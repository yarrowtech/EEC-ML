/**
 * Social / belonging dimension — a student's participation in the Alcove
 * peer community (posts, comments, likes given/received) as a proxy for
 * social connectedness alongside pure academic engagement metrics.
 */
const mockPost = { countDocuments: jest.fn(), find: jest.fn() };
jest.mock('../models/AlcovePost', () => mockPost);

const mockComment = { countDocuments: jest.fn() };
jest.mock('../models/AlcoveComment', () => mockComment);

const { computeStudentBelongingScore, getClassBelongingSummary, bandFromScore } = require('../services/belongingService');

const findLean = (v) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });

beforeEach(() => jest.clearAllMocks());

describe('bandFromScore', () => {
  test('bands scores into isolated / low / moderate / active', () => {
    expect(bandFromScore(0)).toBe('isolated');
    expect(bandFromScore(19)).toBe('isolated');
    expect(bandFromScore(20)).toBe('low');
    expect(bandFromScore(40)).toBe('moderate');
    expect(bandFromScore(70)).toBe('active');
    expect(bandFromScore(100)).toBe('active');
  });
});

describe('computeStudentBelongingScore', () => {
  test('scores zero for a student with no Alcove activity', async () => {
    mockPost.countDocuments.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
    mockComment.countDocuments.mockResolvedValue(0);
    mockPost.find.mockReturnValue(findLean([]));

    const result = await computeStudentBelongingScore({ schoolId: 'sch1', studentId: 's1' });
    expect(result.belongingScore).toBe(0);
    expect(result.band).toBe('isolated');
  });

  test('combines posts, comments, likes given and likes received into a score', async () => {
    // order: postsAuthored, commentsAuthored (via Promise.all with find/likesGiven interleaved)
    mockPost.countDocuments
      .mockResolvedValueOnce(2)  // postsAuthored
      .mockResolvedValueOnce(4); // likesGivenCount
    mockComment.countDocuments.mockResolvedValue(3); // commentsAuthored
    mockPost.find.mockReturnValue(findLean([{ likedBy: ['student:x', 'teacher:y'] }, { likedBy: ['student:z'] }])); // likesReceived = 3

    const result = await computeStudentBelongingScore({ schoolId: 'sch1', studentId: 's1' });
    // postsScore = min(100,40)*0.35=14, commentsScore=min(100,30)*0.25=7.5,
    // givenScore=min(100,20)*0.15=3, receivedScore=min(100,30)*0.25=7.5 -> 32 rounded
    expect(result.postsAuthored).toBe(2);
    expect(result.commentsAuthored).toBe(3);
    expect(result.likesGiven).toBe(4);
    expect(result.likesReceived).toBe(3);
    expect(result.belongingScore).toBe(32);
    expect(result.band).toBe('low');
  });

  test('caps each component at 100 so a single burst of activity cannot dominate', async () => {
    mockPost.countDocuments.mockResolvedValueOnce(50).mockResolvedValueOnce(50);
    mockComment.countDocuments.mockResolvedValue(50);
    mockPost.find.mockReturnValue(findLean([]));

    const result = await computeStudentBelongingScore({ schoolId: 'sch1', studentId: 's1' });
    expect(result.belongingScore).toBeLessThanOrEqual(100);
  });
});

describe('getClassBelongingSummary', () => {
  test('ranks students lowest belonging score first', async () => {
    mockPost.countDocuments
      .mockResolvedValueOnce(5).mockResolvedValueOnce(5) // student "high"
      .mockResolvedValueOnce(0).mockResolvedValueOnce(0); // student "low"
    mockComment.countDocuments.mockResolvedValueOnce(5).mockResolvedValueOnce(0);
    mockPost.find.mockReturnValue(findLean([]));

    const summary = await getClassBelongingSummary({ schoolId: 'sch1', studentIds: ['high', 'low'] });
    expect(summary.map((r) => r.studentId)).toEqual(['low', 'high']);
  });
});
