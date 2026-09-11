const express = require('express');
const router = express.Router();
const authStudent = require('../middleware/authStudent');
const authTeacher = require('../middleware/authTeacher');
const { scopedStudents } = require('../utils/analyticsScope');
const {
  recordCheckin,
  getStudentCalibrationProfile,
  getClassCalibrationSummary,
} = require('../services/confidenceTrackingService');

// POST /api/confidence/checkin — student self-rates confidence (1-5) on a topic
router.post('/checkin', authStudent, async (req, res) => {
  try {
    const { subject, topicId, topicTitle, confidenceRating, source } = req.body || {};
    const result = await recordCheckin({
      studentId: req.user?.id, schoolId: req.schoolId, subject, topicId, topicTitle, confidenceRating, source,
    });
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

// GET /api/confidence/profile?subject= — student's own calibration history
router.get('/profile', authStudent, async (req, res) => {
  try {
    const profile = await getStudentCalibrationProfile({
      studentId: req.user?.id, schoolId: req.schoolId, subject: req.query.subject,
    });
    return res.json({ success: true, data: profile });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/confidence/class?className=&section=&subject= — teacher view, most-miscalibrated first
router.get('/class', authTeacher, async (req, res) => {
  try {
    const students = await scopedStudents(req);
    const summary = await getClassCalibrationSummary({
      schoolId: req.schoolId, studentIds: students.map((s) => s._id), subject: req.query.subject,
    });
    const byId = new Map(students.map((s) => [String(s._id), s]));
    const data = summary.map((row) => ({
      ...row,
      name: byId.get(String(row.studentId))?.name,
      roll: byId.get(String(row.studentId))?.roll,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
