import React from 'react';
import { Calendar, Clock, MapPin } from 'lucide-react';

const formatRoutineDate = (raw) => {
  if (!raw) return 'TBA';
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return String(raw);
  return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

const ExamRoutineTable = ({ rows }) => {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return (
    <div className="rounded-xl border border-emerald-100 overflow-hidden">
      <div className="px-4 py-2.5 bg-emerald-600 text-white text-xs font-bold uppercase tracking-wide">
        Examination Schedule
      </div>
      <div className="overflow-x-auto bg-emerald-50/40">
        <table className="w-full text-sm">
          <thead>
            <tr>
              {['Subject', 'Date', 'Time', 'Duration', 'Venue'].map((h) => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wide whitespace-nowrap text-emerald-700 bg-emerald-100/60">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-emerald-100/70">
            {rows.map((row, idx) => (
              <tr key={`${row.subject}-${idx}`} className="odd:bg-white even:bg-emerald-50/30">
                <td className="px-3 py-2 font-semibold text-slate-700 whitespace-nowrap">{row.subject || '—'}</td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <Calendar className="h-3 w-3 text-slate-400" />
                    {formatRoutineDate(row.date)}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3 text-slate-400" />
                    {row.time || 'TBA'}
                  </span>
                </td>
                <td className="px-3 py-2 text-slate-600 whitespace-nowrap">{row.duration ? `${row.duration} min` : '—'}</td>
                <td className="px-3 py-2 text-slate-600">
                  <span className="inline-flex items-center gap-1">
                    <MapPin className="h-3 w-3 text-slate-400 shrink-0" />
                    {row.venue || '—'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default ExamRoutineTable;
