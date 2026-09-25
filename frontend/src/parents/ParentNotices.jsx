import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Megaphone, Paperclip, Pin, RefreshCw, Search } from 'lucide-react';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { parentApiFetch } from './parentApi';
import FormalNotice, { isFormalNotice, attachmentsForRole } from '../components/FormalNotice';
import { downloadAttachment } from '../utils/noticeDisplay';

// Official school notices only (kind 'notice'). Event alerts — fee receipts,
// results, routine changes — live in the bell, not here.
const CATEGORIES = [
  { value: 'all', label: 'All' },
  { value: 'general', label: 'General' },
  { value: 'academic', label: 'Academic' },
  { value: 'exam', label: 'Exam' },
  { value: 'events', label: 'Events' },
  { value: 'fee', label: 'Fee' },
  { value: 'transport', label: 'Transport' },
];

const CATEGORY_TONE = {
  general: 'bg-slate-100 text-slate-700',
  academic: 'bg-blue-50 text-blue-700',
  exam: 'bg-violet-50 text-violet-700',
  events: 'bg-amber-50 text-amber-700',
  fee: 'bg-emerald-50 text-emerald-700',
  transport: 'bg-cyan-50 text-cyan-700',
};

// Older notices predate the category list — infer one from their type.
const categoryOf = (n) => {
  const c = String(n?.category || '').toLowerCase();
  if (CATEGORY_TONE[c] && c !== 'general') return c;
  const t = String(n?.type || '').toLowerCase();
  if (t === 'exam' || t === 'result') return 'exam';
  if (t === 'fee') return 'fee';
  if (String(n?.typeLabel || '') === 'holiday') return 'events';
  return CATEGORY_TONE[c] ? c : 'general';
};

const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ParentNotices = () => {
  const navigate = useNavigate();
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('all');
  const [query, setQuery] = useState('');
  const [openFormalId, setOpenFormalId] = useState(null);

  const load = useCallback(async ({ silent = false } = {}) => {
    if (silent) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const res = await parentApiFetch('/api/notifications/user?kind=notice', { cache: 'no-store' }, navigate);
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Unable to load notices');
      setNotices(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'Unable to load notices');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return notices
      .filter((n) => category === 'all' || categoryOf(n) === category)
      .filter((n) => !q || `${n?.title || ''} ${n?.message || ''}`.toLowerCase().includes(q))
      .sort((a, b) => (Number(Boolean(b?.isPinned)) - Number(Boolean(a?.isPinned)))
        || (new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0)));
  }, [notices, category, query]);

  const counts = useMemo(() => {
    const map = { all: notices.length };
    notices.forEach((n) => { const c = categoryOf(n); map[c] = (map[c] || 0) + 1; });
    return map;
  }, [notices]);

  return (
    <div className="space-y-4">
      <PageHeader
        title="Notices"
        icon={Megaphone}
        subtitle="Official announcements from the school"
        actions={(
          <button
            type="button"
            onClick={() => load({ silent: true })}
            disabled={refreshing}
            aria-label="Refresh notices"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      />

      <div className="flex flex-col gap-3 rounded-2xl bg-white p-3 shadow-sm sm:flex-row sm:items-center">
        <label className="relative flex-1">
          <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search notices"
            className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-indigo-300"
          />
        </label>
        <div className="flex gap-1.5 overflow-x-auto">
          {CATEGORIES.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setCategory(c.value)}
              className={`shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition ${category === c.value ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
            >
              {c.label}{counts[c.value] ? ` (${counts[c.value]})` : ''}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <Loading />
      ) : error ? (
        <ErrorState message={error} onRetry={() => load()} />
      ) : visible.length === 0 ? (
        <EmptyState title="No notices" hint="School notices will appear here." icon={Megaphone} />
      ) : (
        <div className="space-y-3">
          {visible.map((n) => {
            const cat = categoryOf(n);
            const scope = [n?.className, n?.sectionName].filter(Boolean).join(' · ');
            return (
              <article key={n._id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide ${CATEGORY_TONE[cat]}`}>{cat}</span>
                  {n?.isPinned && <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600"><Pin size={11} /> Pinned</span>}
                  {n?.priority === 'high' && <span className="text-[10px] font-semibold text-rose-600">Important</span>}
                  <span className="ml-auto text-xs text-slate-400">{formatDate(n?.createdAt)}</span>
                </div>
                <h2 className="mt-2 text-base font-semibold text-slate-900">{n?.title}</h2>
                {isFormalNotice(n) ? (
                  <>
                    <p className="mt-1 text-sm leading-6 text-slate-600">
                      {String(n.document.paragraphs?.[0] || '').split('**').join('')}
                      {' '}<span className="text-xs text-slate-400">({n.document.noticeNo})</span>
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setOpenFormalId((id) => (id === n._id ? null : n._id))}
                        className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        {openFormalId === n._id ? 'Hide notice' : 'Read full notice'}
                      </button>
                      {n.typeLabel === 'feedback_window' && (
                        <button
                          type="button"
                          onClick={() => navigate('/parents/teacher-feedback')}
                          className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-indigo-700"
                        >
                          Track child&apos;s feedback
                        </button>
                      )}
                    </div>
                    {openFormalId === n._id && <FormalNotice document={n.document} viewerRole="parent" className="mt-4" />}
                  </>
                ) : (
                  <p className="mt-1 whitespace-pre-line text-sm leading-6 text-slate-600">{n?.message}</p>
                )}
                {(scope || n?.createdByName) && (
                  <p className="mt-2 text-xs text-slate-400">{[n?.createdByName && `From ${n.createdByName}`, scope].filter(Boolean).join(' · ')}</p>
                )}
                {attachmentsForRole(n?.attachments || [], 'parent').some((a) => a?.url) && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {attachmentsForRole(n.attachments, 'parent').filter((a) => a?.url).map((a) => (
                      // Blob download so raw Cloudinary files keep their real name (.pdf).
                      <button key={a.url} type="button" onClick={() => downloadAttachment(a)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-indigo-700 hover:bg-indigo-50">
                        <Paperclip size={13} /> {a.name || 'Attachment'}
                      </button>
                    ))}
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default ParentNotices;
