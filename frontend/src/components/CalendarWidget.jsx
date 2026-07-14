import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, CalendarDays, ChevronLeft, ChevronRight, Loader2, Sparkles } from 'lucide-react';
import { fetchCachedJson } from '../utils/studentApiCache';

const toDateOnly = (value) => {
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return new Date(dt.getFullYear(), dt.getMonth(), dt.getDate());
};

const toISODate = (value) => {
  const dt = toDateOnly(value);
  if (!dt) return '';
  return `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
};

const expandHolidayToEvents = (holiday) => {
  const start = toDateOnly(holiday?.startDate || holiday?.date);
  const end = toDateOnly(holiday?.endDate || holiday?.startDate || holiday?.date);
  if (!start || !end || end < start) return [];

  const events = [];
  const cursor = new Date(start);
  while (cursor <= end) {
    events.push({
      id: `${holiday?._id || holiday?.id || holiday?.name || 'holiday'}-${toISODate(cursor)}`,
      date: toISODate(cursor),
      title: String(holiday?.name || 'Holiday').trim() || 'Holiday',
    });
    cursor.setDate(cursor.getDate() + 1);
  }
  return events;
};

const getDuration = (startVal, endVal) => {
  const s = toDateOnly(startVal);
  const e = toDateOnly(endVal || startVal);
  if (!s || !e) return '';
  const days = Math.round((e - s) / (1000 * 60 * 60 * 24)) + 1;
  return days === 1 ? '1 day' : `${days} days`;
};

const CalendarWidget = () => {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);
  const [holidays, setHolidays] = useState([]);
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastSynced, setLastSynced] = useState(null);

  useEffect(() => {
    const controller = new AbortController();

    const loadHolidays = async () => {
      try {
        setLoading(true);
        setError('');
        const token = localStorage.getItem('token');
        const userType = localStorage.getItem('userType');

        if (!token || userType !== 'Student') {
          setHolidays([]);
          setEvents([]);
          setLoading(false);
          return;
        }

        const { data } = await fetchCachedJson(`${import.meta.env.VITE_API_URL}/api/holidays/student`, {
          ttlMs: 10 * 60 * 1000,
          fetchOptions: {
            signal: controller.signal,
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
          },
        });

        const list = Array.isArray(data) ? data : [];
        const expanded = list.flatMap(expandHolidayToEvents);
        setHolidays(list);
        setEvents(expanded);
        setLastSynced(new Date());
      } catch (err) {
        if (err.name === 'AbortError') return;
        setError(err.message || 'Unable to load holidays for calendar.');
      } finally {
        setLoading(false);
      }
    };

    loadHolidays();
    return () => controller.abort();
  }, []);

  const monthNames = useMemo(
    () => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
    []
  );
  const daysOfWeek = useMemo(() => ['S', 'M', 'T', 'W', 'T', 'F', 'S'], []);

  const eventMap = useMemo(() => {
    const map = new Map();
    events.forEach((evt) => {
      if (!evt.date) return;
      if (!map.has(evt.date)) map.set(evt.date, []);
      map.get(evt.date).push(evt);
    });
    return map;
  }, [events]);

  const days = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const firstDay = new Date(year, month, 1);
    const startDate = new Date(firstDay);
    startDate.setDate(startDate.getDate() - firstDay.getDay());

    const grid = [];
    const cursor = new Date(startDate);
    for (let i = 0; i < 42; i += 1) {
      const dateKey = toISODate(cursor);
      grid.push({
        date: new Date(cursor),
        dateKey,
        isCurrentMonth: cursor.getMonth() === month,
        isToday: toISODate(cursor) === toISODate(new Date()),
        isWeekend: cursor.getDay() === 0 || cursor.getDay() === 6,
        events: eventMap.get(dateKey) || [],
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return grid;
  }, [currentDate, eventMap]);

  const monthlyUpcomingHolidays = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStart = new Date(year, month, 1);
    const monthEnd = new Date(year, month + 1, 0, 23, 59, 59, 999);
    const today = toDateOnly(new Date());

    return [...holidays]
      .filter((h) => {
        const start = toDateOnly(h?.startDate || h?.date);
        const end = toDateOnly(h?.endDate || h?.startDate || h?.date);
        if (!start || !end) return false;
        return end >= monthStart && start <= monthEnd && (!today || end >= today);
      })
      .sort((a, b) => new Date(a.startDate || a.date) - new Date(b.startDate || b.date));
  }, [holidays, currentDate]);

  const navigateMonth = (direction) => {
    const next = new Date(currentDate);
    next.setMonth(next.getMonth() + direction);
    setCurrentDate(next);
  };

  const goToToday = () => {
    setCurrentDate(new Date());
    setSelectedDate(new Date());
  };

  const selectedEvents = selectedDate ? (eventMap.get(toISODate(selectedDate)) || []) : [];

  return (
    <div className="bg-white rounded-3xl border border-purple-100 shadow-sm shadow-purple-100/50 overflow-hidden max-w-4xl mx-auto">

      {/* ── Header ── */}
      <div className="relative overflow-hidden bg-linear-to-br from-purple-500 via-purple-600 to-violet-700 px-5 pt-5 pb-4">
        <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/10" />
        <div className="pointer-events-none absolute -bottom-8 left-10 h-20 w-20 rounded-full bg-white/8" />
        <div className="relative z-10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/25 border border-white/40 shadow-sm">
              <CalendarDays className="w-4.5 h-4.5 text-white" size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-white leading-none">Holiday Calendar</h2>
              <p className="text-[11px] text-white/70 mt-0.5 leading-none">School holidays & breaks</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {lastSynced && (
              <span className="hidden sm:inline-flex items-center gap-1 text-[11px] font-medium text-white bg-white/20 border border-white/35 px-2.5 py-1 rounded-full backdrop-blur-sm">
                <Sparkles size={10} />
                Synced {lastSynced.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
              </span>
            )}
            <button
              type="button"
              onClick={goToToday}
              className="text-[11px] font-bold text-purple-700 bg-white hover:bg-white/90 px-3 py-1.5 rounded-full transition-colors shadow-sm"
            >
              Today
            </button>
          </div>
        </div>

        {error && (
          <div className="relative z-10 mt-3 flex items-center gap-2 text-xs text-red-600 bg-white/95 rounded-2xl px-3.5 py-2.5 shadow-sm">
            <AlertCircle size={13} className="shrink-0" />
            {error}
          </div>
        )}
      </div>

      <div className="p-5">

        {/* ── Month navigation ── */}
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => navigateMonth(-1)}
            type="button"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-purple-500 hover:bg-purple-50 hover:text-purple-700 transition-all"
          >
            <ChevronLeft size={18} />
          </button>

          <div className="text-center">
            <h3 className="text-base font-black text-gray-900 leading-none">
              {monthNames[currentDate.getMonth()]}
            </h3>
            <p className="text-xs text-gray-400 mt-0.5">{currentDate.getFullYear()}</p>
          </div>

          <button
            onClick={() => navigateMonth(1)}
            type="button"
            className="w-8 h-8 rounded-xl flex items-center justify-center text-purple-500 hover:bg-purple-50 hover:text-purple-700 transition-all"
          >
            <ChevronRight size={18} />
          </button>
        </div>

        {/* ── Day headers ── */}
        <div className="grid grid-cols-7 mb-1">
          {daysOfWeek.map((day, i) => (
            <div
              key={`${day}-${i}`}
              className={`text-center text-[11px] font-bold py-1.5 ${i === 0 || i === 6 ? 'text-red-400' : 'text-gray-400'}`}
            >
              {day}
            </div>
          ))}
        </div>

        {/* ── Calendar grid ── */}
        {loading ? (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <div className="w-9 h-9 rounded-2xl bg-purple-50 flex items-center justify-center">
              <Loader2 className="w-4 h-4 text-purple-500 animate-spin" />
            </div>
            <p className="text-xs text-gray-400">Loading calendar...</p>
          </div>
        ) : (
          <div className="grid grid-cols-7 gap-0.5 mb-5">
            {days.map((day, index) => {
              const isSelected = selectedDate && day.date.toDateString() === selectedDate.toDateString();
              const hasHoliday = day.events.length > 0;

              return (
                <button
                  key={`${day.dateKey}-${index}`}
                  onClick={() => setSelectedDate(day.date)}
                  type="button"
                  className={`
                    relative flex flex-col items-center py-1.5 rounded-xl transition-all group
                    ${!day.isCurrentMonth ? 'opacity-30' : ''}
                    ${isSelected ? 'bg-purple-600' : day.isToday ? 'bg-purple-50' : 'hover:bg-gray-50'}
                  `}
                >
                  {/* Date number */}
                  <span className={`
                    text-xs font-bold leading-none w-6 h-6 flex items-center justify-center rounded-full
                    ${day.isToday && !isSelected ? 'bg-purple-600 text-white' : ''}
                    ${isSelected ? 'text-white' : day.isWeekend && day.isCurrentMonth ? 'text-red-400' : 'text-gray-700'}
                  `}>
                    {day.date.getDate()}
                  </span>

                  {/* Holiday dot */}
                  {hasHoliday && (
                    <div className={`mt-1 w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-yellow-300' : 'bg-amber-400'}`} />
                  )}

                  {/* Tooltip on hover */}
                  {hasHoliday && !isSelected && (
                    <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-20 hidden group-hover:block pointer-events-none">
                      <div className="bg-gray-900 text-white text-[10px] font-medium px-2 py-1 rounded-lg whitespace-nowrap shadow-lg">
                        {day.events[0].title}
                        {day.events.length > 1 && ` +${day.events.length - 1}`}
                      </div>
                      <div className="w-2 h-2 bg-gray-900 rotate-45 mx-auto -mt-1" />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        {/* ── Selected date detail ── */}
        {selectedDate && !loading && (
          <div className={`mb-5 rounded-2xl border px-4 py-3 transition-all ${selectedEvents.length > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-100'}`}>
            <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">
              {selectedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
            {selectedEvents.length > 0 ? (
              <div className="space-y-1">
                {selectedEvents.map((evt) => (
                  <div key={evt.id} className="flex items-center gap-2">
                    <div className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                    <p className="text-sm font-semibold text-amber-800">{evt.title}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-gray-400">No holiday on this day</p>
            )}
          </div>
        )}

        {/* ── Upcoming holidays ── */}
        {!loading && (
          <div>
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-black text-gray-700 uppercase tracking-wider">Upcoming Holidays</h4>
              {monthlyUpcomingHolidays.length > 0 && (
                <span className="text-[11px] font-semibold text-purple-600 bg-purple-50 border border-purple-100 px-2 py-0.5 rounded-full">
                  {monthlyUpcomingHolidays.length}
                </span>
              )}
            </div>

            {monthlyUpcomingHolidays.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-6 gap-2 bg-gray-50 rounded-2xl border border-gray-100">
                <CalendarDays size={20} className="text-gray-300" />
                <p className="text-xs text-gray-400">No upcoming holidays in {monthNames[currentDate.getMonth()]}</p>
              </div>
            ) : (
              <div className="space-y-2">
                {monthlyUpcomingHolidays.map((holiday, idx) => {
                  const start = new Date(holiday.startDate || holiday.date);
                  const end = new Date(holiday.endDate || holiday.startDate || holiday.date);
                  const sameDay = toISODate(start) === toISODate(end);
                  const duration = getDuration(holiday.startDate || holiday.date, holiday.endDate || holiday.startDate || holiday.date);
                  const colors = ['border-l-purple-400', 'border-l-amber-400', 'border-l-rose-400', 'border-l-sky-400', 'border-l-emerald-400'];
                  const dotColors = ['bg-purple-400', 'bg-amber-400', 'bg-rose-400', 'bg-sky-400', 'bg-emerald-400'];

                  return (
                    <div
                      key={holiday._id || `${holiday.name}-${holiday.startDate}`}
                      className={`flex items-center justify-between rounded-2xl border border-gray-100 border-l-4 ${colors[idx % colors.length]} bg-white px-4 py-3 hover:shadow-sm transition-shadow`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className={`w-2 h-2 rounded-full shrink-0 ${dotColors[idx % dotColors.length]}`} />
                        <div className="min-w-0">
                          <p className="text-sm font-bold text-gray-800 truncate">{holiday.name}</p>
                          <p className="text-[11px] text-gray-400 mt-0.5">
                            {sameDay
                              ? start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
                              : `${start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })} – ${end.toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}`}
                          </p>
                        </div>
                      </div>
                      <span className="shrink-0 ml-3 text-[11px] font-semibold text-gray-400 bg-gray-50 border border-gray-100 px-2 py-1 rounded-lg">
                        {duration}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default CalendarWidget;
