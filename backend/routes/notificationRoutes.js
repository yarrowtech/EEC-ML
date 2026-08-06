const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const authAnyUser = require('../middleware/authAnyUser');
const authTeacher = require('../middleware/authTeacher');
const Notification = require('../models/Notification');
const TeacherAllocation = require('../models/TeacherAllocation');
const TeacherUser = require('../models/TeacherUser');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const Subject = require('../models/Subject');
const Timetable = require('../models/Timetable');
const PushSubscription = require('../models/PushSubscription');
const { initializeWebPush } = require('../utils/webPushService');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');

const router = express.Router();

// Matches the typeLabels attendanceRoutes.js/meetingRoute.js stamp on
// system-generated, per-recipient notifications (attendance marked,
// substitute-class alerts, individual low-attendance alerts, PTM invites).
// These still reach students/parents/teachers via GET /user — they're just
// noise on the admin Notice Board, which shows the one-per-event summary
// notices instead (typeLabel: attendance/substitute/low-attendance/etc.
// "_summary"). Kept as plain strings here to avoid cross-route imports.
const HIDDEN_FROM_NOTICEBOARD_TYPE_LABELS = [
  'attendance_marked',
  'substitute_attendance',
  'parent_teacher_meeting',
  'Weekly Attendance Alert',
  'exam_schedule_teacher',
];

const resolveSchoolId = (req, res) => {
  const schoolId = req.schoolId || req.admin?.schoolId || null;
  if (!schoolId) {
    res.status(400).json({ error: 'schoolId is required' });
    return null;
  }
  if (!mongoose.isValidObjectId(schoolId)) {
    res.status(400).json({ error: 'Invalid schoolId' });
    return null;
  }
  return schoolId;
};

const resolveClassNames = async ({ schoolId, campusId, classId, sectionId }) => {
  let className = '';
  let sectionName = '';
  if (classId) {
    const classDoc = await ClassModel.findOne({
      _id: classId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    })
      .select('name')
      .lean();
    className = classDoc?.name || '';
  }
  if (sectionId) {
    const sectionDoc = await Section.findOne({
      _id: sectionId,
      schoolId,
      ...(campusId ? { campusId } : {}),
    })
      .select('name')
      .lean();
    sectionName = sectionDoc?.name || '';
  }
  return { className, sectionName };
};

const markNotificationsViewed = async ({ notificationIds = [], userId }) => {
  if (!userId || !Array.isArray(notificationIds) || notificationIds.length === 0) return;
  await Notification.updateMany(
    {
      _id: { $in: notificationIds },
      'viewedBy.userId': { $ne: userId },
    },
    {
      $inc: { views: 1 },
      $push: { viewedBy: { userId, viewedAt: new Date() } },
    }
  );
};

const buildCampusVisibilityFilter = (campusId) => (
  campusId
    ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
    : {}
);

const normalizeAudienceFromUserType = (userType) => (
  userType
    ? userType.charAt(0).toUpperCase() + userType.slice(1)
    : 'unknown'
);
const normalizePushUserType = (userType) => {
  const normalized = String(userType || '').trim().toLowerCase();
  if (normalized === 'admin' || normalized === 'super_admin') return 'Admin';
  if (normalized === 'teacher') return 'Teacher';
  if (normalized === 'student') return 'Student';
  if (normalized === 'parent') return 'Parent';
  if (normalized === 'principal') return 'Principal';
  return null;
};

const toComparableId = (value) => String(value?._id || value || '');

const hasUserEntry = (entries, userId) => (
  Array.isArray(entries)
    ? entries.some((entry) => toComparableId(entry?.userId) === toComparableId(userId))
    : false
);

const toObjectIdIfPossible = (value) => (
  mongoose.isValidObjectId(value) ? new mongoose.Types.ObjectId(value) : value
);

const ADMIN_SELF_HIDDEN_TYPES = ['notice', 'announcement'];

router.get('/push/public-key', authAnyUser, async (_req, res) => {
  // #swagger.tags = ['Notifications']
  const enabled = initializeWebPush();
  const key = process.env.WEB_PUSH_PUBLIC_KEY || '';
  return res.json({
    enabled: Boolean(enabled && key),
    publicKey: enabled ? key : '',
  });
});

