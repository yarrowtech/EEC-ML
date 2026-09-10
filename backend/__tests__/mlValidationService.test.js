/**
 * Retrospective backtest of the at-risk detector: predicts using evidence up
 * to a cutoff, then checks the outcome against evidence recorded after it.
 */
const mockComputeAtRisk = jest.fn();
jest.mock('../services/mlEngine', () => ({ computeAtRisk: (...args) => mockComputeAtRisk(...args) }));

const mockLoadEvidence = jest.fn();
jest.mock('../services/learningEvidenceService', () => ({
  loadEvidence: (...args) => mockLoadEvidence(...args),
  credible: (e) => !['decay', 'self-report'].includes(e.source) && Number.isFinite(e.assessmentScore),
}));

const { backtestAtRiskDetection } = require('../services/mlValidationService');

const predictions = {
  s1: { riskScore: 80, dropoutRisk: { band: 'critical' } }, // predicted at-risk
  s2: { riskScore: 90, dropoutRisk: { band: 'critical' } }, // predicted at-risk
  s3: { riskScore: 10, dropoutRisk: { band: 'low' } },      // predicted not at-risk
  s4: { riskScore: 5, dropoutRisk: { band: 'low' } },       // predicted not at-risk
  s5: { riskScore: null, dropoutRisk: { band: 'insufficient_data' } }, // no baseline evidence
  s6: { riskScore: 60, dropoutRisk: { band: 'high' } },     // baseline exists, no outcome evidence
};

const outcomes = {
  s1: [{ source: 'exam', assessmentScore: 30 }], // actually at-risk -> true positive
  s2: [{ source: 'exam', assessmentScore: 90 }], // actually fine   -> false positive
  s3: [{ source: 'exam', assessmentScore: 20 }], // actually at-risk -> false negative
  s4: [{ source: 'exam', assessmentScore: 85 }], // actually fine   -> true negative
  s5: [{ source: 'exam', assessmentScore: 40 }],
  s6: [],
};

beforeEach(() => {
  mockComputeAtRisk.mockReset().mockImplementation(({ studentId }) => Promise.resolve(predictions[studentId]));
  mockLoadEvidence.mockReset().mockImplementation(({ studentId }) => Promise.resolve(outcomes[studentId] || []));
});

describe('backtestAtRiskDetection', () => {
  test('builds a confusion matrix and precision/recall/accuracy from real outcomes', async () => {
    const report = await backtestAtRiskDetection({
      schoolId: 'sch1', studentIds: ['s1', 's2', 's3', 's4', 's5', 's6'], horizonDays: 7,
    });

    expect(report.sampleSize).toBe(4);
    expect(report.excludedCount).toBe(2);
    expect(report.confusionMatrix).toEqual({ truePositive: 1, falsePositive: 1, falseNegative: 1, trueNegative: 1 });
    expect(report.precision).toBe(0.5);
    expect(report.recall).toBe(0.5);
    expect(report.accuracy).toBe(0.5);
    expect(report.f1).toBe(0.5);
  });

  test('flags small samples as insufficient rather than reporting false confidence', async () => {
    const report = await backtestAtRiskDetection({ schoolId: 'sch1', studentIds: ['s1', 's4'], horizonDays: 7 });
    expect(report.sampleSize).toBe(2);
    expect(report.dataStatus).toBe('insufficient_sample');
  });

  test('predicts as of (now - horizonDays) and measures outcome over the following window', async () => {
    const now = Date.now();
    await backtestAtRiskDetection({ schoolId: 'sch1', studentIds: ['s1'], horizonDays: 7, asOf: now });

    const [predictArgs] = mockComputeAtRisk.mock.calls[0];
    expect(predictArgs.asOf).toBe(now - 7 * 86400000);

    const [evidenceArgs] = mockLoadEvidence.mock.calls[0];
    expect(evidenceArgs).toMatchObject({ studentId: 's1', schoolId: 'sch1', asOf: now, windowDays: 7 });
  });

  test('returns null metrics and zero sample when nothing is evaluable', async () => {
    const report = await backtestAtRiskDetection({ schoolId: 'sch1', studentIds: [] });
    expect(report.sampleSize).toBe(0);
    expect(report.precision).toBeNull();
    expect(report.recall).toBeNull();
    expect(report.accuracy).toBeNull();
    expect(report.dataStatus).toBe('insufficient_sample');
  });
});
