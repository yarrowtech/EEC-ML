const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const ExamResult = require('../models/ExamResult');
const TeacherAllocation = require('../models/TeacherAllocation');
const InterventionLog = require('../models/InterventionLog');

// ── Compute composite at-risk score for a student ────────────────────────────
// Factors: attendance %, exam score avg, score trend (declining?), submission rate
const computeRiskScore = (student, examResults = []) => {
  const attendance = Array.isArray(student.attendance) ? student.attendance : [];
  const totalDays = attendance.length;
  const presentDays = attendance.filter((a) => a.status === 'present').length;
  const attPct = totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 100;

  // Avg exam score (last 6)
  const recent = examResults.slice(-6);
  const avgScore = recent.length
    ? Math.round(recent.reduce((s, r) => s + (Number(r.marks) || 0), 0) / recent.length)
    : null;

  // Score trend: compare first half vs second half (declining = risk)
  let scoreTrend = 0; // positive = improving, negative = declining
  if (recent.length >= 4) {
    const firstHalf = recent.slice(0, Math.floor(recent.length / 2));
    const secondHalf = recent.slice(Math.floor(recent.length / 2));
    const avgFirst = firstHalf.reduce((s, r) => s + (Number(r.marks) || 0), 0) / firstHalf.length;
    const avgSecond = secondHalf.reduce((s, r) => s + (Number(r.marks) || 0), 0) / secondHalf.length;
    scoreTrend = avgSecond - avgFirst;
  }

  // Composite risk score (0-100, higher = more at risk)
  let risk = 0;
  if (attPct < 60)       risk += 35;
  else if (attPct < 75)  risk += 20;
  else if (attPct < 85)  risk += 8;

  if (avgScore !== null) {
    if (avgScore < 35)     risk += 40;
    else if (avgScore < 50) risk += 25;
    else if (avgScore < 65) risk += 12;
  }

  if (scoreTrend < -10)  risk += 15;
  else if (scoreTrend < -5) risk += 8;

  const level = risk >= 60 ? 'critical' : risk >= 40 ? 'high' : risk >= 20 ? 'medium' : 'low';

  return { risk, level, attPct, avgScore, scoreTrend: Math.round(scoreTrend) };
};

