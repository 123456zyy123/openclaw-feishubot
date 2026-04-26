class TestAgent {
  execute({ functionName, feature }) {
    if (functionName === "sortArray" || String(feature || "").includes("排序")) {
      return [
        "const test = require('node:test');",
        "const assert = require('node:assert/strict');",
        "const { sortArray } = require('./generated');",
        "",
        "test('sortArray empty array', () => {",
        "  assert.deepEqual(sortArray([]), []);",
        "});",
        "",
        "test('sortArray random numbers', () => {",
        "  assert.deepEqual(sortArray([3, 1, 2]), [1, 2, 3]);",
        "});",
      ].join("\n");
    }

    return [
      "const test = require('node:test');",
      "const assert = require('node:assert/strict');",
      "const { generatedFunction } = require('./generated');",
      "",
      "test('generatedFunction passthrough', () => {",
      "  assert.equal(generatedFunction('x'), 'x');",
      "});",
    ].join("\n");
  }
}

module.exports = {
  TestAgent,
};
