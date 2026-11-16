// Exam attendance via admit-card QR codes.
//   POST /api/exam-attendance/scan   (teacher)  – invigilator scans a student's admit-card QR
//   GET  /api/exam-attendance/mine   (teacher)  – what this teacher scanned on a date
//   GET  /api/exam-attendance        (admin)    – date → class/section → students, live status
//   GET  /api/exam-attendance/dates  (admin)    – exam dates that exist (for the date picker)
const express = require('express');
const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const ExamAttendance = require('../models/ExamAttendance');
const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const adminAuth = require('../middleware/adminAuth');
const teacherAuth = require('../middleware/authTeacher');
const { verifyAdmitQr } = require('../utils/admitCardQr');

const router = express.Router();

const TZ = process.env.SCHOOL_TIMEZONE || 'Asia/Kolkata';
const todayIso = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const nowMinutes = () => {
  const [h, m] = new Date().toLocaleTimeString('en-GB', { timeZone: TZ, hour12: false }).split(':').map(Number);
  return h * 60 + m;
};
const isIsoDate = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const norm = (v) => String(v || '').trim().toLowerCase().replace(/\s+/g, ' ');
const escapeRegex = (v) => String(v).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const timeToMinutes = (t) => {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})\s*(am|pm)?/i);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = (m[3] || '').toLowerCase();
  if (ap === 'pm' && h < 12) h += 12;
  if (ap === 'am' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
};
const dateFilter = (iso) => ({ $regex: `^${escapeRegex(iso)}` });
const studentActiveFilter = { isArchived: { $ne: true }, status: { $nin: ['Left', 'left', 'Inactive'] } };

const isInvigilator = (exam, teacher) => {
  if (!teacher) return false;
  const ids = new Set([teacher.name, teacher.username, teacher.employeeCode, teacher.email, String(teacher.email || '').split('@')[0]]
    .map(norm).filter(Boolean));
  return String(exam?.instructor || '').split(',').map(norm).some((n) => ids.has(n));
};

// ── Teacher: scan an admit-card QR ──────────────────────────────────────────
router.post('/scan', teacherAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const decoded = verifyAdmitQr(req.body?.code);
    if (!decoded) return res.status(400).json({ success: false, code: 'INVALID_QR', message: 'This is not a valid admit card QR code.' });
    if (decoded.schoolId && String(decoded.schoolId) !== String(schoolId)) {
      return res.status(403).json({ success: false, code: 'OTHER_SCHOOL', message: 'This admit card belongs to another school.' });
    }
    if (!mongoose.isValidObjectId(decoded.studentId)) {
      return res.status(400).json({ success: false, code: 'INVALID_QR', message: 'Invalid admit card.' });
    }

    const student = await StudentUser.findOne({ _id: decoded.studentId, schoolId })
      .select('name username roll grade section profilePic isArchived').lean();
    if (!student) return res.status(404).json({ success: false, code: 'NO_STUDENT', message: 'Student not found.' });

    const date = todayIso();
    const exams = await Exam.find({ schoolId, date: dateFilter(date) })
      .select('title subject instructor time duration grade section groupId date')
      .lean();
    const studentExams = exams.filter((e) => norm(e.grade) === norm(student.grade) && norm(e.section) === norm(student.section));
    if (!studentExams.length) {
      return res.status(404).json({
        success: false, code: 'NO_EXAM_TODAY',
        message: `${student.name || 'This student'} (${student.grade}-${student.section}) has no exam today.`,
      });
    }

    const teacher = req.user?.id && mongoose.isValidObjectId(req.user.id)
      ? await TeacherUser.findById(req.user.id).select('name username employeeCode email').lean()
      : null;

    // Prefer the exam this teacher invigilates, then the one nearest to now.
    const now = nowMinutes();
    const ranked = studentExams
      .map((e) => {
        const start = timeToMinutes(e.time);
        return { e, mine: isInvigilator(e, teacher), dist: start == null ? 9999 : Math.abs(start - now) };
      })
      .sort((a, b) => (Number(b.mine) - Number(a.mine)) || (a.dist - b.dist));
    const { e: exam, mine } = ranked[0];

    const existing = await ExamAttendance.findOne({ examId: exam._id, studentId: student._id }).lean();
    const studentInfo = {
      id: student._id, name: student.name || 'Student', username: student.username || '',
      roll: student.roll ?? null, grade: student.grade || '', section: student.section || '',
      photo: typeof student.profilePic === 'string' ? student.profilePic : (student.profilePic?.secure_url || student.profilePic?.url || null),
    };
    const examInfo = { id: exam._id, title: exam.title || '', subject: exam.subject || '', time: exam.time || '', date };

    if (existing) {
      return res.json({
        success: true, alreadyMarked: true, isInvigilator: mine, student: studentInfo, exam: examInfo,
        markedAt: existing.createdAt, markedByName: existing.markedByName,
        message: `Already marked present at ${new Date(existing.createdAt).toLocaleTimeString('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}.`,
      });
    }

    let record;
    try {
      record = await ExamAttendance.create({
        schoolId, campusId: req.campusId || null,
        examId: exam._id, groupId: exam.groupId || null, studentId: student._id,
        studentName: studentInfo.name, username: studentInfo.username, roll: studentInfo.roll,
        grade: studentInfo.grade, section: studentInfo.section,
        subject: exam.subject || '', examTitle: exam.title || '', date,
        markedBy: teacher?._id || null, markedByName: teacher?.name || req.user?.name || '',
        method: 'qr',
      });
    } catch (err) {
      if (err?.code !== 11000) throw err;
      record = await ExamAttendance.findOne({ examId: exam._id, studentId: student._id }).lean();
      return res.json({ success: true, alreadyMarked: true, isInvigilator: mine, student: studentInfo, exam: examInfo, markedAt: record?.createdAt, message: 'Already marked present.' });
    }

    return res.json({
      success: true, alreadyMarked: false, isInvigilator: mine, student: studentInfo, exam: examInfo,
      markedAt: record.createdAt, message: 'Attendance recorded.',
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message || 'Failed to record attendance' });
  }
});