// ── GET /api/teacher-analytics/at-risk ───────────────────────────────────────
router.get('/at-risk', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const { className, section } = req.query;

    // Get students allocated to this teacher
    const allocations = await TeacherAllocation.find({ schoolId, teacherId })
      .populate('classId', 'name')
      .populate('sectionId', 'name')
      .lean();

    const filter = {
      schoolId,
      ...(className ? { $or: [{ grade: className }, { grade: `Class ${className}` }] } : {}),
      ...(section ? { section } : {}),
    };

    const students = await StudentUser.find(filter)
      .select('name roll grade section attendance')
      .lean();

    // Get exam results for all these students in one query
    const studentIds = students.map((s) => s._id);
    const allResults = await ExamResult.find({
      schoolId,
      studentId: { $in: studentIds },
      published: true,
    })
      .populate('examId', 'subject marks date')
      .sort({ createdAt: 1 })
      .lean();

    // Group by student
    const resultsByStudent = {};
    allResults.forEach((r) => {
      const sid = String(r.studentId);
      if (!resultsByStudent[sid]) resultsByStudent[sid] = [];
      resultsByStudent[sid].push(r);
    });

    const atRiskStudents = students
      .map((student) => {
        const results = resultsByStudent[String(student._id)] || [];
        const metrics = computeRiskScore(student, results);
        return {
          studentId: student._id,
          name: student.name,
          roll: student.roll,
          grade: student.grade,
          section: student.section,
          ...metrics,
          recentScores: results.slice(-3).map((r) => ({
            subject: r.examId?.subject || '',
            marks: r.marks,
            maxMarks: r.examId?.marks,
            date: r.examId?.date,
          })),
        };
      })
      .filter((s) => s.level !== 'low')
      .sort((a, b) => b.risk - a.risk);

    return res.json({ success: true, data: atRiskStudents });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/class-trends ───────────────────────────────────
router.get('/class-trends', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const { className, section } = req.query;

    const filter = { schoolId };
    if (className) filter.$or = [{ grade: className }, { grade: `Class ${className}` }];
    if (section) filter.section = section;

    const students = await StudentUser.find(filter).select('_id grade section attendance').lean();
    const studentIds = students.map((s) => s._id);

    // Exam results grouped by subject over time
    const results = await ExamResult.find({
      schoolId, studentId: { $in: studentIds }, published: true,
    })
      .populate('examId', 'subject marks date term')
      .sort({ createdAt: 1 })
      .lean();

    // Group by subject → array of {date, avgPct}
    const subjectMap = {};
    results.forEach((r) => {
      const subject = r.examId?.subject || 'Unknown';
      const maxM = r.examId?.marks || 100;
      const pct = Math.round((r.marks / maxM) * 100);
      const date = r.examId?.date || r.createdAt;
      if (!subjectMap[subject]) subjectMap[subject] = [];
      subjectMap[subject].push({ date, pct });
    });

    const subjectTrends = Object.entries(subjectMap).map(([subject, pts]) => {
      const sorted = [...pts].sort((a, b) => new Date(a.date) - new Date(b.date));
      // Average by date bucket
      return { subject, points: sorted };
    });

    // Attendance trend: daily avg across class (last 30 records per student)
    const attByDate = {};
    students.forEach((s) => {
      (s.attendance || []).slice(-30).forEach((a) => {
        const d = String(a.date || '').slice(0, 10);
        if (!d) return;
        if (!attByDate[d]) attByDate[d] = { present: 0, total: 0 };
        attByDate[d].total++;
        if (a.status === 'present') attByDate[d].present++;
      });
    });
    const attendanceTrend = Object.entries(attByDate)
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-20)
      .map(([date, { present, total }]) => ({
        date,
        attPct: Math.round((present / total) * 100),
      }));

    // Class stats
    const totalStudents = students.length;
    const allAttPct = students.map((s) => {
      const att = s.attendance || [];
      const p = att.filter((a) => a.status === 'present').length;
      return att.length > 0 ? Math.round((p / att.length) * 100) : 100;
    });
    const avgAttPct = allAttPct.length
      ? Math.round(allAttPct.reduce((s, v) => s + v, 0) / allAttPct.length) : 0;

    return res.json({
      success: true,
      data: { subjectTrends, attendanceTrend, totalStudents, avgAttPct },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/teacher-analytics/interventions ─────────────────────────────────
router.post('/interventions', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    if (!schoolId || !teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const { studentId, studentName, riskLevel, reason, action, notes, scheduledDate } = req.body || {};
    if (!studentId || !reason || !action) {
      return res.status(400).json({ error: 'studentId, reason, and action are required' });
    }
    const log = await InterventionLog.create({
      schoolId, campusId: req.campusId || null, teacherId,
      studentId, studentName: studentName || '',
      riskLevel: riskLevel || 'medium',
      reason, action, notes: notes || '',
      scheduledDate: scheduledDate ? new Date(scheduledDate) : null,
      status: 'planned',
    });
    return res.status(201).json({ success: true, data: log });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/teacher-analytics/interventions ──────────────────────────────────
router.get('/interventions', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    const { studentId, status } = req.query;
    const filter = { schoolId, teacherId };
    if (studentId) filter.studentId = studentId;
    if (status) filter.status = status;
    const logs = await InterventionLog.find(filter).sort({ createdAt: -1 }).lean();
    return res.json({ success: true, data: logs });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── PUT /api/teacher-analytics/interventions/:id/outcome ─────────────────────
router.put('/interventions/:id/outcome', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const teacherId = req.user?.id || req.teacher?.id;
    const { outcome, status, improvement } = req.body || {};
    const log = await InterventionLog.findOneAndUpdate(
      { _id: req.params.id, schoolId, teacherId },
      {
        $set: {
          outcome: outcome || '',
          status: status || 'completed',
          improvement: improvement != null ? Number(improvement) : null,
          resolvedAt: new Date(),
        },
      },
      { new: true }
    );
    if (!log) return res.status(404).json({ error: 'Intervention not found' });
    return res.json({ success: true, data: log });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
