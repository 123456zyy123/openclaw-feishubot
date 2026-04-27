const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const {
  DEFAULT_REQUIREMENT,
  normalizePort,
  parseCliArgs,
  loadGeneratedExports,
  parseBodyToObject,
  buildPreviewHtml,
  startPreviewServer,
} = require("../preview_server");

function createTempUsersFilePath() {
  return path.join(
    os.tmpdir(),
    "intelli-auth-users-" + Date.now() + "-" + Math.random().toString(16).slice(2) + ".json",
  );
}

test("preview: parseCliArgs should parse requirement and options", () => {
  const parsed = parseCliArgs([
    "Build login site",
    "--port",
    "3101",
    "--host",
    "0.0.0.0",
    "--open",
  ]);

  assert.equal(parsed.requirementText, "Build login site");
  assert.equal(parsed.port, 3101);
  assert.equal(parsed.host, "0.0.0.0");
  assert.equal(parsed.openBrowser, true);
});

test("preview: parseCliArgs should fall back to defaults", () => {
  const parsed = parseCliArgs(["--port=bad"]);

  assert.equal(parsed.requirementText, DEFAULT_REQUIREMENT);
  assert.equal(parsed.port, 3000);
  assert.equal(parsed.openBrowser, false);
});

test("preview: normalizePort should validate range", () => {
  assert.equal(normalizePort("1"), 1);
  assert.equal(normalizePort("65535"), 65535);
  assert.equal(normalizePort("0"), 3000);
  assert.equal(normalizePort("70000"), 3000);
});

test("preview: loadGeneratedExports should evaluate module exports", () => {
  const exported = loadGeneratedExports([
    "function renderLoginPage() {",
    "  return '<main>ok</main>';",
    "}",
    "module.exports = { renderLoginPage };",
  ].join("\n"));

  assert.equal(typeof exported.renderLoginPage, "function");
  assert.equal(exported.renderLoginPage(), "<main>ok</main>");
});

test("preview: parseBodyToObject should support json and form", () => {
  const jsonBody = parseBodyToObject("{\"username\":\"admin\",\"password\":\"123\"}", "application/json");
  assert.equal(jsonBody.username, "admin");

  const formBody = parseBodyToObject("username=admin&password=123&token=abc", "application/x-www-form-urlencoded");
  assert.equal(formBody.username, "admin");
  assert.equal(formBody.password, "123");
  assert.equal(formBody.token, "abc");
});

test("preview: buildPreviewHtml should include requirement and helper area", () => {
  const html = buildPreviewHtml({
    requirement: "Build a website with login feature",
    pageHtml: "<main><form id=\"login-form\"></form></main>",
    runResult: {
      step_results: [
        { task: "设计登录接口", source: "memory" },
      ],
      optimization_rounds: 2,
      used_memory_code: true,
    },
  });

  assert.equal(html.includes("Build a website with login feature"), true);
  assert.equal(html.includes("id=\"login-result\""), true);
  assert.equal(html.includes("id=\"token-view\""), true);
  assert.equal(html.includes("id=\"logout-btn\""), true);
  assert.equal(html.includes("id=\"fill-demo\""), true);
  assert.equal(html.includes("id=\"fill-demo\" class=\"btn\" type=\"button\""), true);
  assert.equal(html.includes("id=\"quick-login\""), true);
  assert.equal(html.includes("id=\"reset-demo\""), true);
  assert.equal(html.includes("id=\"action-fill-state\""), true);
  assert.equal(html.includes("id=\"action-quick-state\""), true);
  assert.equal(html.includes("id=\"action-reset-state\""), true);
  assert.equal(html.includes("id=\"agent-timeline\""), true);
  assert.equal(html.includes("id=\"activity-feed\""), true);
  assert.equal(html.includes("id=\"message-list\""), true);
  assert.equal(html.includes("id=\"agent-run-form\""), true);
  assert.equal(html.includes("id=\"conversation-list\""), true);
  assert.equal(html.includes("id=\"frontend-error-panel\""), true);
  assert.equal(html.includes("Agent Control Plane"), true);
  assert.equal(html.includes("/api/login"), true);
  assert.equal(html.includes("/api/me"), true);
  assert.equal(html.includes("/api/logout"), true);
  assert.equal(html.includes("/api/reset-demo-user"), true);
  assert.equal(html.includes("/api/agent/run"), true);
  assert.equal(html.includes("/api/agent/history"), true);
  assert.equal(html.includes("currentForm.setAttribute(\"method\", \"post\")") || html.includes("form.setAttribute(\"method\", \"post\")"), true);
  assert.equal(html.includes("window.history.replaceState"), true);
  assert.equal(html.includes("const initialStepCount ="), true);
  assert.equal(html.includes("loginWithDemoCredentials"), true);
  assert.equal(html.includes("resolveLoginInputs"), true);
  assert.equal(html.includes("readLoginPayload"), true);
  assert.equal(html.includes("setDemoActionState"), true);
  assert.equal(html.includes("setButtonBusy"), true);
  assert.equal(html.includes("window.addEventListener(\"error\""), true);
  assert.equal(html.includes("window.addEventListener(\"unhandledrejection\""), true);
});

