import React, { useLayoutEffect, useState } from 'react';
import { ChevronRight } from 'lucide-react';

export function useCompactExamLayout(enabled = true) {
  const [compact, setCompact] = useState(false);
  useLayoutEffect(() => {
    if (!enabled || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia('(max-width: 1023.98px), (max-width: 1366px) and (pointer: coarse)');
    const update = () => setCompact(media.matches);
    update();
    media.addEventListener?.('change', update);
    return () => media.removeEventListener?.('change', update);
  }, [enabled]);
  return enabled && compact;
}

export const ResultPickerCard = ({ title, subtitle, icon: Icon, onClick, tags = null }) => (
  <button
    type="button"
    onClick={onClick}
    className="flex w-full items-center gap-3 rounded-xl border border-l-4 border-slate-200 border-l-violet-500 bg-white p-4 text-left shadow-sm transition hover:bg-violet-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-violet-600"
  >
    <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-100 text-violet-700">
      <Icon size={20} aria-hidden="true" />
    </span>
    <span className="min-w-0 flex-1">
      <span className="block break-words text-sm font-bold text-slate-900">{title}</span>
      {subtitle && <span className="mt-1 block text-xs text-slate-600">{subtitle}</span>}
      {tags && <span className="mt-2 flex flex-wrap items-center gap-1.5">{tags}</span>}
    </span>
    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-violet-100 text-violet-700">
      <ChevronRight size={18} aria-hidden="true" />
    </span>
  </button>
);
