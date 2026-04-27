class ReflectionAgent {
  execute({ requirementText, code }) {
    const requirement = String(requirementText || "").trim();
    const sourceCode = String(code || "");
    const problems = this.detectProblems(requirement, sourceCode);
    const suggestions = this.buildSuggestions(problems);
    const optimizedCode = this.optimizeCode(requirement, sourceCode, problems);

    return {
      problems,
      suggestions,
      optimized_code: optimizedCode,
    };
  }

  detectProblems(requirementText, code) {
    const problems = [];
    const normalizedRequirement = requirementText.toLowerCase();

    if (!code.trim()) {
      problems.push("结构问题：没有可分析代码");
      return problems;
    }

    const hasFunction = /function\s+[a-zA-Z0-9_]+\s*\(/.test(code);
    const hasDocComment = /\/\*\*[\s\S]*?\*\//.test(code);
    if (hasFunction && !hasDocComment) {
      problems.push("可读性问题：缺少函数级注释");
    }

    if (code.includes("const mockDB = { admin: '123456' };")) {
      problems.push("可扩展问题：认证数据被硬编码");
    }

    if (code.includes("function generatedFunction(input)") && code.includes("return input;")) {
      problems.push("结构问题：占位函数逻辑过于简单");
    }

    if (code.includes("function sortArray(arr)") && code.includes("sort((a, b) => a - b)") && !code.includes("isNumericArray")) {
      problems.push("健壮性问题：排序逻辑未校验数组元素类型");
    }

    const longFunctions = this.findLongFunctions(code, 18);
    if (longFunctions.length > 0) {
      problems.push(`可维护性问题：函数过长（${longFunctions.join(", ")}）`);
    }

    if ((normalizedRequirement.includes("登录") || normalizedRequirement.includes("login")) && !code.includes("LOGIN_ROUTE")) {
      problems.push("可扩展问题：路由字符串未抽离为常量");
    }

    return problems;
  }

  buildSuggestions(problems) {
    const suggestions = [];

    for (const problem of problems) {
      if (problem.includes("缺少函数级注释")) {
        suggestions.push("为核心函数补充 JSDoc 注释，明确输入输出与副作用");
      }

      if (problem.includes("认证数据被硬编码")) {
        suggestions.push("将凭据抽离为可注入配置，避免业务逻辑与数据耦合");
      }

      if (problem.includes("占位函数逻辑过于简单")) {
        suggestions.push("增加最小输入校验和命名化中间变量，提高代码可读性");
      }

      if (problem.includes("排序逻辑未校验数组元素类型")) {
        suggestions.push("补充数字数组校验函数，防止运行时比较异常");
      }

      if (problem.includes("函数过长")) {
        suggestions.push("拆分长函数为小函数，降低单函数复杂度");
      }

      if (problem.includes("路由字符串未抽离为常量")) {
        suggestions.push("提取路由常量，避免散落的魔法字符串");
      }
    }

    return Array.from(new Set(suggestions));
  }

  optimizeCode(requirementText, originalCode, problems) {
    let code = String(originalCode || "");
    if (!code.trim()) {
      return code;
    }

    let changed = false;

    if (problems.some((item) => item.includes("排序逻辑未校验数组元素类型"))) {
      const replacement = [
        "/**",
        " * 校验输入是否为纯数字数组。",
        " */",
        "function isNumericArray(arr) {",
        "  return Array.isArray(arr) && arr.every((item) => typeof item === 'number' && Number.isFinite(item));",
        "}",
        "",
        "/**",
        " * 对数字数组进行升序排序，并返回新数组。",
        " */",
        "function sortArray(arr) {",
        "  if (!isNumericArray(arr)) {",
        "    throw new Error('输入必须为数字数组');",
        "  }",
        "",
        "  const copied = [...arr];",
        "  return copied.sort((a, b) => a - b);",
        "}",
      ].join("\n");

      const nextCode = this.replaceFunction(code, "sortArray", replacement);
      if (nextCode !== code) {
        code = nextCode;
        changed = true;
      }
    }

    if (problems.some((item) => item.includes("认证数据被硬编码"))) {
      const replacement = [
        "const DEFAULT_CREDENTIALS = Object.freeze({ admin: '123456' });",
        "",
        "/**",
        " * 校验用户名和密码，返回 token。",
        " */",
        "function authenticateUser(username, password, credentials = DEFAULT_CREDENTIALS) {",
        "  const normalizedUsername = String(username || '').trim();",
        "  const normalizedPassword = String(password || '').trim();",
        "",
        "  if (!normalizedUsername || !normalizedPassword) {",
        "    return '';",
        "  }",
        "",
        "  if (credentials[normalizedUsername] !== normalizedPassword) {",
        "    return '';",
        "  }",
        "",
        "  return `token-${normalizedUsername}`;",
        "}",
      ].join("\n");

      const nextCode = this.replaceFunction(code, "authenticateUser", replacement);
      if (nextCode !== code) {
        code = nextCode;
        changed = true;
      }
    }

    if (problems.some((item) => item.includes("路由字符串未抽离为常量")) && code.includes("app.post('/api/login'")) {
      const withConstant = code.includes("const LOGIN_ROUTE = '/api/login';")
        ? code
        : `const LOGIN_ROUTE = '/api/login';\n\n${code}`;

      const nextCode = withConstant.replace("app.post('/api/login'", "app.post(LOGIN_ROUTE");
      if (nextCode !== code) {
        code = nextCode;
        changed = true;
      }
    }

    if (problems.some((item) => item.includes("占位函数逻辑过于简单"))) {
      const replacement = [
        "/**",
        " * 通用透传函数：返回输入值，便于后续扩展处理逻辑。",
        " */",
        "function generatedFunction(input) {",
        "  const output = input;",
        "  return output;",
        "}",
      ].join("\n");

      const nextCode = this.replaceFunction(code, "generatedFunction", replacement);
      if (nextCode !== code) {
        code = nextCode;
        changed = true;
      }
    }

    if (problems.some((item) => item.includes("缺少函数级注释"))) {
      const codeWithComments = this.addMissingFunctionComments(code);
      if (codeWithComments !== code) {
        code = codeWithComments;
        changed = true;
      }
    }

    if (changed && !code.startsWith("// Optimized by ReflectionAgent")) {
      code = `// Optimized by ReflectionAgent\n${code}`;
    }

    return code;
  }

  addMissingFunctionComments(code) {
    const functionNames = this.extractFunctionNames(code);
    let output = code;

    for (const functionName of functionNames) {
      const token = `function ${functionName}(`;
      const index = output.indexOf(token);
      if (index <= 0) {
        continue;
      }

      const prefix = output.slice(0, index);
      const hasNearbyComment = /\/\*\*[\s\S]*?\*\/\s*$/.test(prefix);
      if (hasNearbyComment) {
        continue;
      }

      const comment = `/**\n * ${functionName} auto generated helper.\n */\n`;
      output = `${output.slice(0, index)}${comment}${output.slice(index)}`;
    }

    return output;
  }

  extractFunctionNames(code) {
    const regex = /function\s+([a-zA-Z0-9_]+)\s*\(/g;
    const names = [];
    let match = regex.exec(code);

    while (match) {
      names.push(match[1]);
      match = regex.exec(code);
    }

    return names;
  }

  findLongFunctions(code, threshold) {
    const lines = String(code || "").split("\n");
    const result = [];

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      const functionMatch = line.match(/function\s+([a-zA-Z0-9_]+)\s*\(/);
      if (!functionMatch) {
        continue;
      }

      let depth = 0;
      let foundStart = false;
      let endLine = i;

      for (let j = i; j < lines.length; j += 1) {
        const chars = lines[j].split("");
        for (const ch of chars) {
          if (ch === "{") {
            depth += 1;
            foundStart = true;
          }
          if (ch === "}") {
            depth -= 1;
          }
        }

        if (foundStart && depth <= 0) {
          endLine = j;
          break;
        }
      }

      if (endLine - i + 1 > threshold) {
        result.push(functionMatch[1]);
      }
    }

    return result;
  }

  replaceFunction(code, functionName, replacementCode) {
    const token = `function ${functionName}(`;
    const start = code.indexOf(token);
    if (start < 0) {
      return code;
    }

    const braceStart = code.indexOf("{", start);
    if (braceStart < 0) {
      return code;
    }

    let depth = 0;
    let end = -1;
    for (let i = braceStart; i < code.length; i += 1) {
      const ch = code[i];
      if (ch === "{") {
        depth += 1;
      } else if (ch === "}") {
        depth -= 1;
        if (depth === 0) {
          end = i;
          break;
        }
      }
    }

    if (end < 0) {
      return code;
    }

    return `${code.slice(0, start)}${replacementCode}${code.slice(end + 1)}`;
  }
}

module.exports = {
  ReflectionAgent,
};