import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import toast from 'react-hot-toast';
import {
  Bell, Search, Filter, Calendar, User, AlertCircle, Pin, Download, Share2,
  MessageCircle, Mail, Phone, Copy, File, FileText, FileSpreadsheet,
  Image as ImageIcon, Paperclip, Megaphone, Clock, ArrowRight, ArrowLeft,
  ChevronRight, ChevronLeft, LayoutGrid, List as ListIcon, Hash, Tag, Flag,
  Users, RefreshCw, Info,
} from 'lucide-react';
import { fetchCachedJson } from '../utils/studentApiCache';
import { useStudentDashboard } from './StudentDashboardContext';
import { generateExamSchedulePdf } from '../utils/examRoutinePdf';
import ExamRoutineTable from './ExamRoutineTable';
import {
  CATEGORY_ORDER, CATEGORY_META, PRIORITY_META, DEPT_FALLBACK,
  getDisplayCategory, isNewNotice, isPinnedNotice, formatNoticeDate,
  formatNoticeTime, formatNoticeDateTime, getNoticeDisplayId, formatFileSize,
  getAttachmentMeta, getVisibleToLabel,
} from '../utils/noticeDisplay';

/* ─── Helpers ─── */
const looksLikeUserId = (value) => {
  const v = String(value || '').trim();
  if (!v) return false;
  return /^[A-Z0-9-]{6,}$/.test(v);
};

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

const isExamNotice = (notice) => {
  const type = String(notice?.type || '').trim().toLowerCase();
  const entityType = String(notice?.relatedEntity?.entityType || '').trim().toLowerCase();
  return type === 'exam' || entityType === 'exam';
};

const findExamGroupForNotice = (notice, examGroups) => {
  const examId = String(notice?.relatedEntity?.entityId || '').trim();
  if (!examId || !Array.isArray(examGroups)) return null;
  return examGroups.find((group) =>
    (group?.subjects || []).some((subject) => String(subject?._id || '') === examId)
  ) || null;
};

const getCreator = (notice) => {
  const rawName = notice?.createdByName || '';
  const safeName = rawName && !looksLikeUserId(rawName) ? rawName : '';
  if (notice?.createdByType === 'admin') return safeName ? `Admin · ${safeName}` : 'Admin';
  if (notice?.createdByType === 'teacher') return safeName ? `Teacher · ${safeName}` : 'Teacher';
  if (safeName) return safeName;
  return DEPT_FALLBACK[getDisplayCategory(notice)] || 'School Administration';
};

const getFileIcon = (kind) => {
  if (kind === 'image') return ImageIcon;
  if (kind === 'sheet') return FileSpreadsheet;
  if (kind === 'pdf' || kind === 'doc') return FileText;
  return File;
};

const NOTICE_PAGE_SIZE = 5;

/* ─── Skeleton ─── */
const SkeletonCard = () => (
  <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden animate-pulse">
    <div className="flex items-center gap-4 p-5">
      <div className="w-10 h-10 bg-gray-200 rounded-xl shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-3 w-16 bg-gray-200 rounded" />
        <div className="h-4 w-2/3 bg-gray-200 rounded-lg" />
        <div className="h-3 w-full bg-gray-100 rounded-lg" />
      </div>
    </div>
  </div>
);

