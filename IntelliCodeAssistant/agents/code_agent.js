const { generateCode } = require("../src/generator");

class CodeAgent {
  constructor(memoryAgent) {
    this.memoryAgent = memoryAgent || null;
  }

  execute(requirement, options = {}) {
    const rootRequirementText = String(options.rootRequirement || requirement.原始需求 || requirement.功能 || "");
    const subTaskText = String(options.subTask || requirement.子任务 || "").trim();
    const shouldGenerateFragment = Boolean(subTaskText) && Number(options.totalTasks || 1) > 1;
    const requirementText = shouldGenerateFragment
      ? (subTaskText || rootRequirementText)
      : (rootRequirementText || subTaskText);
    const memoryScope = String(options.memoryScope || (shouldGenerateFragment ? "step" : "run"));
    const memoryMatches = this.memoryAgent
      ? this.memoryAgent.searchSimilar(requirementText, { limit: 3, minScore: 0.2, scope: memoryScope })
      : [];
    const reusableBest = this.memoryAgent
      ? this.memoryAgent.findBestReusableCode(requirementText, {
        minScore: shouldGenerateFragment ? 0.65 : 0.55,
        limit: 5,
        scope: memoryScope,
      })
      : null;

    // Reuse high quality historical code before generating a new implementation.
    if (reusableBest && options.allowMemoryReuse !== false) {
      const reusableCode = reusableBest.code;
      const fragment = shouldGenerateFragment
        ? this.buildFragmentFromCode({
          taskText: subTaskText,
          code: reusableCode,
          stepIndex: Number(options.stepIndex || 0),
        })
        : null;

      return {
        code: reusableCode,
        fragment,
        usedMemoryCode: true,
        memoryMatches,
        source: "memory",
      };
    }

    if (shouldGenerateFragment) {
      const fragment = this.generateSubTaskFragment({
        taskText: subTaskText,
        rootRequirementText,
        stepIndex: Number(options.stepIndex || 0),
      });

      return {
        code: fragment.code,
        fragment,
        usedMemoryCode: false,
        memoryMatches,
        source: "generated",
      };
    }

    const code = generateCode({
      功能: requirement.功能,
      输入: requirement.输入,
      输出: requirement.输出,
      步骤: requirement.步骤,
    });

    return {
      code,
      fragment: null,
      usedMemoryCode: false,
      memoryMatches,
      source: "generated",
    };
  }

  compose(stepResults, options = {}) {
    const steps = Array.isArray(stepResults) ? stepResults : [];
    if (steps.length === 0) {
      return "";
    }

    const fragments = steps
      .map((item) => item.fragment)
      .filter((item) => item && typeof item.code === "string");

    if (fragments.length === 0) {
      return steps.map((item) => String(item.code || "").trim()).filter(Boolean).join("\n\n");
    }

    const uniqueFragments = [];
    const seenNames = new Set();

    for (const fragment of fragments) {
      const name = String(fragment.name || "").trim();
      if (!name || seenNames.has(name)) {
        continue;
      }

      seenNames.add(name);
      uniqueFragments.push(fragment);
    }

    const body = uniqueFragments
      .map((fragment) => String(fragment.code || "").trim())
      .filter(Boolean)
      .join("\n\n");

    const exportsList = uniqueFragments.map((fragment) => fragment.name);
    const rootRequirementText = String(options.rootRequirement || "").trim();
    const lines = [];

    if (rootRequirementText) {
      lines.push(`// Root requirement: ${rootRequirementText}`);
      lines.push("");
    }

    if (body) {
      lines.push(body);
      lines.push("");
    }

    lines.push(`module.exports = { ${exportsList.join(", ")} };`);
    return lines.join("\n").trim() + "\n";
  }

