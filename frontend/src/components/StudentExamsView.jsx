import React, { useEffect, useMemo, useState } from 'react';
import { Calendar, FileText, Loader2, Clock, CheckCircle2, Sparkles, Users, Search as SearchIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { useStudentDashboard } from './StudentDashboardContext';
import { fetchCachedJson } from '../utils/studentApiCache';
import { generateExamSchedulePdf, buildRoomLabel } from '../utils/examRoutinePdf';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const STUDENT_EXAMS_ENDPOINT = `${API_BASE}/api/exam/groups/student-schedule`;
const STUDENT_EXAMS_CACHE_TTL_MS = 2 * 60 * 1000;

const TERM_OPTIONS = ['all', 'Class Test', 'Unit Test', 'Monthly Test', 'Term 1', 'Term 2', 'Term 3', 'Half Yearly', 'Annual', 'Final'];
const STATUS_OPTIONS = ['all', 'scheduled', 'completed'];

const formatDate = (value) => {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  return `${day}/${month}/${year}`;
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

const SUBJECT_PALETTE = [
  { bg: 'bg-indigo-50', border: 'border-indigo-200', text: 'text-indigo-700', dot: 'bg-indigo-500' },
  { bg: 'bg-sky-50', border: 'border-sky-200', text: 'text-sky-700', dot: 'bg-sky-500' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', text: 'text-fuchsia-700', dot: 'bg-fuchsia-500' },
  { bg: 'bg-rose-50', border: 'border-rose-200', text: 'text-rose-700', dot: 'bg-rose-500' },
  { bg: 'bg-violet-50', border: 'border-violet-200', text: 'text-violet-700', dot: 'bg-violet-500' },
  { bg: 'bg-teal-50', border: 'border-teal-200', text: 'text-teal-700', dot: 'bg-teal-500' },
  { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-500' },
];

const getSubjectStyle = (name) => {
  const str = String(name || '');
  let hash = 0;
  for (let i = 0; i < str.length; i += 1) hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  return SUBJECT_PALETTE[hash % SUBJECT_PALETTE.length];
};

const StatTile = ({ icon, label, value, sub, grad, shadow }) => {
  const Icon = icon;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${grad} p-3.5 shadow-lg ${shadow} transition-transform hover:-translate-y-0.5 md:p-4`}>
      <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
      <div className="relative z-10">
        <div className="flex items-start justify-between">
          <p className="text-[11px] font-semibold text-white/80">{label}</p>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
            <Icon className="h-4 w-4 text-white" />
          </div>
        </div>
        <p className="mt-1.5 text-lg font-black text-white leading-tight truncate md:text-xl">{value}</p>
        {sub && <p className="mt-1 text-[11px] text-white/70 truncate">{sub}</p>}
      </div>
    </div>
  );
};

const StudentExamsView = () => {
  const { profile } = useStudentDashboard();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [termFilter, setTermFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [downloadingGroupId, setDownloadingGroupId] = useState('');

  useEffect(() => {
    const fetchStudentExamSchedule = async () => {
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Student') {
        setError('Please login as student.');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const { data } = await fetchCachedJson(STUDENT_EXAMS_ENDPOINT, {
          ttlMs: STUDENT_EXAMS_CACHE_TTL_MS,
          fetchOptions: {
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        });
        setGroups(Array.isArray(data) ? data : []);
      } catch (err) {
        setError(err.message || 'Failed to load exam schedule');
        setGroups([]);
      } finally {
        setLoading(false);
      }
    };
    fetchStudentExamSchedule();
  }, []);

  const filteredGroups = useMemo(() => {
    const q = search.trim().toLowerCase();
    return groups.filter((group) => {
      const groupStatus = String(group?.status || '').toLowerCase();
      const termMatches = termFilter === 'all' || String(group?.term || '') === termFilter;
      const statusMatches = statusFilter === 'all' || groupStatus === statusFilter;
      const queryMatches = !q
        || [group?.title, group?.term, group?.grade, group?.section]
          .some((value) => String(value || '').toLowerCase().includes(q));
      return termMatches && statusMatches && queryMatches;
    });
  }, [groups, search, statusFilter, termFilter]);

  const stats = useMemo(() => {
    const total = groups.length;
    const completed = groups.filter((g) => String(g?.status || '').toLowerCase() === 'completed').length;
    const scheduled = total - completed;
    const upcoming = groups
      .filter((g) => String(g?.status || '').toLowerCase() !== 'completed')
      .map((g) => ({ group: g, days: daysUntil(g?.startDate) }))
      .filter((entry) => entry.days !== null && entry.days >= 0)
      .sort((a, b) => a.days - b.days)[0];
    return { total, completed, scheduled, upcoming };
  }, [groups]);

  const pdfHeader = useMemo(() => ({
    schoolName: String(profile?.schoolName || '').trim(),
    schoolAddressLine: String(profile?.schoolAddress || '').trim(),
    logoUrl: String(profile?.schoolLogo || '').trim(),
  }), [profile?.schoolAddress, profile?.schoolLogo, profile?.schoolName]);

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

  return (
    <div className="min-h-screen bg-slate-50 space-y-5 p-4 pb-8 md:p-6">
      <div className="relative overflow-hidden rounded-2xl bg-linear-to-br from-indigo-500 via-indigo-600 to-purple-600 p-5 shadow-lg shadow-indigo-200/60 sm:p-6">
        <div className="pointer-events-none absolute -right-8 -top-8 h-36 w-36 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-10 left-1/3 h-28 w-28 rounded-full bg-white/10" />
        <div className="relative flex items-center gap-3">
          <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
            <Calendar className="h-5.5 w-5.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white sm:text-2xl">Exams</h1>
            <p className="text-sm text-white/80">View your exam schedule and download the routine</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatTile icon={FileText} label="Total Exams" value={stats.total} grad="from-blue-500 to-indigo-600" shadow="shadow-blue-200/60" />
        <StatTile icon={Clock} label="Scheduled" value={stats.scheduled} grad="from-amber-400 to-orange-500" shadow="shadow-amber-200/60" />
        <StatTile icon={CheckCircle2} label="Completed" value={stats.completed} grad="from-emerald-500 to-teal-600" shadow="shadow-emerald-200/60" />
        <StatTile
          icon={Sparkles}
          label="Next Exam"
          value={stats.upcoming ? (stats.upcoming.group.title || stats.upcoming.group.term || 'Exam') : 'None'}
          sub={stats.upcoming ? (stats.upcoming.days === 0 ? 'Starts today' : `In ${stats.upcoming.days} day${stats.upcoming.days === 1 ? '' : 's'}`) : 'No upcoming exam'}
          grad="from-purple-500 to-fuchsia-600"
          shadow="shadow-purple-200/60"
        />
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="relative md:col-span-2">
          <SearchIcon className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search exam"
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition placeholder:text-slate-400"
          />
        </div>
        <select
          value={termFilter}
          onChange={(e) => setTermFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
        >
          {TERM_OPTIONS.map((term) => (
            <option key={term} value={term}>{term === 'all' ? 'All Terms' : term}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-800 focus:border-indigo-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 transition"
        >
          {STATUS_OPTIONS.map((status) => (
            <option key={status} value={status}>{status === 'all' ? 'All Status' : status.charAt(0).toUpperCase() + status.slice(1)}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-sm p-8 text-sm text-slate-500 flex items-center gap-2">
          <Loader2 size={16} className="animate-spin" />
          Loading exam schedule...
        </div>
      ) : error ? (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 px-4 py-3 rounded-xl text-sm">
          {error}
        </div>
      ) : filteredGroups.length === 0 ? (
        <div className="bg-white rounded-2xl border border-dashed border-slate-200 shadow-sm p-8 text-sm text-slate-500 text-center">
          No exams found for your schedule.
        </div>
      ) : (
        <div className="space-y-4">
          {filteredGroups.map((group) => {
            const classLabel = group?.classId?.name || group?.grade || '—';
            const sectionLabel = group?.sectionId?.name || group?.section || '—';
            const statusLabel = String(group?.status || 'Scheduled');
            const normalizedStatus = statusLabel.toLowerCase();
            const isCompleted = normalizedStatus === 'completed';
            const statusClass = isCompleted
              ? 'bg-emerald-50 text-emerald-700'
              : 'bg-blue-50 text-blue-700';
            const days = daysUntil(group?.startDate);
            const subjects = group?.subjects || [];

            return (
              <div
                key={group._id}
                className={`overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-sm border-t-4 ${
                  isCompleted ? 'border-t-emerald-400' : 'border-t-indigo-400'
                }`}
              >
                <div className="p-4 md:p-5">
                  <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                    <div>
                      <span className="inline-flex items-center rounded-full bg-indigo-50 px-2.5 py-1 text-xs font-bold uppercase tracking-wide text-indigo-600">
                        {group?.term || 'Exam'}
                      </span>
                      <h3 className="mt-1.5 text-lg font-bold text-slate-900">{group?.title || 'Exam Schedule'}</h3>
                      <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-500">
                        <Users size={14} className="text-slate-400" />
                        Class {classLabel} · Section {sectionLabel}
                      </p>
                      <p className="mt-1 flex items-center gap-1.5 text-xs text-slate-400">
                        <Calendar size={12} />
                        {formatDate(group?.startDate)} - {formatDate(group?.endDate)}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${statusClass}`}>
                        {statusLabel}
                      </span>
                      {!isCompleted && days !== null && days >= 0 && (
                        <span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold text-amber-700">
                          {days === 0 ? 'Starts today' : `In ${days}d`}
                        </span>
                      )}
                      <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-bold text-slate-600">
                        {subjects.length} Subjects
                      </span>
                    </div>
                  </div>

                  <div className="mt-4">
                    <button
                      type="button"
                      onClick={() => handleDownload(group)}
                      disabled={downloadingGroupId === String(group._id)}
                      className="inline-flex items-center gap-2 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {downloadingGroupId === String(group._id) ? <Loader2 size={14} className="animate-spin" /> : <FileText size={14} />}
                      {downloadingGroupId === String(group._id) ? 'Preparing...' : 'Download Routine'}
                    </button>
                  </div>

                  <div className="mt-4 space-y-2">
                    {subjects.slice(0, 4).map((exam) => {
                      const subjectName = exam?.subjectId?.name || exam?.subject || exam?.title || 'Subject';
                      const style = getSubjectStyle(subjectName);
                      const room = buildRoomLabel(exam);
                      return (
                        <div
                          key={exam?._id || `${group._id}-${subjectName}`}
                          className={`flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 ${style.border} ${style.bg}`}
                        >
                          <div className="flex min-w-0 items-center gap-2.5">
                            <span className={`h-2 w-2 shrink-0 rounded-full ${style.dot}`} />
                            <p className={`truncate text-sm font-semibold ${style.text}`}>{subjectName}</p>
                          </div>
                          <div className="flex shrink-0 items-center gap-2 text-xs text-slate-500">
                            <span>{formatDate(exam?.date)}</span>
                            {room !== '—' && <span className="hidden sm:inline">· Room {room}</span>}
                          </div>
                        </div>
                      );
                    })}
                    {subjects.length > 4 && (
                      <p className="text-xs font-medium text-slate-400">+{subjects.length - 4} more subjects in this exam</p>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default StudentExamsView;
