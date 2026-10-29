const express = require('express');
const router = express.Router();
const { studentDashboardCache } = require('../utils/responseCache');
const { teacherAnalyticsCache } = require('../utils/responseCache');
router.use(teacherAnalyticsCache.invalidateOnWrite);
const authStudent = require('../middleware/authStudent');
const authTeacher = require('../middleware/authTeacher');
const { scopedStudents } = require('../utils/analyticsScope');
const { computeStudentBelongingScore, getClassBelongingSummary } = require('../services/belongingService');

// GET /api/belonging/me — student's own social/belonging score
router.get('/me', authStudent, studentDashboardCache.cache, async (req, res) => {
  try {
    const profile = await computeStudentBelongingScore({ studentId: req.user?.id, schoolId: req.schoolId });
    return res.json({ success: true, data: profile });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/belonging/class — teacher view, least-engaged students first
router.get('/class', authTeacher, teacherAnalyticsCache.cache, async (req, res) => {
  try {
    const students = await scopedStudents(req);
    const requestedDays = Number(req.query.sinceDays);
    const sinceDays = [7, 30, 90, 365].includes(requestedDays) ? requestedDays : 30;
    const summary = await getClassBelongingSummary({ schoolId: req.schoolId, studentIds: students.map((s) => s._id), sinceDays });
    const byId = new Map(students.map((s) => [String(s._id), s]));
    const data = summary.map((row) => ({
      ...row,
      name: byId.get(String(row.studentId))?.name,
      roll: byId.get(String(row.studentId))?.roll,
      profilePic: byId.get(String(row.studentId))?.profilePic,
    }));
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
