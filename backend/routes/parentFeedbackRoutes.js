const express = require('express');
const mongoose = require('mongoose');
const authParent = require('../middleware/authParent');
const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');
const TeacherFeedback = require('../models/TeacherFeedback');
const { feedbackHelpers } = require('./studentRoute');

const router = express.Router();
const { buildTeacherFeedbackContext, resolveTeacherFeedbackAvailability } = feedbackHelpers;

// The parent may only act for their own, non-left children.
const loadChild = async (parentId, childId) => {
  if (!mongoose.isValidObjectId(childId)) return null;
  const parent = await ParentUser.findById(parentId).select('childrenIds').lean();
  const owns = (parent?.childrenIds || []).some((id) => String(id) === String(childId));
  if (!owns) return null;
  return StudentUser.findOne({ _id: childId, status: { $nin: ['Left', 'Expelled'] }, isArchived: { $ne: true } })
    .select('name grade section schoolId campusId profilePic')
    .lean();
};

const windowPayload = (availability) => ({
  isOpen: availability.isOpen,
  reason: availability.reason,
  message: availability.message,
  enabled: availability.settings.enabled,
  startDate: availability.settings.startDate,
  endDate: availability.settings.endDate,
});

// GET /api/parent/teacher-feedback/children — the parent's current children.
router.get('/children', authParent, async (req, res) => {
  try {
    const parent = await ParentUser.findById(req.user.id).select('childrenIds').lean();
    const children = await StudentUser.find({
      _id: { $in: parent?.childrenIds || [] },
      status: { $nin: ['Left', 'Expelled'] },
      isArchived: { $ne: true },
    }).select('name grade section profilePic').sort({ name: 1 }).lean();
    return res.json({ children: children.map((c) => ({ id: String(c._id), name: c.name, grade: c.grade, section: c.section, profilePic: c.profilePic || '' })) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to load children' });
  }
});

// GET /api/parent/teacher-feedback/context?childId=…
// View-only: the child's allocated teachers + window status + whether the
// CHILD has submitted feedback for each (in the current window). Ratings and
// comments stay anonymous — only done / not done is exposed.
router.get('/context', authParent, async (req, res) => {
  try {
    const child = await loadChild(req.user.id, req.query.childId);
    if (!child) return res.status(404).json({ error: 'Child not found' });

    const availability = await resolveTeacherFeedbackAvailability(child.schoolId);
    const since = availability.settings.startDate ? new Date(availability.settings.startDate) : null;
    const [{ contexts }, given] = await Promise.all([
      buildTeacherFeedbackContext(child),
      TeacherFeedback.find({
        studentId: child._id,
        respondentType: { $ne: 'parent' },
        ...(since ? { createdAt: { $gte: since } } : {}),
      }).select('teacherId subjectId subjectName createdAt').lean(),
    ]);

    const keyOf = (t) => `${t.teacherId}::${t.subjectId || String(t.subjectName || '').toLowerCase()}`;
    const givenAt = new Map();
    given.forEach((g) => {
      const k = keyOf({ teacherId: String(g.teacherId), subjectId: g.subjectId ? String(g.subjectId) : null, subjectName: g.subjectName });
      const prev = givenAt.get(k);
      if (!prev || new Date(g.createdAt) > prev) givenAt.set(k, new Date(g.createdAt));
    });

    const teachers = contexts.map((t) => ({
      teacherId: t.teacherId,
      teacherName: t.teacherName,
      teacherProfilePic: t.teacherProfilePic,
      subjectId: t.subjectId,
      subjectName: t.subjectName,
      submitted: givenAt.has(keyOf(t)),
      submittedAt: givenAt.get(keyOf(t)) || null,
    }));

    return res.json({
      child: { id: child._id, name: child.name, grade: child.grade, section: child.section },
      feedbackWindow: windowPayload(availability),
      teachers,
      summary: { total: teachers.length, submitted: teachers.filter((t) => t.submitted).length },
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Unable to load feedback status' });
  }
});

module.exports = router;
