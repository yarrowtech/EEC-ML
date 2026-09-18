const mongoose = require('mongoose');
const StudentUser = require('../models/StudentUser');
const ClassModel = require('../models/Class');
const AcademicYear = require('../models/AcademicYear');
const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const { buildInvoiceSnapshotsForStudent } = require('../utils/feeHeadPolicy');

/**
 * Mutates an invoice object to recompute its status and balanceAmount
 * based on current paidAmount, totalAmount, and discountAmount.
 */
const recomputeInvoiceStatus = (invoice) => {
  const paid = Number(invoice.paidAmount || 0);
  const total = Math.max(
    0,
    Number(invoice.totalAmount || 0) - Number(invoice.discountAmount || 0)
  );
  const balance = Math.max(0, total - paid);
  invoice.balanceAmount = balance;
  if (balance === 0) {
    invoice.status = 'paid';
  } else if (paid > 0) {
    invoice.status = 'partial';
  } else {
    invoice.status = 'due';
  }
};

/**
 * Extracts and validates schoolId from a request. Responds with 400 and
 * returns null if the schoolId is missing or not a valid ObjectId.
 */
const resolveSchoolId = (req, res) => {
  const schoolId = req.schoolId || req.admin?.schoolId || null;
  if (!schoolId) {
    res.status(400).json({ error: 'schoolId is required' });
    return null;
  }
  if (!mongoose.isValidObjectId(schoolId)) {
    res.status(400).json({ error: 'Invalid schoolId' });
    return null;
  }
  return schoolId;
};

const normalizeName = (value) => String(value || '').trim();

/**
 * Resolves the list of StudentUser documents linked to a parent.
 * Prefers childrenIds (ObjectId references) over legacy children name arrays.
 */
const resolveParentStudents = async ({ parent, schoolId, campusId }) => {
  const filter = { schoolId };
  if (campusId) filter.campusId = campusId;

  if (Array.isArray(parent?.childrenIds) && parent.childrenIds.length > 0) {
    return StudentUser.find({
      ...filter,
      _id: { $in: parent.childrenIds },
    })
      .select('name grade section studentCode roll admissionNumber username')
      .lean();
  }

  const names = Array.isArray(parent?.children)
    ? parent.children.map(normalizeName).filter(Boolean)
    : [];
  if (names.length === 0) return [];

  return StudentUser.find({
    ...filter,
    name: { $in: names },
  })
    .select('name grade section studentCode roll admissionNumber username')
    .lean();
};

/**
 * Groups a flat payments array into a map keyed by invoiceId.
 */
const buildPaymentsByInvoice = (payments = []) => {
  return payments.reduce((acc, payment) => {
    const key = String(payment.invoiceId || '');
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(payment);
    return acc;
  }, {});
};

/**
 * Auto-assigns the active fee structure for a student's current class (in
 * the school's active academic year) by creating a FeeInvoice, if one
 * doesn't already exist for that structure. Called right after a student is
 * enrolled/edited into a class, and after a promotion moves them into a new
 * one — mirrors the admin's manual "assign" flow (POST /admin/invoices/bulk)
 * so invoices come out identical either way. Silently no-ops (returns null)
 * when there's no active year, no matching class, no fee structure for that
 * class yet, or the student already has an invoice for it — none of those
 * are error conditions worth surfacing to whatever caller triggered this.
 */
const autoAssignFeeStructure = async ({ studentId, schoolId, campusId, grade, section }) => {
  try {
    if (!studentId || !schoolId || !grade) return null;

    const activeYear = await AcademicYear.findOne({ schoolId, isActive: true }).lean();
    if (!activeYear) return null;

    const classFilter = { schoolId, name: grade, academicYearId: activeYear._id };
    if (campusId) classFilter.campusId = campusId;
    const classDoc = await ClassModel.findOne(classFilter).select('_id name').lean();
    if (!classDoc) return null;

    const structure = await FeeStructure.findOne({
      schoolId,
      classId: classDoc._id,
      academicYearId: activeYear._id,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!structure) return null;

    const alreadyAssigned = await FeeInvoice.exists({
      schoolId,
      feeStructureId: structure._id,
      studentId,
    });
    if (alreadyAssigned) return null;

    const hasPriorInvoice = await FeeInvoice.exists({ schoolId, studentId });
    const snapshots = buildInvoiceSnapshotsForStudent({ structure, hasPriorInvoice: Boolean(hasPriorInvoice) });

    const invoice = await FeeInvoice.create({
      schoolId,
      academicYearId: structure.academicYearId || activeYear._id,
      classId: structure.classId,
      className: grade,
      section: section || '',
      studentId,
      feeStructureId: structure._id,
      title: structure.name || 'Fee Invoice',
      totalAmount: snapshots.totalAmount,
      paidAmount: 0,
      balanceAmount: snapshots.totalAmount,
      discountAmount: 0,
      discountNote: '',
      lateFeeRuleSnapshot: {
        amount: Number(structure.lateFeeAmount || 0),
        excludeSundays: Boolean(structure.lateFeeExcludeSundays),
        excludeHolidays: Boolean(structure.lateFeeExcludeHolidays),
      },
      lateFeeAmountApplied: 0,
      feeHeadsSnapshot: snapshots.feeHeadsSnapshot,
      installmentsSnapshot: snapshots.installmentsSnapshot,
      status: 'due',
    });
    return invoice;
  } catch {
    // Best-effort — a fee-assignment hiccup must never block enrollment/promotion.
    return null;
  }
};

module.exports = {
  recomputeInvoiceStatus,
  resolveSchoolId,
  resolveParentStudents,
  buildPaymentsByInvoice,
  autoAssignFeeStructure,
};
