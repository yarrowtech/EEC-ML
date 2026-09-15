/**
 * Exam routine + invigilator auto-scheduling engine.
 *
 * Hard constraints (never violated, ever):
 *   A. One room cannot host two exams in the same date+startTime+endTime slot.
 *   B. One teacher cannot invigilate two rooms in the same slot.
 *   C. One class/section cannot sit two exams in the same slot.
 *   D. Room capacity must cover the class/section's student count.
 *   E. Teacher must be active and not on approved leave that day.
 *   F. Database must reject duplicate room/teacher-slot rows even if the
 *      application layer has a bug (see models/ExamInvigilation.js indexes).
 *
 * Soft preferences (best-effort, only applied when they don't force a hard
 * constraint to break):
 *   - Fair distribution of invigilation duty counts across teachers.
 *   - Avoid a subject's own teacher invigilating that subject's exam.
 *   - Avoid a class's own class-teacher invigilating that class's exam.
 *   - Respect a minimum transition time between two different buildings on
 *     the same day.
 *
 * Everything here reads its input from the database (Exam/Room/Floor/
 * Building/TeacherUser/TeacherAllocation/TeacherLeave/ExamInvigilation) —
 * nothing is hard-coded. See generateRoutine() for the orchestration and
 * routes/examSchedulingRoutes.js for the HTTP surface.
 */

const mongoose = require('mongoose');
const Exam = require('../models/Exam');
const Room = require('../models/Room');
const TeacherUser = require('../models/TeacherUser');
const TeacherAllocation = require('../models/TeacherAllocation');
const TeacherLeave = require('../models/TeacherLeave');
const ExamInvigilation = require('../models/ExamInvigilation');

/**
 * @typedef {Object} SchedulingConfig
 * @property {number} invigilatorsPerRoom            Teachers required per room (default 1).
 * @property {number} maxInvigilationDutiesPerDay     Cap on duties/day per teacher (default Infinity).
 * @property {number} minimumTeacherTransitionMinutes Minimum gap required to move buildings same day (default 0).
 * @property {boolean} avoidSubjectTeacherInvigilation Soft: don't let a subject's own teacher invigilate it.
 * @property {boolean} avoidClassTeacherInvigilation   Soft: don't let a class's own class-teacher invigilate it.
 */
const DEFAULT_CONFIG = {
  invigilatorsPerRoom: 1,
  maxInvigilationDutiesPerDay: Infinity,
  minimumTeacherTransitionMinutes: 0,
  avoidSubjectTeacherInvigilation: true,
  avoidClassTeacherInvigilation: true,
};

/**
 * @typedef {Object} ExamInstance
 * @property {string} examId
 * @property {string} classId
 * @property {string} sectionId
 * @property {string} subjectId
 * @property {string} date       YYYY-MM-DD
 * @property {string} startTime  HH:mm (24h)
 * @property {string} endTime    HH:mm (24h)
 * @property {number} studentCount
 */

/**
 * @typedef {Object} RoomAssignment
 * @property {ExamInstance} instance
 * @property {Object} room  { _id, buildingId, floorId, capacity }
 */

/**
 * @typedef {Object} InvigilatorAssignment
 * @property {RoomAssignment} roomAssignment
 * @property {Object[]} teachers  [{ _id, name }, ...] length === invigilatorsPerRoom
 */

