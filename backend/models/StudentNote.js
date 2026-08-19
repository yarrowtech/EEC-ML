const mongoose = require('mongoose');

const studentNoteSchema = new mongoose.Schema(
  {
    studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
    schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School',      required: true },
    title:     { type: String, default: 'Study Notes' },
    content:   { type: String, required: true },
    subject:   { type: String, default: '' },
    topicTitle:{ type: String, default: '' },
    savedAt:   { type: Date,   default: Date.now },
  },
  { timestamps: true }
);

studentNoteSchema.index({ studentId: 1, schoolId: 1 });

module.exports = mongoose.model('StudentNote', studentNoteSchema);
