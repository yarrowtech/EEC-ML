const express = require('express');
const router = express.Router();
const axios = require('axios');
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const ExamResult = require('../models/ExamResult');
const MasteryScore = require('../models/MasteryScore');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT = 120_000;

const callTeacherAI = (mode, subject, topic, gradeLevel, context, question) =>
  axios.post(
    `${AI_SERVICE_URL}/generate/teacher`,
    { mode, subject, topic, gradeLevel: gradeLevel || null, context: context || null, question: question || null },
    { timeout: TIMEOUT }
  );

// ── POST /api/ai-teacher/lesson-content ──────────────────────────────────────
router.post('/lesson-content', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel, chapterTitle } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    const fullTopic = [chapterTitle, topic].filter(Boolean).join(' — ');
    const aiRes = await callTeacherAI('lesson_content', subject, fullTopic, gradeLevel);
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
    if (!schoolId) return res.status(401).json({ error: 'Unauthorized' });

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

    const results = await ExamResult.find({
      schoolId, studentId, published: true,
      ...(subject ? { subject: { $regex: subject, $options: 'i' } } : {}),
    })
      .populate('examId', 'subject marks date')
      .sort({ createdAt: -1 })
      .limit(20)
      .lean();

    const student = await StudentUser.findById(studentId).select('name grade section attendance').lean();
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

// ── POST /api/ai-teacher/idoweedo ─────────────────────────────────────────────
router.post('/idoweedo', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel, totalMinutes } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    const question = totalMinutes ? `Total lesson duration: ${totalMinutes} minutes` : null;
    const aiRes = await callTeacherAI('idoweedo', subject, topic, gradeLevel, null, question);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error', detail: err.response.data });
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/ai-teacher/quiz-generate ────────────────────────────────────────
router.post('/quiz-generate', authTeacher, async (req, res) => {
  try {
    const { subject, topic, gradeLevel, difficulty, count } = req.body || {};
    if (!subject || !topic) return res.status(400).json({ error: 'subject and topic are required' });
    const question = [
      difficulty ? `Difficulty level: ${difficulty}` : null,
      count ? `Generate exactly ${count} questions` : 'Generate exactly 5 questions',
    ].filter(Boolean).join('. ');

    const aiRes = await callTeacherAI('quiz_generate', subject, topic, gradeLevel, null, question);
    const raw = (aiRes.data?.content || '').trim();

    // Try to parse JSON out of LLM response
    let questions = [];
    try {
      const start = raw.indexOf('[');
      const end = raw.lastIndexOf(']');
      if (start !== -1 && end > start) {
        questions = JSON.parse(raw.slice(start, end + 1));
      }
    } catch (_) {
      // Return raw content if JSON parse fails — frontend can show it
    }

    return res.json({ success: true, data: { questions, raw } });
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

module.exports = router;
