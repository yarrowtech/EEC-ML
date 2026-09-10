const axios = require('axios');

async function evaluateStoredAnswer({ questionText, correctAnswer, studentAnswer, subject = '', topicTitle = '', questionType = 'mcq', context = '' }) {
  const started = Date.now();
  let data;
  if (!String(studentAnswer || '').trim() || questionType === 'mcq') {
    const correct = String(correctAnswer || '').trim().toLowerCase();
    const isCorrect = Boolean(correct) && correct === String(studentAnswer || '').trim().toLowerCase();
    data = { score: isCorrect ? 1 : 0, isCorrect, confidenceScore: 1,
      errorType: isCorrect ? 'None' : 'Concept', missingConcepts: [], bloomLevel: '',
      feedback: isCorrect ? 'Correct.' : 'Review the model answer with your teacher.', evaluationMethod: 'exact_match' };
  } else {
    const response = await axios.post((process.env.AI_SERVICE_URL || 'http://localhost:8000').replace(/\/$/, '') + '/evaluate/answer',
      { questionText, correctAnswer, studentAnswer, subject, topicTitle, questionType, context }, { timeout: 120000 });
    data = response.data;
  }
  if (!Number.isFinite(data.score) || data.score < 0 || data.score > 1 ||
      !Number.isFinite(data.confidenceScore) || data.confidenceScore < 0 || data.confidenceScore > 1) {
    throw new Error('Evaluator returned invalid scores');
  }
  return { ...data, missingConcepts: Array.isArray(data.missingConcepts) ? data.missingConcepts.map(String).slice(0, 30) : [],
    needsReview: data.evaluationMethod === 'lexical_fallback' || data.confidenceScore < 0.7,
    evaluatorVersion: data.evaluatorVersion || 'academic-v1', latencyMs: Date.now() - started };
}

module.exports = { evaluateStoredAnswer };
