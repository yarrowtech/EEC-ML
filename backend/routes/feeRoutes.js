const express = require('express');
const mongoose = require('mongoose');
const adminAuth = require('../middleware/adminAuth');
const authParent = require('../middleware/authParent');
const authStudent = require('../middleware/authStudent');
const authAnyUser = require('../middleware/authAnyUser');
const paymentGatewayResolver = require('../middleware/paymentGatewayResolver');

const FeeStructure = require('../models/FeeStructure');
const FeeInvoice = require('../models/FeeInvoice');
const FeePayment = require('../models/FeePayment');
const Payment = require('../models/Payment');
const PaymentAudit = require('../models/PaymentAudit');
const StudentUser = require('../models/StudentUser');
const ParentUser = require('../models/ParentUser');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const AcademicYear = require('../models/AcademicYear');
const School = require('../models/School');
const NotificationService = require('../utils/notificationService');
const { logger } = require('../utils/logger');
const {
  buildRazorpayReceipt,
  createRazorpayOrder,
  verifyRazorpaySignature,
  buildTransactionId,
} = require('../utils/paymentGatewayService');
const { capturePayment } = require('../services/paymentLifecycleService');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');
const { buildInvoiceSnapshotsForStudent } = require('../utils/feeHeadPolicy');

const router = express.Router();

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

const normalizeName = (value) => String(value || '').trim();

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

const buildPaymentsByInvoice = (payments = []) => {
  return payments.reduce((acc, payment) => {
    const key = String(payment.invoiceId || '');
    if (!key) return acc;
    if (!acc[key]) acc[key] = [];
    acc[key].push(payment);
    return acc;
  }, {});
};

const normalizeFeeHeads = (feeHeads) => {
  if (!Array.isArray(feeHeads)) return [];
  return feeHeads
    .map((head) => ({
      label: String(head?.label || '').trim(),
      amount: Number(head?.amount || 0),
    }))
    .filter((head) => head.label && Number.isFinite(head.amount) && head.amount >= 0);
};

const normalizeInstallments = (installments) => {
  if (!Array.isArray(installments)) return [];
  return installments
    .map((inst) => ({
      label: String(inst?.label || '').trim(),
      amount: Number(inst?.amount || 0),
      dueDate: inst?.dueDate ? new Date(inst.dueDate) : undefined,
    }))
    .filter((inst) => inst.label && Number.isFinite(inst.amount) && inst.amount >= 0);
};

const sumAmounts = (items) =>
  items.reduce((sum, item) => sum + Number(item.amount || 0), 0);

const getEarliestInstallmentDueDate = (installments = []) => {
  if (!Array.isArray(installments) || installments.length === 0) return undefined;
  const dates = installments
    .map((item) => (item?.dueDate ? new Date(item.dueDate) : null))
    .filter((date) => date && !Number.isNaN(date.getTime()))
    .sort((a, b) => a.getTime() - b.getTime());
  return dates[0] || undefined;
};

const normalizeLateFeeAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) && amount >= 0 ? amount : 0;
};

const buildCampusFilter = (schoolId, campusId) => {
  const filter = { schoolId };
  if (campusId) {
    filter.campusId = campusId;
  }
  return filter;
};

const fetchCampusStudentIds = async (schoolId, campusId) => {
  if (!campusId) return null;
  const students = await StudentUser.find({ schoolId, campusId })
    .select('_id')
    .lean();
  return students.map((student) => student._id);
};

const ensureClassAccessible = async (schoolId, campusId, classId) => {
  if (!campusId) return true;
  if (!classId || !mongoose.isValidObjectId(classId)) return false;
  const exists = await ClassModel.findOne({ _id: classId, schoolId, campusId })
    .select('_id')
    .lean();
  return Boolean(exists);
};

const requireCampusId = (req, res) => {
  if (!req.campusId) {
    res.status(400).json({ error: 'campusId is required' });
    return false;
  }
  return true;
};

const ensureInvoiceCampusAccess = async ({ invoice, schoolId, campusId }) => {
  if (!campusId) return true;
  const student = await StudentUser.findOne({ _id: invoice.studentId, schoolId })
    .select('campusId')
    .lean();
  return Boolean(student && String(student.campusId || '') === String(campusId));
};

const getOverdueDate = (invoice) => {
  if (invoice?.dueDate) return new Date(invoice.dueDate);
  const installmentDates = Array.isArray(invoice?.installmentsSnapshot)
    ? invoice.installmentsSnapshot
        .map((item) => (item?.dueDate ? new Date(item.dueDate) : null))
        .filter((date) => date && !Number.isNaN(date.getTime()))
    : [];
  if (!installmentDates.length) return null;
  return installmentDates.sort((a, b) => a.getTime() - b.getTime())[0];
};

const shouldAutoApplyLateFee = (invoice) => {
  if (!invoice) return false;
  if (Number(invoice.balanceAmount || 0) <= 0) return false;
  const dueDate = getOverdueDate(invoice);
  if (!dueDate || Number.isNaN(dueDate.getTime())) return false;
  return Date.now() > dueDate.getTime();
};

const startOfDay = (value) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
};

const getOverdueDays = (invoice) => {
  const dueDate = getOverdueDate(invoice);
  const dueStart = startOfDay(dueDate);
  const todayStart = startOfDay(new Date());
  if (!dueStart || !todayStart) return 0;
  const diffMs = todayStart.getTime() - dueStart.getTime();
  if (diffMs <= 0) return 0;
  return Math.floor(diffMs / (1000 * 60 * 60 * 24));
};

const resolveInvoiceLateFeeAmount = async ({ invoice, schoolId, structureCache }) => {
  const fromSnapshot = normalizeLateFeeAmount(invoice?.lateFeeRuleSnapshot?.amount);
  if (fromSnapshot > 0) return fromSnapshot;

  const structureId = String(invoice?.feeStructureId || '');
  if (!structureId || !mongoose.isValidObjectId(structureId)) return 0;

  if (structureCache && structureCache.has(structureId)) {
    return structureCache.get(structureId);
  }

  const structure = await FeeStructure.findOne({ _id: structureId, schoolId })
    .select('lateFeeAmount')
    .lean();
  const amount = normalizeLateFeeAmount(structure?.lateFeeAmount);
  if (structureCache) structureCache.set(structureId, amount);
  return amount;
};

const applyLateFeeToInvoiceIfEligible = async ({ invoice, schoolId, structureCache }) => {
  if (!shouldAutoApplyLateFee(invoice)) return false;
  const perDayLateFeeAmount = await resolveInvoiceLateFeeAmount({ invoice, schoolId, structureCache });
  if (perDayLateFeeAmount <= 0) return false;
  const overdueDays = getOverdueDays(invoice);
  if (overdueDays <= 0) return false;

  const expectedLateFeeTotal = perDayLateFeeAmount * overdueDays;
  const alreadyAppliedLateFee = normalizeLateFeeAmount(invoice.lateFeeAmountApplied);
  const lateFeeDelta = expectedLateFeeTotal - alreadyAppliedLateFee;
  if (lateFeeDelta <= 0) return false;

  invoice.totalAmount = Number(invoice.totalAmount || 0) + lateFeeDelta;
  invoice.lateFeeAmountApplied = alreadyAppliedLateFee + lateFeeDelta;
  invoice.lateFeeAppliedAt = new Date();
  const snapshotHeads = Array.isArray(invoice.feeHeadsSnapshot) ? [...invoice.feeHeadsSnapshot] : [];
  const lateFeeHeadIndex = snapshotHeads.findIndex(
    (item) => String(item?.label || '').trim().toLowerCase() === 'late fee'
  );
  if (lateFeeHeadIndex >= 0) {
    snapshotHeads[lateFeeHeadIndex] = {
      ...snapshotHeads[lateFeeHeadIndex],
      amount: normalizeLateFeeAmount(snapshotHeads[lateFeeHeadIndex].amount) + lateFeeDelta,
    };
  } else {
    snapshotHeads.push({ label: 'Late fee', amount: lateFeeDelta });
  }
  invoice.feeHeadsSnapshot = snapshotHeads;
  recomputeInvoiceStatus(invoice);
  await invoice.save();
  return true;
};

