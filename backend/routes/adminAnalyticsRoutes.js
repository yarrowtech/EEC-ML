const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const MasteryScore = require('../models/MasteryScore');
const TeacherUser = require('../models/TeacherUser');
const StudentUser = require('../models/StudentUser');

const toObjId = (id) => {
  try { return new mongoose.Types.ObjectId(id); } catch { return null; }
};

// GET /api/admin-analytics/mastery-matrix
// Returns school-wide mastery grouped by subject × class grade
router.get('/mastery-matrix', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });

    const rows = await MasteryScore.aggregate([
      { $match: { schoolId: schoolObjId } },
      {
        $lookup: {
          from: 'studentusers',
          localField: 'studentId',
          foreignField: '_id',
          as: 'student',
        },
      },
      { $unwind: { path: '$student', preserveNullAndEmpty: false } },
      {
        $group: {
          _id: { subject: '$subject', grade: '$student.grade' },
          avgScore: { $avg: '$score' },
          studentCount: { $addToSet: '$studentId' },
        },
      },
      {
        $project: {
          subject: '$_id.subject',
          grade: '$_id.grade',
          avgScore: { $round: ['$avgScore', 1] },
          studentCount: { $size: '$studentCount' },
        },
      },
      { $sort: { grade: 1, subject: 1 } },
    ]);

    // Build matrix structure for frontend
    const subjects = [...new Set(rows.map((r) => r.subject))].sort();
    const grades = [...new Set(rows.map((r) => r.grade))].sort();
    const matrix = {};
    for (const r of rows) {
      if (!matrix[r.grade]) matrix[r.grade] = {};
      matrix[r.grade][r.subject] = r.avgScore;
    }

    return res.json({ success: true, data: { subjects, grades, matrix } });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/admin-analytics/teacher-effectiveness
// Returns per-teacher: subject, avg mastery for that subject school-wide,
// student count, and avg exam score for their subject
router.get('/teacher-effectiveness', adminAuth, async (req, res) => {
  try {
    const schoolObjId = toObjId(req.schoolId);
    if (!schoolObjId) return res.status(400).json({ error: 'Invalid schoolId' });

    const [teachers, subjectMastery] = await Promise.all([
      TeacherUser.find({ schoolId: req.schoolId })
        .select('name subject email phone')
        .lean(),
      MasteryScore.aggregate([
        { $match: { schoolId: schoolObjId } },
        {
          $group: {
            _id: '$subject',
            avgScore: { $avg: '$score' },
            studentCount: { $addToSet: '$studentId' },
            topicCount: { $addToSet: '$topicTitle' },
          },
        },
        {
          $project: {
            subject: '$_id',
            avgScore: { $round: ['$avgScore', 1] },
            studentCount: { $size: '$studentCount' },
            topicCount: { $size: '$topicCount' },
          },
        },
      ]),
    ]);

    const masteryBySubject = {};
    for (const s of subjectMastery) {
      masteryBySubject[s.subject] = s;
    }

    const result = teachers.map((t) => {
      const subjectStats = masteryBySubject[t.subject] || {};
      return {
        teacherId: t._id,
        name: t.name,
        subject: t.subject || '—',
        avgClassMastery: subjectStats.avgScore ?? null,
        studentCount: subjectStats.studentCount ?? 0,
        topicsCovered: subjectStats.topicCount ?? 0,
        effectiveness:
          subjectStats.avgScore != null
            ? subjectStats.avgScore >= 75
              ? 'High'
              : subjectStats.avgScore >= 55
              ? 'Moderate'
              : 'Needs Support'
            : 'No data',
      };
    });

    result.sort((a, b) => (b.avgClassMastery ?? -1) - (a.avgClassMastery ?? -1));
    return res.json({ success: true, data: result });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
