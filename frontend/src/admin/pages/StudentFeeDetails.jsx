import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  BadgeCheck,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  Mail,
  Phone,
  Receipt,
  Smartphone,
  User,
  Wallet,
  Zap,
} from 'lucide-react';
import { downloadFeeReceiptPdf } from '../../utils/feeReceiptPdf';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const PAYMENT_METHODS = [
  { key: 'cash', label: 'Cash', icon: Banknote, referenceLabel: 'Receipt Number', referencePlaceholder: 'e.g. RC-2026-00123', needsBank: false },
  { key: 'upi', label: 'UPI', icon: Smartphone, referenceLabel: 'UPI Transaction ID', referencePlaceholder: 'e.g. 402912345678', needsBank: false },
  { key: 'bank', label: 'Bank Transfer', icon: Landmark, referenceLabel: 'Transaction / UTR Number', referencePlaceholder: 'e.g. UTR1234567890', needsBank: true },
  { key: 'card', label: 'Card', icon: CreditCard, referenceLabel: 'Card Transaction Reference', referencePlaceholder: 'e.g. approval code or last 4 digits', needsBank: false },
  { key: 'razorpay', label: 'Razorpay (Online)', icon: Zap, referenceLabel: null, referencePlaceholder: '', needsBank: false },
];
const paymentMethodMeta = (key) => PAYMENT_METHODS.find((m) => m.key === key) || PAYMENT_METHODS[0];

