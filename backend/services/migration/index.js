const academicYear = require('./academicYear');
const classImporter = require('./class');
const section = require('./section');
const subject = require('./subject');
const teacher = require('./teacher');
const student = require('./student');
const feeStructure = require('./feeStructure');
const feeInvoice = require('./feeInvoice');
const attendance = require('./attendance');

// Fixed dependency order for the migration portal (see the plan at
// /home/meow/.claude/plans/sleepy-growing-biscuit.md). `dependsOn` entity
// types must already have a `completed` entry on the school's MigrationBatch
// before this entity's import is allowed to start — enforced in
// backend/routes/superAdminMigrationRoutes.js.
const ENTITY_IMPORTERS = {
  academicYear: { label: 'Academic Year', dependsOn: [], ...academicYear },
  class: { label: 'Class', dependsOn: ['academicYear'], ...classImporter },
  section: { label: 'Section', dependsOn: ['class'], ...section },
  subject: { label: 'Subject', dependsOn: ['class'], ...subject },
  teacher: { label: 'Teacher', dependsOn: [], ...teacher },
  student: { label: 'Student', dependsOn: ['class'], ...student },
  feeStructure: { label: 'Fee Structure', dependsOn: ['class'], ...feeStructure },
  feeInvoice: { label: 'Fee Invoice', dependsOn: ['feeStructure', 'student'], ...feeInvoice },
  attendance: { label: 'Attendance', dependsOn: ['student'], ...attendance },
};

const ENTITY_ORDER = [
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

module.exports = { ENTITY_IMPORTERS, ENTITY_ORDER };
