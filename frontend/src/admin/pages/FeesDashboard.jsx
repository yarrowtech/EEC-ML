import React, { useState, useEffect, useMemo } from 'react';
import {
  Calendar,
  Download,
  Users,
  AlertCircle,
  School,
  Search,
  TrendingUp,
  CheckCircle,
  Clock,
  IndianRupee,
  CreditCard,
  X,
} from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL;
const DATE_RANGE_OPTIONS = [
  { value: '30d', label: 'Last 30 Days' },
  { value: '7d', label: 'Last 7 Days' },
  { value: 'all', label: 'All Time' },
];

const FONT_STACK = "'Inter Variable', Inter, system-ui, -apple-system, 'Segoe UI', sans-serif";

// Glass surface presets — frosted, semi-transparent, soft-bordered.
const GLASS_CARD = 'rounded-2xl border border-white/70 bg-white/60 backdrop-blur-xl backdrop-saturate-150 shadow-[0_8px_30px_rgba(15,23,42,0.06)]';
const GLASS_INNER = 'rounded-xl border border-white/70 bg-white/50 backdrop-blur-md';
const GLASS_INPUT = 'text-xs border border-white/70 rounded-xl px-3 py-2 bg-white/50 backdrop-blur-md focus:ring-2 focus:ring-violet-500/30 focus:border-violet-400 focus:outline-none transition-all';

const escapeCsv = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;

