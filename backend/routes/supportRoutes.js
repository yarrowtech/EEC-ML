const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const SupportRequest = require('../models/SupportRequest');
const Admin = require('../models/Admin');
const School = require('../models/School');
const TeacherUser = require('../models/TeacherUser');
const ParentUser = require('../models/ParentUser');
const StudentUser = require('../models/StudentUser');
const Principal = require('../models/Principal');
const SupportSetting = require('../models/SupportSetting');
const Notification = require('../models/Notification');
const { isStrongPassword, passwordPolicyMessage } = require('../utils/passwordPolicy');
const { logSecurityEvent } = require('../utils/securityEventLogger');
const { logBusinessEvent } = require('../utils/businessEventLogger');
const { recordPlatformAudit } = require('../utils/platformAudit');

const router = express.Router();

const roleModelMap = {
  teacher: TeacherUser,
  staff: TeacherUser,
  parent: ParentUser,
  student: StudentUser,
  principal: Principal,
  admin: Admin
};
const SETTINGS_KEY = 'global';
const SCHOOL_ADMIN_ONLY_SUPPORT_TYPES = ['complaint', 'feedback'];

const ensureSuperAdmin = (req, res, next) => {
  if (!req.isSuperAdmin) {
    logSecurityEvent(req, {
      action: 'security.rbac_violation',
      outcome: 'blocked',
      severity: 'high',
      attack_type: 'rbac_violation',
      riskScore: 82,
      reason: 'Super admin role required for support route',
      statusCode: 403,
      requiredRole: 'super_admin',
    });
    return res.status(403).json({ error: 'Super admin access required' });
  }
  return next();
};

const sanitizeSupportRequest = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject({ virtuals: false }) : doc;
  const sanitized = {
    ...obj,
    id: obj._id ? obj._id.toString() : undefined
  };
  delete sanitized.__v;
  return sanitized;
};

const sanitizeSupportSettings = (doc) => {
  if (!doc) return null;
  const obj = doc.toObject ? doc.toObject({ virtuals: false }) : doc;
  return {
    id: obj._id ? obj._id.toString() : undefined,
    phoneNumber: obj.phoneNumber || '+91 90420 56789',
    email: obj.email || 'support@eecschools.com',
    availableDays: obj.availableDays || 'Mon - Fri',
    availableTime: obj.availableTime || '8 AM - 6 PM IST',
    onCall24x7: obj.onCall24x7 !== false
  };
};

const getOrCreateSupportSettings = async () => {
  const settings = await SupportSetting.findOneAndUpdate(
    { key: SETTINGS_KEY },
    {
      $setOnInsert: {
        key: SETTINGS_KEY,
        phoneNumber: '+91 90420 56789',
        email: 'support@eecschools.com',
        availableDays: 'Mon - Fri',
        availableTime: '8 AM - 6 PM IST',
        onCall24x7: true
      }
    },
    { new: true, upsert: true }
  );
  return settings;
};

router.get('/settings', adminAuth, async (_req, res) => {
  try {
    const settings = await getOrCreateSupportSettings();
    res.json(sanitizeSupportSettings(settings));
  } catch (err) {
    console.error('Failed to fetch support settings', err);
    res.status(500).json({ error: err.message || 'Unable to fetch support settings' });
  }
});

router.patch('/settings', adminAuth, ensureSuperAdmin, async (req, res) => {
  try {
    const payload = req.body || {};
    const update = {};
    const allowed = ['phoneNumber', 'email', 'availableDays', 'availableTime', 'onCall24x7'];

    allowed.forEach((field) => {
      if (payload[field] !== undefined) {
        update[field] =
          field === 'onCall24x7'
            ? Boolean(payload[field])
            : String(payload[field]).trim();
      }
    });

    const settings = await SupportSetting.findOneAndUpdate(
      { key: SETTINGS_KEY },
      { $set: update, $setOnInsert: { key: SETTINGS_KEY } },
      { new: true, upsert: true }
    );

    res.json(sanitizeSupportSettings(settings));
  } catch (err) {
    console.error('Failed to update support settings', err);
    res.status(500).json({ error: err.message || 'Unable to update support settings' });
  }
});

