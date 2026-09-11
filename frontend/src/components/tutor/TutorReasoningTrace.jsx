import React, { useState } from 'react';
import { Info, ChevronDown, ChevronUp } from 'lucide-react';

// Explainable AI: surfaces the lineage block the backend already computes
// (model, retrieval query, chunk/citation counts) plus the non-visual source
// chunks a text answer was grounded in — the "why did the AI answer this way"
// trace that previously reached the frontend but was never rendered.
const TutorReasoningTrace = ({ lineage, citations }) => {
  const [open, setOpen] = useState(false);
  const textSources = (citations || []).filter((c) => !c?.visual_pages?.length);
  if (!lineage && !textSources.length) return null;

  return (
    <div className="mt-1">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium text-[#a3aaa2] transition-colors hover:bg-[#FEF3C7] hover:text-[#B45309]"
        aria-expanded={open}
      >
        <Info className="size-3" />
        Why this answer?
        {open ? <ChevronUp className="size-3" /> : <ChevronDown className="size-3" />}
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-xl border border-[#E7E3D9] bg-[#FBF9F4] p-3 text-xs text-[#5b6660]">
          {lineage && (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
              {lineage.model && <span><strong className="text-[#26332E]">Model:</strong> {lineage.model}</span>}
              {lineage.mode && <span><strong className="text-[#26332E]">Mode:</strong> {lineage.mode}</span>}
              {lineage.promptSource && <span><strong className="text-[#26332E]">Prompt source:</strong> {lineage.promptSource}</span>}
              {lineage.retrievalChunkCount != null && (
                <span><strong className="text-[#26332E]">Chunks retrieved:</strong> {lineage.retrievalChunkCount}</span>
              )}
              {lineage.citationCount != null && (
                <span><strong className="text-[#26332E]">Sources cited:</strong> {lineage.citationCount}</span>
              )}
              {lineage.rewrittenQuery && (
                <span className="col-span-2"><strong className="text-[#26332E]">Search query used:</strong> &ldquo;{lineage.rewrittenQuery}&rdquo;</span>
              )}
            </div>
          )}
          {textSources.length > 0 && (
            <div>
              <p className="mb-1 font-semibold text-[#26332E]">Source material used:</p>
              <ul className="space-y-1">
                {textSources.map((c, i) => (
                  <li key={c.material_id || i} className="flex items-start gap-1.5">
                    <span className="mt-1 size-1 shrink-0 rounded-full bg-[#F59E0B]" />
                    <span>{c.source_name || 'Untitled material'}{c.chapter_title ? ` — ${c.chapter_title}` : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default TutorReasoningTrace;
