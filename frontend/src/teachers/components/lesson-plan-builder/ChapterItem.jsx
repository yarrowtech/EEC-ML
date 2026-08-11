/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React from 'react';
import { motion as Motion } from 'framer-motion';
import { GripVertical, MoreHorizontal, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const ChapterItem = ({ chapter, index = 0, total = 1, isActive, onClick, onDragStart, onDrop }) => {
  const stopActionEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
  };

  const stopActionPointer = (event) => {
    event.stopPropagation();
    event.nativeEvent?.stopImmediatePropagation?.();
  };

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
      className={`group relative cursor-pointer overflow-hidden rounded-[18px] border p-3 transition-all focus-within:ring-2 focus-within:ring-blue-300 ${isActive
          ? 'border-[#2563eb] bg-[#eef2ff] shadow-sm dark:border-blue-600 dark:bg-blue-950/40'
          : 'border-[#e9edf2] bg-white shadow-sm hover:border-[#bdd3ff] hover:bg-[#fafcff] dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700'
        }`}
    >
      {isActive && (
        <Motion.div
          layoutId="active-chapter-indicator"
          className="absolute inset-y-3 left-0 w-1 rounded-r-full bg-linear-to-b from-blue-500 to-violet-500"
        />
      )}

      <div className="flex items-start gap-2">
        <button
          type="button"
          draggable
          onDragStart={(event) => {
            event.stopPropagation();
            onDragStart(chapter.id);
          }}
          className="mt-0.5 cursor-grab rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing dark:hover:bg-slate-800"
          aria-label={`Drag chapter ${chapter.title}`}
          title="Drag to reorder"
          onClick={stopActionEvent}
        >
          <GripVertical className="size-4" />
        </button>

        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left focus-visible:outline-none">
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
            {isActive && <Sparkles className="ml-auto size-3.5 text-blue-500" />}
          </div>

          <p className="truncate text-sm font-semibold text-slate-800">{chapter.title}</p>
          <p className="mt-1 text-[10px] text-slate-500 dark:text-slate-400 line-clamp-2">AI-ready chapter block · Click to open</p>
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <Motion.div className="h-full rounded-full bg-linear-to-r from-blue-500 to-violet-500" initial={false} animate={{ width: `${progress}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <Sparkles className="size-3" /> Smart outline
        </div>
        <div className={`flex items-center gap-1 transition ${isActive ? 'opacity-100' : 'opacity-100 group-hover:opacity-100 group-focus-within:opacity-100'}`}>
          <Button variant="ghost" size="icon-xs" onPointerDown={stopActionPointer} onMouseDown={stopActionPointer} onClick={stopActionEvent} className="rounded-lg text-slate-800 hover:bg-slate-50 hover:text-slate-800" title="More actions" aria-label="More chapter actions">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </div>
      </div>
    </Motion.div>
  );
};

export default ChapterItem;