const applyLateFeesForFilter = async ({ schoolId, filter = {} }) => {
  const overdueFilter = {
    ...filter,
    schoolId,
    balanceAmount: { $gt: 0 },
  };

  const overdueInvoices = await FeeInvoice.find(overdueFilter);
  if (!overdueInvoices.length) return 0;

  const structureCache = new Map();
  let appliedCount = 0;
  for (const invoice of overdueInvoices) {
    // eslint-disable-next-line no-await-in-loop
    const applied = await applyLateFeeToInvoiceIfEligible({ invoice, schoolId, structureCache });
    if (applied) appliedCount += 1;
  }
  return appliedCount;
};


// Fee Structures
router.post('/structures', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const {
      name,
      totalAmount,
      academicYearId,
      classId,
      className,
      installments,
      feeHeads,
      board,
      lateFeeAmount,
    } = req.body || {};
    if (!name || !String(name).trim()) {
      return res.status(400).json({ error: 'Structure name is required' });
    }
    if (req.campusId && classId) {
      const classAllowed = await ensureClassAccessible(schoolId, req.campusId, classId);
      if (!classAllowed) {
        return res.status(403).json({ error: 'Class not available for this campus' });
      }
    }
    const normalizedFeeHeads = normalizeFeeHeads(feeHeads);
    const headsTotal = sumAmounts(normalizedFeeHeads);
    const total =
      Number.isFinite(Number(totalAmount)) && Number(totalAmount) >= 0
        ? Number(totalAmount)
        : headsTotal;
    if (!Number.isFinite(total) || total < 0) {
      return res.status(400).json({ error: 'Valid totalAmount is required' });
    }
    const normalizedInstallments = normalizeInstallments(installments);
    const normalizedLateFeeAmount = normalizeLateFeeAmount(lateFeeAmount);

    const created = await FeeStructure.create({
      schoolId,
      academicYearId: academicYearId || undefined,
      classId: classId || undefined,
      className: className ? String(className).trim() : undefined,
      board: board ? String(board).trim() : 'GENERAL',
      name: String(name).trim(),
      totalAmount: total,
      lateFeeAmount: normalizedLateFeeAmount,
      feeHeads: normalizedFeeHeads,
      installments: normalizedInstallments,
    });

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/structures', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const filter = { schoolId };
    let campusClassIds = null;
    if (req.campusId) {
      const classDocs = await ClassModel.find(buildCampusFilter(schoolId, req.campusId))
        .select('_id')
        .lean();
      campusClassIds = classDocs.map((doc) => doc._id);
      if (campusClassIds.length === 0) {
        return res.json([]);
      }
      filter.classId = { $in: campusClassIds };
    }
    if (req.query.classId && mongoose.isValidObjectId(req.query.classId)) {
      if (campusClassIds && !campusClassIds.some((id) => String(id) === String(req.query.classId))) {
        return res.json([]);
      }
      filter.classId = req.query.classId;
    }
    if (req.query.className) {
      filter.className = String(req.query.className).trim();
    }
    const items = await FeeStructure.find(filter).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/admin/structures/analytics', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const filter = { schoolId };
    let campusClassIds = null;
    if (req.campusId) {
      const classDocs = await ClassModel.find(buildCampusFilter(schoolId, req.campusId))
        .select('_id')
        .lean();
      campusClassIds = classDocs.map((doc) => doc._id);
      if (campusClassIds.length === 0) {
        return res.json({
          count: 0,
          totalValue: 0,
          averageValue: 0,
          classesCovered: 0,
          lastUpdated: null,
        });
      }
      filter.classId = { $in: campusClassIds };
    }

    if (req.query.classId && mongoose.isValidObjectId(req.query.classId)) {
      if (campusClassIds && !campusClassIds.some((id) => String(id) === String(req.query.classId))) {
        return res.json({
          count: 0,
          totalValue: 0,
          averageValue: 0,
          classesCovered: 0,
          lastUpdated: null,
        });
      }
      filter.classId = req.query.classId;
    }

    if (req.query.academicYearId && mongoose.isValidObjectId(req.query.academicYearId)) {
      filter.academicYearId = req.query.academicYearId;
    }

    if (req.query.board) {
      filter.board = String(req.query.board).trim().toUpperCase();
    }

    const result = await FeeStructure.aggregate([
      { $match: filter },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          totalValue: { $sum: { $ifNull: ['$totalAmount', 0] } },
          classIds: { $addToSet: '$classId' },
          lastUpdated: { $max: '$updatedAt' },
        },
      },
    ]);

    const row = result[0] || {};
    const count = Number(row.count || 0);
    const totalValue = Math.round(Number(row.totalValue || 0));
    const classesCovered = Array.isArray(row.classIds)
      ? row.classIds.filter((id) => Boolean(id)).length
      : 0;

    res.json({
      count,
      totalValue,
      averageValue: count > 0 ? Math.round(totalValue / count) : 0,
      classesCovered,
      lastUpdated: row.lastUpdated || null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load structure analytics' });
  }
});

