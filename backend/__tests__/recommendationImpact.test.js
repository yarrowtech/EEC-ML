/**
 * Recommendation tracking: a recommendation shown to a student is persisted,
 * the student's accept / dismiss / complete response is recorded, mastery is
 * frozen at acceptance and re-measured on completion, and a cron sweep
 * finalizes accepted recommendations left open past the impact window.
 */
const mockRecommendationEvent = {
  findOne: jest.fn(),
  find: jest.fn(),
  updateOne: jest.fn(),
  updateMany: jest.fn(),
};
jest.mock('../models/RecommendationEvent', () => mockRecommendationEvent);

const mockMasteryScore = { find: jest.fn() };
jest.mock('../models/MasteryScore', () => mockMasteryScore);

const {
  recordDecision,
  measureRecommendationImpact,
  currentMastery,
  summarize,
} = require('../services/recommendationImpactService');

const leanOf = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }), lean: () => Promise.resolve(value) });

// Minimal mongoose-doc stand-in.
const fakeDoc = (fields) => {
  const doc = { ...fields, save: jest.fn().mockResolvedValue(undefined) };
  doc.toObject = () => { const { save, toObject, ...rest } = doc; return rest; };
  return doc;
};

const SCHOOL = 'school1';
const STUDENT = 'stud1';

beforeEach(() => jest.clearAllMocks());

describe('currentMastery', () => {
  test('matches by topicId, then by case-insensitive title', async () => {
    mockMasteryScore.find.mockReturnValue(leanOf([
      { score: 42, topicId: 't1', topicTitle: 'Fractions', subject: 'Math' },
      { score: 71, topicId: 't2', topicTitle: 'Decimals', subject: 'Math' },
    ]));
    expect(await currentMastery({ schoolId: SCHOOL, studentId: STUDENT, subject: 'Math', topicId: 't2' })).toBe(71);
    expect(await currentMastery({ schoolId: SCHOOL, studentId: STUDENT, subject: 'Math', topicTitle: 'fractions' })).toBe(42);
    expect(await currentMastery({ schoolId: SCHOOL, studentId: STUDENT, subject: 'Math', topicTitle: 'Nope' })).toBeNull();
  });
});

describe('recordDecision', () => {
  test('accept freezes the baseline mastery', async () => {
    const doc = fakeDoc({ _id: 'r1', schoolId: SCHOOL, studentId: STUDENT, status: 'issued',
      subject: 'Math', topicId: 't1', topicTitle: 'Fractions', baselineMastery: null, respondedAt: null });
    mockRecommendationEvent.findOne.mockResolvedValue(doc);
    mockMasteryScore.find.mockReturnValue(leanOf([{ score: 40, topicId: 't1', topicTitle: 'Fractions', subject: 'Math' }]));

    const { event } = await recordDecision({ id: 'r1', schoolId: SCHOOL, studentId: STUDENT, decision: 'accept' });

    expect(event.status).toBe('accepted');
    expect(event.baselineMastery).toBe(40);
    expect(event.respondedAt).toBeInstanceOf(Date);
    expect(doc.save).toHaveBeenCalled();
  });

  test('complete measures post mastery and the delta against the frozen baseline', async () => {
    const doc = fakeDoc({ _id: 'r1', schoolId: SCHOOL, studentId: STUDENT, status: 'accepted',
      subject: 'Math', topicId: 't1', topicTitle: 'Fractions', baselineMastery: 40, respondedAt: new Date() });
    mockRecommendationEvent.findOne.mockResolvedValue(doc);
    mockMasteryScore.find.mockReturnValue(leanOf([{ score: 68, topicId: 't1', topicTitle: 'Fractions', subject: 'Math' }]));

    const { event } = await recordDecision({ id: 'r1', schoolId: SCHOOL, studentId: STUDENT, decision: 'complete' });

    expect(event.status).toBe('completed');
    expect(event.postMastery).toBe(68);
    expect(event.masteryDelta).toBe(28);
    expect(event.completedAt).toBeInstanceOf(Date);
  });

  test('dismiss records a reason and does not touch mastery', async () => {
    const doc = fakeDoc({ _id: 'r1', schoolId: SCHOOL, studentId: STUDENT, status: 'issued', baselineMastery: null, respondedAt: null });
    mockRecommendationEvent.findOne.mockResolvedValue(doc);

    const { event } = await recordDecision({ id: 'r1', schoolId: SCHOOL, studentId: STUDENT, decision: 'dismiss', reason: 'too hard' });

    expect(event.status).toBe('dismissed');
    expect(event.dismissReason).toBe('too hard');
    expect(mockMasteryScore.find).not.toHaveBeenCalled();
  });

  test('unknown recommendation id returns notFound', async () => {
    mockRecommendationEvent.findOne.mockResolvedValue(null);
    const result = await recordDecision({ id: 'x', schoolId: SCHOOL, studentId: STUDENT, decision: 'accept' });
    expect(result.notFound).toBe(true);
  });
});

describe('measureRecommendationImpact', () => {
  test('finalizes accepted recs past the impact window and expires ignored ones', async () => {
    mockRecommendationEvent.find.mockReturnValue(leanOf([
      { _id: 'r1', schoolId: SCHOOL, studentId: STUDENT, subject: 'Math', topicId: 't1', baselineMastery: 45 },
    ]));
    mockMasteryScore.find.mockReturnValue(leanOf([{ score: 60, topicId: 't1', topicTitle: 'Fractions', subject: 'Math' }]));
    mockRecommendationEvent.updateOne.mockResolvedValue({});
    mockRecommendationEvent.updateMany.mockResolvedValue({});

    const { finalized } = await measureRecommendationImpact();

    expect(finalized).toBe(1);
    const findFilter = mockRecommendationEvent.find.mock.calls[0][0];
    expect(findFilter.status).toBe('accepted');
    expect(findFilter.respondedAt.$lte).toBeInstanceOf(Date);

    const set = mockRecommendationEvent.updateOne.mock.calls[0][1].$set;
    expect(set.status).toBe('completed');
    expect(set.postMastery).toBe(60);
    expect(set.masteryDelta).toBe(15);

    expect(mockRecommendationEvent.updateMany.mock.calls[0][0].status).toBe('issued');
    expect(mockRecommendationEvent.updateMany.mock.calls[0][1].$set.status).toBe('expired');
  });
});

describe('summarize', () => {
  test('computes acceptance, completion, and average measured impact', () => {
    const s = summarize([
      { status: 'completed', masteryDelta: 10 },
      { status: 'completed', masteryDelta: 20 },
      { status: 'accepted' },
      { status: 'dismissed' },
      { status: 'issued' },
      { status: 'expired' },
    ]);
    // offered = non-expired count = 5; acted (accepted|completed) = 3
    expect(s.acceptanceRate).toBe(60);
    // completed / acted = 2 / 3
    expect(s.completionRate).toBe(67);
    expect(s.avgMasteryDelta).toBe(15);
    expect(s.measuredCount).toBe(2);
  });
});
