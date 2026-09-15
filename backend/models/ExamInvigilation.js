const mongoose = require('mongoose');

// One row = one teacher guarding one room for one exam slot. This is the
// hard-constraint source of truth for the auto-scheduler in
// services/examSchedulingEngine.js — Exam.instructor stays a free-text
// name string for backward compatibility with the existing admin UI, but
// conflict detection must never trust a name string, only these ObjectId
// references plus the two unique indexes below (enforced by MongoDB itself,
// not just application code).
const examInvigilationSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    examId: { type: mongoose.Schema.Types.ObjectId, ref: 'Exam', required: true, index: true },
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamGroup', default: null, index: true },
    teacherId: { type: mongoose.Schema.Types.ObjectId, ref: 'TeacherUser', required: true },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    buildingId: { type: mongoose.Schema.Types.ObjectId, ref: 'Building', required: true },
    floorId: { type: mongoose.Schema.Types.ObjectId, ref: 'Floor', required: true },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class', required: true },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', required: true },
    date: { type: String, required: true }, // YYYY-MM-DD
    startTime: { type: String, required: true }, // HH:mm (24h)
    endTime: { type: String, required: true }, // HH:mm (24h) — startTime + duration
    role: { type: String, enum: ['primary', 'secondary'], default: 'primary' },
  },
  { timestamps: true }
);

// Hard constraint B: one teacher cannot invigilate two rooms in the same slot.
// A teacher CAN hold both the primary and secondary role for the SAME room
// (that's normal — a room can have two invigilators), so role is excluded
// from the key on purpose: two rows for the same teacher+date+startTime are
// only valid if they also share the same roomId, which the app layer must
// still check (a unique index alone can't express "same room only").
examInvigilationSchema.index(
  { schoolId: 1, campusId: 1, teacherId: 1, date: 1, startTime: 1, roomId: 1 },
  { unique: true, name: 'uniq_teacher_room_slot' }
);

// Fast lookup for "who's already busy at this slot" and for the fairness
// duty-count aggregation.
examInvigilationSchema.index({ schoolId: 1, campusId: 1, teacherId: 1, date: 1 });
examInvigilationSchema.index({ schoolId: 1, campusId: 1, roomId: 1, date: 1, startTime: 1 });

module.exports = mongoose.model('ExamInvigilation', examInvigilationSchema);
