import React, { useState, useEffect, useCallback } from 'react';
import {
  Bell,
  Search,
  Filter,
  Calendar,
  User,
  AlertCircle,
  Info,
  CheckCircle,
  Pin,
  Download,
  Share2,
  Bookmark,
  BookmarkCheck,
  File,
  FileText,
  Image as ImageIcon,
  Paperclip,
  Megaphone,
  Clock,
} from 'lucide-react';
import { fetchCachedJson } from '../utils/studentApiCache';

/* ─── Helpers ─── */
const looksLikeUserId = (value) => {
  const v = String(value || '').trim();
  if (!v) return false;
  return /^[A-Z0-9-]{6,}$/.test(v);
};

const resolvePriority = (notice) => (notice?.priority || 'general').toLowerCase();
const resolveCategory = (notice) => (notice?.category || notice?.audience || 'general').toLowerCase();
const resolveDate = (notice) => notice?.date || notice?.createdAt || notice?.updatedAt || null;
const resolveId = (notice) => notice?._id || notice?.id;
const shouldHideNoticeFromNoticeboard = (notice) => {
  const typeLabel = String(notice?.typeLabel || '').trim().toLowerCase();
  const type = String(notice?.type || '').trim().toLowerCase();
  const title = String(notice?.title || '').trim().toLowerCase();
  const message = String(notice?.message || '').trim().toLowerCase();

  if (typeLabel === 'attendance_marked') return true;
  if (type === 'class_note' || typeLabel === 'class note') return true;
  if (
    type === 'achievement' ||
    typeLabel === 'achievement' ||
    title.includes('achievement') ||
    message.includes('achievement')
  ) return true;

  return false;
};

const resolveAuthor = (notice) => {
  const rawName = notice?.createdByName || '';
  const safeName = rawName && !looksLikeUserId(rawName) ? rawName : '';
  if (notice?.createdByType === 'admin') return safeName ? `School Admin · ${safeName}` : 'School Admin';
  if (notice?.createdByType === 'teacher') return safeName ? `Teacher · ${safeName}` : 'Teacher';
  return notice?.author || 'School Administration';
};

const PRIORITY_META = {
  high:    { label: 'High',    badge: 'bg-red-100 text-red-700 border-red-200',       bar: 'bg-red-500',    icon: AlertCircle,  chip: 'bg-red-100 text-red-600' },
  medium:  { label: 'Medium',  badge: 'bg-amber-100 text-amber-700 border-amber-200', bar: 'bg-amber-400',  icon: Info,         chip: 'bg-amber-100 text-amber-600' },
  low:     { label: 'Low',     badge: 'bg-green-100 text-green-700 border-green-200', bar: 'bg-green-500',  icon: CheckCircle,  chip: 'bg-green-100 text-green-600' },
  general: { label: 'General', badge: 'bg-gray-100 text-gray-600 border-gray-200',    bar: 'bg-gray-300',   icon: Bell,         chip: 'bg-gray-100 text-gray-500' },
};

const CATEGORY_META = {
  academic:  'bg-blue-100 text-blue-700 border-blue-200',
  events:    'bg-purple-100 text-purple-700 border-purple-200',
  transport: 'bg-orange-100 text-orange-700 border-orange-200',
  general:   'bg-gray-100 text-gray-600 border-gray-200',
};

const getFileIcon = (type) => {
  if (type?.startsWith('image/')) return ImageIcon;
  if (type === 'application/pdf') return FileText;
  return File;
};

