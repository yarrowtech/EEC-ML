import React from 'react';
import { Activity, ClipboardList, CalendarX } from 'lucide-react';
import { useStudentDashboard } from './StudentDashboardContext';

/* SVG circular progress ring */
const Ring = ({ pct = 0, size = 96, stroke = 9, color = '#10b981', bg = '#e5e7eb' }) => {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const offset = circ - (Math.min(100, Math.max(0, pct)) / 100) * circ;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={bg} strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none"
        stroke={color} strokeWidth={stroke}
        strokeDasharray={circ} strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 0.9s ease' }}
      />
    </svg>
  );
};

const attColor  = (pct) => pct >= 75 ? '#10b981' : pct >= 50 ? '#f59e0b' : '#ef4444';
const attLabel  = (pct) => pct >= 75 ? 'Great'   : pct >= 50 ? 'Okay'    : 'Low';
const attBadge  = (pct) => pct >= 75
  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
  : pct >= 50
  ? 'bg-amber-50 text-amber-700 border-amber-200'
  : 'bg-red-50 text-red-600 border-red-200';

const SnapItem = ({ icon, label, value, gradient }) => {
  const Icon = icon;
  return (
    <div className={`relative overflow-hidden rounded-xl bg-linear-to-br ${gradient} p-3.5 shadow-sm`}>
      <div className="pointer-events-none absolute -right-3 -top-3 h-14 w-14 rounded-full bg-white/10" />
      <div className="relative z-10 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/20 backdrop-blur-sm">
          <Icon size={16} className="text-white" />
        </div>
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-white/75">{label}</p>
          <p className="text-lg font-black text-white leading-tight">{value}</p>
        </div>
      </div>
    </div>
  );
};

const CourseProgress = () => {
  const { stats, profile, loading, error } = useStudentDashboard();

  const displayClass   = profile?.className  || profile?.grade   || '';
  const displaySection = profile?.sectionName || profile?.section || '';
  const attPct  = typeof stats?.attendancePercentage === 'number' ? stats.attendancePercentage : null;
  const present = typeof stats?.presentDays  === 'number' ? stats.presentDays  : null;
  const total   = typeof stats?.totalClasses === 'number' ? stats.totalClasses : null;
  const absent  = present !== null && total !== null ? Math.max(0, total - present) : null;

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-100 bg-white p-6 shadow-sm">
        <div className="flex items-center gap-4 mb-5">
          <div className="h-24 w-24 rounded-full bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-32 rounded bg-slate-200" />
            <div className="h-6 w-20 rounded bg-slate-200" />
            <div className="h-3 w-24 rounded bg-slate-200" />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {[0,1].map(i => <div key={i} className="h-16 rounded-xl bg-slate-100" />)}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-sm text-red-600 shadow-sm">
        {error}
      </div>
    );
  }

  const ringColor = attPct !== null ? attColor(attPct) : '#d1d5db';

  return (
    <div className="rounded-2xl border border-slate-100 bg-white shadow-sm overflow-hidden">

      {/* Header bar */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-100">
            <Activity size={15} className="text-emerald-600" />
          </div>
          <h2 className="text-sm font-black text-slate-800">Attendance Snapshot</h2>
        </div>
        {(displayClass || displaySection) && (
          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
            {displayClass ? `Class ${displayClass}` : ''}{displaySection ? ` · ${displaySection}` : ''}
          </span>
        )}
      </div>

      <div className="p-5 sm:p-6">
        {/* ── Attendance ring + details ── */}
        <div className="flex items-center gap-5 sm:gap-6">
          <div className="relative shrink-0">
            <Ring pct={attPct ?? 0} size={104} stroke={10} color={ringColor} />
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-2xl font-black text-slate-800 leading-none">
                {attPct !== null ? `${attPct}%` : '—'}
              </span>
              <span className={`mt-1.5 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide ${attPct !== null ? attBadge(attPct) : 'bg-slate-100 text-slate-500 border-slate-200'}`}>
                {attPct !== null ? attLabel(attPct) : 'N/A'}
              </span>
            </div>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">This term</p>
            {present !== null && total !== null ? (
              <p className="mt-1 text-sm text-slate-600">
                Present <span className="font-black text-slate-800">{present}</span> out of{' '}
                <span className="font-black text-slate-800">{total}</span> classes
              </p>
            ) : (
              <p className="mt-1 text-sm text-slate-400">No attendance recorded yet</p>
            )}
            <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-100">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{ width: `${attPct ?? 0}%`, backgroundColor: ringColor }}
              />
            </div>
          </div>
        </div>

        {/* ── Present / Absent breakdown ── */}
        <div className="mt-5 grid grid-cols-2 gap-3">
          <SnapItem
            icon={ClipboardList}
            label="Present Days"
            value={present !== null ? present : '—'}
            gradient="from-emerald-500 to-teal-600"
          />
          <SnapItem
            icon={CalendarX}
            label="Absent Days"
            value={absent !== null ? absent : '—'}
            gradient="from-rose-500 to-red-600"
          />
        </div>
      </div>
    </div>
  );
};

export default CourseProgress;