// Local-calendar date key (YYYY-MM-DD). Using toISOString() here would bucket an
// evening payment into the next UTC day for IST and similar +ve offsets.
const localDateKey = (value) => {
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const FeesDashboard = ({ setShowAdminHeader }) => {
  useEffect(() => {
    setShowAdminHeader(false);
  }, [setShowAdminHeader]);

  const [searchTerm, setSearchTerm] = useState('');
  const [dateRange, setDateRange] = useState('30d');
  const [selectedSession, setSelectedSession] = useState('');
  const [selectedClass, setSelectedClass] = useState('');
  const [selectedSection, setSelectedSection] = useState('');
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    const loadSummary = async () => {
      setError('');
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/fees/admin/summary`, {
          headers: {
            'Content-Type': 'application/json',
            authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          signal: controller.signal,
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data?.error || data?.message || 'Failed to load fees dashboard data');
        }
        setSummary(data);
      } catch (err) {
        if (controller.signal.aborted) return;
        console.error(err);
        setError(err.message || 'Failed to load dashboard data');
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };
    loadSummary();
    return () => controller.abort();
  }, []);

  const totals = summary?.totals || {
    totalOutstanding: 0,
    totalCollected: 0,
    totalInvoiced: 0,
    totalStudents: 0,
    overdueInvoices: 0,
  };
  const enrollmentData = summary?.enrollment || [];
  const outstandingFeesData = summary?.outstandingSegments || [];
  const recentPayments = summary?.recentPayments || [];
  const dateRangeLabel =
    DATE_RANGE_OPTIONS.find((option) => option.value === dateRange)?.label || 'Last 30 Days';

  const rangeStart = useMemo(() => {
    if (dateRange === 'all') return null;
    const now = new Date();
    const days = dateRange === '7d' ? 7 : 30;
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    start.setDate(start.getDate() - (days - 1));
    return start;
  }, [dateRange]);

  const paymentsByDateRange = useMemo(() => {
    if (!rangeStart) return recentPayments;
    return recentPayments.filter((payment) => {
      if (!payment?.paidOn) return false;
      const paidOn = new Date(payment.paidOn);
      if (Number.isNaN(paidOn.getTime())) return false;
      return paidOn >= rangeStart;
    });
  }, [recentPayments, rangeStart]);

  const sessionOptions = useMemo(() => {
    const values = new Set();
    paymentsByDateRange.forEach((payment) => {
      values.add(payment.session || 'Unassigned');
    });
    return Array.from(values).sort();
  }, [paymentsByDateRange]);

  const classOptions = useMemo(() => {
    const values = new Set();
    paymentsByDateRange.forEach((payment) => {
      if (selectedSession && (payment.session || 'Unassigned') !== selectedSession) return;
      values.add(payment.className || 'Unassigned');
    });
    return Array.from(values).sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }, [paymentsByDateRange, selectedSession]);

  const sectionOptions = useMemo(() => {
    const values = new Set();
    paymentsByDateRange.forEach((payment) => {
      const sessionLabel = payment.session || 'Unassigned';
      const classLabel = payment.className || 'Unassigned';
      if (selectedSession && sessionLabel !== selectedSession) return;
      if (selectedClass && classLabel !== selectedClass) return;
      values.add(payment.section || 'Unassigned');
    });
    return Array.from(values).sort();
  }, [paymentsByDateRange, selectedSession, selectedClass]);

  useEffect(() => {
    if (selectedSession && !sessionOptions.includes(selectedSession)) {
      setSelectedSession('');
      setSelectedClass('');
      setSelectedSection('');
    }
  }, [sessionOptions, selectedSession]);

  useEffect(() => {
    if (selectedClass && !classOptions.includes(selectedClass)) {
      setSelectedClass('');
      setSelectedSection('');
    }
  }, [classOptions, selectedClass]);

  useEffect(() => {
    if (selectedSection && !sectionOptions.includes(selectedSection)) {
      setSelectedSection('');
    }
  }, [sectionOptions, selectedSection]);

  const filteredPayments = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return paymentsByDateRange.filter((payment) => {
      const sessionLabel = payment.session || 'Unassigned';
      const classLabel = payment.className || 'Unassigned';
      const sectionLabel = payment.section || 'Unassigned';
      const matchesSearch =
        !term ||
        [payment.studentName, payment.username, payment.transactionId, payment.admissionNo, payment.className, payment.section, payment.status]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(term));
      const matchesSession = !selectedSession || sessionLabel === selectedSession;
      const matchesClass = !selectedClass || classLabel === selectedClass;
      const matchesSection = !selectedSection || sectionLabel === selectedSection;
      return matchesSearch && matchesSession && matchesClass && matchesSection;
    });
  }, [paymentsByDateRange, searchTerm, selectedSession, selectedClass, selectedSection]);

  const formatCurrency = (amount = 0) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);

  const getStatusColor = (status) =>
    status === 'Paid'
      ? 'bg-emerald-100/80 text-emerald-700'
      : status === 'Partial'
        ? 'bg-amber-100/80 text-amber-700'
        : 'bg-slate-100/80 text-slate-600';

  const openPaymentDetails = (payment) => {
    setSelectedPayment(payment);
  };

  const closePaymentDetails = () => {
    setSelectedPayment(null);
  };

  const collectionTrend = useMemo(() => {
    const today = new Date();
    const result = [];
    for (let i = 6; i >= 0; i -= 1) {
      const date = new Date(today);
      date.setDate(today.getDate() - i);
      const key = localDateKey(date);
      result.push({
        key,
        label: date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }),
        value: 0,
      });
    }
    const seriesMap = result.reduce((map, entry) => {
      map.set(entry.key, entry);
      return map;
    }, new Map());
    paymentsByDateRange.forEach((payment) => {
      if (!payment.paidOn) return;
      const paidOnKey = localDateKey(payment.paidOn);
      if (seriesMap.has(paidOnKey)) {
        seriesMap.get(paidOnKey).value += Number(payment.amount || 0);
      }
    });
    return result;
  }, [paymentsByDateRange]);

  const peakCollection = Math.max(
    ...collectionTrend.map((entry) => entry.value),
    1
  );

  const generateReport = () => {
    const exportDate = new Date();
    const rows = [];

    rows.push(['FEES DASHBOARD REPORT']);
    rows.push(['Generated At', exportDate.toLocaleString('en-IN')]);
    rows.push(['Date Range', dateRangeLabel]);
    rows.push([]);

    rows.push(['SUMMARY']);
    rows.push(['Metric', 'Value']);
    rows.push(['Total Outstanding', totals.totalOutstanding]);
    rows.push(['Overdue Invoices', totals.overdueInvoices]);
    rows.push(['Students with Invoices', totals.totalStudents]);
    rows.push(['Total Collected', totals.totalCollected]);
    rows.push(['Total Invoiced', totals.totalInvoiced]);
    rows.push([]);

    rows.push(['COLLECTION TREND (LAST 7 DAYS)']);
    rows.push(['Date', 'Amount']);
    collectionTrend.forEach((entry) => {
      rows.push([entry.label, entry.value]);
    });
    rows.push([]);

    rows.push(['ENROLLMENT BY CLASS']);
    rows.push(['Class', 'Students', 'Share %']);
    enrollmentData.forEach((item) => {
      rows.push([item.label, item.students, item.percentage]);
    });
    rows.push([]);

    rows.push(['OUTSTANDING OVERVIEW']);
    rows.push(['Class', 'Amount', 'Share %']);
    outstandingFeesData.forEach((item) => {
      rows.push([item.label, item.amount, item.percentage]);
    });
    rows.push([]);

    rows.push(['RECENT PAYMENTS']);
    rows.push(['Student', 'Class', 'Section', 'Amount', 'Paid On', 'Method', 'Status']);
    filteredPayments.forEach((payment) => {
      rows.push([
        payment.studentName || '',
        payment.className || '',
        payment.section || '',
        payment.amount || 0,
        payment.paidOn ? new Date(payment.paidOn).toLocaleDateString('en-IN') : '',
        payment.method || '',
        payment.status || 'Paid',
      ]);
    });

    const csvContent = rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fees-dashboard-report-${exportDate.toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f1f5f9] flex items-center justify-center" style={{ fontFamily: FONT_STACK }}>
        <div className="text-center text-slate-600">
          <div className="animate-spin h-10 w-10 border-2 border-violet-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-sm text-[#64748b] mt-2">Loading the latest fee analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f1f5f9] relative" style={{ fontFamily: FONT_STACK }}>
      {/* Ambient background accents */}
      <div className="pointer-events-none fixed top-[-10%] right-[-5%] w-96 h-96 bg-violet-300/20 rounded-full blur-3xl" />
      <div className="pointer-events-none fixed bottom-[-10%] left-[-5%] w-96 h-96 bg-emerald-200/20 rounded-full blur-3xl" />

      {/* ── Header ── */}
      <div className="relative px-4 sm:px-6 pt-6 pb-2 max-w-7xl mx-auto">
        <div className={`${GLASS_CARD} px-6 py-5 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-11 h-11 rounded-2xl bg-violet-500/10 border border-violet-300/40 flex items-center justify-center shrink-0">
                <IndianRupee className="h-5 w-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs font-semibold text-[#8e9aaf] uppercase tracking-widest">Fees Control Center</p>
                <h1 className="text-xl font-bold text-[#0f172a] tracking-tight">Fees Dashboard</h1>
                <p className="text-sm text-[#64748b] mt-0.5">Monitor collection health, overdue invoices, and cash flow trends.</p>
              </div>
            </div>
            <button
              onClick={generateReport}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-500/10 hover:bg-violet-500/20 border border-violet-300/40 text-violet-700 text-sm font-semibold transition-all duration-200 ease-out hover:-translate-y-0.5"
            >
              <Download size={15} />
              Export Snapshot
            </button>
          </div>
        </div>
      </div>

      <div className="relative px-4 sm:px-6 py-6 max-w-7xl mx-auto">
        {error && (
          <div className="mb-5 rounded-xl border border-red-200/70 bg-red-50/70 backdrop-blur-md text-red-700 px-4 py-3 text-sm">
            {error}
          </div>
        )}

        {/* ── Stat Cards ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              label: 'Total Outstanding',
              value: formatCurrency(totals.totalOutstanding),
              sub: 'Pending across all records',
              icon: Clock,
              iconBg: 'bg-[#fffbeb]',
              iconColor: 'text-amber-600',
            },
            {
              label: 'Overdue Invoices',
              value: `${totals.overdueInvoices} Invoices`,
              sub: 'Require immediate follow-up',
              icon: AlertCircle,
              iconBg: 'bg-red-50',
              iconColor: 'text-red-600',
              subColor: 'text-red-500',
            },
            {
              label: 'Students with Invoices',
              value: `${totals.totalStudents.toLocaleString()} Students`,
              sub: 'Linked to fee records',
              icon: School,
              iconBg: 'bg-violet-500/10',
              iconColor: 'text-violet-600',
            },
            {
              label: 'Total Collected',
              value: formatCurrency(totals.totalCollected),
              sub: 'Amount received so far',
              icon: CheckCircle,
              iconBg: 'bg-emerald-50',
              iconColor: 'text-emerald-600',
            },
          ].map((card, idx) => (
            <div
              key={card.label}
              className={`${GLASS_CARD} p-5 transition-all duration-200 ease-out hover:-translate-y-0.5 hover:shadow-[0_12px_36px_rgba(15,23,42,0.09)] animate-in fade-in slide-in-from-bottom-2`}
              style={{ animationDelay: `${idx * 60}ms`, animationDuration: '500ms', animationFillMode: 'both' }}
            >
              <div className="flex items-center justify-between mb-3">
                <p className="text-xs font-semibold text-[#8e9aaf] uppercase tracking-wide">{card.label}</p>
                <div className={`w-9 h-9 flex items-center justify-center rounded-xl ${card.iconBg}`}>
                  <card.icon className={`w-4.5 h-4.5 ${card.iconColor}`} size={18} />
                </div>
              </div>
              <p className="text-2xl font-bold text-[#0f172a]">{card.value}</p>
              <p className={`text-xs mt-1 ${card.subColor || 'text-[#8e9aaf]'}`}>{card.sub}</p>
            </div>
          ))}
        </div>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-3 gap-5">
          <div className="xl:col-span-2 space-y-5">

            {/* ── Collection Trend ── */}
            <div className={`${GLASS_CARD} p-5 animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-5">
                <div>
                  <h2 className="text-base font-semibold text-[#0f172a] flex items-center gap-2">
                    <TrendingUp size={16} className="text-violet-500" /> Collection Trend
                  </h2>
                  <p className="text-xs text-[#8e9aaf] mt-0.5">Daily collections over the last 7 days</p>
                </div>
                <div className={`${GLASS_INNER} flex items-center gap-2 text-xs text-[#64748b] px-3 py-1.5`}>
                  <Calendar className="w-3.5 h-3.5" />
                  <span>Last 7 days</span>
                </div>
              </div>
              <div className="flex gap-2 items-end h-44">
                {collectionTrend.map((entry) => (
                  <div key={entry.key} className="flex flex-col items-center w-full group">
                    <div className="w-full flex-1 flex items-end">
                      <div
                        className="w-full rounded-t-lg bg-linear-to-t from-violet-600 to-violet-400 shadow-sm transition-all group-hover:from-violet-700 group-hover:to-violet-500"
                        style={{ height: `${Math.max((entry.value / peakCollection) * 100, entry.value > 0 ? 4 : 0)}%`, minHeight: entry.value > 0 ? '4px' : '0' }}
                      />
                    </div>
                    <div className="mt-2 text-center">
                      <p className="text-[11px] font-semibold text-slate-700">{formatCurrency(entry.value)}</p>
                      <p className="text-[10px] text-[#8e9aaf]">{entry.label}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── Recent Payments ── */}
            <div className={`${GLASS_CARD} overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className="px-5 py-4 border-b border-white/60">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold text-[#0f172a] flex items-center gap-2">
                      <CreditCard size={16} className="text-violet-500" /> Recent Payments
                    </h2>
                    <p className="text-xs text-[#8e9aaf] mt-0.5">Payments logged from fee invoices</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <select
                      value={dateRange}
                      onChange={(e) => setDateRange(e.target.value)}
                      className={GLASS_INPUT}
                    >
                      {DATE_RANGE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <button
                      onClick={generateReport}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 text-white text-xs font-semibold rounded-xl hover:bg-violet-700 transition-all duration-200 ease-out hover:-translate-y-0.5"
                    >
                      <Download size={13} /> Report
                    </button>
                  </div>
                </div>

                <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1.5fr)_repeat(3,minmax(0,1fr))]">
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-[#8e9aaf] absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    <input
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Search student, username, transaction ID..."
                      className={`${GLASS_INPUT} w-full pl-8`}
                    />
                  </div>
                  <select
                    value={selectedSession}
                    onChange={(e) => {
                      setSelectedSession(e.target.value);
                      setSelectedClass('');
                      setSelectedSection('');
                    }}
                    className={GLASS_INPUT}
                  >
                    <option value="">All Sessions</option>
                    {sessionOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <select
                    value={selectedClass}
                    onChange={(e) => {
                      setSelectedClass(e.target.value);
                      setSelectedSection('');
                    }}
                    disabled={!selectedSession && sessionOptions.length > 0}
                    className={`${GLASS_INPUT} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <option value="">All Classes</option>
                    {classOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <select
                    value={selectedSection}
                    onChange={(e) => setSelectedSection(e.target.value)}
                    disabled={!selectedClass && classOptions.length > 0}
                    className={`${GLASS_INPUT} disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    <option value="">All Sections</option>
                    {sectionOptions.map((option) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              </div>

              {filteredPayments.length ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-white/40">
                      <tr>
                        {['Student', 'Class', 'Amount', 'Paid On', 'Method', 'Status'].map((h) => (
                          <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold text-[#8e9aaf] uppercase tracking-wide">{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-white/60">
                      {filteredPayments.map((payment, idx) => (
                        <tr
                          key={`${payment.studentName}-${payment.transactionId || idx}`}
                          onClick={() => openPaymentDetails(payment)}
                          className="hover:bg-white/50 transition-colors cursor-pointer"
                        >
                          <td className="px-4 py-3">
                            <p className="font-semibold text-slate-800 text-sm">{payment.studentName || '—'}</p>
                            <p className="text-[11px] text-[#8e9aaf]">{payment.username || '—'}</p>
                          </td>
                          <td className="px-4 py-3 text-[#64748b] text-xs">
                            {payment.className || '—'}{payment.section ? ` · ${payment.section}` : ''}
                          </td>
                          <td className="px-4 py-3 font-bold text-[#0f172a] text-sm">{formatCurrency(payment.amount)}</td>
                          <td className="px-4 py-3 text-[#64748b] text-xs">
                            {payment.paidOn ? new Date(payment.paidOn).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                          </td>
                          <td className="px-4 py-3 text-[#64748b] text-xs capitalize">{payment.method || '—'}</td>
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(payment.status)}`}>
                              {payment.status || 'Paid'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 gap-2 border-t border-dashed border-slate-300 mx-5 mb-5 rounded-xl">
                  <CreditCard size={28} className="text-slate-300 mt-4" />
                  <p className="text-sm text-[#8e9aaf] mb-4">No recent payments match your search.</p>
                </div>
              )}
            </div>
          </div>

          {/* ── Right Sidebar ── */}
          <div className="space-y-5">

            {/* Enrollment by Class */}
            <div className={`${GLASS_CARD} overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
                <div>
                  <h2 className="text-base font-semibold text-[#0f172a]">Enrollment by Class</h2>
                  <p className="text-xs text-[#8e9aaf] mt-0.5">Students with fee invoices</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                  <Users className="w-4 h-4 text-violet-500" />
                </div>
              </div>
              <div className="px-5 py-4">
                {enrollmentData.length ? (
                  <div className="space-y-3">
                    {enrollmentData.map((program) => (
                      <div key={program.label} className="flex items-center justify-between">
                        <div className="min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{program.label}</p>
                          <p className="text-[11px] text-[#8e9aaf]">{program.students} students</p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <div className="w-24 h-1.5 bg-white/60 rounded-full overflow-hidden">
                            <div className="h-full bg-violet-400 rounded-full" style={{ width: `${program.percentage}%` }} />
                          </div>
                          <span className="text-xs font-bold text-slate-600 w-8 text-right">{program.percentage}%</span>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-xl py-6 text-center">
                    <p className="text-xs text-[#8e9aaf]">No enrollment data available.</p>
                  </div>
                )}
              </div>
            </div>

            {/* Outstanding Overview */}
            <div className={`${GLASS_CARD} overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              <div className="flex items-center justify-between px-5 py-4 border-b border-white/60">
                <div>
                  <h2 className="text-base font-semibold text-[#0f172a]">Outstanding Overview</h2>
                  <p className="text-xs text-[#8e9aaf] mt-0.5">Top classes with pending dues</p>
                </div>
                <div className="w-8 h-8 rounded-xl bg-[#fffbeb] flex items-center justify-center">
                  <AlertCircle className="w-4 h-4 text-amber-500" />
                </div>
              </div>
              <div className="px-5 py-4">
                {outstandingFeesData.length ? (
                  <div className="space-y-4">
                    {outstandingFeesData.map((segment) => (
                      <div key={segment.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <p className="text-xs font-semibold text-slate-700">{segment.label}</p>
                          <span className="text-xs font-bold text-amber-600">{segment.percentage}%</span>
                        </div>
                        <div className="w-full bg-white/60 rounded-full h-1.5">
                          <div
                            className="bg-linear-to-r from-amber-400 to-orange-400 h-1.5 rounded-full transition-all"
                            style={{ width: `${segment.percentage}%` }}
                          />
                        </div>
                        {segment.amount !== undefined && (
                          <p className="text-[11px] text-[#8e9aaf] mt-0.5">{formatCurrency(segment.amount)}</p>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="border border-dashed border-slate-300 rounded-xl py-6 text-center">
                    <p className="text-xs text-[#8e9aaf]">No outstanding data to display.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {selectedPayment ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-sm px-3 py-3 sm:px-4 sm:py-4"
          onClick={closePaymentDetails}
        >
          <div
            className="flex max-h-[calc(100vh-1.5rem)] w-full max-w-2xl flex-col overflow-hidden rounded-2xl border border-white/70 bg-white/80 backdrop-blur-2xl backdrop-saturate-150 shadow-2xl sm:max-h-[calc(100vh-2rem)] sm:rounded-3xl animate-in fade-in slide-in-from-bottom-4 duration-300"
            style={{ fontFamily: FONT_STACK }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4 border-b border-white/60 px-6 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-violet-500">Payment Details</p>
                <h3 className="mt-1 text-xl font-bold text-[#0f172a]">{selectedPayment.studentName || 'Student'}</h3>
                <p className="text-sm text-[#64748b]">
                  {selectedPayment.className || '—'}
                  {selectedPayment.section ? ` · ${selectedPayment.section}` : ''}
                  {selectedPayment.session ? ` · ${selectedPayment.session}` : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={closePaymentDetails}
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-white/70 bg-white/50 text-slate-500 hover:bg-white/80 hover:text-slate-700 transition-all duration-200 ease-out"
                aria-label="Close payment details"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid flex-1 gap-4 overflow-y-auto px-4 py-4 sm:px-6 sm:py-5 md:grid-cols-[minmax(0,1.2fr)_minmax(0,0.8fr)]">
              <div className="grid gap-3 sm:grid-cols-2">
                {[
                  ['Student Name', selectedPayment.studentName || '—'],
                  ['Username', selectedPayment.username || '—'],
                  ['Admission / SID', selectedPayment.admissionNo || '—'],
                  ['Class', selectedPayment.className || '—'],
                  ['Section', selectedPayment.section || '—'],
                  ['Session', selectedPayment.session || '—'],
                  ['Amount', formatCurrency(selectedPayment.amount)],
                  ['Transaction Date & Time', selectedPayment.paidOnLabel || '—'],
                  ['Transaction ID', selectedPayment.transactionId || '—'],
                  ['Payment Method', selectedPayment.method || '—'],
                  ['Invoice Status', selectedPayment.invoiceStatus || '—'],
                  ['Gateway Payment ID', selectedPayment.gatewayPaymentId || '—'],
                  ['Gateway Order ID', selectedPayment.gatewayOrderId || '—'],
                ].map(([label, value]) => (
                  <div key={label} className={`${GLASS_INNER} px-3 py-3 sm:px-4`}>
                    <p className="text-[11px] font-semibold uppercase tracking-wide text-[#8e9aaf]">{label}</p>
                    <p className="mt-1 text-sm font-semibold text-[#0f172a] break-words leading-5">{value}</p>
                  </div>
                ))}
              </div>

              <div className={`${GLASS_INNER} space-y-4 p-4 sm:p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#8e9aaf]">Payment Status</p>
                    <p className="mt-1 text-lg font-bold text-[#0f172a]">{selectedPayment.status || 'Paid'}</p>
                  </div>
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${getStatusColor(selectedPayment.status)}`}>
                    {selectedPayment.status || 'Paid'}
                  </span>
                </div>

                <div className="rounded-xl bg-white/60 p-4 border border-white/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8e9aaf]">Notes</p>
                  <p className="mt-2 text-sm leading-6 text-[#64748b] whitespace-pre-line">
                    {selectedPayment.notes || 'No additional notes available for this payment.'}
                  </p>
                </div>

                <div className="rounded-xl bg-white/60 p-4 border border-white/70">
                  <p className="text-xs font-semibold uppercase tracking-wide text-[#8e9aaf]">Summary</p>
                  <div className="mt-3 space-y-2 text-sm text-[#64748b]">
                    <div className="flex items-center justify-between gap-3">
                      <span>Paid amount</span>
                      <span className="font-semibold text-[#0f172a]">{formatCurrency(selectedPayment.amount)}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Receipt date</span>
                      <span className="font-semibold text-[#0f172a]">{selectedPayment.paidOnLabel || '—'}</span>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span>Transaction reference</span>
                      <span className="font-semibold text-[#0f172a]">{selectedPayment.transactionId || '—'}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
};

export default FeesDashboard;
