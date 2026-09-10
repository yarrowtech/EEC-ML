describe('engagement scorer', () => {
  test('uses per-student material activity and exposes three dimensions', async () => {
    jest.resetModules();
    const now = new Date();
    const chain = (value) => ({ select: () => ({ lean: () => Promise.resolve(value) }), lean: () => Promise.resolve(value) });
    jest.doMock('../models/TeachingMaterial', () => ({
      find: jest.fn(() => chain([{ subjectName: 'Math', topicTitle: 'Fractions', viewedBy: [{ studentId: 's1', viewCount: 2, timeSpent: 600, lastViewedAt: now }], quizAttempts: [{ studentId: 's1', submittedAt: now }] }])),
    }));
    jest.doMock('../models/Wellbeing', () => ({ findOne: jest.fn(() => chain({ mood: 'good', socialEngagement: 8, academicStress: 3 })) }));
    jest.doMock('../utils/notificationService', () => ({ createNotification: jest.fn() }));

    const { computeEngagement } = require('../services/engagementScorer');
    const [topic] = await computeEngagement('s1', 'school1');
    expect(topic.views).toBe(2);
    expect(topic.quizAttempts).toBe(1);
    expect(topic.dimensions.behavioural).toBeGreaterThan(0);
    expect(topic.dimensions.situational).toBeGreaterThan(0);
    expect(topic.dimensions.emotional).toBeGreaterThan(0);
    expect(topic.score).toBeGreaterThan(0);
  });
});
