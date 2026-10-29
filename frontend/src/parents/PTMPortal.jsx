/* eslint-disable react/prop-types */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  AlertCircle, CalendarCheck2, CalendarDays, Check, CheckCircle2, Clock, Copy, ExternalLink,
  FileText, Hourglass, MapPin, Phone, ShieldCheck, Star, Users, UsersRound, Video, X,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { useDialog } from './useDialog';
import useParentChildren from './useParentChildren';

// Jitsi hash-config for a privacy-respecting room: show the prejoin screen,
// auto-knock so the parent waits in the lobby until the teacher admits them,
// and hide invite/dial-in controls.
const JITSI_ROOM_CONFIG = '#config.prejoinPageEnabled=true&config.lobby.autoKnock=true&config.disableInviteFunctions=true&config.startWithAudioMuted=true';

const buildJitsiUrl = (room) => {
  if (!room) return '';
  if (/^https?:\/\//.test(room)) return room;
  return `https://meet.jit.si/${encodeURIComponent(room)}`;
};

const CARD = 'rounded-xl border border-slate-100 bg-white shadow-[0_1px_3px_rgba(15,23,42,0.04)]';

// Client-side cache: paint the last meetings list instantly, then refresh it
// in the background. Scoped to the logged-in token.
const MEETINGS_CACHE_KEY = 'parent_meetings_cache_v1';
const MEETINGS_CACHE_TTL_MS = 5 * 60 * 1000;

const meetingsCacheScope = () => {
  try {
    return (localStorage.getItem('token') || '').split('.')[1] || 'anonymous';
  } catch {
    return 'anonymous';
  }
};

const readMeetingsCache = () => {
  try {
    const parsed = JSON.parse(sessionStorage.getItem(MEETINGS_CACHE_KEY) || 'null');
    if (!parsed || parsed.scope !== meetingsCacheScope()) return null;
    if (Date.now() - parsed.cachedAt > MEETINGS_CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
};

const writeMeetingsCache = (data) => {
  try {
    sessionStorage.setItem(MEETINGS_CACHE_KEY, JSON.stringify({ scope: meetingsCacheScope(), cachedAt: Date.now(), data }));
  } catch {
    // Storage full/blocked — caching is best-effort.
  }
};

const PAGE_MOTION = { hidden: {}, show: { transition: { staggerChildren: 0.05 } } };
const RISE = {
  hidden: { opacity: 0, y: 10 },
  show: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
};
const ITEM = {
  hidden: { opacity: 0, y: 8 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: 'easeOut' } },
  exit: { opacity: 0, y: -6, transition: { duration: 0.15 } },
};

const DONE_STATUSES = ['completed', 'cancelled', 'declined'];
const TYPE_TONE = {
  'Video Call': 'bg-blue-50 text-blue-600',
  'Phone Call': 'bg-violet-50 text-violet-600',
  'In Person': 'bg-emerald-50 text-emerald-600',
};

const normalizeStatus = (status) => String(status || 'scheduled').toLowerCase();
const isPendingStatus = (status) => ['scheduled', 'pending', 'reschedule_requested'].includes(normalizeStatus(status));
const isConfirmedStatus = (status) => normalizeStatus(status) === 'confirmed';
const isDone = (m) => DONE_STATUSES.includes(normalizeStatus(m.status));
const getMeetingId = (meeting) => meeting?._id || meeting?.id;
const getTeacherName = (meeting) => meeting?.teacherId?.name || meeting?.teacherName || 'Teacher';
const getMeetingTitle = (meeting) => meeting?.title || meeting?.topic || 'Parent-Teacher Meeting';
const getMeetingDescription = (meeting) => meeting?.description || (meeting?.title && meeting?.topic && meeting.topic !== meeting.title ? meeting.topic : '');
const getMeetingTypeLabel = (meeting) => meeting?.meetingType || meeting?.type || 'In Person';
const meetingDateOf = (meeting) => {
  const d = new Date(meeting?.meetingDate || meeting?.date || '');
  return Number.isNaN(d.getTime()) ? null : d;
};
const formatMeetingDate = (value) => {
  const parsed = new Date(value);
  if (!value || Number.isNaN(parsed.getTime())) return String(value || '');
  return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};
const to12h = (t) => {
  const m = String(t || '').match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(t || '');
  const h = Number(m[1]);
  return `${String(((h + 11) % 12) + 1).padStart(2, '0')}:${m[2]} ${h >= 12 ? 'PM' : 'AM'}`;
};
const formatTime = (t) => String(t || '').split(/\s*[-–]\s*/).map(to12h).join(' – ');
const roomForMeeting = (meeting) => (meeting ? meeting.meetingLink || meeting.videoRoom || '' : '');

// Session window: the school's active academic year when known, else April → March.
const sessionWindow = (activeSession) => {
  const start = new Date(activeSession?.startDate);
  const end = new Date(activeSession?.endDate);
  if (!Number.isNaN(start.getTime()) && !Number.isNaN(end.getTime())) {
    return { name: activeSession.name || '', start, end };
  }
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return { name: `${y} - ${y + 1}`, start: new Date(y, 3, 1), end: new Date(y + 1, 2, 31, 23, 59, 59, 999) };
};

const StatCard = ({ Icon, label, value, sub, tone }) => (
  <div className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${tone.card}`}>
    <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${tone.icon}`}><Icon size={20} /></span>
    <div className="min-w-0">
      <p className={`truncate text-xs font-medium ${tone.label}`}>{label}</p>
      <p className="text-xl font-bold leading-tight text-[#0b1446]">{value}</p>
      <p className="truncate text-[11px] text-slate-500">{sub}</p>
    </div>
  </div>
);

const PTMPortal = () => {
  const navigate = useNavigate();
  const { selected } = useParentChildren();
  const cached = readMeetingsCache();
  const [meetings, setMeetings] = useState(() => cached?.meetings || []);
  const [activeSession, setActiveSession] = useState(() => cached?.activeSession || null);
  const [loading, setLoading] = useState(() => !cached);
  const [busyId, setBusyId] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all'); // all | upcoming | pending | past

  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'details' | 'feedback' | null
  const [feedbackForm, setFeedbackForm] = useState({ rating: 0, comment: '' });

  const closeModal = () => {
    setSelectedMeeting(null);
    setModalMode(null);
    setError('');
  };
  const dialogRef = useDialog(Boolean(selectedMeeting && modalMode), closeModal);

  // Video meeting state (Jitsi embed). The room comes from the meeting record
  // (a teacher-set link, or the server-generated unguessable `videoRoom` slug),
  // never from the meeting id, so it can't be enumerated.
  const [videoMeetingId, setVideoMeetingId] = useState('');
  const [jitsiActive, setJitsiActive] = useState(false);
  const videoMeeting = useMemo(
    () => meetings.find((m) => String(getMeetingId(m)) === String(videoMeetingId)) || null,
    [meetings, videoMeetingId],
  );
  const videoRoom = roomForMeeting(videoMeeting);
  const jitsiUrl = useMemo(() => buildJitsiUrl(videoRoom), [videoRoom]);

  const fetchMeetings = useCallback(async () => {
    const hasCache = Boolean(readMeetingsCache());
    if (!hasCache) setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Parent') {
        setMeetings([]);
        return;
      }
      const [list, holidays] = await Promise.all([
        parentApiJson('/api/meeting/parent/my-meetings', {}, navigate),
        // Only used for the active session window (already server-cached).
        parentApiJson('/api/holidays/parent', {}, navigate).catch(() => null),
      ]);
      const next = { meetings: Array.isArray(list) ? list : [], activeSession: holidays?.activeSession || null };
      setMeetings(next.meetings);
      setActiveSession(next.activeSession);
      writeMeetingsCache(next);
    } catch (err) {
      // Keep showing cached data if a background refresh fails.
      if (!hasCache) {
        setError(err.message || 'Failed to load meetings');
        setMeetings([]);
      }
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const meetingAction = async (meetingId, { method, path, body }) => {
    setError('');
    setBusyId(String(meetingId));
    try {
      const payload = await parentApiJson(`/api/meeting/parent/${path}/${meetingId}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }, navigate);
      sessionStorage.removeItem(MEETINGS_CACHE_KEY);
      await fetchMeetings();
      return payload;
    } catch (err) {
      setError(err.message || 'Request failed');
      throw err;
    } finally {
      setBusyId('');
    }
  };

  const handleResponse = (meeting, response) => {
    const id = getMeetingId(meeting);
    const action = response === 'accept'
      ? { method: 'PUT', path: 'confirm' }
      : { method: 'PUT', path: 'decline', body: {} };
    meetingAction(id, action).catch(() => {});
  };

  const openDetails = (meeting) => {
    setSelectedMeeting(meeting);
    setModalMode('details');
    setError('');
  };

  const openFeedback = (meeting) => {
    setSelectedMeeting(meeting);
    setModalMode('feedback');
    setError('');
    setFeedbackForm({ rating: 0, comment: '' });
  };

  const submitFeedback = async () => {
    if (!selectedMeeting) return;
    if (!feedbackForm.rating) {
      setError('Please choose a star rating.');
      return;
    }
    try {
      await meetingAction(getMeetingId(selectedMeeting), {
        method: 'POST',
        path: 'feedback',
        body: { rating: feedbackForm.rating, comment: feedbackForm.comment.trim() },
      });
      closeModal();
    } catch {
      /* error surfaced via state */
    }
  };

  const copyToClipboard = async (text) => {
    try { await navigator.clipboard.writeText(text); } catch { /* clipboard blocked */ }
  };

  const startVideo = (meeting) => {
    setVideoMeetingId(String(getMeetingId(meeting)));
    setJitsiActive(true);
  };

  /* ── Derived lists ─────────────────────────────────────────────────────── */
  const session = useMemo(() => sessionWindow(activeSession), [activeSession]);

  const sessionMeetings = useMemo(() => meetings.filter((m) => {
    const sid = String(m.studentId?._id || m.studentId || '');
    if (selected?.id && sid && sid !== String(selected.id)) return false;
    const d = meetingDateOf(m);
    return !d || (d >= session.start && d <= session.end);
  }), [meetings, selected?.id, session]);

  const upcoming = useMemo(
    () => sessionMeetings.filter((m) => !isDone(m)).sort((a, b) => (meetingDateOf(b) || 0) - (meetingDateOf(a) || 0)),
    [sessionMeetings],
  );
  const past = useMemo(
    () => sessionMeetings.filter(isDone).sort((a, b) => (meetingDateOf(b) || 0) - (meetingDateOf(a) || 0)),
    [sessionMeetings],
  );
  const pending = upcoming.filter((m) => isPendingStatus(m.status));
  const attended = past.filter((m) => normalizeStatus(m.status) === 'completed');

  const tabs = [
    { key: 'all', label: `All (${sessionMeetings.length})` },
    { key: 'upcoming', label: `Upcoming (${upcoming.length})` },
    { key: 'pending', label: `Pending (${pending.length})` },
    { key: 'past', label: `Past (${past.length})` },
  ];

  const groups = [
    {
      key: 'upcoming',
      label: tab === 'pending' ? 'Pending Meetings' : 'Upcoming Meetings',
      rows: tab === 'pending' ? pending : upcoming,
      show: tab !== 'past',
      tone: 'bg-emerald-50/70',
      icon: <CalendarCheck2 size={16} className="text-emerald-600" />,
    },
    {
      key: 'past',
      label: 'Past Meetings',
      rows: past,
      show: tab === 'all' || tab === 'past',
      tone: 'bg-blue-50/70',
      icon: <CalendarDays size={16} className="text-blue-600" />,
    },
  ].filter((g) => g.show);


  /* ── Pieces ────────────────────────────────────────────────────────────── */
  const statusPill = (meeting) => {
    const s = normalizeStatus(meeting.status);
    if (s === 'confirmed') return <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-0.5 text-[11px] font-medium text-emerald-600"><CheckCircle2 size={12} /> Confirmed</span>;
    if (s === 'reschedule_requested') return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-600"><Clock size={12} /> Reschedule Requested</span>;
    return <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2.5 py-0.5 text-[11px] font-medium text-amber-600"><AlertCircle size={12} /> Response Required</span>;
  };

  const pastStatus = (meeting) => {
    const s = normalizeStatus(meeting.status);
    if (s === 'completed') return <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700"><CheckCircle2 size={14} /> Attended</span>;
    return <span className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-semibold capitalize text-slate-600"><X size={14} /> {s}</span>;
  };

  const actions = (meeting) => {
    const id = String(getMeetingId(meeting));
    const busy = busyId === id;
    if (isDone(meeting)) {
      const canRate = normalizeStatus(meeting.status) === 'completed' && !meeting.parentFeedback?.submittedAt;
      return (
        <>
          {pastStatus(meeting)}
          <button type="button" onClick={() => (canRate ? openFeedback(meeting) : openDetails(meeting))} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50">
            {canRate ? <Star size={14} /> : <FileText size={14} />} {canRate ? 'Leave Feedback' : 'View Details'}
          </button>
        </>
      );
    }
    if (isPendingStatus(meeting.status)) {
      return (
        <>
          <button type="button" disabled={busy} onClick={() => handleResponse(meeting, 'accept')} className="flex w-full items-center justify-center gap-1.5 rounded-full border bg-green-600 text-white p-1 text-xs font-semibold transition hover:bg-green-50 hover:text-green-500 disabled:opacity-50">
            <Check size={14} />
          </button>
          <button type="button" disabled={busy} onClick={() => handleResponse(meeting, 'decline')} className="flex w-full items-center justify-center gap-1.5 rounded-full border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50">
            <X size={14} />
          </button>
        </>
      );
    }
    const isVideo = getMeetingTypeLabel(meeting) === 'Video Call';
    return (
      <>
        {isConfirmedStatus(meeting.status) && isVideo && roomForMeeting(meeting) ? (
          <button type="button" onClick={() => startVideo(meeting)} className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700">
            <Video size={14} /> Join
          </button>
        ) : null}
        <button type="button" onClick={() => openDetails(meeting)} className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-blue-200 bg-white px-3 py-1.5 text-xs font-semibold text-blue-600 transition hover:bg-blue-50">
          <FileText size={14} /> View Details
        </button>
      </>
    );
  };

  const meetingCard = (meeting) => {
    const d = meetingDateOf(meeting);
    const type = getMeetingTypeLabel(meeting);
    const description = getMeetingDescription(meeting);
    const time = formatTime(meeting.meetingTime || meeting.time);
    const TypeIcon = type === 'Video Call' ? Video : type === 'Phone Call' ? Phone : MapPin;
    return (
      <motion.article
        key={getMeetingId(meeting)}
        variants={ITEM}
        initial="hidden"
        animate="show"
        exit="exit"
        layout
        className="flex flex-col gap-3 rounded-lg border border-slate-100 bg-white p-2.5 transition hover:border-blue-100 hover:shadow-[0_4px_14px_rgba(15,23,42,0.05)] sm:flex-row sm:items-center"
      >
        <div className="flex w-full shrink-0 items-center gap-3 sm:w-[72px] sm:flex-col sm:gap-0 sm:rounded-lg sm:bg-slate-50 sm:py-2 sm:text-center">
          {d ? (
            <>
              <p className="text-[11px] text-slate-600">{d.toLocaleDateString('en-GB', { month: 'short' })}</p>
              <p className="text-xl font-bold leading-tight text-[#0b1446]">{d.getDate()}</p>
              <p className="text-[11px] text-slate-600">{d.getFullYear()}</p>
              <p className="text-[11px] text-slate-500 sm:mt-1">{d.toLocaleDateString('en-GB', { weekday: 'short' })}</p>
            </>
          ) : <p className="text-xs text-slate-400">Date TBA</p>}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-sm font-bold text-[#0b1446]">{getMeetingTitle(meeting)}</h3>
            <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${TYPE_TONE[type] || 'bg-slate-100 text-slate-600'}`}>{type}</span>
            {!isDone(meeting) ? <span className="sm:ml-auto">{statusPill(meeting)}</span> : null}
          </div>
          {description ? <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{description}</p> : null}
          <div className="mt-2 grid gap-2 text-xs sm:grid-cols-3">
            <span className="flex items-center gap-1.5 text-slate-700"><Clock size={14} className="shrink-0 text-slate-500" />{time || 'Time TBA'}</span>
            <span className="flex min-w-0 items-start gap-1.5">
              <TypeIcon size={14} className="mt-0.5 shrink-0 text-slate-500" />
              <span className="min-w-0">
                <span className="block truncate text-slate-700">{meeting.location || type}</span>
                {type === 'Video Call' && !meeting.location ? <span className="block truncate text-[11px] text-slate-500">Online meeting</span> : null}
              </span>
            </span>
            <span className="flex min-w-0 items-start gap-1.5">
              <Users size={14} className="mt-0.5 shrink-0 text-slate-500" />
              <span className="min-w-0">
                <span className="block truncate text-slate-700">Teacher</span>
                <span className="block truncate text-[11px] text-slate-500">{getTeacherName(meeting)}</span>
              </span>
            </span>
          </div>
          {meeting.rescheduleRequest?.requestedAt ? (
            <p className="mt-2 rounded-md bg-amber-50 px-2 py-1 text-[11px] text-amber-700">
              Your reschedule request:
              {meeting.rescheduleRequest.requestedDate ? ` ${formatMeetingDate(meeting.rescheduleRequest.requestedDate)}` : ' (no date given)'}
              {meeting.rescheduleRequest.requestedTime ? ` at ${meeting.rescheduleRequest.requestedTime}` : ''}
              {meeting.rescheduleRequest.reason ? ` — ${meeting.rescheduleRequest.reason}` : ''}
            </p>
          ) : null}
        </div>

        <div className="flex shrink-0 gap-2 sm:flex-row">{actions(meeting)}</div>
      </motion.article>
    );
  };

  /* ── Render ────────────────────────────────────────────────────────────── */
  return (
    <motion.div variants={PAGE_MOTION} initial="hidden" animate="show" className="space-y-3 p-3 sm:p-4 md:p-5">
      <motion.header variants={RISE} className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-violet-100 text-violet-600"><UsersRound size={22} /></span>
          <div>
            <h1 className="text-xl font-bold leading-tight text-[#0b1446]">Meetings / PTM</h1>
            <p className="text-xs text-slate-500 sm:text-sm">Parent-Teacher Meetings and other scheduled meetings.</p>
          </div>
        </div>

      </motion.header>

      {/* Stats */}
      <motion.div variants={RISE} className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
        <StatCard Icon={Users} label="Total Meetings" value={loading ? '—' : sessionMeetings.length} sub="This session"
          tone={{ card: 'border-blue-100 bg-blue-50/40', icon: 'bg-blue-100/80 text-blue-600', label: 'text-blue-600' }} />
        <StatCard Icon={CalendarCheck2} label="Upcoming" value={loading ? '—' : upcoming.length} sub="To be attended"
          tone={{ card: 'border-emerald-100 bg-emerald-50/40', icon: 'bg-emerald-100/80 text-emerald-600', label: 'text-slate-600' }} />
        <StatCard Icon={Hourglass} label="Pending Response" value={loading ? '—' : pending.length} sub="Action required"
          tone={{ card: 'border-amber-100 bg-amber-50/40', icon: 'bg-amber-100/80 text-amber-600', label: 'text-amber-600' }} />
        <StatCard Icon={CheckCircle2} label="Attended" value={loading ? '—' : attended.length} sub="Completed"
          tone={{ card: 'border-violet-100 bg-violet-50/40', icon: 'bg-violet-100/80 text-violet-600', label: 'text-violet-600' }} />
      </motion.div>

      {error && !modalMode ? <ErrorState message={error} onRetry={fetchMeetings} /> : null}

      {/* Inline video call */}
      {jitsiActive && videoRoom && (
        <motion.section variants={RISE} className={`${CARD} overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-3 py-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {videoMeeting ? `Video call with ${getTeacherName(videoMeeting)}` : 'Video call'} — you&apos;ll wait in the lobby until the teacher admits you
            </p>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => window.open(`${jitsiUrl}${JITSI_ROOM_CONFIG}`, '_blank', 'noopener')} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Open in new tab"><ExternalLink className="h-4 w-4" /></button>
              <button type="button" onClick={() => copyToClipboard(`${jitsiUrl}${JITSI_ROOM_CONFIG}`)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Copy link"><Copy className="h-4 w-4" /></button>
              <button type="button" onClick={() => setJitsiActive(false)} className="rounded-lg bg-slate-100 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-200">Leave</button>
            </div>
          </div>
          <iframe title="PTM Video Meeting" src={`${jitsiUrl}${JITSI_ROOM_CONFIG}`} className="h-[420px] w-full" allow="camera; microphone; fullscreen; display-capture" />
        </motion.section>
      )}

      {/* List */}
      <motion.section variants={RISE} className={`${CARD} p-3`}>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              aria-pressed={tab === t.key}
              onClick={() => setTab(t.key)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold transition ${tab === t.key ? 'border-violet-600 bg-blue-600 text-white' : 'border-slate-200 bg-white text-[#0b1446] hover:bg-slate-50'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {loading ? (
          <Loading label="meetings" rows={3} />
        ) : sessionMeetings.length === 0 ? (
          <EmptyState icon={Video} title="No meetings scheduled" hint="Requests from teachers will appear here." />
        ) : (
          <div className="space-y-3">
            {groups.map((group) => (
              <div key={group.key} className="overflow-hidden rounded-lg border border-slate-100">
                <div className={`flex items-center gap-2 px-3 py-2 text-sm font-semibold text-[#0b1446] ${group.tone}`}>
                  {group.icon}
                  {group.label} ({group.rows.length})
                </div>
                <div className="space-y-2 p-2">
                  <AnimatePresence initial={false} mode="popLayout">
                    {group.rows.length ? group.rows.map(meetingCard) : (
                      <motion.p key="empty" variants={ITEM} initial="hidden" animate="show" className="px-2 py-3 text-center text-xs text-slate-400">
                        No meetings here.
                      </motion.p>
                    )}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </motion.section>

      {/* Details / Feedback modal (portal → covers the whole viewport) */}
      {createPortal(
      <AnimatePresence>
        {selectedMeeting && modalMode && (
          <motion.div className="fixed inset-0 z-[100] flex items-center justify-center p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <div className="absolute inset-0 bg-black/40" onClick={closeModal} aria-hidden="true" />
            <motion.div
              ref={dialogRef}
              tabIndex={-1}
              role="dialog"
              aria-modal="true"
              aria-labelledby="ptm-modal-title"
              initial={{ opacity: 0, y: 16, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.98 }}
              transition={{ duration: 0.2 }}
              className="relative w-full max-w-md rounded-xl border bg-white p-4 shadow-xl"
            >
              <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                  <h3 id="ptm-modal-title" className="flex items-center gap-2 text-base font-bold text-[#0b1446]">
                    {modalMode === 'feedback' ? <Star className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                    {modalMode === 'feedback' ? 'Meeting Feedback' : getMeetingTitle(selectedMeeting)}
                  </h3>
                  <p className="text-xs text-slate-500">{getTeacherName(selectedMeeting)} • {formatMeetingDate(selectedMeeting.meetingDate)}</p>
                </div>
                <button type="button" onClick={closeModal} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-100"><X size={16} /></button>
              </div>
              {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}

              {modalMode === 'details' ? (
                <dl className="space-y-2 text-sm">
                  {[
                    ['Topic', selectedMeeting.topic],
                    ['Description', selectedMeeting.description],
                    ['Time', formatTime(selectedMeeting.meetingTime)],
                    ['Type', getMeetingTypeLabel(selectedMeeting)],
                    ['Location', selectedMeeting.location],
                    ['Status', normalizeStatus(selectedMeeting.status).replace(/_/g, ' ')],
                    ['Your rating', selectedMeeting.parentFeedback?.submittedAt ? `${selectedMeeting.parentFeedback.rating}/5${selectedMeeting.parentFeedback.comment ? ` — ${selectedMeeting.parentFeedback.comment}` : ''}` : ''],
                  ].filter(([, v]) => v).map(([k, v]) => (
                    <div key={k} className="grid grid-cols-[96px_1fr] gap-2">
                      <dt className="text-xs text-slate-500">{k}</dt>
                      <dd className="text-xs text-slate-800">{v}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <>
                  <div className="mb-3 flex items-center gap-1" role="radiogroup" aria-label="Rating out of 5">
                    <span className="mr-1 text-sm text-slate-700">Rating:</span>
                    {[1, 2, 3, 4, 5].map((r) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setFeedbackForm({ ...feedbackForm, rating: r })}
                        aria-label={`${r} star${r > 1 ? 's' : ''}`}
                        aria-pressed={feedbackForm.rating === r}
                        className={`rounded p-1 ${feedbackForm.rating >= r ? 'text-yellow-500' : 'text-slate-300'}`}
                      >
                        <Star className="h-5 w-5 fill-current" />
                      </button>
                    ))}
                  </div>
                  <label htmlFor="ptm-fb-comment" className="text-sm text-slate-700">Comments</label>
                  <textarea id="ptm-fb-comment" rows={3} value={feedbackForm.comment} onChange={(e) => setFeedbackForm({ ...feedbackForm, comment: e.target.value })} className="mb-3 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" placeholder="Share your feedback" />
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={closeModal} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm">Cancel</button>
                    <button type="button" onClick={submitFeedback} disabled={Boolean(busyId)} className="rounded-lg bg-blue-600 px-3 py-1.5 text-sm text-white hover:bg-blue-700 disabled:opacity-50">Submit Feedback</button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>,
      document.body,
      )}
    </motion.div>
  );
};

export default PTMPortal;
