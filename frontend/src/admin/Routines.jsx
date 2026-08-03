import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import jsPDF from 'jspdf';
import Swal from 'sweetalert2';
import {
  Calendar, LayoutGrid, BookOpen, User, Download, Trash2,
  Search, X, AlertCircle, Loader2, ChevronRight, Pencil, Plus,
  Clock, CheckCircle2, Sparkles, FileText, ChevronDown,
} from 'lucide-react';
import {
  timetableApi, academicApi, transformTimetablesToRoutines,
  convertTo12Hour, convertTo24Hour,
} from './utils/timetableApi';

/* ─── constants ─── */
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const DAY_META = {
  Monday:    { color: '#ef4444', light: '#fef2f2', ring: '#fca5a5' },
  Tuesday:   { color: '#10b981', light: '#ecfdf5', ring: '#6ee7b7' },
  Wednesday: { color: '#f59e0b', light: '#fffbeb', ring: '#fcd34d' },
  Thursday:  { color: '#3b82f6', light: '#eff6ff', ring: '#93c5fd' },
  Friday:    { color: '#8b5cf6', light: '#f5f3ff', ring: '#c4b5fd' },
  Saturday:  { color: '#6366f1', light: '#eef2ff', ring: '#a5b4fc' },
};

const CELL_TYPES = [
  { value: 'academic',  label: 'Academic',      bg: '#eff6ff', border: '#bfdbfe', text: '#1e40af' },
  { value: 'assembly',  label: 'Assembly/CTP',  bg: '#f0fdf4', border: '#bbf7d0', text: '#166534' },
  { value: 'it',        label: 'IT / Lab',       bg: '#fff7ed', border: '#fed7aa', text: '#9a3412' },
  { value: 'games',     label: 'Games / PE',     bg: '#f0fdf4', border: '#bbf7d0', text: '#14532d' },
  { value: 'art',       label: 'Art / Library',  bg: '#fdf4ff', border: '#e9d5ff', text: '#6b21a8' },
  { value: 'robotics',  label: 'Robotics',       bg: '#fefce8', border: '#fef08a', text: '#713f12' },
  { value: 'clubs',     label: 'Clubs',          bg: '#fdf2f8', border: '#fbcfe8', text: '#831843' },
];
const CELL_TYPE_MAP = Object.fromEntries(CELL_TYPES.map(t => [t.value, t]));

/* ─── helpers ─── */
const getId = v => (v && typeof v === 'object' ? v._id : v);

const normDay = v => {
  const m = {
    mon:'Monday', monday:'Monday', tue:'Tuesday', tuesday:'Tuesday',
    wed:'Wednesday', wednesday:'Wednesday', thu:'Thursday', thursday:'Thursday',
    fri:'Friday', friday:'Friday', sat:'Saturday', saturday:'Saturday',
  };
  return m[String(v).trim().toLowerCase()] || String(v).trim();
};

const to24 = s => {
  if (!s) return '';
  if (/^\d{2}:\d{2}$/.test(s)) return s;
  try { return convertTo24Hour(s); } catch { return ''; }
};

const to12 = t => { try { return t ? convertTo12Hour(t) : ''; } catch { return t || ''; } };

const fmtRange = (s, e) => (s && e ? `${to12(s)} – ${to12(e)}` : '');

/* Extract startTime + endTime from a schedule entry robustly */
const entryTimes = entry => {
  if (entry.startTime && entry.endTime) return { startTime: entry.startTime, endTime: entry.endTime };
  if (entry.time) {
    const parts = entry.time.split(' - ').map(p => p.trim());
    return { startTime: to24(parts[0]) || '', endTime: to24(parts[1]) || '' };
  }
  return { startTime: '', endTime: '' };
};

