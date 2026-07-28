import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  Bus,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CreditCard,
  Download,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  Lock,
  Palette,
  RefreshCw,
  RotateCcw,
  ShieldCheck,
  User,
  Zap,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { downloadFeeReceiptPdf } from '../utils/feeReceiptPdf';
import { downloadFeesStructurePdf } from '../utils/feesStructurePdf';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const AVATAR_COLORS = [
  'bg-indigo-500', 'bg-sky-500', 'bg-violet-500', 'bg-fuchsia-500',
  'bg-teal-500', 'bg-orange-500', 'bg-pink-500', 'bg-blue-500',
];

const DEFAULT_PDF_SCHOOL = {
  schoolName: '',
  schoolAddressLine: '',
  schoolContactLine: '',
  logoUrl: '',
  logoUrlOverride: '',
  accentColor: '#0f172a',
};

const formatCurrency = (value) => {
  const amount = Number(value || 0);
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (value) => {
  if (!value) return '-';
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return '-';
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const getInvoiceSessionLabel = (invoice) => {
  const year = invoice?.academicYearId;
  if (year && typeof year === 'object' && year.name) return year.name;
  return 'Other Session';
};

// FeePayment records only carry a lump amount against the invoice, not a
// specific installment, so "which installment is paid" is derived here by
// walking installmentsSnapshot in order and consuming invoice.paidAmount
// cumulatively. An installment unlocks only once every prior one is fully paid.
// `paymentsAsc` (oldest first) is walked the same way to attribute the payment
// that completed each installment, purely so a receipt can be offered for it.
const getInstallmentBreakdown = (invoice, paymentsAsc = []) => {
  const installments = Array.isArray(invoice?.installmentsSnapshot) ? invoice.installmentsSnapshot : [];
  if (!installments.length) return [];

  let remainingPaid = Number(invoice.paidAmount || 0);
  let priorFullyPaid = true;
  let cumulativeThreshold = 0;
  let runningPaymentTotal = 0;
  let paymentPtr = 0;

  return installments.map((installment, index) => {
    const amount = Number(installment?.amount || 0);
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
        runningPaymentTotal += Number(paymentsAsc[paymentPtr]?.amount || 0);
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
      paidTowards,
      remaining: Math.max(0, amount - paidTowards),
      isPaid,
      isLocked,
      progressPct,
      receiptPayment,
    };
  });
};

const feeIconFor = (title = '') => {
  const t = title.toLowerCase();
  if (t.includes('transport') || t.includes('bus')) return Bus;
  if (t.includes('activity') || t.includes('art') || t.includes('craft')) return Palette;
  if (t.includes('tuition')) return GraduationCap;
  return FileText;
};

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

const getStoredToken = () => {
  try {
    if (typeof global !== 'undefined' && global.localStorage?.getItem) {
      const token = global.localStorage.getItem('token') || '';
      if (token) return token;
    }
  } catch {
    // ignore storage access errors
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage?.getItem) {
      const token = window.localStorage.getItem('token') || '';
      if (token) return token;
    }
  } catch {
    // ignore storage access errors
  }
  if (typeof process !== 'undefined' && process.env?.NODE_ENV === 'test') {
    return 'test-token';
  }
  return '';
};

const ChildAvatar = ({ name, size = 'md' }) => {
  const initial = (name || '?').trim().charAt(0).toUpperCase() || '?';
  const color = AVATAR_COLORS[(name || '').charCodeAt(0) % AVATAR_COLORS.length || 0];
  const dimensions = size === 'sm' ? 'h-8 w-8 text-xs' : 'h-10 w-10 text-sm';
  return (
    <span className={`inline-flex ${dimensions} shrink-0 items-center justify-center rounded-full ${color} font-bold text-white`}>
      {initial}
    </span>
  );
};

const StatTile = ({ icon, label, value, subtitle, subtitleAction, iconColor, iconBg }) => {
  const Icon = icon;
  return (
    <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </span>
        <span className="text-sm text-gray-500">{label}</span>
      </div>
      <p className="mt-3 text-2xl font-bold text-gray-900">{value}</p>
      {subtitleAction ? (
        <button type="button" onClick={subtitleAction.onClick} className="mt-1 text-xs font-semibold text-amber-600 hover:text-amber-700">
          {subtitle}
        </button>
      ) : (
        <p className="mt-1 text-xs text-gray-400">{subtitle}</p>
      )}
    </div>
  );
};

