const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const TeacherFeedback = require('../models/TeacherFeedback');
const School = require('../models/School');
const AcademicYear = require('../models/AcademicYear');
const { notifyTeacherFeedbackWindowStarted } = require('../utils/teacherFeedbackNotify');

const router = express.Router();

const toObjectId = (value) => {
  if (!value || !mongoose.isValidObjectId(value)) return null;
  return new mongoose.Types.ObjectId(String(value));
};

const normalizeText = (value) => String(value || '').trim();

// Build the date directly in UTC from its Y-M-D components instead of
// `new Date(value)` + `setHours(...)` — the latter mutates in the server's
// *local* timezone, which silently shifts the stored instant onto the
// previous UTC day whenever the server runs ahead of UTC (e.g. IST),
// making the saved start/end date look one day earlier on reload.
const parseDate = (value, endOfDay = false) => {
  if (!value) return null;
  const str = String(value).slice(0, 10);
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(str);
  if (!match) return null;
  const [, y, m, d] = match.map(Number);
  const date = endOfDay
    ? new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999))
    : new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0));
  return Number.isNaN(date.getTime()) ? null : date;
};

const normalizeTeacherFeedbackSettings = (schoolDoc, sessionId) => {
  const windows = schoolDoc?.teacherFeedbackWindows || [];
  const match = windows.find((window) => String(window.sessionId) === String(sessionId));
  return {
    sessionId: String(sessionId),
    enabled: Boolean(match?.enabled),
    startDate: match?.startDate || null,
    endDate: match?.endDate || null,
  };
};

router.get('/teacher-feedback/settings', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Feedback']
  try {
    const schoolId = req.schoolId || req.admin?.schoolId || null;
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return res.status(400).json({ error: 'Valid schoolId is required' });
    }

    const sessionId = req.query?.sessionId;
    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ error: 'Valid sessionId is required' });
    }

    const [school, session] = await Promise.all([
      School.findById(schoolId).select('teacherFeedbackWindows').lean(),
      AcademicYear.findOne({ _id: sessionId, schoolId }).select('_id').lean(),
    ]);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    if (!session) {
      return res.status(404).json({ error: 'Academic session not found' });
    }

    return res.json({ settings: normalizeTeacherFeedbackSettings(school, sessionId) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load teacher feedback settings' });
  }
});

router.put('/teacher-feedback/settings', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Feedback']
  try {
    const schoolId = req.schoolId || req.admin?.schoolId || null;
    if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
      return res.status(400).json({ error: 'Valid schoolId is required' });
    }

    const sessionId = req.body?.sessionId;
    if (!sessionId || !mongoose.isValidObjectId(sessionId)) {
      return res.status(400).json({ error: 'Valid sessionId is required' });
    }

    const enabled = Boolean(req.body?.enabled);
    const startDate = parseDate(req.body?.startDate, false);
    const endDate = parseDate(req.body?.endDate, true);

    if (enabled) {
      if (!startDate || !endDate) {
        return res.status(400).json({ error: 'Start date and end date are required when enabling teacher feedback' });
      }
      if (startDate > endDate) {
        return res.status(400).json({ error: 'Start date must be before or equal to end date' });
      }
    }

    const [school, session] = await Promise.all([
      School.findById(schoolId),
      AcademicYear.findOne({ _id: sessionId, schoolId }).select('_id').lean(),
    ]);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    if (!session) {
      return res.status(404).json({ error: 'Academic session not found' });
    }

    const existingIndex = (school.teacherFeedbackWindows || []).findIndex(
      (window) => String(window.sessionId) === String(sessionId)
    );
    const wasEnabled = existingIndex >= 0 ? Boolean(school.teacherFeedbackWindows[existingIndex].enabled) : false;

    const nextWindow = { sessionId, enabled, startDate: startDate || null, endDate: endDate || null };
    if (existingIndex >= 0) {
      school.teacherFeedbackWindows[existingIndex] = nextWindow;
    } else {
      school.teacherFeedbackWindows.push(nextWindow);
    }

    await school.save();

    if (enabled && !wasEnabled) {
      notifyTeacherFeedbackWindowStarted({ schoolId: school._id, sessionId, startDate, endDate }).catch((err) => {
        console.error('[teacher-feedback] failed to send start notifications:', err.message);
      });
    }

    return res.json({
      message: 'Teacher feedback settings updated',
      settings: normalizeTeacherFeedbackSettings(school, sessionId),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to update teacher feedback settings' });
  }
});

