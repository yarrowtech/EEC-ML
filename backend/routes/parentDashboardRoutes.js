const express = require('express');
const router = express.Router();
const axios = require('axios');
const authParent = require('../middleware/authParent');
const StudentUser = require('../models/StudentUser');
const MasteryScore = require('../models/MasteryScore');
const ExamResult = require('../models/ExamResult');
const Exam = require('../models/Exam');
const StudentObservation = require('../models/StudentObservation');
const ParentDashboardReport = require('../models/ParentDashboardReport');
const StudentDevelopmentProfile = require('../models/StudentDevelopmentProfile');
const { resolveParentChildren, parentOwnsStudent } = require('../utils/parentChildren');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';
const TIMEOUT = 120_000;

const callAI = (mode, context, extra = {}) =>
  axios.post(
    `${AI_SERVICE_URL}/generate/teacher`,
    { mode, context, subject: 'Overall Progress', topic: 'Parent Report', ...extra },
    { timeout: TIMEOUT },
  );

const getChildIds = async (parentId, schoolId) => {
  const { childIds } = await resolveParentChildren({ parentId, schoolId, select: '_id' });
  return childIds;
};

const ownsStudent = parentOwnsStudent;

// ── Exam result helpers ──────────────────────────────────────────────────────
// ExamResult stores `marks` (obtained). The exam total lives on Exam.marks.
const buildExamIndex = async (examIds) => {
  const ids = [...new Set(examIds.filter(Boolean).map(String))];
  if (!ids.length) return new Map();
  const exams = await Exam.find({ _id: { $in: ids } })
    .select('title subject date marks')
    .lean();
  return new Map(exams.map((exam) => [String(exam._id), exam]));
};

const shapeExamResult = (result, exam) => {
  const total = Number(exam?.marks) || 0;
  const obtained = Number(result?.marks) || 0;
  return {
    title: exam?.title || 'Exam',
    subject: exam?.subject || '',
    date: exam?.date || result?.createdAt || null,
    marks: obtained,
    total: total || null,
    percentage: total > 0 ? Math.round((obtained / total) * 100) : null,
    grade: result?.grade || '',
    status: result?.status || 'pass',
  };
};

// GET /api/parent-dashboard/weak-areas
router.get('/weak-areas', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id, req.schoolId);
    if (!childIds.length) return res.json({ success: true, data: [] });

    const weakAreas = await MasteryScore.find({
      studentId: { $in: childIds },
      score: { $lt: 60 },
      schoolId: req.schoolId,
    })
      .sort({ score: 1 })
      .limit(30)
      .populate('studentId', 'name grade section')
      .lean();

    return res.json({ success: true, data: weakAreas });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/remarks-feed
router.get('/remarks-feed', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id, req.schoolId);
    if (!childIds.length) return res.json({ success: true, data: [] });

    const remarks = await StudentObservation.find({
      studentId: { $in: childIds },
      schoolId: req.schoolId,
      source: 'teacher',
    })
      .sort({ recordedAt: -1 })
      .limit(20)
      .select('studentId studentName observationText category recordedAt concernLevel')
      .lean();

    return res.json({ success: true, data: remarks });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/home-support/:studentId
