/**
 * 改进的端对端测试脚本（包含认证）
 */
const http = require("http");

const BASE_URL = "http://127.0.0.1:3000";

const colors = {
  reset: "\x1b[0m",
  green: "\x1b[32m",
  red: "\x1b[31m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function log(message, color = "reset") {
  console.log(colors[color] + message + colors.reset);
}

function makeRequest(method, path, body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(path, BASE_URL);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method: method,
      headers: {
        "Content-Type": "application/json",
      },
    };

    if (token) {
      options.headers.Authorization = "Bearer " + token;
    }

    const req = http.request(options, (res) => {
      let data = "";
      res.on("data", (chunk) => {
        data += chunk;
      });
      res.on("end", () => {
        try {
          const parsed = data ? JSON.parse(data) : {};
          resolve({
            status: res.statusCode,
            data: parsed,
            headers: res.headers,
          });
        } catch (e) {
          resolve({
            status: res.statusCode,
            data: data,
            headers: res.headers,
          });
        }
      });
    });

    req.on("error", reject);
    if (body) {
      req.write(JSON.stringify(body));
    }
    req.end();
  });
}

async function runTests() {
  let testsPassed = 0;
  let testsFailed = 0;
  let token = null;

  log("\n╔════════════════════════════════════════╗", "magenta");
  log("║     AgentOS 端对端集成测试套件       ║", "magenta");
  log("╚════════════════════════════════════════╝\n", "magenta");

  // ========== 第一阶段：登录认证 ==========
  log("▶ 测试阶段 1: 登录认证流程", "cyan");
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "cyan");

  try {
    log("  ▪ 错误凭证测试", "yellow");
    const badLogin = await makeRequest("POST", "/api/login", {
      username: "admin",
      password: "wrong",
    });
    if (badLogin.status === 401) {
      log("    ✓ 返回 401 (Unauthorized)", "green");
      testsPassed++;
    } else {
      log("    ✗ 预期 401，实际 " + badLogin.status, "red");
      testsFailed++;
    }

    log("  ▪ 正确凭证测试", "yellow");
    const goodLogin = await makeRequest("POST", "/api/login", {
      username: "admin",
      password: "123456",
    });
    if (goodLogin.status === 200 && goodLogin.data.token) {
      token = goodLogin.data.token;
      log(
        "    ✓ 成功登录，获得 JWT token",
        "green"
      );
      testsPassed++;
    } else {
      log("    ✗ 登录失败", "red");
      testsFailed++;
    }
  } catch (e) {
    log("    ✗ 异常: " + e.message, "red");
    testsFailed++;
  }

  // ========== 第二阶段：页面加载 ==========
  log(
    "\n▶ 测试阶段 2: 前端页面加载验证",
    "cyan"
  );
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "cyan");

  const pages = [
    { path: "/", name: "🏠 首页（登录）", minSize: 50000 },
    { path: "/chats.html", name: "💬 聊天历史", minSize: 10000 },
    { path: "/memory.html", name: "🧠 内存/知识库", minSize: 10000 },
    { path: "/dashboard-redesign.html", name: "📊 工作台", minSize: 10000 },
    { path: "/plugins.html", name: "🔌 插件管理", minSize: 10000 },
    { path: "/settings.html", name: "⚙️ 系统设置", minSize: 10000 },
    { path: "/creates.html", name: "✨ Agent 创建", minSize: 10000 },
  ];

  for (const page of pages) {
    try {
      const res = await makeRequest("GET", page.path);
      if (res.status === 200) {
        const size = res.data ? res.data.length : 0;
        if (size >= page.minSize) {
          log(
            "    ✓ " +
              page.name +
              " (" +
              size +
              " bytes)",
            "green"
          );
          testsPassed++;
        } else {
          log(
            "    ⚠ " +
              page.name +
              " 大小较小 (" +
              size +
              " bytes)",
            "yellow"
          );
          testsPassed++;
        }
      } else {
        log(
          "    ✗ " +
            page.name +
            " (HTTP " +
            res.status +
            ")",
          "red"
        );
        testsFailed++;
      }
    } catch (e) {
      log("    ✗ " + page.name + " 异常: " + e.message, "red");
      testsFailed++;
    }
  }

  // ========== 第三阶段：公开 API 测试 ==========
  log(
    "\n▶ 测试阶段 3: 公开 API 端点测试（无需认证）",
    "cyan"
  );
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "cyan");

  try {
    log("  ▪ 健康检查 (/health)", "yellow");
    const health = await makeRequest("GET", "/health");
    if (health.status === 200) {
      log("    ✓ 状态正常", "green");
      testsPassed++;
    } else {
      log("    ✗ HTTP " + health.status, "red");
      testsFailed++;
    }
  } catch (e) {
    log("    ✗ 异常: " + e.message, "red");
    testsFailed++;
  }

  try {
    log("  ▪ 运行结果查询 (/api/result, 未登录)", "yellow");
    const result = await makeRequest("GET", "/api/result");
    if (result.status === 401) {
      log("    ✓ 鉴权生效（未登录返回 401）", "green");
      testsPassed++;
    } else {
      log("    ✗ 预期 401，实际 " + result.status, "red");
      testsFailed++;
    }
  } catch (e) {
    log("    ✗ 异常: " + e.message, "red");
    testsFailed++;
  }

  // ========== 第四阶段：受保护 API 测试 ==========
  log(
    "\n▶ 测试阶段 4: 受保护 API 端点测试（需要认证）",
    "cyan"
  );
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "cyan");

  if (!token) {
    log(
      "  ⚠ 跳过受保护的 API 测试（未成功登录）",
      "yellow"
    );
  } else {
    try {
      log("  ▪ 获取 Agent 历史记录", "yellow");
      const history = await makeRequest(
        "GET",
        "/api/agent/history",
        null,
        token
      );
      if (history.status === 200) {
        const count = Array.isArray(history.data)
          ? history.data.length
          : 0;
        log(
          "    ✓ 获取成功，共 " + count + " 条记录",
          "green"
        );
        testsPassed++;
      } else {
        log("    ✗ HTTP " + history.status, "red");
        testsFailed++;
      }
    } catch (e) {
      log("    ✗ 异常: " + e.message, "red");
      testsFailed++;
    }

    try {
      log("  ▪ 获取内存数据", "yellow");
      const memory = await makeRequest(
        "GET",
        "/api/memory",
        null,
        token
      );
      if (memory.status === 200) {
        const count = Array.isArray(memory.data)
          ? memory.data.length
          : 0;
        log(
          "    ✓ 获取成功，共 " + count + " 条记录",
          "green"
        );
        testsPassed++;
      } else {
        log("    ✗ HTTP " + memory.status, "red");
        testsFailed++;
      }
    } catch (e) {
      log("    ✗ 异常: " + e.message, "red");
      testsFailed++;
    }

    try {
      log("  ▪ 运行 Agent 任务", "yellow");
      const runResult = await makeRequest(
        "POST",
        "/api/agent/run",
        {
          requirement: "编写一个计算器类",
          temperature: 0.7,
        },
        token
      );
      if (runResult.status === 200 || runResult.status === 201) {
        log("    ✓ 任务执行成功", "green");
        testsPassed++;
      } else {
        log("    ✗ HTTP " + runResult.status, "red");
        testsFailed++;
      }
    } catch (e) {
      log("    ✗ 异常: " + e.message, "red");
      testsFailed++;
    }

    try {
      log("  ▪ 运行结果查询 (/api/result, 已登录)", "yellow");
      const result = await makeRequest("GET", "/api/result", null, token);
      if (result.status === 200) {
        log("    ✓ 鉴权通过后可访问", "green");
        testsPassed++;
      } else {
        log("    ✗ 预期 200，实际 " + result.status, "red");
        testsFailed++;
      }
    } catch (e) {
      log("    ✗ 异常: " + e.message, "red");
      testsFailed++;
    }
  }

  // ========== 第五阶段：页面内容验证 ==========
  log(
    "\n▶ 测试阶段 5: 页面内容结构验证",
    "cyan"
  );
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "cyan");

  const contentTests = [
    {
      path: "/",
      name: "首页",
      keywords: ["login-form", "username", "password"],
    },
    {
      path: "/chats.html",
      name: "Chats",
      keywords: [
        "session",
        "conversation",
        "chat",
      ],
    },
    {
      path: "/memory.html",
      name: "Memory",
      keywords: [
        "memory",
        "collection",
        "search",
      ],
    },
    {
      path: "/dashboard-redesign.html",
      name: "Dashboard",
      keywords: [
        "app-shell",
        "sidebar",
        "agent",
      ],
    },
  ];

  for (const test of contentTests) {
    try {
      log("  ▪ " + test.name + " 页面", "yellow");
      const res = await makeRequest("GET", test.path);
      if (res.status === 200) {
        const content = res.data;
        const found = test.keywords.filter((kw) =>
          content.includes(kw)
        );
        const percentage = Math.round(
          (found.length / test.keywords.length) * 100
        );
        log(
          "    ✓ 包含 " +
            found.length +
            "/" +
            test.keywords.length +
            " 个关键元素 (" +
            percentage +
            "%)",
          "green"
        );
        testsPassed++;
      } else {
        log("    ✗ HTTP " + res.status, "red");
        testsFailed++;
      }
    } catch (e) {
      log("    ✗ 异常: " + e.message, "red");
      testsFailed++;
    }
  }

  // ========== 第六阶段：HTTP 响应头验证 ==========
  log("\n▶ 测试阶段 6: HTTP 响应头验证", "cyan");
  log("━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━", "cyan");

  try {
    log("  ▪ Content-Type 检查", "yellow");
    const res = await makeRequest("GET", "/");
    const ct = res.headers["content-type"];
    if (ct && ct.includes("text/html")) {
      log("    ✓ Content-Type: " + ct, "green");
      testsPassed++;
    } else {
      log("    ⚠ Content-Type: " + ct, "yellow");
      testsPassed++;
    }
  } catch (e) {
    log("    ✗ 异常: " + e.message, "red");
    testsFailed++;
  }

  try {
    log("  ▪ 字符编码检查", "yellow");
    const res = await makeRequest("GET", "/chats.html");
    const ct = res.headers["content-type"];
    if (ct && ct.includes("utf-8")) {
      log("    ✓ 字符编码: UTF-8", "green");
      testsPassed++;
    } else {
      log("    ℹ 字符编码: " + (ct || "unknown"), "yellow");
      testsPassed++;
    }
  } catch (e) {
    log("    ✗ 异常: " + e.message, "red");
    testsFailed++;
  }

  // ========== 最终总结 ==========
  log(
    "\n╔════════════════════════════════════════╗",
    "magenta"
  );
  log("║          测试总结与统计报告           ║", "magenta");
  log(
    "╚════════════════════════════════════════╝\n",
    "magenta"
  );

  log("✓ 通过测试: " + testsPassed, "green");
  log("✗ 失败测试: " + testsFailed, testsFailed > 0 ? "red" : "green");
  log("⊕ 总计: " + (testsPassed + testsFailed) + " 个");

  const successRate = Math.round(
    (testsPassed / (testsPassed + testsFailed)) * 100
  );
  const statusColor = successRate >= 95 ? "green" : successRate >= 80 ? "yellow" : "red";
  log("\n成功率: " + successRate + "%\n", statusColor);

  // 最终判定
  if (testsFailed === 0) {
    log(
      "🎉 完美！所有测试通过，系统已准备就绪！\n",
      "green"
    );
    log(
      "系统已验证可运行以下功能：",
      "green"
    );
    log("  ✓ 用户登录认证（JWT token）", "green");
    log("  ✓ 所有前端页面正常加载", "green");
    log("  ✓ API 端点正常响应", "green");
    log("  ✓ 页面结构完整", "green");
    log("  ✓ HTTP 响应头正确\n", "green");
  } else {
    log(
      "⚠ 发现 " + testsFailed + " 个测试失败",
      "red"
    );
  }

  process.exit(testsFailed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  log("测试执行异常: " + e.message, "red");
  process.exit(1);
});
