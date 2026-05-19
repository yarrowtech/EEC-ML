const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const TeachingMaterial = require('../models/TeachingMaterial');
const StudentUser = require('../models/StudentUser');
const authStudent = require('../middleware/authStudent');

// Middleware to ensure student is authenticated
router.use(authStudent);

// Helper: Get student's class and section
const getStudentClassSection = async (studentId) => {
  const student = await StudentUser.findById(studentId).lean();
  if (!student) return null;
  return {
    className: student.className,
    sectionName: student.sectionName,
    classId: student.classId,
    sectionId: student.sectionId
  };
};

// LIST: Get all available materials for student
router.get('/', async (req, res, next) => {
  try {
    const { subject, category, tags, search, page = 1, limit = 20 } = req.query;

    // Get student's class and section
    const studentInfo = await getStudentClassSection(req.userId);
    if (!studentInfo) {
      return res.status(400).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const accessFilters = [
      { classId: studentInfo.classId, sectionId: studentInfo.sectionId },
      { className: studentInfo.className, sectionName: studentInfo.sectionName }
    ];

    const filters = {
      schoolId: req.schoolId,
      status: 'published',
      materialType: { $ne: 'folder' },
      $and: [
        { $or: accessFilters },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
          ]
        }
      ]
    };

    // Apply optional filters
    if (subject && mongoose.Types.ObjectId.isValid(subject)) filters.subjectId = new mongoose.Types.ObjectId(subject);
    if (category) filters.category = category;
    if (tags) {
      const tagArray = Array.isArray(tags) ? tags : [tags];
      filters.tags = { $in: tagArray };
    }

    // Text search
    if (search) {
      filters.$text = { $search: search };
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const materials = await TeachingMaterial.find(filters)
      .sort({ isPinned: -1, createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('+title +content +attachments +createdAt +teacherName +subjectName +priority +typeLabel')
      .lean();

    const total = await TeachingMaterial.countDocuments(filters);

    res.json({
      success: true,
      materials,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching student materials:', error);
    next(error);
  }
});

// GET: Get single material details
router.get('/:id', async (req, res, next) => {
  try {
    const studentInfo = await getStudentClassSection(req.userId);
    if (!studentInfo) {
      return res.status(400).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      status: 'published',
      materialType: { $ne: 'folder' },
      $or: [
        { classId: studentInfo.classId, sectionId: studentInfo.sectionId },
        { className: studentInfo.className, sectionName: studentInfo.sectionName }
      ]
    }).lean();

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found or not accessible'
      });
    }

    // Check if expired
    if (material.expiresAt && new Date() > material.expiresAt) {
      return res.status(404).json({
        success: false,
        message: 'Material has expired'
      });
    }

    res.json({
      success: true,
      material
    });
  } catch (error) {
    console.error('Error fetching material:', error);
    next(error);
  }
});

// TRACK VIEW: Record when student views material
router.post('/:id/view', async (req, res, next) => {
  try {
    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      status: 'published'
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Check if student already viewed this material
    const existingView = material.viewedBy.find(
      v => v.studentId.toString() === req.userId
    );

    if (existingView) {
      // Update existing view
      existingView.viewCount += 1;
      existingView.lastViewedAt = new Date();
      existingView.timeSpent = req.body.timeSpent || existingView.timeSpent;
    } else {
      // Add new view
      material.viewedBy.push({
        studentId: req.userId,
        viewCount: 1,
        firstViewedAt: new Date(),
        lastViewedAt: new Date(),
        timeSpent: req.body.timeSpent || 0
      });
    }

    // Update total views
    material.views = material.viewedBy.reduce((sum, v) => sum + v.viewCount, 0);

    await material.save();

    res.json({
      success: true,
      message: 'View recorded'
    });
  } catch (error) {
    console.error('Error recording view:', error);
    next(error);
  }
});

// TRACK DOWNLOAD: Record when student downloads file
router.post('/:id/download', async (req, res, next) => {
  try {
    const { attachmentName } = req.body;

    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      status: 'published'
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Check if student already downloaded
    const existingDownload = material.downloadedBy.find(
      d => d.studentId.toString() === req.userId && d.attachmentName === attachmentName
    );

    if (existingDownload) {
      existingDownload.downloadCount += 1;
      existingDownload.lastDownloadedAt = new Date();
    } else {
      material.downloadedBy.push({
        studentId: req.userId,
        downloadCount: 1,
        lastDownloadedAt: new Date(),
        attachmentName: attachmentName || 'unknown'
      });
    }

    // Update total downloads
    material.downloads = material.downloadedBy.length;

    await material.save();

    res.json({
      success: true,
      message: 'Download recorded'
    });
  } catch (error) {
    console.error('Error recording download:', error);
    next(error);
  }
});

