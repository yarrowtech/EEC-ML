const mongoose = require('mongoose');

const flashcardResultSchema = new mongoose.Schema({
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: 'StudentUser', required: true, index: true },
  schoolId:  { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
  topicId:   { type: String, required: true },
  topicTitle:{ type: String, default: '' },
  subject:   { type: String, default: '' },
  result:    { type: String, enum: ['got_it', 'still_learning'], required: true },
}, { timestamps: true });

flashcardResultSchema.index({ studentId: 1, topicId: 1 });

module.exports = mongoose.model('FlashcardResult', flashcardResultSchema);
