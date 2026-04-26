const { parseRequirement } = require("../src/parser");

class RequirementAgent {
  execute(userInput) {
    const parsed = parseRequirement(userInput);
    const functionName = String(parsed.功能 || "").includes("排序")
      ? "sortArray"
      : "generatedFunction";

    return {
      原始需求: String(userInput || "").trim(),
      功能: parsed.功能,
      输入: parsed.输入,
      输出: parsed.输出,
      步骤: parsed.步骤,
      language: "javascript",
      functionName,
    };
  }
}

module.exports = {
  RequirementAgent,
};
