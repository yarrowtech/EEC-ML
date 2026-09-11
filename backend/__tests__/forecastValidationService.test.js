/**
 * Retrospective backtest of the 7-day score forecast (learningEvidenceService
 * .forecastScores): predicts from evidence up to a cutoff, then checks each
 * student's own following week as ground truth — covers both "Performance
 * Forecasting" (regression MAE/RMSE) and "Topic Failure Prediction"
 * (pass/fail confusion matrix) with the same backtest.
 */
const mockForecastScores = jest.fn();
const mockLoadEvidence = jest.fn();
jest.mock('../services/learningEvidenceService', () => ({
  forecastScores: (...args) => mockForecastScores(...args),
  loadEvidence: (...args) => mockLoadEvidence(...args),
  credible: (e) => !['decay', 'self-report'].includes(e.source) && Number.isFinite(e.assessmentScore),
}));

const { backtestScoreForecast, HORIZON_DAYS } = require('../services/forecastValidationService');

const forecasts = {
  s1: { status: 'estimated', predictedScore: 30 }, // predicted fail, actual fail -> TP, small error
  s2: { status: 'estimated', predictedScore: 85 }, // predicted pass, actual fail -> FN
  s3: { status: 'estimated', predictedScore: 90 }, // predicted pass, actual pass -> TN
  s4: { status: 'insufficient_data', predictedScore: null }, // excluded: no forecast
  s5: { status: 'estimated', predictedScore: 50 }, // excluded: no outcome evidence
};

const outcomes = {
  s1: [{ source: 'exam', assessmentScore: 35 }],
  s2: [{ source: 'exam', assessmentScore: 20 }],
  s3: [{ source: 'exam', assessmentScore: 88 }],
  s4: [{ source: 'exam', assessmentScore: 40 }],
  s5: [],
};

beforeEach(() => {
  mockForecastScores.mockReset().mockImplementation((events, cutoff) => {
    // identify which student by matching the events array reference isn't possible here,
    // so tests instead configure loadEvidence to tag evidence with studentId and this
    // mock reads it back off the (mocked) prior-evidence array's marker.
    return forecasts[events.__studentId];
  });
  mockLoadEvidence.mockReset().mockImplementation(({ studentId, windowDays }) => {
    if (windowDays === 30) {
      const arr = [];
      arr.__studentId = studentId;
      return Promise.resolve(arr);
    }
    return Promise.resolve(outcomes[studentId] || []);
  });
});

describe('backtestScoreForecast', () => {
  test('computes MAE/RMSE and a pass/fail confusion matrix from real outcomes', async () => {
    const report = await backtestScoreForecast({
      schoolId: 'sch1', studentIds: ['s1', 's2', 's3', 's4', 's5'],
    });

    expect(report.horizonDays).toBe(HORIZON_DAYS);
    expect(report.sampleSize).toBe(3); // s1, s2, s3 — s4 (no forecast) and s5 (no outcome) excluded
    expect(report.excludedCount).toBe(2);

    expect(report.regression.mae).toBeCloseTo((5 + 65 + 2) / 3, 2); // |30-35| + |85-20| + |90-88|

    expect(report.failurePrediction.confusionMatrix).toEqual({
      truePositive: 1, falsePositive: 0, falseNegative: 1, trueNegative: 1,
    });
  });

  test('flags small samples as insufficient rather than reporting false confidence', async () => {
    const report = await backtestScoreForecast({ schoolId: 'sch1', studentIds: ['s1', 's3'] });
    expect(report.sampleSize).toBe(2);
    expect(report.dataStatus).toBe('insufficient_sample');
  });

  test('predicts as of (now - 7 days) so the cutoff matches the forecast horizon', async () => {
    const now = Date.now();
    await backtestScoreForecast({ schoolId: 'sch1', studentIds: ['s1'], asOf: now });

    const priorEvidenceCall = mockLoadEvidence.mock.calls.find((c) => c[0].windowDays === 30)[0];
    expect(priorEvidenceCall.asOf).toBe(now - HORIZON_DAYS * 86400000);

    const [, cutoffArg] = mockForecastScores.mock.calls[0];
    expect(cutoffArg).toBe(now - HORIZON_DAYS * 86400000);

    const outcomeCall = mockLoadEvidence.mock.calls.find((c) => c[0].windowDays === HORIZON_DAYS)[0];
    expect(outcomeCall.asOf).toBe(now);
  });

  test('returns null regression/confusion stats with nothing evaluable', async () => {
    const report = await backtestScoreForecast({ schoolId: 'sch1', studentIds: [] });
    expect(report.sampleSize).toBe(0);
    expect(report.regression).toEqual({ mae: null, rmse: null });
    expect(report.failurePrediction.precision).toBeNull();
    expect(report.dataStatus).toBe('insufficient_sample');
  });
});
