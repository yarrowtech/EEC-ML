const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const authTeacher = require('../middleware/authTeacher');
const { scopedStudents } = require('../utils/analyticsScope');
const { detectStudentLearningStyle, getClassLearningStyleSummary } = require('../services/learningStyleService');

// GET /api/learning-style/me — student's own detected vs. self-reported style
router.get('/me', authStudent, async (req, res) => {
  try {
    const profile = await detectStudentLearningStyle({ studentId: req.user?.id, schoolId: req.schoolId });
    return res.json({ success: true, data: profile });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/learning-style/class — teacher view, distribution across the class
router.get('/class', authTeacher, async (req, res) => {
  try {
    const students = await scopedStudents(req);
    const summary = await getClassLearningStyleSummary({ schoolId: req.schoolId, studentIds: students.map((s) => s._id) });
    const byId = new Map(students.map((s) => [String(s._id), s]));
    const studentsWithNames = summary.students.map((row) => ({
      ...row,
      name: byId.get(String(row.studentId))?.name,
      roll: byId.get(String(row.studentId))?.roll,
    }));
    return res.json({ success: true, data: { ...summary, students: studentsWithNames } });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
