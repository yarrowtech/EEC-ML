import React, { useCallback, useEffect, useState } from 'react';
import Swal from 'sweetalert2';
import { Award, CheckCircle2, Download, Loader2, Printer, Search } from 'lucide-react';
import { downloadLeavingCertificate, printLeavingCertificate } from '../../utils/leavingCertificatePdf';
import { invalidateCache, readCache, writeCache } from '../../utils/swrCache';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const authHeader = () => ({
  'Content-Type': 'application/json',
  authorization: `Bearer ${localStorage.getItem('token')}`,
});

const dmy = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString('en-GB');
};

// Certificates tab: search a Left student (name / ID / roll / certificate no.),
// Issue → records the issue date in the DB, then Print / Download the A4 PDF.
const LeavingCertificates = () => {
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [issuingId, setIssuingId] = useState('');
  const [printingId, setPrintingId] = useState('');

  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 300);
    return () => clearTimeout(t);
  }, [query]);

  // Results are cached per search term: shown instantly, then revalidated.
  const cacheKeyFor = (q) => `left-students:cert:${q.toLowerCase()}`;
  const search = useCallback(async () => {
    const cached = readCache(cacheKeyFor(debounced));
    if (cached) {
      setStudents(cached);
      setLoading(false);
    } else {
      setLoading(true);
    }
    try {
      const res = await fetch(`${API_BASE}/api/promotion/certificates?q=${encodeURIComponent(debounced)}`, { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Search failed');
      const list = Array.isArray(data.students) ? data.students : [];
      writeCache(cacheKeyFor(debounced), list);
      setStudents(list);
    } catch (err) {
      if (!cached) Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#6366f1' });
    } finally {
      setLoading(false);
    }
  }, [debounced]);

  useEffect(() => { search(); }, [search]);

  const handleIssue = async (student) => {
    const confirm = await Swal.fire({
      icon: 'question',
      title: 'Issue Certificate',
      html: `Issue the School Leaving Certificate to <b>${student.name}</b>?<br/>Today's date will be recorded as the issue date.`,
      showCancelButton: true,
      confirmButtonText: 'Issue',
      confirmButtonColor: '#4f46e5',
      cancelButtonColor: '#6b7280',
    });
    if (!confirm.isConfirmed) return;
    setIssuingId(student._id);
    try {
      const res = await fetch(`${API_BASE}/api/promotion/certificates/${student._id}/issue`, { method: 'PUT', headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to issue certificate');
      setStudents((prev) => prev.map((s) => (s._id === student._id ? { ...s, ...data.student } : s)));
      invalidateCache('left-students:cert:');
      Swal.fire({ icon: 'success', title: 'Issued', text: data.message, timer: 1600, showConfirmButton: false });
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#6366f1' });
    } finally {
      setIssuingId('');
    }
  };

  const withCertificateData = async (student, action) => {
    setPrintingId(`${action}:${student._id}`);
    try {
      const res = await fetch(`${API_BASE}/api/promotion/certificates/${student._id}`, { headers: authHeader() });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to load certificate');
      if (action === 'print') await printLeavingCertificate(data);
      else await downloadLeavingCertificate(data);
    } catch (err) {
      Swal.fire({ icon: 'error', title: 'Error', text: err.message, confirmButtonColor: '#6366f1' });
    } finally {
      setPrintingId('');
    }
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="shrink-0 border-b border-gray-100 p-3 md:p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-full border border-gray-200 bg-white py-2.5 pl-9 pr-3 text-sm focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-300/40"
            placeholder="Search left students by name, student ID, admission no., roll number or certificate no."
          />
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-gray-400">
          <Loader2 className="h-5 w-5 animate-spin" /> Searching…
        </div>
      ) : students.length === 0 ? (
        <div className="py-16 text-center">
          <Award className="mx-auto mb-2 h-8 w-8 text-gray-300" />
          <p className="font-semibold text-gray-500">No left students found</p>
          <p className="text-xs text-gray-400">Certificates are available once a student is marked as Left.</p>
        </div>
      ) : (
        <ul className="min-h-0 flex-1 divide-y divide-gray-100 overflow-auto">
          {students.map((s) => {
            const issued = Boolean(s.leavingCertificateIssuedAt);
            return (
              <li key={s._id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-3">
                  <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${issued ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
                    <Award className="h-5 w-5" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-semibold text-gray-900">{s.name}</p>
                    <p className="text-xs text-gray-500">
                      {[s.grade, s.section].filter(Boolean).join('-') || '—'}
                      {s.roll ? ` · Roll ${s.roll}` : ''}
                      {s.studentCode || s.admissionNumber ? ` · ${s.studentCode || s.admissionNumber}` : ''}
                    </p>
                    <p className="mt-0.5 text-xs">
                      <span className="font-mono font-semibold text-indigo-700">{s.transferCertificateNo || 'No. assigned on issue'}</span>
                      {issued && <span className="ml-2 text-emerald-600">· Issued {dmy(s.leavingCertificateIssuedAt)}</span>}
                    </p>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  {issued ? (
                    <>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700">
                        <CheckCircle2 className="h-3.5 w-3.5" /> Issued
                      </span>
                      <button
                        type="button"
                        onClick={() => withCertificateData(s, 'print')}
                        disabled={Boolean(printingId)}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700 disabled:opacity-60"
                      >
                        {printingId === `print:${s._id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Printer className="h-3.5 w-3.5" />}
                        Print
                      </button>
                      <button
                        type="button"
                        onClick={() => withCertificateData(s, 'download')}
                        disabled={Boolean(printingId)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-semibold text-gray-600 hover:bg-gray-50 disabled:opacity-60"
                        title="Download PDF"
                      >
                        {printingId === `download:${s._id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                        PDF
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleIssue(s)}
                      disabled={issuingId === s._id}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      {issuingId === s._id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Award className="h-3.5 w-3.5" />}
                      Issue Certificate
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default LeavingCertificates;
