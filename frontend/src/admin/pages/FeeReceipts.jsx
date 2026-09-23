import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AlertCircle,
  Banknote,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Download,
  Eye,
  FileText,
  Landmark,
  ListFilter,
  Loader2,
  Receipt,
  RefreshCw,
  Search,
  Smartphone,
  X,
  Zap,
} from 'lucide-react';
import { downloadFeeReceiptPdf } from '../../utils/feeReceiptPdf';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const PAGE_SIZE = 15;

const METHOD_META = {
  cash: { label: 'Cash', icon: Banknote, cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  upi: { label: 'UPI', icon: Smartphone, cls: 'bg-violet-50 text-violet-700 border-violet-200' },
  bank: { label: 'Bank Transfer', icon: Landmark, cls: 'bg-sky-50 text-sky-700 border-sky-200' },
  card: { label: 'Card', icon: CreditCard, cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  razorpay: { label: 'Razorpay (Online)', icon: Zap, cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
};
const methodMeta = (key) => METHOD_META[String(key || '').toLowerCase()]
  || { label: key || 'Other', icon: Receipt, cls: 'bg-slate-50 text-slate-700 border-slate-200' };

const formatCurrency = (value) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(Number(value || 0));

const formatDateTime = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '-' : d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' });
};

const resolvePhotoUrl = (value) => {
  const src = String(value || '').trim();
  if (!src) return '';
  if (/^(https?:|data:|blob:)/i.test(src)) return src;
  return `${API_BASE}/${src.replace(/^\/+/, '')}`;
};

const authHeaders = () => ({
  'Content-Type': 'application/json',
  authorization: `Bearer ${localStorage.getItem('token')}`,
});

// eslint-disable-next-line react/prop-types
const FeeReceipts = ({ setShowAdminHeader }) => {
  const navigate = useNavigate();
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [totalAmount, setTotalAmount] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState({ method: '', from: '', to: '' });
  const [downloadingId, setDownloadingId] = useState('');
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    setShowAdminHeader?.(true);
  }, [setShowAdminHeader]);

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 350);
    return () => clearTimeout(t);
  }, [search]);

  useEffect(() => { setPage(1); }, [debouncedSearch, filters]);

  const fetchReceipts = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const params = new URLSearchParams({ page: String(page), limit: String(PAGE_SIZE) });
      if (debouncedSearch) params.set('search', debouncedSearch);
      if (filters.method) params.set('method', filters.method);
      if (filters.from) params.set('from', filters.from);
      if (filters.to) params.set('to', filters.to);
      const res = await fetch(`${API_BASE}/api/fees/admin/receipts?${params}`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to load receipts');
      setItems(Array.isArray(data.items) ? data.items : []);
      setTotal(Number(data.total || 0));
      setTotalAmount(Number(data?.totals?.amount || 0));
    } catch (err) {
      setError(err.message || 'Unable to load receipts');
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, filters]);

  useEffect(() => { fetchReceipts(); }, [fetchReceipts]);

  // Same PDF as the parent portal: identical receipt payload + generator.
  const handleDownload = async (item) => {
    setDownloadingId(String(item.paymentId));
    try {
      const res = await fetch(`${API_BASE}/api/fees/payments/${item.paymentId}/receipt`, { headers: authHeaders() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Unable to load receipt');
      await downloadFeeReceiptPdf({
        invoice: data.invoice,
        student: data.student,
        payment: data.payment,
        receipt: data.receipt || null,
        school: data.school || null,
        schoolName: localStorage.getItem('schoolName') || localStorage.getItem('school') || 'Electronic Educare School',
        schoolSubtitle: 'Fee Payment Receipt',
      });
    } catch (err) {
      setError(err.message || 'Unable to download receipt');
    } finally {
      setDownloadingId('');
    }
  };

  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const activeFilterCount = [filters.method, filters.from, filters.to].filter(Boolean).length;
  const selectCls = 'w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400';

  return (
    <div className="space-y-5 p-3 sm:p-5 lg:p-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-violet-200/60 bg-violet-50">
            <Receipt className="h-5 w-5 text-violet-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Fee Receipts</h1>
            <p className="text-sm text-slate-500">Every generated receipt with its number and payment details</p>
          </div>
        </div>
        <button
          type="button"
          onClick={fetchReceipts}
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 shadow-sm hover:bg-slate-50 disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Receipts</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-slate-900">{total.toLocaleString('en-IN')}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Total Collected</p>
          <p className="mt-1 text-2xl font-bold tabular-nums text-emerald-600 break-words">{formatCurrency(totalAmount)}</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Search + filters */}
        <div className="space-y-3 border-b border-slate-100 p-4">
          <div className="flex items-center gap-2">
            <div className="relative min-w-0 flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400/30 focus:border-violet-400"
                placeholder="Search by receipt no, student name, admission no or transaction ID"
              />
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border transition-all ${
                showFilters ? 'border-rose-200 bg-rose-50 text-rose-600' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
              aria-label={showFilters ? 'Close filters' : 'Show filters'}
            >
              {showFilters ? <X className="h-4 w-4" /> : <ListFilter className="h-4 w-4" />}
              {!showFilters && activeFilterCount > 0 && (
                <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-white bg-violet-500" />
              )}
            </button>
          </div>
          {showFilters && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <select value={filters.method} onChange={(e) => setFilters((p) => ({ ...p, method: e.target.value }))} className={selectCls}>
                <option value="">All Methods</option>
                {Object.entries(METHOD_META).map(([key, m]) => <option key={key} value={key}>{m.label}</option>)}
              </select>
              <input type="date" value={filters.from} onChange={(e) => setFilters((p) => ({ ...p, from: e.target.value }))} className={selectCls} title="From date" />
              <input type="date" value={filters.to} onChange={(e) => setFilters((p) => ({ ...p, to: e.target.value }))} className={selectCls} title="To date" />
            </div>
          )}
        </div>

        {error && (
          <div className="mx-4 mt-4 flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Table */}
        <div className="max-h-[62vh] overflow-auto">
          <table className="w-full min-w-[680px]">
            <thead className="sticky top-0 z-10">
              <tr className="bg-slate-50 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-4 py-3">Receipt No.</th>
                <th className="px-4 py-3">Student</th>
                <th className="px-4 py-3">Class</th>
                <th className="px-4 py-3 text-right">Amount</th>
                <th className="px-4 py-3">Paid Via</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr><td colSpan={6} className="py-16 text-center text-sm text-slate-400">
                  <Loader2 className="mx-auto mb-2 h-6 w-6 animate-spin text-violet-500" />Loading receipts…
                </td></tr>
              ) : items.length === 0 ? (
                <tr><td colSpan={6} className="py-16 text-center">
                  <FileText className="mx-auto mb-2 h-8 w-8 text-slate-300" />
                  <p className="text-sm font-semibold text-slate-500">No receipts found</p>
                  <p className="text-xs text-slate-400">Receipts appear here as soon as a payment is recorded.</p>
                </td></tr>
              ) : items.map((item) => {
                const m = methodMeta(item.method);
                const MethodIcon = m.icon;
                const photo = resolvePhotoUrl(item.profilePic);
                const initials = (item.studentName || 'S').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
                return (
                  <tr key={item.paymentId} className="hover:bg-slate-50/70">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs font-semibold text-violet-700">{item.receiptNumber || '-'}</span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-violet-100 text-xs font-bold text-violet-600">
                          {photo ? <img src={photo} alt="" className="h-full w-full object-cover" /> : initials}
                        </div>
                        <div className="min-w-0">
                          <p className="whitespace-nowrap text-sm font-semibold text-slate-800">{item.studentName}</p>
                          {item.admissionNumber ? <p className="text-[11px] text-slate-400">{item.admissionNumber}</p> : null}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{[item.className, item.section].filter(Boolean).join('-') || '-'}</td>
                    <td className="px-4 py-3 text-right text-sm font-semibold tabular-nums text-slate-900">{formatCurrency(item.amount)}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-1 text-[11px] font-semibold ${m.cls}`}>
                        <MethodIcon className="h-3 w-3" />
                        {m.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setSelected(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"
                        >
                          <Eye className="h-3.5 w-3.5" /> View
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDownload(item)}
                          disabled={downloadingId === String(item.paymentId)}
                          className="inline-flex items-center gap-1 rounded-lg bg-violet-600 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                        >
                          {downloadingId === String(item.paymentId) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {!loading && total > 0 && (
          <div className="flex flex-col items-center justify-between gap-3 border-t border-slate-100 px-4 py-3 sm:flex-row">
            <p className="text-xs text-slate-500">
              Showing <b className="text-slate-700">{(page - 1) * PAGE_SIZE + 1}</b>–<b className="text-slate-700">{Math.min(page * PAGE_SIZE, total)}</b> of <b className="text-slate-700">{total}</b> receipts
            </p>
            <div className="flex items-center gap-1">
              <button type="button" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Previous page">
                <ChevronLeft className="h-4 w-4" />
              </button>
              {Array.from({ length: pageCount }, (_, i) => i + 1)
                .filter((n) => n === 1 || n === pageCount || Math.abs(n - page) <= 1)
                .map((n, idx, arr) => (
                  <React.Fragment key={n}>
                    {idx > 0 && n - arr[idx - 1] > 1 && <span className="px-1 text-xs text-slate-400">…</span>}
                    <button type="button" onClick={() => setPage(n)}
                      className={`h-8 min-w-8 rounded-lg px-2 text-xs font-semibold ${n === page ? 'bg-violet-600 text-white' : 'border border-slate-200 text-slate-600 hover:bg-slate-50'}`}>
                      {n}
                    </button>
                  </React.Fragment>
                ))}
              <button type="button" onClick={() => setPage((p) => Math.min(pageCount, p + 1))} disabled={page >= pageCount}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-40" aria-label="Next page">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Receipt details modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-3 backdrop-blur-sm" onClick={() => setSelected(null)}>
          <div className="max-h-[calc(100vh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-widest text-violet-500">Fee Receipt</p>
                <h3 className="mt-0.5 font-mono text-lg font-bold text-slate-900">{selected.receiptNumber || '-'}</h3>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-50" aria-label="Close">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 gap-3 p-5 sm:grid-cols-2">
              {[
                ['Student', selected.studentName],
                ['Admission No', selected.admissionNumber || '-'],
                ['Class', [selected.className, selected.section].filter(Boolean).join('-') || '-'],
                ['Amount', formatCurrency(selected.amount)],
                ['Paid Via', methodMeta(selected.method).label + (selected.bankName ? ` · ${selected.bankName}` : '')],
                ['Date & Time', formatDateTime(selected.paidOn)],
                ['Reference No.', selected.referenceNumber || '-'],
                ['Transaction ID', selected.transactionId || '-'],
                ...(selected.gatewayPaymentId ? [['Gateway Payment ID', selected.gatewayPaymentId]] : []),
                ...(selected.gatewayOrderId ? [['Gateway Order ID', selected.gatewayOrderId]] : []),
                ...(selected.invoiceTitle ? [['Invoice', selected.invoiceTitle]] : []),
                ...(selected.notes ? [['Notes', selected.notes]] : []),
              ].map(([label, value]) => (
                <div key={label} className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{label}</p>
                  <p className="mt-0.5 break-words text-sm font-medium text-slate-800">{value}</p>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-slate-100 px-5 py-4">
              <button
                type="button"
                onClick={() => navigate(`/admin/fees/student-details?invoice=${selected.invoiceId}`)}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
              >
                Open Student Fees
              </button>
              <button
                type="button"
                onClick={() => handleDownload(selected)}
                disabled={downloadingId === String(selected.paymentId)}
                className="inline-flex items-center gap-2 rounded-xl bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
              >
                {downloadingId === String(selected.paymentId) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
                Download Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FeeReceipts;