router.put('/structures/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const structureId = req.params.id;
    if (!mongoose.isValidObjectId(structureId)) {
      return res.status(400).json({ error: 'Invalid structure id' });
    }

    const existing = await FeeStructure.findOne({ _id: structureId, schoolId });
    if (!existing) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    if (req.campusId) {
      const currentAllowed = await ensureClassAccessible(schoolId, req.campusId, existing.classId);
      if (!currentAllowed) {
        return res.status(403).json({ error: 'Fee structure not available for this campus' });
      }
    }

    const {
      name,
      totalAmount,
      academicYearId,
      classId,
      className,
      installments,
      feeHeads,
      board,
      isActive,
      lateFeeAmount,
    } = req.body || {};

    if (typeof name !== 'undefined' && !String(name).trim()) {
      return res.status(400).json({ error: 'Structure name is required' });
    }

    if (classId && req.campusId) {
      const classAllowed = await ensureClassAccessible(schoolId, req.campusId, classId);
      if (!classAllowed) {
        return res.status(403).json({ error: 'Class not available for this campus' });
      }
    }

    const updates = {};
    if (typeof name !== 'undefined') updates.name = String(name).trim();
    if (typeof board !== 'undefined') updates.board = String(board).trim() || 'GENERAL';
    if (typeof academicYearId !== 'undefined') updates.academicYearId = academicYearId || undefined;
    if (typeof classId !== 'undefined') updates.classId = classId || undefined;
    if (typeof className !== 'undefined') updates.className = className ? String(className).trim() : undefined;
    if (typeof isActive !== 'undefined') updates.isActive = Boolean(isActive);
    if (typeof lateFeeAmount !== 'undefined') {
      updates.lateFeeAmount = normalizeLateFeeAmount(lateFeeAmount);
    }

    let normalizedFeeHeads = null;
    if (typeof feeHeads !== 'undefined') {
      normalizedFeeHeads = normalizeFeeHeads(feeHeads);
      updates.feeHeads = normalizedFeeHeads;
    }

    let normalizedInstallments = null;
    if (typeof installments !== 'undefined') {
      normalizedInstallments = normalizeInstallments(installments);
      updates.installments = normalizedInstallments;
    }

    if (typeof totalAmount !== 'undefined' || normalizedFeeHeads) {
      const headsTotal = normalizedFeeHeads ? sumAmounts(normalizedFeeHeads) : Number(existing.totalAmount || 0);
      const total =
        Number.isFinite(Number(totalAmount)) && Number(totalAmount) >= 0
          ? Number(totalAmount)
          : headsTotal;
      if (!Number.isFinite(total) || total < 0) {
        return res.status(400).json({ error: 'Valid totalAmount is required' });
      }
      updates.totalAmount = total;
    }

    Object.assign(existing, updates);
    await existing.save();

    // Keep assigned student invoices in sync when installment due dates are changed.
    // We update only unpaid/partial invoices so completed fee records remain untouched.
    if (normalizedInstallments !== null) {
      const invoicesToSync = await FeeInvoice.find({
        schoolId,
        feeStructureId: existing._id,
        status: { $in: ['due', 'partial'] },
      });
      const nextDueDate = getEarliestInstallmentDueDate(normalizedInstallments);
      for (const invoice of invoicesToSync) {
        invoice.installmentsSnapshot = normalizedInstallments;
        invoice.dueDate = nextDueDate;
        await invoice.save();
      }
    }

    res.json(existing);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to update structure' });
  }
});

router.delete('/structures/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const structureId = req.params.id;
    if (!mongoose.isValidObjectId(structureId)) {
      return res.status(400).json({ error: 'Invalid structure id' });
    }

    const existing = await FeeStructure.findOne({ _id: structureId, schoolId });
    if (!existing) {
      return res.status(404).json({ error: 'Fee structure not found' });
    }

    if (req.campusId) {
      const currentAllowed = await ensureClassAccessible(schoolId, req.campusId, existing.classId);
      if (!currentAllowed) {
        return res.status(403).json({ error: 'Fee structure not available for this campus' });
      }
    }

    const hasInvoices = await FeeInvoice.exists({ schoolId, feeStructureId: structureId });
    if (hasInvoices) {
      return res.status(400).json({ error: 'Cannot delete structure with invoices' });
    }

    await FeeStructure.deleteOne({ _id: structureId, schoolId });
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to delete structure' });
  }
});

