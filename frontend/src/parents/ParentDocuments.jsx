import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarClock, Download, FileBadge, FileText, FolderOpen, Megaphone, Receipt, Search } from 'lucide-react';
import { parentApiJson } from './parentApi';
import ChildSwitcher from './ChildSwitcher';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import useParentChildren from './useParentChildren';

// One place for every document the school publishes to parents: exam routine
// PDFs and notice/circular attachments are listed here directly; report cards,
// fee receipts and admit cards open their own screens (which generate them).
const QUICK = [
  { to: '/parents/academic', label: 'Report Card', hint: 'Download the published report card PDF', Icon: BookOpen, tone: 'bg-violet-50 text-violet-700' },
  { to: '/parents/fees', label: 'Fee Receipts', hint: 'Payment history and receipts', Icon: Receipt, tone: 'bg-emerald-50 text-emerald-700' },
  { to: '/parents/admit-cards', label: 'Admit Cards', hint: 'Exam admit cards', Icon: FileBadge, tone: 'bg-sky-50 text-sky-700' },
  { to: '/parents/exam-routine', label: 'Exam Routine', hint: 'Official routine for each exam', Icon: CalendarClock, tone: 'bg-amber-50 text-amber-700' },
];

const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '');
const isForParent = (att) => !att?.role || ['parent', 'parents', 'all'].includes(String(att.role).toLowerCase());

const ParentDocuments = () => {
  const navigate = useNavigate();
  const { options, childKey, setChildKey, selected } = useParentChildren();
  const [notices, setNotices] = useState([]);
  const [examChildren, setExamChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError('');
    const [n, e] = await Promise.allSettled([
      parentApiJson('/api/notifications/user?kind=notice', {}, navigate),
      parentApiJson('/api/exam/groups/parent-schedule', {}, navigate),
    ]);
    setNotices(n.status === 'fulfilled' && Array.isArray(n.value) ? n.value : []);
    setExamChildren(e.status === 'fulfilled' ? (e.value?.children || []) : []);
    if (n.status === 'rejected' && e.status === 'rejected') setError(n.reason?.message || 'Unable to load documents');
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const docs = useMemo(() => {
    const list = [];
    const child = examChildren.find((c) => String(c.studentId) === String(selected?.id)) || examChildren[0];
    (child?.groups || []).forEach((g) => {
      const url = typeof g.routinePdf === 'string' ? g.routinePdf : g.routinePdf?.url || g.routinePdf?.secure_url;
      if (url) list.push({ key: `exam-${g._id}`, name: `${g.title || 'Exam'} — Routine`, type: 'Exam Routine', date: g.updatedAt || g.createdAt, url });
    });
    notices.forEach((n) => {
      (Array.isArray(n.attachments) ? n.attachments : []).filter(isForParent).forEach((att, i) => {
        const url = att.url || att.secure_url;
        if (!url) return;
        list.push({ key: `${n._id}-${i}`, name: att.name || att.fileName || n.title || 'Circular', type: n.typeLabel || 'Circular', date: n.createdAt, url, from: n.title });
      });
    });
    const q = search.trim().toLowerCase();
    return list
      .filter((d) => !q || [d.name, d.type, d.from].some((v) => String(v || '').toLowerCase().includes(q)))
      .sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
  }, [notices, examChildren, selected?.id, search]);

  return (
    <div className="space-y-4 p-3 sm:p-4 md:p-6">
      <PageHeader title="Documents" icon={FolderOpen} subtitle="Report cards, receipts, routines and school circulars.">
        <ChildSwitcher options={options} value={childKey} onChange={setChildKey} />
      </PageHeader>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {QUICK.map(({ to, label, hint, Icon, tone }) => (
          <Link key={to} to={to} className="group flex flex-col rounded-2xl border border-slate-100 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow">
            <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}><Icon size={19} /></span>
            <p className="mt-3 font-semibold text-slate-900">{label}</p>
            <p className="text-xs text-slate-500">{hint}</p>
            <span className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-violet-700">Open <ArrowRight size={13} className="transition group-hover:translate-x-0.5" /></span>
          </Link>
        ))}
      </div>

      <section className="rounded-2xl border border-slate-100 bg-white shadow-sm">
        <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-base font-bold text-slate-900"><Megaphone size={17} className="text-violet-600" /> Circulars &amp; published files</h2>
          <div className="relative w-full sm:w-64">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search documents…" className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100" />
          </div>
        </div>
        {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={load} /> : docs.length === 0 ? (
          <EmptyState title="No documents yet" hint="Files the school shares with parents will appear here." icon={FileText} />
        ) : (
          <ul className="divide-y divide-slate-50">
            {docs.map((d) => (
              <li key={d.key} className="flex items-center gap-3 px-4 py-3">
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-500"><FileText size={18} /></span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{d.name}</p>
                  <p className="truncate text-xs text-slate-500">{d.type}{d.date ? ` · ${fmt(d.date)}` : ''}{d.from && d.from !== d.name ? ` · ${d.from}` : ''}</p>
                </div>
                <a href={d.url} target="_blank" rel="noreferrer" className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:bg-slate-50">
                  <Download size={14} /> <span className="hidden sm:inline">Open</span>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
};

export default ParentDocuments;
