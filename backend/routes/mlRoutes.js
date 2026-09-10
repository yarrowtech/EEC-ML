const express = require('express');
const router = express.Router();
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const StudentProgress = require('../models/StudentProgress');
const { scopedStudents } = require('../utils/analyticsScope');
const {
  computeAllScores,
} = require('../services/mlEngine');
const { backtestAtRiskDetection } = require('../services/mlValidationService');

async function getStudentsForClass({ schoolId, className, section }) {
  const filter = { schoolId };
  if (className) filter.grade = { $regex: `^${className}$`, $options: 'i' };
  if (section) filter.section = { $regex: `^${section}$`, $options: 'i' };
  return StudentUser.find(filter).select('_id name roll grade section').lean();
}

async function buildClassScores(students, schoolId) {
  const results = await Promise.allSettled(
    students.map(async (s) => {
      const scores = await computeAllScores({ studentId: s._id, schoolId });
      const progress = await StudentProgress.findOne({ studentId: s._id, schoolId })
        .select('interventionLevel')
        .lean();
      return {
        studentId: s._id,
        name: s.name,
        roll: s.roll,
        grade: s.grade,
        section: s.section,
        atRisk: scores.atRisk,
        engagement: scores.engagement,
        masteryAvg: scores.masteryAvg,
        pace: scores.pace,
        trend: scores.trend,
        gaps: scores.gaps,
        interventionLevel: progress?.interventionLevel || 'low',
      };
    })
  );

  return results
    .filter((r) => r.status === 'fulfilled')
    .map((r) => r.value);
}

// GET /api/ml/student/:studentId
router.get('/student/:studentId', authTeacher, async (req, res) => {
  try {
    const students = await scopedStudents(req);
    const student = students.find((s) => String(s._id) === req.params.studentId);
    if (!student) return res.status(404).json({ success: false, error: 'Student not found' });
    const scores = await computeAllScores({ studentId: req.params.studentId, schoolId: req.schoolId });
    return res.json({ success: true, data: { ...student, ...scores } });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ml/class/scores?className=&section=&subject=
router.get('/class/scores', authTeacher, async (req, res) => {
  try {
    const { className, section } = req.query;
    const students = await scopedStudents(req);
    const data = await buildClassScores(students, req.schoolId);
    return res.json({ success: true, data });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ml/class/at-risk?className=&section=
router.get('/class/at-risk', authTeacher, async (req, res) => {
  try {
    const { className, section } = req.query;
    const students = await scopedStudents(req);
    const data = await buildClassScores(students, req.schoolId);
    const atRisk = data
      .filter((s) => s.atRisk?.isAtRisk)
      .sort((a, b) => (b.atRisk?.riskScore || 0) - (a.atRisk?.riskScore || 0));
    return res.json({ success: true, data: atRisk });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ml/class/engagement?className=&section=
router.get('/class/engagement', authTeacher, async (req, res) => {
  try {
    const { className, section } = req.query;
    const students = await scopedStudents(req);
    const data = await buildClassScores(students, req.schoolId);
    const sorted = data.sort((a, b) => (a.engagement?.engagementScore || 0) - (b.engagement?.engagementScore || 0));
    return res.json({ success: true, data: sorted });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ml/class/trends?className=&section=
router.get('/class/trends', authTeacher, async (req, res) => {
  try {
    const { className, section } = req.query;
    const students = await scopedStudents(req);
    const data = await buildClassScores(students, req.schoolId);
    const trends = data.map((s) => ({
      studentId: s.studentId,
      name: s.name,
      roll: s.roll,
      overallTrend: s.trend?.overallTrend || 'stable',
      rollingAvg: s.trend?.rollingAvg,
    }));
    return res.json({ success: true, data: trends });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

// GET /api/ml/class/at-risk-validation?className=&section=&horizonDays=
router.get('/class/at-risk-validation', authTeacher, async (req, res) => {
  try {
    const { className, section, horizonDays } = req.query;
    const students = await scopedStudents(req);
    const filtered = students.filter((s) => {
      if (className && !new RegExp(`^${className}$`, 'i').test(s.grade || '')) return false;
      if (section && !new RegExp(`^${section}$`, 'i').test(s.section || '')) return false;
      return true;
    });
    const report = await backtestAtRiskDetection({
      schoolId: req.schoolId,
      studentIds: filtered.map((s) => s._id),
      horizonDays: horizonDays ? Number(horizonDays) : undefined,
    });
    return res.json({ success: true, data: report });
  } catch (err) {
    return res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
