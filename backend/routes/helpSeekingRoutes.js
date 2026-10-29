const express = require('express');
const router = express.Router();
const { teacherAnalyticsCache } = require('../utils/responseCache');
router.use(teacherAnalyticsCache.invalidateOnWrite);
const authStudent = require('../middleware/authStudent');
const authTeacher = require('../middleware/authTeacher');
const { scopedStudents } = require('../utils/analyticsScope');
const { getStudentHelpSeekingProfile, getClassHelpSeekingSummary } = require('../services/helpSeekingService');

// GET /api/help-seeking/profile — student's own help-seeking summary
router.get('/profile', authStudent, async (req, res) => {
  try {
    const profile = await getStudentHelpSeekingProfile({ studentId: req.user?.id, schoolId: req.schoolId });
    return res.json({ success: true, data: profile });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/help-seeking/class — teacher view, most-active help-seekers first
router.get('/class', authTeacher, teacherAnalyticsCache.cache, async (req, res) => {
  try {
    const students = await scopedStudents(req);
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
    const summary = await getClassHelpSeekingSummary({ schoolId: req.schoolId, studentIds: students.map((s) => s._id), sinceDays: days });
    const byId = new Map(students.map((s) => [String(s._id), s]));
    const data = summary.map((row) => {
      const st = byId.get(String(row.studentId));
      return {
        ...row,
        name: st?.name,
        roll: st?.roll,
        profilePic: typeof st?.profilePic === 'string' ? st.profilePic : (st?.profilePic?.secure_url || st?.profilePic?.url || null),
      };
    });
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(err.status || 500).json({ success: false, error: err.message });
  }
});

module.exports = router;