router.post('/push/subscribe', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const schoolId = req.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const userId = req.user?.id;
    if (!userId || !mongoose.isValidObjectId(userId)) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    const userType = normalizePushUserType(req.userType || req.user?.userType || req.user?.type);
    if (!userType) {
      return res.status(400).json({ error: 'Unsupported user type for push subscription' });
    }

    const subscription = req.body?.subscription || req.body || {};
    const endpoint = String(subscription?.endpoint || '').trim();
    const p256dh = String(subscription?.keys?.p256dh || '').trim();
    const auth = String(subscription?.keys?.auth || '').trim();
    if (!endpoint || !p256dh || !auth) {
      return res.status(400).json({ error: 'Invalid subscription payload' });
    }

    const expirationTime = subscription?.expirationTime ? new Date(subscription.expirationTime) : null;
    const userAgent = String(req.headers['user-agent'] || '');

    const doc = await PushSubscription.findOneAndUpdate(
      { endpoint },
      {
        $set: {
          schoolId,
          campusId: req.campusId || null,
          userId: new mongoose.Types.ObjectId(String(userId)),
          userType,
          endpoint,
          expirationTime: expirationTime && !Number.isNaN(expirationTime.getTime()) ? expirationTime : null,
          keys: { p256dh, auth },
          userAgent,
          disabled: false,
        },
      },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    ).lean();

    return res.json({ success: true, id: doc?._id });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to save push subscription' });
  }
});

router.post('/push/unsubscribe', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const endpoint = String(req.body?.endpoint || '').trim();
    const userId = req.user?.id;
    if (!endpoint) return res.status(400).json({ error: 'endpoint is required' });
    if (!userId) return res.status(401).json({ error: 'User not authenticated' });

    await PushSubscription.deleteOne({
      endpoint,
      userId: toObjectIdIfPossible(userId),
    });
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to remove push subscription' });
  }
});

