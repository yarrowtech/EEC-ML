import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import toast from 'react-hot-toast';
import {
  AlertCircle,
  BookOpen,
  Calendar,
  CheckCircle2,
  Edit3,
  Download,
  FileText,
  IndianRupee,
  Layers,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
  Edit,
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
  lateFeeExcludeSundays: false,
  lateFeeExcludeHolidays: false,
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

const escapeHtmlLite = (value) =>
  String(value || '').replace(/[&<>"']/g, (ch) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[ch]));

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
  const [pdfSchool, setPdfSchool] = useState(DEFAULT_PDF_SCHOOL);

  const [formOpen, setFormOpen] = useState(false);
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 8;

  useEffect(() => {
    setShowAdminHeader?.(!formOpen);
  }, [setShowAdminHeader, formOpen]);

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
  // The first step that isn't finished yet is the one the stepper highlights
  // as "current" — once everything is filled in, it just stays on the last step.
  const currentStepIndex = !basicsDone ? 0 : !headsDone ? 1 : !installmentsDone ? 2 : 2;

  const filteredStructures = useMemo(() => {
    return structures.filter((item) => {
      if (selectedClass && String(item.classId) !== String(selectedClass)) return false;
      if (selectedYear && String(item.academicYearId) !== String(selectedYear)) return false;
      if (selectedBoard && String(item.board || 'GENERAL') !== selectedBoard) return false;
      const haystack = `${item.name || ''} ${item.className || ''} ${item.board || ''}`.toLowerCase();
      return haystack.includes(search.toLowerCase());
    });
  }, [structures, selectedClass, selectedYear, selectedBoard, search]);

  const totalPages = Math.max(1, Math.ceil(filteredStructures.length / PAGE_SIZE));
  useEffect(() => {
    setPage(1);
  }, [selectedClass, selectedYear, selectedBoard, search]);
  useEffect(() => {
    setPage((prev) => Math.min(prev, totalPages));
  }, [totalPages]);
  const paginatedStructures = useMemo(
    () => filteredStructures.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filteredStructures, page]
  );

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
      toast.error(err.message || 'Unable to load fee builder data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  const resetForm = () => {
    setActiveId('');
    // Session is no longer picked in the UI — keep it defaulted to the
    // active academic year instead of wiping it back to '' along with the
    // rest of the form, otherwise the Class dropdown has nothing to scope to.
    setForm({ ...EMPTY_FORM, academicYearId: activeAcademicYears[0]?.id || '' });
  };

  const handleResetClick = async () => {
    const confirm = await Swal.fire({
      icon: 'warning',
      title: 'Reset this form?',
      text: 'Are you sure you want to reset? Everything filled in on this form will be cleared.',
      showCancelButton: true,
      confirmButtonText: 'Yes, reset',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
    });
    if (confirm.isConfirmed) resetForm();
  };

  const openCreateForm = () => {
    resetForm();
    setFormOpen(true);
  };

  const closeForm = () => {
    setFormOpen(false);
    resetForm();
  };

  const editStructure = (structure) => {
    setActiveId(structure._id || '');
    setFormOpen(true);
    setForm({
      classId: structure.classId || '',
      className: structure.className || '',
      academicYearId: structure.academicYearId || '',
      board: structure.board || 'GENERAL',
      name: structure.name || '',
      lateFeeAmount: toAmount(structure.lateFeeAmount),
      lateFeeExcludeSundays: Boolean(structure.lateFeeExcludeSundays),
      lateFeeExcludeHolidays: Boolean(structure.lateFeeExcludeHolidays),
      feeHeads: (structure.feeHeads || []).map((item) => {
        const label = item.label || '';
        const isCustom = Boolean(label) && !FEE_HEAD_OPTIONS.includes(label);
        return {
          label: isCustom ? '' : label,
          customLabel: isCustom ? label : '',
          isCustom,
          amount: toAmount(item.amount),
        };
      }),
      installments: normalizeInstallments(structure.installments || []),
    });
  };

  const addHead = () =>
    setForm((prev) => ({
      ...prev,
      feeHeads: [...prev.feeHeads, { label: '', customLabel: '', amount: '', isCustom: false }],
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
    if (!form.classId) return toast.error('Class is required.');
    if (!String(form.name || '').trim()) return toast.error('Structure name is required.');

    const heads = form.feeHeads
      .map((item) => ({
        label: String(item.label || item.customLabel || '').trim(),
        amount: toAmount(item.amount),
      }))
      .filter((item) => item.label);
    if (!heads.length) return toast.error('Add at least one fee head.');
    if (heads.every((item) => item.amount === 0)) return toast.error('Fee head amount cannot be all zero.');

    const sameScope = structures.find(
      (item) =>
        String(item.classId || '') === String(form.classId) &&
        String(item.academicYearId || '') === String(form.academicYearId || '') &&
        String(item.board || 'GENERAL') === String(form.board || 'GENERAL') &&
        item._id !== activeId
    );
    if (sameScope) {
      return toast.error('A structure already exists for this class, board, and academic year.');
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
        lateFeeExcludeSundays: Boolean(form.lateFeeExcludeSundays),
        lateFeeExcludeHolidays: Boolean(form.lateFeeExcludeHolidays),
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
      setFormOpen(false);
      toast.success(isEdit ? 'Fee structure updated.' : 'Fee structure created.');
    } catch (err) {
      toast.error(err.message || 'Unable to save structure');
    } finally {
      setSaving(false);
    }
  };

  const setStructureActive = async (structure, isActive) => {
    const res = await fetch(`${API_BASE}/api/fees/structures/${structure._id}`, {
      method: 'PUT',
      headers: authHeaders(),
      body: JSON.stringify({ isActive }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Unable to update structure');
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
      if (!res.ok) {
        // Deleting would orphan the invoices already billed against this
        // structure — the backend refuses on purpose. Offer deactivating it
        // instead: it disappears from future use but existing invoices keep
        // their reference intact.
        if (res.status === 400 && /invoices/i.test(data?.error || '')) {
          const offer = await Swal.fire({
            icon: 'info',
            title: "Can't delete — invoices exist",
            text: `Students already have invoices billed against "${structure.name || 'this structure'}". Deactivating is the safe option (existing invoices keep working); force deleting removes the structure and every unpaid invoice tied to it — invoices with a recorded payment always block it.`,
            showCancelButton: true,
            showDenyButton: true,
            confirmButtonText: 'Deactivate instead',
            denyButtonText: 'Force delete…',
            cancelButtonText: 'Cancel',
            confirmButtonColor: '#7c3aed',
            denyButtonColor: '#dc2626',
          });
          if (offer.isConfirmed) {
            await setStructureActive(structure, false);
            await loadAll();
            toast.success('Fee structure deactivated — existing invoices are unaffected.');
          } else if (offer.isDenied) {
            await forceDeleteStructure(structure);
          }
          return;
        }
        throw new Error(data?.error || 'Unable to delete structure');
      }
      await loadAll();
      if (activeId === structure._id) resetForm();
      toast.success('Fee structure deleted.');
    } catch (err) {
      toast.error(err.message || 'Unable to delete structure');
    }
  };

  const forceDeleteStructure = async (structure) => {
    const structureName = structure.name || 'this structure';
    const typed = await Swal.fire({
      icon: 'warning',
      title: 'Type to confirm force delete',
      html: `This permanently deletes <b>${escapeHtmlLite(structureName)}</b> and every <u>unpaid</u> invoice billed against it. This cannot be undone.<br/><br/>Type <b>DELETE</b> to continue.`,
      input: 'text',
      inputPlaceholder: 'DELETE',
      showCancelButton: true,
      confirmButtonText: 'Force Delete',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#dc2626',
      inputValidator: (value) => (value === 'DELETE' ? undefined : 'Type DELETE (all caps) to confirm'),
    });
    if (!typed.isConfirmed) return;
    try {
      const res = await fetch(`${API_BASE}/api/fees/structures/${structure._id}?force=true`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to force delete structure');
      await loadAll();
      if (activeId === structure._id) resetForm();
      toast.success(
        data.invoicesDeleted > 0
          ? `Fee structure deleted along with ${data.invoicesDeleted} invoice(s).`
          : 'Fee structure deleted.'
      );
    } catch (err) {
      toast.error(err.message || 'Unable to force delete structure');
    }
  };

  const reactivateStructure = async (structure) => {
    try {
      await setStructureActive(structure, true);
      await loadAll();
      toast.success('Fee structure reactivated.');
    } catch (err) {
      toast.error(err.message || 'Unable to reactivate structure');
    }
  };

  const handleDownloadStructurePdf = async (structure) => {
    if (!structure) return;
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
      toast.success('Fee structure PDF downloaded.');
    } catch {
      toast.error('Unable to generate fee structure PDF');
    }
  };

  // ── Glass morphism design tokens (list page) ──────────────────────────────
  const glassCard =
    'rounded-3xl border border-white/60 bg-white/55 shadow-[0_8px_30px_rgba(15,23,42,0.06)] backdrop-blur-2xl backdrop-saturate-[1.8]';
  const iCls =
    'w-full rounded-xl border border-white/70 bg-white/50 px-3.5 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none backdrop-blur-md transition-all duration-200 focus:border-violet-300 focus:bg-white/85 focus:ring-4 focus:ring-violet-100';
  const sCls = iCls;
  const ghostBtn =
    'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:-translate-y-0.5 hover:bg-white/80';

  // ── Plain-form tokens (create/edit full page) ─────────────────────────────
  const fInput =
    'w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 outline-none transition-colors focus:border-violet-400 focus:ring-4 focus:ring-violet-100';
  const fSelect = fInput;
  const tblInput =
    'w-full rounded-md border border-transparent bg-transparent px-1.5 py-1 text-sm text-gray-800 outline-none transition-colors hover:border-gray-200 focus:border-violet-400 focus:bg-white focus:ring-2 focus:ring-violet-100';

  if (formOpen) {
    const STEPS = [
      { label: 'Basics', icon: FileText },
      { label: 'Fee Heads', icon: Layers },
      { label: 'Installments', icon: Calendar },
    ];

    // AdminHeader is hidden while this page is open, so no header-height
    // offset is needed here — just the mobile/tablet bottom tab bar
    // (AdminBottomNav, h-14, lg:hidden) that still renders underneath.
    return (
      <div className="flex h-[calc(100dvh-56px)] lg:h-dvh flex-col overflow-hidden bg-gray-50">
        {/* ── Full-page header ── */}
        <div className="flex shrink-0 items-center justify-between border-b border-gray-200 bg-white px-6 py-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">{activeId ? 'Edit Fee Structure' : 'Create Fee Structure'}</h1>
            <p className="mt-0.5 text-xs text-gray-500">Fill all 3 steps then save</p>
          </div>
          <button
            onClick={closeForm}
            className="flex h-9 w-9 items-center justify-center rounded-xl text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-600"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* ── Stepper ── */}
        <div className="shrink-0 border-b border-gray-200 bg-white px-6 py-5">
          <div className="mx-auto flex max-w-3xl items-center">
            {STEPS.map((step, i) => {
              const done = i < currentStepIndex;
              const active = i === currentStepIndex;
              return (
                <React.Fragment key={step.label}>
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold transition-colors ${
                        done
                          ? 'bg-emerald-500 text-white'
                          : active
                            ? 'bg-violet-600 text-white'
                            : 'border-2 border-gray-200 bg-white text-gray-400'
                      }`}
                    >
                      {done ? <CheckCircle2 className="h-4.5 w-4.5" /> : i + 1}
                    </span>
                    <span className={`text-sm font-semibold ${active || done ? 'text-gray-900' : 'text-gray-400'}`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`mx-4 h-0.5 flex-1 rounded-full ${done ? 'bg-emerald-400' : 'bg-gray-200'}`} />
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-6">
          <div className="mx-auto max-w-[1500px] space-y-5">
            {/* Panel 1 — Basics (full width) */}
            <div className="rounded-2xl border border-gray-200 bg-white">
              <div className="flex items-center gap-3 border-b border-gray-100 px-5 py-4">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600">
                  <FileText className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-bold text-gray-900">1. Basics</p>
                  <p className="truncate text-xs text-gray-400">Set the basic details for this fee structure</p>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-4 p-5 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Board <span className="text-rose-500">*</span></label>
                  <select value={form.board} onChange={(e) => setForm((prev) => ({ ...prev, board: e.target.value }))} className={fSelect}>
                    {BOARD_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Class <span className="text-rose-500">*</span></label>
                  <select
                    value={form.classId}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        classId: e.target.value,
                        className: classNameById.get(String(e.target.value)) || '',
                      }))
                    }
                    className={fSelect}
                    disabled={!form.academicYearId}
                  >
                    <option value="">{form.academicYearId ? 'Select class' : 'No active academic session'}</option>
                    {classOptionsByFormYear.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                  <p className="mt-1 text-[11px] text-gray-400">Classes for the current active academic session.</p>
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Structure Name <span className="text-rose-500">*</span></label>
                  <input
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="e.g. Class 5 Annual Fees 2026"
                    className={fInput}
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-xs font-semibold text-gray-600">Late Fine Amount (Per Day)</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-400">₹</span>
                    <input
                      type="number"
                      min="0"
                      value={form.lateFeeAmount}
                      onChange={(e) => setForm((prev) => ({ ...prev, lateFeeAmount: e.target.value }))}
                      placeholder="0"
                      className={`${fInput} pl-7`}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-gray-400">Auto-added daily after due date while unpaid.</p>
                </div>
              </div>

              {/* Late fine day-counting exclusions */}
              <div className="flex flex-wrap items-center gap-5 border-t border-gray-100 px-5 py-4">
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.lateFeeExcludeSundays}
                    onChange={(e) => setForm((prev) => ({ ...prev, lateFeeExcludeSundays: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-400"
                  />
                  Exclude Sundays
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    checked={form.lateFeeExcludeHolidays}
                    onChange={(e) => setForm((prev) => ({ ...prev, lateFeeExcludeHolidays: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-violet-600 focus:ring-violet-400"
                  />
                  Exclude School Holidays
                </label>
                <p className="w-full text-[11px] text-gray-400">
                  When checked, Sundays and/or this school&apos;s holiday-calendar dates don&apos;t count toward the late fine, even while an installment is overdue.
                </p>
              </div>
            </div>

            {/* Panels 2 & 3 — Fee Heads / Installments, 50/50 */}
            <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-2">
              {/* Panel 2 — Fee Heads */}
              <div className="rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600">
                      <Layers className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">2. Fee Heads</p>
                      <p className="truncate text-xs text-gray-400">Add fee components for this structure</p>
                    </div>
                  </div>
                  <button
                    onClick={addHead}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Head
                  </button>
                </div>

                {form.feeHeads.length === 0 ? (
                  <div className="p-5">
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-8 text-center text-xs text-gray-400">
                      No fee heads added — click &quot;Add Head&quot; above.
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto px-5 pt-2">
                    <table className="w-full min-w-[360px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="w-8 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">#</th>
                          <th className="py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Fee Head</th>
                          <th className="w-28 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Amount (₹)</th>
                          <th className="w-10 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400 text-right">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {form.feeHeads.map((item, index) => (
                          <tr key={index} className="align-top">
                            <td className="py-2 text-sm text-gray-400">{index + 1}</td>
                            <td className="py-2 pr-2">
                              <select
                                value={item.isCustom ? 'CUSTOM' : item.label}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  const isCustom = v === 'CUSTOM';
                                  setForm((prev) => ({
                                    ...prev,
                                    feeHeads: prev.feeHeads.map((head, idx) =>
                                      idx === index
                                        ? { ...head, isCustom, label: isCustom ? '' : v, customLabel: isCustom ? head.customLabel : '' }
                                        : head
                                    ),
                                  }));
                                }}
                                className={tblInput}
                              >
                                <option value="">Select fee head</option>
                                {FEE_HEAD_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                                <option value="CUSTOM">Custom…</option>
                              </select>
                              {item.isCustom && (
                                <input
                                  value={item.customLabel || ''}
                                  onChange={(e) => updateHead(index, 'customLabel', e.target.value)}
                                  placeholder="Custom fee head name"
                                  className={`${tblInput} mt-1`}
                                />
                              )}
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                min="0"
                                value={item.amount}
                                onChange={(e) => updateHead(index, 'amount', e.target.value)}
                                placeholder="0"
                                className={tblInput}
                              />
                            </td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => removeHead(index)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Panel footer stats */}
                <div className="mt-3 grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
                  <div>
                    <p className="text-[11px] font-medium text-gray-400">Total Fee Heads</p>
                    <p className="mt-0.5 text-base font-bold text-gray-900">{configuredHeads}</p>
                  </div>
                  <div className="pl-4">
                    <p className="text-[11px] font-medium text-gray-400">Total Amount</p>
                    <p className="mt-0.5 text-base font-bold text-violet-600">{money(formTotal)}</p>
                  </div>
                </div>
              </div>

              {/* Panel 3 — Installments */}
              <div className="rounded-2xl border border-gray-200 bg-white">
                <div className="flex items-center justify-between gap-3 border-b border-gray-100 px-5 py-4">
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-amber-50 text-amber-600">
                      <Calendar className="h-4.5 w-4.5" />
                    </span>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-gray-900">3. Installments</p>
                      <p className="truncate text-xs text-gray-400">Configure payment schedule</p>
                    </div>
                  </div>
                  <button
                    onClick={addInstallment}
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-semibold text-violet-700 transition-colors hover:bg-violet-100"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add Installment
                  </button>
                </div>

                {form.installments.length === 0 ? (
                  <div className="p-5">
                    <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/60 py-8 text-center text-xs text-gray-400">
                      No installments — fee will be collected as a lump sum.
                    </div>
                  </div>
                ) : (
                  <div className="overflow-x-auto px-5 pt-2">
                    <table className="w-full min-w-[420px] border-collapse text-left">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="w-8 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">#</th>
                          <th className="py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Installment</th>
                          <th className="w-24 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Amount (₹)</th>
                          <th className="w-36 py-2 text-[11px] font-semibold uppercase tracking-wider text-gray-400">Due Date</th>
                          <th className="w-10 py-2 text-right text-[11px] font-semibold uppercase tracking-wider text-gray-400">Actions</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-50">
                        {form.installments.map((item, index) => (
                          <tr key={index}>
                            <td className="py-2 text-sm text-gray-400">{index + 1}</td>
                            <td className="py-2 pr-2">
                              <input
                                value={item.label}
                                onChange={(e) => updateInstallment(index, 'label', e.target.value)}
                                placeholder="e.g. Term 1"
                                className={tblInput}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="number"
                                min="0"
                                value={item.amount}
                                onChange={(e) => updateInstallment(index, 'amount', e.target.value)}
                                placeholder="0"
                                className={tblInput}
                              />
                            </td>
                            <td className="py-2 pr-2">
                              <input
                                type="date"
                                value={item.dueDate || ''}
                                onChange={(e) => updateInstallment(index, 'dueDate', e.target.value)}
                                className={tblInput}
                              />
                            </td>
                            <td className="py-2 text-right">
                              <button
                                onClick={() => removeInstallment(index)}
                                className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-rose-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Panel footer stats */}
                <div className="mt-3 grid grid-cols-2 divide-x divide-gray-100 border-t border-gray-100 bg-gray-50/60 px-5 py-3">
                  <div>
                    <p className="text-[11px] font-medium text-gray-400">Total Installments</p>
                    <p className="mt-0.5 text-base font-bold text-gray-900">{configuredInstallments}</p>
                  </div>
                  <div className="pl-4">
                    <p className="text-[11px] font-medium text-gray-400">Total Amount</p>
                    <p className="mt-0.5 text-base font-bold text-violet-600">{money(installmentTotal)}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Balanced / difference banner */}
            {(configuredHeads > 0 || configuredInstallments > 0) && (
              <div
                className={`flex items-center gap-3 rounded-2xl border px-5 py-4 ${
                  differenceTotal === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'
                }`}
              >
                <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${differenceTotal === 0 ? 'bg-emerald-500' : 'bg-amber-500'} text-white`}>
                  {differenceTotal === 0 ? <CheckCircle2 className="h-5 w-5" /> : <AlertCircle className="h-5 w-5" />}
                </span>
                <div>
                  <p className={`text-sm font-bold ${differenceTotal === 0 ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {differenceTotal === 0 ? 'Structure is balanced' : 'Installments don’t add up yet'}
                  </p>
                  <p className={`mt-0.5 text-xs ${differenceTotal === 0 ? 'text-emerald-700' : 'text-amber-700'}`}>
                    {differenceTotal === 0
                      ? 'All amounts and installments are valid.'
                      : configuredInstallments > 0
                        ? `Off by ${money(Math.abs(differenceTotal))} — the last installment will be auto-adjusted on save.`
                        : 'Add installments, or leave them empty to collect the full amount as a lump sum.'}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Action bar ── */}
        <div className="flex shrink-0 flex-col-reverse items-stretch gap-3 border-t border-gray-200 bg-white px-6 py-4 sm:flex-row sm:items-center sm:justify-end">
          <button
            onClick={closeForm}
            className="rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            onClick={handleResetClick}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white px-4 py-2.5 text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" />
            Reset
          </button>
          <button
            onClick={saveStructure}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-violet-700 disabled:opacity-60"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? 'Saving…' : activeId ? 'Update Structure' : 'Save Structure'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-fade-in relative flex h-[calc(100dvh-94px)] md:h-[calc(100dvh-150px)] lg:h-[calc(100dvh-94px)] flex-col overflow-hidden bg-[#f1f5f9] p-4 sm:p-6">
      <style>{`
        @keyframes fmFadeUp { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: none; } }
        .fm-in { animation: fmFadeUp .5s cubic-bezier(.22,1,.36,1) both; }
      `}</style>

      {/* Ambient colour wash behind the frosted glass */}
      <div className="pointer-events-none absolute -left-24 -top-32 h-80 w-80 rounded-full bg-violet-300/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-24 top-1/3 h-96 w-96 rounded-full bg-sky-300/25 blur-3xl" />
      <div className="pointer-events-none absolute -bottom-24 left-1/3 h-80 w-80 rounded-full bg-emerald-200/25 blur-3xl" />

      <div className="relative mx-auto flex w-full max-w-[1400px] flex-1 min-h-0 flex-col space-y-4">

      {/* ── Page header ── */}
      <div className="fm-in flex shrink-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" style={{ animationDelay: '0ms' }}>
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
          <button
            onClick={openCreateForm}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-violet-500 px-4 py-2.5 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(139,92,246,0.35)] transition-all duration-150 hover:-translate-y-0.5 hover:bg-violet-600 sm:w-auto"
          >
            <Plus className="h-3.5 w-3.5" />
            Add Fees
          </button>
        </div>
      </div>

      {/* ── Stats cards ── */}
      <div className="grid shrink-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* ── Saved Structures table ── */}
      <div className={`fm-in flex flex-1 min-h-0 flex-col overflow-hidden ${glassCard}`} style={{ animationDelay: '300ms' }}>
        {/* Filter bar */}
        <div className="shrink-0 space-y-3 border-b border-white/50 px-6 py-4">
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

        {/* Structure table */}
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
            <p className="text-xs text-slate-400">Try adjusting filters, or click &quot;Add Fees&quot; to create one.</p>
          </div>
        )}
        {!loading && filteredStructures.length > 0 && (
          <div className="flex-1 min-h-0 overflow-auto">
            <table className="w-full min-w-[860px] border-collapse text-left">
              <thead className="sticky top-0 z-[1] bg-white/85 backdrop-blur-md">
                <tr className="border-b border-white/60">
                  <th className="px-6 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Structure</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Class</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Board</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Session</th>
                  <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Late Fine</th>
                  <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">Total</th>
                  <th className="px-4 py-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/50">
                {paginatedStructures.map((item, i) => (
                  <tr
                    key={item._id}
                    className={`fm-in transition-colors duration-150 ${activeId === item._id ? 'bg-violet-50/50' : 'hover:bg-white/50'}`}
                    style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
                  >
                    <td className="px-6 py-3.5">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-semibold text-slate-900">{item.name || 'Unnamed'}</p>
                        {item.isActive === false && (
                          <span className="inline-flex items-center rounded-full border border-gray-200 bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <p className="mt-0.5 text-[11px] text-slate-400">{(item.feeHeads || []).length} heads · {(item.installments || []).length} installments</p>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full border border-violet-200/70 bg-violet-50/70 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
                        {item.className || classNameById.get(String(item.classId)) || '—'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full border border-slate-200/70 bg-slate-100/70 px-2 py-0.5 text-[11px] font-semibold text-slate-600">
                        {item.board || 'GENERAL'}
                      </span>
                    </td>
                    <td className="px-4 py-3.5">
                      {item.academicYearId ? (
                        <span className="inline-flex items-center rounded-full border border-sky-200/70 bg-sky-50/70 px-2 py-0.5 text-[11px] font-semibold text-sky-700">
                          {yearNameById.get(String(item.academicYearId)) || 'Academic Year'}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3.5">
                      <span className="inline-flex items-center rounded-full border border-rose-200/70 bg-rose-50/70 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                        {money(item.lateFeeAmount || 0)}/day
                      </span>
                    </td>
                    <td className="px-4 py-3.5 text-right text-sm font-semibold text-slate-900">{money(item.totalAmount)}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap items-center justify-center gap-2">
                        <button onClick={() => editStructure(item)} className={ghostBtn} title="Edit">
                          <Edit className="h-3.5 w-3.5 text-violet-500" />
                        </button>
                        <button onClick={() => handleDownloadStructurePdf(item)} className={ghostBtn} title="Download PDF">
                          <Download className="h-3.5 w-3.5 text-emerald-500" />
                        </button>
                        <button onClick={() => deleteStructure(item)} className={ghostBtn} title="Delete">
                          <Trash2 className="h-3.5 w-3.5 text-rose-500" />
                        </button>
                        {item.isActive === false && (
                          <button onClick={() => reactivateStructure(item)} className={ghostBtn} title="Reactivate">
                            <RefreshCw className="h-3.5 w-3.5 text-emerald-500" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && filteredStructures.length > 0 && (
          <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-t border-white/50 px-6 py-3">
            <p className="text-xs text-slate-400">
              Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, filteredStructures.length)} of {filteredStructures.length}
            </p>
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
                className="rounded-lg border border-white/70 bg-white/55 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Prev
              </button>
              <span className="px-2 text-xs font-semibold text-slate-500">{page} / {totalPages}</span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
                className="rounded-lg border border-white/70 bg-white/55 px-3 py-1.5 text-xs font-semibold text-slate-600 backdrop-blur-md transition-all duration-150 hover:bg-white/80 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
      </div>
    </div>
  );
};

export default FeesManagement;
