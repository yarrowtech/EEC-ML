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
const { EXITED_STUDENT_STATUSES, ACTIVE_STUDENT_FILTER } = require('../utils/studentStatus');
const ClassModel = require('../models/Class');
const Section = require('../models/Section');
const AcademicYear = require('../models/AcademicYear');
const School = require('../models/School');
const Holiday = require('../models/Holiday');
const NotificationService = require('../utils/notificationService');
const { notifyFeeInvoicesCreated, notifyFeePaymentReceived } = require('../services/schoolCommunication');
const { logger } = require('../utils/logger');
const {
  buildRazorpayReceipt,
  closeRazorpayQrCode,
  createRazorpayOrder,
  createRazorpayQrCode,
  fetchRazorpayQrCode,
  fetchRazorpayQrPayments,
  verifyRazorpaySignature,
  buildTransactionId,
} = require('../utils/paymentGatewayService');
const { capturePayment } = require('../services/paymentLifecycleService');
const { logStudentPortalEvent, logStudentPortalError } = require('../utils/studentPortalLogger');
const { buildInvoiceSnapshotsForStudent } = require('../utils/feeHeadPolicy');
const {
  recomputeInvoiceStatus,
  resolveSchoolId,
  resolveParentStudents,
  buildPaymentsByInvoice,
} = require('../services/feeService');

const router = express.Router();

// Short-lived in-memory cache for /admin/summary — it's a heavy aggregation
// (every active student, every invoice, a FeePayment aggregate, a 500-row
// recent-payments query, and another aggregate for the trend) hit repeatedly
// by both the main admin dashboard and the Fees Dashboard page for the same
// school. Same TTL-Map pattern as the students/teachers directory caches in
// adminUserManagement.js.
// 5 minutes — this aggregation's cost is dominated by data-transfer round trips
// (student/invoice/payment documents pulled from the DB), not CPU, so a longer
// TTL buys a much bigger reduction in how often that transfer happens than it
// costs in staleness for a dashboard summary tile.
const FEE_SUMMARY_TTL_MS = 5 * 60 * 1000;
const feeSummaryCache = new Map(); // key -> { data, expires }
// Filter options (classes/sections/years) + fee structures change rarely; a
// short TTL makes Fees Collection's parallel boot requests near-instant.
const FEE_META_TTL_MS = 2 * 60 * 1000;
const feeMetaCache = new Map(); // key -> { data, expires }
const readFeeMeta = (key) => {
  const hit = feeMetaCache.get(key);
  return hit && hit.expires > Date.now() ? hit.data : null;
};
const writeFeeMeta = (key, data) => feeMetaCache.set(key, { data, expires: Date.now() + FEE_META_TTL_MS });
const feeSummaryCacheKey = (req) => {
  const { academicYearId = '', classId = '', section = '', activeYear = '' } = req.query || {};
  return `${req.schoolId || 'x'}:${req.campusId || 'x'}:${academicYearId}:${classId}:${section}:${activeYear ? 'active' : ''}`;
};

const formatReceiptDateTime = (value) => {
  const date = new Date(value || Date.now());
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
};

// Payments recorded before receipt numbers existed get one assigned the first
// time a receipt is requested, so every receipt (admin + parent) has a number.
const ensurePaymentReceiptNumber = async (payment) => {
  if (!payment || payment.receiptNumber || !payment._id) return payment;
  const receiptNumber = await FeePayment.allocateReceiptNumber(
    payment.schoolId,
    payment.paidOn || payment.createdAt || new Date()
  );
  await FeePayment.updateOne(
    { _id: payment._id, receiptNumber: { $in: [null, ''] } },
    { $set: { receiptNumber } }
  );
  payment.receiptNumber = receiptNumber;
  return payment;
};

