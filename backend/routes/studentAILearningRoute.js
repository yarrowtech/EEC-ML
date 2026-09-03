const express = require('express');
const router = express.Router();
const StudentUser = require('../models/StudentUser');
const authStudent = require('../middleware/authStudent');
const MasteryScore = require('../models/MasteryScore');
const PracticeAttempt = require('../models/PracticeAttempt');
const { logger } = require('../utils/logger');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

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

    // Mock courses based on student's grade
    const courses = getCoursesForGrade(student.grade);
    
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

    let generatedContent;
    
    switch (contentType) {
      case 'summary':
        generatedContent = await generateSummary(topic, subject, difficulty);
        break;
      case 'mindmap':
        generatedContent = await generateMindMap(topic, subject, difficulty);
        break;
      case 'flashcards':
        generatedContent = await generateFlashcards(topic, subject, difficulty);
        break;
      case 'quiz':
        generatedContent = await generateQuiz(topic, subject, difficulty);
        break;
      case 'explanation':
        generatedContent = await generateExplanation(topic, subject, difficulty);
        break;
      default:
        return res.status(400).json({ error: 'Invalid content type' });
    }

    res.status(200).json({
      success: true,
      content: generatedContent
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

// Helper functions for AI content generation
function getCoursesForGrade(grade) {
  const gradeNumber = parseInt(grade);
  let subjects = [];

  if (gradeNumber >= 9) {
    subjects = [
      {
        id: 'math',
        name: 'Mathematics',
        description: 'Advanced mathematical concepts including algebra, geometry, and calculus',
        topics: [
          'Algebra', 'Geometry', 'Trigonometry', 'Statistics', 'Probability',
          'Calculus Basics', 'Number Theory', 'Coordinate Geometry'
        ],
        color: 'blue'
      },
      {
        id: 'physics',
        name: 'Physics',
        description: 'Fundamental principles of physics including mechanics, electricity, and optics',
        topics: [
          'Mechanics', 'Heat and Thermodynamics', 'Light', 'Sound', 'Electricity',
          'Magnetism', 'Modern Physics', 'Waves'
        ],
        color: 'purple'
      },
      {
        id: 'chemistry',
        name: 'Chemistry',
        description: 'Chemical principles, reactions, and molecular structures',
        topics: [
          'Atomic Structure', 'Chemical Bonding', 'Acids and Bases', 'Organic Chemistry',
          'Periodic Table', 'Chemical Reactions', 'Electrochemistry'
        ],
        color: 'green'
      },
      {
        id: 'biology',
        name: 'Biology',
        description: 'Life sciences including cell biology, genetics, and ecology',
        topics: [
          'Cell Biology', 'Genetics', 'Evolution', 'Human Physiology', 'Plant Biology',
          'Ecology', 'Biotechnology', 'Molecular Biology'
        ],
        color: 'orange'
      }
    ];
  }

  return subjects;
}

async function generateSummary(topic, subject, difficulty = 'medium') {
  // Mock AI-generated summary
  const summaries = {
    'Quadratic Equations': {
      basic: "Quadratic equations are mathematical expressions of the form ax² + bx + c = 0. They create parabolic curves when graphed and have at most two solutions. The solutions can be found using factoring, completing the square, or the quadratic formula.",
      medium: "Quadratic equations (ax² + bx + c = 0) represent second-degree polynomial functions that form parabolic graphs. Key concepts include: discriminant analysis (b² - 4ac) to determine solution types, vertex form for optimization problems, and applications in physics for projectile motion. Solutions are found through factoring, completing the square, or the quadratic formula: x = (-b ± √(b² - 4ac)) / 2a.",
      advanced: "Quadratic equations encompass a fundamental class of second-degree polynomial functions with extensive applications across mathematics and physics. The general form ax² + bx + c = 0 exhibits rich mathematical properties including discriminant analysis for solution classification, transformation techniques for vertex and standard forms, and connections to conic sections. Advanced topics include complex solutions, optimization applications, and relationships to quadratic inequalities and systems of equations."
    },
    'Photosynthesis': {
      basic: "Photosynthesis is the process by which plants make their own food using sunlight, water, and carbon dioxide. It produces glucose (sugar) and oxygen. This process happens mainly in the leaves and is essential for life on Earth.",
      medium: "Photosynthesis is a complex biochemical process occurring in chloroplasts, involving light-dependent and light-independent reactions. The overall equation is: 6CO₂ + 6H₂O + light energy → C₆H₁₂O₆ + 6O₂. Light reactions occur in thylakoids producing ATP and NADPH, while the Calvin cycle in the stroma fixes CO₂ into glucose.",
      advanced: "Photosynthesis encompasses two interconnected stages: the photo-dependent reactions in thylakoid membranes and the Calvin-Benson cycle in the chloroplast stroma. Z-scheme electron transport, photosystems I and II, cyclic and non-cyclic phosphorylation, and the intricate regulation of RuBisCO activity demonstrate the sophisticated molecular machinery that converts light energy into chemical bonds, driving virtually all terrestrial ecosystems."
    }
  };

  return summaries[topic]?.[difficulty] || summaries[topic]?.medium || 
    `This is an AI-generated summary for ${topic} in ${subject}. The content would be tailored to ${difficulty} level understanding with comprehensive explanations and examples.`;
}

async function generateMindMap(topic, subject, difficulty) {
  // Mock mind map structure
  const mindMaps = {
    'Quadratic Equations': {
      center: 'Quadratic Equations',
      branches: [
        {
          name: 'Standard Form',
          children: ['ax² + bx + c = 0', 'a ≠ 0', 'Degree 2']
        },
        {
          name: 'Solutions',
          children: ['Factoring', 'Quadratic Formula', 'Completing Square', 'Graphing']
        },
        {
          name: 'Discriminant',
          children: ['b² - 4ac', 'Real Solutions', 'Complex Solutions', 'One Solution']
        },
        {
          name: 'Applications',
          children: ['Projectile Motion', 'Optimization', 'Area Problems']
        }
      ]
    },
    'Photosynthesis': {
      center: 'Photosynthesis',
      branches: [
        {
          name: 'Light Reactions',
          children: ['Photosystem I', 'Photosystem II', 'ATP', 'NADPH']
        },
        {
          name: 'Calvin Cycle',
          children: ['CO₂ Fixation', 'RuBisCO', 'Glucose Production']
        },
        {
          name: 'Requirements',
          children: ['Sunlight', 'CO₂', 'H₂O', 'Chlorophyll']
        },
        {
          name: 'Products',
          children: ['Glucose', 'Oxygen', 'ATP']
        }
      ]
    }
  };

  return mindMaps[topic] || {
    center: topic,
    branches: [
      { name: 'Key Concepts', children: ['Concept 1', 'Concept 2', 'Concept 3'] },
      { name: 'Applications', children: ['Application 1', 'Application 2'] },
      { name: 'Examples', children: ['Example 1', 'Example 2'] }
    ]
  };
}

async function generateFlashcards(topic, subject, difficulty) {
  const flashcards = [
    {
      id: 1,
      front: `What is the general form of a quadratic equation?`,
      back: `ax² + bx + c = 0, where a ≠ 0`
    },
    {
      id: 2,
      front: `What is the discriminant in a quadratic equation?`,
      back: `b² - 4ac, which determines the nature of the roots`
    },
    {
      id: 3,
      front: `What does the quadratic formula solve?`,
      back: `x = (-b ± √(b² - 4ac)) / 2a`
    }
  ];

  return flashcards;
}

async function generateQuiz(topic, subject, difficulty) {
  const quiz = {
    title: `${topic} - ${subject} Quiz`,
    questions: [
      {
        id: 1,
        question: "What is the standard form of a quadratic equation?",
        options: ["ax + b = 0", "ax² + bx + c = 0", "ax³ + bx² + cx + d = 0", "ax² + b = 0"],
        correct: 1,
        explanation: "The standard form of a quadratic equation is ax² + bx + c = 0 where a ≠ 0."
      },
      {
        id: 2,
        question: "If the discriminant is negative, what type of roots does the equation have?",
        options: ["Two real roots", "One real root", "No real roots", "Infinite roots"],
        correct: 2,
        explanation: "When the discriminant (b² - 4ac) is negative, the quadratic equation has no real roots, only complex roots."
      }
    ]
  };

  return quiz;
}

async function generateExplanation(topic, subject, difficulty) {
  return {
    topic,
    explanation: `A comprehensive explanation of ${topic} in ${subject}, tailored for ${difficulty} level learning with step-by-step breakdowns and practical examples.`,
    examples: [
      "Example 1: Basic application",
      "Example 2: Intermediate problem",
      "Example 3: Advanced scenario"
    ],
    keyPoints: [
      "Key concept 1",
      "Key concept 2", 
      "Key concept 3"
    ]
  };
}

module.exports = router;
