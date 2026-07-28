const express = require('express');
const mongoose = require('mongoose');

const authTeacher = require('../middleware/authTeacher');
const authStudent = require('../middleware/authStudent');

const TeacherAllocation = require('../models/TeacherAllocation');
const PracticeQuestion = require('../models/PracticeQuestion');
const PracticeAttempt = require('../models/PracticeAttempt');
const StudentUser = require('../models/StudentUser');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const router = express.Router();

const isValidId = (value) => mongoose.isValidObjectId(value);

const buildCampusScope = (campusId) => {
  if (!campusId) return {};
  const values = [campusId];
  if (isValidId(campusId)) {
    values.push(new mongoose.Types.ObjectId(campusId));
  }
  return {
    $or: [
      { campusId: { $in: values } },
      { campusId: null },
      { campusId: { $exists: false } },
    ],
  };
};

const ensureTeacherAllocation = async ({ schoolId, campusId, teacherId, classId, sectionId, subjectId }) => {
  const allocation = await TeacherAllocation.findOne({
    schoolId,
    teacherId,
    classId,
    sectionId,
    subjectId,
    ...buildCampusScope(campusId),
  }).lean();
  if (allocation) return true;

  const timetableFilter = {
    schoolId,
    ...(campusId ? { campusId } : {}),
    classId,
    sectionId,
    'entries.teacherId': teacherId,
  };
  const timetable = await Timetable.findOne(timetableFilter)
    .select('entries')
    .populate('entries.subjectId', '_id')
    .lean();
  const hasMatch = (timetable?.entries || []).some((entry) => {
    if (String(entry.teacherId) !== String(teacherId)) return false;
    return String(entry.subjectId?._id || entry.subjectId) === String(subjectId);
  });
  return hasMatch;
};

const resolveStudentClassSection = async ({ schoolId, campusId, student }) => {
  const classDoc = await ClassModel.findOne({
    schoolId,
    ...(campusId ? { campusId } : {}),
    name: String(student.grade || '').trim(),
  }).lean();
  if (!classDoc) {
    return { error: 'Class not found for student grade' };
  }

  const sectionDoc = await Section.findOne({
    schoolId,
    ...(campusId ? { campusId } : {}),
    classId: classDoc._id,
    name: String(student.section || '').trim(),
  }).lean();
  if (!sectionDoc) {
    return { error: 'Section not found for student section' };
  }

  return { classDoc, sectionDoc };
};

// Teacher: create practice question
router.post('/teacher/questions', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const teacherId = req.user?.id;

    const { classId, sectionId, subjectId, type, question, options, correctAnswer, explanation } = req.body || {};

    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }
    if (!isValidId(classId) || !isValidId(sectionId) || !isValidId(subjectId)) {
      return res.status(400).json({ error: 'classId, sectionId and subjectId must be valid IDs' });
    }
    if (!['mcq', 'blank'].includes(type)) {
      return res.status(400).json({ error: 'type must be mcq or blank' });
    }
    if (!String(question || '').trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const allowed = await ensureTeacherAllocation({
      schoolId,
      campusId,
      teacherId,
      classId,
      sectionId,
      subjectId,
    });
    if (!allowed) {
      return res.status(403).json({ error: 'You are not assigned to this class/section/subject' });
    }

    const subject = await Subject.findOne({
      _id: subjectId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    }).lean();
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found' });
    }
    if (subject.classId && String(subject.classId) !== String(classId)) {
      return res.status(400).json({ error: 'Subject does not belong to selected class' });
    }

    let sanitizedOptions = Array.isArray(options) ? options.map((o) => String(o || '').trim()).filter(Boolean) : [];
    let sanitizedAnswer = String(correctAnswer || '').trim();

    if (type === 'mcq') {
      if (sanitizedOptions.length < 2) {
        return res.status(400).json({ error: 'At least two options are required for MCQ' });
      }
      if (!sanitizedAnswer || !sanitizedOptions.includes(sanitizedAnswer)) {
        return res.status(400).json({ error: 'Correct answer must match one of the options' });
      }
    } else {
      sanitizedOptions = [];
      if (!sanitizedAnswer) {
        return res.status(400).json({ error: 'Correct answer is required' });
      }
    }

    const created = await PracticeQuestion.create({
      schoolId,
      campusId,
      teacherId,
      classId,
      sectionId,
      subjectId,
      type,
      question: String(question).trim(),
      options: sanitizedOptions,
      correctAnswer: sanitizedAnswer,
      explanation: String(explanation || '').trim(),
    });

    res.status(201).json({ question: created });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Teacher: list practice questions