const safeRegex = (value) => {
  if (!value) return null;
  const escaped = String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`^${escaped}$`, 'i');
};

const derivePriority = (supportType, payload = {}) => {
  if (supportType === 'password-reset') {
    switch (payload.urgency) {
      case 'critical':
      case 'high':
        return 'high';
      default:
        return 'medium';
    }
  }
  if (supportType === 'complaint') {
    switch (payload.impactLevel) {
      case 'critical':
        return 'critical';
      case 'high':
        return 'high';
      case 'medium':
        return 'medium';
      default:
        return 'low';
    }
  }
  return payload.priority || 'low';
};

const deriveSubject = (supportType, payload = {}) => {
  if (payload.subject) return payload.subject;
  if (supportType === 'password-reset') {
    return `Password reset • ${payload.staffName || payload.email || 'Account'}`;
  }
  if (supportType === 'complaint') {
    return `Complaint • ${payload.topic || payload.category || 'General'}`;
  }
  if (supportType === 'feedback') {
    return payload.subject || `Feedback • ${payload.category || 'General'}`;
  }
  return 'Support request';
};

const deriveMessage = (supportType, payload = {}) => {
  if (payload.message) return payload.message;
  if (supportType === 'complaint') {
    return payload.description || payload.details || '';
  }
  if (supportType === 'password-reset') {
    return payload.details || `Reset request for ${payload.role || 'user'}`;
  }
  return payload.details || payload.description || '';
};

const generateTicketNumber = () => {
  const randomSegment = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `SR-${Date.now().toString(36).toUpperCase()}-${randomSegment}`;
};

const performPasswordReset = async (request, newPassword) => {
  const targetRole = (request.targetRole || request.requestDetails?.role || '').toLowerCase();
  const targetEmail = request.targetEmail || request.requestDetails?.email || request.requestDetails?.username;

  if (!targetRole || !targetEmail) {
    return { success: false, message: 'Missing role or email for password reset' };
  }

  const Model = roleModelMap[targetRole];
  if (!Model) {
    return { success: false, message: 'Role not supported for automated password reset' };
  }

  const regex = safeRegex(targetEmail);
  const query = {
    $or: [{ email: regex }, { username: regex }]
  };
  if (Model.schema.path('schoolId') && request.schoolId) {
    query.schoolId = request.schoolId;
  }

  const user = await Model.findOne(query);
  if (!user) {
    return { success: false, message: 'Account not found for the supplied email or username' };
  }
  user.password = newPassword;
  await user.save();
  return { success: true, userId: user._id, message: 'Password reset successfully' };
};

router.post('/requests', adminAuth, async (req, res) => {
  try {
    const payload = req.body || {};
    if (!payload.supportType) {
      return res.status(400).json({ error: 'supportType is required' });
    }

    const admin = await Admin.findById(req.admin.id).lean();
    if (!admin) {
      return res.status(404).json({ error: 'Admin not found' });
    }

    const resolvedSchoolId = admin.schoolId || req.admin.schoolId || payload.schoolId || null;
    let schoolDoc = null;
    if (resolvedSchoolId) {
      if (!mongoose.isValidObjectId(resolvedSchoolId)) {
        return res.status(400).json({ error: 'Invalid schoolId' });
      }
      schoolDoc = await School.findById(resolvedSchoolId).select('name campusType').lean();
      if (!schoolDoc) {
        return res.status(404).json({ error: 'School not found' });
      }
    } else if (!req.isSuperAdmin) {
      return res.status(400).json({ error: 'School context is required' });
    }

    const ticketNumber = generateTicketNumber();
    const supportRequest = await SupportRequest.create({
      ticketNumber,
      supportType: payload.supportType,
      category: payload.category || payload.supportType,
      subject: deriveSubject(payload.supportType, payload),
      message: deriveMessage(payload.supportType, payload),
      priority: derivePriority(payload.supportType, payload),
      status: 'open',
      owner: payload.owner || 'Support Desk',
      schoolId: schoolDoc?._id || null,
      schoolName: schoolDoc?.name || payload.schoolName || 'Unknown School',
      campusType: schoolDoc?.campusType || admin.campusType || null,
      createdBy: admin._id,
      createdByName: admin.name || admin.username || 'Admin',
      createdByRole: admin.role || 'admin',
      contactEmail: payload.email || admin.email,
      contactPhone: payload.contactNumber || payload.phone,
      targetRole: payload.role || payload.targetRole,
      targetEmail: payload.email || payload.targetEmail,
      requestDetails: payload,
      auditTrail: [
        {
          status: 'open',
          note: `Ticket created (${payload.supportType})`,
          changedBy: admin._id,
          changedByName: admin.name || admin.username || 'Admin'
        }
      ],
      passwordReset:
        payload.supportType === 'password-reset'
          ? { status: 'pending' }
          : undefined
    });

    res.status(201).json(sanitizeSupportRequest(supportRequest));
  } catch (err) {
    console.error('Failed to create support request', err);
    res.status(500).json({ error: err.message || 'Unable to create support request' });
  }
});

