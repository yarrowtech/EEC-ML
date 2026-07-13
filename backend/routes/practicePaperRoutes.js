const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const PracticePaper = require('../models/PracticePaper');
const Class = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const authTeacher = require('../middleware/authTeacher');
const authStudent = require('../middleware/authStudent');
const StudentUser = require('../models/StudentUser');

// Helper: Resolve denormalized names
const resolveDenormalizedNames = async (classId, sectionId, subjectId) => {
  const result = {};

  if (classId) {
    const classDoc = await Class.findById(classId).lean();
    result.className = classDoc ? classDoc.name : '';
  }

  if (sectionId) {
    const sectionDoc = await Section.findById(sectionId).lean();
    result.sectionName = sectionDoc ? sectionDoc.name : '';
  }

  if (subjectId) {
    const subjectDoc = await Subject.findById(subjectId).lean();
    result.subjectName = subjectDoc ? subjectDoc.name : '';
  }

  return result;
};

// Helper: Grade a practice paper
const gradePaper = (paper, answers) => {
  let totalMarks = 0;
  let marksObtained = 0;
  const gradedAnswers = [];

  paper.questions.forEach((question, idx) => {
    const studentAnswer = answers[idx];
    const marks = question.marks || 1;
    totalMarks += marks;

    let isCorrect = false;

    if (question.questionType === 'mcq') {
      const selectedOption = question.options[studentAnswer];
      isCorrect = selectedOption && selectedOption.isCorrect;
    } else if (question.questionType === 'true_false') {
      isCorrect = studentAnswer === question.correctAnswer;
    } else if (question.questionType === 'blank' || question.questionType === 'short_answer') {
      // Case-insensitive comparison
      isCorrect = studentAnswer && studentAnswer.toLowerCase().trim() ===
        question.correctAnswer.toLowerCase().trim();
    } else if (question.questionType === 'essay') {
      // Essays need manual grading
      isCorrect = false;
    }

    const marksForThisQuestion = isCorrect ? marks : 0;
    marksObtained += marksForThisQuestion;

    gradedAnswers.push({
      questionIndex: idx,
      selectedAnswer: studentAnswer,
      isCorrect,
      marksObtained: marksForThisQuestion
    });
  });

  return {
    marksObtained,
    totalMarks,
    percentage: totalMarks > 0 ? Math.round((marksObtained / totalMarks) * 100) : 0,
    isPassed: totalMarks > 0 ? (marksObtained / totalMarks) * 100 >= (paper.passingPercentage || 40) : false,
    answers: gradedAnswers
  };
};

// ===== TEACHER ROUTES =====

// CREATE: Create new practice paper
router.post('/', authTeacher, async (req, res, next) => {
  try {
    const {
      title,
      description,
      paperType,
      classId,
      sectionId,
      subjectId,
      questions,
      duration,
      difficulty,
      tags,
      chapter,
      unit,
      topics,
      passingPercentage,
      showCorrectAnswers,
      allowRetakes,
      shuffleQuestions,
      status
    } = req.body;

    // Validate required fields
    if (!title || !classId || !sectionId) {
      return res.status(400).json({
        success: false,
        message: 'Title, classId, and sectionId are required'
      });
    }

    // Validate questions
    if (!Array.isArray(questions) || questions.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'At least one question is required'
      });
    }

    // Resolve denormalized names
    const denormalized = await resolveDenormalizedNames(classId, sectionId, subjectId);

    const paperData = {
      schoolId: req.schoolId,
      title: title.trim(),
      description: description || '',
      paperType: paperType || 'practice_set',
      classId,
      sectionId,
      subjectId: subjectId || null,
      ...denormalized,
      teacherId: req.userId,
      teacherName: req.userDetails?.name || 'Teacher',
      questions,
      duration: duration || 0,
      difficulty: difficulty || 'medium',
      tags: tags || [],
      chapter: chapter || '',
      unit: unit || '',
      topics: topics || [],
      passingPercentage: passingPercentage || 40,
      showCorrectAnswers: showCorrectAnswers !== false,
      allowRetakes: allowRetakes !== false,
      shuffleQuestions: shuffleQuestions || false,
      status: status || 'draft'
    };

    const paper = new PracticePaper(paperData);
    await paper.save();

    res.status(201).json({
      success: true,
      message: 'Practice paper created successfully',
      paper
    });
  } catch (error) {
    console.error('Error creating practice paper:', error);
    next(error);
  }
});

