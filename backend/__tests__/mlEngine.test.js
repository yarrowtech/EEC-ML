describe('ML mastery weighting', () => {
  test('calculateEma weights newer assessment events more heavily', () => {
    const { calculateEma } = require('../services/mlEngine');
    expect(calculateEma([40, 80], 0.35)).toBeCloseTo(54);
    expect(calculateEma([], 0.35)).toBeNull();
  });

  test('computeWeightedMastery reads the event stream for each topic', async () => {
    jest.resetModules();
    const masteryRows = [{ subject: 'Math', topicId: 'math::fractions', topicTitle: 'Fractions', score: 70, attemptCount: 2 }];
    const eventRows = [
      { subject: 'Math', topicId: 'math::fractions', assessmentScore: 40, source: 'practice', metadata: {}, createdAt: new Date('2026-01-01') },
      { subject: 'Math', topicId: 'math::fractions', assessmentScore: 80, source: 'exam', metadata: {}, createdAt: new Date('2026-01-02') },
    ];
    const chain = (value) => ({ sort: () => ({ lean: () => Promise.resolve(value) }), lean: () => Promise.resolve(value) });
    jest.doMock('../models/MasteryScore', () => ({ find: jest.fn(() => chain(masteryRows)) }));
    jest.doMock('../models/MasteryEvent', () => ({ find: jest.fn(() => chain(eventRows)) }));
    jest.doMock('../models/StudentProgress', () => ({}));
    jest.doMock('../models/TeachingMaterial', () => ({}));
    jest.doMock('../models/StudentUser', () => ({}));

    const { computeWeightedMastery } = require('../services/mlEngine');
    const result = await computeWeightedMastery({ studentId: 'student-1', schoolId: 'school-1' });
    expect(result[0].weightedScore).toBe(54);
    expect(result[0].rawScore).toBe(70);
  });

  test('computeAtRisk includes recent attendance in the risk band', async () => {
    jest.resetModules();
    const chain = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }), lean: () => Promise.resolve(value) });
    const recent = new Date();
    jest.doMock('../models/MasteryEvent', () => ({
      find: jest.fn(() => ({ sort: () => ({ lean: () => Promise.resolve([
        { source: 'exam', assessmentScore: 40, createdAt: recent, metadata: {} },
      ]) }) })),
    }));
    jest.doMock('../models/StudentUser', () => ({
      findOne: jest.fn(() => chain({ attendance: [
        { date: recent, status: 'present' },
        { date: recent, status: 'absent' },
      ] })),
    }));
    jest.doMock('../models/MasteryScore', () => ({ find: jest.fn(() => chain([])) }));
    jest.doMock('../models/StudentProgress', () => ({}));
    jest.doMock('../models/TeachingMaterial', () => ({}));

    const { computeAtRisk } = require('../services/mlEngine');
    const result = await computeAtRisk({ studentId: 's1', schoolId: 'school1' });
    expect(result.attendanceRate).toBe(50);
    expect(result.riskFactors).toContain('low_attendance');
    expect(result.dropoutRisk.band).toBe('critical');
  });
});
