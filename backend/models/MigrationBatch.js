const mongoose = require('mongoose');

// One document per school being migrated from a legacy system by a super
// admin (see backend/routes/superAdminMigrationRoutes.js). Tracks progress
// per entity type so the super admin can leave mid-migration and resume, and
// so there's an audit trail of what was imported. Row-level data is never
// persisted here — only counts and a capped error sample — the source file
// is re-uploaded to retry a failed/partial entity.
const ENTITY_TYPES = [
  'academicYear',
  'class',
  'section',
  'subject',
  'teacher',
  'student',
  'feeStructure',
  'feeInvoice',
  'attendance',
];

const migrationEntitySchema = new mongoose.Schema(
  {
    type: { type: String, enum: ENTITY_TYPES, required: true },
    status: { type: String, enum: ['pending', 'importing', 'completed', 'failed'], default: 'pending' },
    totalRows: { type: Number, default: 0 },
    imported: { type: Number, default: 0 },
    failed: { type: Number, default: 0 },
    lastRunAt: { type: Date },
    lastJobId: { type: String },
    errorSample: [
      {
        index: { type: Number },
        message: { type: String },
      },
    ],
  },
  { _id: false }
);

const migrationBatchSchema = new mongoose.Schema(
  {
    schoolId: { type: mongoose.Schema.Types.ObjectId, ref: 'School', required: true },
    campusId: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    entities: { type: [migrationEntitySchema], default: [] },
  },
  { timestamps: true }
);

migrationBatchSchema.index({ schoolId: 1 }, { unique: true });

module.exports = mongoose.model('MigrationBatch', migrationBatchSchema);
module.exports.ENTITY_TYPES = ENTITY_TYPES;
