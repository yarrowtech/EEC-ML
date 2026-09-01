'use strict';

const StudentUser = require('../models/StudentUser');

/**
 * Roll numbers in EEC are class-wide and continuous within an academic year
 * (sections do not restart the numbering). Both the bulk import and the single
 * "register student" flow build an allocator through this helper so they cannot
 * drift apart, and so a roll that is supplied explicitly (e.g. a "Roll No"
 * column in an uploaded sheet) but already taken gets reassigned to the next
 * free number instead of silently colliding with an existing student.
 *
 * Usage:
 *   const alloc = await buildRollAllocator({ schoolId, campusId, grade, academicYear });
 *   const { roll, reassignedFrom } = alloc.claim(row.roll); // row.roll may be blank
 */
const buildRollAllocator = async ({ schoolId, campusId, grade, academicYear }) => {
  const taken = new Set();
  let maxRoll = 0;
  let count = 0;

  if (grade) {
    const filter = { schoolId, grade, isArchived: { $ne: true } };
    if (campusId) filter.campusId = campusId;
    if (academicYear) filter.academicYear = academicYear;
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

  // Auto-assigned rolls continue from the top of the class (historical
  // behaviour — numbering doesn't restart low just because some rolls are
  // missing). Explicitly-claimed rolls don't move this high-water mark; the
  // scan below simply skips any number that has since been taken.
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