// Fee Invoices
router.post('/invoices', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const {
      studentId,
      feeStructureId,
      title,
      totalAmount,
      dueDate,
      academicYearId,
      classId,
    } = req.body || {};
    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'Valid studentId is required' });
    }

    const student = await StudentUser.findOne({ _id: studentId, schoolId }).lean();
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    if (req.campusId && String(student.campusId || '') !== String(req.campusId)) {
      return res.status(403).json({ error: 'Student not available for this campus' });
    }

    let structure = null;
    if (feeStructureId && mongoose.isValidObjectId(feeStructureId)) {
      structure = await FeeStructure.findOne({ _id: feeStructureId, schoolId }).lean();
    }
    if (structure && req.campusId && structure.classId) {
      const campusClass = await ClassModel.findOne({
        _id: structure.classId,
        schoolId,
        campusId: req.campusId,
      })
        .select('_id')
        .lean();
      if (!campusClass) {
        return res.status(403).json({ error: 'Fee structure not available for this campus' });
      }
    }

    const hasPriorInvoice = student?._id
      ? await FeeInvoice.exists({ schoolId, studentId: student._id })
      : null;
    const structureSnapshots = structure
      ? buildInvoiceSnapshotsForStudent({
          structure,
          hasPriorInvoice: Boolean(hasPriorInvoice),
        })
      : null;
    const resolvedTotal = Number.isFinite(Number(totalAmount))
      ? Number(totalAmount)
      : structureSnapshots?.totalAmount;
    if (!Number.isFinite(resolvedTotal)) {
      return res.status(400).json({ error: 'totalAmount is required' });
    }

    const created = await FeeInvoice.create({
      schoolId,
      academicYearId: academicYearId || structure?.academicYearId,
      classId: classId || structure?.classId,
      className: student?.grade || structure?.className || '',
      section: student?.section || '',
      studentId,
      feeStructureId: structure?._id,
      title: title ? String(title).trim() : structure?.name || 'Fee Invoice',
      totalAmount: resolvedTotal,
      paidAmount: 0,
      balanceAmount: resolvedTotal,
      discountAmount: 0,
      discountNote: '',
      lateFeeRuleSnapshot: {
        amount: normalizeLateFeeAmount(structure?.lateFeeAmount),
      },
      lateFeeAmountApplied: 0,
      feeHeadsSnapshot: structureSnapshots?.feeHeadsSnapshot || [],
      installmentsSnapshot: structureSnapshots?.installmentsSnapshot || [],
      status: 'due',
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    // Create notification if due date is within 7 days
    if (created.dueDate) {
      const daysUntilDue = Math.ceil((new Date(created.dueDate) - new Date()) / (1000 * 60 * 60 * 24));

      if (daysUntilDue <= 7 && daysUntilDue >= 0) {
        try {
          await NotificationService.notifyFeeReminder({
            schoolId,
            campusId: req.campusId || null,
            invoice: created,
            createdBy: req.admin?.id || null
          });
        } catch (notifErr) {
          (req.log || logger).error({ err: notifErr, invoiceId: created._id }, 'Failed to create fee notification');
          // Don't fail the entire request if notification fails
        }
      }
    }

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/invoices', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const filter = { schoolId };
    let campusStudentIds = null;
    if (req.campusId) {
      campusStudentIds = await fetchCampusStudentIds(schoolId, req.campusId);
      if (campusStudentIds.length === 0) {
        return res.json([]);
      }
      filter.studentId = { $in: campusStudentIds };
    }
    if (req.query.studentId && mongoose.isValidObjectId(req.query.studentId)) {
      if (campusStudentIds && !campusStudentIds.some((id) => String(id) === String(req.query.studentId))) {
        return res.json([]);
      }
      filter.studentId = req.query.studentId;
    }
    await applyLateFeesForFilter({ schoolId, filter });
    const items = await FeeInvoice.find(filter).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Payments
router.post('/payments', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const { invoiceId, amount, method, notes, paidOn } = req.body || {};
    if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: 'Valid invoiceId is required' });
    }
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    const hasInvoiceAccess = await ensureInvoiceCampusAccess({
      invoice,
      schoolId,
      campusId: req.campusId,
    });
    if (!hasInvoiceAccess) {
      return res.status(403).json({ error: 'Invoice not available for this campus' });
    }
    await applyLateFeeToInvoiceIfEligible({ invoice, schoolId, structureCache: new Map() });

    const balance = Math.max(
      0,
      Number(invoice.totalAmount || 0) - Number(invoice.discountAmount || 0) - Number(invoice.paidAmount || 0)
    );
    if (paymentAmount > balance) {
      return res.status(400).json({ error: 'Payment amount exceeds balance' });
    }

    invoice.paidAmount = Number(invoice.paidAmount || 0) + paymentAmount;
    recomputeInvoiceStatus(invoice);
    await invoice.save();

    const created = await FeePayment.create({
      schoolId,
      invoiceId: invoice._id,
      studentId: invoice.studentId,
      transactionId: buildTransactionId('ADM'),
      amount: paymentAmount,
      currency: 'INR',
      method: method || 'cash',
      notes: notes ? String(notes).trim() : undefined,
      paidOn: paidOn ? new Date(paidOn) : undefined,
      initiatedByType: 'admin',
      initiatedById: req.admin?.id || null,
      metadata: {
        source: 'admin_manual',
      },
    });

    res.status(201).json({
      success: true,
      message: 'Payment recorded successfully',
      payment: created,
      invoice,
    });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/payments', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const filter = { schoolId };
    let campusStudentIds = null;
    if (req.campusId) {
      campusStudentIds = await fetchCampusStudentIds(schoolId, req.campusId);
      if (campusStudentIds.length === 0) {
        return res.json([]);
      }
      filter.studentId = { $in: campusStudentIds };
    }
    if (req.query.invoiceId && mongoose.isValidObjectId(req.query.invoiceId)) {
      filter.invoiceId = req.query.invoiceId;
    }
    const items = await FeePayment.find(filter).sort({ createdAt: -1 }).lean();
    res.json(items);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/payments/:paymentId/receipt', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  // #swagger.summary = 'Fetch Fees / Payments / Receipt'
  // #swagger.description = 'Fetch a detailed fee payment receipt payload including school branding metadata for PDF generation.'
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const paymentId = req.params.paymentId;
    if (!paymentId || !mongoose.isValidObjectId(paymentId)) {
      return res.status(400).json({ error: 'Valid paymentId is required' });
    }

    const payment = await FeePayment.findOne({ _id: paymentId, schoolId }).lean();
    if (!payment) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const invoice = await FeeInvoice.findOne({ _id: payment.invoiceId, schoolId }).lean();
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found for this payment' });
    }

    const hasInvoiceAccess = await ensureInvoiceCampusAccess({
      invoice,
      schoolId,
      campusId: req.campusId,
    });
    if (!hasInvoiceAccess) {
      return res.status(403).json({ error: 'Payment not available for this campus' });
    }

    const [student, school, academicYear] = await Promise.all([
      StudentUser.findOne({ _id: payment.studentId, schoolId })
        .select(
          'name grade section roll admissionNumber studentCode fatherName motherName guardianName guardianPhone guardianEmail mobile email'
        )
        .lean(),
      School.findById(schoolId)
        .select(
          'name address contactEmail contactPhone officialEmail websiteURL logo campuses'
        )
        .lean(),
      invoice.academicYearId
        ? AcademicYear.findOne({ _id: invoice.academicYearId, schoolId }).select('name startDate endDate').lean()
        : null,
    ]);

    const campusInfo = school?.campuses?.find(
      (campus) =>
        String(campus?._id || '') === String(req.campusId || '') ||
        String(campus?.name || '').toLowerCase() === String(student?.campusName || '').toLowerCase()
    );

    const classSection = [invoice.className || student?.grade || '', invoice.section || student?.section || '']
      .filter(Boolean)
      .join(' - ');
    const notes = [
      'In case of any discrepancy, contact the school fees office within 7 days.',
      'This receipt is valid only after successful realization of payment.',
      'Preserve this receipt for school and audit records.',
    ];

    res.json({
      receipt: {
        paymentId: payment._id,
        transactionId: payment.transactionId || '',
        receiptNo: payment.transactionId || payment.gatewayPaymentId || String(payment._id || ''),
        sid: student?.studentCode || student?.admissionNumber || '',
        date: payment.paidOn || payment.createdAt || new Date(),
        payMode: payment.method || '',
        classSection,
        academicYear: academicYear?.name || '',
        fatherName: student?.fatherName || '',
        motherName: student?.motherName || '',
        guardianName: student?.guardianName || '',
        notes,
        generatedAt: new Date().toISOString(),
      },
      payment,
      invoice,
      student: student || null,
      school: school
        ? {
            name: school.name || '',
            address: campusInfo?.address || school.address || '',
            contactPhone: campusInfo?.contactPhone || school.contactPhone || '',
            contactEmail: school.contactEmail || school.officialEmail || '',
            websiteURL: school.websiteURL || '',
            logoUrl: school.logo?.secure_url || '',
          }
        : null,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load payment receipt' });
  }
});

router.post('/admin/razorpay/order', adminAuth, paymentGatewayResolver, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const { invoiceId, amount, notes } = req.body || {};
    if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: 'Valid invoiceId is required' });
    }

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId }).lean();
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const hasInvoiceAccess = await ensureInvoiceCampusAccess({
      invoice,
      schoolId,
      campusId: req.campusId,
    });
    if (!hasInvoiceAccess) {
      return res.status(403).json({ error: 'Invoice not available for this campus' });
    }
    await applyLateFeesForFilter({ schoolId, filter: { _id: invoiceId } });
    const refreshedInvoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId }).lean();
    if (!refreshedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const balance = Math.max(
      0,
      Number(refreshedInvoice.totalAmount || 0) -
        Number(refreshedInvoice.discountAmount || 0) -
        Number(refreshedInvoice.paidAmount || 0)
    );
    if (balance <= 0) {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const paymentAmount = Number.isFinite(Number(amount)) ? Number(amount) : balance;
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (paymentAmount > balance) {
      return res.status(400).json({ error: 'Payment amount exceeds balance' });
    }

    const amountPaise = Math.round(paymentAmount * 100);
    const receipt = buildRazorpayReceipt('adminfee', invoiceId);
    const { order, keyId } = await createRazorpayOrder({
      credentials: req.paymentGateway,
      amountPaise,
      receipt,
      notes: {
        invoiceId: String(invoiceId),
        studentId: String(refreshedInvoice.studentId),
        source: 'admin',
        note: String(notes || '').trim().slice(0, 120),
      },
    });

    const payment = await Payment.create({
      organizationId: req.paymentGateway.organizationId,
      schoolId,
      studentId: refreshedInvoice.studentId,
      feeId: refreshedInvoice._id,
      amount: paymentAmount,
      providerOrderId: order.id,
      initiatedByType: 'admin',
      initiatedById: req.admin?.id || null,
    });
    await PaymentAudit.create({
      organizationId: req.paymentGateway.organizationId,
      action: 'payment.order_created',
      userId: req.admin?.id || null,
      metadata: { paymentId: payment._id, feeId: refreshedInvoice._id, providerOrderId: order.id, amount: paymentAmount, actorType: 'admin' },
    });

    res.json({
      success: true,
      message: 'Razorpay order created',
      order,
      keyId,
      amount: paymentAmount,
      currency: order.currency || 'INR',
      invoiceId,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to create Razorpay order' });
  }
});

router.post('/admin/razorpay/verify', adminAuth, paymentGatewayResolver, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const {
      invoiceId,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: 'Valid invoiceId is required' });
    }
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing Razorpay payment details' });
    }

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const hasInvoiceAccess = await ensureInvoiceCampusAccess({
      invoice,
      schoolId,
      campusId: req.campusId,
    });
    if (!hasInvoiceAccess) {
      return res.status(403).json({ error: 'Invoice not available for this campus' });
    }
    await applyLateFeeToInvoiceIfEligible({ invoice, schoolId, structureCache: new Map() });

    const isValidSignature = verifyRazorpaySignature({
      keySecret: req.paymentGateway.keySecret,
      orderId,
      paymentId,
      signature,
    });
    if (!isValidSignature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const paymentIntent = await Payment.findOne({
      organizationId: req.paymentGateway.organizationId,
      schoolId,
      feeId: invoice._id,
      providerOrderId: orderId,
    });
    if (!paymentIntent) return res.status(404).json({ error: 'Payment order not found' });

    const captured = await capturePayment({
      payment: paymentIntent,
      providerPaymentId: paymentId,
      providerSignature: signature,
      source: 'admin_callback',
      userId: req.admin?.id || null,
    });
    return res.json({
      success: true,
      message: 'Payment verified and captured',
      payment: captured.receipt,
      invoice: captured.invoice,
    });

  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to verify payment' });
  }
});

