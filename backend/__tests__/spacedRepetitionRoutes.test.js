describe('spaced repetition retention endpoint', () => {
  test('returns estimated retention and status for scheduled topics', async () => {
    jest.resetModules();
    const lastReviewedAt = new Date(Date.now() - 3 * 86400000);
    jest.doMock('../middleware/authStudent', () => (req, _res, next) => {
      req.user = { id: 'student-1' }; req.schoolId = 'school-1'; next();
    });
    jest.doMock('../models/SpacedRepetitionSchedule', () => ({ find: jest.fn(), findOne: jest.fn(), create: jest.fn() }));
    const router = require('../routes/spacedRepetitionRoutes');
    const result = router.estimateRetention({ intervalDays: 1, lastReviewedAt, nextReviewDate: new Date() });
    expect(result.estimatedRetention).toBeLessThan(100);
    expect(result.status).toBe('fading');
  });
});
