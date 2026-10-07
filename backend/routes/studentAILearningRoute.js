const express = require('express');
const axios = require('axios');
const router = express.Router();
const StudentUser = require('../models/StudentUser');
const authStudent = require('../middleware/authStudent');
const MasteryScore = require('../models/MasteryScore');
const PracticeAttempt = require('../models/PracticeAttempt');
const Subject = require('../models/Subject');
const TeachingMaterial = require('../models/TeachingMaterial');
const { logger } = require('../utils/logger');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

const CONTENT_TYPE_TO_MODE = {
  summary: 'summarize',
  mindmap: 'mind_map',
  flashcards: 'flashcards',
  quiz: 'quiz',
  explanation: 'explain',
};

const ensureStudentAccess = (req, res, studentId) => {
  if (req.userType === 'Admin') return true;
  if (req.user?.id && String(req.user.id) === String(studentId)) return true;
  res.status(403).json({ error: 'Access denied' });
  return false;
};

// Get available courses for AI learning
router.get('/courses/:studentId', authStudent, async (req, res) => {
  // #swagger.tags = ['Student AI Learning']
  try {
    const { studentId } = req.params;
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'courses.fetch',
      targetType: 'student',
      targetId: studentId,
    });
    if (!ensureStudentAccess(req, res, studentId)) return;
    const schoolId = req.schoolId || req.user?.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }
    const student = await StudentUser.findOne({ _id: studentId, schoolId });

    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    // Build courses from the subjects actually offered to this student's class
    // and the chapters/topics teachers have published for their class+section,
    // rather than a hardcoded grade-based list.
    const courses = await getCoursesForStudent(student, schoolId);

    res.status(200).json(courses);
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'courses.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      resultCount: Array.isArray(courses) ? courses.length : 0,
    });
  } catch (error) {
    logStudentPortalError(req, {
      feature: 'ai_learning',
      action: 'courses.fetch',
      statusCode: 500,
      err: error,
      targetType: 'student',
      targetId: req.params.studentId,
    });
    (req.log || logger).error({ err: error, studentId: req.params.studentId }, 'Error fetching AI courses');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate AI content for a topic
router.post('/generate-content', authStudent, async (req, res) => {
  // #swagger.tags = ['Student AI Learning']
  try {
    const { topic, subject, contentType, difficulty } = req.body;
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'content.generate',
      targetType: 'student',
      targetId: req.user?.id,
      contentType,
      topic,
      subject,
      difficulty,
    });

    const mode = CONTENT_TYPE_TO_MODE[contentType];
    if (!mode) {
      return res.status(400).json({ error: 'Invalid content type' });
    }
    if (!topic || !subject) {
      return res.status(400).json({ error: 'topic and subject are required' });
    }

    const studentId = req.user?.id;
    const schoolId = req.schoolId || req.user?.schoolId || null;
    const student = schoolId
      ? await StudentUser.findOne({ _id: studentId, schoolId }).lean().catch(() => null)
      : null;

    const aiStarted = Date.now();
    let aiResponse;
    try {
      aiResponse = await axios.post(`${AI_SERVICE_URL}/orchestrate`, {
        task_type: 'generate',
        payload: {
          mode,
          subject,
          topic,
          gradeLevel: student?.grade ? `Grade ${student.grade}` : null,
          schoolId: schoolId ? String(schoolId) : null,
          classId: student?.classId ? String(student.classId) : null,
          sectionId: student?.sectionId ? String(student.sectionId) : null,
          difficulty: difficulty || 'medium',
        },
      }, { timeout: 90000 });
    } catch (aiErr) {
      require('../services/aiInteractionLogger').logAiInteraction({
        schoolId, userId: studentId, userRole: 'student',
        feature: 'ai_learning_generate_content', mode, subject, topicTitle: topic,
        status: 'error', httpStatus: aiErr.response?.status || null,
        errorType: aiErr.response ? 'ai_service_error' : 'network_error',
        latencyMs: Date.now() - aiStarted,
      });
      throw aiErr;
    }

    require('../services/aiInteractionLogger').logAiInteraction({
      schoolId, userId: studentId, userRole: 'student',
      feature: 'ai_learning_generate_content', mode, subject, topicTitle: topic,
      aiResponse: aiResponse.data || {}, status: 'success', latencyMs: Date.now() - aiStarted,
    });

    res.status(200).json({
      success: true,
      content: {
        contentType,
        topic,
        subject,
        difficulty: difficulty || 'medium',
        text: aiResponse.data?.content || '',
        model: aiResponse.data?.model || null,
        groundedInMaterial: aiResponse.data?.groundedInMaterial || false,
        citations: Array.isArray(aiResponse.data?.citations) ? aiResponse.data.citations : [],
      },
    });
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'content.generate',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: req.user?.id,
      contentType,
      topic,
      subject,
    });
  } catch (error) {
    logStudentPortalError(req, {
      feature: 'ai_learning',
      action: 'content.generate',
      statusCode: 500,
      err: error,
      targetType: 'student',
      targetId: req.user?.id,
      contentType: req.body?.contentType,
      topic: req.body?.topic,
    });
    (req.log || logger).error({ err: error, contentType: req.body?.contentType, topic: req.body?.topic }, 'Error generating AI content');
    if (error.response) {
      return res.status(502).json({ error: 'AI service error' });
    }
    res.status(500).json({ error: 'Failed to generate content' });
  }
});

