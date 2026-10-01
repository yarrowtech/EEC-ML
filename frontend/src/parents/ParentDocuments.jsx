import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Bus,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Download,
  Eye,
  FileText,
  Folder,
  GraduationCap,
  HeartPulse,
  LayoutGrid,
  Contact,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import useParentChildren from './useParentChildren';
import ChildPicker from './ChildPicker';
import { FileBadge, PreviewModal, fileKind, fmt, kindLabel } from './DocPreview';

// Every document the school holds for the selected child, grouped by category:
// enrolment documents / photo / certificates (from the student record), exam
// routine PDFs and notice/circular attachments shared with parents.

const CATEGORIES = [
  {
    key: 'identity',
    title: 'Identity Documents',
    subtitle: 'Official identification and personal documents.',
    tab: 'Identity',
    Icon: Contact,
    headBg: 'bg-rose-50/70',
    iconBg: 'bg-rose-500 text-white',
    badge: 'bg-rose-100/70 text-rose-700',
    tabIcon: 'text-rose-500',
  },
  {
    key: 'academic',
    title: 'Academic Documents',
    subtitle: 'Reports, certificates and academic records.',
    tab: 'Academic',
    Icon: GraduationCap,
    headBg: 'bg-blue-50/70',
    iconBg: 'bg-blue-100 text-blue-600',
    badge: 'bg-blue-100/70 text-blue-700',
    tabIcon: 'text-blue-600',
  },
  {
    key: 'medical',
    title: 'Medical Documents',
    subtitle: 'Health related documents and medical records.',
    tab: 'Medical',
    Icon: HeartPulse,
    headBg: 'bg-emerald-50/70',
    iconBg: 'bg-emerald-100 text-emerald-600',
    badge: 'bg-emerald-100/70 text-emerald-700',
    tabIcon: 'text-emerald-600',
  },
  {
    key: 'transport',
    title: 'Transport Documents',
    subtitle: 'Transport related documents.',
    tab: 'Transport',
    Icon: Bus,
    headBg: 'bg-indigo-50/70',
    iconBg: 'bg-indigo-100 text-indigo-600',
    badge: 'bg-indigo-100/70 text-indigo-700',
    tabIcon: 'text-indigo-600',
  },
  {
    key: 'other',
    title: 'Other Documents',
    subtitle: 'Any other important documents.',
    tab: 'Other',
    Icon: Folder,
    headBg: 'bg-amber-50/70',
    iconBg: 'bg-amber-100 text-amber-500',
    badge: 'bg-amber-100/70 text-amber-700',
    tabIcon: 'text-amber-500',
  },
];

/* ---------- client cache (stale-while-revalidate, per login) ---------- */
const FRESH_MS = 60 * 1000;
const cacheKey = () => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `parent:documents:v2:${t.slice(-16)}`;
};
const MAX_AGE_MS = 24 * 60 * 60 * 1000;
let memCache = null; // { key, at, data } — survives route changes, no JSON parse
let inflight = null; // shared request so remounts never double-fetch
const readCache = () => {
  const key = cacheKey();
  if (memCache?.key === key) return memCache;
  try {
    const entry = JSON.parse(localStorage.getItem(key) || 'null');
    memCache = entry && Date.now() - entry.at < MAX_AGE_MS ? { ...entry, key } : null;
  } catch { memCache = null; }
  return memCache;
};
const writeCache = (data) => {
  memCache = { key: cacheKey(), at: Date.now(), data };
  try { localStorage.setItem(memCache.key, JSON.stringify({ at: memCache.at, data })); } catch { /* quota */ }
};
/* ---------------------------- small parts ---------------------------- */

