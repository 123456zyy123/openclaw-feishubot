class DebugAgent {
  execute({ errorMessage, codeLine, requirement }) {
    const text = String(errorMessage || "");

    if (text.includes("sort is not a function")) {
      return {
        原因: "data 不是数组，无法调用 sort 方法。",
        修复建议: [
          "在排序前使用 Array.isArray 进行类型校验。",
          "必要时将可迭代输入转换为数组。",
          "补充空输入和异常输入测试。",
        ],
        修复示例: "function sortArray(arr) { if (!Array.isArray(arr)) throw new Error('输入必须为数组'); return [...arr].sort((a, b) => a - b); }",
        关联代码: codeLine || "",
        需求上下文: requirement || null,
      };
    }

    return {
      原因: "暂未命中已知错误模式。",
      修复建议: [
        "检查输入类型与边界值。",
        "开启更多日志并定位触发路径。",
        "为失败路径增加最小复现测试。",
      ],
      关联代码: codeLine || "",
      需求上下文: requirement || null,
    };
  }
}

module.exports = {
  DebugAgent,
};
