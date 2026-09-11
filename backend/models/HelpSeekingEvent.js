const mongoose = require('mongoose');

// A single instance of a student proactively reaching out for help during a
// tutor session — e.g. switching into Homework Help mode, or telling the
// Socratic tutor "I don't know" mid-conversation. Distinct from the
// Misconceptions Engine (StudentMisconception), which tracks *wrong answers*
// regardless of whether the student asked for help.
const helpSeekingEventSchema = new mongoose.Schema({
  schoolId:   { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  studentId:  { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  subject:    { type: String, default: '' },
  topicTitle: { type: String, default: '' },
  eventType:  { type: String, enum: ['homework_help_used', 'stuck_signal'], required: true },
  mode:       { type: String, default: '' },
}, { timestamps: true });

helpSeekingEventSchema.index({ schoolId: 1, studentId: 1, createdAt: -1 });

module.exports = mongoose.model('HelpSeekingEvent', helpSeekingEventSchema);
