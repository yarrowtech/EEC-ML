/**
 * Learner confidence tracking — a student's 1-5 self-rating on a topic is
 * compared against their actual mastery score at that moment to flag
 * over/under-confidence.
 */
const mockMasteryScore = { findOne: jest.fn() };
jest.mock('../models/MasteryScore', () => mockMasteryScore);

const mockCheckin = { create: jest.fn(), find: jest.fn() };
jest.mock('../models/StudentConfidenceCheckin', () => mockCheckin);

const {
  recordCheckin,
  getStudentCalibrationProfile,
  getClassCalibrationSummary,
  labelFromGap,
  GAP_THRESHOLD,
} = require('../services/confidenceTrackingService');

const selectLean = (v) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });
const sortLimitLean = (v) => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve(v) }) }) });

beforeEach(() => jest.clearAllMocks());

describe('labelFromGap', () => {
  test('bands gaps into overconfident / underconfident / calibrated / insufficient_data', () => {
    expect(labelFromGap(null)).toBe('insufficient_data');
    expect(labelFromGap(GAP_THRESHOLD + 1)).toBe('overconfident');
    expect(labelFromGap(-(GAP_THRESHOLD + 1))).toBe('underconfident');
    expect(labelFromGap(0)).toBe('calibrated');
  });
});

describe('recordCheckin', () => {
  test('flags overconfidence when self-rating is far above actual mastery', async () => {
    mockMasteryScore.findOne.mockReturnValue(selectLean({ score: 30 }));
    mockCheckin.create.mockImplementation((doc) => Promise.resolve({ ...doc, toObject: () => doc }));

    const result = await recordCheckin({
      studentId: 's1', schoolId: 'sch1', subject: 'Math', topicId: 't1', topicTitle: 'Fractions',
      confidenceRating: 5, source: 'post_quiz',
    });

    expect(result.confidencePercent).toBe(100);
    expect(result.masteryScoreAtCheckin).toBe(30);
    expect(result.calibrationGap).toBe(70);
    expect(result.calibrationLabel).toBe('overconfident');
  });

  test('flags underconfidence when self-rating is far below actual mastery', async () => {
    mockMasteryScore.findOne.mockReturnValue(selectLean({ score: 90 }));
    mockCheckin.create.mockImplementation((doc) => Promise.resolve({ ...doc, toObject: () => doc }));

    const result = await recordCheckin({
      studentId: 's1', schoolId: 'sch1', subject: 'Math', topicId: 't1', topicTitle: 'Fractions', confidenceRating: 1,
    });

    expect(result.confidencePercent).toBe(0);
    expect(result.calibrationGap).toBe(-90);
    expect(result.calibrationLabel).toBe('underconfident');
  });

  test('marks insufficient_data when there is no mastery record yet', async () => {
    mockMasteryScore.findOne.mockReturnValue(selectLean(null));
    mockCheckin.create.mockImplementation((doc) => Promise.resolve({ ...doc, toObject: () => doc }));

    const result = await recordCheckin({ studentId: 's1', schoolId: 'sch1', subject: 'Math', topicId: 't1', confidenceRating: 3 });
    expect(result.masteryScoreAtCheckin).toBeNull();
    expect(result.calibrationGap).toBeNull();
    expect(result.calibrationLabel).toBe('insufficient_data');
  });

  test('rejects a rating outside 1-5', async () => {
    await expect(recordCheckin({ studentId: 's1', schoolId: 'sch1', topicId: 't1', confidenceRating: 7 }))
      .rejects.toThrow(/1 to 5/);
    expect(mockCheckin.create).not.toHaveBeenCalled();
  });

  test('requires a topicId', async () => {
    await expect(recordCheckin({ studentId: 's1', schoolId: 'sch1', confidenceRating: 3 }))
      .rejects.toThrow(/topicId/);
  });
});

describe('getStudentCalibrationProfile', () => {
  test('collapses to the most recent checkin per topic and averages the gap', async () => {
    mockCheckin.find.mockReturnValue(sortLimitLean([
      { subject: 'Math', topicId: 't1', topicTitle: 'Fractions', calibrationGap: 70, calibrationLabel: 'overconfident', createdAt: new Date('2026-02-02') },
      { subject: 'Math', topicId: 't1', topicTitle: 'Fractions', calibrationGap: 60, calibrationLabel: 'overconfident', createdAt: new Date('2026-02-01') },
      { subject: 'Math', topicId: 't2', topicTitle: 'Decimals', calibrationGap: -30, calibrationLabel: 'underconfident', createdAt: new Date('2026-02-01') },
    ]));

    const profile = await getStudentCalibrationProfile({ studentId: 's1', schoolId: 'sch1' });
    expect(profile.topics).toHaveLength(2);
    expect(profile.topics.find((t) => t.topicId === 't1').calibrationGap).toBe(70); // most recent, not the older 60
    expect(profile.sampleSize).toBe(2);
    expect(profile.overallGap).toBe(20); // (70 + -30) / 2
  });

  test('reports insufficient_data with no checkins', async () => {
    mockCheckin.find.mockReturnValue(sortLimitLean([]));
    const profile = await getStudentCalibrationProfile({ studentId: 's1', schoolId: 'sch1' });
    expect(profile.sampleSize).toBe(0);
    expect(profile.overallLabel).toBe('insufficient_data');
  });
});

describe('getClassCalibrationSummary', () => {
  test('ranks students by the size of their miscalibration, largest first', async () => {
    mockCheckin.find
      .mockReturnValueOnce(sortLimitLean([{ subject: 'Math', topicId: 't1', calibrationGap: 10, calibrationLabel: 'calibrated', createdAt: new Date() }]))
      .mockReturnValueOnce(sortLimitLean([{ subject: 'Math', topicId: 't1', calibrationGap: -80, calibrationLabel: 'underconfident', createdAt: new Date() }]))
      .mockReturnValueOnce(sortLimitLean([])); // no checkins at all — excluded

    const summary = await getClassCalibrationSummary({ schoolId: 'sch1', studentIds: ['low-gap', 'high-gap', 'no-data'] });
    expect(summary.map((r) => r.studentId)).toEqual(['high-gap', 'low-gap']);
  });
});
