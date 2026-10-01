import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';

// Photo card child picker (name + class/section/roll) with a dropdown when the
// parent has more than one child. `kids`: [{ id, name, photo, grade, section, roll }].
const ChildPicker = ({ kids, selected, onChange }) => {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, []);
  if (!selected) return null;
  const meta = (c) => [c.grade && `Class ${c.grade}`, c.section && `Section ${c.section}`, c.roll !== '' && c.roll != null && `Roll ${c.roll}`].filter(Boolean);
  const Avatar = ({ c, size = 'h-10 w-10' }) => (c.photo ? (
    <img src={c.photo} alt={c.name} className={`${size} shrink-0 rounded-full object-cover`} />
  ) : (
    <span className={`${size} flex shrink-0 items-center justify-center rounded-lg bg-blue-50 text-lg font-bold text-blue-600`}>
      {c.name?.split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()}
    </span>
  ));
  const multi = kids.length > 1;
  return (
    <div ref={ref} className="relative w-full sm:w-[340px] lg:shrink-0">
      <button
        type="button"
        onClick={() => multi && setOpen((v) => !v)}
        className={`flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white p-2 pr-4 text-left ${multi ? 'hover:border-blue-300' : 'cursor-default'}`}
      >
        <Avatar c={selected} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold text-[#10145c]">{selected.name}</p>
          <p className="truncate text-xs text-slate-500">{meta(selected).join('  •  ')}</p>
        </div>
        {multi && <ChevronDown size={18} className={`shrink-0 text-slate-700 transition ${open ? 'rotate-180' : ''}`} />}
      </button>
      {open && (
        <ul className="absolute left-0 right-0 z-30 mt-1 overflow-hidden rounded-xl border border-slate-100 bg-white py-1 shadow-lg">
          {kids.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                onClick={() => { onChange(c.id); setOpen(false); }}
                className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-slate-50 ${c.id === selected.id ? 'bg-blue-50/60' : ''}`}
              >
                <Avatar c={c} size="h-9 w-9" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{c.name}</p>
                  <p className="truncate text-xs text-slate-500">{meta(c).join(' • ')}</p>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default ChildPicker;
