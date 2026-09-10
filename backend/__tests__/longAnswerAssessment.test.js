/**
 * Long-answer assessment workflow: the AI evaluator scores a written answer
 * against the teacher's model answer/rubric, an official mastery event is
 * pushed only for a trustworthy grade, and a teacher review supersedes the AI
 * grade with a distinct event.
 */
const mockEvaluate = jest.fn();
jest.mock('../services/academicEvaluator', () => ({ evaluateStoredAnswer: (...a) => mockEvaluate(...a) }));

const mockApply = jest.fn();
jest.mock('../services/masteryEventService', () => ({ applyAssessment: (...a) => mockApply(...a) }));

jest.mock('../services/aiInteractionLogger', () => ({ logAiInteraction: jest.fn() }));

const { evaluateAnswer, applyMastery, resolveFinalMarks, clampMarks } = require('../services/longAnswerAssessmentService');

const question = {
  _id: 'q1', subject: 'Science', topicId: 'sci::photosynthesis', topicTitle: 'Photosynthesis',
  chapterTitle: 'Plants', questionText: 'Explain photosynthesis.', modelAnswer: 'Plants convert light...',
  rubric: 'Mention chlorophyll, CO2, water, glucose, oxygen.', markingCriteria: ['chlorophyll', 'glucose'],
  maxMarks: 10,
};

beforeEach(() => jest.clearAllMocks());

describe('clampMarks', () => {
  test('rounds to 2dp and clamps to [0, max]', () => {
    expect(clampMarks(7.126, 10)).toBe(7.13);
    expect(clampMarks(-2, 10)).toBe(0);
    expect(clampMarks(999, 10)).toBe(10);
  });
});

describe('evaluateAnswer', () => {
  test('sends long_answer type + rubric context and converts score to marks', async () => {
    mockEvaluate.mockResolvedValue({
      score: 0.7, feedback: 'Good, but no mention of oxygen.', errorType: 'Concept',
      bloomLevel: 'understand', missingConcepts: ['oxygen release'], confidenceScore: 0.9,
      evaluationMethod: 'llm', evaluatorVersion: 'academic-v1', needsReview: false, latencyMs: 1200,
    });
    const ai = await evaluateAnswer({ question, answerText: 'Plants use sunlight and CO2 to make glucose.' });

    const sent = mockEvaluate.mock.calls[0][0];
    expect(sent.questionType).toBe('long_answer');
    expect(sent.correctAnswer).toBe(question.modelAnswer);
    expect(sent.context).toContain('chlorophyll');
    expect(ai.marks).toBe(7);
    expect(ai.missingConcepts).toEqual(['oxygen release']);
    expect(ai.needsReview).toBe(false);
  });
});

describe('resolveFinalMarks', () => {
  test('prefers a teacher mark, falls back to the AI mark', () => {
    expect(resolveFinalMarks({ ai: { marks: 6 }, teacherReview: { marks: 8 } })).toBe(8);
    expect(resolveFinalMarks({ ai: { marks: 6 }, teacherReview: {} })).toBe(6);
    expect(resolveFinalMarks({ ai: {}, teacherReview: {} })).toBeNull();
  });
});

describe('applyMastery', () => {
  const baseSubmission = {
    _id: 's1', studentId: 'stud1', submittedAt: new Date('2026-03-01T00:00:00Z'),
    ai: { marks: 7, needsReview: false, errorType: 'Concept', bloomLevel: 'understand', missingConcepts: [], confidenceScore: 0.9 },
    teacherReview: {},
  };

  test('pushes an official assignment-source mastery event for a trustworthy AI grade', async () => {
    const applied = await applyMastery({ schoolId: 'school1', question, submission: { ...baseSubmission, finalMarks: 7 } });
    expect(applied).toBe(true);
    const evt = mockApply.mock.calls[0][0];
    expect(evt.source).toBe('assignment');
    expect(evt.assessmentScore).toBe(70);
    expect(evt.eventId).toMatch(/^long_answer:s1:ai:/);
    expect(evt.metadata.provenance).toBe('long_answer_ai');
  });

  test('withholds mastery while the AI grade needs review', async () => {
    const applied = await applyMastery({
      schoolId: 'school1', question,
      submission: { ...baseSubmission, ai: { ...baseSubmission.ai, needsReview: true }, finalMarks: 7 },
    });
    expect(applied).toBe(false);
    expect(mockApply).not.toHaveBeenCalled();
  });

  test('a teacher review supersedes with a distinct event and its own score', async () => {
    const reviewed = {
      ...baseSubmission,
      ai: { ...baseSubmission.ai, needsReview: true, marks: 4 },
      teacherReview: { marks: 8, reviewedAt: new Date('2026-03-05T00:00:00Z') },
      finalMarks: 8,
    };
    const applied = await applyMastery({ schoolId: 'school1', question, submission: reviewed });
    expect(applied).toBe(true);
    const evt = mockApply.mock.calls[0][0];
    expect(evt.assessmentScore).toBe(80);
    expect(evt.eventId).toMatch(/^long_answer:s1:review:/);
    expect(evt.metadata.provenance).toBe('teacher_reviewed');
  });
});
