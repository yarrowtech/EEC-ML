const express = require('express');
const router = express.Router();
const axios = require('axios');
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const ExamResult = require('../models/ExamResult');
const MasteryScore = require('../models/MasteryScore');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const {
  buildTeacherAllocationScope,
  scopeAllowsRequest,
  studentIsWithinTeacherScope,
  teacherHasClassAllocation,
} = require('../utils/teacherAllocationScope');

// ── Scope guards ──────────────────────────────────────────────────────────────
// These AI endpoints accept class/section/student identifiers straight from
// the request body and use them to pull real student data into LLM prompts.
// Without a server-side check, any authenticated teacher could request a
// report/summary for a class or student they aren't allocated to. Every
// handler that reads class/section/student data validates against the
// teacher's own TeacherAllocation records first.
const requireClassNameScope = async (req, res, { className, section, subject } = {}) => {
  const schoolId = req.schoolId;
  const teacherId = req.user?.id || req.teacher?.id;
  if (!schoolId || !teacherId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const scope = await buildTeacherAllocationScope({ schoolId, campusId: req.campusId || null, teacherId });
  if (className || section) {
    if (!scope.length || !scopeAllowsRequest(scope, { grade: className, section, subject })) {
      res.status(403).json({ error: 'You are not allocated to this class/section' });
      return null;
    }
  }
  return scope;
};

const requireClassIdScope = async (req, res, { classId, sectionId, subjectId } = {}) => {
  const schoolId = req.schoolId;
  const teacherId = req.user?.id || req.teacher?.id;
  if (!schoolId || !teacherId) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  if (!classId) return true;
  const allowed = await teacherHasClassAllocation({
    schoolId, campusId: req.campusId || null, teacherId, classId, sectionId, subjectId,
  });
  if (!allowed) {
    res.status(403).json({ error: 'You are not allocated to this class' });
    return false;
  }
  return true;
};

const requireStudentScope = async (req, res, studentId) => {
  const schoolId = req.schoolId;
  const teacherId = req.user?.id || req.teacher?.id;
  if (!schoolId || !teacherId) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }
  const student = await StudentUser.findOne({ _id: studentId, schoolId }).select('name grade section attendance').lean();
  if (!student) {
    res.status(404).json({ error: 'Student not found' });
    return null;
  }
  const scope = await buildTeacherAllocationScope({ schoolId, campusId: req.campusId || null, teacherId });
  if (!scope.length || !studentIsWithinTeacherScope(student, scope)) {
    res.status(403).json({ error: 'You are not allocated to this student\'s class' });
    return null;
  }
  return student;
};

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT = 120_000;

const callTeacherAI = (mode, subject, topic, gradeLevel, context, question) =>
  axios.post(
    `${AI_SERVICE_URL}/generate/teacher`,
    { mode, subject, topic, gradeLevel: gradeLevel || null, context: context || null, question: question || null },
    { timeout: TIMEOUT }
  );

const callTeacherRagAI = (payload) =>
  axios.post(
    `${AI_SERVICE_URL}/generate/tutor`,
    payload,
    { timeout: TIMEOUT }
  );

const extractJsonObject = (value) => {
  const text = String(value || '').trim();
  const start = text.indexOf('{');
  const end = text.lastIndexOf('}');
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch (_) {
    return null;
  }
};

const extractJsonArray = (value) => {
  const text = String(value || '').replace(/```(?:json)?/gi, '').trim();
  const start = text.indexOf('[');
  if (start === -1) return null;
  let depth = 0;
  let insideString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (insideString) {
      if (escaped) escaped = false;
      else if (character === '\\') escaped = true;
      else if (character === '"') insideString = false;
      continue;
    }
    if (character === '"') insideString = true;
    else if (character === '[') depth += 1;
    else if (character === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return null;
};

const cleanOptionText = (value) => String(value || '')
  .replace(/^\s*\(?[A-D]\)?[.):\-]\s*/i, '')
  .trim();

const normalizeMcqQuestion = (item) => {
  if (!item || typeof item !== 'object') return null;
  const questionText = String(item.questionText || item.question || item.stem || item.text || '').trim();
  const rawOptions = Array.isArray(item.options) ? item.options : [];
  const options = rawOptions.slice(0, 4).map((option) => ({
    text: cleanOptionText(typeof option === 'string' ? option : option?.text || option?.choice || option?.label),
    isCorrect: Boolean(option && typeof option === 'object'
      && (option.isCorrect === true || option.correct === true || option.is_answer === true)),
  })).filter((option) => option.text);
  if (!questionText || options.length !== 4 || new Set(options.map((option) => option.text.toLowerCase())).size !== 4) {
    return null;
  }

  let correctIndex = options.findIndex((option) => option.isCorrect);
  const explicitIndex = Number(item.correctAnswerIndex ?? item.answerIndex);
  if (correctIndex < 0 && Number.isInteger(explicitIndex) && explicitIndex >= 0 && explicitIndex < options.length) {
    correctIndex = explicitIndex;
  }
  const explicitAnswer = String(item.correctAnswer ?? item.answer ?? item.correctOption ?? '').trim();
  if (correctIndex < 0 && /^[A-D]$/i.test(explicitAnswer)) {
    correctIndex = explicitAnswer.toUpperCase().charCodeAt(0) - 65;
  }
  if (correctIndex < 0 && explicitAnswer) {
    const cleanedAnswer = cleanOptionText(explicitAnswer).toLowerCase();
    correctIndex = options.findIndex((option) => option.text.toLowerCase() === cleanedAnswer);
  }
  if (correctIndex < 0 || correctIndex >= options.length) return null;

  return {
    questionText,
    options: options.map((option, index) => ({ ...option, isCorrect: index === correctIndex })),
    correctAnswer: options[correctIndex].text,
    explanation: String(item.explanation || item.reason || item.rationale || '').trim(),
    difficulty: String(item.difficulty || '').trim(),
  };
};

const parsePlainMcqQuestions = (value) => {
  const text = String(value || '').replace(/```(?:json)?/gi, '').trim();
  const blocks = text.split(/\n(?=\s*(?:Question\s*)?\d+\s*[.):\-]\s*)/i).filter(Boolean);
  return blocks.map((block) => {
    const lines = block.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const questionLineIndex = lines.findIndex((line) => /^(?:Question\s*)?\d+\s*[.):\-]\s*/i.test(line));
    if (questionLineIndex < 0) return null;
    const questionText = lines[questionLineIndex]
      .replace(/^(?:Question\s*)?\d+\s*[.):\-]\s*/i, '')
      .trim();
    const options = [];
    let answer = '';
    let explanation = '';
    lines.slice(questionLineIndex + 1).forEach((line) => {
      const optionMatch = line.match(/^\(?([A-D])\)?[.):\-]\s*(.+)$/i);
      if (optionMatch) {
        options.push({ text: optionMatch[2].trim(), isCorrect: false });
        return;
      }
      const answerMatch = line.match(/^(?:Correct\s+Answer|Answer|Key)\s*[:\-]\s*(.+)$/i);
      if (answerMatch) {
        answer = answerMatch[1].trim();
        return;
      }
      const explanationMatch = line.match(/^(?:Explanation|Reason|Why)\s*[:\-]\s*(.+)$/i);
      if (explanationMatch) explanation = explanationMatch[1].trim();
    });
    return normalizeMcqQuestion({ questionText, options, correctAnswer: answer, explanation });
  }).filter(Boolean);
};

