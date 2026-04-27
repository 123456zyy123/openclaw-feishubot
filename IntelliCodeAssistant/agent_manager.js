const { RequirementAgent } = require("./agents/requirement_agent");
const { CodeAgent } = require("./agents/code_agent");
const { TestAgent } = require("./agents/test_agent");
const { DebugAgent } = require("./agents/debug_agent");
const { MemoryAgent } = require("./agents/memory_agent");
const { PlannerAgent } = require("./agents/planner_agent");
const { ReflectionAgent } = require("./agents/reflection_agent");

class AgentManager {
  constructor(options = {}) {
    this.memoryAgent = new MemoryAgent(options.memoryFilePath);
    this.plannerAgent = new PlannerAgent();
    this.requirementAgent = new RequirementAgent();
    this.codeAgent = new CodeAgent(this.memoryAgent);
    this.testAgent = new TestAgent();
    this.debugAgent = new DebugAgent();
    this.reflectionAgent = new ReflectionAgent();
    this.maxReflectionRounds = Number.isInteger(options.maxReflectionRounds)
      ? Math.max(1, Math.min(options.maxReflectionRounds, 3))
      : 3;
  }

  run(userRequirementText) {
    const userInput = String(userRequirementText || "").trim();
    const requirement = this.requirementAgent.execute(userInput);
    const taskGraph = this.plannerAgent.execute(userInput);
    const taskQueue = this.createTaskQueue(taskGraph);
    const taskStateHistory = taskQueue.map((item) => ({
      taskId: item.id,
      task: item.task,
      status: item.status,
    }));

    const stepResults = [];
    const memoryMatches = [];
    let usedMemoryCode = false;

    for (let index = 0; index < taskQueue.length; index += 1) {
      const queueItem = taskQueue[index];
      this.updateTaskStatus(queueItem, "running", taskStateHistory);

      const subRequirement = this.requirementAgent.execute(`${userInput}。子任务：${queueItem.task}`);
      subRequirement.子任务 = queueItem.task;

      const stepResult = this.codeAgent.execute(subRequirement, {
        rootRequirement: userInput,
        subTask: queueItem.task,
        stepIndex: index,
        totalTasks: taskQueue.length,
        allowMemoryReuse: true,
        memoryScope: taskQueue.length > 1 ? "step" : "run",
      });

      stepResults.push({
        taskId: queueItem.id,
        task: queueItem.task,
        code: stepResult.code,
        fragment: stepResult.fragment || null,
        source: stepResult.source || "generated",
      });

      if (Array.isArray(stepResult.memoryMatches)) {
        memoryMatches.push(...stepResult.memoryMatches);
      }
      usedMemoryCode = usedMemoryCode || Boolean(stepResult.usedMemoryCode);

      if ((stepResult.source || "generated") !== "memory") {
        this.memoryAgent.rememberStep({
          taskText: queueItem.task,
          rootRequirementText: userInput,
          code: stepResult.code,
          optimizedCode: stepResult.code,
          source: stepResult.source || "generated",
        });
      }

      this.updateTaskStatus(queueItem, "done", taskStateHistory);
    }

    const generatedCode = taskQueue.length > 1
      ? this.codeAgent.compose(stepResults, { rootRequirement: userInput })
      : (stepResults[0] ? stepResults[0].code : "");

    const tests = this.testAgent.execute({
      functionName: requirement.functionName,
      feature: requirement.功能,
    });

    const reflectionResult = this.runReflectionLoop({
      requirementText: userInput,
      code: generatedCode,
      tests,
    });

    const finalCode = reflectionResult.optimizedCode;

    const result = {
      requirement,
      task_graph: taskGraph,
      task_queue: taskQueue,
      task_state_history: taskStateHistory,
      step_results: stepResults.map((item) => ({
        taskId: item.taskId,
        task: item.task,
        code: item.code,
        source: item.source,
      })),
      generated_code: generatedCode,
      code: finalCode,
      tests,
      reflection: reflectionResult.lastReflection,
      optimization_history: reflectionResult.history,
      optimization_rounds: reflectionResult.rounds,
      learning_summary: {
        memory_reused: usedMemoryCode,
        reused_steps: stepResults.filter((item) => item.source === "memory").length,
        total_steps: stepResults.length,
      },
      memory_matches: this.deduplicateMemoryMatches(memoryMatches),
      used_memory_code: usedMemoryCode,
    };

    this.memoryAgent.rememberRun({
      requirementText: userInput,
      requirement,
      functionName: requirement.functionName,
      generatedCode,
      optimizedCode: finalCode,
      code: finalCode,
      tests,
      optimizationHistory: reflectionResult.history,
    });

    return result;
  }

  debug(errorMessage, codeLine, requirement) {
    const debugResult = this.debugAgent.execute({
      errorMessage,
      codeLine,
      requirement,
    });

    this.memoryAgent.rememberDebug({
      errorMessage,
      codeLine,
      requirement,
    });

    return debugResult;
  }

  createTaskQueue(taskGraph) {
    const graph = Array.isArray(taskGraph) ? taskGraph : [];
    const normalizedQueue = [];
    const usedIds = new Set();

    for (let index = 0; index < graph.length; index += 1) {
      const item = graph[index] || {};
      const rawId = Number(item.id);
      let id = Number.isInteger(rawId) && rawId > 0 ? rawId : (index + 1);

      while (usedIds.has(id)) {
        id += 1;
      }

      usedIds.add(id);
      normalizedQueue.push({
        id,
        task: String(item.task || "").trim() || `task_${index + 1}`,
        status: "pending",
        dependsOn: Array.isArray(item.dependsOn) ? item.dependsOn : [],
      });
    }

    const idSet = new Set(normalizedQueue.map((item) => item.id));
    const queueWithNormalizedDeps = normalizedQueue.map((item) => ({
      ...item,
      dependsOn: this.normalizeDependencies(item.dependsOn, item.id, idSet),
    }));

    return this.sortTaskQueueByDependency(queueWithNormalizedDeps);
  }