/* ─── Notice detail (inline) ─── */
const NoticeDetailsView = ({
  notice, onBack, examGroup, onDownloadRoutine, downloadingRoutine, onViewExams,
  onPrev, onNext, hasPrev, hasNext,
}) => {
  if (!notice) return null;
  const displayCategory = getDisplayCategory(notice);
  const meta = CATEGORY_META[displayCategory];
  const Icon = meta.icon;
  const priorityMeta = PRIORITY_META[notice.priority || 'medium'];
  const pinned = isPinnedNotice(notice);
  const fresh = isNewNotice(notice);
  const creator = getCreator(notice);
  const displayDate = resolveDate(notice);
  const subjectLabel = notice.subjectName || notice.subject || '';
  const attachments = Array.isArray(notice.attachments) ? notice.attachments : [];
  const showExamRoutine = isExamNotice(notice);

  return (
    <div className="space-y-6">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to notices
      </button>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <div className="flex items-start justify-between mb-3">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-bold tracking-wide uppercase ${meta.badge}`}>
                {meta.label}
              </span>
              {pinned && (
                <span className="inline-flex items-center gap-1 rounded-full bg-indigo-600 text-white px-2.5 py-1 text-[11px] font-bold">
                  <Pin className="h-3 w-3" />
                  PINNED
                </span>
              )}
            </div>

            <div className="flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">{notice.title || 'Untitled Notice'}</h1>
                {/* <p className="mt-2 text-sm text-slate-500 leading-relaxed">{notice.message}</p> */}

                <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                  <span className="flex items-center gap-1.5">
                    <Calendar className="h-3.5 w-3.5" />
                    {formatNoticeDate(displayDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5" />
                    {formatNoticeTime(displayDate)}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5" />
                    <span className="text-slate-600 font-medium">{creator}</span>
                  </span>
                  {fresh && (
                    <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>New</span>
                  )}
                </div>
              </div>

              <div className={`hidden sm:flex w-20 h-20 rounded-2xl items-center justify-center shrink-0 ${meta.iconBg}`}>
                <Icon className={`h-10 w-10 ${meta.iconColor}`} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
              <Info className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900">Notice Details</h2>
            </div>
            <div className="px-5 py-5 space-y-4">
              {showExamRoutine && (
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
                  <div className="mb-2 flex items-center gap-2">
                    <Calendar className="h-4 w-4 text-indigo-600" />
                    <p className="text-sm font-semibold text-indigo-900">Exam Routine</p>
                  </div>
                  <p className="mb-3 text-xs text-indigo-700/80">
                    {examGroup
                      ? 'Download the full exam routine below, or see all your exams on the Exams page.'
                      : 'View the full exam schedule on the Exams page.'}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {examGroup && (
                      <button
                        type="button"
                        onClick={onDownloadRoutine}
                        disabled={downloadingRoutine}
                        className="inline-flex items-center gap-1.5 rounded-full bg-linear-to-r from-indigo-500 to-purple-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        <Download className="h-3.5 w-3.5" />
                        {downloadingRoutine ? 'Preparing…' : 'Download Routine PDF'}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={onViewExams}
                      className="inline-flex items-center gap-1.5 rounded-full border border-indigo-200 bg-white px-3.5 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-50"
                    >
                      See Details <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              )}

              <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{notice.message || 'No details available.'}</p>
              {subjectLabel ? <p className="text-xs text-slate-400">Subject: {subjectLabel}</p> : null}
              <ExamRoutineTable rows={notice.examRoutine} />
            </div>

            <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-slate-100">
              <button
                type="button"
                disabled={!hasPrev}
                onClick={onPrev}
                title="Previous notice"
                className="p-2.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <button
                type="button"
                disabled={!hasNext}
                onClick={onNext}
                title="Next notice"
                className="p-2.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Hash className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900">Notice Information</h2>
            </div>
            <div className="space-y-4">
              <InfoRow icon={Hash} label="Notice ID" value={getNoticeDisplayId(notice)} />
              <InfoRow icon={Tag} label="Category">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${meta.badge}`}>
                  {meta.label}
                </span>
              </InfoRow>
              <InfoRow icon={Flag} label="Priority">
                <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${priorityMeta.badge}`}>
                  {priorityMeta.label}
                </span>
              </InfoRow>
              <InfoRow icon={Users} label="Visible To" value={getVisibleToLabel(notice)} />
              <InfoRow icon={Calendar} label="Published On" value={formatNoticeDateTime(displayDate)} />
              <InfoRow icon={RefreshCw} label="Last Updated" value={formatNoticeDateTime(notice.updatedAt || displayDate)} />
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Paperclip className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900">Attachments ({attachments.length})</h2>
            </div>
            {attachments.length === 0 ? (
              <p className="text-xs text-slate-400 text-center py-4">No attachment is added</p>
            ) : (
              <div className="space-y-2">
                {attachments.map((att, idx) => {
                  const fileMeta = getAttachmentMeta(att);
                  const FileIcon = getFileIcon(fileMeta.kind);
                  return (
                    <a
                      key={`${att?.url || idx}`}
                      href={att?.url || '#'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-slate-100 transition"
                    >
                      <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${fileMeta.color}`}>
                        <FileIcon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-slate-700 truncate">{att?.name || `Attachment ${idx + 1}`}</p>
                        <p className="text-[11px] text-slate-400">{fileMeta.label}{att?.size ? ` · ${formatFileSize(att.size)}` : ''}</p>
                      </span>
                      <Download className="h-4 w-4 text-slate-400 shrink-0" />
                    </a>
                  );
                })}
              </div>
            )}
          </div>

          {/* <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
            <div className="flex items-center gap-2 mb-1">
              <Share2 className="h-4 w-4 text-indigo-500" />
              <h2 className="text-sm font-semibold text-slate-900">Share Notice</h2>
            </div>
            <p className="text-xs text-slate-400 mb-4">Share this notice with others</p>
            <div className="grid grid-cols-4 gap-2 text-center">
              <ShareButton icon={MessageCircle} label="WhatsApp" color="bg-emerald-500" onClick={() => onShare('whatsapp', notice)} />
              <ShareButton icon={Mail} label="Email" color="bg-blue-500" onClick={() => onShare('email', notice)} />
              <ShareButton icon={Phone} label="SMS" color="bg-amber-500" onClick={() => onShare('sms', notice)} />
              <ShareButton icon={Copy} label="Copy Link" color="bg-purple-500" onClick={() => onShare('copy', notice)} />
            </div>
          </div> */}
        </div>
      </div>
    </div>
  );
};

