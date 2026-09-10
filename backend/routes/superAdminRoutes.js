const express = require('express');
const mongoose = require('mongoose');
const Admin = require('../models/Admin');
const School = require('../models/School');
const StudentUser = require('../models/StudentUser');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const StaffUser = require('../models/StaffUser');
const Principal = require('../models/Principal');
const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');
const SuperAdminAnnouncement = require('../models/SuperAdminAnnouncement');
const SuperAdminCompliance = require('../models/SuperAdminCompliance');
const SuperAdminActivity = require('../models/SuperAdminActivity');
const adminAuth = require('../middleware/adminAuth');
const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const { deleteSchoolScopedData } = require('../utils/deleteSchoolCascade');
const { recordPlatformAudit } = require('../utils/platformAudit');
const {
  ACTIVE_STUDENT_FILTER,
  ACTIVE_PARENT_FILTER,
  ACTIVE_TEACHER_FILTER,
  ACTIVE_STAFF_FILTER,
  ACTIVE_ADMIN_FILTER,
} = require('../utils/studentStatus');

const escapeRegex = (value = '') => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const router = express.Router();

const ensureSuperAdmin = (req, res, next) => {
  if (!req.isSuperAdmin) {
    return res.status(403).json({ error: 'Super admin access required' });
  }
  return next();
};

const resolveSchoolIdOrError = async (schoolId, res) => {
  if (!schoolId || !mongoose.isValidObjectId(schoolId)) {
    res.status(400).json({ error: 'Valid schoolId is required' });
    return null;
  }
  const exists = await School.exists({ _id: schoolId });
  if (!exists) {
    res.status(404).json({ error: 'School not found' });
    return null;
  }
  return schoolId;
};

const resolveBroadcastSchoolFilter = (audience = 'All schools') => {
  const normalized = String(audience || '').trim().toLowerCase();
  if (normalized === 'premium schools') {
    return { registrationStatus: 'approved', subscriptionPlan: { $in: ['premium', 'enterprise'] } };
  }
  if (normalized === 'pending onboarding') {
    return { registrationStatus: 'pending' };
  }
  return { registrationStatus: 'approved' };
};

const DEFAULT_COMPLIANCE_ITEMS = [
  {
    title: 'Data residency attestation',
    status: 'pending',
    owner: 'Legal',
    dueDate: '2024-02-10',
  },
  {
    title: 'SOC2 quarterly backup drill',
    status: 'in_progress',
    owner: 'Security',
    dueDate: '2024-02-08',
  },
  {
    title: 'GDPR DPIA update',
    status: 'completed',
    owner: 'Privacy Office',
    dueDate: '2024-01-28',
  },
];

const toOpsAnnouncement = (item) => ({
  id: String(item?._id || ''),
  title: item?.title || '',
  message: item?.message || '',
  audience: item?.audience || 'All schools',
  createdAt: item?.createdAt || item?.updatedAt || new Date().toISOString(),
  owner: item?.createdByName || 'Super Admin',
  status: item?.status || 'sent',
  targetSchools: Number(item?.targetSchools || 0),
  notificationsCreated: Number(item?.notificationsCreated || 0),
});

const toOpsCompliance = (item) => ({
  id: String(item?._id || ''),
  title: item?.title || '',
  status: item?.status || 'pending',
  owner: item?.owner || '',
  dueDate: item?.dueDate || '',
});

const toOpsActivity = (item) => ({
  id: String(item?._id || ''),
  label: item?.label || '',
  timestamp: item?.timestamp || item?.createdAt || new Date().toISOString(),
  type: item?.type || 'other',
});

const ensureComplianceSeed = async () => {
  const count = await SuperAdminCompliance.countDocuments();
  if (count > 0) return;
  await SuperAdminCompliance.insertMany(DEFAULT_COMPLIANCE_ITEMS);
};