// LIST: Get teacher's practice papers
router.get('/teacher', authTeacher, async (req, res, next) => {
  try {
    const { status, classId, subjectId, paperType, page = 1, limit = 20 } = req.query;

    const filters = {
      teacherId: req.userId,
      schoolId: req.schoolId
    };

    if (status) filters.status = status;
    if (classId) filters.classId = new mongoose.Types.ObjectId(classId);
    if (subjectId) filters.subjectId = new mongoose.Types.ObjectId(subjectId);
    if (paperType) filters.paperType = paperType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const papers = await PracticePaper.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await PracticePaper.countDocuments(filters);

    res.json({
      success: true,
      papers,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching papers:', error);
    next(error);
  }
});

// GET SINGLE: Get paper by ID
router.get('/:id', authTeacher, async (req, res, next) => {
  try {
    const paper = await PracticePaper.findOne({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Practice paper not found'
      });
    }

    res.json({
      success: true,
      paper
    });
  } catch (error) {
    console.error('Error fetching paper:', error);
    next(error);
  }
});

// UPDATE: Update practice paper
router.patch('/:id', authTeacher, async (req, res, next) => {
  try {
    const { title, description, questions, tags, difficulty, duration, passingPercentage, status } = req.body;

    const paper = await PracticePaper.findOne({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Practice paper not found'
      });
    }

    // Update allowed fields
    if (title) paper.title = title.trim();
    if (description !== undefined) paper.description = description;
    if (questions) paper.questions = questions;
    if (tags) paper.tags = tags;
    if (difficulty) paper.difficulty = difficulty;
    if (duration !== undefined) paper.duration = duration;
    if (passingPercentage !== undefined) paper.passingPercentage = passingPercentage;
    if (status) paper.status = status;

    await paper.save();

    res.json({
      success: true,
      message: 'Practice paper updated successfully',
      paper
    });
  } catch (error) {
    console.error('Error updating paper:', error);
    next(error);
  }
});

// DELETE: Delete practice paper
router.delete('/:id', authTeacher, async (req, res, next) => {
  try {
    const paper = await PracticePaper.findOneAndDelete({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Practice paper not found'
      });
    }

    res.json({
      success: true,
      message: 'Practice paper deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting paper:', error);
    next(error);
  }
});

// PUBLISH: Publish practice paper
router.post('/:id/publish', authTeacher, async (req, res, next) => {
  try {
    const paper = await PracticePaper.findOne({
      _id: req.params.id,
      teacherId: req.userId,
      schoolId: req.schoolId
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Practice paper not found'
      });
    }

    paper.status = 'published';
    paper.publishedAt = new Date();
    await paper.save();

    res.json({
      success: true,
      message: 'Practice paper published successfully',
      paper
    });
  } catch (error) {
    console.error('Error publishing paper:', error);
    next(error);
  }
});

// ===== STUDENT ROUTES =====

// StudentUser stores the class name in `grade` and the section name in
// `section`; some records may also carry classId/sectionId. Papers are
// matched on whichever identifiers the student actually has.
const buildStudentPaperAccess = (student) => {
  const conditions = [];
  if (student.classId && student.sectionId) {
    conditions.push({ classId: student.classId, sectionId: student.sectionId });
  }
  const className = String(student.className || student.grade || '').trim();
  const sectionName = String(student.sectionName || student.section || '').trim();
  if (className) {
    conditions.push(sectionName ? { className, sectionName } : { className });
  }
  return conditions.length ? { $or: conditions } : null;
};

// LIST: Get available practice papers
router.get('/student/papers', authStudent, async (req, res, next) => {
  try {
    const { subject, paperType, page = 1, limit = 20 } = req.query;

    // Get student's class and section
    const student = await StudentUser.findById(req.userId).lean();
    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const classAccessFilter = buildStudentPaperAccess(student);
    if (!classAccessFilter) {
      return res.json({ success: true, papers: [], total: 0, page: 1, limit: parseInt(limit), pages: 0 });
    }

    const filters = {
      schoolId: req.schoolId,
      status: 'published',
      $and: [
        classAccessFilter,
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: { $gt: new Date() } }
          ]
        }
      ]
    };

    if (subject && mongoose.Types.ObjectId.isValid(subject)) filters.subjectId = new mongoose.Types.ObjectId(subject);
    if (paperType) filters.paperType = paperType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const papers = await PracticePaper.find(filters)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .select('-studentAttempts -questions') // Don't send full questions/answers list initially
      .lean();

    const total = await PracticePaper.countDocuments(filters);

    res.json({
      success: true,
      papers,
      total,
      page: parseInt(page),
      limit: parseInt(limit),
      pages: Math.ceil(total / parseInt(limit))
    });
  } catch (error) {
    console.error('Error fetching papers:', error);
    next(error);
  }
});

// GET SINGLE: Get paper details to start attempt
router.get('/student/papers/:id', authStudent, async (req, res, next) => {
  try {
    const student = await StudentUser.findById(req.userId).lean();
    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const paper = await PracticePaper.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      status: 'published',
      $or: [
        { classId: student.classId, sectionId: student.sectionId },
        { className: student.className, sectionName: student.sectionName }
      ]
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Practice paper not found'
      });
    }

    // Check if expired
    if (paper.expiresAt && new Date() > paper.expiresAt) {
      return res.status(404).json({
        success: false,
        message: 'Practice paper has expired'
      });
    }

    // Prepare questions for student (hide answers initially if configured)
    const questionsForStudent = paper.questions.map((q, idx) => ({
      _id: idx,
      questionText: q.questionText,
      questionType: q.questionType,
      options: q.options.map(o => ({ text: o.text })), // Don't send isCorrect
      marks: q.marks,
      difficulty: q.difficulty,
      // Don't send correctAnswer and explanation
    }));

    const paperResponse = paper.toObject();
    paperResponse.questions = questionsForStudent;

    res.json({
      success: true,
      paper: paperResponse
    });
  } catch (error) {
    console.error('Error fetching paper:', error);
    next(error);
  }
});