router.get('/requests', adminAuth, async (req, res) => {
  try {
    const { status, supportType, schoolId, limit } = req.query || {};
    const filter = {};

    if (!req.isSuperAdmin) {
      if (!req.admin.schoolId) {
        return res.status(400).json({ error: 'School context missing for admin' });
      }
      filter.schoolId = req.admin.schoolId;
    } else if (schoolId) {
      if (!mongoose.isValidObjectId(schoolId)) {
        return res.status(400).json({ error: 'Invalid schoolId' });
      }
      filter.schoolId = schoolId;
    }

    if (status) {
      filter.status = status;
    }
    if (supportType) {
      filter.supportType = supportType;
    }

    if (req.isSuperAdmin) {
      if (supportType && SCHOOL_ADMIN_ONLY_SUPPORT_TYPES.includes(supportType)) {
        filter.createdByRole = { $ne: 'parent' };
      } else {
        filter.$or = [
          { supportType: { $nin: SCHOOL_ADMIN_ONLY_SUPPORT_TYPES } },
          { createdByRole: { $ne: 'parent' } }
        ];
      }
    }

    const query = SupportRequest.find(filter).sort({ createdAt: -1 });
    const parsedLimit = Number(limit);
    if (parsedLimit && parsedLimit > 0) {
      query.limit(parsedLimit);
    }
    const results = await query.lean();
    logBusinessEvent(req, {
      action: 'support_requests.fetch',
      outcome: 'success',
      entity: 'support_request',
      statusCode: 200,
      resultCount: results.length,
      supportType,
      statusFilter: status,
      schoolIdFilter: schoolId,
      adminId: req.admin?.id || req.admin?._id,
    });
    res.json(results.map(sanitizeSupportRequest));
  } catch (err) {
    console.error('Failed to fetch support requests', err);
    res.status(500).json({ error: err.message || 'Unable to fetch support requests' });
  }
});

router.get('/requests/:id', adminAuth, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const request = await SupportRequest.findById(id).lean();
    if (!request) {
      return res.status(404).json({ error: 'Support request not found' });
    }

    if (!req.isSuperAdmin && (!req.admin.schoolId || request.schoolId?.toString() !== req.admin.schoolId)) {
      logSecurityEvent(req, {
        action: 'security.idor_attempt_detected',
        outcome: 'blocked',
        severity: 'high',
        attack_type: 'idor_attempt',
        riskScore: 85,
        reason: 'Cross-school support request access denied',
        statusCode: 403,
        entity: 'support_request',
        entityId: id,
        actorSchoolId: req.admin?.schoolId,
        targetSchoolId: request.schoolId?.toString(),
      });
      return res.status(403).json({ error: 'Access denied' });
    }

    res.json(sanitizeSupportRequest(request));
  } catch (err) {
    console.error('Failed to fetch support request', err);
    res.status(500).json({ error: err.message || 'Unable to fetch support request' });
  }
});

