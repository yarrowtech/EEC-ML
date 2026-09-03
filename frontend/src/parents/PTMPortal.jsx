import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Video, Phone, Users, Check, X, ArrowLeftRight, Star, ExternalLink, Copy, ShieldCheck } from 'lucide-react';
import { parentApiJson } from './parentApi';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';
import { useDialog } from './useDialog';

// Jitsi hash-config for a privacy-respecting room: show the prejoin screen,
// auto-knock so the parent waits in the lobby until the teacher admits them,
// and hide invite/dial-in controls.
const JITSI_ROOM_CONFIG = '#config.prejoinPageEnabled=true&config.lobby.autoKnock=true&config.disableInviteFunctions=true&config.startWithAudioMuted=true';

const buildJitsiUrl = (room) => {
  if (!room) return '';
  if (/^https?:\/\//.test(room)) return room;
  return `https://meet.jit.si/${encodeURIComponent(room)}`;
};

const PTMPortal = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState('upcoming'); // upcoming | history
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [modalMode, setModalMode] = useState(null); // 'reschedule' | 'feedback' | null
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [rescheduleForm, setRescheduleForm] = useState({ date: '', time: '', reason: '' });
  const [feedbackForm, setFeedbackForm] = useState({ rating: 0, comment: '' });

  const closeModal = () => {
    setSelectedMeeting(null);
    setModalMode(null);
    setError('');
  };
  const dialogRef = useDialog(Boolean(selectedMeeting && modalMode), closeModal);

  // Video meeting state (Jitsi embed)
  const [videoMeetingId, setVideoMeetingId] = useState('');
  const [jitsiActive, setJitsiActive] = useState(false);

  // The room comes from the meeting record (a teacher-set link, or the
  // server-generated unguessable `videoRoom` slug). It is never derived from the
  // meeting id, so it can't be enumerated by anyone outside the meeting.
  const roomForMeeting = (meeting) => {
    if (!meeting) return '';
    return meeting.meetingLink || meeting.videoRoom || '';
  };
  const videoMeeting = useMemo(
    () => meetings.find((m) => String(m._id || m.id) === String(videoMeetingId)) || null,
    [meetings, videoMeetingId],
  );
  const videoRoom = roomForMeeting(videoMeeting);
  const jitsiUrl = useMemo(() => buildJitsiUrl(videoRoom), [videoRoom]);
  const getMeetingId = (meeting) => meeting?._id || meeting?.id;
  const getTeacherName = (meeting) => meeting?.teacherId?.name || meeting?.teacherName || 'Teacher';
  const getMeetingSubject = (meeting) =>
    meeting?.topic ||
    meeting?.title ||
    (meeting?.studentId?.name ? `Discussion about ${meeting.studentId.name}` : 'Parent-Teacher Meeting');
  const getMeetingTypeLabel = (meeting) => meeting?.meetingType || meeting?.type || 'In Person';
  const formatMeetingDate = (value) => {
    if (!value) return '';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return parsed.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };
  const getMeetingDate = (meeting) => formatMeetingDate(meeting?.meetingDate || meeting?.date || '');
  const getMeetingTime = (meeting) => meeting?.meetingTime || meeting?.time || '';
  const getMeetingAgenda = (meeting) => meeting?.agenda || (meeting?.description ? [meeting.description] : null);
  const getStudentLabel = (meeting) => {
    if (!meeting?.studentId) return '';
    const { name, grade, section } = meeting.studentId;
    const gradeLabel = grade ? `Grade ${grade}${section ? ` - ${section}` : ''}` : '';
    if (name && gradeLabel) return `${name} • ${gradeLabel}`;
    return name || gradeLabel || '';
  };
  const normalizeStatus = (status) => String(status || 'scheduled').toLowerCase();
  const isPendingStatus = (status) => {
    const value = normalizeStatus(status);
    return value === 'scheduled' || value === 'pending';
  };
  const isConfirmedStatus = (status) => normalizeStatus(status) === 'confirmed';
  const isRescheduleStatus = (status) => normalizeStatus(status) === 'reschedule_requested';

  const fetchMeetings = useCallback(async () => {
    try {
      setLoading(true);
      setError('');
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');
      if (!token || userType !== 'Parent') {
        setMeetings([]);
        setLoading(false);
        return;
      }

      const data = await parentApiJson('/api/meeting/parent/my-meetings', {}, navigate);
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Parent meetings fetch error:', err);
      setError(err.message || 'Failed to load meetings');
      setMeetings([]);
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => {
    fetchMeetings();
  }, [fetchMeetings]);

  const getMeetingTypeIcon = (type) => {
    switch (type) {
      case 'Video Call':
        return <Video className="w-4 h-4" />;
      case 'Phone Call':
        return <Phone className="w-4 h-4" />;
      default:
        return <Users className="w-4 h-4" />;
    }
  };

  const confirmMeeting = async (meetingId) => {
    try {
      setLoading(true);
      setError('');
      await parentApiJson(`/api/meeting/parent/confirm/${meetingId}`, { method: 'PUT' }, navigate);
      await fetchMeetings();
    } catch (err) {
      console.error('Confirm meeting error:', err);
      setError(err.message || 'Failed to confirm meeting');
    } finally {
      setLoading(false);
    }
  };

  const meetingAction = async (meetingId, { method, path, body }) => {
    setError('');
    setLoading(true);
    try {
      const payload = await parentApiJson(`/api/meeting/parent/${path}/${meetingId}`, {
        method,
        ...(body ? { body: JSON.stringify(body) } : {}),
      }, navigate);
      await fetchMeetings();
      return payload;
    } catch (err) {
      setError(err.message || 'Request failed');
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const handleResponse = (meeting, response) => {
    const id = getMeetingId(meeting);
    if (response === 'accept') {
      confirmMeeting(id);
    } else if (response === 'decline') {
      meetingAction(id, { method: 'PUT', path: 'decline', body: {} }).catch(() => {});
    }
  };

  const handleRescheduleRequest = (meeting) => {
    setSelectedMeeting(meeting);
    setModalMode('reschedule');
    setError('');
    setRescheduleForm({ date: '', time: '', reason: '' });
  };

  const submitReschedule = async () => {
    if (!selectedMeeting) return;
    if (!rescheduleForm.reason.trim()) {
      setError('Please tell the teacher why you need to reschedule.');
      return;
    }
    try {
      await meetingAction(getMeetingId(selectedMeeting), {
        method: 'PUT',
        path: 'reschedule',
        body: {
          requestedDate: rescheduleForm.date || undefined,
          requestedTime: rescheduleForm.time || undefined,
          reason: rescheduleForm.reason.trim(),
        },
      });
      closeModal();
    } catch {
      /* error surfaced via state */
    }
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
    try { await navigator.clipboard.writeText(text); } catch {}
  };

  const DONE_STATUSES = ['completed', 'cancelled', 'declined'];
  const activeMeetings = useMemo(
    () => meetings.filter((m) => !DONE_STATUSES.includes(normalizeStatus(m.status))),
    [meetings],
  );
  const pastMeetings = useMemo(
    () => meetings.filter((m) => DONE_STATUSES.includes(normalizeStatus(m.status))),
    [meetings],
  );
  const needsResponseCount = activeMeetings.filter(
    (m) => isPendingStatus(m.status) || isRescheduleStatus(m.status),
  ).length;

  const [statusFilter, setStatusFilter] = useState('all'); // all | response | confirmed
  const filteredActive = activeMeetings.filter((m) => {
    if (statusFilter === 'response') return isPendingStatus(m.status) || isRescheduleStatus(m.status);
    if (statusFilter === 'confirmed') return isConfirmedStatus(m.status);
    return true;
  });

  const startVideo = (meeting) => {
    setVideoMeetingId(String(getMeetingId(meeting)));
    setJitsiActive(true);
  };
  const stopVideo = () => setJitsiActive(false);

  const statusChip = (status) => {
    const s = normalizeStatus(status);
    if (s === 'confirmed') return <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-700">Confirmed</span>;
    if (s === 'reschedule_requested') return <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-700">Reschedule requested</span>;
    return <span className="rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-semibold text-violet-700">Needs your response</span>;
  };

  return (
    <div className="p-4 sm:p-6 max-w-5xl mx-auto">
      <PageHeader
        title="Meetings"
        icon={Video}
        subtitle="Respond to meeting requests and join video calls."
      />

      {error && <div className="mb-4"><ErrorState message={error} /></div>}

      {/* Tabs */}
      <div className="mb-4 inline-flex rounded-xl bg-slate-100 p-1">
        {[
          { key: 'upcoming', label: `Upcoming${activeMeetings.length ? ` (${activeMeetings.length})` : ''}` },
          { key: 'history', label: 'Past' },
        ].map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            aria-pressed={activeTab === t.key}
            className={`rounded-lg px-4 py-1.5 text-sm font-medium transition ${
              activeTab === t.key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Inline video call */}
      {jitsiActive && videoRoom && (
        <section className="mb-4 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 px-4 py-2.5">
            <p className="flex items-center gap-1.5 text-sm font-medium text-slate-700">
              <ShieldCheck className="h-4 w-4 text-emerald-600" />
              {videoMeeting ? `Video call with ${getTeacherName(videoMeeting)}` : 'Video call'} — you&apos;ll wait in the lobby until the teacher admits you
            </p>
            <div className="flex items-center gap-1.5">
              <button onClick={() => window.open(`${jitsiUrl}${JITSI_ROOM_CONFIG}`, '_blank', 'noopener')} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Open in new tab">
                <ExternalLink className="h-4 w-4" />
              </button>
              <button onClick={() => copyToClipboard(`${jitsiUrl}${JITSI_ROOM_CONFIG}`)} className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50" aria-label="Copy link">
                <Copy className="h-4 w-4" />
              </button>
              <button onClick={stopVideo} className="rounded-lg bg-slate-100 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-200">Leave</button>
            </div>
          </div>
          <iframe
            title="PTM Video Meeting"
            src={`${jitsiUrl}${JITSI_ROOM_CONFIG}`}
            className="w-full h-[460px]"
            allow="camera; microphone; fullscreen; display-capture"
          />
        </section>
      )}

      {activeTab === 'upcoming' && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 p-4">
            <h2 className="text-base font-semibold text-slate-800">Meetings</h2>
            <div className="inline-flex rounded-lg bg-slate-100 p-0.5" role="group" aria-label="Filter meetings">
              {[
                { key: 'all', label: 'All' },
                { key: 'response', label: `Needs response${needsResponseCount ? ` (${needsResponseCount})` : ''}` },
                { key: 'confirmed', label: 'Confirmed' },
              ].map((f) => (
                <button
                  key={f.key}
                  type="button"
                  aria-pressed={statusFilter === f.key}
                  onClick={() => setStatusFilter(f.key)}
                  className={`rounded-md px-2.5 py-1 text-xs font-medium transition ${
                    statusFilter === f.key ? 'bg-white text-violet-700 shadow-sm' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="divide-y divide-slate-100">
            {loading && activeMeetings.length === 0 && (
              <div className="p-4"><Loading label="meetings" rows={2} /></div>
            )}
            {!loading && filteredActive.length === 0 && (
              <div className="p-4">
                <EmptyState
                  icon={Video}
                  title={activeMeetings.length === 0 ? 'No meetings scheduled' : 'Nothing in this filter'}
                  hint={activeMeetings.length === 0 ? 'Requests from teachers will appear here.' : undefined}
                />
              </div>
            )}
            {filteredActive.map((meeting) => {
              const meetingId = getMeetingId(meeting);
              const pending = isPendingStatus(meeting.status);
              const confirmed = isConfirmedStatus(meeting.status);
              const agendaItems = getMeetingAgenda(meeting);
              const meetingType = getMeetingTypeLabel(meeting);
              const isVideo = meetingType === 'Video Call';
              const teacherName = getTeacherName(meeting);
              const subjectLabel = getMeetingSubject(meeting);
              const studentLabel = getStudentLabel(meeting);

              return (
                <div key={meetingId || subjectLabel} className="p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-semibold text-slate-800">Meeting with {teacherName}</h3>
                        {statusChip(meeting.status)}
                      </div>
                      <p className="text-sm text-slate-500">{subjectLabel}</p>
                      {studentLabel && <p className="text-xs text-slate-400">{studentLabel}</p>}
                      <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                        <span className="flex items-center gap-1"><Calendar className="h-4 w-4" />{getMeetingDate(meeting) || 'Date TBA'}</span>
                        <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{getMeetingTime(meeting) || 'Time TBA'}</span>
                        <span className="flex items-center gap-1">{getMeetingTypeIcon(meetingType)}{meetingType}</span>
                      </div>
                      {agendaItems?.length ? (
                        <p className="text-sm text-slate-600"><span className="font-medium">Agenda:</span> {agendaItems.join(', ')}</p>
                      ) : null}
                      {meeting.rescheduleRequest?.requestedAt && (
                        <p className="mt-1 rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-700">
                          Your reschedule request:
                          {meeting.rescheduleRequest.requestedDate ? ` ${formatMeetingDate(meeting.rescheduleRequest.requestedDate)}` : ' (no date given)'}
                          {meeting.rescheduleRequest.requestedTime ? ` at ${meeting.rescheduleRequest.requestedTime}` : ''}
                          {meeting.rescheduleRequest.reason ? ` — ${meeting.rescheduleRequest.reason}` : ''}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {confirmed && isVideo && roomForMeeting(meeting) && (
                        <button onClick={() => startVideo(meeting)} className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-violet-700">
                          <Video className="h-4 w-4" /> Join
                        </button>
                      )}
                      {pending && (
                        <button onClick={() => handleResponse(meeting, 'accept')} className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700">
                          <Check className="h-4 w-4" /> Accept
                        </button>
                      )}
                      {(pending || confirmed) && (
                        <button onClick={() => handleRescheduleRequest(meeting)} className="rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50">
                          Reschedule
                        </button>
                      )}
                      {pending && (
                        <button onClick={() => handleResponse(meeting, 'decline')} className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
                          Decline
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {activeTab === 'history' && (
        <section className="rounded-xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-100 p-4">
            <h2 className="text-base font-semibold text-slate-800">Past meetings</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {pastMeetings.length === 0 && (
              <div className="p-4"><EmptyState icon={Video} title="No past meetings" /></div>
            )}
            {pastMeetings.map((m) => {
              const meetingId = getMeetingId(m);
              const statusLabel = normalizeStatus(m.status).replace(/_/g, ' ');
              const isCompleted = normalizeStatus(m.status) === 'completed';
              return (
                <div key={meetingId || getMeetingSubject(m)} className="flex flex-wrap items-start justify-between gap-3 p-4">
                  <div>
                    <p className="font-medium text-slate-800">{getTeacherName(m)} · {getMeetingSubject(m)}</p>
                    <p className="text-sm text-slate-500">{getMeetingDate(m) || 'Date TBA'} at {getMeetingTime(m) || 'Time TBA'}</p>
                    {m.parentFeedback?.submittedAt && (
                      <p className="mt-1 text-xs text-slate-500">Your rating: {m.parentFeedback.rating}/5{m.parentFeedback.comment ? ` — ${m.parentFeedback.comment}` : ''}</p>
                    )}
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium capitalize text-slate-600">{statusLabel}</span>
                    {isCompleted && !m.parentFeedback?.submittedAt && (
                      <button onClick={() => openFeedback(m)} className="rounded-lg border border-violet-200 px-3 py-1 text-xs font-medium text-violet-700 hover:bg-violet-50">
                        Leave feedback
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Reschedule Modal */}
      {selectedMeeting && modalMode === 'reschedule' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} aria-hidden="true" />
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ptm-reschedule-title" className="relative bg-white w-full max-w-lg rounded-xl shadow-xl border p-5">
            <div className="mb-3">
              <h3 id="ptm-reschedule-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2"><ArrowLeftRight className="w-5 h-5"/> Request Reschedule</h3>
              <p className="text-sm text-gray-600">{getTeacherName(selectedMeeting)} • {getMeetingSubject(selectedMeeting)}</p>
            </div>
            {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
              <div>
                <label htmlFor="ptm-rs-date" className="text-sm text-gray-700">Preferred date (optional)</label>
                <input id="ptm-rs-date" type="date" value={rescheduleForm.date} onChange={e=>setRescheduleForm({...rescheduleForm, date:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2"/>
              </div>
              <div>
                <label htmlFor="ptm-rs-time" className="text-sm text-gray-700">Preferred time (optional)</label>
                <input id="ptm-rs-time" type="time" value={rescheduleForm.time} onChange={e=>setRescheduleForm({...rescheduleForm, time:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2"/>
              </div>
              <div className="sm:col-span-2">
                <label htmlFor="ptm-rs-reason" className="text-sm text-gray-700">Reason <span className="text-red-500">*</span></label>
                <textarea id="ptm-rs-reason" rows={3} value={rescheduleForm.reason} onChange={e=>setRescheduleForm({...rescheduleForm, reason:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Brief reason for rescheduling"/>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="px-3 py-2 rounded-lg border border-gray-300">Cancel</button>
              <button onClick={submitReschedule} disabled={loading} className="px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">Submit Request</button>
            </div>
          </div>
        </div>
      )}

      {/* Feedback Modal */}
      {selectedMeeting && modalMode === 'feedback' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={closeModal} aria-hidden="true" />
          <div ref={dialogRef} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="ptm-feedback-title" className="relative bg-white w-full max-w-lg rounded-xl shadow-xl border p-5">
            <div className="mb-3">
              <h3 id="ptm-feedback-title" className="text-lg font-semibold text-gray-900 flex items-center gap-2"><Star className="w-5 h-5"/> Meeting Feedback</h3>
              <p className="text-sm text-gray-600">{getTeacherName(selectedMeeting)} • {getMeetingSubject(selectedMeeting)}</p>
            </div>
            {error && <p role="alert" className="mb-3 text-sm text-red-600">{error}</p>}
            <div className="grid grid-cols-1 gap-3 mb-3">
              <div className="flex items-center gap-2" role="radiogroup" aria-label="Rating out of 5">
                <span className="text-sm text-gray-700">Rating:</span>
                {[1,2,3,4,5].map(r => (
                  <button
                    key={r}
                    type="button"
                    onClick={()=>setFeedbackForm({...feedbackForm, rating: r})}
                    aria-label={`${r} star${r > 1 ? 's' : ''}`}
                    aria-pressed={feedbackForm.rating === r}
                    className={`p-1 rounded ${feedbackForm.rating >= r ? 'text-yellow-500' : 'text-gray-300'}`}
                  >
                    <Star className="w-5 h-5 fill-current"/>
                  </button>
                ))}
              </div>
              <div>
                <label htmlFor="ptm-fb-comment" className="text-sm text-gray-700">Comments</label>
                <textarea id="ptm-fb-comment" rows={3} value={feedbackForm.comment} onChange={e=>setFeedbackForm({...feedbackForm, comment:e.target.value})} className="w-full border border-gray-300 rounded-lg px-3 py-2" placeholder="Share your feedback"/>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={closeModal} className="px-3 py-2 rounded-lg border border-gray-300">Cancel</button>
              <button onClick={submitFeedback} disabled={loading} className="px-3 py-2 rounded-lg bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50">Submit Feedback</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PTMPortal; 