// SUBMIT: Submit practice paper attempt
router.post('/student/papers/:id/submit', authStudent, async (req, res, next) => {
  try {
    const { answers, timeSpent } = req.body;

    if (!Array.isArray(answers)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid answers format'
      });
    }

    const student = await StudentUser.findById(req.userId).lean();
    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const paper = await PracticePaper.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      status: 'published',
      $or: [
        { classId: student.classId, sectionId: student.sectionId },
        { className: student.className, sectionName: student.sectionName }
      ]
    });

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Practice paper not found'
      });
    }

    // Check if expired
    if (paper.expiresAt && new Date() > paper.expiresAt) {
      return res.status(404).json({
        success: false,
        message: 'Practice paper has expired'
      });
    }

    // Check if retakes allowed
    const previousAttempts = paper.studentAttempts.filter(
      a => a.studentId.toString() === req.userId
    );

    if (previousAttempts.length > 0 && !paper.allowRetakes) {
      return res.status(400).json({
        success: false,
        message: 'Retakes are not allowed for this paper'
      });
    }

    // Grade the paper
    const gradeResult = gradePaper(paper, answers);

    // Create attempt record
    const attemptNumber = previousAttempts.length + 1;
    const newAttempt = {
      studentId: req.userId,
      attemptNumber,
      score: gradeResult.percentage,
      marksObtained: gradeResult.marksObtained,
      totalMarks: gradeResult.totalMarks,
      percentage: gradeResult.percentage,
      isPassed: gradeResult.isPassed,
      answers: gradeResult.answers,
      startedAt: new Date(),
      submittedAt: new Date(),
      timeSpent: timeSpent || 0
    };

    paper.studentAttempts.push(newAttempt);
    paper.attempts = (paper.attempts || 0) + 1;

    // Update or add to attemptedBy tracking
    const attemptedByIndex = paper.attemptedBy.findIndex(
      a => a.studentId.toString() === req.userId
    );

    if (attemptedByIndex >= 0) {
      paper.attemptedBy[attemptedByIndex].attemptCount += 1;
      paper.attemptedBy[attemptedByIndex].lastAttemptedAt = new Date();
      if (!paper.attemptedBy[attemptedByIndex].bestScore || gradeResult.percentage > paper.attemptedBy[attemptedByIndex].bestScore) {
        paper.attemptedBy[attemptedByIndex].bestScore = gradeResult.percentage;
      }
    } else {
      paper.attemptedBy.push({
        studentId: req.userId,
        attemptCount: 1,
        lastAttemptedAt: new Date(),
        bestScore: gradeResult.percentage
      });
    }

    await paper.save();

    // Prepare response
    const responseData = {
      success: true,
      message: 'Paper submitted successfully',
      result: {
        attemptNumber,
        marksObtained: gradeResult.marksObtained,
        totalMarks: gradeResult.totalMarks,
        percentage: gradeResult.percentage,
        isPassed: gradeResult.isPassed,
        timeSpent
      }
    };

    // Include answer feedback if configured
    if (paper.showCorrectAnswers) {
      responseData.result.answers = gradeResult.answers.map((ans, idx) => ({
        questionIndex: idx,
        selectedAnswer: ans.selectedAnswer,
        isCorrect: ans.isCorrect,
        marksObtained: ans.marksObtained,
        correctAnswer: paper.questions[idx].correctAnswer,
        explanation: paper.questions[idx].explanation
      }));
    }

    res.json(responseData);
  } catch (error) {
    console.error('Error submitting paper:', error);
    next(error);
  }
});

// GET RESULTS: Get student's attempt history
router.get('/student/papers/:id/attempts', authStudent, async (req, res, next) => {
  try {
    const student = await StudentUser.findById(req.userId).lean();
    if (!student) {
      return res.status(400).json({
        success: false,
        message: 'Student profile not found'
      });
    }

    const paper = await PracticePaper.findOne({
      _id: req.params.id,
      schoolId: req.schoolId,
      status: 'published',
      $or: [
        { classId: student.classId, sectionId: student.sectionId },
        { className: student.className, sectionName: student.sectionName }
      ]
    }).lean();

    if (!paper) {
      return res.status(404).json({
        success: false,
        message: 'Practice paper not found'
      });
    }

    const studentAttempts = paper.studentAttempts.filter(
      a => a.studentId.toString() === req.userId
    );

    res.json({
      success: true,
      attempts: studentAttempts.map(a => ({
        attemptNumber: a.attemptNumber,
        score: a.percentage,
        marksObtained: a.marksObtained,
        totalMarks: a.totalMarks,
        isPassed: a.isPassed,
        submittedAt: a.submittedAt,
        timeSpent: a.timeSpent
      }))
    });
  } catch (error) {
    console.error('Error fetching attempts:', error);
    next(error);
  }
});

module.exports = router;
