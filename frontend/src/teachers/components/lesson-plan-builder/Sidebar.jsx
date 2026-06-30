import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  ChevronRight,
  Layers,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import ChapterItem from './ChapterItem';

const sidebarVariants = {
  expanded: { width: 256 },
  collapsed: { width: 58 },
};

const contentVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0, transition: { staggerChildren: 0.035 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: { opacity: 1, y: 0 },
};

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
  const hasSearch = query.trim().length > 0;

  return (
    <Motion.aside
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="relative shrink-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/70 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/90 dark:shadow-black/20 self-start"
      aria-label="Lesson chapters sidebar"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-linear-to-b from-blue-50/90 to-transparent dark:from-blue-950/20" />

      <div className="relative flex h-full min-h-0 flex-col p-2.5">
        {/* Header */}
        <div className="mb-2.5">
          <div className={`flex items-start ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}>
            {!collapsed && (
              <div className="min-w-0 flex items-center gap-1.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
                  <Layers className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <span className="flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full bg-blue-600 text-[9px] font-bold text-white">2</span>
                    <h2 className="truncate text-xs font-semibold text-slate-900 dark:text-slate-50">Your Chapters</h2>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-500 dark:text-slate-400">
                    {chapters.length === 0 ? 'No chapters yet' : `${chapters.length} chapter${chapters.length === 1 ? '' : 's'}`}
                  </p>
                </div>
              </div>
            )}
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={onToggleCollapse}
                title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
              {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
            </Button>
          </div>
          {!collapsed && <Separator className="mt-2.5 bg-slate-200 dark:bg-slate-800" />}
        </div>

        <AnimatePresence initial={false} mode="wait">
          {!collapsed ? (
            <Motion.div
              key="expanded-content"
              variants={contentVariants}
              initial="hidden"
              animate="visible"
              exit="hidden"
              className="flex min-h-0 flex-1 flex-col"
            >
              {/* Search */}
              <Motion.div variants={itemVariants} className="mb-2.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Search chapters..."
                    className="h-8 rounded-xl border-slate-200 bg-slate-50/80 pl-8 text-xs focus-visible:ring-2 focus-visible:ring-blue-200 dark:bg-slate-900"
                    style={{ color: '#0f172a', caretColor: '#0f172a' }}
                    aria-label="Search chapters"
                  />
                </div>
                {hasSearch && (
                  <p className="mt-1 px-1 text-[10px] text-slate-500">
                    {chapters.length} result{chapters.length === 1 ? '' : 's'}
                  </p>
                )}
              </Motion.div>

              {/* Hint */}
              <Motion.div variants={itemVariants} className="mb-1.5 px-1">
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  Click a chapter to open it, or use + to create one
                </p>
              </Motion.div>

              {/* Chapter list */}
              <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-14 pr-1 [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-200 hover:[&::-webkit-scrollbar-thumb]:bg-blue-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
                <AnimatePresence initial={false}>
                  {chapters.map((chapter, index) => (
                    <Motion.div
                      key={chapter.id}
                      variants={itemVariants}
                      layout
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, x: -10, height: 0 }}
                    >
                      <ChapterItem
                        chapter={chapter}
                        index={index}
                        total={chapters.length}
                        isActive={chapter.id === activeChapterId}
                        onClick={() => onSelect(chapter.id)}
                        onDelete={onDelete}
                        onRename={onRename}
                        onDragStart={onDragStart}
                        onDrop={onDrop}
                      />
                    </Motion.div>
                  ))}
                </AnimatePresence>

                {chapters.length === 0 && <EmptyState onAdd={onAdd} />}
              </div>
            </Motion.div>
          ) : (
            <CollapsedRail
              key="collapsed-content"
              chapters={chapters}
              activeChapterId={activeChapterId}
              onSelect={onSelect}
              onToggleCollapse={onToggleCollapse}
            />
          )}
        </AnimatePresence>

        {/* Floating add button */}
        <div className="absolute bottom-3.5 left-1/2 z-10 -translate-x-1/2">
          <Button
            size={collapsed ? 'icon-lg' : 'sm'}
            onClick={onAdd}
            title="Add chapter"
            aria-label="Add chapter"
            className={`rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 ${collapsed ? '' : 'px-3.5 py-2'}`}
          >
            <Plus className="size-4" />
            {!collapsed && <span className="ml-1.5 text-[11px] font-semibold">Add Chapter</span>}
          </Button>
        </div>
      </div>
    </Motion.aside>
  );
};

const EmptyState = () => (
  <Motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-2xl border border-dashed border-blue-200 bg-blue-50/50 p-4 text-center dark:border-blue-900/60 dark:bg-blue-950/20"
  >
    <div className="mx-auto mb-2.5 flex size-9 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-950 dark:text-blue-300">
      <Lightbulb className="size-4" />
    </div>
    <p className="text-xs font-semibold text-slate-700 dark:text-slate-200">No chapters yet</p>
    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Click the + button below to create your first chapter.</p>
  </Motion.div>
);

const CollapsedRail = ({ chapters, activeChapterId, onSelect, onToggleCollapse }) => (
  <Motion.div
    key="collapsed-rail"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="flex min-h-0 flex-1 flex-col items-center gap-1.5 pt-1"
  >
    <button
      type="button"
      onClick={onToggleCollapse}
      className="mb-2 flex size-9 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm transition hover:scale-105 dark:bg-white dark:text-slate-950"
      aria-label="Expand sidebar"
      title="Expand sidebar"
    >
      <ChevronRight className="size-3.5" />
    </button>
    <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto pb-12 px-1">
      {chapters.slice(0, 12).map((chapter, index) => {
        const active = chapter.id === activeChapterId;
        return (
          <button
            key={chapter.id}
            type="button"
            onClick={() => onSelect(chapter.id)}
            title={chapter.title}
            className={`flex size-9 items-center justify-center rounded-2xl text-[11px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
              active
                ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                : 'bg-slate-100 text-slate-500 hover:bg-blue-50 hover:text-blue-700 dark:bg-slate-800 dark:text-slate-400'
            }`}
          >
            {index + 1}
          </button>
        );
      })}
    </div>
  </Motion.div>
);

export default Sidebar;