router.get('/home-support/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id, req.schoolId);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const weakAreas = await MasteryScore.find({
      studentId: req.params.studentId,
      score: { $lt: 70 },
      schoolId: req.schoolId,
    })
      .sort({ score: 1 })
      .limit(6)
      .lean();

    if (!weakAreas.length) {
      return res.json({
        success: true,
        data: { content: 'Great news — no weak areas identified right now! Keep encouraging regular study and reading habits at home.' },
      });
    }

    const context = weakAreas.map((w) => `${w.subject} — ${w.topicTitle}: ${w.score}%`).join('\n');
    const aiRes = await callAI('home_support', context);
    return res.json({ success: true, data: { content: aiRes.data?.content || '' } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/weekly-digest/:studentId
router.get('/weekly-digest/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id, req.schoolId);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const SEVEN_DAYS = 7 * 24 * 60 * 60 * 1000;
    const existing = await ParentDashboardReport.findOne({
      parentId: req.user.id,
      studentId: req.params.studentId,
      type: 'weekly_digest',
    }).lean();

    if (existing && Date.now() - new Date(existing.generatedAt) < SEVEN_DAYS) {
      return res.json({ success: true, data: { content: existing.content, generatedAt: existing.generatedAt } });
    }

    const since = new Date(Date.now() - SEVEN_DAYS);
    const [recentExams, recentMastery, student] = await Promise.all([
      ExamResult.find({ studentId: req.params.studentId, createdAt: { $gte: since } }).lean(),
      MasteryScore.find({ studentId: req.params.studentId, lastUpdated: { $gte: since } }).lean(),
      StudentUser.findById(req.params.studentId).select('name grade section').lean(),
    ]);

    const weeklyExamIndex = await buildExamIndex(recentExams.map((e) => e.examId));
    const examSummary = recentExams.length
      ? recentExams
          .map((e) => shapeExamResult(e, weeklyExamIndex.get(String(e.examId))))
          .map((e) => `${e.subject || e.title}: ${e.marks}/${e.total ?? '?'}`)
          .join(', ')
      : 'No exams this week';
    const masterySummary = recentMastery.length
      ? recentMastery.map((m) => `${m.subject}/${m.topicTitle}: ${m.score}%`).join(', ')
      : 'No mastery activity';

    const context = `Student: ${student?.name || 'Student'}, Class ${student?.grade || ''} ${student?.section || ''}\nExams this week: ${examSummary}\nMastery updates: ${masterySummary}`;
    const aiRes = await callAI('progress_digest', context);
    const content = aiRes.data?.content || '';

    await ParentDashboardReport.findOneAndUpdate(
      { parentId: req.user.id, studentId: req.params.studentId, type: 'weekly_digest' },
      { content, generatedAt: new Date(), schoolId: req.schoolId },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: { content, generatedAt: new Date() } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/monthly-report/:studentId
router.get('/monthly-report/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id, req.schoolId);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }

    const THIRTY_DAYS = 30 * 24 * 60 * 60 * 1000;
    const existing = await ParentDashboardReport.findOne({
      parentId: req.user.id,
      studentId: req.params.studentId,
      type: 'monthly_report',
    }).lean();

    if (existing && Date.now() - new Date(existing.generatedAt) < THIRTY_DAYS) {
      return res.json({ success: true, data: { content: existing.content, generatedAt: existing.generatedAt } });
    }

    const since = new Date(Date.now() - THIRTY_DAYS);
    const [exams, mastery, remarks, student] = await Promise.all([
      ExamResult.find({ studentId: req.params.studentId, createdAt: { $gte: since } }).lean(),
      MasteryScore.find({ studentId: req.params.studentId }).lean(),
      StudentObservation.find({
        studentId: req.params.studentId,
        source: 'teacher',
        recordedAt: { $gte: since },
      })
        .select('observationText category concernLevel')
        .lean(),
      StudentUser.findById(req.params.studentId).select('name grade section').lean(),
    ]);

    const monthlyExamIndex = await buildExamIndex(exams.map((e) => e.examId));
    const examSummary = exams.length
      ? exams
          .map((e) => shapeExamResult(e, monthlyExamIndex.get(String(e.examId))))
          .map((e) => `${e.subject || e.title}: ${e.marks}/${e.total ?? '?'} (${e.percentage ?? '?'}%)`)
          .join('; ')
      : 'No exams this month';
    const masterySummary = mastery.length
      ? mastery.map((m) => `${m.subject}/${m.topicTitle}: ${m.score}%`).join('; ')
      : 'No mastery data';
    const remarksSummary = remarks.length
      ? remarks.map((r) => `[${r.category}] ${r.observationText}`).join(' | ')
      : 'No remarks this month';

    const context = `Student: ${student?.name || 'Student'}, Class ${student?.grade || ''} ${student?.section || ''}\nExam results: ${examSummary}\nMastery scores: ${masterySummary}\nTeacher remarks: ${remarksSummary}`;
    const aiRes = await callAI('monthly_report', context);
    const content = aiRes.data?.content || '';

    await ParentDashboardReport.findOneAndUpdate(
      { parentId: req.user.id, studentId: req.params.studentId, type: 'monthly_report' },
      { content, generatedAt: new Date(), schoolId: req.schoolId },
      { upsert: true, new: true }
    );

    return res.json({ success: true, data: { content, generatedAt: new Date() } });
  } catch (err) {
    if (err.response) return res.status(502).json({ error: 'AI service error' });
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/analytics/academic/:studentId
router.get('/analytics/academic/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id, req.schoolId);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }
    const sid = req.params.studentId;

    const [masteryScores, examResults, student] = await Promise.all([
      MasteryScore.find({ studentId: sid, schoolId: req.schoolId }).lean(),
      ExamResult.find({ studentId: sid }).lean(),
      StudentUser.findById(sid).select('name grade section attendance').lean(),
    ]);
    const examIndex = await buildExamIndex(examResults.map((r) => r.examId));

    // Subject-wise mastery grouped
    const subjectMap = {};
    for (const m of masteryScores) {
      if (!subjectMap[m.subject]) subjectMap[m.subject] = { scores: [], topics: [] };
      subjectMap[m.subject].scores.push(m.score);
      subjectMap[m.subject].topics.push({ title: m.topicTitle, score: m.score, chapter: m.chapterTitle });
    }
    const subjectBreakdown = Object.entries(subjectMap).map(([subject, { scores, topics }]) => ({
      subject,
      avg: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length),
      topicCount: scores.length,
      topics: topics.sort((a, b) => a.score - b.score),
    })).sort((a, b) => b.avg - a.avg);

    // Exam trend (last 12 results)
    const examTrend = examResults
      .filter((r) => examIndex.has(String(r.examId)))
      .map((r) => shapeExamResult(r, examIndex.get(String(r.examId))))
      .sort((a, b) => new Date(a.date) - new Date(b.date))
      .slice(-12);

    // Attendance summary from embedded array
    const attendance = Array.isArray(student?.attendance) ? student.attendance : [];
    const presentDays = attendance.filter((a) => String(a.status).toLowerCase() === 'present').length;
    const totalDays = attendance.length;
    const attendancePct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : null;

    // Monthly attendance trend (last 6 months)
    const monthlyAttendance = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const records = attendance.filter((a) => {
        const dt = new Date(a.date);
        return dt.getFullYear() === yr && dt.getMonth() === mo;
      });
      const present = records.filter((a) => String(a.status).toLowerCase() === 'present').length;
      monthlyAttendance.push({ label, present, total: records.length, pct: records.length ? Math.round((present / records.length) * 100) : null });
    }

    return res.json({
      success: true,
      data: {
        student: { name: student?.name, grade: student?.grade, section: student?.section },
        subjectBreakdown,
        examTrend,
        attendanceSummary: { presentDays, totalDays, attendancePct },
        monthlyAttendance,
        overallMastery: masteryScores.length
          ? Math.round(masteryScores.reduce((a, b) => a + b.score, 0) / masteryScores.length)
          : null,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/analytics/wellbeing/:studentId
router.get('/analytics/wellbeing/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id, req.schoolId);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }
    const sid = req.params.studentId;

    const observations = await StudentObservation.find({
      studentId: sid,
      schoolId: req.schoolId,
    })
      .sort({ recordedAt: -1 })
      .limit(60)
      .lean();

    // Concern level distribution
    const concernCounts = { low: 0, medium: 0, high: 0, urgent: 0 };
    for (const o of observations) {
      const lvl = String(o.concernLevel || 'low').toLowerCase();
      if (concernCounts[lvl] !== undefined) concernCounts[lvl]++;
    }

    // Category breakdown
    const categoryMap = {};
    for (const o of observations) {
      const cat = o.category || 'General';
      categoryMap[cat] = (categoryMap[cat] || 0) + 1;
    }
    const categoryBreakdown = Object.entries(categoryMap)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);

    // Mood trend (last 20 with a moodRating)
    const moodTrend = observations
      .filter((o) => o.moodRating != null)
      .slice(0, 20)
      .map((o) => ({
        date: o.recordedAt,
        mood: o.moodRating,
        note: o.observationText?.slice(0, 80) || '',
      }))
      .reverse();

    // Monthly observation count (last 6 months)
    const monthlyObservations = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date();
      d.setMonth(d.getMonth() - i);
      const yr = d.getFullYear();
      const mo = d.getMonth();
      const label = d.toLocaleString('en-US', { month: 'short', year: '2-digit' });
      const count = observations.filter((o) => {
        const dt = new Date(o.recordedAt);
        return dt.getFullYear() === yr && dt.getMonth() === mo;
      }).length;
      monthlyObservations.push({ label, count });
    }

    // Recent observations for feed
    const recentObservations = observations.slice(0, 8).map((o) => ({
      date: o.recordedAt,
      text: o.observationText,
      category: o.category,
      concernLevel: o.concernLevel,
      moodRating: o.moodRating,
      followUpRequired: o.followUpRequired,
    }));

    const avgMood = moodTrend.length
      ? Math.round((moodTrend.reduce((a, b) => a + b.mood, 0) / moodTrend.length) * 10) / 10
      : null;

    return res.json({
      success: true,
      data: {
        totalObservations: observations.length,
        avgMood,
        concernCounts,
        categoryBreakdown,
        moodTrend,
        monthlyObservations,
        recentObservations,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/parent-dashboard/analytics/skills/:studentId
router.get('/analytics/skills/:studentId', authParent, async (req, res) => {
  try {
    const childIds = await getChildIds(req.user.id, req.schoolId);
    if (!ownsStudent(childIds, req.params.studentId)) {
      return res.status(403).json({ error: 'Not authorized for this student' });
    }
    const sid = req.params.studentId;

    const [masteryScores, examResults, student, observations, devProfile] = await Promise.all([
      MasteryScore.find({ studentId: sid, schoolId: req.schoolId }).lean(),
      ExamResult.find({ studentId: sid }).lean(),
      StudentUser.findById(sid).select('name grade section attendance').lean(),
      StudentObservation.find({ studentId: sid, schoolId: req.schoolId }).sort({ recordedAt: -1 }).limit(40).lean(),
      StudentDevelopmentProfile.findOne({ studentId: sid, schoolId: req.schoolId }).lean(),
    ]);

    const masteryAvg = masteryScores.length
      ? Math.round(masteryScores.reduce((a, b) => a + b.score, 0) / masteryScores.length)
      : null;

    const skillsExamIndex = await buildExamIndex(examResults.map((r) => r.examId));
    const examPercentages = examResults
      .map((r) => shapeExamResult(r, skillsExamIndex.get(String(r.examId))).percentage)
      .filter((p) => p != null);
    const examAvg = examPercentages.length
      ? Math.round(examPercentages.reduce((a, b) => a + b, 0) / examPercentages.length)
      : null;

    const attendance = Array.isArray(student?.attendance) ? student.attendance : [];
    const presentDays = attendance.filter((a) => String(a.status).toLowerCase() === 'present').length;
    const attendancePct = attendance.length > 0 ? Math.round((presentDays / attendance.length) * 100) : null;

    const moodRatings = observations.filter((o) => o.moodRating != null).map((o) => o.moodRating);
    const moodScore = moodRatings.length
      ? Math.round((moodRatings.reduce((a, b) => a + b, 0) / moodRatings.length) * 20)
      : null;
    const lowConcernCount = observations.filter((o) => !o.concernLevel || o.concernLevel === 'low').length;
    const positiveRatio = observations.length > 0 ? Math.round((lowConcernCount / observations.length) * 100) : null;

    const blend = (a, b, wa = 0.5) => {
      if (a != null && b != null) return Math.round(a * wa + b * (1 - wa));
      return a ?? b ?? null;
    };
    const clamp = (v, off) => (v != null ? Math.max(0, Math.min(100, v + off)) : null);

    // Use real development profile scores when available, fall back to heuristics
    const realCognitive       = devProfile?.cognitive?.score ?? null;
    const realMemory          = devProfile?.memory?.score ?? null;
    const realCreative        = devProfile?.creative?.score ?? null;
    const realLanguage        = devProfile?.language?.score ?? null;
    const realSocialEmotional = devProfile?.socialEmotional?.score ?? null;
    const realPhysical        = devProfile?.physical?.score ?? null;

    const cognitive       = realCognitive       ?? masteryAvg;
    const thinkingSkills  = realCognitive       ?? blend(masteryAvg, examAvg, 0.55);
    const languageComm    = realLanguage        ?? masteryAvg;
    const attentionMotiv  = realMemory          ?? blend(attendancePct, moodScore, 0.6);
    const socialEmotional = realSocialEmotional ?? blend(moodScore, positiveRatio, 0.5);
    const physicalMental  = realPhysical        ?? blend(cognitive, attentionMotiv, 0.5);

    // 3-section summary for parent view
    const academicGrowthScore = [realCognitive, realMemory, realCreative, realLanguage]
      .filter((s) => s != null);
    const academicGrowth = academicGrowthScore.length
      ? Math.round(academicGrowthScore.reduce((a, b) => a + b, 0) / academicGrowthScore.length)
      : blend(masteryAvg, examAvg, 0.6);

    const wellbeingScores = [realSocialEmotional, realPhysical].filter((s) => s != null);
    const emotionalWellbeing = wellbeingScores.length
      ? Math.round(wellbeingScores.reduce((a, b) => a + b, 0) / wellbeingScores.length)
      : blend(moodScore, positiveRatio, 0.5);

    const holistic = {
      academicGrowth: {
        score: academicGrowth,
        breakdown: {
          cognitive:  { score: realCognitive,  trend: devProfile?.cognitive?.trend  ?? 'unknown' },
          memory:     { score: realMemory,      trend: devProfile?.memory?.trend      ?? 'unknown' },
          creative:   { score: realCreative,    trend: devProfile?.creative?.trend    ?? 'unknown' },
          language:   { score: realLanguage,    trend: devProfile?.language?.trend    ?? 'unknown' },
        },
      },
      emotionalWellbeing: {
        score: emotionalWellbeing,
        breakdown: {
          socialEmotional: { score: realSocialEmotional, trend: devProfile?.socialEmotional?.trend ?? 'unknown' },
          physical:        { score: realPhysical,         trend: devProfile?.physical?.trend         ?? 'unknown' },
        },
      },
      hasRealData: !!devProfile,
    };

    const domains = [
      {
        name: 'Cognitive & Thinking',
        color: '#f59e0b',
        score: cognitive,
        icon: 'Brain',
        skills: [
          { id: 1,  label: 'Cognitive Ability',             score: clamp(cognitive, 0)  },
          { id: 6,  label: 'Convergent Analytic Thinking',  score: clamp(thinkingSkills, +2)  },
          { id: 7,  label: 'Divergent Thinking',            score: clamp(thinkingSkills, -4)  },
          { id: 8,  label: 'Critical Thinking',             score: clamp(thinkingSkills, +5)  },
          { id: 9,  label: 'Creative Thinking',             score: clamp(thinkingSkills, -6)  },
          { id: 10, label: 'Intelligence',                  score: clamp(cognitive, +3)  },
          { id: 12, label: 'Memory',                        score: clamp(cognitive, +7)  },
          { id: 13, label: 'Reasoning',                     score: clamp(cognitive, +4)  },
        ],
      },
      {
        name: 'Attention & Motivation',
        color: '#6366f1',
        score: attentionMotiv,
        icon: 'Target',
        skills: [
          { id: 2,  label: 'Motivational Engagement',       score: clamp(attentionMotiv, 0)   },
          { id: 3,  label: 'Encouraging Attention Span',    score: clamp(attentionMotiv, +5)  },
          { id: 4,  label: 'Attention Span Development',    score: clamp(attentionMotiv, +2)  },
          { id: 5,  label: 'Concentration in Answering',    score: clamp(attentionMotiv, -5)  },
          { id: 11, label: 'Interest & Curiosity',          score: clamp(attentionMotiv, +6)  },
        ],
      },
      {
        name: 'Language & Communication',
        color: '#10b981',
        score: languageComm,
        icon: 'MessageSquare',
        skills: [
          { id: 14, label: 'Speaking, Listening, Reading & Writing', score: clamp(languageComm, 0)  },
          { id: 15, label: 'Vocabulary Development',        score: clamp(languageComm, -4)  },
          { id: 16, label: 'Communication Strategies',      score: clamp(languageComm, +3)  },
          { id: 17, label: 'Visual Goal Setting',           score: clamp(languageComm, -7)  },
          { id: 18, label: 'Self-Explanation',              score: clamp(languageComm, +2)  },
        ],
      },
      {
        name: 'Social & Emotional',
        color: '#f43f5e',
        score: socialEmotional,
        icon: 'Users',
        skills: [
          { id: 19, label: 'Group Activity & Teamwork',     score: clamp(socialEmotional, +4)  },
          { id: 22, label: 'Social, Emotional & Creative Development', score: clamp(socialEmotional, 0) },
        ],
      },
      {
        name: 'Physical & Mental Development',
        color: '#8b5cf6',
        score: physicalMental,
        icon: 'Activity',
        skills: [
          { id: 20, label: 'Physical Dev. (Fine Motor Skills)', score: clamp(physicalMental, -3) },
          { id: 21, label: 'Mental Development',            score: clamp(physicalMental, +4)  },
        ],
      },
    ];

    const allScores = domains.flatMap((d) => d.skills.map((s) => s.score)).filter((s) => s != null);
    const overallSkillScore = allScores.length
      ? Math.round(allScores.reduce((a, b) => a + b, 0) / allScores.length)
      : null;

    return res.json({
      success: true,
      data: {
        student: { name: student?.name, grade: student?.grade, section: student?.section },
        domains,
        overallSkillScore,
        totalSkills: 22,
        dataPoints: { masteryAvg, examAvg, attendancePct, moodScore, positiveRatio },
        holistic,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
