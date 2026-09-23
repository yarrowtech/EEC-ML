import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  AlertCircle,
  BarChart4,
  CheckCircle2,
  CreditCard,
  Download,
  Eye,
  IndianRupee,
  Loader2,
  RefreshCw,
  Search,
  Users,
  X,
  Wallet,
  ListFilter,
  FileText,
  Plus,
  ChevronLeft,
  ChevronRight,
} from 'lucide-react';
import FeesDashboard from './FeesDashboard';
import { readCache, writeCache } from '../../utils/swrCache';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const INVOICE_PAGE_SIZE = 10;

const resolvePhotoUrl = (value) => {
  const src = String(value || '').trim();
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  return `${API_BASE}/${src.replace(/^\/+/, '')}`;
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

const FeesCollection = ({ setShowAdminHeader }) => {
  const navigate = useNavigate();
  // Seed from the client cache so the first paint already has data.
  const cachedFilterOptions = readCache('fees:filters');
  const cachedActiveYearId = (cachedFilterOptions?.academicYears || []).find((y) => Boolean(y?.isActive))?.id;
  const [filters, setFilters] = useState({
    academicYearId: cachedActiveYearId ? String(cachedActiveYearId) : '',
    classId: '',
    section: '',
    status: '',
    overdue: false,
    search: '',
  });
  const [filterOptions, setFilterOptions] = useState({
    classes: cachedFilterOptions?.classes || [],
    sections: cachedFilterOptions?.sections || [],
    academicYears: cachedFilterOptions?.academicYears || [],
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [students, setStudents] = useState(() => readCache('fees:students') || []);
  const [structures, setStructures] = useState(() => readCache('fees:structures') || []);
  const [bulkForm, setBulkForm] = useState({
    academicYearId: '',
    classId: '',
    section: '',
    title: '',
    dueDate: '',
  });
  const [bulkLoading, setBulkLoading] = useState(false);
  const [bulkStatus, setBulkStatus] = useState({ type: '', text: '' });
  const [actionNotice, setActionNotice] = useState({ type: '', text: '' });
  const [onlinePaymentModal, setOnlinePaymentModal] = useState({
    open: false,
    record: null,
    amount: '',
    notes: '',
  });
  const [onlinePaymentLoading, setOnlinePaymentLoading] = useState(false);
  const [searchParams] = useSearchParams();
  // ?view=payments opens straight on Collect & Manage (e.g. "Back to Fees" from student details).
  const [activeView, setActiveView] = useState(searchParams.get('view') === 'payments' ? 'payments' : 'overview');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [invoicePage, setInvoicePage] = useState(1);

  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  const authFetchJson = async (url, fallbackError) => {
    const res = await fetch(url, {
      headers: {
        'Content-Type': 'application/json',
        authorization: `Bearer ${localStorage.getItem('token')}`,
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || fallbackError);
    return data;
  };

  const applyFilterOptions = (data) => {
    setFilterOptions({
      classes: data.classes || [],
      sections: data.sections || [],
      academicYears: data.academicYears || [],
    });
    const activeYear = (data.academicYears || []).find((year) => Boolean(year?.isActive));
    if (activeYear?.id) {
      setFilters((prev) => (
        prev.academicYearId
          ? prev
          : { ...prev, academicYearId: String(activeYear.id), classId: '', section: '' }
      ));
    }
  };

  // Each loader paints cached data instantly, then revalidates in the background.
  const loadFilters = async () => {
    try {
      const data = await authFetchJson(`${API_BASE}/api/fees/admin/filters`, 'Failed to load filters');
      writeCache('fees:filters', data);
      applyFilterOptions(data);
    } catch (err) {
      console.error(err);
    }
  };

  const recordsRequestRef = useRef(0);
  const fetchRecords = async () => {
    const requestId = ++recordsRequestRef.current;
    const params = new URLSearchParams();
    const selectedClassName = filters.classId
      ? classOptions.find((cls) => String(cls.id) === String(filters.classId))?.name
      : '';
    if (filters.classId) params.append('classId', filters.classId);
    if (filters.academicYearId) params.append('academicYearId', filters.academicYearId);
    if (selectedClassName) params.append('className', selectedClassName);
    if (filters.section) params.append('section', filters.section);
    if (filters.status) params.append('status', filters.status);
    if (filters.search) params.append('search', filters.search);
    if (filters.overdue) params.append('overdue', 'true');
    const cacheKey = `fees:invoices:${params.toString()}`;

    const cached = readCache(cacheKey);
    if (cached) {
      setRecords(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setFetchError('');
    try {
      const data = await authFetchJson(`${API_BASE}/api/fees/admin/invoices?${params.toString()}`, 'Failed to load invoices');
      if (requestId !== recordsRequestRef.current) return; // a newer filter won
      const list = Array.isArray(data) ? data : [];
      writeCache(cacheKey, list);
      setRecords(list);
    } catch (err) {
      if (requestId !== recordsRequestRef.current) return;
      if (!cached) setFetchError(err.message || 'Unable to load invoices');
    } finally {
      if (requestId === recordsRequestRef.current) setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const data = await authFetchJson(`${API_BASE}/api/admin/users/get-students`, 'Failed to load students');
      const list = Array.isArray(data) ? data : [];
      writeCache('fees:students', list);
      setStudents(list);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStructures = async () => {
    try {
      const data = await authFetchJson(`${API_BASE}/api/fees/structures`, 'Failed to load structures');
      const list = Array.isArray(data) ? data : [];
      writeCache('fees:structures', list);
      setStructures(list);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadFilters();
    fetchStudents();
    fetchStructures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Also covers the first load (filters' initial state) — no separate mount fetch.
  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  // Invoice table pagination — back to page 1 whenever the result set changes.
  useEffect(() => { setInvoicePage(1); }, [records]);
  const invoicePageCount = Math.max(1, Math.ceil(records.length / INVOICE_PAGE_SIZE));
  const safeInvoicePage = Math.min(invoicePage, invoicePageCount);
  const pagedRecords = useMemo(
    () => records.slice((safeInvoicePage - 1) * INVOICE_PAGE_SIZE, safeInvoicePage * INVOICE_PAGE_SIZE),
    [records, safeInvoicePage]
  );

  const summary = useMemo(() => {
    const totalStudents = new Set(records.map((r) => r.studentId)).size;
    const totalDue = records.reduce((sum, r) => sum + Number(r.totalAmount || 0), 0);
    const totalCollected = records.reduce((sum, r) => sum + Number(r.paidAmount || 0), 0);
    const totalPending = records.reduce((sum, r) => sum + Number(r.balanceAmount || 0), 0);
    return { totalStudents, totalDue, totalCollected, totalPending };
  }, [records]);

  const classOptions = useMemo(() => filterOptions.classes || [], [filterOptions.classes]);
  const sectionOptions = useMemo(() => filterOptions.sections || [], [filterOptions.sections]);
  const activeAcademicYears = useMemo(
    () => (filterOptions.academicYears || []).filter((year) => Boolean(year?.isActive)),
    [filterOptions.academicYears]
  );
  const classNameById = useMemo(() => {
    const map = new Map();
    classOptions.forEach((cls) => map.set(String(cls.id), cls.name));
    return map;
  }, [classOptions]);
  const filteredSections = useMemo(() => {
    const selectedClassId = filters.classId || null;
    if (!selectedClassId) return sectionOptions;
    return sectionOptions.filter((sec) => String(sec.classId) === String(selectedClassId));
  }, [filters.classId, sectionOptions]);
  const filteredClasses = useMemo(() => {
    if (!filters.academicYearId) return classOptions;
    return classOptions.filter(
      (cls) => String(cls?.academicYearId || '') === String(filters.academicYearId)
    );
  }, [classOptions, filters.academicYearId]);
  const bulkSections = useMemo(() => {
    const selectedClassId = bulkForm.classId || null;
    if (!selectedClassId) return sectionOptions;
    return sectionOptions.filter((sec) => String(sec.classId) === String(selectedClassId));
  }, [bulkForm.classId, sectionOptions]);
  const bulkClassOptions = useMemo(() => {
    if (!bulkForm.academicYearId) return [];
    return classOptions.filter(
      (cls) => String(cls?.academicYearId || '') === String(bulkForm.academicYearId)
    );
  }, [classOptions, bulkForm.academicYearId]);

  useEffect(() => {
    if (!filters.section) return;
    const valid = filteredSections.some((sec) => String(sec.name) === String(filters.section));
    if (!valid) {
      setFilters((prev) => ({ ...prev, section: '' }));
    }
  }, [filteredSections, filters.section]);
  useEffect(() => {
    if (!filters.classId) return;
    const valid = filteredClasses.some((cls) => String(cls.id) === String(filters.classId));
    if (!valid) {
      setFilters((prev) => ({ ...prev, classId: '', section: '' }));
    }
  }, [filteredClasses, filters.classId]);

  useEffect(() => {
    if (!bulkForm.section) return;
    const valid = bulkSections.some((sec) => String(sec.name) === String(bulkForm.section));
    if (!valid) {
      setBulkForm((prev) => ({ ...prev, section: '' }));
    }
  }, [bulkSections, bulkForm.section]);
  useEffect(() => {
    if (!bulkForm.classId) return;
    const valid = bulkClassOptions.some((cls) => String(cls.id) === String(bulkForm.classId));
    if (!valid) {
      setBulkForm((prev) => ({ ...prev, classId: '', section: '' }));
    }
  }, [bulkClassOptions, bulkForm.classId]);
  useEffect(() => {
    if (bulkForm.academicYearId) return;
    const defaultYearId = activeAcademicYears[0]?.id ? String(activeAcademicYears[0].id) : '';
    if (!defaultYearId) return;
    setBulkForm((prev) => ({ ...prev, academicYearId: defaultYearId }));
  }, [activeAcademicYears, bulkForm.academicYearId]);

  const bulkTargetSummary = useMemo(() => {
    const className = classNameById.get(String(bulkForm.classId)) || '';
    const sectionName = String(bulkForm.section || '').trim();
    if (!className) {
      return { className: '', sectionName: '', studentCount: 0 };
    }
    const scopedStudents = students.filter((student) => {
      const grade = String(student?.grade || '').trim();
      const studentSection = String(student?.section || '').trim();
      if (grade !== className) return false;
      if (sectionName && studentSection !== sectionName) return false;
      return true;
    });
    return {
      className,
      sectionName,
      studentCount: scopedStudents.length,
    };
  }, [bulkForm.classId, bulkForm.section, classNameById, students]);

  const selectedBulkAcademicYear = useMemo(
    () =>
      (filterOptions.academicYears || []).find(
        (year) => String(year?.id || '') === String(bulkForm.academicYearId || '')
      ) || null,
    [filterOptions.academicYears, bulkForm.academicYearId]
  );

  const matchedBulkStructure = useMemo(() => {
    if (!bulkForm.classId || !bulkForm.academicYearId) return null;
    const selectedYearId = String(bulkForm.academicYearId);
    const filtered = (structures || []).filter((structure) => {
      if (String(structure?.classId || '') !== String(bulkForm.classId)) return false;
      if (structure?.isActive === false) return false;
      return String(structure?.academicYearId || '') === selectedYearId;
    });
    if (!filtered.length) return null;
    return filtered[0];
  }, [bulkForm.classId, bulkForm.academicYearId, structures]);

  const bulkAssignDisabledReason = useMemo(() => {
    if (!bulkForm.academicYearId) return 'Select a session first.';
    if (!bulkForm.classId) return 'Select a class first.';
    if (!matchedBulkStructure) return 'No fee structure found for selected session and class.';
    if (bulkTargetSummary.studentCount === 0) return 'No students found for selected class/section.';
    return '';
  }, [bulkForm.academicYearId, bulkForm.classId, matchedBulkStructure, bulkTargetSummary.studentCount]);

  const handleViewDetails = (record) => {
    if (!record?.invoiceId) return;
    navigate(`/admin/fees/student-details?invoice=${record.invoiceId}`, {
      state: { invoiceId: record.invoiceId },
    });
  };

  const handleOpenOnlinePayment = (record) => {
    setActionNotice({ type: '', text: '' });
    setOnlinePaymentModal({
      open: true,
      record,
      amount: String(Number(record?.balanceAmount || 0)),
      notes: '',
    });
  };

  const handleCloseOnlinePayment = () => {
    if (onlinePaymentLoading) return;
    setOnlinePaymentModal({
      open: false,
      record: null,
      amount: '',
      notes: '',
    });
  };

  const handleStartOnlinePayment = async () => {
    const record = onlinePaymentModal.record;
    if (!record?.invoiceId) return;
    setActionNotice({ type: '', text: '' });
    setOnlinePaymentLoading(true);
    try {
      const amount = Number(onlinePaymentModal.amount || 0);
      const maxBalance = Number(record.balanceAmount || 0);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new Error('Enter a valid payment amount');
      }
      if (amount > maxBalance) {
        throw new Error('Amount cannot exceed outstanding balance');
      }

      const orderRes = await fetch(`${API_BASE}/api/fees/admin/razorpay/order`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify({
          invoiceId: record.invoiceId,
          amount,
          notes: onlinePaymentModal.notes || '',
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
        description: `${record.studentName || 'Student'} - ${record.className || ''}`,
        order_id: orderData.order?.id,
        prefill: {
          name: record.studentName || 'Parent',
        },
        notes: {
          invoiceId: String(record.invoiceId),
          studentName: record.studentName || '',
          className: record.className || '',
          section: record.section || '',
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
                invoiceId: record.invoiceId,
                amount,
                notes: onlinePaymentModal.notes || '',
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
              }),
            });
            const verifyData = await verifyRes.json().catch(() => ({}));
            if (!verifyRes.ok) {
              throw new Error(verifyData?.error || 'Payment verification failed');
            }
            await fetchRecords();
            setActionNotice({ type: 'success', text: 'Online payment captured successfully.' });
            setOnlinePaymentModal({
              open: false,
              record: null,
              amount: '',
              notes: '',
            });
          } catch (verifyErr) {
            setActionNotice({
              type: 'error',
              text: verifyErr.message || 'Unable to verify online payment',
            });
          } finally {
            setOnlinePaymentLoading(false);
          }
        },
        modal: {
          ondismiss: () => setOnlinePaymentLoading(false),
        },
      };

      const razorpay = new window.Razorpay(options);
      razorpay.open();
    } catch (err) {
      setActionNotice({ type: 'error', text: err.message || 'Unable to start online payment' });
      setOnlinePaymentLoading(false);
    }
  };

  const handleBulkGenerate = async () => {
    if (!bulkForm.academicYearId) {
      setBulkStatus({ type: 'error', text: 'Select a session before generating invoices.' });
      return;
    }
    if (!bulkForm.classId) {
      setBulkStatus({ type: 'error', text: 'Select a class before generating invoices.' });
      return;
    }
    if (bulkForm.dueDate) {
      const due = new Date(`${bulkForm.dueDate}T00:00:00`);
      const now = new Date();
      now.setHours(0, 0, 0, 0);
      if (due < now) {
        setBulkStatus({ type: 'error', text: 'Due date cannot be in the past.' });
        return;
      }
    }
    if (bulkTargetSummary.studentCount === 0) {
      setBulkStatus({
        type: 'error',
        text: 'No students found for selected class/section. Please check student mappings.',
      });
      return;
    }
    setBulkLoading(true);
    setBulkStatus({ type: '', text: '' });
    try {
      const payload = {
        academicYearId: bulkForm.academicYearId,
        classId: bulkForm.classId,
        section: bulkForm.section || undefined,
        title: bulkForm.title || undefined,
        dueDate: bulkForm.dueDate || undefined,
      };
      const res = await fetch(`${API_BASE}/api/fees/admin/invoices/bulk`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to generate invoices');
      }
      const className = classNameById.get(String(bulkForm.classId)) || 'Class';
      setBulkStatus({
        type: 'success',
        text: `Created ${data.createdCount} invoices (skipped ${data.skippedCount}) for ${className}${bulkForm.section ? ` - ${bulkForm.section}` : ''}.`,
      });
      fetchRecords();
    } catch (err) {
      setBulkStatus({ type: 'error', text: err.message || 'Unable to generate invoices' });
    } finally {
      setBulkLoading(false);
    }
  };

  const exportReport = () => {
    if (!records.length) return;
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.width;
    const currentDate = new Date().toLocaleDateString('en-IN');
    let y = 20;

    doc.setFontSize(16);
    doc.text('Fees Collection Report', pageWidth / 2, y, { align: 'center' });
    y += 8;
    doc.setFontSize(10);
    doc.text(`Generated on: ${currentDate}`, pageWidth / 2, y, { align: 'center' });
    y += 10;

    doc.setFontSize(9);
    doc.text('Student', 10, y);
    doc.text('Adm No', 45, y);
    doc.text('Class', 70, y);
    doc.text('Sec', 85, y);
    doc.text('Total', 100, y);
    doc.text('Paid', 125, y);
    doc.text('Due', 150, y);
    doc.text('Status', 175, y);
    y += 4;
    doc.line(10, y, pageWidth - 10, y);
    y += 6;

    records.forEach((record) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(record.studentName || '-'), 10, y);
      doc.text(String(record.admissionNumber || '-'), 45, y);
      doc.text(String(record.className || '-'), 70, y);
      doc.text(String(record.section || '-'), 85, y);
      doc.text(String(Number(record.totalAmount || 0).toLocaleString()), 100, y);
      doc.text(String(Number(record.paidAmount || 0).toLocaleString()), 125, y);
      doc.text(String(Number(record.balanceAmount || 0).toLocaleString()), 150, y);
      doc.text(String(record.status || '-'), 175, y);
      y += 6;
    });

    doc.save(`fees-report-${currentDate.replace(/\//g, '-')}.pdf`);
  };

  // ── Glass morphism design tokens ──────────────────────────────────────────
  const glassCard =
    'rounded-3xl border border-white/60 bg-white/55 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-2xl backdrop-saturate-[1.8]';
  const selectCls =
    'w-full rounded-full border border-white/70 bg-white/50 px-3.5 py-2.5 text-sm text-slate-900 outline-none backdrop-blur-md transition-all duration-200 focus:border-violet-300 focus:bg-white/85 focus:ring-4 focus:ring-violet-100';
  const inputCls = selectCls;
  const ghostBtn =
    'inline-flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/55 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/80';

  const STATUS_STYLE = {
    paid:    { bg: 'bg-emerald-50/70 text-emerald-700 border-emerald-200/70', dot: 'bg-emerald-500' },
    partial: { bg: 'bg-amber-50/70 text-amber-700 border-amber-200/70',       dot: 'bg-amber-500'   },
    due:     { bg: 'bg-rose-50/70 text-rose-700 border-rose-200/70',          dot: 'bg-rose-500'    },
  };
  const statusStyle = (s) => STATUS_STYLE[s] || STATUS_STYLE.due;

  const CARD_CONFIG = [
    { label: 'Total Students', value: summary.totalStudents,                 icon: Users,        ic: 'text-violet-500'  },
    { label: 'Total Fees',     value: formatCurrency(summary.totalDue),       icon: IndianRupee,  ic: 'text-violet-500'  },
    { label: 'Collected',      value: formatCurrency(summary.totalCollected), icon: CheckCircle2, ic: 'text-emerald-500' },
    { label: 'Pending',        value: formatCurrency(summary.totalPending),   icon: AlertCircle,  ic: 'text-rose-500'    },
  ];

  return (
    <div
      className="relative min-h-screen overflow-hidden bg-[#f1f5f9] p-4 sm:p-6"
      style={{ fontFamily: "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif" }}
    >
      <style>{`
        @keyframes fcFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .fc-in { animation: fcFadeUp .5s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* Ambient colour wash behind the frosted glass */}
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/4 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-emerald-200/25 blur-3xl" />

      <div className="relative mx-auto max-w-[1400px] space-y-5">

      {/* ── Page header ── */}
      <div className="fc-in flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/60 bg-white/60 shadow-[0_8px_24px_rgba(139,92,246,0.25)] backdrop-blur-md">
            <Wallet className="h-5 w-5 text-violet-500" />
          </div>
          <div>
            <h1 className="text-xl font-semibold leading-tight tracking-tight text-slate-900">Fees Collection</h1>
            <p className="mt-0.5 text-xs text-slate-500">Track invoices, collect payments, and manage fee structures</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportReport}
            className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/55 px-4 py-2.5 text-xs font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/80"
          >
            <Download className="h-3.5 w-3.5" />
            Export PDF
          </button>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-white/70 bg-white/55 px-4 py-2.5 text-xs font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/80 disabled:opacity-50"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {/* ── View tabs (+ Assign action on the Collect tab) ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="fc-in inline-flex items-center gap-1 rounded-full border border-white/60 bg-white/55 p-1 backdrop-blur-md">
        {[
          { key: 'overview', label: 'Overview', icon: BarChart4 },
          { key: 'payments', label: 'Collect & Manage', icon: CreditCard },
        ].map((tab) => (
          <button
            key={tab.key}
            type="button"
            onClick={() => setActiveView(tab.key)}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold transition-all duration-150 ${
              activeView === tab.key
                ? 'bg-violet-500 text-white shadow-[0_8px_20px_rgba(139,92,246,0.3)]'
                : 'text-slate-500 hover:bg-white/70'
            }`}
          >
            <tab.icon className="h-3.5 w-3.5" />
            {tab.label}
          </button>
        ))}
      </div>
      {activeView === 'payments' && (
        <button
          type="button"
          onClick={() => setShowAssignModal(true)}
          className="inline-flex items-center gap-2 rounded-full bg-emerald-500 px-4 py-2 text-xs font-semibold text-white shadow-[0_8px_20px_rgba(16,185,129,0.3)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-600"
        >
          <Plus className="h-3.5 w-3.5" />
          Assign
        </button>
      )}
      </div>

      {activeView === 'overview' && (
        <FeesDashboard embedded setShowAdminHeader={setShowAdminHeader} />
      )}

      {activeView === 'payments' && (
      <>
      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {CARD_CONFIG.map((card, i) => (
          <div
            key={card.label}
            className="fc-in flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/55 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-2xl backdrop-saturate-[1.8] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/70"
            style={{ animationDelay: `${60 + i * 60}ms` }}
          >
            <div>
              <p className="text-xs font-medium text-slate-500">{card.label}</p>
              <p className="mt-1 text-lg font-semibold text-slate-900">{card.value}</p>
            </div>
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/60 bg-white/60 backdrop-blur-md">
              <card.icon className={`h-5 w-5 ${card.ic}`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Notices ── */}
      {fetchError && (
        <div className="fc-in flex items-center gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-700 backdrop-blur-md">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {fetchError}
        </div>
      )}
      {actionNotice.text && (
        <div className={`fc-in flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm backdrop-blur-md ${
          actionNotice.type === 'success'
            ? 'border-emerald-200/70 bg-emerald-50/70 text-emerald-700'
            : 'border-rose-200/70 bg-rose-50/70 text-rose-700'
        }`}>
          {actionNotice.type === 'success'
            ? <CheckCircle2 className="h-4 w-4 shrink-0" />
            : <AlertCircle className="h-4 w-4 shrink-0" />}
          {actionNotice.text}
        </div>
      )}

      {/* ── Bulk assign modal ── */}
      {showAssignModal && (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 px-3 py-3 backdrop-blur-sm sm:px-4"
        onClick={() => setShowAssignModal(false)}
      >
      <div
        className="max-h-[calc(100vh-1.5rem)] w-full max-w-4xl space-y-5 overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-slate-200 bg-emerald-50">
              <FileText className="h-4 w-4 text-emerald-500" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-slate-900">Assign Fee Structure to Class</h2>
              <p className="mt-0.5 text-xs text-slate-500">Auto-generate invoices for all students in a class using the active fee structure</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setShowAssignModal(false)}
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step pills */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {['Select Session / Class / Section', 'Verify Structure', 'Click Assign'].map((step, i) => (
            <div key={step} className="flex items-center gap-2 rounded-xl border border-white/70 bg-white/45 px-3 py-2 backdrop-blur-md">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-600">{i + 1}</span>
              <span className="text-xs font-medium text-slate-600">{step}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Session</label>
            <select
              value={bulkForm.academicYearId}
              onChange={(e) =>
                setBulkForm((prev) => ({
                  ...prev,
                  academicYearId: e.target.value,
                  classId: '',
                  section: '',
                }))
              }
              className={selectCls}
            >
              <option value="">Select active session</option>
              {activeAcademicYears.map((year) => (
                <option key={year.id} value={year.id}>{year.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Class</label>
            <select
              value={bulkForm.classId}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, classId: e.target.value, section: '' }))}
              className={selectCls}
              disabled={!bulkForm.academicYearId}
            >
              <option value="">{bulkForm.academicYearId ? 'Select class' : 'Select session first'}</option>
              {bulkClassOptions.map((cls) => (
                <option key={cls.id} value={cls.id}>{cls.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Section <span className="font-normal normal-case text-slate-400">(optional)</span></label>
            <select
              value={bulkForm.section}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, section: e.target.value }))}
              className={selectCls}
              disabled={!bulkForm.classId}
            >
              <option value="">{bulkForm.classId ? 'All Sections' : 'Select class first'}</option>
              {bulkSections.map((sec) => (
                <option key={sec.id} value={sec.name}>{sec.name}</option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Due Date <span className="font-normal normal-case text-slate-400">(optional)</span></label>
            <input
              type="date"
              value={bulkForm.dueDate}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Invoice Title <span className="font-normal normal-case text-slate-400">(optional)</span></label>
            <input
              value={bulkForm.title}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, title: e.target.value }))}
              className={inputCls}
              placeholder="e.g. Annual Fee Invoice"
            />
          </div>
        </div>

        {/* Status row */}
        <div className="flex flex-wrap items-center gap-3">
          <div className={`min-w-[180px] flex-1 rounded-xl border px-4 py-2.5 text-xs font-medium backdrop-blur-md ${
            matchedBulkStructure
              ? 'border-emerald-200/70 bg-emerald-50/70 text-emerald-700'
              : 'border-white/70 bg-white/45 text-slate-400'
          }`}>
            <span className="font-semibold">Structure: </span>
            {matchedBulkStructure
              ? `${matchedBulkStructure.name || 'Structure'} · ₹${Number(matchedBulkStructure.totalAmount || 0).toLocaleString('en-IN')}`
              : (bulkForm.classId ? 'No active structure found for this class' : 'Select a class to see matched structure')}
          </div>
          <div className="rounded-xl border border-white/70 bg-white/45 px-4 py-2.5 text-xs text-slate-600 backdrop-blur-md">
            <span className="font-semibold">Academic Year: </span>
            {selectedBulkAcademicYear?.name || 'Not selected'}
          </div>
          <div className="rounded-xl border border-violet-200/70 bg-violet-50/70 px-4 py-2.5 text-xs text-violet-700 backdrop-blur-md">
            <span className="font-semibold">Target: </span>
            {bulkTargetSummary.className || 'No class'}{bulkTargetSummary.sectionName ? ` · ${bulkTargetSummary.sectionName}` : ''} · <span className="font-bold">{bulkTargetSummary.studentCount} students</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 border-t border-white/50 pt-4">
          <button
            onClick={handleBulkGenerate}
            disabled={bulkLoading || Boolean(bulkAssignDisabledReason)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(16,185,129,0.35)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-emerald-600 disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Assign to Class Students
          </button>
          {bulkAssignDisabledReason && (
            <span className="text-xs font-medium text-rose-500">{bulkAssignDisabledReason}</span>
          )}
          {bulkStatus.text && (
            <span className={`text-xs font-semibold ${bulkStatus.type === 'success' ? 'text-emerald-700' : 'text-rose-600'}`}>
              {bulkStatus.text}
            </span>
          )}
        </div>
      </div>
      </div>
      )}

      {/* ── Filters + Invoice list ── */}
      <div className={`fc-in overflow-hidden ${glassCard}`} style={{ animationDelay: '180ms' }}>
        {/* Filter bar */}
        <div className="space-y-4 border-b border-white/50 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListFilter className="h-4 w-4 text-slate-400" />
              <span className="text-sm font-semibold text-slate-800">Filters</span>
              {!loading && (
                <span className="rounded-full border border-violet-200/70 bg-violet-50/70 px-2 py-0.5 text-xs font-semibold text-violet-700">
                  {records.length} invoices
                </span>
              )}
            </div>
            <label className="inline-flex cursor-pointer select-none items-center gap-2 text-xs font-semibold text-rose-600">
              <input
                type="checkbox"
                checked={filters.overdue}
                onChange={(e) => setFilters((prev) => ({ ...prev, overdue: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-slate-300 text-rose-500 focus:ring-rose-400"
              />
              Overdue only
            </label>
          </div>
          {/* Full-width search + filter toggle */}
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
              <input
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className={`${inputCls} pl-9`}
                placeholder="Search by name / ID"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all duration-150 ${
                showFilters
                  ? 'border-rose-200 bg-rose-50 text-rose-600 hover:bg-rose-100'
                  : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              title={showFilters ? 'Close filters' : 'Show filters'}
              aria-label={showFilters ? 'Close filters' : 'Show filters'}
            >
              {showFilters ? <X className="h-4 w-4" /> : <ListFilter className="h-4 w-4" />}
              {!showFilters && (filters.academicYearId || filters.classId || filters.section || filters.status) && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-violet-500" />
              )}
            </button>
          </div>
          {showFilters && (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <select
              value={filters.academicYearId}
              onChange={(e) => setFilters((prev) => ({ ...prev, academicYearId: e.target.value, classId: '', section: '' }))}
              className={selectCls}
            >
              <option value="">All Sessions</option>
              {(filterOptions.academicYears || []).map((year) => (
                <option key={year.id} value={year.id}>{year.name}</option>
              ))}
            </select>
            <select value={filters.classId} onChange={(e) => setFilters((prev) => ({ ...prev, classId: e.target.value, section: '' }))} className={selectCls}>
              <option value="">All Classes</option>
              {filteredClasses.map((cls) => <option key={cls.id} value={cls.id}>{cls.name}</option>)}
            </select>
            <select value={filters.section} onChange={(e) => setFilters((prev) => ({ ...prev, section: e.target.value }))} className={selectCls}>
              <option value="">All Sections</option>
              {filteredSections.map((sec) => <option key={sec.id} value={sec.name}>{sec.name}</option>)}
            </select>
            <select value={filters.status} onChange={(e) => setFilters((prev) => ({ ...prev, status: e.target.value }))} className={selectCls}>
              <option value="">All Statuses</option>
              <option value="due">Due</option>
              <option value="partial">Partial</option>
              <option value="paid">Paid</option>
            </select>
          </div>
          )}
        </div>

        {/* Table */}
        {/* Body scrolls inside its own box (sticky header) so the page doesn't grow with the list. */}
        <div className="max-h-[60vh] overflow-auto">
          <table className="min-w-full">
            <thead className="sticky top-0 z-10">
              <tr className="border-b border-slate-200/70 bg-slate-50/95 backdrop-blur-md">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Student</th>
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">Class</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Total Fee</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Paid</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Outstanding</th>
                <th className="px-5 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-400">Status</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-400">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/50">
              {loading && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/60 bg-white/60 backdrop-blur-md">
                        <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                      </div>
                      <p className="text-sm text-slate-400">Loading fee invoices…</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-5 py-16 text-center">
                    <div className="mx-auto flex max-w-sm flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-300/70 py-10">
                      <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/60 bg-white/50 backdrop-blur-md">
                        <FileText className="h-7 w-7 text-slate-300" />
                      </div>
                      <p className="text-sm font-semibold text-slate-500">No invoices found</p>
                      <p className="text-xs text-slate-400">Try adjusting the filters above.</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && pagedRecords.map((record) => {
                const ss = statusStyle(record.status);
                const initials = (record.studentName || 'S').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
                const photo = resolvePhotoUrl(record.profilePic);
                const classSection = [record.className, record.section].filter(Boolean).join('-') || '—';
                return (
                  <tr key={record.invoiceId} className="transition-colors duration-150 hover:bg-white/50">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-100 text-xs font-bold text-violet-600">
                          {photo ? (
                            <img
                              src={photo}
                              alt={record.studentName || 'Student'}
                              className="h-full w-full object-cover"
                              onError={(e) => { e.currentTarget.style.display = 'none'; e.currentTarget.parentElement.textContent = initials; }}
                            />
                          ) : initials}
                        </div>
                        <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">{record.studentName || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm font-medium text-slate-600 whitespace-nowrap">{classSection}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-slate-800">{formatCurrency(record.totalAmount)}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-medium text-emerald-600">{formatCurrency(record.paidAmount)}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-rose-500">
                      {Number(record.balanceAmount || 0) > 0 ? formatCurrency(record.balanceAmount) : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold backdrop-blur-md ${ss.bg}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${ss.dot}`} />
                        {(record.status || 'due').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button onClick={() => handleViewDetails(record)} className={ghostBtn}>
                          <Eye className="h-3 w-3" />
                          Details
                        </button>
                        {Number(record.balanceAmount || 0) > 0 && (
                          <button
                            onClick={() => handleOpenOnlinePayment(record)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-violet-200/70 bg-violet-50/70 px-3 py-1.5 text-xs font-semibold text-violet-600 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-violet-100/70"
                          >
                            <CreditCard className="h-3 w-3" />
                            Pay
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && records.length > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-white/50 px-5 py-3 sm:flex-row">
            <p className="text-xs text-slate-500">
              Showing <span className="font-semibold text-slate-700">{(safeInvoicePage - 1) * INVOICE_PAGE_SIZE + 1}</span>–
              <span className="font-semibold text-slate-700">{Math.min(safeInvoicePage * INVOICE_PAGE_SIZE, records.length)}</span> of{' '}
              <span className="font-semibold text-slate-700">{records.length}</span> invoices
            </p>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setInvoicePage((p) => Math.max(1, p - 1))}
                disabled={safeInvoicePage <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Previous page"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: invoicePageCount }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === invoicePageCount || Math.abs(n - safeInvoicePage) <= 1)
                .map((n, idx, arr) => (
                  <React.Fragment key={n}>
                    {idx > 0 && n - arr[idx - 1] > 1 && <span className="px-1 text-xs text-slate-400">…</span>}
                    <button
                      type="button"
                      onClick={() => setInvoicePage(n)}
                      className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold transition-colors ${
                        n === safeInvoicePage
                          ? 'bg-violet-500 text-white shadow-sm'
                          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      {n}
                    </button>
                  </React.Fragment>
                ))}
              <button
                type="button"
                onClick={() => setInvoicePage((p) => Math.min(invoicePageCount, p + 1))}
                disabled={safeInvoicePage >= invoicePageCount}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-40"
                aria-label="Next page"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
      </>
      )}

      {/* ── Online Payment Modal ── */}
      {onlinePaymentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/30 backdrop-blur-md" onClick={handleCloseOnlinePayment} />
          <div className="fc-in relative w-full max-w-md overflow-hidden rounded-3xl border border-white/60 bg-white/80 shadow-[0_20px_60px_rgba(15,23,42,0.2)] backdrop-blur-2xl backdrop-saturate-[1.8]">
            <div className="flex items-center justify-between border-b border-white/50 px-6 py-5">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/60 bg-white/60 backdrop-blur-md">
                  <CreditCard className="h-4 w-4 text-violet-500" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">Collect Online Payment</h3>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {onlinePaymentModal.record?.studentName || 'Student'} · {onlinePaymentModal.record?.className || ''}{onlinePaymentModal.record?.section ? ` (${onlinePaymentModal.record.section})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseOnlinePayment}
                disabled={onlinePaymentLoading}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-all duration-150 hover:bg-white/70 hover:text-slate-600 disabled:opacity-50"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4 p-6">
              <div className="flex items-center justify-between rounded-xl border border-amber-200/70 bg-amber-50/70 px-4 py-3 backdrop-blur-md">
                <span className="text-xs font-semibold text-amber-700">Outstanding Balance</span>
                <span className="text-sm font-semibold text-amber-800">{formatCurrency(onlinePaymentModal.record?.balanceAmount || 0)}</span>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Payment Amount</label>
                <input
                  type="number"
                  min="0"
                  step="1"
                  value={onlinePaymentModal.amount}
                  onChange={(e) => setOnlinePaymentModal((prev) => ({ ...prev, amount: e.target.value }))}
                  className={inputCls}
                  placeholder="Enter amount"
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Notes <span className="font-normal normal-case text-slate-400">(optional)</span></label>
                <input
                  type="text"
                  value={onlinePaymentModal.notes}
                  onChange={(e) => setOnlinePaymentModal((prev) => ({ ...prev, notes: e.target.value }))}
                  className={inputCls}
                  placeholder="Reference note"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-white/50 px-6 py-4">
              <button
                type="button"
                onClick={handleCloseOnlinePayment}
                disabled={onlinePaymentLoading}
                className="rounded-xl border border-white/70 bg-white/55 px-4 py-2.5 text-sm font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/80 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartOnlinePayment}
                disabled={onlinePaymentLoading}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(139,92,246,0.35)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-violet-600 disabled:opacity-60"
              >
                {onlinePaymentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
                {onlinePaymentLoading ? 'Processing…' : 'Proceed to Razorpay'}
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
};

export default FeesCollection;
