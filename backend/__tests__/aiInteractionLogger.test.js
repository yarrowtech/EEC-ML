/**
 * AI interaction lineage logging — every backend→AI-service call is recorded
 * with the model / prompt / retrieval config that produced it, for the
 * explainable-AI audit trail and quality monitoring.
 */
const mockCreate = jest.fn();
jest.mock('../models/AiInteractionLog', () => ({ create: (...a) => mockCreate(...a) }));
jest.mock('../utils/logger', () => ({ logger: { warn: jest.fn(), error: jest.fn(), info: jest.fn() } }));

const { shapeRecord, logAiInteraction } = require('../services/aiInteractionLogger');

beforeEach(() => jest.clearAllMocks());

describe('shapeRecord', () => {
  test('flattens the ai-service lineage + response into one record', () => {
    const r = shapeRecord({
      schoolId: 'school1', userId: 'stud1', userRole: 'student',
      feature: 'tutor_generate', subject: 'Science', topicTitle: 'Photosynthesis',
      retrievalConfig: { classId: 'c1', sectionId: 's1', chapterTitle: 'Plants', excludedMaterialCount: 2 },
      aiResponse: {
        mode: 'explain', model: 'llama3.2:3b', content: 'Plants make food from light.',
        groundedInMaterial: true, citations: [{ page: 3 }, { page: 4 }],
        lineage: { promptSource: 'prompts/explain', rewrittenQuery: 'how do plants make food',
          retrievalChunkCount: 6, citationCount: 2, provider: 'ollama' },
      },
      status: 'success', latencyMs: 1800,
    });

    expect(r.feature).toBe('tutor_generate');
    expect(r.model).toBe('llama3.2:3b');
    expect(r.mode).toBe('explain');
    expect(r.promptSource).toBe('prompts/explain');
    expect(r.rewrittenQuery).toBe('how do plants make food');
    expect(r.grounded).toBe(true);
    expect(r.citationCount).toBe(2);
    expect(r.retrievalConfig.chunkCount).toBe(6);
    expect(r.retrievalConfig.excludedMaterialCount).toBe(2);
    expect(r.provider).toBe('ollama');
    expect(r.outputChars).toBe('Plants make food from light.'.length);
    expect(r.latencyMs).toBe(1800);
  });

  test('captures evaluation scores and needs-review', () => {
    const r = shapeRecord({
      schoolId: 'school1', feature: 'long_answer_evaluate',
      aiResponse: { score: 0.7, confidenceScore: 0.55, needsReview: true, evaluationMethod: 'lexical_fallback' },
      status: 'success',
    });
    expect(r.score).toBe(0.7);
    expect(r.confidenceScore).toBe(0.55);
    expect(r.needsReview).toBe(true);
  });

  test('shapes an error record without an aiResponse', () => {
    const r = shapeRecord({
      schoolId: 'school1', feature: 'answer_evaluate',
      status: 'error', httpStatus: 502, errorType: 'ai_service_error', latencyMs: 400,
    });
    expect(r.status).toBe('error');
    expect(r.httpStatus).toBe(502);
    expect(r.model).toBe('');
    expect(r.outputChars).toBeNull();
  });
});

describe('logAiInteraction', () => {
  test('persists a shaped record', async () => {
    await logAiInteraction({ schoolId: 'school1', feature: 'tutor_generate', aiResponse: { model: 'm' }, status: 'success' });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({ feature: 'tutor_generate', model: 'm' }));
  });

  test('never throws when the write fails', async () => {
    mockCreate.mockRejectedValueOnce(new Error('db down'));
    await expect(logAiInteraction({ feature: 'tutor_generate' })).resolves.toBeUndefined();
  });
});
