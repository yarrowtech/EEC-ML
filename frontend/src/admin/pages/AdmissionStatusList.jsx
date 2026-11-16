import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, Search, Loader2, FileText } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '').replace(/\/api$/, '');

// One table per dashboard card (Admission team): ?status=new | pending | approved | admitted
const VIEWS = {
  new:      { title: 'New Enquiries',  hint: 'Applications received in the last 7 days', match: (a) => Date.now() - new Date(a.createdAt) <= 7 * 86400000 },
  pending:  { title: 'Pending Review', hint: 'Submitted or shortlisted applications',     match: (a) => ['submitted', 'shortlisted'].includes(a.status) },
  approved: { title: 'Approved',       hint: 'Approved and awaiting admission',           match: (a) => a.status === 'approved' },
  admitted: {
    title: 'Admitted Students', hint: 'Admitted this month',
    match: (a) => {
      if (a.status !== 'admitted') return false;
      const d = new Date(a.admittedAt || a.updatedAt || 0); const now = new Date();
      return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
    },
  },
};

const STATUS_CHIP = {
  submitted: 'bg-blue-50 text-blue-700', shortlisted: 'bg-indigo-50 text-indigo-700', approved: 'bg-violet-50 text-violet-700',
  admitted: 'bg-emerald-50 text-emerald-700', rejected: 'bg-rose-50 text-rose-700',
};
const fmtDate = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—');

const AdmissionStatusList = ({ setShowAdminHeader }) => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const viewKey = VIEWS[params.get('status')] ? params.get('status') : 'pending';
  const view = VIEWS[viewKey];
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');

  useEffect(() => { setShowAdminHeader?.(true); }, [setShowAdminHeader]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`${API_BASE}/api/admissions/admin/applications`, {
          headers: { authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error(data?.error || 'Unable to load applications');
        if (!cancelled) { setItems(Array.isArray(data) ? data : []); setError(''); }
      } catch (err) {
        if (!cancelled) setError(err.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items.filter(view.match).filter((a) => !q || [a.studentName, a.admissionNumber, a.applyingForClass, a.fatherName, a.guardianName]
      .some((v) => String(v || '').toLowerCase().includes(q)));
  }, [items, view, query]);

  const isAdmitted = viewKey === 'admitted';
  const classLabel = (a) => {
    const grade = a.studentGrade || a.applyingForClass || '';
    const section = isAdmitted ? (a.studentSection || '') : '';
    return grade ? `${grade}${section ? `-${section}` : ''}` : '—';
  };

  return (
    <div className="space-y-4 p-3 sm:p-4 lg:p-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => navigate('/admin/dashboard')} className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50" aria-label="Back to dashboard">
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="text-lg font-bold text-slate-900">{view.title}</h1>
            <p className="text-xs text-slate-500">{view.hint}</p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search name, admission no…" className="w-full rounded-full border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200" />
        </div>
      </div>

      <div className="flex gap-1.5 overflow-x-auto [scrollbar-width:none]">
        {Object.entries(VIEWS).map(([key, v]) => (
          <button key={key} type="button" onClick={() => setParams({ status: key })}
            className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${key === viewKey ? 'bg-slate-900 text-white' : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'}`}>
            {v.title} <span className={key === viewKey ? 'text-white/70' : 'text-slate-400'}>{items.filter(v.match).length}</span>
          </button>
        ))}
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-500"><Loader2 size={16} className="animate-spin" /> Loading…</div>
        ) : error ? (
          <div className="py-16 text-center text-sm text-rose-600">{error}</div>
        ) : rows.length === 0 ? (
          <div className="py-16 text-center">
            <FileText size={26} className="mx-auto mb-2 text-slate-300" />
            <p className="text-sm text-slate-500">No {view.title.toLowerCase()} right now.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">Student name</th>
                  <th className="px-4 py-3">{isAdmitted ? 'Roll no.' : 'Admission no.'}</th>
                  <th className="px-4 py-3">Academic year</th>
                  <th className="px-4 py-3">{isAdmitted ? 'Class-Section' : 'Applying for'}</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">{isAdmitted ? 'Admitted on' : 'Applied on'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((a, i) => (
                  <tr key={a._id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{a.studentName}</td>
                    <td className="px-4 py-3 text-slate-700">{isAdmitted ? (a.studentRoll ?? '—') : (a.admissionNumber || '—')}</td>
                    <td className="px-4 py-3 text-slate-700">{a.studentAcademicYear || a.academicYear || '—'}</td>
                    <td className="px-4 py-3 text-slate-700">{classLabel(a)}</td>
                    <td className="px-4 py-3"><span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${STATUS_CHIP[a.status] || 'bg-slate-100 text-slate-600'}`}>{a.status}</span></td>
                    <td className="px-4 py-3 text-slate-500">{fmtDate(isAdmitted ? a.admittedAt : a.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default AdmissionStatusList;
