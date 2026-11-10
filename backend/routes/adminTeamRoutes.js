const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const Admin = require('../models/Admin');
const TeacherUser = require('../models/TeacherUser');
const crypto = require('crypto');
const AdminRole = require('../models/AdminRole');
const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const { generatePassword } = require('../utils/generator');
const { clearTeamAccessCache } = require('../middleware/teamAccess');
const { DEFAULT_ROLES, normalizePermissions, publicModules } = require('../config/adminPermissions');

const router = express.Router();

// Only the school's owner admin manages roles and team members.
const ownerOnly = (req, res, next) => {
  if (req.isSuperAdmin || req.admin?.teamMember || !req.schoolId) {
    return res.status(403).json({ error: 'Only the school admin can manage roles and team members' });
  }
  return next();
};
router.use(adminAuth, ownerOnly);

const toPermissionList = (input) => Object.entries(normalizePermissions(
  Array.isArray(input) ? input : Object.entries(input || {}).map(([key, level]) => ({ key, level }))
)).map(([key, level]) => ({ key, level }));

const roleView = (role, memberCount = 0) => ({
  _id: role._id,
  name: role.name,
  description: role.description || '',
  permissions: normalizePermissions(role.permissions),
  memberCount,
  updatedAt: role.updatedAt,
});

const memberView = (m) => ({
  _id: m._id,
  name: m.name || '',
  email: m.email || '',
  username: m.username,
  status: m.status,
  accessRoleId: m.accessRoleId || null,
  lastLoginAt: m.lastLoginAt || null,
  linkedTeacherId: m.linkedTeacherId || null,
  createdAt: m.createdAt || m._id.getTimestamp(),
});

router.get('/modules', (req, res) => res.json(publicModules()));

// ── Roles ────────────────────────────────────────────────────────────────────

router.get('/roles', async (req, res) => {
  try {
    const schoolId = req.schoolId;
    let roles = await AdminRole.find({ schoolId }).sort({ name: 1 }).lean();
    if (!roles.length) {
      // First visit: start the school off with the common departments.
      await AdminRole.insertMany(DEFAULT_ROLES.map((r) => ({
        schoolId,
        name: r.name,
        description: r.description,
        permissions: r.permissions.map(([key, level]) => ({ key, level })),
      })), { ordered: false }).catch(() => {});
      roles = await AdminRole.find({ schoolId }).sort({ name: 1 }).lean();
    }
    const counts = await Admin.aggregate([
      { $match: { schoolId: new mongoose.Types.ObjectId(String(schoolId)), isTeamMember: true } },
      { $group: { _id: '$accessRoleId', count: { $sum: 1 } } },
    ]);
    const countByRole = new Map(counts.map((c) => [String(c._id), c.count]));
    return res.json(roles.map((r) => roleView(r, countByRole.get(String(r._id)) || 0)));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

const readRoleBody = (body = {}) => {
  const name = String(body.name || '').trim().slice(0, 60);
  if (!name) return { error: 'Role name is required' };
  const permissions = toPermissionList(body.permissions);
  if (!permissions.length) return { error: 'Select at least one menu for this role' };
  return { data: { name, description: String(body.description || '').trim().slice(0, 200), permissions } };
};

router.post('/roles', async (req, res) => {
  try {
    const { data, error } = readRoleBody(req.body);
    if (error) return res.status(400).json({ error });
    const role = await AdminRole.create({ ...data, schoolId: req.schoolId });
    return res.status(201).json(roleView(role.toObject()));
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: 'A role with this name already exists' });
    return res.status(400).json({ error: err.message });
  }
});

router.put('/roles/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const { data, error } = readRoleBody(req.body);
    if (error) return res.status(400).json({ error });
    const role = await AdminRole.findOneAndUpdate({ _id: req.params.id, schoolId: req.schoolId }, { $set: data }, { new: true }).lean();
    if (!role) return res.status(404).json({ error: 'Role not found' });
    clearTeamAccessCache();
    return res.json(roleView(role));
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: 'A role with this name already exists' });
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/roles/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const members = await Admin.countDocuments({ schoolId: req.schoolId, isTeamMember: true, accessRoleId: req.params.id });
    if (members) return res.status(409).json({ error: `${members} team member${members === 1 ? ' uses' : 's use'} this role. Move them to another role first.` });
    await AdminRole.deleteOne({ _id: req.params.id, schoolId: req.schoolId });
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// ── Team members ─────────────────────────────────────────────────────────────

const findRole = (schoolId, roleId) => (mongoose.isValidObjectId(roleId)
  ? AdminRole.findOne({ _id: roleId, schoolId }).select('_id').lean()
  : null);

