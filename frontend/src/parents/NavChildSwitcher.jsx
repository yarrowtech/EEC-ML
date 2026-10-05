import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Check, ChevronDown, Repeat } from 'lucide-react';
import useParentChildren from './useParentChildren';
import { childOptionKey } from './ChildSwitcher';

// Navbar child switcher — the single place a parent changes the active child.
// Every screen reads the shared selection (ChildSwitcher store), so switching
// here updates whichever page is open. Hidden when only one child is linked.
const initials = (name) => String(name || 'C').trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

const Avatar = ({ child, size = 'h-7 w-7' }) => (child?.profilePic || child?.photo ? (
  <img src={child.profilePic || child.photo} alt="" className={`${size} shrink-0 rounded-full object-cover`} />
) : (
  <span className={`${size} flex shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-bold text-blue-700`}>{initials(child?.name)}</span>
));

const NavChildSwitcherInner = () => {
  const { children, options, childKey, setChildKey, selected } = useParentChildren();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', close);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', close);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  if (options.length < 2) return null;

  const classLine = (c) => [c?.grade && `Class ${c.grade}`, c?.section && `Sec ${c.section}`].filter(Boolean).join(' · ');

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`Switch child (viewing ${selected?.name || 'child'})`}
        className="flex h-10 items-center gap-2 rounded-full border border-white/30 bg-white/40 pl-1 pr-2.5 text-left transition hover:border-white/60 hover:bg-white/80"
      >
        <Avatar child={selected} size="h-8 w-8" />
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block max-w-[120px] truncate text-xs font-semibold text-slate-900">{selected?.name || 'Select child'}</span>
          <span className="flex items-center gap-1 text-[10px] text-slate-500"><Repeat size={10} /> Switch child</span>
        </span>
        <ChevronDown size={14} className={`shrink-0 text-slate-500 transition ${open ? 'rotate-180' : ''}`} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.ul
            role="listbox"
            aria-label="Children"
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 z-50 mt-2 w-64 overflow-hidden rounded-xl border border-slate-100 bg-white p-1 shadow-xl"
          >
            {options.map((opt, i) => {
              const key = childOptionKey(opt);
              const child = children[i];
              const active = key === childKey;
              return (
                <li key={key}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => { setChildKey(key); setOpen(false); }}
                    className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition ${active ? 'bg-blue-50' : 'hover:bg-slate-50'}`}
                  >
                    <Avatar child={child} />
                    <span className="min-w-0 flex-1 leading-tight">
                      <span className="block truncate text-sm font-semibold text-slate-800">{opt.name}</span>
                      <span className="block truncate text-[11px] text-slate-500">{classLine(child)}</span>
                    </span>
                    {active ? <Check size={15} className="shrink-0 text-blue-600" /> : null}
                  </button>
                </li>
              );
            })}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
};

// Only mount (and fetch the children list) for a logged-in parent.
const NavChildSwitcher = () => {
  let token = '';
  try { token = localStorage.getItem('token') || ''; } catch { /* storage blocked */ }
  return token ? <NavChildSwitcherInner /> : null;
};

export default NavChildSwitcher;
