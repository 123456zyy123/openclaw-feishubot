const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const { AgentManager } = require("../agent_manager");
const { MemoryAgent } = require("../agents/memory_agent");

function createTempMemoryPath() {
  return path.join(
    os.tmpdir(),
    "intelli-memory-" + Date.now() + "-" + Math.random().toString(16).slice(2) + ".json",
  );
}

test("flow: sorting requirement should produce sortArray code", () => {
  const memoryFilePath = createTempMemoryPath();
  const manager = new AgentManager({ memoryFilePath });

  const result = manager.run("实现一个函数，对输入数字数组进行排序并返回结果。");

  assert.equal(result.requirement.functionName, "sortArray");
  assert.ok(result.code.includes("function sortArray(arr)"));
  assert.ok(result.tests.includes("sortArray random numbers"));

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});

test("flow: generic requirement should produce generatedFunction code", () => {
  const memoryFilePath = createTempMemoryPath();
  const manager = new AgentManager({ memoryFilePath });

  const result = manager.run("写一个透传函数，返回输入值");

  assert.equal(result.requirement.functionName, "generatedFunction");
  assert.ok(result.code.includes("function generatedFunction(input)"));

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});

test("flow: manager should write memory after run", () => {
  const memoryFilePath = createTempMemoryPath();
  const manager = new AgentManager({ memoryFilePath });

  manager.run("实现一个函数，对输入数字数组进行排序并返回结果。");

  const content = fs.readFileSync(memoryFilePath, "utf8");
  const records = JSON.parse(content);

  assert.equal(Array.isArray(records), true);
  assert.equal(records.length > 0, true);
  assert.equal(records[records.length - 1].type, "run");
  assert.equal(typeof records[records.length - 1].code, "string");
  assert.equal(typeof records[records.length - 1].tests, "string");

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});

test("memory: similar requirement should be matched", () => {
  const memoryFilePath = createTempMemoryPath();
  const manager = new AgentManager({ memoryFilePath });

  manager.run("实现一个函数，对输入数字数组进行排序并返回结果。");

  const memoryAgent = new MemoryAgent(memoryFilePath);
  const hits = memoryAgent.searchSimilar("请实现数字数组升序排序", {
    limit: 3,
    minScore: 0.1,
  });

  assert.equal(Array.isArray(hits), true);
  assert.equal(hits.length > 0, true);
  assert.equal(hits[0].type, "run");

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});

test("flow: second run should consult memory and return memory matches", () => {
  const memoryFilePath = createTempMemoryPath();
  const manager = new AgentManager({ memoryFilePath });

  manager.run("实现一个函数，对输入数字数组进行排序并返回结果。");
  const second = manager.run("实现一个函数，对输入数字数组进行排序并返回结果。");

  assert.equal(Array.isArray(second.memory_matches), true);
  assert.equal(second.memory_matches.length > 0, true);
  assert.equal(second.used_memory_code, true);

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});

test("flow: complex login requirement should be decomposed and executed sequentially", () => {
  const memoryFilePath = createTempMemoryPath();
  const manager = new AgentManager({ memoryFilePath });

  const result = manager.run("开发一个带登录功能的网站");

  assert.equal(Array.isArray(result.task_graph), true);
  assert.equal(result.task_graph.length, 4);
  assert.equal(result.task_graph[0].task, "设计登录接口");

  assert.equal(Array.isArray(result.task_queue), true);
  assert.equal(result.task_queue.every((item) => item.status === "done"), true);

  assert.equal(Array.isArray(result.step_results), true);
  assert.equal(result.step_results.length, 4);
  assert.ok(result.code.includes("function registerLoginRoutes"));
  assert.ok(result.code.includes("function renderLoginPage"));
  assert.ok(result.code.includes("function authenticateUser"));

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});

test("flow: reflection should auto-optimize generated code within three rounds", () => {
  const memoryFilePath = createTempMemoryPath();
  const manager = new AgentManager({ memoryFilePath, maxReflectionRounds: 3 });

  const result = manager.run("开发一个带登录功能的网站");

  assert.equal(typeof result.generated_code, "string");
  assert.equal(typeof result.code, "string");
  assert.equal(result.generated_code.includes("const mockDB = { admin: '123456' };"), true);
  assert.equal(result.code.includes("DEFAULT_CREDENTIALS"), true);
  assert.equal(result.code.startsWith("// Optimized by ReflectionAgent"), true);
  assert.equal(result.generated_code !== result.code, true);

  assert.equal(Array.isArray(result.optimization_history), true);
  assert.equal(result.optimization_history.length > 0, true);
  assert.equal(result.optimization_rounds <= 3, true);

  const firstRound = result.optimization_history[0];
  assert.equal(Array.isArray(firstRound.problems), true);
  assert.equal(firstRound.problems.length > 0, true);

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});