const buildReceiptPayload = async ({ payment, invoice, schoolId, campusId = null, parentName = '' }) => {
  await ensurePaymentReceiptNumber(payment);
  const [student, school, academicYear] = await Promise.all([
    StudentUser.findOne({ _id: payment.studentId, schoolId })
      .select('name username grade section roll admissionNumber studentCode fatherName motherName guardianName guardianPhone guardianEmail mobile email academicYear')
      .lean(),
    School.findById(schoolId)
      .select('name address contactEmail contactPhone officialEmail websiteURL logo campuses')
      .lean(),
    invoice.academicYearId
      ? AcademicYear.findOne({ _id: invoice.academicYearId, schoolId }).select('name startDate endDate').lean()
      : null,
  ]);

  const campusInfo = school?.campuses?.find(
    (campus) =>
      String(campus?._id || '') === String(campusId || '') ||
      String(campus?.name || '').toLowerCase() === String(student?.campusName || '').toLowerCase()
  );

  const className = invoice.className || student?.grade || '';
  const section = invoice.section || student?.section || '';
  const classSection = [className, section].filter(Boolean).join(' - ');
  const transactionDate = payment.paidOn || payment.createdAt || new Date();
  const dateObject = new Date(transactionDate);
  const transactionTime = Number.isNaN(dateObject.getTime())
    ? '-'
    : dateObject.toLocaleTimeString('en-IN', {
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      });

  const notes = [
    'In case of any discrepancy, contact the school fees office within 7 days.',
    'This receipt is valid only after successful realization of payment.',
    'Preserve this receipt for school and audit records.',
  ];

  return {
    receipt: {
      paymentId: payment._id,
      transactionId: payment.transactionId || payment.gatewayPaymentId || '',
      receiptNo: payment.receiptNumber || payment.transactionId || payment.gatewayPaymentId || String(payment._id || ''),
      receiptNumber: payment.receiptNumber || '',
      sid: student?.studentCode || student?.admissionNumber || '',
      childName: student?.name || '',
      username: student?.username || '',
      date: transactionDate,
      transactionDate: formatReceiptDateTime(transactionDate),
      transactionTime,
      payMode: payment.method || '',
      className,
      section,
      classSection,
      session: academicYear?.name || student?.academicYear || '',
      parentName: parentName || student?.guardianName || '',
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
  };
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

  const installments = Array.isArray(invoice?.installmentsSnapshot)
    ? invoice.installmentsSnapshot
        .map((item) => ({
          amount: Number(item?.amount || 0),
          dueDate: item?.dueDate ? new Date(item.dueDate) : null,
        }))
        .filter((item) => item.dueDate && !Number.isNaN(item.dueDate.getTime()))
        .sort((a, b) => a.dueDate.getTime() - b.dueDate.getTime())
    : [];
  if (!installments.length) return null;

  // Walk the payment waterfall instead of just taking the earliest
  // installment date: once enough has been paid to cover April + August,
  // the invoice isn't overdue again until December's own due date arrives,
  // even though April's date is long in the past.
  const paid = Number(invoice?.paidAmount || 0);
  let cumulative = 0;
  for (const installment of installments) {
    cumulative += installment.amount;
    if (cumulative > paid + 0.01) {
      return installment.dueDate;
    }
  }
  // Every installment is already covered by payments made so far.
  return null;
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

const toDateKey = (date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

// Expands every Holiday doc's startDate..endDate range for a school/campus
// into a flat set of 'YYYY-MM-DD' keys, so per-day exclusion checks during
// late-fee counting are O(1) lookups instead of a query per invoice.
const fetchHolidayDateSet = async (schoolId, campusId) => {
  const filter = { schoolId };
  if (campusId) filter.campusId = campusId;
  const holidays = await Holiday.find(filter).select('startDate endDate').lean();
  const keys = new Set();
  holidays.forEach((h) => {
    const start = startOfDay(h.startDate);
    const end = startOfDay(h.endDate) || start;
    if (!start) return;
    const cursor = new Date(start);
    // Holiday ranges are school calendar spans, not decades — this loop is
    // always small (days within a single break), never unbounded.
    while (cursor.getTime() <= end.getTime()) {
      keys.add(toDateKey(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }
  });
  return keys;
};

// Counts calendar days strictly between dueStart and todayStart (i.e. days
// the invoice has actually been overdue), skipping Sundays and/or school
// holidays when the structure asked to exclude them.
const getOverdueDays = (invoice, { excludeSundays = false, excludeHolidays = false, holidayDateSet = null } = {}) => {
  const dueDate = getOverdueDate(invoice);
  const dueStart = startOfDay(dueDate);
  const todayStart = startOfDay(new Date());
  if (!dueStart || !todayStart) return 0;
  if (todayStart.getTime() <= dueStart.getTime()) return 0;

  if (!excludeSundays && !excludeHolidays) {
    const diffMs = todayStart.getTime() - dueStart.getTime();
    return Math.floor(diffMs / (1000 * 60 * 60 * 24));
  }

  let count = 0;
  const cursor = new Date(dueStart);
  cursor.setDate(cursor.getDate() + 1);
  while (cursor.getTime() <= todayStart.getTime()) {
    const isSunday = excludeSundays && cursor.getDay() === 0;
    const isHoliday = excludeHolidays && holidayDateSet?.has(toDateKey(cursor));
    if (!isSunday && !isHoliday) count += 1;
    cursor.setDate(cursor.getDate() + 1);
  }
  return count;
};

const resolveInvoiceLateFeeRule = async ({ invoice, schoolId, structureCache }) => {
  const snapshot = invoice?.lateFeeRuleSnapshot;
  const snapshotAmount = normalizeLateFeeAmount(snapshot?.amount);
  if (snapshotAmount > 0) {
    return {
      amount: snapshotAmount,
      excludeSundays: Boolean(snapshot?.excludeSundays),
      excludeHolidays: Boolean(snapshot?.excludeHolidays),
    };
  }

  const structureId = String(invoice?.feeStructureId || '');
  if (!structureId || !mongoose.isValidObjectId(structureId)) {
    return { amount: 0, excludeSundays: false, excludeHolidays: false };
  }

  if (structureCache && structureCache.has(structureId)) {
    return structureCache.get(structureId);
  }

  const structure = await FeeStructure.findOne({ _id: structureId, schoolId })
    .select('lateFeeAmount lateFeeExcludeSundays lateFeeExcludeHolidays')
    .lean();
  const rule = {
    amount: normalizeLateFeeAmount(structure?.lateFeeAmount),
    excludeSundays: Boolean(structure?.lateFeeExcludeSundays),
    excludeHolidays: Boolean(structure?.lateFeeExcludeHolidays),
  };
  if (structureCache) structureCache.set(structureId, rule);
  return rule;
};

const applyLateFeeToInvoiceIfEligible = async ({ invoice, schoolId, structureCache }) => {
  if (!shouldAutoApplyLateFee(invoice)) return false;
  const rule = await resolveInvoiceLateFeeRule({ invoice, schoolId, structureCache });
  if (rule.amount <= 0) return false;
  const holidayDateSet = rule.excludeHolidays ? await fetchHolidayDateSet(schoolId) : null;
  const overdueDays = getOverdueDays(invoice, {
    excludeSundays: rule.excludeSundays,
    excludeHolidays: rule.excludeHolidays,
    holidayDateSet,
  });
  if (overdueDays <= 0) return false;
  const perDayLateFeeAmount = rule.amount;

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

// Same late-fee math as applyLateFeeToInvoiceIfEligible, but applied via a
// single bulkWrite instead of one invoice.save() per overdue invoice — the
// per-invoice loop was doing hundreds of sequential DB round trips on every
// GET /invoices call for schools with a lot of overdue invoices.
const applyLateFeesForFilter = async ({ schoolId, filter = {} }) => {
  const overdueFilter = {
    ...filter,
    schoolId,
    balanceAmount: { $gt: 0 },
  };

  const overdueInvoices = await FeeInvoice.find(overdueFilter).lean();
  if (!overdueInvoices.length) return 0;

  const structureCache = new Map();
  // Fetched lazily and once per batch (not per-invoice) the first time any
  // invoice's rule actually needs holiday exclusion.
  let holidayDateSet = null;
  const bulkOps = [];
  for (const invoice of overdueInvoices) {
    if (!shouldAutoApplyLateFee(invoice)) continue;
    // eslint-disable-next-line no-await-in-loop
    const rule = await resolveInvoiceLateFeeRule({ invoice, schoolId, structureCache });
    if (rule.amount <= 0) continue;
    if (rule.excludeHolidays && !holidayDateSet) {
      // eslint-disable-next-line no-await-in-loop
      holidayDateSet = await fetchHolidayDateSet(schoolId);
    }
    const overdueDays = getOverdueDays(invoice, {
      excludeSundays: rule.excludeSundays,
      excludeHolidays: rule.excludeHolidays,
      holidayDateSet,
    });
    if (overdueDays <= 0) continue;
    const perDayLateFeeAmount = rule.amount;

    const expectedLateFeeTotal = perDayLateFeeAmount * overdueDays;
    const alreadyAppliedLateFee = normalizeLateFeeAmount(invoice.lateFeeAmountApplied);
    const lateFeeDelta = expectedLateFeeTotal - alreadyAppliedLateFee;
    if (lateFeeDelta <= 0) continue;

    const updated = {
      totalAmount: Number(invoice.totalAmount || 0) + lateFeeDelta,
      lateFeeAmountApplied: alreadyAppliedLateFee + lateFeeDelta,
      lateFeeAppliedAt: new Date(),
    };
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
    updated.feeHeadsSnapshot = snapshotHeads;
    const recomputed = { ...invoice, ...updated };
    recomputeInvoiceStatus(recomputed);
    updated.balanceAmount = recomputed.balanceAmount;
    updated.status = recomputed.status;

    bulkOps.push({ updateOne: { filter: { _id: invoice._id }, update: { $set: updated } } });
  }

  if (bulkOps.length) {
    await FeeInvoice.bulkWrite(bulkOps, { ordered: false });
  }
  return bulkOps.length;
};


// Fee Structures
router.post('/structures', adminAuth, async (req, res) => {
  res.on('finish', () => { if (res.statusCode < 400) feeMetaCache.clear(); });
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
      lateFeeExcludeSundays,
      lateFeeExcludeHolidays,
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
      lateFeeExcludeSundays: Boolean(lateFeeExcludeSundays),
      lateFeeExcludeHolidays: Boolean(lateFeeExcludeHolidays),
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
    const structuresKey = `structures:${schoolId}:${req.campusId || 'x'}:${req.query.classId || ''}:${req.query.className || ''}`;
    const cachedStructures = readFeeMeta(structuresKey);
    if (cachedStructures) return res.json(cachedStructures);
    const items = await FeeStructure.find(filter).sort({ createdAt: -1 }).lean();
    writeFeeMeta(structuresKey, items);
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
  res.on('finish', () => { if (res.statusCode < 400) feeMetaCache.clear(); });
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
      lateFeeExcludeSundays,
      lateFeeExcludeHolidays,
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
    if (typeof lateFeeExcludeSundays !== 'undefined') {
      updates.lateFeeExcludeSundays = Boolean(lateFeeExcludeSundays);
    }
    if (typeof lateFeeExcludeHolidays !== 'undefined') {
      updates.lateFeeExcludeHolidays = Boolean(lateFeeExcludeHolidays);
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
      // Don't stamp a top-level invoice.dueDate here — leave it unset so
      // getOverdueDate()'s payment-waterfall logic keeps picking whichever
      // installment isn't covered by payments yet, instead of pinning
      // lateness to the earliest installment regardless of what's been paid.
      for (const invoice of invoicesToSync) {
        invoice.installmentsSnapshot = normalizedInstallments;
        await invoice.save();
      }
    }

    res.json(existing);
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to update structure' });
  }
});

router.delete('/structures/:id', adminAuth, async (req, res) => {
  res.on('finish', () => { if (res.statusCode < 400) feeMetaCache.clear(); });
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

    const linkedInvoices = await FeeInvoice.find({ schoolId, feeStructureId: structureId })
      .select('_id')
      .lean();

    if (linkedInvoices.length > 0) {
      const force = String(req.query.force || '').toLowerCase() === 'true';
      if (!force) {
        return res.status(400).json({ error: 'Cannot delete structure with invoices' });
      }

      // Force delete still refuses to touch an invoice that has real money
      // collected against it — cascading the delete into paid/partial
      // invoices would destroy payment history, which no confirmation dialog
      // should be able to authorize from this endpoint.
      const invoiceIds = linkedInvoices.map((inv) => inv._id);
      const hasPayments = await FeePayment.exists({ schoolId, invoiceId: { $in: invoiceIds } });
      if (hasPayments) {
        return res.status(400).json({
          error: 'Cannot force delete — some invoices for this structure have recorded payments. Refund/void those first.',
        });
      }

      await FeeInvoice.deleteMany({ _id: { $in: invoiceIds }, schoolId });
    }

    await FeeStructure.deleteOne({ _id: structureId, schoolId });
    feeSummaryCache.clear();
    invoicesListCache.clear();
    res.json({ success: true, invoicesDeleted: linkedInvoices.length });
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
        excludeSundays: Boolean(structure?.lateFeeExcludeSundays),
        excludeHolidays: Boolean(structure?.lateFeeExcludeHolidays),
      },
      lateFeeAmountApplied: 0,
      feeHeadsSnapshot: structureSnapshots?.feeHeadsSnapshot || [],
      installmentsSnapshot: structureSnapshots?.installmentsSnapshot || [],
      status: 'due',
      dueDate: dueDate ? new Date(dueDate) : undefined,
    });

    // Student + linked parents: invoice issued (idempotent per invoice).
    notifyFeeInvoicesCreated({
      schoolId, campusId: req.campusId || null, invoices: [created], entityId: created._id, createdBy: req.admin?.id || null,
    }).catch((err) => console.error('Failed to send fee invoice notifications:', err.message));

    res.status(201).json(created);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Short-lived cache for the full invoices list — hit on every Student
// Management refresh (alongside get-students / get-parents) as well as the
// Fees Collection and per-student pages. Data-transfer round trips are the
// dominant cost here (see the /admin/summary cache above), so a small TTL
// makes repeated refreshes fast without noticeably staling the ledger.
const INVOICES_LIST_TTL_MS = 20 * 1000;
const invoicesListCache = new Map(); // key -> { data, expires }
const invoicesListCacheKey = (req) =>
  `${req.schoolId || 'x'}:${req.campusId || 'x'}:${req.query?.studentId || ''}`;

router.get('/invoices', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const cacheKey = invoicesListCacheKey(req);
    const cached = invoicesListCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return res.json(cached.data);
    }

    const filter = { schoolId };
    let campusStudentIds = null;
    if (req.campusId) {
      campusStudentIds = await fetchCampusStudentIds(schoolId, req.campusId);
      if (campusStudentIds.length === 0) {
        invoicesListCache.set(cacheKey, { data: [], expires: Date.now() + INVOICES_LIST_TTL_MS });
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
    invoicesListCache.set(cacheKey, { data: items, expires: Date.now() + INVOICES_LIST_TTL_MS });
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
    const referenceNumber = String(req.body?.referenceNumber || '').trim();
    const bankName = String(req.body?.bankName || '').trim();
    if (!invoiceId || !mongoose.isValidObjectId(invoiceId)) {
      return res.status(400).json({ error: 'Valid invoiceId is required' });
    }
    const paymentAmount = Number(amount);
    if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ error: 'Valid payment amount is required' });
    }
    const resolvedMethod = String(method || 'cash').trim().toLowerCase();
    const REFERENCE_LABEL_BY_METHOD = {
      // cash: receipt number is now system-generated (FeePayment.receiptNumber)
      upi: 'UPI transaction ID',
      bank: 'Bank transaction / UTR number',
      card: 'Card transaction reference',
    };
    const referenceLabel = REFERENCE_LABEL_BY_METHOD[resolvedMethod];
    if (referenceLabel && !referenceNumber) {
      return res.status(400).json({ error: `${referenceLabel} is required for ${resolvedMethod} payments` });
    }
    if (resolvedMethod === 'bank' && !bankName) {
      return res.status(400).json({ error: 'Bank name is required for bank transfer payments' });
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
      method: resolvedMethod,
      referenceNumber: referenceNumber || undefined,
      bankName: resolvedMethod === 'bank' ? bankName : undefined,
      notes: notes ? String(notes).trim() : undefined,
      paidOn: paidOn ? new Date(paidOn) : undefined,
      initiatedByType: 'admin',
      initiatedById: req.admin?.id || null,
      metadata: {
        source: 'admin_manual',
      },
    });
    feeSummaryCache.clear();
    invoicesListCache.clear();
    notifyFeePaymentReceived({ schoolId, campusId: req.campusId || null, payment: created, invoice })
      .catch((err) => console.error('Failed to send fee payment notifications:', err.message));

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

// Fee receipts register — every recorded payment with its receipt number,
// student and payment details. Supports search (receipt no / transaction id /
// student name / admission no), method filter, date range and pagination.
router.get('/admin/receipts', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  // #swagger.summary = 'List fee receipts'
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20));
    const search = String(req.query.search || '').trim();
    const method = String(req.query.method || '').trim().toLowerCase();

    const filter = { schoolId };
    let studentIdScope = null;
    if (req.campusId) {
      studentIdScope = (await fetchCampusStudentIds(schoolId, req.campusId)).map(String);
      if (!studentIdScope.length) {
        return res.json({ items: [], total: 0, page, limit, totals: { amount: 0, count: 0 } });
      }
    }
    if (method) filter.method = method;
    const from = req.query.from ? new Date(req.query.from) : null;
    const to = req.query.to ? new Date(req.query.to) : null;
    if ((from && !Number.isNaN(from.getTime())) || (to && !Number.isNaN(to.getTime()))) {
      filter.paidOn = {};
      if (from && !Number.isNaN(from.getTime())) filter.paidOn.$gte = from;
      if (to && !Number.isNaN(to.getTime())) {
        to.setHours(23, 59, 59, 999);
        filter.paidOn.$lte = to;
      }
    }

    if (search) {
      const safe = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const rx = new RegExp(safe, 'i');
      const matchedStudents = await StudentUser.find({
        schoolId,
        $or: [{ name: rx }, { admissionNumber: rx }, { studentCode: rx }],
      }).select('_id').lean();
      let matchedIds = matchedStudents.map((s) => String(s._id));
      if (studentIdScope) matchedIds = matchedIds.filter((id) => studentIdScope.includes(id));
      filter.$or = [
        { receiptNumber: rx },
        { transactionId: rx },
        { referenceNumber: rx },
        { gatewayPaymentId: rx },
        ...(matchedIds.length ? [{ studentId: { $in: matchedIds.map((id) => new mongoose.Types.ObjectId(id)) } }] : []),
      ];
    }
    if (studentIdScope) filter.studentId = { $in: studentIdScope.map((id) => new mongoose.Types.ObjectId(id)) };

    const [total, totalsAgg, payments] = await Promise.all([
      FeePayment.countDocuments(filter),
      FeePayment.aggregate([
        { $match: { ...filter, schoolId: new mongoose.Types.ObjectId(String(schoolId)) } },
        { $group: { _id: null, amount: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]).catch(() => []),
      FeePayment.find(filter)
        .sort({ paidOn: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
    ]);

    // Backfill numbers for legacy payments on the page being viewed.
    await Promise.all(payments.map((p) => ensurePaymentReceiptNumber(p)));

    const studentIds = [...new Set(payments.map((p) => String(p.studentId)))];
    const invoiceIds = [...new Set(payments.map((p) => String(p.invoiceId)))];
    const [students, invoices] = await Promise.all([
      StudentUser.find({ _id: { $in: studentIds } })
        .select('name grade section admissionNumber studentCode profilePic')
        .lean(),
      FeeInvoice.find({ _id: { $in: invoiceIds } }).select('className section title').lean(),
    ]);
    const studentMap = new Map(students.map((s) => [String(s._id), s]));
    const invoiceMap = new Map(invoices.map((i) => [String(i._id), i]));

    const items = payments.map((p) => {
      const student = studentMap.get(String(p.studentId)) || {};
      const invoice = invoiceMap.get(String(p.invoiceId)) || {};
      return {
        paymentId: p._id,
        invoiceId: p.invoiceId,
        receiptNumber: p.receiptNumber || '',
        studentName: student.name || 'Student',
        admissionNumber: student.admissionNumber || student.studentCode || '',
        profilePic: student.profilePic || '',
        className: invoice.className || student.grade || '',
        section: invoice.section || student.section || '',
        invoiceTitle: invoice.title || '',
        amount: Number(p.amount || 0),
        method: p.method || 'cash',
        gateway: p.gateway || '',
        referenceNumber: p.referenceNumber || '',
        bankName: p.bankName || '',
        transactionId: p.transactionId || '',
        gatewayPaymentId: p.gatewayPaymentId || '',
        gatewayOrderId: p.gatewayOrderId || '',
        paidOn: p.paidOn || p.createdAt,
        notes: p.notes || '',
        initiatedByType: p.initiatedByType || '',
      };
    });

    res.json({
      items,
      total,
      page,
      limit,
      totals: { amount: Number(totalsAgg?.[0]?.amount || 0), count: Number(totalsAgg?.[0]?.count || total) },
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load receipts' });
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

    const payload = await buildReceiptPayload({
      payment,
      invoice,
      schoolId,
      campusId: req.campusId,
    });
    res.json(payload);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load payment receipt' });
  }
});

router.get('/parent/payments/:paymentId/receipt', authParent, async (req, res) => {
  // #swagger.tags = ['Fees']
  // #swagger.summary = 'Fetch Parent Fees / Payments / Receipt'
  // #swagger.description = 'Fetch a detailed fee payment receipt payload for parent portal PDF generation.'
  try {
    const parent = await ParentUser.findById(req.user.id)
      .select('name childrenIds children schoolId campusId')
      .lean();
    if (!parent) {
      return res.status(404).json({ error: 'Parent not found' });
    }

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) {
      return res.status(400).json({ error: 'schoolId is required' });
    }

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

    const campusId = parent.campusId || req.campusId || null;
    const students = await resolveParentStudents({ parent, schoolId, campusId });
    const hasAccess = students.some((item) => String(item._id) === String(invoice.studentId));
    if (!hasAccess) {
      return res.status(403).json({ error: 'Payment not linked to this parent' });
    }

    const payload = await buildReceiptPayload({
      payment,
      invoice,
      schoolId,
      campusId,
      parentName: parent.name || '',
    });
    res.json(payload);
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
    feeSummaryCache.clear();
    invoicesListCache.clear();
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

// Creates a single-use, fixed-amount UPI QR code for a "second screen" /
// kiosk-style display: admin picks the amount, the QR is shown to the payer
// on its own screen, and the poll endpoint below auto-records the payment
// the moment Razorpay confirms it — no manual entry needed.
router.post('/admin/razorpay/qr', adminAuth, paymentGatewayResolver, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const { invoiceId, amount } = req.body || {};
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
    const closeBy = Math.floor(Date.now() / 1000) + 30 * 60; // QR self-expires after 30 minutes
    const qrCode = await createRazorpayQrCode({
      credentials: req.paymentGateway,
      amountPaise,
      closeBy,
      name: `Fee payment ${String(refreshedInvoice._id).slice(-6)}`,
      notes: {
        invoiceId: String(invoiceId),
        studentId: String(refreshedInvoice.studentId),
        source: 'admin_qr',
      },
    });

    const payment = await Payment.create({
      organizationId: req.paymentGateway.organizationId,
      schoolId,
      studentId: refreshedInvoice.studentId,
      feeId: refreshedInvoice._id,
      amount: paymentAmount,
      providerOrderId: qrCode.id,
      initiatedByType: 'admin',
      initiatedById: req.admin?.id || null,
    });
    await PaymentAudit.create({
      organizationId: req.paymentGateway.organizationId,
      action: 'payment.qr_created',
      userId: req.admin?.id || null,
      metadata: { paymentId: payment._id, feeId: refreshedInvoice._id, qrCodeId: qrCode.id, amount: paymentAmount },
    });

    res.json({
      success: true,
      qrCodeId: qrCode.id,
      imageUrl: qrCode.image_url,
      amount: paymentAmount,
      expiresAt: new Date(closeBy * 1000).toISOString(),
      invoiceId,
    });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to create QR code' });
  }
});

// Polled by both the admin's screen and the second-screen QR display. Cheap
// once captured (reads our own DB); only calls out to Razorpay while pending.
router.get('/admin/razorpay/qr/:qrCodeId/status', adminAuth, paymentGatewayResolver, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { qrCodeId } = req.params;

    const paymentIntent = await Payment.findOne({
      organizationId: req.paymentGateway.organizationId,
      schoolId,
      providerOrderId: qrCodeId,
    });
    if (!paymentIntent) {
      return res.status(404).json({ error: 'QR payment session not found' });
    }

    if (paymentIntent.status === 'captured') {
      const receipt = await FeePayment.findOne({
        organizationId: req.paymentGateway.organizationId,
        schoolId,
        gatewayOrderId: qrCodeId,
      }).lean();
      return res.json({ status: 'captured', payment: receipt });
    }

    const qrPayments = await fetchRazorpayQrPayments({ credentials: req.paymentGateway, qrCodeId });
    const capturedPayment = (qrPayments?.items || []).find((item) => item.status === 'captured');
    if (capturedPayment) {
      const captured = await capturePayment({
        payment: paymentIntent,
        providerPaymentId: capturedPayment.id,
        source: 'admin_qr_poll',
        userId: req.admin?.id || null,
      });
      feeSummaryCache.clear();
    invoicesListCache.clear();
      return res.json({ status: 'captured', payment: captured.receipt });
    }

    const qrCode = await fetchRazorpayQrCode({ credentials: req.paymentGateway, qrCodeId });
    if (qrCode.status === 'closed' && qrCode.close_reason !== 'completed') {
      return res.json({ status: 'expired' });
    }
    return res.json({ status: 'pending' });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to check QR status' });
  }
});

router.post('/admin/razorpay/qr/:qrCodeId/cancel', adminAuth, paymentGatewayResolver, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    const { qrCodeId } = req.params;
    const paymentIntent = await Payment.findOne({
      organizationId: req.paymentGateway.organizationId,
      schoolId,
      providerOrderId: qrCodeId,
      status: { $ne: 'captured' },
    });
    if (paymentIntent) {
      await closeRazorpayQrCode({ credentials: req.paymentGateway, qrCodeId }).catch(() => {});
    }
    res.json({ success: true });
  } catch (err) {
    res.status(400).json({ error: err.message || 'Unable to cancel QR code' });
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
    const metaKey = `filters:${schoolId}:${campusId || 'x'}`;
    const cachedFilters = readFeeMeta(metaKey);
    if (cachedFilters) return res.json(cachedFilters);
    const [classDocs, sectionDocs, yearDocs] = await Promise.all([
      ClassModel.find(buildCampusFilter(schoolId, campusId)).sort({ order: 1, name: 1 }).lean(),
      Section.find(buildCampusFilter(schoolId, campusId)).sort({ name: 1 }).lean(),
      AcademicYear.find({ schoolId }).sort({ createdAt: -1 }).lean(),
    ]);

    const filtersPayload = {
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
    };
    writeFeeMeta(metaKey, filtersPayload);
    res.json(filtersPayload);
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

    // With ?activeYear=1 the cache key carries the resolved active year id, so
    // switching the active session never serves the previous session's summary.
    const activeYearForKey = req.query.activeYear
      ? await AcademicYear.findOne({ schoolId, isActive: true }).select('_id').lean()
      : null;
    const cacheKey = `${feeSummaryCacheKey(req)}:${activeYearForKey?._id || ''}`;
    const cached = feeSummaryCache.get(cacheKey);
    if (cached && cached.expires > Date.now()) {
      return res.json(cached.data);
    }
    const { academicYearId, classId, section } = req.query || {};

    // Only students still on the roll — archived / left / expelled students keep
    // their historical invoices but must not inflate the dashboard counts, the
    // same rule the rest of the admin portal applies.
    const studentFilter = {
      schoolId,
      isArchived: { $ne: true },
      status: { $nin: EXITED_STUDENT_STATUSES },
    };
    if (req.campusId) {
      studentFilter.campusId = req.campusId;
    }
    if (classId && mongoose.isValidObjectId(classId)) {
      const classDoc = await ClassModel.findById(classId).select('name').lean();
      if (classDoc) {
        studentFilter.grade = classDoc.name;
      }
    }
    if (section) {
      studentFilter.section = String(section).trim();
    }
    // Session scoping is applied to the invoices (academicYearId) below, not to
    // the student record: a student's academicYear holds a name, not an id.
    const students = await StudentUser.find(studentFilter)
      .select('name grade section roll admissionNumber username academicYear studentCode')
      .lean();
    const studentIds = students.map((s) => s._id);
    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    const invoiceFilter = { schoolId };
    let scopedAcademicYearName = '';
    if (req.campusId && studentIds.length === 0) {
      const emptySummary = {
        totals: {
          totalOutstanding: 0,
          totalCollected: 0,
          totalInvoiced: 0,
          totalStudents: 0,
          overdueInvoices: 0,
          overdueAmount: 0,
        },
        monthlyTrend: [],
        enrollment: [],
        outstandingSegments: [],
        classStudents: {},
        recentPayments: [],
      };
      feeSummaryCache.set(cacheKey, { data: emptySummary, expires: Date.now() + FEE_SUMMARY_TTL_MS });
      return res.json(emptySummary);
    }
    // Always scope to current (non-left) students — with no matching students
    // this matches nothing rather than falling back to every invoice.
    invoiceFilter.studentId = { $in: studentIds };
    if (academicYearId && mongoose.isValidObjectId(academicYearId)) {
      invoiceFilter.academicYearId = academicYearId;
    } else if (req.query.activeYear) {
      // ?activeYear=1 → only the school's current active academic year.
      const activeYearDoc = await AcademicYear.findOne({ schoolId, isActive: true }).select('_id name').lean();
      scopedAcademicYearName = activeYearDoc?.name || '';
      invoiceFilter.academicYearId = activeYearDoc?._id || null;
    }
    // Unlike the invoices list/detail routes, this is a high-frequency, cached
    // dashboard read — recomputing late fees for every overdue invoice here
    // (a full sequential pass, one query per distinct fee structure) is what
    // made the cache-miss request take 20-30s on schools with a lot of overdue
    // invoices. Late fees are kept current by the /invoices and per-student
    // routes below, which every admin visit to the Fees Collection page hits,
    // so this dashboard summary can safely read the latest already-applied
    // figures instead of recomputing them on every load.
    const invoices = await FeeInvoice.find(invoiceFilter).lean();

    // "Amount collected" is derived from the payment ledger (FeePayment), not the
    // denormalised invoice.paidAmount / balanceAmount, so a stale or un-synced
    // invoice can't understate collections or overstate dues. Every tile below
    // is computed from the same per-invoice paid figure so they stay consistent
    // (invoiced − discount = collected + outstanding).
    const invoiceIds = invoices.map((inv) => inv._id);
    const paidAgg = invoiceIds.length
      ? await FeePayment.aggregate([
          { $match: { invoiceId: { $in: invoiceIds } } },
          { $group: { _id: '$invoiceId', paid: { $sum: '$amount' } } },
        ])
      : [];
    const paidByInvoice = new Map(paidAgg.map((row) => [String(row._id), Number(row.paid || 0)]));

    const today = new Date();
    const totals = { totalOutstanding: 0, totalCollected: 0, totalInvoiced: 0, totalStudents: 0, overdueAmount: 0 };
    const studentsWithInvoice = new Set();
    let overdueInvoices = 0;

    // 6-month collected-vs-due trend (shared by the main admin dashboard so the
    // two pages can't disagree).
    const monthKeyOf = (v) => {
      if (!v) return '';
      const d = v instanceof Date ? v : new Date(v);
      return Number.isNaN(d.getTime())
        ? ''
        : `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    };
    const trendBuckets = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(today.getFullYear(), today.getMonth() - i, 1);
      trendBuckets.push({
        key: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
        month: d.toLocaleString('en-US', { month: 'short' }),
        collected: 0,
        due: 0,
        overdue: 0,
      });
    }
    const trendMap = new Map(trendBuckets.map((b) => [b.key, b]));

    const classBuckets = new Map();
    const classStudentBuckets = new Map(); // className -> Map(studentId -> { total, paid, balance })
    invoices.forEach((inv) => {
      const gross = Number(inv.totalAmount || 0);
      const discount = Number(inv.discountAmount || 0);
      const payable = Math.max(0, gross - discount);
      const paid = Math.min(paidByInvoice.get(String(inv._id)) || 0, payable);
      const balance = Math.max(0, payable - paid);

      totals.totalInvoiced += gross;
      totals.totalCollected += paid;
      totals.totalOutstanding += balance;
      studentsWithInvoice.add(String(inv.studentId));
      if (inv.dueDate && new Date(inv.dueDate) < today && balance > 0) {
        overdueInvoices += 1;
        totals.overdueAmount += balance;
      }


      const student = studentMap.get(String(inv.studentId));
      const className = inv.className || student?.grade || 'Unassigned';
      if (!classBuckets.has(className)) {
        classBuckets.set(className, { students: new Set(), outstanding: 0 });
      }
      const bucket = classBuckets.get(className);
      bucket.students.add(String(inv.studentId));
      bucket.outstanding += balance;

      // Per-student rollup within each class, so the dashboard can show who's
      // paid/due when an admin drills into a class card — a student can have
      // more than one invoice in the same class, so these are summed.
      if (!classStudentBuckets.has(className)) classStudentBuckets.set(className, new Map());
      const studentBucket = classStudentBuckets.get(className);
      const studentKey = String(inv.studentId);
      if (!studentBucket.has(studentKey)) studentBucket.set(studentKey, { total: 0, paid: 0, balance: 0 });
      const studentRow = studentBucket.get(studentKey);
      studentRow.total += payable;
      studentRow.paid += paid;
      studentRow.balance += balance;
    });
    totals.totalStudents = studentsWithInvoice.size;

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

    const classStudents = {};
    classStudentBuckets.forEach((studentBucket, label) => {
      classStudents[label] = Array.from(studentBucket.entries())
        .map(([studentId, agg]) => {
          const student = studentMap.get(studentId);
          const balanceAmount = Math.round(agg.balance);
          const paidAmount = Math.round(agg.paid);
          return {
            studentId,
            name: student?.name || 'Student',
            roll: student?.roll || '',
            username: student?.username || student?.studentCode || student?.admissionNumber || '',
            section: student?.section || '',
            totalAmount: Math.round(agg.total),
            paidAmount,
            balanceAmount,
            status: balanceAmount <= 0 ? 'paid' : paidAmount > 0 ? 'partial' : 'due',
          };
        })
        .sort((a, b) => b.balanceAmount - a.balanceAmount || a.name.localeCompare(b.name));
    });

    const invoiceMap = new Map(invoices.map((inv) => [String(inv._id), inv]));

    // Resolve academic-year names so "Session" shows a readable label instead of
    // a raw id / stale free-text value on the student record.
    const yearIds = [...new Set(
      invoices
        .map((inv) => String(inv.academicYearId || ''))
        .filter((id) => id && mongoose.isValidObjectId(id))
    )];
    const years = yearIds.length
      ? await AcademicYear.find({ _id: { $in: yearIds }, schoolId }).select('name').lean()
      : [];
    const yearNameById = new Map(years.map((y) => [String(y._id), y.name]));

    // Pull a wide recent window so the client-side date-range filter (7d / 30d /
    // all) and the collection-trend chart have the real payment volume to work
    // with — not just the last 10 rows. The dedicated fees collection page owns
    // the fully paginated ledger.
    const payments = await FeePayment.find(invoiceFilter)
      .sort({ paidOn: -1, createdAt: -1 })
      .limit(500)
      .lean();
    const recentPayments = payments.map((payment) => {
      const student = studentMap.get(String(payment.studentId));
      const invoice = invoiceMap.get(String(payment.invoiceId));
      const paymentStatus = Number(payment.amount || 0) <= 0
        ? 'Unpaid'
        : Number(invoice?.balanceAmount || 0) > 0
          ? 'Partial'
          : 'Paid';
      const paymentDate = payment.paidOn || payment.createdAt;
      return {
        studentId: payment.studentId,
        studentName: student?.name || 'Student',
        username: student?.username || '',
        className: student?.grade || '',
        section: student?.section || '',
        session:
          yearNameById.get(String(invoice?.academicYearId || '')) ||
          (mongoose.isValidObjectId(String(student?.academicYear || '')) ? '' : String(student?.academicYear || '')),
        admissionNo: student?.studentCode || student?.admissionNumber || '',
        amount: payment.amount,
        paidOn: paymentDate,
        paidOnLabel: paymentDate ? new Date(paymentDate).toLocaleString('en-IN') : '',
        transactionId: payment.transactionId || payment.gatewayPaymentId || payment.gatewayOrderId || '',
        method: payment.method || 'cash',
        status: paymentStatus,
        invoiceStatus: invoice?.status || '',
        gatewayPaymentId: payment.gatewayPaymentId || '',
        gatewayOrderId: payment.gatewayOrderId || '',
        notes: payment.notes || '',
      };
    });

    // Collected per month, straight from the payment ledger.
    const trendStart = new Date(today.getFullYear(), today.getMonth() - 5, 1);
    const collectedByMonth = invoiceIds.length
      ? await FeePayment.aggregate([
          { $match: { invoiceId: { $in: invoiceIds }, paidOn: { $gte: trendStart } } },
          {
            $group: {
              _id: { y: { $year: '$paidOn' }, m: { $month: '$paidOn' } },
              total: { $sum: '$amount' },
            },
          },
        ])
      : [];
    collectedByMonth.forEach((row) => {
      const b = trendMap.get(`${row._id.y}-${String(row._id.m).padStart(2, '0')}`);
      if (b) b.collected += Number(row.total || 0);
    });

    // Month-end snapshot per bucket: Outstanding = what had been invoiced by
    // then minus what had been paid by then; Overdue = the part of that whose
    // invoice due date had already passed. Same rules as the Outstanding /
    // Overdue totals, so the current month's bars equal those totals.
    const paidByInvoiceMonth = invoiceIds.length
      ? await FeePayment.aggregate([
          { $match: { invoiceId: { $in: invoiceIds } } },
          {
            $group: {
              _id: { invoiceId: '$invoiceId', y: { $year: '$paidOn' }, m: { $month: '$paidOn' } },
              total: { $sum: '$amount' },
            },
          },
        ])
      : [];
    const paymentsTimeline = new Map(); // invoiceId -> [{ key, amount }]
    paidByInvoiceMonth.forEach((row) => {
      const id = String(row._id.invoiceId);
      if (!paymentsTimeline.has(id)) paymentsTimeline.set(id, []);
      paymentsTimeline.get(id).push({
        key: `${row._id.y}-${String(row._id.m).padStart(2, '0')}`,
        amount: Number(row.total || 0),
      });
    });
    trendBuckets.forEach((bucket) => {
      const [y, m] = bucket.key.split('-').map(Number);
      const monthEnd = new Date(y, m, 0, 23, 59, 59, 999);
      const asOf = monthEnd < today ? monthEnd : today;
      invoices.forEach((inv) => {
        const created = new Date(inv.createdAt || inv.dueDate || 0);
        if (Number.isNaN(created.getTime()) || created > asOf) return;
        const payable = Math.max(0, Number(inv.totalAmount || 0) - Number(inv.discountAmount || 0));
        const paidByThen = (paymentsTimeline.get(String(inv._id)) || [])
          .filter((p) => p.key <= bucket.key)
          .reduce((sum, p) => sum + p.amount, 0);
        const outstanding = Math.max(0, payable - Math.min(paidByThen, payable));
        bucket.due += outstanding;
        if (outstanding > 0 && inv.dueDate && new Date(inv.dueDate) < asOf) bucket.overdue += outstanding;
      });
    });

    const summary = {
      academicYearName: scopedAcademicYearName,
      totals: {
        totalOutstanding: Math.round(totals.totalOutstanding),
        totalCollected: Math.round(totals.totalCollected),
        totalInvoiced: Math.round(totals.totalInvoiced),
        totalStudents: totals.totalStudents,
        overdueInvoices,
        overdueAmount: Math.round(totals.overdueAmount),
      },
      monthlyTrend: trendBuckets.map(({ month, collected, due, overdue }) => ({
        month,
        collected: Math.round(collected),
        due: Math.round(due), // month-end outstanding
        outstanding: Math.round(due),
        overdue: Math.round(overdue),
      })),
      enrollment: enrollmentNormalized,
      outstandingSegments: outstandingNormalized,
      classStudents,
      recentPayments,
    };
    feeSummaryCache.set(cacheKey, { data: summary, expires: Date.now() + FEE_SUMMARY_TTL_MS });
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load summary' });
  }
});

// Keyed on the full query so every filter/search combination caches separately.
// Lives in invoicesListCache so every existing write-path .clear() (payments,
// discounts, bulk assign, Razorpay capture) invalidates it immediately.
const ADMIN_INVOICES_TTL_MS = 30 * 1000;
const adminInvoicesCacheKey = (req) => {
  const q = req.query || {};
  const parts = Object.keys(q).sort().map((k) => `${k}=${q[k]}`).join('&');
  return `admin:${req.schoolId || 'x'}:${req.campusId || 'x'}:${parts}`;
};

router.get('/admin/invoices', adminAuth, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const schoolId = resolveSchoolId(req, res);
    if (!schoolId) return;
    if (!requireCampusId(req, res)) return;

    const adminCacheKey = adminInvoicesCacheKey(req);
    const cachedAdmin = invoicesListCache.get(adminCacheKey);
    if (cachedAdmin && cachedAdmin.expires > Date.now()) {
      res.set('X-Cache', 'HIT');
      return res.json(cachedAdmin.data);
    }

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

    const studentFilter = { schoolId, ...ACTIVE_STUDENT_FILTER };
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

    // Only currently-enrolled students' invoices show up here — a student
    // marked Leaving/Left/Expelled or archived is excluded even when looked
    // up directly by studentId.
    let studentIds = null;
    if (studentId && mongoose.isValidObjectId(studentId)) {
      const student = await StudentUser.findOne({
        _id: studentId,
        schoolId,
        ...ACTIVE_STUDENT_FILTER,
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
    } else {
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
          .select('name grade section roll admissionNumber profilePic')
          .lean()
      : [];
    const studentMap = new Map(students.map((s) => [String(s._id), s]));

    const payload = invoices.map((inv) => {
      const student = studentMap.get(String(inv.studentId));
      return {
        id: inv._id,
        invoiceId: inv._id,
        studentId: inv.studentId,
        academicYearId: inv.academicYearId || null,
        feeStructureId: inv.feeStructureId || null,
        studentName: student?.name || 'Student',
        admissionNumber: student?.admissionNumber || '',
        profilePic: student?.profilePic || '',
        roll: student?.roll || '',
        classId: inv.classId || null,
        className: inv.className || student?.grade || '',
        section: inv.section || student?.section || '',
        title: inv.title,
        totalAmount: inv.totalAmount,
        paidAmount: inv.paidAmount,
        balanceAmount: inv.balanceAmount,
        feeHeadsSnapshot: Array.isArray(inv.feeHeadsSnapshot) ? inv.feeHeadsSnapshot : [],
        installmentsSnapshot: Array.isArray(inv.installmentsSnapshot) ? inv.installmentsSnapshot : [],
        status: inv.status,
        dueDate: inv.dueDate,
        updatedAt: inv.updatedAt,
      };
    });

    invoicesListCache.set(adminCacheKey, { data: payload, expires: Date.now() + ADMIN_INVOICES_TTL_MS });
    res.set("X-Cache", "MISS");
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
            excludeSundays: Boolean(structure?.lateFeeExcludeSundays),
            excludeHolidays: Boolean(structure?.lateFeeExcludeHolidays),
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
      notifyFeeInvoicesCreated({
        schoolId, campusId: req.campusId || null, invoices: invoicesToCreate, entityId: structure._id, createdBy: req.admin?.id || null,
      }).catch((err) => console.error('Failed to send fee invoice notifications:', err.message));
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

    const academicYear = refreshedInvoice.academicYearId
      ? await AcademicYear.findById(refreshedInvoice.academicYearId).select('name').lean()
      : null;

    res.json({
      invoice: { ...refreshedInvoice, academicYearName: academicYear?.name || '' },
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

// Portfolio-wide fee summary across all of a parent's children (dashboard tile)
router.get('/parent/summary', authParent, async (req, res) => {
  // #swagger.tags = ['Fees']
  try {
    const parent = await ParentUser.findById(req.user.id)
      .select('childrenIds children schoolId campusId')
      .lean();
    if (!parent) return res.status(404).json({ error: 'Parent not found' });

    const schoolId = parent.schoolId || req.schoolId || null;
    if (!schoolId) return res.status(400).json({ error: 'schoolId is required' });

    const campusId = parent.campusId || req.campusId || null;
    const students = await resolveParentStudents({ parent, schoolId, campusId });
    const studentIds = students.map((s) => s._id);

    if (studentIds.length === 0) {
      return res.json({ outstandingAmount: 0, openInvoiceCount: 0, totalInvoiceCount: 0, currency: 'INR' });
    }

    await applyLateFeesForFilter({ schoolId, filter: { studentId: { $in: studentIds } } });
    const invoices = await FeeInvoice.find({ schoolId, studentId: { $in: studentIds } })
      .select('balanceAmount status')
      .lean();

    const openInvoices = invoices.filter((inv) => inv.status !== 'paid' && Number(inv.balanceAmount) > 0);
    const outstandingAmount = openInvoices.reduce((sum, inv) => sum + Number(inv.balanceAmount || 0), 0);

    res.json({
      outstandingAmount,
      openInvoiceCount: openInvoices.length,
      totalInvoiceCount: invoices.length,
      currency: 'INR',
    });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Unable to load fee summary' });
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
      .populate('academicYearId', 'name startDate endDate isActive')
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
    feeSummaryCache.clear();
    invoicesListCache.clear();
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
