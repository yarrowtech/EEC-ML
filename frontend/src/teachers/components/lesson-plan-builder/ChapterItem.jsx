import React, { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

const ChapterItem = ({ chapter, isActive, onClick, onDelete, onRename, onDragStart, onDrop }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(chapter.title);

  useEffect(() => {
    setDraft(chapter.title);
  }, [chapter.title]);

  const submitEdit = () => {
    const value = draft.trim() || 'Untitled Chapter';
    onRename(chapter.id, value);
    setIsEditing(false);
  };

  return (
    <motion.div
      layout
      whileHover={{ x: 4 }}
      transition={{ type: 'spring', stiffness: 350, damping: 24 }}
      draggable
      onDragStart={() => onDragStart(chapter.id)}
      onDragOver={(event) => event.preventDefault()}
      onDrop={() => onDrop(chapter.id)}
      className={`group rounded-2xl border p-3 transition ${
        isActive ? 'border-blue-300 bg-gradient-to-r from-blue-50 to-purple-50 shadow-sm' : 'border-slate-200 bg-white hover:border-blue-200'
      }`}
    >
      <div className="flex items-center gap-2">
        <button type="button" onClick={onClick} className="min-w-0 flex-1 text-left">
          {isEditing ? (
            <Input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={submitEdit}
              onKeyDown={(event) => {
                if (event.key === 'Enter') submitEdit();
              }}
              className="h-8 rounded-lg"
            />
          ) : (
            <p className="truncate text-sm font-medium text-slate-800">{chapter.title}</p>
          )}
        </button>

        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => setIsEditing((prev) => !prev)}
          className="opacity-0 transition group-hover:opacity-100"
        >
          <Pencil className="size-3.5" />
        </Button>
        <Button
          variant="ghost"
          size="icon-xs"
          onClick={() => onDelete(chapter.id)}
          className="text-rose-500 opacity-0 transition hover:text-rose-600 group-hover:opacity-100"
        >
          <Trash2 className="size-3.5" />
        </Button>
      </div>
    </motion.div>
  );
};

export default ChapterItem;
