
    (function () {
      const loginPlayground = document.querySelector("#login-playground");
      const form = (loginPlayground
        && (loginPlayground.querySelector("#login-form") || loginPlayground.querySelector("form")))
        || document.querySelector("#login-form");
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
      const tokenStorageKey = "preview_demo_token";
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
          .replace(/"/g, "&quot;")
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

      function setAgentComposerEnabled(enabled, placeholderText) {
        if (agentRunInput) {
          agentRunInput.disabled = !enabled;
          if (!enabled) {
            agentRunInput.placeholder = String(placeholderText || "请先登录后再运行 Agent�?);
          }
        }

        if (agentRunButton) {
          agentRunButton.disabled = !enabled;
        }
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
          ? String(busyText || "处理�?..")
          : String(button.dataset.idleText || button.textContent || "");
      }

      function setDemoActionState(actionKey, status, detail) {
        const nodeMap = {
          fill: actionFillState,
          quick: actionQuickState,
          reset: actionResetState,
        };
        const node = nodeMap[String(actionKey || "")];
        if (!node) {
          return;
        }

        const normalizedStatus = String(status || "idle");
        const statusMap = {
          idle: "待执�?,
          busy: "执行�?,
          ok: "成功",
          warn: "提醒",
          error: "失败",
        };
        const title = String(detail || "");
        const stamp = new Date().toLocaleTimeString();

        node.className = "action-badge " + (normalizedStatus === "idle" ? "" : normalizedStatus);
        node.textContent = (statusMap[normalizedStatus] || "待执�?) + " " + stamp;
        node.title = title;
      }

      function resolveLoginInputs() {
        const iframeRoot = document.querySelector("#login-playground-frame");
        const docRoot = iframeRoot && iframeRoot.contentDocument ? iframeRoot.contentDocument : document;
        const searchRoot = form || docRoot.querySelector("#login-form") || docRoot.querySelector("form") || loginPlayground || document;
        if (!searchRoot) {
          return {
            usernameInput: null,
            passwordInput: null,
          };
        }

        const usernameSelectors = [
          "input[name="username"]",
          "input[name="user"]",
          "input[name="email"]",
          "input[id*="user"]",
          "input[type="text"]",
          "input:not([type])",
          "input[type="email"]",
        ];

        let usernameInput = null;
        for (const selector of usernameSelectors) {
          usernameInput = searchRoot.querySelector(selector);
          if (usernameInput) {
            break;
          }
        }

        const passwordInput = searchRoot.querySelector("input[name="password"], input[name="pass"], input[name="pwd"], input[type="password"], input[id*="pass"]");

        return {
          usernameInput,
          passwordInput,
        };
      }

      function readLoginPayload() {
        const extracted = resolveLoginInputs();
        const usernameFromInputs = extracted.usernameInput
          ? String(extracted.usernameInput.value || "").trim()
          : "";
        const passwordFromInputs = extracted.passwordInput
          ? String(extracted.passwordInput.value || "")
          : "";

        const docRoot = document.querySelector("#login-playground-frame")?.contentDocument || document;
        const currentForm = form || docRoot.querySelector("#login-form") || docRoot.querySelector("form");

        const fallbackData = currentForm
          ? new FormData(currentForm)
          : new FormData();

        return {
          username: usernameFromInputs
            || String(fallbackData.get("username") || fallbackData.get("user") || fallbackData.get("email") || "").trim(),
          password: passwordFromInputs
            || String(fallbackData.get("password") || fallbackData.get("pass") || fallbackData.get("pwd") || ""),
        };
      }

      function fillLoginInputs() {
        const { usernameInput, passwordInput } = resolveLoginInputs();

        if (usernameInput) {
          usernameInput.value = "admin";
        }

        if (passwordInput) {
          passwordInput.value = "123456";
          passwordInput.focus();
        }

        return Boolean(usernameInput && passwordInput);
      }

      async function loginWithDemoCredentials(actionKey = "") {
        if (actionKey) {
          setDemoActionState(actionKey, "busy", "正在请求 /api/login");
        }

        setAuthState("loading", "正在使用演示账号登录 ...", "");
        setResult("loading", "Requesting /api/login ...");
        pushActivity("warn", "一键演示登录中");

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
          const username = data.user && data.user.username
            ? String(data.user.username)
            : "admin";
          setAuthState("logged_in", "登录成功，欢�?" + username + "�?, token);
          setResult("success", JSON.stringify(data, null, 2));
          pushActivity("ok", "一键登录成�? " + username);
          if (actionKey) {
            setDemoActionState(actionKey, "ok", "演示登录成功");
          }
          await refreshAgentHistory();
          return true;
        }

        localStorage.removeItem(tokenStorageKey);
        localStorage.removeItem(tokenStorageKey + "_expires");
        setAuthState("error", (data && data.message) || "登录失败，请检查账号密码�?, "");
        setResult("error", JSON.stringify(data, null, 2));
        pushActivity("error", "一键登录失�?);
        if (actionKey) {
          setDemoActionState(actionKey, "error", (data && data.message) || "演示登录失败");
        }
        await refreshAgentHistory();
        return false;
      }

      function appendMessage(role, html) {
        if (!messageList) {
          return null;
        }

        const item = document.createElement("article");
        item.className = "message " + (role || "assistant");
        item.innerHTML = String(html || "");
        messageList.appendChild(item);
        messageList.scrollTop = messageList.scrollHeight;
        return item;
      }

      function appendUserMessage(promptText) {
        return appendMessage("user", [
          "<div class="message-meta">You</div>",
          "<div class="message-body">" + escapeText(promptText) + "</div>",
        ].join("
"));
      }

      function buildAssistantRunCard(promptText, resultPayload, createdAtText) {
        const payload = resultPayload && typeof resultPayload === "object" ? resultPayload : {};
        const summary = summarizeRun(payload);
        const stepSource = Array.isArray(payload.step_results) && payload.step_results.length > 0
          ? payload.step_results
          : (Array.isArray(payload.task_queue) ? payload.task_queue : []);
        const stepItems = stepSource.slice(0, 6);
        const stepHtml = stepItems.length > 0
          ? "<ul class="assistant-steps">" + stepItems.map((item, index) => (
            "<li>" + (index + 1) + ". " + escapeText(item.task || "Untitled Task") + "</li>"
          )).join("") + "</ul>"
          : "<div class="assistant-empty">没有可展示的步骤信息�?/div>";
        const code = String(payload.code || "");
        const codePreview = code
          ? (code.length > 860 ? code.slice(0, 860) + "
..." : code)
          : "No code generated.";
        const timestamp = createdAtText
          ? new Date(createdAtText).toLocaleTimeString()
          : new Date().toLocaleTimeString();

        return [
          "<div class="message-meta">Agent</div>",
          "<section class="assistant-card">",
          "  <div class="assistant-meta">",
          "    <span class="assistant-chip">" + escapeText(timestamp) + "</span>",
          "    <span class="assistant-chip">steps: " + summary.steps + "</span>",
          "    <span class="assistant-chip">rounds: " + summary.optimization_rounds + "</span>",
          "    <span class="assistant-chip">memory: " + (summary.memory_reused ? "yes" : "no") + "</span>",
          "  </div>",
          "  <div class="message-body">" + escapeText(promptText || "Agent Response") + "</div>",
          stepHtml,
          "  <pre class="assistant-code">" + escapeText(codePreview) + "</pre>",
          "</section>",
        ].join("
");
      }

      function appendAssistantRunMessage(promptText, resultPayload, createdAtText) {
        return appendMessage("assistant", buildAssistantRunCard(promptText, resultPayload, createdAtText));
      }

      function appendPendingAgentMessage() {
        return appendMessage("assistant", [
          "<div class="message-meta">Agent</div>",
          "<section class="assistant-card">",
          "  <div class="assistant-meta"><span class="assistant-chip">running</span></div>",
          "  <div class="assistant-empty">Agent 正在执行中，请稍�?..</div>",
          "</section>",
        ].join("
"));
      }

      function renderConversationList(items) {
        if (!conversationList) {
          return;
        }

        const source = Array.isArray(items) ? items : [];
        if (source.length === 0) {
          conversationList.innerHTML = "<li class="conversation-item"><div class="conversation-main">暂无历史运行</div><div class="conversation-meta">登录后会显示你的 Agent 运行记录</div></li>";
          return;
        }

        conversationList.innerHTML = source.map((item) => {
          const prompt = String(item.prompt || "Untitled prompt");
          const summary = buildSummaryText(item.summary || {});
          const createdAt = item.created_at
            ? new Date(item.created_at).toLocaleString()
            : "Unknown time";
          return [
            "<li class="conversation-item" data-prompt="" + escapeText(prompt) + "">",
            "  <div class="conversation-main">" + escapeText(prompt) + "</div>",
            "  <div class="conversation-meta">" + escapeText(createdAt + " | " + summary) + "</div>",
            "</li>",
          ].join("
");
        }).join("
");

        for (const itemNode of conversationList.querySelectorAll(".conversation-item[data-prompt]")) {
          itemNode.addEventListener("click", function () {
            if (!agentRunInput) {
              return;
            }

            agentRunInput.value = String(itemNode.dataset.prompt || "");
            agentRunInput.focus();
          });
        }
      }

      async function refreshAgentHistory() {
        const token = String(localStorage.getItem(tokenStorageKey) || "");
        if (!token) {
          renderConversationList([]);
          return;
        }

        try {
          const response = await fetch("/api/agent/history", {
            headers: {
              Authorization: "Bearer " + token,
            },
          });
          const data = await response.json();

          if (response.ok && data && data.ok && Array.isArray(data.items)) {
            renderConversationList(data.items);
            return;
          }
        } catch (error) {
          // Ignore history loading failures and keep UI usable.
        }

        renderConversationList([]);
      }

      async function runAgent(promptText) {
        if (isAgentRunning) {
          pushActivity("warn", "Agent 正在执行中，请稍�?..");
          return;
        }

        const token = String(localStorage.getItem(tokenStorageKey) || "");
        if (!token) {
          setAuthState("warn", "请先登录后再运行 Agent�?, "");
          pushActivity("warn", "未登录，拒绝运行 Agent");
          return;
        }

        const prompt = String(promptText || "").trim();
        if (!prompt) {
          return;
        }

        isAgentRunning = true;
        appendUserMessage(prompt);
        const pendingNode = appendPendingAgentMessage();
        if (agentRunButton) {
          agentRunButton.disabled = true;
        }

        setResult("loading", "Requesting /api/agent/run ...");
        pushActivity("warn", "发�?Agent 运行请求");

        try {
          const response = await fetch("/api/agent/run", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: "Bearer " + token,
            },
            body: JSON.stringify({ prompt }),
          });
          const data = await response.json();

          if (!response.ok || !data || !data.ok || !data.result) {
            throw new Error((data && data.message) || "Agent run failed");
          }

          runData = data.result;
          renderTimeline();
          if (pendingNode) {
            pendingNode.innerHTML = buildAssistantRunCard(prompt, data.result, data.created_at);
          }
          setResult("success", JSON.stringify(data, null, 2));
          setAuthState("logged_in", "Agent 运行完成�?, token);
          pushActivity("ok", "Agent 运行成功");
          await refreshAgentHistory();
        } catch (error) {
          const message = String(error && error.message ? error.message : error);
          if (pendingNode) {
            pendingNode.innerHTML = [
              "<div class="message-meta">Agent</div>",
              "<section class="assistant-card">",
              "  <div class="assistant-meta"><span class="assistant-chip">failed</span></div>",
              "  <div class="assistant-empty">" + escapeText(message) + "</div>",
              "</section>",
            ].join("
");
          }
          setResult("error", message);
          pushActivity("error", "Agent 运行失败");
        } finally {
          isAgentRunning = false;
          if (agentRunButton) {
            agentRunButton.disabled = !String(localStorage.getItem(tokenStorageKey) || "");
          }
        }
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
        const msg = event && event.message
          ? event.message
          : "Unknown script error";
        reportClientError(msg);
        pushActivity("error", "前端脚本异常: " + msg);
      });

      window.addEventListener("unhandledrejection", function (event) {
        const reason = event && event.reason
          ? String(event.reason.message || event.reason)
          : "Unhandled Promise Rejection";
        reportClientError(reason);
        pushActivity("error", "前端 Promise 异常: " + reason);
      });

      function renderTimeline() {
        if (!timeline) {
          return;
        }

        const stepResults = Array.isArray(runData.step_results) ? runData.step_results : [];
        const queue = Array.isArray(runData.task_queue) ? runData.task_queue : [];
        const items = stepResults.length > 0
          ? stepResults.map((item, index) => ({
            index: index + 1,
            task: item.task,
            source: item.source || "generated",
            status: "done",
          }))
          : queue.map((item, index) => ({
            index: index + 1,
            task: item.task,
            source: "planned",
            status: item.status || "pending",
          }));

        if (items.length === 0) {
          timeline.innerHTML = "<li class="timeline-empty">暂无可展示的 Agent 步骤�?/li>";
          return;
        }

        timeline.innerHTML = items.map((item) => {
          const source = String(item.source || "generated");
          return [
            "<li class="timeline-item">",
            "  <div class="timeline-head">",
            "    <span class="timeline-index">" + item.index + "</span>",
            "    <span class="timeline-source " + (source === "memory" ? "memory" : "") + "">" + escapeText(source) + "</span>",
            "  </div>",
            "  <div class="timeline-task">" + escapeText(item.task) + "</div>",
            "  <div class="timeline-status">status: " + escapeText(item.status) + "</div>",
            "</li>",
          ].join("
");
        }).join("
");
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

      function setResult(state, content) {
        if (!output) {
          return;
        }

        output.dataset.state = state || "idle";
        output.textContent = String(content || "");
      }

      function setAuthState(state, note, token) {
        const currentState = String(state || "idle");
        const statusMap = {
          idle: "未登�?,
          loading: "请求�?,
          logged_in: "已登�?,
          logged_out: "已登�?,
          warn: "待处�?,
          error: "登录失败",
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
          helperText.textContent = String(note || "提交表单后将显示接口返回与当前登录状态�?);
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
        
        setAgentComposerEnabled(Boolean(safeToken), "请先登录后再运行 Agent�?);
      }

      function enhanceFormHint() {
        const docRoot = document.querySelector("#login-playground-frame")?.contentDocument || document;
        const currentForm = form || docRoot.querySelector("#login-form") || docRoot.querySelector("form");
        if (!currentForm) {
          return;
        }

        // Enforce POST behavior to avoid credentials appearing in URL query string.
        currentForm.setAttribute("method", "post");
        currentForm.setAttribute("action", "javascript:void(0)");

        const { usernameInput, passwordInput } = resolveLoginInputs();

        if (usernameInput && !usernameInput.placeholder) {
          usernameInput.placeholder = "请输入用户名";
        }

        if (passwordInput && !passwordInput.placeholder) {
          passwordInput.placeholder = "请输入密�?;
        }

        if (!currentForm.querySelector(".form-tip")) {
          const tip = document.createElement("p");
          tip.className = "form-tip";
          tip.textContent = "建议先尝�?admin / 123456 进行演示登录�?;
          currentForm.appendChild(tip);
        }
      }

      async function onLogout() {
        const token = String(localStorage.getItem(tokenStorageKey) || "");
        if (!token) {
          setAuthState("logged_out", "当前没有可登出的 token�?, "");
          setResult("idle", "没有找到 token，可直接重新登录�?);
          pushActivity("warn", "尝试登出，但本地不存�?token");
          return;
        }

        setAuthState("loading", "正在请求 /api/logout ...", token);
        setResult("loading", "Requesting /api/logout ...");
        pushActivity("warn", "发送登出请�?);

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
          setAuthState("logged_out", data.message || "已退出登录�?, "");
          setResult("success", JSON.stringify(data, null, 2));
          pushActivity("ok", "登出成功");
          await refreshAgentHistory();
        } catch (error) {
          setAuthState("error", "登出请求失败，请稍后重试�?, token);
          setResult("error", String(error && error.message ? error.message : error));
          pushActivity("error", "登出请求失败");
        }
      }

      if (!output || !helperText || !authDot || !authText || !tokenView || !copyButton || !logoutButton) {
        return;
      }

      renderTimeline();
      renderConversationList([
        {
          prompt: String((runData.requirement && (runData.requirement.原始需�?|| runData.requirement.functionName)) || "Initial run"),
          summary: summarizeRun(runData),
          created_at: new Date().toISOString(),
        },
      ]);

      appendAssistantRunMessage(
        String((runData.requirement && (runData.requirement.原始需�?|| runData.requirement.functionName)) || "Initial run"),
        runData,
        new Date().toISOString(),
      );

      const query = new URLSearchParams(window.location.search || "");
      if (query.has("username") || query.has("password")) {
        window.history.replaceState({}, "", window.location.pathname);
        pushActivity("warn", "检测到地址栏敏感参数，已自动清理�?);
      }

      pushActivity("", "加载完成，Agent 步骤�? " + initialStepCount);

      if (fillDemoButton) {
        fillDemoButton.addEventListener("click", function () {
          setDemoActionState("fill", "busy", "正在尝试填充账号密码");
          const filled = fillLoginInputs();
          if (!filled) {
            setAuthState("warn", "未找到可填充的输入框，可直接点一键演示登录�?, String(localStorage.getItem(tokenStorageKey) || ""));
            pushActivity("warn", "填充失败：未找到账号输入�?);
            setDemoActionState("fill", "warn", "未找到可填充输入�?);
            return;
          }

          pushActivity("ok", "已填充演示账�?admin / 123456");
          setDemoActionState("fill", "ok", "已填�?admin / 123456");
        });
      }

      if (quickLoginButton) {
        quickLoginButton.addEventListener("click", async function () {
          setButtonBusy(quickLoginButton, true, "登录�?..");
          try {
            await loginWithDemoCredentials("quick");
          } catch (error) {
            setAuthState("error", "一键登录失败，请稍后重试�?, "");
            setResult("error", String(error && error.message ? error.message : error));
            pushActivity("error", "一键登录请求异�?);
            setDemoActionState("quick", "error", String(error && error.message ? error.message : error));
          } finally {
            setButtonBusy(quickLoginButton, false);
          }
        });
      }

      if (resetDemoButton) {
        resetDemoButton.addEventListener("click", async function () {
          setButtonBusy(resetDemoButton, true, "重置�?..");
          setDemoActionState("reset", "busy", "正在请求重置演示账号");
          setResult("loading", "Requesting /api/reset-demo-user ...");
          pushActivity("warn", "请求重置演示账号");

          try {
            const response = await fetch("/api/reset-demo-user", {
              method: "POST",
            });
            const data = await response.json();

            if (!response.ok || !data || !data.ok) {
              throw new Error((data && data.message) || "Reset demo account failed");
            }

            localStorage.removeItem(tokenStorageKey);
            localStorage.removeItem(tokenStorageKey + "_expires");
            const filled = fillLoginInputs();
            setAuthState("idle", "演示账号已重置为 admin / 123456，请重新登录�?, "");
            setResult("success", JSON.stringify(data, null, 2));
            pushActivity(filled ? "ok" : "warn", filled ? "演示账号已重置，可重新登�? : "演示账号已重置，但未找到输入框，建议点一键演示登�?);
            setDemoActionState("reset", filled ? "ok" : "warn", filled ? "账号已重置并回填" : "账号已重置，未找到输入框");
            await refreshAgentHistory();
          } catch (error) {
            setResult("error", String(error && error.message ? error.message : error));
            pushActivity("error", "重置演示账号失败");
            setDemoActionState("reset", "error", String(error && error.message ? error.message : error));
          } finally {
            setButtonBusy(resetDemoButton, false);
          }
        });
      }

      async function restoreSession() {
        const cachedToken = String(localStorage.getItem(tokenStorageKey) || "");
        if (!cachedToken) {
          setAuthState("idle", "请填写账号密码并提交登录请求�?, "");
          await refreshAgentHistory();
          return;
        }

        setAuthState("loading", "正在校验本地 token ...", cachedToken);
        pushActivity("warn", "检测到本地 token，开始会话校�?);

        try {
          const response = await fetch("/api/me", {
            headers: {
              Authorization: "Bearer " + cachedToken,
            },
          });
          const data = await response.json();

          if (response.ok && data && data.ok) {
            const username = data.user && data.user.username ? String(data.user.username) : "用户";
            setAuthState("logged_in", "欢迎回来�? + username + "�?, cachedToken);
            pushActivity("ok", "会话校验成功: " + username);
            await refreshAgentHistory();
            return;
          }

          localStorage.removeItem(tokenStorageKey);
          localStorage.removeItem(tokenStorageKey + "_expires");
          setAuthState("idle", "登录态已失效，请重新登录�?, "");
          pushActivity("warn", "会话校验失败，已清理本地 token");
          await refreshAgentHistory();
        } catch (error) {
          setAuthState("warn", "会话校验失败，请重新登录�?, "");
          pushActivity("error", "请求 /api/me 失败");
          await refreshAgentHistory();
        }
      }

      restoreSession();

      copyButton.addEventListener("click", async function () {
        const token = String(localStorage.getItem(tokenStorageKey) || "");
        if (!token) {
          return;
        }

        try {
          await navigator.clipboard.writeText(token);
          setAuthState("logged_in", "Token 已复制到剪贴板�?, token);
          pushActivity("ok", "Token 已复制到剪贴�?);
        } catch (error) {
          setAuthState("logged_in", "浏览器阻止复制，请手动复�?token�?, token);
          pushActivity("warn", "浏览器阻止自动复�?);
        }
      });

      logoutButton.addEventListener("click", onLogout);

      if (agentRunForm && agentRunInput) {
        agentRunForm.addEventListener("submit", async function (event) {
          event.preventDefault();
          const prompt = String(agentRunInput.value || "").trim();
          if (!prompt) {
            return;
          }

          agentRunInput.value = "";
          agentRunInput.style.height = "auto";
          await runAgent(prompt);
        });

        agentRunInput.addEventListener("input", function () {
          this.style.height = "auto";
          this.style.height = this.scrollHeight + "px";
        });

        agentRunInput.addEventListener("keydown", function (event) {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            if (!isAgentRunning) {
              agentRunForm.requestSubmit();
            }
          }
        });
      }

      function bindIframeForm() {
        const docRoot = document.querySelector("#login-playground-frame")?.contentDocument || document;
        const currentForm = form || docRoot.querySelector("#login-form") || docRoot.querySelector("form");
        if (!currentForm) {
          setAuthState("warn", "页面未检测到登录表单�?, "");
          setResult("idle", "No login form detected in generated page. You can still use quick demo login.");
          pushActivity("warn", "未检测到可提交的登录表单，可直接点一键演示登�?);
          setDemoActionState("fill", "warn", "未检测到登录表单");
        } else {
          // Remove old listeners to avoid stacking
          const newForm = currentForm.cloneNode(true);
          if (currentForm.parentNode) {
            currentForm.parentNode.replaceChild(newForm, currentForm);
          }
          
          newForm.addEventListener("submit", async function (event) {
            event.preventDefault();
            const payload = readLoginPayload();

            if (!payload.username || !payload.password) {
              setAuthState("warn", "请输入用户名和密码�?, "");
              setResult("error", JSON.stringify({ ok: false, message: "Username and password are required." }, null, 2));
              pushActivity("warn", "登录表单缺少必填�?);
              return;
            }

            setAuthState("loading", "正在请求 /api/login ...", "");
            setResult("loading", "Requesting /api/login ...");
            pushActivity("warn", "发送登录请�? " + payload.username);

            if (payload.username === "admin" && payload.password === "123456") {
              try {
                await loginWithDemoCredentials("quick");
                return;
              } catch (error) {
                setAuthState("error", "登录失败，请稍后重试�?, "");
                setResult("error", String(error && error.message ? error.message : error));
                pushActivity("error", "演示账号登录请求异常");
                return;
              }
            }

            try {
              const response = await fetch("/api/login", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload),
              });

              const data = await response.json();
              if (response.ok && data && data.ok && data.token) {
                const token = String(data.token);
                localStorage.setItem(tokenStorageKey, token);
                localStorage.setItem(tokenStorageKey + "_expires", String(data.expires_at || ""));
                const username = data.user && data.user.username
                  ? String(data.user.username)
                  : payload.username;
                setAuthState("logged_in", "登录成功，欢�?" + username + "�?, token);
                setResult("success", JSON.stringify(data, null, 2));
                pushActivity("ok", "登录成功并写�?token: " + username);
                await refreshAgentHistory();
                return;
              }

              localStorage.removeItem(tokenStorageKey);
              localStorage.removeItem(tokenStorageKey + "_expires");
              setAuthState("error", (data && data.message) || "登录失败，请检查账号密码�?, "");
              setResult("error", JSON.stringify(data, null, 2));
              pushActivity("error", "登录失败，接口返回拒�?);
              await refreshAgentHistory();
            } catch (error) {
              localStorage.removeItem(tokenStorageKey);
              localStorage.removeItem(tokenStorageKey + "_expires");
              setAuthState("error", "网络异常，请稍后再试�?, "");
              setResult("error", String(error && error.message ? error.message : error));
              pushActivity("error", "登录请求发生异常");
              await refreshAgentHistory();
            }
          });
        }
      }

      const playgroundIframe = document.querySelector("#login-playground-frame");
      if (playgroundIframe) {
        playgroundIframe.addEventListener("load", function() {
          enhanceFormHint();
          bindIframeForm();
        });
      } else {
        enhanceFormHint();
        bindIframeForm();
      }
    })();
  