router.get('/members', async (req, res) => {
  try {
    const members = await Admin.find({ schoolId: req.schoolId, isTeamMember: true })
      .select('name email username status accessRoleId lastLoginAt createdAt linkedTeacherId')
      .sort({ name: 1 })
      .lean();
    return res.json(members.map(memberView));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

// Teachers of this school who don't have admin-panel access yet.
router.get('/teachers', async (req, res) => {
  try {
    const [teachers, linked] = await Promise.all([
      TeacherUser.find({ schoolId: req.schoolId, isArchived: { $ne: true } }).select('name username email department').sort({ name: 1 }).lean(),
      Admin.find({ schoolId: req.schoolId, linkedTeacherId: { $ne: null } }).select('linkedTeacherId').lean(),
    ]);
    const taken = new Set(linked.map((a) => String(a.linkedTeacherId)));
    return res.json(teachers.filter((tch) => !taken.has(String(tch._id))).map((tch) => ({
      _id: tch._id, name: tch.name || tch.username, username: tch.username, email: tch.email || '', department: tch.department || '',
    })));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/members', async (req, res) => {
  try {
    const b = req.body || {};
    if (b.teacherId) {
      // Existing teacher: no separate login — they switch over from the teacher portal.
      if (!mongoose.isValidObjectId(b.teacherId)) return res.status(400).json({ error: 'Select a teacher' });
      if (!(await findRole(req.schoolId, b.accessRoleId))) return res.status(400).json({ error: 'Select a role' });
      const teacher = await TeacherUser.findOne({ _id: b.teacherId, schoolId: req.schoolId }).lean();
      if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
      if (await Admin.exists({ linkedTeacherId: teacher._id })) return res.status(409).json({ error: 'This teacher already has admin panel access' });
      const owner = await Admin.findById(req.admin.id).select('campusId campusName campusType').lean();
      const member = await Admin.create({
        username: `tch-${teacher.username || teacher._id}`.toLowerCase(),
        password: crypto.randomBytes(24).toString('base64url'), // never used: access is via account switch
        name: teacher.name || teacher.username,
        email: teacher.email || '',
        role: 'admin',
        status: 'active',
        schoolId: req.schoolId,
        campusId: owner?.campusId || null,
        campusName: owner?.campusName || null,
        campusType: owner?.campusType || null,
        isTeamMember: true,
        accessRoleId: b.accessRoleId,
        linkedTeacherId: teacher._id,
        createdBy: req.admin.id,
        lastLoginAt: new Date(),
      });
      return res.status(201).json({ member: memberView(member.toObject()), linkedTeacher: true });
    }
    const name = String(b.name || '').trim().slice(0, 120);
    const username = String(b.username || '').trim().toLowerCase().slice(0, 60);
    const email = String(b.email || '').trim().toLowerCase().slice(0, 160);
    if (!name || !username) return res.status(400).json({ error: 'Name and username are required' });
    if (!/^[a-z0-9._-]{3,}$/.test(username)) return res.status(400).json({ error: 'Username: at least 3 characters, letters, numbers, dot, dash or underscore' });
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return res.status(400).json({ error: 'Please enter a valid email' });
    if (!(await findRole(req.schoolId, b.accessRoleId))) return res.status(400).json({ error: 'Select a role' });
    let password = String(b.password || '');
    if (password && !isStrongPassword(password)) return res.status(400).json({ error: passwordPolicyMessage });
    if (!password) password = generatePassword();
    if (await Admin.exists({ username })) return res.status(409).json({ error: 'This username is already taken' });

    const owner = await Admin.findById(req.admin.id).select('campusId campusName campusType').lean();
    const member = await Admin.create({
      username,
      password,
      name,
      email,
      role: 'admin',
      status: 'active',
      schoolId: req.schoolId,
      campusId: owner?.campusId || null,
      campusName: owner?.campusName || null,
      campusType: owner?.campusType || null,
      isTeamMember: true,
      accessRoleId: b.accessRoleId,
      createdBy: req.admin.id,
    });
    // The password is returned once so the admin can hand it over; the member
    // must set a new one on first login.
    return res.status(201).json({ member: memberView(member.toObject()), password });
  } catch (err) {
    if (err?.code === 11000) return res.status(409).json({ error: 'This username is already taken' });
    return res.status(400).json({ error: err.message });
  }
});

router.put('/members/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const b = req.body || {};
    const update = {};
    if (b.name !== undefined) {
      update.name = String(b.name || '').trim().slice(0, 120);
      if (!update.name) return res.status(400).json({ error: 'Name is required' });
    }
    if (b.email !== undefined) update.email = String(b.email || '').trim().toLowerCase().slice(0, 160);
    if (b.status !== undefined) update.status = b.status === 'inactive' ? 'inactive' : 'active';
    if (b.accessRoleId !== undefined) {
      if (!(await findRole(req.schoolId, b.accessRoleId))) return res.status(400).json({ error: 'Select a role' });
      update.accessRoleId = b.accessRoleId;
    }
    const member = await Admin.findOneAndUpdate(
      { _id: req.params.id, schoolId: req.schoolId, isTeamMember: true },
      { $set: update },
      { new: true }
    ).select('name email username status accessRoleId lastLoginAt createdAt linkedTeacherId').lean();
    if (!member) return res.status(404).json({ error: 'Team member not found' });
    clearTeamAccessCache();
    return res.json(memberView(member));
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.post('/members/:id/reset-password', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const member = await Admin.findOne({ _id: req.params.id, schoolId: req.schoolId, isTeamMember: true });
    if (!member) return res.status(404).json({ error: 'Team member not found' });
    if (member.linkedTeacherId) return res.status(400).json({ error: 'This member signs in with their teacher account' });
    const password = generatePassword();
    member.password = password;
    member.lastLoginAt = null; // forces a new password on next login
    await member.save();
    return res.json({ username: member.username, password });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

router.delete('/members/:id', async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) return res.status(400).json({ error: 'Invalid id' });
    const result = await Admin.deleteOne({ _id: req.params.id, schoolId: req.schoolId, isTeamMember: true });
    if (!result.deletedCount) return res.status(404).json({ error: 'Team member not found' });
    clearTeamAccessCache();
    return res.json({ success: true });
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
});

module.exports = router;
