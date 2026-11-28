const mongoose = require('mongoose');

const examGroupSchema = new mongoose.Schema({
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
  campusId:  { type: String, default: null, index: true },
  title:     { type: String, required: true, trim: true },
  term:      {
    type: String,
    enum: ['Class Test','Unit Test','Monthly Test','Term 1','Term 2','Term 3','Half Yearly','Annual','Final'],
    default: 'Term 1',
  },
  classId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Class', default: null },
  sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section', default: null },
  grade:     { type: String, default: '' },
  section:   { type: String, default: '' },
  status:    { type: String, default: 'Scheduled' },
  // formal     — term / final exams: rooms, seating plans and admit cards
  // class_test — quiz / class test held in the class's own room: no room
  //              allocation, no seating plan, no admit card
  examMode:  { type: String, enum: ['formal', 'class_test'], default: 'formal' },
  startDate: { type: String, default: '' },
  endDate:   { type: String, default: '' },
  startTime: { type: String, default: '' },
  publishedAt: { type: Date, default: null },
  // When set, the scheduler publishes every subject result under this exam
  // once this time arrives (then clears it).
  resultPublishAt: { type: Date, default: null },
  routineNoticeId: { type: mongoose.Schema.Types.ObjectId, ref: 'Notification', default: null },
}, { timestamps: true });

module.exports = mongoose.model('ExamGroup', examGroupSchema);