router.get('/teacher/questions', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const teacherId = req.user?.id;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }

    const filter = {
      schoolId,
      teacherId,
      ...buildCampusScope(campusId),
    };

    if (isValidId(req.query.classId)) filter.classId = req.query.classId;
    if (isValidId(req.query.sectionId)) filter.sectionId = req.query.sectionId;
    if (isValidId(req.query.subjectId)) filter.subjectId = req.query.subjectId;
    if (['mcq', 'blank'].includes(req.query.type)) filter.type = req.query.type;

    const questions = await PracticeQuestion.find(filter)
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .populate('subjectId', 'name')
      .sort({ createdAt: -1 })
      .lean();

    res.json({ questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher: update question
router.put('/teacher/questions/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const teacherId = req.user?.id;
    const { id } = req.params;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }
    if (!isValidId(id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }

    const existing = await PracticeQuestion.findOne({ _id: id, schoolId, teacherId }).lean();
    if (!existing) {
      return res.status(404).json({ error: 'Question not found' });
    }

    const {
      classId = existing.classId,
      sectionId = existing.sectionId,
      subjectId = existing.subjectId,
      type = existing.type,
      question = existing.question,
      options = existing.options,
      correctAnswer = existing.correctAnswer,
      explanation = existing.explanation,
      isActive = existing.isActive,
    } = req.body || {};

    if (!['mcq', 'blank'].includes(type)) {
      return res.status(400).json({ error: 'type must be mcq or blank' });
    }
    if (!String(question || '').trim()) {
      return res.status(400).json({ error: 'Question is required' });
    }

    const allowed = await ensureTeacherAllocation({
      schoolId,
      campusId,
      teacherId,
      classId,
      sectionId,
      subjectId,
    });
    if (!allowed) {
      return res.status(403).json({ error: 'You are not assigned to this class/section/subject' });
    }

    let sanitizedOptions = Array.isArray(options) ? options.map((o) => String(o || '').trim()).filter(Boolean) : [];
    let sanitizedAnswer = String(correctAnswer || '').trim();

    if (type === 'mcq') {
      if (sanitizedOptions.length < 2) {
        return res.status(400).json({ error: 'At least two options are required for MCQ' });
      }
      if (!sanitizedAnswer || !sanitizedOptions.includes(sanitizedAnswer)) {
        return res.status(400).json({ error: 'Correct answer must match one of the options' });
      }
    } else {
      sanitizedOptions = [];
      if (!sanitizedAnswer) {
        return res.status(400).json({ error: 'Correct answer is required' });
      }
    }

    const updated = await PracticeQuestion.findOneAndUpdate(
      { _id: id, schoolId, teacherId },
      {
        $set: {
          classId,
          sectionId,
          subjectId,
          type,
          question: String(question).trim(),
          options: sanitizedOptions,
          correctAnswer: sanitizedAnswer,
          explanation: String(explanation || '').trim(),
          isActive: Boolean(isActive),
        },
      },
      { new: true }
    );

    res.json({ question: updated });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Teacher: delete question
router.delete('/teacher/questions/:id', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id;
    if (!schoolId || !teacherId) {
      return res.status(400).json({ error: 'schoolId and teacherId are required' });
    }
    if (!isValidId(req.params.id)) {
      return res.status(400).json({ error: 'Invalid question id' });
    }
    const removed = await PracticeQuestion.findOneAndDelete({
      _id: req.params.id,
      schoolId,
      teacherId,
    });
    if (!removed) {
      return res.status(404).json({ error: 'Question not found' });
    }
    res.json({ message: 'Question deleted' });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Student: meta (class/section/subjects)
router.get('/student/meta', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const studentId = req.user?.id;
    if (!schoolId || !studentId) {
      return res.status(400).json({ error: 'schoolId and studentId are required' });
    }

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).lean();
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const resolved = await resolveStudentClassSection({ schoolId, campusId, student });
    if (resolved.error) {
      return res.status(404).json({ error: resolved.error });
    }

    const { classDoc, sectionDoc } = resolved;

    const subjects = await Subject.find({
      schoolId,
      ...(campusId ? { campusId } : {}),
      ...(classDoc ? { classId: classDoc._id } : {}),
    })
      .select('name code')
      .sort({ name: 1 })
      .lean();

    res.json({
      class: { id: classDoc._id, name: classDoc.name },
      section: { id: sectionDoc._id, name: sectionDoc.name },
      subjects: subjects.map((s) => ({ id: s._id, name: s.name, code: s.code || '' })),
      questionTypes: ['mcq', 'blank'],
    });
    logStudentPortalEvent(req, {
      feature: 'practice',
      action: 'practice_meta.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      resultCount: subjects.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'practice',
      action: 'practice_meta.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// Student: list questions
router.get('/student/questions', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const studentId = req.user?.id;
    const subjectId = req.query.subjectId;
    const type = req.query.type || 'mcq';

    if (!schoolId || !studentId) {
      return res.status(400).json({ error: 'schoolId and studentId are required' });
    }
    if (!isValidId(subjectId)) {
      return res.status(400).json({ error: 'Valid subjectId is required' });
    }
    if (!['mcq', 'blank'].includes(type)) {
      return res.status(400).json({ error: 'type must be mcq or blank' });
    }

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).lean();
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const resolved = await resolveStudentClassSection({ schoolId, campusId, student });
    if (resolved.error) {
      return res.status(404).json({ error: resolved.error });
    }
    const { classDoc, sectionDoc } = resolved;

    const subject = await Subject.findOne({
      _id: subjectId,
      schoolId,
      ...(campusId ? { campusId } : {}),
      ...(classDoc ? { classId: classDoc._id } : {}),
    }).lean();
    if (!subject) {
      return res.status(404).json({ error: 'Subject not found for this class' });
    }

    const questions = await PracticeQuestion.find({
      schoolId,
      campusId,
      classId: classDoc._id,
      sectionId: sectionDoc._id,
      subjectId,
      type,
      isActive: true,
    })
      .select('question options type')
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      questions: questions.map((q) => ({
        id: q._id,
        question: q.question,
        options: q.options || [],
        type: q.type,
      })),
    });
    logStudentPortalEvent(req, {
      feature: 'practice',
      action: 'practice_questions.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      subjectId,
      resultCount: questions.length,
      questionType: type,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'practice',
      action: 'practice_questions.fetch',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
      subjectId: req.query?.subjectId,
    });
    res.status(400).json({ error: err.message });
  }
});

// Student: submit answers
router.post('/student/submit', authStudent, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const studentId = req.user?.id;
    const answers = Array.isArray(req.body?.answers) ? req.body.answers : [];

    if (!schoolId || !studentId) {
      return res.status(400).json({ error: 'schoolId and studentId are required' });
    }
    if (!answers.length) {
      return res.status(400).json({ error: 'answers are required' });
    }

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).lean();
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }

    const resolved = await resolveStudentClassSection({ schoolId, campusId, student });
    if (resolved.error) {
      return res.status(404).json({ error: resolved.error });
    }
    const { classDoc, sectionDoc } = resolved;

    const ids = answers.map((a) => a.questionId).filter((id) => isValidId(id));
    const questions = await PracticeQuestion.find({
      _id: { $in: ids },
      schoolId,
      campusId,
      classId: classDoc._id,
      sectionId: sectionDoc._id,
      isActive: true,
    }).lean();

    const questionMap = new Map(questions.map((q) => [String(q._id), q]));
    let correctCount = 0;

    const results = answers.map((ans) => {
      const q = questionMap.get(String(ans.questionId));
      if (!q) {
        return {
          questionId: ans.questionId,
          isCorrect: false,
          correctAnswer: '',
          explanation: '',
        };
      }
      const given = String(ans.answer || '').trim();
      const expected = String(q.correctAnswer || '').trim();
      const isCorrect = q.type === 'blank'
        ? given.toLowerCase() === expected.toLowerCase()
        : given === expected;
      if (isCorrect) correctCount += 1;
      return {
        questionId: q._id,
        isCorrect,
        correctAnswer: expected,
        explanation: q.explanation || '',
      };
    });

    const attempts = results
      .map((r) => {
        const q = questionMap.get(String(r.questionId));
        if (!q) return null;
        const answerItem = answers.find((a) => String(a.questionId) === String(q._id));
        return {
          schoolId,
          campusId,
          studentId,
          questionId: q._id,
          classId: q.classId,
          sectionId: q.sectionId,
          subjectId: q.subjectId,
          answer: String(answerItem?.answer || ''),
          isCorrect: r.isCorrect,
        };
      })
      .filter(Boolean);

    if (attempts.length) {
      await PracticeAttempt.insertMany(attempts);
    }

    res.json({
      total: results.length,
      correct: correctCount,
      results,
    });
    logStudentPortalEvent(req, {
      feature: 'practice',
      action: 'practice_submit.create',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      resultCount: results.length,
      correctCount,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'practice',
      action: 'practice_submit.create',
      statusCode: 400,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(400).json({ error: err.message });
  }
});

