/**
 * escalationService.js
 * Routes serious student concerns (wellbeing distress, critical academic risk,
 * teacher-flagged safeguarding) to school leadership + counselling for human
 * follow-up. Auto-raised cases are deduplicated to one open case per
 * student/category per ISO week.
 */
const EscalationCase = require('../models/EscalationCase');
const NotificationService = require('../utils/notificationService');
const { logger } = require('../utils/logger');

const COUNSELLOR_HINTS = /(counsel|welfare|well-?being|psycholog|guidance|pastoral|sen\b|special needs)/i;

function isoWeekKey(d = new Date()) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  const week = Math.ceil(((dt - yearStart) / 86400000 + 1) / 7);
  return `${dt.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Principals + counselling/welfare staff for a school (campus-aware).
async function findEscalationTargets({ schoolId, campusId = null }) {
  const Principal = require('../models/Principal');
  const StaffUser = require('../models/StaffUser');
  const [principals, staff] = await Promise.all([
    Principal.find({ schoolId }).select('_id name').lean(),
    StaffUser.find({ schoolId, status: { $ne: 'Inactive' } }).select('_id name position department campusId').lean(),
  ]);
  const targets = principals.map((p) => ({ role: 'principal', userId: p._id, name: p.name || 'Principal' }));
  for (const s of staff) {
    if (campusId && s.campusId && String(s.campusId) !== String(campusId)) continue;
    if (COUNSELLOR_HINTS.test(`${s.position || ''} ${s.department || ''}`)) {
      targets.push({ role: 'counsellor', userId: s._id, name: s.name || 'Counsellor' });
    }
  }
  return targets;
}

// Decide whether a wellbeing record warrants human escalation.
function assessWellbeing(w = {}) {
  const stress = Number(w.academicStress) || 0;
  const social = Number(w.socialEngagement) || 10;
  if (w.mood === 'critical') {
    return { escalate: true, severity: 'critical', signal: 'mood=critical' };
  }
  if (w.mood === 'concerning' && (w.behaviorChanges || stress >= 8 || social <= 3)) {
    return {
      escalate: true, severity: 'high',
      signal: `mood=concerning${w.behaviorChanges ? ',behaviourChange' : ''}${stress >= 8 ? `,stress=${stress}` : ''}${social <= 3 ? `,social=${social}` : ''}`,
    };
  }
  return { escalate: false };
}

async function raiseEscalation({
  schoolId, campusId = null, studentId, studentName = '',
  category, severity = 'high', summary = '', trigger = {},
  raisedBy = { type: 'system' }, auto = true,
}) {
  if (!schoolId || !studentId || !category) throw new Error('schoolId, studentId and category are required');

  const dedupeKey = auto ? `${schoolId}:${studentId}:${category}:${isoWeekKey()}` : undefined;
  const targets = await findEscalationTargets({ schoolId, campusId });

  const doc = {
    schoolId, campusId, studentId, studentName,
    category, severity, summary,
    trigger, raisedBy, assignedTo: targets, status: 'open',
    ...(dedupeKey ? { dedupeKey } : {}),
  };

  let created = false;
  let caseDoc;
  if (dedupeKey) {
    // Only create when no OPEN case already exists this week; a resolved case
    // does not block a fresh escalation.
    const open = await EscalationCase.findOne({ schoolId, studentId, category,
      status: { $in: ['open', 'acknowledged', 'in_progress'] } }).lean();
    if (open) return { case: open, created: false };
    try {
      caseDoc = await EscalationCase.create(doc);
      created = true;
    } catch (err) {
      if (err.code === 11000) {
        caseDoc = await EscalationCase.findOne({ dedupeKey }).lean();
        return { case: caseDoc, created: false };
      }
      throw err;
    }
  } else {
    caseDoc = await EscalationCase.create(doc);
    created = true;
  }

  if (created) {
    try {
      await NotificationService.createNotification({
        schoolId, campusId,
        title: `${severity === 'critical' ? '🚨 URGENT' : '⚠️'} Escalation: ${studentName || 'Student'}`,
        message: summary || `A ${category.replace(/_/g, ' ')} concern needs review.`,
        audience: 'Specific',
        type: 'alert', priority: severity === 'critical' ? 'high' : 'medium', category: 'welfare',
        targetUserIds: targets.map((t) => t.userId).filter(Boolean),
        relatedEntity: { entityType: 'escalation', entityId: caseDoc._id },
      });
    } catch (err) {
      logger.warn({ err: err.message, caseId: String(caseDoc._id) }, 'escalation notification failed');
    }
    try {
      await require('../models/AuditLog').create({
        schoolId, actorId: raisedBy?.id || null, actorType: raisedBy?.type || 'system', actorName: raisedBy?.name || '',
        action: 'escalation.raised', entity: 'EscalationCase', entityId: caseDoc._id,
        meta: { studentId: String(studentId), category, severity, signal: trigger?.signal },
      });
    } catch (_) { /* audit must not block */ }
  }

  return { case: caseDoc, created };
}

// Called after a wellbeing assessment is saved.
async function escalateWellbeingIfNeeded({ schoolId, campusId, student, wellbeing }) {
  const verdict = assessWellbeing(wellbeing);
  if (!verdict.escalate) return { created: false };
  return raiseEscalation({
    schoolId, campusId, studentId: student._id, studentName: student.name || '',
    category: 'wellbeing', severity: verdict.severity,
    summary: `Wellbeing check-in flagged (${verdict.signal}). Human follow-up required.`,
    trigger: { source: 'wellbeing_assessment', signal: verdict.signal,
      detail: { mood: wellbeing.mood, academicStress: wellbeing.academicStress, socialEngagement: wellbeing.socialEngagement } },
  });
}

module.exports = {
  raiseEscalation,
  escalateWellbeingIfNeeded,
  assessWellbeing,
  findEscalationTargets,
  isoWeekKey,
};
