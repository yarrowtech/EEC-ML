import React, { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, Pin, Calendar, Clock, User, Hash, Tag, Flag, Users, RefreshCw,
  Paperclip, Download, Share2, MessageCircle, Mail, Phone, Copy, Info,
  ChevronLeft, ChevronRight, Bell,
} from 'lucide-react';
import toast from 'react-hot-toast';
import ExamRoutineTable from '../../components/ExamRoutineTable';
import {
  CATEGORY_META, PRIORITY_META, getDisplayCategory, isNewNotice, isPinnedNotice,
  getCreatorLabel, CREATOR_TYPE_LABEL, formatNoticeDate, formatNoticeTime,
  formatNoticeDateTime, getNoticeDisplayId, formatFileSize, getAttachmentMeta,
  getVisibleToLabel, downloadAttachment,
} from '../../utils/noticeDisplay';

const API_BASE = import.meta.env.VITE_API_URL || '';

const NoticeDetail = ({ setShowAdminHeader }) => {
  const { noticeId } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [notices, setNotices] = useState([]);
  const [classes, setClasses] = useState([]);
  const [sections, setSections] = useState([]);

  const currentAdminId = useMemo(() => {
    try {
      const token = localStorage.getItem('token');
      if (!token) return '';
      const payloadPart = token.split('.')[1];
      if (!payloadPart) return '';
      const normalized = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
      const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4);
      const decoded = JSON.parse(atob(padded));
      return String(decoded?.id || decoded?._id || '');
    } catch {
      return '';
    }
  }, []);

  const authHeaders = useMemo(() => {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      authorization: token ? `Bearer ${token}` : '',
    };
  }, []);

  const apiRequest = async (path) => {
    const res = await fetch(`${API_BASE}${path}`, { headers: authHeaders });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data?.error || 'Request failed');
    return data;
  };

  useEffect(() => {
    setShowAdminHeader?.(false);
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const [classData, sectionData, noticeData] = await Promise.all([
          apiRequest('/api/academic/classes'),
          apiRequest('/api/academic/sections'),
          apiRequest('/api/notifications'),
        ]);
        if (cancelled) return;
        setClasses(Array.isArray(classData) ? classData : []);
        setSections(Array.isArray(sectionData) ? sectionData : []);
        setNotices(Array.isArray(noticeData) ? noticeData : []);
      } catch (err) {
        toast.error(err.message || 'Failed to load notice');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [setShowAdminHeader]);

  const sortedNotices = useMemo(
    () => [...notices].sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    [notices]
  );

  const noticeIndex = sortedNotices.findIndex((n) => String(n._id) === String(noticeId));
  const notice = noticeIndex >= 0 ? sortedNotices[noticeIndex] : null;
  const prevNotice = noticeIndex > 0 ? sortedNotices[noticeIndex - 1] : null;
  const nextNotice = noticeIndex >= 0 && noticeIndex < sortedNotices.length - 1 ? sortedNotices[noticeIndex + 1] : null;

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-100 border-t-indigo-600" />
      </div>
    );
  }

  if (!notice) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center gap-3">
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 flex items-center justify-center">
          <Bell className="h-7 w-7 text-indigo-200" />
        </div>
        <p className="text-sm font-medium text-slate-400">Notice not found</p>
        <button
          type="button"
          onClick={() => navigate('/admin/notices/view')}
          className="text-sm font-semibold text-indigo-600 hover:text-indigo-700"
        >
          ← Back to Notice Board
        </button>
      </div>
    );
  }

  const displayCategory = getDisplayCategory(notice);
  const meta = CATEGORY_META[displayCategory];
  const Icon = meta.icon;
  const priorityMeta = PRIORITY_META[notice.priority || 'medium'];
  const pinned = isPinnedNotice(notice);
  const fresh = isNewNotice(notice);
  const creator = getCreatorLabel(notice, currentAdminId);
  const creatorType = CREATOR_TYPE_LABEL[String(notice?.createdByType || '').toLowerCase()];
  const attachments = Array.isArray(notice.attachments) ? notice.attachments : [];
  const shareUrl = `${window.location.origin}/admin/notices/view/${notice._id}`;
  const shareText = `${notice.title}\n\n${notice.message}\n\n${shareUrl}`;

  const handleShare = (channel) => {
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`, '_blank', 'noopener,noreferrer');
    } else if (channel === 'email') {
      window.location.href = `mailto:?subject=${encodeURIComponent(notice.title)}&body=${encodeURIComponent(shareText)}`;
    } else if (channel === 'sms') {
      window.location.href = `sms:?body=${encodeURIComponent(shareText)}`;
    } else if (channel === 'copy') {
      navigator.clipboard?.writeText(shareUrl)
        .then(() => toast.success('Link copied to clipboard'))
        .catch(() => toast.error('Unable to copy link'));
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 py-6">

        <button
          type="button"
          onClick={() => navigate('/admin/notices/view')}
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-slate-700 transition mb-5"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to Notice Board
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Main column */}
          <div className="lg:col-span-2 space-y-6">

            {/* Hero card */}
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm relative overflow-hidden">
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
                  <h1 className="text-xl sm:text-2xl font-bold text-slate-900 leading-snug">{notice.title}</h1>
                  {/* <p className="mt-2 text-sm text-slate-500 leading-relaxed">{notice.message}</p> */}

                  <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-slate-400">
                    <span className="flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5" />
                      {formatNoticeDate(notice.createdAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" />
                      {formatNoticeTime(notice.createdAt)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      <User className="h-3.5 w-3.5" />
                      <span>
                        <span className="text-slate-600 font-medium">{creator}</span>
                        {creatorType && creatorType !== creator && (
                          <span className="text-slate-400"> · {creatorType}</span>
                        )}
                      </span>
                    </span>
                    {fresh && (
                      <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${meta.badge}`}>New</span>
                    )}
                  </div>
                </div>

                {/* Decorative category icon */}
                <div className={`hidden sm:flex w-20 h-20 rounded-2xl items-center justify-center shrink-0 ${meta.iconBg}`}>
                  <Icon className={`h-10 w-10 ${meta.iconColor}`} />
                </div>
              </div>
            </div>

            {/* Notice details */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-100 flex items-center gap-2">
                <Info className="h-4 w-4 text-indigo-500" />
                <h2 className="text-sm font-semibold text-slate-900">Notice Details</h2>
              </div>
              <div className="px-5 py-5 space-y-4">
                <p className="text-sm text-slate-600 leading-relaxed whitespace-pre-line">{notice.message}</p>
                <ExamRoutineTable rows={notice.examRoutine} />
              </div>

              {/* Prev / next notice navigation */}
              <div className="flex items-center justify-center gap-2 px-5 py-4 border-t border-slate-100">
                <button
                  type="button"
                  disabled={!prevNotice}
                  onClick={() => prevNotice && navigate(`/admin/notices/view/${prevNotice._id}`)}
                  title={prevNotice ? `Previous: ${prevNotice.title}` : 'No previous notice'}
                  className="p-2.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  disabled={!nextNotice}
                  onClick={() => nextNotice && navigate(`/admin/notices/view/${nextNotice._id}`)}
                  title={nextNotice ? `Next: ${nextNotice.title}` : 'No next notice'}
                  className="p-2.5 rounded-full bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">

            {/* Notice information */}
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
                <InfoRow icon={Users} label="Visible To" value={getVisibleToLabel(notice, classes, sections)} />
                <InfoRow icon={Calendar} label="Published On" value={formatNoticeDateTime(notice.createdAt)} />
                <InfoRow icon={RefreshCw} label="Last Updated" value={formatNoticeDateTime(notice.updatedAt || notice.createdAt)} />
              </div>
            </div>

            {/* Attachments */}
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
                    return (
                      <button
                        type="button"
                        key={`${att.url}-${idx}`}
                        onClick={() => downloadAttachment(att)}
                        className="flex w-full items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 hover:bg-slate-100 transition text-left"
                      >
                        <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${fileMeta.color}`}>
                          <Paperclip className="h-4 w-4" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="text-xs font-semibold text-slate-700 truncate">{att.name || `Attachment ${idx + 1}`}</p>
                          <p className="text-[11px] text-slate-400">{fileMeta.label}{att.size ? ` · ${formatFileSize(att.size)}` : ''}</p>
                        </span>
                        <Download className="h-4 w-4 text-slate-400 shrink-0" />
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Share */}
            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <Share2 className="h-4 w-4 text-indigo-500" />
                <h2 className="text-sm font-semibold text-slate-900">Share Notice</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">Share this notice with others</p>
              <div className="grid grid-cols-4 gap-2 text-center">
                <ShareButton icon={MessageCircle} label="WhatsApp" color="bg-emerald-500" onClick={() => handleShare('whatsapp')} />
                <ShareButton icon={Mail} label="Email" color="bg-blue-500" onClick={() => handleShare('email')} />
                <ShareButton icon={Phone} label="SMS" color="bg-amber-500" onClick={() => handleShare('sms')} />
                <ShareButton icon={Copy} label="Copy Link" color="bg-purple-500" onClick={() => handleShare('copy')} />
              </div>
            </div>
          </div>
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

export default NoticeDetail;