// Admin dashboard + CBSE support
router.get('/admin/filters', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const campusId = req.campusId || null;
    const [classDocs, sectionDocs, yearDocs] = await Promise.all([
      ClassModel.find(buildCampusFilter(schoolId, campusId)).sort({ order: 1, name: 1 }).lean(),
      Section.find(buildCampusFilter(schoolId, campusId)).sort({ name: 1 }).lean(),
      AcademicYear.find({ schoolId }).sort({ createdAt: -1 }).lean(),
    ]);

    res.json({
      classes: classDocs.map((cls) => ({
        id: cls._id,
        name: cls.name,
        academicYearId: cls.academicYearId || null,
        order: cls.order || 0,
      })),
      sections: sectionDocs.map((sec) => ({
        id: sec._id,
        name: sec.name,
        classId: sec.classId || null,
      })),
      academicYears: yearDocs.map((year) => ({
        id: year._id,
        name: year.name,
        isActive: Boolean(year.isActive),
        startDate: year.startDate || null,
        endDate: year.endDate || null,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load filters' });
  }
});

router.get('/admin/summary', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const studentFilter = { schoolId };
    if (req.campusId) {
      studentFilter.campusId = req.campusId;
    }
    const students = await StudentUser.find(studentFilter)
      .select('name grade section roll admissionNumber')
      .lean();
    const studentIds = students.map((s) => s._id);
    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    const invoiceFilter = { schoolId };
    if (req.campusId && studentIds.length === 0) {
      return res.json({
        totals: {
          totalOutstanding: 0,
          totalCollected: 0,
          totalInvoiced: 0,
          totalStudents: 0,
          overdueInvoices: 0,
        },
        enrollment: [],
        outstandingSegments: [],
        recentPayments: [],
      });
    }
    if (studentIds.length > 0) {
      invoiceFilter.studentId = { $in: studentIds };
    }
    await applyLateFeesForFilter({ schoolId, filter: invoiceFilter });
    const invoices = await FeeInvoice.find(invoiceFilter).lean();

    const totals = invoices.reduce(
      (acc, inv) => {
        acc.totalInvoiced += Number(inv.totalAmount || 0);
        acc.totalCollected += Number(inv.paidAmount || 0);
        acc.totalOutstanding += Number(inv.balanceAmount || 0);
        return acc;
      },
      {
        totalOutstanding: 0,
        totalCollected: 0,
        totalInvoiced: 0,
        totalStudents: new Set(invoices.map((inv) => String(inv.studentId))).size,
      }
    );

    const today = new Date();
    const overdueInvoices = invoices.filter(
      (inv) => inv.dueDate && new Date(inv.dueDate) < today && Number(inv.balanceAmount || 0) > 0
    ).length;

    const classBuckets = new Map();
    invoices.forEach((inv) => {
      const student = studentMap.get(String(inv.studentId));
      const className = inv.className || student?.grade || 'Unassigned';
      if (!classBuckets.has(className)) {
        classBuckets.set(className, { students: new Set(), outstanding: 0 });
      }
      const bucket = classBuckets.get(className);
      bucket.students.add(String(inv.studentId));
      bucket.outstanding += Number(inv.balanceAmount || 0);
    });

    const enrollment = Array.from(classBuckets.entries()).map(([label, data]) => ({
      label,
      students: data.students.size,
    }));
    const totalEnrollment = enrollment.reduce((sum, row) => sum + row.students, 0) || 1;
    const enrollmentNormalized = enrollment.map((row) => ({
      ...row,
      percentage: Math.round((row.students / totalEnrollment) * 100),
    }));

    const outstandingSegments = Array.from(classBuckets.entries()).map(([label, data]) => ({
      label,
      amount: Math.round(data.outstanding),
    }));
    const totalOutstanding = outstandingSegments.reduce((sum, row) => sum + row.amount, 0) || 1;
    const outstandingNormalized = outstandingSegments.map((row) => ({
      ...row,
      percentage: Math.round((row.amount / totalOutstanding) * 100),
    }));

    const payments = await FeePayment.find(invoiceFilter)
      .sort({ createdAt: -1 })
      .limit(10)
      .lean();
    const recentPayments = payments.map((payment) => {
      const student = studentMap.get(String(payment.studentId));
      return {
        studentName: student?.name || 'Student',
        className: student?.grade || '',
        section: student?.section || '',
        amount: payment.amount,
        paidOn: payment.paidOn || payment.createdAt,
        method: payment.method || 'cash',
        status: 'Paid',
      };
    });

    res.json({
      totals: {
        totalOutstanding: Math.round(totals.totalOutstanding),
        totalCollected: Math.round(totals.totalCollected),
        totalInvoiced: Math.round(totals.totalInvoiced),
        totalStudents: totals.totalStudents,
        overdueInvoices,
      },
      enrollment: enrollmentNormalized,
      outstandingSegments: outstandingNormalized,
      recentPayments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load summary' });
  }
});

router.get('/admin/invoices', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const {
      academicYearId,
      classId,
      className,
      section,
      status,
      search,
      overdue,
      studentId,
    } = req.query || {};

    const studentFilter = { schoolId };
    if (req.campusId) {
      studentFilter.campusId = req.campusId;
    }
    let resolvedClassName = className ? String(className).trim() : '';
    if (classId && mongoose.isValidObjectId(classId)) {
      const classDoc = await ClassModel.findOne({
        _id: classId,
        schoolId,
        ...(req.campusId ? { campusId: req.campusId } : {}),
      })
        .select('name')
        .lean();
      if (!classDoc) {
        return res.json([]);
      }
      if (resolvedClassName && resolvedClassName !== classDoc.name) {
        return res.json([]);
      }
      resolvedClassName = classDoc.name;
    }
    if (resolvedClassName) {
      studentFilter.grade = resolvedClassName;
    }
    if (section) {
      studentFilter.section = String(section).trim();
    }
    if (search) {
      const q = String(search).trim();
      if (mongoose.isValidObjectId(q)) {
        studentFilter._id = q;
      } else {
        const numericRoll = Number(q);
        studentFilter.$or = [
          { name: new RegExp(q, 'i') },
          { admissionNumber: new RegExp(q, 'i') },
          ...(Number.isFinite(numericRoll) ? [{ roll: numericRoll }] : []),
        ];
      }
    }

    let studentIds = null;
    if (studentId && mongoose.isValidObjectId(studentId)) {
      const student = await StudentUser.findOne({
        _id: studentId,
        schoolId,
        ...(req.campusId ? { campusId: req.campusId } : {}),
      })
        .select('name grade section roll admissionNumber')
        .lean();
      if (!student) {
        return res.json([]);
      }
      if (resolvedClassName && String(student.grade || '') !== resolvedClassName) {
        return res.json([]);
      }
      if (section && String(student.section || '') !== String(section).trim()) {
        return res.json([]);
      }
      studentIds = [student._id];
    } else if (req.campusId || className || section || search) {
      const students = await StudentUser.find(studentFilter)
        .select('name grade section roll admissionNumber')
        .lean();
      studentIds = students.map((s) => s._id);
      if (studentIds.length === 0) {
        return res.json([]);
      }
    }

    const invoiceFilter = { schoolId };
    if (studentIds) {
      invoiceFilter.studentId = { $in: studentIds };
    }
    if (academicYearId && mongoose.isValidObjectId(academicYearId)) {
      invoiceFilter.academicYearId = academicYearId;
    }
    await applyLateFeesForFilter({
      schoolId,
      filter: studentIds ? { studentId: invoiceFilter.studentId } : {},
    });
    if (status) {
      invoiceFilter.status = String(status).trim();
    }
    if (String(overdue || '') === 'true') {
      invoiceFilter.balanceAmount = { $gt: 0 };
      invoiceFilter.dueDate = { $lt: new Date() };
    }

    const invoices = await FeeInvoice.find(invoiceFilter).sort({ createdAt: -1 }).lean();
    const uniqueStudentIds = [...new Set(invoices.map((inv) => String(inv.studentId)))];
    const students = uniqueStudentIds.length
      ? await StudentUser.find({ _id: { $in: uniqueStudentIds } })
          .select('name grade section roll admissionNumber')
          .lean()
      : [];
    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    const payload = invoices.map((inv) => {
      const student = studentMap.get(String(inv.studentId));
      return {
        id: inv._id,
        invoiceId: inv._id,
        studentId: inv.studentId,
        studentName: student?.name || 'Student',
        admissionNumber: student?.admissionNumber || '',
        roll: student?.roll || '',
        classId: inv.classId || null,
        className: inv.className || student?.grade || '',
        section: inv.section || student?.section || '',
        title: inv.title,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balanceAmount: inv.balanceAmount,
        status: inv.status,
        dueDate: inv.dueDate,
        updatedAt: inv.updatedAt,
      };
    });

    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load invoices' });
  }
});

router.post('/admin/invoices/bulk', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const { academicYearId, classId, section, dueDate, title } = req.body || {};
    if (!academicYearId || !mongoose.isValidObjectId(academicYearId)) {
      return res.status(400).json({ error: 'Valid academicYearId is required' });
    }
    if (!classId || !mongoose.isValidObjectId(classId)) {
      return res.status(400).json({ error: 'Valid classId is required' });
    }

    const classAllowed = await ensureClassAccessible(schoolId, req.campusId, classId);
    if (!classAllowed) {
      return res.status(403).json({ error: 'Class not available for this campus' });
    }

    const classDoc = await ClassModel.findOne({ _id: classId, schoolId, campusId: req.campusId })
      .select('name academicYearId')
      .lean();
    if (!classDoc) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const selectedYear = await AcademicYear.findOne({ _id: academicYearId, schoolId })
      .lean();
    if (!selectedYear) {
      return res.status(404).json({ error: 'Academic year not found' });
    }
    if (classDoc.academicYearId && String(classDoc.academicYearId) !== String(selectedYear._id)) {
      return res.status(400).json({ error: 'Selected class is not mapped to the selected academic year' });
    }

    const structure = await FeeStructure.findOne({
      schoolId,
      classId,
      academicYearId: selectedYear._id,
      isActive: true,
    })
      .sort({ createdAt: -1 })
      .lean();
    if (!structure) {
      return res.status(400).json({ error: 'Fee structure not found for selected academic year' });
    }

    const studentFilter = {
      schoolId,
      campusId: req.campusId,
      grade: classDoc.name,
      isArchived: false,
    };
    if (section) {
      studentFilter.section = String(section).trim();
    }
    const students = await StudentUser.find(studentFilter)
      .select('_id name grade section')
      .lean();
    if (students.length === 0) {
      return res.json({ createdCount: 0, skippedCount: 0, totalStudents: 0 });
    }

    const studentIds = students.map((student) => student._id);
    const existingInvoices = await FeeInvoice.find({
      schoolId,
      feeStructureId: structure._id,
      studentId: { $in: studentIds },
    })
      .select('studentId')
      .lean();
    const existingSet = new Set(existingInvoices.map((inv) => String(inv.studentId)));
    const priorInvoices = await FeeInvoice.find({
      schoolId,
      studentId: { $in: studentIds },
    })
      .select('studentId')
      .lean();
    const priorInvoiceSet = new Set(priorInvoices.map((inv) => String(inv.studentId)));

    const invoicesToCreate = students
      .filter((student) => !existingSet.has(String(student._id)))
      .map((student) => {
        const snapshots = buildInvoiceSnapshotsForStudent({
          structure,
          hasPriorInvoice: priorInvoiceSet.has(String(student._id)),
        });
        return {
          schoolId,
          academicYearId: structure.academicYearId || selectedYear._id,
          classId: structure.classId,
          className: student.grade || classDoc.name || structure.className || '',
          section: student.section || '',
          studentId: student._id,
          feeStructureId: structure._id,
          title: title ? String(title).trim() : structure.name || 'Fee Invoice',
          totalAmount: snapshots.totalAmount,
          paidAmount: 0,
          balanceAmount: snapshots.totalAmount,
          discountAmount: 0,
          discountNote: '',
          lateFeeRuleSnapshot: {
            amount: normalizeLateFeeAmount(structure?.lateFeeAmount),
          },
          lateFeeAmountApplied: 0,
          feeHeadsSnapshot: snapshots.feeHeadsSnapshot,
          installmentsSnapshot: snapshots.installmentsSnapshot,
          status: 'due',
          dueDate: dueDate ? new Date(dueDate) : undefined,
        };
      });

    if (invoicesToCreate.length > 0) {
      await FeeInvoice.insertMany(invoicesToCreate);
    }

    res.json({
      createdCount: invoicesToCreate.length,
      skippedCount: students.length - invoicesToCreate.length,
      totalStudents: students.length,
      structureId: structure._id,
      className: classDoc.name,
      section: section || '',
      academicYearId: selectedYear._id,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to generate invoices' });
  }
});

router.get('/admin/invoices/:id', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const invoiceId = req.params.id;
    if (!mongoose.isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: 'Invalid invoiceId' });
    }

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId }).lean();
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    await applyLateFeesForFilter({ schoolId, filter: { _id: invoiceId } });
    const refreshedInvoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId }).lean();
    if (!refreshedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const student = await StudentUser.findOne({ _id: refreshedInvoice.studentId, schoolId })
      .select('name grade section roll admissionNumber guardianName guardianPhone guardianEmail mobile email campusId')
      .lean();
    if (req.campusId && (!student || String(student.campusId || '') !== String(req.campusId))) {
      return res.status(403).json({ error: 'Invoice not available for this campus' });
    }

    const payments = await FeePayment.find({ schoolId, invoiceId })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      invoice: refreshedInvoice,
      student,
      payments,
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load invoice detail' });
  }
});

