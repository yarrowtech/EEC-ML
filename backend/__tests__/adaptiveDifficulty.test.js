/**
 * Within-session adaptive difficulty — starts from the mastery band, steps up
 * on a correct run, steps down on a wrong answer, bounded to [easy, hard], and
 * resumes from the persisted rung (never > 1 rung above the mastery band).
 */
const mockState = { findOne: jest.fn(), updateOne: jest.fn() };
const mockMastery = { findOne: jest.fn() };
jest.mock('../models/AdaptivePracticeState', () => mockState);
jest.mock('../models/MasteryScore', () => mockMastery);

const svc = require('../services/adaptiveDifficultyService');
const lean = (v) => ({ lean: () => Promise.resolve(v) });

beforeEach(() => {
  jest.clearAllMocks();
  mockState.updateOne.mockResolvedValue({});
});

describe('startingDifficulty', () => {
  test('maps mastery score to a starting rung', () => {
    expect(svc.startingDifficulty(null)).toBe('easy');
    expect(svc.startingDifficulty(30)).toBe('easy');
    expect(svc.startingDifficulty(60)).toBe('medium');
    expect(svc.startingDifficulty(85)).toBe('hard');
  });
});

describe('step', () => {
  test('steps up after two correct in a row', () => {
    const a = svc.step({ currentDifficulty: 'easy', lastCorrect: true, consecutiveCorrect: 0 });
    expect(a).toMatchObject({ nextDifficulty: 'easy', consecutiveCorrect: 1, changed: false });
    const b = svc.step({ currentDifficulty: 'easy', lastCorrect: true, consecutiveCorrect: 1 });
    expect(b).toMatchObject({ nextDifficulty: 'medium', consecutiveCorrect: 0, changed: true });
  });

  test('a fast correct answer counts double toward the step-up', () => {
    const r = svc.step({ currentDifficulty: 'medium', lastCorrect: true, consecutiveCorrect: 0, responseMs: 4000 });
    expect(r.nextDifficulty).toBe('hard');
    expect(r.changed).toBe(true);
  });

  test('steps down on a wrong answer and resets the streak', () => {
    const r = svc.step({ currentDifficulty: 'hard', lastCorrect: false, consecutiveCorrect: 5 });
    expect(r).toMatchObject({ nextDifficulty: 'medium', consecutiveCorrect: 0, changed: true });
  });

  test('cannot go below easy or above hard', () => {
    expect(svc.step({ currentDifficulty: 'easy', lastCorrect: false }).nextDifficulty).toBe('easy');
    expect(svc.step({ currentDifficulty: 'hard', lastCorrect: true, consecutiveCorrect: 5 }).nextDifficulty).toBe('hard');
  });
});

describe('resume', () => {
  test('seeds from the mastery band when there is no persisted state', async () => {
    mockState.findOne.mockReturnValue(lean(null));
    mockMastery.findOne.mockReturnValue(lean({ score: 55, topicTitle: 'Fractions' }));
    const r = await svc.resume({ studentId: 's1', schoolId: 'sch1', subject: 'Math', topicId: 't1' });
    expect(r.difficulty).toBe('medium');
    expect(r.fromPersistedState).toBe(false);
  });

  test('caps a persisted rung at one above the mastery band', async () => {
    mockState.findOne.mockReturnValue(lean({ difficulty: 'hard' }));
    mockMastery.findOne.mockReturnValue(lean({ score: 20 })); // mastery band = easy
    const r = await svc.resume({ studentId: 's1', schoolId: 'sch1', subject: 'Math', topicId: 't1' });
    expect(r.difficulty).toBe('medium'); // easy + 1, not hard
  });
});
