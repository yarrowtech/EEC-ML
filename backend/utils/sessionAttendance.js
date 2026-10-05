const AcademicYear = require('../models/AcademicYear');
const Holiday = require('../models/Holiday');

// Attendance over the school's ACTIVE academic session, counted in days.
//
//   schoolDays  = every day from the session start up to today (or the session
//                 end, if it has finished), minus Sundays and school holidays
//   presentDays = school days the child was marked present (a day with several
//                 per-subject records counts once — present if any record is)
//   percentage  = presentDays / schoolDays — so unmarked school days count
//                 against the percentage instead of being ignored
//
// Shared by the parent dashboard and the student dashboard so both show the
// same number.

const DAY_MS = 24 * 60 * 60 * 1000;
const dayKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const startOfDay = (v) => {
  const d = new Date(v);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Session window: the active academic year, else April → March around today.
const resolveSessionWindow = async (schoolId) => {
  const year = schoolId
    ? await AcademicYear.findOne({ schoolId, isActive: true }).select('name startDate endDate').lean()
    : null;
  const start = year?.startDate ? startOfDay(year.startDate) : null;
  const end = year?.endDate ? startOfDay(year.endDate) : null;
  if (start && end && !Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    return { name: year.name || '', start, end };
  }
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { name: `${y}-${y + 1}`, start: new Date(y, 3, 1), end: new Date(y + 1, 2, 31) };
};

const loadHolidayKeys = async ({ schoolId, campusId, start, end }) => {
  if (!schoolId) return new Set();
  const filter = {
    schoolId,
    startDate: { $lte: end },
    endDate: { $gte: start },
    ...(campusId ? { $or: [{ campusId }, { campusId: null }, { campusId: { $exists: false } }] } : {}),
  };
  const holidays = await Holiday.find(filter).select('startDate endDate date').lean();
  const keys = new Set();
  holidays.forEach((h) => {
    const from = startOfDay(h.startDate || h.date);
    const to = startOfDay(h.endDate || h.startDate || h.date);
    for (let d = new Date(from); d <= to; d = new Date(d.getTime() + DAY_MS)) keys.add(dayKey(d));
  });
  return keys;
};

/**
 * @param {{ attendance: Array<{date, status}>, schoolId, campusId, window?, holidayKeys? }} args
 * Pass `window` / `holidayKeys` when summarising several children of one school.
 */
const computeSessionAttendance = async ({ attendance = [], schoolId, campusId = null, window, holidayKeys }) => {
  const session = window || await resolveSessionWindow(schoolId);
  const today = startOfDay(new Date());
  const until = session.end < today ? session.end : today;
  const holidaysSet = holidayKeys || await loadHolidayKeys({ schoolId, campusId, start: session.start, end: until });

  let schoolDays = 0;
  let totalDays = 0;
  const schoolDayKeys = new Set();
  for (let d = new Date(session.start); d <= until; d = new Date(d.getTime() + DAY_MS)) {
    totalDays += 1;
    const key = dayKey(d);
    if (d.getDay() === 0 || holidaysSet.has(key)) continue;
    schoolDays += 1;
    schoolDayKeys.add(key);
  }

  // One status per day: present if any record that day is present.
  const byDay = new Map();
  attendance.forEach((rec) => {
    const date = new Date(rec?.date);
    if (Number.isNaN(date.getTime())) return;
    const key = dayKey(date);
    if (!schoolDayKeys.has(key)) return;
    const status = String(rec.status || '').toLowerCase();
    const prev = byDay.get(key);
    if (prev === 'present') return;
    byDay.set(key, status === 'present' || status === 'late' ? 'present' : status || prev || 'absent');
  });
  const presentDays = [...byDay.values()].filter((s) => s === 'present').length;
  const absentDays = [...byDay.values()].filter((s) => s === 'absent').length;

  return {
    sessionName: session.name,
    startDate: session.start,
    endDate: session.end,
    countedUntil: until,
    totalDays,
    schoolDays,
    markedDays: byDay.size,
    presentDays,
    absentDays,
    percentage: schoolDays > 0 ? Math.round((presentDays / schoolDays) * 100) : 0,
  };
};

module.exports = { computeSessionAttendance, resolveSessionWindow, loadHolidayKeys };