router.post('/admin/discount', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;
    const { invoiceId, amount, note } = req.body || {};
    if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: 'Valid invoiceId is required' });
    }
    const discountAmount = Number(amount);
    if (!Number.isFinite(discountAmount) || discountAmount < 0) {
      return res.status(400).json({ error: 'Valid discount amount is required' });
    }

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }
    await applyLateFeeToInvoiceIfEligible({ invoice, schoolId, structureCache: new Map() });
    if (discountAmount > Number(invoice.totalAmount || 0)) {
      return res.status(400).json({ error: 'Discount cannot exceed total amount' });
    }

    invoice.discountAmount = discountAmount;
    invoice.discountNote = String(note || '').trim();
    recomputeInvoiceStatus(invoice);
    await invoice.save();

    res.json({ invoice });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to apply discount' });
  }
});

// Parent fees (view + pay)
router.get('/parent/children', authParent, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const parent = await ParentUser.findById(req.user.id)
      .select('childrenIds children schoolId campusId')
      .lean();
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    const campusId = parent.campusId || req.campusId || null;
    const students = await resolveParentStudents({ parent, schoolId, campusId });
    const linkedStudents = students.map((student) => ({
      id: student._id,
      name: student.name || 'Student',
      studentCode: student.studentCode || '',
      username: student.username || '',
      roll: student.roll || null,
      admissionNumber: student.admissionNumber || '',
      grade: student.grade || '',
      section: student.section || '',
      linked: true,
    }));

    if (linkedStudents.length > 0) {
      return res.json({ children: linkedStudents });
    }

    const fallbackNames = Array.isArray(parent.children)
      ? parent.children.map(normalizeName).filter(Boolean)
      : [];
    const fallbackChildren = fallbackNames.map((name) => ({
      id: null,
      name,
      grade: '',
      section: '',
      linked: false,
    }));

    return res.json({ children: fallbackChildren });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load children' });
  }
});

