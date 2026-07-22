import React, { useEffect, useMemo, useState } from 'react';
import { CalendarDays, PartyPopper, FileText, Loader, AlertCircle } from 'lucide-react';
import { CardShell, SectionHeader, Badge, MotionDiv, EmptyState, pageVariants, itemVariants } from './principalUi';

const API_BASE = import.meta.env.VITE_API_URL;

const formatDate = (value) =>
  new Date(value).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' });

const monthKey = (value) => {
  const d = new Date(value);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
};

const monthLabel = (key) => {
  const [year, month] = key.split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
};

const CalendarPage = () => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [events, setEvents] = useState([]);

  useEffect(() => {
    const fetchCalendar = async () => {
      setLoading(true);
      setError('');
      try {
        const token = localStorage.getItem('token');
        const res = await fetch(`${API_BASE}/api/principal/calendar`, {
          headers: { authorization: `Bearer ${token}` },
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || 'Failed to load calendar');
        }
        setEvents(Array.isArray(payload?.events) ? payload.events : []);
      } catch (err) {
        console.error('Calendar error:', err);
        setError(err.message || 'Unable to load calendar');
      } finally {
        setLoading(false);
      }
    };
    fetchCalendar();
  }, []);

  const groupedByMonth = useMemo(() => {
    const groups = new Map();
    events.forEach((event) => {
      const key = monthKey(event.date);
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push(event);
    });
    return Array.from(groups.entries()).sort(([a], [b]) => (a > b ? 1 : -1));
  }, [events]);

  return (
    <MotionDiv variants={pageVariants} initial="hidden" animate="show" className="space-y-6">
      <MotionDiv variants={itemVariants} className="rounded-2xl border border-slate-200 bg-slate-950 p-6 text-white shadow-xl sm:p-7">
        <h1 className="text-2xl font-semibold">Calendar</h1>
        <p className="mt-1 text-sm text-slate-300">Upcoming holidays and exam dates</p>
      </MotionDiv>

      {error && (
        <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          <AlertCircle size={16} /> {error}
        </div>
      )}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white py-16 text-slate-500">
          <Loader className="h-5 w-5 animate-spin" /> Loading calendar...
        </div>
      ) : groupedByMonth.length === 0 ? (
        <CardShell className="p-6">
          <EmptyState icon={CalendarDays} title="No upcoming events" description="Holidays and exam dates will appear here as they're scheduled." />
        </CardShell>
      ) : (
        <MotionDiv variants={itemVariants} className="space-y-5">
          {groupedByMonth.map(([key, monthEvents]) => (
            <CardShell key={key}>
              <SectionHeader icon={CalendarDays} title={monthLabel(key)} subtitle={`${monthEvents.length} event${monthEvents.length === 1 ? '' : 's'}`} />
              <div className="divide-y divide-slate-100">
                {monthEvents.map((event) => (
                  <div key={event.id} className="flex items-center justify-between gap-4 px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`rounded-lg p-2 ${event.type === 'holiday' ? 'bg-amber-50 text-amber-600' : 'bg-sky-50 text-sky-600'}`}>
                        {event.type === 'holiday' ? <PartyPopper size={16} /> : <FileText size={16} />}
                      </div>
                      <div>
                        <p className="text-sm font-medium text-slate-900">{event.title}</p>
                        <p className="text-xs text-slate-500">{formatDate(event.date)}</p>
                      </div>
                    </div>
                    <Badge tone={event.type === 'holiday' ? 'amber' : 'sky'}>
                      {event.type === 'holiday' ? 'Holiday' : 'Exam'}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardShell>
          ))}
        </MotionDiv>
      )}
    </MotionDiv>
  );
};

export default CalendarPage;
