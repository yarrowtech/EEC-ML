import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import {
  AlertCircle,
  BookOpen,
  CheckCircle2,
  Edit3,
  Download,
  IndianRupee,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Save,
  Search,
  Trash2,
  X,
} from 'lucide-react';
import { downloadFeesStructurePdf } from '../../utils/feesStructurePdf';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const BOARD_OPTIONS = ['GENERAL', 'CBSE', 'ICSE', 'STATE', 'IB'];
const FEE_HEAD_OPTIONS = [
  'Tuition fee',
  'Admission / Registration fee',
  'Development fee',
  'Library fee',
  'Laboratory fee',
  'Examination fee',
  'Sports / Activity fee',
  'Transport fee',
  'Uniform / Books fee',
  'Miscellaneous charges',
];

const EMPTY_FORM = {
  classId: '',
  className: '',
  academicYearId: '',
  board: 'GENERAL',
  name: '',
  lateFeeAmount: '',
  feeHeads: [],
  installments: [],
};

const DEFAULT_PDF_SCHOOL = {
  schoolName: '',
  schoolAddressLine: '',
  schoolContactLine: '',
  logoUrl: '',
  logoUrlOverride: '',
  accentColor: '#0f172a',
};

const toAmount = (value) => {
  const amount = Number(value);
  return Number.isFinite(amount) ? Math.max(0, amount) : 0;
};

const money = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(Number(value || 0));

const authHeaders = () => ({
  'Content-Type': 'application/json',
  authorization: `Bearer ${localStorage.getItem('token')}`,
});

const normalizeInstallments = (items) =>
  (items || []).map((item) => ({
    label: String(item?.label || '').trim(),
    amount: toAmount(item?.amount),
    dueDate: item?.dueDate ? String(item.dueDate).slice(0, 10) : '',
  }));

