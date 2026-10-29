import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  BookOpen, CalendarCheck2, CalendarDays, Check, ChevronRight, Clock3, Lock, MessageSquareMore, RefreshCw,
} from 'lucide-react';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { useSharedChildSelection } from './ChildSwitcher';
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

const CARD = 'rounded-xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]';

const TONE = {
  emerald: { card: 'border-emerald-100 bg-emerald-50/60', icon: 'bg-emerald-500 text-white', text: 'text-emerald-700' },
  amber: { card: 'border-amber-100 bg-amber-50/60', icon: 'bg-amber-500 text-white', text: 'text-amber-700' },
  slate: { card: 'border-slate-200 bg-slate-50', icon: 'bg-slate-400 text-white', text: 'text-slate-600' },
};

// Letter avatars rotate through soft tones (teachers without a photo).
const AVATAR_TONES = [
  'bg-blue-50 text-blue-600',
  'bg-violet-50 text-violet-600',
  'bg-cyan-50 text-cyan-700',
  'bg-fuchsia-50 text-fuchsia-600',
];

const PAGE_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const RISE = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};
const LIST_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.03 } } };
const ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.22, ease: 'easeOut' } },
};

const ParentTeacherFeedback = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState('all');

  const childOptions = useMemo(
    () => children.map((c) => ({ id: c.id, name: c.name, meta: [c.grade, c.section].filter(Boolean).join('-'), profileImage: c.profilePic || c.profileImage || c.photo || '' })),
    [children],
  );
  const [, , selectedChild] = useSharedChildSelection(childOptions);

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
  if (win?.isOpen) banner = { tone: 'emerald', Icon: CalendarCheck2, title: 'Feedback portal is open', text: `Open until ${formatDate(win.endDate)}` };
  else if (win?.reason === 'feedback_not_started') banner = { tone: 'amber', Icon: Clock3, title: 'Feedback portal opens soon', text: win.message };
  else if (win) banner = { tone: 'slate', Icon: Lock, title: 'Feedback portal is closed', text: win.message || 'The school has not opened teacher feedback.' };


  const tabs = [['all', `All (${total})`], ['pending', `Pending (${total - done})`], ['done', `Given (${done})`]];

  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="space-y-3 p-3 sm:p-4 md:p-5">
      {/* Header + child selector (top right) */}
      <motion.header variants={RISE} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600">
            <MessageSquareMore size={22} />
          </span>
          <div>
            <h1 className="text-xl font-bold leading-tight text-[#0b1446]">Teacher Feedback</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Track your child&apos;s teacher feedback</p>
          </div>
        </div>

        <div className="flex w-full items-center gap-2 sm:w-auto">
          <button
            type="button"
            onClick={load}
            aria-label="Refresh"
            className="inline-flex h-[54px] shrink-0 items-center gap-2 rounded-xl border border-blue-200 bg-white px-3.5 text-xs font-semibold text-blue-600 shadow-[0_1px_3px_rgba(15,23,42,0.04)] transition hover:bg-blue-50"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Refresh</span>
          </button>
        </div>
      </motion.header>

      {error ? (
        <ErrorState message={error} onRetry={load} />
      ) : loading && !data ? (
        <Loading />
      ) : !children.length ? (
        <EmptyState title="No children linked" hint="Contact the school to link your child to this account." />
      ) : (
        <>
          <motion.div variants={RISE} className="grid gap-3 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
            {/* Instructions */}
            <section className={`${CARD} p-3.5`}>
              <div className="mb-3 flex items-center gap-2.5">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-50 text-blue-600"><BookOpen size={18} /></span>
                <h2 className="text-base font-bold text-[#0b1446]">How to give feedback</h2>
              </div>
              <ol className="relative space-y-2.5 pl-1">
                <span aria-hidden="true" className="absolute bottom-3 left-[13px] top-3 w-px bg-blue-100" />
                {INSTRUCTIONS.map((line, i) => (
                  <li key={line} className="relative flex items-center gap-3 text-xs text-slate-700 sm:text-[13px]">
                    <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[11px] font-bold text-white">{i + 1}</span>
                    <span>{line}</span>
                  </li>
                ))}
              </ol>
            </section>

            <div className="grid gap-3">
              {/* Window banner */}
              {banner && (
                <div className={`relative flex items-center gap-3 overflow-hidden rounded-xl border px-4 py-3 ${TONE[banner.tone].card}`}>
                  <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${TONE[banner.tone].icon}`}><banner.Icon size={22} /></span>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-[#0b1446]">{banner.title}</p>
                    {banner.text && <p className={`text-xs ${TONE[banner.tone].text}`}>{banner.text}</p>}
                  </div>
                  <CalendarDays aria-hidden="true" size={56} className={`absolute -right-1 top-1/2 hidden -translate-y-1/2 opacity-15 sm:block ${TONE[banner.tone].text}`} />
                </div>
              )}

              {/* Progress */}
              <div className="flex items-center gap-4 rounded-xl border border-violet-100 bg-violet-50/40 px-4 py-3">
                <svg viewBox="0 0 36 36" className="h-16 w-16 shrink-0 -rotate-90" aria-hidden="true">
                  <circle cx="18" cy="18" r="15" fill="none" strokeWidth="4" className="stroke-slate-200/70" />
                  <motion.circle
                    cx="18" cy="18" r="15" fill="none" strokeWidth="4" strokeLinecap="round"
                    className={pct === 100 ? 'stroke-emerald-500' : 'stroke-blue-600'}
                    strokeDasharray={2 * Math.PI * 15}
                    initial={{ strokeDashoffset: 2 * Math.PI * 15 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - pct / 100) }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                  />
                </svg>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-[#0b1446]">{childName}&apos;s progress</p>
                  <p className="text-2xl font-bold leading-tight text-[#0b1446]">{done}/{total}</p>
                  <p className="text-xs text-slate-500">
                    {total === 0 ? 'No teachers allocated yet.'
                      : pct === 100 ? 'All done — thank you!'
                        : `${total - done} teacher${total - done === 1 ? '' : 's'} still pending.`}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Teachers */}
          <motion.section variants={RISE} className={`${CARD} p-3`}>
            {total > 0 && (
              <div className="mb-3 flex flex-wrap gap-1.5">
                {tabs.map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    aria-pressed={filter === key}
                    onClick={() => setFilter(key)}
                    className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${filter === key ? 'border-violet-600 bg-violet-600 text-white' : 'border-slate-200 bg-white text-[#0b1446] hover:bg-slate-50'}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            )}

            {total === 0 ? (
              <EmptyState title="No teachers allocated" hint="Your child's timetable has no teachers assigned yet." icon={MessageSquareMore} />
            ) : visible.length === 0 ? (
              <EmptyState title={filter === 'done' ? 'No feedback given yet' : 'Nothing pending'} icon={MessageSquareMore} />
            ) : (
              <motion.div key={filter} variants={LIST_MOTION} initial="hidden" animate="show" className="grid gap-2 md:grid-cols-2">
                {visible.map((t, i) => {
                  const avatarTone = AVATAR_TONES[i % AVATAR_TONES.length];
                  return (
                    <motion.article
                      key={`${t.teacherId}-${t.subjectId || t.subjectName}`}
                      variants={ITEM}
                      className="flex items-center gap-3 rounded-lg border border-slate-100 bg-white px-3 py-2 transition hover:border-blue-100 hover:shadow-[0_4px_14px_rgba(15,23,42,0.05)]"
                    >
                      {t.teacherProfilePic
                        ? <img src={t.teacherProfilePic} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
                        : <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-base font-semibold ${avatarTone}`}>{String(t.teacherName || 'T').slice(0, 1).toUpperCase()}</span>}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-bold text-[#0b1446]">{t.teacherName}</p>
                        <p className="truncate text-xs text-slate-500">{t.subjectName}</p>
                      </div>
                      {t.submitted ? (
                        <span className="flex shrink-0 flex-col items-center">
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-0.5 text-[11px] font-medium text-emerald-700"><Check size={13} /> Given</span>
                          {t.submittedAt && <span className="mt-0.5 text-[11px] text-slate-500">{formatDate(t.submittedAt)}</span>}
                        </span>
                      ) : (
                        <span className="shrink-0 rounded-full bg-rose-50 px-3 py-0.5 text-[11px] font-medium text-rose-500">Pending</span>
                      )}
                      {/* <ChevronRight size={16} aria-hidden="true" className="shrink-0 text-slate-500" /> */}
                    </motion.article>
                  );
                })}
              </motion.div>
            )}
          </motion.section>
        </>
      )}
    </motion.div>
  );
};

export default ParentTeacherFeedback;