// Get learning progress for a student
router.get('/progress/:studentId', authStudent, async (req, res) => {
  // #swagger.tags = ['Student AI Learning']
  try {
    const { studentId } = req.params;
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'progress.fetch',
      targetType: 'student',
      targetId: studentId,
    });
    if (!ensureStudentAccess(req, res, studentId)) return;

    // Real progress derived from the student's own mastery + practice records.
    // Degrade gracefully — a stats query failure should not blank the page.
    const [masteryRows, weekAttempts] = await Promise.all([
      MasteryScore.find({ studentId }).lean().catch(() => []),
      PracticeAttempt.countDocuments({
        studentId,
        createdAt: { $gte: new Date(Date.now() - 7 * 86400000) },
      }).catch(() => 0),
    ]);

    const bySubject = {};
    for (const row of masteryRows) {
      const key = row.subject || 'General';
      if (!bySubject[key]) bySubject[key] = { total: 0, sum: 0, mastered: 0 };
      bySubject[key].total += 1;
      bySubject[key].sum += Number(row.score) || 0;
      if ((Number(row.score) || 0) >= 75) bySubject[key].mastered += 1;
    }
    const subjectProgress = {};
    Object.entries(bySubject).forEach(([subject, s]) => {
      subjectProgress[subject] = {
        completed: s.mastered,
        total: s.total,
        percentage: s.total ? Math.round(s.sum / s.total) : 0,
      };
    });

    const activeDays = new Set(
      masteryRows
        .map((r) => r.lastUpdated && new Date(r.lastUpdated).toISOString().slice(0, 10))
        .filter(Boolean)
    );

    const progress = {
      studentId,
      totalTopicsStudied: masteryRows.length,
      completedCourses: Object.values(subjectProgress).filter((s) => s.total > 0 && s.completed === s.total).length,
      currentStreak: 0, // see /api/student-dashboard/learning-streak for the streak calc
      totalActiveDays: activeDays.size,
      weeklyGoal: 5,
      weeklyProgress: weekAttempts,
      subjectProgress,
      recentActivity: [...masteryRows]
        .sort((a, b) => new Date(b.lastUpdated || 0) - new Date(a.lastUpdated || 0))
        .slice(0, 5)
        .map((r) => ({
          topic: r.topicTitle || r.subject,
          subject: r.subject || '',
          date: r.lastUpdated || null,
          type: 'mastery',
        })),
    };

    res.status(200).json(progress);
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'progress.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      weeklyProgress: progress.weeklyProgress,
    });
  } catch (error) {
    logStudentPortalError(req, {
      feature: 'ai_learning',
      action: 'progress.fetch',
      statusCode: 500,
      err: error,
      targetType: 'student',
      targetId: req.params.studentId,
    });
    (req.log || logger).error({ err: error, studentId: req.params.studentId }, 'Error fetching AI learning progress');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Save learning activity.
// NOTE: there is no dedicated activity-log collection yet — this endpoint
// acknowledges the client event but does not fabricate downstream analytics.
// Mastery/practice/flashcard progress is persisted by their own endpoints.
router.post('/activity', authStudent, async (req, res) => {
  // #swagger.tags = ['Student AI Learning']
  try {
    const { studentId, topic, subject, activityType, timeSpent, completed } = req.body;
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'activity.save',
      targetType: 'student',
      targetId: studentId,
      activityType,
      topic,
      subject,
      timeSpent,
      completed: Boolean(completed),
    });
    if (!ensureStudentAccess(req, res, studentId)) return;
    
    // In real implementation, save to database
    const activity = {
      studentId,
      topic,
      subject,
      activityType,
      timeSpent,
      completed,
      timestamp: new Date()
    };

    res.status(200).json({
      success: true,
      message: 'Activity received',
      activity
    });
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'activity.save',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      activityType,
      topic,
    });
  } catch (error) {
    logStudentPortalError(req, {
      feature: 'ai_learning',
      action: 'activity.save',
      statusCode: 500,
      err: error,
      targetType: 'student',
      targetId: req.body?.studentId,
      activityType: req.body?.activityType,
    });
    (req.log || logger).error({ err: error, studentId: req.body?.studentId, activityType: req.body?.activityType }, 'Error saving AI learning activity');
    res.status(500).json({ error: 'Failed to save activity' });
  }
});