const DocCard = ({ doc, onPreview }) => {
  const kind = fileKind(doc);
  return (
    <div className="flex items-center gap-2.5 rounded-xl border border-slate-100 bg-white p-2.5 shadow-[0_1px_4px_rgba(15,23,42,0.04)]">
      <FileBadge kind={kind} />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold text-slate-900" title={doc.name}>{doc.name}</p>
        <p className="truncate text-xs text-slate-500">{kindLabel(kind)}</p>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {doc.date && <span className="text-xs text-slate-500">Uploaded: {fmt(doc.date)}</span>}
          {doc.verified && (
            <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-600">
              <CheckCircle2 size={10} /> Verified
            </span>
          )}
        </div>
      </div>
      <div className="flex shrink-0 flex-col gap-1.5 sm:flex-row">
        <button
          type="button"
          onClick={() => onPreview(doc)}
          title="Preview"
          aria-label={`Preview ${doc.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-violet-600 transition hover:bg-blue-50"
        >
          <Eye size={16} />
        </button>
        <a
          href={doc.url}
          target="_blank"
          rel="noreferrer"
          download
          title="Download"
          aria-label={`Download ${doc.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 text-violet-600 transition hover:bg-blue-50"
        >
          <Download size={16} />
        </a>
      </div>
    </div>
  );
};

/* ------------------------------- page ------------------------------- */

const ParentDocuments = () => {
  const navigate = useNavigate();
  const { children, options, setChildKey, selected } = useParentChildren();
  const initial = readCache()?.data || null;
  const [raw, setRaw] = useState(initial);
  const [loading, setLoading] = useState(!initial);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [collapsed, setCollapsed] = useState({});
  const [preview, setPreview] = useState(null);

  const load = useCallback(async (force = false) => {
    const cached = readCache();
    if (!force && cached && Date.now() - cached.at < FRESH_MS) { setRaw(cached.data); setLoading(false); return; }
    if (!cached) setLoading(true);
    setError('');
    if (!inflight) {
      inflight = Promise.allSettled([
        parentApiJson('/api/parent/auth/children-documents', {}, navigate),
        parentApiJson('/api/exam/groups/parent-schedule', {}, navigate),
      ]).finally(() => { inflight = null; });
    }
    const [d, e] = await inflight;
    const data = {
      student: d.status === 'fulfilled' ? (d.value?.children || []) : [],
      exams: e.status === 'fulfilled' ? (e.value?.children || []) : [],
    };
    if ([d, e].every((r) => r.status === 'rejected')) {
      if (!cached) setError(d.reason?.message || 'Unable to load documents');
    } else {
      setRaw(data);
      writeCache(data);
    }
    setLoading(false);
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const handleChildChange = (id) => {
    const opt = options.find((o) => o.id === id);
    if (opt) setChildKey(`${opt.id || ''}::${opt.name || ''}`);
  };

  const grouped = useMemo(() => {
    const out = Object.fromEntries(CATEGORIES.map((c) => [c.key, []]));
    if (!raw || !selected) return out;
    const sid = String(selected.id);
    const own = raw.student.find((c) => String(c.studentId) === sid);
    (own?.documents || []).forEach((d, i) => {
      (out[d.category] || out.other).push({ key: `s-${i}`, name: d.name, url: d.url, fileName: d.fileName, date: d.uploadedAt, verified: d.verified });
    });
    const exam = raw.exams.find((c) => String(c.studentId) === sid) || (raw.exams.length === 1 ? raw.exams[0] : null);
    (exam?.groups || []).forEach((g) => {
      const url = typeof g.routinePdf === 'string' ? g.routinePdf : g.routinePdf?.url || g.routinePdf?.secure_url;
      if (url) out.academic.push({ key: `exam-${g._id}`, name: `${g.title || 'Exam'} Routine`, url, fileName: 'routine.pdf', date: g.updatedAt || g.createdAt, verified: true });
    });
    Object.values(out).forEach((list) => list.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0)));
    return out;
  }, [raw, selected]);

  const visible = CATEGORIES.filter((c) => tab === 'all' || tab === c.key);
  const total = Object.values(grouped).reduce((s, l) => s + l.length, 0);

  return (
    <div className="min-h-full space-y-4 bg-[#f5f8ff] p-3 sm:p-4 md:p-6">
      {/* Header + child selector */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-rose-100/70 text-rose-500">
            <FileText size={22} />
          </span>
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold tracking-tight text-[#10145c] sm:text-2xl">Documents</h1>
            <p className="text-xs text-slate-500 sm:text-sm">All important documents related to your child in one place.</p>
          </div>
        </div>
        <ChildPicker kids={children} selected={selected} onChange={handleChildChange} />
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setTab('all')}
          className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${tab === 'all' ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
        >
          <LayoutGrid size={16} /> All Documents
        </button>
        {CATEGORIES.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setTab(c.key)}
            className={`flex shrink-0 items-center gap-2 rounded-full border px-4 py-2 text-xs font-semibold transition ${tab === c.key ? 'border-violet-600 bg-violet-600 text-white shadow-sm' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'}`}
          >
            <c.Icon size={16} className={tab === c.key ? 'text-white' : c.tabIcon} /> {c.tab}
          </button>
        ))}
      </div>

      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={() => load(true)} /> : !selected ? (
        <EmptyState title="No child linked" hint="Ask the school to link your child to this account." icon={FileText} />
      ) : tab === 'all' && total === 0 ? (
        <EmptyState title="No documents yet" hint="Documents the school uploads for your child will appear here." icon={FileText} />
      ) : (
        <div className="space-y-3">
          {visible.map((c) => {
            const list = grouped[c.key];
            const isOpen = !collapsed[c.key];
            return (
              <section key={c.key} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_2px_12px_rgba(15,23,42,0.04)]">
                <button
                  type="button"
                  onClick={() => setCollapsed((s) => ({ ...s, [c.key]: isOpen }))}
                  className={`flex w-full items-center gap-3 px-3 py-2 text-left ${c.headBg}`}
                  aria-expanded={isOpen}
                >
                  <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${c.iconBg}`}>
                    <c.Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h2 className="text-sm font-bold text-[#10145c]">{c.title}</h2>
                    <p className="truncate text-[11px] text-slate-500">{c.subtitle}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium ${c.badge}`}>
                    {list.length} {list.length === 1 ? 'file' : 'files'}
                  </span>
                  {isOpen ? <ChevronUp size={18} className="shrink-0 text-blue-600" /> : <ChevronDown size={18} className="shrink-0 text-blue-600" />}
                </button>
                {isOpen && (
                  <div className="p-2.5">
                    {list.length ? (
                      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                        {list.map((d) => <DocCard key={d.key} doc={d} onPreview={setPreview} />)}
                      </div>
                    ) : (
                      <p className="px-2 py-1.5 text-xs text-slate-400">No {c.tab.toLowerCase()} documents uploaded yet.</p>
                    )}
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}

      <PreviewModal doc={preview} onClose={() => setPreview(null)} />
    </div>
  );
};

export default ParentDocuments;
