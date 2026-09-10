/**
 * Personalised gap profile — assembles a student's weak topics, root-cause
 * prerequisite gaps, and recurring error types into a targeting context block.
 */
const mockMasteryScore = { find: jest.fn() };
const mockErrorRecord = { aggregate: jest.fn() };
jest.mock('../models/MasteryScore', () => mockMasteryScore);
jest.mock('../models/ErrorRecord', () => mockErrorRecord);

const mockDetectGaps = jest.fn();
jest.mock('../services/gapDetectionEngine', () => ({ detectGaps: (...a) => mockDetectGaps(...a) }));

const { buildStudentGapProfile } = require('../services/personalisedContentService');

const sortLean = (v) => ({ sort: () => ({ lean: () => Promise.resolve(v) }) });
const SID = '507f1f77bcf86cd799439d11';
const SCH = '507f1f77bcf86cd799439d22';

beforeEach(() => jest.clearAllMocks());

test('assembles weak topics, root causes, error patterns and a summary', async () => {
  mockMasteryScore.find.mockReturnValue(sortLean([
    { topicTitle: 'Fractions', subject: 'Math', score: 32 },
    { topicTitle: 'Decimals', subject: 'Math', score: 58 },
    { topicTitle: 'Integers', subject: 'Math', score: 88 },
  ]));
  mockErrorRecord.aggregate.mockResolvedValue([
    { _id: { errorType: 'Concept', topicTitle: 'Fractions' }, count: 5 },
    { _id: { errorType: 'Calculation', topicTitle: 'Decimals' }, count: 2 },
  ]);
  mockDetectGaps.mockResolvedValue({ rootCauses: [{ topicTitle: 'Number Line', masteryScore: 40, blockedTopics: ['Fractions'] }] });

  const p = await buildStudentGapProfile({ studentId: SID, schoolId: SCH, subject: 'Math', className: '6' });

  expect(p.weakTopics.map((t) => t.topicTitle)).toEqual(['Fractions', 'Decimals']);
  expect(p.weakestTopic).toBe('Fractions');
  expect(p.rootCauses[0].topicTitle).toBe('Number Line');
  expect(p.dominantErrorType).toBe('Concept');
  expect(p.hasGaps).toBe(true);
  expect(p.summaryText).toMatch(/Weak topics/);
  expect(p.summaryText).toMatch(/Root-cause prerequisite gaps: Number Line/);
  expect(p.summaryText).toMatch(/Most common error category: Concept/);
});

test('falls back gracefully when the student has no recorded weaknesses', async () => {
  mockMasteryScore.find.mockReturnValue(sortLean([{ topicTitle: 'All Good', subject: 'Math', score: 92 }]));
  mockErrorRecord.aggregate.mockResolvedValue([]);
  mockDetectGaps.mockResolvedValue({ rootCauses: [] });

  const p = await buildStudentGapProfile({ studentId: SID, schoolId: SCH, subject: 'Math' });
  expect(p.hasGaps).toBe(false);
  expect(p.weakestTopic).toBe('All Good'); // lowest-scoring topic as last resort
  expect(p.summaryText).toMatch(/No significant weaknesses/);
});

test('does not run gap detection when no subject is given', async () => {
  mockMasteryScore.find.mockReturnValue(sortLean([]));
  mockErrorRecord.aggregate.mockResolvedValue([]);
  await buildStudentGapProfile({ studentId: SID, schoolId: SCH });
  expect(mockDetectGaps).not.toHaveBeenCalled();
});