const formatFileSize = (bytes) => {
  if (!bytes) return '';
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(1)} MB`;
};

const formatDate = (raw) => {
  if (!raw) return 'Date TBA';
  return new Date(raw).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
};

const formatTime = (raw) => {
  if (!raw) return 'Time TBA';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return 'Time TBA';
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
};

/* ─── Skeleton ─── */
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
    <div className="flex">
      <div className="w-1.5 bg-gray-200 shrink-0" />
      <div className="flex-1 p-5 space-y-3">
        <div className="flex gap-2">
          <div className="h-5 w-16 bg-gray-200 rounded-full" />
          <div className="h-5 w-20 bg-gray-200 rounded-full" />
        </div>
        <div className="h-5 w-2/3 bg-gray-200 rounded-lg" />
        <div className="h-4 w-full bg-gray-100 rounded-lg" />
        <div className="h-4 w-4/5 bg-gray-100 rounded-lg" />
        <div className="flex gap-4 pt-2">
          <div className="h-4 w-24 bg-gray-100 rounded" />
          <div className="h-4 w-20 bg-gray-100 rounded" />
        </div>
      </div>
    </div>
  </div>
);

const isRecentNotice = (notice) => {
  const raw = resolveDate(notice);
  if (!raw) return false;
  const ageMs = Date.now() - new Date(raw).getTime();
  return ageMs >= 0 && ageMs <= 2 * 24 * 60 * 60 * 1000;
};

/* ─── Notice card ─── */
const NoticeCard = ({ notice, onOpen }) => {
  const priority = resolvePriority(notice);
  const category = resolveCategory(notice);
  const meta = PRIORITY_META[priority] || PRIORITY_META.general;
  const PriorityIcon = meta.icon;
  const author = resolveAuthor(notice);
  const displayDate = resolveDate(notice);
  const isNew = isRecentNotice(notice);
  const attachmentCount = Array.isArray(notice?.attachments) ? notice.attachments.length : 0;

  return (
    <button
      type="button"
      onClick={() => onOpen?.(notice)}
      className={`group flex w-full items-start gap-3 rounded-2xl border bg-white p-4 text-left shadow-sm transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${
        notice?.pinned ? 'border-amber-200 bg-amber-50/40' : 'border-gray-100'
      }`}
    >
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${meta.chip}`}>
        <PriorityIcon className="h-5 w-5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-1.5">
          {notice?.pinned && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              <Pin className="h-2.5 w-2.5" /> Pinned
            </span>
          )}
          {isNew && (
            <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              New
            </span>
          )}
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>
            {meta.label}
          </span>
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold capitalize ${CATEGORY_META[category] || CATEGORY_META.general}`}>
            {category}
          </span>
        </div>
        <p className="mt-1.5 truncate text-sm font-bold text-gray-900 group-hover:text-indigo-700">
          {notice?.title || 'Untitled Notice'}
        </p>
        {notice?.message && (
          <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-gray-500">{notice.message}</p>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-gray-400">
          <span className="inline-flex items-center gap-1">
            <User className="h-3 w-3" /> {author}
          </span>
          <span className="inline-flex items-center gap-1">
            <Calendar className="h-3 w-3" /> {formatDate(displayDate)}
          </span>
          {attachmentCount > 0 && (
            <span className="inline-flex items-center gap-1">
              <Paperclip className="h-3 w-3" /> {attachmentCount}
            </span>
          )}
        </div>
      </div>
    </button>
  );
};

const PRIORITY_BANNER = {
  high: 'from-red-500 to-rose-600',
  medium: 'from-amber-400 to-orange-500',
  low: 'from-green-500 to-emerald-600',
  general: 'from-gray-500 to-gray-600',
};

const NoticeDetailsView = ({ notice, onBack }) => {
  if (!notice) return null;
  const priority = resolvePriority(notice);
  const category = resolveCategory(notice);
  const meta = PRIORITY_META[priority] || PRIORITY_META.general;
  const PriorityIcon = meta.icon;
  const author = resolveAuthor(notice);
  const displayDate = resolveDate(notice);
  const subjectLabel = notice.subjectName || notice.subject || '';
  const attachments = Array.isArray(notice.attachments) ? notice.attachments : [];

  return (
    <div className="space-y-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-1.5 text-sm font-semibold text-indigo-600 hover:text-indigo-800"
      >
        ← Back to notices
      </button>

      <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
        <div className={`relative overflow-hidden bg-linear-to-br ${PRIORITY_BANNER[priority] || PRIORITY_BANNER.general} p-5 text-white sm:p-6`}>
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-white/10" />
          <div className="relative flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/20 backdrop-blur-sm">
              <PriorityIcon className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              {notice?.pinned && (
                <span className="mb-1.5 inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-0.5 text-[10px] font-bold">
                  <Pin className="h-2.5 w-2.5" /> Pinned Notice
                </span>
              )}
              <h2 className="text-lg font-bold leading-snug sm:text-xl">{notice.title || 'Untitled Notice'}</h2>
            </div>
          </div>
        </div>

        <div className="space-y-5 p-5 sm:p-6">
          {/* Meta grid: who posted it, date, time, priority, category */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Posted By</p>
              <p className="mt-1 flex items-center gap-1 truncate text-sm font-semibold text-gray-800">
                <User className="h-3.5 w-3.5 shrink-0 text-indigo-500" /> {author}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Date</p>
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-gray-800">
                <Calendar className="h-3.5 w-3.5 shrink-0 text-indigo-500" /> {formatDate(displayDate)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Time</p>
              <p className="mt-1 flex items-center gap-1 text-sm font-semibold text-gray-800">
                <Clock className="h-3.5 w-3.5 shrink-0 text-indigo-500" /> {formatTime(displayDate)}
              </p>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Priority</p>
              <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${meta.badge}`}>
                {meta.label}
              </span>
            </div>
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Category</p>
              <span className={`mt-1 inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold capitalize ${CATEGORY_META[category] || CATEGORY_META.general}`}>
                {category}
              </span>
            </div>
          </div>

          <p className="whitespace-pre-wrap text-gray-700 leading-relaxed">{notice.message || 'No details available.'}</p>
          {subjectLabel ? <p className="text-sm text-gray-500">Subject: {subjectLabel}</p> : null}

          {attachments.length > 0 && (
            <div className="space-y-2">
              <p className="text-sm font-semibold text-gray-700">Attachments</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {attachments.map((att, idx) => {
                  const FileIcon = getFileIcon(att?.type);
                  return (
                    <a
                      key={`${att?.url || idx}`}
                      href={att?.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 hover:bg-indigo-50 hover:border-indigo-200 transition-all"
                    >
                      <FileIcon className="w-4 h-4 text-indigo-600" />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-gray-800 truncate">{att?.name || `File ${idx + 1}`}</p>
                        {att?.size ? <p className="text-xs text-gray-500">{formatFileSize(att.size)}</p> : null}
                      </div>
                      <Download className="w-4 h-4 text-gray-500" />
                    </a>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ─── Stat tile ─── */
const StatCard = ({ icon, value, label, grad, shadow }) => {
  const IconComp = icon;
  return (
    <div className={`relative overflow-hidden rounded-2xl bg-linear-to-br ${grad} p-3.5 shadow-lg ${shadow} transition-transform hover:-translate-y-0.5 md:p-4`}>
      <div className="pointer-events-none absolute -right-3 -top-3 h-16 w-16 rounded-full bg-white/10" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
          <IconComp className="h-4.5 w-4.5 text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-lg font-black leading-tight text-white">{value}</p>
          <p className="text-[11px] font-semibold text-white/80">{label}</p>
        </div>
      </div>
    </div>
  );
};

/* ─── Main ─── */
const NoticeBoard = () => {
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
    .replace(/\/$/, '')
    .replace(/\/api$/, '');
  const NOTICEBOARD_NOTICES_ENDPOINT = `${API_BASE}/api/notifications/user`;
  const NOTICEBOARD_CLASS_TEACHER_ENDPOINT = `${API_BASE}/api/student/auth/class-teacher`;
  const NOTICEBOARD_NOTICES_CACHE_TTL_MS = 2 * 60 * 1000;
  const NOTICEBOARD_CLASS_TEACHER_CACHE_TTL_MS = 5 * 60 * 1000;

  const [searchQuery, setSearchQuery] = useState('');
  const [filterPriority, setFilterPriority] = useState('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [bookmarkedNotices] = useState([]);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [classTeacher, setClassTeacher] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [selectedNotice, setSelectedNotice] = useState(null);
  const [refreshing, setRefreshing] = useState(false);

  const loadNoticeBoardData = useCallback(async ({ forceRefresh = false } = {}) => {
      try {
        if (forceRefresh) setRefreshing(true);
        else setLoading(true);
        setError(null);
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');
        if (!token || userType !== 'Student') {
          setNotices([]);
          setClassTeacher(null);
          return;
        }

        const { data } = await fetchCachedJson(NOTICEBOARD_NOTICES_ENDPOINT, {
          ttlMs: NOTICEBOARD_NOTICES_CACHE_TTL_MS,
          forceRefresh,
          fetchOptions: {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          },
        });
        const incomingNotices = Array.isArray(data) ? data : [];
        setNotices(incomingNotices.filter((notice) => !shouldHideNoticeFromNoticeboard(notice)));
        setLastUpdated(new Date());

        setTeacherLoading(true);
        const { data: teacherData } = await fetchCachedJson(NOTICEBOARD_CLASS_TEACHER_ENDPOINT, {
          ttlMs: NOTICEBOARD_CLASS_TEACHER_CACHE_TTL_MS,
          forceRefresh,
          fetchOptions: {
            headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          },
        });
        setClassTeacher(teacherData?.teacher || null);
      } catch (err) {
        console.error('Failed to fetch notices:', err);
        setError(err.message);
      } finally {
        setLoading(false);
        setTeacherLoading(false);
        setRefreshing(false);
      }
  }, [
    NOTICEBOARD_CLASS_TEACHER_CACHE_TTL_MS,
    NOTICEBOARD_CLASS_TEACHER_ENDPOINT,
    NOTICEBOARD_NOTICES_CACHE_TTL_MS,
    NOTICEBOARD_NOTICES_ENDPOINT,
  ]);

  useEffect(() => {
    loadNoticeBoardData({ forceRefresh: false });
  }, [loadNoticeBoardData]);

  const filteredNotices = notices.filter(notice => {
    const q = searchQuery.toLowerCase();
    const matchesSearch =
      (notice.title || '').toLowerCase().includes(q) ||
      (notice.message || '').toLowerCase().includes(q) ||
      resolveAuthor(notice).toLowerCase().includes(q);
    const matchesPriority = filterPriority === 'all' || resolvePriority(notice) === filterPriority;
    const matchesCategory = filterCategory === 'all' || resolveCategory(notice) === filterCategory;
    return matchesSearch && matchesPriority && matchesCategory;
  });

  const sortedNotices = [...filteredNotices].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(resolveDate(b) || 0) - new Date(resolveDate(a) || 0);
  });

  const pinnedNotices = sortedNotices.filter((n) => Boolean(n.pinned));
  const otherNotices = sortedNotices.filter((n) => !n.pinned);

  const hasActiveFilters = filterPriority !== 'all' || filterCategory !== 'all' || searchQuery;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {selectedNotice ? (
        <NoticeDetailsView notice={selectedNotice} onBack={() => setSelectedNotice(null)} />
      ) : (
      <>
      {/* Header */}
      <div className="relative bg-gradient-to-br from-indigo-600 via-violet-600 to-purple-700 rounded-2xl p-6 md:p-8 text-white mb-6 overflow-hidden">
        <div className="absolute -top-10 -right-10 w-48 h-48 bg-white/10 rounded-full pointer-events-none" />
        <div className="absolute -bottom-12 -left-6 w-36 h-36 bg-white/5 rounded-full pointer-events-none" />
        <div className="flex flex-col justify-center items-center md:items-stretch md:justify-between gap-4">
        <div className="relative flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 rounded-full px-3 py-1 text-xs font-medium mb-3">
              <Megaphone className="w-3.5 h-3.5" />
              School Announcements
            </div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">Notice Board</h1>
            <p className="text-indigo-200 text-sm mt-1">
              Stay updated with the latest school notices &amp; announcements
            </p>
            {lastUpdated && !loading && (
              <p className="text-indigo-300 text-xs mt-2">
                Last updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
              </p>
            )}
          </div>

          <div className="bg-white/15 backdrop-blur-sm rounded-2xl px-5 py-4 text-center min-w-[90px] shrink-0">
            <div className="text-3xl font-bold">{loading ? '—' : notices.length}</div>
            <div className="text-xs text-indigo-200 mt-0.5">Total</div>
            <button
              type="button"
              onClick={() => loadNoticeBoardData({ forceRefresh: true })}
              disabled={refreshing || loading}
              className="mt-2 inline-flex items-center rounded-lg border border-white/30 bg-white/10 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-white/20 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Class teacher */}
        <div className="relative mt-5">
          <div className="inline-flex items-center gap-2 bg-white/10 border border-white/20 rounded-xl px-4 py-2 text-sm">
            <User className="w-4 h-4 text-indigo-200" />
            {teacherLoading ? (
              <span className="text-indigo-200">Loading class teacher…</span>
            ) : classTeacher ? (
              <span>
                Class Teacher:{' '}
                <span className="font-semibold">{classTeacher.name}</span>
                {classTeacher.subject ? ` · ${classTeacher.subject}` : ''}
                {classTeacher.className ? ` · ${classTeacher.className}` : ''}
                {classTeacher.sectionName ? `-${classTeacher.sectionName}` : ''}
              </span>
            ) : (
              <span className="text-indigo-200">Class Teacher: Not assigned</span>
            )}
          </div>
        </div>
</div>
        {error && (
          <div className="relative mt-4 flex items-center gap-2 bg-red-500/20 border border-red-400/30 text-white text-sm rounded-xl px-4 py-3">
            <AlertCircle className="w-4 h-4 shrink-0" />
            {error}
          </div>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <StatCard icon={Bell} value={loading ? '—' : notices.length} label="All Notices" grad="from-indigo-500 to-blue-600" shadow="shadow-indigo-200/60" />
        <StatCard icon={AlertCircle} value={loading ? '—' : notices.filter(n => resolvePriority(n) === 'high').length} label="High Priority" grad="from-rose-500 to-red-600" shadow="shadow-rose-200/60" />
        <StatCard icon={Pin} value={loading ? '—' : notices.filter(n => Boolean(n.pinned)).length} label="Pinned" grad="from-amber-400 to-orange-500" shadow="shadow-amber-200/60" />
        <StatCard icon={Bookmark} value={bookmarkedNotices.length} label="Bookmarked" grad="from-purple-500 to-fuchsia-600" shadow="shadow-purple-200/60" />
      </div>

      {/* Search & Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="relative mb-3">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search notices…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 text-sm border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-400 focus:border-transparent outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-1.5 mb-2">
          <Filter className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-400">Priority</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['all', 'high', 'medium', 'low'].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setFilterPriority(p)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold capitalize transition-all ${
                filterPriority === p
                  ? 'border-indigo-600 bg-indigo-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {p === 'all' ? 'All' : p}
            </button>
          ))}
        </div>

        <div className="mt-3 flex items-center gap-1.5 mb-2">
          <Megaphone className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-semibold text-gray-400">Category</span>
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {['all', 'academic', 'events', 'transport', 'general'].map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setFilterCategory(c)}
              className={`shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-bold capitalize transition-all ${
                filterCategory === c
                  ? 'border-violet-600 bg-violet-600 text-white shadow-sm'
                  : 'border-gray-200 bg-white text-gray-500 hover:bg-gray-50'
              }`}
            >
              {c === 'all' ? 'All' : c}
            </button>
          ))}
        </div>

        {/* Active filter chips */}
        {hasActiveFilters && (
          <div className="flex flex-wrap gap-2 mt-3 pt-3 border-t border-gray-100">
            <span className="text-xs text-gray-400 self-center">Active:</span>
            {searchQuery && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full border border-indigo-200">
                "{searchQuery}"
                <button onClick={() => setSearchQuery('')} className="ml-0.5 hover:text-indigo-900 font-bold">×</button>
              </span>
            )}
            {filterPriority !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full border border-indigo-200 capitalize">
                {filterPriority} priority
                <button onClick={() => setFilterPriority('all')} className="ml-0.5 hover:text-indigo-900 font-bold">×</button>
              </span>
            )}
            {filterCategory !== 'all' && (
              <span className="inline-flex items-center gap-1 px-2.5 py-1 bg-indigo-50 text-indigo-700 text-xs rounded-full border border-indigo-200 capitalize">
                {filterCategory}
                <button onClick={() => setFilterCategory('all')} className="ml-0.5 hover:text-indigo-900 font-bold">×</button>
              </span>
            )}
          </div>
        )}
      </div>

      {/* Notices */}
      <div className="space-y-4">
        {loading ? (
          <><SkeletonCard /><SkeletonCard /><SkeletonCard /></>
        ) : sortedNotices.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center">
            <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-8 h-8 text-gray-300" />
            </div>
            <h3 className="text-base font-semibold text-gray-700 mb-1">No notices found</h3>
            <p className="text-sm text-gray-400">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          <>
            <p className="text-xs text-gray-400 px-1">
              Showing {sortedNotices.length} of {notices.length} notice{notices.length !== 1 ? 's' : ''}
            </p>

            {pinnedNotices.length > 0 && (
              <div className="space-y-2">
                <h2 className="flex items-center gap-1.5 px-1 text-xs font-bold uppercase tracking-wide text-amber-600">
                  <Pin className="h-3.5 w-3.5" /> Pinned
                </h2>
                {pinnedNotices.map((notice) => (
                  <NoticeCard key={resolveId(notice)} notice={notice} onOpen={setSelectedNotice} />
                ))}
              </div>
            )}

            {otherNotices.length > 0 && (
              <div className="space-y-2">
                {pinnedNotices.length > 0 && (
                  <h2 className="px-1 text-xs font-bold uppercase tracking-wide text-gray-400">All Notices</h2>
                )}
                {otherNotices.map((notice) => (
                  <NoticeCard key={resolveId(notice)} notice={notice} onOpen={setSelectedNotice} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
      </>
      )}
    </div>
  );
};

export default NoticeBoard;
