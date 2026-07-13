const FeeInvoice = require('../models/FeeInvoice');
const FeePayment = require('../models/FeePayment');
const Payment = require('../models/Payment');
const PaymentAudit = require('../models/PaymentAudit');
const { buildTransactionId } = require('../utils/paymentGatewayService');

const sanitizeReason = (value) => String(value || '').trim().slice(0, 300);

const syncInvoiceFromReceipts = async ({ organizationId, schoolId, feeId }) => {
  const totals = await FeePayment.aggregate([
    { $match: { organizationId, schoolId, invoiceId: feeId } },
    { $group: { _id: null, paidAmount: { $sum: '$amount' } } },
  ]);
  const invoice = await FeeInvoice.findOne({ _id: feeId, organizationId, schoolId });
  if (!invoice) throw new Error('Fee invoice not found');

  const paidAmount = Number(totals[0]?.paidAmount || 0);
  const payable = Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.discountAmount || 0));
  invoice.paidAmount = Math.min(paidAmount, payable);
  invoice.balanceAmount = Math.max(0, payable - invoice.paidAmount);
  invoice.status = invoice.balanceAmount === 0 ? 'paid' : (invoice.paidAmount > 0 ? 'partial' : 'due');
  await invoice.save();
  return invoice;
};

const capturePayment = async ({
  payment,
  providerPaymentId,
  providerSignature,
  source = 'callback',
  userId = null,
}) => {
  const organizationId = payment.organizationId;
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, organizationId, status: { $ne: 'captured' } },
    {
      $set: {
        status: 'captured',
        providerPaymentId,
        ...(providerSignature ? { providerSignature } : {}),
        failureReason: '',
        paidAt: new Date(),
      },
    },
    { new: true }
  ).select('+providerSignature');
  const captured = updated || await Payment.findOne({ _id: payment._id, organizationId });

  let receipt = await FeePayment.findOne({
    organizationId,
    schoolId: captured.schoolId,
    gatewayOrderId: captured.providerOrderId,
  });
  if (!receipt) {
    try {
      receipt = await FeePayment.create({
        organizationId,
        schoolId: captured.schoolId,
        invoiceId: captured.feeId,
        studentId: captured.studentId,
        transactionId: buildTransactionId('RZP'),
        amount: captured.amount,
        currency: captured.currency,
        method: 'razorpay',
        paidOn: captured.paidAt || new Date(),
        initiatedByType: captured.initiatedByType,
        initiatedById: captured.initiatedById,
        gateway: 'razorpay',
        gatewayOrderId: captured.providerOrderId,
        gatewayPaymentId: providerPaymentId || captured.providerPaymentId,
        gatewaySignature: providerSignature || undefined,
        gatewayStatus: 'captured',
        metadata: { source },
      });
    } catch (error) {
      if (error?.code !== 11000) throw error;
      receipt = await FeePayment.findOne({ organizationId, gatewayOrderId: captured.providerOrderId });
    }
  }

  const invoice = await syncInvoiceFromReceipts({
    organizationId,
    schoolId: captured.schoolId,
    feeId: captured.feeId,
  });

  if (updated) {
    await PaymentAudit.create({
      organizationId,
      action: 'payment.captured',
      userId,
      metadata: {
        paymentId: captured._id,
        feeId: captured.feeId,
        providerOrderId: captured.providerOrderId,
        providerPaymentId: providerPaymentId || captured.providerPaymentId,
        amount: captured.amount,
        source,
      },
    });
  }
  return { payment: captured, receipt, invoice };
};

const failPayment = async ({ payment, providerPaymentId, reason, source = 'webhook' }) => {
  const updated = await Payment.findOneAndUpdate(
    { _id: payment._id, organizationId: payment.organizationId, status: { $ne: 'captured' } },
    {
      $set: {
        status: 'failed',
        ...(providerPaymentId ? { providerPaymentId } : {}),
        failureReason: sanitizeReason(reason),
      },
    },
    { new: true }
  );
  if (updated) {
    await PaymentAudit.create({
      organizationId: payment.organizationId,
      action: 'payment.failed',
      metadata: {
        paymentId: payment._id,
        feeId: payment.feeId,
        providerOrderId: payment.providerOrderId,
        providerPaymentId: providerPaymentId || null,
        reason: sanitizeReason(reason),
        source,
      },
    });
  }
  return updated || payment;
};

module.exports = { capturePayment, failPayment, syncInvoiceFromReceipts };