  generateSubTaskFragment({ taskText, rootRequirementText, stepIndex }) {
    const task = String(taskText || "").trim() || `task_${stepIndex + 1}`;
    const normalizedTask = task.toLowerCase();
    const normalizedRoot = String(rootRequirementText || "").toLowerCase();
    const normalizedAll = `${normalizedTask} ${normalizedRoot}`;

    if (normalizedAll.includes("排序") || normalizedAll.includes("sort")) {
      return {
        task,
        name: "sortArray",
        code: [
          "function sortArray(arr) {",
          "  if (!Array.isArray(arr)) {",
          "    throw new Error('输入必须为数组');",
          "  }",
          "  return [...arr].sort((a, b) => a - b);",
          "}",
        ].join("\n"),
      };
    }

    if (normalizedAll.includes("登录") || normalizedAll.includes("login")) {
      if (normalizedTask.includes("接口") || normalizedTask.includes("api")) {
        return {
          task,
          name: "registerLoginRoutes",
          code: [
            "function registerLoginRoutes(app, authService) {",
            "  app.post('/api/login', (req, res) => {",
            "    const { username, password } = req.body || {};",
            "    const token = authService.authenticateUser(username, password);",
            "",
            "    if (!token) {",
            "      return res.status(401).json({ message: '用户名或密码错误' });",
            "    }",
            "",
            "    return res.json({ token });",
            "  });",
            "}",
          ].join("\n"),
        };
      }

      if (normalizedTask.includes("前端") || normalizedTask.includes("页面") || normalizedTask.includes("frontend")) {
        return {
          task,
          name: "renderLoginPage",
          code: [
            "function renderLoginPage() {",
            "  return [",
            "    '<main class=\"login-container\">',",
            "    '  <h1>Login</h1>',",
            "    '  <form id=\"login-form\">',",
            "    '    <input name=\"username\" placeholder=\"用户名\" required />',",
            "    '    <input name=\"password\" type=\"password\" placeholder=\"密码\" required />',",
            "    '    <button type=\"submit\">登录</button>',",
            "    '  </form>',",
            "    '</main>',",
            "  ].join('\\n');",
            "}",
          ].join("\n"),
        };
      }

      if (normalizedTask.includes("后端") || normalizedTask.includes("逻辑") || normalizedTask.includes("backend")) {
        return {
          task,
          name: "authenticateUser",
          code: [
            "function authenticateUser(username, password) {",
            "  const mockDB = { admin: '123456' };",
            "",
            "  if (!username || !password) {",
            "    return '';",
            "  }",
            "",
            "  if (mockDB[username] !== password) {",
            "    return '';",
            "  }",
            "",
            "  return `token-${username}`;",
            "}",
          ].join("\n"),
        };
      }

      if (normalizedTask.includes("测试") || normalizedTask.includes("test")) {
        return {
          task,
          name: "runLoginTests",
          code: [
            "function runLoginTests(authService) {",
            "  const pass = authService.authenticateUser('admin', '123456');",
            "  const fail = authService.authenticateUser('admin', 'bad-password');",
            "",
            "  return {",
            "    pass: Boolean(pass),",
            "    fail: !fail,",
            "  };",
            "}",
          ].join("\n"),
        };
      }
    }

    const fallbackName = this.buildSafeName(task, stepIndex);
    return {
      task,
      name: fallbackName,
      code: [
        `function ${fallbackName}(context = {}) {`,
        "  return {",
        "    ...context,",
        `    ${JSON.stringify(fallbackName)}: true,`,
        "  };",
        "}",
      ].join("\n"),
    };
  }

  buildFragmentFromCode({ taskText, code, stepIndex }) {
    const inferredName = this.inferPrimaryFunctionName(code);
    const name = inferredName || this.buildSafeName(taskText, stepIndex);

    return {
      task: String(taskText || "").trim(),
      name,
      code: String(code || "").trim(),
    };
  }

  inferPrimaryFunctionName(code) {
    const text = String(code || "");
    const match = text.match(/function\s+([a-zA-Z0-9_]+)\s*\(/);
    return match ? match[1] : "";
  }

  buildSafeName(taskText, stepIndex) {
    const normalized = String(taskText || "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!normalized) {
      return `taskStep${stepIndex + 1}`;
    }

    if (/^[0-9]/.test(normalized)) {
      return `task_${normalized}`;
    }

    return normalized;
  }
}

module.exports = {
  CodeAgent,
};