const EMPTY_PAYMENT_FORM = {
  amount: '',
  method: 'cash',
  referenceNumber: '',
  bankName: '',
  notes: '',
};

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const loadRazorpayScript = () =>
  new Promise((resolve) => {
    if (window?.Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

const StudentFeeDetails = ({ setShowAdminHeader }) => {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const invoiceId = location.state?.invoiceId || searchParams.get('invoice') || '';

  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [paymentForm, setPaymentForm] = useState(EMPTY_PAYMENT_FORM);
  const [discountForm, setDiscountForm] = useState({
    amount: '',
    note: '',
  });
  const [savingPayment, setSavingPayment] = useState(false);
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [actionMessage, setActionMessage] = useState({ type: '', text: '' });

  useEffect(() => {
    setShowAdminHeader(false);
  }, [setShowAdminHeader]);

  const fetchDetails = useCallback(async () => {
    if (!invoiceId) {
      setError('No invoice selected. Please return to fees collection.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/fees/admin/invoices/${invoiceId}`, {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to load invoice');
      }
      setDetail(data);
      setDiscountForm({
        amount: data.invoice?.discountAmount || 0,
        note: data.invoice?.discountNote || '',
      });
    } catch (err) {
      setError(err.message || 'Unable to load invoice');
    } finally {
      setLoading(false);
    }
  }, [invoiceId]);

  useEffect(() => {
    fetchDetails();
  }, [fetchDetails]);

  const totals = useMemo(() => {
    if (!detail?.invoice) {
      return { total: 0, paid: 0, balance: 0, discount: 0 };
    }
    const total = Number(detail.invoice.totalAmount || 0);
    const paid = Number(detail.invoice.paidAmount || 0);
    const discount = Number(detail.invoice.discountAmount || 0);
    const balance = Math.max(0, total - discount - paid);
    return { total, paid, balance, discount };
  }, [detail]);
  const fineSummary = useMemo(() => {
    const invoice = detail?.invoice || {};
    const perDayFine = Number(invoice?.lateFeeRuleSnapshot?.amount || 0);
    const appliedFine = Number(invoice?.lateFeeAmountApplied || 0);
    const dueDate = invoice?.dueDate ? new Date(invoice.dueDate) : null;
    const hasValidDueDate = dueDate && !Number.isNaN(dueDate.getTime());
    const startOfDay = (value) => {
      const dt = new Date(value);
      if (Number.isNaN(dt.getTime())) return null;
      return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
    };
    const todayStart = startOfDay(new Date());
    const dueStart = hasValidDueDate ? startOfDay(dueDate) : null;
    const overdueDays =
      dueStart && todayStart && todayStart.getTime() > dueStart.getTime()
        ? Math.floor((todayStart.getTime() - dueStart.getTime()) / (1000 * 60 * 60 * 24))
        : 0;
    const hasOutstanding = Number(invoice?.balanceAmount || 0) > 0;
    const todayFineApplied = perDayFine > 0 && overdueDays > 0 && hasOutstanding;
    return {
      perDayFine,
      appliedFine,
      overdueDays,
      todayFineApplied,
      todayFineAmount: todayFineApplied ? perDayFine : 0,
    };
  }, [detail]);

  const handlePaymentSave = async () => {
    if (!paymentForm.amount) {
      setActionMessage({ type: 'error', text: 'Enter amount' });
      return;
    }
    if (paymentForm.method === 'razorpay') {
      await handleRazorpayPayment();
      return;
    }
    const activeMethod = paymentMethodMeta(paymentForm.method);
    if (activeMethod.referenceLabel && !paymentForm.referenceNumber.trim()) {
      setActionMessage({ type: 'error', text: `${activeMethod.referenceLabel} is required for ${activeMethod.label} payments` });
      return;
    }
    if (activeMethod.needsBank && !paymentForm.bankName.trim()) {
      setActionMessage({ type: 'error', text: 'Bank name is required for bank transfer payments' });
      return;
    }
    setSavingPayment(true);
    setActionMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/fees/payments`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          invoiceId,
          amount: Number(paymentForm.amount || 0),
          method: paymentForm.method || 'cash',
          referenceNumber: paymentForm.referenceNumber.trim(),
          bankName: paymentForm.bankName.trim(),
          notes: paymentForm.notes || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to record payment');
      }
      setPaymentForm(EMPTY_PAYMENT_FORM);
      setActionMessage({ type: 'success', text: 'Payment recorded successfully.' });
      fetchDetails();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Unable to record payment' });
    } finally {
      setSavingPayment(false);
    }
  };

  const handleRazorpayPayment = async () => {
    if (!invoiceId) return;
    setSavingPayment(true);
    setActionMessage({ type: '', text: '' });
    try {
      const amount = Number(paymentForm.amount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Enter a valid amount');
      }

      const orderRes = await fetch(`${API_BASE}/api/fees/admin/razorpay/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          invoiceId,
          amount,
          notes: paymentForm.notes || '',
        }),
      });
      const orderData = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        throw new Error(orderData?.error || 'Unable to create online payment order');
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to load Razorpay checkout');
      }

      const razorpayKey = orderData.keyId;
      if (!razorpayKey) {
        throw new Error('Razorpay key is missing');
      }

      const options = {
        key: razorpayKey,
        amount: orderData.order?.amount,
        currency: orderData.order?.currency || 'INR',
        name: 'EEC Fees Collection',
        description: invoiceId,
        order_id: orderData.order?.id,
        prefill: {
          name: student?.guardianName || student?.name || 'Parent',
          contact: student?.guardianPhone || student?.mobile || '',
          email: student?.guardianEmail || student?.email || '',
        },
        notes: {
          studentName: student?.name || '',
          invoiceId: String(invoiceId),
        },
        theme: {
          color: '#f59e0b',
        },
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${API_BASE}/api/fees/admin/razorpay/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                authorization: `Bearer ${localStorage.getItem('token')}`,
              },
              body: JSON.stringify({
                invoiceId,
                amount,
                notes: paymentForm.notes || '',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) {
              throw new Error(verifyData?.error || 'Unable to verify online payment');
            }
            setPaymentForm(EMPTY_PAYMENT_FORM);
            setActionMessage({ type: 'success', text: 'Online payment captured successfully.' });
            await fetchDetails();
          } catch (verifyErr) {
            setActionMessage({
              type: 'error',
              text: verifyErr.message || 'Unable to verify online payment',
            });
          } finally {
            setSavingPayment(false);
          }
        },
        modal: {
          ondismiss: () => setSavingPayment(false),
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Online payment failed' });
      setSavingPayment(false);
    }
  };

  const handleDiscountSave = async () => {
    setSavingDiscount(true);
    setActionMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/fees/admin/discount`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          invoiceId,
          amount: Number(discountForm.amount || 0),
          note: discountForm.note || '',
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to apply discount');
      }
      setActionMessage({ type: 'success', text: 'Discount updated successfully.' });
      fetchDetails();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Unable to apply discount' });
    } finally {
      setSavingDiscount(false);
    }
  };

  const handleDownloadReceipt = async (payment) => {
    if (!payment || !detail?.invoice) return;
    try {
      const res = await fetch(`${API_BASE}/api/fees/payments/${payment._id}/receipt`, {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to load receipt data');
      }
      await downloadFeeReceiptPdf({
        invoice: data?.invoice || detail.invoice,
        student: data?.student || detail.student,
        payment: data?.payment || payment,
        receipt: data?.receipt || null,
        school: data?.school || null,
        schoolName:
          localStorage.getItem('schoolName') ||
          localStorage.getItem('school') ||
          'Electronic Educare School',
        schoolSubtitle: 'Fee Payment Receipt',
      });
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Unable to download receipt' });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="text-center text-slate-600">
          <div className="animate-spin h-10 w-10 border-2 border-amber-500 border-t-transparent rounded-full mx-auto mb-4" />
          Loading invoice details...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4 bg-slate-50">
        <div className="max-w-xl w-full rounded-3xl border border-red-100 shadow-2xl overflow-hidden bg-white">
          <div className="p-8 flex flex-col items-center text-center gap-6">
            <div className="w-16 h-16 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center text-red-500">
              <AlertCircle size={28} />
            </div>
            <div className="space-y-2">
              <h2 className="text-2xl font-bold text-slate-900">Invoice not found</h2>
              <p className="text-slate-600">{error}</p>
            </div>
            <button
              onClick={() => navigate('/admin/fees/collection')}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-white font-semibold"
            >
              <ArrowLeft size={16} />
              Back to Fees Collection
            </button>
          </div>
        </div>
      </div>
    );
  }

  const invoice = detail?.invoice || {};
  const student = detail?.student || {};
  const payments = detail?.payments || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="px-6 py-8 lg:px-10 space-y-8">
        <div className="rounded-3xl border border-slate-200 bg-white shadow-2xl overflow-hidden">
          <div className="relative isolate px-6 py-8 sm:px-8 bg-gradient-to-r from-amber-500 via-orange-500 to-yellow-400 text-white">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between relative z-10">
              <div className="space-y-4">
                <button
                  onClick={() => navigate('/admin/fees/collection')}
                  className="inline-flex items-center gap-2 text-sm text-white/80 hover:text-white"
                >
                  <ArrowLeft size={16} />
                  Back to Fees
                </button>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="text-3xl font-semibold">{student?.name || 'Student'}</h1>
                  <span className="px-3 py-1 rounded-full text-xs font-semibold bg-white/25">
                    {invoice.status?.toUpperCase?.() || 'STATUS'}
                  </span>
                </div>
                <p className="text-white/80">
                  Admission: {student?.admissionNumber || '-'} - Class:{' '}
                  {invoice.className || student?.grade || '-'} {student?.section ? `(${student.section})` : ''}
                </p>
                <div className="flex flex-wrap gap-4 text-sm text-white/80">
                  <span className="inline-flex items-center gap-2">
                    <User size={16} />
                    {student?.guardianName || 'Guardian not added'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Phone size={16} />
                    {student?.guardianPhone || student?.mobile || 'Not provided'}
                  </span>
                  <span className="inline-flex items-center gap-2">
                    <Mail size={16} />
                    {student?.guardianEmail || student?.email || 'Not provided'}
                  </span>
                </div>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-sm">
                <div className="rounded-2xl bg-white/15 border border-white/30 p-4 shadow-lg">
                  <p className="text-sm text-white/80">Outstanding balance</p>
                  <p className="text-3xl font-semibold">{formatCurrency(totals.balance)}</p>
                  <p className="text-xs text-white/70">
                    Net payable: {formatCurrency(totals.total - totals.discount)}
                  </p>
                </div>
                <div className="rounded-2xl bg-white/10 border border-white/20 p-4">
                  <p className="text-sm text-white/80">Invoice Due</p>
                  <p className="text-2xl font-semibold">
                    {invoice.dueDate ? new Date(invoice.dueDate).toLocaleDateString() : 'Not set'}
                  </p>
                </div>
                <button
                  onClick={() => window.print()}
                  className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-amber-600 rounded-2xl font-semibold"
                >
                  <Download size={16} />
                  Print Statement
                </button>
                {payments.length ? (
                  <button
                    onClick={() => handleDownloadReceipt(payments[0])}
                    className="flex items-center justify-center gap-2 px-4 py-3 bg-slate-900 text-white rounded-2xl font-semibold"
                  >
                    <Download size={16} />
                    Latest Receipt PDF
                  </button>
                ) : null}
              </div>
            </div>
          </div>

          <div className="p-6 space-y-6 bg-white">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl border border-slate-100 p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Total Fee</span>
                  <Wallet size={18} className="text-amber-600" />
                </div>
                <p className="text-2xl font-semibold text-slate-900">{formatCurrency(totals.total)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Discount Applied</span>
                  <BadgeCheck size={18} className="text-emerald-600" />
                </div>
                <p className="text-2xl font-semibold text-emerald-600">
                  {formatCurrency(totals.discount)}
                </p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Total Paid</span>
                  <BadgeCheck size={18} className="text-emerald-600" />
                </div>
                <p className="text-2xl font-semibold text-emerald-600">{formatCurrency(totals.paid)}</p>
              </div>
              <div className="rounded-2xl border border-slate-100 p-4 bg-white shadow-sm">
                <div className="flex items-center justify-between text-sm text-slate-500">
                  <span>Outstanding</span>
                  <AlertCircle size={18} className="text-red-500" />
                </div>
                <p className="text-2xl font-semibold text-red-600">{formatCurrency(totals.balance)}</p>
              </div>
            </div>

            {(fineSummary.perDayFine > 0 || fineSummary.appliedFine > 0) && (
              <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
                <h3 className="text-base font-semibold text-amber-800 mb-2">Late Fine Details</h3>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div>
                    <p className="text-xs text-amber-700">Fine Per Day</p>
                    <p className="text-sm font-semibold text-amber-900">{formatCurrency(fineSummary.perDayFine)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700">Total Fine Applied</p>
                    <p className="text-sm font-semibold text-amber-900">{formatCurrency(fineSummary.appliedFine)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-amber-700">Today Fine Status</p>
                    <p className="text-sm font-semibold text-amber-900">
                      {fineSummary.todayFineApplied
                        ? `${formatCurrency(fineSummary.todayFineAmount)} added today`
                        : 'No fine added today'}
                    </p>
                  </div>
                </div>
                {fineSummary.overdueDays > 0 ? (
                  <p className="text-xs text-amber-700 mt-2">
                    Invoice is overdue by {fineSummary.overdueDays} day{fineSummary.overdueDays > 1 ? 's' : ''}.
                  </p>
                ) : null}
              </div>
            )}

            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Fee Heads</h3>
                <div className="space-y-2">
                  {(invoice.feeHeadsSnapshot || []).length ? (
                    invoice.feeHeadsSnapshot.map((head, idx) => (
                      <div key={`${head.label}-${idx}`} className="flex justify-between text-sm text-slate-700">
                        <span>{head.label}</span>
                        <span className="font-semibold">{formatCurrency(head.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No fee heads added.</p>
                  )}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 p-5">
                <h3 className="text-lg font-semibold text-slate-900 mb-3">Installments</h3>
                <div className="space-y-2">
                  {(invoice.installmentsSnapshot || []).length ? (
                    invoice.installmentsSnapshot.map((inst, idx) => (
                      <div key={`${inst.label}-${idx}`} className="flex justify-between text-sm text-slate-700">
                        <span>
                          {inst.label} {inst.dueDate ? `- ${new Date(inst.dueDate).toLocaleDateString()}` : ''}
                        </span>
                        <span className="font-semibold">{formatCurrency(inst.amount)}</span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">No installments defined.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="xl:col-span-2 flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Payment History</h3>
              {payments.length ? (
                <div className="space-y-3">
                  {payments.map((payment) => (
                    <div
                      key={payment._id}
                      className="flex items-center justify-between border border-slate-200 rounded-xl p-3"
                    >
                      <div>
                        <p className="font-medium text-slate-800">
                          {formatCurrency(payment.amount)}
                        </p>
                        <p className="text-sm text-slate-500">
                          {payment.method?.toUpperCase() || 'CASH'}
                          {payment.bankName ? ` · ${payment.bankName}` : ''}
                        </p>
                        {payment.referenceNumber ? (
                          <p className="text-xs text-slate-400">{paymentMethodMeta(payment.method).referenceLabel || 'Ref'}: {payment.referenceNumber}</p>
                        ) : payment.transactionId ? (
                          <p className="text-xs text-slate-400">Ref: {payment.transactionId}</p>
                        ) : null}
                      </div>
                      <p className="text-sm text-slate-500">
                        {payment.paidOn
                          ? new Date(payment.paidOn).toLocaleDateString()
                          : '-'}
                      </p>
                      <button
                        onClick={() => handleDownloadReceipt(payment)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        <Download size={13} />
                        Receipt
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-slate-500">
                  No payment records yet. Collect a payment to populate this list.
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-6">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center gap-2.5 mb-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 border border-emerald-100">
                  <Wallet size={16} className="text-emerald-600" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900">Collect Payment</h3>
              </div>
              {actionMessage.text ? (
                <div
                  className={`mb-3 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                    actionMessage.type === 'success'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-red-200 bg-red-50 text-red-700'
                  }`}
                >
                  {actionMessage.type !== 'success' && <AlertCircle size={14} className="shrink-0" />}
                  {actionMessage.text}
                </div>
              ) : null}
              <div className="space-y-4">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Amount</label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm font-medium">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={paymentForm.amount}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Payment Method</label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAYMENT_METHODS.map(({ key, label, icon: MethodIcon }) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPaymentForm((prev) => ({ ...prev, method: key, referenceNumber: '', bankName: '' }))}
                        className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-all ${
                          paymentForm.method === key
                            ? 'border-emerald-500 bg-emerald-50 text-emerald-800 ring-2 ring-emerald-200'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <MethodIcon size={15} className={paymentForm.method === key ? 'text-emerald-600' : 'text-slate-400'} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* method-specific required fields */}
                {paymentMethodMeta(paymentForm.method).referenceLabel && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      {paymentMethodMeta(paymentForm.method).referenceLabel} <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Receipt size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={paymentForm.referenceNumber}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                        placeholder={paymentMethodMeta(paymentForm.method).referencePlaceholder}
                      />
                    </div>
                  </div>
                )}

                {paymentMethodMeta(paymentForm.method).needsBank && (
                  <div>
                    <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">
                      Bank Name <span className="text-red-500">*</span>
                    </label>
                    <div className="relative">
                      <Landmark size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input
                        type="text"
                        value={paymentForm.bankName}
                        onChange={(e) => setPaymentForm((prev) => ({ ...prev, bankName: e.target.value }))}
                        className="w-full rounded-lg border border-slate-300 pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                        placeholder="e.g. HDFC Bank"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-[11px] font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Notes (optional)</label>
                  <input
                    type="text"
                    value={paymentForm.notes}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400/40 focus:border-emerald-400"
                    placeholder="Any additional notes"
                  />
                </div>

                <button
                  onClick={handlePaymentSave}
                  disabled={savingPayment}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 text-white px-4 py-2.5 text-sm font-semibold hover:bg-emerald-700 disabled:bg-gray-300 transition-colors"
                >
                  {savingPayment ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  {paymentForm.method === 'razorpay' ? 'Pay Online via Razorpay' : 'Record Payment'}
                </button>
                {paymentForm.method === 'razorpay' ? (
                  <p className="text-xs text-slate-500">
                    Opens Razorpay Checkout and auto-updates payment history after verification.
                  </p>
                ) : (
                  <p className="text-xs text-slate-400">
                    {paymentMethodMeta(paymentForm.method).referenceLabel} is required so this payment can be traced back to a physical receipt or bank statement.
                  </p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h3 className="text-lg font-semibold text-slate-900 mb-4">Apply Discount</h3>
              <div className="space-y-3">
                <input
                  type="number"
                  min="0"
                  value={discountForm.amount}
                  onChange={(e) => setDiscountForm((prev) => ({ ...prev, amount: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Discount amount"
                />
                <input
                  type="text"
                  value={discountForm.note}
                  onChange={(e) => setDiscountForm((prev) => ({ ...prev, note: e.target.value }))}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  placeholder="Discount note"
                />
                <button
                  onClick={handleDiscountSave}
                  disabled={savingDiscount}
                  className="w-full inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 text-white px-4 py-2 text-sm font-semibold hover:bg-slate-800 disabled:bg-gray-300"
                >
                  {savingDiscount ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Save Discount
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentFeeDetails;
