const {
  buildExamInstances,
  assignRooms,
  assignInvigilators,
  validateSchedule,
  toMinutes,
  addMinutesToTime,
} = require('../services/examSchedulingEngine');

// ── fixtures ────────────────────────────────────────────────────────────
const room = (id, buildingName, floorName, roomNumber, capacity) => ({
  _id: id,
  capacity,
  floorId: {
    _id: `floor-${id}`,
    name: floorName,
    buildingId: { _id: `building-${buildingName}`, name: buildingName },
  },
  roomNumber,
});

const teacher = (id, name, subject = '') => ({ _id: id, name, subject });

const baseContext = (overrides = {}) => ({
  rooms: [],
  teachers: [],
  allocations: [],
  leaves: [],
  existingInvigilations: [],
  allSchoolExams: [],
  ...overrides,
});

const instance = (over = {}) => ({
  examId: 'exam-1',
  classId: 'class-1',
  sectionId: 'section-1',
  subjectId: 'subject-1',
  date: '2026-10-05',
  startTime: '10:00',
  endTime: '11:00',
  duration: 60,
  studentCount: 30,
  ...over,
});

describe('examSchedulingEngine — buildExamInstances', () => {
  it('skips exams missing date/time/duration/class/section instead of crashing', () => {
    const { instances, skipped } = buildExamInstances([
      { _id: 'e1', date: '2026-10-05', time: '10:00', duration: 60, classId: 'c1', sectionId: 's1', noOfStudents: 10 },
      { _id: 'e2', date: '', time: '10:00', duration: 60, classId: 'c1', sectionId: 's1' },
      { _id: 'e3', date: '2026-10-05', time: '', duration: 60, classId: 'c1', sectionId: 's1' },
    ]);
    expect(instances).toHaveLength(1);
    expect(instances[0].examId).toBe('e1');
    expect(skipped).toHaveLength(2);
  });

  it('computes endTime from startTime + duration', () => {
    const { instances } = buildExamInstances([
      { _id: 'e1', date: '2026-10-05', time: '10:30', duration: 90, classId: 'c1', sectionId: 's1' },
    ]);
    expect(instances[0].endTime).toBe('12:00');
  });
});

describe('examSchedulingEngine — assignRooms (hard constraint A + D)', () => {
  it('reproduces the spec\'s "Important Example": 5 classes, same slot, 5 different rooms, no two classes share a room', () => {
    const context = baseContext({
      rooms: [
        room('r1', 'Academic', 'Ground', '101', 40),
        room('r2', 'Academic', 'Ground', '102', 50),
        room('r3', 'Sports', 'SPT Ground', '101', 60),
        room('r4', 'Library', 'LIB Ground', '101', 30),
        room('r5', 'Laboratory', 'LAB Ground', '101', 40),
      ],
    });
    const instances = ['5A', '5B', '6A', '6B', '7A'].map((cls, i) =>
      instance({ examId: `exam-${cls}`, classId: cls, sectionId: cls, studentCount: 25 + i }),
    );

    const { assignments, conflicts } = assignRooms(instances, context);

    expect(conflicts).toHaveLength(0);
    expect(assignments).toHaveLength(5);
    const roomIds = assignments.map((a) => a.room._id);
    expect(new Set(roomIds).size).toBe(5); // every class got a DIFFERENT room
  });

  it('never assigns a room to two classes in the same date+time slot, even across separate calls (simulating a room already booked school-wide)', () => {
    const context = baseContext({
      rooms: [room('r1', 'Academic', 'Ground', '101', 40)],
      allSchoolExams: [{ roomId: 'r1', date: '2026-10-05', time: '10:00', duration: 60 }],
    });
    const { assignments, conflicts } = assignRooms([instance({ studentCount: 20 })], context);
    expect(assignments).toHaveLength(0);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('NO_ROOM_AVAILABLE');
  });

  it('rejects a room whose capacity is below the class headcount (hard constraint D)', () => {
    const context = baseContext({ rooms: [room('r1', 'Academic', 'Ground', '101', 30)] });
    const { assignments, conflicts } = assignRooms([instance({ studentCount: 45 })], context);
    expect(assignments).toHaveLength(0);
    expect(conflicts[0].type).toBe('NO_ROOM_AVAILABLE');
  });

  it('does NOT treat two different buildings sharing the same room NUMBER as the same room', () => {
    const context = baseContext({
      rooms: [
        room('academic-101', 'Academic', 'Ground', '101', 40),
        room('sports-101', 'Sports', 'SPT Ground', '101', 40),
      ],
    });
    const instances = [
      instance({ examId: 'e1', classId: 'c1', sectionId: 's1', studentCount: 30 }),
      instance({ examId: 'e2', classId: 'c2', sectionId: 's2', studentCount: 30 }),
    ];
    const { assignments, conflicts } = assignRooms(instances, context);
    expect(conflicts).toHaveLength(0);
    expect(assignments).toHaveLength(2);
    expect(new Set(assignments.map((a) => a.room._id)).size).toBe(2);
  });
});

