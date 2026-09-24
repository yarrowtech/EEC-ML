const mongoose = require('mongoose');
const webpush = require('web-push');
const PushSubscription = require('../models/PushSubscription');
const School = require('../models/School');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const TeacherUser = require('../models/TeacherUser');
const Admin = require('../models/Admin');
const Principal = require('../models/Principal');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');

const normalizeString = (value = '') => String(value || '').trim().toLowerCase();

let isConfigured = false;
let initialized = false;

const initializeWebPush = () => {
  if (initialized) return isConfigured;
  initialized = true;

  const publicKey = process.env.WEB_PUSH_PUBLIC_KEY || '';
  const privateKey = process.env.WEB_PUSH_PRIVATE_KEY || '';
  const contact = process.env.WEB_PUSH_CONTACT || 'mailto:support@eecschools.com';

  if (!publicKey || !privateKey) {
    isConfigured = false;
    return false;
  }

  try {
    webpush.setVapidDetails(contact, publicKey, privateKey);
    isConfigured = true;
    return true;
  } catch (_err) {
    isConfigured = false;
    return false;
  }
};

const resolveAudienceUserTypes = (audience = 'All') => {
  const normalized = String(audience || 'All').trim();
  if (normalized === 'All') {
    return ['Admin', 'Teacher', 'Student', 'Parent', 'Principal'];
  }
  return [normalized];
};

const buildCampusScopeFilter = (campusId) => (
  campusId
    ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] }
    : {}
);

const buildClassNameCandidates = (value) => {
  const className = String(value || '').trim();
  if (!className) return [];
  const set = new Set([className]);
  if (/^\d+$/i.test(className)) set.add(`Class ${className}`);
  if (/^class\s+/i.test(className)) set.add(className.replace(/^class\s+/i, '').trim());
  return Array.from(set).filter(Boolean);
};

const resolveStudentTargetIds = async (notification) => {
  const schoolId = notification?.schoolId;
  if (!schoolId) return [];
  const classNameCandidates = buildClassNameCandidates(notification?.className);
  let resolvedClassNameCandidates = [...classNameCandidates];
  let resolvedSectionName = String(notification?.sectionName || '').trim();

  if (notification?.classId && mongoose.isValidObjectId(notification.classId)) {
    const classDoc = await ClassModel.findById(notification.classId).select('name').lean();
    if (classDoc?.name) {
      resolvedClassNameCandidates = Array.from(
        new Set([...resolvedClassNameCandidates, ...buildClassNameCandidates(classDoc.name)])
      );
    }
  }
  if (!resolvedSectionName && notification?.sectionId && mongoose.isValidObjectId(notification.sectionId)) {
    const sectionDoc = await Section.findById(notification.sectionId).select('name').lean();
    if (sectionDoc?.name) resolvedSectionName = sectionDoc.name;
  }

  const studentFilter = {
    schoolId,
    ...(notification?.campusId ? { campusId: notification.campusId } : {}),
    isArchived: false,
  };

  if (resolvedClassNameCandidates.length) {
    studentFilter.grade = { $in: resolvedClassNameCandidates };
  }
  if (resolvedSectionName) {
    studentFilter.section = resolvedSectionName;
  }

  const students = await StudentUser.find(studentFilter).select('_id').lean();
  return students.map((student) => student._id);
};

const resolveParentTargetIds = async (studentIds = []) => {
  if (!studentIds.length) return [];
  const parents = await ParentUser.find({ childrenIds: { $in: studentIds } }).select('_id').lean();
  return parents.map((parent) => parent._id);
};

const resolveTeacherTargetIds = async (notification) => {
  const teachers = await TeacherUser.find({
    schoolId: notification.schoolId,
    ...(notification?.campusId ? { campusId: notification.campusId } : {}),
  }).select('_id').lean();
  return teachers.map((item) => item._id);
};

const resolveAdminTargetIds = async (notification) => {
  const admins = await Admin.find({
    schoolId: notification.schoolId,
    ...buildCampusScopeFilter(notification?.campusId || null),
  }).select('_id').lean();
  return admins.map((item) => item._id);
};

const resolvePrincipalTargetIds = async (notification) => {
  const principals = await Principal.find({
    schoolId: notification.schoolId,
    ...buildCampusScopeFilter(notification?.campusId || null),
  }).select('_id').lean();
  return principals.map((item) => item._id);
};

const resolveUserTargetMap = async (notification) => {
  const wantedTypes = resolveAudienceUserTypes(notification?.audience || 'All');
  const explicitTargetIds = Array.isArray(notification?.targetUserIds)
    ? notification.targetUserIds.map((id) => String(id))
    : [];
  const explicitSet = new Set(explicitTargetIds);

  const targetMap = new Map();
  const pushTarget = (type, ids) => {
    if (!Array.isArray(ids)) return;
    ids.forEach((id) => {
      const key = String(id);
      if (!key) return;
      if (!targetMap.has(type)) targetMap.set(type, new Set());
      targetMap.get(type).add(key);
    });
  };

  let studentIds = [];
  if (wantedTypes.includes('Student') || wantedTypes.includes('Parent')) {
    studentIds = (await resolveStudentTargetIds(notification)).map((id) => String(id));
  }
  if (wantedTypes.includes('Student')) pushTarget('Student', studentIds);
  if (wantedTypes.includes('Parent')) {
    const parentIds = (await resolveParentTargetIds(studentIds)).map((id) => String(id));
    pushTarget('Parent', parentIds);
  }
  if (wantedTypes.includes('Teacher')) {
    pushTarget('Teacher', (await resolveTeacherTargetIds(notification)).map((id) => String(id)));
  }
  if (wantedTypes.includes('Admin')) {
    pushTarget('Admin', (await resolveAdminTargetIds(notification)).map((id) => String(id)));
  }
  if (wantedTypes.includes('Principal')) {
    pushTarget('Principal', (await resolvePrincipalTargetIds(notification)).map((id) => String(id)));
  }

  if (explicitSet.size > 0) {
    for (const [type, idSet] of targetMap.entries()) {
      targetMap.set(type, new Set(Array.from(idSet).filter((id) => explicitSet.has(id))));
    }
  }

  return targetMap;
};

