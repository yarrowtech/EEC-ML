/**
 * Holiday / fee / promotion → communication pipeline.
 *
 *   HOLIDAY   → one school-wide NOTICE (kept in sync with the holiday) +
 *               one school-wide alert: Created / Updated (only on change) / Cancelled
 *   FEE       → invoice issued: student + linked parents
 *               payment received: that student + linked parents (per receipt)
 *   PROMOTION → promoted students + linked parents
 *
 * Everything goes through communicationService (targeting + dedupe), so a
 * retried request, webhook + callback double-capture, or an unchanged update
 * never produces a second alert.
 */
const Notification = require('../models/Notification');
const { EVENTS, fingerprint, notify, broadcast } = require('./communicationService');

const fmtDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};
const inr = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const classText = (grade, section) => {
  const g = String(grade || '').trim();
  const cls = !g ? '' : (/^class\b/i.test(g) ? g : `Class ${g}`);
  return [cls, section ? `Section ${section}` : ''].filter(Boolean).join(', ');
};

// ── Holidays ────────────────────────────────────────────────────────────────
const holidayRange = (h) => {
  const start = fmtDate(h.startDate || h.date);
  const end = fmtDate(h.endDate || h.startDate || h.date);
  return start === end ? `on ${start}` : `from ${start} to ${end}`;
};

// action: 'created' | 'updated' | 'deleted'
const notifyHolidayChange = async ({ schoolId, campusId = null, holiday, action, createdBy = null }) => {
  if (!holiday?._id) return null;
  const noticeKey = `holiday-notice:${schoolId}:${holiday._id}`;
  const range = holidayRange(holiday);
  const data = { name: holiday.name, range };

  if (action === 'deleted') {
    await Notification.deleteOne({ dedupeKey: noticeKey });
    return broadcast({
      schoolId, campusId, createdBy,
      eventType: EVENTS.HOLIDAY_CANCELLED, entityType: 'holiday', entityId: holiday._id,
      category: 'events', priority: 'medium', data,
      title: `Holiday Cancelled: ${holiday.name}`,
      message: `The holiday "${holiday.name}" ${range} has been cancelled. School will function as usual.`,
    });
  }

  // Updates that change nothing visible stay silent.
  const existing = await Notification.findOne({ dedupeKey: noticeKey }).select('_id message').lean();
  const noticeMessage = `The school will remain closed ${range} on account of ${holiday.name}.`;
  if (existing && existing.message === noticeMessage) return { created: 0, skipped: 1, unchanged: true };

  const noticeFields = {
    schoolId, campusId: campusId || null,
    kind: 'notice', eventType: action === 'created' ? EVENTS.HOLIDAY_CREATED : EVENTS.HOLIDAY_UPDATED, targetRole: 'all',
    title: `Holiday: ${holiday.name}`,
    message: noticeMessage,
    audience: 'All', type: 'announcement', typeLabel: 'holiday',
    category: 'events', priority: 'medium',
    createdBy, relatedEntity: { entityType: 'holiday', entityId: holiday._id },
  };
  if (existing) await Notification.updateOne({ _id: existing._id }, { $set: noticeFields });
  else {
    try { await Notification.create({ ...noticeFields, dedupeKey: noticeKey }); } catch (err) { if (err?.code !== 11000) throw err; }
  }

  const isUpdate = Boolean(existing) || action === 'updated';
  return broadcast({
    schoolId, campusId, createdBy,
    eventType: isUpdate ? EVENTS.HOLIDAY_UPDATED : EVENTS.HOLIDAY_CREATED,
    entityType: 'holiday', entityId: holiday._id,
    category: 'events', priority: 'medium', data,
    title: isUpdate ? `Holiday Updated: ${holiday.name}` : `Holiday Declared: ${holiday.name}`,
    message: isUpdate
      ? `The ${holiday.name} holiday has changed — school is now closed ${range}.`
      : `School will remain closed ${range} for ${holiday.name}.`,
  });
};