// Admin creates a notification
router.post('/', adminAuth, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = req.campusId || null;
    const { title, message, audience, classId, sectionId, type, typeLabel, priority, category, expiresAt, attachments, subjectId, isPinned } = req.body || {};
    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    const normalizedType = type ? String(type).trim().toLowerCase() : 'general';
    const allowedTypes = ['notice', 'class_note', 'assignment', 'exam', 'result', 'fee', 'general', 'announcement', 'other'];
    const safeType = allowedTypes.includes(normalizedType) ? normalizedType : 'general';
    const resolvedAudience =
      safeType === 'class_note'
        ? (audience && ['Student', 'Parent'].includes(audience) ? audience : 'Student')
        : (audience || 'All');

    const { className, sectionName } = await resolveClassNames({
      schoolId,
      campusId,
      classId,
      sectionId,
    });
    let subjectName = '';
    if (subjectId && mongoose.isValidObjectId(subjectId)) {
      const subjectDoc = await Subject.findOne({
        _id: subjectId,
        schoolId,
        ...(campusId ? { campusId } : {}),
      }).select('name').lean();
      subjectName = subjectDoc?.name || '';
    }

    const created = await Notification.create({
      schoolId,
      campusId: campusId || null,
      title: String(title).trim(),
      message: String(message).trim(),
      audience: resolvedAudience,
      classId: classId || undefined,
      sectionId: sectionId || undefined,
      createdBy: req.admin?.id || null,
      createdByType: 'admin',
      createdByName: req.admin?.name || req.admin?.username || '',
      type: safeType,
      typeLabel: typeLabel ? String(typeLabel).trim() : '',
      priority: priority || undefined,
      category: category || undefined,
      className,
      sectionName,
      subjectId: subjectId || undefined,
      subjectName,
      attachments: Array.isArray(attachments) ? attachments : [],
      isPinned: Boolean(isPinned),
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Teacher creates a class note
router.post('/teacher', authTeacher, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const schoolId = req.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;
    const { title, message, classId, sectionId, typeLabel, priority, category, expiresAt, attachments, subjectId } = req.body || {};

    if (!title || !String(title).trim() || !message || !String(message).trim()) {
      return res.status(400).json({ error: 'title and message are required' });
    }
    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'classId is required' });
    }
    if (!sectionId || !mongoose.isValidObjectId(sectionId)) {
      return res.status(400).json({ error: 'sectionId is required' });
    }

    const teacherId = req.user?.id;
    if (!teacherId) return res.status(401).json({ error: 'Unauthorized' });

    const allocationFilter = {
      schoolId,
      ...(campusId
        ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
        : {}),
      teacherId,
      classId,
      sectionId,
    };
    if (subjectId && mongoose.isValidObjectId(subjectId)) {
      allocationFilter.subjectId = subjectId;
    }
    let allocation = await TeacherAllocation.findOne(allocationFilter).lean();
    if (!allocation) {
      const timetableFilter = {
        schoolId,
        ...(campusId ? { campusId } : {}),
        classId,
        sectionId,
        'entries.teacherId': teacherId,
      };
      const timetable = await Timetable.findOne(timetableFilter)
        .select('entries')
        .populate('entries.subjectId', '_id')
        .lean();
      const hasMatch = (timetable?.entries || []).some((entry) => {
        if (String(entry.teacherId) !== String(teacherId)) return false;
        if (subjectId && mongoose.isValidObjectId(subjectId)) {
          return String(entry.subjectId?._id || entry.subjectId) === String(subjectId);
        }
        return true;
      });
      if (!hasMatch) {
        return res.status(403).json({ error: 'You are not assigned to this class/section' });
      }
      allocation = { fallback: true };
    }

    const teacher = await TeacherUser.findById(teacherId).select('name').lean();
    const { className, sectionName } = await resolveClassNames({
      schoolId,
      campusId,
      classId,
      sectionId,
    });
    let subjectName = '';
    if (subjectId && mongoose.isValidObjectId(subjectId)) {
      const subjectDoc = await Subject.findOne({
        _id: subjectId,
        schoolId,
        ...(campusId ? { campusId } : {}),
      }).select('name').lean();
      subjectName = subjectDoc?.name || '';
    }

    const created = await Notification.create({
      schoolId,
      campusId: campusId || null,
      title: String(title).trim(),
      message: String(message).trim(),
      audience: 'Student',
      classId,
      sectionId,
      createdByType: 'teacher',
      createdByTeacherId: teacherId,
      createdByName: teacher?.name || '',
      type: 'class_note',
      typeLabel: typeLabel ? String(typeLabel).trim() : '',
      priority: priority || undefined,
      category: category || undefined,
      className,
      sectionName,
      subjectId: subjectId || undefined,
      subjectName,
      attachments: Array.isArray(attachments) ? attachments : [],
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin list all notifications
router.get('/', adminAuth, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = req.campusId || null;
    const items = await Notification.find({
      schoolId,
      // Per-recipient system notifications (attendance, substitute alerts,
      // PTM invites, individual low-attendance alerts) aren't admin-authored
      // notices — keep them out of the Notice Board console (they still
      // reach students/parents/teachers via /user).
      typeLabel: { $nin: HIDDEN_FROM_NOTICEBOARD_TYPE_LABELS },
      ...(campusId
        ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
        : {}),
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Admin update a notification
router.patch('/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = req.campusId || null;
    const { id } = req.params;
    const updates = { ...(req.body || {}) };

    // className/sectionName are used as a fallback in the student visibility
    // filter — keep them in sync whenever classId/sectionId are edited.
    if (updates.classId !== undefined || updates.sectionId !== undefined) {
      const { className, sectionName } = await resolveClassNames({
        schoolId,
        campusId,
        classId: updates.classId,
        sectionId: updates.sectionId,
      });
      updates.className = className;
      updates.sectionName = sectionName;
    }

    const updated = await Notification.findOneAndUpdate(
      { _id: id, schoolId, ...(campusId ? { campusId } : {}) },
      updates,
      { new: true, runValidators: true }
    );
    if (!updated) return res.status(404).json({ error: 'Not found' });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin delete a notification
router.delete('/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const campusId = req.campusId || null;
    const { id } = req.params;
    const existing = await Notification.findOne({ _id: id, schoolId, ...(campusId ? { campusId } : {}) }).lean();
    if (!existing) return res.status(404).json({ error: 'Not found' });
    if (!req.isSuperAdmin && String(existing.createdByType || '').toLowerCase() === 'super_admin') {
      return res.status(403).json({ error: 'Super admin notices cannot be deleted by school admin' });
    }

    const deleted = await Notification.findOneAndDelete({ _id: id, schoolId, ...(campusId ? { campusId } : {}) });
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher list their class notes
router.get('/teacher', authTeacher, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const schoolId = req.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;
    const teacherId = req.user?.id;
    const items = await Notification.find({
      schoolId,
      ...(campusId
        ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
        : {}),
      createdByType: 'teacher',
      createdByTeacherId: teacherId,
      type: 'class_note',
    })
      .sort({ createdAt: -1 })
      .lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Teacher delete their class note
router.delete('/teacher/:id', authTeacher, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const schoolId = req.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;
    const teacherId = req.user?.id;
    const { id } = req.params;

    const deleted = await Notification.findOneAndDelete({
      _id: id,
      schoolId,
      ...(campusId
        ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
        : {}),
      createdByType: 'teacher',
      createdByTeacherId: teacherId,
      type: 'class_note',
    });
    if (!deleted) return res.status(404).json({ error: 'Not found' });
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Any user fetch their notifications
router.get('/user', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    logStudentPortalEvent(req, {
      feature: 'noticeboard',
      action: 'notifications.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const schoolId = req.schoolId;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });
    const campusId = req.campusId || null;
    const userType = req.userType;
    const userId = req.user?.id;
    const normalizedUserId = toObjectIdIfPossible(userId);
    const normalizedAudience = userType
      ? userType.charAt(0).toUpperCase() + userType.slice(1)
      : 'unknown';

    const filter = {
      schoolId,
      ...buildCampusVisibilityFilter(campusId),
      'dismissedBy.userId': { $ne: userId },
      $and: [
        {
          $or: [
            { targetUserIds: { $exists: false } },
            { targetUserIds: { $size: 0 } },
            { targetUserIds: { $in: [normalizedUserId, userId] } },
          ],
        },
        { $or: [{ audience: 'All' }, { audience: normalizedAudience }] },
        {
          $or: [
            { expiresAt: { $exists: false } },
            { expiresAt: null },
            { expiresAt: { $gt: new Date() } }
          ]
        }
      ]
    };

    if (normalizedAudience === 'Admin') {
      filter.$and.push({
        $or: [
          { createdBy: { $exists: false } },
          { createdBy: null },
          {
            $and: [
              { createdBy: userId },
              { type: { $nin: ADMIN_SELF_HIDDEN_TYPES } },
            ],
          },
          { createdBy: { $ne: userId } },
        ],
      });
    }

    if (normalizedAudience === 'Student') {
      const student = await StudentUser.findById(userId).select('grade section').lean();
      const rawClassName = student?.grade || '';
      const className = String(rawClassName || '').trim();
      const sectionName = student?.section || '';
      let classId = null;
      let sectionId = null;
      const classNameCandidates = new Set();
      if (className) {
        classNameCandidates.add(className);
        if (/^\d+$/i.test(className)) {
          classNameCandidates.add(`Class ${className}`);
        }
        if (/^class\s+/i.test(className)) {
          classNameCandidates.add(className.replace(/^class\s+/i, '').trim());
        }
      }
      if (classNameCandidates.size) {
        const classDoc = await ClassModel.findOne({
          schoolId,
          ...(campusId ? { campusId } : {}),
          name: { $in: Array.from(classNameCandidates) },
        }).select('_id name').lean();
        classId = classDoc?._id || null;
        if (classDoc?.name) {
          classNameCandidates.add(classDoc.name);
        }
      }
      if (classId && sectionName) {
        const sectionDoc = await Section.findOne({
          schoolId,
          ...(campusId ? { campusId } : {}),
          classId,
          name: sectionName
        }).select('_id').lean();
        sectionId = sectionDoc?._id || null;
      }

      filter.$and.push({
        $or: [
          { classId: { $exists: false } },
          { classId: null },
          classId ? { classId } : null,
          classNameCandidates.size ? { className: { $in: Array.from(classNameCandidates) } } : null,
        ].filter(Boolean),
      });
      if (sectionId || sectionName) {
        filter.$and.push({
          $or: [
            { sectionId: { $exists: false } },
            { sectionId: null },
            sectionId ? { sectionId } : null,
            sectionName ? { sectionName } : null,
          ].filter(Boolean),
        });
      }
    }

    if (normalizedAudience === 'Parent') {
      const parent = await ParentUser.findById(userId).select('childrenIds').lean();
      const childrenIds = Array.isArray(parent?.childrenIds) ? parent.childrenIds : [];
      const children = childrenIds.length
        ? await StudentUser.find({ _id: { $in: childrenIds } })
            .select('grade section')
            .lean()
        : [];
      const classNames = Array.from(new Set(children.map((c) => c.grade).filter(Boolean)));
      const sectionNames = Array.from(new Set(children.map((c) => c.section).filter(Boolean)));

      const classDocs = classNames.length
        ? await ClassModel.find({
            schoolId,
            ...(campusId ? { campusId } : {}),
            name: { $in: classNames },
          }).select('_id').lean()
        : [];
      const classIds = classDocs.map((c) => c._id);

      filter.$and.push({
        $or: [
          // Always allow direct, targeted notifications for this parent.
          { targetUserIds: { $in: [normalizedUserId, userId] } },
          {
            $or: [
              { classId: { $exists: false } },
              { classId: null },
              classIds.length ? { classId: { $in: classIds } } : null,
              classNames.length ? { className: { $in: classNames } } : null,
            ].filter(Boolean),
          },
        ],
      });

      if (sectionNames.length) {
        filter.$and.push({
          $or: [
            // Always allow direct, targeted notifications for this parent.
            { targetUserIds: { $in: [normalizedUserId, userId] } },
            { sectionId: { $exists: false } },
            { sectionId: null },
            { sectionName: { $in: sectionNames } },
          ],
        });
      }
    }

    const items = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    const unseenViewIds = items
      .filter((item) => !(item.viewedBy || []).some((v) => String(v.userId) === String(userId)))
      .map((item) => item._id);
    if (unseenViewIds.length) {
      await markNotificationsViewed({ notificationIds: unseenViewIds, userId });
      const seenSet = new Set(unseenViewIds.map((id) => String(id)));
      items.forEach((item) => {
        if (seenSet.has(String(item._id))) {
          item.views = Number(item.views || 0) + 1;
        }
      });
    }

    // Add isRead flag for each notification
    const itemsWithReadStatus = items.map(item => ({
      ...item,
      isRead: hasUserEntry(item.readBy, userId)
    }));

    res.json(itemsWithReadStatus);
    logStudentPortalEvent(req, {
      feature: 'noticeboard',
      action: 'notifications.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: userId,
      resultCount: itemsWithReadStatus.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'noticeboard',
      action: 'notifications.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: err.message });
  }
});

// Mark notification as read
router.patch('/user/:id/read', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const userType = req.userType;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid notification id' });
    }

    const normalizedAudience = normalizeAudienceFromUserType(userType);
    const normalizedUserId = toObjectIdIfPossible(userId);
    const filter = {
      _id: id,
      schoolId,
      ...buildCampusVisibilityFilter(campusId),
      $and: [
        {
          $or: [
            { targetUserIds: { $exists: false } },
            { targetUserIds: { $size: 0 } },
            { targetUserIds: normalizedUserId },
          ],
        },
      ],
      $or: [{ audience: 'All' }, { audience: normalizedAudience }],
      'dismissedBy.userId': { $ne: normalizedUserId },
    };

    if (normalizedAudience === 'Admin') {
      filter.$and.push({
        $or: [
          { createdBy: { $exists: false } },
          { createdBy: null },
          {
            $and: [
              { createdBy: normalizedUserId },
              { type: { $nin: ADMIN_SELF_HIDDEN_TYPES } },
            ],
          },
          { createdBy: { $ne: normalizedUserId } },
        ],
      });
    }

    const notification = await Notification.findOne(filter);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const alreadyViewed = hasUserEntry(notification.viewedBy, userId);
    if (!alreadyViewed) {
      notification.viewedBy.push({ userId, viewedAt: new Date() });
      notification.views = Number(notification.views || 0) + 1;
    }

    const alreadyRead = hasUserEntry(notification.readBy, userId);
    if (!alreadyRead) {
      notification.readBy.push({ userId, readAt: new Date() });
    }
    if (!alreadyRead || !alreadyViewed) await notification.save();

    res.json({ success: true, notification });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Dismiss notification (hide from view)
router.patch('/user/:id/dismiss', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const notification = await Notification.findById(id);
    if (!notification) {
      return res.status(404).json({ error: 'Notification not found' });
    }

    const dismissedBy = Array.isArray(notification.dismissedBy) ? notification.dismissedBy : [];
    const alreadyDismissed = dismissedBy.some(d => d.userId.toString() === userId);
    if (!alreadyDismissed) {
      notification.dismissedBy.push({ userId, dismissedAt: new Date() });
      await notification.save();
    }

    res.json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Mark all as read
router.post('/user/read-all', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const userId = req.user?.id;
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const userType = req.userType;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const normalizedAudience = normalizeAudienceFromUserType(userType);
    const normalizedUserId = toObjectIdIfPossible(userId);

    const filter = {
      schoolId,
      ...buildCampusVisibilityFilter(campusId),
      $and: [
        {
          $or: [
            { targetUserIds: { $exists: false } },
            { targetUserIds: { $size: 0 } },
            { targetUserIds: normalizedUserId },
          ],
        },
      ],
      $or: [{ audience: 'All' }, { audience: normalizedAudience }],
      'readBy.userId': { $ne: normalizedUserId },
      'dismissedBy.userId': { $ne: normalizedUserId }
    };

    if (normalizedAudience === 'Admin') {
      filter.$and.push({
        $or: [
          { createdBy: { $exists: false } },
          { createdBy: null },
          {
            $and: [
              { createdBy: normalizedUserId },
              { type: { $nin: ADMIN_SELF_HIDDEN_TYPES } },
            ],
          },
          { createdBy: { $ne: normalizedUserId } },
        ],
      });
    }

    await Notification.updateMany(
      filter,
      { $addToSet: { readBy: { userId: normalizedUserId } } }
    );

    res.json({ success: true });
    logStudentPortalEvent(req, {
      feature: 'noticeboard',
      action: 'notifications.read_all',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: userId,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'noticeboard',
      action: 'notifications.read_all',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: err.message });
  }
});

// Get unread count
router.get('/user/unread-count', authAnyUser, async (req, res) => {
  // #swagger.tags = ['Notifications']
  try {
    const userId = req.user?.id;
    const schoolId = req.schoolId;
    const campusId = req.campusId || null;
    const userType = req.userType;

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    const normalizedAudience = normalizeAudienceFromUserType(userType);
    const normalizedUserId = toObjectIdIfPossible(userId);

    const filter = {
      schoolId,
      ...buildCampusVisibilityFilter(campusId),
      $and: [
        {
          $or: [
            { targetUserIds: { $exists: false } },
            { targetUserIds: { $size: 0 } },
            { targetUserIds: normalizedUserId },
          ],
        },
      ],
      $or: [{ audience: 'All' }, { audience: normalizedAudience }],
      'readBy.userId': { $ne: normalizedUserId },
      'dismissedBy.userId': { $ne: normalizedUserId }
    };

    if (normalizedAudience === 'Admin') {
      filter.$and.push({
        $or: [
          { createdBy: { $exists: false } },
          { createdBy: null },
          {
            $and: [
              { createdBy: normalizedUserId },
              { type: { $nin: ADMIN_SELF_HIDDEN_TYPES } },
            ],
          },
          { createdBy: { $ne: normalizedUserId } },
        ],
      });
    }

    const count = await Notification.countDocuments(filter);
    res.json({ count });
    logStudentPortalEvent(req, {
      feature: 'noticeboard',
      action: 'notifications.unread_count',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: userId,
      resultCount: count,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'noticeboard',
      action: 'notifications.unread_count',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
