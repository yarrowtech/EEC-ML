const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const authAnyUser = require('../middleware/authAnyUser');
const authTeacher = require('../middleware/authTeacher');
const StudentUser = require('../models/StudentUser');
const EscalationCase = require('../models/EscalationCase');
const { raiseEscalation } = require('../services/escalationService');
const { buildTeacherAllocationScope, studentIsWithinTeacherScope } = require('../utils/teacherAllocationScope');

const actorRole = (req) => String(req.userType || req.user?.userType || req.user?.type || '').toLowerCase();
const actorId = (req) => req.user?.id || req.user?._id || null;
const isReviewer = (req) => ['principal', 'admin'].includes(actorRole(req));

// ── Raise an escalation (teacher / admin) ────────────────────────────────────
router.post('/', authTeacher, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const raiserId = req.user?.id || req.teacher?.id;
    const { studentId, category, severity = 'high', summary, detail } = req.body || {};

    if (!studentId || !mongoose.Types.ObjectId.isValid(studentId)) {
      return res.status(400).json({ error: 'A valid studentId is required' });
    }
    if (!['wellbeing', 'at_risk_academic', 'safeguarding', 'behaviour'].includes(category)) {
      return res.status(400).json({ error: 'category must be wellbeing | at_risk_academic | safeguarding | behaviour' });
    }
    if (!['high', 'critical'].includes(severity)) {
      return res.status(400).json({ error: 'severity must be high or critical' });
    }

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).select('name grade section campusId').lean();
    if (!student) return res.status(404).json({ error: 'Student not found' });

    // Teachers may only escalate students in their allocation scope; admins are unrestricted.
    if (actorRole(req) !== 'admin') {
      const scope = await buildTeacherAllocationScope({ schoolId, campusId: req.campusId || null, teacherId: raiserId });
      if (!studentIsWithinTeacherScope(student, scope)) {
        return res.status(403).json({ error: 'Student is outside your assigned scope' });
      }
    }

    const { case: caseDoc, created } = await raiseEscalation({
      schoolId, campusId: student.campusId || req.campusId || null,
      studentId, studentName: student.name || '',
      category, severity,
      summary: String(summary || '').trim() || `${category.replace(/_/g, ' ')} concern raised by a teacher.`,
      trigger: { source: 'teacher_manual', detail: detail || null, signal: 'manual' },
      raisedBy: { type: actorRole(req) === 'admin' ? 'admin' : 'teacher', id: raiserId, name: req.user?.name || '' },
      auto: false,
    });
    return res.status(created ? 201 : 200).json({ success: true, data: caseDoc, created });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── List escalations ────────────────────────────────────────────────────────
// Reviewers (principal/admin) see all; a counsellor sees cases assigned to them;
// a teacher sees cases they raised.
router.get('/', authAnyUser, async (req, res) => {
  try {
    const schoolId = req.schoolId;
    const { status, severity, studentId } = req.query;
    const filter = { schoolId };
    if (status) filter.status = status;
    if (severity) filter.severity = severity;
    if (studentId && mongoose.Types.ObjectId.isValid(studentId)) filter.studentId = studentId;

    if (!isReviewer(req)) {
      const id = actorId(req);
      filter.$or = [{ 'assignedTo.userId': id }, { 'raisedBy.id': id }];
    }

    const cases = await EscalationCase.find(filter)
      .sort({ status: 1, severity: -1, createdAt: -1 })
      .limit(300).lean();
    const summary = {
      open: cases.filter((c) => c.status === 'open').length,
      critical: cases.filter((c) => c.severity === 'critical' && c.status !== 'resolved' && c.status !== 'dismissed').length,
      resolved: cases.filter((c) => c.status === 'resolved').length,
    };
    return res.json({ success: true, data: cases, summary });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

const loadCaseForActor = async (req, res) => {
  if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
    res.status(400).json({ error: 'Invalid case id' });
    return null;
  }
  const c = await EscalationCase.findOne({ _id: req.params.id, schoolId: req.schoolId });
  if (!c) { res.status(404).json({ error: 'Escalation not found' }); return null; }
  const id = String(actorId(req) || '');
  const assigned = (c.assignedTo || []).some((a) => String(a.userId) === id);
  if (!isReviewer(req) && !assigned && String(c.raisedBy?.id || '') !== id) {
    res.status(403).json({ error: 'You are not assigned to this case' });
    return null;
  }
  return c;
};

// ── Acknowledge ─────────────────────────────────────────────────────────────
router.patch('/:id/acknowledge', authAnyUser, async (req, res) => {
  try {
    const c = await loadCaseForActor(req, res);
    if (!c) return;
    if (['resolved', 'dismissed'].includes(c.status)) {
      return res.status(409).json({ error: 'Case is already closed' });
    }
    if (c.status === 'open') c.status = 'acknowledged';
    c.acknowledgedBy = actorId(req);
    c.acknowledgedByRole = actorRole(req);
    c.acknowledgedAt = new Date();
    await c.save();
    return res.json({ success: true, data: c });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Add an action note ──────────────────────────────────────────────────────
router.post('/:id/actions', authAnyUser, async (req, res) => {
  try {
    const c = await loadCaseForActor(req, res);
    if (!c) return;
    const note = String(req.body?.note || '').trim();
    if (!note) return res.status(400).json({ error: 'note is required' });
    c.actions.push({ note, by: actorId(req), byRole: actorRole(req), byName: req.user?.name || '', at: new Date() });
    if (c.status === 'open' || c.status === 'acknowledged') c.status = 'in_progress';
    await c.save();
    return res.json({ success: true, data: c });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

// ── Resolve / dismiss ───────────────────────────────────────────────────────
router.patch('/:id/resolve', authAnyUser, async (req, res) => {
  try {
    const c = await loadCaseForActor(req, res);
    if (!c) return;
    const { outcome, note, dismiss } = req.body || {};
    if (!isReviewer(req) && actorRole(req) !== 'counsellor' && actorRole(req) !== 'staff') {
      return res.status(403).json({ error: 'Only a reviewer or assigned counsellor can close a case' });
    }
    c.status = dismiss ? 'dismissed' : 'resolved';
    c.resolution = {
      outcome: String(outcome || (dismiss ? 'dismissed' : 'resolved')),
      note: String(note || ''),
      by: actorId(req), byRole: actorRole(req), at: new Date(),
    };
    await c.save();
    try {
      await require('../models/AuditLog').create({
        schoolId: req.schoolId, actorId: actorId(req), actorType: actorRole(req), actorName: req.user?.name || '',
        action: 'escalation.closed', entity: 'EscalationCase', entityId: c._id,
        meta: { status: c.status, studentId: String(c.studentId) },
      });
    } catch (_) { /* audit must not block */ }
    return res.json({ success: true, data: c });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
});

module.exports = router;
