const mongoose = require('mongoose');

const holidaySchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    campusId: { type: String, default: null, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    startDate: { type: Date, required: true, index: true },
    endDate: { type: Date, required: true, index: true },
    date: { type: Date, default: null, index: true }, // legacy single-day field
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin', default: null },
  },
  { timestamps: true }
);

holidaySchema.pre('validate', function attachLegacyDefaults(next) {
  if (!this.startDate && this.date) {
    this.startDate = this.date;
  }
  if (!this.endDate && this.startDate) {
    this.endDate = this.startDate;
  }
  if (!this.date && this.startDate) {
    this.date = this.startDate;
  }
  next();
});

holidaySchema.index({ schoolId: 1, campusId: 1, startDate: 1, name: 1 }, { unique: true });

// Any holiday write drops cached holiday reads.
const clearHolidayCache = () => require('../utils/responseCache').holidayCache.clear();
holidaySchema.post(['save', 'insertMany', 'updateOne', 'updateMany', 'findOneAndUpdate', 'deleteOne', 'deleteMany', 'findOneAndDelete'], clearHolidayCache);

module.exports = mongoose.model('Holiday', holidaySchema);
