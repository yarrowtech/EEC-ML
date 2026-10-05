jest.mock('../models/MasteryEvent', () => ({}));
jest.mock('../models/MasteryScore', () => ({}));
const mongoose = require('mongoose');
const { applyAssessment } = require('../services/masteryEventService');

describe('mastery evidence trust boundary', () => {
  test.each(['tutor', 'self-report', 'decay'])('%s cannot mutate mastery or start a transaction', async (source) => {
    const start = jest.spyOn(mongoose, 'startSession');
    await expect(applyAssessment({
      schoolId: 'school', studentId: 'student', subject: 'Math', topicId: 'topic',
      source, assessmentScore: 100,
    })).rejects.toThrow('verified assessment evidence');
    expect(start).not.toHaveBeenCalled();
    start.mockRestore();
  });
});
