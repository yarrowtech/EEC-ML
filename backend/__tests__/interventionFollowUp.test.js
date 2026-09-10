/**
 * Intervention follow-up: improvement is measured automatically from later
 * assessment evidence against a frozen pre-intervention baseline, and a plan
 * auto-finalizes (status → completed, resolvedAt, generated outcome) once every
 * checkpoint's evidence window has closed — no manual teacher entry required.
 */
const mockInterventionLog = { find: jest.fn(), updateOne: jest.fn() };
jest.mock('../models/InterventionLog', () => mockInterventionLog);

const mockMasteryEvent = { find: jest.fn() };
jest.mock('../models/MasteryEvent', () => mockMasteryEvent);

const { measurePlan, computeBaseline, measureFollowUps } = require('../services/interventionFollowUpService');

const DAY = 86400000;
// measureFollowUps() measures against the real wall clock, so anchor fixtures to it.
const NOW = Date.now();
const ago = (d) => new Date(NOW - d * DAY);

const evt = (daysAgo, score, extra = {}) => ({
  _id: `e-${daysAgo}-${score}`,
  source: 'exam',
  subject: 'Math',
  topicId: 't1',
  assessmentScore: score,
  createdAt: ago(daysAgo),
  metadata: {},
  ...extra,
});

const planWith = (overrides = {}) => ({
  _id: 'plan1',
  schoolId: 'school1',
  studentId: 'stud1',
  subject: 'Math',
  topicId: 't1',
  baselineScore: 40,
  createdAt: ago(40),
  scheduledDate: ago(39),
  outcome: '',
  followUpAssessments: [7, 14, 30].map((daysAfter) => ({
    daysAfter,
    scheduledDate: new Date(ago(40).getTime() + daysAfter * DAY),
    completedAt: null,
    score: null,
    improvement: null,
  })),
  ...overrides,
});

describe('computeBaseline', () => {
  test('picks the most recent credible score at or before the anchor, subject-scoped', () => {
    const events = [
      evt(50, 30),
      evt(20, 45),
      evt(10, 70, { subject: 'Science' }),
      evt(2, 80),
    ];
    expect(computeBaseline(events, ago(15).getTime(), { subject: 'Math' })).toBe(45);
  });

  test('ignores self-reported and needs-review evidence', () => {
    const events = [
      evt(30, 90, { source: 'self-report' }),
      evt(20, 88, { metadata: { needsReview: true } }),
      evt(10, 55),
    ];
    expect(computeBaseline(events, NOW, {})).toBe(55);
  });

  test('returns null when there is no prior evidence', () => {
    expect(computeBaseline([], NOW, {})).toBeNull();
  });
});

describe('measurePlan', () => {
  test('measures each checkpoint against the frozen baseline', () => {
    const events = [evt(32, 50), evt(25, 55), evt(9, 62)];
    const { checkpoints, settled, latestImprovement } = measurePlan(planWith(), events, NOW);

    expect(checkpoints.map((c) => c.improvement)).toEqual([10, 15, 22]);
    expect(checkpoints.every((c) => c.completedAt)).toBe(true);
    expect(settled).toBe(true);
    expect(latestImprovement).toBe(22);
  });

  test('generates an outcome summary once every checkpoint is settled', () => {
    const events = [evt(32, 50), evt(25, 55), evt(9, 62)];
    const { outcomeSummary } = measurePlan(planWith(), events, NOW);
    expect(outcomeSummary).toMatch(/baseline 40% → 62% by day 30 \(\+22\)/);
    expect(outcomeSummary).toMatch(/improved/);
  });

  test('a checkpoint whose window has not closed leaves the plan unsettled', () => {
    // Plan created 10 days ago — day 14 and day 30 checkpoints are still open.
    const plan = planWith({
      createdAt: ago(10),
      scheduledDate: ago(9),
      followUpAssessments: [7, 14, 30].map((daysAfter) => ({
        daysAfter,
        scheduledDate: new Date(ago(10).getTime() + daysAfter * DAY),
        completedAt: null, score: null, improvement: null,
      })),
    });
    const { settled, outcomeSummary } = measurePlan(plan, [evt(2, 58)], NOW);
    expect(settled).toBe(false);
    expect(outcomeSummary).toBeNull();
  });

  test('settles with a no-evidence outcome when nothing was recorded', () => {
    const { settled, outcomeSummary, latestImprovement } = measurePlan(planWith(), [], NOW);
    expect(settled).toBe(true);
    expect(latestImprovement).toBeNull();
    expect(outcomeSummary).toMatch(/no comparable assessment evidence/i);
  });

  test('derives a baseline from evidence when the plan has none stored', () => {
    const plan = planWith({ baselineScore: null });
    const events = [evt(45, 38), evt(32, 50), evt(25, 55), evt(9, 62)];
    const { baseline, checkpoints } = measurePlan(plan, events, NOW);
    expect(baseline).toBe(38);
    expect(checkpoints[0].improvement).toBe(12);
  });
});

describe('measureFollowUps', () => {
  const leanQuery = (value) => ({ sort: () => ({ lean: () => Promise.resolve(value) }), lean: () => Promise.resolve(value) });

  beforeEach(() => jest.clearAllMocks());

  test('finalizes a settled plan: status, resolvedAt, generated outcome', async () => {
    mockInterventionLog.find.mockReturnValue(leanQuery([planWith()]));
    mockMasteryEvent.find.mockReturnValue(leanQuery([evt(32, 50), evt(25, 55), evt(9, 62)]));
    mockInterventionLog.updateOne.mockResolvedValue({});

    await measureFollowUps();

    // Only in-flight plans are scanned.
    expect(mockInterventionLog.find.mock.calls[0][0].status).toEqual({ $in: ['planned', 'in_progress'] });
    const update = mockInterventionLog.updateOne.mock.calls[0][1].$set;
    expect(update.status).toBe('completed');
    expect(update.resolvedAt).toBeInstanceOf(Date);
    expect(update.improvement).toBe(22);
    expect(update.outcome).toMatch(/Auto-measured/);
  });

  test('does not overwrite an outcome the teacher already wrote', async () => {
    mockInterventionLog.find.mockReturnValue(leanQuery([planWith({ outcome: 'Teacher note: resolved in class' })]));
    mockMasteryEvent.find.mockReturnValue(leanQuery([evt(32, 50), evt(25, 55), evt(9, 62)]));
    mockInterventionLog.updateOne.mockResolvedValue({});

    await measureFollowUps();

    const update = mockInterventionLog.updateOne.mock.calls[0][1].$set;
    expect(update.status).toBe('completed');
    expect(update.outcome).toBeUndefined();
  });

  test('leaves an unsettled plan in place', async () => {
    const plan = planWith({
      createdAt: ago(10), scheduledDate: ago(9),
      followUpAssessments: [7, 14, 30].map((daysAfter) => ({
        daysAfter, scheduledDate: new Date(ago(10).getTime() + daysAfter * DAY),
        completedAt: null, score: null, improvement: null,
      })),
    });
    mockInterventionLog.find.mockReturnValue(leanQuery([plan]));
    mockMasteryEvent.find.mockReturnValue(leanQuery([evt(2, 58)]));
    mockInterventionLog.updateOne.mockResolvedValue({});

    await measureFollowUps();
    const update = mockInterventionLog.updateOne.mock.calls[0][1].$set;
    expect(update.status).toBeUndefined();
    expect(update.resolvedAt).toBeUndefined();
  });
});
