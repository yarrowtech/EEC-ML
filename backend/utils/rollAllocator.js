'use strict';

const StudentUser = require('../models/StudentUser');

/**
 * Roll numbers in EEC are unique per class + section among the students
 * currently sitting in that class+section (promotion moves a student to a new
 * grade, archiving unsets the roll, so both drop out of the check naturally —
 * which is why no academic-year filter is needed here).
 *
 * Both the bulk import and the single "register student" flow build an
 * allocator through this helper so they cannot drift apart, and so a roll that
 * is supplied explicitly (a "Roll No" column in an uploaded sheet, or a value
 * typed into the manual form) but already taken gets reassigned to the next
 * free number instead of silently colliding with an existing student.
 *
 * Usage:
 *   const alloc = await buildRollAllocator({ schoolId, campusId, grade, section });
 *   const { roll, reassignedFrom } = alloc.claim(desiredRoll); // may be blank
 */

const escapeRegex = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// "Class 5" / "class-5" / "CLASS 5" / "5" all normalise to "5" so the two
// registration paths (one stores the raw class name, the other a normalised
// one) still recognise each other's students when checking for taken rolls.
const normalizeGrade = (value) => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const m = raw.match(/^class[\s\-_:]*([a-z0-9]+)$/i);
  return (m ? m[1] : raw).toUpperCase();
};

const buildRollAllocator = async ({ schoolId, campusId, grade, section }) => {
  const taken = new Set();
  let maxRoll = 0;
  let count = 0;

  const normGrade = normalizeGrade(grade);
  const normSection = String(section || '').trim();

  if (normGrade) {
    const filter = {
      schoolId,
      isArchived: { $ne: true },
      // Match the class regardless of how the name is stored ("5" vs "Class 5").
      grade: { $regex: `^(class[\\s\\-_:]*)?${escapeRegex(normGrade)}$`, $options: 'i' },
    };
    if (campusId) filter.campusId = campusId;
    if (normSection) {
      filter.section = { $regex: `^${escapeRegex(normSection)}$`, $options: 'i' };
    }

    const rows = await StudentUser.find(filter).select('roll').lean();
    count = rows.length;
    rows.forEach((r) => {
      const n = Number(r?.roll);
      if (Number.isInteger(n) && n > 0) {
        taken.add(n);
        if (n > maxRoll) maxRoll = n;
      }
    });
  }

  // Auto-assigned rolls continue from the top of the section (numbering doesn't
  // restart low just because some rolls are missing). Explicitly-claimed rolls
  // don't move this high-water mark; the scan below skips any taken number.
  let nextAuto = Math.max(maxRoll, count) + 1;

  return {
    /**
     * @param {*} desired the roll the caller would like (may be undefined/blank)
     * @returns {{ roll: number, reassignedFrom: number|null }}
     *          reassignedFrom is set only when `desired` was a valid number that
     *          was already taken and had to be replaced.
     */
    claim(desired) {
      const wanted = Number(desired);
      const wantedValid = Number.isInteger(wanted) && wanted > 0;

      if (wantedValid && !taken.has(wanted)) {
        taken.add(wanted);
        return { roll: wanted, reassignedFrom: null };
      }

      while (taken.has(nextAuto)) nextAuto += 1;
      const roll = nextAuto;
      taken.add(roll);
      nextAuto += 1;
      return { roll, reassignedFrom: wantedValid ? wanted : null };
    },
    has: (n) => taken.has(Number(n)),
  };
};

module.exports = { buildRollAllocator };
