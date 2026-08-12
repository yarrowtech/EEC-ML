import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { Minus, Network, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

export function parseMindMap(text) {
  const lines = (text || '').split('\n');
  let root = 'Topic';
  const branches = [];
  let currentBranch = null;
  let rootSet = false;

  const stripMarkdown = (s) =>
    s.replace(/^#{1,6}\s*/, '')
     .replace(/^[-*+•]\s*/, '')
     .replace(/\*{1,2}([^*]+)\*{1,2}/g, '$1')
     .trim();

  for (const line of lines) {
    if (!line.trim()) continue;

    const indent = (line.match(/^(\s*)/)?.[1] ?? '').length;
    const trimmed = line.trim();
    const clean = stripMarkdown(trimmed);
    if (!clean) continue;

    if (/^mind\s*map/i.test(clean)) {
      const m = clean.match(/mind\s*map\s*[—–\-:]\s*(.+)/i);
      root = m ? m[1].trim() : clean;
      rootSet = true;
      continue;
    }

    if (indent === 0) {
      if (!rootSet && !branches.length) {
        if (!/^topic$/i.test(clean)) { root = clean; rootSet = true; }
        continue;
      }
      if (/^topic$/i.test(clean) || clean === root) continue;
      currentBranch = { title: clean, items: [] };
      branches.push(currentBranch);
    } else {
      if (!currentBranch) {
        currentBranch = { title: root, items: [] };
        branches.push(currentBranch);
      }
      if (indent >= 6 && currentBranch.items.length) {
        const last = currentBranch.items[currentBranch.items.length - 1];
        if (typeof last === 'object') last.sub = [...(last.sub || []), clean];
        else currentBranch.items[currentBranch.items.length - 1] = { label: last, sub: [clean] };
      } else {
        currentBranch.items.push(clean);
      }
    }
  }

  return { root, branches: branches.length ? branches : [{ title: 'Overview', items: [] }] };
}

const BRANCH_PALETTE = [
  { bg: 'bg-sky-50',     border: 'border-sky-200',     titleBg: 'bg-sky-500',     hex: '#0ea5e9' },
  { bg: 'bg-violet-50',  border: 'border-violet-200',  titleBg: 'bg-violet-500',  hex: '#8b5cf6' },
  { bg: 'bg-rose-50',    border: 'border-rose-200',    titleBg: 'bg-rose-500',    hex: '#f43f5e' },
  { bg: 'bg-emerald-50', border: 'border-emerald-200', titleBg: 'bg-emerald-500', hex: '#10b981' },
  { bg: 'bg-amber-50',   border: 'border-amber-200',   titleBg: 'bg-amber-500',   hex: '#f59e0b' },
  { bg: 'bg-fuchsia-50', border: 'border-fuchsia-200', titleBg: 'bg-fuchsia-500', hex: '#d946ef' },
  { bg: 'bg-teal-50',    border: 'border-teal-200',    titleBg: 'bg-teal-500',    hex: '#14b8a6' },
  { bg: 'bg-orange-50',  border: 'border-orange-200',  titleBg: 'bg-orange-500',  hex: '#f97316' },
];

function NodeToggle({ open, hex, onToggle }) {
  return (
    <button
      type="button"
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="absolute -right-2.5 top-1/2 z-20 flex size-5 -translate-y-1/2 items-center justify-center rounded-full border bg-white shadow-sm transition-transform hover:scale-110"
      style={{ borderColor: hex, color: hex }}
    >
      {open ? <Minus className="size-3" strokeWidth={3} /> : <Plus className="size-3" strokeWidth={3} />}
    </button>
  );
}

export function MindMapUI({ text }) {
  const { root, branches } = useMemo(() => parseMindMap(text), [text]);
  const scrollRef = useRef(null);
  const containerRef = useRef(null);
  const nodeRefs = useRef({});
  const [expanded, setExpanded] = useState(() => new Set());
  const [svgPaths, setSvgPaths] = useState([]);

  const pan = useRef({ active: false, startX: 0, startY: 0, left: 0, top: 0, moved: false });

  const toggle = useCallback((id) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const setExpandAll = useCallback((open) => {
    if (!open) { setExpanded(new Set()); return; }
    const all = new Set(['root']);
    branches.forEach((_, i) => all.add(`b${i}`));
    setExpanded(all);
  }, [branches]);

  const rootOpen = expanded.has('root');

  const visibleEdges = useMemo(() => {
    const edges = [];
    if (!rootOpen) return edges;
    branches.forEach((branch, i) => {
      const color = BRANCH_PALETTE[i % BRANCH_PALETTE.length].hex;
      edges.push({ parent: 'root', child: `b${i}`, color, key: `root-b${i}` });
      if (expanded.has(`b${i}`)) {
        (branch.items || []).forEach((_, j) => {
          edges.push({ parent: `b${i}`, child: `b${i}-i${j}`, color, key: `b${i}-i${j}` });
        });
      }
    });
    return edges;
  }, [branches, expanded, rootOpen]);

  const recalc = useCallback(() => {
    const container = containerRef.current;
    if (!container) return;
    const cRect = container.getBoundingClientRect();
    if (cRect.width === 0) return;

    const paths = visibleEdges
      .map((edge) => {
        const pEl = nodeRefs.current[edge.parent];
        const cEl = nodeRefs.current[edge.child];
        if (!pEl || !cEl) return null;
        const p = pEl.getBoundingClientRect();
        const c = cEl.getBoundingClientRect();
        const px = p.right - cRect.left;
        const py = p.top   - cRect.top + p.height / 2;
        const cx = c.left  - cRect.left;
        const cy = c.top   - cRect.top + c.height / 2;
        const mid = px + (cx - px) * 0.5;
        return {
          d: `M ${px} ${py} C ${mid} ${py}, ${mid} ${cy}, ${cx} ${cy}`,
          color: edge.color,
          key: edge.key,
        };
      })
      .filter(Boolean);

    setSvgPaths(paths);
  }, [visibleEdges]);

  useEffect(() => {
    const timers = [0, 120, 260, 440, 650].map((t) => setTimeout(recalc, t));
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    window.addEventListener('resize', recalc);
    return () => {
      timers.forEach(clearTimeout);
      ro.disconnect();
      window.removeEventListener('resize', recalc);
    };
  }, [recalc, expanded]);

  const onPointerDown = (e) => {
    const el = scrollRef.current;
    if (!el) return;
    pan.current = {
      active: true, moved: false,
      startX: e.clientX, startY: e.clientY,
      left: el.scrollLeft, top: el.scrollTop,
    };
  };
  const onPointerMove = (e) => {
    const el = scrollRef.current;
    if (!el || !pan.current.active) return;
    const dx = e.clientX - pan.current.startX;
    const dy = e.clientY - pan.current.startY;
    if (Math.abs(dx) > 4 || Math.abs(dy) > 4) pan.current.moved = true;
    el.scrollLeft = pan.current.left - dx;
    el.scrollTop = pan.current.top - dy;
  };
  const endPan = () => { pan.current.active = false; };
  const guardedToggle = (id) => {
    if (pan.current.moved) { pan.current.moved = false; return; }
    toggle(id);
  };

  return (
    <div className="relative w-full">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">Click a node or ± to expand · drag to pan</span>
        <div className="flex gap-1.5">
          <button
            onClick={() => setExpandAll(true)}
            className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Expand all
          </button>
          <button
            onClick={() => setExpandAll(false)}
            className="rounded-lg bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-200 transition-colors"
          >
            Collapse
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={endPan}
        onPointerLeave={endPan}
        className="relative max-h-[460px] overflow-auto rounded-xl border border-slate-100 bg-slate-50/40 cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
      >
        <div ref={containerRef} className="relative inline-block min-w-full p-6">
          <svg
            className="pointer-events-none absolute inset-0"
            style={{ width: '100%', height: '100%', overflow: 'visible', zIndex: 0 }}
          >
            <AnimatePresence>
              {svgPaths.map((p) => (
                <Motion.path
                  key={p.key}
                  d={p.d}
                  stroke={p.color}
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 0.55 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.5, ease: 'easeOut' }}
                />
              ))}
            </AnimatePresence>
          </svg>

          <div className="relative z-10 flex items-center gap-14">
            <Motion.div
              ref={(el) => { nodeRefs.current.root = el; }}
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3 }}
              className="relative shrink-0"
            >
              <button
                type="button"
                onClick={() => guardedToggle('root')}
                className="flex items-center gap-2 rounded-2xl bg-slate-800 px-4 py-2.5 shadow-lg hover:bg-slate-700 transition-colors"
              >
                <Network className="size-4 text-white/70" />
                <span className="text-sm font-bold tracking-wide text-white">{root}</span>
              </button>
              {branches.length > 0 && (
                <NodeToggle open={rootOpen} hex="#334155" onToggle={() => toggle('root')} />
              )}
            </Motion.div>

            <AnimatePresence>
              {rootOpen && (
                <Motion.div
                  key="branches"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="flex shrink-0 flex-col justify-center gap-4"
                >
                  {branches.map((branch, i) => {
                    const pal = BRANCH_PALETTE[i % BRANCH_PALETTE.length];
                    const items = branch.items || [];
                    const bId = `b${i}`;
                    const open = expanded.has(bId);
                    return (
                      <div key={i} className="flex items-center gap-14">
                        <Motion.div
                          ref={(el) => { nodeRefs.current[bId] = el; }}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ duration: 0.3, delay: 0.05 + i * 0.04 }}
                          className="relative shrink-0"
                        >
                          <button
                            type="button"
                            onClick={() => items.length && guardedToggle(bId)}
                            className={cn(
                              'flex max-w-[200px] items-center gap-1.5 rounded-xl border px-3 py-2 shadow-sm transition-colors',
                              pal.bg, pal.border, items.length ? 'cursor-pointer hover:brightness-95' : 'cursor-default'
                            )}
                            style={{ borderLeftWidth: 3, borderLeftColor: pal.hex }}
                          >
                            <span className="text-[11px] font-bold uppercase tracking-wide leading-tight text-slate-700 text-left">
                              {branch.title}
                            </span>
                          </button>
                          {items.length > 0 && (
                            <NodeToggle open={open} hex={pal.hex} onToggle={() => toggle(bId)} />
                          )}
                        </Motion.div>

                        <AnimatePresence>
                          {open && items.length > 0 && (
                            <Motion.div
                              key="items"
                              initial={{ opacity: 0 }}
                              animate={{ opacity: 1 }}
                              exit={{ opacity: 0 }}
                              className="flex shrink-0 flex-col justify-center gap-1.5"
                            >
                              {items.map((item, j) => {
                                const label = typeof item === 'object' ? item.label : item;
                                const sub   = typeof item === 'object' ? (item.sub || []) : [];
                                return (
                                  <Motion.div
                                    key={j}
                                    ref={(el) => { nodeRefs.current[`${bId}-i${j}`] = el; }}
                                    initial={{ opacity: 0, x: -8, scale: 0.95 }}
                                    animate={{ opacity: 1, x: 0, scale: 1 }}
                                    transition={{ duration: 0.22, delay: j * 0.03 }}
                                    className="max-w-[240px] shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-sm"
                                  >
                                    <span className="text-[11px] leading-relaxed text-slate-700">{label}</span>
                                    {sub.map((s, k) => (
                                      <div key={k} className="mt-0.5 flex items-start gap-1">
                                        <span className="mt-1.5 size-1 shrink-0 rounded-full bg-slate-300" />
                                        <span className="text-[10px] leading-relaxed text-slate-500">{s}</span>
                                      </div>
                                    ))}
                                  </Motion.div>
                                );
                              })}
                            </Motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    );
                  })}
                </Motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

export default MindMapUI;