const resolveNotificationPath = (notification, userType) => {
  const type = normalizeString(notification?.type || notification?.typeLabel || '');
  const content = normalizeString(`${notification?.title || ''} ${notification?.message || ''}`);

  if (userType === 'Student') {
    if (content.includes('attendance')) return '/student/attendance';
    if (content.includes('achievement')) return '/student/achievements';
    if (type.includes('assignment')) return '/student/assignments';
    if (type.includes('exam') || type.includes('result')) return '/student/results';
    if (type.includes('fee')) return '/student/fees';
    return '/student/noticeboard';
  }
  if (userType === 'Teacher') {
    if (content.includes('attendance')) return '/teacher/attendance';
    if (content.includes('feedback')) return '/teacher/feedback';
    if (type.includes('assignment')) return '/teacher/assignments';
    return '/teacher/dashboard';
  }
  if (userType === 'Parent') {
    if (content.includes('attendance')) return '/parents/attendance';
    if (content.includes('fee') || content.includes('payment')) return '/parents/fees';
    if (content.includes('result') || content.includes('exam')) return '/parents/results';
    return '/parents';
  }
  if (userType === 'Principal') {
    if (content.includes('finance') || content.includes('fee')) return '/principal/finance';
    if (content.includes('staff') || content.includes('teacher')) return '/principal/staff';
    return '/principal/notifications';
  }
  return '/admin/notices';
};

const resolveSchoolIcon = async (schoolId) => {
  if (!schoolId || !mongoose.isValidObjectId(schoolId)) return '';
  const school = await School.findById(schoolId).select('logo').lean();
  const logo = school?.logo || {};
  return String(logo?.secure_url || logo?.url || '').trim();
};

const pruneFailedSubscription = async (subscriptionDoc) => {
  await PushSubscription.updateOne(
    { _id: subscriptionDoc._id },
    {
      $set: { lastFailureAt: new Date() },
      $inc: { failureCount: 1 },
    }
  );
};

const markSuccessfulDelivery = async (subscriptionDoc) => {
  await PushSubscription.updateOne(
    { _id: subscriptionDoc._id },
    {
      $set: { lastSuccessAt: new Date(), failureCount: 0, disabled: false },
    }
  );
};

const disableSubscription = async (subscriptionDoc) => {
  await PushSubscription.updateOne(
    { _id: subscriptionDoc._id },
    {
      $set: { disabled: true, lastFailureAt: new Date() },
      $inc: { failureCount: 1 },
    }
  );
};

const sendPushForNotification = async (notificationInput) => {
  const configured = initializeWebPush();
  if (!configured) return { ok: false, reason: 'web_push_not_configured' };

  const notification = notificationInput?.toObject ? notificationInput.toObject() : notificationInput;
  if (!notification?.schoolId) return { ok: false, reason: 'missing_school' };
  if (notification?.expiresAt && new Date(notification.expiresAt) < new Date()) {
    return { ok: false, reason: 'notification_expired' };
  }

  const targetMap = await resolveUserTargetMap(notification);
  const targetTypes = Array.from(targetMap.keys());
  if (!targetTypes.length) return { ok: true, sent: 0 };

  const subscriptionFilter = {
    schoolId: notification.schoolId,
    userType: { $in: targetTypes },
    disabled: false,
    ...buildCampusScopeFilter(notification?.campusId || null),
  };
  const subscriptions = await PushSubscription.find(subscriptionFilter).lean();
  if (!subscriptions.length) return { ok: true, sent: 0 };
  const schoolIcon = await resolveSchoolIcon(notification.schoolId);

  let sent = 0;
  for (const sub of subscriptions) {
    const userId = String(sub.userId);
    const typeSet = targetMap.get(sub.userType);
    if (!typeSet || !typeSet.has(userId)) continue;
    const payload = JSON.stringify({
      title: notification.title || 'New Notification',
      body: notification.message || '',
      icon: schoolIcon || '',
      badge: schoolIcon || '',
      tag: `notif-${notification._id}-${sub.userType}-${userId}`,
      data: {
        notificationId: String(notification._id),
        path: resolveNotificationPath(notification, sub.userType),
        userType: sub.userType,
      },
    });
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          expirationTime: sub.expirationTime || null,
          keys: {
            p256dh: sub.keys?.p256dh,
            auth: sub.keys?.auth,
          },
        },
        payload
      );
      sent += 1;
      await markSuccessfulDelivery(sub);
    } catch (err) {
      const statusCode = Number(err?.statusCode || err?.status || 0);
      // 404/410 = subscription gone; 403 = it was created with a different VAPID
      // key (keys rotated) — all are dead, so drop them and let the browser resubscribe.
      if (statusCode === 404 || statusCode === 410 || statusCode === 403) {
        await disableSubscription(sub);
      } else {
        await pruneFailedSubscription(sub);
      }
    }
  }

  return { ok: true, sent };
};

module.exports = {
  initializeWebPush,
  sendPushForNotification,
};
