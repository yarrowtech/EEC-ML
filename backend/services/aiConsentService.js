/** Personal learning context requires consent; explicit withdrawal always wins. */
const mongoose = require('mongoose');
const DEFAULT_REQUIRES_CONSENT = true;

async function orgRequiresConsent(schoolId) {
  try {
    const school = await require('../models/School').findOne({ _id: schoolId }).select('organizationId').lean();
    if (!school?.organizationId) return DEFAULT_REQUIRES_CONSENT;
    const org = await require('../models/Organization').findOne({ _id: school.organizationId }).select('settings').lean();
    return org?.settings?.ai?.personalisationRequiresConsent !== false;
  } catch (_) {
    return DEFAULT_REQUIRES_CONSENT;
  }
}

async function personalisationAllowed({ studentId, schoolId }) {
  const [requiresConsent, student] = await Promise.all([
    orgRequiresConsent(schoolId),
    require('../models/StudentUser').findOne({ _id: studentId, schoolId })
      .select('parentConsentGivenAt parentConsentWithdrawnAt').lean(),
  ]);
  const status = { allowed: false, requiresConsent, consentGivenAt: student?.parentConsentGivenAt || null,
    withdrawnAt: student?.parentConsentWithdrawnAt || null };
  if (!student) return { ...status, reason: 'student_not_found' };
  if (student.parentConsentWithdrawnAt) return { ...status, reason: 'consent_withdrawn' };
  if (student.parentConsentGivenAt) return { ...status, allowed: true, reason: 'consent_on_file' };
  if (!requiresConsent) return { ...status, allowed: true, reason: 'org_policy_no_consent_required' };
  return { ...status, reason: 'consent_missing' };
}

// The consent change and audit record commit together on the project's replica set.
async function changeConsent({ studentId, schoolId, givenBy, actor, granted }) {
  if (!studentId || !schoolId || !actor?.id) throw new Error('Consent scope and actor are required');
  if (granted && !String(givenBy || '').trim()) throw new Error('Consenting guardian is required');
  const session = await mongoose.startSession();
  let result;
  try {
    await session.withTransaction(async () => {
      const now = new Date();
      const updated = await require('../models/StudentUser').findOneAndUpdate(
        { _id: studentId, schoolId },
        { $set: {
          parentConsentGivenAt: granted ? now : null,
          parentConsentGivenBy: granted ? String(givenBy).trim().slice(0, 200) : '',
          parentConsentWithdrawnAt: granted ? null : now,
        } },
        { new: true, session, runValidators: true },
      ).select('parentConsentGivenAt parentConsentWithdrawnAt').lean();
      if (!updated) { result = { notFound: true }; return; }
      await require('../models/AuditLog').create([{
        schoolId, actorId: actor.id, actorType: actor.type, actorName: actor.name || '',
        action: granted ? 'ai_personalisation.consent_recorded' : 'ai_personalisation.consent_withdrawn',
        entity: 'StudentUser', entityId: studentId,
        meta: { policyVersion: 'ai-personalisation-v1' },
      }], { session });
      result = { student: updated };
    });
    return result;
  } finally { await session.endSession(); }
}

const recordConsent = (input) => changeConsent({ ...input, granted: true });
const withdrawConsent = (input) => changeConsent({ ...input, granted: false });
module.exports = { personalisationAllowed, recordConsent, withdrawConsent, orgRequiresConsent };