  normalizeDependencies(dependsOn, selfId, idSet) {
    const raw = Array.isArray(dependsOn) ? dependsOn : [];
    const unique = new Set();

    for (const dependency of raw) {
      const depId = Number(dependency);
      if (!Number.isInteger(depId) || depId <= 0 || depId === selfId || !idSet.has(depId)) {
        continue;
      }

      unique.add(depId);
    }

    return Array.from(unique.values());
  }

  sortTaskQueueByDependency(queue) {
    const source = Array.isArray(queue) ? queue : [];
    if (source.length <= 1) {
      return source;
    }

    const byId = new Map(source.map((item) => [item.id, item]));
    const indegree = new Map(source.map((item) => [item.id, 0]));
    const dependencyToTargets = new Map(source.map((item) => [item.id, []]));

    for (const item of source) {
      for (const depId of item.dependsOn) {
        if (!byId.has(depId)) {
          continue;
        }

        indegree.set(item.id, indegree.get(item.id) + 1);
        dependencyToTargets.get(depId).push(item.id);
      }
    }

    const ready = source
      .filter((item) => indegree.get(item.id) === 0)
      .map((item) => item.id);
    const orderedIds = [];

    while (ready.length > 0) {
      const currentId = ready.shift();
      orderedIds.push(currentId);

      const targets = dependencyToTargets.get(currentId) || [];
      for (const targetId of targets) {
        const nextDegree = indegree.get(targetId) - 1;
        indegree.set(targetId, nextDegree);
        if (nextDegree === 0) {
          ready.push(targetId);
        }
      }
    }

    if (orderedIds.length < source.length) {
      const orderedSet = new Set(orderedIds);
      for (const item of source) {
        if (!orderedSet.has(item.id)) {
          orderedIds.push(item.id);
        }
      }
    }

    const orderedQueue = orderedIds
      .map((id) => byId.get(id))
      .filter(Boolean)
      .map((item) => ({ ...item }));

    return this.reconcileDependencies(orderedQueue);
  }

  reconcileDependencies(queue) {
    const source = Array.isArray(queue) ? queue : [];
    const visited = new Set();

    return source.map((item) => {
      const filtered = item.dependsOn.filter((depId) => visited.has(depId));
      visited.add(item.id);

      return {
        ...item,
        dependsOn: filtered,
      };
    });
  }

  updateTaskStatus(queueItem, status, history) {
    queueItem.status = status;
    history.push({
      taskId: queueItem.id,
      task: queueItem.task,
      status,
    });
  }

  deduplicateMemoryMatches(matches) {
    const source = Array.isArray(matches) ? matches : [];
    const map = new Map();

    for (const item of source) {
      if (!item || typeof item !== "object") {
        continue;
      }

      const requirement = String(item.requirement || "");
      const key = `${item.timestamp || ""}|${requirement}`;
      const current = map.get(key);

      if (!current) {
        map.set(key, item);
        continue;
      }

      const currentRanking = Number(current.ranking_score || 0);
      const nextRanking = Number(item.ranking_score || 0);
      const currentSimilarity = Number(current.similarity || 0);
      const nextSimilarity = Number(item.similarity || 0);

      if (nextRanking > currentRanking || (nextRanking === currentRanking && nextSimilarity > currentSimilarity)) {
        map.set(key, item);
      }
    }

    return Array.from(map.values())
      .sort((a, b) => {
        const rankingDiff = Number(b.ranking_score || 0) - Number(a.ranking_score || 0);
        if (rankingDiff !== 0) {
          return rankingDiff;
        }

        const similarityDiff = Number(b.similarity || 0) - Number(a.similarity || 0);
        if (similarityDiff !== 0) {
          return similarityDiff;
        }

        const qualityDiff = Number(b.quality_score || 0) - Number(a.quality_score || 0);
        if (qualityDiff !== 0) {
          return qualityDiff;
        }

        return this.parseTimestamp(b.timestamp) - this.parseTimestamp(a.timestamp);
      })
      .slice(0, 3);
  }

  parseTimestamp(value) {
    const timestamp = Date.parse(String(value || ""));
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }

  runReflectionLoop({ requirementText, code, tests }) {
    let currentCode = String(code || "");
    const history = [];
    let lastReflection = {
      problems: [],
      suggestions: [],
      optimized_code: currentCode,
    };

    for (let round = 1; round <= this.maxReflectionRounds; round += 1) {
      const reflection = this.reflectionAgent.execute({
        requirementText,
        code: currentCode,
        tests,
      });

      const optimizedCode = String(reflection.optimized_code || currentCode);
      const hasProblems = Array.isArray(reflection.problems) && reflection.problems.length > 0;
      const changed = optimizedCode !== currentCode;

      history.push({
        round,
        problems: reflection.problems,
        suggestions: reflection.suggestions,
        code_before: currentCode,
        optimized_code: optimizedCode,
      });

      lastReflection = reflection;
      currentCode = optimizedCode;

      if (!hasProblems || !changed) {
        break;
      }
    }

    return {
      optimizedCode: currentCode,
      history,
      rounds: history.length,
      lastReflection,
    };
  }
}

function main() {
  const input = process.argv.slice(2).join(" ").trim()
    || "实现一个函数，对输入数字数组进行排序并返回结果。";

  const manager = new AgentManager();
  const output = manager.run(input);
  console.log(JSON.stringify(output, null, 2));
}

if (require.main === module) {
  main();
}

module.exports = {
  AgentManager,
};
