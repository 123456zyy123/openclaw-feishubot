const http = require("node:http");
const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { URL, URLSearchParams } = require("node:url");
const { exec } = require("node:child_process");

const { AgentManager } = require("./agent_manager");

const DEFAULT_REQUIREMENT = "Build a ChatGPT-like Q&A login interface";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 3000;
const MAX_BODY_SIZE = 1024 * 1024;
const DEFAULT_USERS_FILE_PATH = path.join(__dirname, "storage", "auth_users.json");
const DEFAULT_TOKEN_TTL_SECONDS = 2 * 60 * 60;
const PASSWORD_HASH_ITERATIONS = 120000;
const PASSWORD_HASH_KEY_LENGTH = 32;
const PASSWORD_HASH_DIGEST = "sha256";

function normalizePort(value) {
  const parsed = Number.parseInt(String(value || ""), 10);
  if (!Number.isInteger(parsed) || parsed <= 0 || parsed > 65535) {
    return DEFAULT_PORT;
  }

  return parsed;
}

function parseCliArgs(argv = []) {
  const args = Array.isArray(argv) ? argv : [];
  const requirementParts = [];
  let openBrowser = false;
  let host = DEFAULT_HOST;
  let port = DEFAULT_PORT;

  for (let index = 0; index < args.length; index += 1) {
    const token = String(args[index] || "");

    if (!token) {
      continue;
    }

    if (token === "--open") {
      openBrowser = true;
      continue;
    }

    if (token === "--host" && args[index + 1]) {
      host = String(args[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith("--host=")) {
      host = String(token.slice("--host=".length) || DEFAULT_HOST);
      continue;
    }

    if (token === "--port" && args[index + 1]) {
      port = normalizePort(args[index + 1]);
      index += 1;
      continue;
    }

    if (token.startsWith("--port=")) {
      port = normalizePort(token.slice("--port=".length));
      continue;
    }

    requirementParts.push(token);
  }

  return {
    requirementText: requirementParts.join(" ").trim() || DEFAULT_REQUIREMENT,
    host,
    port,
    openBrowser,
  };
}

function escapeHtml(text) {
  return String(text || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sendJson(response, statusCode, payload) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
  });
  response.end(JSON.stringify(payload));
}

function sendHtml(response, statusCode, html) {
  response.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*",
  });
  response.end(html);
}

function serveStaticFile(response, uriPath) {
  // Map /dashboard, /chats, etc. directly to public files
  const basename = path.basename(uriPath);
  const targetFile = basename === "" || basename === "/" ? "dashboard-redesign.html" : basename;
  const filePath = path.join(__dirname, "public", targetFile);

  if (fs.existsSync(filePath)) {
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css',
      '.js': 'application/javascript',
      '.json': 'application/json',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.gif': 'image/gif',
      '.svg': 'image/svg+xml'
    };
    
    response.writeHead(200, {
      "Content-Type": mimeTypes[ext] || 'application/octet-stream',
      "Cache-Control": "no-cache"
    });
    fs.createReadStream(filePath).pipe(response);
    return true;
  }
  return false;
}

