import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Users } from 'lucide-react';
import { formatStudentDisplay } from '../utils/studentDisplay';
import { parentApiFetch } from './parentApi';
import ChildSwitcher, { useSharedChildSelection } from './ChildSwitcher';
import PageHeader from './PageHeader';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const normalizeDay = (value) => {
  if (!value) return null;
  const v = String(value).trim().toLowerCase();
  return DAYS.find((day) => day.toLowerCase() === v) || null;
};

const normalizeSchedule = (rawSchedule) => {
  const base = DAYS.reduce((acc, day) => {
    acc[day] = [];
    return acc;
  }, {});
  if (!rawSchedule || typeof rawSchedule !== 'object') return base;

  Object.entries(rawSchedule).forEach(([day, entries]) => {
    const normalizedDay = normalizeDay(day);
    if (!normalizedDay) return;
    base[normalizedDay] = Array.isArray(entries) ? entries : [];
  });
  return base;
};

const getTimeLabel = (entry, index) =>
  entry?.time || (entry?.period ? `Period ${entry.period}` : `Slot ${index + 1}`);

const ParentClassRoutine = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);

  const childOptions = useMemo(
    () => children.map((c) => ({ id: String(c.studentId || ''), name: c.studentName || 'Student' })),
    [children],
  );
  const [childKey, setChildKey, selectedOption] = useSharedChildSelection(childOptions);
  const selectedChildId = selectedOption?.id || '';

  const fetchRoutine = useCallback(async ({ initial = false } = {}) => {
    const token = localStorage.getItem('token');
    const userType = localStorage.getItem('userType');
    if (!token || userType !== 'Parent') {
      setError('Only parents can view children routines.');
      setChildren([]);
      setLoading(false);
      setIsRefreshing(false);
      return;
    }

    try {
      if (initial) {
        setLoading(true);
      } else {
        setIsRefreshing(true);
      }
      setError('');

      const res = await parentApiFetch('/api/parent/auth/routine', {}, navigate);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data?.error || 'Unable to load routine');
      }

      const list = (data?.children || []).map((child) => ({
        ...child,
        schedule: normalizeSchedule(child?.schedule),
      }));

      setChildren(list);
      setLastFetchedAt(new Date());
    } catch (err) {
      setError(err.message || 'Unable to load routine');
      setChildren([]);
    } finally {
      if (initial) {
        setLoading(false);
      } else {
        setIsRefreshing(false);
      }
    }
  }, [navigate]);

  useEffect(() => {
    fetchRoutine({ initial: true });
  }, [fetchRoutine]);

  const selectedChild = useMemo(
    () => children.find((child) => String(child.studentId) === String(selectedChildId)) || null,
    [children, selectedChildId]
  );

  const schedule = selectedChild?.schedule || {};
  const weeklySlots = useMemo(() => {
    const map = new Map();
    DAYS.forEach((day) => {
      (schedule[day] || []).forEach((entry, index) => {
        const time = getTimeLabel(entry, index);
        const order = Number(entry?.period || 999);
        if (!map.has(time) || order < map.get(time).order) {
          map.set(time, { time, order });
        }
      });
    });
    return Array.from(map.values()).sort((a, b) => (a.order === b.order ? a.time.localeCompare(b.time) : a.order - b.order));
  }, [schedule]);

  const weeklyMatrix = useMemo(() => {
    const matrix = {};
    DAYS.forEach((day) => {
      matrix[day] = {};
      (schedule[day] || []).forEach((entry, index) => {
        matrix[day][getTimeLabel(entry, index)] = entry;
      });
    });
    return matrix;
  }, [schedule]);

  const weeklyCount = useMemo(
    () => DAYS.reduce((sum, day) => sum + ((schedule[day] || []).length), 0),
    [schedule]
  );
  const todayName = useMemo(
    () => new Date().toLocaleDateString('en-US', { weekday: 'long' }),
    []
  );
  const todayEntries = schedule[todayName] || [];

  if (loading) {
    return <div className="p-4 sm:p-6 mx-auto w-full max-w-[1500px]"><Loading label="class routine" rows={3} /></div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1500px] space-y-5">
        <PageHeader
          title="Class Routine"
          icon={Calendar}
          subtitle={selectedChild
            ? formatStudentDisplay({
                studentName: selectedChild.studentName,
                studentId: selectedChild.studentId,
                roll: selectedChild.roll || selectedChild.rollNumber,
                section: selectedChild.sectionName || selectedChild.section,
              })
            : 'Weekly schedule and class timings at a glance.'}
          actions={(
            <button
              onClick={() => fetchRoutine()}
              disabled={loading || isRefreshing}
              className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:opacity-60"
            >
              {isRefreshing ? 'Refreshing…' : 'Refresh'}
            </button>
          )}
        >
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-xl bg-slate-50 px-3 py-2.5" data-flat>
              <p className="text-xs uppercase tracking-wide text-gray-500">Weekly classes</p>
              <p className="mt-0.5 text-lg font-semibold text-gray-900">{weeklyCount}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5" data-flat>
              <p className="text-xs uppercase tracking-wide text-gray-500">Today</p>
              <p className="mt-0.5 text-lg font-semibold text-gray-900">{todayEntries.length}</p>
            </div>
            <div className="rounded-xl bg-slate-50 px-3 py-2.5" data-flat>
              <p className="text-xs uppercase tracking-wide text-gray-500">Children</p>
              <p className="mt-0.5 text-lg font-semibold text-gray-900">{children.length}</p>
            </div>
          </div>
        </PageHeader>

        {error && <ErrorState message={error} />}

        {childOptions.length > 1 && (
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-gray-700">
              <Users className="h-4 w-4 text-violet-600" />
              Child
            </div>
            <ChildSwitcher options={childOptions} value={childKey} onChange={setChildKey} label="Child" />
          </div>
        )}

        <div className="space-y-4 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
          {children.length === 0 ? (
            <EmptyState icon={Users} title="No linked children" hint="This parent account isn't linked to any student yet." />
          ) : !selectedChild ? (
            <EmptyState icon={Users} title="Select a child" hint="Choose a child above to view their weekly routine." />
          ) : weeklyCount === 0 ? (
            <EmptyState icon={Calendar} title="No routine yet" hint="The class teacher hasn't set up a weekly timetable for this class." />
          ) : (
            <div className="overflow-x-auto rounded-xl border border-gray-200">
              <table className="w-full min-w-[980px] border-separate border-spacing-0">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 z-20 border-b border-r bg-gray-50 px-4 py-3 text-left text-sm font-semibold text-gray-700">Time</th>
                    {DAYS.map((day) => (
                      <th key={day} className="border-b px-4 py-3 text-left text-sm font-semibold text-gray-700">{day}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {weeklySlots.map((slot) => (
                    <tr key={slot.time} className="align-top">
                      <td className="sticky left-0 z-10 border-b border-r bg-gray-50 px-4 py-3 text-sm font-semibold text-gray-700">{slot.time}</td>
                      {DAYS.map((day) => {
                        const entry = weeklyMatrix[day]?.[slot.time];
                        return (
                          <td key={`${day}-${slot.time}`} className="border-b p-2.5">
                            {entry ? (
                              <div className="rounded-lg border border-violet-100 bg-violet-50/60 px-3 py-2">
                                <p className="text-sm font-semibold text-gray-900">{entry.subject || 'Subject'}</p>
                                <p className="mt-1 text-xs text-gray-600">{entry.instructor || 'TBA'}</p>
                                <p className="mt-1 text-xs text-gray-500">{entry.room || 'TBA'}</p>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-gray-200 px-3 py-2 text-center text-xs text-gray-400">--</div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ParentClassRoutine;