test("memory: should store requirement, generated code and optimized code", () => {
  const memoryFilePath = createTempMemoryPath();
  const manager = new AgentManager({ memoryFilePath, maxReflectionRounds: 3 });

  manager.run("开发一个带登录功能的网站");

  const records = JSON.parse(fs.readFileSync(memoryFilePath, "utf8"));
  const runRecord = records.filter((item) => item.type === "run").pop();

  assert.equal(typeof runRecord.requirement, "string");
  assert.equal(typeof runRecord.generated_code, "string");
  assert.equal(typeof runRecord.optimized_code, "string");
  assert.equal(runRecord.optimized_code.startsWith("// Optimized by ReflectionAgent"), true);
  assert.equal(typeof runRecord.quality_score, "number");

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});

test("learning: second similar complex requirement should reuse historical best code", () => {
  const memoryFilePath = createTempMemoryPath();
  const manager = new AgentManager({ memoryFilePath, maxReflectionRounds: 3 });

  manager.run("开发一个带登录功能的网站");
  const second = manager.run("开发一个支持登录功能的网站");

  assert.equal(second.used_memory_code, true);
  assert.equal(second.learning_summary.memory_reused, true);
  assert.equal(second.learning_summary.reused_steps > 0, true);
  assert.equal(second.step_results.some((item) => item.source === "memory"), true);

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});

test("queue: createTaskQueue should normalize dependencies and topologically sort tasks", () => {
  const manager = new AgentManager({ memoryFilePath: createTempMemoryPath() });
  const queue = manager.createTaskQueue([
    { id: 3, task: "实现后端", dependsOn: [2, 999, 3] },
    { id: 2, task: "实现前端", dependsOn: [1] },
    { id: 1, task: "细化需求", dependsOn: [] },
  ]);

  assert.deepEqual(queue.map((item) => item.id), [1, 2, 3]);
  assert.deepEqual(queue[2].dependsOn, [2]);
  assert.equal(queue.every((item) => item.status === "pending"), true);

  const idToIndex = new Map(queue.map((item, index) => [item.id, index]));
  const dependenciesSatisfied = queue.every((item) => item.dependsOn.every((depId) => idToIndex.get(depId) < idToIndex.get(item.id)));
  assert.equal(dependenciesSatisfied, true);
});

test("memory: deduplicateMemoryMatches should keep highest-scored duplicate", () => {
  const manager = new AgentManager({ memoryFilePath: createTempMemoryPath() });
  const deduplicated = manager.deduplicateMemoryMatches([
    {
      timestamp: "2026-01-01T00:00:00.000Z",
      requirement: "实现排序",
      similarity: 0.31,
      ranking_score: 0.30,
      quality_score: 0.6,
    },
    {
      timestamp: "2026-01-01T00:00:00.000Z",
      requirement: "实现排序",
      similarity: 0.82,
      ranking_score: 0.80,
      quality_score: 0.8,
    },
    {
      timestamp: "2026-01-02T00:00:00.000Z",
      requirement: "实现登录",
      similarity: 0.62,
      ranking_score: 0.60,
      quality_score: 0.7,
    },
  ]);

  assert.equal(deduplicated.length, 2);
  assert.equal(deduplicated[0].requirement, "实现排序");
  assert.equal(deduplicated[0].similarity, 0.82);
});

test("memory: searchSimilar should prefer newer record when scores tie", () => {
  const memoryFilePath = createTempMemoryPath();
  const memoryAgent = new MemoryAgent(memoryFilePath);

  memoryAgent.writeAll([
    {
      type: "run",
      scope: "run",
      requirement: "实现登录功能",
      code: "function oldLogin() {}",
      quality_score: 0.7,
      timestamp: "2026-01-01T00:00:00.000Z",
    },
    {
      type: "run",
      scope: "run",
      requirement: "实现登录功能",
      code: "function newLogin() {}",
      quality_score: 0.7,
      timestamp: "2026-02-01T00:00:00.000Z",
    },
  ]);

  const hits = memoryAgent.searchSimilar("请实现登录功能", {
    limit: 2,
    minScore: 0.1,
    scope: "run",
  });

  assert.equal(hits.length, 2);
  assert.equal(hits[0].timestamp, "2026-02-01T00:00:00.000Z");

  if (fs.existsSync(memoryFilePath)) {
    fs.unlinkSync(memoryFilePath);
  }
});
