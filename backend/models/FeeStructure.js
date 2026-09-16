const mongoose = require('mongoose');

const installmentSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
    dueDate: { type: Date },
  },
  { _id: false }
);

const feeHeadSchema = new mongoose.Schema(
  {
    label: { type: String, required: true, trim: true },
    amount: { type: Number, required: true, min: 0 },
  },
  { _id: false }
);

const feeStructureSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    academicYearId: { type: mongoose.Schema.Types.ObjectId, ref: 'AcademicYear' },
    classId: { type: mongoose.Schema.Types.ObjectId, ref: 'Class' },
    className: { type: String, trim: true },
    board: { type: String, default: 'GENERAL' },
    name: { type: String, required: true, trim: true },
    totalAmount: { type: Number, required: true, min: 0 },
    lateFeeAmount: { type: Number, default: 0, min: 0 },
    // Skip Sundays / this school's Holiday-collection dates when counting
    // how many days an invoice has been overdue for late-fee purposes.
    lateFeeExcludeSundays: { type: Boolean, default: false },
    lateFeeExcludeHolidays: { type: Boolean, default: false },
    feeHeads: [feeHeadSchema],
    installments: [installmentSchema],
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

module.exports = mongoose.model('FeeStructure', feeStructureSchema);
