import React from 'react';

/*
 * One loading state for every parent screen.
 *   <Loading label="attendance" />        → announces "Loading attendance…"
 *   <Loading label="fees" rows={4} />
 */
const Loading = ({ label = 'data', rows = 3 }) => (
  <div className="space-y-3" role="status" aria-live="polite" aria-busy="true">
    <span className="sr-only">Loading {label}…</span>
    <div className="p-skel" style={{ '--h': '3.5rem' }} />
    {Array.from({ length: rows }).map((_, i) => (
      <div key={i} className="p-skel" />
    ))}
  </div>
);

export default Loading;
