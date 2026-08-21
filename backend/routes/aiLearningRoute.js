const express = require('express');
const router = express.Router();
const StudentProgress = require('../models/StudentProgress');
const StudentUser = require('../models/StudentUser');
const adminAuth = require('../middleware/adminAuth');
const authTeacher = require('../middleware/authTeacher');

const resolveSchoolId = (req, res) => {
  const schoolId = req.schoolId || req.admin?.schoolId || null;
  if (!schoolId) {
    res.status(400).json({ error: 'schoolId is required' });
    return null;
  }
  return schoolId;
};

// Analyze student weakness and identify weak students
router.post('/analyze-weakness/:studentId', authTeacher, async (req, res) => {
  // #swagger.tags = ['AI Learning']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { studentId } = req.params;
    const { subject } = req.body;

    const progress = await StudentProgress.findOne({ studentId, schoolId });
    if (!progress) {
      return res.status(404).json({ error: 'Student progress not found' });
    }

    const analysis = await analyzeStudentWeakness(progress, subject);
    
    // Update the progress record with weakness analysis
    const existingAnalysisIndex = progress.weaknessAnalysis.findIndex(w => w.subject === subject);
    if (existingAnalysisIndex >= 0) {
      progress.weaknessAnalysis[existingAnalysisIndex] = analysis;
    } else {
      progress.weaknessAnalysis.push(analysis);
    }

    // Determine if student is weak based on consistency scores
    const averageConsistency = progress.weaknessAnalysis.reduce((sum, w) => sum + w.consistencyScore, 0) / progress.weaknessAnalysis.length;
    progress.isWeakStudent = averageConsistency < 60; // Threshold for weak student identification
    progress.needsIntervention = averageConsistency < 40;
    
    // Set intervention level
    if (averageConsistency < 25) progress.interventionLevel = 'critical';
    else if (averageConsistency < 40) progress.interventionLevel = 'high';
    else if (averageConsistency < 60) progress.interventionLevel = 'medium';
    else progress.interventionLevel = 'low';

    progress.lastUpdated = new Date();
    await progress.save();

    res.status(200).json({ 
      message: 'Weakness analysis completed', 
      analysis,
      isWeakStudent: progress.isWeakStudent,
      interventionLevel: progress.interventionLevel
    });
  } catch (error) {
    console.error('Error analyzing weakness:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get all weak students
router.get('/weak-students', adminAuth, async (req, res) => {
  // #swagger.tags = ['AI Learning']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { grade, section, subject, interventionLevel } = req.query;
    
    let studentFilter = { schoolId };
    if (grade) studentFilter.grade = grade;
    if (section) studentFilter.section = section;

    const students = await StudentUser.find(studentFilter).select('name grade section roll');
    const studentIds = students.map(student => student._id);

    let progressFilter = { 
      studentId: { $in: studentIds },
      isWeakStudent: true,
      schoolId
    };

    if (interventionLevel) {
      progressFilter.interventionLevel = interventionLevel;
    }

    const weakStudents = await StudentProgress.find(progressFilter)
      .populate('studentId', 'name grade section roll email')
      .lean();

    // Filter by subject if specified
    let filteredStudents = weakStudents;
    if (subject) {
      filteredStudents = weakStudents.filter(student => 
        student.weaknessAnalysis.some(analysis => analysis.subject === subject)
      );
    }

    // Add detailed analysis for each student
    const detailedAnalysis = filteredStudents.map(student => {
      const subjectAnalysis = subject 
        ? student.weaknessAnalysis.find(w => w.subject === subject)
        : student.weaknessAnalysis[0]; // Get first analysis if no subject specified

      return {
        ...student,
        focusSubject: subjectAnalysis?.subject,
        consistencyScore: subjectAnalysis?.consistencyScore || 0,
        weakAreas: subjectAnalysis?.weakAreas || [],
        recommendedTopics: subjectAnalysis?.recommendedTopics || []
      };
    });

    res.status(200).json(detailedAnalysis);
  } catch (error) {
    console.error('Error fetching weak students:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Generate AI learning path for a student
router.post('/generate-learning-path/:studentId', authTeacher, async (req, res) => {
  // #swagger.tags = ['AI Learning']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { studentId } = req.params;
    const { subject, weakAreas, currentLevel } = req.body;

    const progress = await StudentProgress.findOne({ studentId, schoolId });
    if (!progress) {
      return res.status(404).json({ error: 'Student progress not found' });
    }

    // Generate personalized learning path
    const learningPath = await generateAILearningPath(subject, weakAreas, currentLevel);
    
    // Update or add learning path
    const existingPathIndex = progress.aiLearningPaths.findIndex(p => p.subject === subject);
    if (existingPathIndex >= 0) {
      progress.aiLearningPaths[existingPathIndex] = learningPath;
    } else {
      progress.aiLearningPaths.push(learningPath);
    }

    progress.lastUpdated = new Date();
    await progress.save();

    res.status(200).json({ 
      message: 'AI learning path generated successfully', 
      learningPath 
    });
  } catch (error) {
    console.error('Error generating learning path:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get learning path for a student
router.get('/learning-path/:studentId/:subject', adminAuth, async (req, res) => {
  // #swagger.tags = ['AI Learning']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { studentId, subject } = req.params;

    const progress = await StudentProgress.findOne({ studentId, schoolId })
      .populate('studentId', 'name grade section roll');
      
    if (!progress) {
      return res.status(404).json({ error: 'Student progress not found' });
    }

    const learningPath = progress.aiLearningPaths.find(p => p.subject === subject);
    if (!learningPath) {
      return res.status(404).json({ error: 'Learning path not found for this subject' });
    }

    res.status(200).json({ 
      student: progress.studentId,
      learningPath,
      weaknessAnalysis: progress.weaknessAnalysis.find(w => w.subject === subject)
    });
  } catch (error) {
    console.error('Error fetching learning path:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Update learning progress
router.put('/update-progress/:studentId/:subject', adminAuth, async (req, res) => {
  // #swagger.tags = ['AI Learning']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { studentId, subject } = req.params;
    const { topicCompleted, resourceCompleted, progressPercentage } = req.body;

    const progress = await StudentProgress.findOne({ studentId, schoolId });
    if (!progress) {
      return res.status(404).json({ error: 'Student progress not found' });
    }

    const learningPathIndex = progress.aiLearningPaths.findIndex(p => p.subject === subject);
    if (learningPathIndex === -1) {
      return res.status(404).json({ error: 'Learning path not found' });
    }

    const learningPath = progress.aiLearningPaths[learningPathIndex];

    if (topicCompleted && !learningPath.completedTopics.includes(topicCompleted)) {
      learningPath.completedTopics.push(topicCompleted);
    }

    if (progressPercentage !== undefined) {
      learningPath.progress = Math.min(100, Math.max(0, progressPercentage));
    }

    learningPath.lastAccessed = new Date();
    progress.lastUpdated = new Date();

    await progress.save();

    res.status(200).json({ 
      message: 'Learning progress updated successfully',
      updatedPath: learningPath
    });
  } catch (error) {
    console.error('Error updating learning progress:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Helper function to analyze student weakness
async function analyzeStudentWeakness(progress, subject) {
  const axios = require('axios');
  const AI_SERVICE_URL = process.env.AI_SERVICE_URL || 'http://localhost:8000';

  // Filter submissions that have a score
  const scoredSubs = (progress.submissions || []).filter(
    (sub) => sub.score !== undefined && sub.score !== null
  );

  if (scoredSubs.length < 3) {
    return {
      subject,
      consistencyScore: 50,
      weakAreas: ['Insufficient data for analysis'],
      recommendedTopics: ['Continue submitting assignments for better analysis'],
      aiRecommendations: null,
      difficultyLevel: 'intermediate',
      lastAnalyzed: new Date(),
    };
  }

  const scores = scoredSubs.map((s) => Number(s.score));
  const average = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const consistencyScore = Math.max(0, Math.round(100 - stdDev * 2));
  const difficultyLevel = average < 40 ? 'basic' : average < 70 ? 'intermediate' : 'advanced';

  // Build context for LLM — describe performance numerically
  const recentScores = scoredSubs.slice(-5).map((s) => s.score);
  const trend = recentScores.length >= 2
    ? recentScores[recentScores.length - 1] - recentScores[0]
    : 0;

  const context = [
    `Subject: ${subject}`,
    `Total assignments scored: ${scores.length}`,
    `Average score: ${Math.round(average)}%`,
    `Score consistency (lower stdDev = more consistent): ${Math.round(stdDev)}`,
    `Recent score trend (positive = improving): ${trend > 0 ? '+' : ''}${Math.round(trend)}`,
    `Performance level: ${difficultyLevel}`,
  ].join('\n');

  let aiRecommendations = null;
  try {
    const aiRes = await axios.post(
      `${AI_SERVICE_URL}/generate/teacher`,
      {
        mode: 'intervention_recommendation',
        subject,
        topic: 'Student Weakness Analysis',
        context,
      },
      { timeout: 60000 }
    );
    aiRecommendations = aiRes.data?.content || null;
  } catch (_) {
    // Non-blocking — fall back to null
  }

  const weakAreas = identifyWeakAreas(subject, average, stdDev);
  const recommendedTopics = getRecommendedTopics(subject, average, weakAreas);

  return {
    subject,
    consistencyScore,
    weakAreas,
    recommendedTopics,
    aiRecommendations,
    difficultyLevel,
    lastAnalyzed: new Date(),
  };
}

// Helper function to identify weak areas
function identifyWeakAreas(subject, average, standardDeviation) {
  const weakAreas = [];
  
  if (average < 60) weakAreas.push('Basic Concepts');
  if (standardDeviation > 20) weakAreas.push('Consistency in Performance');
  if (average < 40) weakAreas.push('Fundamental Understanding');

  // Subject-specific weak areas
  switch (subject.toLowerCase()) {
    case 'mathematics':
      if (average < 70) weakAreas.push('Problem Solving', 'Mathematical Reasoning');
      if (standardDeviation > 15) weakAreas.push('Calculation Accuracy');
      break;
    case 'physics':
      if (average < 70) weakAreas.push('Conceptual Understanding', 'Formula Application');
      break;
    case 'chemistry':
      if (average < 70) weakAreas.push('Chemical Equations', 'Molecular Concepts');
      break;
    case 'biology':
      if (average < 70) weakAreas.push('Biological Processes', 'Scientific Terminology');
      break;
  }

  return weakAreas.length > 0 ? weakAreas : ['General Improvement Needed'];
}

// Helper function to get recommended topics
function getRecommendedTopics(subject, average, weakAreas) {
  const topics = [];

  // Basic recommendations based on performance
  if (average < 40) {
    topics.push('Foundation Review', 'Basic Practice Exercises');
  } else if (average < 70) {
    topics.push('Intermediate Concepts', 'Practice Problems');
  }

  // Subject-specific recommendations
  switch (subject.toLowerCase()) {
    case 'mathematics':
      if (weakAreas.includes('Basic Concepts')) {
        topics.push('Number Systems', 'Basic Operations', 'Algebraic Expressions');
      }
      if (weakAreas.includes('Problem Solving')) {
        topics.push('Word Problems', 'Mathematical Logic', 'Step-by-step Solutions');
      }
      break;
    case 'physics':
      if (weakAreas.includes('Conceptual Understanding')) {
        topics.push('Physics Fundamentals', 'Laws of Motion', 'Energy Concepts');
      }
      break;
    case 'chemistry':
      if (weakAreas.includes('Chemical Equations')) {
        topics.push('Balancing Equations', 'Reaction Types', 'Stoichiometry');
      }
      break;
  }

  return topics;
}

// Helper function to determine difficulty level
function getDifficultyLevel(average) {
  if (average < 40) return 'basic';
  if (average < 70) return 'intermediate';
  return 'advanced';
}

// Helper function to generate AI learning path
async function generateAILearningPath(subject, weakAreas, currentLevel) {
  const resources = generateLearningResources(subject, weakAreas, currentLevel);
  
  return {
    subject,
    currentTopic: resources[0]?.title || 'Getting Started',
    completedTopics: [],
    recommendedResources: resources,
    progress: 0,
    createdAt: new Date(),
    lastAccessed: null
  };
}

// Helper function to generate learning resources
function generateLearningResources(subject, weakAreas, level = 'intermediate') {
  const resources = [];
  
  // Subject-specific resources based on weak areas
  weakAreas.forEach(area => {
    switch (subject.toLowerCase()) {
      case 'mathematics':
        if (area.includes('Basic Concepts') || area.includes('Fundamental')) {
          resources.push({
            title: 'Mathematics Fundamentals',
            type: 'video',
            url: '/learning/math/fundamentals',
            difficulty: 'basic',
            estimatedTime: 30
          });
          resources.push({
            title: 'Basic Math Practice',
            type: 'practice',
            url: '/learning/math/basic-practice',
            difficulty: 'basic',
            estimatedTime: 45
          });
        }
        if (area.includes('Problem Solving')) {
          resources.push({
            title: 'Problem Solving Strategies',
            type: 'interactive',
            url: '/learning/math/problem-solving',
            difficulty: level,
            estimatedTime: 60
          });
        }
        break;
        
      case 'physics':
        if (area.includes('Conceptual Understanding')) {
          resources.push({
            title: 'Physics Concepts Explained',
            type: 'video',
            url: '/learning/physics/concepts',
            difficulty: level,
            estimatedTime: 40
          });
        }
        break;
        
      case 'chemistry':
        if (area.includes('Chemical Equations')) {
          resources.push({
            title: 'Balancing Chemical Equations',
            type: 'interactive',
            url: '/learning/chemistry/equations',
            difficulty: level,
            estimatedTime: 50
          });
        }
        break;
    }
  });

  // Add general resources if no specific ones were added
  if (resources.length === 0) {
    resources.push({
      title: `${subject} Review`,
      type: 'video',
      url: `/learning/${subject.toLowerCase()}/review`,
      difficulty: level,
      estimatedTime: 30
    });
    resources.push({
      title: `${subject} Practice Quiz`,
      type: 'quiz',
      url: `/learning/${subject.toLowerCase()}/quiz`,
      difficulty: level,
      estimatedTime: 20
    });
  }

  return resources;
}

module.exports = router;
