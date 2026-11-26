import React, { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ExternalLink, Library, Link2, Search, X } from 'lucide-react';
import {
  BOARDS, SIMULATION_CATALOG, SIM_PROVIDERS, catalogClasses, catalogSubjects, toEmbeddableSimUrl,
} from '@/utils/simulationCatalog';

const selectCls = 'rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-sm text-slate-800 focus:border-emerald-400 focus:outline-none';

// Pick a ready-made 3rd-party simulation (board → class → subject → chapter) and import it
// into the chapter's Virtual Lab experiments with one click.
const SimulationLibraryModal = ({ open, onClose, onImport, defaultClass = '', defaultSubject = '', importedUrls = [] }) => {
  const classes = catalogClasses();
  const [board, setBoard] = useState('CBSE');
  const [className, setClassName] = useState('');
  const [subject, setSubject] = useState('');
  const [query, setQuery] = useState('');
  const [pasted, setPasted] = useState('');
  const [pastedTitle, setPastedTitle] = useState('');

  // Start on the chapter's own class/subject when they are in the catalogue.
  useEffect(() => {
    if (!open) return;
    const cls = String(defaultClass || '').match(/\d+/)?.[0] || '';
    setClassName(classes.includes(cls) ? cls : '');
    setSubject('');
    setQuery('');
  }, [open, defaultClass]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open || !defaultSubject) return;
    const match = catalogSubjects(className).find((s) => s.toLowerCase() === String(defaultSubject).toLowerCase());
    if (match) setSubject(match);
  }, [open, className, defaultSubject]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    return SIMULATION_CATALOG.filter((s) => s.boards.includes(board)
      && (!className || s.className === className)
      && (!subject || s.subject === subject)
      && (!q || `${s.title} ${s.chapter} ${s.objective}`.toLowerCase().includes(q)));
  }, [board, className, subject, query]);

  const pastedUrl = toEmbeddableSimUrl(pasted);
  const imported = new Set(importedUrls);

  if (!open) return null;
  return createPortal(
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm" role="presentation" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label="Simulation library" className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-5 py-4">
          <div className="flex items-center gap-3">
            <span className="flex size-10 items-center justify-center rounded-full bg-emerald-600 text-white"><Library size={18} /></span>
            <div>
              <h3 className="text-base font-bold text-slate-900">Import a simulation</h3>
              <p className="text-xs text-slate-500">Ready-made interactive simulations from {SIM_PROVIDERS.phet.name}, sorted by board, class and chapter.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"><X size={16} /></button>
        </div>

        {/* filters */}
        <div className="flex flex-wrap items-center gap-2 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <select aria-label="Board" value={board} onChange={(e) => setBoard(e.target.value)} className={selectCls}>{BOARDS.map((b) => <option key={b}>{b}</option>)}</select>
          <select aria-label="Class" value={className} onChange={(e) => { setClassName(e.target.value); setSubject(''); }} className={selectCls}>
            <option value="">All classes</option>
            {classes.map((c) => <option key={c} value={c}>Class {c}</option>)}
          </select>
          <select aria-label="Subject" value={subject} onChange={(e) => setSubject(e.target.value)} className={selectCls}>
            <option value="">All subjects</option>
            {catalogSubjects(className).map((s) => <option key={s}>{s}</option>)}
          </select>
          <label className="relative min-w-[180px] flex-1">
            <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chapter or simulation" aria-label="Search simulations" className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-8 pr-3 text-sm focus:border-emerald-400 focus:outline-none" />
          </label>
        </div>

        {/* results */}
        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {results.length === 0 ? (
            <p className="py-10 text-center text-sm text-slate-500">No simulations for these filters. Try “All subjects” or another class, or paste a link below.</p>
          ) : (
            <ul className="grid gap-3 sm:grid-cols-2">
              {results.map((s) => {
                const done = imported.has(s.url);
                return (
                  <li key={s.id} className="flex flex-col rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-slate-900">{s.title}</p>
                        <p className="text-xs text-slate-500">Class {s.className} · {s.subject} · {s.chapter}</p>
                      </div>
                      <span className="shrink-0 rounded-full bg-sky-50 px-2 py-0.5 text-[10.5px] font-semibold text-sky-700">{SIM_PROVIDERS[s.provider]?.name}</span>
                    </div>
                    <p className="mt-1.5 flex-1 text-xs text-slate-600">{s.objective}</p>
                    <div className="mt-2.5 flex items-center justify-end gap-2">
                      <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50"><ExternalLink size={12} /> Preview</a>
                      <button type="button" disabled={done} onClick={() => onImport(s)} aria-label={`Import ${s.title}`} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 disabled:bg-emerald-100 disabled:text-emerald-700">
                        {done ? <><Check size={12} /> Imported</> : 'Import'}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* paste a link */}
        <div className="border-t border-slate-100 bg-slate-50 px-5 py-3">
          <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold text-slate-600"><Link2 size={13} /> Or paste a PhET simulation link</p>
          <div className="flex flex-wrap gap-2">
            <input value={pasted} onChange={(e) => setPasted(e.target.value)} placeholder="https://phet.colorado.edu/en/simulations/…" aria-label="Simulation link" className="min-w-[220px] flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            <input value={pastedTitle} onChange={(e) => setPastedTitle(e.target.value)} placeholder="Title" aria-label="Simulation title" className="w-48 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:border-emerald-400 focus:outline-none" />
            <button
              type="button"
              disabled={!pastedUrl || !pastedTitle.trim()}
              onClick={() => { onImport({ provider: 'phet', title: pastedTitle.trim(), url: pastedUrl, objective: '' }); setPasted(''); setPastedTitle(''); }}
              className="rounded-full bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700 disabled:opacity-40"
            >
              Import link
            </button>
          </div>
          {pasted.trim() && !pastedUrl && <p className="mt-1 text-xs text-rose-600">Only links from phet.colorado.edu can be imported.</p>}
        </div>
      </div>
    </div>,
    document.body,
  );
};

export default SimulationLibraryModal;