// ── Fees ────────────────────────────────────────────────────────────────────
// invoices: [{ _id?, studentId, title, totalAmount, dueDate }]; entityId groups
// a bulk run (fee structure) or a single invoice.
const notifyFeeInvoicesCreated = async ({ schoolId, campusId = null, invoices = [], entityId = null, createdBy = null }) => {
  const list = invoices.filter((i) => i?.studentId);
  if (!list.length) return null;
  const byStudent = new Map(list.map((i) => [String(i.studentId), i]));
  const first = list[0];
  const due = first.dueDate ? ` Due by ${fmtDate(first.dueDate)}.` : '';
  const amountFor = (s) => {
    const inv = byStudent.get(String(s._id));
    return inv?.totalAmount ? ` of ${inr(inv.totalAmount)}` : '';
  };
  return notify({
    schoolId, campusId, createdBy,
    eventType: EVENTS.FEE_CREATED,
    entityType: 'fee', entityId: entityId || first._id,
    category: 'fee', priority: 'medium',
    target: { studentIds: list.map((i) => i.studentId) },
    data: { title: first.title, due: first.dueDate || '', students: [...byStudent.keys()].sort() },
    student: (s, group) => ({
      title: 'New Fee Invoice',
      message: `A fee invoice "${first.title}"${group.length === 1 ? amountFor(s) : ''} has been issued to you.${due}`,
    }),
    parent: (s) => ({
      title: 'New Fee Invoice',
      message: `A fee invoice "${first.title}"${amountFor(s)} has been issued for ${s.name} (${classText(s.grade, s.section)}).${due}`,
    }),
  });
};

const notifyFeePaymentReceived = async ({ schoolId, campusId = null, payment, invoice = null }) => {
  if (!payment?._id || !payment.studentId) return null;
  const receipt = payment.receiptNumber ? ` Receipt No: ${payment.receiptNumber}.` : '';
  const balance = invoice
    ? Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.discountAmount || 0) - Number(invoice.paidAmount || 0))
    : null;
  const balanceText = balance === null ? '' : (balance > 0 ? ` Remaining balance: ${inr(balance)}.` : ' The invoice is now fully paid.');
  return notify({
    schoolId, campusId,
    eventType: EVENTS.FEE_PAYMENT_RECEIVED,
    entityType: 'payment', entityId: payment._id,
    category: 'fee', priority: 'medium',
    target: { studentIds: [payment.studentId] },
    data: { payment: String(payment._id) },
    student: () => ({
      title: 'Fee Payment Received',
      message: `We have received your fee payment of ${inr(payment.amount)}.${receipt}${balanceText}`,
    }),
    parent: (s) => ({
      title: 'Fee Payment Received',
      message: `Payment of ${inr(payment.amount)} received for ${s.name}.${receipt}${balanceText}`,
    }),
  });
};

// ── Promotion ───────────────────────────────────────────────────────────────
const notifyStudentsPromoted = async ({ schoolId, campusId = null, studentIds = [], historyId = null, toClass, toSection, toAcademicYear, createdBy = null }) => {
  if (!studentIds.length) return null;
  const dest = classText(toClass, toSection);
  const session = toAcademicYear ? ` for the ${toAcademicYear} session` : '';
  return notify({
    schoolId, campusId, createdBy,
    eventType: EVENTS.STUDENT_PROMOTED,
    entityType: 'promotion', entityId: historyId,
    category: 'academic', priority: 'medium',
    target: { studentIds },
    data: { dest, toAcademicYear: toAcademicYear || '', fp: fingerprint(studentIds.map(String).sort()) },
    student: () => ({ title: 'Promoted!', message: `Congratulations! You have been promoted to ${dest}${session}.` }),
    parent: (s) => ({ title: 'Student Promoted', message: `${s.name} has been promoted to ${dest}${session}.` }),
  });
};

module.exports = {
  notifyHolidayChange,
  notifyFeeInvoicesCreated,
  notifyFeePaymentReceived,
  notifyStudentsPromoted,
};
