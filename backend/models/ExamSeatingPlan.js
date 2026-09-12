const mongoose = require('mongoose');

// One seat, one student — captured at generation time (name/roll/class copied
// in rather than only referenced) so a seating chart stays exactly as printed
// even if a student later moves class/section or changes their roll number.
const seatSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser' },
    name: { type: String, default: '' },
    username: { type: String, default: '' },
    roll: { type: Number, default: null },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    className: { type: String, default: '' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    sectionName: { type: String, default: '' },
  },
  { _id: false }
);

// One room, on one date/time, holding seats mixed in from one or more classes
// up to the room's capacity.
const roomAllocationSchema = new mongoose.Schema(
  {
    date: { type: String, default: '' },
    time: { type: String, default: '' },
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    roomNumber: { type: String, default: '' },
    floorName: { type: String, default: '' },
    buildingName: { type: String, default: '' },
    seats: [seatSchema],
  },
  { _id: false }
);

const examSeatingPlanSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    title: { type: String, required: true, trim: true },
    term: { type: String, default: '' },
    startDate: { type: String, default: '' },
    endDate: { type: String, default: '' },
    // Every ExamGroup (one per class/section) this seating plan covers — how
    // an exam batch is identified elsewhere in the admin Examinations page too.
    groupIds: [{ type: mongoose.Schema.Types.ObjectId, ref: 'ExamGroup' }],
    roomAllocations: [roomAllocationSchema],
  },
  { timestamps: true }
);

examSeatingPlanSchema.index({ schoolId: 1, campusId: 1, groupIds: 1 });

module.exports = mongoose.model('ExamSeatingPlan', examSeatingPlanSchema);
