import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Calendar, FileText, Loader2, Clock, CheckCircle2, Sparkles, ChevronLeft, ChevronRight, Search as SearchIcon, AlertCircle, PlayCircle, RefreshCw } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { slugifyForUrl } from '../utils/urlSlug';
import { ResultPickerCard, useCompactExamLayout } from './StudentExamPickerCard';
import toast from 'react-hot-toast';
import { useStudentDashboard } from './StudentDashboardContext';
import { fetchCachedJson } from '../utils/studentApiCache';
import { generateExamSchedulePdf, buildFullVenueLabel } from '../utils/examRoutinePdf';
import MockExamView from './MockExamView';
import WrongAnswerReviewView from './WrongAnswerReviewView';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const STUDENT_EXAMS_ENDPOINT = `${API_BASE}/api/exam/groups/student-schedule`;
const STUDENT_EXAMS_CACHE_TTL_MS = 2 * 60 * 1000;

const TERM_OPTIONS = ['all', 'Class Test', 'Unit Test', 'Monthly Test', 'Term 1', 'Term 2', 'Term 3', 'Half Yearly', 'Annual', 'Final'];
const STATUS_OPTIONS = ['all', 'scheduled', 'completed'];

const FILTER_INPUT = 'min-w-0 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-700 focus-visible:outline-2 focus-visible:outline-amber-600';

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
};

const parseExamDateTime = (dateStr, timeStr) => {
  if (!dateStr) return null;
  let d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) {
    const parts = String(dateStr).split('/');
    if (parts.length === 3) d = new Date(`${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`);
  }
  if (Number.isNaN(d.getTime())) return null;

  if (timeStr) {
    const m = String(timeStr).match(/(\d{1,2}):(\d{2})\s*(AM|PM)?/i);
    if (m) {
      let h = parseInt(m[1], 10);
      const mins = parseInt(m[2], 10);
      const ampm = m[3]?.toUpperCase();
      if (ampm === 'PM' && h !== 12) h += 12;
      if (ampm === 'AM' && h === 12) h = 0;
      d.setHours(h, mins, 0, 0);
    }
  }
  return d;
};

const daysUntil = (value) => {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  d.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
};

// ── Days-until pill ─────────────────────────────────────────────────────────
const CountdownBadge = ({ date, small = false }) => {
  const days = daysUntil(date);
  if (days === null || days < 0) return null;
  const label = days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`;
  return (
    <span
      className={`rounded-full border font-bold ${small ? 'px-2 py-0.5 text-[10.5px]' : 'px-2.5 py-1 text-xs'} ${
        days <= 1
          ? 'border-rose-200/70 bg-rose-50 text-rose-600'
          : 'border-[rgba(139,92,246,0.3)] bg-violet-50 text-[#7c3aed]'
      }`}
    >
      {label}
    </span>
  );
};

const examTitle = (group) => group.title || group.term || 'Exam schedule';

// Where an exam is right now: upcoming → ongoing → completed
const examPhase = (group) => {
  if (String(group?.status || '').toLowerCase() === 'completed') return 'completed';
  const start = parseExamDateTime(group?.startDate, group?.startTime);
  const end = parseExamDateTime(group?.endDate || group?.startDate);
  const now = new Date();
  if (start && start > now) return 'upcoming';
  if (end) {
    const endOfDay = new Date(end);
    endOfDay.setHours(23, 59, 59, 999);
    if (endOfDay < now) return 'completed';
  }
  return start ? 'ongoing' : 'upcoming';
};
const PHASE_META = {
  upcoming: { label: 'Upcoming', cls: 'bg-amber-500 text-white' },
  ongoing: { label: 'Ongoing', cls: 'bg-sky-600 text-white' },
  completed: { label: 'Completed', cls: 'bg-emerald-600 text-white' },
};
const ExamTags = ({ group }) => {
  const phase = examPhase(group);
  const meta = PHASE_META[phase];
  return (
    <>
      <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${meta.cls}`}>{meta.label}</span>
      {phase === 'upcoming' && <CountdownBadge date={group.startDate} small />}
    </>
  );
};
const examSubject = (exam) => exam.subjectId?.name || exam.subject || exam.title || 'Subject';
const examSubjects = (group) => Array.isArray(group.subjects) ? group.subjects : [];

