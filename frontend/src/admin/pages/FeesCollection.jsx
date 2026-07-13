import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { jsPDF } from 'jspdf';
import {
  AlertCircle,
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
} from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

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
  const [filters, setFilters] = useState({
    academicYearId: '',
    classId: '',
    section: '',
    status: '',
    overdue: false,
    search: '',
  });
  const [filterOptions, setFilterOptions] = useState({
    classes: [],
    sections: [],
    academicYears: [],
  });
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchError, setFetchError] = useState('');

  const [students, setStudents] = useState([]);
  const [structures, setStructures] = useState([]);
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

  useEffect(() => {
    setShowAdminHeader?.(false);
  }, [setShowAdminHeader]);

  const loadFilters = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/fees/admin/filters`, {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load filters');
      }
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
    } catch (err) {
      console.error(err);
    }
  };

  const fetchRecords = async () => {
    setLoading(true);
    setFetchError('');
    try {
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

      const res = await fetch(`${API_BASE}/api/fees/admin/invoices?${params.toString()}`, {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load invoices');
      }
      setRecords(Array.isArray(data) ? data : []);
    } catch (err) {
      setFetchError(err.message || 'Unable to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const fetchStudents = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/admin/users/get-students`, {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load students');
      }
      setStudents(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchStructures = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/fees/structures`, {
        headers: {
          'Content-Type': 'application/json',
          authorization: `Bearer ${localStorage.getItem('token')}`,
        },
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to load structures');
      }
      setStructures(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadFilters();
    fetchRecords();
    fetchStudents();
    fetchStructures();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    fetchRecords();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

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

  const selectCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50';
  const inputCls = 'w-full rounded-xl border border-gray-200 bg-gray-50 px-3.5 py-2.5 text-sm text-gray-900 placeholder-gray-300 outline-none transition-all focus:border-indigo-400 focus:bg-white focus:ring-4 focus:ring-indigo-50';

  const STATUS_STYLE = {
    paid:    { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200',    dot: 'bg-emerald-500' },
    partial: { bg: 'bg-amber-50 text-amber-700 border-amber-200',          dot: 'bg-amber-500'   },
    due:     { bg: 'bg-red-50 text-red-700 border-red-200',                dot: 'bg-red-500'     },
  };
  const statusStyle = (s) => STATUS_STYLE[s] || STATUS_STYLE.due;

  const CARD_CONFIG = [
    { label: 'Total Students', value: summary.totalStudents, icon: Users,        bg: 'bg-indigo-50',  ic: 'text-indigo-500'  },
    { label: 'Total Fees',     value: formatCurrency(summary.totalDue),       icon: IndianRupee,  bg: 'bg-violet-50',  ic: 'text-violet-500'  },
    { label: 'Collected',      value: formatCurrency(summary.totalCollected),  icon: CheckCircle2, bg: 'bg-emerald-50', ic: 'text-emerald-500' },
    { label: 'Pending',        value: formatCurrency(summary.totalPending),    icon: AlertCircle,  bg: 'bg-red-50',     ic: 'text-red-500'     },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 space-y-5">

      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-indigo-500 flex items-center justify-center shadow-md shadow-indigo-200">
            <Wallet className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-black text-gray-900 leading-tight">Fees Collection</h1>
            <p className="text-xs text-gray-400 mt-0.5">Track invoices, collect payments, and manage fee structures</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={exportReport}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all shadow-sm"
          >
            <Download className="w-3.5 h-3.5" />
            Export PDF
          </button>
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {/* ── Summary cards ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {CARD_CONFIG.map((card) => (
          <div key={card.label} className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm flex items-center justify-between gap-3">
            <div>
              <p className="text-xs text-gray-500 font-medium">{card.label}</p>
              <p className="text-lg font-black text-gray-900 mt-1">{card.value}</p>
            </div>
            <div className={`w-10 h-10 rounded-2xl ${card.bg} flex items-center justify-center shrink-0`}>
              <card.icon className={`w-5 h-5 ${card.ic}`} />
            </div>
          </div>
        ))}
      </div>

      {/* ── Notices ── */}
      {fetchError && (
        <div className="flex items-center gap-2.5 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {fetchError}
        </div>
      )}
      {actionNotice.text && (
        <div className={`flex items-center gap-2.5 rounded-2xl border px-4 py-3 text-sm ${
          actionNotice.type === 'success'
            ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
            : 'border-red-200 bg-red-50 text-red-700'
        }`}>
          {actionNotice.type === 'success'
            ? <CheckCircle2 className="w-4 h-4 shrink-0" />
            : <AlertCircle className="w-4 h-4 shrink-0" />}
          {actionNotice.text}
        </div>
      )}

      {/* ── Bulk assign section ── */}
      <div className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 flex items-center justify-center">
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-sm font-bold text-gray-900">Assign Fee Structure to Class</h2>
            <p className="text-xs text-gray-400 mt-0.5">Auto-generate invoices for all students in a class using the active fee structure</p>
          </div>
        </div>

        {/* Step pills */}
        <div className="grid grid-cols-3 gap-2">
          {['Select Session / Class / Section', 'Verify Structure', 'Click Assign'].map((step, i) => (
            <div key={step} className="flex items-center gap-2 rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
              <span className="w-5 h-5 rounded-full bg-indigo-100 text-indigo-600 text-[10px] font-bold flex items-center justify-center shrink-0">{i + 1}</span>
              <span className="text-xs text-gray-600 font-medium">{step}</span>
            </div>
          ))}
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Session</label>
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
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Class</label>
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
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Section <span className="normal-case font-normal text-gray-400">(optional)</span></label>
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
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Due Date <span className="normal-case font-normal text-gray-400">(optional)</span></label>
            <input
              type="date"
              value={bulkForm.dueDate}
              onChange={(e) => setBulkForm((prev) => ({ ...prev, dueDate: e.target.value }))}
              className={inputCls}
            />
          </div>
          <div className="space-y-1.5">
            <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Invoice Title <span className="normal-case font-normal text-gray-400">(optional)</span></label>
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
          <div className={`flex-1 min-w-[180px] rounded-xl border px-4 py-2.5 text-xs font-medium ${
            matchedBulkStructure
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-gray-200 bg-gray-50 text-gray-400'
          }`}>
            <span className="font-semibold">Structure: </span>
            {matchedBulkStructure
              ? `${matchedBulkStructure.name || 'Structure'} · ₹${Number(matchedBulkStructure.totalAmount || 0).toLocaleString('en-IN')}`
              : (bulkForm.classId ? 'No active structure found for this class' : 'Select a class to see matched structure')}
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-2.5 text-xs text-gray-600">
            <span className="font-semibold">Academic Year: </span>
            {selectedBulkAcademicYear?.name || 'Not selected'}
          </div>
          <div className="rounded-xl border border-indigo-100 bg-indigo-50 px-4 py-2.5 text-xs text-indigo-700">
            <span className="font-semibold">Target: </span>
            {bulkTargetSummary.className || 'No class'}{bulkTargetSummary.sectionName ? ` · ${bulkTargetSummary.sectionName}` : ''} · <span className="font-bold">{bulkTargetSummary.studentCount} students</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1 border-t border-gray-50">
          <button
            onClick={handleBulkGenerate}
            disabled={bulkLoading || Boolean(bulkAssignDisabledReason)}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            {bulkLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            Assign to Class Students
          </button>
          {bulkAssignDisabledReason && (
            <span className="text-xs text-red-500 font-medium">{bulkAssignDisabledReason}</span>
          )}
          {bulkStatus.text && (
            <span className={`text-xs font-semibold ${bulkStatus.type === 'success' ? 'text-emerald-700' : 'text-red-600'}`}>
              {bulkStatus.text}
            </span>
          )}
        </div>
      </div>

      {/* ── Filters + Invoice list ── */}
      <div className="rounded-3xl border border-gray-100 bg-white shadow-sm overflow-hidden">
        {/* Filter bar */}
        <div className="px-6 py-4 border-b border-gray-50 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListFilter className="w-4 h-4 text-gray-400" />
              <span className="text-sm font-bold text-gray-800">Filters</span>
              {!loading && (
                <span className="text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 px-2 py-0.5 rounded-full">
                  {records.length} invoices
                </span>
              )}
            </div>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-red-600 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={filters.overdue}
                onChange={(e) => setFilters((prev) => ({ ...prev, overdue: e.target.checked }))}
                className="h-3.5 w-3.5 rounded border-gray-300 text-red-500 focus:ring-red-400"
              />
              Overdue only
            </label>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
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
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={filters.search}
                onChange={(e) => setFilters((prev) => ({ ...prev, search: e.target.value }))}
                className={`${inputCls} pl-9`}
                placeholder="Name / adm. no / ID"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="min-w-full">
            <thead>
              <tr className="bg-gray-50/80 border-b border-gray-100">
                <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Student</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Adm. No</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Class</th>
                <th className="px-5 py-3 text-left text-[11px] font-bold text-gray-400 uppercase tracking-wider">Sec</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Total Fee</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Paid</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Outstanding</th>
                <th className="px-5 py-3 text-center text-[11px] font-bold text-gray-400 uppercase tracking-wider">Status</th>
                <th className="px-5 py-3 text-right text-[11px] font-bold text-gray-400 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-indigo-50 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 text-indigo-500 animate-spin" />
                      </div>
                      <p className="text-sm text-gray-400">Loading fee invoices…</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && records.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-16 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <div className="w-14 h-14 rounded-3xl bg-gray-50 border border-gray-100 flex items-center justify-center">
                        <FileText className="w-7 h-7 text-gray-200" />
                      </div>
                      <p className="text-sm font-semibold text-gray-500">No invoices found</p>
                      <p className="text-xs text-gray-400">Try adjusting the filters above.</p>
                    </div>
                  </td>
                </tr>
              )}
              {!loading && records.map((record) => {
                const ss = statusStyle(record.status);
                const initials = (record.studentName || 'S').split(' ').map(w => w[0]).slice(0,2).join('').toUpperCase();
                return (
                  <tr key={record.invoiceId} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-xl bg-indigo-100 text-indigo-600 text-xs font-bold flex items-center justify-center shrink-0">
                          {initials}
                        </div>
                        <span className="text-sm font-semibold text-gray-800">{record.studentName || '—'}</span>
                      </div>
                    </td>
                    <td className="px-5 py-3.5 text-sm text-gray-500">{record.admissionNumber || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{record.className || '—'}</td>
                    <td className="px-5 py-3.5 text-sm text-gray-600">{record.section || '—'}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-semibold text-gray-800">{formatCurrency(record.totalAmount)}</td>
                    <td className="px-5 py-3.5 text-right text-sm text-emerald-600 font-medium">{formatCurrency(record.paidAmount)}</td>
                    <td className="px-5 py-3.5 text-right text-sm font-bold text-red-500">
                      {Number(record.balanceAmount || 0) > 0 ? formatCurrency(record.balanceAmount) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-center">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${ss.bg}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${ss.dot}`} />
                        {(record.status || 'due').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          onClick={() => handleViewDetails(record)}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-all"
                        >
                          <Eye className="h-3 w-3" />
                          Details
                        </button>
                        {Number(record.balanceAmount || 0) > 0 && (
                          <button
                            onClick={() => handleOpenOnlinePayment(record)}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-600 hover:bg-indigo-100 transition-all"
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
      </div>

      {/* ── Online Payment Modal ── */}
      {onlinePaymentModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleCloseOnlinePayment} />
          <div className="relative w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-indigo-50 flex items-center justify-center">
                  <CreditCard className="w-4.5 h-4.5 text-indigo-600" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-900">Collect Online Payment</h3>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {onlinePaymentModal.record?.studentName || 'Student'} · {onlinePaymentModal.record?.className || ''}{onlinePaymentModal.record?.section ? ` (${onlinePaymentModal.record.section})` : ''}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCloseOnlinePayment}
                disabled={onlinePaymentLoading}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-all disabled:opacity-50"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 px-4 py-3">
                <span className="text-xs font-semibold text-amber-700">Outstanding Balance</span>
                <span className="text-sm font-black text-amber-800">{formatCurrency(onlinePaymentModal.record?.balanceAmount || 0)}</span>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Payment Amount</label>
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
                <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Notes <span className="normal-case font-normal text-gray-400">(optional)</span></label>
                <input
                  type="text"
                  value={onlinePaymentModal.notes}
                  onChange={(e) => setOnlinePaymentModal((prev) => ({ ...prev, notes: e.target.value }))}
                  className={inputCls}
                  placeholder="Reference note"
                />
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-gray-100">
              <button
                type="button"
                onClick={handleCloseOnlinePayment}
                disabled={onlinePaymentLoading}
                className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-all disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleStartOnlinePayment}
                disabled={onlinePaymentLoading}
                className="inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-bold text-white shadow-md transition-all disabled:opacity-60"
                style={{ background: 'linear-gradient(135deg,#4f46e5 0%,#6366f1 60%,#818cf8 100%)' }}
              >
                {onlinePaymentLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CreditCard className="w-4 h-4" />}
                {onlinePaymentLoading ? 'Processing…' : 'Proceed to Razorpay'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeesCollection;
