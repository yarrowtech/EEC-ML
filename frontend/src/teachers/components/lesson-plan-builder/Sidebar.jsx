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
      className="relative shrink-0 overflow-hidden rounded-2xl border border-blue-100 bg-white/90 shadow-sm dark:border-slate-700 dark:bg-slate-900/90"
    >
      <div className="flex h-full min-h-0 flex-col p-3">
        <div className="mb-3 flex items-center justify-between">
          {!collapsed && (
            <div className="flex items-center gap-2">
              <h2 className="text-base font-semibold text-slate-800 dark:text-slate-100">Chapters</h2>
              {chapters.length > 0 && (
                <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-blue-100 px-1.5 text-xs font-medium text-blue-700 dark:bg-blue-900/50 dark:text-blue-300">
                  {chapters.length}
                </span>
              )}
            </div>
          )}
          <Button variant="ghost" size="icon-sm" onClick={onToggleCollapse} title={collapsed ? "Expand sidebar" : "Collapse sidebar"}>
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
          {chapters.map((chapter, index) => (
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
          {!collapsed && chapters.length === 0 && (
            <div className="flex flex-col items-center justify-center py-8 px-4 text-center">
              <div className="mb-2 text-slate-400 dark:text-slate-500">
                <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                </svg>
              </div>
              <p className="text-sm font-medium text-slate-600 dark:text-slate-400 mb-1">No chapters yet</p>
              <p className="text-xs text-slate-500 dark:text-slate-500">Click the + button below to add your first chapter</p>
            </div>
          )}
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
