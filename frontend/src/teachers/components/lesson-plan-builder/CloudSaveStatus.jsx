import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

/**
 * Google-Sheets-style cloud save indicator.
 * Maps the free-text autosave status to: saving (cloud + spinning arrows),
 * saved (cloud + check that draws in), error (cloud with a slash) or idle.
 */
const stateOf = (status) => {
  const s = String(status || '').toLowerCase();
  if (/saving|uploading|deleting|publishing|loading/.test(s)) return 'saving';
  if (/fail|error/.test(s)) return 'error';
  if (!s || /not saved|no chapters/.test(s)) return 'idle';
  return 'saved';
};

const LABELS = {
  saving: 'Saving…',
  saved: 'Saved to cloud',
  error: 'Couldn’t save',
  idle: 'Not saved yet',
};

const CLOUD = 'M7 18a4.5 4.5 0 0 1-.6-8.96A6 6 0 0 1 17.9 8.6 4.75 4.75 0 0 1 17.25 18H7z';

const CloudIcon = ({ state }) => (
  <svg viewBox="0 0 24 24" className="size-[18px] shrink-0" fill="none" aria-hidden="true">
    <path d={CLOUD} stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    {state === 'saving' && (
      <g className="animate-spin" style={{ transformBox: 'view-box', transformOrigin: '12px 13px', animationDuration: '1s' }}>
        <path d="M9.5 13a2.5 2.5 0 0 1 4.3-1.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        <path d="M14.5 13a2.5 2.5 0 0 1-4.3 1.75" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      </g>
    )}
    {state === 'saved' && (
      <motion.path
        key="saved-check"
        d="M9.3 13.2l1.9 1.9 3.6-3.7"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut', delay: 0.1 }}
      />
    )}
    {state === 'error' && <path d="M5 5l14 14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
  </svg>
);

const TONE = {
  saving: 'text-slate-500 dark:text-slate-400',
  saved: 'text-slate-500 dark:text-slate-400',
  error: 'text-rose-600 dark:text-rose-400',
  idle: 'text-slate-400 dark:text-slate-500',
};

const MIN_SAVING_MS = 700;

const CloudSaveStatus = ({ status, className = '' }) => {
  const target = stateOf(status);
  const [state, setState] = useState(target);
  const savingSince = useRef(target === 'saving' ? Date.now() : 0);

  // Keep "Saving…" on screen long enough to be seen before it turns into the
  // check, like Google Sheets, even when the save itself is instant.
  useEffect(() => {
    if (target === 'saving') {
      savingSince.current = Date.now();
      setState('saving');
      return undefined;
    }
    const wait = savingSince.current ? Math.max(0, MIN_SAVING_MS - (Date.now() - savingSince.current)) : 0;
    const id = setTimeout(() => { savingSince.current = 0; setState(target); }, wait);
    return () => clearTimeout(id);
  }, [target, status]);
  return (
    <span
      role="status"
      aria-live="polite"
      title={status || LABELS[state]}
      className={`inline-flex items-center gap-1.5 text-sm font-medium ${TONE[state]} ${className}`}
    >
      <CloudIcon state={state} />
      {/* label */}
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={state}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className="whitespace-nowrap"
        >
          {state === 'error' && /load/i.test(status || '') ? 'Couldn’t load' : state === 'error' && /upload/i.test(status || '') ? 'Upload failed' : LABELS[state]}
        </motion.span>
      </AnimatePresence>
    </span>
  );
};

export default CloudSaveStatus;
