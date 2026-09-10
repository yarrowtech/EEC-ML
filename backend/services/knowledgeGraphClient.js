/**
 * knowledgeGraphClient.js
 * Thin client for the ai-service knowledge_graph module. The Node backend owns
 * the graph data (CurriculumMap) and mastery data; this ships both to the
 * Python module for topological ordering, cycle detection, gap + root-cause
 * analysis, and bridge-path construction.
 *
 * The in-process gapDetectionEngine.js remains the default; use this when you
 * want the shared Python implementation (e.g. the orchestrated path).
 */
const axios = require('axios');

const AI_SERVICE_URL = (process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '');

// map: CurriculumMap.topics[] + { titleLower -> score }  →  analysis
async function analyzeGraph({ topics = [], mastery = {}, targetTopic = null, gapThreshold = 60, masteryTarget = 75, timeoutMs = 15000 } = {}) {
  const payload = {
    topics: topics.map((t) => ({
      title: String(t.title || ''),
      order: Number(t.order) || 0,
      prerequisites: Array.isArray(t.prerequisites) ? t.prerequisites.map(String) : [],
      concepts: Array.isArray(t.concepts) ? t.concepts.map(String) : [],
    })),
    mastery,
    target_topic: targetTopic || null,
    gap_threshold: gapThreshold,
    mastery_target: masteryTarget,
  };
  const { data } = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
    task_type: 'graph_analyze', payload,
  }, { timeout: timeoutMs });
  return data;
}

// Build the { titleLower -> score } mastery map the module expects.
function masteryMapFromScores(scoreDocs = []) {
  const out = {};
  for (const d of scoreDocs) {
    if (d && d.topicTitle != null && Number.isFinite(d.score)) {
      out[String(d.topicTitle).toLowerCase().trim()] = d.score;
    }
  }
  return out;
}

module.exports = { analyzeGraph, masteryMapFromScores };