// Get AI study recommendations
router.get('/recommendations/:studentId', authStudent, async (req, res) => {
  // #swagger.tags = ['Student AI Learning']
  try {
    const { studentId } = req.params;
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'recommendations.fetch',
      targetType: 'student',
      targetId: studentId,
    });
    if (!ensureStudentAccess(req, res, studentId)) return;

    // Recommend the student's own weakest tracked topics for review.
    const weakTopics = await MasteryScore.find({ studentId, score: { $lt: 60 } })
      .sort({ score: 1, lastUpdated: 1 })
      .limit(5)
      .lean()
      .catch(() => []);

    const recommendations = weakTopics.map((t, i) => ({
      id: String(t._id || i + 1),
      title: `Review ${t.topicTitle || t.subject}`,
      subject: t.subject || '',
      reason: `Your current mastery here is ${Math.round(Number(t.score) || 0)}% — a review session should help.`,
      difficulty: (Number(t.score) || 0) < 35 ? 'basic' : 'medium',
      estimatedTime: 30,
      type: 'review',
    }));

    res.status(200).json(recommendations);
    logStudentPortalEvent(req, {
      feature: 'ai_learning',
      action: 'recommendations.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      resultCount: recommendations.length,
    });
  } catch (error) {
    logStudentPortalError(req, {
      feature: 'ai_learning',
      action: 'recommendations.fetch',
      statusCode: 500,
      err: error,
      targetType: 'student',
      targetId: req.params.studentId,
    });
    (req.log || logger).error({ err: error, studentId: req.params.studentId }, 'Error fetching AI recommendations');
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Build courses from the subjects configured for the student's class, enriched
// with chapter/topic titles pulled from materials teachers have actually
// published to the student portal for that class+section. Falls back to the
// subject with no topics (rather than inventing any) when nothing is published yet.
const COLOR_CYCLE = ['blue', 'purple', 'green', 'orange', 'teal', 'rose', 'indigo', 'amber'];

async function getCoursesForStudent(student, schoolId) {
  if (!student.classId) return [];

  const [subjects, materials] = await Promise.all([
    Subject.find({ schoolId, classId: student.classId }).lean().catch(() => []),
    TeachingMaterial.find({
      schoolId,
      classId: student.classId,
      ...(student.sectionId ? { sectionId: student.sectionId } : {}),
      status: 'published',
      publishedForStudentPortal: true,
      isEnabled: true,
    })
      .select('subjectId subjectName chapterTitle topicTitle')
      .lean()
      .catch(() => []),
  ]);

  const topicsBySubjectId = {};
  const topicsBySubjectName = {};
  for (const m of materials) {
    const topic = m.topicTitle || m.chapterTitle;
    if (!topic) continue;
    if (m.subjectId) {
      const key = String(m.subjectId);
      if (!topicsBySubjectId[key]) topicsBySubjectId[key] = new Set();
      topicsBySubjectId[key].add(topic);
    }
    if (m.subjectName) {
      if (!topicsBySubjectName[m.subjectName]) topicsBySubjectName[m.subjectName] = new Set();
      topicsBySubjectName[m.subjectName].add(topic);
    }
  }

  return subjects.map((subject, i) => {
    const topics = Array.from(
      topicsBySubjectId[String(subject._id)] || topicsBySubjectName[subject.name] || []
    );
    return {
      id: String(subject._id),
      name: subject.name,
      description: subject.stream ? `${subject.name} (${subject.stream})` : subject.name,
      topics,
      color: COLOR_CYCLE[i % COLOR_CYCLE.length],
    };
  });
}

module.exports = router;
