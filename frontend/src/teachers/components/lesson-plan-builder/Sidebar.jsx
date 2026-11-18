/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
  ChevronRight,
  Layers,
  Lightbulb,
  PanelLeftClose,
  PanelLeftOpen,
  Plus,
  RefreshCw,
  Search,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Separator } from '@/components/ui/separator';
import ChapterItem from './ChapterItem';
import { groupLessonsByUnit } from './chapterGroups';

const sidebarVariants = {
  expanded: { opacity: 1 },
  collapsed: { opacity: 1 },
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
  onAddLesson,
  onRefresh,
  onDelete,
  onRename,
  addDisabled = false,
  collapsed,
  onToggleCollapse,
  onDragStart,
  onDrop,
}) => {
  const hasSearch = query.trim().length > 0;
  // Search lives behind an icon in the header; opening it turns the header
  // into a full-width search field (like the portal header search).
  const [searchOpen, setSearchOpen] = useState(false);
  const closeSearch = () => { setSearchOpen(false); onQueryChange(''); };

  // Reload the lessons (mine + colleagues'); the icon spins while it works.
  const [refreshing, setRefreshing] = useState(false);
  const handleRefresh = async () => {
    if (refreshing || !onRefresh) return;
    setRefreshing(true);
    const started = Date.now();
    try { await onRefresh(); } finally {
      // keep the spin visible for a moment even if the reload is instant
      const wait = Math.max(0, 700 - (Date.now() - started));
      setTimeout(() => setRefreshing(false), wait);
    }
  };

  return (
    <Motion.aside
      initial={false}
      animate={collapsed ? 'collapsed' : 'expanded'}
      variants={sidebarVariants}
      transition={{ type: 'spring', stiffness: 260, damping: 30 }}
      className={`relative h-80 min-h-0 shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-sm transition-[width] sm:h-96 sm:rounded-2xl lg:h-full ${collapsed ? 'w-[58px]' : 'w-full lg:w-72'} dark:border-slate-700 dark:bg-slate-950/90 dark:shadow-black/20`}
      aria-label="Lesson chapters sidebar"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20" />

      <div className="relative flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200/70 bg-white/95 px-3 py-3 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95">
          <div className={`flex items-center ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}>
            {!collapsed && searchOpen && (
              <div className="animate-header-search relative min-w-0 flex-1">
                <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                <Input
                  autoFocus
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  onKeyDown={(event) => { if (event.key === 'Escape') closeSearch(); }}
                  placeholder="Search lessons…"
                  className="h-8 rounded-full border-slate-200 bg-slate-100/90 pl-8 text-xs outline-none focus:outline-none focus-visible:border-indigo-400 focus-visible:bg-white focus-visible:ring-2 focus-visible:ring-indigo-500/20 focus-visible:outline-none dark:bg-slate-800"
                  style={{ color: '#0f172a', caretColor: '#0f172a' }}
                  aria-label="Search chapters and lessons"
                />
              </div>
            )}
            {!collapsed && !searchOpen && (
              <div className="min-w-0 flex items-center gap-1.5">
                <div className="flex size-8 shrink-0 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-600 via-indigo-600 to-violet-600 text-white shadow-sm shadow-indigo-500/25">
                  <Layers className="size-3.5" />
                </div>
                <div className="min-w-0">
                  <h2 className="truncate text-sm font-bold tracking-tight text-slate-900 dark:text-slate-50">Your Chapters</h2>
                  <p className="mt-0.5 flex items-center gap-1.5 text-[10px] font-medium leading-tight text-slate-500 dark:text-slate-400">
                    <span>{chapters.length} chapter{chapters.length === 1 ? '' : 's'}</span><span className="size-1 rounded-full bg-slate-300" /><span className="font-semibold text-emerald-600">{chapters.filter((chapter) => chapter.status === 'published' && chapter.isDraft === false).length} published</span>
                  </p>
                </div>
              </div>
            )}
              <div className="flex shrink-0 items-center gap-1">
                {!collapsed && !searchOpen && onRefresh && (
                  <button
                    type="button"
                    onClick={handleRefresh}
                    disabled={refreshing}
                    aria-label="Refresh lessons"
                    title={refreshing ? 'Refreshing…' : 'Refresh'}
                    className={`flex size-7 items-center justify-center rounded-lg transition-colors ${refreshing ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                  >
                    <Motion.span
                      className="flex"
                      animate={refreshing ? { rotate: 360 } : { rotate: 0 }}
                      transition={refreshing ? { repeat: Infinity, duration: 0.7, ease: 'linear' } : { duration: 0.3 }}
                      whileTap={{ scale: 0.8 }}
                    >
                      <RefreshCw className="size-3.5" />
                    </Motion.span>
                  </button>
                )}
                {!collapsed && (
                  <button
                    type="button"
                    onClick={() => (searchOpen ? closeSearch() : setSearchOpen(true))}
                    aria-label={searchOpen ? 'Close search' : 'Search lessons'}
                    aria-expanded={searchOpen}
                    title={searchOpen ? 'Close search' : 'Search'}
                    className={`relative flex size-7 items-center justify-center overflow-hidden rounded-lg transition-colors ${searchOpen ? 'bg-slate-200 text-slate-700' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                  >
                    {/* the icon spins from 🔍 into ✕ and back */}
                    <AnimatePresence mode="wait" initial={false}>
                      <Motion.span
                        key={searchOpen ? 'close' : 'search'}
                        initial={{ rotate: -180, scale: 0.4, opacity: 0 }}
                        animate={{ rotate: 0, scale: 1, opacity: 1 }}
                        exit={{ rotate: 180, scale: 0.4, opacity: 0 }}
                        transition={{ duration: 0.22, ease: 'easeInOut' }}
                        className="flex"
                      >
                        {searchOpen ? <X className="size-3.5" /> : <Search className="size-3.5" />}
                      </Motion.span>
                    </AnimatePresence>
                  </button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={() => { if (searchOpen) closeSearch(); onToggleCollapse(); }}
                  title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
                  className="size-7 rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-slate-800"
                >
                  {collapsed ? <PanelLeftOpen className="size-3.5" /> : <PanelLeftClose className="size-3.5" />}
                </Button>
              </div>
          </div>
          {!collapsed && <Separator className="mt-3 bg-slate-200 dark:bg-slate-800" />}
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
              {/* Hint */}
              {/* <Motion.div variants={itemVariants} className="mb-1 px-4 pt-2">
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  {hasSearch ? `${chapters.length} result${chapters.length === 1 ? '' : 's'} for “${query.trim()}”` : 'Select a lesson to continue'}
                </p>
              </Motion.div> */}

              {/* Chapter list */}
              <div className="min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto overscroll-contain px-3 pb-16 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-transparent">
                {groupLessonsByUnit(chapters).map((group) => (
                <div key={group.key} className="space-y-2">
                  <div className="sticky top-0 z-10 -mx-1 flex items-center gap-2 bg-slate-50/95 px-1 pb-1 pt-2 backdrop-blur dark:bg-slate-950/90">
                    <span className={`truncate text-[11px] font-bold uppercase tracking-wide ${group.key === '__none__' ? 'text-slate-400' : 'text-indigo-700'}`}>{group.label}</span>
                    <span className="h-px flex-1 bg-slate-200" />
                    <span className="shrink-0 rounded-full bg-white px-1.5 text-[10px] font-semibold text-slate-500 ring-1 ring-slate-200">{group.lessons.length}</span>
                  </div>
                <AnimatePresence initial={false}>
                  {group.lessons.map((chapter, index) => (
                    <Motion.div
                      key={chapter.id}
                      variants={itemVariants}
                      layout
                      initial="hidden"
                      animate="visible"
                      exit={{ opacity: 0, x: -10 }}
                    >
                      <ChapterItem
                        chapter={chapter}
                        index={index}
                        total={group.lessons.length}
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
                  {group.key !== '__none__' && onAddLesson && (
                    <button
                      type="button"
                      onClick={() => onAddLesson({ unitNumber: group.unitNumber || '', unitTitle: group.unitTitle })}
                      disabled={addDisabled}
                      className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-dashed border-indigo-200 bg-white/70 py-1.5 text-[11px] font-semibold text-indigo-600 transition hover:border-indigo-400 hover:bg-indigo-50 disabled:opacity-50"
                    >
                      <Plus className="size-3.5" /> Add lesson to {group.unitNumber ? `Chapter ${group.unitNumber}` : 'this chapter'}
                    </button>
                  )}
                </div>
                ))}

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
            disabled={addDisabled}
            title="New chapter"
            aria-label="New chapter"
            className={`rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${collapsed ? '' : 'px-3.5 py-2'}`}
          >
            <Plus className="size-4" />
            {!collapsed && <span className="ml-1.5 text-[11px] font-semibold">New Chapter</span>}
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
    <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400">Press “+ New Chapter” below, then add lessons inside it.</p>
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
    <div className="min-h-0 flex-1 touch-pan-y space-y-1.5 overflow-y-scroll overscroll-contain pb-12 px-1 [scrollbar-gutter:stable]">
      {chapters.map((chapter, index) => {
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
