import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Clock, Video, Phone, Users, Bell, Check, X, ArrowLeftRight, Star, ExternalLink, Copy, ShieldCheck } from 'lucide-react';
import { parentApiJson } from './parentApi';
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
  const [activeTab, setActiveTab] = useState('meetings'); // meetings | requests | video | history
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
  const videoEligible = useMemo(
    () => meetings.filter((m) => ['confirmed', 'scheduled', 'pending'].includes(String(m.status || '').toLowerCase())),
    [meetings],
  );

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
  const isHistoryStatus = (status) => !isPendingStatus(status) && !isConfirmedStatus(status);

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

  const upcomingMeetings = useMemo(
    () => meetings.filter((m) => isPendingStatus(m.status) || isConfirmedStatus(m.status)),
    [meetings]
  );
  const pendingRequests = useMemo(
    () => meetings.filter((m) => isPendingStatus(m.status) || isRescheduleStatus(m.status)),
    [meetings]
  );
  const historyMeetings = useMemo(
    () => meetings.filter((m) => isHistoryStatus(m.status)),
    [meetings]
  );

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

  return (
    <div className="p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-yellow-400 to-yellow-500 rounded-xl p-6 mb-6 text-white">
        <h1 className="text-3xl font-bold mb-2">Parent-Teacher Meetings</h1>
        <p className="text-yellow-100">View and respond to meeting requests</p>
      </div>

      {error && (
        <div role="alert" className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-4">
        {[
          { key: 'meetings', label: 'Meetings' },
          { key: 'requests', label: 'Requests' },
          { key: 'video', label: 'Video Meeting' },
          { key: 'history', label: 'History' },
        ].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-3 py-1.5 rounded-lg text-sm border ${activeTab === t.key ? 'bg-yellow-500 text-black border-yellow-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}>
            {t.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Upcoming Meetings */}
        <div className="lg:col-span-2 space-y-6">
          {activeTab === 'meetings' && (
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Upcoming Meetings</h2>
            </div>
            <div className="p-4 space-y-4">
              {loading && upcomingMeetings.length === 0 && (
                <div className="py-6 text-center text-gray-500">Loading meetings...</div>
              )}
              {!loading && upcomingMeetings.length === 0 && (
                <div className="py-6 text-center text-gray-500">No meetings scheduled yet.</div>
              )}
              {upcomingMeetings.map((meeting) => {
                  const meetingId = getMeetingId(meeting);
                  const pending = isPendingStatus(meeting.status);
                  const confirmed = isConfirmedStatus(meeting.status);
                  const agendaItems = getMeetingAgenda(meeting);
                  const meetingType = getMeetingTypeLabel(meeting);
                  const meetingDateLabel = getMeetingDate(meeting);
                  const meetingTimeLabel = getMeetingTime(meeting);
                  const teacherName = getTeacherName(meeting);
                  const subjectLabel = getMeetingSubject(meeting);
                  const studentLabel = getStudentLabel(meeting);

                  return (
                    <div
                      key={meetingId || subjectLabel}
                      className="bg-white border border-gray-200 rounded-lg p-4 hover:border-yellow-500 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <h3 className="font-medium text-gray-800">
                              Meeting with {teacherName}
                            </h3>
                            {pending && (
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                                New
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-gray-500">{subjectLabel}</p>
                          {studentLabel && (
                            <p className="text-xs text-gray-400">{studentLabel}</p>
                          )}
                          <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center space-x-1">
                              <Calendar className="w-4 h-4" />
                              <span>{meetingDateLabel || 'TBA'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              <Clock className="w-4 h-4" />
                              <span>{meetingTimeLabel || 'TBA'}</span>
                            </div>
                            <div className="flex items-center space-x-1">
                              {getMeetingTypeIcon(meetingType)}
                              <span>{meetingType}</span>
                            </div>
                          </div>
                          {agendaItems?.length ? (
                            <div className="text-sm text-gray-600">
                              <span className="font-medium">Agenda:</span> {agendaItems.join(', ')}
                            </div>
                          ) : null}
                        </div>

                        {pending && (
                          <div className="flex flex-wrap items-center gap-2 justify-end">
                            <button
                              onClick={() => handleResponse(meeting, 'accept')}
                              aria-label="Confirm meeting"
                              className="p-2 rounded-full bg-green-100 text-green-600 hover:bg-green-200 transition-colors"
                            >
                              <Check className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleRescheduleRequest(meeting)}
                              className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
                            >
                              Reschedule
                            </button>
                            <button
                              onClick={() => handleResponse(meeting, 'decline')}
                              aria-label="Decline meeting"
                              className="p-2 rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                            >
                              <X className="w-4 h-4" />
                            </button>
                          </div>
                        )}

                        {confirmed && (
                          <div className="flex items-center gap-2">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Confirmed
                            </span>
                            <button
                              onClick={() => handleRescheduleRequest(meeting)}
                              className="px-3 py-1.5 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold hover:bg-blue-50"
                            >
                              Reschedule
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          </div>
          )}

          {activeTab === 'requests' && (
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Pending Requests</h2>
              </div>
              <div className="p-4 space-y-4">
                {pendingRequests.length === 0 && (
                  <p className="text-sm text-gray-500">No pending requests.</p>
                )}
                {pendingRequests.map((m) => {
                    const meetingId = getMeetingId(m);
                    const meetingType = getMeetingTypeLabel(m);
                    const meetingDateLabel = getMeetingDate(m);
                    const meetingTimeLabel = getMeetingTime(m);
                    const subjectLabel = getMeetingSubject(m);
                    const teacherName = getTeacherName(m);
                    return (
                      <div key={meetingId || subjectLabel} className="border rounded-lg p-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-gray-800">{teacherName} • {subjectLabel}</p>
                            <p className="text-sm text-gray-600">
                              {meetingDateLabel || 'TBA'} at {meetingTimeLabel || 'TBA'} • {meetingType}
                            </p>
                            {m.rescheduleRequest?.requestedAt && (
                              <p className="text-xs text-blue-700 mt-1">
                                Your reschedule request:
                                {m.rescheduleRequest.requestedDate ? ` ${formatMeetingDate(m.rescheduleRequest.requestedDate)}` : ' (no date given)'}
                                {m.rescheduleRequest.requestedTime ? ` at ${m.rescheduleRequest.requestedTime}` : ''}
                                {m.rescheduleRequest.reason ? ` — ${m.rescheduleRequest.reason}` : ''}
                              </p>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <button onClick={() => handleResponse(m, 'accept')} className="px-3 py-1 rounded-lg bg-green-600 text-white text-sm">Accept</button>
                            <button onClick={() => handleRescheduleRequest(m)} className="px-3 py-1 rounded-lg border border-blue-300 text-blue-700 text-sm">Reschedule</button>
                            <button onClick={() => handleResponse(m, 'decline')} className="px-3 py-1 rounded-lg bg-red-600 text-white text-sm">Decline</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {activeTab === 'video' && (
            <div className="bg-white rounded-xl shadow-sm p-4">
              <h2 className="text-lg font-semibold text-gray-800 mb-1">Video Meeting</h2>
              <p className="text-xs text-gray-500 mb-3">
                Pick a scheduled meeting to join its private room. Your child&apos;s teacher joins the same room from their portal.
              </p>
              <p className="mb-3 flex items-start gap-1.5 rounded-lg bg-emerald-50 px-3 py-2 text-xs text-emerald-700">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                Each meeting has its own unlisted room. You&apos;ll wait in a lobby until the teacher admits you.
              </p>
              {videoEligible.length === 0 ? (
                <div className="h-[200px] flex items-center justify-center text-gray-500 text-sm">
                  You have no scheduled meetings to join.
                </div>
              ) : (
                <>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3">
                    <label htmlFor="ptm-video-meeting" className="sr-only">Select meeting</label>
                    <select
                      id="ptm-video-meeting"
                      value={videoMeetingId}
                      onChange={(e) => { setVideoMeetingId(e.target.value); setJitsiActive(false); }}
                      className="border border-gray-300 rounded-lg px-3 py-2 md:col-span-2"
                    >
                      <option value="">Select a meeting…</option>
                      {videoEligible.map((m) => (
                        <option key={getMeetingId(m)} value={getMeetingId(m)}>
                          {getTeacherName(m)} — {getMeetingDate(m) || 'TBA'} {getMeetingTime(m)}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() => setJitsiActive(true)}
                      disabled={!videoRoom}
                      className={`px-3 py-2 rounded-lg ${videoRoom ? 'bg-yellow-500 text-black hover:bg-yellow-600' : 'bg-gray-100 text-gray-400'}`}
                    >
                      Join room
                    </button>
                  </div>
                  {videoRoom && (
                    <div className="flex items-center gap-2 mb-3">
                      <button onClick={() => window.open(`${jitsiUrl}${JITSI_ROOM_CONFIG}`, '_blank', 'noopener')} className="text-sm inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300">
                        <ExternalLink className="w-4 h-4" /> Open in new tab
                      </button>
                      <button onClick={() => copyToClipboard(`${jitsiUrl}${JITSI_ROOM_CONFIG}`)} className="text-sm inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-gray-300">
                        <Copy className="w-4 h-4" /> Copy link
                      </button>
                    </div>
                  )}
                  <div className="rounded-lg overflow-hidden border border-gray-200">
                    {jitsiActive && videoRoom ? (
                      <iframe
                        title="PTM Video Meeting"
                        src={`${jitsiUrl}${JITSI_ROOM_CONFIG}`}
                        className="w-full h-[480px]"
                        allow="camera; microphone; fullscreen; display-capture"
                      />
                    ) : (
                      <div className="h-[240px] flex items-center justify-center text-gray-500 text-sm">
                        Select a meeting and click Join room.
                      </div>
                    )}
                  </div>
                </>
              )}
              <p className="mt-2 text-xs text-gray-500">Video meetings are powered by Jitsi Meet. By joining, you agree to Jitsi&apos;s terms of service.</p>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="bg-white rounded-xl shadow-sm">
              <div className="p-4 border-b border-gray-200">
                <h2 className="text-lg font-semibold text-gray-800">Past Meetings</h2>
              </div>
              <div className="p-4 space-y-3">
                {historyMeetings.length === 0 && (
                  <p className="text-sm text-gray-500">No past meetings recorded.</p>
                )}
                {historyMeetings.map((m) => {
                  const meetingId = getMeetingId(m);
                  const meetingDateLabel = getMeetingDate(m);
                  const meetingTimeLabel = getMeetingTime(m);
                  const subjectLabel = getMeetingSubject(m);
                  const statusLabel = normalizeStatus(m.status).replace(/_/g, ' ');
                  const isCompleted = normalizeStatus(m.status) === 'completed';
                  return (
                    <div key={meetingId || subjectLabel} className="border rounded-lg p-3">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-medium text-gray-800">{getTeacherName(m)} • {subjectLabel}</p>
                          <p className="text-sm text-gray-600">{meetingDateLabel || 'TBA'} at {meetingTimeLabel || 'TBA'}</p>
                          {m.parentFeedback?.submittedAt && (
                            <p className="text-xs text-yellow-700">Your rating: {m.parentFeedback.rating}/5{m.parentFeedback.comment ? ` — ${m.parentFeedback.comment}` : ''}</p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-gray-100 text-gray-700 capitalize">{statusLabel}</span>
                          {isCompleted && !m.parentFeedback?.submittedAt && (
                            <button onClick={() => openFeedback(m)} className="text-xs px-3 py-1 rounded-lg border border-yellow-300 text-yellow-700 hover:bg-yellow-50">
                              Leave feedback
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Notifications & Calendar */}
        <div className="space-y-6">
          {/* Recent Notifications */}
          <div className="bg-white rounded-xl shadow-sm">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-800">Notifications</h2>
            </div>
            <div className="p-4">
              <div className="space-y-4">
                {meetings.slice(0, 5).map((meeting) => {
                  const meetingId = getMeetingId(meeting);
                  const pending = isPendingStatus(meeting.status);
                  const meetingDateLabel = getMeetingDate(meeting);
                  const meetingTimeLabel = getMeetingTime(meeting);
                  return (
                    <div
                      key={meetingId || meetingDateLabel}
                      className={`flex items-start space-x-3 p-3 rounded-lg ${
                        pending ? 'bg-yellow-50' : 'bg-gray-50'
                      }`}
                    >
                      <Bell className={`w-5 h-5 ${
                        pending ? 'text-yellow-500' : 'text-gray-400'
                      }`} />
                      <div>
                        <p className="text-sm text-gray-800">
                          {pending ? 'New meeting scheduled' : 'Meeting update'} from {getTeacherName(meeting)}
                        </p>
                        <p className="text-xs text-gray-500">
                          {meetingDateLabel || 'Date TBA'} {meetingTimeLabel ? `• ${meetingTimeLabel}` : ''}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {meetings.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No notifications yet.</p>
                )}
              </div>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Overview</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500">Upcoming</p>
                <p className="text-2xl font-semibold text-yellow-600">
                  {upcomingMeetings.length}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pending</p>
                <p className="text-2xl font-semibold text-yellow-600">
                  {pendingRequests.length}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

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
              <button onClick={submitReschedule} disabled={loading} className="px-3 py-2 rounded-lg bg-blue-600 text-white disabled:opacity-50">Submit Request</button>
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
              <button onClick={submitFeedback} disabled={loading} className="px-3 py-2 rounded-lg bg-yellow-500 text-black disabled:opacity-50">Submit Feedback</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PTMPortal; 