const InfoRow = (props) => {
  const { icon, label, value, children } = props;
  const Icon = icon;
  return (
    <div className="flex items-start gap-2.5">
      <Icon className="h-3.5 w-3.5 text-slate-300 mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
        {children || <p className="text-sm text-slate-700 mt-0.5">{value || '—'}</p>}
      </div>
    </div>
  );
};

const ShareButton = (props) => {
  const { icon, label, color, onClick } = props;
  const Icon = icon;
  return (
    <button type="button" onClick={onClick} className="flex flex-col items-center gap-1.5 group">
      <span className={`w-11 h-11 rounded-full flex items-center justify-center text-white ${color} group-hover:opacity-90 transition shadow-sm`}>
        <Icon className="h-4 w-4" />
      </span>
      <span className="text-[11px] text-slate-500">{label}</span>
    </button>
  );
};

/* ─── Main ─── */
const NoticeBoard = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { profile } = useStudentDashboard();
  const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000')
    .replace(/\/$/, '')
    .replace(/\/api$/, '');
  const NOTICEBOARD_NOTICES_ENDPOINT = `${API_BASE}/api/notifications/user`;
  const NOTICEBOARD_CLASS_TEACHER_ENDPOINT = `${API_BASE}/api/student/auth/class-teacher`;
  const NOTICEBOARD_EXAM_GROUPS_ENDPOINT = `${API_BASE}/api/exam/groups/student-schedule`;
  const NOTICEBOARD_NOTICES_CACHE_TTL_MS = 2 * 60 * 1000;
  const NOTICEBOARD_CLASS_TEACHER_CACHE_TTL_MS = 5 * 60 * 1000;
  const NOTICEBOARD_EXAM_GROUPS_CACHE_TTL_MS = 2 * 60 * 1000;

  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchBar, setShowSearchBar] = useState(false);
  const [activeCategory, setActiveCategory] = useState('all');
  const [sortBy, setSortBy] = useState('newest');
  const [showAllPinned, setShowAllPinned] = useState(false);
  const [listLayout, setListLayout] = useState('list');
  const [currentPage, setCurrentPage] = useState(1);
  const [notices, setNotices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [classTeacher, setClassTeacher] = useState(null);
  const [teacherLoading, setTeacherLoading] = useState(false);
  const [selectedNoticeId, setSelectedNoticeId] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [examGroups, setExamGroups] = useState([]);
  const [downloadingExamId, setDownloadingExamId] = useState('');

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

        if (incomingNotices.some((notice) => isExamNotice(notice))) {
          const { data: examData } = await fetchCachedJson(NOTICEBOARD_EXAM_GROUPS_ENDPOINT, {
            ttlMs: NOTICEBOARD_EXAM_GROUPS_CACHE_TTL_MS,
            forceRefresh,
            fetchOptions: {
              headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
            },
          });
          setExamGroups(Array.isArray(examData) ? examData : []);
        }
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
    NOTICEBOARD_EXAM_GROUPS_CACHE_TTL_MS,
    NOTICEBOARD_EXAM_GROUPS_ENDPOINT,
    NOTICEBOARD_NOTICES_CACHE_TTL_MS,
    NOTICEBOARD_NOTICES_ENDPOINT,
  ]);

  useEffect(() => {
    loadNoticeBoardData({ forceRefresh: false });
  }, [loadNoticeBoardData]);

  // Deep link support: notifications route here as ?notice=<id> so clicking
  // one opens that specific notice instead of just landing on the board.
  useEffect(() => {
    const noticeIdParam = searchParams.get('notice');
    if (!noticeIdParam || !notices.length) return;
    if (notices.some((n) => String(resolveId(n)) === String(noticeIdParam))) {
      setSelectedNoticeId(noticeIdParam);
    }
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete('notice');
      return next;
    }, { replace: true });
  }, [notices, searchParams, setSearchParams]);

  const searchedNotices = useMemo(() => {
    if (!searchQuery.trim()) return notices;
    const q = searchQuery.toLowerCase();
    return notices.filter((notice) =>
      (notice.title || '').toLowerCase().includes(q) ||
      (notice.message || '').toLowerCase().includes(q) ||
      getCreator(notice).toLowerCase().includes(q)
    );
  }, [notices, searchQuery]);

  const noticesWithMeta = useMemo(
    () => searchedNotices.map((n) => ({ ...n, _displayCategory: getDisplayCategory(n) })),
    [searchedNotices]
  );

  const categoryCounts = useMemo(() => {
    const counts = { all: noticesWithMeta.length };
    CATEGORY_ORDER.slice(1).forEach((key) => { counts[key] = 0; });
    noticesWithMeta.forEach((n) => { counts[n._displayCategory] = (counts[n._displayCategory] || 0) + 1; });
    return counts;
  }, [noticesWithMeta]);

  const categoryFilteredNotices = useMemo(() => {
    if (activeCategory === 'all') return noticesWithMeta;
    return noticesWithMeta.filter((n) => n._displayCategory === activeCategory);
  }, [noticesWithMeta, activeCategory]);

  const sortedNotices = useMemo(() => {
    const arr = [...categoryFilteredNotices];
    if (sortBy === 'oldest') {
      arr.sort((a, b) => new Date(resolveDate(a) || 0) - new Date(resolveDate(b) || 0));
    } else if (sortBy === 'priority') {
      const rank = { high: 0, medium: 1, low: 2 };
      arr.sort((a, b) => (rank[a.priority] ?? 1) - (rank[b.priority] ?? 1) || new Date(resolveDate(b) || 0) - new Date(resolveDate(a) || 0));
    } else {
      arr.sort((a, b) => new Date(resolveDate(b) || 0) - new Date(resolveDate(a) || 0));
    }
    return arr;
  }, [categoryFilteredNotices, sortBy]);

  const pinnedNotices = useMemo(() => {
    const highPriority = [...noticesWithMeta]
      .filter((n) => isPinnedNotice(n))
      .sort((a, b) => new Date(resolveDate(b) || 0) - new Date(resolveDate(a) || 0));
    const source = highPriority.length ? highPriority : [...noticesWithMeta].sort((a, b) => new Date(resolveDate(b) || 0) - new Date(resolveDate(a) || 0));
    return source.slice(0, showAllPinned ? 6 : 3);
  }, [noticesWithMeta, showAllPinned]);

  const totalPages = Math.max(1, Math.ceil(sortedNotices.length / NOTICE_PAGE_SIZE));

  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, sortBy, searchQuery]);

  const paginatedNotices = useMemo(() => {
    const start = (currentPage - 1) * NOTICE_PAGE_SIZE;
    return sortedNotices.slice(start, start + NOTICE_PAGE_SIZE);
  }, [sortedNotices, currentPage]);

  const allSortedByDate = useMemo(
    () => [...noticesWithMeta].sort((a, b) => new Date(resolveDate(a) || 0) - new Date(resolveDate(b) || 0)),
    [noticesWithMeta]
  );
  const selectedIndex = allSortedByDate.findIndex((n) => String(resolveId(n)) === String(selectedNoticeId));
  const selectedNotice = selectedIndex >= 0 ? allSortedByDate[selectedIndex] : null;
  const prevNotice = selectedIndex > 0 ? allSortedByDate[selectedIndex - 1] : null;
  const nextNotice = selectedIndex >= 0 && selectedIndex < allSortedByDate.length - 1 ? allSortedByDate[selectedIndex + 1] : null;

  const pdfHeader = useMemo(() => ({
    schoolName: String(profile?.schoolName || '').trim(),
    schoolAddressLine: String(profile?.schoolAddress || '').trim(),
    logoUrl: String(profile?.schoolLogo || '').trim(),
  }), [profile?.schoolAddress, profile?.schoolLogo, profile?.schoolName]);

  const matchedExamGroup = selectedNotice && isExamNotice(selectedNotice)
    ? findExamGroupForNotice(selectedNotice, examGroups)
    : null;

  const handleDownloadRoutine = async () => {
    if (!matchedExamGroup?._id) return;
    setDownloadingExamId(String(matchedExamGroup._id));
    try {
      await generateExamSchedulePdf(matchedExamGroup, pdfHeader);
      toast.success('Exam routine downloaded');
    } catch (err) {
      toast.error(err.message || 'Failed to download exam routine');
    } finally {
      setDownloadingExamId('');
    }
  };

  const handleShare = (channel, notice) => {
    const boardUrl = `${window.location.origin}/student/noticeboard`;
    const shareText = `${notice.title}\n\n${notice.message}\n\n${boardUrl}`;
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
    } else if (channel === 'email') {
      window.location.href = `mailto:?subject=${encodeURIComponent(notice.title)}&body=${encodeURIComponent(shareText)}`;
    } else if (channel === 'sms') {
      window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
    } else if (channel === 'copy') {
      navigator.clipboard?.writeText(boardUrl)
        .then(() => toast.success('Notice board link copied'))
        .catch(() => toast.error('Unable to copy link'));
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-6">
      {selectedNotice ? (
        <NoticeDetailsView
          notice={selectedNotice}
          onBack={() => setSelectedNoticeId(null)}
          examGroup={matchedExamGroup}
          onDownloadRoutine={handleDownloadRoutine}
          downloadingRoutine={downloadingExamId === String(matchedExamGroup?._id || '')}
          onViewExams={() => navigate('/student/exams')}
          onPrev={() => prevNotice && setSelectedNoticeId(resolveId(prevNotice))}
          onNext={() => nextNotice && setSelectedNoticeId(resolveId(nextNotice))}
          hasPrev={Boolean(prevNotice)}
          hasNext={Boolean(nextNotice)}
          onShare={handleShare}
        />
      ) : (
        <div className="space-y-6">
          {/* Header */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-5 py-5">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-11 h-11 rounded-2xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Megaphone className="h-5 w-5 text-indigo-600" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-slate-900 tracking-tight">Notice Board</h1>
                  <p className="text-sm text-slate-400 mt-0.5">Stay updated with all important announcements and notices.</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => loadNoticeBoardData({ forceRefresh: true })}
                  disabled={refreshing || loading}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3.5 py-2.5 text-sm font-semibold text-slate-500 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition"
                >
                  <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
                  {refreshing ? 'Refreshing…' : 'Refresh'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSearchBar((v) => !v)}
                  className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition shadow-sm"
                >
                  <Filter className="h-4 w-4" />
                  Filter &amp; Search
                </button>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              <div className="inline-flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3.5 py-2 text-xs">
                <User className="h-3.5 w-3.5 text-indigo-400" />
                {teacherLoading ? (
                  <span className="text-slate-400">Loading class teacher…</span>
                ) : classTeacher ? (
                  <span className="text-slate-500">
                    Class Teacher:{' '}
                    <span className="font-semibold text-slate-700">{classTeacher.name}</span>
                    {classTeacher.subject ? ` · ${classTeacher.subject}` : ''}
                    {classTeacher.className ? ` · ${classTeacher.className}` : ''}
                    {classTeacher.sectionName ? `-${classTeacher.sectionName}` : ''}
                  </span>
                ) : (
                  <span className="text-slate-400">Class Teacher: Not assigned</span>
                )}
              </div>
              {lastUpdated && !loading && (
                <span className="text-[11px] text-slate-300">
                  Last updated {lastUpdated.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                </span>
              )}
            </div>

            {error && (
              <div className="mt-3 flex items-center gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-xl px-4 py-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {showSearchBar && (
              <div className="mt-4 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  type="text"
                  autoFocus
                  placeholder="Search notices…"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-200 rounded-xl bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                />
              </div>
            )}
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORY_ORDER.map((key) => {
              const meta = CATEGORY_META[key];
              const Icon = meta.icon;
              const active = activeCategory === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveCategory(key)}
                  className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-sm font-semibold border transition ${
                    active
                      ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center ${active ? 'bg-white/20' : meta.iconBg || 'bg-indigo-50'}`}>
                    <Icon className={`h-3 w-3 ${active ? 'text-white' : meta.iconColor || 'text-indigo-500'}`} />
                  </span>
                  {meta.label}
                  <span className={`rounded-full px-1.5 py-0.5 text-[11px] font-bold ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>
                    {categoryCounts[key] || 0}
                  </span>
                </button>
              );
            })}
          </div>

          {loading ? (
            <div className="space-y-3">
              <SkeletonCard /><SkeletonCard /><SkeletonCard />
            </div>
          ) : (
            <>
              {/* Pinned notices */}
              {pinnedNotices.length > 0 && (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center gap-2">
                      <Pin className="h-4 w-4 text-indigo-500" />
                      <h2 className="text-sm font-semibold text-slate-900">Pinned Notices</h2>
                    </div>
                    {noticesWithMeta.filter((n) => isPinnedNotice(n)).length > 3 && (
                      <button
                        type="button"
                        onClick={() => setShowAllPinned((v) => !v)}
                        className="text-xs font-semibold text-indigo-600 hover:text-indigo-700"
                      >
                        {showAllPinned ? 'Show Less' : 'View All Pinned'}
                      </button>
                    )}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {pinnedNotices.map((notice) => {
                      const meta = CATEGORY_META[notice._displayCategory];
                      const Icon = meta.icon;
                      const creator = getCreator(notice);
                      const fresh = isNewNotice(notice);
                      return (
                        <div
                          key={resolveId(notice)}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedNoticeId(resolveId(notice))}
                          onKeyDown={(e) => { if (e.key === 'Enter') setSelectedNoticeId(resolveId(notice)); }}
                          className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition cursor-pointer"
                        >
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                              <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.iconBg}`}>
                                <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                              </span>
                              <span className={`text-xs font-semibold ${meta.text}`}>{meta.label}</span>
                            </div>
                            <span className="text-[10px] font-bold tracking-wide text-white bg-indigo-600 rounded-full px-2 py-0.5">
                              PINNED
                            </span>
                          </div>
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm font-semibold text-slate-900 leading-snug">{notice.title}</h3>
                            <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-0.5" />
                          </div>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">{notice.message}</p>
                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatNoticeDate(resolveDate(notice))}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {creator}
                              </span>
                            </div>
                            {fresh && (
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>New</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* All notices */}
              <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between gap-3">
                  <h2 className="text-base font-semibold text-slate-900">All Notices</h2>
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="appearance-none pl-3 pr-8 py-2 text-sm border border-slate-200 rounded-xl bg-white text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-400 transition"
                    >
                      <option value="newest">Sort by: Newest First</option>
                      <option value="oldest">Sort by: Oldest First</option>
                      <option value="priority">Sort by: Priority</option>
                    </select>
                    <div className="hidden sm:flex items-center rounded-xl border border-slate-200 overflow-hidden">
                      <button
                        type="button"
                        onClick={() => setListLayout('list')}
                        className={`p-2 transition ${listLayout === 'list' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                        title="List view"
                      >
                        <ListIcon className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setListLayout('grid')}
                        className={`p-2 transition ${listLayout === 'grid' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-50'}`}
                        title="Grid view"
                      >
                        <LayoutGrid className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>

                {sortedNotices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
                      <Bell className="h-7 w-7 text-indigo-200" />
                    </div>
                    <p className="text-sm font-medium text-slate-400">No notices found</p>
                    <p className="text-xs text-slate-300">Try adjusting your search or filter criteria</p>
                  </div>
                ) : listLayout === 'list' ? (
                  <div className="divide-y divide-slate-100">
                    {paginatedNotices.map((notice) => {
                      const meta = CATEGORY_META[notice._displayCategory];
                      const Icon = meta.icon;
                      const creator = getCreator(notice);
                      const fresh = isNewNotice(notice);
                      return (
                        <div
                          key={resolveId(notice)}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedNoticeId(resolveId(notice))}
                          onKeyDown={(e) => { if (e.key === 'Enter') setSelectedNoticeId(resolveId(notice)); }}
                          className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/80 transition-colors cursor-pointer"
                        >
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${meta.iconBg}`}>
                            <Icon className={`h-5 w-5 ${meta.iconColor}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-semibold ${meta.text}`}>{meta.label}</p>
                            <p className="text-sm font-semibold text-slate-900 truncate">{notice.title || 'Untitled Notice'}</p>
                            <p className="text-xs text-slate-500 truncate">{notice.message}</p>
                          </div>
                          <div className="hidden md:flex items-center gap-4 text-xs text-slate-400 shrink-0">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3.5 w-3.5" />
                              {formatNoticeDate(resolveDate(notice))}
                            </span>
                            <span className="flex items-center gap-1">
                              <User className="h-3.5 w-3.5" />
                              {creator}
                            </span>
                          </div>
                          {fresh && (
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>New</span>
                          )}
                          <ChevronRight className="h-4 w-4 text-slate-300 shrink-0" />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 p-5">
                    {paginatedNotices.map((notice) => {
                      const meta = CATEGORY_META[notice._displayCategory];
                      const Icon = meta.icon;
                      const creator = getCreator(notice);
                      const fresh = isNewNotice(notice);
                      return (
                        <div
                          key={resolveId(notice)}
                          role="button"
                          tabIndex={0}
                          onClick={() => setSelectedNoticeId(resolveId(notice))}
                          onKeyDown={(e) => { if (e.key === 'Enter') setSelectedNoticeId(resolveId(notice)); }}
                          className="rounded-2xl border border-slate-200 bg-white p-4 hover:shadow-md transition cursor-pointer"
                        >
                          <div className="flex items-center gap-2 mb-3">
                            <span className={`w-8 h-8 rounded-lg flex items-center justify-center ${meta.iconBg}`}>
                              <Icon className={`h-4 w-4 ${meta.iconColor}`} />
                            </span>
                            <span className={`text-xs font-semibold ${meta.text}`}>{meta.label}</span>
                          </div>
                          <h3 className="text-sm font-semibold text-slate-900 leading-snug">{notice.title}</h3>
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2 leading-relaxed">{notice.message}</p>
                          <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400">
                            <div className="flex items-center gap-3">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {formatNoticeDate(resolveDate(notice))}
                              </span>
                              <span className="flex items-center gap-1">
                                <User className="h-3 w-3" />
                                {creator}
                              </span>
                            </div>
                            {fresh && (
                              <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>New</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {sortedNotices.length > 0 && (
                  <div className="flex items-center justify-center gap-1.5 px-5 py-4 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                      className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                      <button
                        key={page}
                        type="button"
                        onClick={() => setCurrentPage(page)}
                        className={`min-w-9 h-9 rounded-lg text-sm font-semibold transition ${
                          page === currentPage
                            ? 'bg-indigo-600 text-white shadow-sm'
                            : 'text-slate-500 hover:bg-slate-50 border border-slate-200'
                        }`}
                      >
                        {page}
                      </button>
                    ))}
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                      className="p-2 rounded-lg border border-slate-200 text-slate-400 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
};

export default NoticeBoard;