/* ─── TeacherPicker ─── */
const TeacherPicker = ({ value, teachers, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  const sorted = useMemo(() => [...teachers].sort((a, b) => (a.name || '').localeCompare(b.name || '')), [teachers]);
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? sorted.filter(t => (t.name || '').toLowerCase().includes(q)) : sorted;
  }, [sorted, query]);

  useEffect(() => {
    if (!open) return;
    const h = e => { if (ref.current && !ref.current.contains(e.target)) { setOpen(false); setQuery(''); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  return (
    <div className="relative" ref={ref}>
      <div className="relative">
        <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
        <input
          type="text"
          value={open ? query : (value || '')}
          onChange={e => { setQuery(e.target.value); if (!open) setOpen(true); }}
          onFocus={() => { setOpen(true); setQuery(''); }}
          placeholder="Search teacher…"
          className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-8 pr-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100"
        />
      </div>
      <AnimatePresence>
        {open && (
          <Motion.div
            initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.12 }}
            className="absolute z-30 mt-1 w-full max-h-44 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-lg"
          >
            {value && (
              <button type="button" onClick={() => { onChange(''); setOpen(false); }}
                className="w-full text-left px-3 py-1.5 text-xs text-slate-400 hover:bg-slate-50 border-b border-slate-100">
                Clear
              </button>
            )}
            {filtered.length === 0 && <div className="px-3 py-2 text-xs text-slate-400">No match</div>}
            {filtered.map(t => (
              <button key={t._id} type="button"
                onClick={() => { onChange(t.name); setOpen(false); setQuery(''); }}
                className={`w-full text-left px-3 py-2 text-sm transition-colors ${value === t.name ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}>
                {t.name}
              </button>
            ))}
          </Motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ─── CellEditor ─── */
const CellEditor = ({ ctx, subjects, teachers, classSectionRows, saving, onSave, onDelete, onClose }) => {
  const existingTimes = ctx.cell ? entryTimes(ctx.cell) : { startTime: '', endTime: '' };
  const [startTime, setStartTime] = useState(ctx.period?.startTime || existingTimes.startTime || '');
  const [endTime, setEndTime]     = useState(ctx.period?.endTime   || existingTimes.endTime   || '');
  const [subject, setSubject]     = useState(ctx.cell?.subject || '');
  const [teacher, setTeacher]     = useState(ctx.cell?.teacher === '-' ? '' : (ctx.cell?.teacher || ''));
  const [type, setType]           = useState(ctx.cell?.type || 'academic');

  const isNew = !ctx.period?.startTime;
  const dayMeta = DAY_META[ctx.day] || DAY_META.Monday;
  const classSubjects = useMemo(
    () => subjects.filter(s => String(s.classId) === String(ctx.classId)),
    [subjects, ctx.classId],
  );
  const row = classSectionRows.find(
    r => String(r.classId) === String(ctx.classId) &&
         String(r.sectionId || '') === String(ctx.sectionId || ''),
  );
  const rowLabel = row ? `${row.className}${row.sectionName ? ` – ${row.sectionName}` : ''}` : '';
  const canSave = subject && startTime && endTime && startTime < endTime;

  return (
    <Motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <Motion.div
        initial={{ scale: 0.94, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.94, y: 12 }}
        transition={{ type: 'spring', stiffness: 380, damping: 30 }}
        className="w-full max-w-sm bg-white rounded-2xl shadow-2xl overflow-hidden border border-slate-100"
        style={{ borderTop: `4px solid ${dayMeta.color}` }}
      >
        {/* Header */}
        <div className="flex items-start justify-between px-5 pt-4 pb-3 border-b border-slate-100">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400">{ctx.day}</p>
            <p className="font-bold text-slate-900 text-sm mt-0.5">
              {isNew ? 'Add Period' : 'Edit Period'} — <span style={{ color: dayMeta.color }}>{rowLabel}</span>
            </p>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">
          {/* Time row */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                Start Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="time" value={startTime} onChange={e => setStartTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-2 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
            </div>
            <div>
              <label className="block mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
                End Time <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <Clock size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                <input type="time" value={endTime} onChange={e => setEndTime(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 bg-slate-50 pl-7 pr-2 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
              </div>
            </div>
          </div>

          {/* Subject */}
          <div>
            <label className="block mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">
              Subject <span className="text-red-500">*</span>
            </label>
            {classSubjects.length > 0 ? (
              <select value={subject} onChange={e => setSubject(e.target.value)}
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100">
                <option value="">— choose —</option>
                {classSubjects.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
              </select>
            ) : (
              <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                placeholder="e.g. Mathematics"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
            )}
          </div>

          {/* Teacher */}
          <div>
            <label className="block mb-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Teacher</label>
            <TeacherPicker value={teacher} teachers={teachers} onChange={setTeacher} />
          </div>

          {/* Break toggle */}
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={subject === 'Break'}
              onChange={e => { setSubject(e.target.checked ? 'Break' : ''); setTeacher(''); setType('academic'); }}
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
            <span className="text-sm text-slate-600 font-medium">Mark as Break</span>
          </label>

          {/* Type chips */}
          {subject !== 'Break' && (
            <div>
              <label className="block mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-500">Color Type</label>
              <div className="flex flex-wrap gap-1.5">
                {CELL_TYPES.map(t => (
                  <button key={t.value} type="button" onClick={() => setType(t.value)}
                    className="px-2.5 py-1 rounded-lg text-[11px] font-semibold border-2 transition-all"
                    style={{
                      background: t.bg, color: t.text,
                      borderColor: type === t.value ? t.border : 'transparent',
                      opacity: type === t.value ? 1 : 0.55,
                    }}>
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/60">
          {ctx.cell ? (
            <button onClick={onDelete}
              className="flex items-center gap-1.5 text-xs font-semibold text-red-600 hover:text-red-800 transition-colors">
              <Trash2 size={13} /> Delete
            </button>
          ) : <span />}
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => onSave({
                subject, teacher: teacher || '-', type, startTime, endTime,
                originalStartTime: ctx.period?.startTime || existingTimes.startTime,
              })}
              disabled={saving || !canSave}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              {saving && <Loader2 size={12} className="animate-spin" />}
              Save
            </button>
          </div>
        </div>
      </Motion.div>
    </Motion.div>
  );
};

/* ─── DayGridView ─── */
const DayGridView = ({ day, classSectionRows, periodColumns, getCell, dayConflicts, selectedClassId, selectedSectionId, onCellClick, onAddPeriod, onDeleteDay }) => {
  const dayMeta = DAY_META[day] || DAY_META.Monday;
  const rows = selectedClassId
    ? classSectionRows.filter(r =>
        String(r.classId) === String(selectedClassId) &&
        (!selectedSectionId || String(r.sectionId || '') === String(selectedSectionId)))
    : classSectionRows;

  const clashList = useMemo(() => {
    const out = [];
    dayConflicts.forEach(key => {
      const [startTime, teacher] = key.split('|');
      out.push({ startTime, teacher });
    });
    return out;
  }, [dayConflicts]);

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="h-5 w-1 rounded-full" style={{ background: dayMeta.color }} />
          <h2 className="text-lg font-bold text-slate-800">{day} Schedule</h2>
          <span className="text-xs font-semibold px-2 py-0.5 rounded-full" style={{ background: dayMeta.light, color: dayMeta.color }}>
            {periodColumns.length} period{periodColumns.length !== 1 ? 's' : ''}
          </span>
        </div>
        {clashList.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-50 text-red-700 border border-red-200">
            <AlertCircle size={13} /> {clashList.length} teacher clash{clashList.length > 1 ? 'es' : ''}
          </div>
        )}
      </div>

      {/* Clash banner */}
      <AnimatePresence>
        {clashList.length > 0 && (
          <Motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="rounded-xl px-4 py-3 mb-3 text-xs bg-red-50 border border-red-200 text-red-700">
            <strong className="block mb-1">⚠ Teacher clashes on {day}:</strong>
            {clashList.map((c, i) => <div key={i}>• {c.teacher} is double-booked at {to12(c.startTime)}</div>)}
          </Motion.div>
        )}
      </AnimatePresence>

      {/* No periods yet */}
      {periodColumns.length === 0 && (
        <div className="bg-white border border-slate-200 rounded-2xl p-10 text-center">
          <Calendar size={32} className="mx-auto mb-3 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700 mb-1">No periods scheduled for {day}</p>
          <p className="text-xs text-slate-400 mb-4">Click "Add Period" on any class row to start building the timetable.</p>
        </div>
      )}

      {/* Grid table */}
      {(rows.length > 0) && (
        <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
          <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12 }}>
            <thead>
              {periodColumns.length > 0 && (
                <>
                  {/* Day banner */}
                  <tr>
                    <td colSpan={periodColumns.length + 2}
                      className="py-2 px-4 text-xs font-bold uppercase tracking-widest text-white"
                      style={{ background: dayMeta.color }}>
                      {day}
                    </td>
                  </tr>
                  {/* Period headers */}
                  <tr className="bg-slate-800 text-white">
                    <th className="text-left px-4 py-3 text-xs font-semibold sticky left-0 bg-slate-800 z-10 min-w-[140px]">
                      Class / Section
                    </th>
                    {periodColumns.map(p => (
                      <th key={p.startTime} className="text-center px-3 py-2 min-w-[110px] border-l border-slate-700" style={{ fontFamily: "'IBM Plex Mono', monospace" }}>
                        <div className="font-bold text-[11px]">{p.isBreak ? 'Break' : to12(p.startTime)}</div>
                        <div className="text-[9px] text-slate-400 mt-0.5">{fmtRange(p.startTime, p.endTime)}</div>
                      </th>
                    ))}
                    <th className="px-3 py-2 border-l border-slate-700 min-w-[90px]" />
                  </tr>
                </>
              )}
              {periodColumns.length === 0 && (
                <tr className="bg-slate-800 text-white">
                  <th className="text-left px-4 py-3 text-xs font-semibold sticky left-0 bg-slate-800 z-10 min-w-[140px]">Class / Section</th>
                  <th className="text-center px-3 py-3 text-xs font-semibold">Actions</th>
                </tr>
              )}
            </thead>
            <tbody>
              {rows.map((row, ri) => (
                <Motion.tr
                  key={`${row.classId}_${row.sectionId}`}
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: ri * 0.02 }}
                  className="group border-t border-slate-100 hover:bg-slate-50/50 transition-colors"
                >
                  {/* Class label */}
                  <td className="px-4 py-3 sticky left-0 bg-white group-hover:bg-slate-50/50 z-[1] border-r border-slate-100">
                    <span className="font-bold text-slate-800 text-sm">
                      {row.className}{row.sectionName ? <span className="text-indigo-600"> – {row.sectionName}</span> : ''}
                    </span>
                  </td>

                  {/* Period cells */}
                  {periodColumns.map(p => {
                    const cell = getCell(row.classId, row.sectionId, day, p.startTime);
                    const isClash = dayConflicts.has(`${p.startTime}|${(cell?.teacher || '').toUpperCase().trim()}`);

                    if (p.isBreak || cell?.subject === 'Break') {
                      return (
                        <td key={p.startTime} className="text-center border-l border-slate-100 bg-slate-50 px-2 py-2">
                          <span className="text-[10px] text-slate-400 uppercase tracking-wider">Break</span>
                        </td>
                      );
                    }

                    if (cell?.subject) {
                      const ct = CELL_TYPE_MAP[cell.type] || CELL_TYPE_MAP.academic;
                      return (
                        <td key={p.startTime}
                          className="border-l border-slate-100 px-2 py-1.5 relative cursor-pointer group/cell transition-all"
                          style={{ background: ct.bg, outline: isClash ? `2px solid #ef4444` : 'none', outlineOffset: '-2px' }}
                          onClick={() => onCellClick(row.classId, row.sectionId, p)}>
                          {isClash && <span className="absolute top-1 right-1 text-[10px] text-red-500">⚠</span>}
                          <div className="font-bold text-[12px] text-center mt-1" style={{ color: ct.text }}>{cell.subject}</div>
                          {cell.teacher && cell.teacher !== '-' && (
                            <div className="text-[9.5px] text-center text-slate-500 mt-0.5 truncate max-w-[100px] mx-auto">{cell.teacher}</div>
                          )}
                          <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover/cell:opacity-100 transition-opacity bg-white/60 rounded-sm">
                            <Pencil size={13} className="text-indigo-600" />
                          </div>
                        </td>
                      );
                    }

                    return (
                      <td key={p.startTime}
                        onClick={() => onCellClick(row.classId, row.sectionId, p)}
                        className="border-l border-slate-100 text-center px-2 py-4 cursor-pointer hover:bg-indigo-50 transition-colors">
                        <span className="text-slate-300 text-xs">+</span>
                      </td>
                    );
                  })}

                  {/* Row actions */}
                  <td className="border-l border-slate-100 px-3 py-2 text-center">
                    <div className="flex items-center justify-center gap-1.5">
                      <button
                        onClick={() => onAddPeriod(row.classId, row.sectionId)}
                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors whitespace-nowrap">
                        <Plus size={10} /> Add
                      </button>
                      <button
                        onClick={() => onDeleteDay(row.classId, row.sectionId)}
                        className="p-1 rounded-lg text-slate-300 hover:text-red-500 hover:bg-red-50 transition-colors opacity-0 group-hover:opacity-100">
                        <Trash2 size={12} />
                      </button>
                    </div>
                  </td>
                </Motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

/* ─── ClassView ─── */
const ClassView = ({ selectedRow, routines, getCell, onCellClick, onAddPeriod }) => {
  const periodsForRow = useMemo(() => {
    if (!selectedRow) return [];
    const seen = new Map();
    DAYS.forEach(day => {
      const r = routines.find(rt =>
        String(rt.classId) === String(selectedRow.classId) &&
        String(rt.sectionId || '') === String(selectedRow.sectionId || '') &&
        normDay(rt.day) === day,
      );
      r?.schedule?.forEach(s => {
        const { startTime, endTime } = entryTimes(s);
        if (startTime && !seen.has(startTime))
          seen.set(startTime, { startTime, endTime, isBreak: !!s.isBreak });
      });
    });
    return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([, v]) => v);
  }, [routines, selectedRow]);

  if (!selectedRow) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-16 text-center shadow-sm">
        <BookOpen size={36} className="mx-auto mb-3 text-slate-300" />
        <p className="text-sm font-semibold text-slate-700 mb-1">No class selected</p>
        <p className="text-xs text-slate-400">Click a class from the sidebar or use the filter above.</p>
      </div>
    );
  }

  let totalPeriods = 0;
  const subjectSet = new Set();

  const dayBlocks = DAYS.map(day => {
    const dayMeta = DAY_META[day];
    const cards = periodsForRow.map(period => {
      const cell = getCell(selectedRow.classId, selectedRow.sectionId, day, period.startTime);

      if (period.isBreak || cell?.subject === 'Break') {
        return (
          <div key={period.startTime} className="rounded-xl px-3 py-2 bg-slate-100 border border-slate-200">
            <span className="block text-[9px] font-mono text-slate-400">{fmtRange(period.startTime, period.endTime)}</span>
            <span className="text-xs text-slate-400 italic">Break</span>
          </div>
        );
      }
      if (cell?.subject) {
        totalPeriods++;
        subjectSet.add(cell.subject);
        const ct = CELL_TYPE_MAP[cell.type] || CELL_TYPE_MAP.academic;
        return (
          <Motion.div key={period.startTime} whileHover={{ y: -2 }}
            className="rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
            style={{ background: ct.bg, borderColor: ct.border }}>
            <div className="px-3 pt-2 pb-1">
              <span className="block text-[9px] font-mono mb-1" style={{ color: ct.text, opacity: 0.7 }}>{fmtRange(period.startTime, period.endTime)}</span>
              <span className="block font-bold text-[12px] mb-0.5" style={{ color: ct.text }}>{cell.subject}</span>
              {cell.teacher && cell.teacher !== '-' && (
                <span className="block text-[10px] text-slate-500">{cell.teacher}</span>
              )}
            </div>
            <button
              onClick={() => onCellClick(selectedRow.classId, selectedRow.sectionId, day, period)}
              className="w-full flex items-center justify-center gap-1 py-1 text-[10px] font-semibold border-t transition-colors hover:bg-white/60"
              style={{ color: ct.text, borderColor: ct.border }}>
              <Pencil size={9} /> Edit Subject / Teacher
            </button>
          </Motion.div>
        );
      }
      return (
        <Motion.div key={period.startTime} whileHover={{ y: -2 }}
          onClick={() => onCellClick(selectedRow.classId, selectedRow.sectionId, day, period)}
          className="rounded-xl border border-dashed border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 transition-colors cursor-pointer">
          <div className="px-3 py-2">
            <span className="block text-[9px] font-mono text-slate-400 mb-1">{fmtRange(period.startTime, period.endTime)}</span>
          </div>
          <div className="flex items-center justify-center gap-1 py-1 border-t border-dashed border-slate-200 text-[10px] font-semibold text-indigo-400 hover:text-indigo-600">
            <Plus size={9} /> Assign Subject & Teacher
          </div>
        </Motion.div>
      );
    });

    return { day, cards, dayMeta };
  });

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-slate-800">
          Class {selectedRow.className}{selectedRow.sectionName ? <span className="text-indigo-600"> – {selectedRow.sectionName}</span> : ''} — Full Week
        </h2>
        <div className="flex gap-2 ml-auto">
          {[{ label: 'Periods', value: totalPeriods }, { label: 'Subjects', value: subjectSet.size }].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center">
              <span className="block font-bold text-indigo-600 text-lg">{s.value}</span>
              <span className="block text-[10px] text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(140px, 1fr))', gap: 10 }}>
        {dayBlocks.map(({ day, cards, dayMeta }, di) => (
          <Motion.div key={day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: di * 0.05 }}>
            <div className="rounded-xl py-2 px-3 mb-2 text-center text-sm font-bold text-white" style={{ background: dayMeta.color }}>
              {day}
            </div>
            <div className="space-y-1.5">
              {cards.length === 0
                ? <p className="text-xs text-slate-400 text-center py-3 italic">No schedule</p>
                : cards}
              <button
                onClick={() => onAddPeriod(selectedRow.classId, selectedRow.sectionId, day)}
                className="w-full py-1.5 rounded-xl border border-dashed border-indigo-200 text-indigo-400 hover:text-indigo-600 hover:border-indigo-400 hover:bg-indigo-50 transition-colors flex items-center justify-center gap-1 text-[11px] font-semibold">
                <Plus size={11} /> Add Period
              </button>
            </div>
          </Motion.div>
        ))}
      </div>
    </div>
  );
};

