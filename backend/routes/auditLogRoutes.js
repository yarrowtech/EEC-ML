const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const AuditLog = require('../models/AuditLog');

const router = express.Router();

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

// Create audit log entry (admin only)
router.post('/', adminAuth, async (req, res) => {
  // #swagger.tags = ['Audit Logs']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { action, entity, entityId, meta } = req.body || {};
    if (!action || !String(action).trim()) {
      return res.status(400).json({ error: 'action is required' });
    }
    const created = await AuditLog.create({
      schoolId,
      actorId: req.admin?.id || null,
      actorType: 'Admin',
      actorName: req.admin?.name || req.admin?.username || undefined,
      action: String(action).trim(),
      entity: entity ? String(entity).trim() : undefined,
      entityId: entityId || undefined,
      ip: req.ip || req.socket?.remoteAddress || undefined,
      meta: meta || undefined,
    });
    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// List audit logs (admin only)
router.get('/', adminAuth, async (req, res) => {
  // #swagger.tags = ['Audit Logs']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const items = await AuditLog.find({ schoolId }).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
