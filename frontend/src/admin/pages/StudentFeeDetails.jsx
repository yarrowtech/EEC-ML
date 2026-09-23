import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  Banknote,
  CreditCard,
  Download,
  Landmark,
  Loader2,
  Mail,
  MonitorSmartphone,
  Phone,
  QrCode,
  Smartphone,
  User,
  Wallet,
  Zap,
  AlertTriangle,
  CalendarDays,
  ChevronDown,
  ChevronLeft,
  Clock,
  FileCheck,
  FileText,
  Info,
  Percent,
  Printer,
} from 'lucide-react';
import { downloadFeeReceiptPdf } from '../../utils/feeReceiptPdf';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const PAYMENT_METHODS = [
  // Cash needs no manual reference — the receipt number is auto-generated on save.
  { key: 'cash', label: 'Cash', icon: Banknote, referenceLabel: null, referencePlaceholder: '', needsBank: false },
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

// dd/mm/yyyy
const formatDMY = (value) => {
  if (!value) return '-';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleDateString('en-GB');
};

const INSTALLMENT_STATUS = {
  paid: { label: 'Paid', cls: 'border-emerald-200 bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  partial: { label: 'Partial', cls: 'border-amber-200 bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  overdue: { label: 'Overdue', cls: 'border-rose-200 bg-rose-50 text-rose-700', dot: 'bg-rose-500' },
  due: { label: 'Due', cls: 'border-slate-200 bg-slate-50 text-slate-600', dot: 'bg-slate-400' },
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
  const [creatingQr, setCreatingQr] = useState(false);
  const [activeQrCodeId, setActiveQrCodeId] = useState('');
  const qrPollTimerRef = useRef(null);
  const [fineOpen, setFineOpen] = useState(false);
  const [selectedInstallment, setSelectedInstallment] = useState(null);
  const amountInputRef = useRef(null);

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
      setSelectedInstallment(null);
      setActionMessage({
        type: 'success',
        text: data?.payment?.receiptNumber
          ? `Payment recorded. Receipt No: ${data.payment.receiptNumber}`
          : 'Payment recorded successfully.',
      });
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
            setSelectedInstallment(null);
            setActionMessage({
              type: 'success',
              text: verifyData?.payment?.receiptNumber
                ? `Online payment captured. Receipt No: ${verifyData.payment.receiptNumber}`
                : 'Online payment captured successfully.',
            });
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

  // Polls the QR payment session from the admin's own screen (independent of
  // the second-screen display's own polling) so the invoice/payment history
  // here refreshes automatically the instant the payer scans and pays.
  const pollQrStatus = useCallback((qrCodeId) => {
    clearTimeout(qrPollTimerRef.current);
    const check = async () => {
      try {
        const res = await fetch(`${API_BASE}/api/fees/admin/razorpay/qr/${qrCodeId}/status`, {
          headers: { authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          qrPollTimerRef.current = setTimeout(check, 3000);
          return;
        }
        if (data.status === 'captured') {
          setActiveQrCodeId('');
          setPaymentForm(EMPTY_PAYMENT_FORM);
          setSelectedInstallment(null);
          setActionMessage({ type: 'success', text: 'QR payment received and recorded automatically.' });
          await fetchDetails();
          return;
        }
        if (data.status === 'expired') {
          setActiveQrCodeId('');
          setActionMessage({ type: 'error', text: 'QR code expired without payment.' });
          return;
        }
        qrPollTimerRef.current = setTimeout(check, 3000);
      } catch {
        qrPollTimerRef.current = setTimeout(check, 3000);
      }
    };
    check();
  }, [fetchDetails]);

  useEffect(() => () => clearTimeout(qrPollTimerRef.current), []);

  const handleOpenQr = async () => {
    const amount = Number(paymentForm.amount || 0);
    if (!Number.isFinite(amount) || amount <= 0) {
      setActionMessage({ type: 'error', text: 'Enter a valid amount first' });
      return;
    }
    setCreatingQr(true);
    setActionMessage({ type: '', text: '' });
    try {
      const res = await fetch(`${API_BASE}/api/fees/admin/razorpay/qr`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({ invoiceId, amount }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to create QR code');
      }

      const qrParams = new URLSearchParams({
        qrId: data.qrCodeId,
        imageUrl: data.imageUrl || '',
        amount: String(data.amount || amount),
        studentName: student?.name || '',
      });
      const displayWindow = window.open(
        `/admin/fees/qr-display?${qrParams.toString()}`,
        'razorpay-qr-display',
        'width=440,height=680'
      );
      if (!displayWindow) {
        setActionMessage({ type: 'error', text: 'Enable pop-ups for this site to open the QR display.' });
        return;
      }

      setActiveQrCodeId(data.qrCodeId);
      setActionMessage({ type: 'success', text: 'QR opened on a new screen — waiting for payment…' });
      pollQrStatus(data.qrCodeId);
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message || 'Unable to create QR code' });
    } finally {
      setCreatingQr(false);
    }
  };

  // Fill Collect Payment with an installment's amount (capped at the remaining
  // balance so we never pre-fill an overpayment), then focus the amount field.
  const handleSelectInstallment = (inst, idx) => {
    const instAmount = Number(inst?.amount || 0);
    const amount = totals.balance > 0 ? Math.min(instAmount, totals.balance) : instAmount;
    setSelectedInstallment(idx);
    setPaymentForm((prev) => ({
      ...prev,
      amount: String(amount),
      notes: prev.notes || `${inst?.label || 'Installment'} payment`,
    }));
    setActionMessage({
      type: 'success',
      text: amount < instAmount
        ? `${inst?.label || 'Installment'} selected — amount set to remaining balance ${formatCurrency(amount)}.`
        : `${inst?.label || 'Installment'} selected — ${formatCurrency(amount)} filled.`,
    });
    requestAnimationFrame(() => {
      amountInputRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      amountInputRef.current?.focus({ preventScroll: true });
    });
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
              onClick={() => navigate('/admin/fees/collection?view=payments')}
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

  const statusKey = String(invoice.status || 'due').toLowerCase();
  const statusBadge = statusKey === 'paid'
    ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
    : statusKey === 'partial'
      ? 'bg-amber-50 text-amber-600 border-amber-200'
      : 'bg-rose-50 text-rose-600 border-rose-200';
  const dueStatusText = statusKey === 'paid'
    ? 'Fully paid'
    : statusKey === 'partial' ? 'Partially paid' : 'Payment pending';
  const sessionName = invoice.academicYearName || invoice.session || '';
  const classLabel = invoice.className || student?.grade || '-';
  const sectionLabel = invoice.section || student?.section || '';
  const feeHeads = invoice.feeHeadsSnapshot || [];
  const lateFeeAmount = Number(invoice.lateFeeAmountApplied || 0);
  const feeHeadsTotal = feeHeads.reduce((sum, h) => sum + Number(h.amount || 0), 0) + lateFeeAmount;
  const installments = invoice.installmentsSnapshot || [];
  // Allocate what's been paid (plus any discount) to installments in order:
  // fully covered → Paid, partly covered → Partial, else Overdue/Due by date.
  const installmentRows = (() => {
    let credit = totals.paid + totals.discount;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return installments.map((inst, idx) => {
      const amount = Number(inst.amount || 0);
      const covered = Math.min(amount, Math.max(0, credit));
      credit -= covered;
      const remaining = amount - covered;
      const due = inst.dueDate ? new Date(inst.dueDate) : null;
      const isOverdue = due && !Number.isNaN(due.getTime()) && due < today;
      const status = remaining <= 0 ? 'paid' : covered > 0 ? 'partial' : isOverdue ? 'overdue' : 'due';
      return { inst, idx, status, remaining };
    });
  })();
  const activeMethod = paymentMethodMeta(paymentForm.method);
  // Discount can't push the balance below zero: cap at total fee minus what's already paid.
  const maxDiscount = Math.max(0, totals.total - totals.paid);
  const discountValue = Number(discountForm.amount || 0);
  const discountError = discountValue < 0
    ? 'Discount cannot be negative.'
    : discountValue > maxDiscount
      ? `Discount cannot exceed ${formatCurrency(maxDiscount)} (total fee ${formatCurrency(totals.total)}${totals.paid > 0 ? ` minus ${formatCurrency(totals.paid)} already paid` : ''}).`
      : '';
  const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-400/30 focus:border-indigo-400';
  const cardCls = 'rounded-2xl border border-slate-200/80 bg-white shadow-[0_1px_2px_rgba(15,23,42,0.04)]';
  const formatDateTime = (value) => {
    if (!value) return '-';
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-IN', { dateStyle: 'short', timeStyle: 'short' });
  };

  const SectionTitle = ({ icon: Icon, title, subtitle, tone = 'indigo', action = null }) => (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone === 'emerald' ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-500'}`}>
          <Icon size={19} />
        </span>
        <div>
          <h3 className="text-base font-semibold text-slate-900">{title}</h3>
          {subtitle ? <p className="text-xs text-slate-500">{subtitle}</p> : null}
        </div>
      </div>
      {action}
    </div>
  );

  const StatCard = ({ icon: Icon, iconCls, label, value, valueCls, extra }) => (
    <div className="flex min-w-0 items-center gap-4 px-4 py-3">
      <span className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-full ${iconCls}`}>
        <Icon size={22} />
      </span>
      <div className="min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`text-2xl font-bold leading-tight tabular-nums break-words ${valueCls}`}>{value}</p>
        {extra}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50/60">
      <div className="px-4 py-6 sm:px-6 lg:px-8 space-y-5">
        {/* ── Header ── */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-2 min-w-0">
            <button
              onClick={() => navigate('/admin/fees/collection?view=payments')}
              className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
            >
              <ChevronLeft size={16} />
              Back to Fees
            </button>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">{student?.name || 'Student'}</h1>
              <span className={`rounded-full border px-3 py-0.5 text-xs font-semibold ${statusBadge}`}>
                {(invoice.status || 'due').toUpperCase()}
              </span>
            </div>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
              <span>Admission: {student?.admissionNumber || '-'}</span>
              <span className="text-slate-300">|</span>
              <span>Class: {classLabel}</span>
              {sectionLabel ? (<><span className="text-slate-300">|</span><span>Section: {sectionLabel}</span></>) : null}
              {sessionName ? (<><span className="text-slate-300">|</span><span>Session: {sessionName}</span></>) : null}
            </p>
            <div className="flex flex-wrap gap-x-6 gap-y-1.5 pt-1 text-sm text-slate-600">
              <span className="inline-flex items-center gap-2"><User size={15} className="text-slate-400" />Parent Name: {student?.guardianName || 'Guardian not added'}</span>
              <span className="inline-flex items-center gap-2"><Phone size={15} className="text-slate-400" />{student?.guardianPhone || student?.mobile || 'Not provided'}</span>
              <span className="inline-flex items-center gap-2 min-w-0"><Mail size={15} className="text-slate-400" /><span className="truncate">{student?.guardianEmail || student?.email || 'Not provided'}</span></span>
            </div>
          </div>
          {/* <div className="flex shrink-0 flex-wrap gap-2">
            {payments.length ? (
              <button
                onClick={() => handleDownloadReceipt(payments[0])}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
              >
                <Download size={16} className="text-indigo-500" />
                Latest Receipt
              </button>
            ) : null}
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50"
            >
              <Printer size={16} className="text-indigo-500" />
              Print Statement
            </button>
          </div> */}
        </div>

        <div className="grid grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
          {/* ── Left column ── */}
          <div className="min-w-0 space-y-5">
            {/* Stats + late fee */}
            <div className={`${cardCls} p-3 sm:p-4`}>
              <div className="grid grid-cols-1 sm:grid-cols-2 2xl:grid-cols-4 sm:divide-x-0 2xl:divide-x divide-slate-100">
                <StatCard icon={FileText} iconCls="bg-indigo-50 text-indigo-500" label="Total Fee" value={formatCurrency(totals.total)} valueCls="text-slate-900" />
                <StatCard icon={FileCheck} iconCls="bg-emerald-50 text-emerald-600" label="Total Paid" value={formatCurrency(totals.paid)} valueCls="text-emerald-600" />
                <StatCard
                  icon={FileText}
                  iconCls="bg-amber-50 text-amber-500"
                  label="Remaining"
                  value={formatCurrency(totals.balance)}
                  valueCls={totals.balance > 0 ? 'text-rose-600' : 'text-emerald-600'}
                  extra={totals.discount > 0 ? <p className="text-xs text-emerald-600">Discount {formatCurrency(totals.discount)} applied</p> : null}
                />
                <div className="flex min-w-0 items-center gap-4 px-4 py-3">
                  <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-indigo-500">
                    <CalendarDays size={22} />
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-sm text-slate-500">Due Status</p>
                      <span className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${statusBadge}`}>
                        {(invoice.status || 'due').toUpperCase()}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {dueStatusText}{invoice.dueDate ? ` · Due ${formatDMY(invoice.dueDate)}` : ''}
                    </p>
                  </div>
                </div>
              </div>

              {(fineSummary.perDayFine > 0 || fineSummary.appliedFine > 0) && (
                <div className="mt-3 rounded-xl border border-amber-200 bg-amber-50/70">
                  <button
                    type="button"
                    onClick={() => setFineOpen((v) => !v)}
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3 text-left"
                  >
                    <span className="inline-flex items-center gap-2 text-sm font-semibold text-amber-800">
                      <AlertTriangle size={17} className="text-amber-500" />
                      Late fee: {formatCurrency(fineSummary.appliedFine)} applied
                      <Info size={14} className="text-amber-600" />
                    </span>
                    <span className="ml-auto flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span>Fine per day <b className="ml-1 text-slate-800">{formatCurrency(fineSummary.perDayFine)}</b></span>
                      <span className="text-slate-300">|</span>
                      <span>Total fine applied <b className="ml-1 text-slate-800">{formatCurrency(fineSummary.appliedFine)}</b></span>
                      <span className="text-slate-300">|</span>
                      <span>Today&apos;s status: <b className="ml-1 text-slate-800">{fineSummary.todayFineApplied ? `${formatCurrency(fineSummary.todayFineAmount)} added today` : 'No fine added today'}</b></span>
                    </span>
                    <ChevronDown size={16} className={`shrink-0 text-slate-500 transition-transform ${fineOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {fineOpen && (
                    <div className="border-t border-amber-200/70 px-4 py-2.5 text-xs text-amber-800">
                      {fineSummary.overdueDays > 0
                        ? `Invoice is overdue by ${fineSummary.overdueDays} day${fineSummary.overdueDays > 1 ? 's' : ''}. A fine of ${formatCurrency(fineSummary.perDayFine)} is added for each overdue day while a balance remains.`
                        : 'Invoice is not overdue. No daily fine is being added.'}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Fee breakdown + installments */}
            <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
              <div className={`${cardCls} p-4 sm:p-5`}>
                <SectionTitle
                  icon={FileText}
                  title="Fee Breakdown"
                  subtitle="Complete list of fee heads for this academic year"
                  action={
                    <button
                      type="button"
                      onClick={() => navigate('/admin/fees/manage')}
                      className="shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-100"
                    >
                      View Fee Structure
                    </button>
                  }
                />
                <div className="mt-4 overflow-hidden rounded-lg">
                  <div className="flex justify-between bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
                    <span>Fee Head</span><span>Amount</span>
                  </div>
                  {feeHeads.length || lateFeeAmount > 0 ? (
                    <div className="divide-y divide-slate-100">
                      {feeHeads.map((head, idx) => (
                        <div key={`${head.label}-${idx}`} className="flex justify-between gap-3 px-3 py-2 text-sm text-slate-700">
                          <span className="min-w-0">{head.label}</span>
                          <span className="tabular-nums">{formatCurrency(head.amount)}</span>
                        </div>
                      ))}
                      {lateFeeAmount > 0 && (
                        <div className="flex justify-between gap-3 px-3 py-2 text-sm text-slate-700">
                          <span>Late fee</span>
                          <span className="tabular-nums">{formatCurrency(lateFeeAmount)}</span>
                        </div>
                      )}
                    </div>
                  ) : (
                    <p className="px-3 py-4 text-sm text-slate-500">No fee heads added.</p>
                  )}
                  <div className="mt-1 flex justify-between rounded-lg bg-indigo-50/60 px-3 py-3">
                    <span className="text-sm font-semibold text-slate-800">Total Fee</span>
                    <span className="text-lg font-bold tabular-nums text-slate-900">{formatCurrency(feeHeads.length ? feeHeadsTotal : totals.total)}</span>
                  </div>
                </div>
              </div>

              <div className={`${cardCls} p-4 sm:p-5`}>
                <SectionTitle icon={CalendarDays} title="Installment Schedule" subtitle="Click an installment to fill its amount in Collect Payment" />
                <div className="mt-4 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                        <th className="px-3 py-2 text-left">Installment</th>
                        <th className="px-3 py-2 text-left">Due Date</th>
                        <th className="px-3 py-2 text-right">Amount</th>
                        <th className="px-3 py-2 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 text-slate-700">
                      {installmentRows.length ? installmentRows.map(({ inst, idx, status, remaining }) => {
                        const isPaid = status === 'paid';
                        return (
                          <tr
                            key={`${inst.label}-${idx}`}
                            onClick={isPaid ? undefined : () => handleSelectInstallment({ ...inst, amount: remaining }, idx)}
                            className={`transition-colors ${
                              isPaid
                                ? 'cursor-default text-slate-400'
                                : selectedInstallment === idx ? 'cursor-pointer bg-indigo-50 text-indigo-700' : 'cursor-pointer hover:bg-slate-50'
                            }`}
                            title={isPaid ? 'This installment is fully paid' : 'Click to fill this amount in Collect Payment'}
                          >
                            <td className="px-3 py-2.5">{inst.label}</td>
                            <td className="px-3 py-2.5 whitespace-nowrap">{formatDMY(inst.dueDate)}</td>
                            <td className="px-3 py-2.5 text-right tabular-nums">
                              {formatCurrency(inst.amount)}
                              {status === 'partial' && (
                                <p className="text-[11px] font-medium text-amber-600">{formatCurrency(remaining)} left</p>
                              )}
                            </td>
                            <td className="px-3 py-2.5 text-center">
                              <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-semibold ${INSTALLMENT_STATUS[status].cls}`}>
                                <span className={`h-1.5 w-1.5 rounded-full ${INSTALLMENT_STATUS[status].dot}`} />
                                {INSTALLMENT_STATUS[status].label}
                              </span>
                            </td>
                          </tr>
                        );
                      }) : (
                        <tr><td colSpan={4} className="px-3 py-6 text-center text-sm text-slate-500">No installments defined.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>

            {/* Payment history */}
            <div className={`${cardCls} p-4 sm:p-5`}>
              <SectionTitle icon={Clock} title="Payment History" subtitle="All payment records for this student" />
              <div className="mt-4 overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead>
                    <tr className="bg-slate-50 text-xs font-semibold text-slate-600">
                      <th className="px-3 py-2.5 text-left">#</th>
                      <th className="px-3 py-2.5 text-left">Date &amp; Time</th>
                      <th className="px-3 py-2.5 text-left">Amount</th>
                      <th className="px-3 py-2.5 text-left">Method</th>
                      <th className="px-3 py-2.5 text-left">Receipt No.</th>
                      <th className="px-3 py-2.5 text-left">Notes</th>
                      <th className="px-3 py-2.5 text-left">Status</th>
                      <th className="px-3 py-2.5 text-right">Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {payments.length ? payments.map((payment, idx) => (
                      <tr key={payment._id}>
                        <td className="px-3 py-2.5 text-slate-500">{idx + 1}</td>
                        <td className="px-3 py-2.5 whitespace-nowrap">{formatDateTime(payment.paidOn || payment.createdAt)}</td>
                        <td className="px-3 py-2.5 font-semibold tabular-nums text-slate-900">{formatCurrency(payment.amount)}</td>
                        <td className="px-3 py-2.5 capitalize">{paymentMethodMeta(payment.method).label}{payment.bankName ? ` · ${payment.bankName}` : ''}</td>
                        <td className="px-3 py-2.5">
                          <p className="font-mono text-xs font-semibold text-slate-800">{payment.receiptNumber || "-"}</p>
                          {payment.referenceNumber || payment.gatewayPaymentId ? (
                            <p className="font-mono text-[11px] text-slate-400">Ref: {payment.referenceNumber || payment.gatewayPaymentId}</p>
                          ) : null}
                        </td>
                        <td className="px-3 py-2.5 max-w-[180px] truncate text-slate-500">{payment.notes || '-'}</td>
                        <td className="px-3 py-2.5">
                          <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-xs font-semibold capitalize text-emerald-600">
                            {payment.status || 'Paid'}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-right">
                          <button
                            onClick={() => handleDownloadReceipt(payment)}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            <Download size={13} />
                            PDF
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan={8} className="py-10 text-center">
                          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                            <FileText size={18} />
                          </div>
                          <p className="text-sm font-medium text-slate-700">No payment records yet</p>
                          <p className="text-xs text-slate-500">Collect a payment to populate this list.</p>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* ── Right column: collect payment + discount ── */}
          <div className={`${cardCls} h-fit p-4 sm:p-5 xl:sticky xl:top-4`}>
            <SectionTitle icon={Wallet} tone="emerald" title="Collect Payment" subtitle="Record a new payment for this student" />

            {actionMessage.text ? (
              <div className={`mt-4 flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                actionMessage.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'
              }`}>
                {actionMessage.type !== 'success' && <AlertCircle size={14} className="shrink-0" />}
                {actionMessage.text}
              </div>
            ) : null}

            <div className="mt-4 space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Amount <span className="text-rose-500">*</span></label>
                <div className="flex overflow-hidden rounded-lg border border-slate-200 focus-within:border-indigo-400 focus-within:ring-2 focus-within:ring-indigo-400/30">
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={paymentForm.amount}
                    ref={amountInputRef}
                    onChange={(e) => { setSelectedInstallment(null); setPaymentForm((prev) => ({ ...prev, amount: e.target.value })); }}
                    className="w-full px-3 py-2.5 text-sm focus:outline-none"
                    placeholder="0"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Payment Method <span className="text-rose-500">*</span></label>
                <div className="grid grid-cols-2 gap-2">
                  {PAYMENT_METHODS.map(({ key, label, icon: MethodIcon }) => {
                    const active = paymentForm.method === key;
                    return (
                      <button
                        key={key}
                        type="button"
                        onClick={() => setPaymentForm((prev) => ({ ...prev, method: key, referenceNumber: '', bankName: '' }))}
                        className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 text-sm font-medium transition-all ${
                          key === 'razorpay' ? 'col-span-2' : ''
                        } ${active
                          ? 'border-indigo-400 bg-indigo-50 text-indigo-700 ring-1 ring-indigo-300'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                      >
                        <MethodIcon size={16} className={active ? 'text-indigo-600' : 'text-indigo-400'} />
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {activeMethod.referenceLabel && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">
                    {activeMethod.referenceLabel} <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                    className={inputCls}
                    placeholder={activeMethod.referencePlaceholder}
                  />
                </div>
              )}

              {activeMethod.needsBank && (
                <div>
                  <label className="mb-1.5 block text-sm font-medium text-slate-700">Bank Name <span className="text-rose-500">*</span></label>
                  <input
                    type="text"
                    value={paymentForm.bankName}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, bankName: e.target.value }))}
                    className={inputCls}
                    placeholder="e.g. HDFC Bank"
                  />
                </div>
              )}

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Notes (Optional)</label>
                <textarea
                  rows={3}
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                  className={`${inputCls} resize-none`}
                  placeholder="Any additional notes..."
                />
              </div>

              <button
                onClick={handlePaymentSave}
                disabled={savingPayment}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:bg-slate-300"
              >
                {savingPayment ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard size={16} />}
                {paymentForm.method === 'razorpay' ? 'Pay Online via Razorpay' : 'Record Payment'}
              </button>

              {paymentForm.method === 'razorpay' && (
                <div className="space-y-1.5">
                  <button
                    onClick={handleOpenQr}
                    disabled={creatingQr || Boolean(activeQrCodeId) || !paymentForm.amount}
                    className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {creatingQr ? <Loader2 className="h-4 w-4 animate-spin" /> : <MonitorSmartphone className="h-4 w-4" />}
                    {activeQrCodeId ? 'Waiting for QR payment…' : 'Open UPI QR on Second Screen'}
                  </button>
                  <p className="flex items-start gap-1.5 text-xs text-slate-400">
                    <QrCode className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    Opens a QR in a new window — the payment is recorded automatically once it succeeds.
                  </p>
                </div>
              )}
            </div>

            <div className="my-5 border-t border-slate-200" />

            <div className="flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-500">
                <Percent size={18} />
              </span>
              <h3 className="text-base font-semibold text-slate-900">Apply Discount</h3>
            </div>
            <div className="mt-4 space-y-3">
              <div>
                <div className={`flex overflow-hidden rounded-lg border focus-within:ring-2 ${
                  discountError
                    ? 'border-rose-400 focus-within:border-rose-400 focus-within:ring-rose-400/30'
                    : 'border-slate-200 focus-within:border-indigo-400 focus-within:ring-indigo-400/30'
                }`}>
                  <span className="flex items-center border-r border-slate-200 bg-slate-50 px-3 text-sm text-slate-500">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={discountForm.amount}
                    onChange={(e) => setDiscountForm((prev) => ({ ...prev, amount: e.target.value }))}
                    className="w-full px-3 py-2.5 text-sm focus:outline-none"
                    placeholder="0"
                    aria-invalid={Boolean(discountError)}
                  />
                </div>
                {discountError ? (
                  <p className="mt-1.5 flex items-start gap-1.5 text-xs font-medium text-rose-600">
                    <AlertCircle size={13} className="mt-px shrink-0" />
                    {discountError}
                  </p>
                ) : (
                  <p className="mt-1.5 text-xs text-slate-400">Max discount: {formatCurrency(maxDiscount)}</p>
                )}
              </div>
              <input
                type="text"
                value={discountForm.note}
                onChange={(e) => setDiscountForm((prev) => ({ ...prev, note: e.target.value }))}
                className={inputCls}
                placeholder="Discount note (optional)"
              />
              <button
                onClick={handleDiscountSave}
                disabled={savingDiscount || Boolean(discountError)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 bg-slate-100 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-200 disabled:opacity-60"
              >
                {savingDiscount ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Save Discount
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StudentFeeDetails;
