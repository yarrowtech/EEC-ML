import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Bot,
  ChevronRight,
  Copy,
  FileDown,
  GripVertical,
  Layers,
  Lightbulb,
  ListTree,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  Search,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import ChapterItem from './ChapterItem';

const sidebarVariants = {
  expanded: { width: 336 },
  collapsed: { width: 88 },
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
  const activeIndex = chapters.findIndex((chapter) => chapter.id === activeChapterId);
  const completion = chapters.length ? Math.round(((activeIndex + 1 || 1) / chapters.length) * 100) : 0;
  const hasSearch = query.trim().length > 0;

  return (
    <Motion.aside
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className="relative shrink-0 overflow-hidden rounded-3xl border border-slate-200/80 bg-white/90 shadow-xl shadow-slate-200/70 backdrop-blur-xl dark:border-slate-700 dark:bg-slate-950/90 dark:shadow-black/20"
      aria-label="Lesson chapters workspace navigator"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-linear-to-b from-blue-50/90 to-transparent dark:from-blue-950/20" />
      <div className="relative flex h-full min-h-0 flex-col p-3">
        <WorkspaceHeader
          collapsed={collapsed}
          chapters={chapters}
          activeIndex={activeIndex}
          completion={completion}
          onToggleCollapse={onToggleCollapse}
        />

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
              <Motion.div variants={itemVariants} className="mb-3">
                <div className="relative rounded-2xl border border-slate-200 bg-slate-50/80 p-1.5 shadow-inner dark:border-slate-700 dark:bg-slate-900/70">
                  <Search className="pointer-events-none absolute left-4 top-1/2 size-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Search chapters, topics, keywords..."
                    className="h-10 rounded-xl border-0 bg-white pl-9 text-sm shadow-sm focus-visible:ring-2 focus-visible:ring-blue-200 dark:bg-slate-950"
                    aria-label="Search chapters"
                  />
                </div>
                {hasSearch && (
                  <p className="mt-2 px-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">
                    Showing {chapters.length} matching chapter{chapters.length === 1 ? '' : 's'}
                  </p>
                )}
              </Motion.div>

              <Motion.div variants={itemVariants} className="mb-3 rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Chapter overview</p>
                    <p className="mt-1 text-sm font-semibold text-slate-800 dark:text-slate-100">
                      {chapters.length || 0} chapter{chapters.length === 1 ? '' : 's'} in structure
                    </p>
                  </div>
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-blue-50 text-blue-600 dark:bg-blue-950/40 dark:text-blue-300">
                    <ListTree className="size-5" />
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                  <Motion.div
                    className="h-full rounded-full bg-linear-to-r from-blue-500 to-violet-500"
                    initial={false}
                    animate={{ width: `${completion}%` }}
                  />
                </div>
              </Motion.div>

              <Motion.div variants={itemVariants} className="mb-2 flex items-center justify-between px-1">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">Navigation tree</p>
                </div>
                <div className="flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-[10px] font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                  <GripVertical className="size-3" /> Drag to reorder
                </div>
              </Motion.div>

              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1 [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-blue-200 hover:[&::-webkit-scrollbar-thumb]:bg-blue-300 dark:[&::-webkit-scrollbar-thumb]:bg-slate-700 [&::-webkit-scrollbar-track]:bg-transparent">
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

              <QuickActions />
              <AiAssistLayer />
            </Motion.div>
          ) : (
            <CollapsedRail key="collapsed-content" chapters={chapters} activeChapterId={activeChapterId} onSelect={onSelect} onToggleCollapse={onToggleCollapse} />
          )}
        </AnimatePresence>

        <FloatingCreateButton collapsed={collapsed} onAdd={onAdd} />
      </div>
    </Motion.aside>
  );
};

