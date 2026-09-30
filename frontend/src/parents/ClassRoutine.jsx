import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  BookOpen,
  BookOpenText,
  Calculator,
  ChevronDown,
  Download,
  FlaskConical,
  Globe2,
  Heart,
  Info,
  LayoutGrid,
  Leaf,
  ListChecks,
  Monitor,
  Music,
  Palette,
  PersonStanding,
  Star,
  UtensilsCrossed,
  Coffee,
} from 'lucide-react';
import { parentApiJson } from './parentApi';
import { readSharedChild, writeSharedChild } from './ChildSwitcher';

// Weekly class routine for the parent's child. The backend picks the active
// academic year and the child's own class/section — no selectors here.

const ALL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

/* ── helpers ─────────────────────────────────────────────────────────────── */
const toMinutes = (t) => {
  const m = String(t || '').match(/(\d{1,2}):(\d{2})\s*([AaPp][Mm])?/);
  if (!m) return null;
  let h = Number(m[1]);
  const ap = m[3]?.toUpperCase();
  if (ap === 'PM' && h < 12) h += 12;
  if (ap === 'AM' && h === 12) h = 0;
  return h * 60 + Number(m[2]);
};
const fmt12 = (t) => {
  const mins = toMinutes(t);
  if (mins === null) return String(t || '');
  const h = Math.floor(mins / 60);
  return `${((h + 11) % 12) + 1}:${String(mins % 60).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
};
const splitTime = (entry) => {
  if (entry?.startTime) return [entry.startTime, entry.endTime || ''];
  const [s, e] = String(entry?.time || '').split(/\s*[-–]\s*/);
  return [s || '', e || ''];
};
const slotLabel = (s, e) => (s ? `${fmt12(s)}${e ? ` – ${fmt12(e)}` : ''}` : '');
const initials = (n) => String(n || 'S').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const startOfWeek = (d) => {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const offset = (x.getDay() + 6) % 7; // Monday = 0
  x.setDate(x.getDate() - offset);
  return x;
};
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const fmtDay = (d) => d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

// Subject → icon + tint (matches the design's colour coding).
const tone = (color, Icon, pdf) => ({
  Icon,
  cls: `bg-${color}-100 text-slate-900`,
  tile: `bg-${color}-200/70`,
  icon: `text-${color}-600`,
  accent: `text-${color}-700`,
  pdf,
});
// Full class strings kept literal below so Tailwind generates them:
// bg-amber-100 bg-violet-100 bg-red-100 bg-green-100 bg-blue-100 bg-slate-100 bg-purple-100 bg-pink-100 bg-sky-100 bg-rose-100 bg-indigo-100 bg-yellow-100 bg-emerald-100
// bg-amber-200/70 bg-violet-200/70 bg-red-200/70 bg-green-200/70 bg-blue-200/70 bg-slate-200/70 bg-purple-200/70 bg-pink-200/70 bg-sky-200/70 bg-rose-200/70 bg-indigo-200/70 bg-yellow-200/70 bg-emerald-200/70
// text-amber-600 text-violet-600 text-red-600 text-green-600 text-blue-600 text-slate-600 text-purple-600 text-pink-600 text-sky-600 text-rose-600 text-indigo-600 text-yellow-600 text-emerald-600
// text-amber-700 text-violet-700 text-red-700 text-green-700 text-blue-700 text-slate-700 text-purple-700 text-pink-700 text-sky-700 text-rose-700 text-indigo-700 text-yellow-700 text-emerald-700
const subjectStyle = (name) => {
  const s = String(name || '').toLowerCase();
  if (/english/.test(s)) return tone('red', BookOpen, [254, 226, 226]);
  if (/math/.test(s)) return tone('violet', Calculator, [237, 233, 254]);
  if (/science|physics|chemistry|biology/.test(s)) return tone('green', FlaskConical, [220, 252, 231]);
  if (/computer|ict|coding/.test(s)) return tone('blue', Monitor, [219, 234, 254]);
  if (/bengali|bangla|hindi|sanskrit/.test(s)) return tone('amber', BookOpenText, [254, 243, 199]);
  if (/history|social|geography|civics/.test(s)) return tone('purple', Globe2, [243, 232, 255]);
  if (/evs|environment/.test(s)) return tone('emerald', Leaf, [209, 250, 229]);
  if (/art|craft|drawing/.test(s)) return tone('rose', Palette, [255, 228, 230]);
  if (/physical|p\.?e\.?$|sport|games/.test(s)) return tone('slate', PersonStanding, [241, 245, 249]);
  if (/library/.test(s)) return tone('sky', BookOpen, [224, 242, 254]);
  if (/moral|value/.test(s)) return tone('pink', Heart, [252, 231, 243]);
  if (/music/.test(s)) return tone('indigo', Music, [224, 231, 255]);
  if (/activity|club/.test(s)) return tone('yellow', Star, [254, 249, 195]);
  return tone('slate', BookOpen, [241, 245, 249]);
};


// Client cache (memory + sessionStorage, per login) → instant repeat visits.
const CACHE_MAX_AGE = 10 * 60 * 1000;
const cacheKey = () => {
  let t = '';
  try { t = localStorage.getItem('token') || ''; } catch { /* ignore */ }
  return `parent:routine:v5:${t.slice(-16)}`;
};
let memCache = null;
const readCache = () => {
  const key = cacheKey();
  let entry = memCache?.key === key ? memCache : null;
  if (!entry) { try { entry = JSON.parse(sessionStorage.getItem(key) || 'null'); } catch { entry = null; } }
  return entry && Date.now() - entry.at < CACHE_MAX_AGE ? entry.data : null;
};
const writeCache = (data) => {
  memCache = { key: cacheKey(), at: Date.now(), data };
  try { sessionStorage.setItem(memCache.key, JSON.stringify(memCache)); } catch { /* quota */ }
};

const RISE = { hidden: { opacity: 0, y: 14 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: [0.22, 1, 0.36, 1] } } };

/* ── page ────────────────────────────────────────────────────────────────── */
const ParentClassRoutine = () => {
  const navigate = useNavigate();
  const [children, setChildren] = useState(() => readCache()?.children || []);
  const [letterhead, setLetterhead] = useState(() => readCache()?.letterhead || { school: {}, principalName: '' });
  const [loading, setLoading] = useState(() => !readCache());
  const [error, setError] = useState('');
  const [childId, setChildId] = useState(() => String(readSharedChild()?.id || ''));
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef(null);
  const [tab, setTab] = useState('weekly');
  const weekStart = useMemo(() => startOfWeek(new Date()), []); // current week (dates under day names)

  const load = useCallback(async () => {
    const cached = readCache();
    if (!cached) setLoading(true);
    setError('');
    try {
      const data = await parentApiJson('/api/parent/auth/routine', {}, navigate);
      const list = Array.isArray(data?.children) ? data.children : [];
      const lh = { school: data?.school || {}, principalName: data?.principalName || '' };
      setChildren(list);
      setLetterhead(lh);
      writeCache({ children: list, letterhead: lh });
    } catch (err) {
      if (!cached) setError(err.message || 'Unable to load routine');
    } finally {
      setLoading(false);
    }
  }, [navigate]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const close = (e) => { if (pickerRef.current && !pickerRef.current.contains(e.target)) setPickerOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);

  const child = children.find((c) => String(c.studentId) === childId) || children[0] || null;
  const pickChild = (c) => {
    setChildId(String(c.studentId));
    writeSharedChild({ id: String(c.studentId), name: c.studentName || '' });
    setPickerOpen(false);
  };
  const classLine = child
    ? `Class ${child.className || child.grade || '—'}${child.sectionName || child.section ? ` - Section ${child.sectionName || child.section}` : ''}`
    : '';

  /* ── grid model ── */
  const grid = useMemo(() => {
    const schedule = child?.schedule || {};
    const byDay = {};
    ALL_DAYS.forEach((d) => {
      const key = Object.keys(schedule).find((k) => k.toLowerCase() === d.toLowerCase());
      byDay[d] = Array.isArray(schedule[key]) ? schedule[key] : [];
    });
    const days = ALL_DAYS.filter((d, i) => i < 6 || byDay[d].length); // Sunday only if used
    const slots = new Map();
    days.forEach((d) => byDay[d].forEach((e, idx) => {
      const [s, en] = splitTime(e);
      const key = s ? `${s}|${en}` : `P${e.period || idx + 1}`;
      const order = toMinutes(s) ?? (Number(e.period) || idx + 1) * 1000;
      if (!slots.has(key)) slots.set(key, { key, s, e: en, order, period: e.period, cells: {} });
      slots.get(key).cells[d] = e;
    }));
    const rows = [...slots.values()].sort((a, b) => a.order - b.order).map((row) => {
      const used = days.filter((d) => row.cells[d]);
      const isBreak = used.length > 0 && used.every((d) => row.cells[d].isBreak || /break|recess|lunch|tiffin/i.test(row.cells[d].subject || ''));
      const breakName = isBreak
        ? (row.cells[used[0]].subject && !/^break$/i.test(row.cells[used[0]].subject)
          ? row.cells[used[0]].subject
          : ((toMinutes(row.s) ?? 0) >= 12 * 60 ? 'Lunch Break' : 'Morning Break'))
        : '';
      return { ...row, isBreak, breakName, label: slotLabel(row.s, row.e) || `Period ${row.period || ''}` };
    });
    return { days, rows };
  }, [child]);

  const subjects = useMemo(() => {
    const map = new Map();
    grid.rows.forEach((r) => {
      if (r.isBreak) return;
      Object.values(r.cells).forEach((e) => {
        if (e.isBreak || !e.subject) return;
        if (!map.has(e.subject)) map.set(e.subject, { name: e.subject, periods: 0, teachers: new Set() });
        const s = map.get(e.subject);
        s.periods += 1;
        if (e.instructor && e.instructor !== 'TBA') s.teachers.add(e.instructor);
      });
    });
    return [...map.values()].map((s) => ({ ...s, teachers: [...s.teachers] }));
  }, [grid]);

  const weekDates = grid.days.map((d) => addDays(weekStart, ALL_DAYS.indexOf(d)));
  const todayIdx = grid.days.findIndex((_, i) => weekDates[i].toDateString() === new Date().toDateString());

  /* ── PDF ── */
  // Official routine PDF: centred letterhead (logo, name, address, contact),
  // divider, underlined title, a clean timetable grid (days only, no dates)
  // and the principal's signature block bottom-right.
  const downloadPdf = async () => {
    const { jsPDF } = await import('jspdf');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const W = pdf.internal.pageSize.getWidth();
    const H = pdf.internal.pageSize.getHeight();
    const M = 34;
    const ink = [15, 23, 42];
    const muted = [100, 116, 139];
    const line = [203, 213, 225];
    const school = letterhead.school || {};
    let y = 30;

    // Logo (fetched as data URL so jsPDF can embed it)
    if (school.logo) {
      try {
        const blob = await (await fetch(school.logo)).blob();
        const dataUrl = await new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = rej; fr.readAsDataURL(blob); });
        pdf.addImage(dataUrl, W / 2 - 21, y, 42, 42);
        y += 48;
      } catch { /* logo unavailable — skip */ }
    }
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(17); pdf.setTextColor(...ink);
    pdf.text(String(school.name || 'School').toUpperCase(), W / 2, y + 8, { align: 'center' });
    y += 24;
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(...muted);
    if (school.address) { pdf.text(school.address, W / 2, y, { align: 'center', maxWidth: W - 2 * M }); y += 13; }
    const contact = [school.phone && `Phone: ${school.phone}`, school.email && `Email: ${school.email}`, school.website].filter(Boolean).join('   |   ');
    if (contact) { pdf.text(contact, W / 2, y, { align: 'center' }); y += 13; }
    y += 4;
    pdf.setDrawColor(...ink); pdf.setLineWidth(1.2); pdf.line(M, y, W - M, y);
    pdf.setDrawColor(...line); pdf.setLineWidth(0.5); pdf.line(M, y + 2.5, W - M, y + 2.5);
    y += 24;

    // Underlined title
    const cls = child?.className || child?.grade || '';
    const sec = child?.sectionName || child?.section || '';
    const title = `CLASS ROUTINE OF CLASS ${cls}${sec ? ` - SECTION ${sec}` : ''}`.toUpperCase();
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(13); pdf.setTextColor(...ink);
    pdf.text(title, W / 2, y, { align: 'center' });
    const tw = pdf.getTextWidth(title);
    pdf.setLineWidth(0.8); pdf.setDrawColor(...ink); pdf.line(W / 2 - tw / 2, y + 3, W / 2 + tw / 2, y + 3);
    y += 12;
    if (child?.academicYearName) {
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9.5); pdf.setTextColor(...muted);
      pdf.text(`Academic Year: ${child.academicYearName}`, W / 2, y + 6, { align: 'center' });
      y += 14;
    }
    y += 8;

    // Table
    const timeW = 92;
    const colW = (W - M * 2 - timeW) / grid.days.length;
    const headH = 24;
    const footerSpace = 62; // room for the signature line
    const classRows = grid.rows.filter((r) => !r.isBreak).length;
    const breakRows = grid.rows.length - classRows;
    const avail = H - footerSpace - y - headH;
    const breakH = Math.min(20, Math.max(12, avail * 0.06));
    const rowH = Math.min(38, classRows ? (avail - breakRows * breakH) / classRows : 38);
    const k = Math.max(0.6, Math.min(1, rowH / 38)); // text scale for tight routines
    const drawHead = () => {
      pdf.setFillColor(30, 41, 59);
      pdf.rect(M, y, W - 2 * M, headH, 'F');
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); pdf.setTextColor(255, 255, 255);
      pdf.text('TIME', M + timeW / 2, y + 15.5, { align: 'center' });
      grid.days.forEach((d, i) => pdf.text(d.toUpperCase(), M + timeW + i * colW + colW / 2, y + 15.5, { align: 'center' }));
      y += headH;
    };
    drawHead();
    grid.rows.forEach((r, idx) => {
      const h = r.isBreak ? breakH : rowH;
      pdf.setDrawColor(...line); pdf.setLineWidth(0.6);
      if (r.isBreak) {
        pdf.setFillColor(241, 245, 249); pdf.rect(M, y, W - 2 * M, h, 'FD');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(...ink);
        pdf.setFontSize(8.5 * Math.max(k, 0.8));
        pdf.text(r.label, M + timeW / 2, y + h / 2 + 3, { align: 'center' });
        pdf.setTextColor(71, 85, 105);
        pdf.text(String(r.breakName).toUpperCase(), M + timeW + (W - 2 * M - timeW) / 2, y + h / 2 + 3, { align: 'center', charSpace: 1.5 });
        pdf.line(M + timeW, y, M + timeW, y + h);
      } else {
        if (idx % 2 === 1) { pdf.setFillColor(250, 251, 252); pdf.rect(M, y, W - 2 * M, h, 'F'); }
        pdf.rect(M, y, timeW, h, 'S');
        pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5 * k); pdf.setTextColor(...ink);
        const [t1, t2] = r.label.split(' – ');
        pdf.text(t1 || '', M + timeW / 2, y + (t2 ? h * 0.42 : h / 2 + 3), { align: 'center' });
        if (t2) { pdf.setFont('helvetica', 'normal'); pdf.setTextColor(...muted); pdf.text(`to ${t2}`, M + timeW / 2, y + h * 0.72, { align: 'center' }); }
        grid.days.forEach((d, i) => {
          const x = M + timeW + i * colW;
          pdf.rect(x, y, colW, h, 'S');
          const ev = r.cells[d];
          if (!ev) {
            pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...muted);
            pdf.text('—', x + colW / 2, y + h / 2 + 3, { align: 'center' });
            return;
          }
          const room = [ev.roomBuilding, [ev.roomFloor, ev.roomNumber].filter(Boolean).join(' · ')].filter(Boolean).join(', ') || ev.room || 'TBA';
          const teacher = ev.instructor && ev.instructor !== 'TBA' ? ev.instructor : 'TBA';
          const fit = (txt, size) => { pdf.setFontSize(size); return pdf.splitTextToSize(String(txt), colW - 8)[0] || ''; };
          pdf.setFont('helvetica', 'bold'); pdf.setTextColor(...ink);
          pdf.text(fit(ev.subject, 9 * k), x + colW / 2, y + h * 0.33, { align: 'center' });
          pdf.setFont('helvetica', 'normal'); pdf.setTextColor(51, 65, 85);
          pdf.text(fit(teacher, 7.5 * k), x + colW / 2, y + h * 0.62, { align: 'center' });
          pdf.setTextColor(...muted);
          pdf.text(fit(room, 7 * k), x + colW / 2, y + h * 0.87, { align: 'center' });
        });
      }
      y += h;
    });
    // Principal signature line — bottom-right (always on this single page)
    const sigY = H - 34;
    const sx = W - M - 170;
    pdf.setDrawColor(...muted); pdf.setLineWidth(0.6); pdf.line(sx, sigY, W - M, sigY);
    if (letterhead.principalName) {
      pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); pdf.setTextColor(...ink);
      pdf.text(letterhead.principalName, W - M - 85, sigY - 5, { align: 'center' });
    }
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(...muted);
    pdf.text('Principal', W - M - 85, sigY + 12, { align: 'center' });

    pdf.save(`Class-Routine-Class-${cls}${sec ? `-${sec}` : ''}.pdf`.replace(/\s+/g, '-'));
  };

  const hasRoutine = grid.rows.length > 0;
  // Any class period without a room → show the "to be announced" note.
  const roomsPending = grid.rows.some((r) => !r.isBreak
    && Object.values(r.cells).some((e) => !e.isBreak && !e.roomBuilding && !e.roomFloor && !e.roomNumber && !e.room));

  return (
    <motion.div
      className="mx-auto flex min-h-screen max-w-7xl flex-col gap-4 bg-slate-50 p-3 sm:p-4 lg:p-6"
      initial="hidden"
      animate="show"
      variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
    >
      {/* ── Title + child picker ── */}
      <motion.div variants={RISE} className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Class Routine</h1>
          <p className="mt-0.5 text-sm text-slate-600">View your child&apos;s weekly class routine, subject details and timings.</p>
        </div>
        {child && (
          <div className="relative" ref={pickerRef}>
            <button
              type="button"
              onClick={() => children.length > 1 && setPickerOpen((o) => !o)}
              className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 pr-4 text-left shadow-sm sm:w-72"
            >
              {child.photo
                ? <img src={child.photo} alt={child.studentName} className="h-11 w-11 rounded-full object-cover" />
                : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-violet-100 text-sm font-bold text-violet-700">{initials(child.studentName)}</span>}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-bold text-slate-900">{child.studentName}</span>
                <span className="block truncate text-xs text-slate-500">{classLine}</span>
              </span>
              {children.length > 1 && <ChevronDown size={17} className={`text-slate-500 transition ${pickerOpen ? 'rotate-180' : ''}`} />}
            </button>
            {pickerOpen && (
              <ul className="absolute right-0 z-20 mt-2 w-full overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-xl">
                {children.map((c) => (
                  <li key={c.studentId}>
                    <button type="button" onClick={() => pickChild(c)} className={`flex w-full items-center gap-3 px-3 py-2.5 text-left hover:bg-slate-50 ${String(c.studentId) === String(child.studentId) ? 'bg-violet-50' : ''}`}>
                      {c.photo
                        ? <img src={c.photo} alt="" className="h-8 w-8 rounded-lg object-cover" />
                        : <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-100 text-xs font-bold text-violet-700">{initials(c.studentName)}</span>}
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-slate-800">{c.studentName}</span>
                        <span className="block text-xs text-slate-500">Class {c.className || c.grade}{c.sectionName || c.section ? ` - Section ${c.sectionName || c.section}` : ''}</span>
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </motion.div>

      {error ? <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p> : null}

      {/* ── Routine card ── */}
      <motion.section variants={RISE} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex gap-2">
            {[
              { key: 'weekly', label: 'Weekly Routine', Icon: LayoutGrid },
              { key: 'subjects', label: 'Subject Details', Icon: ListChecks },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setTab(t.key)}
                className={`inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-semibold transition ${
                  tab === t.key ? 'border-blue-100 bg-blue-50 text-blue-700' : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                }`}
              >
                <t.Icon size={16} /> {t.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={downloadPdf} disabled={!hasRoutine} className="inline-flex h-10 items-center gap-2 rounded-lg border border-slate-200 px-4 text-sm font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50">
              <Download size={16} className="text-blue-600" /> Download PDF
            </button>
          </div>
        </div>

        {roomsPending && (
          <p className="mt-3 flex items-center justify-end gap-1.5 text-xs font-medium text-amber-700">
            <Info size={14} className="shrink-0" />
            Rooms are not allocated yet — to be announced (TBA).
          </p>
        )}

        <div className="mt-4">
          {loading ? (
            <div className="space-y-2">{Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-10 animate-pulse rounded-lg bg-slate-100" />)}</div>
          ) : !child ? (
            <p className="rounded-xl bg-slate-50 py-12 text-center text-sm text-slate-500">No child is linked to this account yet.</p>
          ) : !hasRoutine ? (
            <p className="rounded-xl bg-slate-50 py-12 text-center text-sm text-slate-500">The school hasn&apos;t published a timetable for {classLine} yet.</p>
          ) : (
            <AnimatePresence mode="wait">
              {tab === 'weekly' ? (
                <motion.div key="weekly" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full min-w-270 table-fixed border-separate border-spacing-0 text-sm">
                    <colgroup><col className="w-40" />{grid.days.map((d) => <col key={d} />)}</colgroup>
                    <thead>
                      <tr className="bg-slate-50">
                        <th className="border-b border-r border-slate-100 px-3 py-2.5 text-center font-semibold text-slate-800">Time</th>
                        {grid.days.map((d, i) => (
                          <th key={d} className={`border-b border-slate-100 px-2 py-2.5 text-center ${i === todayIdx ? 'bg-blue-50' : ''}`}>
                            <span className="block font-semibold text-slate-800">{d}</span>
                            <span className="block text-[11px] font-normal text-slate-500">{fmtDay(weekDates[i])}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {grid.rows.map((r, ri) => (
                        <motion.tr key={r.key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: Math.min(ri * 0.03, 0.4) }}>
                          <td className={`whitespace-nowrap border-b border-r border-slate-100 px-3 py-2 text-center text-xs ${r.isBreak ? (/lunch/i.test(r.breakName) ? 'bg-red-100 font-bold text-red-600' : 'bg-blue-100 font-bold text-blue-700') : 'font-medium text-slate-700'}`}>
                            {r.label}
                          </td>
                          {r.isBreak ? (
                            <td colSpan={grid.days.length} className={`border-b border-slate-100 px-2 py-1.5 ${/lunch/i.test(r.breakName) ? 'bg-red-100' : 'bg-blue-100'}`}>
                              <span className={`flex items-center justify-center gap-2 py-1 text-base font-bold ${/lunch/i.test(r.breakName) ? 'text-red-600' : 'text-blue-700'}`}>
                                {/lunch/i.test(r.breakName) ? <UtensilsCrossed size={18} /> : <Coffee size={18} />} {r.breakName}
                              </span>
                            </td>
                          ) : grid.days.map((d, i) => {
                            const e = r.cells[d];
                            const sty = e ? subjectStyle(e.subject) : null;
                            return (
                              <td key={d} className={`h-px border-b border-slate-100 p-1.5 align-top ${i === todayIdx ? 'bg-blue-50/30' : ''}`}>
                                {e ? (
                                  <motion.div
                                    whileHover={{ y: -2 }}
                                    title={[e.subject, e.instructor && e.instructor !== 'TBA' ? e.instructor : '', e.roomLocation || e.room].filter(Boolean).join(' · ')}
                                    className={`box-border flex h-full min-h-23 items-center gap-2.5 rounded-xl px-2.5 py-2 transition-shadow hover:shadow-md ${sty.cls}`}
                                  >
                                    <span className="min-w-0 flex-1 leading-tight text-center">
                                      <span className="block truncate text-xs font-bold text-slate-900 text-center">{e.subject}</span>
                                      {(e.roomBuilding || e.roomFloor || e.roomNumber) ? (
                                        <>
                                          {e.roomBuilding ? (
                                            <span className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-500"><span className="truncate">{e.roomBuilding}</span></span>
                                          ) : null}
                                          {(e.roomFloor || e.roomNumber) ? (
                                            <span className="mt-0.5 flex items-center justify-center gap-1 text-[10px] text-slate-500"><span className="truncate">{[e.roomFloor, e.roomNumber].filter(Boolean).join(' · ')}</span></span>
                                          ) : null}
                                        </>
                                      ) : (
                                        <span className="mt-1 flex items-center justify-center gap-1 text-[10px] text-slate-500"><span className="truncate">{e.room || 'TBA'}</span></span>
                                      )}
                                      <span className={`mt-1 flex items-center justify-center gap-1 text-[10.5px] font-medium ${sty.accent}`}>
                                        <span className="truncate">{e.instructor && e.instructor !== 'TBA' ? e.instructor : 'TBA'}</span>
                                      </span>
                                    </span>
                                  </motion.div>
                                ) : (
                                  <div className="flex h-full min-h-23 flex-col items-center justify-center gap-1 rounded-xl bg-slate-50 text-slate-400">
                                    <span>-</span><span>-</span><span>-</span>
                                  </div>
                                )}
                              </td>
                            );
                          })}
                        </motion.tr>
                      ))}
                    </tbody>
                  </table>
                </motion.div>
              ) : (
                <motion.div key="subjects" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} transition={{ duration: 0.2 }} className="overflow-x-auto rounded-xl border border-slate-100">
                  <table className="w-full min-w-150 text-sm">
                    <thead>
                      <tr className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                        <th className="px-4 py-3">Subject</th>
                        <th className="px-4 py-3">Teacher</th>
                        <th className="px-4 py-3 text-right">Periods / week</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {subjects.map((s) => {
                        const sty = subjectStyle(s.name);
                        return (
                          <tr key={s.name}>
                            <td className="px-4 py-3">
                              <span className="flex items-center gap-3">
                                <span className={`flex h-9 w-9 items-center justify-center rounded-lg ${sty.cls}`}><sty.Icon size={17} className={sty.icon} /></span>
                                <span className="font-semibold text-slate-800">{s.name}</span>
                              </span>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{s.teachers.join(', ') || 'To be assigned'}</td>
                            <td className="px-4 py-3 text-right font-semibold text-slate-900">{s.periods}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.section>

      {/* ── Subject list ── */}
      {hasRoutine && (
        <motion.section variants={RISE} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_2px_12px_rgba(15,23,42,0.04)] sm:p-5">
          <h2 className="text-base font-bold text-slate-900">Subject List</h2>
          <p className="text-sm text-slate-500">Subjects in {classLine}</p>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
            {subjects.map((s, i) => {
              const sty = subjectStyle(s.name);
              return (
                <motion.div
                  key={s.name}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: Math.min(i * 0.03, 0.4) }}
                  whileHover={{ y: -2 }}
                  className={`flex items-center gap-3 rounded-xl px-3.5 py-3 ${sty.cls}`}
                >
                  <sty.Icon size={20} className={`shrink-0 ${sty.icon}`} />
                  <span className="text-sm font-medium leading-snug text-slate-800">{s.name}</span>
                </motion.div>
              );
            })}
          </div>
        </motion.section>
      )}
    </motion.div>
  );
};

export default ParentClassRoutine;
