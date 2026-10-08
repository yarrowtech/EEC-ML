/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { GripVertical, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ChapterItem = ({ chapter, index = 0, total = 1, isActive, onClick, onDragStart, onDrop, onDelete, onRename }) => {
  const [isRenaming, setIsRenaming] = useState(false);
  const [draftTitle, setDraftTitle] = useState(chapter.title);
  const renameInputRef = useRef(null);

  useEffect(() => {
    if (!isRenaming) return;
    setDraftTitle(chapter.title);
    const raf = requestAnimationFrame(() => renameInputRef.current?.focus());
    return () => cancelAnimationFrame(raf);
  }, [isRenaming, chapter.title]);

  const stopActionEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
  };

  const stopActionPointer = (event) => {
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
  };

  const commitRename = () => {
    setIsRenaming(false);
    const trimmed = draftTitle.trim();
    if (trimmed && trimmed !== chapter.title) onRename?.(chapter.id, trimmed);
  };

  const cancelRename = () => setIsRenaming(false);

  const progress = total ? Math.round(((index + 1) / total) * 100) : 0;
  const status = chapter.status === 'published' && chapter.isDraft === false ? 'Published' : 'Draft';
  const statusClass = status === 'Published'
    ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300'
    : 'bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300';

  return (
    <Motion.div
      layout
      // whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(chapter.id)}
      onClick={() => { if (!isRenaming) onClick(); }}
      className={`group relative cursor-pointer overflow-hidden rounded-xl border p-2.5 transition-all focus-within:ring-2 focus-within:ring-indigo-300 ${isActive
          ? 'border-2 border-indigo-500/80 bg-indigo-50/50 shadow-[0_4px_14px_-2px_rgba(79,70,229,0.18)] ring-2 ring-indigo-500/10 dark:border-indigo-600 dark:bg-indigo-950/40'
          : 'border-slate-200/90 bg-white shadow-sm hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-indigo-700'
        }`}
    >
      {isActive && (
        <Motion.div
          layoutId="active-chapter-indicator"
          className="absolute inset-y-2 left-0 w-1 rounded-r-full bg-indigo-600"
        />
      )}

      <div className={`flex items-center gap-1.5 ${isActive ? 'pl-1' : ''}`}>
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            onDragStart(chapter.id);
          }}
          className="cursor-grab rounded p-0.5 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing dark:hover:bg-slate-800"
          aria-label={`Drag chapter ${chapter.title}`}
          title="Drag to reorder"
          onClick={stopActionEvent}
        >
          <GripVertical className="size-4" />
        </button>

        {isRenaming ? (
          <div className="min-w-0 flex-1">
            <div className="mb-2 flex items-center gap-2">
              <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${isActive ? 'bg-[#2563eb] text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
                {index + 1}
              </span>
              <Badge className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400">
                {progress}% mapped
              </Badge>
              <Badge className={`rounded-full px-2 py-0.5 text-[8px] font-semibold ${statusClass}`}>
                {status}
              </Badge>
            </div>
            <input
              ref={renameInputRef}
              value={draftTitle}
              onChange={(event) => setDraftTitle(event.target.value)}
              onClick={stopActionPointer}
              onPointerDown={stopActionPointer}
              onMouseDown={stopActionPointer}
              onBlur={commitRename}
              onKeyDown={(event) => {
                event.stopPropagation();
                if (event.key === 'Enter') { event.preventDefault(); commitRename(); }
                if (event.key === 'Escape') { event.preventDefault(); cancelRename(); }
              }}
              aria-label={`Rename chapter, currently ${chapter.title}`}
              className="w-full rounded-lg border border-blue-300 bg-white px-2 py-1 text-sm font-semibold text-slate-800 outline-none focus:ring-2 focus:ring-blue-300 dark:border-blue-700 dark:bg-slate-900 dark:text-slate-100"
            />
          </div>
        ) : (
          <button type="button" className="min-w-0 flex-1 text-left focus-visible:outline-none">
            <div className="mb-2 flex items-center gap-2">
              <span className={`flex size-5 shrink-0 items-center justify-center rounded-md text-[10px] font-bold ${isActive ? 'bg-indigo-600 text-white shadow-sm shadow-indigo-500/40' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'}`}>
                {index + 1}
              </span>
              <Badge className={`rounded px-1.5 py-0.5 text-[9px] font-semibold ${isActive ? 'bg-indigo-100 text-indigo-700 hover:bg-indigo-100' : 'bg-slate-100 text-slate-600 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400'}`}>
                {progress}%
              </Badge>
              <Badge className={`rounded border px-1.5 py-0.5 text-[9px] font-semibold ${status === 'Published' ? 'border-emerald-200/60 bg-emerald-50 text-emerald-700' : statusClass}`}>
                {status === 'Published' ? 'Publish' : 'Draft'}
              </Badge>
              {isActive && <span className="ml-auto size-1.5 rounded-full bg-indigo-500" />}
            </div>

            <p className={`truncate text-xs tracking-tight ${isActive ? 'font-bold text-indigo-950' : 'font-semibold text-slate-800 dark:text-slate-100'}`}>{chapter.title}</p>
          </button>
        )}

        {!isRenaming && (
          <div className="flex shrink-0 items-center gap-0.5 pl-0.5">
            <Button
              variant="ghost"
              size="icon-xs"
              onPointerDown={stopActionPointer}
              onMouseDown={stopActionPointer}
              onClick={(event) => { stopActionEvent(event); onDelete?.(chapter.id); }}
              className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-500"
              title="Delete chapter"
              aria-label={`Delete chapter ${chapter.title}`}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
        )}
      </div>

      <div className={`mt-2 h-1.5 overflow-hidden rounded-full ${isActive ? 'bg-indigo-100' : 'bg-slate-100 dark:bg-slate-800'}`}>
        <Motion.div className={`h-full rounded-full ${progress >= 100 ? 'bg-gradient-to-r from-emerald-500 to-teal-500' : isActive ? 'bg-gradient-to-r from-indigo-600 via-indigo-600 to-violet-600' : 'bg-gradient-to-r from-indigo-500 to-violet-500'}`} initial={false} animate={{ width: `${progress}%` }} />
      </div>

    </Motion.div>
  );
};

export default ChapterItem;