const WorkspaceHeader = ({ collapsed, chapters, activeIndex, completion, onToggleCollapse }) => (
  <div className="mb-3">
    <div className={`flex items-start ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}>
      {!collapsed && (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <div className="flex size-9 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm dark:bg-white dark:text-slate-950">
              <Layers className="size-4" />
            </div>
            <div className="min-w-0">
              <h2 className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">Lesson Chapters</h2>
              <p className="text-[11px] font-medium text-slate-500 dark:text-slate-400">
                {chapters.length} Chapters · Auto Saved
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <Badge className="rounded-full bg-blue-50 text-blue-700 hover:bg-blue-50 dark:bg-blue-950/50 dark:text-blue-300">{completion}% mapped</Badge>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300">
              <span className="size-1.5 rounded-full bg-emerald-500" /> Active lesson
            </span>
          </div>
        </div>
      )}

      <Button
        variant="ghost"
        size="icon-sm"
        onClick={onToggleCollapse}
        title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        aria-label={collapsed ? 'Expand lesson chapters sidebar' : 'Collapse lesson chapters sidebar'}
        className="rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        {collapsed ? <PanelLeftOpen className="size-4" /> : <PanelLeftClose className="size-4" />}
      </Button>
    </div>
    {!collapsed && (
      <>
        <Separator className="mt-4 bg-slate-200 dark:bg-slate-800" />
        <p className="mt-3 text-[11px] text-slate-500 dark:text-slate-400">
          {activeIndex >= 0 ? `Editing chapter ${activeIndex + 1} of ${chapters.length}` : 'Select or create a chapter to begin.'}
        </p>
      </>
    )}
  </div>
);

const QuickActions = () => (
  <Motion.div variants={itemVariants} className="mt-3 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900/70">
    <div className="mb-2 px-1 text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">Quick actions</div>
    <div className="grid grid-cols-5 gap-1">
      {[
        { icon: ListTree, label: 'Expand All' },
        { icon: GripVertical, label: 'Reorder Mode' },
        { icon: Copy, label: 'Duplicate Lesson' },
        { icon: FileDown, label: 'Export Structure' },
        { icon: Wand2, label: 'Outline Tools' },
      ].map((item) => {
        const Icon = item.icon;
        return (
          <button
            key={item.label}
            type="button"
            title={item.label}
            className="flex h-9 items-center justify-center rounded-xl text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-slate-100"
          >
            <Icon className="size-4" />
          </button>
        );
      })}
    </div>
  </Motion.div>
);

const AiAssistLayer = () => (
  <Motion.div variants={itemVariants} className="mt-3 rounded-2xl border border-cyan-100 bg-cyan-50/80 p-3 dark:border-cyan-900/50 dark:bg-cyan-950/20">
    <div className="flex items-start gap-2">
      <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-white text-cyan-700 shadow-sm dark:bg-slate-950 dark:text-cyan-300">
        <Bot className="size-4" />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-semibold text-cyan-950 dark:text-cyan-100">AI assist</p>
        <p className="mt-1 text-[11px] leading-4 text-cyan-800 dark:text-cyan-300">Suggest next chapter, detect missing topics, or improve titles.</p>
      </div>
    </div>
  </Motion.div>
);

const EmptyState = ({ onAdd }) => (
  <Motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="rounded-3xl border border-dashed border-blue-200 bg-linear-to-br from-blue-50 to-violet-50 p-5 text-center dark:border-blue-900/60 dark:from-blue-950/20 dark:to-violet-950/20"
  >
    <div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-2xl bg-white text-blue-600 shadow-sm dark:bg-slate-950 dark:text-blue-300">
      <Lightbulb className="size-6" />
    </div>
    <p className="text-sm font-semibold text-slate-800 dark:text-slate-100">Start building your lesson structure.</p>
    <p className="mt-1 text-xs leading-5 text-slate-500 dark:text-slate-400">Create your first chapter to begin organizing objectives, activities, and assessments.</p>
    <Button onClick={onAdd} size="sm" className="mt-4 rounded-xl bg-slate-950 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950">
      <Plus className="mr-1.5 size-4" /> Create first chapter
    </Button>
  </Motion.div>
);

const CollapsedRail = ({ chapters, activeChapterId, onSelect, onToggleCollapse }) => (
  <Motion.div
    key="collapsed-rail"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="flex min-h-0 flex-1 flex-col items-center gap-2 pt-1"
  >
    <button
      type="button"
      onClick={onToggleCollapse}
      className="mb-2 flex size-11 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-sm transition hover:scale-105 dark:bg-white dark:text-slate-950"
      aria-label="Expand lesson chapters sidebar"
      title="Expand sidebar"
    >
      <ChevronRight className="size-5" />
    </button>
    <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-1">
      {chapters.slice(0, 12).map((chapter, index) => {
        const active = chapter.id === activeChapterId;
        return (
          <button
            key={chapter.id}
            type="button"
            onClick={() => onSelect(chapter.id)}
            title={chapter.title}
            className={`flex size-10 items-center justify-center rounded-2xl text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-300 ${
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

const FloatingCreateButton = ({ collapsed, onAdd }) => (
  <Motion.div
    className="absolute bottom-4 left-1/2 z-10 -translate-x-1/2"
    animate={{ y: [0, -2, 0] }}
    transition={{ duration: 3.2, repeat: Infinity, ease: 'easeInOut' }}
  >
    <Button
      size={collapsed ? 'icon-lg' : 'sm'}
      onClick={onAdd}
      title="Add chapter"
      aria-label="Add chapter"
      className={`rounded-full bg-linear-to-r from-blue-600 to-violet-600 text-white shadow-xl shadow-blue-500/25 hover:from-blue-700 hover:to-violet-700 ${collapsed ? '' : 'px-4'}`}
    >
      <Plus className="size-5" />
      {!collapsed && <span className="ml-2 text-xs font-semibold">Add Chapter</span>}
    </Button>
  </Motion.div>
);

export default Sidebar;