// Overview counts (super admin only)
router.get('/overview', adminAuth, ensureSuperAdmin, async (_req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const [
      schoolTotal,
      schoolActive,
      schoolInactive,
      pendingRegistrations,
      approvedRegistrations,
      rejectedRegistrations,
      superAdmins,
      schoolAdmins,
      students,
      teachers,
      parents,
      principals,
    ] = await Promise.all([
      School.countDocuments(),
      School.countDocuments({ status: 'active' }),
      School.countDocuments({ status: 'inactive' }),
      School.countDocuments({ registrationStatus: 'pending' }),
      School.countDocuments({ registrationStatus: 'approved' }),
      School.countDocuments({ registrationStatus: 'rejected' }),
      Admin.countDocuments({ schoolId: null }),
      Admin.countDocuments({ schoolId: { $ne: null } }),
      StudentUser.countDocuments(ACTIVE_STUDENT_FILTER),
      TeacherUser.countDocuments(ACTIVE_TEACHER_FILTER),
      ParentUser.countDocuments(ACTIVE_PARENT_FILTER),
      Principal.countDocuments(),
    ]);

    res.json({
      schools: {
        total: schoolTotal,
        active: schoolActive,
        inactive: schoolInactive,
        registrations: {
          pending: pendingRegistrations,
          approved: approvedRegistrations,
          rejected: rejectedRegistrations,
        },
      },
      admins: {
        superAdmins,
        schoolAdmins,
      },
      users: {
        students,
        teachers,
        parents,
        principals,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// List schools (super admin only)
router.get('/schools', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { status, registrationStatus, q } = req.query || {};
    const filter = {};

    if (status) {
      filter.status = status;
    }
    if (registrationStatus) {
      filter.registrationStatus = registrationStatus;
    }
    if (q && String(q).trim()) {
      const query = escapeRegex(String(q).trim());
      filter.$or = [
        { name: { $regex: query, $options: 'i' } },
        { code: { $regex: query, $options: 'i' } },
        { officialEmail: { $regex: query, $options: 'i' } },
      ];
    }

    const schools = await School.find(filter).sort({ createdAt: -1 }).lean();
    res.json(schools);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Operations data (super admin only)
router.get('/operations/data', adminAuth, ensureSuperAdmin, async (_req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    await ensureComplianceSeed();
    const [announcements, complianceItems, activityFeed] = await Promise.all([
      SuperAdminAnnouncement.find().sort({ createdAt: -1 }).limit(100).lean(),
      SuperAdminCompliance.find().sort({ createdAt: -1 }).limit(100).lean(),
      SuperAdminActivity.find().sort({ timestamp: -1, createdAt: -1 }).limit(200).lean(),
    ]);
    return res.json({
      announcements: announcements.map(toOpsAnnouncement),
      complianceItems: complianceItems.map(toOpsCompliance),
      activityFeed: activityFeed.map(toOpsActivity),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to fetch operations data' });
  }
});

// Update compliance item status (super admin only)
router.patch('/operations/compliance/:id', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { id } = req.params;
    const { status } = req.body || {};
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid compliance item id' });
    }
    if (!['pending', 'in_progress', 'completed'].includes(String(status || ''))) {
      return res.status(400).json({ error: 'Invalid compliance status' });
    }
    const updated = await SuperAdminCompliance.findByIdAndUpdate(
      id,
      { $set: { status: String(status) } },
      { new: true, runValidators: true }
    ).lean();
    if (!updated) {
      return res.status(404).json({ error: 'Compliance item not found' });
    }
    const activity = await SuperAdminActivity.create({
      label: `Compliance ${String(status)}: ${updated.title}`,
      type: 'compliance',
      timestamp: new Date(),
    });
    await recordPlatformAudit(req, {
      action: 'compliance.status_update',
      entity: 'compliance_item',
      entityId: id,
      meta: { title: updated.title, status: String(status) },
    });
    return res.json({
      item: toOpsCompliance(updated),
      activity: toOpsActivity(activity),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to update compliance item' });
  }
});

// Broadcast announcement to schools (super admin only)
router.post('/announcements/broadcast', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { title, message, audience = 'All schools', priority = 'medium', expiresAt } = req.body || {};
    const safeTitle = String(title || '').trim();
    const safeMessage = String(message || '').trim();
    if (!safeTitle || !safeMessage) {
      return res.status(400).json({ error: 'title and message are required' });
    }

    const allowedPriority = new Set(['low', 'medium', 'high']);
    const safePriority = allowedPriority.has(String(priority || '').trim().toLowerCase())
      ? String(priority).trim().toLowerCase()
      : 'medium';

    const schoolFilter = resolveBroadcastSchoolFilter(audience);
    const schools = await School.find(schoolFilter).select('_id').lean();
    if (!schools.length) {
      return res.status(404).json({ error: 'No schools matched the selected audience' });
    }

    const docs = schools.map((school) => ({
      schoolId: school._id,
      campusId: null,
      title: safeTitle,
      message: safeMessage,
      audience: 'Admin',
      createdBy: req.admin?.id || req.admin?._id || null,
      createdByType: 'super_admin',
      createdByName: req.admin?.name || req.admin?.username || 'Super Admin',
      type: 'announcement',
      typeLabel: 'Super Admin Broadcast',
      priority: safePriority,
      category: 'general',
      expiresAt: expiresAt ? new Date(expiresAt) : undefined,
    }));

    const created = await Notification.insertMany(docs, { ordered: false });
    const announcement = await SuperAdminAnnouncement.create({
      title: safeTitle,
      message: safeMessage,
      audience: String(audience || 'All schools'),
      status: 'sent',
      targetSchools: schools.length,
      notificationsCreated: Array.isArray(created) ? created.length : 0,
      createdBy: req.admin?.id || req.admin?._id || null,
      createdByName: req.admin?.name || req.admin?.username || 'Super Admin',
    });
    const activity = await SuperAdminActivity.create({
      label: `Broadcast sent: ${safeTitle}`,
      type: 'broadcast',
      timestamp: new Date(),
    });
    await recordPlatformAudit(req, {
      action: 'announcement.broadcast',
      entity: 'announcement',
      entityId: announcement._id,
      meta: { title: safeTitle, audience: String(audience || 'All schools'), targetSchools: schools.length },
    });
    return res.status(201).json({
      message: 'Announcement broadcast sent',
      targetSchools: schools.length,
      notificationsCreated: Array.isArray(created) ? created.length : 0,
      audience: String(audience || 'All schools'),
      announcement: toOpsAnnouncement(announcement),
      activity: toOpsActivity(activity),
    });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Failed to broadcast announcement' });
  }
});

// Get school details (super admin only)
router.get('/schools/:id', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid school id' });
    }
    const school = await School.findById(id).lean();
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update school status (super admin only)
router.patch('/schools/:id/status', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { id } = req.params;
    const { status, suspensionReason } = req.body || {};
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid school id' });
    }
    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ error: 'status must be active or inactive' });
    }

    const update = { status };
    if (status === 'inactive') {
      update.subscriptionStatus = 'suspended';
      update.suspendedAt = new Date();
      update.suspendedBy = req.admin.id || req.admin._id;
      update.suspensionReason = suspensionReason ? String(suspensionReason).trim() : undefined;
    } else {
      update.subscriptionStatus = 'active';
      update.suspendedAt = undefined;
      update.suspendedBy = undefined;
      update.suspensionReason = undefined;
    }

    const school = await School.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    await recordPlatformAudit(req, {
      action: 'school.status_update',
      entity: 'school',
      entityId: school._id,
      schoolId: school._id,
      meta: { status, suspensionReason: update.suspensionReason },
    });
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update subscription (super admin only)
const SUBSCRIPTION_FIELD_RULES = {
  subscriptionPlan: (v) => ['trial', 'basic', 'premium', 'enterprise'].includes(v),
  subscriptionStatus: (v) => ['active', 'suspended', 'expired', 'cancelled'].includes(v),
  subscriptionStartDate: (v) => !Number.isNaN(Date.parse(v)),
  subscriptionEndDate: (v) => !Number.isNaN(Date.parse(v)),
  paymentStatus: (v) => ['pending', 'partial', 'completed', 'failed'].includes(v),
  paymentAmount: (v) => typeof v === 'number' && Number.isFinite(v) && v >= 0,
  invoiceNumber: (v) => typeof v === 'string' && v.length <= 100,
  commercialStatus: (v) => [
    'pending_review', 'verified', 'contacted', 'negotiating',
    'payment_pending', 'paid', 'active', 'suspended',
  ].includes(v),
  superAdminNotes: (v) => typeof v === 'string' && v.length <= 5000,
};

router.patch('/schools/:id/subscription', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid school id' });
    }

    const update = {};
    for (const [field, isValid] of Object.entries(SUBSCRIPTION_FIELD_RULES)) {
      const value = req.body?.[field];
      if (value === undefined) continue;
      if (!isValid(value)) {
        return res.status(400).json({ error: `Invalid value for ${field}` });
      }
      update[field] = value;
    }
    if (Object.keys(update).length === 0) {
      return res.status(400).json({ error: 'No valid subscription fields provided' });
    }

    const school = await School.findByIdAndUpdate(id, update, { new: true, runValidators: true });
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }
    await recordPlatformAudit(req, {
      action: 'school.subscription_update',
      entity: 'school',
      entityId: school._id,
      schoolId: school._id,
      meta: { fields: Object.keys(update) },
    });
    res.json(school);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete school (super admin only)
