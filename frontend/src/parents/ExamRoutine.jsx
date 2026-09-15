import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { UserCircle2, BookOpenText, CalendarClock, Download, Info, ChevronDown } from 'lucide-react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { parentApiJson } from './parentApi';
import { generateExamSchedulePdf } from '../utils/examRoutinePdf';
import ExamRoutineTable from '../components/ExamRoutineTable';
import ChildSwitcher, { useSharedChildSelection } from './ChildSwitcher';
import Loading from './Loading';
import { EmptyState, ErrorState } from './StateBlock';

const PREP_QUOTE = 'Preparation today, confident tomorrow!';

// "HH:mm" (24h, from a <input type="time">) → "h:mm AM/PM". Anything that
// doesn't parse as 24h time (already-formatted strings, free text) passes
// through unchanged rather than being mangled.
const to12Hour = (value) => {
  const raw = String(value || '').trim();
  const match = raw.match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return raw;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (!Number.isFinite(h) || !Number.isFinite(m)) return raw;
  const period = h >= 12 ? 'PM' : 'AM';
  const hh = ((h + 11) % 12) + 1;
  return `${hh}:${String(m).padStart(2, '0')} ${period}`;
};

const addMinutes = (time24, minutes) => {
  const match = String(time24 || '').trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!match || !Number.isFinite(Number(minutes))) return '';
  const total = Number(match[1]) * 60 + Number(match[2]) + Number(minutes);
  const wrapped = ((total % 1440) + 1440) % 1440;
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
};

const toRoutineRows = (group) => {
  const subjects = Array.isArray(group?.subjects) ? group.subjects : [];
  return subjects
    .map((exam) => {
      const date = exam?.date ? new Date(exam.date) : null;
      const validDate = date && !Number.isNaN(date.getTime());
      let time = '—';
      if (exam?.startTime && exam?.endTime) {
        time = `${to12Hour(exam.startTime)} – ${to12Hour(exam.endTime)}`;
      } else if (exam?.startTime) {
        time = to12Hour(exam.startTime);
      } else if (exam?.time) {
        const duration = exam?.duration ?? exam?.durationMinutes ?? null;
        const endTime24 = duration ? addMinutes(exam.time, duration) : '';
        time = endTime24 ? `${to12Hour(exam.time)} – ${to12Hour(endTime24)}` : to12Hour(exam.time);
      }

      return {
        rawDate: validDate ? date.getTime() : Number.MAX_SAFE_INTEGER,
        date: validDate ? date.toISOString() : null,
        day: validDate ? date.toLocaleDateString('en-US', { weekday: 'short' }) : '—',
        subject: exam?.subjectId?.name || exam?.subject || 'Subject',
        time,
        duration: exam?.duration ?? exam?.durationMinutes ?? null,
        building: exam?.roomId?.floorId?.buildingId?.name || '',
        floor: exam?.roomId?.floorId?.name || '',
        room: exam?.roomId?.roomNumber || '',
        venue: exam?.venue || '',
      };
    })
    .sort((a, b) => a.rawDate - b.rawDate);
};

// Groups (exam routines) → the distinct academic sessions they belong to,
// newest first, with whichever one the school has flagged isActive (falling
// back to the most recent) picked as the default "current" session.
const buildSessions = (groups) => {
  const byId = new Map();
  groups.forEach((group) => {
    const id = group.academicYearId ? String(group.academicYearId) : `__unknown_${group.academicYearName || 'session'}`;
    if (!byId.has(id)) {
      byId.set(id, { id, name: group.academicYearName || 'Unknown session', isActive: Boolean(group.academicYearIsActive) });
    } else if (group.academicYearIsActive) {
      byId.get(id).isActive = true;
    }
  });
  const sessions = Array.from(byId.values()).sort((a, b) => b.name.localeCompare(a.name, undefined, { numeric: true }));
  if (!sessions.some((s) => s.isActive) && sessions.length) sessions[0].isActive = true;
  return sessions;
};

