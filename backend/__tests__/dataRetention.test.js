/**
 * AI data retention lifecycle — tutor conversations and rolling memory are
 * pruned past their windows, and every AI artifact for a student is purged once
 * their retention window closes (or on an explicit erasure request).
 */
const del = () => jest.fn(() => Promise.resolve({ deletedCount: 3 }));

const mockTutorConversation = { deleteMany: del(), find: jest.fn() };
const mockStudentMemorySummary = { deleteMany: del(), find: jest.fn() };
const mockRecommendationEvent = { deleteMany: del() };
const mockTutorAnswerCorrection = { deleteMany: del() };
const mockLongAnswerSubmission = { deleteMany: del() };
const mockAiInteractionLog = { deleteMany: del() };
const mockReadingAssessment = { deleteMany: del() };
const mockWritingAssessment = { deleteMany: del() };
const mockStudentUser = { find: jest.fn() };

jest.mock('../models/TutorConversation', () => mockTutorConversation);
jest.mock('../models/StudentMemorySummary', () => mockStudentMemorySummary);
jest.mock('../models/RecommendationEvent', () => mockRecommendationEvent);
jest.mock('../models/TutorAnswerCorrection', () => mockTutorAnswerCorrection);
jest.mock('../models/LongAnswerSubmission', () => mockLongAnswerSubmission);
jest.mock('../models/AiInteractionLog', () => mockAiInteractionLog);
jest.mock('../models/ReadingAssessment', () => mockReadingAssessment);
jest.mock('../models/WritingAssessment', () => mockWritingAssessment);
jest.mock('../models/StudentUser', () => mockStudentUser);
jest.mock('../utils/logger', () => ({ logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() } }));

const svc = require('../services/dataRetentionService');

const allDeleteMocks = [
  mockTutorConversation, mockStudentMemorySummary, mockRecommendationEvent, mockTutorAnswerCorrection,
  mockLongAnswerSubmission, mockAiInteractionLog, mockReadingAssessment, mockWritingAssessment,
];

beforeEach(() => {
  jest.clearAllMocks();
  allDeleteMocks.forEach((m) => m.deleteMany.mockResolvedValue({ deletedCount: 3 }));
});

describe('purgeStudentAiData', () => {
  test('deletes from every AI collection, keyed by the right field', async () => {
    const r = await svc.purgeStudentAiData('stud1', 'school1');
    expect(mockTutorConversation.deleteMany).toHaveBeenCalledWith({ studentId: 'stud1', schoolId: 'school1' });
    expect(mockAiInteractionLog.deleteMany).toHaveBeenCalledWith({ userId: 'stud1', schoolId: 'school1' });
    expect(r.TutorConversation).toBe(3);
    expect(r.LongAnswerSubmission).toBe(3);
  });

  test('a single collection error does not abort the rest', async () => {
    mockRecommendationEvent.deleteMany.mockRejectedValueOnce(new Error('boom'));
    const r = await svc.purgeStudentAiData('stud1', 'school1');
    expect(r.RecommendationEvent).toMatch(/^error:/);
    expect(r.WritingAssessment).toBe(3);
  });
});

describe('pruneOldConversations', () => {
  test('deletes conversations older than the retention window', async () => {
    await svc.pruneOldConversations();
    const filter = mockTutorConversation.deleteMany.mock.calls[0][0];
    expect(filter.updatedAt.$lt).toBeInstanceOf(Date);
    expect(Date.now() - filter.updatedAt.$lt.getTime()).toBeGreaterThan(360 * 86400000);
  });
});

describe('purgeExpiredStudents', () => {
  test('purges AI data for every student past their retention date', async () => {
    mockStudentUser.find.mockReturnValue({
      select: () => ({ limit: () => ({ lean: () => Promise.resolve([
        { _id: 'a', schoolId: 's1' }, { _id: 'b', schoolId: 's1' },
      ]) }) }),
    });
    const r = await svc.purgeExpiredStudents();
    expect(r).toEqual({ expiredStudents: 2, purged: 2 });
    expect(mockTutorConversation.deleteMany).toHaveBeenCalledTimes(2);
  });
});

describe('pruneOldMemory', () => {
  test('blanks stale summaries and drops per-subject memory', async () => {
    const doc = { summary: 'old', keyInsights: ['x'], subjectSummaries: { a: 1 }, save: jest.fn() };
    mockStudentMemorySummary.find.mockResolvedValue([doc]);
    const r = await svc.pruneOldMemory();
    expect(doc.summary).toBe('');
    expect(doc.keyInsights).toEqual([]);
    expect(doc.subjectSummaries).toBeUndefined();
    expect(doc.save).toHaveBeenCalled();
    expect(r.trimmed).toBe(1);
  });
});