router.get('/parent/invoices', authParent, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const parent = await ParentUser.findById(req.user.id)
      .select('childrenIds children schoolId campusId')
      .lean();
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    const { studentId } = req.query || {};
    if (!studentId || !mongoose.isValidObjectId(studentId)) {
      return res.status(400).json({ error: 'Valid studentId is required' });
    }

    const campusId = parent.campusId || req.campusId || null;
    const students = await resolveParentStudents({ parent, schoolId, campusId });
    const student = students.find((item) => String(item._id) === String(studentId));
    if (!student) {
      return res.status(403).json({ error: 'Student not linked to this parent' });
    }

    await applyLateFeesForFilter({ schoolId, filter: { studentId } });
    const refreshedInvoices = await FeeInvoice.find({
      schoolId,
      studentId,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (refreshedInvoices.length === 0) {
      return res.json({ student, invoices: [], paymentsByInvoice: {} });
    }

    const invoiceIds = refreshedInvoices.map((invoice) => invoice._id);
    const payments = await FeePayment.find({
      schoolId,
      invoiceId: { $in: invoiceIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      student,
      invoices: refreshedInvoices,
      paymentsByInvoice: buildPaymentsByInvoice(payments),
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load invoices' });
  }
});

router.post('/parent/razorpay/order', authParent, paymentGatewayResolver, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const parent = await ParentUser.findById(req.user.id)
      .select('childrenIds children schoolId campusId')
      .lean();
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    const { invoiceId, amount } = req.body || {};
    if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: 'Valid invoiceId is required' });
    }

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId }).lean();
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const campusId = parent.campusId || req.campusId || null;
    const students = await resolveParentStudents({ parent, schoolId, campusId });
    const isLinkedStudent = students.some((item) => String(item._id) === String(invoice.studentId));
    if (!isLinkedStudent) {
      return res.status(403).json({ error: 'Student not linked to this parent' });
    }
    await applyLateFeesForFilter({ schoolId, filter: { _id: invoiceId } });
    const refreshedInvoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId }).lean();
    if (!refreshedInvoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const balance = Math.max(
      0,
      Number(refreshedInvoice.totalAmount || 0) - Number(refreshedInvoice.discountAmount || 0) - Number(refreshedInvoice.paidAmount || 0)
    );
    if (balance <= 0) {
      return res.status(400).json({ error: 'Invoice is already paid' });
    }

    const paymentAmount = Number.isFinite(Number(amount)) ? Number(amount) : balance;
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid amount is required' });
    }
    if (paymentAmount > balance) {
      return res.status(400).json({ error: 'Payment amount exceeds balance' });
    }

    const amountPaise = Math.round(paymentAmount * 100);
    const receipt = buildRazorpayReceipt('parentfee', invoiceId);
    const { order, keyId } = await createRazorpayOrder({
      credentials: req.paymentGateway,
      amountPaise,
      receipt,
      notes: {
        invoiceId: String(invoiceId),
        studentId: String(refreshedInvoice.studentId),
      },
    });

    const payment = await Payment.create({
      organizationId: req.paymentGateway.organizationId,
      schoolId,
      studentId: refreshedInvoice.studentId,
      feeId: refreshedInvoice._id,
      amount: paymentAmount,
      providerOrderId: order.id,
      initiatedByType: 'parent',
      initiatedById: parent._id,
    });
    await PaymentAudit.create({
      organizationId: req.paymentGateway.organizationId,
      action: 'payment.order_created',
      userId: parent._id,
      metadata: { paymentId: payment._id, feeId: refreshedInvoice._id, providerOrderId: order.id, amount: paymentAmount, actorType: 'parent' },
    });

    res.json({
      success: true,
      message: 'Razorpay order created',
      order,
      keyId,
      amount: paymentAmount,
      currency: order.currency || 'INR',
      invoiceId,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to create Razorpay order' });
  }
});

router.post('/parent/razorpay/verify', authParent, paymentGatewayResolver, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const parent = await ParentUser.findById(req.user.id)
      .select('childrenIds children schoolId campusId')
      .lean();
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    const {
      invoiceId,
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};

    if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: 'Valid invoiceId is required' });
    }
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing Razorpay payment details' });
    }

    const invoice = await FeeInvoice.findOne({ _id: invoiceId, schoolId });
    if (!invoice) {
      return res.status(404).json({ error: 'Invoice not found' });
    }

    const campusId = parent.campusId || req.campusId || null;
    const students = await resolveParentStudents({ parent, schoolId, campusId });
    const isLinkedStudent = students.some((item) => String(item._id) === String(invoice.studentId));
    if (!isLinkedStudent) {
      return res.status(403).json({ error: 'Student not linked to this parent' });
    }
    await applyLateFeeToInvoiceIfEligible({ invoice, schoolId, structureCache: new Map() });

    const isValidSignature = verifyRazorpaySignature({
      keySecret: req.paymentGateway.keySecret,
      orderId,
      paymentId,
      signature,
    });
    if (!isValidSignature) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }

    const paymentIntent = await Payment.findOne({
      organizationId: req.paymentGateway.organizationId,
      schoolId,
      feeId: invoice._id,
      providerOrderId: orderId,
    });
    if (!paymentIntent) return res.status(404).json({ error: 'Payment order not found' });

    const captured = await capturePayment({
      payment: paymentIntent,
      providerPaymentId: paymentId,
      providerSignature: signature,
      source: 'parent_callback',
      userId: parent._id,
    });
    return res.json({
      success: true,
      message: 'Payment verified and captured',
      payment: captured.receipt,
      invoice: captured.invoice,
    });

  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to verify payment' });
  }
});