function buildPreviewHtml({ requirement, pageHtml, runResult }) {
  const safeRequirement = escapeHtml(requirement);
  const fallbackBody = [
    "<style>",
    "  body { margin: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f5f7fa; height: 100vh; display: flex; justify-content: center; align-items: center; color: rgba(0, 0, 0, 0.88); }",
    "  .login-container { width: 100%; max-width: 400px; min-width: 320px; background: #ffffff; border-radius: 12px; padding: 32px 24px; box-shadow: 0 8px 24px rgba(0, 0, 0, 0.08); box-sizing: border-box; }",
    "  .login-title { margin: 0 0 24px 0; text-align: center; font-size: 24px; font-weight: 600; color: rgba(0, 0, 0, 0.85); }",
    "  .form-item { margin-bottom: 24px; display: flex; flex-direction: column; gap: 8px; position: relative; }",
    "  .form-item label { font-size: 14px; color: #333; font-weight: 500; }",
    "  .chat-input { width: 100%; height: 40px; padding: 4px 12px; font-size: 14px; line-height: 1.5714285714285714; background-color: #ffffff; background-image: none; border-width: 1px; border-style: solid; border-color: #ddd; border-radius: 6px; transition: all 0.2s; box-sizing: border-box; outline: none; }",
    "  .chat-input:hover { border-color: #1677ff; }",
    "  .chat-input:focus { border-color: #1677ff; box-shadow: 0 0 0 2px rgba(22, 119, 255, 0.1); outline: 0; }",
    "  .login-btn { width: 100%; height: 40px; font-size: 14px; border-radius: 6px; color: #fff; background-color: #1677ff; box-shadow: 0 2px 0 rgba(5, 145, 255, 0.1); border: transparent; cursor: pointer; transition: all 0.2s cubic-bezier(0.645, 0.045, 0.355, 1); font-weight: 400; display: flex; justify-content: center; align-items: center; gap: 8px; }",
    "  .login-btn:hover { background-color: #0958d9; }",
    "  .login-btn:active { background-color: #0958d9; }",
    "  .login-btn:disabled { background-color: #a0cbf2; cursor: not-allowed; }",
    "  .error-text { color: #ff4d4f; font-size: 12px; margin-top: 4px; display: none; position: absolute; bottom: -20px; left: 0; }",
    "  .form-item.has-error .chat-input { border-color: #ff4d4f; }",
    "  .form-item.has-error .chat-input:focus { box-shadow: 0 0 0 2px rgba(255, 77, 79, 0.1); }",
    "  .form-item.has-error .error-text { display: block; }",
    "</style>",
    "<div class=\"login-container\">",
    "  <h2 class=\"login-title\">用户登录</h2>",
    "  <form id=\"login-form\" novalidate>",
    "    <div class=\"form-item\" id=\"user-item\">",
    "      <label>用户名</label>",
    "      <input name=\"username\" class=\"chat-input\" placeholder=\"请输入用户名\" required />",
    "      <div class=\"error-text\">请输入用户名</div>",
    "    </div>",
    "    <div class=\"form-item\" id=\"pwd-item\">",
    "      <label>密码</label>",
    "      <input name=\"password\" type=\"password\" class=\"chat-input\" placeholder=\"请输入密码\" required />",
    "      <div class=\"error-text\">请输入密码</div>",
    "    </div>",
    "    <button type=\"submit\" class=\"login-btn\" id=\"submit-btn\">登录</button>",
    "  </form>",
    "</div>"
  ].join("\n");
  const body = String(pageHtml || "").trim() || fallbackBody;
  const result = runResult && typeof runResult === "object" ? runResult : {};
  const stepCount = Array.isArray(result.step_results)
    ? result.step_results.length
    : (Array.isArray(result.task_queue) ? result.task_queue.length : 0);
  const optimizationRounds = Number(result.optimization_rounds || 0);
  const memoryReused = Boolean(result.used_memory_code);

  // Sanitize runData to remove sensitive code content
  const sanitizedResult = {
    requirement: result.requirement,
    task_graph: result.task_graph,
    task_queue: result.task_queue,
    task_state_history: result.task_state_history,
    step_results: Array.isArray(result.step_results)
      ? result.step_results.map(step => ({
          taskId: step.taskId,
          task: step.task,
          source: step.source,
          // Remove actual code content for security
        }))
      : [],
    generated_code: "[REDACTED - Login required to view code]",
    code: "[REDACTED - Login required to view code]",
    tests: result.tests,
    reflection: result.reflection ? {
      problems: result.reflection.problems,
      suggestions: result.reflection.suggestions,
      // Remove code content for security
      optimized_code: "[REDACTED - Login required to view code]",
    } : result.reflection,
    optimization_history: Array.isArray(result.optimization_history)
      ? result.optimization_history.map(entry => ({
          round: entry.round,
          problems: entry.problems,
          suggestions: entry.suggestions,
          // Remove code content for security
          code_before: "[REDACTED - Login required to view code]",
          optimized_code: "[REDACTED - Login required to view code]",
        }))
      : result.optimization_history,
    optimization_rounds: result.optimization_rounds,
    learning_summary: result.learning_summary,
    memory_matches: Array.isArray(result.memory_matches)
      ? result.memory_matches.map(match => ({
          type: match.type,
          scope: match.scope,
          requirement: match.requirement,
          root_requirement: match.root_requirement,
          source: match.source,
          timestamp: match.timestamp,
          similarity: match.similarity,
          quality_score: match.quality_score,
          ranking_score: match.ranking_score,
          // Remove code content for security
          generated_code: "[REDACTED - Login required to view code]",
          optimized_code: "[REDACTED - Login required to view code]",
          code: "[REDACTED - Login required to view code]",
        }))
      : result.memory_matches,
    used_memory_code: result.used_memory_code,
  };

  const runDataJson = JSON.stringify(sanitizedResult).replace(/</g, "\\u003c");

  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <link rel="icon" href="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 64 64'%3E%3Ccircle cx='32' cy='32' r='30' fill='%230f766e'/%3E%3Ccircle cx='32' cy='32' r='14' fill='%23ecfeff'/%3E%3C/svg%3E" />
  <title>IntelliCodeAssistant Agent Preview</title>
  <style>
:root {
  --sidebar-bg: #f9f9f8;
  --sidebar-border: #e6e6e6;
  --sidebar-text: #595959;
  --main-bg: #ffffff;
  --text-main: #0d0d0d;
  --text-muted: #737373;
  --user-bubble: #f4f4f0;
  --user-bubble-border: #e5e5e0;
  --primary-button: #2B3631;
  --primary-button-text: #fff;
  --border-radius: 12px;
  --input-border: #e6e6e6;
  --input-focus: #c2c2c2;
  --font-family: ui-sans-serif, -apple-system, system-ui, "Segoe UI", Helvetica, "Apple Color Emoji", Arial, sans-serif;
  --ok: #20875e;
  --warn: #d28c34;
  --danger: #d94b4b;
}
* { box-sizing: border-box; }
body { margin: 0; padding: 0; font-family: var(--font-family); color: var(--text-main); background: var(--main-bg); height: 100vh; display: flex; overflow: hidden; }
.app-shell { display: flex; width: 100vw; height: 100vh; overflow: hidden; }
.sidebar { width: 340px; min-width: 320px; background-color: var(--sidebar-bg); border-right: 1px solid var(--sidebar-border); display: flex; flex-direction: column; padding: 24px 20px; overflow-y: auto; gap: 28px; }
.brand { font-size: 16px; font-weight: 600; color: var(--text-main); margin-bottom: 8px; }
.requirement-chip { font-size: 13px; color: var(--sidebar-text); line-height: 1.4; margin-bottom: 12px; }
.metric-row { display: flex; gap: 6px; flex-wrap: wrap; margin-top: 8px;}
.metric-chip { font-size: 11px; background: #ffffff; border: 1px solid var(--sidebar-border); padding: 4px 6px; border-radius: 6px; color: var(--text-muted); }
.sidebar h2 { font-size: 12px; font-weight: 600; color: var(--sidebar-text); text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 12px 0; }
.sidebar-section { display: flex; flex-direction: column; gap: 8px; }
.main-content { flex: 1; display: flex; flex-direction: column; background: var(--main-bg); position: relative; }
.chat-area { flex: 1; overflow-y: auto; padding: 40px 20px 140px 20px; display: flex; flex-direction: column; align-items: center; }
.message-list { width: 100%; max-width: 768px; display: flex; flex-direction: column; gap: 32px; }
.message { display: flex; flex-direction: column; width: 100%; }
.message.user { align-items: flex-end; }
.message.assistant { align-items: flex-start; }
.message-meta { font-size: 12px; font-weight: 500; margin-bottom: 6px; color: var(--text-muted); text-transform: uppercase; display: flex; align-items: center; gap: 6px;}
.message-body { font-size: 15px; line-height: 1.6; white-space: pre-wrap; word-break: break-word; max-width: 90%; padding: 14px 18px; }
.message.user .message-body { background: var(--user-bubble); border: 1px solid var(--user-bubble-border); border-radius: 18px 18px 4px 18px; color: var(--text-main); }
.message.assistant .message-body { background: none; border-radius: 0; padding: 0; max-width: 100%; }
.assistant-card { display: flex; flex-direction: column; gap: 8px; width: 100%; margin-top: 12px; border-left: 3px solid #e5e5e0; padding-left: 14px; }
.assistant-meta { font-size: 12px; color: var(--text-muted); display: flex; gap: 8px; align-items: center; }
.assistant-chip, .assistant-steps li { font-size: 12px; background: #fff; padding: 4px 10px; border-radius: 6px; color: #555; border: 1px solid #e5e5e0; }
.assistant-steps { list-style: none; padding: 0; margin: 0; display: flex; gap: 6px; flex-wrap: wrap; }
.assistant-code { background: #fcfcfc; border: 1px solid #f0f0f0; padding: 14px; border-radius: 8px; font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace; font-size: 13px; overflow-x: auto; margin-top: 12px; }
.input-area { position: absolute; bottom: 0; left: 0; right: 0; background: linear-gradient(180deg, transparent, rgba(255,255,255,0.9) 25%, #ffffff 100%); padding: 20px 20px 30px; display: flex; justify-content: center; }
.agent-composer { width: 100%; max-width: 768px; background: #f4f4f0; border: 1px solid transparent; border-radius: 16px; display: flex; flex-direction: column; padding: 10px 14px; transition: border-color 0.2s ease, background 0.2s ease; }
.agent-composer:focus-within { background: #ffffff; border-color: var(--input-border); box-shadow: 0 4px 20px rgba(0,0,0,0.06); }
.agent-input { width: 100%; border: none; background: none; resize: none; font-size: 15px; font-family: var(--font-family); color: var(--text-main); padding: 8px 4px; min-height: 48px; max-height: 200px; outline: none; }
.agent-input::placeholder { color: #a3a3a3; }
.agent-composer-actions { display: flex; justify-content: space-between; align-items: center; padding: 6px 4px 2px; }
.agent-hint { font-size: 12px; color: var(--text-muted); }
.agent-submit { background: var(--primary-button); color: var(--primary-button-text); border: none; padding: 8px 18px; border-radius: 20px; font-size: 13px; font-weight: 500; cursor: pointer; transition: opacity 0.2s, background 0.2s; }
.agent-submit:disabled { opacity: 0.3; cursor: not-allowed; }
.agent-submit:hover:not(:disabled) { background: #1a221f; }
.timeline { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; gap: 8px; }
.timeline-item { font-size: 12px; padding: 12px; background: #ffffff; border: 1px solid var(--sidebar-border); border-radius: 8px; }
.timeline-head { display: flex; gap: 8px; align-items: center; margin-bottom: 6px; }
.timeline-index { background: var(--text-muted); color: #fff; border-radius: 4px; padding: 2px 6px; font-weight: bold; font-size: 10px; }
.timeline-task { font-weight: 600; color: var(--text-main); line-height: 1.4; }
.timeline-source { font-size: 10px; border: 1px solid #e0e0e0; padding: 1px 5px; border-radius: 4px; color: #666; }
.timeline-source.memory { background: #f0fdf4; border-color: #bbf7d0; color: #166534; }
.timeline-status { color: var(--text-muted); }
.timeline-empty { font-size: 12px; color: var(--text-muted); padding: 12px; border: 1px dashed #ccc; border-radius: 8px; text-align: center; }
.generated-view { background: #ffffff; border: 1px solid var(--sidebar-border); border-radius: 8px; padding: 16px; margin-bottom: 12px; box-shadow: 0 1px 3px rgba(0,0,0,0.02);}
.generated-view input { width: 100%; padding: 10px 12px; border: 1px solid var(--input-border); border-radius: 6px; margin-bottom: 12px; font-size: 14px; }
.generated-view button { width: 100%; padding: 10px; background: var(--primary-button); color: #fff; border: none; border-radius: 6px; cursor: pointer; font-size: 14px; font-weight: 500; }
.status-pill { display: flex; align-items: center; gap: 6px; font-size: 12px; margin-bottom: 16px; background: #fff; border: 1px solid var(--sidebar-border); padding: 8px 12px; border-radius: 6px; font-weight: 500;}
.dot { width: 8px; height: 8px; border-radius: 50%; background: #e0e0e0; }
.dot.ok { background: var(--ok); box-shadow: 0 0 0 3px rgba(32,135,94,0.15);}
.dot.warn { background: var(--warn); }
.dot.error { background: var(--danger); box-shadow: 0 0 0 3px #ffe4e6; }
.token-box { background: #ffffff; border: 1px solid var(--sidebar-border); border-radius: 8px; padding: 16px; font-size: 12px; }
.token-head { margin-bottom: 10px; font-weight: 600; color: var(--sidebar-text); }
#token-view { background: #fafafa; padding: 8px; border-radius: 6px; font-family: monospace; word-break: break-all; margin: 0 0 12px 0; color: var(--text-main); border: 1px solid #f0f0f0;}
.button-row { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 12px; }
.btn { padding: 8px; font-size: 12px; border: 1px solid var(--input-border); background: #ffffff; border-radius: 6px; cursor: pointer; font-weight: 500; color: var(--text-main); transition: background 0.15s;}
.btn:hover:not(:disabled) { background: #f4f4f0; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
#logout-btn { color: #dc2626; border-color: #fecaca; }
#logout-btn:hover:not(:disabled) { background: #fef2f2; }
.demo-action-board { margin-top: 16px; background: #fafafa; border: 1px solid var(--sidebar-border); padding: 12px; border-radius: 8px; }
.demo-action-head { font-weight: 600; font-size: 11px; margin-bottom: 10px; text-transform: uppercase; color: var(--text-muted); }
.action-row { display: flex; justify-content: space-between; align-items: center; font-size: 11px; margin-bottom: 8px; }
.action-label { color: var(--text-main); font-weight: 500;}
.action-badge { background: #ffffff; border: 1px solid #ccc; padding: 2px 6px; border-radius: 4px; color: var(--text-muted); font-weight: 600; }
.action-badge.ok { border-color: #86efac; color: #166534; background: #f0fdf4; }
.action-badge.error { border-color: #fca5a5; color: #991b1b; background: #fef2f2; }
#helper-text { font-size: 11px; color: var(--text-muted); margin-top: 16px; line-height: 1.5; }
.activity-feed { list-style: none; padding: 0; margin: 12px 0 0; font-size: 11px; display: flex; flex-direction: column; gap: 6px; }
.activity-item { padding: 8px 10px; border-radius: 6px; background: #ffffff; border: 1px solid var(--sidebar-border); line-height: 1.4;}
.activity-item.ok { border-color: #86efac; background: #f0fdf4; color: #166534; }
.activity-item.warn { border-color: #fdba74; background: #fff7ed; color: #9a3412; }
.activity-item.error { border-color: #fca5a5; background: #fef2f2; color: #991b1b; }
#login-result { font-family: ui-monospace, monospace; font-size: 11px; background: #f4f4f0; color: #333; padding: 12px; border-radius: 8px; overflow-x: auto; margin-top: 16px; line-height: 1.4; border: 1px solid #e0e0e0;}
.frontend-error-panel { background: #fef2f2; border: 1px solid #fecaca; padding: 12px; border-radius: 8px; font-size: 11px; margin-top: 16px; }
.frontend-error-head { font-weight: 600; color: #991b1b; margin-bottom: 8px; }
.frontend-error-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.frontend-error-item { background: #ffffff; border: 1px solid #fca5a5; padding: 8px; border-radius: 4px; color: #7f1d1d; }
.conversation-strip-head { font-size: 12px; font-weight: 600; color: var(--sidebar-text); text-transform: uppercase; margin-bottom: 8px; }
.conversation-strip { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 6px; }
.conversation-item { font-size: 13px; padding: 10px 12px; background: #ffffff; border: 1px solid var(--sidebar-border); border-radius: 8px; cursor: pointer; transition: background 0.15s; }
.conversation-item:hover { background: #f4f4f0; }
.conversation-main { margin-bottom: 4px; font-weight: 500; color: var(--text-main);}
.conversation-meta { font-size: 11px; color: var(--text-muted); }
  .hidden { display: none !important; }
  body.not-logged-in .sidebar { display: none !important; }
  body.not-logged-in .main-content { display: none !important; }
  body.not-logged-in .app-shell { display: flex; align-items: center; justify-content: center; width: 100vw; height: 100vh; background-color: #f5f7fa; }
  body.not-logged-in #login-playground { display: flex !important; position: static !important; width: 100vw !important; height: 100vh !important; background: transparent !important; z-index: 10000; align-items: center; justify-content: center; }

</style>
</head>
<body class="not-logged-in">
  <div class="app-shell">
    <aside class="sidebar">
      <div>
        <div class="brand">Agent Control Plane</div>
        <div class="requirement-chip">Requirement: ${safeRequirement}</div>
        <div class="metric-row">
          <span class="metric-chip">Steps: ${stepCount}</span>
          <span class="metric-chip">Optimization: ${optimizationRounds}</span>
          <span class="metric-chip">Memory: ${memoryReused ? "Yes" : "No"}</span>
        </div>
      </div>

      <div class="sidebar-section">
        <div class="conversation-strip-head">Recent Runs</div>
        <ul id="conversation-list" class="conversation-strip"></ul>
      </div>

      <div class="sidebar-section">
        <h2>Agent Flow</h2>
        <ol id="agent-timeline" class="timeline"></ol>
      </div>

      <div class="sidebar-section">
        <h2>Runtime Console</h2>
        <div class="login-playground-title" style="font-size:11px;font-weight:600;margin-bottom:8px;color:var(--text-muted);text-transform:uppercase;">Auth Playground</div>
        <button type="button" class="btn" style="width:100%; margin-bottom:8px;" onclick="document.getElementById('login-playground').style.display='flex'">重新打开登录界面</button>
        <a href="/preview" target="_blank" style="display:block; text-decoration:none; text-align:center; padding:12px; background:#fff; border:1px solid var(--sidebar-border); color:var(--text-main); border-radius:6px; font-size:12px; font-weight:500; margin-bottom:12px; transition:background 0.2s;">在新标签打开 (跳转)</a>
        <div class="status-pill">
          <span id="auth-dot" class="dot"></span>
          <span id="auth-text">未登录</span>
        </div>
        <div class="token-box">
          <div class="token-head">Current Token (masked)</div>
          <pre id="token-view">-</pre>
          <div class="button-row">
            <button id="copy-token" class="btn" disabled>复制 Token</button>
            <button id="logout-btn" class="btn" disabled>退出登录</button>
          </div>
          <button id="fill-demo" class="btn" type="button" style="width:100%;margin-bottom:8px;">填充演示账号</button>
          <button id="quick-login" class="btn" type="button" style="width:100%;margin-bottom:8px; background:var(--primary-button); color:#fff; border:none;">一键演示登录</button>
          <button id="reset-demo" class="btn" type="button" style="width:100%;">重置演示账号</button>
          <div class="demo-action-board" id="demo-action-board">
            <div class="demo-action-head">Button Demo Status</div>
            <div class="action-row">
              <span class="action-label">填充演示账号</span>
              <span class="action-badge" id="action-fill-state">待执行</span>
            </div>
            <div class="action-row">
              <span class="action-label">一键演示登录</span>
              <span class="action-badge" id="action-quick-state">待执行</span>
            </div>
            <div class="action-row">
              <span class="action-label">重置演示账号</span>
              <span class="action-badge" id="action-reset-state">待执行</span>
            </div>
          </div>
        </div>
        <p id="helper-text">提交表单后将显示接口返回与当前登录状态。</p>
        <ul id="activity-feed" class="activity-feed"></ul>
        <section id="frontend-error-panel" class="frontend-error-panel" hidden>
          <div class="frontend-error-head">前端异常捕获</div>
          <ul id="frontend-error-list" class="frontend-error-list"></ul>
        </section>
        <pre id="login-result" data-state="idle">等待提交登录请求...</pre>
      </div>
    </aside>

    <div class="generated-view" id="login-playground" style="position:fixed; top:0; left:0; width:100vw; height:100vh; z-index:9999; background:#f5f7fa; padding:0; border:none; display:none; align-items: center; justify-content: center;">
      <button type="button" onclick="document.getElementById('login-playground').style.display='none'" style="position:absolute; top:20px; right:20px; z-index:10000; padding:8px 16px; background:var(--sidebar-border); border:none; border-radius:8px; cursor:pointer;">跳过 (在侧边栏一键登录)</button>
      <iframe id="login-playground-frame" srcdoc="${body.replace(/"/g, '&quot;')}" sandbox="allow-scripts allow-forms allow-same-origin" style="width:100%; height:100%; border:none; background:transparent;"></iframe>
    </div>

    <main class="main-content">
      <div class="chat-area">
        <div id="message-list" class="message-list"></div>
      </div>
      
      <div class="input-area">
        <form id="agent-run-form" class="agent-composer">
          <textarea id="agent-input" class="agent-input" rows="1" placeholder="给助手发送要求，例如：开发一个带注册、登录的网站"></textarea>
          <div class="agent-composer-actions">
            <span class="agent-hint">Tip: 登录后可在此直接调用你的 Agent。</span>
            <button id="agent-run-btn" class="agent-submit" type="submit" disabled>发送并运行</button>
          </div>
        </form>
      </div>
    </main>
  </div>

  <script id="run-data" type="application/json">${runDataJson}</script>
  <script>
    (function () {
      const tokenStorageKey = "preview_demo_token";
      const output = document.querySelector("#login-result");
      const helperText = document.querySelector("#helper-text");
      const authDot = document.querySelector("#auth-dot");
      const authText = document.querySelector("#auth-text");
      const tokenView = document.querySelector("#token-view");
      const copyButton = document.querySelector("#copy-token");
      const logoutButton = document.querySelector("#logout-btn");
      const fillDemoButton = document.querySelector("#fill-demo");
      const quickLoginButton = document.querySelector("#quick-login");
      const resetDemoButton = document.querySelector("#reset-demo");
      const actionFillState = document.querySelector("#action-fill-state");
      const actionQuickState = document.querySelector("#action-quick-state");
      const actionResetState = document.querySelector("#action-reset-state");
      const activityFeed = document.querySelector("#activity-feed");
      const frontendErrorPanel = document.querySelector("#frontend-error-panel");
      const frontendErrorList = document.querySelector("#frontend-error-list");
      const timeline = document.querySelector("#agent-timeline");
      const conversationList = document.querySelector("#conversation-list");
      const messageList = document.querySelector("#message-list");
      const agentRunForm = document.querySelector("#agent-run-form");
      const agentRunInput = document.querySelector("#agent-input");
      const agentRunButton = document.querySelector("#agent-run-btn");
      const runDataNode = document.querySelector("#run-data");
      const loginPlayground = document.querySelector("#login-playground");
      const loginIframe = document.querySelector("#login-playground-frame");
      let isAgentRunning = false;

      let runData = {};
      try {
        runData = JSON.parse((runDataNode && runDataNode.textContent) || "{}");
      } catch (error) {
        runData = {};
      }

      const initialStepCount = Array.isArray(runData.step_results)
        ? runData.step_results.length
        : (Array.isArray(runData.task_queue) ? runData.task_queue.length : 0);

      function escapeText(text) {
        return String(text || "")
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;")
          .replace(/\"/g, "&quot;")
          .replace(/'/g, "&#39;");
      }

      function summarizeRun(payload) {
        const source = payload && typeof payload === "object" ? payload : {};
        const steps = Array.isArray(source.step_results)
          ? source.step_results.length
          : (Array.isArray(source.task_queue) ? source.task_queue.length : 0);
        return {
          steps,
          optimization_rounds: Number(source.optimization_rounds || 0),
          memory_reused: Boolean(source.used_memory_code),
        };
      }

      function buildSummaryText(summary) {
        const source = summary && typeof summary === "object" ? summary : {};
        return [
          "steps " + Number(source.steps || 0),
          "rounds " + Number(source.optimization_rounds || 0),
          "memory " + (source.memory_reused ? "yes" : "no"),
        ].join(" | ");
      }

      function setResult(state, content) {
        if (!output) {
          return;
        }
        output.dataset.state = state || "idle";
        output.textContent = String(content || "");
      }

      function formatToken(rawToken) {
        const token = String(rawToken || "");
        if (!token) {
          return "-";
        }
        if (token.length <= 30) {
          return token;
        }
        return token.slice(0, 14) + "..." + token.slice(-8);
      }

      function setAgentComposerEnabled(enabled, placeholderText) {
        if (agentRunInput) {
          agentRunInput.disabled = !enabled;
          if (!enabled) {
            agentRunInput.placeholder = String(placeholderText || "Please login before running the agent.");
          }
        }
        if (agentRunButton) {
          agentRunButton.disabled = !enabled;
        }
      }

      function setAuthState(state, note, token) {
        const currentState = String(state || "idle");
        const statusMap = {
          idle: "未登录",
          loading: "请求中",
          logged_in: "已登录",
          logged_out: "已退出",
          warn: "待处理",
          error: "失败",
        };
        const dotMap = {
          idle: "dot",
          loading: "dot warn",
          logged_in: "dot ok",
          logged_out: "dot warn",
          warn: "dot warn",
          error: "dot error",
        };

        if (authDot) {
          authDot.className = dotMap[currentState] || "dot";
        }
        if (authText) {
          authText.textContent = statusMap[currentState] || statusMap.idle;
        }
        if (helperText) {
          helperText.textContent = String(note || "Submit login request to update auth status.");
        }

        const safeToken = String(token || "");
        if (tokenView) {
          tokenView.textContent = formatToken(safeToken);
          tokenView.title = safeToken || "";
        }
        if (copyButton) {
          copyButton.disabled = !safeToken;
        }
        if (logoutButton) {
          logoutButton.disabled = !safeToken;
        }

        setAgentComposerEnabled(Boolean(safeToken), "Please login before running the agent.");
      }

      function setButtonBusy(button, busy, busyText) {
        if (!button) {
          return;
        }
        if (!button.dataset.idleText) {
          button.dataset.idleText = button.textContent;
        }
        button.disabled = Boolean(busy);
        button.textContent = busy
          ? String(busyText || "Processing...")
          : String(button.dataset.idleText || button.textContent || "");
      }

      function setDemoActionState(actionKey, status, detail) {
        const map = {
          fill: actionFillState,
          quick: actionQuickState,
          reset: actionResetState,
        };
        const node = map[String(actionKey || "")];
        if (!node) {
          return;
        }
        const statusMap = {
          idle: "待执行",
          busy: "执行中",
          ok: "成功",
          warn: "提醒",
          error: "失败",
        };
        const current = String(status || "idle");
        node.className = "action-badge " + (current === "idle" ? "" : current);
        node.textContent = (statusMap[current] || statusMap.idle) + " " + new Date().toLocaleTimeString();
        node.title = String(detail || "");
      }

      function pushActivity(kind, message) {
        if (!activityFeed) {
          return;
        }
        const item = document.createElement("li");
        item.className = ("activity-item " + (kind || "")).trim();
        item.textContent = new Date().toLocaleTimeString() + " - " + String(message || "");
        activityFeed.prepend(item);
        while (activityFeed.childElementCount > 8) {
          activityFeed.removeChild(activityFeed.lastElementChild);
        }
      }

      function reportClientError(message) {
        if (!frontendErrorPanel || !frontendErrorList) {
          return;
        }
        frontendErrorPanel.hidden = false;
        const item = document.createElement("li");
        item.className = "frontend-error-item";
        item.textContent = String(message || "Unknown client error");
        frontendErrorList.prepend(item);
        while (frontendErrorList.childElementCount > 5) {
          frontendErrorList.removeChild(frontendErrorList.lastElementChild);
        }
      }

      window.addEventListener("error", function (event) {
        const msg = event && event.message ? event.message : "Unknown script error";
        reportClientError(msg);
        pushActivity("error", "Frontend error: " + msg);
      });

      window.addEventListener("unhandledrejection", function (event) {
        const reason = event && event.reason
          ? String(event.reason.message || event.reason)
          : "Unhandled Promise Rejection";
        reportClientError(reason);
        pushActivity("error", "Promise rejection: " + reason);
      });

      function resolveLoginInputs() {
        const docRoot = loginIframe && loginIframe.contentDocument
          ? loginIframe.contentDocument
          : document;
        const currentForm = docRoot.querySelector("#login-form") || docRoot.querySelector("form") || document.querySelector("#login-form");
        const usernameInput = currentForm
          ? (currentForm.querySelector('input[name="username"]')
            || currentForm.querySelector('input[name="user"]')
            || currentForm.querySelector('input[name="email"]')
            || currentForm.querySelector('input[type="text"]')
            || currentForm.querySelector('input[type="email"]'))
          : null;
        const passwordInput = currentForm
          ? (currentForm.querySelector('input[name="password"]')
            || currentForm.querySelector('input[name="pass"]')
            || currentForm.querySelector('input[name="pwd"]')
            || currentForm.querySelector('input[type="password"]'))
          : null;
        return {
          currentForm,
          usernameInput,
          passwordInput,
        };
      }

      function readLoginPayload() {
        const refs = resolveLoginInputs();
        const fallbackData = refs.currentForm ? new FormData(refs.currentForm) : new FormData();
        return {
          username: refs.usernameInput
            ? String(refs.usernameInput.value || "").trim()
            : String(fallbackData.get("username") || fallbackData.get("user") || fallbackData.get("email") || "").trim(),
          password: refs.passwordInput
            ? String(refs.passwordInput.value || "")
            : String(fallbackData.get("password") || fallbackData.get("pass") || fallbackData.get("pwd") || ""),
        };
      }

      function fillLoginInputs() {
        const refs = resolveLoginInputs();
        if (refs.usernameInput) {
          refs.usernameInput.value = "admin";
        }
        if (refs.passwordInput) {
          refs.passwordInput.value = "123456";
          refs.passwordInput.focus();
        }
        return Boolean(refs.usernameInput && refs.passwordInput);
      }

      async function loginWithDemoCredentials(actionKey) {
        if (actionKey) {
          setDemoActionState(actionKey, "busy", "Requesting /api/login");
        }
        setAuthState("loading", "Requesting /api/login ...", "");
        setResult("loading", "Requesting /api/login ...");

        const response = await fetch("/api/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username: "admin", password: "123456" }),
        });
        const data = await response.json();

        if (response.ok && data && data.ok && data.token) {
          const token = String(data.token);
          localStorage.setItem(tokenStorageKey, token);
          localStorage.setItem(tokenStorageKey + "_expires", String(data.expires_at || ""));
          setAuthState("logged_in", "Demo login success", token);
          setResult("success", JSON.stringify(data, null, 2));
          if (actionKey) {
            setDemoActionState(actionKey, "ok", "Demo login success");
          }
          await refreshAgentHistory();
          return true;
        }

        localStorage.removeItem(tokenStorageKey);
        localStorage.removeItem(tokenStorageKey + "_expires");
        setAuthState("error", (data && data.message) || "Login failed", "");
        setResult("error", JSON.stringify(data, null, 2));
        if (actionKey) {
          setDemoActionState(actionKey, "error", (data && data.message) || "Demo login failed");
        }
        return false;
      }

      function appendMessage(role, html) {
        if (!messageList) {
          return null;
        }
        const item = document.createElement("article");
        item.className = "message " + (role || "assistant");
        item.innerHTML = html;
        messageList.appendChild(item);
        messageList.scrollTop = messageList.scrollHeight;
        return item;
      }

      function appendUserMessage(promptText) {
        return appendMessage("user", "<div class=\"message-meta\">You</div><div class=\"message-body\">" + escapeText(promptText) + "</div>");
      }

      function appendAssistantMessage(promptText, payload) {
        const summary = summarizeRun(payload || {});
        const steps = Array.isArray(payload && payload.step_results)
          ? payload.step_results
          : [];
        const stepsHtml = steps.slice(0, 6).map(function (item, index) {
          return "<li>" + (index + 1) + ". " + escapeText(item.task || "Untitled Task") + "</li>";
        }).join("");
        const body = [
          "<div class=\"message-meta\">Agent</div>",
          "<section class=\"assistant-card\">",
          "<div class=\"assistant-meta\"><span class=\"assistant-chip\">steps: " + summary.steps + "</span><span class=\"assistant-chip\">rounds: " + summary.optimization_rounds + "</span></div>",
          "<div class=\"message-body\">" + escapeText(promptText || "Agent response") + "</div>",
          stepsHtml ? "<ul class=\"assistant-steps\">" + stepsHtml + "</ul>" : "<div class=\"assistant-empty\">No step details</div>",
          "</section>",
        ].join("");
        return appendMessage("assistant", body);
      }

      function renderConversationList(items) {
        if (!conversationList) {
          return;
        }
        const source = Array.isArray(items) ? items : [];
        if (source.length === 0) {
          conversationList.innerHTML = "<li class=\"conversation-item\"><div class=\"conversation-main\">No history</div><div class=\"conversation-meta\">Login to load runs</div></li>";
          return;
        }
        conversationList.innerHTML = source.map(function (item) {
          const prompt = String(item.prompt || "Untitled prompt");
          const summary = buildSummaryText(item.summary || {});
          const createdAt = item.created_at ? new Date(item.created_at).toLocaleString() : "Unknown time";
          return "<li class=\"conversation-item\" data-prompt=\"" + escapeText(prompt) + "\"><div class=\"conversation-main\">" + escapeText(prompt) + "</div><div class=\"conversation-meta\">" + escapeText(createdAt + " | " + summary) + "</div></li>";
        }).join("");

        Array.from(conversationList.querySelectorAll(".conversation-item[data-prompt]")).forEach(function (node) {
          node.addEventListener("click", function () {
            if (agentRunInput) {
              agentRunInput.value = String(node.dataset.prompt || "");
              agentRunInput.focus();
            }
          });
        });
      }

      async function refreshAgentHistory() {
        const token = String(localStorage.getItem(tokenStorageKey) || "");
        if (!token) {
          renderConversationList([]);
          return;
        }
        try {
          const response = await fetch("/api/agent/history", {
            headers: { Authorization: "Bearer " + token },
          });
          const data = await response.json();
          if (response.ok && data && data.ok && Array.isArray(data.items)) {
            renderConversationList(data.items);
            return;
          }
        } catch (error) {
          pushActivity("warn", "Failed to load /api/agent/history");
        }
        renderConversationList([]);
      }

      function renderTimeline() {
        if (!timeline) {
          return;
        }
        const steps = Array.isArray(runData.step_results)
          ? runData.step_results
          : (Array.isArray(runData.task_queue) ? runData.task_queue : []);
        if (steps.length === 0) {
          timeline.innerHTML = "<li class=\"timeline-empty\">No steps</li>";
          return;
        }
        timeline.innerHTML = steps.map(function (item, index) {
          const source = String(item.source || "generated");
          const status = String(item.status || "done");
          return "<li class=\"timeline-item\"><div class=\"timeline-head\"><span class=\"timeline-index\">" + (index + 1) + "</span><span class=\"timeline-source " + (source === "memory" ? "memory" : "") + "\">" + escapeText(source) + "</span></div><div class=\"timeline-task\">" + escapeText(item.task || "Untitled Task") + "</div><div class=\"timeline-status\">status: " + escapeText(status) + "</div></li>";
        }).join("");
      }

      async function runAgent(promptText) {
        if (isAgentRunning) {
          pushActivity("warn", "Agent is already running");
          return;
        }

        const token = String(localStorage.getItem(tokenStorageKey) || "");
        if (!token) {
          setAuthState("warn", "Please login first", "");
          return;
        }

        const prompt = String(promptText || "").trim();
        if (!prompt) {
          return;
        }

        isAgentRunning = true;
        appendUserMessage(prompt);
        setResult("loading", "Requesting /api/agent/run ...");
        pushActivity("warn", "Requesting /api/agent/run");
        if (agentRunButton) {
          agentRunButton.disabled = true;
        }

        try {
          const response = await fetch("/api/agent/run", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ prompt: prompt }),
          });
          const data = await response.json();
          if (!response.ok || !data || !data.ok || !data.result) {
            throw new Error((data && data.message) || "Agent run failed");
          }
          runData = data.result;
          renderTimeline();
          appendAssistantMessage(prompt, data.result);
          setResult("success", JSON.stringify(data, null, 2));
          setAuthState("logged_in", "Agent run finished", token);
          await refreshAgentHistory();
        } catch (error) {
          const message = String(error && error.message ? error.message : error);
          setResult("error", message);
          pushActivity("error", message);
        } finally {
          isAgentRunning = false;
          if (agentRunButton) {
            agentRunButton.disabled = !String(localStorage.getItem(tokenStorageKey) || "");
          }
        }
      }

      async function onLogout() {
        const token = String(localStorage.getItem(tokenStorageKey) || "");
        if (!token) {
          setAuthState("logged_out", "No token found", "");
          setResult("idle", "No token found");
          return;
        }
        setAuthState("loading", "Requesting /api/logout ...", token);
        setResult("loading", "Requesting /api/logout ...");
        try {
          const response = await fetch("/api/logout", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ token: token }),
          });
          const data = await response.json();
          localStorage.removeItem(tokenStorageKey);
          localStorage.removeItem(tokenStorageKey + "_expires");
          setAuthState("logged_out", (data && data.message) || "Logged out", "");
          setResult("success", JSON.stringify(data, null, 2));
          await refreshAgentHistory();
        } catch (error) {
          setAuthState("error", "Logout request failed", token);
          setResult("error", String(error && error.message ? error.message : error));
        }
      }

      async function restoreSession() {
        const token = String(localStorage.getItem(tokenStorageKey) || "");
        if (!token) {
          setAuthState("idle", "Please login with your account", "");
          await refreshAgentHistory();
          return;
        }
        setAuthState("loading", "Requesting /api/me ...", token);
        try {
          const response = await fetch("/api/me", {
            headers: { Authorization: "Bearer " + token },
          });
          const data = await response.json();
          if (response.ok && data && data.ok) {
            setAuthState("logged_in", "Welcome back " + (data.user && data.user.username ? data.user.username : "user"), token);
            await refreshAgentHistory();
            return;
          }
          localStorage.removeItem(tokenStorageKey);
          localStorage.removeItem(tokenStorageKey + "_expires");
          setAuthState("idle", "Session expired", "");
          await refreshAgentHistory();
        } catch (error) {
          setAuthState("warn", "Failed to validate session", "");
          await refreshAgentHistory();
        }
      }

      function bindLoginForm() {
        const refs = resolveLoginInputs();
        const currentForm = refs.currentForm;
        if (!currentForm) {
          setAuthState("warn", "Login form not found", "");
          setResult("idle", "No login form detected in generated page.");
          return;
        }

        currentForm.setAttribute("method", "post");
        currentForm.setAttribute("action", "javascript:void(0)");

        if (currentForm.dataset.boundSubmit === "1") {
          return;
        }

        currentForm.addEventListener("submit", async function (event) {
          event.preventDefault();
          const payload = readLoginPayload();
          if (!payload.username || !payload.password) {
            setAuthState("warn", "Username and password are required", "");
            setResult("error", JSON.stringify({ ok: false, message: "Username and password are required." }, null, 2));
            return;
          }

          setAuthState("loading", "Requesting /api/login ...", "");
          setResult("loading", "Requesting /api/login ...");
          try {
            const response = await fetch("/api/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(payload),
            });
            const data = await response.json();
            if (response.ok && data && data.ok && data.token) {
              localStorage.setItem(tokenStorageKey, String(data.token));
              localStorage.setItem(tokenStorageKey + "_expires", String(data.expires_at || ""));
              setAuthState("logged_in", "Login success", String(data.token));
              setResult("success", JSON.stringify(data, null, 2));
              await refreshAgentHistory();
              return;
            }
            localStorage.removeItem(tokenStorageKey);
            localStorage.removeItem(tokenStorageKey + "_expires");
            setAuthState("error", (data && data.message) || "Login failed", "");
            setResult("error", JSON.stringify(data, null, 2));
          } catch (error) {
            setAuthState("error", "Network error while logging in", "");
            setResult("error", String(error && error.message ? error.message : error));
          }
        });

        currentForm.dataset.boundSubmit = "1";
      }

      if (fillDemoButton) {
        fillDemoButton.addEventListener("click", function () {
          setDemoActionState("fill", "busy", "Filling admin credentials");
          const filled = fillLoginInputs();
          setDemoActionState("fill", filled ? "ok" : "warn", filled ? "Filled admin / 123456" : "Input controls not found");
        });
      }

      if (quickLoginButton) {
        quickLoginButton.addEventListener("click", async function () {
          setButtonBusy(quickLoginButton, true, "Logging in...");
          try {
            await loginWithDemoCredentials("quick");
          } catch (error) {
            setAuthState("error", "Demo login failed", "");
            setResult("error", String(error && error.message ? error.message : error));
          } finally {
            setButtonBusy(quickLoginButton, false);
          }
        });
      }

      if (resetDemoButton) {
        resetDemoButton.addEventListener("click", async function () {
          setButtonBusy(resetDemoButton, true, "Resetting...");
          setDemoActionState("reset", "busy", "Requesting /api/reset-demo-user");
          setResult("loading", "Requesting /api/reset-demo-user ...");
          try {
            const response = await fetch("/api/reset-demo-user", { method: "POST" });
            const data = await response.json();
            if (!response.ok || !data || !data.ok) {
              throw new Error((data && data.message) || "Reset failed");
            }
            localStorage.removeItem(tokenStorageKey);
            localStorage.removeItem(tokenStorageKey + "_expires");
            fillLoginInputs();
            setAuthState("idle", "Demo account reset to admin / 123456", "");
            setResult("success", JSON.stringify(data, null, 2));
            setDemoActionState("reset", "ok", "Demo account reset");
          } catch (error) {
            setResult("error", String(error && error.message ? error.message : error));
            setDemoActionState("reset", "error", String(error && error.message ? error.message : error));
          } finally {
            setButtonBusy(resetDemoButton, false);
          }
        });
      }

      if (copyButton) {
        copyButton.addEventListener("click", async function () {
          const token = String(localStorage.getItem(tokenStorageKey) || "");
          if (!token) {
            return;
          }
          try {
            await navigator.clipboard.writeText(token);
            setAuthState("logged_in", "Token copied", token);
          } catch (error) {
            setAuthState("warn", "Clipboard copy blocked", token);
          }
        });
      }

      if (logoutButton) {
        logoutButton.addEventListener("click", onLogout);
      }

      if (agentRunForm && agentRunInput) {
        agentRunForm.addEventListener("submit", async function (event) {
          event.preventDefault();
          const prompt = String(agentRunInput.value || "").trim();
          if (!prompt) {
            return;
          }
          agentRunInput.value = "";
          await runAgent(prompt);
        });
      }

      if (loginIframe) {
        loginIframe.addEventListener("load", bindLoginForm);
      }
      bindLoginForm();

      const query = new URLSearchParams(window.location.search || "");
      if (query.has("username") || query.has("password")) {
        window.history.replaceState({}, "", window.location.pathname);
      }

      renderTimeline();
      appendAssistantMessage(
        String((runData.requirement && (runData.requirement["原始需求"] || runData.requirement.functionName)) || "Initial run"),
        runData,
      );
      pushActivity("", "Loaded, initial step count: " + initialStepCount);
      restoreSession();
      setResult("idle", "Ready. Use /api/login to authenticate, then /api/agent/run.");
      setDemoActionState("fill", "idle", "Idle");
      setDemoActionState("quick", "idle", "Idle");
      setDemoActionState("reset", "idle", "Idle");
    })();
  </script>
</body>
</html>`;
}

function loadGeneratedExports(code) {
  const moduleRef = { exports: {} };
  const sourceCode = String(code || "");

  if (!sourceCode.trim()) {
    return moduleRef.exports;
  }

  const factory = new Function("module", "exports", "require", `${sourceCode}\n;return module.exports;`);
  const exported = factory(moduleRef, moduleRef.exports, require);
  if (exported && typeof exported === "object") {
    return exported;
  }

  return moduleRef.exports;
}

function parseBodyToObject(rawBody, contentType) {
  const body = String(rawBody || "");
  if (!body) {
    return {};
  }

  const normalizedType = String(contentType || "").split(";")[0].trim().toLowerCase();

  if (normalizedType === "application/json") {
    return JSON.parse(body);
  }

  if (normalizedType === "application/x-www-form-urlencoded") {
    const params = new URLSearchParams(body);
    const result = {};
    for (const [key, value] of params.entries()) {
      result[String(key || "")] = String(value || "");
    }
    return result;
  }

  return JSON.parse(body);
}

function readRequestBody(request) {
  return new Promise((resolve, reject) => {
    let rawBody = "";

    request.on("data", (chunk) => {
      rawBody += chunk;
      if (rawBody.length > MAX_BODY_SIZE) {
        reject(new Error("Request body too large"));
      }
    });

    request.on("end", () => resolve(rawBody));
    request.on("error", reject);
  });
}

function toBase64Url(input) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function fromBase64Url(text) {
  const source = String(text || "").replace(/-/g, "+").replace(/_/g, "/");
  const padLength = source.length % 4 === 0 ? 0 : 4 - (source.length % 4);
  return Buffer.from(source + "=".repeat(padLength), "base64");
}

function safeTimingEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  if (leftBuffer.length !== rightBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function hashPassword(password, saltHex) {
  const salt = String(saltHex || crypto.randomBytes(16).toString("hex"));
  const hash = crypto
    .pbkdf2Sync(
      String(password || ""),
      Buffer.from(salt, "hex"),
      PASSWORD_HASH_ITERATIONS,
      PASSWORD_HASH_KEY_LENGTH,
      PASSWORD_HASH_DIGEST,
    )
    .toString("hex");

  return ["pbkdf2", PASSWORD_HASH_ITERATIONS, salt, hash].join("$");
}

function verifyPassword(password, passwordHash) {
  const parts = String(passwordHash || "").split("$");
  if (parts.length !== 4 || parts[0] !== "pbkdf2") {
    return false;
  }

  const iterations = Number.parseInt(parts[1], 10);
  const salt = parts[2];
  const digestHash = parts[3];
  if (!Number.isInteger(iterations) || iterations <= 0 || !salt || !digestHash) {
    return false;
  }

  const computed = crypto
    .pbkdf2Sync(
      String(password || ""),
      Buffer.from(salt, "hex"),
      iterations,
      PASSWORD_HASH_KEY_LENGTH,
      PASSWORD_HASH_DIGEST,
    )
    .toString("hex");

  return safeTimingEqual(computed, digestHash);
}

function normalizeUsername(username) {
  return String(username || "").trim().toLowerCase();
}

function isValidPasswordHash(value) {
  return /^pbkdf2\$\d+\$[a-f0-9]+\$[a-f0-9]+$/i.test(String(value || ""));
}

function buildDefaultUsers() {
  return [
    {
      username: "admin",
      role: "admin",
      disabled: false,
      password_hash: hashPassword("123456"),
      created_at: new Date().toISOString(),
      last_login_at: null,
    },
  ];
}

function writeUsersFile(filePath, users) {
  fs.writeFileSync(filePath, JSON.stringify(users, null, 2) + "\n", "utf8");
}

function readUsersFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const parsed = JSON.parse(content);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function normalizeUserRecord(record) {
  if (!record || typeof record !== "object") {
    return null;
  }

  const username = String(record.username || "").trim();
  if (!username) {
    return null;
  }

  const normalizedName = normalizeUsername(username);
  const legacyPassword = String(record.password || "");
  let passwordHash = String(record.password_hash || "");

  if (!isValidPasswordHash(passwordHash)) {
    if (legacyPassword) {
      passwordHash = hashPassword(legacyPassword);
    } else if (normalizedName === "admin") {
      passwordHash = hashPassword("123456");
    } else {
      return null;
    }
  }

  return {
    username,
    role: String(record.role || (normalizedName === "admin" ? "admin" : "user")),
    disabled: Boolean(record.disabled),
    password_hash: passwordHash,
    created_at: record.created_at || new Date().toISOString(),
    last_login_at: record.last_login_at || null,
  };
}

function normalizeUsersForStorage(sourceUsers) {
  const source = Array.isArray(sourceUsers) ? sourceUsers : [];
  const normalized = [];
  const seen = new Set();
  let changed = false;

  for (const item of source) {
    const normalizedUser = normalizeUserRecord(item);
    if (!normalizedUser) {
      changed = true;
      continue;
    }

    const key = normalizeUsername(normalizedUser.username);
    if (!key || seen.has(key)) {
      changed = true;
      continue;
    }

    seen.add(key);
    normalized.push(normalizedUser);

    if (Object.prototype.hasOwnProperty.call(item, "password")) {
      changed = true;
    }
  }

  if (!normalized.some((item) => normalizeUsername(item.username) === "admin")) {
    normalized.unshift(buildDefaultUsers()[0]);
    changed = true;
  }

  if (normalized.length === 0) {
    normalized.push(...buildDefaultUsers());
    changed = true;
  }

  return {
    users: normalized,
    changed: changed || normalized.length !== source.length,
  };
}

function ensureUsersFile(filePath) {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  if (!fs.existsSync(filePath)) {
    writeUsersFile(filePath, buildDefaultUsers());
    return;
  }

  const users = readUsersFile(filePath);
  const normalized = normalizeUsersForStorage(users);
  if (normalized.changed) {
    writeUsersFile(filePath, normalized.users);
  }
}

function sanitizeUser(user) {
  return {
    username: String(user.username || ""),
    role: String(user.role || "user"),
    last_login_at: user.last_login_at || null,
  };
}

function extractAccessToken(request, body = {}) {
  const authHeader = String(request.headers.authorization || "").trim();
  if (/^bearer\s+/i.test(authHeader)) {
    return authHeader.replace(/^bearer\s+/i, "").trim();
  }

  return String(body.token || "").trim();
}

function createAuthService(options = {}) {
  const usersFilePath = String(options.usersFilePath || DEFAULT_USERS_FILE_PATH);
  const tokenSecret = String(options.tokenSecret || process.env.INTELLICODE_AUTH_SECRET || "intelli-auth-dev-secret");
  const tokenTtlSeconds = Number.isInteger(options.tokenTtlSeconds)
    ? Math.max(300, Number(options.tokenTtlSeconds))
    : DEFAULT_TOKEN_TTL_SECONDS;
  const revokedJtiMap = new Map();

  ensureUsersFile(usersFilePath);

  function cleanupRevokedTokens() {
    const nowMs = Date.now();
    for (const [jti, expiresAtMs] of revokedJtiMap.entries()) {
      if (expiresAtMs <= nowMs) {
        revokedJtiMap.delete(jti);
      }
    }
  }

  function signTokenPayload(payload) {
    const headerEncoded = toBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
    const payloadEncoded = toBase64Url(JSON.stringify(payload));
    const signature = toBase64Url(
      crypto.createHmac("sha256", tokenSecret).update(`${headerEncoded}.${payloadEncoded}`).digest(),
    );

    return `${headerEncoded}.${payloadEncoded}.${signature}`;
  }

  function verifyToken(token) {
    cleanupRevokedTokens();
    const source = String(token || "").trim();
    if (!source) {
      return { ok: false, status: 401, message: "Unauthorized" };
    }

    const parts = source.split(".");
    if (parts.length !== 3) {
      return { ok: false, status: 401, message: "Unauthorized" };
    }

    const [headerEncoded, payloadEncoded, signature] = parts;
    const expectedSignature = toBase64Url(
      crypto.createHmac("sha256", tokenSecret).update(`${headerEncoded}.${payloadEncoded}`).digest(),
    );
    if (!safeTimingEqual(signature, expectedSignature)) {
      return { ok: false, status: 401, message: "Unauthorized" };
    }

    let payload;
    try {
      payload = JSON.parse(fromBase64Url(payloadEncoded).toString("utf8"));
    } catch {
      return { ok: false, status: 401, message: "Unauthorized" };
    }

    const nowSeconds = Math.floor(Date.now() / 1000);
    const exp = Number(payload.exp || 0);
    if (!payload.sub || !Number.isFinite(exp) || exp <= nowSeconds) {
      return { ok: false, status: 401, message: "Token expired" };
    }

    if (payload.jti && revokedJtiMap.has(String(payload.jti))) {
      return { ok: false, status: 401, message: "Token revoked" };
    }

    return { ok: true, status: 200, payload };
  }

  function findUser(users, username) {
    const normalized = normalizeUsername(username);
    return users.find((item) => normalizeUsername(item.username) === normalized);
  }

  function issueToken(user) {
    const nowSeconds = Math.floor(Date.now() / 1000);
    const exp = nowSeconds + tokenTtlSeconds;
    const payload = {
      sub: String(user.username || ""),
      role: String(user.role || "user"),
      iat: nowSeconds,
      exp,
      jti: crypto.randomUUID(),
    };

    return {
      token: signTokenPayload(payload),
      payload,
      expires_at: new Date(exp * 1000).toISOString(),
    };
  }

  function resetDemoUserRecord() {
    const users = readUsersFile(usersFilePath);
    let user = findUser(users, "admin");

    if (!user) {
      user = buildDefaultUsers()[0];
      users.unshift(user);
    }

    user.role = "admin";
    user.disabled = false;
    user.password_hash = hashPassword("123456");
    if (!user.created_at) {
      user.created_at = new Date().toISOString();
    }
    if (!Object.prototype.hasOwnProperty.call(user, "last_login_at")) {
      user.last_login_at = null;
    }

    writeUsersFile(usersFilePath, users);

    return {
      ok: true,
      status: 200,
      message: "Demo account reset to admin / 123456",
      user: sanitizeUser(user),
    };
  }

  return {
    login({ username, password }) {
      const normalizedUsername = String(username || "").trim();
      const normalizedPassword = String(password || "");
      if (!normalizedUsername || !normalizedPassword) {
        return {
          ok: false,
          status: 400,
          message: "Username and password are required",
        };
      }

      let users = readUsersFile(usersFilePath);
      let user = findUser(users, normalizedUsername);
      let passwordValid = Boolean(user && !user.disabled && verifyPassword(normalizedPassword, user.password_hash));

      // Keep local demo usable even if admin credentials were accidentally modified.
      if (!passwordValid && normalizeUsername(normalizedUsername) === "admin" && normalizedPassword === "123456") {
        resetDemoUserRecord();
        users = readUsersFile(usersFilePath);
        user = findUser(users, normalizedUsername);
        passwordValid = Boolean(user && !user.disabled && verifyPassword(normalizedPassword, user.password_hash));
      }

      if (!user || user.disabled || !passwordValid) {
        return {
          ok: false,
          status: 401,
          message: "Invalid username or password",
        };
      }

      const issued = issueToken(user);
      user.last_login_at = new Date().toISOString();
      writeUsersFile(usersFilePath, users);

      return {
        ok: true,
        status: 200,
        token: issued.token,
        expires_at: issued.expires_at,
        user: sanitizeUser(user),
      };
    },

    getSession(token) {
      const verified = verifyToken(token);
      if (!verified.ok) {
        return verified;
      }

      const users = readUsersFile(usersFilePath);
      const user = findUser(users, verified.payload.sub);
      if (!user || user.disabled) {
        return { ok: false, status: 401, message: "Unauthorized" };
      }

      return {
        ok: true,
        status: 200,
        user: sanitizeUser(user),
        expires_at: new Date(Number(verified.payload.exp || 0) * 1000).toISOString(),
      };
    },

    logout(token) {
      const verified = verifyToken(token);
      if (verified.ok && verified.payload.jti) {
        const expiresAtMs = Number(verified.payload.exp || 0) * 1000;
        revokedJtiMap.set(String(verified.payload.jti), expiresAtMs || Date.now());
      }

      return {
        ok: true,
        status: 200,
        message: "Logged out",
      };
    },

    resetDemoUser() {
      return resetDemoUserRecord();
    },

    usersFilePath,
  };
}

function tryOpenBrowser(url) {
  const safeUrl = String(url || "").replace(/\"/g, '\\"');

  if (process.platform === "win32") {
    exec(`start \"\" \"${safeUrl}\"`);
    return;
  }

  if (process.platform === "darwin") {
    exec(`open \"${safeUrl}\"`);
    return;
  }

  exec(`xdg-open \"${safeUrl}\"`);
}

function createPreviewContext(requirementText) {
  const manager = new AgentManager();
  const runResult = manager.run(requirementText);
  const exported = loadGeneratedExports(runResult.code || runResult.generated_code || "");
  const renderLoginPage = typeof exported.renderLoginPage === "function"
    ? exported.renderLoginPage
    : null;

  let pageHtml = "";
  if (renderLoginPage) {
    try {
      pageHtml = String(renderLoginPage() || "");
    } catch {
      pageHtml = "";
    }
  }

  return {
    manager,
    runResult,
    exported,
    pageHtml,
  };
}

function summarizeRunResult(runResult) {
  const source = runResult && typeof runResult === "object" ? runResult : {};
  const steps = Array.isArray(source.step_results)
    ? source.step_results.length
    : (Array.isArray(source.task_queue) ? source.task_queue.length : 0);

  return {
    steps,
    optimization_rounds: Number(source.optimization_rounds || 0),
    memory_reused: Boolean(source.used_memory_code),
  };
}

function createRunHistoryEntry({ id, prompt, runResult, createdAt }) {
  return {
    id: String(id || ""),
    prompt: String(prompt || ""),
    created_at: createdAt || new Date().toISOString(),
    summary: summarizeRunResult(runResult),
  };
}

function startPreviewServer({ requirementText, host, port, openBrowser, usersFilePath, tokenSecret }) {
  const context = createPreviewContext(requirementText);
  const authService = createAuthService({
    usersFilePath,
    tokenSecret,
  });
  const runHistory = [];
  const maxHistorySize = 20;
  let runCounter = 0;

  function rememberRun(prompt, runResult) {
    runCounter += 1;
    const entry = createRunHistoryEntry({
      id: `run_${runCounter}`,
      prompt,
      runResult,
      createdAt: new Date().toISOString(),
    });
    runHistory.unshift(entry);
    if (runHistory.length > maxHistorySize) {
      runHistory.length = maxHistorySize;
    }
    return entry;
  }

  rememberRun(requirementText, context.runResult);

  const server = http.createServer(async (request, response) => {
    const method = String(request.method || "GET").toUpperCase();
    const requestUrl = new URL(
      request.url || "/",
      `http://${request.headers.host || `${host}:${port}`}`,
    );

    // Handle CORS preflight requests
    if (method === "OPTIONS") {
      response.writeHead(200, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization",
        "Access-Control-Max-Age": "86400",
      });
      response.end();
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/") {
      const html = buildPreviewHtml({
        requirement: requirementText,
        pageHtml: context.pageHtml,
        runResult: context.runResult,
      });
      sendHtml(response, 200, html);
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/result") {
      const token = extractAccessToken(request);
      const session = authService.getSession(token);
      if (!session.ok) {
        sendJson(response, session.status || 401, {
          ok: false,
          message: session.message || "Authentication required to view code",
        });
        return;
      }
      sendJson(response, 200, context.runResult);
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/health") {
      sendJson(response, 200, { ok: true });
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/favicon.ico") {
      response.writeHead(204, {
        "Cache-Control": "public, max-age=86400",
      });
      response.end();
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/me") {
      const token = extractAccessToken(request);
      const session = authService.getSession(token);
      if (!session.ok) {
        sendJson(response, session.status || 401, {
          ok: false,
          message: session.message || "Unauthorized",
        });
        return;
      }

      sendJson(response, 200, {
        ok: true,
        user: session.user,
        expires_at: session.expires_at,
      });
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/agent/history") {
      const token = extractAccessToken(request);
      const session = authService.getSession(token);
      if (!session.ok) {
        sendJson(response, session.status || 401, {
          ok: false,
          message: session.message || "Unauthorized",
        });
        return;
      }

      sendJson(response, 200, {
        ok: true,
        items: runHistory,
      });
      return;
    }

    if (method === "GET" && requestUrl.pathname === "/api/memory") {
      const token = extractAccessToken(request);
      const session = authService.getSession(token);
      if (!session.ok) {
        sendJson(response, session.status || 401, { ok: false, message: session.message || "Unauthorized" });
        return;
      }
      try {
        const memoryPath = path.join(__dirname, "storage", "memory_store.json");
        if (fs.existsSync(memoryPath)) {
          const memoryData = JSON.parse(fs.readFileSync(memoryPath, "utf8"));
          sendJson(response, 200, { ok: true, memory: memoryData });
        } else {
          sendJson(response, 200, { ok: true, memory: [] });
        }
      } catch (error) {
        sendJson(response, 500, { ok: false, message: "Error reading memory" });
      }
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/agent/create") {
      try {
        const rawBody = await readRequestBody(request);
        const body = rawBody ? parseBodyToObject(rawBody, request.headers["content-type"]) : {};
        
        // Mock successful creation
        sendJson(response, 200, {
          ok: true,
          message: "Agent created successfully",
          data: { id: "ag-" + Date.now(), name: body.name }
        });
        return;
      } catch (err) {
        sendJson(response, 500, { ok: false, message: err.message });
        return;
      }
    }

    if (method === "POST" && requestUrl.pathname === "/api/agent/run") {
      try {
        const rawBody = await readRequestBody(request);
        const body = rawBody
          ? parseBodyToObject(rawBody, request.headers["content-type"])
          : {};
        const token = extractAccessToken(request, body);
        const session = authService.getSession(token);
        if (!session.ok) {
          sendJson(response, session.status || 401, {
            ok: false,
            message: session.message || "Unauthorized",
          });
          return;
        }

        const prompt = String(body.prompt || body.requirement || body.message || "").trim();
        if (!prompt) {
          sendJson(response, 400, {
            ok: false,
            message: "Prompt is required",
          });
          return;
        }

        const runResult = context.manager.run(prompt);
        context.runResult = runResult;
        const entry = rememberRun(prompt, runResult);

        sendJson(response, 200, {
          ok: true,
          run_id: entry.id,
          created_at: entry.created_at,
          prompt,
          summary: entry.summary,
          result: runResult,
        });
        return;
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          message: String(error && error.message ? error.message : error),
        });
        return;
      }
    }

    if (method === "POST" && requestUrl.pathname === "/api/logout") {
      try {
        const rawBody = await readRequestBody(request);
        const body = rawBody
          ? parseBodyToObject(rawBody, request.headers["content-type"])
          : {};
        const token = extractAccessToken(request, body);
        if (!token) {
          sendJson(response, 400, {
            ok: false,
            message: "Token is required",
          });
          return;
        }

        const result = authService.logout(token);
        sendJson(response, result.status || 200, {
          ok: true,
          message: result.message,
        });
        return;
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          message: String(error && error.message ? error.message : error),
        });
        return;
      }
    }

    if (method === "POST" && requestUrl.pathname === "/api/reset-demo-user") {
      const result = authService.resetDemoUser();
      sendJson(response, result.status || 200, {
        ok: true,
        message: result.message,
        user: result.user,
      });
      return;
    }

    if (method === "POST" && requestUrl.pathname === "/api/login") {
      try {
        const rawBody = await readRequestBody(request);
        const body = parseBodyToObject(rawBody, request.headers["content-type"]);
        const result = authService.login({
          username: body.username,
          password: body.password,
        });

        if (!result.ok) {
          sendJson(response, result.status || 401, {
            ok: false,
            message: result.message || "Invalid username or password",
          });
          return;
        }

        sendJson(response, 200, {
          ok: true,
          token: result.token,
          user: result.user,
          expires_at: result.expires_at,
        });
        return;
      } catch (error) {
        sendJson(response, 400, {
          ok: false,
          message: String(error && error.message ? error.message : error),
        });
        return;
      }
    }

      // Serve static frontend files from 'public' directory
      if (method === "GET") {
        const publicPath = path.join(__dirname, "public", requestUrl.pathname === "/" ? "dashboard-redesign.html" : requestUrl.pathname);
        if (fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
           const ext = path.extname(publicPath);
           const mimeTypes = {
              ".html": "text/html",
              ".js": "text/javascript",
              ".css": "text/css",
              ".json": "application/json",
              ".png": "image/png",
              ".jpg": "image/jpeg",
              ".svg": "image/svg+xml"
           };
           const contentType = mimeTypes[ext] || "application/octet-stream";
           response.writeHead(200, { "Content-Type": contentType });
           fs.createReadStream(publicPath).pipe(response);
           return;
        }
      }

      sendJson(response, 404, {
        ok: false,
        message: "Not Found",
      });
    });

  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(port, host, () => {
      server.removeListener("error", reject);
      const address = server.address();
      const resolvedPort = address && typeof address === "object"
        ? address.port
        : port;
      const baseUrl = `http://${host}:${resolvedPort}`;

      if (openBrowser) {
        tryOpenBrowser(baseUrl);
      }

      resolve({
        server,
        baseUrl,
        context,
      });
    });
  });
}

function main() {
  const args = parseCliArgs(process.argv.slice(2));

  startPreviewServer(args)
    .then(({ baseUrl, context }) => {
      console.log(`[preview] server is running at ${baseUrl}`);
      console.log(`[preview] open page: ${baseUrl}/`);
      console.log(`[preview] run result: ${baseUrl}/api/result`);
      console.log(`[preview] health: ${baseUrl}/health`);
      console.log(`[preview] task steps: ${context.runResult.step_results.length}`);
    })
    .catch((error) => {
      console.error("[preview] failed to start server");
      console.error(String(error && error.stack ? error.stack : error));
      process.exitCode = 1;
    });
}

if (require.main === module) {
  main();
}

module.exports = {
  DEFAULT_REQUIREMENT,
  normalizePort,
  parseCliArgs,
  loadGeneratedExports,
  parseBodyToObject,
  buildPreviewHtml,
  createPreviewContext,
  startPreviewServer,
};