const parseQuizQuestions = (raw, requestedType = 'mcq') => {
  const cleaned = String(raw || '').replace(/```(?:json)?/gi, '').trim();
  let parsed = null;
  try {
    parsed = JSON.parse(cleaned);
  } catch (_) {
    const arrayText = extractJsonArray(cleaned);
    if (arrayText) {
      try { parsed = JSON.parse(arrayText); } catch (_) { parsed = null; }
    }
  }
  const items = Array.isArray(parsed)
    ? parsed
    : Array.isArray(parsed?.questions) ? parsed.questions : Array.isArray(parsed?.items) ? parsed.items : [];
  if (requestedType !== 'mcq') return items;
  const normalized = items.map(normalizeMcqQuestion).filter(Boolean);
  return normalized.length ? normalized : parsePlainMcqQuestions(cleaned);
};

// ── POST /api/ai-teacher/ingest-file ─────────────────────────────────────────
// Immediately ingest an uploaded Cloudinary file into the AI vector store so
// AI features (quiz, content, tryout) in subsequent lesson-plan steps can use it.
router.post('/ingest-file', authTeacher, async (req, res) => {
  try {
    const { url, fileName, classId, sectionId, subjectId, subjectName, chapterTitle, cloudinaryPublicId } = req.body || {};
    if (!url) return res.status(400).json({ error: 'url is required' });
    if (!classId || !sectionId || !subjectId || !subjectName) {
      return res.status(400).json({ error: 'classId, sectionId, subjectId, and subjectName are required for AI indexing' });
    }
    if (!(await requireClassIdScope(req, res, { classId, sectionId, subjectId }))) return;

    const schoolId = String(req.schoolId || '');
    const classDoc = await ClassModel.findOne({ _id: classId, schoolId }).select('academicYearId').lean();
    if (!classDoc) return res.status(400).json({ error: 'Selected class was not found for this school' });
    // Use the Cloudinary public ID as a stable vector namespace; fall back to the URL
    const materialId = cloudinaryPublicId || url;

    const response = await axios.post(
      `${AI_SERVICE_URL}/ingest/material`,
      {
        url,
        material_id: materialId,
        source_id: materialId,
        file_name: fileName || '',
        content_type: '',
        replace_existing: true,
        school_id: schoolId,
        class_id: String(classId || ''),
        section_id: String(sectionId || ''),
        academic_year_id: String(classDoc.academicYearId || ''),
        subject_id: String(subjectId),
        subject_name: subjectName || '',
        chapter_title: chapterTitle || '',
        topic_title: chapterTitle || '',
      },
      { timeout: 300_000 }
    );

    return res.json({ success: true, data: response.data });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/lesson-content ──────────────────────────────────────
// Uses the RAG pipeline so the introduction is grounded in the teacher's
// uploaded materials (ingested into Qdrant on the Materials step).
router.post('/lesson-content', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel, chapterTitle, classId, sectionId, subjectId } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    if (!(await requireClassIdScope(req, res, { classId, sectionId, subjectId }))) return;

    const payload = {
      mode: 'summarize',
      subject,
      topic,
      gradeLevel: gradeLevel || null,
      question: 'Write a short 2–3 sentence lesson introduction for this topic. It should be a punchy hook that grabs student attention and states what they will learn. No headings, no bullet points, no long explanations — just one tight introductory paragraph.',
      candidates: [],
      schoolId: String(req.schoolId),
      classId: classId ? String(classId) : null,
      sectionId: sectionId ? String(sectionId) : null,
      subjectId: subjectId ? String(subjectId) : null,
      chapterTitle: chapterTitle || topic,
      subTopic: null,
      difficulty: null,
      studentContext: null,
      conversationHistory: null,
    };

    const aiRes = await callTeacherRagAI(payload);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/hinge-questions ──────────────────────────────────────
router.post('/hinge-questions', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    const aiRes = await callTeacherAI('hinge_question', subject, topic, gradeLevel);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/class-summary ────────────────────────────────────────
router.post('/class-summary', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { className, section, subject } = req.body || {};
    if (!(await requireClassNameScope(req, res, { className, section, subject }))) return;

    const filter = { schoolId };
    if (className) filter.$or = [{ grade: className }, { grade: `Class ${className}` }];
    if (section) filter.section = section;

    const students = await StudentUser.find(filter).select('_id name grade section attendance').lean();
    const studentIds = students.map((s) => s._id);

    const results = await ExamResult.find({
      schoolId, studentId: { $in: studentIds }, published: true,
      ...(subject ? { subject: { $regex: subject, $options: 'i' } } : {}),
    })
      .populate('examId', 'subject marks date')
      .sort({ createdAt: -1 })
      .limit(500)
      .lean();

    // Compute class averages
    const totalStudents = students.length;
    const attPcts = students.map((s) => {
      const att = s.attendance || [];
      return att.length > 0 ? Math.round((att.filter((a) => a.status === 'present').length / att.length) * 100) : 100;
    });
    const avgAtt = attPcts.length ? Math.round(attPcts.reduce((a, b) => a + b, 0) / attPcts.length) : 0;
    const below75 = attPcts.filter((p) => p < 75).length;

    const subjectScores = {};
    results.forEach((r) => {
      const sub = r.examId?.subject || 'General';
      const max = r.examId?.marks || 100;
      const pct = Math.round((r.marks / max) * 100);
      if (!subjectScores[sub]) subjectScores[sub] = [];
      subjectScores[sub].push(pct);
    });
    const subjectAvgs = Object.entries(subjectScores).map(([sub, scores]) => ({
      subject: sub,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      count: scores.length,
    })).sort((a, b) => a.avg - b.avg);

    const context = [
      `Class: ${className || 'All'} | Section: ${section || 'All'} | Total Students: ${totalStudents}`,
      `Attendance: Avg ${avgAtt}% | Students below 75%: ${below75}`,
      `Subject Performance (avg %):`,
      ...subjectAvgs.map((s) => `  - ${s.subject}: ${s.avg}% (${s.count} results)`),
    ].join('\n');

    const aiRes = await callTeacherAI(
      'class_performance_summary',
      subject || 'All Subjects',
      `${className || 'Class'} ${section || ''} Performance Summary`,
      null,
      context
    );
    return res.json({
      success: true,
      data: {
        content: aiRes.data?.content || '',
        stats: { totalStudents, avgAtt, below75, subjectAvgs },
      },
    });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/parent-report ────────────────────────────────────────
router.post('/parent-report', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId, studentName, grade, section, subject } = req.body || {};
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });
    const student = await requireStudentScope(req, res, studentId);
    if (!student) return;

    const results = await ExamResult.find({
      schoolId, studentId, published: true,
      ...(subject ? { subject: { $regex: subject, $options: 'i' } } : {}),
    })
      .populate('examId', 'subject marks date')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const att = student?.attendance || [];
    const attPct = att.length > 0 ? Math.round((att.filter((a) => a.status === 'present').length / att.length) * 100) : 100;

    const subjectMap = {};
    results.forEach((r) => {
      const sub = r.examId?.subject || 'General';
      const max = r.examId?.marks || 100;
      const pct = Math.round((r.marks / max) * 100);
      if (!subjectMap[sub]) subjectMap[sub] = [];
      subjectMap[sub].push(pct);
    });
    const subjectSummary = Object.entries(subjectMap)
      .map(([sub, scores]) => `${sub}: ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}%`)
      .join(', ');

    const context = [
      `Student: ${studentName || student?.name || 'Student'} | Grade: ${grade || student?.grade} | Section: ${section || student?.section}`,
      `Attendance: ${attPct}%`,
      `Subject Performance (recent exams): ${subjectSummary || 'No exam results yet'}`,
    ].join('\n');

    const aiRes = await callTeacherAI(
      'parent_report',
      subject || 'All Subjects',
      `${studentName || student?.name || 'Student'} Progress Report`,
      grade || student?.grade ? `Grade ${grade || student?.grade}` : null,
      context
    );
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/exit-ticket-grade ────────────────────────────────────
router.post('/exit-ticket-grade', authTeacher, async (req, res) => {
  try {
    const { question, studentResponse, subject, topic, gradeLevel } = req.body || {};
    if (!question || !studentResponse) {
      return res.status(400).json({ error: 'question and studentResponse are required' });
    }
    const context = `Exit Ticket Question:\n${question}\n\nStudent's Response:\n${studentResponse}`;
    const aiRes = await callTeacherAI('exit_ticket_grade', subject || 'General', topic || 'Topic', gradeLevel, context);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/differentiated-content ───────────────────────────────
router.post('/differentiated-content', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    const aiRes = await callTeacherAI('differentiated_plan', subject, topic, gradeLevel, null, null);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/generate-content ─────────────────────────────────────
// Single RAG call that returns all Content-step fields in one shot:
// objectives, instructional flow (HOOK/I DO/WE DO/YOU DO), explanation, recap.
router.post('/generate-content', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel, classId, sectionId, subjectId, chapterTitle } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    if (!(await requireClassIdScope(req, res, { classId, sectionId, subjectId }))) return;

    const payload = {
      mode: 'explain',
      subject,
      topic,
      gradeLevel: gradeLevel || null,
      question: [
        'Using ONLY the uploaded material, output the following sections with these exact headers. No extra text outside these sections.',
        '',
        'OBJECTIVES:',
        '- [learning objective 1]',
        '- [learning objective 2]',
        '- [learning objective 3]',
        '',
        'HOOK: [one sentence engaging opener from the material]',
        'I DO: [one sentence — teacher demonstrates a concept from the material]',
        'WE DO: [one sentence — guided practice with students using the material]',
        'YOU DO: [one sentence — independent student practice from the material]',
        '',
        'EXPLANATION:',
        '1. [step one — one sentence]',
        '2. [step two — one sentence]',
        '3. [step three — one sentence]',
        '',
        'RECAP:',
        '- [key takeaway 1]',
        '- [key takeaway 2]',
        '- [key takeaway 3]',
      ].join('\n'),
      candidates: [],
      schoolId: String(req.schoolId),
      classId: classId ? String(classId) : null,
      sectionId: sectionId ? String(sectionId) : null,
      subjectId: subjectId ? String(subjectId) : null,
      chapterTitle: chapterTitle || topic,
      subTopic: null,
      difficulty: null,
      studentContext: null,
      conversationHistory: null,
    };

    const aiRes = await callTeacherRagAI(payload);
    if (aiRes.data?.noMaterialFound || !aiRes.data?.groundedInMaterial) {
      return res.status(404).json({
        error: 'No indexed material matched this class, section, subject, and chapter. Re-index the chapter material and try again.',
      });
    }
    const raw = (aiRes.data?.content || '').trim();

    // ── Parse OBJECTIVES ──────────────────────────────────────────────────────
    const sectionBetween = (text, startHeader, endHeaders) => {
      const si = text.search(new RegExp(startHeader, 'i'));
      if (si === -1) return '';
      let chunk = text.slice(si).replace(new RegExp(startHeader, 'i'), '').trim();
      for (const eh of endHeaders) {
        const ei = chunk.search(new RegExp(eh, 'i'));
        if (ei !== -1) chunk = chunk.slice(0, ei);
      }
      return chunk.trim();
    };

    const objectives = sectionBetween(raw, 'OBJECTIVES:', ['HOOK:', 'I DO:', 'EXPLANATION:', 'RECAP:'])
      .split('\n')
      .map((l) => l.replace(/^[-•*\d.]+\s*/, '').replace(/\*\*/g, '').trim())
      .filter((l) => l.length > 3);

    // ── Parse FLOW lines ──────────────────────────────────────────────────────
    const inlineLine = (text, key) => {
      const m = text.match(new RegExp(`\\b${key}:\\s*(.+)`, 'i'));
      return m ? m[1].replace(/\*\*/g, '').trim().slice(0, 120) : '';
    };
    const flow = {
      HOOK:    inlineLine(raw, 'HOOK'),
      'I DO':  inlineLine(raw, 'I DO'),
      'WE DO': inlineLine(raw, 'WE DO'),
      'YOU DO':inlineLine(raw, 'YOU DO'),
    };

    // ── Parse EXPLANATION ─────────────────────────────────────────────────────
    const explanation = sectionBetween(raw, 'EXPLANATION:', ['RECAP:'])
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 3)
      .join('\n');

    // ── Parse RECAP ───────────────────────────────────────────────────────────
    const recapLines = sectionBetween(raw, 'RECAP:', [])
      .split('\n')
      .map((l) => l.replace(/^[-•*\d.]+\s*/, '').replace(/\*\*/g, '').trim())
      .filter((l) => l.length > 3);
    const recap = recapLines.map((l) => `• ${l}`).join('\n');

    if (objectives.length === 0 && !explanation && !recap) {
      return res.status(502).json({ error: 'AI returned content in an unsupported format. Please try again.' });
    }

    return res.json({ success: true, data: { objectives, flow, explanation, recap, raw } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/assignment-draft ───────────────────────────────────
// Produces a structured, editable assignment grounded in the material indexed
// for the selected class, section, subject, and chapter.
const VALID_ACTIVITY_TYPES = ['Assignment', 'Worksheet', 'Essay', 'Quiz', 'Exam', 'Project', 'Homework'];

const ACTIVITY_TYPE_INSTRUCTIONS = {
  Worksheet: [
    'Create one structured WORKSHEET using ONLY the retrieved school material.',
    'A worksheet should contain a mix of short-answer questions, fill-in-the-blank exercises, and labelling or matching tasks — NOT open-ended essay questions.',
    'Number every question. Keep tasks concise so students can complete them on a single page.',
  ].join(' '),
  Quiz: [
    'Create one short QUIZ using ONLY the retrieved school material.',
    'A quiz should contain 5 to 10 focused questions: a mix of multiple-choice (with 4 options each) and short-answer questions.',
    'Number every question. Mark the correct answers in parentheses after each MCQ option.',
  ].join(' '),
  Exam: [
    'Create one comprehensive EXAM using ONLY the retrieved school material.',
    'The exam should contain sections: Section A (MCQ, 5 questions), Section B (short answer, 3 questions), Section C (long answer / problem-solving, 2 questions).',
    'Number every question. Indicate marks per question.',
  ].join(' '),
  Project: [
    'Create one PROJECT brief using ONLY the retrieved school material.',
    'The brief should describe the project goal, deliverables, step-by-step instructions, and evaluation criteria.',
    'Use numbered steps. Make the deliverables concrete and measurable.',
  ].join(' '),
  Homework: [
    'Create one HOMEWORK task using ONLY the retrieved school material.',
    'Homework should be completable in 20–30 minutes: a few focused practice questions or a short reading-response task.',
    'Number every question. Keep instructions clear and self-contained.',
  ].join(' '),
  Essay: [
    'Create one ESSAY writing task using ONLY the retrieved school material.',
    'Provide a clear writing prompt, word count target, and 3 to 5 grading rubric criteria (one per line).',
  ].join(' '),
  Assignment: [
    'Create one classroom ASSIGNMENT using ONLY the retrieved school material.',
    'The description must contain enough concrete questions or tasks for a student to complete independently.',
  ].join(' '),
};

router.post('/assignment-draft', authTeacher, async (req, res) => {
  try {
    const {
      subject, topic, chapterTitle, gradeLevel, classId, sectionId, subjectId,
      difficulty = 'Medium', activityType = 'Assignment', marks = 20,
    } = req.body || {};
    const schoolId = String(req.schoolId || '');
    const normalizedTopic = String(topic || chapterTitle || '').trim();
    const resolvedActivityType = VALID_ACTIVITY_TYPES.includes(activityType) ? activityType : 'Assignment';

    if (!schoolId) return res.status(401).json({ error: 'Unauthorized' });
    if (!subject || !classId || !sectionId) {
      return res.status(400).json({ error: 'classId, sectionId, and subject are required' });
    }
    if (!(await requireClassIdScope(req, res, { classId, sectionId, subjectId }))) return;

    const [classDoc, sectionDoc, subjectDoc] = await Promise.all([
      ClassModel.findOne({ _id: classId, schoolId }).select('name').lean(),
      Section.findOne({ _id: sectionId, classId, schoolId }).select('name').lean(),
      subjectId ? Subject.findOne({ _id: subjectId, schoolId }).select('name').lean() : Promise.resolve(null),
    ]);
    if (!classDoc || !sectionDoc) return res.status(404).json({ error: 'Selected class or section was not found' });
    if (subjectId && !subjectDoc) return res.status(404).json({ error: 'Selected subject was not found' });
    if (subjectDoc && String(subjectDoc.name || '').trim().toLowerCase() !== String(subject).trim().toLowerCase()) {
      return res.status(400).json({ error: 'Selected subject does not match subjectId' });
    }

    const requestedMarks = Math.min(500, Math.max(1, Number(marks) || 20));
    const topicLine = normalizedTopic ? `Topic / Chapter: ${normalizedTopic}.` : `Subject: ${subject}.`;
    const typeInstructions = ACTIVITY_TYPE_INSTRUCTIONS[resolvedActivityType] || ACTIVITY_TYPE_INSTRUCTIONS.Assignment;
    const isEssayType = resolvedActivityType === 'Essay';

    const question = [
      typeInstructions,
      'Return ONLY one valid JSON object with no markdown, no code fences, and no extra commentary.',
      'Use exactly these keys:',
      '{"title":"concise title","description":"full student-facing instructions and tasks","marks":20,"difficulty":"Medium","activityType":"Assignment","submissionFormat":"text","isEssay":false,"rubric":""}',
      `${topicLine} Target total marks: ${requestedMarks}. Requested difficulty: ${difficulty}. Set activityType to "${resolvedActivityType}" in the JSON.`,
      isEssayType
        ? 'Set isEssay to true and provide 3 to 5 newline-separated rubric criteria in the rubric field.'
        : 'Set isEssay to false and leave rubric as an empty string.',
    ].join('\n');

    const aiRes = await callTeacherRagAI({
      mode: 'custom',
      subject,
      topic: normalizedTopic || subject,
      gradeLevel: gradeLevel || classDoc.name || null,
      question,
      candidates: [],
      schoolId,
      classId: String(classId),
      sectionId: String(sectionId),
      subjectId: subjectId ? String(subjectId) : null,
      chapterTitle: chapterTitle || normalizedTopic || null,
      subTopic: null,
      difficulty: String(difficulty || 'Medium').toLowerCase(),
      studentContext: null,
      conversationHistory: null,
    });

    if (aiRes.data?.noMaterialFound || !aiRes.data?.groundedInMaterial) {
      return res.status(404).json({
        error: 'No indexed material found for this class, section, and subject. Upload or re-index the lesson material first, then try again.',
      });
    }

    const raw = String(aiRes.data?.content || '').trim();
    const parsed = extractJsonObject(raw);
    if (!parsed) return res.status(502).json({ error: 'AI returned an invalid format. Please try again.' });

    const normalizedDifficulty = ['Easy', 'Medium', 'Hard'].includes(parsed.difficulty)
      ? parsed.difficulty
      : ['Easy', 'Medium', 'Hard'].includes(difficulty) ? difficulty : 'Medium';
    const normalizedType = VALID_ACTIVITY_TYPES.includes(parsed.activityType)
      ? parsed.activityType
      : resolvedActivityType;
    const isEssay = normalizedType === 'Essay' || Boolean(parsed.isEssay);
    const draft = {
      title: String(parsed.title || `${subject}${normalizedTopic ? ': ' + normalizedTopic : ''}`).trim().slice(0, 180),
      description: String(parsed.description || '').trim().slice(0, 12000),
      marks: Math.min(500, Math.max(1, Number(parsed.marks) || requestedMarks)),
      difficulty: normalizedDifficulty,
      type: normalizedType,
      submissionFormat: parsed.submissionFormat === 'pdf' ? 'pdf' : 'text',
      isEssay,
      rubric: isEssay ? String(parsed.rubric || '').trim().slice(0, 4000) : '',
    };
    if (!draft.title || !draft.description) {
      return res.status(502).json({ error: 'AI response did not contain a usable title and description.' });
    }

    return res.json({
      success: true,
      data: {
        draft,
        groundedInMaterial: true,
        citations: Array.isArray(aiRes.data?.citations) ? aiRes.data.citations : [],
      },
    });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/idoweedo ─────────────────────────────────────────────
// Uses RAG so the I Do / We Do / You Do phases are grounded in the teacher's
// uploaded materials rather than generic knowledge.
router.post('/idoweedo', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel, totalMinutes, classId, sectionId, chapterTitle } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    if (!(await requireClassIdScope(req, res, { classId, sectionId }))) return;

    const minutes = totalMinutes || 60;
    const payload = {
      mode: 'notes',
      subject,
      topic,
      gradeLevel: gradeLevel || null,
      question: `Reply with ONLY these 4 lines and nothing else — no intro, no summary, no extra text:\nHOOK: <one sentence engaging opener drawn from the material>\nI DO: <one sentence where teacher demonstrates a concept from the material>\nWE DO: <one sentence of guided practice using the material>\nYOU DO: <one sentence of independent student practice from the material>\nEach line must be under 100 characters. Total lesson duration: ${minutes} minutes.`,
      candidates: [],
      schoolId: String(req.schoolId),
      classId: classId ? String(classId) : null,
      sectionId: sectionId ? String(sectionId) : null,
      chapterTitle: chapterTitle || topic,
      subTopic: null,
      difficulty: null,
      studentContext: null,
      conversationHistory: null,
    };

    const aiRes = await callTeacherRagAI(payload);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/quiz-generate ────────────────────────────────────────
router.post('/quiz-generate', authTeacher, async (req, res) => {
  try {
    const {
      subject, topic, gradeLevel, difficulty, count, questionType, chapterTitle, topicTitle,
      classId, sectionId, subjectId, academicYearId,
    } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    if (!(await requireClassIdScope(req, res, { classId, sectionId, subjectId }))) return;
    const chapter = chapterTitle || topicTitle || null;
    const requestedType = questionType || 'mcq';
    const safeCount = Math.min(20, Math.max(1, Number(count) || 5));
    const questionTypeText = requestedType === 'mcq'
      ? 'multiple-choice questions'
      : `questions in the ${requestedType} format`;
    const question = [
      difficulty ? `Difficulty level: ${difficulty}` : null,
      `Generate exactly ${safeCount} ${questionTypeText}.`,
      'Base all questions only on the uploaded course material for this topic.',
      requestedType === 'mcq'
        ? [
          'Return ONLY a valid JSON array with no markdown, heading, or commentary.',
          'Each array item must use this exact shape:',
          '{"questionText":"Question","options":[{"text":"Option 1","isCorrect":false},{"text":"Option 2","isCorrect":true},{"text":"Option 3","isCorrect":false},{"text":"Option 4","isCorrect":false}],"explanation":"Why the marked option is correct","difficulty":"medium"}',
          'Every question must have exactly four distinct, non-empty options and exactly one option with isCorrect set to true.',
          'Do not add A, B, C, or D prefixes inside option text.',
        ].join(' ')
        : `Create questions in the ${requestedType} format and return a valid JSON array with no markdown.`,
    ].filter(Boolean).join(' ');

    const payload = {
      mode: 'quiz',
      subject,
      topic,
      gradeLevel: gradeLevel || null,
      questionType: requestedType,
      question,
      candidates: [],
      schoolId: String(req.schoolId),
      classId: classId ? String(classId) : null,
      sectionId: sectionId ? String(sectionId) : null,
      academicYearId: academicYearId ? String(academicYearId) : null,
      subjectId: subjectId ? String(subjectId) : null,
      chapterTitle: chapter,
      subTopic: null,
      difficulty: difficulty || null,
      studentContext: null,
      conversationHistory: null,
    };

    const aiRes = await callTeacherRagAI(payload);
    const raw = (aiRes.data?.content || '').trim();
    if (aiRes.data?.noMaterialFound || !aiRes.data?.groundedInMaterial) {
      return res.status(404).json({
        error: 'No indexed material matched the selected class, section, subject, and topic.',
      });
    }
    const questions = parseQuizQuestions(raw, requestedType);
    if (!questions.length) {
      return res.status(502).json({
        error: requestedType === 'mcq'
          ? 'AI could not produce a complete MCQ with four options and one correct answer. Please try again.'
          : 'AI returned questions in an unsupported format. Please try again.',
      });
    }

    return res.json({
      success: true,
      data: {
        questions,
        raw,
        groundedInMaterial: aiRes.data?.groundedInMaterial || false,
        noMaterialFound: aiRes.data?.noMaterialFound || false,
        citations: Array.isArray(aiRes.data?.citations) ? aiRes.data.citations : [],
      },
    });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/misconception-report ─────────────────────────────────
router.post('/misconception-report', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel, wrongAnswerPatterns } = req.body || {};
    if (!wrongAnswerPatterns || !wrongAnswerPatterns.length) {
      return res.status(400).json({ error: 'wrongAnswerPatterns is required' });
    }
    const context = wrongAnswerPatterns
      .map((p) => `Topic: ${p.topic} | Wrong: "${p.wrongAnswer}" | Students: ${p.count} (${p.pct}%)`)
      .join('\n');
    const aiRes = await callTeacherAI('misconception_report', subject || 'General', topic || 'Multiple Topics', gradeLevel, context);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/curriculum-check ─────────────────────────────────────
router.post('/curriculum-check', authTeacher, async (req, res) => {
  try {
    const { subject, gradeLevel, curriculumStandard, lessonContent } = req.body || {};
    if (!curriculumStandard || !lessonContent) {
      return res.status(400).json({ error: 'curriculumStandard and lessonContent are required' });
    }
    const context = `CURRICULUM STANDARD / OBJECTIVE:\n${curriculumStandard}\n\nLESSON CONTENT TO CHECK:\n${lessonContent.slice(0, 3000)}`;
    const aiRes = await callTeacherAI('curriculum_alignment', subject || 'General', 'Curriculum Alignment Check', gradeLevel, context);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/generate-lesson-package ─────────────────────────────
// One-click orchestrator: gap analysis + all AI content in parallel.
// Body: { subject, topic, chapterTitle, gradeLevel, classId, sectionId }
// Returns: { gapAnalysis, lessonContent, differentiatedPlan, hingeQuestion,
//            exitQuizQuestions, misconceptions, learningPathNodes, rawOutputs }
router.post('/generate-lesson-package', authTeacher, async (req, res) => {
  try {
    const schoolId  = req.schoolId;
    const teacherId = req.user?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const { subject, topic, chapterTitle, gradeLevel, classId, sectionId } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    if (!(await requireClassIdScope(req, res, { classId, sectionId }))) return;

    const fullTopic = [chapterTitle, topic].filter(Boolean).join(' — ');

    // ── 1. Gap analysis from real student data ────────────────────────────────
    let gapAnalysis = { averageMastery: null, weakStudentCount: 0, topWeaknesses: [], tierBreakdown: { foundation: 0, core: 0, extension: 0 } };
    try {
      const filter = { schoolId, subject };
      if (classId || sectionId) {
        // Find students in this class/section
        const StudentUser = require('../models/StudentUser');
        const classStudents = await StudentUser.find({
          schoolId,
          ...(classId ? {} : {}), // classId is an ObjectId for Class, not stored directly on student
        }).select('_id grade section').lean();

        const studentIds = classStudents.map((s) => s._id);
        if (studentIds.length) filter.studentId = { $in: studentIds };
      }

      const scores = await MasteryScore.find(filter).select('score studentId').lean();
      if (scores.length) {
        const avg = Math.round(scores.reduce((s, v) => s + v.score, 0) / scores.length);
        const { MASTERY } = require('../config/workflowThresholds');
        gapAnalysis = {
          averageMastery: avg,
          weakStudentCount: scores.filter((s) => s.score < MASTERY.CRITICAL).length,
          topWeaknesses: avg < 60 ? [`Students averaging ${avg}% on ${subject}`, `${scores.filter(s => s.score < 40).length} students in foundational tier`] : [],
          tierBreakdown: {
            foundation: scores.filter((s) => s.score < MASTERY.CRITICAL).length,
            core:        scores.filter((s) => s.score >= MASTERY.CRITICAL && s.score < MASTERY.MID).length,
            extension:   scores.filter((s) => s.score >= MASTERY.MID).length,
          },
        };
      }
    } catch (_) { /* gap analysis failure must not block content generation */ }

    const gapContext = gapAnalysis.averageMastery != null
      ? `Class data: avg mastery ${gapAnalysis.averageMastery}%, ${gapAnalysis.tierBreakdown.foundation} foundation students, ${gapAnalysis.tierBreakdown.core} core, ${gapAnalysis.tierBreakdown.extension} extension.`
      : '';

    // ── 2. Fire all AI modes in parallel ──────────────────────────────────────
    const [
      lessonRes,
      diffRes,
      hingeRes,
      quizRes,
      misconRes,
    ] = await Promise.allSettled([
      callTeacherAI('lesson_content',        subject, fullTopic, gradeLevel, gapContext),
      callTeacherAI('differentiated_plan',   subject, fullTopic, gradeLevel, gapContext),
      callTeacherAI('hinge_question',        subject, fullTopic, gradeLevel),
      callTeacherAI('quiz_generate',         subject, fullTopic, gradeLevel, `Generate 5 exit quiz MCQs at mixed difficulty. ${gapContext}`),
      callTeacherAI('misconception_report',  subject, fullTopic, gradeLevel, gapContext),
    ]);

    const getText = (settled) => settled.status === 'fulfilled'
      ? (settled.value?.data?.content || settled.value?.data?.response || '')
      : '';

    const lessonRaw   = getText(lessonRes);
    const diffRaw     = getText(diffRes);
    const hingeRaw    = getText(hingeRes);
    const quizRaw     = getText(quizRes);
    const misconRaw   = getText(misconRes);

    // ── 3. Parse differentiated plan into Foundation / Core / Extension ───────
    const parseTiers = (text) => {
      const tiers = { foundation: '', core: '', extension: '' };
      const foundMatch  = text.match(/(?:Foundation|Tier\s*1|Basic)[:\s\-–]*([\s\S]*?)(?=(?:Core|Tier\s*2|Intermediate|Extension|Tier\s*3|Advanced)|$)/i);
      const coreMatch   = text.match(/(?:Core|Tier\s*2|Intermediate)[:\s\-–]*([\s\S]*?)(?=(?:Extension|Tier\s*3|Advanced)|$)/i);
      const extMatch    = text.match(/(?:Extension|Tier\s*3|Advanced|Challenge)[:\s\-–]*([\s\S]*?)$/i);
      if (foundMatch?.[1]) tiers.foundation = foundMatch[1].trim();
      if (coreMatch?.[1])  tiers.core       = coreMatch[1].trim();
      if (extMatch?.[1])   tiers.extension  = extMatch[1].trim();
      if (!tiers.foundation && !tiers.core && !tiers.extension) tiers.core = text;
      return tiers;
    };

    // ── 4. Parse hinge question into structured MCQ ───────────────────────────
    const parseHinge = (text) => {
      const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
      const qLine = lines.find((l) => l.match(/^(Q|Question|Hinge)/i))?.replace(/^(Q|Question|Hinge)[:\-\s]*/i, '')
        || lines[0] || '';
      const opts  = lines.filter((l) => /^[A-D][).]\s/.test(l)).map((l) => l.replace(/^[A-D][).]\s*/, ''));
      const ansLetter = (text.match(/Answer\s*:\s*([A-D])/i) || [])[1]?.toUpperCase() || 'A';
      const ansIdx = ['A','B','C','D'].indexOf(ansLetter);
      return { question: qLine, options: opts.slice(0, 4), answer: ansIdx >= 0 ? ansIdx : 0 };
    };

    // ── 5. Parse exit quiz MCQs ────────────────────────────────────────────────
    const parseQuizMCQ = (text) => {
      const blocks = text.split(/\n(?=\d+\.\s)/).map((b) => b.trim()).filter(Boolean);
      return blocks.slice(0, 5).map((block) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        const q     = lines[0]?.replace(/^\d+\.\s*/, '') || '';
        const opts  = lines.filter((l) => /^[A-D][).]\s/.test(l));
        const ansL  = (block.match(/Answer\s*:\s*([A-D])/i) || [])[1]?.toUpperCase();
        return {
          questionText: q,
          options: opts.map((o, i) => ({
            text:      o.replace(/^[A-D][).]\s*/, ''),
            isCorrect: String.fromCharCode(65 + i) === ansL,
          })),
        };
      }).filter((q) => q.questionText);
    };

    // ── 6. Build suggested learning path nodes from topic breakdown ───────────
    const buildPathNodes = (lessonText, diffText) => {
      // Extract sub-topics from lesson content headings
      const headings = lessonText.match(/(?:^|\n)(?:#{1,3}|\*\*|[A-Z][A-Z\s]{2,}:)/gm) || [];
      const nodes = headings.slice(0, 5).map((h, i) => ({
        idx:    i,
        title:  h.replace(/^[#*]+\s*/, '').replace(/:$/, '').trim(),
        bloom:  ['remember', 'understand', 'apply', 'analyse', 'evaluate'][i] || 'understand',
        tier:   i === 0 ? 'foundation' : i < 3 ? 'core' : 'extension',
        status: i === 0 ? 'active' : 'locked',
      })).filter((n) => n.title.length > 2);

      if (!nodes.length) {
        // Fallback: single node for the whole topic
        nodes.push({ idx: 0, title: fullTopic, bloom: 'understand', tier: 'core', status: 'active' });
      }
      return nodes;
    };

    const tiers        = parseTiers(diffRaw);
    const hingeQ       = parseHinge(hingeRaw);
    const exitQuizQs   = parseQuizMCQ(quizRaw);
    const pathNodes    = buildPathNodes(lessonRaw, diffRaw);

    // ── 7. Parse lesson content into lesson plan fields ───────────────────────
    const introMatch = lessonRaw.match(/(?:Introduction|Overview|Hook)[:\s\-–]*([\s\S]*?)(?=\n#{1,3}|\n\*\*[A-Z]|$)/i);
    const explanationText = lessonRaw.length > 200
      ? lessonRaw.slice(0, Math.floor(lessonRaw.length * 0.7))
      : lessonRaw;
    const recapMatch = lessonRaw.match(/(?:Summary|Recap|Key Takeaways?)[:\s\-–]*([\s\S]*?)$/i);

    const objectivesMatch = lessonRaw.match(/(?:Learning Objectives?|By the end)[:\s\-–]*([\s\S]*?)(?=\n#{1,3}|\n\*\*[A-Z]|$)/i);
    const objectives = objectivesMatch?.[1]
      ? objectivesMatch[1].split('\n').map((l) => l.replace(/^[-•*\d.]+\s*/, '').trim()).filter((l) => l.length > 5).slice(0, 5)
      : [`Understand ${topic}`, `Apply concepts of ${topic} in context`];

    return res.json({
      success: true,
      data: {
        gapAnalysis,
        lessonPlanFields: {
          introduction:       introMatch?.[1]?.trim() || lessonRaw.slice(0, 300),
          explanation:        explanationText,
          recap:              recapMatch?.[1]?.trim() || '',
          learningObjectives: objectives,
          additionalNotes:    misconRaw.slice(0, 500),
        },
        differentiatedPlan: tiers,
        hingeQuestion:       hingeQ,
        exitQuizQuestions:   exitQuizQs,
        misconceptions:      misconRaw,
        learningPathNodes:   pathNodes,
        rawOutputs: {
          lessonContent:       lessonRaw,
          differentiatedPlan:  diffRaw,
          hingeQuestion:       hingeRaw,
          exitQuiz:            quizRaw,
          misconceptions:      misconRaw,
        },
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/progress-summary ─────────────────────────────────────
router.post('/progress-summary', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { studentId, studentName, grade, section } = req.body || {};
    if (!studentId) return res.status(400).json({ error: 'studentId is required' });
    if (!(await requireStudentScope(req, res, studentId))) return;

    const [student, results, mastery] = await Promise.all([
      StudentUser.findById(studentId).select('name grade section attendance').lean(),
      ExamResult.find({ schoolId, studentId, published: true })
        .populate('examId', 'subject marks date')
        .sort({ createdAt: -1 }).limit(20).lean(),
      MasteryScore.find({ studentId, schoolId }).sort({ score: 1 }).lean(),
    ]);

    const att = student?.attendance || [];
    const attPct = att.length > 0
      ? Math.round((att.filter((a) => a.status === 'present').length / att.length) * 100)
      : 100;

    const subjectMap = {};
    results.forEach((r) => {
      const sub = r.examId?.subject || 'General';
      const max = r.examId?.marks || 100;
      const pct = Math.round((r.marks / max) * 100);
      if (!subjectMap[sub]) subjectMap[sub] = [];
      subjectMap[sub].push(pct);
    });
    const subjectLines = Object.entries(subjectMap)
      .map(([sub, scores]) => {
        const avg = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
        const trend = scores.length > 1 ? (scores[scores.length - 1] > scores[0] ? 'improving' : 'declining') : 'stable';
        return `${sub}: ${avg}% (${trend})`;
      })
      .join('\n');

    const weakTopics = mastery.filter((m) => m.score < 60).map((m) => m.topicTitle).slice(0, 3).join(', ');

    const context = [
      `Student: ${studentName || student?.name} | Grade: ${grade || student?.grade} | Section: ${section || student?.section}`,
      `Attendance: ${attPct}%`,
      `Subject Performance:\n${subjectLines || 'No exam data'}`,
      weakTopics ? `Weak topics: ${weakTopics}` : '',
    ].filter(Boolean).join('\n');

    const aiRes = await callTeacherAI(
      'progress_summary',
      'All Subjects',
      `${studentName || student?.name || 'Student'} Academic Progress`,
      grade || student?.grade ? `Grade ${grade || student?.grade}` : null,
      context
    );
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/worksheet ────────────────────────────────────────────
router.post('/worksheet', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    const aiRes = await callTeacherAI('worksheet', subject, topic, gradeLevel || null, null);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/intervention-plan ────────────────────────────────────
router.post('/intervention-plan', authTeacher, async (req, res) => {
  try {
    const { flaggedStudents = [], reteachPlans = [], lowMastery = [] } = req.body || {};

    const studentLines = flaggedStudents.slice(0, 10).map((f) => {
      const name = f.studentId?.name || 'Student';
      return `  - ${name}: ${f.subject} | ${f.score}% avg after ${f.attemptCount} attempts`;
    });

    const reteachLines = reteachPlans.slice(0, 8).map((p) =>
      `  - "${p.title}" (${p.subject}) — class avg fell below ${p.exitQuizThreshold}% threshold`
    );

    const masteryLines = lowMastery.slice(0, 6).map((lm) =>
      `  - ${lm._id}: ${Math.round(lm.avgScore)}% class avg (${lm.studentCount} students assessed)`
    );

    const context = [
      `Flagged Students (score <40% after 3+ attempts): ${flaggedStudents.length}`,
      studentLines.length ? studentLines.join('\n') : '  None',
      `\nLessons Flagged for Re-teaching: ${reteachPlans.length}`,
      reteachLines.length ? reteachLines.join('\n') : '  None',
      `\nLow Mastery Subjects (class avg <50%): ${lowMastery.length}`,
      masteryLines.length ? masteryLines.join('\n') : '  None',
    ].join('\n');

    const aiRes = await callTeacherAI('intervention_plan', 'Multiple Subjects', 'Class Intervention Plan', null, context);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/rubric-generate ─────────────────────────────────────
router.post('/rubric-generate', authTeacher, async (req, res) => {
  try {
    const { subject, taskDescription, gradeLevel } = req.body || {};
    if (!subject || !taskDescription) {
      return res.status(400).json({ error: 'subject and taskDescription are required' });
    }
    const aiRes = await callTeacherAI('rubric_generate', subject, taskDescription, gradeLevel || null, null, null);
    const raw = (aiRes.data?.content || '').trim();

    let rubric = null;
    try {
      const start = raw.indexOf('{');
      const end = raw.lastIndexOf('}');
      if (start !== -1 && end > start) {
        rubric = JSON.parse(raw.slice(start, end + 1));
      }
    } catch (_) { /* fall through */ }

    return res.json({ success: true, data: { rubric, raw } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/cohort-report ────────────────────────────────────────
router.post('/cohort-report', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { className, section, subject } = req.body || {};
    if (!className) return res.status(400).json({ error: 'className is required' });
    if (!(await requireClassNameScope(req, res, { className, section, subject }))) return;

    const StudentUserModel = require('../models/StudentUser');
    const MasteryScoreModel = require('../models/MasteryScore');
    const filter = { schoolId };
    if (className) filter.grade = { $regex: `^${className}$`, $options: 'i' };
    if (section) filter.section = { $regex: `^${section}$`, $options: 'i' };
    const students = await StudentUserModel.find(filter).select('_id name grade section attendance').lean();
    const studentIds = students.map((s) => s._id);
    const since = new Date(Date.now() - 30 * 86400000);

    const [recentExams, masteryLow] = await Promise.all([
      ExamResult.find({ schoolId, studentId: { $in: studentIds }, createdAt: { $gte: since } })
        .populate('examId', 'subject marks').lean(),
      MasteryScoreModel.find({ schoolId, studentId: { $in: studentIds }, score: { $lt: 60 } }).lean(),
    ]);

    const subjectMap = {};
    recentExams.forEach((r) => {
      const sub = r.examId?.subject || 'General';
      const max = r.examId?.marks || 100;
      if (!subjectMap[sub]) subjectMap[sub] = [];
      subjectMap[sub].push(Math.round((r.marks / max) * 100));
    });
    const subjectSummary = Object.entries(subjectMap)
      .map(([sub, scores]) => `${sub}: ${Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)}% avg (${scores.length} results)`)
      .join('\n');

    const weakTopics = [...new Set(masteryLow.map((m) => m.topicTitle))].slice(0, 5).join(', ');
    const attArr = students.flatMap((s) => s.attendance || []);
    const attPct = attArr.length > 0
      ? Math.round((attArr.filter((a) => a.status === 'present').length / attArr.length) * 100)
      : 100;

    const context = [
      `Class: Grade ${className}${section ? ' Section ' + section : ''} | ${students.length} students | Period: last 30 days`,
      `Attendance: ${attPct}%`,
      `Subject Performance (30-day):\n${subjectSummary || 'No exam data'}`,
      weakTopics ? `Top weak topics across class: ${weakTopics}` : '',
    ].filter(Boolean).join('\n');

    const aiRes = await callTeacherAI('class_performance_summary', subject || 'All Subjects', `Grade ${className} Cohort Report`, `Grade ${className}`, context);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
