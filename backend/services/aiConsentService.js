/**
 * aiConsentService.js
 * Gates AI *personalisation* (feeding a student's mastery / gaps / memory /
 * development profile into an LLM prompt) on recorded parental consent.
 *
 * The tutor itself still works without consent — it just answers from the
 * retrieved course material only, with no personal data in the prompt.
 */
const DEFAULT_REQUIRES_CONSENT = true;

async function orgRequiresConsent(schoolId) {
  try {
    const Organization = require('../models/Organization');
    const org = await Organization.findOne({ $or: [{ _id: schoolId }, { schoolId }] })
      .select('settings').lean();
    const v = org?.settings?.ai?.personalisationRequiresConsent;
    return v === undefined ? DEFAULT_REQUIRES_CONSENT : Boolean(v);
  } catch (_) {
    return DEFAULT_REQUIRES_CONSENT;
  }
}

// { allowed: boolean, reason: string, requiresConsent: boolean, consentGivenAt }
async function personalisationAllowed({ studentId, schoolId }) {
  const StudentUser = require('../models/StudentUser');
  const [requiresConsent, student] = await Promise.all([
    orgRequiresConsent(schoolId),
    StudentUser.findOne({ _id: studentId, schoolId }).select('parentConsentGivenAt parentConsentGivenBy').lean(),
  ]);

  if (!requiresConsent) {
    return { allowed: true, requiresConsent: false, reason: 'org_policy_no_consent_required', consentGivenAt: student?.parentConsentGivenAt || null };
  }
  if (student?.parentConsentGivenAt) {
    return { allowed: true, requiresConsent: true, reason: 'consent_on_file', consentGivenAt: student.parentConsentGivenAt };
  }
  return { allowed: false, requiresConsent: true, reason: 'consent_missing', consentGivenAt: null };
}

async function recordConsent({ studentId, schoolId, givenBy, actor }) {
  const StudentUser = require('../models/StudentUser');
  const now = new Date();
  const updated = await StudentUser.findOneAndUpdate(
    { _id: studentId, schoolId },
    { $set: { parentConsentGivenAt: now, parentConsentGivenBy: String(givenBy || '') } },
    { new: true },
  ).select('name parentConsentGivenAt parentConsentGivenBy').lean();
  if (!updated) return { notFound: true };

  try {
    await require('../models/AuditLog').create({
      schoolId, actorId: actor?.id || null, actorType: actor?.type || 'admin', actorName: actor?.name || '',
      action: 'ai_personalisation.consent_recorded', entity: 'StudentUser', entityId: studentId,
      meta: { givenBy: String(givenBy || '') },
    });
  } catch (_) { /* audit must not block */ }
  return { student: updated };
}

module.exports = { personalisationAllowed, recordConsent, orgRequiresConsent };