const InfoTile = ({ icon, title, copy, iconColor, iconBg }) => {
  const Icon = icon;
  return (
    <div className="flex items-start gap-3 rounded-2xl border border-gray-100 bg-white p-4 shadow-sm">
      <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${iconBg}`}>
        <Icon className={`h-4.5 w-4.5 ${iconColor}`} />
      </span>
      <div className="min-w-0">
        <p className="text-sm font-semibold text-gray-800">{title}</p>
        <p className="mt-0.5 text-xs leading-relaxed text-gray-500">{copy}</p>
      </div>
    </div>
  );
};

const FeesPayment = () => {
  const [children, setChildren] = useState([]);
  const [selectedChildId, setSelectedChildId] = useState('');
  const [childPickerOpen, setChildPickerOpen] = useState(false);
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
  const childPickerRef = useRef(null);

  const buildChildKey = (child) => (child.id ? `id:${child.id}` : `name:${child.name || ''}`);

  const showError = (message) => {
    const text = message || 'Something went wrong';
    setError(text);
    toast.error(text);
  };

  const selectedChild = useMemo(
    () => children.find((child) => buildChildKey(child) === selectedChildId) || null,
    [children, selectedChildId]
  );

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (childPickerRef.current && !childPickerRef.current.contains(event.target)) {
        setChildPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchChildren = async () => {
    const token = getStoredToken();

    setLoadingChildren(true);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/fees/parent/children`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load children');
      }
      const list = Array.isArray(data.children) ? data.children : [];
      setChildren(list);
      if (list.length > 0) {
        setSelectedChildId(buildChildKey(list[0]));
      }
    } catch (err) {
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
      const res = await fetch(`${API_BASE}/api/fees/parent/invoices?studentId=${childId}`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load invoices');
      }
      const list = Array.isArray(data.invoices) ? data.invoices : [];
      setInvoices(list);
      setPaymentsByInvoice(data.paymentsByInvoice || {});
      const nextAmounts = {};
      list.forEach((invoice) => {
        nextAmounts[invoice._id] = Number(invoice.balanceAmount || 0);
      });
      setAmounts(nextAmounts);
    } catch (err) {
      showError(err.message || 'Unable to load invoices');
    } finally {
      setLoadingInvoices(false);
    }
  };

  const handleDownloadReceipt = async (payment, invoice) => {
    const token = getStoredToken();
    if (!payment?._id) {
      showError('Receipt not available for this payment');
      return;
    }

    setDownloadingReceiptId(payment._id);
    setError('');
    setSuccessMessage('');
    try {
      const res = await fetch(`${API_BASE}/api/fees/parent/payments/${payment._id}/receipt`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to load receipt');
      }

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

  const fetchPdfSchool = async () => {
    const token = getStoredToken();
    try {
      const res = await fetch(`${API_BASE}/api/reports/report-cards/parent`, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
      });
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
      // Keep default branding if the template can't be loaded.
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
          className: invoice.className || selectedChild?.grade || '',
          board: 'GENERAL',
          academicYearName: getInvoiceSessionLabel(invoice),
          name: invoice.title || 'Fee Invoice',
          feeHeads: Array.isArray(invoice.feeHeadsSnapshot) ? invoice.feeHeadsSnapshot : [],
          installments: Array.isArray(invoice.installmentsSnapshot) ? invoice.installmentsSnapshot : [],
          totalAmount: invoice.totalAmount,
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

  useEffect(() => {
    fetchChildren();
    fetchPdfSchool();
  }, []);

  useEffect(() => {
    if (selectedChild?.id) {
      fetchInvoices(selectedChild.id);
    } else {
      setInvoices([]);
      setPaymentsByInvoice({});
    }
  }, [selectedChild?.id]);

  const handlePayNow = async (invoice, amountOverride) => {
    const token = getStoredToken();
    setProcessingInvoiceId(invoice._id);
    setError('');
    setSuccessMessage('');
    try {
      const paymentAmount = Number(amountOverride ?? amounts[invoice._id]);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0) {
        throw new Error('Enter a valid amount');
      }

      const orderRes = await fetch(`${API_BASE}/api/fees/${invoice._id}/pay`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          amount: paymentAmount,
        }),
      });
      const orderData = await orderRes.json();
      if (!orderRes.ok) {
        throw new Error(orderData?.error || 'Failed to create payment order');
      }

      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Unable to load Razorpay');
      }

      const razorpayKey = orderData.keyId;
      if (!razorpayKey) {
        throw new Error('Razorpay key is missing');
      }

      const options = {
        key: razorpayKey,
        amount: orderData.order?.amount,
        currency: orderData.order?.currency || 'INR',
        name: 'School Fees',
        description: invoice.title || 'Fee Payment',
        order_id: orderData.order?.id,
        handler: async (response) => {
          try {
            const verifyRes = await fetch(`${API_BASE}/api/fees/payments/razorpay/verify`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json();
            if (!verifyRes.ok) {
              throw new Error(verifyData?.error || 'Payment verification failed');
            }
            setSuccessMessage('Payment successful. Invoice updated.');
            await fetchInvoices(selectedChild.id);
          } catch (verifyErr) {
            showError(verifyErr.message || 'Unable to verify payment');
          } finally {
            setProcessingInvoiceId('');
          }
        },
        modal: {
          ondismiss: () => setProcessingInvoiceId(''),
        },
        prefill: {
          name: selectedChild?.name || 'Parent',
        },
        theme: {
          color: '#f59e0b',
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      showError(err.message || 'Payment failed');
      setProcessingInvoiceId('');
    }
  };

  // Sessions come from each invoice's academic year, so fees never get lumped
  // into one cross-year total — the parent picks a session and only that
  // session's invoices feed the totals, list, and payment panel below.
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
    const stillValid = sessionOptions.some((option) => option.label === sessionFilter);
    if (!stillValid) {
      const active = sessionOptions.find((option) => option.isActive);
      setSessionFilter(active?.label || sessionOptions[0].label);
    }
  }, [sessionOptions, sessionFilter]);

  const sessionInvoices = useMemo(
    () => invoices.filter((invoice) => getInvoiceSessionLabel(invoice) === sessionFilter),
    [invoices, sessionFilter]
  );

  useEffect(() => {
    const firstPending = sessionInvoices.find((invoice) => Number(invoice.balanceAmount || 0) > 0);
    setSelectedInvoiceId(firstPending?._id || sessionInvoices[0]?._id || '');
  }, [sessionInvoices]);

  const totals = useMemo(() => {
    return sessionInvoices.reduce(
      (acc, invoice) => {
        acc.total += Number(invoice.totalAmount || 0);
        acc.paid += Number(invoice.paidAmount || 0);
        acc.balance += Number(invoice.balanceAmount || 0);
        return acc;
      },
      { total: 0, paid: 0, balance: 0 }
    );
  }, [sessionInvoices]);

  const pendingInvoices = useMemo(
    () => sessionInvoices.filter((invoice) => Number(invoice.balanceAmount || 0) > 0),
    [sessionInvoices]
  );

  const nearestDueDate = useMemo(() => {
    const dated = pendingInvoices
      .map((invoice) => invoice.dueDate)
      .filter(Boolean)
      .map((value) => new Date(value))
      .filter((date) => !Number.isNaN(date.getTime()))
      .sort((a, b) => a - b);
    return dated[0] || null;
  }, [pendingInvoices]);

  const selectedInvoice = useMemo(
    () => sessionInvoices.find((invoice) => invoice._id === selectedInvoiceId) || null,
    [sessionInvoices, selectedInvoiceId]
  );

  const installmentBreakdown = useMemo(() => {
    if (!selectedInvoice) return [];
    // paymentsByInvoice is sorted newest-first (for the Recent Payments list);
    // installment attribution needs oldest-first to walk amounts in order.
    const paymentsAsc = [...(paymentsByInvoice[selectedInvoice._id] || [])].reverse();
    return getInstallmentBreakdown(selectedInvoice, paymentsAsc);
  }, [selectedInvoice, paymentsByInvoice]);
  const hasInstallments = installmentBreakdown.length > 0;

  useEffect(() => {
    setShowFeeBreakdown(false);
  }, [selectedInvoiceId]);

  const handlePayInstallment = (invoice, installment) => {
    setAmounts((prev) => ({ ...prev, [invoice._id]: installment.remaining }));
    handlePayNow(invoice, installment.remaining);
  };

  const isProcessingSelected = selectedInvoice && processingInvoiceId === selectedInvoice._id;
  const selectedAmount = selectedInvoice ? Number(amounts[selectedInvoice._id] ?? selectedInvoice.balanceAmount ?? 0) : 0;
  const canPaySelected = Boolean(selectedInvoice) && selectedAmount > 0;

  return (
    <div className="w-full space-y-5 p-3 pb-8 sm:p-4 md:p-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">Make a Payment</h1>
        <p className="mt-1 text-sm text-gray-500">Select a child and choose the fees you want to pay</p>
      </div>

      {/* Select Child */}
      <div className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-amber-900">Select Child</h3>
              <button
                onClick={fetchChildren}
                className="ml-1 flex items-center gap-1 text-[11px] font-medium text-amber-700/80 hover:text-amber-900"
                type="button"
              >
                <RefreshCw className="h-3 w-3" /> Refresh
              </button>
            </div>
            <p className="mt-0.5 text-xs text-amber-700/80">Choose a child to view their pending fees</p>
          </div>

          <div className="relative w-full sm:w-72" ref={childPickerRef}>
            <button
              type="button"
              disabled={loadingChildren || children.length === 0}
              onClick={() => setChildPickerOpen((open) => !open)}
              className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-white px-3 py-2.5 text-left shadow-sm transition hover:border-amber-300 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {selectedChild ? (
                <>
                  <ChildAvatar name={selectedChild.name} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold text-gray-800">{selectedChild.name || 'Child'}</span>
                    <span className="block truncate text-xs text-gray-500">
                      {selectedChild.grade ? `Class ${selectedChild.grade}${selectedChild.section ? ` - ${selectedChild.section}` : ''}` : 'Not linked'}
                    </span>
                  </span>
                </>
              ) : (
                <>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-100 text-gray-400">
                    <User className="h-5 w-5" />
                  </span>
                  <span className="flex-1 text-sm text-gray-500">
                    {loadingChildren ? 'Loading children…' : 'Select a child'}
                  </span>
                </>
              )}
              <ChevronDown className={`h-4 w-4 shrink-0 text-gray-400 transition-transform ${childPickerOpen ? 'rotate-180' : ''}`} />
            </button>

            {childPickerOpen && children.length > 0 && (
              <div className="absolute right-0 z-20 mt-2 w-full overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg">
                {children.map((child) => (
                  <button
                    key={buildChildKey(child)}
                    type="button"
                    onClick={() => {
                      setSelectedChildId(buildChildKey(child));
                      setChildPickerOpen(false);
                    }}
                    className={`flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-amber-50 ${
                      buildChildKey(child) === selectedChildId ? 'bg-amber-50' : ''
                    }`}
                  >
                    <ChildAvatar name={child.name} />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-gray-800">{child.name || 'Child'}</span>
                      <span className="block truncate text-xs text-gray-500">
                        {child.grade ? `Class ${child.grade}${child.section ? ` - ${child.section}` : ''}` : 'Not linked'}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {selectedChild && !selectedChild.id && (
          <p className="mt-3 text-sm text-amber-700">
            This child is not linked to a student record yet. Please contact the school office.
          </p>
        )}
        {error && (
          <p className="mt-3 flex items-center gap-1.5 text-sm text-red-600">
            <AlertCircle className="h-4 w-4 shrink-0" /> {error}
          </p>
        )}
        {successMessage && <p className="mt-3 text-sm text-emerald-700">{successMessage}</p>}
      </div>

      {selectedChild?.id ? (
        <>
          {/* Stat tiles */}
          <div className="grid gap-3 sm:grid-cols-3">
            <StatTile
              icon={GraduationCap}
              iconColor="text-blue-600"
              iconBg="bg-blue-50"
              label="Total Pending"
              value={formatCurrency(totals.balance)}
              subtitle={`${pendingInvoices.length} pending fee${pendingInvoices.length === 1 ? '' : 's'}`}
            />
            <StatTile
              icon={CalendarDays}
              iconColor="text-amber-600"
              iconBg="bg-amber-50"
              label="Due Date"
              value={nearestDueDate ? formatDate(nearestDueDate) : 'No dues'}
              subtitle={nearestDueDate ? 'Upcoming deadline' : 'All fees settled'}
            />
            <StatTile
              icon={CheckCircle2}
              iconColor="text-emerald-600"
              iconBg="bg-emerald-50"
              label="Total Paid"
              value={formatCurrency(totals.paid)}
              subtitle="Across all fees"
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {/* Pending Fees */}
            <div className="rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5 lg:col-span-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-bold text-gray-800 sm:text-lg">Fees Overview</h3>
                  <p className="mt-0.5 text-xs text-gray-500">Upcoming fees and past payments for this session</p>
                </div>
                <div className="flex items-center gap-3">
                  {loadingInvoices && (
                    <span className="flex items-center gap-2 text-xs text-gray-500">
                      <Loader2 className="h-4 w-4 animate-spin" /> Loading…
                    </span>
                  )}
                  {sessionOptions.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <label htmlFor="fees-session-filter" className="text-xs font-semibold text-gray-500">
                        Session
                      </label>
                      <select
                        id="fees-session-filter"
                        value={sessionFilter}
                        onChange={(e) => setSessionFilter(e.target.value)}
                        className="rounded-lg border border-gray-200 bg-gray-50 px-2.5 py-1.5 text-xs font-semibold text-gray-700 focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                      >
                        {sessionOptions.map((option) => (
                          <option key={option.label} value={option.label}>
                            {option.label}
                            {option.isActive ? ' (Active)' : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              {sessionInvoices.length === 0 && !loadingInvoices ? (
                <div className="py-8 text-center text-sm text-gray-500">
                  {invoices.length === 0 ? 'No invoices found for this student.' : 'No fees found for this session.'}
                </div>
              ) : (
                <div className="mt-3 divide-y divide-gray-100">
                  {sessionInvoices.map((invoice) => {
                    const balance = Number(invoice.balanceAmount || 0);
                    const isPending = balance > 0;
                    const isPaid = !isPending;
                    const isPartial = isPending && Number(invoice.paidAmount || 0) > 0;
                    const isOverdue = isPending && invoice.dueDate && new Date(invoice.dueDate) < new Date();
                    const latestPayment = (paymentsByInvoice[invoice._id] || [])[0] || null;
                    const Icon = feeIconFor(invoice.title);
                    const isSelected = selectedInvoiceId === invoice._id;
                    const badge = isPaid
                      ? { label: 'Paid', className: 'bg-emerald-50 text-emerald-700' }
                      : isOverdue
                      ? { label: 'Overdue', className: 'bg-red-50 text-red-600' }
                      : isPartial
                      ? { label: 'Partial', className: 'bg-amber-50 text-amber-700' }
                      : { label: 'Upcoming', className: 'bg-blue-50 text-blue-600' };
                    return (
                      <div
                        key={invoice._id}
                        role="button"
                        tabIndex={0}
                        onClick={() => setSelectedInvoiceId(invoice._id)}
                        onKeyDown={(e) => (e.key === 'Enter' ? setSelectedInvoiceId(invoice._id) : null)}
                        className={`flex w-full cursor-pointer items-center gap-3 rounded-lg py-3 text-left transition hover:bg-amber-50/60 ${
                          isSelected ? 'bg-amber-50/80' : ''
                        } -mx-1 px-1`}
                      >
                        <span
                          className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border-2 ${
                            isSelected ? 'border-amber-500 bg-amber-500' : 'border-gray-300'
                          }`}
                        >
                          {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                        </span>
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 text-gray-500">
                          <Icon className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-semibold text-gray-800">{invoice.title || 'Fee Invoice'}</span>
                            <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold ${badge.className}`}>
                              {badge.label}
                            </span>
                          </span>
                          <span className="block truncate text-xs text-gray-500">
                            {invoice.className ? `Class ${invoice.className}${invoice.section ? ` - ${invoice.section}` : ''}` : (isPaid ? 'Fully paid' : 'Due soon')}
                          </span>
                        </span>
                        <span className="hidden shrink-0 text-xs text-gray-500 sm:block">
                          {isPaid ? 'Paid on' : 'Due'} {formatDate(isPaid ? (latestPayment?.paidOn || latestPayment?.createdAt || invoice.updatedAt) : invoice.dueDate)}
                        </span>
                        <span className={`shrink-0 text-sm font-bold ${isPending ? 'text-gray-900' : 'text-emerald-600'}`}>
                          {formatCurrency(isPending ? balance : invoice.totalAmount)}
                        </span>
                        {isPaid && latestPayment && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDownloadReceipt(latestPayment, invoice);
                            }}
                            disabled={downloadingReceiptId === latestPayment._id}
                            className="ml-1 inline-flex shrink-0 items-center gap-1 rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
                            title="Download receipt"
                          >
                            {downloadingReceiptId === latestPayment._id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Download className="h-3 w-3" />
                            )}
                            <span className="hidden sm:inline">Receipt</span>
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {selectedInvoice && (
                <div
                  className={`mt-4 rounded-xl border px-4 py-3 ${
                    selectedInvoice.balanceAmount > 0 ? 'border-amber-100 bg-amber-50' : 'border-emerald-100 bg-emerald-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-semibold ${selectedInvoice.balanceAmount > 0 ? 'text-amber-900' : 'text-emerald-800'}`}>
                      {selectedInvoice.balanceAmount > 0 ? 'Total Amount Due' : 'Amount Paid'}
                    </span>
                    <span className={`text-lg font-bold ${selectedInvoice.balanceAmount > 0 ? 'text-amber-900' : 'text-emerald-800'}`}>
                      {formatCurrency(selectedInvoice.balanceAmount > 0 ? selectedAmount : selectedInvoice.totalAmount)}
                    </span>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                    {Array.isArray(selectedInvoice.feeHeadsSnapshot) && selectedInvoice.feeHeadsSnapshot.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setShowFeeBreakdown((v) => !v)}
                        className={`text-xs font-semibold underline-offset-2 hover:underline ${
                          selectedInvoice.balanceAmount > 0 ? 'text-amber-700' : 'text-emerald-700'
                        }`}
                      >
                        {showFeeBreakdown ? 'Hide Fees Breakdown' : 'View Fees Breakdown'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => handleDownloadFeesCard(selectedInvoice)}
                      disabled={downloadingFeesCardId === selectedInvoice._id}
                      className={`inline-flex items-center gap-1.5 text-xs font-semibold underline-offset-2 hover:underline disabled:cursor-not-allowed disabled:opacity-60 ${
                        selectedInvoice.balanceAmount > 0 ? 'text-amber-700' : 'text-emerald-700'
                      }`}
                    >
                      {downloadingFeesCardId === selectedInvoice._id ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : (
                        <Layers className="h-3 w-3" />
                      )}
                      Download Fees Card
                    </button>
                  </div>

                  {Array.isArray(selectedInvoice.feeHeadsSnapshot) && selectedInvoice.feeHeadsSnapshot.length > 0 && showFeeBreakdown && (
                    <div className="mt-2 space-y-1 rounded-lg border border-white/60 bg-white/70 p-2.5">
                      {selectedInvoice.feeHeadsSnapshot.map((head, headIdx) => (
                        <div key={`${head.label}-${headIdx}`} className="flex items-center justify-between text-xs text-gray-600">
                          <span>{head.label}</span>
                          <span className="font-semibold text-gray-800">{formatCurrency(head.amount)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Installment breakdown for the selected invoice */}
              {hasInstallments && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-gray-600">Installment Breakdown</p>
                  <div className="space-y-3">
                    {installmentBreakdown.map((installment) => {
                      const isCurrent = !installment.isPaid && !installment.isLocked;
                      const cardColor = installment.isPaid
                        ? 'border-emerald-100 bg-emerald-50/50'
                        : installment.isLocked
                        ? 'border-gray-100 bg-gray-50/60'
                        : 'border-amber-200 bg-amber-50/50';
                      const badgeColor = installment.isPaid
                        ? 'bg-emerald-500 text-white'
                        : installment.isLocked
                        ? 'bg-gray-300 text-white'
                        : 'bg-amber-500 text-white';
                      const barColor = installment.isPaid ? 'bg-emerald-500' : 'bg-amber-500';
                      const isProcessingThis = processingInvoiceId === selectedInvoice._id && isCurrent;
                      return (
                        <div key={installment.id} className={`rounded-xl border p-3.5 sm:p-4 ${cardColor}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-center gap-2.5">
                              <span className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${badgeColor}`}>
                                {installment.isPaid ? <CheckCircle2 className="h-4 w-4" /> : installment.isLocked ? <Lock className="h-3.5 w-3.5" /> : installment.index + 1}
                              </span>
                              <div>
                                <p className="text-sm font-bold text-gray-800">{installment.label}</p>
                                <p className="text-xs text-gray-500">Due: {formatDate(installment.dueDate)}</p>
                              </div>
                            </div>
                            <p className="shrink-0 text-sm font-bold text-gray-900">{formatCurrency(installment.amount)}</p>
                          </div>

                          {installment.isLocked ? (
                            <p className="mt-3 text-xs font-medium text-gray-400">
                              Locked until {installmentBreakdown[installment.index - 1]?.label || 'the previous installment'} is paid
                            </p>
                          ) : (
                            <>
                              <div className="mt-3">
                                <div className="flex items-center justify-between text-[11px] text-gray-500">
                                  <span>Progress</span>
                                  <span>{installment.progressPct}%</span>
                                </div>
                                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-white">
                                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${installment.progressPct}%` }} />
                                </div>
                              </div>

                              {isCurrent && (
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={() => handlePayInstallment(selectedInvoice, installment)}
                                    disabled={isProcessingThis}
                                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-500 px-3 py-1.5 text-xs font-bold text-white hover:bg-amber-600 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {isProcessingThis ? (
                                      <>
                                        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Processing…
                                      </>
                                    ) : (
                                      <>Pay {formatCurrency(installment.remaining)}</>
                                    )}
                                  </button>
                                </div>
                              )}

                              {installment.isPaid && installment.receiptPayment && (
                                <div className="mt-3">
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadReceipt(installment.receiptPayment, selectedInvoice)}
                                    disabled={downloadingReceiptId === installment.receiptPayment._id}
                                    className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-200 bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
                                  >
                                    {downloadingReceiptId === installment.receiptPayment._id ? (
                                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                    ) : (
                                      <Download className="h-3.5 w-3.5" />
                                    )}
                                    Download Receipt
                                  </button>
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {(() => {
                    const totalAmount = Number(selectedInvoice.totalAmount || 0);
                    const paidAmount = Number(selectedInvoice.paidAmount || 0);
                    const paidPct = totalAmount > 0 ? Math.min(100, Math.round((paidAmount / totalAmount) * 100)) : 0;
                    return (
                      <div className="mt-4 rounded-xl border border-gray-100 bg-gray-50/60 p-3.5">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-semibold text-gray-700">Amount Paid</span>
                          <span className="font-bold text-gray-900">
                            {formatCurrency(paidAmount)} <span className="font-medium text-gray-400">of {formatCurrency(totalAmount)}</span>
                          </span>
                        </div>
                        <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-gray-200">
                          <div className="h-full rounded-full bg-emerald-500" style={{ width: `${paidPct}%` }} />
                        </div>
                        <p className="mt-1 text-right text-[11px] text-gray-400">{paidPct}% paid</p>
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Recent payments for the selected invoice */}
              {/* {selectedInvoice && (paymentsByInvoice[selectedInvoice._id] || []).length > 0 && (
                <div className="mt-4">
                  <p className="mb-2 text-xs font-semibold text-gray-600">Recent Payments</p>
                  <div className="space-y-2">
                    {(paymentsByInvoice[selectedInvoice._id] || []).slice(0, 3).map((payment) => (
                      <div
                        key={payment._id}
                        className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2 text-xs text-gray-600"
                      >
                        <div className="min-w-0">
                          <span className="block truncate">
                            {new Date(payment.paidOn || payment.createdAt).toLocaleDateString()}
                            {' - '}
                            {payment.method || 'cash'}
                            {payment.transactionId ? ` - Ref ${payment.transactionId}` : ''}
                          </span>
                          <span className="mt-0.5 block font-semibold text-gray-800">{formatCurrency(payment.amount)}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleDownloadReceipt(payment, selectedInvoice)}
                          disabled={downloadingReceiptId === payment._id}
                          className="ml-3 inline-flex items-center gap-1 rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700 hover:bg-amber-100 disabled:cursor-not-allowed disabled:opacity-60"
                          title="Download receipt"
                        >
                          {downloadingReceiptId === payment._id ? (
                            <>
                              <Loader2 className="h-3 w-3 animate-spin" /> PDF
                            </>
                          ) : (
                            <>
                              <Download className="h-3 w-3" /> Receipt
                            </>
                          )}
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )} */}
            </div>

            {/* Payment summary / pay action */}
            {/* <div className="h-fit rounded-2xl border border-gray-100 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-base font-bold text-gray-800">Payment Summary</h3>
              <p className="mt-0.5 text-xs text-gray-500">Choose your payment option on the secure checkout screen</p>

              {selectedInvoice && selectedInvoice.balanceAmount <= 0 ? (
                <div className="mt-4 flex flex-col items-center gap-2 rounded-xl border border-emerald-100 bg-emerald-50 px-4 py-6 text-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  <p className="text-sm font-bold text-emerald-800">Fully Paid</p>
                  <p className="text-xs text-emerald-700">{selectedInvoice.title}</p>
                  <p className="text-lg font-bold text-emerald-900">{formatCurrency(selectedInvoice.totalAmount)}</p>
                  {(paymentsByInvoice[selectedInvoice._id] || [])[0] && (
                    <button
                      type="button"
                      onClick={() => handleDownloadReceipt((paymentsByInvoice[selectedInvoice._id] || [])[0], selectedInvoice)}
                      disabled={downloadingReceiptId === (paymentsByInvoice[selectedInvoice._id] || [])[0]?._id}
                      className="mt-2 inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {downloadingReceiptId === (paymentsByInvoice[selectedInvoice._id] || [])[0]?._id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Download Receipt
                    </button>
                  )}
                </div>
              ) : selectedInvoice && hasInstallments ? (
                <div className="mt-4 rounded-xl border border-amber-100 bg-amber-50/60 p-4 text-center">
                  <p className="text-sm font-semibold text-amber-900">This fee is split into installments</p>
                  <p className="mt-1 text-xs leading-relaxed text-amber-700">
                    Pay each installment in order from the breakdown on the left. Balance due: {formatCurrency(selectedInvoice.balanceAmount)}
                  </p>
                </div>
              ) : selectedInvoice ? (
                <>
                  <div className="mt-4 space-y-2 rounded-xl border border-gray-100 bg-gray-50/60 p-3">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Fee</span>
                      <span className="max-w-[60%] truncate text-right font-medium text-gray-800">{selectedInvoice.title}</span>
                    </div>
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Due Date</span>
                      <span className="font-medium text-gray-800">{formatDate(selectedInvoice.dueDate)}</span>
                    </div>
                  </div>

                  <label className="mt-3 block text-xs font-semibold text-gray-500">Amount to pay</label>
                  <input
                    type="number"
                    min="0"
                    step="1"
                    max={selectedInvoice.balanceAmount}
                    value={amounts[selectedInvoice._id] ?? ''}
                    onChange={(e) =>
                      setAmounts((prev) => ({
                        ...prev,
                        [selectedInvoice._id]: e.target.value,
                      }))
                    }
                    className="mt-1 w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:border-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-100"
                  />

                  <button
                    type="button"
                    onClick={() => handlePayNow(selectedInvoice)}
                    disabled={!canPaySelected || isProcessingSelected}
                    className={`mt-4 flex w-full items-center justify-center gap-2 rounded-xl px-4 py-3 text-sm font-bold transition ${
                      canPaySelected
                        ? 'bg-amber-500 text-white shadow-sm shadow-amber-200 hover:bg-amber-600'
                        : 'cursor-not-allowed bg-gray-200 text-gray-500'
                    }`}
                  >
                    {isProcessingSelected ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" /> Processing…
                      </>
                    ) : (
                      <>
                        <Lock className="h-3.5 w-3.5" /> Pay {formatCurrency(selectedAmount)}
                      </>
                    )}
                  </button>
                  <p className="mt-2 text-center text-[11px] text-gray-400">
                    You'll be redirected to a secure Razorpay checkout page.
                  </p>
                </>
              ) : (
                <div className="mt-6 flex flex-col items-center gap-2 py-6 text-center text-sm text-gray-400">
                  <CreditCard className="h-8 w-8 text-gray-300" />
                  {sessionInvoices.length === 0 ? 'No fees for this session.' : 'All fees are fully paid. Nothing due.'}
                </div>
              )}
            </div> */}
          </div>
        </>
      ) : (
        <div className="rounded-2xl border border-gray-100 bg-white p-6 text-center text-gray-500 shadow-sm">
          Please select a child to view fee details.
        </div>
      )}

      {/* Info strip */}
      {/* <div className="grid gap-3 sm:grid-cols-3">
        <InfoTile
          icon={ShieldCheck}
          iconColor="text-emerald-600"
          iconBg="bg-emerald-50"
          title="Safe & Secure"
          copy="Your payments are protected with 256-bit encryption."
        />
        <InfoTile
          icon={Zap}
          iconColor="text-blue-600"
          iconBg="bg-blue-50"
          title="Instant Confirmation"
          copy="Get an instant receipt after successful payment."
        />
        <InfoTile
          icon={RotateCcw}
          iconColor="text-violet-600"
          iconBg="bg-violet-50"
          title="Easy Refunds"
          copy="Refunds are processed quickly and easily."
        />
      </div> */}
    </div>
  );
};

export default FeesPayment;
