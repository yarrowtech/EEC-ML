import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, Calendar, Users } from 'lucide-react';
import { formatStudentDisplay } from '../utils/studentDisplay';
import { parentApiFetch } from './parentApi';
import ChildSwitcher, { useSharedChildSelection } from './ChildSwitcher';

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
    return <div className="p-6 text-sm text-gray-600" aria-busy="true" aria-live="polite">Loading class routine…</div>;
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto w-full max-w-[1500px] space-y-5">
        <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5 shadow-sm sm:p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-violet-700" />
                <h1 className="text-xl font-semibold text-gray-900 sm:text-2xl">Children Class Routine</h1>
              </div>
              {selectedChild && (
                <p className="mt-2 text-sm text-gray-700">
                  {formatStudentDisplay({
                    studentName: selectedChild.studentName,
                    studentId: selectedChild.studentId,
                    roll: selectedChild.roll || selectedChild.rollNumber,
                    section: selectedChild.sectionName || selectedChild.section,
                  })}
                </p>
              )}
              <p className="mt-1 text-xs text-gray-600">
                Keep track of weekly schedule and class timings at a glance.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {lastFetchedAt && (
                <span className="rounded-lg bg-white/80 px-3 py-1.5 text-xs font-medium text-gray-600">
                  Updated {lastFetchedAt.toLocaleTimeString()}
                </span>
              )}
              <button
                onClick={() => fetchRoutine()}
                disabled={loading || isRefreshing}
                className="inline-flex items-center gap-1 rounded-lg border border-violet-300 bg-white px-3 py-1.5 text-sm font-medium text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {isRefreshing ? 'Refreshing...' : 'Refresh data'}
              </button>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="rounded-xl border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Weekly Classes</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{weeklyCount}</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Today ({todayName})</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{todayEntries.length}</p>
            </div>
            <div className="rounded-xl border border-white/80 bg-white/80 px-4 py-3">
              <p className="text-xs uppercase tracking-wide text-gray-500">Linked Children</p>
              <p className="mt-1 text-xl font-semibold text-gray-900">{children.length}</p>
            </div>
          </div>

          {error && (
            <div role="alert" className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>

        {childOptions.length > 0 && (
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
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-600">
              No linked children found for this parent account.
            </div>
          ) : !selectedChild ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-600">
              Select a child to view routine.
            </div>
          ) : weeklyCount === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-gray-50 px-4 py-8 text-sm text-gray-600">
              No routine assigned yet for{' '}
              {formatStudentDisplay({
                studentName: selectedChild.studentName,
                studentId: selectedChild.studentId,
                roll: selectedChild.roll || selectedChild.rollNumber,
                section: selectedChild.sectionName || selectedChild.section,
              })}.
            </div>
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