describe('examSchedulingEngine — assignInvigilators (hard constraint B/E, soft fairness)', () => {
  it('never assigns the SAME teacher to two different rooms in the same slot — the exact "Incorrect output" scenario from the spec', () => {
    const context = baseContext({
      teachers: [teacher('t1', 'T1'), teacher('t2', 'T2')],
    });
    const roomAssignments = [
      { instance: instance({ examId: 'e1', classId: '5A', sectionId: '5A' }), room: { _id: 'r1', buildingId: 'b1', buildingName: 'Academic', floorId: 'f1', floorName: 'Ground', roomNumber: '101', capacity: 40 } },
      { instance: instance({ examId: 'e2', classId: '5B', sectionId: '5B' }), room: { _id: 'r2', buildingId: 'b1', buildingName: 'Academic', floorId: 'f1', floorName: 'Ground', roomNumber: '102', capacity: 40 } },
    ];
    const { results, conflicts } = assignInvigilators(roomAssignments, context, {});
    expect(conflicts).toHaveLength(0);
    expect(results).toHaveLength(2);
    const names = results.map((r) => r.teachers[0].name);
    expect(names[0]).not.toBe(names[1]);
  });

  it('reports a conflict instead of double-booking when there are more rooms than free teachers', () => {
    const context = baseContext({ teachers: [teacher('t1', 'T1')] });
    const roomAssignments = [
      { instance: instance({ examId: 'e1', classId: '5A', sectionId: '5A' }), room: { _id: 'r1', buildingId: 'b1', buildingName: 'A', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 } },
      { instance: instance({ examId: 'e2', classId: '5B', sectionId: '5B' }), room: { _id: 'r2', buildingId: 'b1', buildingName: 'A', floorId: 'f1', floorName: 'G', roomNumber: '102', capacity: 40 } },
    ];
    const { results, conflicts } = assignInvigilators(roomAssignments, context, {});
    expect(results).toHaveLength(1);
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0].type).toBe('NO_TEACHER_AVAILABLE');
  });

  it('never picks a teacher on approved leave that day (hard constraint E)', () => {
    const context = baseContext({
      teachers: [teacher('t1', 'On Leave'), teacher('t2', 'Free')],
      leaves: [{ teacherId: 't1', startDate: '2026-10-05', endDate: '2026-10-05' }],
    });
    const roomAssignments = [{ instance: instance(), room: { _id: 'r1', buildingId: 'b1', buildingName: 'A', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 } }];
    const { results } = assignInvigilators(roomAssignments, context, {});
    expect(results[0].teachers[0].name).toBe('Free');
  });

  it('respects maxInvigilationDutiesPerDay', () => {
    const context = baseContext({
      teachers: [teacher('t1', 'T1')],
      existingInvigilations: [{ teacherId: 't1', date: '2026-10-05', startTime: '08:00', endTime: '09:00', buildingId: 'b1' }],
    });
    const roomAssignments = [{ instance: instance(), room: { _id: 'r1', buildingId: 'b1', buildingName: 'A', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 } }];
    const { results, conflicts } = assignInvigilators(roomAssignments, context, { maxInvigilationDutiesPerDay: 1 });
    expect(results).toHaveLength(0);
    expect(conflicts[0].type).toBe('NO_TEACHER_AVAILABLE');
  });

  it('allows a second duty the same day when maxInvigilationDutiesPerDay = 2 and slots do not overlap', () => {
    const context = baseContext({
      teachers: [teacher('t1', 'T1')],
      existingInvigilations: [{ teacherId: 't1', date: '2026-10-05', startTime: '08:00', endTime: '09:00', buildingId: 'b1' }],
    });
    const roomAssignments = [{ instance: instance({ startTime: '10:00', endTime: '11:00' }), room: { _id: 'r1', buildingId: 'b1', buildingName: 'A', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 } }];
    const { results, conflicts } = assignInvigilators(roomAssignments, context, { maxInvigilationDutiesPerDay: 2 });
    expect(conflicts).toHaveLength(0);
    expect(results[0].teachers[0]._id).toBe('t1');
  });

  it('blocks a same-day building switch that violates minimumTeacherTransitionMinutes', () => {
    const context = baseContext({
      teachers: [teacher('t1', 'T1'), teacher('t2', 'T2')],
      existingInvigilations: [{ teacherId: 't1', date: '2026-10-05', startTime: '10:00', endTime: '11:00', buildingId: 'academic' }],
    });
    const roomAssignments = [{
      instance: instance({ startTime: '11:05', endTime: '12:05' }), // only 5 min gap
      room: { _id: 'r1', buildingId: 'sports', buildingName: 'Sports', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 },
    }];
    const { results } = assignInvigilators(roomAssignments, context, { minimumTeacherTransitionMinutes: 10 });
    // t1 doesn't have enough transition time — t2 must be picked instead.
    expect(results[0].teachers[0].name).toBe('T2');
  });

  it('allows the same-day building switch once the gap meets minimumTeacherTransitionMinutes', () => {
    const context = baseContext({
      teachers: [teacher('t1', 'T1')],
      existingInvigilations: [{ teacherId: 't1', date: '2026-10-05', startTime: '10:00', endTime: '11:00', buildingId: 'academic' }],
    });
    const roomAssignments = [{
      instance: instance({ startTime: '11:15', endTime: '12:15' }), // 15 min gap
      room: { _id: 'r1', buildingId: 'sports', buildingName: 'Sports', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 },
    }];
    const { results, conflicts } = assignInvigilators(roomAssignments, context, { minimumTeacherTransitionMinutes: 10 });
    expect(conflicts).toHaveLength(0);
    expect(results[0].teachers[0]._id).toBe('t1');
  });

  it('prefers the teacher with the lower existing duty count (fair distribution)', () => {
    const context = baseContext({
      teachers: [teacher('busy', 'Busy'), teacher('free', 'Free')],
      existingInvigilations: [
        { teacherId: 'busy', date: '2026-09-01', startTime: '08:00', endTime: '09:00', buildingId: 'b0' },
        { teacherId: 'busy', date: '2026-09-02', startTime: '08:00', endTime: '09:00', buildingId: 'b0' },
        { teacherId: 'busy', date: '2026-09-03', startTime: '08:00', endTime: '09:00', buildingId: 'b0' },
      ],
    });
    const roomAssignments = [{ instance: instance(), room: { _id: 'r1', buildingId: 'b1', buildingName: 'A', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 } }];
    const { results } = assignInvigilators(roomAssignments, context, {});
    expect(results[0].teachers[0].name).toBe('Free');
  });

  it('avoids the subject\'s own teacher when avoidSubjectTeacherInvigilation is on and an alternative exists', () => {
    const context = baseContext({
      teachers: [teacher('bengali-teacher', 'Bengali Teacher'), teacher('other', 'Other Teacher')],
      allocations: [{ teacherId: 'bengali-teacher', classId: 'class-1', sectionId: 'section-1', subjectId: 'subject-1', isClassTeacher: false }],
    });
    const roomAssignments = [{ instance: instance(), room: { _id: 'r1', buildingId: 'b1', buildingName: 'A', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 } }];
    const { results } = assignInvigilators(roomAssignments, context, { avoidSubjectTeacherInvigilation: true });
    expect(results[0].teachers[0].name).toBe('Other Teacher');
  });

  it('falls back to the subject teacher when they are the only eligible option (soft, not hard)', () => {
    const context = baseContext({
      teachers: [teacher('bengali-teacher', 'Bengali Teacher')],
      allocations: [{ teacherId: 'bengali-teacher', classId: 'class-1', sectionId: 'section-1', subjectId: 'subject-1', isClassTeacher: false }],
    });
    const roomAssignments = [{ instance: instance(), room: { _id: 'r1', buildingId: 'b1', buildingName: 'A', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 } }];
    const { results, conflicts } = assignInvigilators(roomAssignments, context, { avoidSubjectTeacherInvigilation: true });
    expect(conflicts).toHaveLength(0);
    expect(results[0].teachers[0].name).toBe('Bengali Teacher');
  });

  it('avoids a class\'s own class-teacher when avoidClassTeacherInvigilation is on and an alternative exists', () => {
    const context = baseContext({
      teachers: [teacher('class-teacher', 'Class Teacher'), teacher('other', 'Other')],
      allocations: [{ teacherId: 'class-teacher', classId: 'class-1', sectionId: 'section-1', isClassTeacher: true }],
    });
    const roomAssignments = [{ instance: instance(), room: { _id: 'r1', buildingId: 'b1', buildingName: 'A', floorId: 'f1', floorName: 'G', roomNumber: '101', capacity: 40 } }];
    const { results } = assignInvigilators(roomAssignments, context, { avoidClassTeacherInvigilation: true });
    expect(results[0].teachers[0].name).toBe('Other');
  });
});