test("preview: startPreviewServer should support real auth flow", async () => {
  const usersFilePath = createTempUsersFilePath();
  const running = await startPreviewServer({
    requirementText: "开发一个带登录功能的网站",
    host: "127.0.0.1",
    port: 0,
    openBrowser: false,
    usersFilePath,
  });

  try {
    const loginResponse = await fetch(`${running.baseUrl}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "admin", password: "123456" }),
    });

    const loginPayload = await loginResponse.json();
    assert.equal(loginResponse.status, 200);
    assert.equal(loginPayload.ok, true);
    assert.equal(typeof loginPayload.token, "string");
    assert.equal(loginPayload.user.username, "admin");

    const meResponse = await fetch(`${running.baseUrl}/api/me`, {
      headers: {
        Authorization: `Bearer ${loginPayload.token}`,
      },
    });
    const mePayload = await meResponse.json();
    assert.equal(meResponse.status, 200);
    assert.equal(mePayload.ok, true);
    assert.equal(mePayload.user.username, "admin");

    const logoutResponse = await fetch(`${running.baseUrl}/api/logout`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginPayload.token}`,
      },
      body: JSON.stringify({ token: loginPayload.token }),
    });
    const logoutPayload = await logoutResponse.json();
    assert.equal(logoutResponse.status, 200);
    assert.equal(logoutPayload.ok, true);

    const meAfterLogout = await fetch(`${running.baseUrl}/api/me`, {
      headers: {
        Authorization: `Bearer ${loginPayload.token}`,
      },
    });
    const meAfterLogoutPayload = await meAfterLogout.json();
    assert.equal(meAfterLogout.status, 401);
    assert.equal(meAfterLogoutPayload.ok, false);
  } finally {
    await new Promise((resolve) => {
      running.server.close(() => resolve());
    });

    if (fs.existsSync(usersFilePath)) {
      fs.unlinkSync(usersFilePath);
    }
  }
});

test("preview: startPreviewServer should run agent from api and return history", async () => {
  const usersFilePath = createTempUsersFilePath();
  const running = await startPreviewServer({
    requirementText: "开发一个带登录功能的网站",
    host: "127.0.0.1",
    port: 0,
    openBrowser: false,
    usersFilePath,
  });

  try {
    const loginResponse = await fetch(`${running.baseUrl}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "admin", password: "123456" }),
    });
    const loginPayload = await loginResponse.json();

    assert.equal(loginResponse.status, 200);
    assert.equal(loginPayload.ok, true);
    assert.equal(typeof loginPayload.token, "string");

    const runResponse = await fetch(`${running.baseUrl}/api/agent/run`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${loginPayload.token}`,
      },
      body: JSON.stringify({ prompt: "实现一个求和函数" }),
    });
    const runPayload = await runResponse.json();

    assert.equal(runResponse.status, 200);
    assert.equal(runPayload.ok, true);
    assert.equal(typeof runPayload.run_id, "string");
    assert.equal(typeof runPayload.result, "object");
    assert.equal(Array.isArray(runPayload.result.step_results), true);

    const historyResponse = await fetch(`${running.baseUrl}/api/agent/history`, {
      headers: {
        Authorization: `Bearer ${loginPayload.token}`,
      },
    });
    const historyPayload = await historyResponse.json();

    assert.equal(historyResponse.status, 200);
    assert.equal(historyPayload.ok, true);
    assert.equal(Array.isArray(historyPayload.items), true);
    assert.equal(historyPayload.items.length >= 2, true);
    assert.equal(historyPayload.items.some((item) => item.prompt === "实现一个求和函数"), true);
  } finally {
    await new Promise((resolve) => {
      running.server.close(() => resolve());
    });

    if (fs.existsSync(usersFilePath)) {
      fs.unlinkSync(usersFilePath);
    }
  }
});