const FeesManagement = ({ setShowAdminHeader }) => {
  const [filters, setFilters] = useState({ classes: [], academicYears: [] });
  const [structures, setStructures] = useState([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [activeId, setActiveId] = useState('');
  const [search, setSearch] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedBoard, setSelectedBoard] = useState('');
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [pdfSchool, setPdfSchool] = useState(DEFAULT_PDF_SCHOOL);

  useEffect(() => {
    setShowAdminHeader?.(false);
  }, [setShowAdminHeader]);

  const classNameById = useMemo(
    () => new Map((filters.classes || []).map((item) => [String(item.id), item.name])),
    [filters.classes]
  );

  const yearNameById = useMemo(
    () => new Map((filters.academicYears || []).map((item) => [String(item.id), item.name])),
    [filters.academicYears]
  );
  const activeAcademicYears = useMemo(
    () => (filters.academicYears || []).filter((year) => Boolean(year?.isActive)),
    [filters.academicYears]
  );
  const classOptionsByFormYear = useMemo(() => {
    if (!form.academicYearId) return [];
    return (filters.classes || []).filter(
      (cls) => String(cls?.academicYearId || '') === String(form.academicYearId)
    );
  }, [filters.classes, form.academicYearId]);
  const classOptionsBySelectedYear = useMemo(() => {
    if (!selectedYear) return [];
    return (filters.classes || []).filter(
      (cls) => String(cls?.academicYearId || '') === String(selectedYear)
    );
  }, [filters.classes, selectedYear]);
  useEffect(() => {
    if (!selectedClass) return;
    const classStillValid = classOptionsBySelectedYear.some(
      (cls) => String(cls.id) === String(selectedClass)
    );
    if (!classStillValid) setSelectedClass('');
  }, [classOptionsBySelectedYear, selectedClass]);

  const formTotal = useMemo(
    () => form.feeHeads.reduce((sum, item) => sum + toAmount(item.amount), 0),
    [form.feeHeads]
  );
  const installmentTotal = useMemo(
    () => form.installments.reduce((sum, item) => sum + toAmount(item.amount), 0),
    [form.installments]
  );
  const differenceTotal = useMemo(() => formTotal - installmentTotal, [formTotal, installmentTotal]);
  const configuredHeads = useMemo(
    () =>
      form.feeHeads.filter((item) => String(item.label || item.customLabel || '').trim()).length,
    [form.feeHeads]
  );
  const configuredInstallments = useMemo(
    () => form.installments.filter((item) => String(item.label || '').trim()).length,
    [form.installments]
  );
  const basicsDone = Boolean(form.classId && String(form.name || '').trim());
  const headsDone = configuredHeads > 0;
  const installmentsDone = configuredInstallments > 0;
  const FLOW_COMPLETED = [basicsDone, headsDone, installmentsDone].filter(Boolean).length;


  const filteredStructures = useMemo(() => {
    return structures.filter((item) => {
      if (selectedClass && String(item.classId) !== String(selectedClass)) return false;
      if (selectedYear && String(item.academicYearId) !== String(selectedYear)) return false;
      if (selectedBoard && String(item.board || 'GENERAL') !== selectedBoard) return false;
      const haystack = `${item.name || ''} ${item.className || ''} ${item.board || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [structures, selectedClass, selectedYear, selectedBoard, search]);

  const dashboardStats = useMemo(() => {
    if (!filteredStructures.length) {
      return {
        count: 0,
        totalValue: 0,
        averageValue: 0,
        classesCovered: 0,
      };
    }
    const totalValue = filteredStructures.reduce(
      (sum, item) => sum + toAmount(item.totalAmount),
      0
    );
    const classIds = new Set(
      filteredStructures
        .map((item) => {
          if (item.classId) return String(item.classId);
          if (item.className) return `${item.className}-${item.board || 'GENERAL'}`;
          return null;
        })
        .filter(Boolean)
    );
    return {
      count: filteredStructures.length,
      totalValue,
      averageValue: Math.round(totalValue / filteredStructures.length),
      classesCovered: classIds.size,
    };
  }, [filteredStructures]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [filtersRes, structuresRes, templateRes] = await Promise.all([
        fetch(`${API_BASE}/api/fees/admin/filters`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/fees/structures`, { headers: authHeaders() }),
        fetch(`${API_BASE}/api/reports/report-cards/template`, { headers: authHeaders() }),
      ]);
      const filtersData = await filtersRes.json().catch(() => ({}));
      const structuresData = await structuresRes.json().catch(() => ([]));
      const templateData = await templateRes.json().catch(() => ({}));
      if (!filtersRes.ok) throw new Error(filtersData?.error || 'Failed to load filters');
      if (!structuresRes.ok) throw new Error(structuresData?.error || 'Failed to load fee structures');
      setFilters({
        classes: filtersData.classes || [],
        academicYears: filtersData.academicYears || [],
      });
      setStructures(Array.isArray(structuresData) ? structuresData : []);
      if (templateRes.ok && templateData && typeof templateData === 'object') {
        setPdfSchool({
          schoolName: String(templateData.schoolName || '').trim(),
          schoolAddressLine: String(templateData.schoolAddressLine || '').trim(),
          schoolContactLine: String(templateData.schoolContactLine || '').trim(),
          logoUrl: String(templateData.logoUrl || '').trim(),
          logoUrlOverride: String(templateData.logoUrlOverride || '').trim(),
          accentColor: String(templateData.accentColor || '#0f172a').trim() || '#0f172a',
        });
      } else {
        setPdfSchool(DEFAULT_PDF_SCHOOL);
      }
      const activeYear = (filtersData.academicYears || []).find((year) => Boolean(year?.isActive));
      if (activeYear?.id) {
        setSelectedYear((prev) => (prev ? prev : String(activeYear.id)));
        setForm((prev) =>
          prev.academicYearId
            ? prev
            : { ...prev, academicYearId: String(activeYear.id), classId: '', className: '' }
        );
      }
    } catch (err) {
      setError(err.message || 'Unable to load fee builder data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const resetForm = () => {
    setActiveId('');
    setForm(EMPTY_FORM);
    setError('');
    setNotice('');
  };

  const editStructure = (structure) => {
    setActiveId(structure._id || '');
    setError('');
    setNotice('');
    setForm({
      classId: structure.classId || '',
      className: structure.className || '',
      academicYearId: structure.academicYearId || '',
      board: structure.board || 'GENERAL',
      name: structure.name || '',
      lateFeeAmount: toAmount(structure.lateFeeAmount),
      feeHeads: (structure.feeHeads || []).map((item) => ({
        label: item.label || '',
        customLabel: '',
        amount: toAmount(item.amount),
      })),
      installments: normalizeInstallments(structure.installments || []),
    });
  };

  const addHead = () =>
    setForm((prev) => ({
      ...prev,
      feeHeads: [...prev.feeHeads, { label: '', customLabel: '', amount: '' }],
    }));

  const removeHead = (index) =>
    setForm((prev) => ({
      ...prev,
      feeHeads: prev.feeHeads.filter((_, idx) => idx !== index),
    }));

  const updateHead = (index, key, value) =>
    setForm((prev) => ({
      ...prev,
      feeHeads: prev.feeHeads.map((head, idx) => (idx === index ? { ...head, [key]: value } : head)),
    }));

  const addInstallment = () =>
    setForm((prev) => ({
      ...prev,
      installments: [...prev.installments, { label: '', amount: '', dueDate: '' }],
    }));

  const removeInstallment = (index) =>
    setForm((prev) => ({
      ...prev,
      installments: prev.installments.filter((_, idx) => idx !== index),
    }));

  const updateInstallment = (index, key, value) =>
    setForm((prev) => ({
      ...prev,
      installments: prev.installments.map((item, idx) => (idx === index ? { ...item, [key]: value } : item)),
    }));

  const saveStructure = async () => {
    setError('');
    setNotice('');
    if (!form.classId) return setError('Class is required.');
    if (!String(form.name || '').trim()) return setError('Structure name is required.');

    const heads = form.feeHeads
      .map((item) => ({
        label: String(item.label || item.customLabel || '').trim(),
        amount: toAmount(item.amount),
      }))
      .filter((item) => item.label);
    if (!heads.length) return setError('Add at least one fee head.');
    if (heads.every((item) => item.amount === 0)) return setError('Fee head amount cannot be all zero.');

    const sameScope = structures.find(
      (item) =>
        String(item.classId || '') === String(form.classId) &&
        String(item.academicYearId || '') === String(form.academicYearId || '') &&
        String(item.board || 'GENERAL') === String(form.board || 'GENERAL') &&
        item._id !== activeId
    );
    if (sameScope) {
      return setError('A structure already exists for this class, board, and academic year.');
    }

    const totalAmount = heads.reduce((sum, item) => sum + item.amount, 0);
    const installments = normalizeInstallments(form.installments).filter((item) => item.label);
    if (installments.length) {
      const installmentSum = installments.reduce((sum, item) => sum + item.amount, 0);
      const diff = totalAmount - installmentSum;
      if (diff !== 0) {
        installments[installments.length - 1].amount = toAmount(installments[installments.length - 1].amount + diff);
      }
    }

    setSaving(true);
    try {
      const payload = {
        classId: form.classId,
        className: form.className || classNameById.get(String(form.classId)) || '',
        academicYearId: form.academicYearId || undefined,
        board: form.board || 'GENERAL',
        name: String(form.name || '').trim(),
        lateFeeAmount: toAmount(form.lateFeeAmount),
        totalAmount,
        feeHeads: heads,
        installments,
      };
      const isEdit = Boolean(activeId);
      const endpoint = isEdit
        ? `${API_BASE}/api/fees/structures/${activeId}`
        : `${API_BASE}/api/fees/structures`;
      const res = await fetch(endpoint, {
        method: isEdit ? 'PUT' : 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to save structure');
      await loadAll();
      resetForm();
      setNotice(isEdit ? 'Fee structure updated.' : 'Fee structure created.');
    } catch (err) {
      setError(err.message || 'Unable to save structure');
    } finally {
      setSaving(false);
    }
  };

  const deleteStructure = async (structure) => {
    if (!structure?._id) return;
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Delete fee structure?',
      text: `Delete "${structure.name || 'this structure'}"?`,
      showCancelButton: true,
      confirmButtonText: 'Yes, Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (!confirm.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/fees/structures/${structure._id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to delete structure');
      await loadAll();
      if (activeId === structure._id) resetForm();
      setNotice('Fee structure deleted.');
    } catch (err) {
      setError(err.message || 'Unable to delete structure');
    }
  };

  const handleDownloadStructurePdf = async (structure) => {
    if (!structure) return;
    setError('');
    setNotice('');
    try {
      const academicYearName =
        yearNameById.get(String(structure.academicYearId || '')) || '';
      await downloadFeesStructurePdf({
        structure: {
          ...structure,
          academicYearName,
        },
        school: pdfSchool,
      });
      setNotice('Fee structure PDF downloaded.');
    } catch {
      setError('Unable to generate fee structure PDF');
    }
  };

  // ── Glass morphism design tokens ──────────────────────────────────────────
  const glassCard =
    'rounded-3xl border border-white/60 bg-white/55 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-2xl backdrop-saturate-[1.8]';
  const glassInset =
    'rounded-xl border border-white/70 bg-white/45 backdrop-blur-md backdrop-saturate-[1.8]';
  const iCls =
    'w-full rounded-xl border border-white/70 bg-white/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none backdrop-blur-md transition-all duration-200 focus:border-violet-300 focus:bg-white/85 focus:ring-4 focus:ring-violet-100';
  const sCls = iCls;
  const ghostBtn =
    'inline-flex items-center gap-1.5 rounded-xl border border-white/70 bg-white/55 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/80';

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#f1f5f9] p-4 sm:p-6">
      <style>{`
        @keyframes fmFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .fm-in { animation: fmFadeUp .5s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* Ambient colour wash behind the frosted glass */}
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-emerald-200/25 blur-3xl" />

      <div className="relative mx-auto max-w-[1400px] space-y-5">

      {/* ── Page header ── */}
      <div className="fm-in flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: '0ms' }}>
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/60 bg-white/60 shadow-[0_8px_24px_rgba(139,92,246,0.25)] backdrop-blur-md">
            <Layers className="h-5 w-5 text-violet-500" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold leading-tight tracking-tight text-slate-900 sm:text-xl">Fee Structure Management</h1>
            <p className="mt-0.5 text-xs text-slate-500">Build class-wise fee structures with heads and installment plans</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadAll}
            disabled={loading}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-white/70 bg-white/55 px-4 py-2.5 text-xs font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/80 disabled:opacity-50 sm:w-auto"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Refresh
          </button>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: 'Structures',      value: loading ? '…' : dashboardStats.count,               icon: BookOpen,    ic: 'text-violet-500'  },
          { label: 'Total Value',     value: loading ? '…' : money(dashboardStats.totalValue),   icon: IndianRupee, ic: 'text-violet-500'  },
          { label: 'Average Value',   value: loading ? '…' : money(dashboardStats.averageValue), icon: IndianRupee, ic: 'text-emerald-500' },
          { label: 'Classes Covered', value: loading ? '…' : dashboardStats.classesCovered,      icon: Layers,      ic: 'text-amber-500'   },
        ].map((card, i) => (
          <div
            key={card.label}
            className={`fm-in flex items-center justify-between gap-3 rounded-2xl border border-white/60 bg-white/55 p-5 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-2xl backdrop-saturate-[1.8] transition-all duration-200 hover:-translate-y-0.5 hover:bg-white/70`}
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
      {error  && <div className="fm-in flex items-center gap-2.5 rounded-2xl border border-rose-200/70 bg-rose-50/70 px-4 py-3 text-sm text-rose-700 backdrop-blur-md"><AlertCircle className="h-4 w-4 shrink-0" />{error}</div>}
      {notice && <div className="fm-in flex items-center gap-2.5 rounded-2xl border border-emerald-200/70 bg-emerald-50/70 px-4 py-3 text-sm text-emerald-700 backdrop-blur-md"><CheckCircle2 className="h-4 w-4 shrink-0" />{notice}</div>}

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1fr_480px]">

        {/* ── Left: Saved Structures ── */}
        <div className={`fm-in overflow-hidden ${glassCard}`} style={{ animationDelay: '300ms' }}>
          {/* Filter bar */}
          <div className="space-y-3 border-b border-white/50 px-6 py-4">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-800">Saved Structures</span>
              {!loading && (
                <span className="rounded-full border border-violet-200/70 bg-violet-50/70 px-2.5 py-1 text-xs font-semibold text-violet-700">
                  {filteredStructures.length} {filteredStructures.length === 1 ? 'structure' : 'structures'}
                </span>
              )}
            </div>
            <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <div className="relative sm:col-span-2 lg:col-span-1">
                <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search name…" className={`${iCls} pl-9`} />
              </div>
              <select value={selectedYear} onChange={(e) => setSelectedYear(e.target.value)} className={sCls}>
                <option value="">Select Active Session</option>
                {activeAcademicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
              </select>
              <select
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                className={sCls}
                disabled={!selectedYear}
              >
                <option value="">{selectedYear ? 'All Classes' : 'Select session first'}</option>
                {classOptionsBySelectedYear.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select value={selectedBoard} onChange={(e) => setSelectedBoard(e.target.value)} className={sCls}>
                <option value="">All Boards</option>
                {BOARD_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
          </div>

          {/* Structure list */}
          <div className="max-h-[620px] divide-y divide-white/50 overflow-y-auto">
            {loading && (
              <div className="flex flex-col items-center justify-center gap-3 py-16">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/60 bg-white/60 backdrop-blur-md">
                  <Loader2 className="h-5 w-5 animate-spin text-violet-500" />
                </div>
                <p className="text-sm text-slate-400">Loading structures…</p>
              </div>
            )}
            {!loading && filteredStructures.length === 0 && (
              <div className="m-6 flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-slate-300/70 py-14">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/60 bg-white/50 backdrop-blur-md">
                  <BookOpen className="h-7 w-7 text-slate-300" />
                </div>
                <p className="text-sm font-semibold text-slate-500">No structures found</p>
                <p className="text-xs text-slate-400">Try adjusting filters or create a new structure.</p>
              </div>
            )}
            {!loading && filteredStructures.map((item, i) => (
              <div
                key={item._id}
                className={`fm-in px-6 py-4 transition-colors duration-150 ${activeId === item._id ? 'border-l-4 border-l-violet-400 bg-violet-50/50' : 'border-l-4 border-l-transparent hover:bg-white/50'}`}
                style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
                  <div className="min-w-0">
                    <h3 className="truncate text-sm font-semibold text-slate-900">{item.name || 'Unnamed'}</h3>
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="inline-flex items-center rounded-full border border-violet-200/70 bg-violet-50/70 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                        {item.className || classNameById.get(String(item.classId)) || '—'}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-100/70 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {item.board || 'GENERAL'}
                      </span>
                      <span className="inline-flex items-center rounded-full border border-rose-200/70 bg-rose-50/70 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                        Fine {money(item.lateFeeAmount || 0)}/day
                      </span>
                      {item.academicYearId && (
                        <span className="inline-flex items-center rounded-full border border-sky-200/70 bg-sky-50/70 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                          {yearNameById.get(String(item.academicYearId)) || 'Academic Year'}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-left sm:text-right">
                    <p className="text-base font-semibold text-slate-900">{money(item.totalAmount)}</p>
                    <p className="mt-0.5 text-[11px] text-slate-400">{(item.feeHeads || []).length} heads · {(item.installments || []).length} installments</p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button onClick={() => editStructure(item)} className={ghostBtn}>
                    <Edit3 className="h-3 w-3 text-violet-500" />
                    Edit
                  </button>
                  <button onClick={() => handleDownloadStructurePdf(item)} className={ghostBtn}>
                    <Download className="h-3 w-3 text-emerald-500" />
                    PDF
                  </button>
                  <button onClick={() => deleteStructure(item)} className={ghostBtn}>
                    <Trash2 className="h-3 w-3 text-rose-500" />
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Right: Form Builder ── */}
        <div className={`fm-in ${glassCard} xl:sticky xl:top-6 xl:max-h-[calc(100vh-6rem)] xl:overflow-y-auto`} style={{ animationDelay: '360ms' }}>
          {/* Form header */}
          <div className="flex items-center justify-between border-b border-white/50 px-6 py-5">
            <div>
              <h2 className="text-sm font-semibold text-slate-900">{activeId ? 'Edit Structure' : 'Create Structure'}</h2>
              <p className="mt-0.5 text-xs text-slate-500">Fill all 3 steps then save</p>
            </div>
            {activeId && (
              <button
                onClick={resetForm}
                className="flex h-8 w-8 items-center justify-center rounded-xl text-slate-400 transition-all duration-150 hover:bg-white/70 hover:text-slate-600"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="space-y-6 p-6">
            {/* Step indicators */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: '1. Basics',       done: basicsDone },
                { label: '2. Fee Heads',    done: headsDone },
                { label: '3. Installments', done: installmentsDone },
              ].map((step) => (
                <div
                  key={step.label}
                  className={`flex items-center justify-center gap-1.5 rounded-xl border py-2 text-xs font-semibold backdrop-blur-md transition-all duration-200 ${
                    step.done
                      ? 'border-emerald-200/70 bg-emerald-50/70 text-emerald-700'
                      : 'border-white/70 bg-white/45 text-slate-400'
                  }`}
                >
                  {step.done && <CheckCircle2 className="h-3.5 w-3.5" />}
                  {step.label}
                </div>
              ))}
            </div>

            {/* Step 1 — Basics */}
            <div className="space-y-3">
              <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Step 1 — Basics</p>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Board</label>
                <select value={form.board} onChange={(e) => setForm((prev) => ({ ...prev, board: e.target.value }))} className={sCls}>
                  {BOARD_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Structure Name <span className="text-rose-400">*</span></label>
                <input
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  placeholder="e.g. Class 9 Annual Fees 2026"
                  className={iCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Session <span className="text-rose-400">*</span></label>
                <select
                  value={form.academicYearId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      academicYearId: e.target.value,
                      classId: '',
                      className: '',
                    }))
                  }
                  className={sCls}
                >
                  <option value="">Select active session</option>
                  {activeAcademicYears.map((y) => <option key={y.id} value={y.id}>{y.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Class <span className="text-rose-400">*</span></label>
                <select
                  value={form.classId}
                  onChange={(e) =>
                    setForm((prev) => ({
                      ...prev,
                      classId: e.target.value,
                      className: classNameById.get(String(e.target.value)) || '',
                    }))
                  }
                  className={sCls}
                  disabled={!form.academicYearId}
                >
                  <option value="">{form.academicYearId ? 'Select class' : 'Select session first'}</option>
                  {classOptionsByFormYear.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="block text-[11px] font-semibold uppercase tracking-wider text-slate-500">Late Fine Amount (Per Day)</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">₹</span>
                  <input
                    type="number"
                    min="0"
                    value={form.lateFeeAmount}
                    onChange={(e) => setForm((prev) => ({ ...prev, lateFeeAmount: e.target.value }))}
                    placeholder="0"
                    className={`${iCls} pl-7`}
                  />
                </div>
                <p className="text-[11px] text-slate-400">Auto-added daily after due date while invoice remains unpaid.</p>
              </div>
            </div>

            {/* Step 2 — Fee Heads */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Step 2 — Fee Heads</p>
                <button onClick={addHead} className={ghostBtn}>
                  <Plus className="h-3.5 w-3.5 text-violet-500" />
                  Add Head
                </button>
              </div>

              {form.feeHeads.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300/70 bg-white/30 py-6 text-center text-xs text-slate-400">
                  No fee heads added — click "Add Head" above.
                </div>
              ) : (
                <div className="space-y-2">
                  {form.feeHeads.map((item, index) => (
                    <div key={index} className={`space-y-2 p-3 ${glassInset}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Head {index + 1}</span>
                        <button onClick={() => removeHead(index)} className="flex h-6 w-6 items-center justify-center rounded-lg text-rose-400 transition-all duration-150 hover:bg-rose-50/70 hover:text-rose-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <select
                        value={FEE_HEAD_OPTIONS.includes(item.label) ? item.label : 'CUSTOM'}
                        onChange={(e) => {
                          const v = e.target.value;
                          const isCustom = v === 'CUSTOM';
                          updateHead(index, 'label', isCustom ? '' : v);
                          if (!isCustom) updateHead(index, 'customLabel', '');
                        }}
                        className={sCls}
                      >
                        <option value="">Select fee head</option>
                        {FEE_HEAD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                        <option value="CUSTOM">Custom…</option>
                      </select>
                      {!FEE_HEAD_OPTIONS.includes(item.label) && (
                        <input
                          value={item.customLabel || ''}
                          onChange={(e) => updateHead(index, 'customLabel', e.target.value)}
                          placeholder="Enter custom fee head name"
                          className={iCls}
                        />
                      )}
                      <div className="relative">
                        <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">₹</span>
                        <input
                          type="number"
                          min="0"
                          value={item.amount}
                          onChange={(e) => updateHead(index, 'amount', e.target.value)}
                          placeholder="Amount"
                          className={`${iCls} pl-7`}
                        />
                      </div>
                    </div>
                  ))}
                  <div className="flex items-center justify-between rounded-xl border border-violet-200/70 bg-violet-50/70 px-4 py-2.5 backdrop-blur-md">
                    <span className="text-xs font-semibold text-violet-700">Heads Total</span>
                    <span className="text-sm font-semibold text-violet-900">{money(formTotal)}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Step 3 — Installments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Step 3 — Installments</p>
                <button onClick={addInstallment} className={ghostBtn}>
                  <Plus className="h-3.5 w-3.5 text-violet-500" />
                  Add Installment
                </button>
              </div>

              {form.installments.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300/70 bg-white/30 py-6 text-center text-xs text-slate-400">
                  No installments — fee will be collected as a lump sum.
                </div>
              ) : (
                <div className="space-y-2">
                  {form.installments.map((item, index) => (
                    <div key={index} className={`space-y-2 p-3 ${glassInset}`}>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Installment {index + 1}</span>
                        <button onClick={() => removeInstallment(index)} className="flex h-6 w-6 items-center justify-center rounded-lg text-rose-400 transition-all duration-150 hover:bg-rose-50/70 hover:text-rose-600">
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                      <input
                        value={item.label}
                        onChange={(e) => updateInstallment(index, 'label', e.target.value)}
                        placeholder="e.g. Term 1, Quarter 2"
                        className={iCls}
                      />
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">₹</span>
                          <input
                            type="number"
                            min="0"
                            value={item.amount}
                            onChange={(e) => updateInstallment(index, 'amount', e.target.value)}
                            placeholder="Amount"
                            className={`${iCls} pl-7`}
                          />
                        </div>
                        <input
                          type="date"
                          value={item.dueDate || ''}
                          onChange={(e) => updateInstallment(index, 'dueDate', e.target.value)}
                          className={iCls}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Totals summary */}
            {(form.feeHeads.length > 0 || form.installments.length > 0) && (
              <div className="divide-y divide-white/50 overflow-hidden rounded-2xl border border-white/70 bg-white/45 backdrop-blur-md">
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-semibold text-slate-600">Fee Heads Total</span>
                  <span className="text-sm font-semibold text-slate-900">{money(formTotal)}</span>
                </div>
                <div className="flex items-center justify-between px-4 py-3">
                  <span className="text-xs font-semibold text-slate-600">Installments Total</span>
                  <span className="text-sm font-semibold text-slate-900">{money(installmentTotal)}</span>
                </div>
                <div className={`flex items-center justify-between px-4 py-3 ${differenceTotal === 0 ? 'bg-emerald-50/70' : 'bg-amber-50/70'}`}>
                  <span className={`flex items-center gap-1.5 text-xs font-semibold ${differenceTotal === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {differenceTotal === 0 && <CheckCircle2 className="h-3.5 w-3.5" />}
                    {differenceTotal === 0 ? 'Balanced' : 'Difference'}
                  </span>
                  <span className={`text-sm font-semibold ${differenceTotal === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {differenceTotal === 0 ? 'Matched' : money(Math.abs(differenceTotal))}
                  </span>
                </div>
                {configuredInstallments > 0 && differenceTotal !== 0 && (
                  <div className="bg-amber-50/70 px-4 py-2.5">
                    <p className="text-[11px] text-amber-700">Last installment will be auto-adjusted on save to match the total.</p>
                  </div>
                )}
              </div>
            )}

            {/* Actions */}
            <div className="flex flex-col-reverse gap-3 border-t border-white/50 pt-4 sm:flex-row sm:items-center sm:justify-end">
              <button
                onClick={resetForm}
                className="w-full rounded-xl border border-white/70 bg-white/55 px-4 py-2.5 text-sm font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/80 sm:w-auto"
              >
                Reset
              </button>
              <button
                onClick={saveStructure}
                disabled={saving}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-5 py-2.5 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(139,92,246,0.35)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-violet-600 disabled:opacity-60 sm:w-auto"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving…' : activeId ? 'Update Structure' : 'Save Structure'}
              </button>
            </div>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
};

export default FeesManagement;
