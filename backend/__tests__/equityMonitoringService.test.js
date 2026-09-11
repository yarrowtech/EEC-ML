/**
 * Equity / bias monitoring — checks whether the AI answer evaluator behaves
 * consistently across gender cohorts. Deliberately scoped to gender only;
 * caste/religion/category are excluded (see service file header).
 */
const mockLog = { find: jest.fn() };
jest.mock('../models/AiInteractionLog', () => mockLog);

const mockStudent = { find: jest.fn() };
jest.mock('../models/StudentUser', () => mockStudent);

const { computeGenderModelParity, MIN_COHORT_SAMPLE } = require('../services/equityMonitoringService');

const selectLean = (v) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });

beforeEach(() => jest.clearAllMocks());

const student = (id, gender) => ({ _id: id, gender });
const log = (userId, score, confidenceScore = 0.8, needsReview = false) => ({ userId, score, confidenceScore, needsReview });

describe('computeGenderModelParity', () => {
  test('reports insufficient_sample when a cohort is below the minimum', async () => {
    mockStudent.find.mockReturnValue(selectLean([student('m1', 'male'), student('f1', 'female')]));
    mockLog.find.mockReturnValue(selectLean([log('m1', 0.9), log('f1', 0.5)]));

    const result = await computeGenderModelParity({ schoolId: 'sch1' });
    expect(result.dataStatus).toBe('insufficient_sample');
    expect(result.flags).toHaveLength(0);
  });

  test('flags a large average-score gap once both cohorts meet the minimum sample', async () => {
    const males = Array.from({ length: MIN_COHORT_SAMPLE }, (_, i) => student(`m${i}`, 'male'));
    const females = Array.from({ length: MIN_COHORT_SAMPLE }, (_, i) => student(`f${i}`, 'female'));
    mockStudent.find.mockReturnValue(selectLean([...males, ...females]));

    const maleLogs = males.map((s) => log(s._id, 0.9));   // avg 0.9
    const femaleLogs = females.map((s) => log(s._id, 0.5)); // avg 0.5 -> gap 0.4
    mockLog.find.mockReturnValue(selectLean([...maleLogs, ...femaleLogs]));

    const result = await computeGenderModelParity({ schoolId: 'sch1' });
    expect(result.dataStatus).toBe('available');
    const scoreFlag = result.flags.find((f) => f.signal === 'avg_score_gap');
    expect(scoreFlag).toBeDefined();
    expect(scoreFlag.lower).toBe('female');
    expect(scoreFlag.higher).toBe('male');
  });

  test('does not flag cohorts whose scores are close together', async () => {
    const males = Array.from({ length: MIN_COHORT_SAMPLE }, (_, i) => student(`m${i}`, 'male'));
    const females = Array.from({ length: MIN_COHORT_SAMPLE }, (_, i) => student(`f${i}`, 'female'));
    mockStudent.find.mockReturnValue(selectLean([...males, ...females]));
    mockLog.find.mockReturnValue(selectLean([
      ...males.map((s) => log(s._id, 0.75)),
      ...females.map((s) => log(s._id, 0.72)),
    ]));

    const result = await computeGenderModelParity({ schoolId: 'sch1' });
    expect(result.flags).toHaveLength(0);
  });

  test('flags a needs-review rate gap independently of the score gap', async () => {
    const males = Array.from({ length: MIN_COHORT_SAMPLE }, (_, i) => student(`m${i}`, 'male'));
    const females = Array.from({ length: MIN_COHORT_SAMPLE }, (_, i) => student(`f${i}`, 'female'));
    mockStudent.find.mockReturnValue(selectLean([...males, ...females]));
    mockLog.find.mockReturnValue(selectLean([
      ...males.map((s) => log(s._id, 0.7, 0.8, false)),
      ...females.map((s) => log(s._id, 0.7, 0.8, true)), // all flagged needs-review
    ]));

    const result = await computeGenderModelParity({ schoolId: 'sch1' });
    const reviewFlag = result.flags.find((f) => f.signal === 'needs_review_rate_gap');
    expect(reviewFlag).toBeDefined();
    expect(reviewFlag.higher).toBe('female');
  });
});