// ── Teacher: my scans for a date ────────────────────────────────────────────
router.get('/mine', teacherAuth, async (req, res) => {
  try {
    const date = isIsoDate(req.query.date) ? req.query.date : todayIso();
    const rows = await ExamAttendance.find({ schoolId: req.schoolId, date, markedBy: req.user?.id })
      .sort({ createdAt: -1 }).limit(500).lean();
    return res.json({ success: true, data: { date, records: rows } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin: exam dates (for picker) ──────────────────────────────────────────
router.get('/dates', adminAuth, async (req, res) => {
  try {
    const raw = await Exam.distinct('date', { schoolId: req.schoolId });
    const dates = [...new Set(raw.map((d) => String(d || '').slice(0, 10)).filter(isIsoDate))].sort();
    return res.json({ success: true, data: { dates, today: todayIso() } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

// ── Admin: date → class/section → students ──────────────────────────────────
router.get('/', adminAuth, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const date = isIsoDate(req.query.date) ? req.query.date : todayIso();
    const exams = await Exam.find({ schoolId, date: dateFilter(date) })
      .select('title subject instructor time duration grade section groupId venue')
      .sort({ grade: 1, section: 1, time: 1 })
      .lean();
    if (!exams.length) return res.json({ success: true, data: { date, classes: [], totals: { expected: 0, present: 0 } } });

    const records = await ExamAttendance.find({ schoolId, examId: { $in: exams.map((e) => e._id) } }).lean();
    const recByKey = new Map(records.map((r) => [`${r.examId}:${r.studentId}`, r]));

    const classMap = new Map();
    exams.forEach((e) => {
      const key = `${norm(e.grade)}|${norm(e.section)}`;
      if (!classMap.has(key)) classMap.set(key, { grade: e.grade || '', section: e.section || '', exams: [] });
      classMap.get(key).exams.push(e);
    });

    const grades = [...new Set([...classMap.values()].map((c) => c.grade))];
    const students = await StudentUser.find({ schoolId, grade: { $in: grades }, ...studentActiveFilter })
      .select('name username roll grade section').lean();

    let expected = 0;
    let present = 0;
    const classes = [...classMap.values()].map((c) => {
      const list = students
        .filter((s) => norm(s.grade) === norm(c.grade) && norm(s.section) === norm(c.section))
        .sort((a, b) => (a.roll ?? 1e9) - (b.roll ?? 1e9) || String(a.name).localeCompare(String(b.name)));
      const examsOut = c.exams.map((e) => ({
        id: e._id, title: e.title, subject: e.subject, time: e.time, duration: e.duration, venue: e.venue || '', invigilator: e.instructor || '',
      }));
      const rows = list.map((s) => {
        const attendance = c.exams.map((e) => {
          const r = recByKey.get(`${e._id}:${s._id}`);
          return r ? { examId: e._id, present: true, markedAt: r.createdAt, markedByName: r.markedByName } : { examId: e._id, present: false };
        });
        return { id: s._id, name: s.name, username: s.username, roll: s.roll ?? null, grade: s.grade, section: s.section, attendance };
      });
      const classExpected = rows.length * c.exams.length;
      const classPresent = rows.reduce((n, r) => n + r.attendance.filter((a) => a.present).length, 0);
      expected += classExpected;
      present += classPresent;
      return { grade: c.grade, section: c.section, exams: examsOut, students: rows, expected: classExpected, present: classPresent };
    }).sort((a, b) => String(a.grade).localeCompare(String(b.grade), undefined, { numeric: true }) || String(a.section).localeCompare(String(b.section)));

    return res.json({ success: true, data: { date, classes, totals: { expected, present } } });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
});

module.exports = router;
