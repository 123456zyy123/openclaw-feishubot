const { parseRequirement } = require("./parser");
const { generateCode } = require("./generator");

/**
 * 智能代码助手主流程：解析需求 -> 生成代码。
 */
function runAssistant(userRequirementText) {
  const requirement = parseRequirement(userRequirementText);
  const code = generateCode(requirement);

  return {
    requirement,
    code,
  };
}

module.exports = {
  runAssistant,
};
