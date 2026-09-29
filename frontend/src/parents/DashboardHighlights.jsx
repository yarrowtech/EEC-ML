import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight, BookOpen, CalendarClock, Megaphone } from 'lucide-react';
import { parentApiJson } from './parentApi';
import useParentChildren from './useParentChildren';

// Dashboard strip for the selected child: next exam, recent homework and the
// latest school notices, each linking to its full screen.
const fmt = (d) => (d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '');

const Card = ({ icon: Icon, tone, title, to, children }) => (
  <section className="flex h-full flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
    <div className="mb-3 flex items-center justify-between">
      <h3 className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-500">
        <Icon size={14} className={tone} /> {title}
      </h3>
      <Link to={to} className="inline-flex items-center gap-0.5 text-xs font-semibold text-violet-700 hover:underline">
        View all <ArrowRight size={12} />
      </Link>
    </div>
    <div className="flex-1">{children}</div>
  </section>
);

const Empty = ({ text }) => <p className="rounded-lg bg-slate-50 py-4 text-center text-sm text-slate-400">{text}</p>;

const DashboardHighlights = () => {
  const { selected } = useParentChildren();
  const [homework, setHomework] = useState([]);
  const [examChildren, setExamChildren] = useState([]);
  const [notices, setNotices] = useState([]);

  useEffect(() => {
    let cancelled = false;
    Promise.allSettled([
      parentApiJson('/api/exam/groups/parent-schedule'),
      parentApiJson('/api/notifications/user?kind=notice'),
    ]).then(([e, n]) => {
      if (cancelled) return;
      setExamChildren(e.status === 'fulfilled' ? (e.value?.children || []) : []);
      setNotices(n.status === 'fulfilled' && Array.isArray(n.value) ? n.value : []);
    });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!selected?.id) return undefined;
    let cancelled = false;
    parentApiJson(`/api/assignment/parent/assignments?studentId=${encodeURIComponent(selected.id)}`)
      .then((data) => { if (!cancelled) setHomework(Array.isArray(data) ? data : []); })
      .catch(() => { if (!cancelled) setHomework([]); });
    return () => { cancelled = true; };
  }, [selected?.id]);

  const nextExams = useMemo(() => {
    const child = examChildren.find((c) => String(c.studentId) === String(selected?.id)) || examChildren[0];
    const today = new Date(new Date().toDateString());
    const rows = [];
    (child?.groups || []).forEach((g) => (g.subjects || []).forEach((s) => {
      const d = s.date ? new Date(s.date) : null;
      if (d && !Number.isNaN(d.getTime()) && d >= today) {
        rows.push({ date: d, title: g.title || 'Exam', subject: s.subject?.name || s.subjectName || s.subject || '' });
      }
    }));
    return rows.sort((a, b) => a.date - b.date).slice(0, 3);
  }, [examChildren, selected?.id]);

  const recentHomework = useMemo(
    () => homework.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3),
    [homework],
  );
  const latestNotices = useMemo(
    () => notices.slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0)).slice(0, 3),
    [notices],
  );

  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
      <Card icon={CalendarClock} tone="text-violet-600" title="Upcoming exams" to="/parents/exam-routine">
        {nextExams.length === 0 ? <Empty text="No upcoming exams" /> : (
          <ul className="space-y-2">
            {nextExams.map((x, i) => (
              <li key={i} className="flex items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
                <span className="min-w-0 truncate text-sm font-medium text-slate-800">{x.subject ? `${x.subject} — ` : ''}{x.title}</span>
                <span className="shrink-0 text-xs font-semibold text-violet-700">{fmt(x.date)}</span>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card icon={BookOpen} tone="text-emerald-600" title="Recent homework" to="/parents/homework">
        {recentHomework.length === 0 ? <Empty text="No homework yet" /> : (
          <ul className="space-y-2">
            {recentHomework.map((a) => (
              <li key={a._id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="truncate text-sm font-medium text-slate-800">{a.subject?.name || a.subjectName || a.subject || 'General'} — {a.title}</p>
                <p className="text-xs text-slate-500">Due {fmt(a.dueDate) || '—'} · {a.submissionStatus === 'not_submitted' || !a.submissionStatus ? 'Pending' : 'Submitted'}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Card icon={Megaphone} tone="text-amber-600" title="Latest notices" to="/parents/notices">
        {latestNotices.length === 0 ? <Empty text="No notices" /> : (
          <ul className="space-y-2">
            {latestNotices.map((n) => (
              <li key={n._id} className="rounded-lg bg-slate-50 px-3 py-2">
                <p className="truncate text-sm font-medium text-slate-800">{n.title}</p>
                <p className="text-xs text-slate-500">{fmt(n.createdAt)}{n.typeLabel ? ` · ${n.typeLabel}` : ''}</p>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
};

export default DashboardHighlights;
