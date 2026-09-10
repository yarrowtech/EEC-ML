/**
 * Node client for the ai-service knowledge_graph module — shapes CurriculumMap
 * topics + mastery scores into the module's payload and dispatches via the
 * orchestrator.
 */
const mockAxios = { post: jest.fn() };
jest.mock('axios', () => mockAxios);

const { analyzeGraph, masteryMapFromScores } = require('../services/knowledgeGraphClient');

beforeEach(() => jest.clearAllMocks());

describe('masteryMapFromScores', () => {
  test('builds a lowercased title → score map, dropping invalid rows', () => {
    const map = masteryMapFromScores([
      { topicTitle: 'Fractions', score: 42 },
      { topicTitle: 'Decimals', score: 71 },
      { topicTitle: 'Nulls', score: null },
      { score: 5 },
    ]);
    expect(map).toEqual({ fractions: 42, decimals: 71 });
  });
});

describe('analyzeGraph', () => {
  test('dispatches graph_analyze with a normalised payload', async () => {
    mockAxios.post.mockResolvedValue({ data: { status: 'ok', gaps: [], root_causes: [] } });

    await analyzeGraph({
      topics: [{ title: 'Addition', order: 2, prerequisites: ['Counting'] }, { title: 'Counting', order: 1 }],
      mastery: { addition: 40 },
      targetTopic: 'Division',
    });

    const [url, body] = mockAxios.post.mock.calls[0];
    expect(url).toMatch(/\/orchestrate$/);
    expect(body.task_type).toBe('graph_analyze');
    expect(body.payload.topics[0]).toEqual({ title: 'Addition', order: 2, prerequisites: ['Counting'], concepts: [] });
    expect(body.payload.topics[1].prerequisites).toEqual([]); // missing -> []
    expect(body.payload.target_topic).toBe('Division');
    expect(body.payload.gap_threshold).toBe(60);
  });

  test('returns the module result unchanged', async () => {
    mockAxios.post.mockResolvedValue({ data: { status: 'has_cycle', cycles: [['A', 'B']] } });
    const r = await analyzeGraph({ topics: [] });
    expect(r).toEqual({ status: 'has_cycle', cycles: [['A', 'B']] });
  });
});
