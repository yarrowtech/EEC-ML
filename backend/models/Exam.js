const mongoose = require('mongoose');

const examSchema = new mongoose.Schema({
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null, index: true },
    title: String,
    subject: String,
    term: {
        type: String,
        enum: [
            'Class Test',
            'Unit Test',
            'Monthly Test',
            'Term 1',
            'Term 2',
            'Term 3',
            'Half Yearly',
            'Annual',
            'Final'
        ],
        default: 'Term 1'
    },
    instructor: String,
    venue: String,
    date: String,
    time: String,
    duration: Number,
    marks: Number,
    noOfStudents: Number,
    status: String,
    roomId: { type: mongoose.Schema.Types.ObjectId, ref: 'Room' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    sectionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Section' },
    subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
    grade: String,
    section: String,
    groupId: { type: mongoose.Schema.Types.ObjectId, ref: 'ExamGroup', default: null, index: true },
    published: { type: Boolean, default: false },
    publishedAt: { type: Date },
    // MCQ auto-grading support
    questions: [{
      questionText: { type: String },
      options: [{ text: String, isCorrect: Boolean }],
      marks: { type: Number, default: 1 },
    }],
    examType: { type: String, enum: ['manual', 'mcq'], default: 'manual' },
})

module.exports = mongoose.model('Exam', examSchema);
