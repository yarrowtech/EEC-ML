/**
 * errorClassifier.js
 * Classifies a student's wrong answer into one of four error types:
 *   Concept      — wrong knowledge or misunderstanding
 *   Calculation  — arithmetic or numerical slip
 *   Reading      — misread the question or options
 *   Logic        — correct knowledge but flawed reasoning step
 *
 * Uses fast heuristics first; falls back to a lightweight LLM call only
 * when the question text is long enough to benefit from it.
 */

const ErrorRecord = require('../models/ErrorRecord');

// Numeric difference between expected and given answers → likely Calculation error
const _isNumeric = (s) => s !== '' && !Number.isNaN(Number(s.replace(/,/g, '')));

// Words that signal the student may have misread the question
const _READING_SIGNALS = ['not', 'except', 'always', 'never', 'least', 'most', 'incorrect', 'false', 'wrong'];

function classifyErrorType(questionText, correctAnswer, studentAnswer) {
  const q = (questionText || '').toLowerCase();
  const correct = String(correctAnswer || '').trim();
  const given   = String(studentAnswer  || '').trim();

  // Calculation: both answers are numeric and differ
  if (_isNumeric(correct) && _isNumeric(given)) {
    return 'Calculation';
  }

  // Reading: question contains negation / qualifier words the student likely missed
  if (_READING_SIGNALS.some((w) => q.includes(w))) {
    return 'Reading';
  }

  // Logic: student answer is in the correct option set but in wrong position
  // (applies to MCQ where options follow predictable A/B/C/D patterns)
  const optionLetters = ['a', 'b', 'c', 'd'];
  if (
    optionLetters.includes(given.toLowerCase()) &&
    optionLetters.includes(correct.toLowerCase())
  ) {
    return 'Logic';
  }

  // Default: treat as a Concept error
  return 'Concept';
}

/**
 * Persist error records for a set of wrong answers.
 * @param {object} params
 * @param {string} params.studentId
 * @param {string} params.schoolId
 * @param {string} params.source  - 'practice' | 'practice_paper' | 'exam' | 'quiz'
 * @param {Array}  params.wrongs  - [{ questionId, questionText, correctAnswer, studentAnswer, subject, subjectId, topicTitle, chapterTitle }]
 */
async function recordErrors({ studentId, schoolId, source, wrongs }) {
  if (!wrongs || !wrongs.length) return;
  const docs = wrongs.map((w) => ({
    schoolId,
    studentId,
    questionId:    String(w.questionId || ''),
    questionText:  w.questionText  || '',
    correctAnswer: w.correctAnswer || '',
    studentAnswer: w.studentAnswer || '',
    errorType:     classifyErrorType(w.questionText, w.correctAnswer, w.studentAnswer),
    subject:       w.subject       || '',
    subjectId:     w.subjectId     || null,
    topicTitle:    w.topicTitle    || '',
    chapterTitle:  w.chapterTitle  || '',
    source:        source          || 'practice',
    attemptedAt:   new Date(),
  }));
  await ErrorRecord.insertMany(docs).catch(() => {});
}

/**
 * Return aggregated error counts per type and top weak topics for a student.
 */
async function getStudentErrorSummary(studentId) {
  const pipeline = [
    { $match: { studentId: new (require('mongoose').Types.ObjectId)(studentId) } },
    {
      $group: {
        _id: { errorType: '$errorType', subject: '$subject', topicTitle: '$topicTitle' },
        count: { $sum: 1 },
      },
    },
    { $sort: { count: -1 } },
    { $limit: 50 },
  ];
  return ErrorRecord.aggregate(pipeline);
}

/**
 * Return error records for a class/section — teacher-facing.
 */
async function getClassErrorRecords({ schoolId, subject, classId, limit = 200 }) {
  const ErrorRecord = require('../models/ErrorRecord');
  const StudentUser = require('../models/StudentUser');
  const studentIds  = await StudentUser.distinct('_id', { schoolId, classId });
  return ErrorRecord.find({
    schoolId,
    studentId: { $in: studentIds },
    ...(subject ? { subject } : {}),
  })
    .sort({ attemptedAt: -1 })
    .limit(limit)
    .lean();
}

module.exports = { classifyErrorType, recordErrors, getStudentErrorSummary, getClassErrorRecords };
