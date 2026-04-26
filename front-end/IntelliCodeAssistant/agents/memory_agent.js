const fs = require("node:fs");
const path = require("node:path");

class MemoryAgent {
  constructor(memoryFilePath) {
    this.memoryFilePath = memoryFilePath
      || path.join(__dirname, "..", "storage", "memory_store.json");
    this.ensureStore();
  }

  ensureStore() {
    const dir = path.dirname(this.memoryFilePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    if (!fs.existsSync(this.memoryFilePath)) {
      fs.writeFileSync(this.memoryFilePath, "[]\n", "utf8");
    }
  }

  writeAll(records) {
    const safeRecords = Array.isArray(records) ? records : [];
    fs.writeFileSync(this.memoryFilePath, JSON.stringify(safeRecords, null, 2) + "\n", "utf8");
  }

  remember(record) {
    const existing = this.readAll();
    existing.push({
      ...record,
      timestamp: new Date().toISOString(),
    });

    const compact = existing.slice(-300);
    this.writeAll(compact);
  }

  readAll() {
    try {
      const content = fs.readFileSync(this.memoryFilePath, "utf8");
      const parsed = JSON.parse(content);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  rememberRun({
    requirementText,
    requirement,
    functionName,
    code,
    generatedCode,
    optimizedCode,
    tests,
    optimizationHistory,
  }) {
    const generated = String(generatedCode || code || "");
    const optimized = String(optimizedCode || code || generated || "");

    this.remember({
      type: "run",
      scope: "run",
      requirement: String(requirementText || "").trim(),
      requirement_json: requirement || null,
      functionName: functionName || "",
      generated_code: generated,
      optimized_code: optimized,
      code: optimized,
      tests: tests || "",
      optimization_history: Array.isArray(optimizationHistory) ? optimizationHistory : [],
      quality_score: this.estimateQualityScore({
        generatedCode: generated,
        optimizedCode: optimized,
        tests,
      }),
    });
  }

  rememberStep({ taskText, rootRequirementText, code, optimizedCode, source }) {
    const generated = String(code || "");
    const optimized = String(optimizedCode || generated || "");

    this.remember({
      type: "step",
      scope: "step",
      requirement: String(taskText || "").trim(),
      root_requirement: String(rootRequirementText || "").trim(),
      generated_code: generated,
      optimized_code: optimized,
      code: optimized,
      source: source || "generated",
      quality_score: this.estimateQualityScore({
        generatedCode: generated,
        optimizedCode: optimized,
      }),
    });
  }

  rememberDebug({ errorMessage, codeLine, requirement }) {
    this.remember({
      type: "debug",
      errorMessage: String(errorMessage || ""),
      codeLine: String(codeLine || ""),
      requirement: requirement || null,
    });
  }

  searchSimilar(requirementText, options = {}) {
    const limit = Number.isInteger(options.limit) ? options.limit : 3;
    const minScore = typeof options.minScore === "number" ? options.minScore : 0.2;
    const scope = Object.prototype.hasOwnProperty.call(options, "scope")
      ? String(options.scope || "").trim()
      : "run";
    const query = String(requirementText || "").trim();

    if (!query) {
      return [];
    }

    const records = this.readAll().filter((item) => this.isSearchableRecord(item, scope));
    const scored = records.map((item) => {
      const candidate = String(item.requirement || "").trim();
      const similarity = this.calculateSimilarity(query, candidate);
      const quality = Number(item.quality_score || 0);

      return {
        ...item,
        similarity,
        quality_score: quality,
        ranking_score: similarity * 0.75 + quality * 0.25,
      };
    });

    return scored
      .filter((item) => item.similarity >= minScore)
      .sort((a, b) => {
        if (b.ranking_score !== a.ranking_score) {
          return b.ranking_score - a.ranking_score;
        }

        if (b.similarity !== a.similarity) {
          return b.similarity - a.similarity;
        }

        if (b.quality_score !== a.quality_score) {
          return b.quality_score - a.quality_score;
        }

        return this.parseTimestamp(b.timestamp) - this.parseTimestamp(a.timestamp);
      })
      .slice(0, limit);
  }

  findBestReusableCode(requirementText, options = {}) {
    const minScore = typeof options.minScore === "number" ? options.minScore : 0.55;
    const limit = Number.isInteger(options.limit) ? options.limit : 5;
    const scope = String(options.scope || "").trim();

    const hits = this.searchSimilar(requirementText, {
      minScore,
      limit,
      scope,
    });

    for (const item of hits) {
      const code = this.extractReusableCode(item);
      if (code) {
        return {
          code,
          record: item,
        };
      }
    }

    return null;
  }

  isSearchableRecord(item, scope) {
    if (!item || !["run", "step", "experience"].includes(String(item.type || ""))) {
      return false;
    }

    if (!scope) {
      return true;
    }

    return String(item.scope || item.type || "") === scope;
  }

  extractReusableCode(item) {
    const optimized = String(item.optimized_code || "").trim();
    if (optimized) {
      return optimized;
    }

    const code = String(item.code || "").trim();
    if (code) {
      return code;
    }

    const generated = String(item.generated_code || "").trim();
    return generated || "";
  }

  estimateQualityScore({ generatedCode, optimizedCode, tests }) {
    const generated = String(generatedCode || "");
    const optimized = String(optimizedCode || "");
    const testsText = String(tests || "");
    let score = 0.5;

    if (generated && optimized && generated !== optimized) {
      score += 0.2;
    }

    if (optimized.includes("/**")) {
      score += 0.1;
    }

    if (optimized.includes("Object.freeze") || optimized.includes("const LOGIN_ROUTE")) {
      score += 0.1;
    }

    if (testsText.trim()) {
      score += 0.1;
    }

    return Math.max(0, Math.min(1, Number(score.toFixed(3))));
  }

  calculateSimilarity(left, right) {
    const leftTokens = this.tokenize(left);
    const rightTokens = this.tokenize(right);

    if (leftTokens.size === 0 || rightTokens.size === 0) {
      return 0;
    }

    let intersection = 0;
    for (const token of leftTokens) {
      if (rightTokens.has(token)) {
        intersection += 1;
      }
    }

    const union = new Set([...leftTokens, ...rightTokens]).size;
    if (union === 0) {
      return 0;
    }

    return intersection / union;
  }

  tokenize(text) {
    const normalized = String(text || "")
      .toLowerCase()
      .replace(/[\r\n\t]/g, " ")
      .trim();

    const words = normalized
      .split(/[^a-z0-9\u4e00-\u9fa5]+/)
      .filter(Boolean);

    const chars = normalized
      .replace(/[^a-z0-9\u4e00-\u9fa5]/g, "")
      .split("")
      .filter(Boolean);

    // Use both word-level and character-level features to support Chinese short text matching.
    return new Set([...words, ...chars]);
  }

  parseTimestamp(value) {
    const timestamp = Date.parse(String(value || ""));
    return Number.isNaN(timestamp) ? 0 : timestamp;
  }
}

module.exports = {
  MemoryAgent,
};