test("preview: should migrate legacy users file and allow login", async () => {
  const usersFilePath = createTempUsersFilePath();
  fs.writeFileSync(
    usersFilePath,
    JSON.stringify([
      {
        username: "admin",
        role: "admin",
        password: "123456",
        disabled: false,
      },
    ], null, 2) + "\n",
    "utf8",
  );

  const running = await startPreviewServer({
    requirementText: "开发一个带登录功能的网站",
    host: "127.0.0.1",
    port: 0,
    openBrowser: false,
    usersFilePath,
  });

  try {
    const loginResponse = await fetch(`${running.baseUrl}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "admin", password: "123456" }),
    });
    const loginPayload = await loginResponse.json();

    assert.equal(loginResponse.status, 200);
    assert.equal(loginPayload.ok, true);

    const savedUsers = JSON.parse(fs.readFileSync(usersFilePath, "utf8"));
    assert.equal(Array.isArray(savedUsers), true);
    assert.equal(typeof savedUsers[0].password_hash, "string");
    assert.equal(Object.prototype.hasOwnProperty.call(savedUsers[0], "password"), false);
  } finally {
    await new Promise((resolve) => {
      running.server.close(() => resolve());
    });

    if (fs.existsSync(usersFilePath)) {
      fs.unlinkSync(usersFilePath);
    }
  }
});

test("preview: reset demo user endpoint should recover admin login", async () => {
  const usersFilePath = createTempUsersFilePath();
  fs.writeFileSync(
    usersFilePath,
    JSON.stringify([
      {
        username: "admin",
        role: "admin",
        password: "wrong-password",
        disabled: false,
      },
    ], null, 2) + "\n",
    "utf8",
  );

  const running = await startPreviewServer({
    requirementText: "开发一个带登录功能的网站",
    host: "127.0.0.1",
    port: 0,
    openBrowser: false,
    usersFilePath,
  });

  try {
    const loginBefore = await fetch(`${running.baseUrl}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "admin", password: "definitely-wrong" }),
    });
    assert.equal(loginBefore.status, 401);

    const resetResponse = await fetch(`${running.baseUrl}/api/reset-demo-user`, {
      method: "POST",
    });
    const resetPayload = await resetResponse.json();

    assert.equal(resetResponse.status, 200);
    assert.equal(resetPayload.ok, true);
    assert.equal(resetPayload.user.username, "admin");

    const loginAfter = await fetch(`${running.baseUrl}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ username: "admin", password: "123456" }),
    });
    const loginAfterPayload = await loginAfter.json();

    assert.equal(loginAfter.status, 200);
    assert.equal(loginAfterPayload.ok, true);
    assert.equal(loginAfterPayload.user.username, "admin");
  } finally {
    await new Promise((resolve) => {
      running.server.close(() => resolve());
    });

    if (fs.existsSync(usersFilePath)) {
      fs.unlinkSync(usersFilePath);
    }
  }
});

test("preview: favicon endpoint should not return 404", async () => {
  const usersFilePath = createTempUsersFilePath();
  const running = await startPreviewServer({
    requirementText: "开发一个带登录功能的网站",
    host: "127.0.0.1",
    port: 0,
    openBrowser: false,
    usersFilePath,
  });

  try {
    const response = await fetch(`${running.baseUrl}/favicon.ico`);
    assert.equal(response.status, 204);
  } finally {
    await new Promise((resolve) => {
      running.server.close(() => resolve());
    });

    if (fs.existsSync(usersFilePath)) {
      fs.unlinkSync(usersFilePath);
    }
  }
});
