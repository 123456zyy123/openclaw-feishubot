const test = require("node:test");
const assert = require("node:assert/strict");

const { parseRequirement } = require("../src/parser");

test("parseRequirement should extract sorting intent", () => {
  const result = parseRequirement("实现一个函数，对输入数字数组进行排序并返回结果。");

  assert.equal(result.功能, "对数字数组进行排序");
  assert.equal(result.输入, "数字数组（整数列表）");
  assert.equal(result.输出, "升序排序后的数字数组");
  assert.ok(Array.isArray(result.步骤));
  assert.equal(result.步骤.length > 0, true);
});
