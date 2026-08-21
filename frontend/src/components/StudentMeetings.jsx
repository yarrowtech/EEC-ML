import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, Calendar, ExternalLink, Loader2, MapPin, Video } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const StudentMeetings = () => {
  const [meetings, setMeetings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const response = await fetch(`${API_BASE}/api/meeting/student/my-meetings`, {
          headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
        });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload?.error || 'Unable to load meetings');
        setMeetings(Array.isArray(payload) ? payload : []);
      } catch (err) {
        setError(err.message || 'Unable to load meetings');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const upcoming = useMemo(() => meetings.filter((item) => !['cancelled', 'completed'].includes(String(item.status).toLowerCase())), [meetings]);

  return (
    <div className="space-y-5 p-3 pb-24 md:p-5 md:pb-6">
      <header className="rounded-2xl border border-amber-100 bg-white p-5"><p className="text-xs font-bold uppercase tracking-wider text-amber-600">School meetings</p><h1 className="mt-1 text-2xl font-bold text-slate-900">Parent-Teacher Meetings</h1><p className="mt-2 text-sm text-slate-600">View meetings teachers have scheduled about your learning.</p></header>
      {error && <div className="flex gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"><AlertCircle className="h-5 w-5" />{error}</div>}
      {loading ? <div className="flex min-h-48 items-center justify-center text-slate-500"><Loader2 className="mr-2 h-5 w-5 animate-spin" />Loading meetings...</div> : upcoming.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">No upcoming meetings.</div> : <div className="grid gap-4 md:grid-cols-2">{upcoming.map((meeting) => <article key={meeting._id} className="rounded-2xl border border-slate-200 bg-white p-5"><div className="flex items-start justify-between gap-3"><div><p className="font-bold text-slate-900">{meeting.title || meeting.topic || 'Parent-Teacher Meeting'}</p><p className="mt-1 text-sm text-slate-600">With {meeting.teacherId?.name || 'Teacher'}</p></div><span className="rounded-full bg-amber-50 px-2.5 py-1 text-xs font-bold capitalize text-amber-700">{meeting.status || 'scheduled'}</span></div><div className="mt-4 space-y-2 text-sm text-slate-600"><p className="flex items-center gap-2"><Calendar className="h-4 w-4 text-amber-600" />{meeting.meetingDate ? new Date(meeting.meetingDate).toLocaleDateString() : 'Date TBA'} · {meeting.meetingTime || 'Time TBA'}</p><p className="flex items-center gap-2">{meeting.meetingType === 'Video Call' ? <Video className="h-4 w-4 text-indigo-600" /> : <MapPin className="h-4 w-4 text-indigo-600" />}{meeting.meetingType || 'In Person'}{meeting.location ? ` · ${meeting.location}` : ''}</p></div>{meeting.topic && <p className="mt-4 rounded-xl bg-slate-50 p-3 text-sm text-slate-700">Topic: {meeting.topic}</p>}{meeting.meetingType === 'Video Call' && meeting.meetingLink && <a href={meeting.meetingLink} target="_blank" rel="noreferrer" className="mt-4 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white">Join meeting <ExternalLink className="h-4 w-4" /></a>}</article>)}</div>}
    </div>
  );
};

export default StudentMeetings;
