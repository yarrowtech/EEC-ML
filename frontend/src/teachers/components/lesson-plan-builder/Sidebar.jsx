import React from 'react';
import { motion } from 'framer-motion';
import { Plus, PanelLeftClose, PanelLeftOpen, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ChapterItem from './ChapterItem';

const Sidebar = ({
  chapters,
  activeChapterId,
  query,
  onQueryChange,
  onSelect,
  onAdd,
  onDelete,
  onRename,
  collapsed,
  onToggleCollapse,
  onDragStart,
  onDrop,
}) => {
  return (
    <motion.aside
      animate={{ width: collapsed ? 88 : 320 }}
      className="relative shrink-0 overflow-hidden rounded-2xl border border-blue-100 bg-white/90 shadow-sm"
    >
      <div className="flex h-full min-h-0 flex-col p-3">
        <div className="mb-3 flex items-center justify-between">
          {!collapsed && <h2 className="text-sm font-semibold text-slate-700">Chapters</h2>}
          <Button variant="ghost" size="icon-sm" onClick={onToggleCollapse}>
            {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
          </Button>
        </div>

        {!collapsed && (
          <div className="relative mb-3">
            <Search className="pointer-events-none absolute left-2 top-2 size-4 text-slate-400" />
            <Input
              value={query}
              onChange={(event) => onQueryChange(event.target.value)}
              placeholder="Search chapters"
              className="h-9 rounded-xl border-blue-100 pl-8"
            />
          </div>
        )}

        <div className="flex-1 min-h-0 space-y-2 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-200 hover:[&::-webkit-scrollbar-thumb]:bg-blue-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
          {chapters.map((chapter) => (
            <ChapterItem
              key={chapter.id}
              chapter={chapter}
              isActive={chapter.id === activeChapterId}
              onClick={() => onSelect(chapter.id)}
              onDelete={onDelete}
              onRename={onRename}
              onDragStart={onDragStart}
              onDrop={onDrop}
            />
          ))}
          {!chapters.length && !collapsed && <p className="p-2 text-sm text-slate-500">No chapters found.</p>}
        </div>

        <Button
          size="icon-lg"
          onClick={onAdd}
          className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg"
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </motion.aside>
  );
};

export default Sidebar;