// MARK COMPLETE: Student marks material as complete
router.post('/:id/complete', async (req, res, next) => {
  try {
    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      status: 'published'
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    // Check if already completed
    const existingCompletion = material.completedBy.find(
      c => c.studentId.toString() === req.userId
    );

    if (!existingCompletion) {
      material.completedBy.push({
        studentId: req.userId,
        completedAt: new Date()
      });
    }

    await material.save();

    res.json({
      success: true,
      message: 'Material marked as complete'
    });
  } catch (error) {
    console.error('Error marking complete:', error);
    next(error);
  }
});

// QUIZ: Start quiz attempt
router.post('/:id/quiz/attempt', async (req, res, next) => {
  try {
    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      hasQuiz: true,
      status: 'published'
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Get quiz config
    const quiz = material.quiz;
    if (!quiz) {
      return res.status(400).json({
        success: false,
        message: 'Quiz not properly configured'
      });
    }

    // Check if student already has a pending attempt
    const pendingAttempt = material.quizAttempts.find(
      qa => qa.studentId.toString() === req.userId && !qa.submittedAt
    );

    if (pendingAttempt && material.quiz.allowRetakes === false) {
      return res.status(400).json({
        success: false,
        message: 'You have already attempted this quiz'
      });
    }

    // Create new attempt
    const attemptNumber = material.quizAttempts.filter(
      qa => qa.studentId.toString() === req.userId
    ).length + 1;

    const newAttempt = {
      studentId: req.userId,
      attemptNumber,
      score: 0,
      totalQuestions: quiz.questions ? quiz.questions.length : 0,
      correctAnswers: 0,
      answers: [],
      startedAt: new Date(),
      submittedAt: null,
      timeSpent: 0
    };

    material.quizAttempts.push(newAttempt);
    await material.save();

    // Return quiz questions (without answers revealed)
    const questionsForStudent = quiz.questions.map(q => ({
      _id: q._id,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options.map(o => ({
        text: o.text
        // Don't send isCorrect
      })),
      points: q.points
    }));

    res.status(201).json({
      success: true,
      message: 'Quiz attempt started',
      quiz: {
        title: quiz.title,
        description: quiz.description,
        timeLimit: quiz.timeLimit,
        passingScore: quiz.passingScore,
        questions: questionsForStudent
      },
      attemptNumber
    });
  } catch (error) {
    console.error('Error starting quiz:', error);
    next(error);
  }
});

// QUIZ: Submit quiz attempt
router.post('/:id/quiz/submit', async (req, res, next) => {
  try {
    const { answers, timeSpent } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid answers format'
      });
    }

    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      hasQuiz: true,
      status: 'published'
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Quiz not found'
      });
    }

    // Find the latest attempt for this student
    const quizAttempts = material.quizAttempts.filter(
      qa => qa.studentId.toString() === req.userId
    );

    if (quizAttempts.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No active quiz attempt found'
      });
    }

    const attemptIndex = material.quizAttempts.length - 1;
    const attempt = material.quizAttempts[attemptIndex];

    // Check time limit
    if (material.quiz.timeLimit && timeSpent > material.quiz.timeLimit * 60) {
      attempt.submittedAt = new Date();
      await material.save();
      return res.status(400).json({
        success: false,
        message: 'Time limit exceeded'
      });
    }

    // Grade the quiz
    let correctCount = 0;
    let totalPoints = 0;

    answers.forEach((answerData, index) => {
      const question = material.quiz.questions[index];
      if (!question) return;

      const isCorrect = gradeAnswer(question, answerData.selectedAnswer);
      const pointsEarned = isCorrect ? question.points : 0;

      attempt.answers.push({
        questionIndex: index,
        selectedAnswer: answerData.selectedAnswer,
        isCorrect,
        pointsEarned
      });

      if (isCorrect) correctCount++;
      totalPoints += pointsEarned;
    });

    // Calculate score
    const maxPoints = material.quiz.questions.reduce((sum, q) => sum + q.points, 0);
    const scorePercentage = maxPoints > 0 ? Math.round((totalPoints / maxPoints) * 100) : 0;

    attempt.score = scorePercentage;
    attempt.correctAnswers = correctCount;
    attempt.submittedAt = new Date();
    attempt.timeSpent = timeSpent || 0;

    // Mark as completed if passed
    if (scorePercentage >= material.quiz.passingScore) {
      const existingCompletion = material.completedBy.find(
        c => c.studentId.toString() === req.userId
      );
      if (!existingCompletion) {
        material.completedBy.push({
          studentId: req.userId,
          completedAt: new Date(),
          quizScore: scorePercentage,
          quizAttempts: quizAttempts.length
        });
      }
    }

    await material.save();

    // Prepare response
    const responseData = {
      success: true,
      message: 'Quiz submitted successfully',
      result: {
        score: scorePercentage,
        correctAnswers: correctCount,
        totalQuestions: material.quiz.questions.length,
        passed: scorePercentage >= material.quiz.passingScore,
        passingScore: material.quiz.passingScore,
        timeSpent
      }
    };

    // Include correct answers if configured
    if (material.quiz.showCorrectAnswers) {
      responseData.result.answers = attempt.answers.map((ans, idx) => ({
        questionIndex: idx,
        selectedAnswer: ans.selectedAnswer,
        isCorrect: ans.isCorrect,
        explanation: material.quiz.questions[idx].explanation
      }));
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error submitting quiz:', error);
    next(error);
  }
});