// ── GET /api/practice/error-analysis ────────────────────────────────────────
// Returns wrong-answer clusters grouped by subject + topic for the logged-in student.
router.get('/error-analysis', authStudent, async (req, res) => {
  try {
    const studentId = req.user?.id;
    const schoolId  = req.schoolId;
    if (!studentId || !schoolId) return res.status(401).json({ error: 'Unauthorized' });

    const wrongAttempts = await PracticeAttempt.find({ studentId, schoolId, isCorrect: false })
      .populate('questionId', 'question correctAnswer subject topicTitle chapterTitle difficultyLevel')
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();

    // Group by subject → topicTitle
    const clusters = {};
    for (const attempt of wrongAttempts) {
      const q = attempt.questionId;
      if (!q) continue;
      const subject = q.subject || 'General';
      const topic   = q.topicTitle || 'Unknown Topic';
      const key     = `${subject}|||${topic}`;
      if (!clusters[key]) {
        clusters[key] = {
          subject,
          topicTitle: topic,
          chapterTitle: q.chapterTitle || '',
          errorCount: 0,
          questions: [],
        };
      }
      clusters[key].errorCount++;
      if (clusters[key].questions.length < 3) {
        clusters[key].questions.push({
          question:      q.question,
          correctAnswer: q.correctAnswer,
          difficulty:    q.difficultyLevel || 'medium',
        });
      }
    }

    const result = Object.values(clusters)
      .sort((a, b) => b.errorCount - a.errorCount)
      .slice(0, 10);

    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
