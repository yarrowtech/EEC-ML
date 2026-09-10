/**
 * AI bridge learning path — from the student's root-cause gap up to a target
 * topic, ordered by the curriculum graph, with mastery-aware node states.
 */
const mockMasteryScore = { find: jest.fn() };
const mockCurriculumMap = { findOne: jest.fn() };
jest.mock('../models/MasteryScore', () => mockMasteryScore);
jest.mock('../models/CurriculumMap', () => mockCurriculumMap);

const mockDetectGaps = jest.fn();
jest.mock('../services/gapDetectionEngine', () => ({ detectGaps: (...a) => mockDetectGaps(...a) }));

const { buildBridgePath, toPathNodes, prerequisiteChain } = require('../services/learningPathService');

const lean = (v) => ({ lean: () => Promise.resolve(v) });

const MAP = {
  topics: [
    { order: 1, title: 'Counting', estimatedWeeks: 1, prerequisites: [] },
    { order: 2, title: 'Addition', estimatedWeeks: 1, prerequisites: ['Counting'] },
    { order: 3, title: 'Subtraction', estimatedWeeks: 1, prerequisites: ['Addition'] },
    { order: 4, title: 'Multiplication', estimatedWeeks: 2, prerequisites: ['Addition'] },
    { order: 5, title: 'Division', estimatedWeeks: 2, prerequisites: ['Multiplication', 'Subtraction'] },
  ],
};

beforeEach(() => {
  jest.clearAllMocks();
  mockDetectGaps.mockResolvedValue({ rootCauses: [{ topicTitle: 'Addition', order: 2 }] });
});

describe('prerequisiteChain', () => {
  test('resolves transitive explicit prerequisites in curriculum order', () => {
    const byTitle = new Map(MAP.topics.map((t) => [t.title.toLowerCase(), t]));
    const sorted = [...MAP.topics];
    const chain = prerequisiteChain(byTitle.get('division'), byTitle, sorted).map((t) => t.title);
    expect(chain).toEqual(['Counting', 'Addition', 'Subtraction', 'Multiplication']);
  });
});

describe('buildBridgePath', () => {
  const call = () => buildBridgePath({
    studentId: 's1', schoolId: 'sch1', subject: 'Math', targetTopic: 'Division', className: '5',
  });

  test('returns only unmastered prerequisites plus the target, first gap active', async () => {
    mockMasteryScore.find.mockReturnValue(lean([
      { topicTitle: 'Counting', score: 90 },       // mastered → excluded
      { topicTitle: 'Addition', score: 45 },        // gap → included, active
      { topicTitle: 'Subtraction', score: 70 },     // below target → included, locked
      { topicTitle: 'Multiplication', score: null }, // not started → included, locked
    ]));
    mockCurriculumMap.findOne.mockReturnValue(lean(MAP));

    const r = await call();
    expect(r.status).toBe('ok');
    expect(r.steps.map((s) => s.title)).toEqual(['Addition', 'Subtraction', 'Multiplication', 'Division']);
    expect(r.steps[0].status).toBe('active');
    expect(r.steps[0].isRootCauseGap).toBe(true);
    expect(r.steps.slice(1).every((s) => s.status === 'locked')).toBe(true);
    expect(r.steps.at(-1).isTarget).toBe(true);
    expect(r.gapCount).toBe(2); // Addition (45) + Multiplication (null)
    expect(r.totalEstimatedDays).toBeGreaterThan(0);
  });

  test('marks an already-mastered prerequisite done and keeps the chain', async () => {
    mockMasteryScore.find.mockReturnValue(lean([
      { topicTitle: 'Counting', score: 95 },
      { topicTitle: 'Addition', score: 95 },
      { topicTitle: 'Subtraction', score: 40 },
      { topicTitle: 'Multiplication', score: 80 },
    ]));
    mockCurriculumMap.findOne.mockReturnValue(lean(MAP));

    const r = await call();
    // Addition & Multiplication mastered → excluded; Subtraction gap + Division target
    expect(r.steps.map((s) => s.title)).toEqual(['Subtraction', 'Division']);
    expect(r.steps[0].status).toBe('active');
    expect(r.steps[0].action).toBe('learn'); // score 40 < GAP_THRESHOLD
  });

  test('handles a missing curriculum map', async () => {
    mockMasteryScore.find.mockReturnValue(lean([]));
    mockCurriculumMap.findOne.mockReturnValue(lean(null));
    const r = await call();
    expect(r.status).toBe('no_curriculum_map');
    expect(r.steps).toEqual([]);
  });

  test('handles a target not present in the map', async () => {
    mockMasteryScore.find.mockReturnValue(lean([]));
    mockCurriculumMap.findOne.mockReturnValue(lean(MAP));
    const r = await buildBridgePath({ studentId: 's1', schoolId: 'sch1', subject: 'Math', targetTopic: 'Calculus' });
    expect(r.status).toBe('target_not_in_map');
  });
});

describe('toPathNodes', () => {
  test('shapes steps into TeacherLearningPath nodes', () => {
    const nodes = toPathNodes({ steps: [
      { idx: 0, title: 'Addition', bloom: 'understand', tier: 'orange', status: 'active' },
      { idx: 1, title: 'Division', bloom: 'apply', tier: 'purple', status: 'locked' },
    ] });
    expect(nodes).toEqual([
      { idx: 0, title: 'Addition', bloom: 'understand', tier: 'orange', hasLesson: false, status: 'active', completedAt: null },
      { idx: 1, title: 'Division', bloom: 'apply', tier: 'purple', hasLesson: false, status: 'locked', completedAt: null },
    ]);
  });
});
