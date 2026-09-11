/**
 * Help-seeking behaviour — logs when a student switches into Homework Help
 * mode or signals they're stuck ("I don't know"), then summarises frequency
 * per student and per class.
 */
const mockEvent = { create: jest.fn(), find: jest.fn() };
jest.mock('../models/HelpSeekingEvent', () => mockEvent);

const {
  detectStuckSignal,
  logFromTutorTurn,
  getStudentHelpSeekingProfile,
  getClassHelpSeekingSummary,
} = require('../services/helpSeekingService');

const sortLimitLean = (v) => ({ sort: () => ({ limit: () => ({ lean: () => Promise.resolve(v) }) }) });

beforeEach(() => jest.clearAllMocks());

describe('detectStuckSignal', () => {
  test('matches common "I don\'t know" phrasing', () => {
    expect(detectStuckSignal("I don't know")).toBe(true);
    expect(detectStuckSignal('idk')).toBe(true);
    expect(detectStuckSignal("I'm stuck on this one")).toBe(true);
    expect(detectStuckSignal('not sure what to do next')).toBe(true);
  });

  test('does not false-positive on ordinary questions', () => {
    expect(detectStuckSignal('What is photosynthesis?')).toBe(false);
    expect(detectStuckSignal('')).toBe(false);
    expect(detectStuckSignal(undefined)).toBe(false);
  });
});

describe('logFromTutorTurn', () => {
  test('logs homework_help_used for every homework_help turn', async () => {
    mockEvent.create.mockResolvedValue({});
    await logFromTutorTurn({ schoolId: 'sch1', studentId: 's1', subject: 'Math', topicTitle: 'Fractions', mode: 'homework_help', question: 'How do I add fractions?' });

    expect(mockEvent.create).toHaveBeenCalledTimes(1);
    expect(mockEvent.create).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'homework_help_used' }));
  });

  test('also logs stuck_signal when the student says they do not know', async () => {
    mockEvent.create.mockResolvedValue({});
    await logFromTutorTurn({ schoolId: 'sch1', studentId: 's1', mode: 'homework_help', question: "I don't know, help me" });

    expect(mockEvent.create).toHaveBeenCalledTimes(2);
    expect(mockEvent.create.mock.calls.map((c) => c[0].eventType)).toEqual(
      expect.arrayContaining(['homework_help_used', 'stuck_signal'])
    );
  });

  test('logs misconception_explainer_used when the student asks the AI to explain a quiz mistake', async () => {
    mockEvent.create.mockResolvedValue({});
    await logFromTutorTurn({ schoolId: 'sch1', studentId: 's1', mode: 'misconception', question: 'Why is A wrong?' });

    expect(mockEvent.create).toHaveBeenCalledTimes(1);
    expect(mockEvent.create).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'misconception_explainer_used' }));
  });

  test('logs stuck_signal in any mode, not just homework_help', async () => {
    mockEvent.create.mockResolvedValue({});
    await logFromTutorTurn({ schoolId: 'sch1', studentId: 's1', mode: 'explain', question: "idk what this means" });

    expect(mockEvent.create).toHaveBeenCalledTimes(1);
    expect(mockEvent.create).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'stuck_signal', mode: 'explain' }));
  });

  test('does nothing for an ordinary question in a non-instrumented mode', async () => {
    await logFromTutorTurn({ schoolId: 'sch1', studentId: 's1', mode: 'quiz', question: 'anything' });
    expect(mockEvent.create).not.toHaveBeenCalled();
  });

  test('swallows logging errors without throwing', async () => {
    mockEvent.create.mockRejectedValue(new Error('db down'));
    await expect(logFromTutorTurn({ schoolId: 'sch1', studentId: 's1', mode: 'homework_help', question: 'x' }))
      .resolves.toBeUndefined();
  });
});

describe('getStudentHelpSeekingProfile', () => {
  test('summarises event counts and top subjects', async () => {
    mockEvent.find.mockReturnValue(sortLimitLean([
      { eventType: 'homework_help_used', subject: 'Math', createdAt: new Date('2026-02-02') },
      { eventType: 'homework_help_used', subject: 'Math', createdAt: new Date('2026-02-01') },
      { eventType: 'stuck_signal', subject: 'Science', createdAt: new Date('2026-02-01') },
      { eventType: 'misconception_explainer_used', subject: 'Math', createdAt: new Date('2026-02-01') },
    ]));

    const profile = await getStudentHelpSeekingProfile({ schoolId: 'sch1', studentId: 's1' });
    expect(profile.totalEvents).toBe(4);
    expect(profile.homeworkHelpUsed).toBe(2);
    expect(profile.stuckSignals).toBe(1);
    expect(profile.misconceptionExplainerUsed).toBe(1);
    expect(profile.topSubjects[0]).toEqual({ subject: 'Math', count: 3 });
    expect(profile.lastEventAt).toEqual(new Date('2026-02-02'));
  });

  test('reports zero events when there are none', async () => {
    mockEvent.find.mockReturnValue(sortLimitLean([]));
    const profile = await getStudentHelpSeekingProfile({ schoolId: 'sch1', studentId: 's1' });
    expect(profile.totalEvents).toBe(0);
    expect(profile.lastEventAt).toBeNull();
  });
});

describe('getClassHelpSeekingSummary', () => {
  test('ranks students by total help-seeking events, most first', async () => {
    mockEvent.find
      .mockReturnValueOnce(sortLimitLean([{ eventType: 'homework_help_used', subject: 'Math', createdAt: new Date() }]))
      .mockReturnValueOnce(sortLimitLean([
        { eventType: 'homework_help_used', subject: 'Math', createdAt: new Date() },
        { eventType: 'stuck_signal', subject: 'Math', createdAt: new Date() },
      ]))
      .mockReturnValueOnce(sortLimitLean([]));

    const summary = await getClassHelpSeekingSummary({ schoolId: 'sch1', studentIds: ['low', 'high', 'none'] });
    expect(summary.map((r) => r.studentId)).toEqual(['high', 'low', 'none']);
  });
});
