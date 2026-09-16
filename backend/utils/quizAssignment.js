// Quiz assignments: teacher-built sections of typed questions, a student-safe
// view (no answer keys), and auto-grading of the objective question types.
// Short-answer questions are left for the teacher to mark.

const QUESTION_TYPES = ['mcq_single', 'mcq_multiple', 'fill_blank', 'true_false', 'short_answer'];
const TYPE_LABELS = {
  mcq_single: 'MCQ (single answer)',
  mcq_multiple: 'MCQ (multiple answers)',
  fill_blank: 'Fill in the blanks',
  true_false: 'True / False',
  short_answer: 'Short answer',
};
const MAX_SECTIONS = 20;
const MAX_QUESTIONS_PER_SECTION = 100;
const MAX_OPTIONS = 8;

const quizError = (message) => Object.assign(new Error(message), { statusCode: 400 });
const text = (v, max = 2000) => String(v ?? '').trim().slice(0, max);
const positive = (v, fallback) => {
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : fallback;
};
const normalizeBlank = (v) => String(v ?? '').trim().toLowerCase().replace(/\s+/g, ' ');

// Validates and cleans the teacher's quiz payload. Returns { sections, totalMarks }.
function normalizeQuizSections(input) {
  if (!Array.isArray(input) || !input.length) throw quizError('Add at least one quiz section');
  if (input.length > MAX_SECTIONS) throw quizError(`A quiz can have at most ${MAX_SECTIONS} sections`);

  let totalMarks = 0;
  const sections = input.map((section, sIdx) => {
    const type = QUESTION_TYPES.includes(section?.type) ? section.type : null;
    if (!type) throw quizError(`Section ${sIdx + 1}: choose a valid question type`);
    const questions = Array.isArray(section?.questions) ? section.questions : [];
    if (!questions.length) throw quizError(`Section ${sIdx + 1}: add at least one question`);
    if (questions.length > MAX_QUESTIONS_PER_SECTION) throw quizError(`Section ${sIdx + 1}: too many questions`);
    const defaultMarks = positive(section?.marksPerQuestion, 1);

    const cleanQuestions = questions.map((q, qIdx) => {
      const where = `Section ${sIdx + 1}, Q${qIdx + 1}`;
      const questionText = text(q?.text);
      if (!questionText) throw quizError(`${where}: question text is required`);
      const marks = positive(q?.marks, defaultMarks);
      const out = {
        ...(q?._id ? { _id: q._id } : {}),
        text: questionText,
        marks,
        options: [],
        correctOptions: [],
        correctBool: null,
        acceptableAnswers: [],
        modelAnswer: '',
      };

      if (type === 'mcq_single' || type === 'mcq_multiple') {
        const options = (Array.isArray(q?.options) ? q.options : []).map((o) => text(o, 500)).filter(Boolean);
        if (options.length < 2) throw quizError(`${where}: add at least two options`);
        if (options.length > MAX_OPTIONS) throw quizError(`${where}: at most ${MAX_OPTIONS} options`);
        const correct = [...new Set((Array.isArray(q?.correctOptions) ? q.correctOptions : [])
          .map(Number).filter((i) => Number.isInteger(i) && i >= 0 && i < options.length))].sort((a, b) => a - b);
        if (!correct.length) throw quizError(`${where}: mark the correct option`);
        if (type === 'mcq_single' && correct.length !== 1) throw quizError(`${where}: single-answer MCQ needs exactly one correct option`);
        out.options = options;
        out.correctOptions = correct;
      } else if (type === 'true_false') {
        if (typeof q?.correctBool !== 'boolean') throw quizError(`${where}: choose True or False as the answer`);
        out.correctBool = q.correctBool;
      } else if (type === 'fill_blank') {
        const answers = (Array.isArray(q?.acceptableAnswers) ? q.acceptableAnswers : String(q?.acceptableAnswers || '').split('|'))
          .map((a) => text(a, 200)).filter(Boolean);
        if (!answers.length) throw quizError(`${where}: add the correct answer for the blank`);
        out.acceptableAnswers = answers.slice(0, 10);
      } else {
        out.modelAnswer = text(q?.modelAnswer, 2000);
      }

      totalMarks += marks;
      return out;
    });

    return {
      ...(section?._id ? { _id: section._id } : {}),
      title: text(section?.title, 200) || TYPE_LABELS[type],
      instructions: text(section?.instructions, 500),
      type,
      marksPerQuestion: defaultMarks,
      questions: cleanQuestions,
    };
  });

  return { sections, totalMarks: Math.round(totalMarks * 100) / 100 };
}

// Strips answer keys so the quiz can be sent to students.
function sanitizeQuizForStudent(sections = []) {
  return sections.map((s) => ({
    _id: s._id,
    title: s.title,
    instructions: s.instructions || '',
    type: s.type,
    questions: (s.questions || []).map((q) => ({
      _id: q._id,
      text: q.text,
      marks: q.marks,
      options: s.type === 'mcq_single' || s.type === 'mcq_multiple' ? q.options : [],
    })),
  }));
}

