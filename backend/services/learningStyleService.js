/**
 * learningStyleService.js
 * Learning style detection: infers which content format a student actually
 * engages with most from their own tutor interaction history (AiInteractionLog),
 * rather than relying only on the self-reported `learningPreferences.learningStyle`
 * field (StudentUser) collected once at onboarding. Detected style is compared
 * against the self-report to flag agreement/mismatch — a useful signal on its
 * own (a student who says "visual" but never touches Visual Explain / Mind Map
 * modes may not know their own preference, or the modes may not be discoverable
 * enough).
 */

// Buckets tutor modes into the same 4 categories StudentUser.learningPreferences
// already uses, so detected behaviour can be compared directly to self-report.
const STYLE_MODE_MAP = {
  visual:       ['visual_explain', 'visual_quiz', 'diagram', 'mind_map'],
  reading:      ['notes', 'summarize', 'explain', 'real_world'],
  'hands-on':   ['quiz', 'flashcards', 'practice_basic', 'practice_intermediate', 'practice_advanced'],
  listening:    ['homework_help', 'explain_back', 'custom', 'code_help'],
};

const MODE_TO_STYLE = Object.entries(STYLE_MODE_MAP).reduce((acc, [style, modes]) => {
  modes.forEach((m) => { acc[m] = style; });
  return acc;
}, {});

const MIN_SAMPLE_SIZE = 5;

async function detectStudentLearningStyle({ schoolId, studentId, sinceDays = 60 }) {
  const AiInteractionLog = require('../models/AiInteractionLog');
  const StudentUser = require('../models/StudentUser');
  const since = new Date(Date.now() - sinceDays * 86400000);

  const [logs, student] = await Promise.all([
    AiInteractionLog.find({
      schoolId, userId: studentId, feature: 'tutor_generate', status: 'success', createdAt: { $gte: since },
    }).select('mode').lean(),
    StudentUser.findOne({ _id: studentId, schoolId }).select('learningPreferences.learningStyle').lean(),
  ]);

  const counts = { visual: 0, reading: 0, 'hands-on': 0, listening: 0 };
  for (const log of logs) {
    const style = MODE_TO_STYLE[log.mode];
    if (style) counts[style] += 1;
  }
  const totalClassified = Object.values(counts).reduce((a, b) => a + b, 0);
  const selfReported = student?.learningPreferences?.learningStyle || '';

  if (totalClassified < MIN_SAMPLE_SIZE) {
    return {
      detectedStyle: null, confidence: null, counts, totalClassified, sampleSize: logs.length,
      selfReported, agreesWithSelfReport: null, dataStatus: 'insufficient_sample',
    };
  }

  const [detectedStyle, topCount] = Object.entries(counts).sort((a, b) => b[1] - a[1])[0];
  const confidence = Math.round((topCount / totalClassified) * 100);

  return {
    detectedStyle, confidence, counts, totalClassified, sampleSize: logs.length,
    selfReported,
    agreesWithSelfReport: selfReported ? selfReported === detectedStyle : null,
    dataStatus: 'available',
  };
}

// Teacher-facing view: distribution of detected learning styles across a
// class, so a teacher can gauge how to balance content formats (e.g. mostly
// hands-on/quiz-driven students vs. a strong visual-learner cluster).
async function getClassLearningStyleSummary({ schoolId, studentIds, sinceDays = 60 }) {
  const results = await Promise.allSettled(
    studentIds.map(async (studentId) => ({
      studentId,
      ...(await detectStudentLearningStyle({ schoolId, studentId, sinceDays })),
    }))
  );
  const rows = results.filter((r) => r.status === 'fulfilled').map((r) => r.value);
  const distribution = { visual: 0, reading: 0, 'hands-on': 0, listening: 0, insufficient_data: 0 };
  for (const row of rows) {
    if (row.dataStatus === 'available') distribution[row.detectedStyle] += 1;
    else distribution.insufficient_data += 1;
  }
  return { distribution, students: rows };
}

module.exports = {
  STYLE_MODE_MAP,
  MODE_TO_STYLE,
  detectStudentLearningStyle,
  getClassLearningStyleSummary,
};
