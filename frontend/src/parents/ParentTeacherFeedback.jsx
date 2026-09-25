import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Clock3, Info, Lock, MessageSquareHeart, RefreshCw } from 'lucide-react';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import ChildSwitcher, { useSharedChildSelection } from './ChildSwitcher';
import { parentApiFetch } from './parentApi';

// View-only: parents don't rate teachers — they see instructions and whether
// their child has given feedback for each allocated teacher.

const formatDate = (value) => {
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
};

const INSTRUCTIONS = [
  'Ask your child to log in to the student portal and open Teacher Feedback.',
  'Your child should rate every teacher listed below, honestly and calmly.',
  'Feedback is anonymous — teachers never see who gave it, and you can only see whether it is done.',
  'Please make sure all teachers are completed before the portal closes.',
];

const TONE = {
  emerald: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  slate: 'border-slate-200 bg-slate-50 text-slate-700',
};

const ParentTeacherFeedback = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const childOptions = useMemo(
    () => children.map((c) => ({ id: c.id, name: c.name, meta: [c.grade, c.section].filter(Boolean).join('-') })),
    [children],
  );
  const [childKey, setChildKey, selectedChild] = useSharedChildSelection(childOptions);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await parentApiFetch('/api/parent/teacher-feedback/children', {}, navigate);
        const body = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(body?.error || 'Unable to load children');
        const list = Array.isArray(body.children) ? body.children : [];
        if (!cancelled) { setChildren(list); if (!list.length) setLoading(false); }
      } catch (err) {
        if (!cancelled) { setError(err.message); setLoading(false); }
      }
    })();
    return () => { cancelled = true; };
  }, [navigate]);

  const load = useCallback(async () => {
    if (!selectedChild?.id) return;
    setLoading(true);
    setError('');
    try {
      const res = await parentApiFetch(`/api/parent/teacher-feedback/context?childId=${selectedChild.id}`, { cache: 'no-store' }, navigate);
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Unable to load feedback status');
      setData(body);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [selectedChild?.id, navigate]);

  useEffect(() => { load(); }, [load]);

  const teachers = data?.teachers || [];
  const total = teachers.length;
  const done = teachers.filter((t) => t.submitted).length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const win = data?.feedbackWindow;
  const childName = data?.child?.name || selectedChild?.name || 'Your child';
  const visible = teachers.filter((t) => (filter === 'done' ? t.submitted : filter === 'pending' ? !t.submitted : true));

  let banner = null;
  if (win?.isOpen) banner = { tone: 'emerald', Icon: CheckCircle2, title: 'Feedback portal is open', text: `Open until ${formatDate(win.endDate)}` };
  else if (win?.reason === 'feedback_not_started') banner = { tone: 'amber', Icon: Clock3, title: 'Feedback portal opens soon', text: win.message };
  else if (win) banner = { tone: 'slate', Icon: Lock, title: 'Feedback portal is closed', text: win.message || 'The school has not opened teacher feedback.' };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Teacher Feedback"
        icon={MessageSquareHeart}
        subtitle="Track your child's teacher feedback"
        actions={(
          <button type="button" onClick={load} aria-label="Refresh" className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        )}
      >
        <ChildSwitcher options={childOptions} value={childKey} onChange={setChildKey} />
      </PageHeader>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading && !data ? (
        <Loading />
      ) : !children.length ? (
        <EmptyState title="No children linked" hint="Contact the school to link your child to this account." />
      ) : (
        <>
          <div className="grid gap-3 lg:grid-cols-[1fr_320px]">
            <section className="rounded-2xl border border-indigo-100 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-2 text-indigo-700">
                <Info size={18} />
                <h2 className="text-sm font-semibold">How to give feedback</h2>
              </div>
              <ol className="mt-3 space-y-2">
                {INSTRUCTIONS.map((line, i) => (
                  <li key={line} className="flex gap-3 text-sm text-slate-600">
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-[11px] font-bold text-indigo-700">{i + 1}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </section>

            <section className="space-y-3">
              {banner && (
                <div className={`flex items-start gap-3 rounded-2xl border p-4 ${TONE[banner.tone]}`}>
                  <banner.Icon size={20} className="mt-0.5 shrink-0" />
                  <div>
                    <p className="text-sm font-semibold">{banner.title}</p>
                    {banner.text && <p className="text-xs opacity-80">{banner.text}</p>}
                  </div>
                </div>
              )}
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{childName}&apos;s progress</p>
                  <p className="text-sm font-bold text-slate-900">{done}/{total}</p>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className={`h-full rounded-full transition-all ${pct === 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${pct}%` }} />
                </div>
                <p className="mt-2 text-xs text-slate-500">
                  {total === 0 ? 'No teachers allocated yet.'
                    : pct === 100 ? 'All done — thank you!'
                      : `${total - done} teacher${total - done === 1 ? '' : 's'} still pending.`}
                </p>
              </div>
            </section>
          </div>

          {total > 0 && (
            <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1">
              {[['all', `All (${total})`], ['pending', `Pending (${total - done})`], ['done', `Given (${done})`]].map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setFilter(key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${filter === key ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-900'}`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {total === 0 ? (
            <EmptyState title="No teachers allocated" hint="Your child's timetable has no teachers assigned yet." icon={MessageSquareHeart} />
          ) : visible.length === 0 ? (
            <EmptyState title={filter === 'done' ? 'No feedback given yet' : 'Nothing pending'} icon={MessageSquareHeart} />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {visible.map((t) => (
                <article
                  key={`${t.teacherId}-${t.subjectId || t.subjectName}`}
                  className={`flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm ${t.submitted ? 'border-emerald-200' : 'border-slate-200'}`}
                >
                  {t.teacherProfilePic
                    ? <img src={t.teacherProfilePic} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
                    : <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700">{String(t.teacherName || 'T').slice(0, 1)}</span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-slate-900">{t.teacherName}</p>
                    <p className="truncate text-xs text-slate-500">{t.subjectName}</p>
                  </div>
                  {t.submitted ? (
                    <span className="flex shrink-0 flex-col items-end">
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700"><CheckCircle2 size={13} /> Given</span>
                      {t.submittedAt && <span className="mt-1 text-[10px] text-slate-400">{formatDate(t.submittedAt)}</span>}
                    </span>
                  ) : (
                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700"><Clock3 size={13} /> Pending</span>
                  )}
                </article>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default ParentTeacherFeedback;