const toMinutes = (hhmm) => {
  const m = String(hhmm || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  return Number(m[1]) * 60 + Number(m[2]);
};

const addMinutesToTime = (hhmm, minutes) => {
  const start = toMinutes(hhmm);
  if (start === null) return null;
  const total = ((start + minutes) % 1440 + 1440) % 1440;
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
};

const slotKey = (date, startTime, endTime) => `${date}|${startTime}|${endTime}`;
const roomKey = (roomId, date, startTime, endTime) => `${roomId}|${slotKey(date, startTime, endTime)}`;
const teacherSlotKey = (teacherId, date, startTime, endTime) => `${teacherId}|${slotKey(date, startTime, endTime)}`;

/* ────────────────────────────────────────────────────────────────────────
   STEP 1 — Load everything the engine needs, scoped to (schoolId, campusId)
   and — critically — NOT scoped to only the group(s) being scheduled, so a
   teacher/room already booked on ANY other exam in the school is correctly
   seen as busy.
   ──────────────────────────────────────────────────────────────────────── */
async function loadSchedulingContext({ schoolId, campusId, groupIds }) {
  const campusFilter = campusId ? { campusId } : {};
  const scope = { schoolId, ...campusFilter };

  const [examsToSchedule, allSchoolExams, rooms, teachers, allocations, leaves, existingInvigilations] =
    await Promise.all([
      Exam.find({ ...scope, groupId: { $in: groupIds } })
        .populate('subjectId', 'name')
        .lean(),
      // Every OTHER exam in the school with a room already committed — the
      // room-conflict universe this run must respect.
      Exam.find({ ...scope, roomId: { $ne: null } }).select('roomId date time duration').lean(),
      Room.find({ ...scope, isActive: true })
        .populate({ path: 'floorId', select: 'name buildingId', populate: { path: 'buildingId', select: 'name' } })
        .lean(),
      TeacherUser.find({ ...scope, isArchived: false }).select('name subject classTeacherOf').lean(),
      TeacherAllocation.find(scope).lean(),
      TeacherLeave.find({ ...scope, status: 'Approved' }).lean(),
      // Every other invigilation duty in the school — the teacher-conflict
      // universe (daily-limit + transition-time + slot-clash checks).
      ExamInvigilation.find(scope).lean(),
    ]);

  return { schoolId, campusId, rooms, teachers, allocations, leaves, existingInvigilations, allSchoolExams, examsToSchedule };
}

/* ────────────────────────────────────────────────────────────────────────
   STEP 2 — Turn each Exam doc into a scheduling instance. Date/time/subject
   are assumed already set on the Exam (by the exam-creation step upstream);
   this engine's job is room + invigilator assignment, not picking dates.
   ──────────────────────────────────────────────────────────────────────── */
function buildExamInstances(examsToSchedule) {
  const instances = [];
  const skipped = [];
  for (const exam of examsToSchedule) {
    const startTime = String(exam.time || '').trim();
    const duration = Number(exam.duration) || 0;
    const date = exam.date ? String(exam.date).slice(0, 10) : '';
    const endTime = addMinutesToTime(startTime, duration);
    if (!date || toMinutes(startTime) === null || !duration || !endTime || !exam.classId || !exam.sectionId) {
      skipped.push({ examId: String(exam._id), reason: 'Missing date/time/duration/class/section' });
      continue;
    }
    instances.push({
      examId: String(exam._id),
      classId: String(exam.classId),
      sectionId: String(exam.sectionId),
      subjectId: exam.subjectId ? String(exam.subjectId._id || exam.subjectId) : null,
      date,
      startTime,
      endTime,
      duration,
      studentCount: Number(exam.noOfStudents) || 0,
    });
  }
  return { instances, skipped };
}

/* ────────────────────────────────────────────────────────────────────────
   STEP 3 — Room assignment. One room per class/section instance — rooms are
   never shared between two different classes, per the hard room-conflict
   rule. Smallest sufficient-capacity room wins first (keeps larger rooms
   free for classes that need them).
   ──────────────────────────────────────────────────────────────────────── */
function assignRooms(instances, context) {
  const roomsSortedByCapacity = [...context.rooms].sort((a, b) => (a.capacity || 0) - (b.capacity || 0));
  const usedRoomSlots = new Set(
    context.allSchoolExams
      .filter((e) => e.roomId && e.date && e.time && e.duration)
      .map((e) => roomKey(String(e.roomId), String(e.date).slice(0, 10), e.time, addMinutesToTime(e.time, Number(e.duration)))),
  );

  // First-fit decreasing: bigger classes claim a room first, so a large
  // class is never left with only small rooms remaining in its slot.
  const sorted = [...instances].sort((a, b) => b.studentCount - a.studentCount);

  const assignments = [];
  const conflicts = [];
  for (const instance of sorted) {
    const room = roomsSortedByCapacity.find((r) => {
      if ((r.capacity || 0) < instance.studentCount) return false;
      const key = roomKey(String(r._id), instance.date, instance.startTime, instance.endTime);
      return !usedRoomSlots.has(key);
    });
    if (!room) {
      conflicts.push({
        type: 'NO_ROOM_AVAILABLE',
        examId: instance.examId,
        message: `No room with capacity ≥ ${instance.studentCount} is free on ${instance.date} ${instance.startTime}–${instance.endTime}.`,
      });
      continue;
    }
    usedRoomSlots.add(roomKey(String(room._id), instance.date, instance.startTime, instance.endTime));
    assignments.push({
      instance,
      room: {
        _id: String(room._id),
        buildingId: String(room.floorId?.buildingId?._id || room.floorId?.buildingId || ''),
        buildingName: room.floorId?.buildingId?.name || '',
        floorId: String(room.floorId?._id || room.floorId || ''),
        floorName: room.floorId?.name || '',
        roomNumber: room.roomNumber,
        capacity: room.capacity,
      },
    });
  }
  return { assignments, conflicts };
}

/* ────────────────────────────────────────────────────────────────────────
   STEP 4/5 — Group room assignments by slot, then assign invigilator(s).
   ──────────────────────────────────────────────────────────────────────── */
function groupBySlot(roomAssignments) {
  const bySlot = new Map();
  roomAssignments.forEach((ra) => {
    const key = slotKey(ra.instance.date, ra.instance.startTime, ra.instance.endTime);
    if (!bySlot.has(key)) bySlot.set(key, []);
    bySlot.get(key).push(ra);
  });
  return bySlot;
}

const isTeacherOnLeave = (leaves, teacherId, date) =>
  leaves.some((l) => String(l.teacherId) === teacherId && l.startDate <= date && date <= l.endDate);

const subjectTeacherIds = (allocations, subjectId, classId, sectionId) =>
  new Set(
    allocations
      .filter((a) => String(a.classId) === classId && String(a.sectionId) === sectionId && String(a.subjectId || '') === (subjectId || ''))
      .map((a) => String(a.teacherId)),
  );

const classTeacherIds = (allocations, classId, sectionId) =>
  new Set(
    allocations
      .filter((a) => String(a.classId) === classId && String(a.sectionId) === sectionId && a.isClassTeacher)
      .map((a) => String(a.teacherId)),
  );

/**
 * Assigns invigilators to every room assignment. Mutates nothing — returns
 * the assignments plus any conflicts where no eligible teacher exists (a
 * hard-constraint failure the caller must not silently swallow).
 */
function assignInvigilators(roomAssignments, context, config) {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const bySlot = groupBySlot(roomAssignments);

  // Running state, seeded from the whole school's existing duties, mutated
  // as this run assigns more — so slot 2 of this same run sees slot 1's
  // picks immediately (no post-hoc dedupe needed).
  const dutyCountByTeacher = new Map();
  context.existingInvigilations.forEach((d) => {
    dutyCountByTeacher.set(String(d.teacherId), (dutyCountByTeacher.get(String(d.teacherId)) || 0) + 1);
  });
  const bookedTeacherSlots = new Set(
    context.existingInvigilations.map((d) => teacherSlotKey(String(d.teacherId), d.date, d.startTime, d.endTime)),
  );
  // teacherId -> date -> [{ startTime, endTime, buildingId }] this run + existing, for daily-limit and transition-time checks.
  const dailyAssignments = new Map();
  const seedDaily = (teacherId, date, startTime, endTime, buildingId) => {
    if (!dailyAssignments.has(teacherId)) dailyAssignments.set(teacherId, new Map());
    const byDate = dailyAssignments.get(teacherId);
    if (!byDate.has(date)) byDate.set(date, []);
    byDate.get(date).push({ startTime, endTime, buildingId: buildingId || null });
  };
  context.existingInvigilations.forEach((d) => seedDaily(String(d.teacherId), d.date, d.startTime, d.endTime, String(d.buildingId || '')));

  const results = [];
  const conflicts = [];

  // Slots processed in chronological order so daily-limit/transition-time
  // state is always built up from earlier-in-the-day slots first.
  const orderedSlotKeys = [...bySlot.keys()].sort();

  for (const key of orderedSlotKeys) {
    const roomAssignmentsInSlot = bySlot.get(key);
    for (const ra of roomAssignmentsInSlot) {
      const { instance, room } = ra;
      const subjectTeachers = subjectTeacherIds(context.allocations, instance.subjectId, instance.classId, instance.sectionId);
      const classTeachers = classTeacherIds(context.allocations, instance.classId, instance.sectionId);

      const eligible = context.teachers.filter((t) => {
        const id = String(t._id);
        // Hard: not already guarding another room this exact slot.
        if (bookedTeacherSlots.has(teacherSlotKey(id, instance.date, instance.startTime, instance.endTime))) return false;
        // Hard: not on approved leave.
        if (isTeacherOnLeave(context.leaves, id, instance.date)) return false;
        // Hard: daily duty cap.
        const dutiesToday = (dailyAssignments.get(id)?.get(instance.date) || []).length;
        if (dutiesToday >= cfg.maxInvigilationDutiesPerDay) return false;
        // Hard: enough transition time to reach this building from any
        // other room they're already guarding today.
        const todays = dailyAssignments.get(id)?.get(instance.date) || [];
        const hasTransitionConflict = todays.some((other) => {
          const overlaps = toMinutes(instance.startTime) < toMinutes(other.endTime) && toMinutes(instance.endTime) > toMinutes(other.startTime);
          if (overlaps) return true; // can never be in two rooms at once, same building or not
          if (other.buildingId === room.buildingId) return false; // same building, no travel needed — a gap is not required
          const gapBefore = toMinutes(instance.startTime) - toMinutes(other.endTime);
          const gapAfter = toMinutes(other.startTime) - toMinutes(instance.endTime);
          const hasGap = gapBefore >= cfg.minimumTeacherTransitionMinutes || gapAfter >= cfg.minimumTeacherTransitionMinutes;
          return !hasGap;
        });
        if (hasTransitionConflict) return false;
        return true;
      });

      if (eligible.length < cfg.invigilatorsPerRoom) {
        conflicts.push({
          type: 'NO_TEACHER_AVAILABLE',
          examId: instance.examId,
          roomId: room._id,
          message: `Only ${eligible.length} eligible teacher(s) free for ${instance.date} ${instance.startTime}–${instance.endTime} in ${room.buildingName} / ${room.floorName} / ${room.roomNumber} (need ${cfg.invigilatorsPerRoom}).`,
        });
        continue;
      }

      // Soft scoring: lower is better. Fairness dominates; subject/class
      // preferences add a penalty but never disqualify (hard filtering
      // already happened above).
      const scored = eligible.map((t) => {
        const id = String(t._id);
        let score = (dutyCountByTeacher.get(id) || 0) * 10;
        if (cfg.avoidSubjectTeacherInvigilation && subjectTeachers.has(id)) score += 5;
        if (cfg.avoidClassTeacherInvigilation && classTeachers.has(id)) score += 5;
        return { teacher: t, score };
      });
      scored.sort((a, b) => a.score - b.score || Math.random() - 0.5);

      const chosen = scored.slice(0, cfg.invigilatorsPerRoom).map((s) => s.teacher);
      chosen.forEach((t) => {
        const id = String(t._id);
        bookedTeacherSlots.add(teacherSlotKey(id, instance.date, instance.startTime, instance.endTime));
        dutyCountByTeacher.set(id, (dutyCountByTeacher.get(id) || 0) + 1);
        seedDaily(id, instance.date, instance.startTime, instance.endTime, room.buildingId);
      });

      results.push({ roomAssignment: ra, teachers: chosen.map((t) => ({ _id: String(t._id), name: t.name })) });
    }
  }

  return { results, conflicts };
}

/* ────────────────────────────────────────────────────────────────────────
   STEP 6/12 — Full validation pass over the proposed output before it's
   ever written to the database. Anything in here failing means the whole
   generation is rejected — no partial/half-conflicting routine is saved.
   ──────────────────────────────────────────────────────────────────────── */
function validateSchedule(invigilatorAssignments) {
  const conflicts = [];
  const seenRoomSlots = new Set();
  const seenTeacherSlots = new Set();
  const seenClassSlots = new Set();

  invigilatorAssignments.forEach(({ roomAssignment, teachers }) => {
    const { instance, room } = roomAssignment;

    const rk = roomKey(room._id, instance.date, instance.startTime, instance.endTime);
    if (seenRoomSlots.has(rk)) {
      conflicts.push({ type: 'DUPLICATE_ROOM_ASSIGNMENT', examId: instance.examId, message: `Room ${room.roomNumber} double-booked at ${instance.date} ${instance.startTime}.` });
    }
    seenRoomSlots.add(rk);

    const ck = slotKey(instance.date, instance.startTime, instance.endTime) + '|' + instance.classId + '|' + instance.sectionId;
    if (seenClassSlots.has(ck)) {
      conflicts.push({ type: 'DUPLICATE_CLASS_ASSIGNMENT', examId: instance.examId, message: `Class/section double-booked at ${instance.date} ${instance.startTime}.` });
    }
    seenClassSlots.add(ck);

    if ((room.capacity || 0) < instance.studentCount) {
      conflicts.push({ type: 'CAPACITY_EXCEEDED', examId: instance.examId, message: `Room ${room.roomNumber} capacity ${room.capacity} < ${instance.studentCount} students.` });
    }

    teachers.forEach((t) => {
      const tk = teacherSlotKey(t._id, instance.date, instance.startTime, instance.endTime);
      if (seenTeacherSlots.has(tk)) {
        conflicts.push({ type: 'DUPLICATE_TEACHER_ASSIGNMENT', examId: instance.examId, teacherId: t._id, message: `${t.name} assigned to two rooms at ${instance.date} ${instance.startTime}.` });
      }
      seenTeacherSlots.add(tk);
    });
  });

  return { valid: conflicts.length === 0, conflicts };
}

/* ────────────────────────────────────────────────────────────────────────
   STEP 8/13 — Orchestrator: load → build → assign rooms → assign
   invigilators → validate → (transaction) persist, or roll back and report
   conflicts without writing anything.
   ──────────────────────────────────────────────────────────────────────── */
async function generateRoutine({ schoolId, campusId, groupIds, config = {} }) {
  const context = await loadSchedulingContext({ schoolId, campusId, groupIds });
  const { instances, skipped } = buildExamInstances(context.examsToSchedule);

  const { assignments: roomAssignments, conflicts: roomConflicts } = assignRooms(instances, context);
  const { results: invigilatorAssignments, conflicts: teacherConflicts } = assignInvigilators(roomAssignments, context, config);

  const validation = validateSchedule(invigilatorAssignments);
  const allConflicts = [
    ...skipped.map((s) => ({ type: 'INVALID_EXAM_INPUT', examId: s.examId, message: s.reason })),
    ...roomConflicts,
    ...teacherConflicts,
    ...validation.conflicts,
  ];

  if (allConflicts.length > 0) {
    return {
      status: 'FAILED',
      message: 'Routine could not be generated for every exam instance.',
      examSchedule: [],
      validation: { valid: false, conflicts: allConflicts },
    };
  }

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      for (const { roomAssignment, teachers } of invigilatorAssignments) {
        const { instance, room } = roomAssignment;
        await Exam.updateOne(
          { _id: instance.examId },
          {
            $set: {
              roomId: room._id,
              instructor: teachers.map((t) => t.name).join(', '),
            },
          },
          { session },
        );
        await ExamInvigilation.insertMany(
          teachers.map((t, idx) => ({
            schoolId,
            campusId: campusId || null,
            examId: instance.examId,
            groupId: null,
            teacherId: t._id,
            roomId: room._id,
            buildingId: room.buildingId,
            floorId: room.floorId,
            classId: instance.classId,
            sectionId: instance.sectionId,
            date: instance.date,
            startTime: instance.startTime,
            endTime: instance.endTime,
            role: idx === 0 ? 'primary' : 'secondary',
          })),
          { session, ordered: true },
        );
      }
    });
  } catch (err) {
    // A unique-index violation here means two concurrent generation runs
    // raced for the same room/teacher slot — surface it as a conflict
    // instead of a generic 500, nothing was committed (transaction rolled
    // back automatically).
    if (err?.code === 11000) {
      return {
        status: 'FAILED',
        message: 'Routine generation conflicted with another concurrent change. Nothing was saved — please retry.',
        examSchedule: [],
        validation: { valid: false, conflicts: [{ type: 'CONCURRENT_CONFLICT', message: err.message }] },
      };
    }
    throw err;
  } finally {
    await session.endSession();
  }

  const examSchedule = invigilatorAssignments.map(({ roomAssignment, teachers }) => ({
    examId: roomAssignment.instance.examId,
    date: roomAssignment.instance.date,
    startTime: roomAssignment.instance.startTime,
    endTime: roomAssignment.instance.endTime,
    classId: roomAssignment.instance.classId,
    sectionId: roomAssignment.instance.sectionId,
    subjectId: roomAssignment.instance.subjectId,
    room: {
      buildingId: roomAssignment.room.buildingId,
      floorId: roomAssignment.room.floorId,
      roomId: roomAssignment.room._id,
    },
    invigilators: teachers.map((t) => ({ teacherId: t._id, teacherName: t.name })),
  }));

  return {
    status: 'GENERATED',
    message: `Assigned rooms and invigilators for ${examSchedule.length} exam instance(s).`,
    examSchedule,
    validation: { valid: true, conflicts: [] },
  };
}

module.exports = {
  DEFAULT_CONFIG,
  toMinutes,
  addMinutesToTime,
  loadSchedulingContext,
  buildExamInstances,
  assignRooms,
  groupBySlot,
  assignInvigilators,
  validateSchedule,
  generateRoutine,
};
