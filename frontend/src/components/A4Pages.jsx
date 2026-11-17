import React, { useLayoutEffect, useRef, useState } from 'react';

/**
 * Lays content out on real A4 sheets (210 × 297 mm proportions): blocks fill a
 * page and whatever does not fit continues on the next page, like a printed
 * document. Works at any width — the page keeps the A4 ratio and margins are
 * percentages, so the split is re-measured on resize / font-size change.
 *
 * Props
 *  - blocks:       [{ id, kind: 'heading' | 'text', text, tone? }]
 *  - renderBlock:  (block) => node    (must render the same in measure + view)
 *  - renderHeader: (pageIndex) => node  (repeated at the top of every page)
 *  - deps:         extra values that change block size (e.g. font scale)
 */
const PAGE_CLASS = 'relative mx-auto flex aspect-[210/297] w-full flex-col overflow-hidden bg-white px-[7.6%] pb-[5%] pt-[7%]';

const A4Pages = ({ blocks, renderBlock, renderHeader, deps = [] }) => {
  const measureRef = useRef(null);
  const [pages, setPages] = useState(() => [{ ids: blocks.map((_, i) => i), tall: false }]);

  useLayoutEffect(() => {
    const root = measureRef.current;
    if (!root) return undefined;

    const compute = () => {
      const avail = root.querySelector('[data-a4-avail]')?.clientHeight || 0;
      const nodes = Array.from(root.querySelectorAll('[data-a4-block]'));
      if (!avail || !nodes.length) { setPages([{ ids: blocks.map((_, i) => i), tall: false }]); return; }

      const out = [];
      const tall = new Set();
      let current = [];
      let used = 0;
      nodes.forEach((node, i) => {
        const h = node.offsetHeight;
        if (current.length && used + h > avail) {
          // never leave a heading stranded at the bottom of a page
          const last = current[current.length - 1];
          if (blocks[last]?.kind === 'heading' && current.length > 1) {
            current.pop();
            out.push(current);
            current = [last];
            used = nodes[last].offsetHeight;
          } else {
            out.push(current);
            current = [];
            used = 0;
          }
        }
        current.push(i);
        used += h;
        if (h > avail) tall.add(out.length); // a single block bigger than a page
      });
      if (current.length) out.push(current);

      const next = out.map((ids, p) => ({ ids, tall: tall.has(p) }));
      setPages((prev) => (JSON.stringify(prev) === JSON.stringify(next) ? prev : next));
    };

    compute();
    // Images change the height once they load — split again then.
    const onLoad = () => compute();
    root.addEventListener('load', onLoad, true);
    if (typeof ResizeObserver === 'undefined') return () => root.removeEventListener('load', onLoad, true);
    const ro = new ResizeObserver(() => compute());
    ro.observe(root);
    return () => { ro.disconnect(); root.removeEventListener('load', onLoad, true); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocks, ...deps]);

  const total = pages.length;

  return (
    <div className="relative mx-auto w-full max-w-[210mm]">
      {/* Invisible copy used only to measure how much fits on a page */}
      <div ref={measureRef} aria-hidden="true" className="pointer-events-none invisible absolute inset-x-0 top-0 -z-10">
        <div className={PAGE_CLASS}>
          {renderHeader(0)}
          <div data-a4-avail className="relative min-h-0 flex-1">
            <div className="absolute inset-x-0 top-0">
              {blocks.map((block) => (
                <div key={block.id} data-a4-block>{renderBlock(block)}</div>
              ))}
            </div>
          </div>
          <div className="pt-2 text-center text-[11px]">&nbsp;</div>
        </div>
      </div>

      {/* The visible pages */}
      <div className="space-y-6">
        {pages.map(({ ids, tall }, pageIndex) => (
          <section
            key={pageIndex}
            aria-label={`Page ${pageIndex + 1} of ${total}`}
            className={`${tall ? PAGE_CLASS.replace('aspect-[210/297]', 'min-h-[297mm]').replace('overflow-hidden', '') : PAGE_CLASS} rounded-sm shadow-[0_10px_40px_-12px_rgba(15,23,42,0.25)] ring-1 ring-slate-200`}
          >
            {renderHeader(pageIndex)}
            <div className="min-h-0 flex-1">
              {ids.map((i) => blocks[i] && <div key={blocks[i].id}>{renderBlock(blocks[i])}</div>)}
            </div>
            <div className="pt-2 text-center text-[11px] font-medium text-slate-400">
              Page {pageIndex + 1} of {total}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
};

export default A4Pages;
