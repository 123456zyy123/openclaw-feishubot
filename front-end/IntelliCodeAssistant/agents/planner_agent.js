class PlannerAgent {
  execute(userRequirementText) {
    const requirementText = String(userRequirementText || "").trim();
    const tasks = this.planTasks(requirementText);

    return tasks.map((taskItem, index) => ({
      id: index + 1,
      task: taskItem.task,
      dependsOn: index === 0 ? [] : [index],
      status: "pending",
    }));
  }

  planTasks(requirementText) {
    const normalized = String(requirementText || "").toLowerCase();
    const hasWebsiteIntent = requirementText.includes("网站") || normalized.includes("website");
    const hasLoginIntent = requirementText.includes("登录") || normalized.includes("login");

    if (hasWebsiteIntent && hasLoginIntent) {
      return [
        { task: "设计登录接口" },
        { task: "实现前端页面" },
        { task: "编写后端逻辑" },
        { task: "编写测试" },
      ];
    }

    if (this.isComplexRequirement(requirementText, normalized)) {
      return this.buildGeneralComplexPlan(requirementText, normalized);
    }

    if (requirementText.includes("排序") || normalized.includes("sort")) {
      return [{ task: "实现排序函数" }];
    }

    return [{ task: "实现需求函数" }];
  }

  isComplexRequirement(requirementText, normalized) {
    const splitterMatches = requirementText.match(/并且|并|同时|以及|然后|最后|包括/g) || [];
    const complexKeywords = ["前端", "后端", "接口", "数据库", "测试", "部署", "api", "frontend", "backend", "test"];
    const hitCount = complexKeywords.filter((item) => normalized.includes(item)).length;

    return splitterMatches.length >= 1 && hitCount >= 1;
  }

  buildGeneralComplexPlan(requirementText, normalized) {
    const tasks = [{ task: "细化需求与接口" }];

    if (requirementText.includes("前端") || normalized.includes("frontend")) {
      tasks.push({ task: "实现前端页面" });
    }

    if (requirementText.includes("后端") || normalized.includes("backend") || requirementText.includes("接口") || normalized.includes("api")) {
      tasks.push({ task: "编写后端逻辑" });
    }

    if (tasks.length === 1) {
      tasks.push({ task: "实现核心功能" });
    }

    if (requirementText.includes("测试") || normalized.includes("test")) {
      tasks.push({ task: "编写测试" });
    }

    if (!tasks.some((item) => item.task === "编写测试")) {
      tasks.push({ task: "编写测试" });
    }

    return tasks;
  }
}

module.exports = {
  PlannerAgent,
};