router.get('/teacher-feedback', adminAuth, async (req, res) => {
  // #swagger.tags = ['Admin Feedback']
  try {
    const schoolId = req.schoolId || req.admin?.schoolId || req.query?.schoolId || null;
    const campusId = req.campusId || req.query?.campusId || null;

    if (schoolId && !mongoose.isValidObjectId(schoolId)) {
      return res.status(400).json({ error: 'Valid schoolId is required' });
    }

    const {
      teacherId,
      className = '',
      sectionName = '',
      subjectName = '',
      search = '',
      from = '',
      to = '',
    } = req.query || {};

    if (teacherId && !mongoose.isValidObjectId(teacherId)) {
      return res.status(400).json({ error: 'Invalid teacherId' });
    }

    const dateFrom = parseDate(from, false);
    const dateTo = parseDate(to, true);
    if (from && !dateFrom) {
      return res.status(400).json({ error: 'Invalid from date' });
    }
    if (to && !dateTo) {
      return res.status(400).json({ error: 'Invalid to date' });
    }

    const filter = {};
    if (schoolId) {
      filter.schoolId = toObjectId(schoolId);
    }
    if (campusId) filter.campusId = String(campusId);
    if (teacherId) filter.teacherId = toObjectId(teacherId);
    if (normalizeText(className)) filter.className = normalizeText(className);
    if (normalizeText(sectionName)) filter.sectionName = normalizeText(sectionName);
    if (normalizeText(subjectName)) filter.subjectName = normalizeText(subjectName);
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = dateFrom;
      if (dateTo) filter.createdAt.$lte = dateTo;
    }

    const searchText = normalizeText(search);
    if (searchText) {
      const searchRegex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
      filter.$or = [
        { teacherName: searchRegex },
        { subjectName: searchRegex },
        { className: searchRegex },
        { sectionName: searchRegex },
        { comments: searchRegex },
      ];
    }

    const docs = await TeacherFeedback.find(filter).sort({ createdAt: -1 }).lean();

    const ratingKeys = ['teaching_quality', 'communication', 'engagement', 'preparation', 'availability', 'fairness'];
    const totalFeedback = docs.length;
    const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const categoryAverages = ratingKeys.reduce((acc, key) => {
      acc[key] = { total: 0, count: 0, average: 0 };
      return acc;
    }, {});

    let overallSum = 0;
    docs.forEach((doc) => {
      const values = Object.values(doc.ratings || {})
        .map((value) => Number(value))
        .filter((value) => Number.isFinite(value));
      const computedOverall = Number.isFinite(Number(doc.overallRating))
        ? Number(doc.overallRating)
        : (values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0);

      overallSum += computedOverall;
      const rounded = Math.max(1, Math.min(5, Math.round(computedOverall || 0)));
      ratingDistribution[rounded] += 1;

      ratingKeys.forEach((key) => {
        const value = Number(doc.ratings?.[key]);
        if (Number.isFinite(value)) {
          categoryAverages[key].total += value;
          categoryAverages[key].count += 1;
        }
      });
    });

    ratingKeys.forEach((key) => {
      const entry = categoryAverages[key];
      entry.average = entry.count ? entry.total / entry.count : 0;
    });

    const feedback = docs.map((doc) => ({
      id: doc._id,
      teacherId: doc.teacherId,
      teacherName: doc.teacherName || 'Teacher',
      className: doc.className || '',
      sectionName: doc.sectionName || '',
      subjectName: doc.subjectName || '',
      studentName: doc.isAnonymous ? 'Anonymous Student' : (doc.studentName || 'Student'),
      isAnonymous: Boolean(doc.isAnonymous),
      ratings: doc.ratings || {},
      overallRating: Number(doc.overallRating) || 0,
      comments: doc.comments || '',
      createdAt: doc.createdAt,
    }));

    const uniqueValues = (items) => Array.from(new Set(items.filter(Boolean))).sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
    const teacherMap = new Map();
    docs.forEach((doc) => {
      const id = String(doc.teacherId || '');
      if (!id || teacherMap.has(id)) return;
      teacherMap.set(id, {
        teacherId: id,
        teacherName: doc.teacherName || 'Teacher',
      });
    });
    const teachers = Array.from(teacherMap.values()).sort((a, b) => a.teacherName.localeCompare(b.teacherName));

    return res.json({
      stats: {
        totalFeedback,
        averageRating: totalFeedback ? overallSum / totalFeedback : 0,
        latestFeedbackDate: docs[0]?.createdAt || null,
        ratingDistribution,
        categoryAverages,
      },
      filters: {
        teachers,
        classes: uniqueValues(docs.map((doc) => doc.className)),
        sections: uniqueValues(docs.map((doc) => doc.sectionName)),
        subjects: uniqueValues(docs.map((doc) => doc.subjectName)),
      },
      feedback,
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to load teacher feedback' });
  }
});

module.exports = router;