/* ─── TeacherView ─── */
const TeacherView = ({ selectedTeacher, allTeacherNames, classSectionRows, routines, onCellClick, onSelectTeacher }) => {
  const { totalPeriods, classesTaught, dayData } = useMemo(() => {
    if (!selectedTeacher) return { totalPeriods: 0, classesTaught: new Set(), dayData: [] };
    const name = selectedTeacher.trim().toUpperCase();
    let total = 0;
    const classes = new Set();
    const days = DAYS.map(day => {
      const entries = [];
      classSectionRows.forEach(row => {
        const r = routines.find(rt =>
          String(rt.classId) === String(row.classId) &&
          String(rt.sectionId || '') === String(row.sectionId || '') &&
          normDay(rt.day) === day,
        );
        r?.schedule?.filter(s => !s.isBreak && s.teacher && s.teacher !== '-').forEach(s => {
          const match = s.teacher.split(/[&,]/).some(t => t.trim().toUpperCase() === name);
          if (match) {
            const times = entryTimes(s);
            entries.push({ row, period: { ...times, isBreak: false }, cell: s });
            total++;
            classes.add(`${row.className}-${row.sectionName}`);
          }
        });
      });
      return { day, entries };
    });
    return { totalPeriods: total, classesTaught: classes, dayData: days };
  }, [selectedTeacher, classSectionRows, routines]);

  if (!selectedTeacher) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <User size={18} className="text-indigo-500" />
          <h3 className="text-sm font-bold text-slate-800">Select a Teacher</h3>
          <span className="text-xs text-slate-400 ml-1">— click to view their full week schedule</span>
        </div>
        {allTeacherNames.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-6">No teachers found</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {allTeacherNames.map(name => (
              <Motion.button
                key={name}
                whileHover={{ y: -2 }} whileTap={{ scale: 0.97 }}
                onClick={() => onSelectTeacher(name)}
                className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 bg-slate-50 hover:border-indigo-300 hover:bg-indigo-50 transition-all text-xs font-semibold text-slate-700 hover:text-indigo-700">
                <div className="h-6 w-6 rounded-full bg-indigo-100 text-indigo-600 flex items-center justify-center text-[10px] font-bold shrink-0">
                  {name.charAt(0).toUpperCase()}
                </div>
                {name}
              </Motion.button>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-3 mb-4 flex-wrap">
        <h2 className="text-lg font-bold text-slate-800">{selectedTeacher} — Full Week</h2>
        <div className="flex gap-2 ml-auto">
          {[{ label: 'Periods', value: totalPeriods }, { label: 'Classes', value: classesTaught.size }].map(s => (
            <div key={s.label} className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-center">
              <span className="block font-bold text-indigo-600 text-lg">{s.value}</span>
              <span className="block text-[10px] text-slate-500">{s.label}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, minmax(140px, 1fr))', gap: 10 }}>
        {dayData.map(({ day, entries }, di) => {
          const dayMeta = DAY_META[day];
          return (
            <Motion.div key={day} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: di * 0.05 }}>
              <div className="rounded-xl py-2 px-3 mb-2 text-center text-sm font-bold text-white" style={{ background: dayMeta.color }}>
                {day}
              </div>
              <div className="space-y-1.5">
                {entries.length === 0
                  ? <p className="text-xs text-slate-400 text-center py-3 italic">Free 🎉</p>
                  : entries.map(({ row, period, cell }, i) => {
                    const ct = CELL_TYPE_MAP[cell.type] || CELL_TYPE_MAP.academic;
                    return (
                      <Motion.div key={i} whileHover={{ y: -2 }}
                        className="rounded-xl border overflow-hidden transition-shadow hover:shadow-md"
                        style={{ background: ct.bg, borderColor: ct.border }}>
                        <div className="px-3 pt-2 pb-1">
                          <span className="block text-[9px] font-mono mb-1" style={{ color: ct.text, opacity: 0.7 }}>{fmtRange(period.startTime, period.endTime)}</span>
                          <span className="block font-bold text-[12px] mb-0.5" style={{ color: ct.text }}>{cell.subject}</span>
                          <span className="block text-[10px] text-slate-500">{row.className}{row.sectionName ? `–${row.sectionName}` : ''}</span>
                        </div>
                        <button
                          onClick={() => onCellClick(row.classId, row.sectionId, day, period)}
                          className="w-full flex items-center justify-center gap-1 py-1 text-[10px] font-semibold border-t transition-colors hover:bg-white/60"
                          style={{ color: ct.text, borderColor: ct.border }}>
                          <Pencil size={9} /> Edit
                        </button>
                      </Motion.div>
                    );
                  })}
              </div>
            </Motion.div>
          );
        })}
      </div>
    </div>
  );
};

