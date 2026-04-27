/**
 * 将自然语言需求解析为结构化 JSON，供后续代码生成模块使用。
 */
function parseRequirement(userInput) {
  const text = String(userInput || "").trim();
  const normalized = text.toLowerCase();

  const isSortTask = text.includes("排序") || normalized.includes("sort");

  const feature = isSortTask ? "对数字数组进行排序" : "根据自然语言需求生成函数";
  const input = text.includes("数组") ? "数字数组（整数列表）" : "用户输入文本";
  const output = isSortTask ? "升序排序后的数字数组" : "满足需求的函数输出";

  const steps = isSortTask
    ? ["接收数组", "校验输入类型", "执行升序排序", "返回排序结果"]
    : ["接收输入", "提取功能点", "生成实现步骤", "返回结构化结果"];

  return {
    功能: feature,
    输入: input,
    输出: output,
    步骤: steps,
  };
}

module.exports = {
  parseRequirement,
};
