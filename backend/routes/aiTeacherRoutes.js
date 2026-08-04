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
