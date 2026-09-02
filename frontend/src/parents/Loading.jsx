import React from 'react';

/*
 * One loading state for every parent screen.
 *   <Loading label="attendance" />           → "Loading attendance…"
 *   <Loading label="fees" rows={4} />
 */
const Loading = ({ label = 'data', rows = 3 }) => (
  <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading {label}…</span>
    <div className="h-14 animate-pulse rounded-2xl bg-slate-100" />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
    ))}
  </div>
);

export default Loading;
