import React, { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Copy, GripVertical, MoreHorizontal, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';

const ChapterItem = ({ chapter, index = 0, total = 1, isActive, onClick, onDelete, onRename, onDragStart, onDrop }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(chapter.title);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setDraft(chapter.title);
  }, [chapter.title]);

  const submitEdit = () => {
    const value = draft.trim() || 'Untitled Chapter';
    onRename(chapter.id, value);
    setIsEditing(false);
  };

  const stopActionEvent = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  const handleDelete = async (event) => {
    stopActionEvent(event);
    if (isDeleting) return;
    setIsDeleting(true);
    try {
      await onDelete(chapter.id);
    } finally {
      setIsDeleting(false);
    }
  };

  const progress = total ? Math.round(((index + 1) / total) * 100) : 0;

  return (
    <Motion.div
      layout
      whileHover={{ y: -2, scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      transition={{ type: 'spring', stiffness: 360, damping: 26 }}
      draggable
      onDragStart={() => onDragStart(chapter.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(chapter.id)}
      className={`group relative cursor-pointer overflow-hidden rounded-2xl border p-3 transition-all focus-within:ring-2 focus-within:ring-blue-300 ${
        isActive
          ? 'border-blue-300 bg-linear-to-br from-blue-50 via-white to-violet-50 shadow-lg shadow-blue-500/10 dark:border-blue-600 dark:from-blue-950/40 dark:via-slate-900 dark:to-violet-950/30'
          : 'border-slate-200 bg-white shadow-sm hover:border-blue-200 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-blue-700'
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
          className="mt-0.5 cursor-grab rounded-lg p-1 text-slate-300 transition hover:bg-slate-100 hover:text-slate-500 active:cursor-grabbing dark:hover:bg-slate-800"
          aria-label={`Drag chapter ${chapter.title}`}
          title="Drag to reorder"
          onClick={stopActionEvent}
        >
          <GripVertical className="size-4" />
        </button>

        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left focus-visible:outline-none">
          <div className="mb-2 flex items-center gap-2">
            <span className={`flex size-6 shrink-0 items-center justify-center rounded-lg text-[11px] font-bold ${isActive ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400'}`}>
              {index + 1}
            </span>
            <Badge className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-400">
              {progress}% mapped
            </Badge>
            {isActive && <Sparkles className="ml-auto size-3.5 text-blue-500" />}
          </div>

          {isEditing ? (
            <Input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={submitEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitEdit();
                if (event.key === 'Escape') {
                  setDraft(chapter.title);
                  setIsEditing(false);
                }
              }}
              className="h-9 rounded-xl border-blue-200 bg-white text-sm dark:bg-slate-950"
              aria-label="Rename chapter"
            />
          ) : (
            <>
              <p className="truncate text-sm font-semibold text-slate-850 dark:text-slate-100">{chapter.title}</p>
              <p className="mt-1 truncate text-[11px] text-slate-500 dark:text-slate-400">AI-ready chapter block · Click to open</p>
            </>
          )}
        </button>
      </div>

      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
        <Motion.div className="h-full rounded-full bg-linear-to-r from-blue-500 to-violet-500" initial={false} animate={{ width: `${progress}%` }} />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1 text-[11px] font-medium text-slate-400">
          <Sparkles className="size-3" /> Smart outline
        </div>
        <div className="flex items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={(event) => {
              stopActionEvent(event);
              setIsEditing((prev) => !prev);
            }}
            className="rounded-lg hover:bg-blue-50 hover:text-blue-700 dark:hover:bg-blue-950/40"
            title="Rename chapter"
            aria-label="Rename chapter"
          >
            <Pencil className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={stopActionEvent} className="rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Duplicate chapter" aria-label="Duplicate chapter">
            <Copy className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={stopActionEvent} className="rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="Add section" aria-label="Add section">
            <Plus className="size-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon-xs"
            onClick={handleDelete}
            disabled={isDeleting}
            className="rounded-lg text-rose-500 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-950/30"
            title={isDeleting ? 'Deleting chapter' : 'Delete chapter'}
            aria-label={isDeleting ? 'Deleting chapter' : 'Delete chapter'}
          >
            <Trash2 className="size-3.5" />
          </Button>
          <Button variant="ghost" size="icon-xs" onClick={stopActionEvent} className="rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800" title="More actions" aria-label="More chapter actions">
            <MoreHorizontal className="size-3.5" />
          </Button>
        </div>
      </div>
    </Motion.div>
  );
};

export default ChapterItem;
