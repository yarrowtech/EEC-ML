const mongoose = require('mongoose');
const StudentUser = require('../models/StudentUser');

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

module.exports = {
  recomputeInvoiceStatus,
  resolveSchoolId,
  resolveParentStudents,
  buildPaymentsByInvoice,
};