// This class/section's exam window: first to last subject paper date (falls back to the exam's own dates)
const examDateRange = (group) => {
  const times = examSubjects(group)
    .map((exam) => new Date(exam?.date).getTime())
    .filter((t) => Number.isFinite(t));
  const start = times.length ? new Date(Math.min(...times)) : group.startDate;
  const end = times.length ? new Date(Math.max(...times)) : (group.endDate || group.startDate);
  const a = formatDate(start);
  const b = formatDate(end);
  return a === b || b === '—' ? a : `${a} – ${b}`;
};

const ExamScheduleCard = ({ group, downloading, onDownload, onPractice }) => {
  const [pickSubject, setPickSubject] = useState(false);
  const status = String(group.status || 'scheduled').toLowerCase();
  const completed = status === 'completed';
  const published = status === 'published' || completed;
  const subjects = examSubjects(group);
  const className = group.classId?.name || group.grade;
  const sectionName = group.sectionId?.name || group.section;
  // This class/section's own first–last paper dates
  const dateLabel = examDateRange(group);

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-200 px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <h2 className="text-xl font-bold text-slate-950">{examTitle(group)}</h2>
          {(className || sectionName) && (
            <p className="mt-1 text-sm text-slate-600">
              {[className && (/^class\b/i.test(className) ? className : `Class ${className}`), sectionName && `Section ${sectionName}`].filter(Boolean).join(' · ')}
            </p>
          )}
          {dateLabel && dateLabel !== '—' && <p className="mt-1 text-xs text-slate-500">{dateLabel}</p>}
        </div>
        <div className="flex flex-col items-start gap-2 sm:items-end">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${PHASE_META[examPhase(group)].cls}`}>{PHASE_META[examPhase(group)].label}</span>
            {examPhase(group) === 'upcoming' && <CountdownBadge date={group.startDate} />}
          </div>
          {published && (
          <div className="flex flex-wrap gap-2 sm:justify-end">
              <button type="button" disabled={downloading} onClick={onDownload}
                className="inline-flex items-center gap-1.5 rounded-full bg-violet-700 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-800 disabled:opacity-60">
                {downloading ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                {downloading ? 'Preparing…' : 'Download routine'}
              </button>
              {subjects.length > 0 && (
                <button
                  type="button"
                  aria-haspopup="dialog"
                  onClick={() => setPickSubject(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-800"
                >
                  <PlayCircle size={14} /> Practice Mock
                </button>
              )}
              {completed && <Link to="/student/results" className="inline-flex items-center rounded-full border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">View results</Link>}
          </div>
          )}
        </div>
      </div>
      {published ? (
        <>
          {pickSubject && typeof document !== 'undefined' && createPortal(
            <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setPickSubject(false)}>
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="practice-mock-title"
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl"
              >
                <div className="flex items-center justify-between gap-3 border-b border-slate-200 px-5 py-4">
                  <div className="min-w-0">
                    <h3 id="practice-mock-title" className="text-base font-bold text-slate-900">Practice Mock</h3>
                    <p className="text-xs text-slate-500">Choose a subject — questions from all its chapters, mixed.</p>
                  </div>
                  <button type="button" onClick={() => setPickSubject(false)} aria-label="Close" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">✕</button>
                </div>
                <div className="max-h-[60vh] space-y-2 overflow-y-auto p-4">
                  {subjects.map((exam, index) => (
                    <button
                      key={exam._id || index}
                      type="button"
                      onClick={() => { setPickSubject(false); onPractice(exam); }}
                      className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-emerald-300 hover:bg-emerald-50"
                    >
                      <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700"><PlayCircle size={18} /></span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-bold text-slate-900">{examSubject(exam)}</span>
                        {exam.date && <span className="block text-xs text-slate-500">Exam on {formatDate(exam.date)}</span>}
                      </span>
                      <ChevronRight size={16} className="shrink-0 text-slate-400" />
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body,
          )}
          <div className="p-4 sm:p-5">
            <h3 className="mb-2 text-sm font-semibold text-slate-900">Subject schedule ({subjects.length})</h3>
            {subjects.length ? (
              <div className="overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[22rem] text-left text-xs text-slate-600">
                  <thead className="bg-slate-50 text-slate-700">
                    <tr>{['Subject', 'Date', 'Time', 'Building / Floor / Room'].map((label) => <th key={label} scope="col" className="px-3 py-2.5">{label}</th>)}</tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {subjects.map((exam, index) => (
                      <tr key={exam._id || index}>
                        <th scope="row" className="px-3 py-2.5 font-semibold text-slate-900">{examSubject(exam)}</th>
                        <td className="whitespace-nowrap px-3 py-2.5">{formatDate(exam.date)}</td>
                        <td className="whitespace-nowrap px-3 py-2.5">{exam.time || '—'}</td>
                        <td className="px-3 py-2.5">{buildFullVenueLabel(exam)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : <p className="text-sm text-slate-500">No subjects are listed for this exam.</p>}
          </div>
        </>
      ) : (
        <p className="m-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-800">
          <AlertCircle size={16} className="mt-0.5 shrink-0" aria-hidden="true" /> The subject schedule will appear once your school publishes the exam routine.
        </p>
      )}
    </article>
  );
};

const StudentExamsView = () => {
  const { profile } = useStudentDashboard() || {};
  const navigate = useNavigate();
  // Practice Mock = the subject's whole-subject tryout (questions from every chapter, mixed);
  // closing it comes back here.
  const openSubjectPractice = (exam) => {
    const subjectSlug = slugifyForUrl(examSubject(exam));
    navigate(`/student/smart-learning-courses/subject/${subjectSlug}/topic/${slugifyForUrl('All chapters')}/assessment/tryout-section?scope=chapters`, {
      state: { returnTo: '/student/exams' },
    });
  };
  const compact = useCompactExamLayout();
  const shellRef = useRef(null);
  const [shellHeight, setShellHeight] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showDetail, setShowDetail] = useState(false);
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [termFilter, setTermFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [downloadingGroupId, setDownloadingGroupId] = useState('');
  const [mockExamOpen, setMockExamOpen] = useState(null); // { examId, examTitle, durationMinutes }
  const [reviewExam, setReviewExam] = useState(null);     // { examId, examTitle }

  const [refreshing, setRefreshing] = useState(false);

  const load = async ({ force = false } = {}) => {
    const token = localStorage.getItem('token');
    if (!token) { setError('Please login as student.'); setLoading(false); return; }
    if (force) setRefreshing(true); else setLoading(true);
    setError('');
    try {
      const { data } = await fetchCachedJson(STUDENT_EXAMS_ENDPOINT, {
        ttlMs: STUDENT_EXAMS_CACHE_TTL_MS,
        forceRefresh: force,
        fetchOptions: { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      });
      setGroups(Array.isArray(data) ? data : []);
      if (force) toast.success('Exams updated');
    } catch (err) {
      setError(err.message || 'Failed to load exam schedule');
      if (!force) setGroups([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((g) => {
      const termMatches   = termFilter   === 'all' || String(g?.term   || '') === termFilter;
      const statusMatches = statusFilter === 'all' || String(g?.status || '').toLowerCase() === statusFilter;
      const queryMatches  = !q || [g?.title, g?.term, g?.grade, g?.section, ...examSubjects(g).map(examSubject)].some((v) => String(v || '').toLowerCase().includes(q));
      return termMatches && statusMatches && queryMatches;
    }).sort((a, b) => {
      const rank = { ongoing: 0, upcoming: 1, completed: 2 };
      const pa = examPhase(a);
      const pb = examPhase(b);
      if (rank[pa] !== rank[pb]) return rank[pa] - rank[pb];
      const da = parseExamDateTime(a.startDate, a.startTime)?.getTime() || 0;
      const db = parseExamDateTime(b.startDate, b.startTime)?.getTime() || 0;
      return pa === 'completed' ? db - da : da - db;
    });
  }, [groups, search, statusFilter, termFilter]);

  const stats = useMemo(() => {
    const total     = groups.length;
    const completed = groups.filter((g) => String(g?.status || '').toLowerCase() === 'completed').length;
    const scheduled = total - completed;
    const upcoming  = groups
      .filter((g) => String(g?.status || '').toLowerCase() !== 'completed')
      .map((g) => ({ g, dt: parseExamDateTime(g.startDate, g.startTime) }))
      .filter((e) => e.dt && e.dt > new Date())
      .sort((a, b) => a.dt - b.dt);
    return { total, completed, scheduled, next: upcoming[0]?.g || null };
  }, [groups]);

  const pdfHeader = useMemo(() => ({
    schoolName: String(profile?.schoolName || '').trim(),
    schoolAddressLine: String(profile?.schoolAddress || '').trim(),
    logoUrl: String(profile?.schoolLogo || '').trim(),
    principalName: String(profile?.principalName || '').trim(),
  }), [profile]);

  const handleDownload = async (group) => {
    try {
      setDownloadingGroupId(String(group?._id || ''));
      await generateExamSchedulePdf(group, pdfHeader);
      toast.success('Exam routine downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to download exam routine');
    } finally {
      setDownloadingGroupId('');
    }
  };


  useLayoutEffect(() => {
    const measure = () => {
      const shell = shellRef.current;
      setShellHeight(shell && !compact && window.innerWidth >= 1024
        ? Math.max(480, window.innerHeight - shell.getBoundingClientRect().top - 16)
        : null);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [compact]);

  const selectedGroup = filteredGroups.find((group) => String(group._id) === selectedId);
  const activeGroup = selectedGroup || filteredGroups[0];
  const showingCompactDetail = compact && showDetail && selectedGroup;
  const chooseExam = (group) => {
    setSelectedId(String(group._id));
    setShowDetail(true);
  };
  const resetFilters = () => {
    setSearch('');
    setTermFilter('all');
    setStatusFilter('all');
  };
  const tiles = [
    { label: 'Total Exams', value: stats.total, icon: FileText, tone: 'bg-blue-50 text-blue-600' },
    { label: 'Scheduled', value: stats.scheduled, icon: Clock, tone: 'bg-amber-50 text-amber-600' },
    { label: 'Completed', value: stats.completed, icon: CheckCircle2, tone: 'bg-emerald-50 text-emerald-600' },
    { label: 'Next Exam', value: stats.next?.title || stats.next?.term || 'None', icon: Sparkles, tone: 'bg-violet-50 text-violet-600' },
  ];

  return (
    <>
      <div className="p-3 pb-24 md:p-4">
        <div ref={shellRef} style={shellHeight ? { height: shellHeight } : undefined} className="flex min-h-[480px] flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 px-4 py-3">
            <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-600">
              <Calendar size={20} aria-hidden="true" />
            </span>
            <div className="min-w-0 flex-1">
              <h1 className="text-[17px] font-bold leading-tight text-slate-900">Exams</h1>
              <p className="text-xs text-slate-500">Choose an exam to see its schedule.</p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => load({ force: true })}
                disabled={refreshing || loading}
                aria-label="Refresh"
                title="Refresh"
                className="grid size-9 shrink-0 place-items-center rounded-full border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
              >
                <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
              </button>
            </div>
          </header>

          <div className="grid shrink-0 grid-cols-2 divide-x divide-y divide-slate-200 border-b border-slate-200 md:grid-cols-4 md:divide-y-0">
            {tiles.map(({ label, value, icon: Icon, tone }) => (
              <div key={label} className="flex min-w-0 items-center gap-3 px-4 py-3">
                <span className={`grid size-9 shrink-0 place-items-center rounded-lg ${tone}`}><Icon size={18} aria-hidden="true" /></span>
                <div className="min-w-0">
                  <p className="truncate text-base font-bold leading-tight text-slate-900" title={String(value)}>{value}</p>
                  <p className="mt-1 text-[11px] text-slate-500">{label}</p>
                </div>
              </div>
            ))}
          </div>

          {loading ? (
            <p role="status" className="flex items-center gap-2 p-5 text-sm text-slate-600"><Loader2 size={15} className="animate-spin" /> Loading exam schedule…</p>
          ) : error ? (
            <p role="alert" className="flex items-center gap-2 bg-red-50 p-4 text-sm text-red-700"><AlertCircle size={15} /> {error}</p>
          ) : !activeGroup ? (
            <div className="p-6 text-center text-sm text-slate-600">
              <p>No exams found.</p>
              {(search || termFilter !== 'all' || statusFilter !== 'all') && <button type="button" onClick={resetFilters} className="mt-2 font-semibold text-amber-800 underline">Clear filters</button>}
            </div>
          ) : (
            <div className={`grid min-h-0 flex-1 grid-cols-1 ${compact ? '' : 'lg:grid-cols-[minmax(0,1fr)_minmax(0,3fr)]'}`}>
              {compact
                ? !showingCompactDetail && (
                  <div className="grid content-start gap-3 p-4 sm:grid-cols-2">
                    {filteredGroups.map((group) => (
                      <ResultPickerCard key={group._id} title={examTitle(group)} subtitle={examDateRange(group)} icon={Calendar} onClick={() => chooseExam(group)} tags={<ExamTags group={group} />} />
                    ))}
                  </div>
                )
                : (
                  <aside aria-label="Exam schedules" className="min-h-0 overflow-y-auto border-r border-slate-200 p-2">
                    <p className="px-2 pb-1.5 pt-1 text-[11px] font-bold uppercase tracking-wide text-slate-500">Exams</p>
                    {filteredGroups.map((group) => {
                      const active = group === activeGroup;
                      return (
                        <button key={group._id} type="button" aria-pressed={active} onClick={() => chooseExam(group)}
                          className={`relative mb-1 flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-left ${active ? 'bg-amber-50 ring-1 ring-inset ring-amber-200' : 'hover:bg-slate-50'}`}>
                          {active && <span className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-amber-500" />}
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-semibold text-slate-900">{examTitle(group)}</span>
                            <span className="block truncate text-[11px] text-slate-500">{formatDate(group.startDate)}</span>
                            <span className="mt-1 flex flex-wrap items-center gap-1"><ExamTags group={group} /></span>
                          </span>
                          <ChevronRight size={15} className="shrink-0 text-slate-400" aria-hidden="true" />
                        </button>
                      );
                    })}
                  </aside>
                )}
              {(!compact || showingCompactDetail) && (
                <section aria-label="Exam schedule details" className="min-h-0 min-w-0 overflow-y-auto p-4">
                  {compact && (
                    <button type="button" onClick={() => setShowDetail(false)} className="mb-3 inline-flex items-center gap-1 text-xs font-semibold text-amber-800">
                      <ChevronLeft size={16} aria-hidden="true" /> All exams
                    </button>
                  )}
                  <ExamScheduleCard
                    group={activeGroup}
                    downloading={downloadingGroupId === String(activeGroup._id)}
                    onDownload={() => handleDownload(activeGroup)}
                    onPractice={openSubjectPractice}
                  />
                </section>
              )}
            </div>
          )}
        </div>
      </div>

    {/* Mock Exam Modal */}
    <AnimatePresence>
      {mockExamOpen && (
        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm"
        >
          <Motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
          >
            {reviewExam ? (
              <WrongAnswerReviewView
                examId={reviewExam.examId}
                examTitle={reviewExam.examTitle}
                onClose={() => { setReviewExam(null); setMockExamOpen(null); }}
              />
            ) : (
              <MockExamView
                examId={mockExamOpen.examId}
                examTitle={mockExamOpen.examTitle}
                durationMinutes={mockExamOpen.durationMinutes}
                isMock={mockExamOpen.isMock}
                onClose={() => setMockExamOpen(null)}
                onFinished={(attempt, action) => {
                  if (action === 'review') {
                    setReviewExam({ examId: mockExamOpen.examId, examTitle: mockExamOpen.examTitle });
                  } else {
                    setMockExamOpen(null);
                  }
                }}
              />
            )}
          </Motion.div>
        </Motion.div>
      )}
    </AnimatePresence>
    </>
  );
};

export default StudentExamsView;
