import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  CheckCircle2,
  Download,
  DownloadIcon,
  FileText,
  Loader2,
  Lock,
  RefreshCw,
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

const formatShortDate = (value) => {
  if (!value) return '—';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '—';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' });
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

const ChildAvatar = ({ child, index }) => (
  <span className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br text-sm font-semibold ${AVATAR_STYLES[index % AVATAR_STYLES.length]}`}>
    {getInitials(child?.name)}
  </span>
);

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

  return (
    <div className="fees-dashboard-page w-full px-4 py-4 pb-6 md:p-30">
      <section className="fees-glass-card mx-auto w-full max-w-6xl p-5 sm:p-6 md:p-8" aria-labelledby="fees-dashboard-title">
        <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 id="fees-dashboard-title" className="text-2xl font-bold tracking-tight text-slate-800">
              Fee Dashboard <span className="sr-only">Fees Payment</span>
            </h1>
            <p className="mt-0.5 text-sm text-slate-500">Overview of your children&apos;s fee status and payment history</p>
          </div>
          {sessionOptions.length > 0 && (
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500" htmlFor="fees-session-filter">
              Session
              <select
                id="fees-session-filter"
                value={sessionFilter}
                onChange={(event) => setSessionFilter(event.target.value)}
                className="rounded-full border border-white/70 bg-white/60 px-3 py-1.5 text-xs font-semibold text-slate-700 outline-none transition focus:border-purple-300 focus:ring-2 focus:ring-purple-100"
              >
                {sessionOptions.map((option) => (
                  <option key={option.label} value={option.label}>
                    {option.label}{option.isActive ? ' (Active)' : ''}
                  </option>
                ))}
              </select>
            </label>
          )}
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-4 lg:col-span-1">
            <div>
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-semibold text-slate-700">Select Child</span>
                <button type="button" onClick={handleRefresh} disabled={loadingChildren || loadingInvoices} className="flex items-center gap-1.5 rounded-full border border-purple-100/60 bg-purple-50/80 px-3 py-1.5 text-xs font-medium text-purple-700 transition hover:bg-purple-100 disabled:cursor-not-allowed disabled:opacity-60">
                  <RefreshCw className={`h-3.5 w-3.5 ${loadingChildren || loadingInvoices ? 'animate-spin' : ''}`} /> Refresh
                </button>
              </div>

              <div className="fees-child-list -mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 lg:mx-0 lg:block lg:space-y-2 lg:px-0 lg:pb-0" role={children.length ? 'listbox' : undefined} aria-label="Children">
                {loadingChildren && children.length === 0 ? (
                  <div className="fees-child-card flex w-full items-center gap-3 rounded-xl p-3 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-purple-500" /> Loading children…</div>
                ) : children.length === 0 ? (
                  <div className="fees-child-card w-full rounded-xl p-4 text-center text-sm text-slate-500">No students found.</div>
                ) : children.map((child, index) => {
                  const childKey = buildChildKey(child);
                  const isActive = childKey === selectedChildId;
                  const childClass = getChildClass(child);
                  return (
                    <button key={childKey} type="button" role="option" aria-selected={isActive} onClick={() => pickChild(child)} className={`fees-child-card flex w-[min(280px,calc(100vw-3.5rem))] shrink-0 snap-start items-center gap-3 rounded-xl p-4 text-left lg:w-full lg:p-3 ${isActive ? 'is-active' : ''}`}>
                      <ChildAvatar child={child} index={index} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-slate-800">{child.name || 'Child'}</span>
                        <span className="block truncate text-xs text-slate-400">{childClass ? `Class ${childClass}${child.section ? ` · Section ${child.section}` : ''}` : 'Not linked to a class'}</span>
                      </span>
                      {isActive && <span className="h-2 w-2 shrink-0 rounded-full bg-purple-600" />}
                    </button>
                  );
                })}
              </div>
              <p className="mt-2 text-center text-xs text-slate-400 lg:mt-3 lg:text-left">Select a child to view their fee details</p>
            </div>

            {selectedChild && !getChildId(selectedChild) && <p className="rounded-xl border border-amber-100 bg-amber-50/70 p-3 text-xs text-amber-700">This child is not linked to a student record. Please contact the school office.</p>}
            {razorpayState === 'unreachable' && (
              <p className="flex flex-wrap items-start gap-2 rounded-xl border border-amber-200 bg-amber-50/70 p-3 text-xs text-amber-800" role="status">
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                <span className="min-w-0 flex-1">{paymentUnreachableMessage}</span>
                <button type="button" onClick={() => warmRazorpay(true)} className="font-semibold text-amber-900 underline underline-offset-2">Retry</button>
              </p>
            )}
            {error && <p className="flex items-start gap-2 rounded-xl border border-red-100 bg-red-50/70 p-3 text-xs text-red-600" role="alert"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0" /> {error}</p>}
            {successMessage && <p className="flex items-start gap-2 rounded-xl border border-emerald-100 bg-emerald-50/70 p-3 text-xs text-emerald-700" role="status"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> {successMessage}</p>}

            <div className="grid grid-cols-2 gap-3 lg:grid-cols-1 lg:gap-2" aria-label="Fee summary">
              <div className="fees-stat-glass col-span-2 flex items-end justify-between rounded-xl p-4 lg:col-span-1 lg:items-center lg:p-3">
                <div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Pending</p><p className="text-xl font-bold text-slate-800">{formatCurrency(totals.balance)}</p></div>
                <span className="rounded-md bg-amber-50 px-2 py-1 text-xs font-medium text-amber-600">{pendingInvoices.length ? `${pendingInvoices.length} due` : 'All clear'}</span>
              </div>
              <div className="fees-stat-glass col-span-1 flex min-h-[104px] flex-col justify-between rounded-xl p-4 lg:min-h-0 lg:flex-row lg:items-center lg:p-3">
                <div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Upcoming Due</p><p className="text-sm font-semibold text-amber-600">{nearestDueDate ? formatDate(nearestDueDate) : 'No upcoming dues'}</p></div>
                <span className="self-end text-xs text-slate-400">{getRelativeDueLabel(nearestDueDate)}</span>
              </div>
              <div className="fees-stat-glass col-span-1 flex min-h-[104px] flex-col justify-between rounded-xl p-4 lg:min-h-0 lg:flex-row lg:items-center lg:p-3">
                <div><p className="text-xs font-medium uppercase tracking-wider text-slate-500">Total Paid</p><p className="text-xl font-bold text-slate-800">{formatCurrency(totals.paid)}</p></div>
                <span className="self-end text-xs font-medium text-emerald-600">This session</span>
              </div>
            </div>
          </div>

          <div className="min-w-0 lg:col-span-2">
            <div className="mb-4">
              <div><h2 className="text-base font-semibold text-slate-700 lg:text-sm">Transaction History &amp; Dues</h2><p className="mt-0.5 text-xs text-slate-400">All invoices for the selected academic session</p></div>
              <div className="mt-3 flex items-center justify-end gap-3 text-xs text-slate-400 lg:mt-2 lg:gap-1.5" aria-label="Status legend">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Paid</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-amber-500" /> Due</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-red-500" /> Overdue</span>
              </div>
            </div>

            <div className="fees-scrollable max-h-[480px] space-y-2 overflow-y-auto pr-1">
              {loadingInvoices ? (
                <div className="fees-invoice-item flex min-h-28 items-center justify-center gap-2 rounded-xl p-4 text-sm text-slate-500"><Loader2 className="h-5 w-5 animate-spin text-purple-500" /> Loading fees…</div>
              ) : !selectedChild ? (
                <div className="fees-invoice-item flex min-h-28 items-center justify-center rounded-xl p-4 text-center text-sm text-slate-500">Select a child to view fee details.</div>
              ) : sessionInvoices.length === 0 ? (
                <div className="fees-invoice-item flex min-h-28 flex-col items-center justify-center rounded-xl p-4 text-center text-sm text-slate-500"><FileText className="mb-2 h-7 w-7 text-slate-300" />{invoices.length === 0 ? 'No invoices found for this student.' : 'No fees found for this session.'}</div>
              ) : sessionInvoices.map((invoice, index) => {
                const balance = getInvoiceBalance(invoice);
                const isPaid = balance <= 0;
                const isPartial = balance > 0 && getInvoicePaid(invoice) > 0;
                const isOverdue = balance > 0 && isPastDue(invoice.dueDate);
                const latestPayment = (paymentsByInvoice[invoice._id] || [])[0] || null;
                const isSelected = selectedInvoiceId === invoice._id;
                const status = isPaid ? 'Paid' : isOverdue ? 'Overdue' : isPartial ? 'Partial' : 'Due';
                const statusClass = isPaid ? 'is-paid' : isOverdue ? 'is-overdue' : 'is-due';
                return (
                  <article key={invoice._id} className={`fees-invoice-item fees-stagger ${statusClass} rounded-xl p-4 ${isSelected ? 'is-selected' : ''}`} style={{ animationDelay: `${Math.min(index, 7) * 50 + 50}ms` }}>
                    <button type="button" onClick={() => setSelectedInvoiceId(invoice._id)} className="fees-invoice-summary w-full text-left" aria-expanded={isSelected}>
                      <span className="fees-invoice-identity min-w-0">
                        <span className="block text-sm font-semibold text-slate-800">{getInvoiceTitle(invoice)}</span>
                        <span className="block text-xs text-slate-400">{selectedChild?.name || 'Student'}{getChildClass(selectedChild) ? ` · Class ${getChildClass(selectedChild)}` : ''}</span>
                      </span>
                      <span className="fees-invoice-amount text-sm font-semibold text-slate-800">{formatCurrency(isPaid ? getInvoiceTotal(invoice) : balance)}</span>
                      <span className={`fees-status-pill fees-invoice-status ${statusClass}`}>{status}</span>
                      <span className={`fees-invoice-date text-xs ${isOverdue ? 'text-red-400' : 'text-slate-400'}`}>{isPaid ? 'Paid' : 'Due'}: {formatShortDate(isPaid ? (latestPayment?.paidOn || latestPayment?.createdAt || invoice.updatedAt) : invoice.dueDate)}</span>
                    </button>

                    {isSelected && (
                      <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-white/70 pt-3">
                        {Array.isArray(invoice.feeHeadsSnapshot) && invoice.feeHeadsSnapshot.length > 0 && <button type="button" onClick={() => setShowFeeBreakdown(true)} className="fees-secondary-action">View breakdown</button>}
                        <button type="button" onClick={() => handleDownloadFeesCard(invoice)} disabled={downloadingFeesCardId === invoice._id} className="fees-secondary-action">
                          {downloadingFeesCardId === invoice._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DownloadIcon className="h-3.5 w-3.5" />} Fees card
                        </button>
                        {isPaid && latestPayment && (
                          <button type="button" onClick={() => handleDownloadReceipt(latestPayment, invoice)} disabled={downloadingReceiptId === latestPayment._id} className="fees-secondary-action fees-receipt-action">
                            {downloadingReceiptId === latestPayment._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />} Receipt
                          </button>
                        )}
                        {balance > 0 && (
                          <button type="button" onClick={() => handlePayNow(invoice, activeInstallment?.remaining || balance)} disabled={isProcessingSelected} className="ml-auto hidden items-center gap-1.5 rounded-full bg-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition hover:bg-purple-700 disabled:cursor-not-allowed disabled:opacity-60 md:inline-flex">
                            {isProcessingSelected ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Lock className="h-3.5 w-3.5" />} Pay now
                          </button>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            {selectedInvoice && installmentBreakdown.length > 0 && (
              <section className="mt-3 rounded-xl border border-white/70 bg-white/35 p-4" aria-label="Installment breakdown">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <div><h3 className="text-xs font-semibold text-slate-700">Installment plan</h3><p className="text-[11px] text-slate-400">Installments unlock in payment order</p></div>
                  <span className="text-sm font-bold text-slate-800">{formatCurrency(selectedBalance)} due</span>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  {installmentBreakdown.map((installment) => (
                    <div key={installment.id} className={`rounded-lg border p-3 ${installment.isPaid ? 'border-emerald-100 bg-emerald-50/60' : installment.isLocked ? 'border-slate-100 bg-white/40' : 'border-purple-100 bg-purple-50/60'}`}>
                      <div className="flex items-center justify-between gap-2"><span className="truncate text-xs font-semibold text-slate-700">{installment.label}</span><span className="text-xs font-bold text-slate-800">{formatCurrency(installment.amount)}</span></div>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white"><div className={`h-full rounded-full ${installment.isPaid ? 'bg-emerald-500' : 'bg-purple-500'}`} style={{ width: `${installment.progressPct}%` }} /></div>
                      <div className="mt-1.5 flex items-center justify-between text-[10px] text-slate-400"><span>{installment.isPaid ? 'Paid' : installment.isLocked ? 'Locked' : `Due ${formatShortDate(installment.dueDate)}`}</span><span>{installment.progressPct}%</span></div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>
        </div>
      </section>

      {selectedInvoice && selectedBalance > 0 && (
        <div className="fees-mobile-pay sticky bottom-0 z-20 -mx-4 mt-4 bg-gradient-to-t from-[#fef7ff] via-[#fef7ff]/95 to-transparent px-4 pb-4 pt-8 md:hidden">
          <button
            type="button"
            onClick={() => handlePayNow(selectedInvoice, activeInstallment?.remaining || selectedBalance)}
            disabled={isProcessingSelected}
            className="mx-auto flex w-full max-w-md items-center justify-between rounded-xl bg-purple-700 px-6 py-4 text-base font-bold text-white shadow-[0_10px_30px_rgba(99,14,212,0.28)] transition active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-60"
          >
            <span className="flex items-center gap-2">
              {isProcessingSelected ? <Loader2 className="h-5 w-5 animate-spin" /> : <Lock className="h-4 w-4" />}
              Pay Now
            </span>
            <span>{formatCurrency(activeInstallment?.remaining || selectedBalance)}</span>
          </button>
        </div>
      )}

      {showFeeBreakdown && selectedInvoice && Array.isArray(selectedInvoice.feeHeadsSnapshot) && selectedInvoice.feeHeadsSnapshot.length > 0 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button type="button" className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => setShowFeeBreakdown(false)} aria-label="Close breakdown" />
          <div ref={breakdownDialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="fees-breakdown-title" className="relative w-full max-w-md rounded-2xl border border-white/80 bg-white/95 p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-3">
              <div><h3 id="fees-breakdown-title" className="text-base font-bold text-slate-800">Fees Breakdown</h3><p className="mt-0.5 text-xs text-slate-500">{getInvoiceTitle(selectedInvoice)}</p></div>
              <button type="button" onClick={() => setShowFeeBreakdown(false)} className="rounded-lg p-1 text-slate-400 transition hover:bg-slate-50 hover:text-slate-600" aria-label="Close"><X className="h-4 w-4" /></button>
            </div>
            <div className="mt-4 space-y-1.5">
              {selectedInvoice.feeHeadsSnapshot.map((head, index) => (
                <div key={`${head.label}-${index}`} className="flex items-center justify-between rounded-lg bg-slate-50/80 px-3 py-2 text-sm text-slate-600"><span>{head.label}</span><span className="font-semibold text-slate-800">{formatCurrency(head.amount)}</span></div>
              ))}
            </div>
            <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3"><span className="text-sm font-semibold text-slate-700">Total</span><span className="text-base font-bold text-slate-900">{formatCurrency(getInvoiceTotal(selectedInvoice))}</span></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeesPayment;
