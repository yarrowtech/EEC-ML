/**
 * Learning style detection — infers which tutor-mode category a student
 * engages with most (visual / reading / hands-on / listening) from their
 * AiInteractionLog history, and compares it against their self-reported
 * learningPreferences.learningStyle.
 */
const mockLog = { find: jest.fn() };
jest.mock('../models/AiInteractionLog', () => mockLog);

const mockStudent = { findOne: jest.fn() };
jest.mock('../models/StudentUser', () => mockStudent);

const { detectStudentLearningStyle, getClassLearningStyleSummary, MODE_TO_STYLE } = require('../services/learningStyleService');

const selectLean = (v) => ({ select: () => ({ lean: () => Promise.resolve(v) }) });
const genLogs = (mode, n) => Array.from({ length: n }, () => ({ mode }));

beforeEach(() => jest.clearAllMocks());

describe('MODE_TO_STYLE', () => {
  test('maps every mode to exactly one of the 4 self-report style buckets', () => {
    expect(MODE_TO_STYLE.visual_explain).toBe('visual');
    expect(MODE_TO_STYLE.quiz).toBe('hands-on');
    expect(MODE_TO_STYLE.homework_help).toBe('listening');
    expect(MODE_TO_STYLE.notes).toBe('reading');
  });
});

describe('detectStudentLearningStyle', () => {
  test('reports insufficient_sample below the minimum classified interaction count', () => {
    mockLog.find.mockReturnValue(selectLean(genLogs('quiz', 2)));
    mockStudent.findOne.mockReturnValue(selectLean({ learningPreferences: { learningStyle: '' } }));
    return detectStudentLearningStyle({ schoolId: 'sch1', studentId: 's1' }).then((profile) => {
      expect(profile.dataStatus).toBe('insufficient_sample');
      expect(profile.detectedStyle).toBeNull();
    });
  });

  test('detects the dominant style and computes confidence', async () => {
    mockLog.find.mockReturnValue(selectLean([
      ...genLogs('quiz', 6), ...genLogs('flashcards', 2), ...genLogs('notes', 1),
    ]));
    mockStudent.findOne.mockReturnValue(selectLean({ learningPreferences: { learningStyle: 'hands-on' } }));

    const profile = await detectStudentLearningStyle({ schoolId: 'sch1', studentId: 's1' });
    expect(profile.dataStatus).toBe('available');
    expect(profile.detectedStyle).toBe('hands-on');
    expect(profile.totalClassified).toBe(9);
    expect(profile.confidence).toBe(Math.round((8 / 9) * 100));
    expect(profile.agreesWithSelfReport).toBe(true);
  });

  test('flags a mismatch between detected and self-reported style', async () => {
    mockLog.find.mockReturnValue(selectLean(genLogs('visual_explain', 6)));
    mockStudent.findOne.mockReturnValue(selectLean({ learningPreferences: { learningStyle: 'reading' } }));

    const profile = await detectStudentLearningStyle({ schoolId: 'sch1', studentId: 's1' });
    expect(profile.detectedStyle).toBe('visual');
    expect(profile.agreesWithSelfReport).toBe(false);
  });

  test('ignores unclassified modes (e.g. worksheet) when counting toward the sample', async () => {
    mockLog.find.mockReturnValue(selectLean(genLogs('worksheet', 10)));
    mockStudent.findOne.mockReturnValue(selectLean({ learningPreferences: { learningStyle: '' } }));

    const profile = await detectStudentLearningStyle({ schoolId: 'sch1', studentId: 's1' });
    expect(profile.totalClassified).toBe(0);
    expect(profile.dataStatus).toBe('insufficient_sample');
  });
});

describe('getClassLearningStyleSummary', () => {
  test('tallies a distribution across the class', async () => {
    mockLog.find
      .mockReturnValueOnce(selectLean(genLogs('quiz', 6)))
      .mockReturnValueOnce(selectLean(genLogs('visual_explain', 6)))
      .mockReturnValueOnce(selectLean(genLogs('quiz', 1)));
    mockStudent.findOne.mockReturnValue(selectLean({ learningPreferences: { learningStyle: '' } }));

    const summary = await getClassLearningStyleSummary({ schoolId: 'sch1', studentIds: ['a', 'b', 'c'] });
    expect(summary.distribution['hands-on']).toBe(1);
    expect(summary.distribution.visual).toBe(1);
    expect(summary.distribution.insufficient_data).toBe(1);
    expect(summary.students).toHaveLength(3);
  });
});
