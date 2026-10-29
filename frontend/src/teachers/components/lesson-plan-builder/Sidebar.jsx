/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  CheckCircle2,
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
  onDelete,
  onRename,
  addDisabled = false,
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
      className={`relative h-80 min-h-0 shrink-0 overflow-hidden rounded-2xl border border-slate-200/80 bg-slate-50 shadow-sm transition-[width] sm:h-96 sm:rounded-2xl lg:h-full ${collapsed ? 'w-[58px]' : 'w-full lg:w-72'} dark:border-slate-700 dark:bg-slate-950/90 dark:shadow-black/20`}
      aria-label="Lesson chapters sidebar"
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-linear-to-b from-[#eef2ff] to-transparent dark:from-blue-950/20" />

      <div className="relative flex h-full min-h-0 flex-col">
        {/* Header */}
        <div className="shrink-0 border-b border-slate-200/70 bg-white/95 px-3 py-3 backdrop-blur-md dark:border-slate-700 dark:bg-slate-900/95">
          <div className={`flex items-start ${collapsed ? 'justify-center' : 'justify-between'} gap-2`}>
            {!collapsed && (
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
              <div className="flex items-center gap-1">
                {!collapsed && (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    onClick={onAdd}
                    disabled={addDisabled}
                    title="Create chapter"
                    aria-label="Create chapter"
                    className="size-7 rounded-lg bg-indigo-50 text-indigo-600 hover:bg-indigo-100 disabled:opacity-50"
                  >
                    <Plus className="size-4" />
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="icon-sm"
                  onClick={onToggleCollapse}
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
              {/* Search */}
              <Motion.div variants={itemVariants} className="mb-2 px-0.5">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 size-3.5 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={query}
                    onChange={(event) => onQueryChange(event.target.value)}
                    placeholder="Search chapters..."
                    className="h-8 rounded-lg border-slate-200/80 bg-slate-100/90 pl-8 text-xs focus-visible:bg-white focus-visible:ring-1 focus-visible:ring-indigo-500 dark:bg-slate-800"
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
              <Motion.div variants={itemVariants} className="mb-1 px-1">
                <p className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  Select a chapter to continue
                </p>
              </Motion.div>

              {/* Chapter list */}
              <div className="min-h-0 flex-1 touch-pan-y space-y-2 overflow-y-auto overscroll-contain px-3 pb-16 [scrollbar-gutter:stable] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-slate-300 hover:[&::-webkit-scrollbar-thumb]:bg-slate-400 dark:[&::-webkit-scrollbar-thumb]:bg-slate-600 [&::-webkit-scrollbar-track]:bg-transparent">
                <AnimatePresence initial={false}>
                  {chapters.map((chapter, index) => (
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
            disabled={addDisabled}
            title="Add chapter"
            aria-label="Add chapter"
            className={`rounded-full bg-blue-600 text-white shadow-lg shadow-blue-500/25 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed ${collapsed ? '' : 'px-3.5 py-2'}`}
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
