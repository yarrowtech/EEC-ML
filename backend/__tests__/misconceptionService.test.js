/**
 * Per-student misconception model — recurring same-type errors on a topic are
 * rolled into one row with capped evidence, surfaced only past a repeat
 * threshold, and auto-resolved when the topic is mastered.
 */
const mockMisc = { updateOne: jest.fn(), updateMany: jest.fn(), find: jest.fn() };
jest.mock('../models/StudentMisconception', () => mockMisc);

const {
  recordMisconceptions,
  resolveMisconceptionsForTopic,
  getStudentMisconceptions,
  MIN_OCCURRENCES_TO_SURFACE,
} = require('../services/misconceptionService');

const classify = (q, c, a) => 'Concept';

beforeEach(() => {
  jest.clearAllMocks();
  mockMisc.updateOne.mockResolvedValue({});
  mockMisc.updateMany.mockResolvedValue({ modifiedCount: 2 });
});

describe('recordMisconceptions', () => {
  test('one upsert per (subject, topic, errorType), evidence capped', async () => {
    const wrongs = [
      { subject: 'Math', topicTitle: 'Fractions', questionText: 'q1', studentAnswer: '1/2', correctAnswer: '3/4', errorType: 'Concept' },
      { subject: 'Math', topicTitle: 'Fractions', questionText: 'q2', studentAnswer: '2/3', correctAnswer: '1/6', errorType: 'Concept' },
      { subject: 'Math', topicTitle: 'Decimals', questionText: 'q3', studentAnswer: '0.5', correctAnswer: '0.05', errorType: 'Calculation' },
    ];
    const r = await recordMisconceptions({ studentId: 's1', schoolId: 'sch1', source: 'quiz', wrongs, classify });

    expect(r.updated).toBe(2); // Fractions/Concept + Decimals/Calculation
    const fractionsCall = mockMisc.updateOne.mock.calls.find((c) => c[0].topicTitle === 'Fractions');
    expect(fractionsCall[0]).toEqual({ studentId: 's1', subject: 'Math', topicTitle: 'Fractions', errorType: 'Concept' });
    expect(fractionsCall[1].$inc.occurrences).toBe(2);
    expect(fractionsCall[1].$push.evidence.$slice).toBe(-5);
    expect(fractionsCall[1].$set.status).toBe('active');
  });

  test('classifies error type when the wrong answer has none', async () => {
    await recordMisconceptions({
      studentId: 's1', schoolId: 'sch1',
      wrongs: [{ subject: 'Sci', topicTitle: 'Cells', questionText: 'q', studentAnswer: 'x', correctAnswer: 'y' }],
      classify,
    });
    expect(mockMisc.updateOne.mock.calls[0][0].errorType).toBe('Concept');
  });

  test('no-op on an empty batch', async () => {
    const r = await recordMisconceptions({ studentId: 's1', schoolId: 'sch1', wrongs: [], classify });
    expect(r).toEqual({ updated: 0 });
    expect(mockMisc.updateOne).not.toHaveBeenCalled();
  });
});

describe('resolveMisconceptionsForTopic', () => {
  test('resolves active rows once mastery reaches the threshold', async () => {
    const r = await resolveMisconceptionsForTopic({ studentId: 's1', schoolId: 'sch1', subject: 'Math', topicTitle: 'Fractions', score: 82 });
    expect(r.resolved).toBe(2);
    const [filter, update] = mockMisc.updateMany.mock.calls[0];
    expect(filter.status).toBe('active');
    expect(update.$set.status).toBe('resolved');
    expect(update.$set.resolvedByScore).toBe(82);
  });

  test('does nothing below the mastery threshold', async () => {
    const r = await resolveMisconceptionsForTopic({ studentId: 's1', schoolId: 'sch1', subject: 'Math', topicTitle: 'Fractions', score: 60 });
    expect(r).toEqual({ resolved: 0 });
    expect(mockMisc.updateMany).not.toHaveBeenCalled();
  });
});

describe('getStudentMisconceptions', () => {
  test('hides single-occurrence noise unless includeMinor', async () => {
    mockMisc.find.mockReturnValue({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve([
      { topicTitle: 'Fractions', occurrences: 3 },
      { topicTitle: 'Decimals', occurrences: 1 },
    ]) }) }) });
    const surfaced = await getStudentMisconceptions('s1', 'sch1', {});
    expect(surfaced.map((m) => m.topicTitle)).toEqual(['Fractions']);
    expect(MIN_OCCURRENCES_TO_SURFACE).toBe(2);

    mockMisc.find.mockReturnValue({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve([
      { topicTitle: 'Fractions', occurrences: 3 }, { topicTitle: 'Decimals', occurrences: 1 },
    ]) }) }) });
    const all = await getStudentMisconceptions('s1', 'sch1', { includeMinor: true });
    expect(all).toHaveLength(2);
  });
});