// HELPER: Grade answer based on question type
const gradeAnswer = (question, selectedAnswer) => {
  if (question.questionType === 'multiple_choice') {
    // selectedAnswer should be the option text or index
    if (typeof selectedAnswer === 'number') {
      return question.options[selectedAnswer]?.isCorrect || false;
    }
    return question.options.some(o => o.text === selectedAnswer && o.isCorrect);
  } else if (question.questionType === 'true_false') {
    return selectedAnswer === question.correctAnswer;
  } else if (question.questionType === 'short_answer') {
    // Case-insensitive comparison for short answers
    return selectedAnswer.toLowerCase().trim() === question.correctAnswer.toLowerCase().trim();
  }
  return false;
};

// POLL: Vote on poll
router.post('/:id/poll/vote', async (req, res, next) => {
  try {
    const { selectedOptions } = req.body;

    if (!Array.isArray(selectedOptions)) {
      return res.status(400).json({
        success: false,
        message: 'selectedOptions must be an array'
      });
    }

    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      hasPoll: true,
      status: 'published'
    });

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Poll not found'
      });
    }

    const poll = material.poll;

    // Check if student already voted
    const existingVote = poll.responses.find(
      r => r.studentId.toString() === req.userId
    );

    if (existingVote) {
      return res.status(400).json({
        success: false,
        message: 'You have already voted on this poll'
      });
    }

    // Validate options
    if (!poll.allowMultiple && selectedOptions.length > 1) {
      return res.status(400).json({
        success: false,
        message: 'Multiple selections not allowed for this poll'
      });
    }

    // Update vote counts
    selectedOptions.forEach(optionIndex => {
      if (poll.options[optionIndex]) {
        poll.options[optionIndex].votes += 1;
      }
    });

    // Record response
    poll.responses.push({
      studentId: req.userId,
      selectedOptions,
      respondedAt: new Date()
    });

    await material.save();

    // Return updated poll results
    const results = {
      question: poll.question,
      totalVotes: poll.responses.length,
      options: poll.options.map((opt, idx) => ({
        text: opt.text,
        votes: opt.votes,
        percentage: Math.round((opt.votes / poll.responses.length) * 100) || 0
      }))
    };

    res.json({
      success: true,
      message: 'Vote recorded',
      results
    });
  } catch (error) {
    console.error('Error voting on poll:', error);
    next(error);
  }
});

// GET: Get quiz history for student
router.get('/:id/quiz/attempts', async (req, res, next) => {
  try {
    const material = await TeachingMaterial.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      hasQuiz: true,
      status: 'published'
    }).lean();

    if (!material) {
      return res.status(404).json({
        success: false,
        message: 'Material not found'
      });
    }

    const studentAttempts = material.quizAttempts.filter(
      qa => qa.studentId.toString() === req.userId
    );

    res.json({
      success: true,
      attempts: studentAttempts.map(a => ({
        attemptNumber: a.attemptNumber,
        score: a.score,
        correctAnswers: a.correctAnswers,
        totalQuestions: a.totalQuestions,
        submittedAt: a.submittedAt,
        timeSpent: a.timeSpent
      }))
    });
  } catch (error) {
    console.error('Error fetching quiz attempts:', error);
    next(error);
  }
});

module.exports = router;