const ExamRoutine = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState('');
  const [openGroupId, setOpenGroupId] = useState('');

  const childOptions = useMemo(
    () => children.map((c) => ({ id: String(c.studentId || ''), name: c.studentName || 'Student' })),
    [children],
  );
  const [childKey, setChildKey, selectedOption] = useSharedChildSelection(childOptions);
  const selectedStudentId = selectedOption?.id || '';

  const loadSchedules = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await parentApiJson('/api/exam/groups/parent-schedule', {}, navigate);
      setChildren(Array.isArray(data?.children) ? data.children : []);
    } catch (err) {
      setError(err.message || 'Unable to load exam routine');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSchedules();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedChild = useMemo(
    () => children.find((c) => String(c.studentId) === String(selectedStudentId)) || null,
    [children, selectedStudentId],
  );

  const groups = Array.isArray(selectedChild?.groups) ? selectedChild.groups : [];
  const sessions = useMemo(() => buildSessions(groups), [groups]);

  // Default to the active (current) session whenever the child or their
  // session list changes, so switching kids never leaves a stale pick behind.
  useEffect(() => {
    const active = sessions.find((s) => s.isActive) || sessions[0] || null;
    setSelectedSessionId(active?.id || '');
  }, [selectedStudentId, sessions.map((s) => s.id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const sessionGroups = useMemo(() => {
    if (!selectedSessionId) return [];
    return groups
      .filter((group) => {
        const id = group.academicYearId ? String(group.academicYearId) : `__unknown_${group.academicYearName || 'session'}`;
        return id === selectedSessionId;
      })
      .sort((a, b) => new Date(a.startDate || 0) - new Date(b.startDate || 0));
  }, [groups, selectedSessionId]);

  // Accordion: only the first routine in the session is open by default —
  // re-fold everything when the session (or child) switches to a new list.
  useEffect(() => {
    setOpenGroupId(sessionGroups[0]?._id ? String(sessionGroups[0]._id) : '');
  }, [sessionGroups.map((g) => g._id).join(',')]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDownload = async (group) => {
    setIsExporting(true);
    try {
      await generateExamSchedulePdf(group);
    } catch (err) {
      toast.error('Failed to generate routine PDF');
    } finally {
      setIsExporting(false);
    }
  };

  if (loading) {
    return <div className="space-y-4"><Loading label="exam routine" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Student summary card */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-violet-100 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-3">
          <UserCircle2 className="h-12 w-12 text-violet-300" strokeWidth={1.2} />
          <div>
            <p className="text-base font-bold text-slate-800">{selectedChild?.studentName || 'Student'}</p>
            <p className="text-sm text-slate-500">
              {selectedChild?.grade ? `Class ${selectedChild.grade}` : 'Class —'}
              {selectedChild?.section ? ` • Section ${selectedChild.section}` : ''}
            </p>
            {childOptions.length > 1 && (
              <ChildSwitcher options={childOptions} value={childKey} onChange={setChildKey} className="mt-2" />
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 text-right text-sm italic text-violet-500">
          <p className="max-w-55">“{PREP_QUOTE}”</p>
          <BookOpenText className="h-8 w-8 shrink-0 text-violet-200" strokeWidth={1.2} />
        </div>
      </div>

      {!error && sessions.length > 0 && (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 shadow-sm">
          <label htmlFor="exam-session-select" className="mb-1.5 block text-sm font-bold text-slate-700">
            Select Academic Session
          </label>
          <div className="relative max-w-sm">
            <select
              id="exam-session-select"
              value={selectedSessionId}
              onChange={(e) => setSelectedSessionId(e.target.value)}
              className="w-full appearance-none rounded-xl border border-violet-200 bg-white px-3 py-2.5 pr-9 text-sm font-medium text-slate-800 outline-none transition focus:border-violet-400 focus:ring-2 focus:ring-violet-100"
            >
              {sessions.map((session) => (
                <option key={session.id} value={session.id}>
                  {session.name} {session.isActive ? '(Current)' : '(Previous)'}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
      )}

      {error && <ErrorState message={error} onRetry={loadSchedules} />}

      {!error && sessions.length === 0 && (
        <EmptyState
          title="No exam schedule published yet"
          hint="Once the school publishes an exam routine for this class, it will appear here."
          icon={CalendarClock}
        />
      )}

      {!error && sessions.length > 0 && sessionGroups.length === 0 && (
        <EmptyState
          title="No exam routine for this session"
          hint="Try selecting a different academic session above."
          icon={CalendarClock}
        />
      )}

      {!error && sessionGroups.map((group) => {
        const groupId = String(group._id);
        const isOpen = openGroupId === groupId;
        return (
          <div key={groupId} className="overflow-hidden rounded-2xl border border-emerald-100 shadow-sm">
            <div
              role="button"
              tabIndex={0}
              onClick={() => setOpenGroupId(isOpen ? '' : groupId)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpenGroupId(isOpen ? '' : groupId); } }}
              aria-expanded={isOpen}
              className="flex w-full flex-wrap items-center justify-between gap-2 bg-emerald-600 px-4 py-3 text-left text-white cursor-pointer select-none"
            >
              <div>
                <h3 className="text-base font-bold">{group.title || 'Exam'}</h3>
                <p className="text-xs text-emerald-50/90">
                  Session: {group.academicYearName || '—'}
                  {'  |  '}Class {group.classId?.name || '—'}
                  {'  |  '}Section {group.sectionId?.name || '—'}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDownload(group); }}
                  disabled={isExporting}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold text-emerald-700 shadow-sm transition hover:bg-emerald-50 disabled:opacity-50"
                >
                  <Download size={14} />
                  Download PDF
                </button>
                <ChevronDown
                  size={18}
                  className={`shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
                />
              </div>
            </div>
            <AnimatePresence initial={false}>
              {isOpen && (
                <Motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.2, ease: 'easeInOut' }}
                  style={{ overflow: 'hidden' }}
                >
                  <ExamRoutineTable rows={toRoutineRows(group)} />
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        );
      })}

      {!error && sessionGroups.length > 0 && (
        <div className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50/60 p-3.5 text-sm text-slate-600">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-violet-500" />
          <p><span className="font-bold text-slate-700">Important Note: </span>
            Please make sure your child reaches the exam venue at least 15 minutes before the scheduled time.
          </p>
        </div>
      )}
    </div>
  );
};

export default ExamRoutine;