router.patch('/requests/:id', adminAuth, ensureSuperAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ error: 'Invalid request id' });
    }

    const request = await SupportRequest.findById(id);
    if (!request) {
      return res.status(404).json({ error: 'Support request not found' });
    }

    const updates = {};
    const { status, owner, priority, resolutionNotes, newPassword, action } = req.body || {};
    const previousStatus = request.status;
    if (status) {
      updates.status = status;
    }
    if (owner !== undefined) {
      updates.owner = owner;
    }
    if (priority) {
      updates.priority = priority;
    }
    if (resolutionNotes !== undefined) {
      updates.resolutionNotes = resolutionNotes;
    }

    Object.assign(request, updates);

    const actor = await Admin.findById(req.admin.id).select('name username').lean();
    const actorName = actor?.name || actor?.username || 'Super Admin';

    request.auditTrail.push({
      status: request.status,
      note: resolutionNotes,
      changedBy: req.admin.id,
      changedByName: actorName
    });

    if (request.status === 'resolved') {
      request.resolvedAt = new Date();
      request.resolvedBy = req.admin.id;
      request.resolvedByName = actorName;
    } else if (status && status !== 'resolved') {
      request.resolvedAt = undefined;
      request.resolvedBy = undefined;
      request.resolvedByName = undefined;
    }

    if ((action === 'reset_password' || newPassword) && request.supportType === 'password-reset') {
      if (!newPassword) {
        return res.status(400).json({ error: 'newPassword is required to reset password' });
      }
      if (!isStrongPassword(newPassword)) {
        return res.status(400).json({ error: passwordPolicyMessage });
      }
      const resetResult = await performPasswordReset(request, newPassword);
      await recordPlatformAudit(req, {
        action: 'support.password_reset',
        entity: 'support_request',
        entityId: request._id,
        schoolId: request.schoolId,
        meta: {
          targetRole: request.targetRole || request.requestDetails?.role,
          targetUserId: resetResult.userId || null,
          success: resetResult.success,
        },
      });
      request.passwordReset = {
        performedAt: new Date(),
        performedBy: req.admin.id,
        performedByName: actorName,
        status: resetResult.success ? 'completed' : 'failed',
        targetUserId: resetResult.userId || null,
        message: resetResult.message
      };
      if (resetResult.success && !resolutionNotes) {
        request.resolutionNotes = `Password reset completed: ${resetResult.message}`;
      }
    }

    await request.save();

    // Notify school admin when status moves to in-progress.
    if (request.status === 'in_progress' && previousStatus !== 'in_progress' && request.schoolId) {
      try {
        const title = request.subject || request.supportType || 'Support Request';
        await Notification.create({
          schoolId: request.schoolId,
          title: 'Support Request In Progress',
          message: `Your support request "${title}" is now in progress with the support team.`,
          audience: 'Admin',
          type: 'general',
          priority: 'medium',
          category: 'general',
          createdByType: 'super_admin',
          createdByName: actorName,
        });
      } catch (notifErr) {
        console.warn('Failed to create in-progress notification for support request', request._id, notifErr.message);
      }
    }

    // Notify the school admin when their support request is resolved (only on first resolution)
    if (request.status === 'resolved' && previousStatus !== 'resolved' && request.schoolId) {
      try {
        const title = request.subject || request.supportType || 'Support Request';
        await Notification.create({
          schoolId: request.schoolId,
          title: 'Support Request Resolved',
          message: `Your support request "${title}" has been reviewed and resolved by the support team.`,
          audience: 'Admin',
          type: 'general',
          priority: 'medium',
          category: 'general',
          createdByType: 'super_admin',
          createdByName: actorName,
        });
      } catch (notifErr) {
        console.warn('Failed to create resolution notification for support request', request._id, notifErr.message);
      }
    }

    logBusinessEvent(req, {
      action: 'support_request.update',
      outcome: 'success',
      entity: 'support_request',
      entityId: request._id,
      statusCode: 200,
      supportType: request.supportType,
      previousStatus: request.auditTrail?.length > 1
        ? request.auditTrail[request.auditTrail.length - 2]?.status
        : undefined,
      nextStatus: request.status,
      owner: request.owner,
      adminId: req.admin?.id || req.admin?._id,
    });
    res.json(sanitizeSupportRequest(request));
  } catch (err) {
    logBusinessEvent(req, {
      action: 'support_request.update',
      outcome: 'failure',
      entity: 'support_request',
      entityId: req.params?.id,
      statusCode: 500,
      reason: err.message,
      adminId: req.admin?.id || req.admin?._id,
    });
    console.error('Failed to update support request', err);
    res.status(500).json({ error: err.message || 'Unable to update support request' });
  }
});

module.exports = router;
