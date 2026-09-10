/**
 * Pre/post outcome-measurement framework — captures a cohort's learning metric
 * over baseline and post windows and reports the paired mean change, % improved,
 * and a Cohen's-d effect size.
 */
const mockMasteryEvent = { find: jest.fn() };
const mockMasteryScore = { find: jest.fn() };
jest.mock('../models/MasteryEvent', () => mockMasteryEvent);
jest.mock('../models/MasteryScore', () => mockMasteryScore);
jest.mock('../services/learningEvidenceService', () => ({
  credible: (e) => !['decay', 'self-report'].includes(e.source) && Number.isFinite(e.assessmentScore ?? e.scoreAfter),
}));

const { computeEffect, measureWindow, capturePostAndResult } = require('../services/outcomeStudyService');

const chain = (v) => ({ sort: () => ({ lean: () => Promise.resolve(v) }), lean: () => Promise.resolve(v) });
const ev = (score, daysAgo, extra = {}) => ({ source: 'exam', assessmentScore: score, scoreAfter: score,
  createdAt: new Date(Date.now() - daysAgo * 86400000), ...extra });

beforeEach(() => jest.clearAllMocks());

describe('computeEffect', () => {
  test('paired mean delta, % improved and effect-size interpretation', () => {
    const base = { a: 50, b: 60, c: 40, d: 55 };
    const post = { a: 62, b: 65, c: 58, d: 52 };   // deltas +12 +5 +18 -3
    const r = computeEffect(base, post);
    expect(r.pairedN).toBe(4);
    expect(r.meanDelta).toBe(8);          // (12+5+18-3)/4
    expect(r.pctImproved).toBe(75);       // 3 of 4 improved
    expect(r.effectSize).not.toBeNull();
    expect(['small', 'medium', 'large']).toContain(r.interpretation);
  });

  test('flags a decline', () => {
    const r = computeEffect({ a: 70, b: 80 }, { a: 55, b: 60 });
    expect(r.meanDelta).toBeLessThan(0);
    expect(r.interpretation).toMatch(/_decline$/);
  });

  test('insufficient data when there are no matched pairs', () => {
    const r = computeEffect({ a: 50 }, { b: 60 });
    expect(r.pairedN).toBe(0);
    expect(r.interpretation).toBe('insufficient_data');
  });
});

describe('measureWindow (assessment_avg)', () => {
  test('averages credible assessment scores per student within the window', async () => {
    mockMasteryEvent.find
      .mockReturnValueOnce(chain([ev(40, 20), ev(50, 18), ev(0, 15, { source: 'decay' })])) // s1 → mean of 40,50
      .mockReturnValueOnce(chain([ev(70, 19)]));                                              // s2 → 70
    const m = await measureWindow({
      schoolId: 'sch1', studentIds: ['s1', 's2'], subject: 'Math', metric: 'assessment_avg',
      window: { start: new Date(Date.now() - 30 * 86400000), end: new Date() },
    });
    expect(m.perStudent).toEqual([
      { studentId: 's1', value: 45, sampleCount: 2 },
      { studentId: 's2', value: 70, sampleCount: 1 },
    ]);
    expect(m.mean).toBe(57.5);
    expect(m.n).toBe(2);
  });
});

describe('capturePostAndResult', () => {
  test('joins baseline + post by student and produces a result block', async () => {
    mockMasteryEvent.find
      .mockReturnValueOnce(chain([ev(60, 5)]))   // post s1
      .mockReturnValueOnce(chain([ev(75, 5)]));   // post s2
    const study = {
      schoolId: 'sch1', studentIds: ['s1', 's2'], subject: 'Math', metric: 'assessment_avg',
      postWindow: { start: new Date(Date.now() - 7 * 86400000), end: new Date() },
    };
    const baseline = { perStudent: [{ studentId: 's1', value: 50 }, { studentId: 's2', value: 70 }], mean: 60 };
    const { post, result } = await capturePostAndResult(study, baseline);
    expect(post.mean).toBe(67.5);
    expect(result.meanDelta).toBe(7.5);       // (+10 +5) / 2
    expect(result.pctImproved).toBe(100);
    expect(result.baselineMean).toBe(60);
    expect(result.postMean).toBe(67.5);
  });
});