/* ─── AI Import Modal ─── */
const parseImportText = (raw) => {
  const lines = raw.split('\n').map(l => l.trim()).filter(Boolean);
  const periods = [];

  for (const line of lines) {
    // Skip obvious headers
    if (/^(period|time|subject|teacher|day|#)/i.test(line)) continue;

    // Try: "08:00-08:45, Mathematics, Mr. Sharma" or tab/pipe separated
    const delim = /[,|\t]/.test(line) ? /[,|\t]/ : null;
    if (delim) {
      const parts = line.split(delim).map(p => p.trim());
      // First part might be a time range
      const timeMatch = parts[0]?.match(/(\d{1,2}:\d{2})\s*(?:AM|PM)?\s*[-–to]+\s*(\d{1,2}:\d{2})\s*(?:AM|PM)?/i);
      if (timeMatch) {
        const st = to24(timeMatch[1].includes(' ') ? timeMatch[1] : timeMatch[1]);
        const et = to24(timeMatch[2].includes(' ') ? timeMatch[2] : timeMatch[2]);
        const subject = parts[1] || '';
        const teacher = parts[2] || '';
        if (st && et && subject) periods.push({ startTime: st, endTime: et, subject, teacher, type: 'academic' });
        continue;
      }
    }

    // Try inline: "8:00 AM - 8:45 AM Mathematics Mr. Sharma" or "8:00-8:45 Mathematics"
    const inline = line.match(/(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s*[-–to]+\s*(\d{1,2}:\d{2}(?:\s*[AP]M)?)\s+(.+)/i);
    if (inline) {
      const st = to24(inline[1].trim());
      const et = to24(inline[2].trim());
      const rest = inline[3].trim();
      // Heuristic: split remaining text — last word(s) that look like a name are the teacher
      const words = rest.split(/\s+/);
      let subject = rest, teacher = '';
      // If more than 2 words, assume last 2 might be teacher name
      if (words.length >= 3) {
        subject = words.slice(0, Math.ceil(words.length / 2)).join(' ');
        teacher = words.slice(Math.ceil(words.length / 2)).join(' ');
      }
      if (st && et && subject) periods.push({ startTime: st, endTime: et, subject, teacher, type: 'academic' });
      continue;
    }

    // Try "Period 1 (8:00 - 8:45): Subject | Teacher"
    const pMatch = line.match(/period\s*\d+\s*\(?(\d{1,2}:\d{2})\s*[-–]\s*(\d{1,2}:\d{2})\)?\s*[:\-|]?\s*(.+)/i);
    if (pMatch) {
      const st = to24(pMatch[1]);
      const et = to24(pMatch[2]);
      const rest = pMatch[3].trim();
      const [subject, teacher = ''] = rest.split(/[|\-–]/).map(s => s.trim());
      if (st && et && subject) periods.push({ startTime: st, endTime: et, subject, teacher, type: 'academic' });
    }
  }

  return periods.sort((a, b) => a.startTime.localeCompare(b.startTime));
};

const AIImportModal = ({ classSectionRows, subjects, teachers, onImport, onClose, saving }) => {
  const [text, setText]           = useState('');
  const [classId, setClassId]     = useState('');
  const [sectionId, setSectionId] = useState('');
  const [day, setDay]             = useState('Monday');
  const [parsed, setParsed]       = useState([]);
  const [parsed2, setParsed2]     = useState(false);

  const uniqueClasses = useMemo(() => [...new Map(classSectionRows.map(r => [r.classId, r])).values()], [classSectionRows]);
  const filteredSections = useMemo(() => classSectionRows.filter(r => String(r.classId) === String(classId)), [classSectionRows, classId]);

  const handleParse = () => {
    const result = parseImportText(text);
    setParsed(result);
    setParsed2(true);
  };

  const updateParsed = (i, field, value) =>
    setParsed(prev => prev.map((p, idx) => idx === i ? { ...p, [field]: value } : p));

  const removeParsed = i => setParsed(prev => prev.filter((_, idx) => idx !== i));

  const canImport = classId && day && parsed.length > 0;
  const classSubjects = useMemo(
    () => subjects.filter(s => String(s.classId) === String(classId)),
    [subjects, classId],
  );
  const teacherNames = useMemo(() => teachers.map(t => t.name).filter(Boolean).sort(), [teachers]);

  return (
    <Motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40 backdrop-blur-sm"
      onClick={e => e.target === e.currentTarget && onClose()}>
      <Motion.div
        initial={{ y: 40, scale: 0.97 }} animate={{ y: 0, scale: 1 }} exit={{ y: 40, scale: 0.97 }}
        transition={{ type: 'spring', stiffness: 340, damping: 28 }}
        className="w-full sm:max-w-2xl bg-white rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden border border-indigo-100 max-h-[90vh] flex flex-col"
        style={{ borderTop: '4px solid #6366f1' }}>

        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-slate-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-xl bg-indigo-600 flex items-center justify-center">
              <Sparkles size={14} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-slate-900 text-sm">AI Import Timetable</p>
              <p className="text-[10px] text-slate-400">Paste any timetable text — we'll parse it automatically</p>
            </div>
          </div>
          <button onClick={onClose} className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {/* Target selectors */}
          <div className="px-5 pt-4 pb-3 border-b border-slate-100">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Import Target</p>
            <div className="flex flex-wrap gap-3">
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Class <span className="text-red-400">*</span></label>
                <select value={classId} onChange={e => { setClassId(e.target.value); setSectionId(''); }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400" style={{ minWidth: 80 }}>
                  <option value="">— Class —</option>
                  {uniqueClasses.map(r => <option key={r.classId} value={r.classId}>{r.className}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Section</label>
                <select value={sectionId} onChange={e => setSectionId(e.target.value)} disabled={!classId}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 disabled:opacity-40" style={{ minWidth: 80 }}>
                  <option value="">— All / Default —</option>
                  {filteredSections.map(r => <option key={r.sectionId || 'none'} value={r.sectionId || ''}>{r.sectionName || '(default)'}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] text-slate-400 mb-1">Day <span className="text-red-400">*</span></label>
                <select value={day} onChange={e => setDay(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400">
                  {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Text input */}
          <div className="px-5 pt-4 pb-3">
            <div className="flex items-center justify-between mb-2">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Paste Timetable Data</p>
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] text-slate-400">Supported formats:</span>
                <div className="flex gap-1">
                  {['CSV', 'Tab', 'Plain text'].map(f => (
                    <span key={f} className="px-1.5 py-0.5 rounded text-[9px] font-semibold bg-indigo-50 text-indigo-600">{f}</span>
                  ))}
                </div>
              </div>
            </div>
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setParsed2(false); }}
              placeholder={`Examples:\n08:00-08:45, Mathematics, Mr. Sharma\n08:45-09:30, English, Mrs. Patel\n09:30-09:45, Break\n09:45-10:30, Science, Mr. Kumar`}
              rows={6}
              className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 font-mono focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 resize-none"
            />
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <button
                onClick={handleParse}
                disabled={!text.trim()}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors">
                <Sparkles size={12} /> Parse Timetable
              </button>
              {parsed2 && (
                <span className="text-xs text-slate-500">
                  {parsed.length > 0
                    ? <span className="text-green-700 font-semibold">{parsed.length} period{parsed.length !== 1 ? 's' : ''} detected</span>
                    : <span className="text-red-600 font-semibold">Could not parse — check your format</span>}
                </span>
              )}
            </div>
          </div>

          {/* Preview / edit table */}
          {parsed.length > 0 && (
            <div className="px-5 pb-4">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Preview &amp; Edit</p>
              <div className="rounded-xl border border-slate-200 overflow-hidden">
                <table style={{ width: '100%', fontSize: 11, borderCollapse: 'collapse' }}>
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      {['Start', 'End', 'Subject', 'Teacher', 'Type', ''].map(h => (
                        <th key={h} className="text-left px-2 py-2 text-[10px] font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {parsed.map((p, i) => {
                      const ct = CELL_TYPE_MAP[p.type] || CELL_TYPE_MAP.academic;
                      return (
                        <tr key={i} className="border-t border-slate-100" style={{ background: ct.bg }}>
                          <td className="px-2 py-1">
                            <input type="time" value={p.startTime} onChange={e => updateParsed(i, 'startTime', e.target.value)}
                              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] focus:outline-none focus:border-indigo-400 w-24" />
                          </td>
                          <td className="px-2 py-1">
                            <input type="time" value={p.endTime} onChange={e => updateParsed(i, 'endTime', e.target.value)}
                              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] focus:outline-none focus:border-indigo-400 w-24" />
                          </td>
                          <td className="px-2 py-1">
                            {classSubjects.length > 0 ? (
                              <select value={p.subject} onChange={e => updateParsed(i, 'subject', e.target.value)}
                                className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] focus:outline-none focus:border-indigo-400 max-w-[120px]">
                                <option value="">—</option>
                                <option value="Break">Break</option>
                                {classSubjects.map(s => <option key={s._id} value={s.name}>{s.name}</option>)}
                                <option value={p.subject}>{p.subject} (custom)</option>
                              </select>
                            ) : (
                              <input value={p.subject} onChange={e => updateParsed(i, 'subject', e.target.value)}
                                className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] focus:outline-none focus:border-indigo-400 w-28" />
                            )}
                          </td>
                          <td className="px-2 py-1">
                            <select value={p.teacher} onChange={e => updateParsed(i, 'teacher', e.target.value)}
                              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] focus:outline-none focus:border-indigo-400 max-w-[130px]">
                              <option value="">— none —</option>
                              {teacherNames.map(n => <option key={n} value={n}>{n}</option>)}
                              {p.teacher && !teacherNames.includes(p.teacher) && (
                                <option value={p.teacher}>{p.teacher} (custom)</option>
                              )}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <select value={p.type} onChange={e => updateParsed(i, 'type', e.target.value)}
                              className="rounded border border-slate-200 bg-white px-1.5 py-1 text-[11px] focus:outline-none focus:border-indigo-400"
                              style={{ color: ct.text }}>
                              {CELL_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                            </select>
                          </td>
                          <td className="px-2 py-1">
                            <button onClick={() => removeParsed(i)}
                              className="h-6 w-6 flex items-center justify-center rounded hover:bg-red-100 text-slate-300 hover:text-red-500 transition-colors">
                              <X size={11} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <button
                onClick={() => setParsed(prev => [...prev, { startTime: '', endTime: '', subject: '', teacher: '', type: 'academic' }])}
                className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors">
                <Plus size={12} /> Add row
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-slate-100 bg-slate-50/60 shrink-0">
          <p className="text-[10px] text-slate-400 max-w-xs">
            Existing periods for this class/section/day will be <strong>replaced</strong> with the imported data.
          </p>
          <div className="flex gap-2">
            <button onClick={onClose}
              className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={() => onImport({ classId, sectionId, day, periods: parsed })}
              disabled={saving || !canImport}
              className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-40 transition-colors">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
              Import {parsed.length > 0 ? `${parsed.length} Periods` : ''}
            </button>
          </div>
        </div>
      </Motion.div>
    </Motion.div>
  );
};

/* ─── Main ─── */
const Routines = ({ setShowAdminHeader }) => {
  const [routines, setRoutines]     = useState([]);
  const [classes, setClasses]       = useState([]);
  const [sections, setSections]     = useState([]);
  const [subjects, setSubjects]     = useState([]);
  const [teachers, setTeachers]     = useState([]);
  const [activeYearId, setActiveYearId] = useState('');

  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [saving, setSaving]         = useState(false);
  const [isDeletingAll, setIsDeletingAll] = useState(false);
  const [showAIImport, setShowAIImport] = useState(false);
  const [toast, setToast]           = useState({ show: false, message: '', type: 'success' });

  /* ── school timing (localStorage-persisted) ── */
  const TIMING_KEY = 'eec_school_timing';
  const [timing, setTiming] = useState(() => {
    try { return { start: '08:00', end: '15:30', duration: 45, ...JSON.parse(localStorage.getItem(TIMING_KEY) || '{}') }; }
    catch { return { start: '08:00', end: '15:30', duration: 45 }; }
  });
  const [editingTiming, setEditingTiming] = useState(false);
  const [timingDraft, setTimingDraft]     = useState(timing);

  const saveTiming = () => {
    const t = {
      start: timingDraft.start || '08:00',
      end: timingDraft.end || '15:30',
      duration: Math.max(5, Math.min(180, Number(timingDraft.duration) || 45)),
    };
    setTiming(t);
    localStorage.setItem(TIMING_KEY, JSON.stringify(t));
    setEditingTiming(false);
    showToast('School timing saved');
  };

  const [currentView, setCurrentView]         = useState('dayGrid');
  const [currentDay, setCurrentDay]           = useState('Monday');
  const [selectedClassId, setSelectedClassId] = useState('');
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [selectedTeacher, setSelectedTeacher] = useState('');
  const [cellEditor, setCellEditor]           = useState(null);

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast(t => ({ ...t, show: false })), 3000);
  }, []);

  useEffect(() => { setShowAdminHeader?.(false); }, [setShowAdminHeader]);

  const loadInitialData = async () => {
    setLoading(true); setError(null);
    try {
      const [ttR, yrR, clR, secR, subR, tchR] = await Promise.allSettled([
        timetableApi.getAll(), academicApi.getYears(), academicApi.getClasses(),
        academicApi.getSections(), academicApi.getSubjects(), academicApi.getTeachers(),
      ]);
      const safe = (r, fb = []) => r.status === 'fulfilled' ? (Array.isArray(r.value) ? r.value : fb) : fb;
      const yrItems = safe(yrR);
      setClasses(safe(clR)); setSections(safe(secR)); setSubjects(safe(subR)); setTeachers(safe(tchR));
      setRoutines(transformTimetablesToRoutines(safe(ttR)));
      const active = yrItems.find(y => y?.isActive) || yrItems[0];
      if (active?._id) setActiveYearId(String(active._id));
    } catch (err) { setError(err.message || 'Failed to load'); }
    finally { setLoading(false); }
  };

  useEffect(() => { loadInitialData(); }, []);

  /* ── derived ── */
  const activeClasses = useMemo(
    () => activeYearId ? classes.filter(c => String(c.academicYearId || '') === String(activeYearId)) : classes,
    [classes, activeYearId],
  );

  const classSectionRows = useMemo(() => {
    const rows = [];
    activeClasses.forEach(cls => {
      const secs = sections.filter(s => String(getId(s.classId)) === String(cls._id));
      if (secs.length === 0) rows.push({ classId: cls._id, sectionId: null, className: cls.name, sectionName: '' });
      else secs.forEach(sec => rows.push({ classId: cls._id, sectionId: sec._id, className: cls.name, sectionName: sec.name }));
    });
    return rows.sort((a, b) => {
      const na = parseInt(a.className), nb = parseInt(b.className);
      if (!isNaN(na) && !isNaN(nb) && na !== nb) return na - nb;
      const sc = String(a.className).localeCompare(String(b.className));
      return sc !== 0 ? sc : a.sectionName.localeCompare(b.sectionName);
    });
  }, [activeClasses, sections]);

  const periodColumns = useMemo(() => {
    const seen = new Map();
    routines.forEach(r => {
      if (normDay(r.day) !== currentDay) return;
      r.schedule?.forEach(s => {
        const { startTime, endTime } = entryTimes(s);
        if (startTime && !seen.has(startTime))
          seen.set(startTime, { endTime, isBreak: !!s.isBreak });
      });
    });

    if (seen.size > 0) {
      return [...seen.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([startTime, { endTime, isBreak }]) => ({
        startTime, endTime, isBreak,
      }));
    }

    /* No real data — generate slots from school timing so columns appear automatically */
    const slots = [];
    const [sh, sm] = (timing.start || '08:00').split(':').map(Number);
    const [eh, em] = (timing.end   || '15:30').split(':').map(Number);
    const endTotal = eh * 60 + em;
    const dur = Math.max(5, Number(timing.duration) || 45);
    let cur = sh * 60 + sm;
    while (cur + dur <= endTotal) {
      const pad = n => String(n).padStart(2, '0');
      const st = `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`;
      cur += dur;
      const et = `${pad(Math.floor(cur / 60))}:${pad(cur % 60)}`;
      slots.push({ startTime: st, endTime: et, isBreak: false });
    }
    return slots;
  }, [routines, currentDay, timing]);

  const getCell = useCallback((classId, sectionId, day, startTime) => {
    const r = routines.find(rt =>
      String(rt.classId) === String(classId) &&
      String(rt.sectionId || '') === String(sectionId || '') &&
      normDay(rt.day) === normDay(day),
    );
    return r?.schedule?.find(s => entryTimes(s).startTime === startTime) || null;
  }, [routines]);

  const dayConflicts = useMemo(() => {
    const clashes = new Set();
    periodColumns.forEach(p => {
      if (p.isBreak) return;
      const teacherMap = {};
      classSectionRows.forEach(row => {
        const cell = getCell(row.classId, row.sectionId, currentDay, p.startTime);
        if (!cell || !cell.teacher || cell.teacher === '-' || cell.isBreak) return;
        cell.teacher.split(/[&,]/).map(t => t.trim().toUpperCase()).filter(Boolean).forEach(name => {
          teacherMap[name] = teacherMap[name] || [];
          teacherMap[name].push(row);
        });
      });
      Object.entries(teacherMap).forEach(([name, cls]) => {
        if (cls.length > 1) clashes.add(`${p.startTime}|${name}`);
      });
    });
    return clashes;
  }, [classSectionRows, periodColumns, currentDay, getCell]);

  const allTeacherNames = useMemo(() => {
    const names = new Set(teachers.map(t => t.name).filter(Boolean));
    return [...names].sort();
  }, [teachers]);

  const uniqueClassesInFilter = useMemo(
    () => [...new Map(classSectionRows.map(r => [r.classId, r])).values()],
    [classSectionRows],
  );

  const selectedRow = useMemo(
    () => classSectionRows.find(r =>
      String(r.classId) === String(selectedClassId) &&
      (!selectedSectionId || String(r.sectionId || '') === String(selectedSectionId)),
    ) || (selectedClassId ? classSectionRows.find(r => String(r.classId) === String(selectedClassId)) : null),
    [classSectionRows, selectedClassId, selectedSectionId],
  );

  /* ── save cell ── */
  const saveCellData = async (classId, sectionId, day, periodData) => {
    setSaving(true);
    try {
      const r = routines.find(rt =>
        String(rt.classId) === String(classId) &&
        String(rt.sectionId || '') === String(sectionId || '') &&
        normDay(rt.day) === normDay(day),
      );
      let schedule = r?.schedule ? [...r.schedule] : [];
      const lookupTime = periodData.originalStartTime || periodData.startTime;
      const idx = schedule.findIndex(s => entryTimes(s).startTime === lookupTime);

      if (periodData.clear) {
        if (idx >= 0) schedule.splice(idx, 1);
      } else {
        const isBreak = periodData.subject === 'Break';
        const entry = {
          time: fmtRange(periodData.startTime, periodData.endTime),
          startTime: periodData.startTime,
          endTime: periodData.endTime,
          subject: periodData.subject,
          teacher: isBreak ? '-' : (periodData.teacher || '-'),
          isBreak,
          type: periodData.type || 'academic',
        };
        if (idx >= 0) schedule[idx] = entry;
        else schedule.push(entry);
      }

      const entries = schedule
        .filter(p => p.isBreak || (p.subject && p.subject !== 'Break'))
        .map((p, i) => {
          const times = entryTimes(p);
          const sub = !p.isBreak ? subjects.find(s => s.name === p.subject && String(s.classId) === String(classId)) : null;
          const tch = !p.isBreak ? teachers.find(t => t.name === p.teacher) : null;
          return {
            dayOfWeek: day, period: i + 1, isBreak: !!p.isBreak,
            subjectId: sub?._id || null, teacherId: tch?._id || null,
            roomId: null, startTime: times.startTime, endTime: times.endTime, room: '',
          };
        });

      await timetableApi.saveDay({ classId, sectionId: sectionId || null, dayOfWeek: day, entries });
      showToast('Saved successfully');
      setCellEditor(null);
      await loadInitialData();
    } catch (err) { showToast(err.message || 'Failed to save', 'error'); }
    finally { setSaving(false); }
  };

  /* ── delete day ── */
  const handleDeleteDay = async (classId, sectionId, day) => {
    const ok = await Swal.fire({
      icon: 'warning',
      title: 'Clear this day?',
      text: `This removes all periods for this class on ${day}.`,
      showCancelButton: true,
      confirmButtonText: 'Clear Day',
      confirmButtonColor: '#ef4444',
    });
    if (!ok.isConfirmed) return;
    try {
      await timetableApi.deleteDay({ classId, sectionId: sectionId || null, dayOfWeek: day });
      showToast(`${day} schedule cleared`);
      await loadInitialData();
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
  };

  /* ── delete all ── */
  const handleDeleteAll = async () => {
    if (!routines.length) return;
    const ok = await Swal.fire({
      icon: 'warning', title: 'Delete all routines?',
      text: 'This permanently removes every class routine. Cannot be undone.',
      showCancelButton: true, confirmButtonText: 'Delete All', confirmButtonColor: '#ef4444',
    });
    if (!ok.isConfirmed) return;
    setIsDeletingAll(true);
    try {
      const result = await timetableApi.deleteAll();
      await loadInitialData();
      showToast(`${result?.deletedCount ?? 'All'} routine(s) deleted`);
    } catch (err) { showToast(err.message || 'Failed', 'error'); }
    finally { setIsDeletingAll(false); }
  };

  /* ── export PDF ── */
  const exportPDF = () => {
    if (!routines.length) { showToast('No routines to export', 'error'); return; }
    const dayIndex = new Map(DAYS.map((d, i) => [d, i]));
    const sorted = [...routines].sort((a, b) => {
      const cn = String(a.class || '').localeCompare(String(b.class || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (cn !== 0) return cn;
      const sn = String(a.section || '').localeCompare(String(b.section || ''), undefined, { numeric: true, sensitivity: 'base' });
      if (sn !== 0) return sn;
      return (dayIndex.get(normDay(a.day)) ?? 99) - (dayIndex.get(normDay(b.day)) ?? 99);
    });
    const doc = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
    const pageW = doc.internal.pageSize.getWidth(), pageH = doc.internal.pageSize.getHeight();
    const margin = 36, tableW = pageW - margin * 2;
    const cols = [
      { key: 'time', label: 'Time', w: 130 }, { key: 'subject', label: 'Subject', w: 150 },
      { key: 'teacher', label: 'Teacher', w: 150 }, { key: 'room', label: 'Room', w: tableW - 430 },
    ];
    let y = margin;
    const ensureSpace = h => { if (y + h > pageH - margin) { doc.addPage(); y = margin; } };
    doc.setFontSize(15); doc.setFont(undefined, 'bold');
    doc.text('All Class Routines', margin, y); y += 16;
    doc.setFontSize(9); doc.setFont(undefined, 'normal'); doc.setTextColor(100);
    doc.text(`Generated: ${new Date().toLocaleString()}`, margin, y); doc.setTextColor(20); y += 18;
    sorted.forEach((routine, idx) => {
      const sch = [...(routine.schedule || [])].sort((a, b) => entryTimes(a).startTime.localeCompare(entryTimes(b).startTime));
      const title = `Class ${routine.class || '-'} – ${routine.section || '-'} – ${normDay(routine.day || '')}`;
      ensureSpace(24); doc.setFillColor(245, 247, 255); doc.rect(margin, y, tableW, 20, 'F');
      doc.setFontSize(10); doc.setFont(undefined, 'bold'); doc.text(title, margin + 8, y + 14); y += 20;
      ensureSpace(22); doc.setFillColor(248, 250, 252); doc.rect(margin, y, tableW, 18, 'F');
      doc.setFontSize(8); let x = margin;
      cols.forEach(c => { doc.text(c.label, x + 6, y + 12); x += c.w; }); y += 18;
      doc.setFont(undefined, 'normal');
      sch.forEach(row => {
        ensureSpace(18); let cx = margin;
        const times = entryTimes(row);
        const vals = {
          time: fmtRange(times.startTime, times.endTime) || row.time || '-',
          subject: row.isBreak ? 'Break' : (row.subject || '-'),
          teacher: row.isBreak ? '-' : (row.teacher || '-'), room: '-',
        };
        cols.forEach(c => {
          doc.setDrawColor(220); doc.rect(cx, y, c.w, 18);
          doc.text(String(vals[c.key] || '-').slice(0, 32), cx + 6, y + 12); cx += c.w;
        }); y += 18;
      });
      if (idx < sorted.length - 1) y += 8;
    });
    doc.save(`routines_${new Date().toISOString().slice(0, 10)}.pdf`);
  };

  /* ── open cell editor ── */
  const openCellEditor = (classId, sectionId, day, period) => {
    const cell = getCell(classId, sectionId, day, period.startTime);
    setCellEditor({ classId, sectionId, day, period, cell });
  };

  /* ── open new period editor ── */
  const openAddPeriod = (classId, sectionId, day = currentDay) => {
    const r = routines.find(rt =>
      String(rt.classId) === String(classId) &&
      String(rt.sectionId || '') === String(sectionId || '') &&
      normDay(rt.day) === normDay(day),
    );
    // Next start = end of last period, or school start if none
    const endTimes = (r?.schedule || [])
      .map(s => entryTimes(s).endTime).filter(Boolean).sort();
    const nextStart = endTimes.length ? endTimes[endTimes.length - 1] : timing.start;
    // Next end = nextStart + default duration
    const [h, m] = nextStart.split(':').map(Number);
    const total = h * 60 + m + Number(timing.duration || 45);
    const nextEnd = `${String(Math.floor(total / 60) % 24).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;
    setCellEditor({ classId, sectionId, day, period: { startTime: nextStart, endTime: nextEnd }, cell: null });
  };

  /* ── AI import ── */
  const handleAIImport = async ({ classId, sectionId, day, periods }) => {
    if (!classId || !day || !periods.length) return;
    setSaving(true);
    try {
      const entries = periods
        .filter(p => p.startTime && p.endTime && p.subject)
        .map((p, i) => {
          const isBreak = p.subject === 'Break';
          const sub = !isBreak ? subjects.find(s => s.name === p.subject && String(s.classId) === String(classId)) : null;
          const tch = !isBreak && p.teacher ? teachers.find(t => t.name === p.teacher) : null;
          return {
            dayOfWeek: day, period: i + 1, isBreak,
            subjectId: sub?._id || null, teacherId: tch?._id || null,
            roomId: null, startTime: p.startTime, endTime: p.endTime, room: '',
          };
        });
      await timetableApi.saveDay({ classId, sectionId: sectionId || null, dayOfWeek: day, entries });
      showToast(`Imported ${entries.length} period${entries.length !== 1 ? 's' : ''} for ${day}`);
      setShowAIImport(false);
      await loadInitialData();
    } catch (err) { showToast(err.message || 'Import failed', 'error'); }
    finally { setSaving(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <Loader2 size={32} className="animate-spin mx-auto mb-3 text-indigo-500" />
        <p className="text-slate-500 text-sm">Loading timetables…</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <AlertCircle size={32} className="mx-auto mb-3 text-red-400" />
        <p className="text-slate-700 mb-4">{error}</p>
        <button onClick={loadInitialData} className="px-5 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700">Retry</button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Toast */}
      <AnimatePresence>
        {toast.show && (
          <Motion.div
            initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 12 }}
            className="fixed bottom-5 right-5 z-[200] flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-xl text-sm font-semibold"
            style={{ background: toast.type === 'success' ? '#16a34a' : '#dc2626', color: '#fff' }}>
            {toast.type === 'success' ? <CheckCircle2 size={15} /> : <AlertCircle size={15} />}
            {toast.message}
          </Motion.div>
        )}
      </AnimatePresence>

      {/* ── Topbar ── */}
      <div className="sticky top-0 z-40 bg-white border-b border-slate-200 shadow-sm">
        {/* Row 1: brand + actions */}
        <div className="max-w-[1560px] mx-auto px-6 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-xl bg-indigo-600 flex items-center justify-center shadow-md">
              <Calendar size={16} className="text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 leading-tight">Class Routines</h1>
              <p className="text-[10px] text-slate-400">Manage weekly timetables</p>
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <button onClick={() => setShowAIImport(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-indigo-200 bg-indigo-50 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition-colors">
              <Sparkles size={13} /> AI Import
            </button>
            <button onClick={exportPDF} disabled={routines.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-40 transition-colors">
              <Download size={13} /> Export PDF
            </button>
            <button onClick={handleDeleteAll} disabled={isDeletingAll || routines.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-red-200 bg-red-50 text-xs font-semibold text-red-700 hover:bg-red-100 disabled:opacity-40 transition-colors">
              {isDeletingAll ? <Loader2 size={13} className="animate-spin" /> : <Trash2 size={13} />}
              {isDeletingAll ? 'Deleting…' : 'Delete All'}
            </button>
          </div>
        </div>

        {/* Row 2: view tabs + filters + school timing */}
        <div className="max-w-[1560px] mx-auto px-6 py-2 flex items-center gap-4 flex-wrap border-t border-slate-100">
          {/* View tabs */}
          <div className="flex gap-1 p-1 rounded-xl bg-slate-100 shrink-0">
            {[
              { key: 'dayGrid',     icon: <LayoutGrid size={13} />, label: 'Day Grid' },
              { key: 'classView',   icon: <BookOpen   size={13} />, label: 'By Class' },
              { key: 'teacherView', icon: <User       size={13} />, label: 'By Teacher' },
            ].map(tab => (
              <Motion.button key={tab.key} onClick={() => setCurrentView(tab.key)}
                whileTap={{ scale: 0.97 }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                style={{
                  background: currentView === tab.key ? '#fff' : 'transparent',
                  color: currentView === tab.key ? '#4f46e5' : '#64748b',
                  boxShadow: currentView === tab.key ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}>
                {tab.icon} {tab.label}
              </Motion.button>
            ))}
          </div>

          <div className="w-px h-6 bg-slate-200 shrink-0" />

          {/* School Timing — inline in this row */}
          <div className="flex items-center gap-3 flex-wrap flex-1">
            <Clock size={13} className="text-indigo-500 shrink-0" />
            <AnimatePresence mode="wait">
              {editingTiming ? (
                <Motion.div key="edit"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Start</span>
                  <input type="time" value={timingDraft.start}
                    onChange={e => setTimingDraft(d => ({ ...d, start: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">End</span>
                  <input type="time" value={timingDraft.end}
                    onChange={e => setTimingDraft(d => ({ ...d, end: e.target.value }))}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100" />
                  <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Duration</span>
                  <div className="relative">
                    <input type="number" min={5} max={180} value={timingDraft.duration}
                      onChange={e => setTimingDraft(d => ({ ...d, duration: e.target.value }))}
                      className="rounded-lg border border-slate-200 bg-slate-50 pl-2 pr-9 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 w-20" />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-400 pointer-events-none">min</span>
                  </div>
                  <button onClick={saveTiming}
                    className="px-2.5 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition-colors flex items-center gap-1">
                    <CheckCircle2 size={11} /> Save
                  </button>
                  <button onClick={() => { setTimingDraft(timing); setEditingTiming(false); }}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition-colors">
                    Cancel
                  </button>
                </Motion.div>
              ) : (
                <Motion.div key="view"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] font-semibold text-slate-400">School Hours</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">{to12(timing.start)}</span>
                  <span className="text-slate-300 text-xs">–</span>
                  <span className="px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 text-xs font-bold border border-indigo-100">{to12(timing.end)}</span>
                  <span className="text-[10px] font-semibold text-slate-400 ml-1">Period</span>
                  <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-xs font-bold">{timing.duration} min</span>
                  <button onClick={() => { setTimingDraft(timing); setEditingTiming(true); }}
                    className="flex items-center gap-1 text-[10px] font-semibold text-indigo-500 hover:text-indigo-700 transition-colors ml-1">
                    <Pencil size={10} /> Edit
                  </button>
                </Motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Filters — pushed to the right */}
          <div className="ml-auto shrink-0">
            {currentView !== 'teacherView' ? (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Class</span>
                <select value={selectedClassId} onChange={e => { setSelectedClassId(e.target.value); setSelectedSectionId(''); }}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-400" style={{ minWidth: 80 }}>
                  <option value="">All</option>
                  {uniqueClassesInFilter.map(r => <option key={r.classId} value={r.classId}>{r.className}</option>)}
                </select>
                <ChevronRight size={12} className="text-slate-300" />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Section</span>
                <select value={selectedSectionId} onChange={e => setSelectedSectionId(e.target.value)}
                  disabled={!selectedClassId}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-400 disabled:opacity-40" style={{ minWidth: 72 }}>
                  <option value="">All</option>
                  {classSectionRows.filter(r => String(r.classId) === String(selectedClassId)).map(r => (
                    <option key={r.sectionId || 'none'} value={r.sectionId || ''}>{r.sectionName || '(default)'}</option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-400">Teacher</span>
                <select value={selectedTeacher} onChange={e => setSelectedTeacher(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:outline-none focus:border-indigo-400"
                  style={{ minWidth: 220 }}>
                  <option value="">— Select Teacher —</option>
                  {allTeacherNames.map(n => <option key={n} value={n}>{n}</option>)}
                </select>
                {selectedTeacher && (
                  <button onClick={() => setSelectedTeacher('')}
                    className="h-7 w-7 flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors">
                    <X size={13} />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Day tabs */}
        <AnimatePresence>
          {currentView === 'dayGrid' && (
            <Motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
              className="max-w-[1560px] mx-auto px-6 flex gap-1.5 overflow-x-auto border-t border-slate-100 py-2">
              {DAYS.map(day => {
                const meta = DAY_META[day];
                const isActive = currentDay === day;
                return (
                  <Motion.button key={day} onClick={() => setCurrentDay(day)}
                    whileTap={{ scale: 0.96 }}
                    className="px-4 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all border"
                    style={{
                      background: isActive ? meta.color : meta.light,
                      color: isActive ? '#fff' : meta.color,
                      borderColor: isActive ? meta.color : meta.ring,
                    }}>
                    {day}
                  </Motion.button>
                );
              })}
            </Motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Layout ── */}
      <div className="max-w-[1560px] mx-auto px-6 py-5 flex gap-5 items-start">

        {/* Rail sidebar */}
        <aside className="w-52 shrink-0 sticky top-[148px]">
          <div className="bg-white rounded-2xl border border-slate-200 p-3 shadow-sm">
            <p className="text-xs font-bold text-slate-700 mb-0.5">Classes &amp; Sections</p>
            <p className="text-[10px] text-slate-400 mb-3">Click to filter the view</p>
            <div className="space-y-0.5 max-h-[55vh] overflow-y-auto">
              {classSectionRows.length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4 italic">No classes found</p>
              )}
              {classSectionRows.map((row, i) => {
                const isSelected = String(row.classId) === String(selectedClassId) &&
                  (!selectedSectionId || String(row.sectionId || '') === String(selectedSectionId));
                const hasData = DAYS.some(d => {
                  const r = routines.find(rt =>
                    String(rt.classId) === String(row.classId) &&
                    String(rt.sectionId || '') === String(row.sectionId || '') &&
                    normDay(rt.day) === d,
                  );
                  return r?.schedule?.some(s => !s.isBreak && s.subject && s.subject !== 'Break');
                });
                return (
                  <Motion.div
                    key={`${row.classId}_${row.sectionId}`}
                    initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.015 }}
                    onClick={() => {
                      if (isSelected) { setSelectedClassId(''); setSelectedSectionId(''); }
                      else { setSelectedClassId(String(row.classId)); setSelectedSectionId(String(row.sectionId || '')); }
                    }}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg cursor-pointer transition-all"
                    style={{
                      background: isSelected ? '#eef2ff' : 'transparent',
                      border: `1px solid ${isSelected ? '#c7d2fe' : 'transparent'}`,
                    }}>
                    <span className="text-xs font-semibold text-slate-800">
                      {row.className}{row.sectionName ? <span className="text-indigo-500"> –{row.sectionName}</span> : ''}
                    </span>
                    {hasData && <span className="h-1.5 w-1.5 rounded-full bg-green-500 shrink-0" />}
                  </Motion.div>
                );
              })}
            </div>
          </div>
        </aside>

        {/* Main */}
        <main className="flex-1 min-w-0">
          <AnimatePresence mode="wait">
            {currentView === 'dayGrid' && (
              <Motion.div key="dayGrid"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}>
                <DayGridView
                  day={currentDay}
                  classSectionRows={classSectionRows}
                  periodColumns={periodColumns}
                  getCell={getCell}
                  dayConflicts={dayConflicts}
                  selectedClassId={selectedClassId}
                  selectedSectionId={selectedSectionId}
                  onCellClick={(classId, sectionId, period) => openCellEditor(classId, sectionId, currentDay, period)}
                  onAddPeriod={(classId, sectionId) => openAddPeriod(classId, sectionId, currentDay)}
                  onDeleteDay={(classId, sectionId) => handleDeleteDay(classId, sectionId, currentDay)}
                />
              </Motion.div>
            )}
            {currentView === 'classView' && (
              <Motion.div key="classView"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}>
                <ClassView
                  selectedRow={selectedRow}
                  routines={routines}
                  getCell={getCell}
                  onCellClick={(classId, sectionId, day, period) => openCellEditor(classId, sectionId, day, period)}
                  onAddPeriod={(classId, sectionId, day) => openAddPeriod(classId, sectionId, day)}
                />
              </Motion.div>
            )}
            {currentView === 'teacherView' && (
              <Motion.div key="teacherView"
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.18 }}>
                <TeacherView
                  selectedTeacher={selectedTeacher}
                  allTeacherNames={allTeacherNames}
                  classSectionRows={classSectionRows}
                  routines={routines}
                  onCellClick={(classId, sectionId, day, period) => openCellEditor(classId, sectionId, day, period)}
                  onSelectTeacher={name => setSelectedTeacher(name)}
                />
              </Motion.div>
            )}
          </AnimatePresence>
        </main>
      </div>

      {/* ── AI Import Modal ── */}
      <AnimatePresence>
        {showAIImport && (
          <AIImportModal
            classSectionRows={classSectionRows}
            subjects={subjects}
            teachers={teachers}
            saving={saving}
            onImport={handleAIImport}
            onClose={() => setShowAIImport(false)}
          />
        )}
      </AnimatePresence>

      {/* ── Cell Editor ── */}
      <AnimatePresence>
        {cellEditor && (
          <CellEditor
            ctx={cellEditor}
            subjects={subjects}
            teachers={teachers}
            classSectionRows={classSectionRows}
            saving={saving}
            onSave={data => saveCellData(cellEditor.classId, cellEditor.sectionId, cellEditor.day, data)}
            onDelete={() => saveCellData(cellEditor.classId, cellEditor.sectionId, cellEditor.day, {
              startTime: cellEditor.period.startTime || entryTimes(cellEditor.cell || {}).startTime,
              clear: true,
            })}
            onClose={() => setCellEditor(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
};

export default Routines;
