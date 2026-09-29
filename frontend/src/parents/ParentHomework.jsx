import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { BookOpen, CalendarDays, Clock, ExternalLink, FileText, Search, X } from 'lucide-react';
import { parentApiJson } from './parentApi';
import ChildSwitcher from './ChildSwitcher';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import useParentChildren from './useParentChildren';

// Homework / assignments for the selected child. View only — the student
// submits from their own portal; the parent monitors status and remarks.
const STATUS = {
  not_submitted: { label: 'Pending', cls: 'bg-amber-50 text-amber-700 ring-amber-200' },
  submitted: { label: 'Submitted', cls: 'bg-blue-50 text-blue-700 ring-blue-200' },
  late: { label: 'Submitted late', cls: 'bg-orange-50 text-orange-700 ring-orange-200' },
  graded: { label: 'Checked', cls: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  overdue: { label: 'Overdue', cls: 'bg-rose-50 text-rose-700 ring-rose-200' },
};
const FILTERS = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'submitted', label: 'Submitted' },
  { key: 'checked', label: 'Checked' },
];

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
const subjectOf = (a) => a?.subject?.name || a?.subjectName || a?.subject || 'General';
const attachmentOf = (a) => a?.attachmentUrl || a?.fileUrl || a?.attachment?.url || (Array.isArray(a?.attachments) ? a.attachments[0]?.url : '') || '';
const statusKey = (a) => {
  const s = a?.submissionStatus || 'not_submitted';
  if (s === 'not_submitted' && a?.dueDate && new Date(a.dueDate) < new Date(new Date().toDateString())) return 'overdue';
  return STATUS[s] ? s : 'not_submitted';
};

const ParentHomework = () => {
  const navigate = useNavigate();
  const { options, childKey, setChildKey, selected, loading: childLoading, error: childError, reload } = useParentChildren();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [open, setOpen] = useState(null);

  const load = useCallback(async () => {
    if (!selected?.id) { setItems([]); return; }
    setLoading(true);
    setError('');
    try {
      const data = await parentApiJson(`/api/assignment/parent/assignments?studentId=${encodeURIComponent(selected.id)}`, {}, navigate);
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load homework');
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [selected?.id, navigate]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(() => {
    const c = { all: items.length, pending: 0, submitted: 0, checked: 0 };
    items.forEach((a) => {
      const k = statusKey(a);
      if (k === 'not_submitted' || k === 'overdue') c.pending += 1;
      else if (k === 'graded') c.checked += 1;
      else c.submitted += 1;
    });
    return c;
  }, [items]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items
      .filter((a) => {
        const k = statusKey(a);
        if (filter === 'pending') return k === 'not_submitted' || k === 'overdue';
        if (filter === 'submitted') return k === 'submitted' || k === 'late';
        if (filter === 'checked') return k === 'graded';
        return true;
      })
      .filter((a) => !q || [a.title, a.description, subjectOf(a)].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
  }, [items, filter, search]);

  if (childLoading && !options.length) return <Loading />;

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <PageHeader title="Homework" icon={BookOpen} subtitle="Assignments given to your child, their due dates and status.">
        <ChildSwitcher options={options} value={childKey} onChange={setChildKey} />
      </PageHeader>

      {childError ? <ErrorState message={childError} onRetry={reload} /> : null}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          ['Total', counts.all, 'text-slate-900'],
          ['Pending', counts.pending, 'text-amber-600'],
          ['Submitted', counts.submitted, 'text-blue-600'],
          ['Checked', counts.checked, 'text-emerald-600'],
        ].map(([label, value, tone]) => (
          <div key={label} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <p className="text-xs font-medium text-slate-500">{label}</p>
            <p className={`mt-1 text-2xl font-bold ${tone}`}>{value}</p>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${filter === f.key ? 'bg-violet-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {f.label} ({counts[f.key] ?? 0})
            </button>
          ))}
        </div>
        <div className="relative w-full sm:w-64">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search homework…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
        </div>
      </div>

      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> : visible.length === 0 ? (
        <EmptyState title="No homework here" hint={items.length ? 'Try another filter.' : 'Homework assigned by teachers will appear here.'} icon={BookOpen} />
      ) : (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((a) => {
            const st = STATUS[statusKey(a)];
            return (
              <article key={a._id} className="flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <span className="rounded-md bg-violet-50 px-2 py-0.5 text-xs font-semibold text-violet-700">{subjectOf(a)}</span>
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${st.cls}`}>{st.label}</span>
                </div>
                <h3 className="mt-2 text-base font-bold text-slate-900">{a.title || 'Homework'}</h3>
                {a.description ? <p className="mt-1 line-clamp-2 text-sm text-slate-500">{a.description}</p> : null}
                <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="inline-flex items-center gap-1"><CalendarDays size={13} /> Assigned {fmt(a.createdAt)}</span>
                  <span className="inline-flex items-center gap-1"><Clock size={13} /> Due {fmt(a.dueDate)}</span>
                </div>
                <button type="button" onClick={() => setOpen(a)} className="mt-4 inline-flex items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <FileText size={15} /> View Homework
                </button>
              </article>
            );
          })}
        </div>
      )}

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => { if (e.target === e.currentTarget) setOpen(null); }}>
          <div role="dialog" aria-modal="true" className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white shadow-2xl">
            <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-violet-600">{subjectOf(open)}</p>
                <h3 className="text-lg font-bold text-slate-900">{open.title}</h3>
              </div>
              <button type="button" onClick={() => setOpen(null)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="Close"><X size={18} /></button>
            </div>
            <div className="space-y-4 px-5 py-4 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-slate-500">Assigned</p><p className="font-semibold text-slate-800">{fmt(open.createdAt)}</p></div>
                <div><p className="text-xs text-slate-500">Due</p><p className="font-semibold text-slate-800">{fmt(open.dueDate)}</p></div>
                <div><p className="text-xs text-slate-500">Teacher</p><p className="font-semibold text-slate-800">{open.teacherId?.name || '—'}</p></div>
                <div><p className="text-xs text-slate-500">Status</p><p className="font-semibold text-slate-800">{STATUS[statusKey(open)].label}</p></div>
                {open.submittedAt ? <div><p className="text-xs text-slate-500">Submitted on</p><p className="font-semibold text-slate-800">{fmt(open.submittedAt)}</p></div> : null}
                {open.score !== undefined && open.score !== null ? <div><p className="text-xs text-slate-500">Marks</p><p className="font-semibold text-slate-800">{open.score}{open.maxScore || open.totalMarks ? ` / ${open.maxScore || open.totalMarks}` : ''}</p></div> : null}
              </div>
              {open.description ? <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">Description</p><p className="whitespace-pre-wrap text-slate-700">{open.description}</p></div> : null}
              {attachmentOf(open) ? (
                <a href={attachmentOf(open)} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 rounded-lg bg-violet-50 px-3 py-2 font-semibold text-violet-700 hover:bg-violet-100">
                  <ExternalLink size={15} /> Open attachment
                </a>
              ) : null}
              {open.feedback ? (
                <div className="rounded-xl border border-emerald-100 bg-emerald-50 p-3">
                  <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-emerald-700">Teacher remarks</p>
                  <p className="whitespace-pre-wrap text-emerald-900">{open.feedback}</p>
                </div>
              ) : null}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ParentHomework;