const authorizeOnlinePayment = async ({ req, invoice, schoolId }) => {
  const actorType = String(req.user?.userType || req.user?.type || '').toLowerCase();
  if (actorType === 'student') {
    return String(invoice.studentId) === String(req.user?.id)
      ? { type: 'student', id: req.user.id }
      : null;
  }
  if (actorType === 'parent') {
    const parent = await ParentUser.findOne({ _id: req.user?.id, schoolId })
      .select('childrenIds children schoolId campusId')
      .lean();
    if (!parent) return null;
    const students = await resolveParentStudents({
      parent,
      schoolId,
      campusId: parent.campusId || req.campusId || null,
    });
    return students.some((student) => String(student._id) === String(invoice.studentId))
      ? { type: 'parent', id: parent._id }
      : null;
  }
  if (actorType === 'admin') {
    const allowed = await ensureInvoiceCampusAccess({ invoice, schoolId, campusId: req.campusId });
    return allowed ? { type: 'admin', id: req.user?.id || null } : null;
  }
  return null;
};

// Tenant-neutral checkout URL used by both student and parent portals.
router.post('/:id/pay', authAnyUser, paymentGatewayResolver, async (req, res) => {
  try {
    const feeId = req.params.id;
    if (!mongoose.isValidObjectId(feeId)) return res.status(400).json({ error: 'Valid fee id is required' });
    const schoolId = req.schoolId || req.paymentGateway.schoolId;
    if (!schoolId || String(schoolId) !== String(req.paymentGateway.schoolId)) {
      return res.status(403).json({ error: 'School does not belong to this organization' });
    }
    await applyLateFeesForFilter({ schoolId, filter: { _id: feeId } });
    const invoice = await FeeInvoice.findOne({ _id: feeId, schoolId }).lean();
    if (!invoice) return res.status(404).json({ error: 'Fee invoice not found' });
    const actor = await authorizeOnlinePayment({ req, invoice, schoolId });
    if (!actor) return res.status(403).json({ error: 'You cannot pay this fee invoice' });

    const balance = Math.max(0, Number(invoice.totalAmount || 0)
      - Number(invoice.discountAmount || 0) - Number(invoice.paidAmount || 0));
    const amount = req.body?.amount === undefined ? balance : Number(req.body.amount);
    if (!Number.isFinite(amount) || amount < 1 || amount > balance) {
      return res.status(400).json({ error: 'Payment amount must be between INR 1 and the invoice balance' });
    }
    const amountPaise = Math.round(amount * 100);
    const { order, keyId } = await createRazorpayOrder({
      credentials: req.paymentGateway,
      amountPaise,
      receipt: buildRazorpayReceipt('fee', feeId),
      notes: { feeId: String(feeId), studentId: String(invoice.studentId) },
    });
    const payment = await Payment.create({
      organizationId: req.paymentGateway.organizationId,
      schoolId,
      studentId: invoice.studentId,
      feeId: invoice._id,
      amount,
      providerOrderId: order.id,
      initiatedByType: actor.type,
      initiatedById: actor.id,
    });
    await PaymentAudit.create({
      organizationId: req.paymentGateway.organizationId,
      action: 'payment.order_created',
      userId: actor.id,
      metadata: {
        paymentId: payment._id,
        feeId: invoice._id,
        providerOrderId: order.id,
        amount,
        actorType: actor.type,
      },
    });
    return res.status(201).json({
      orderId: order.id,
      keyId,
      amount: order.amount,
      amountRupees: amount,
      currency: order.currency || 'INR',
      order,
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Unable to create payment order' });
  }
});

router.post('/payments/razorpay/verify', authAnyUser, paymentGatewayResolver, async (req, res) => {
  try {
    const {
      razorpay_order_id: orderId,
      razorpay_payment_id: paymentId,
      razorpay_signature: signature,
    } = req.body || {};
    if (!orderId || !paymentId || !signature) {
      return res.status(400).json({ error: 'Missing Razorpay payment details' });
    }
    if (!verifyRazorpaySignature({ keySecret: req.paymentGateway.keySecret, orderId, paymentId, signature })) {
      return res.status(400).json({ error: 'Invalid payment signature' });
    }
    const payment = await Payment.findOne({
      organizationId: req.paymentGateway.organizationId,
      schoolId: req.schoolId || req.paymentGateway.schoolId,
      providerOrderId: orderId,
    });
    if (!payment) return res.status(404).json({ error: 'Payment order not found' });
    const invoice = await FeeInvoice.findOne({ _id: payment.feeId, schoolId: payment.schoolId }).lean();
    const actor = invoice ? await authorizeOnlinePayment({ req, invoice, schoolId: payment.schoolId }) : null;
    if (!actor) return res.status(403).json({ error: 'You cannot verify this payment' });
    const captured = await capturePayment({
      payment,
      providerPaymentId: paymentId,
      providerSignature: signature,
      source: `${actor.type}_callback`,
      userId: actor.id,
    });
    return res.json({ success: true, payment: captured.receipt, invoice: captured.invoice });
  } catch (error) {
    return res.status(error.statusCode || 400).json({ error: error.message || 'Unable to verify payment' });
  }
});

// Student fees
router.get('/student/invoices', authStudent, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    logStudentPortalEvent(req, {
      feature: 'fees',
      action: 'fee_invoices.fetch',
      targetType: 'student',
      targetId: req.user?.id,
    });
    const schoolId = req.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

    const studentId = req.user.id;
    await applyLateFeesForFilter({ schoolId, filter: { studentId } });
    const refreshedInvoices = await FeeInvoice.find({
      schoolId,
      studentId,
    })
      .sort({ createdAt: -1 })
      .lean();

    if (refreshedInvoices.length === 0) {
      logStudentPortalEvent(req, {
        feature: 'fees',
        action: 'fee_invoices.fetch',
        outcome: 'success',
        statusCode: 200,
        targetType: 'student',
        targetId: studentId,
        resultCount: 0,
      });
      return res.json({ invoices: [], paymentsByInvoice: {} });
    }

    const invoiceIds = refreshedInvoices.map((invoice) => invoice._id);
    const payments = await FeePayment.find({
      schoolId,
      invoiceId: { $in: invoiceIds },
    })
      .sort({ createdAt: -1 })
      .lean();

    res.json({
      invoices: refreshedInvoices,
      paymentsByInvoice: buildPaymentsByInvoice(payments),
    });
    logStudentPortalEvent(req, {
      feature: 'fees',
      action: 'fee_invoices.fetch',
      outcome: 'success',
      statusCode: 200,
      targetType: 'student',
      targetId: studentId,
      resultCount: refreshedInvoices.length,
    });
  } catch (err) {
    logStudentPortalError(req, {
      feature: 'fees',
      action: 'fee_invoices.fetch',
      statusCode: 500,
      err,
      targetType: 'student',
      targetId: req.user?.id,
    });
    res.status(500).json({ error: err.message || 'Unable to load invoices' });
  }
});

module.exports = router;