router.delete('/schools/:id', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid school id' });
    }

    const school = await School.findById(id);
    if (!school) {
      return res.status(404).json({ error: 'School not found' });
    }

    const deletedCollections = await deleteSchoolScopedData(id);
    await School.deleteOne({ _id: id });

    await recordPlatformAudit(req, {
      action: 'school.delete',
      entity: 'school',
      entityId: id,
      schoolId: id,
      meta: { schoolName: school.name, deletedCollections },
    });

    res.json({
      message: 'School and associated data deleted successfully',
      deletedCollections,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to delete school' });
  }
});

// Create school admin (super admin only)
router.post('/admins', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  const { username, password, name, schoolId } = req.body || {};
  try {
    if (!username || !String(username).trim()) {
      return res.status(400).json({ error: 'username is required' });
    }
    if (!password || !String(password).trim()) {
      return res.status(400).json({ error: 'password is required' });
    }
    if (!isStrongPassword(password)) {
      return res.status(400).json({ error: passwordPolicyMessage });
    }
    const resolved = await resolveSchoolIdOrError(schoolId, res);
    if (!resolved) return;

    const admin = new Admin({
      username: String(username).trim(),
      password: String(password).trim(),
      name: name ? String(name).trim() : undefined,
      schoolId: resolved,
    });
    await admin.save();

    await recordPlatformAudit(req, {
      action: 'school_admin.create',
      entity: 'admin',
      entityId: admin._id,
      schoolId: resolved,
      meta: { username: admin.username },
    });

    const created = await Admin.findById(admin._id)
      .select('-password')
      .populate('schoolId', 'name code')
      .lean();
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List admins (super admin only)
router.get('/admins', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { schoolId, scope } = req.query || {};
    const filter = {};
    if (scope === 'super') {
      filter.schoolId = null;
    } else if (scope === 'school') {
      filter.schoolId = { $ne: null };
    }
    if (schoolId && mongoose.isValidObjectId(schoolId)) {
      filter.schoolId = schoolId;
    }
    const admins = await Admin.find(filter)
      .select('-password')
      .populate('schoolId', 'name code')
      .lean();
    res.json(admins);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update admin (super admin only)
router.patch('/admins/:id', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }

    const existing = await Admin.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const update = {};
    if (req.body?.name !== undefined) {
      update.name = String(req.body.name).trim();
    }
    if (req.body?.password !== undefined) {
      if (!isStrongPassword(req.body.password)) {
        return res.status(400).json({ error: passwordPolicyMessage });
      }
      update.password = req.body.password;
    }
    if (req.body?.schoolId !== undefined) {
      if (existing.schoolId === null) {
        return res.status(400).json({ error: 'Cannot change schoolId for super admin' });
      }
      const resolved = await resolveSchoolIdOrError(req.body.schoolId, res);
      if (!resolved) return;
      update.schoolId = resolved;
    }

    const updated = await Admin.findByIdAndUpdate(id, update, { new: true })
      .select('-password')
      .populate('schoolId', 'name code')
      .lean();
    await recordPlatformAudit(req, {
      action: 'school_admin.update',
      entity: 'admin',
      entityId: id,
      schoolId: updated?.schoolId?._id || existing.schoolId,
      meta: {
        fields: Object.keys(update).filter((key) => key !== 'password'),
        passwordChanged: update.password !== undefined,
      },
    });
    res.json(updated);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Delete admin (super admin only)
router.delete('/admins/:id', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid admin id' });
    }

    const existing = await Admin.findById(id);
    if (!existing) {
      return res.status(404).json({ error: 'Admin not found' });
    }
    if (existing.schoolId === null) {
      return res.status(400).json({ error: 'Cannot delete super admin' });
    }

    await Admin.deleteOne({ _id: id });
    await recordPlatformAudit(req, {
      action: 'school_admin.delete',
      entity: 'admin',
      entityId: id,
      schoolId: existing.schoolId,
      meta: { username: existing.username },
    });
    res.json({ message: 'Admin deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/* ────────────────────────────────────────────────────────────────────────────
 * Platform usage — "is this school / role / user actually using the system?"
 * Reads `lastActiveAt` (stamped by middleware/activityTracker.js) plus the
 * legacy `lastLoginAt`. Super-admin only; no tenant scope (platform-wide).
 * ──────────────────────────────────────────────────────────────────────────── */

const USAGE_ROLES = [
  { key: 'student', Model: StudentUser, idField: 'studentCode', statusField: 'status', baseFilter: ACTIVE_STUDENT_FILTER },
  { key: 'teacher', Model: TeacherUser, idField: 'employeeCode', statusField: null, baseFilter: ACTIVE_TEACHER_FILTER },
  { key: 'parent', Model: ParentUser, idField: 'username', statusField: null, baseFilter: ACTIVE_PARENT_FILTER },
  { key: 'staff', Model: StaffUser, idField: 'employeeCode', statusField: 'status', baseFilter: ACTIVE_STAFF_FILTER },
  { key: 'principal', Model: Principal, idField: 'username', statusField: null, baseFilter: {} },
  { key: 'admin', Model: Admin, idField: 'username', statusField: 'status', baseFilter: { role: { $ne: 'super_admin' }, ...ACTIVE_ADMIN_FILTER } },
];

const USAGE_PER_ROLE_CAP = 500;

const usageWindows = () => {
  const now = Date.now();
  const day = 24 * 60 * 60 * 1000;
  return {
    now,
    d1: new Date(now - day),
    d7: new Date(now - 7 * day),
    d30: new Date(now - 30 * day),
  };
};

const usageCounters = ({ d1, d7, d30 }) => ({
  total: { $sum: 1 },
  active24h: { $sum: { $cond: [{ $gte: ['$lastActiveAt', d1] }, 1, 0] } },
  active7d: { $sum: { $cond: [{ $gte: ['$lastActiveAt', d7] }, 1, 0] } },
  active30d: { $sum: { $cond: [{ $gte: ['$lastActiveAt', d30] }, 1, 0] } },
  everActive: { $sum: { $cond: [{ $ifNull: ['$lastActiveAt', false] }, 1, 0] } },
  lastActivityAt: { $max: '$lastActiveAt' },
});

const deriveSchoolHealth = (acc) => {
  if (!acc.lastActivityAt) return 'never';
  if (acc.active7d > 0) return 'active';
  if (acc.active30d > 0) return 'low';
  return 'dormant';
};

// Platform-wide totals + per-role split.
router.get('/usage/overview', adminAuth, ensureSuperAdmin, async (_req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const windows = usageWindows();
    const counters = usageCounters(windows);

    const perRole = await Promise.all(
      USAGE_ROLES.map(async ({ key, Model, baseFilter }) => {
        const pipeline = [];
        if (Object.keys(baseFilter).length) pipeline.push({ $match: baseFilter });
        pipeline.push({ $group: { _id: null, ...counters } });
        const [row] = await Model.aggregate(pipeline);
        return {
          role: key,
          total: row?.total || 0,
          active24h: row?.active24h || 0,
          active7d: row?.active7d || 0,
          active30d: row?.active30d || 0,
          everActive: row?.everActive || 0,
        };
      }),
    );

    const totals = perRole.reduce(
      (acc, r) => ({
        users: acc.users + r.total,
        active24h: acc.active24h + r.active24h,
        active7d: acc.active7d + r.active7d,
        active30d: acc.active30d + r.active30d,
        everActive: acc.everActive + r.everActive,
      }),
      { users: 0, active24h: 0, active7d: 0, active30d: 0, everActive: 0 },
    );

    res.json({
      generatedAt: new Date().toISOString(),
      totals: {
        users: totals.users,
        active24h: totals.active24h,
        active7d: totals.active7d,
        active30d: totals.active30d,
        dormant: Math.max(0, totals.everActive - totals.active30d),
        neverActive: Math.max(0, totals.users - totals.everActive),
      },
      byRole: perRole.map(({ role, total, active7d, active30d }) => ({ role, total, active7d, active30d })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Per-school rollup with a health status.
router.get('/usage/schools', adminAuth, ensureSuperAdmin, async (_req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const windows = usageWindows();
    const counters = usageCounters(windows);
    const bySchool = new Map();

    await Promise.all(
      USAGE_ROLES.map(async ({ Model, baseFilter }) => {
        const rows = await Model.aggregate([
          { $match: { ...baseFilter, schoolId: { $ne: null } } },
          { $group: { _id: '$schoolId', ...counters } },
        ]);
        rows.forEach((r) => {
          const key = String(r._id);
          const acc =
            bySchool.get(key) ||
            { totalUsers: 0, active24h: 0, active7d: 0, active30d: 0, lastActivityAt: null };
          acc.totalUsers += r.total;
          acc.active24h += r.active24h;
          acc.active7d += r.active7d;
          acc.active30d += r.active30d;
          if (r.lastActivityAt && (!acc.lastActivityAt || r.lastActivityAt > acc.lastActivityAt)) {
            acc.lastActivityAt = r.lastActivityAt;
          }
          bySchool.set(key, acc);
        });
      }),
    );

    const schools = await School.find({}, 'name logo status registrationStatus').sort({ name: 1 }).lean();
    const payload = schools.map((s) => {
      const acc =
        bySchool.get(String(s._id)) ||
        { totalUsers: 0, active24h: 0, active7d: 0, active30d: 0, lastActivityAt: null };
      return {
        schoolId: s._id,
        name: s.name || '',
        logo: s.logo || null,
        status: s.status || 'active',
        registrationStatus: s.registrationStatus || null,
        totalUsers: acc.totalUsers,
        active24h: acc.active24h,
        active7d: acc.active7d,
        active30d: acc.active30d,
        lastActivityAt: acc.lastActivityAt,
        health: deriveSchoolHealth(acc),
      };
    });

    res.json({ generatedAt: new Date().toISOString(), schools: payload });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// One school: per-role breakdown, admin accounts, and a filtered user directory.
router.get('/usage/schools/:schoolId', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const schoolId = await resolveSchoolIdOrError(req.params.schoolId, res);
    if (!schoolId) return;

    const windows = usageWindows();
    const { d30 } = windows;
    const counters = usageCounters(windows);
    const objId = new mongoose.Types.ObjectId(schoolId);

    const roleParam = String(req.query.role || 'all').toLowerCase();
    const activity = String(req.query.activity || 'all').toLowerCase();
    const q = String(req.query.q || '').trim();
    const page = Math.max(1, Number(req.query.page) || 1);
    const pageSize = Math.min(50, Math.max(1, Number(req.query.pageSize) || 12));

    const activityFilter =
      activity === 'active'
        ? { lastActiveAt: { $gte: d30 } }
        : activity === 'dormant'
          ? { $or: [{ lastActiveAt: { $lt: d30 } }, { lastActiveAt: null, lastLoginAt: { $ne: null } }] }
          : activity === 'never'
            ? { lastActiveAt: null, lastLoginAt: null }
            : {};

    // ── Per-role breakdown + summary (always every role, school-scoped) ──
    const byRole = [];
    const summary = { totalUsers: 0, active24h: 0, active7d: 0, active30d: 0, lastActivityAt: null };
    await Promise.all(
      USAGE_ROLES.map(async ({ key, Model, baseFilter }) => {
        const [row] = await Model.aggregate([
          { $match: { ...baseFilter, schoolId: objId } },
          { $group: { _id: null, ...counters } },
        ]);
        if (!row || !row.total) return;
        byRole.push({
          role: key,
          total: row.total,
          active24h: row.active24h,
          active7d: row.active7d,
          active30d: row.active30d,
          lastActivityAt: row.lastActivityAt || null,
        });
        summary.totalUsers += row.total;
        summary.active24h += row.active24h;
        summary.active7d += row.active7d;
        summary.active30d += row.active30d;
        if (row.lastActivityAt && (!summary.lastActivityAt || row.lastActivityAt > summary.lastActivityAt)) {
          summary.lastActivityAt = row.lastActivityAt;
        }
      }),
    );
    byRole.sort((a, b) => b.total - a.total);

    // ── Admin + principal accounts ──
    const [adminDocs, principalDocs] = await Promise.all([
      Admin.find(
        { schoolId: objId, role: { $ne: 'super_admin' } },
        'username name email campusName status lastActiveAt lastLoginAt',
      ).lean(),
      Principal.find(
        { schoolId: objId },
        'username name email campusName lastActiveAt lastLoginAt',
      ).lean(),
    ]);
    const admins = [
      ...adminDocs.map((a) => ({
        id: a._id,
        role: 'admin',
        username: a.username,
        name: a.name || '',
        email: a.email || '',
        campusName: a.campusName || '',
        status: a.status || 'active',
        lastActiveAt: a.lastActiveAt || null,
        lastLoginAt: a.lastLoginAt || null,
      })),
      ...principalDocs.map((p) => ({
        id: p._id,
        role: 'principal',
        username: p.username,
        name: p.name || '',
        email: p.email || '',
        campusName: p.campusName || '',
        status: 'active',
        lastActiveAt: p.lastActiveAt || null,
        lastLoginAt: p.lastLoginAt || null,
      })),
    ].sort((a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0));

    // ── User directory (filtered, merged across roles, then paginated) ──
    const targetRoles = USAGE_ROLES.filter((r) => roleParam === 'all' || r.key === roleParam);
    const collected = [];
    let total = 0;
    await Promise.all(
      targetRoles.map(async ({ key, Model, idField, statusField }) => {
        const filter = { schoolId: objId, ...activityFilter };
        if (q) {
          filter.$and = [
            {
              $or: [
                { name: { $regex: escapeRegex(q), $options: 'i' } },
                { [idField]: { $regex: escapeRegex(q), $options: 'i' } },
              ],
            },
          ];
        }
        const projection = ['name', idField, statusField, 'isArchived', 'lastActiveAt', 'lastLoginAt']
          .filter(Boolean)
          .join(' ');
        const [count, docs] = await Promise.all([
          Model.countDocuments(filter),
          Model.find(filter, projection).sort({ lastActiveAt: -1, _id: 1 }).limit(USAGE_PER_ROLE_CAP).lean(),
        ]);
        total += count;
        docs.forEach((d) => {
          collected.push({
            id: d._id,
            name: d.name || '',
            identifier: d[idField] || '',
            role: key,
            status: (statusField && d[statusField]) || (d.isArchived ? 'inactive' : 'active'),
            lastActiveAt: d.lastActiveAt || null,
            lastLoginAt: d.lastLoginAt || null,
          });
        });
      }),
    );
    collected.sort((a, b) => new Date(b.lastActiveAt || 0) - new Date(a.lastActiveAt || 0));
    const items = collected.slice((page - 1) * pageSize, page * pageSize);

    const school = await School.findById(schoolId, 'name logo status').lean();

    res.json({
      school: {
        schoolId,
        name: school?.name || '',
        logo: school?.logo || null,
        status: school?.status || 'active',
      },
      summary,
      byRole,
      admins,
      users: {
        items,
        total,
        page,
        pageSize,
        capped: collected.length >= USAGE_PER_ROLE_CAP * targetRoles.length && total > collected.length,
      },
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Global audit logs (super admin only)
router.get('/audit-logs', adminAuth, ensureSuperAdmin, async (req, res) => {
  // #swagger.tags = ['Super Admin']
  try {
    const { schoolId, limit } = req.query || {};
    const filter = {};
    if (schoolId && mongoose.isValidObjectId(schoolId)) {
      filter.schoolId = schoolId;
    }
    const max = Math.min(Number(limit) || 200, 500);
    const items = await AuditLog.find(filter).sort({ createdAt: -1 }).limit(max).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