const describeAnswer = (type, question, answer) => {
  if (answer === undefined || answer === null || answer === '' || (Array.isArray(answer) && !answer.length)) return '(no answer)';
  if (type === 'mcq_single') return question.options[Number(answer)] ?? '(invalid)';
  if (type === 'mcq_multiple') return (Array.isArray(answer) ? answer : []).map((i) => question.options[Number(i)]).filter(Boolean).join(', ');
  if (type === 'true_false') return answer === true || answer === 'true' ? 'True' : 'False';
  return String(answer);
};

const describeCorrect = (type, q) => {
  if (type === 'mcq_single' || type === 'mcq_multiple') return q.correctOptions.map((i) => q.options[i]).join(', ');
  if (type === 'true_false') return q.correctBool ? 'True' : 'False';
  if (type === 'fill_blank') return q.acceptableAnswers.join(' / ');
  return q.modelAnswer || '';
};

// answers: { [questionId]: value }. Returns the auto-score and a per-question
// breakdown; short answers have `correct: null` and count towards pendingMarks.
function gradeQuiz(sections = [], rawAnswers = {}) {
  const answers = rawAnswers && typeof rawAnswers === 'object' ? rawAnswers : {};
  let autoScore = 0;
  let objectiveMarks = 0;
  let pendingMarks = 0;
  const breakdown = [];
  const cleanAnswers = {};

  sections.forEach((section) => {
    (section.questions || []).forEach((q) => {
      const id = String(q._id);
      const raw = answers[id];
      let value = null;
      let correct = null;

      if (section.type === 'mcq_single') {
        const i = Number(raw);
        value = raw === '' || raw === null || raw === undefined || !Number.isInteger(i) ? null : i;
        correct = value !== null && q.correctOptions.length === 1 && q.correctOptions[0] === value;
      } else if (section.type === 'mcq_multiple') {
        value = [...new Set((Array.isArray(raw) ? raw : []).map(Number).filter(Number.isInteger))].sort((a, b) => a - b);
        correct = value.length > 0 && value.length === q.correctOptions.length && value.every((v, i) => v === q.correctOptions[i]);
      } else if (section.type === 'true_false') {
        value = raw === true || raw === 'true' ? true : raw === false || raw === 'false' ? false : null;
        correct = value !== null && value === q.correctBool;
      } else if (section.type === 'fill_blank') {
        value = text(raw, 200);
        correct = Boolean(value) && q.acceptableAnswers.some((a) => normalizeBlank(a) === normalizeBlank(value));
      } else {
        value = text(raw, 3000);
      }

      cleanAnswers[id] = value;
      const isManual = section.type === 'short_answer';
      const earned = isManual ? null : correct ? q.marks : 0;
      if (isManual) pendingMarks += q.marks;
      else { objectiveMarks += q.marks; autoScore += earned; }

      breakdown.push({
        questionId: id,
        sectionTitle: section.title,
        type: section.type,
        question: q.text,
        studentAnswer: describeAnswer(section.type, q, value),
        correctAnswer: describeCorrect(section.type, q),
        correct: isManual ? null : correct,
        marks: q.marks,
        earned,
      });
    });
  });

  const round = (n) => Math.round(n * 100) / 100;
  return { answers: cleanAnswers, autoScore: round(autoScore), objectiveMarks: round(objectiveMarks), pendingMarks: round(pendingMarks), breakdown };
}

// Plain-text answer sheet stored as submissionText so the existing teacher
// evaluation screen can show the quiz answers without a separate renderer.
function formatAnswerSheet(result) {
  const lines = [];
  let currentSection = null;
  let n = 0;
  result.breakdown.forEach((row) => {
    if (row.sectionTitle !== currentSection) {
      currentSection = row.sectionTitle;
      n = 0;
      lines.push('', `== ${row.sectionTitle} ==`);
    }
    n += 1;
    const mark = row.correct === null ? `[needs review, ${row.marks} mark${row.marks === 1 ? '' : 's'}]` : row.correct ? `[correct +${row.earned}]` : `[wrong 0/${row.marks}]`;
    lines.push(`${n}. ${row.question}`, `   Answer: ${row.studentAnswer} ${mark}`);
    if (row.correct === false) lines.push(`   Correct: ${row.correctAnswer}`);
    if (row.correct === null && row.correctAnswer) lines.push(`   Model answer: ${row.correctAnswer}`);
  });
  lines.unshift(`Auto-graded: ${result.autoScore}/${result.objectiveMarks}${result.pendingMarks ? ` · ${result.pendingMarks} marks of short answers need review` : ''}`);
  return lines.join('\n').trim();
}

module.exports = { QUESTION_TYPES, normalizeQuizSections, sanitizeQuizForStudent, gradeQuiz, formatAnswerSheet };
