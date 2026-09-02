'use strict';

/**
 * The guardian's relationship + occupation, taken from whichever parent the
 * admin picked as the guardian on a student record:
 *   Father  → the father's occupation, "Father"
 *   Mother  → the mother's occupation, "Mother"
 *   other   → the chosen relationship (or "Guardian"), no occupation
 *
 * Match is by the explicit `guardianRelation`, falling back to `guardianName`
 * === fatherName / motherName. Used at enrolment, bulk import, student edit,
 * and the /admin/parents listing so the ParentUser record reflects the choice.
 */
const deriveGuardianMeta = (s = {}) => {
  const gName = String(s.guardianName || '').trim().toLowerCase();
  const rel = String(s.guardianRelation || '').trim();
  const isFather = rel.toLowerCase() === 'father'
    || (s.fatherName && gName && gName === String(s.fatherName).trim().toLowerCase());
  const isMother = rel.toLowerCase() === 'mother'
    || (s.motherName && gName && gName === String(s.motherName).trim().toLowerCase());

  if (isFather) return { relationship: rel || 'Father', occupation: String(s.fatherOccupation || '').trim() };
  if (isMother) return { relationship: rel || 'Mother', occupation: String(s.motherOccupation || '').trim() };
  return { relationship: rel || 'Guardian', occupation: '' };
};

module.exports = { deriveGuardianMeta };