describe('examSchedulingEngine — validateSchedule (final safety net)', () => {
  it('passes a conflict-free schedule', () => {
    const assignments = [
      { roomAssignment: { instance: instance({ examId: 'e1' }), room: { _id: 'r1', roomNumber: '101', capacity: 40 } }, teachers: [{ _id: 't1', name: 'T1' }] },
      { roomAssignment: { instance: instance({ examId: 'e2', classId: '5B', sectionId: '5B' }), room: { _id: 'r2', roomNumber: '102', capacity: 40 } }, teachers: [{ _id: 't2', name: 'T2' }] },
    ];
    expect(validateSchedule(assignments).valid).toBe(true);
  });

  it('flags a duplicate room assignment', () => {
    const assignments = [
      { roomAssignment: { instance: instance({ examId: 'e1' }), room: { _id: 'r1', roomNumber: '101', capacity: 40 } }, teachers: [{ _id: 't1', name: 'T1' }] },
      { roomAssignment: { instance: instance({ examId: 'e2', classId: '5B', sectionId: '5B' }), room: { _id: 'r1', roomNumber: '101', capacity: 40 } }, teachers: [{ _id: 't2', name: 'T2' }] },
    ];
    const result = validateSchedule(assignments);
    expect(result.valid).toBe(false);
    expect(result.conflicts.some((c) => c.type === 'DUPLICATE_ROOM_ASSIGNMENT')).toBe(true);
  });

  it('flags a duplicate teacher assignment (the spec\'s "Incorrect output" example, caught even if it somehow got this far)', () => {
    const assignments = [
      { roomAssignment: { instance: instance({ examId: 'e1' }), room: { _id: 'r1', roomNumber: '101', capacity: 40 } }, teachers: [{ _id: 't1', name: 'T1' }] },
      { roomAssignment: { instance: instance({ examId: 'e2', classId: '5B', sectionId: '5B' }), room: { _id: 'r2', roomNumber: '102', capacity: 40 } }, teachers: [{ _id: 't1', name: 'T1' }] },
    ];
    const result = validateSchedule(assignments);
    expect(result.valid).toBe(false);
    expect(result.conflicts.some((c) => c.type === 'DUPLICATE_TEACHER_ASSIGNMENT')).toBe(true);
  });

  it('flags a room whose capacity is under the assigned headcount', () => {
    const assignments = [
      { roomAssignment: { instance: instance({ studentCount: 50 }), room: { _id: 'r1', roomNumber: '101', capacity: 30 } }, teachers: [{ _id: 't1', name: 'T1' }] },
    ];
    const result = validateSchedule(assignments);
    expect(result.valid).toBe(false);
    expect(result.conflicts[0].type).toBe('CAPACITY_EXCEEDED');
  });
});

describe('examSchedulingEngine — time helpers', () => {
  it('toMinutes parses HH:mm', () => {
    expect(toMinutes('09:05')).toBe(545);
    expect(toMinutes('bad')).toBeNull();
  });
  it('addMinutesToTime wraps correctly', () => {
    expect(addMinutesToTime('23:30', 45)).toBe('00:15');
  });
});
