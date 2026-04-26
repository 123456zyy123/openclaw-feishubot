/**
 * 根据解析后的需求 JSON 生成 JavaScript 函数代码。
 */
function generateCode(requirementJson) {
  const spec = requirementJson || {};
  const feature = String(spec.功能 || "");

  if (feature.includes("排序")) {
    return [
      "function sortArray(arr) {",
      "  if (!Array.isArray(arr)) {",
      "    throw new Error('输入必须为数组');",
      "  }",
      "  return [...arr].sort((a, b) => a - b);",
      "}",
      "",
      "module.exports = { sortArray };",
    ].join("\n");
  }

  return [
    "function generatedFunction(input) {",
    "  return input;",
    "}",
    "",
    "module.exports = { generatedFunction };",
  ].join("\n");
}

module.exports = {
  generateCode,
};
