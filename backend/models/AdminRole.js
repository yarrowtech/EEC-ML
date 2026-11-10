const mongoose = require('mongoose');

// A school-defined access role for admin team members. permissions lists the
// admin modules (see config/adminPermissions.js) the role can view or edit.
const adminRoleSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    description: { type: String, default: '', trim: true, maxlength: 200 },
    permissions: [{
      _id: false,
      key: { type: String, required: true },
      level: { type: String, enum: ['view', 'edit'], required: true },
    }],
  },
  { timestamps: true }
);

adminRoleSchema.index({ schoolId: 1, name: 1 }, { unique: true });

module.exports = mongoose.model('AdminRole', adminRoleSchema);
