import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CalendarCheck,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileText,
  Info,
  Loader2,
  Lock,
  Receipt,
  RefreshCw,
  Wallet,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadFeeReceiptPdf } from '../utils/feeReceiptPdf';
import { downloadFeesStructurePdf } from '../utils/feesStructurePdf';
import { parentApiFetch } from './parentApi';
import { useSharedChildSelection, childOptionKey } from './ChildSwitcher';
import { useDialog } from './useDialog';
import './FeesPayment.css';

const AVATAR_STYLES = [
  'from-purple-100 to-purple-200 text-purple-700',
  'from-emerald-100 to-emerald-200 text-emerald-700',
  'from-amber-100 to-amber-200 text-amber-700',
  'from-sky-100 to-sky-200 text-sky-700',
  'from-rose-100 to-rose-200 text-rose-700',
];

const DEFAULT_PDF_SCHOOL = {
  schoolName: '',
  schoolAddressLine: '',
  schoolContactLine: '',
  logoUrl: '',
  logoUrlOverride: '',
  accentColor: '#0f172a',
};

const toAmount = (value) => {
  const amount = Number(value || 0);
  return Number.isFinite(amount) ? amount : 0;
};

const getInvoiceTitle = (invoice) => invoice?.title || invoice?.description || 'Fee Invoice';
const getInvoiceTotal = (invoice) => toAmount(invoice?.totalAmount ?? invoice?.amount);
const getInvoicePaid = (invoice) => toAmount(invoice?.paidAmount);
const getInvoiceBalance = (invoice) => {
  if (invoice?.balanceAmount !== undefined && invoice?.balanceAmount !== null) {
    return Math.max(0, toAmount(invoice.balanceAmount));
  }
  return Math.max(0, getInvoiceTotal(invoice) - getInvoicePaid(invoice));
};

const formatCurrency = (value) => new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
}).format(toAmount(value));

const formatDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const isPastDue = (value) => {
  if (!value) return false;
  const due = new Date(value);
  if (Number.isNaN(due.getTime())) return false;
  const today = new Date();
  due.setHours(0, 0, 0, 0);
  today.setHours(0, 0, 0, 0);
  return due < today;
};

const getRelativeDueLabel = (date) => {
  if (!date) return 'All settled';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const due = new Date(date);
  due.setHours(0, 0, 0, 0);
  const days = Math.round((due - today) / 86400000);
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'} overdue`;
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  return `In ${days} days`;
};

const getInvoiceSessionLabel = (invoice) => {
  const year = invoice?.academicYearId;
  if (year && typeof year === 'object' && year.name) return year.name;
  return invoice?.session || 'Other Session';
};

const getInitials = (name) => {
  const parts = String(name || 'Child').trim().split(/\s+/).filter(Boolean);
  return `${parts[0]?.[0] || 'C'}${parts.length > 1 ? parts[parts.length - 1][0] : ''}`.toUpperCase();
};

const getChildClass = (child) => child?.grade || child?.class || '';
const buildChildKey = (child) => (child?.id || child?._id
  ? `id:${child.id || child._id}`
  : `name:${child?.name || ''}`);
const getChildId = (child) => child?.id || child?._id || '';

const getInstallmentBreakdown = (invoice, paymentsAsc = []) => {
  const installments = Array.isArray(invoice?.installmentsSnapshot) ? invoice.installmentsSnapshot : [];
  if (!installments.length) return [];

  let remainingPaid = getInvoicePaid(invoice);
  let priorFullyPaid = true;
  let cumulativeThreshold = 0;
  let runningPaymentTotal = 0;
  let paymentPtr = 0;

  return installments.map((installment, index) => {
    const amount = toAmount(installment?.amount);
    const paidTowards = Math.max(0, Math.min(amount, remainingPaid));
    const isPaid = amount > 0 && paidTowards >= amount;
    const isLocked = !priorFullyPaid;
    const progressPct = amount > 0 ? Math.round((paidTowards / amount) * 100) : 0;

    remainingPaid = Math.max(0, remainingPaid - amount);
    priorFullyPaid = isPaid;
    cumulativeThreshold += amount;

    let receiptPayment = null;
    if (isPaid) {
      while (paymentPtr < paymentsAsc.length && runningPaymentTotal < cumulativeThreshold) {
        runningPaymentTotal += toAmount(paymentsAsc[paymentPtr]?.amount);
        receiptPayment = paymentsAsc[paymentPtr];
        paymentPtr += 1;
      }
    }

    return {
      id: installment?._id || `${invoice._id}-installment-${index}`,
      index,
      label: installment?.label || `Installment ${index + 1}`,
      amount,
      dueDate: installment?.dueDate,
      remaining: Math.max(0, amount - paidTowards),
      isPaid,
      isLocked,
      progressPct,
      receiptPayment,
    };
  });
};

const getNextInvoiceDueDate = (invoice) => {
  const nextInstallment = getInstallmentBreakdown(invoice).find((installment) => !installment.isPaid);
  return nextInstallment?.dueDate || invoice?.dueDate || null;
};

// Single shared loader so the Fees screen can warm the script on mount and the
// "Pay Now" click can reuse the same in-flight/settled promise instead of
// racing a fresh <script> tag at the worst possible moment.
let razorpayScriptPromise = null;
const loadRazorpayScript = ({ retry = false } = {}) => {
  if (typeof window === 'undefined') return Promise.resolve(false);
  if (window.Razorpay) return Promise.resolve(true);
  if (retry) razorpayScriptPromise = null;
  if (razorpayScriptPromise) return razorpayScriptPromise;

  razorpayScriptPromise = new Promise((resolve) => {
    const existing = document.querySelector('script[src="https://checkout.razorpay.com/v1/checkout.js"]');
    const script = existing || document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.async = true;
    script.addEventListener('load', () => resolve(true), { once: true });
    script.addEventListener('error', () => {
      razorpayScriptPromise = null; // allow a later retry
      resolve(false);
    }, { once: true });
    if (!existing) document.body.appendChild(script);
  });
  return razorpayScriptPromise;
};

