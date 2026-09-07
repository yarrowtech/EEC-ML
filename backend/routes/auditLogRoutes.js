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
    const page = Number(req.query?.page || 1);
    const limit = Number(req.query?.limit || 200);
    if (!Number.isInteger(page) || page < 1) {
      return res.status(400).json({ error: 'page must be a positive integer' });
    }
    if (!Number.isInteger(limit) || limit < 1 || limit > 500) {
      return res.status(400).json({ error: 'limit must be an integer between 1 and 500' });
    }

    const filter = { schoolId };
    if (req.query?.action) filter.action = String(req.query.action).trim();
    if (req.query?.entity) filter.entity = String(req.query.entity).trim();
    const from = req.query?.from ? new Date(req.query.from) : null;
    const to = req.query?.to ? new Date(req.query.to) : null;
    if (from && Number.isNaN(from.getTime())) return res.status(400).json({ error: 'Invalid from date' });
    if (to && Number.isNaN(to.getTime())) return res.status(400).json({ error: 'Invalid to date' });
    if (from || to) {
      filter.createdAt = {
        ...(from ? { $gte: from } : {}),
        ...(to ? { $lte: to } : {}),
      };
    }

    const [items, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter),
    ]);
    res.set('X-Total-Count', String(total));
    res.set('X-Page', String(page));
    res.set('X-Page-Limit', String(limit));
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
