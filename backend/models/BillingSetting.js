const mongoose = require('mongoose');

/**
 * Platform-wide per-student/per-month pricing, keyed by student-count tier.
 * Singleton document (key: 'global'). The monthly bill for a school is
 * studentCount * pricePerStudent for whichever tier the student count falls in.
 *
 * Tiers:
 *   under500  -> 0 .. 499 students
 *   midTier   -> 500 .. 1000 students
 *   over1000  -> 1001+ students
 */
const billingSettingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, default: 'global' },
    currency: { type: String, default: 'INR' },
    tiers: {
      under500: {
        label: { type: String, default: 'Under 500 students' },
        pricePerStudent: { type: Number, default: 50, min: 0 },
      },
      midTier: {
        label: { type: String, default: '500 – 1,000 students' },
        pricePerStudent: { type: Number, default: 40, min: 0 },
      },
      over1000: {
        label: { type: String, default: '1,000+ students' },
        pricePerStudent: { type: Number, default: 30, min: 0 },
      },
    },
  },
  { timestamps: true }
);

module.exports = mongoose.model('BillingSetting', billingSettingSchema);