const getStoredToken = () => {
  try {
    if (typeof global !== 'undefined' && global.localStorage?.getItem) {
      const token = global.localStorage.getItem('token') || '';
      if (token) return token;
    }
  } catch {
    // Continue to the browser storage fallback.
  }
  try {
    const token = window.localStorage?.getItem('token') || '';
    if (token) return token;
  } catch {
    // Treat storage access errors as a signed-out session.
  }
  return '';
};

const STATUS_PILL = {
  paid: 'bg-green-50 text-green-600 font-bold',
  due: 'bg-amber-50 text-amber-600',
  overdue: 'bg-red-50 text-red-600',
};
const STATUS_LABEL = { paid: 'Paid', due: 'Due', overdue: 'Overdue' };

const ChildAvatar = ({ child, index }) => {
  const photo = child?.profilePic || child?.photo || '';
  if (photo) {
    return <img src={photo} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />;
  }
  return (
    <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-sm font-semibold ${AVATAR_STYLES[index % AVATAR_STYLES.length]}`}>
      {getInitials(child?.name)}
    </span>
  );
};

const FeesPayment = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loadingChildren, setLoadingChildren] = useState(true);
  const [loadingInvoices, setLoadingInvoices] = useState(false);
  const [error, setError] = useState('');
  const [invoices, setInvoices] = useState([]);
  const [paymentsByInvoice, setPaymentsByInvoice] = useState({});
  const [amounts, setAmounts] = useState({});
  const [sessionFilter, setSessionFilter] = useState('');
  const [selectedInvoiceId, setSelectedInvoiceId] = useState('');
  const [processingInvoiceId, setProcessingInvoiceId] = useState('');
  const [downloadingReceiptId, setDownloadingReceiptId] = useState('');
  const [showFeeBreakdown, setShowFeeBreakdown] = useState(false);
  const [pdfSchool, setPdfSchool] = useState(DEFAULT_PDF_SCHOOL);
  const [downloadingFeesCardId, setDownloadingFeesCardId] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  // idle → loading → ready | unreachable — drives the checkout fallback message.
  const [razorpayState, setRazorpayState] = useState('idle');

  const childOptions = useMemo(
    () => children.map((child) => ({ id: String(child?._id || child?.id || ''), name: child?.name || 'Child' })),
    [children],
  );
  const [, setChildKey, selectedChildOption] = useSharedChildSelection(childOptions);

  const selectedChild = useMemo(() => {
    if (!children.length || !selectedChildOption) return null;
    return children.find((child) => {
      const id = String(child?._id || child?.id || '');
      if (selectedChildOption.id && id) return id === selectedChildOption.id;
      return (child?.name || 'Child') === selectedChildOption.name;
    }) || null;
  }, [children, selectedChildOption]);
  const selectedChildId = selectedChild ? buildChildKey(selectedChild) : '';
  const pickChild = (child) => setChildKey(
    childOptionKey({ id: String(child?._id || child?.id || ''), name: child?.name || 'Child' }),
  );

  const breakdownDialogRef = useDialog(showFeeBreakdown, () => setShowFeeBreakdown(false));

  const showError = (message) => {
    const text = message || 'Something went wrong';
    setError(text);
    toast.error(text);
  };

  const fetchChildren = async () => {
    const token = getStoredToken();
    setLoadingChildren(true);
    setError('');
    setSuccessMessage('');
    try {
      if (!token) throw new Error('Login required. Please sign in again.');
      const res = await parentApiFetch('/api/fees/parent/children', {}, navigate);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load children');
      const list = Array.isArray(data.children) ? data.children : [];
      setChildren(list);
    } catch (err) {
      setChildren([]);
      showError(err.message || 'Unable to load children');
    } finally {
      setLoadingChildren(false);
    }
  };

  const fetchInvoices = async (childId) => {
    if (!childId) {
      setInvoices([]);
      setPaymentsByInvoice({});
      return;
    }
    const token = getStoredToken();
    setLoadingInvoices(true);
    setError('');
    setSuccessMessage('');
    try {
      if (!token) throw new Error('Login required. Please sign in again.');
      const res = await parentApiFetch(`/api/fees/parent/invoices?studentId=${childId}`, {}, navigate);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load invoices');
      const list = Array.isArray(data.invoices) ? data.invoices : [];
      setInvoices(list);
      setPaymentsByInvoice(data.paymentsByInvoice || {});
      setAmounts(Object.fromEntries(list.map((invoice) => [invoice._id, getInvoiceBalance(invoice)])));
    } catch (err) {
      setInvoices([]);
      setPaymentsByInvoice({});
      showError(err.message || 'Unable to load invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleRefresh = async () => {
    await fetchChildren();
    const childId = getChildId(selectedChild);
    if (childId) await fetchInvoices(childId);
  };

  const fetchPdfSchool = async () => {
    const token = getStoredToken();
    if (!token) return;
    try {
      const res = await parentApiFetch('/api/reports/report-cards/parent', {}, navigate);
      const data = await res.json().catch(() => ({}));
      const template = res.ok ? data?.template : null;
      if (template && typeof template === 'object') {
        setPdfSchool({
          schoolName: String(template.schoolName || '').trim(),
          schoolAddressLine: String(template.schoolAddressLine || '').trim(),
          schoolContactLine: String(template.schoolContactLine || '').trim(),
          logoUrl: String(template.logoUrl || '').trim(),
          logoUrlOverride: String(template.logoUrlOverride || '').trim(),
          accentColor: String(template.accentColor || '#0f172a').trim() || '#0f172a',
        });
      }
    } catch {
      // The fee card can still use its default branding.
    }
  };

  useEffect(() => {
    fetchChildren();
    fetchPdfSchool();
  }, []);

  // Warm the Razorpay checkout script as soon as the Fees screen opens, so a
  // blocked or slow network surfaces before the parent commits to paying.
  const warmRazorpay = useCallback((retry = false) => {
    setRazorpayState((prev) => (prev === 'ready' ? prev : 'loading'));
    return loadRazorpayScript({ retry }).then((ok) => {
      setRazorpayState(ok ? 'ready' : 'unreachable');
      return ok;
    });
  }, []);

  useEffect(() => {
    warmRazorpay();
  }, [warmRazorpay]);

  const officeContact = String(pdfSchool?.schoolContactLine || '').trim();
  const paymentUnreachableMessage = officeContact
    ? `Online payment isn't reachable right now — pay at the school office (${officeContact}) or try again in a moment.`
    : "Online payment isn't reachable right now — pay at the school office or try again in a moment.";

  useEffect(() => {
    fetchInvoices(getChildId(selectedChild));
  }, [selectedChildId]);

  const handleDownloadReceipt = async (payment, invoice) => {
    if (!payment?._id) {
      showError('Receipt not available for this payment');
      return;
    }
    setDownloadingReceiptId(payment._id);
    setError('');
    setSuccessMessage('');
    try {
      const res = await parentApiFetch(`/api/fees/parent/payments/${payment._id}/receipt`, {}, navigate);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to load receipt');
      await downloadFeeReceiptPdf({
        invoice: data.invoice || invoice,
        student: data.student || selectedChild,
        payment: data.payment || payment,
        receipt: data.receipt || null,
        school: data.school || null,
        schoolName: data.school?.name || 'School',
      });
      setSuccessMessage('Receipt downloaded successfully.');
    } catch (err) {
      showError(err.message || 'Unable to download receipt');
    } finally {
      setDownloadingReceiptId('');
    }
  };

  const handleDownloadFeesCard = async (invoice) => {
    if (!invoice) return;
    setDownloadingFeesCardId(invoice._id);
    setError('');
    setSuccessMessage('');
    try {
      await downloadFeesStructurePdf({
        structure: {
          className: invoice.className || getChildClass(selectedChild),
          board: 'GENERAL',
          academicYearName: getInvoiceSessionLabel(invoice),
          name: getInvoiceTitle(invoice),
          feeHeads: Array.isArray(invoice.feeHeadsSnapshot) ? invoice.feeHeadsSnapshot : [],
          installments: Array.isArray(invoice.installmentsSnapshot) ? invoice.installmentsSnapshot : [],
          totalAmount: getInvoiceTotal(invoice),
          lateFeeAmount: invoice.lateFeeRuleSnapshot?.amount || 0,
        },
        school: pdfSchool,
      });
      setSuccessMessage('Fees card downloaded successfully.');
    } catch {
      showError('Unable to generate fees card PDF');
    } finally {
      setDownloadingFeesCardId('');
    }
  };

  const handlePayNow = async (invoice, amountOverride) => {
    const paymentAmount = Number(amountOverride ?? amounts[invoice._id] ?? getInvoiceBalance(invoice));
    setProcessingInvoiceId(invoice._id);
    setError('');
    setSuccessMessage('');
    try {
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) throw new Error('Enter a valid amount');
      if (paymentAmount > getInvoiceBalance(invoice)) throw new Error('Amount cannot exceed the outstanding balance');
      const orderRes = await parentApiFetch(`/api/fees/${invoice._id}/pay`, {
        method: 'POST',
        body: JSON.stringify({ amount: paymentAmount }),
      }, navigate);
      const orderData = await orderRes.json();
      if (!orderRes.ok) throw new Error(orderData?.error || 'Failed to create payment order');
      if (!(await warmRazorpay(true))) throw new Error(paymentUnreachableMessage);
      if (!orderData.keyId) throw new Error('Razorpay key is missing');

      const razorpay = new window.Razorpay({
        key: orderData.keyId,
        amount: orderData.order?.amount,
        currency: orderData.order?.currency || 'INR',
        name: 'School Fees',
        description: getInvoiceTitle(invoice),
        order_id: orderData.order?.id,
        prefill: { name: selectedChild?.name || 'Parent' },
        theme: { color: '#8b5cf6' },
        modal: { ondismiss: () => setProcessingInvoiceId('') },
        handler: async (response) => {
          try {
            const verifyRes = await parentApiFetch('/api/fees/payments/razorpay/verify', {
              method: 'POST',
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            }, navigate);
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) throw new Error(verifyData?.error || 'Payment verification failed');
            setSuccessMessage('Payment successful. Invoice updated.');
            await fetchInvoices(getChildId(selectedChild));
          } catch (verifyError) {
            showError(verifyError.message || 'Unable to verify payment');
          } finally {
            setProcessingInvoiceId('');
          }
        },
      });
      razorpay.open();
    } catch (payError) {
      showError(payError.message || 'Payment failed');
      setProcessingInvoiceId('');
    }
  };

  const sessionOptions = useMemo(() => {
    const map = new Map();
    invoices.forEach((invoice) => {
      const year = invoice?.academicYearId;
      const label = getInvoiceSessionLabel(invoice);
      if (!map.has(label)) {
        map.set(label, {
          label,
          isActive: Boolean(year && typeof year === 'object' && year.isActive),
          sortKey: year && typeof year === 'object' && year.startDate ? new Date(year.startDate).getTime() : 0,
        });
      }
    });
    return [...map.values()].sort((a, b) => b.sortKey - a.sortKey);
  }, [invoices]);

  useEffect(() => {
    if (!sessionOptions.length) {
      setSessionFilter('');
      return;
    }
    if (!sessionOptions.some((option) => option.label === sessionFilter)) {
      setSessionFilter(sessionOptions.find((option) => option.isActive)?.label || sessionOptions[0].label);
    }
  }, [sessionOptions, sessionFilter]);

  const sessionInvoices = useMemo(
    () => invoices.filter((invoice) => getInvoiceSessionLabel(invoice) === sessionFilter),
    [invoices, sessionFilter]
  );

  useEffect(() => {
    const firstPending = sessionInvoices.find((invoice) => getInvoiceBalance(invoice) > 0);
    setSelectedInvoiceId(firstPending?._id || sessionInvoices[0]?._id || '');
  }, [sessionInvoices]);

  const totals = useMemo(() => sessionInvoices.reduce(
    (acc, invoice) => ({
      total: acc.total + getInvoiceTotal(invoice),
      paid: acc.paid + getInvoicePaid(invoice),
      balance: acc.balance + getInvoiceBalance(invoice),
    }),
    { total: 0, paid: 0, balance: 0 }
  ), [sessionInvoices]);

  const pendingInvoices = useMemo(
    () => sessionInvoices.filter((invoice) => getInvoiceBalance(invoice) > 0),
    [sessionInvoices]
  );

  const nearestDueDate = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return pendingInvoices
      .map(getNextInvoiceDueDate)
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .map((date) => {
        date.setHours(0, 0, 0, 0);
        return date;
      })
      .filter((date) => date >= today)
      .sort((a, b) => a - b)[0] || null;
  }, [pendingInvoices]);

  const selectedInvoice = useMemo(
    () => sessionInvoices.find((invoice) => invoice._id === selectedInvoiceId) || null,
    [sessionInvoices, selectedInvoiceId]
  );

  const installmentBreakdown = useMemo(() => {
    if (!selectedInvoice) return [];
    const paymentsAsc = [...(paymentsByInvoice[selectedInvoice._id] || [])].reverse();
    return getInstallmentBreakdown(selectedInvoice, paymentsAsc);
  }, [selectedInvoice, paymentsByInvoice]);

  useEffect(() => setShowFeeBreakdown(false), [selectedInvoiceId]);

  const activeInstallment = installmentBreakdown.find((installment) => !installment.isPaid && !installment.isLocked);
  const selectedBalance = getInvoiceBalance(selectedInvoice);
  const isProcessingSelected = selectedInvoice && processingInvoiceId === selectedInvoice._id;

  // One table row per installment (or per invoice when it has no plan). Late
  // fines are added to the invoice total by the server, so whatever balance is
  // left after the installments' own remainders is the outstanding fine — it is
  // charged on the installment that is currently open.
  const transactionRows = useMemo(() => sessionInvoices.flatMap((invoice) => {
    const payments = paymentsByInvoice[invoice._id] || [];
    const latestPayment = payments[0] || null;
    const balance = getInvoiceBalance(invoice);
    const installments = getInstallmentBreakdown(invoice, [...payments].reverse());
    const invoiceRef = `INV-${String(invoice._id || '').slice(-6).toUpperCase()}`;

    if (!installments.length) {
      const fine = toAmount(invoice.lateFeeAmountApplied);
      const total = getInvoiceTotal(invoice);
      const isPaid = balance <= 0;
      return [{
        key: invoice._id,
        invoice,
        date: invoice.dueDate || invoice.createdAt,
        label: getInvoiceTitle(invoice),
        subLabel: '',
        amount: Math.max(0, total - fine),
        fine,
        total,
        payable: balance,
        status: isPaid ? 'paid' : isPastDue(invoice.dueDate) ? 'overdue' : 'due',
        isLocked: false,
        payment: latestPayment,
        reference: latestPayment?.receiptNumber || invoiceRef,
      }];
    }

    const fineDue = Math.max(0, balance - installments.reduce((sum, item) => sum + item.remaining, 0));
    return installments.map((installment) => {
      const isOpen = !installment.isPaid && !installment.isLocked;
      const fine = isOpen ? fineDue : 0;
      return {
        key: installment.id,
        invoice,
        installment,
        date: installment.dueDate || invoice.dueDate || invoice.createdAt,
        label: installment.label,
        subLabel: getInvoiceTitle(invoice),
        amount: installment.amount,
        fine,
        total: installment.amount + fine,
        payable: Math.min(balance, installment.remaining + fine),
        status: installment.isPaid ? 'paid' : isPastDue(installment.dueDate || invoice.dueDate) ? 'overdue' : 'due',
        isLocked: installment.isLocked,
        payment: installment.isPaid ? installment.receiptPayment || latestPayment : null,
        reference: (installment.isPaid && installment.receiptPayment?.receiptNumber) || `${invoiceRef}-${installment.index + 1}`,
      };
    });
  }), [sessionInvoices, paymentsByInvoice]);

  const [statusFilter, setStatusFilter] = useState('all');
  const visibleRows = statusFilter === 'all'
    ? transactionRows
    : transactionRows.filter((row) => row.status === statusFilter);

  const fineDueTotal = useMemo(() => sessionInvoices.reduce((sum, invoice) => {
    const balance = getInvoiceBalance(invoice);
    const installments = getInstallmentBreakdown(invoice);
    if (!installments.length) return sum + Math.min(toAmount(invoice.lateFeeAmountApplied), balance);
    return sum + Math.max(0, balance - installments.reduce((acc, item) => acc + item.remaining, 0));
  }, 0), [sessionInvoices]);
  // Per-invoice breakdown for the Late Fine (i) popover. The server charges
  // `lateFeeRuleSnapshot.amount` per overdue day and accumulates it into
  // `lateFeeAmountApplied`, so days charged = applied ÷ daily rate.
  const lateFineDetails = useMemo(() => sessionInvoices
    .filter((invoice) => toAmount(invoice.lateFeeAmountApplied) > 0)
    .map((invoice) => {
      const balance = getInvoiceBalance(invoice);
      const installments = getInstallmentBreakdown(invoice);
      const openInstallment = installments.find((item) => !item.isPaid);
      const applied = toAmount(invoice.lateFeeAmountApplied);
      const rate = toAmount(invoice.lateFeeRuleSnapshot?.amount);
      const outstanding = installments.length
        ? Math.max(0, balance - installments.reduce((acc, item) => acc + item.remaining, 0))
        : Math.min(applied, balance);
      return {
        id: invoice._id,
        label: openInstallment ? `${getInvoiceTitle(invoice)} · ${openInstallment.label}` : getInvoiceTitle(invoice),
        dueDate: openInstallment?.dueDate || invoice.dueDate,
        rate,
        days: rate > 0 ? Math.round(applied / rate) : 0,
        applied,
        outstanding,
        appliedAt: invoice.lateFeeAppliedAt,
        excludeSundays: Boolean(invoice.lateFeeRuleSnapshot?.excludeSundays),
        excludeHolidays: Boolean(invoice.lateFeeRuleSnapshot?.excludeHolidays),
      };
    }), [sessionInvoices]);

  const [lateFineOpen, setLateFineOpen] = useState(false);
  const lateFineDialogRef = useDialog(lateFineOpen, () => setLateFineOpen(false));

  const fineAppliedTotal = sessionInvoices.reduce((sum, invoice) => sum + toAmount(invoice.lateFeeAmountApplied), 0);
  const feesDue = Math.max(0, totals.balance - fineDueTotal);

  const planRows = transactionRows.filter((row) => row.installment && row.invoice._id === selectedInvoiceId);
  const invoicesWithPlans = sessionInvoices.filter((invoice) => (invoice.installmentsSnapshot || []).length > 0);
  const activePlanRow = planRows.find((row) => !row.installment.isPaid && !row.isLocked);
  const mobilePayAmount = activePlanRow?.payable || activeInstallment?.remaining || selectedBalance;

  const [childMenuOpen, setChildMenuOpen] = useState(false);
  const childMenuRef = useRef(null);
  useEffect(() => {
    if (!childMenuOpen) return undefined;
    const close = (event) => {
      if (!childMenuRef.current?.contains(event.target)) setChildMenuOpen(false);
    };
    const onKey = (event) => { if (event.key === 'Escape') setChildMenuOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [childMenuOpen]);

  const selectedChildIndex = Math.max(0, children.findIndex((child) => buildChildKey(child) === selectedChildId));
  const childSubtitle = (child) => {
    const childClass = getChildClass(child);
    return childClass ? `Class ${childClass}${child.section ? ` · Section ${child.section}` : ''}` : 'Not linked to a class';
  };

  const formatMethod = (method) => {
    const value = String(method || '').trim();
    if (!value) return 'Online';
    return value.length <= 4 ? value.toUpperCase() : value.charAt(0).toUpperCase() + value.slice(1);
  };

  const cardClass = 'rounded-2xl border border-slate-200/70 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)] self-start';

  return (
    <div className="fees-dashboard-page w-full bg-[#f5f7fb] px-4 py-4 pb-6 md:px-6">
      <div className="mx-auto w-full max-w-6xl space-y-4" aria-labelledby="fees-dashboard-title">
        {/* Header — title on the left, child picker + refresh on the right.
            The session is picked automatically (active session first). */}
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <h1 id="fees-dashboard-title" className="text-xl font-bold tracking-tight text-slate-900">
                Fees &amp; Payments <span className="sr-only">Fees Payment</span>
              </h1>
              <p className="text-xs text-slate-500">
                Overview of your children&apos;s fee status and payment history
                {sessionFilter ? <> · <span className="font-medium text-slate-700">Session {sessionFilter}</span></> : null}
              </p>
            </div>
          </div>

          <div className="flex w-full items-center gap-2 sm:w-auto">
            <div className="relative min-w-0 flex-1 sm:w-64 sm:flex-none" ref={childMenuRef}>
              {loadingChildren && children.length === 0 ? (
                <div className="flex h-11 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500"><Loader2 className="h-4 w-4 animate-spin text-blue-500" /> Loading children…</div>
              ) : children.length === 0 ? (
                <div className="flex h-11 items-center rounded-xl border border-slate-200 bg-white px-3 text-xs text-slate-500">No students found.</div>
              ) : (
                <>
                  <button
                    type="button"
                    onClick={() => setChildMenuOpen((open) => !open)}
                    aria-haspopup="listbox"
                    aria-expanded={childMenuOpen}
                    aria-label="Select child"
                    className="flex h-11 w-full items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-1.5 text-left shadow-sm transition hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-100"
                  >
                    <ChildAvatar child={selectedChild} index={selectedChildIndex} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-semibold text-slate-900">{selectedChild?.name || 'Select a child'}</span>
                      <span className="block truncate text-[11px] text-slate-500">{selectedChild ? childSubtitle(selectedChild) : ''}</span>
                    </span>
                    <ChevronDown className={`mr-1 h-4 w-4 text-slate-500 transition ${childMenuOpen ? 'rotate-180' : ''}`} />
                  </button>
                  {childMenuOpen && (
                    <ul role="listbox" aria-label="Children" className="absolute right-0 z-30 mt-1.5 max-h-72 w-full min-w-60 overflow-auto rounded-xl border border-slate-200 bg-white p-1 shadow-lg">
                      {children.map((child, index) => {
                        const childKey = buildChildKey(child);
                        const isActive = childKey === selectedChildId;
                        return (
                          <li key={childKey}>
                            <button
                              type="button"
                              role="option"
                              aria-selected={isActive}
                              onClick={() => { pickChild(child); setChildMenuOpen(false); }}
                              className={`flex w-full items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left transition ${isActive ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                            >
                              <ChildAvatar child={child} index={index} />
                              <span className="min-w-0 flex-1 leading-tight">
                                <span className="block truncate text-sm font-semibold text-slate-800">{child.name || 'Child'}</span>
                                <span className="block truncate text-[11px] text-slate-500">{childSubtitle(child)}</span>
                              </span>
                              {isActive && <CheckCircle2 className="h-4 w-4 text-blue-600" />}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </>
              )}
            </div>
            <button
              type="button"
              onClick={handleRefresh}
              disabled={loadingChildren || loadingInvoices}
              aria-label="Refresh"
              title="Refresh"
              className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-white text-blue-600 shadow-sm transition hover:bg-blue-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${loadingChildren || loadingInvoices ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {selectedChild && !getChildId(selectedChild) && <p className="rounded-xl border border-amber-100 bg-amber-50 p-3 text-xs text-amber-700">This child is not linked to a student record. Please contact the school office.</p>}
        {razorpayState === 'unreachable' && (
          <p className="flex flex-wrap items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-800" role="status">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">{paymentUnreachableMessage}</span>
            <button type="button" onClick={() => warmRazorpay(true)} className="font-semibold text-amber-900 underline underline-offset-2">Retry</button>
          </p>
        )}
        {error && <p className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50 p-3 text-xs text-red-600" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}
        {successMessage && <p className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50 p-3 text-xs text-emerald-700" role="status"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {successMessage}</p>}

        {/* Stat cards */}
        <section className="grid gap-3 md:grid-cols-3" aria-label="Fee summary">
          <div className="flex items-center gap-3 rounded-xl border border-red-100 bg-red-50 p-3.5">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-red-200/65 text-red-500"><Wallet className="h-6 w-6" /></span>
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <p className="text-xs font-medium text-red-600">Total Pending</p>
                <span
                  className={`rounded-full px-2.5 py-1 text-xs font-semibold ${pendingInvoices.length
                    ? 'bg-red-100 text-red-600'
                    : 'bg-green-100 text-green-600'
                    }`}
                >
                  {pendingInvoices.length ? `${pendingInvoices.length} due` : 'All clear'}
                </span>
              </div>
              <p className="text-xl font-extrabold tracking-tight text-red-600">{formatCurrency(totals.balance)}</p>
              <p className="text-xs text-slate-500">
                {fineDueTotal > 0 ? `${formatCurrency(feesDue)} fees + ${formatCurrency(fineDueTotal)} fine` : 'No late fine'}
              </p>
            </div>
          </div>

          <button type="button" onClick={() => setStatusFilter('due')} className="flex items-center gap-3 rounded-xl border border-amber-200 bg-amber-100/50 p-3.5 text-left transition hover:shadow-sm">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-amber-200/65 text-amber-500"><CalendarCheck className="h-6 w-6" /></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-slate-600">Upcoming Due</span>
              <span className="block text-xl font-bold tracking-tight text-slate-900">{nearestDueDate ? formatDate(nearestDueDate) : 'No upcoming dues'}</span>
              <span
                className={`block text-xs ${pendingInvoices.length ? 'text-slate-500' : 'text-green-600'
                  }`}
              >
                {pendingInvoices.length
                  ? getRelativeDueLabel(nearestDueDate)
                  : 'All settled'}
              </span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />
          </button>

          <button type="button" onClick={() => setStatusFilter('paid')} className="flex items-center gap-3 rounded-xl border border-green-200 bg-green-100/50 p-3.5 text-left transition hover:shadow-sm">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-green-200/65"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-green-500 text-white"><Check className="h-4 w-4" strokeWidth={3} /></span></span>
            <span className="min-w-0 flex-1">
              <span className="block text-xs font-medium text-slate-600">Total Paid</span>
              <span className="block text-xl font-bold tracking-tight text-slate-900">{formatCurrency(totals.paid)}</span>
              <span className="block text-xs text-slate-500">This session</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-slate-600" />
          </button>
        </section>

        {/* Installment plan */}
        {planRows.length > 0 && (
          <section className={`${cardClass} p-4`} aria-label="Installment breakdown">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><Coins className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Installment Plan</h2>
                  <p className="text-xs text-slate-500">Installments unlock in payment order</p>
                </div>
              </div>
              {invoicesWithPlans.length > 1 && (
                <select
                  value={selectedInvoiceId}
                  onChange={(event) => setSelectedInvoiceId(event.target.value)}
                  aria-label="Select fee plan"
                  className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-700 outline-none focus:ring-2 focus:ring-blue-100"
                >
                  {invoicesWithPlans.map((invoice) => <option key={invoice._id} value={invoice._id}>{getInvoiceTitle(invoice)}</option>)}
                </select>
              )}
            </div>

            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:gap-0">
              {planRows.map((row, index) => {
                const { installment } = row;
                const isOpen = row === activePlanRow;
                const overdue = isOpen && row.status === 'overdue';
                const tone = installment.isPaid
                  ? 'border-green-200 bg-green-100'
                  : isOpen
                    ? overdue ? 'border-red-200 bg-red-50/60' : 'border-red-200 bg-red-100'
                    : 'border-slate-200 bg-slate-50/60';
                return (
                  <React.Fragment key={row.key}>
                    {index > 0 && <span className="hidden h-px w-6 shrink-0 bg-slate-300 lg:block" />}
                    <div className={`min-w-0 flex-1 rounded-xl border p-3 ${tone}`}>
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-800">{installment.label}</p>
                          {/* {isOpen && <p className="truncate text-sm text-slate-600">{row.subLabel}</p>} */}
                          <p className="mt-0.5 text-lg font-bold text-slate-900">{formatCurrency(installment.amount)}</p>
                        </div>
                        {installment.isPaid ? (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-green-600 text-white"><Check className="h-3.5 w-3.5" strokeWidth={3} /></span>
                        ) : isOpen ? (
                          <div className="text-right">
                            <Clock className={`ml-auto h-5 w-5 ${overdue ? 'text-red-500' : 'text-amber-500'}`} />
                            <p className="mt-1 whitespace-nowrap text-xs text-slate-600">Due {formatDate(installment.dueDate)}</p>
                          </div>
                        ) : (
                          <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-200 text-slate-500"><Lock className="h-4 w-4" /></span>
                        )}
                      </div>

                      <div className="mt-3 flex items-center gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white">
                          <div className={`h-full rounded-full ${installment.isPaid ? 'bg-green-600' : overdue ? 'bg-red-400' : 'bg-amber-400'}`} style={{ width: `${installment.progressPct}%` }} />
                        </div>
                        <span className={`text-sm font-bold ${installment.isPaid ? 'text-green-600' : 'text-slate-700'}`}>{installment.progressPct}%</span>
                      </div>

                      {installment.isPaid ? (
                        <p className="mt-2 text-xs text-slate-500">
                          {row.payment ? `Paid on ${formatDate(row.payment.paidOn || row.payment.createdAt)}` : 'Paid'}
                        </p>
                      ) : isOpen ? (
                        <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
                          <div className="min-w-[160px] flex-1 space-y-0.5 text-xs">
                            <div className="flex justify-between gap-4 text-slate-600"><span>Late Fine</span><span>{formatCurrency(row.fine)}</span></div>
                            <div className="flex justify-between gap-4 font-bold text-slate-900"><span>Total Payable</span><span className="text-red-500">{formatCurrency(row.payable)}</span></div>
                          </div>
                          <button
                            type="button"
                            onClick={() => handlePayNow(row.invoice, row.payable)}
                            disabled={processingInvoiceId === row.invoice._id}
                            className="hidden items-center gap-2 rounded-lg bg-red-500 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex"
                          >
                            {processingInvoiceId === row.invoice._id ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />} Pay Now
                          </button>
                        </div>
                      ) : (
                        <p className="mt-2 text-xs text-slate-500">Unlocks after the previous installment · Due {formatDate(installment.dueDate)}</p>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </div>
          </section>
        )}

        {/* Transactions + summary */}
        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px] self-start">
          <section className={`${cardClass} min-w-0 p-4`}>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><FileText className="h-5 w-5" /></span>
                <div>
                  <h2 className="text-base font-bold text-slate-900">Transaction History &amp; Dues</h2>
                  <p className="text-xs text-slate-500">All invoices for the selected academic session.</p>
                </div>
              </div>
              <div className="flex gap-2" role="group" aria-label="Filter by status">
                {['all', 'paid', 'due', 'overdue'].map((value) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setStatusFilter(value)}
                    aria-pressed={statusFilter === value}
                    className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${statusFilter === value ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
                  >
                    {value === 'all' ? 'All' : STATUS_LABEL[value]}
                  </button>
                ))}
              </div>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full min-w-[640px] text-left text-xs text-slate-700">
                <thead className="border-b border-slate-100 text-xs font-medium text-slate-600">
                  <tr>
                    {['#', 'Amount', 'Fine', 'Total', 'Status', 'Method', 'Invoice', 'Action'].map((head) => (
                      <th key={head} className={`px-3 py-2 font-medium bg-gray-200 ${['Status', 'Action'].includes(head) ? 'text-center' : ''}`}>{head}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {loadingInvoices ? (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500"><Loader2 className="mr-2 inline h-5 w-5 animate-spin text-blue-500" /> Loading fees…</td></tr>
                  ) : !selectedChild ? (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">Select a child to view fee details.</td></tr>
                  ) : visibleRows.length === 0 ? (
                    <tr><td colSpan={8} className="px-3 py-10 text-center text-sm text-slate-500">
                      <FileText className="mx-auto mb-2 h-7 w-7 text-slate-300" />
                      {invoices.length === 0 ? 'No invoices found for this student.' : sessionInvoices.length === 0 ? 'No fees found for this session.' : `No ${STATUS_LABEL[statusFilter]?.toLowerCase()} fees.`}
                    </td></tr>
                  ) : visibleRows.map((row, index) => (
                    <tr
                      key={row.key}
                      title={row.subLabel ? `${row.label} · ${row.subLabel}` : row.label}
                      onClick={() => setSelectedInvoiceId(row.invoice._id)}
                      className={`cursor-pointer transition hover:bg-slate-50 ${row.invoice._id === selectedInvoiceId && invoicesWithPlans.length > 1 ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="px-3 py-2.5">{index + 1}</td>
                      <td className="px-3 py-2.5">{formatCurrency(row.amount)}</td>
                      <td className="px-3 py-2.5">{formatCurrency(row.fine)}</td>
                      <td className="px-3 py-2.5">{formatCurrency(row.total)}</td>
                      <td className="px-3 py-2.5 text-center"><span className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${STATUS_PILL[row.status]}`}>{STATUS_LABEL[row.status]}</span></td>
                      <td className="px-3 py-2.5">{row.payment ? formatMethod(row.payment.method) : '-'}</td>
                      <td className="whitespace-nowrap px-3 py-2.5">{row.status === 'paid' ? row.reference : '-'}</td>
                      <td className="px-3 py-2.5 text-center" onClick={(event) => event.stopPropagation()}>
                        {row.status === 'paid' ? (
                          row.payment ? (
                            <button
                              type="button"
                              onClick={() => handleDownloadReceipt(row.payment, row.invoice)}
                              disabled={downloadingReceiptId === row.payment._id}
                              title={row.payment.receiptNumber ? `Receipt ${row.payment.receiptNumber}` : 'Download receipt'}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-1.5 text-xs font-medium text-violet-600 transition hover:bg-violet-100 disabled:opacity-60"
                            >
                              {downloadingReceiptId === row.payment._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Download
                            </button>
                          ) : <span className="text-xs text-slate-400">—</span>
                        ) : row.isLocked ? (
                          <span className="inline-flex items-center gap-1 text-xs text-slate-400"><Lock className="h-3.5 w-3.5" /> Locked</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handlePayNow(row.invoice, row.payable)}
                            disabled={processingInvoiceId === row.invoice._id}
                            className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {processingInvoiceId === row.invoice._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CreditCard className="h-3.5 w-3.5" />} Pay Now
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <aside className={`${cardClass} h-fit p-4`} aria-label="Fee summary details">
            <div className="mb-3 flex items-center gap-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600"><Receipt className="h-5 w-5" /></span>
              <div>
                <h2 className="text-base font-bold text-slate-900">Fee Summary</h2>
                <p className="text-xs text-slate-500">Summary for session {sessionFilter || '—'}</p>
              </div>
            </div>
            <dl className="divide-y divide-slate-100 text-xs">
              <div className="flex justify-between py-1.5"><dt className="text-slate-600">Total Tuition Fees</dt><dd className="font-bold text-slate-900">{formatCurrency(Math.max(0, totals.total - fineAppliedTotal))}</dd></div>
              <div className="flex justify-between py-1.5"><dt className="text-slate-600">Total Paid</dt><dd className="font-bold text-emerald-500">{formatCurrency(totals.paid)}</dd></div>
              <div className="flex justify-between py-1.5"><dt className="text-slate-600">Remaining Fees</dt><dd className="font-bold text-slate-900">{formatCurrency(feesDue)}</dd></div>
              <div className="flex justify-between py-1.5">
                <dt className="flex items-center gap-1.5 text-slate-600">
                  Late Fine
                  <button
                    type="button"
                    onClick={() => setLateFineOpen((open) => !open)}
                    aria-expanded={lateFineOpen}
                    aria-label="Show late fine details"
                    className={`rounded-full p-0.5 transition ${lateFineOpen ? 'bg-blue-50 text-blue-600' : 'text-slate-500 hover:text-blue-600'}`}
                  >
                    <Info className="h-4 w-4" />
                  </button>
                </dt>
                <dd className="font-bold text-red-500">{formatCurrency(fineDueTotal)}</dd>
              </div>
            </dl>
            <div className="mt-2 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2">
              <span className="text-sm font-semibold text-red-500">Total Amount Due</span>
              <span className="text-base font-bold text-red-500">{formatCurrency(totals.balance)}</span>
            </div>

            {selectedInvoice && (
              <div className="mt-4 flex flex-wrap gap-2">
                {Array.isArray(selectedInvoice.feeHeadsSnapshot) && selectedInvoice.feeHeadsSnapshot.length > 0 && (
                  <button type="button" onClick={() => setShowFeeBreakdown(true)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50">
                    <FileText className="h-3.5 w-3.5" /> View breakdown
                  </button>
                )}
                <button type="button" onClick={() => handleDownloadFeesCard(selectedInvoice)} disabled={downloadingFeesCardId === selectedInvoice._id} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-60">
                  {downloadingFeesCardId === selectedInvoice._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Fees card
                </button>
              </div>
            )}

            {/* <p className="mt-4 flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-xs text-slate-600">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white"><Info className="h-3.5 w-3.5" /></span>
              Late fine is applicable as per school policy for delayed payments.
            </p> */}
          </aside>
        </div>
      </div>

      {selectedInvoice && selectedBalance > 0 && (
        <div className="fees-mobile-pay sticky bottom-0 z-20 -mx-4 mt-4 bg-gradient-to-t from-[#f5f7fb] via-[#f5f7fb]/95 to-transparent px-4 pb-4 pt-8 md:hidden">
          <button
            type="button"
            onClick={() => handlePayNow(selectedInvoice, mobilePayAmount)}
            disabled={isProcessingSelected}
            className="mx-auto flex w-full max-w-md items-center justify-between rounded-xl bg-blue-600 px-6 py-4 text-base font-bold text-white shadow-[0_10px_30px_rgba(37,99,235,0.28)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              {isProcessingSelected ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
              Pay Now
            </span>
            <span>{formatCurrency(mobilePayAmount)}</span>
          </button>
        </div>
      )}

      {showFeeBreakdown && selectedInvoice && Array.isArray(selectedInvoice.feeHeadsSnapshot) && selectedInvoice.feeHeadsSnapshot.length > 0 && createPortal(
        // Portalled to <body> so the backdrop covers the whole viewport
        // (sidebar + top bar), not just the portal's content area.
        <div className="fixed inset-0 z-[9999] flex h-dvh w-screen items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowFeeBreakdown(false)} aria-label="Close breakdown" />
          <div ref={breakdownDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="fees-breakdown-title" className="relative w-full max-w-md rounded-2xl border border-white/80 bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h3 id="fees-breakdown-title" className="text-base font-bold text-slate-800">Fees Breakdown</h3><p className="mt-0.5 text-xs text-slate-500">{getInvoiceTitle(selectedInvoice)}</p></div>
              <button type="button" onClick={() => setShowFeeBreakdown(false)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-1.5">
              {selectedInvoice.feeHeadsSnapshot.map((head, index) => (
                <div key={`${head.label}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600"><span>{head.label}</span><span className="font-semibold text-slate-800">{formatCurrency(head.amount)}</span></div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-sm font-semibold text-slate-700">Total</span><span className="text-base font-bold text-slate-900">{formatCurrency(getInvoiceTotal(selectedInvoice))}</span></div>
          </div>
        </div>,
        document.body,
      )}
      {lateFineOpen && createPortal(
        <div className="fixed inset-0 z-[9999] flex h-dvh w-screen items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setLateFineOpen(false)} aria-label="Close late fine details" />
          <div ref={lateFineDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="fees-late-fine-title" className="relative max-h-[85vh] w-full max-w-md overflow-y-auto rounded-2xl border border-white/80 bg-white p-5 text-sm shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h3 id="fees-late-fine-title" className="text-base font-bold text-slate-800">Late Fine Details</h3>
                <p className="mt-0.5 text-xs text-slate-500">Session {sessionFilter || '—'} · Outstanding {formatCurrency(fineDueTotal)}</p>
              </div>
              <button type="button" onClick={() => setLateFineOpen(false)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            {lateFineDetails.length === 0 ? (
              <p className="text-slate-500">No late fine has been charged for this session.</p>
            ) : (
              <div className="space-y-2.5">
                {lateFineDetails.map((item) => (
                  <div key={item.id} className="space-y-1.5 rounded-xl border border-slate-100 bg-slate-50 p-3 text-xs">
                    <p className="font-semibold text-slate-700">{item.label}</p>
                    {item.dueDate && <div className="flex justify-between text-slate-600"><span>Due date</span><span>{formatDate(item.dueDate)}</span></div>}
                    {item.rate > 0 && <div className="flex justify-between text-slate-600"><span>Fine per day</span><span>{formatCurrency(item.rate)}</span></div>}
                    {item.days > 0 && <div className="flex justify-between text-slate-600"><span>Days charged</span><span>{item.days} day{item.days === 1 ? '' : 's'}</span></div>}
                    <div className="flex justify-between text-slate-600"><span>Fine charged</span><span>{formatCurrency(item.applied)}</span></div>
                    <div className="flex justify-between font-semibold text-red-500"><span>Fine outstanding</span><span>{formatCurrency(item.outstanding)}</span></div>
                    {item.appliedAt && <p className="text-[11px] text-slate-400">Last updated {formatDate(item.appliedAt)}</p>}
                    {(item.excludeSundays || item.excludeHolidays) && (
                      <p className="text-[11px] text-slate-400">
                        Not charged on {[item.excludeSundays && 'Sundays', item.excludeHolidays && 'school holidays'].filter(Boolean).join(' or ')}.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            <p className="mt-4 flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
              Late fine is applicable as per school policy for delayed payments.
            </p>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default FeesPayment;
