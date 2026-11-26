import React, { useState } from 'react';
import { FlaskConical, Plus, Sprout, Trash2, FilePlus2, Library, ExternalLink } from 'lucide-react';
import SimulationLibraryModal from './SimulationLibraryModal';
import { experimentFromSimulation } from '@/utils/simulationCatalog';
import SeedJar from '@/components/virtualLab/SeedJar';
import {
  SEED_GERMINATION_TEMPLATE, BLANK_EXPERIMENT, WATER_LEVELS, OUTCOME_LABEL, jarOutcome, isExperimentReady, newLabId,
} from '@/utils/virtualLab';

// "Practical" mode of a lesson-plan chapter: the teacher adds virtual lab
// experiments that students perform in Student → Virtual Lab.
const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 focus:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-100';
const labelCls = 'mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500';
const OUTCOME_TONE = { good: 'bg-emerald-50 text-emerald-700', poor: 'bg-amber-50 text-amber-700', none: 'bg-rose-50 text-rose-700' };

const Section = ({ title, hint, children, action }) => (
  <section className="rounded-xl border border-slate-200 bg-white p-4">
    <div className="mb-3 flex items-start justify-between gap-2">
      <div>
        <h4 className="text-sm font-bold text-slate-800">{title}</h4>
        {hint && <p className="text-xs text-slate-500">{hint}</p>}
      </div>
      {action}
    </div>
    {children}
  </section>
);

const LabExperimentBuilder = ({ experiments = [], onChange, classLabel = '', subjectName = '' }) => {
  const [activeId, setActiveId] = useState(experiments[0]?.id || null);
  const [libraryOpen, setLibraryOpen] = useState(false);
  const active = experiments.find((e) => e.id === activeId) || null;

  const save = (list) => onChange(list);
  const add = (exp) => { save([...experiments, exp]); setActiveId(exp.id); };
  const update = (patch) => save(experiments.map((e) => (e.id === activeId ? { ...e, ...patch } : e)));
  const remove = (id) => {
    if (!window.confirm('Delete this experiment?')) return;
    const next = experiments.filter((e) => e.id !== id);
    save(next);
    if (id === activeId) setActiveId(next[0]?.id || null);
  };
  const setListItem = (key, index, patch) => update({ [key]: (active[key] || []).map((x, i) => (i === index ? { ...x, ...patch } : x)) });
  const removeListItem = (key, index) => update({ [key]: (active[key] || []).filter((_, i) => i !== index) });

  return (
    <div className="flex min-h-0 flex-col gap-4 lg:flex-row">
      <SimulationLibraryModal
        open={libraryOpen}
        onClose={() => setLibraryOpen(false)}
        defaultClass={classLabel}
        defaultSubject={subjectName}
        importedUrls={experiments.filter((e) => e.kind === 'embed').map((e) => e.simUrl)}
        onImport={(entry) => add(experimentFromSimulation(entry, newLabId))}
      />
      {/* experiment list */}
      <aside className="w-full shrink-0 space-y-3 lg:w-64">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <p className="text-sm font-bold text-emerald-900">Add an experiment</p>
          <p className="mb-2 text-xs text-emerald-800">Students will do it in their Virtual Lab.</p>
          <button type="button" onClick={() => add(SEED_GERMINATION_TEMPLATE())} className="mb-1.5 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-xs font-semibold text-emerald-800 ring-1 ring-emerald-200 hover:bg-emerald-50">
            <Sprout size={15} /> Seed Germination (ready template)
          </button>
          <button type="button" onClick={() => setLibraryOpen(true)} className="mb-1.5 flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-xs font-semibold text-sky-800 ring-1 ring-sky-200 hover:bg-sky-50">
            <Library size={15} /> Import from simulation library
          </button>
          <button type="button" onClick={() => add(BLANK_EXPERIMENT())} className="flex w-full items-center gap-2 rounded-lg bg-white px-3 py-2 text-left text-xs font-semibold text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            <FilePlus2 size={15} /> Blank step-by-step experiment
          </button>
        </div>
        {experiments.length > 0 && (
          <ul className="space-y-1.5">
            {experiments.map((e, i) => (
              <li key={e.id} className={`group flex items-center gap-2 rounded-lg border p-2 text-xs ${e.id === activeId ? 'border-emerald-300 bg-emerald-50' : 'border-slate-200 bg-white hover:bg-slate-50'}`}>
                <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-[11px] font-bold text-white">{i + 1}</span>
                <button type="button" onClick={() => setActiveId(e.id)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-semibold text-slate-800">{e.title || 'Untitled experiment'}</span>
                  <span className={`block text-[10.5px] ${isExperimentReady(e) ? 'text-emerald-700' : 'text-amber-600'}`}>{isExperimentReady(e) ? 'Ready for students' : 'Add a title and at least one stage'}</span>
                </button>
                <button type="button" onClick={() => remove(e.id)} aria-label={`Delete ${e.title || 'experiment'}`} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
              </li>
            ))}
          </ul>
        )}
      </aside>

      {/* editor */}
      <div className="min-w-0 flex-1 space-y-4">
        {!active ? (
          <div className="flex min-h-[260px] flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 p-8 text-center">
            <FlaskConical className="size-8 text-emerald-400" />
            <p className="mt-2 text-sm font-semibold text-slate-700">No experiments in this chapter yet</p>
            <p className="mt-1 text-xs text-slate-500">Start from the Seed Germination template or a blank experiment.</p>
          </div>
        ) : (
          <>
            {active.kind === 'embed' && (
              <Section
                title="Simulation"
                hint={active.source ? `Imported for Class ${active.source.className} · ${active.source.subject} · ${active.source.chapter}` : 'Imported from a link'}
                action={<a href={active.simUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 rounded-full border border-slate-200 px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"><ExternalLink size={12} /> Open</a>}
              >
                <div className="aspect-video w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100">
                  <iframe title={`${active.title} preview`} src={active.simUrl} className="h-full w-full" sandbox="allow-scripts allow-same-origin" loading="lazy" />
                </div>
                {active.attribution && <p className="mt-1.5 text-[11px] text-slate-400">Simulation: {active.attribution}</p>}
              </Section>
            )}
            <Section title="Experiment details">
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="sm:col-span-2"><span className={labelCls}>Title</span>
                  <input aria-label="Experiment title" value={active.title} onChange={(e) => update({ title: e.target.value })} placeholder="e.g. How Does a Seed Germinate?" className={inputCls} />
                </label>
                <label className="sm:col-span-2"><span className={labelCls}>Objective</span>
                  <textarea rows={2} value={active.objective} onChange={(e) => update({ objective: e.target.value })} className={inputCls} />
                </label>
                {active.kind !== 'embed' && <label className="sm:col-span-2"><span className={labelCls}>Materials (one per line)</span>
                  <textarea rows={3} value={(active.materials || []).join('\n')} onChange={(e) => update({ materials: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean) })} className={inputCls} />
                </label>}
              </div>
            </Section>

            <Section
              title={active.kind === 'embed' ? 'What students should try in the simulation' : 'Stages students perform'}
              hint="Students complete these in order."
              action={<button type="button" onClick={() => update({ stages: [...(active.stages || []), { title: '', instruction: '' }] })} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"><Plus size={12} /> Stage</button>}
            >
              <ol className="space-y-2">
                {(active.stages || []).map((s, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="mt-2 flex size-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-bold text-slate-600">{i + 1}</span>
                    <div className="grid flex-1 gap-1.5 sm:grid-cols-[180px_1fr]">
                      <input aria-label={`Stage ${i + 1} title`} value={s.title} onChange={(e) => setListItem('stages', i, { title: e.target.value })} placeholder="Stage title" className={inputCls} />
                      <input value={s.instruction} onChange={(e) => setListItem('stages', i, { instruction: e.target.value })} placeholder="What the student does" className={inputCls} />
                    </div>
                    <button type="button" onClick={() => removeListItem('stages', i)} aria-label={`Remove stage ${i + 1}`} className="mt-1.5 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                  </li>
                ))}
              </ol>
            </Section>

            {active.kind === 'germination' && (
              <Section
                title="Test jars"
                hint="Each jar has different conditions — students compare the results. Students also get their own jar to control."
                action={<button type="button" onClick={() => update({ jars: [...(active.jars || []), { name: `Jar ${String.fromCharCode(65 + (active.jars || []).length)}`, water: 1, air: true, warm: true, light: true }] })} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"><Plus size={12} /> Jar</button>}
              >
                <div className="grid gap-3 sm:grid-cols-2">
                  {(active.jars || []).map((jar, i) => {
                    const outcome = jarOutcome(jar);
                    return (
                      <div key={i} className="flex gap-3 rounded-xl border border-slate-200 p-3">
                        <SeedJar stage={outcome === 'good' ? 7 : outcome === 'poor' ? 3 : 0} water={jar.water} light={jar.light} size={70} />
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <input aria-label={`Jar ${i + 1} name`} value={jar.name} onChange={(e) => setListItem('jars', i, { name: e.target.value })} className={inputCls} />
                          <div className="flex flex-wrap gap-1.5 text-xs">
                            <select aria-label="Water" value={jar.water} onChange={(e) => { const water = Number(e.target.value); setListItem('jars', i, { water, air: water < 2 }); }} className="rounded-lg border border-slate-200 px-2 py-1">
                              {WATER_LEVELS.map((w, wi) => <option key={w} value={wi}>{w}</option>)}
                            </select>
                            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={jar.warm} onChange={(e) => setListItem('jars', i, { warm: e.target.checked })} /> Warm</label>
                            <label className="inline-flex items-center gap-1"><input type="checkbox" checked={jar.light} onChange={(e) => setListItem('jars', i, { light: e.target.checked })} /> Light</label>
                          </div>
                          <div className="flex items-center justify-between">
                            <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${OUTCOME_TONE[outcome]}`}>{OUTCOME_LABEL[outcome]}</span>
                            <button type="button" onClick={() => removeListItem('jars', i)} aria-label={`Remove jar ${i + 1}`} className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={13} /></button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </Section>
            )}

            {active.kind === 'germination' && (
              <Section title="What happens each day" hint="Shown to students as they move day by day (the good jar follows these).">
                <div className="space-y-1.5">
                  {(active.days || []).map((d, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="w-14 shrink-0 text-xs font-bold text-emerald-700">Day {d.day}</span>
                      <input value={d.observation} onChange={(e) => setListItem('days', i, { observation: e.target.value })} className={inputCls} />
                    </div>
                  ))}
                </div>
                <label className="mt-3 block"><span className={labelCls}>What students should learn (conclusion)</span>
                  <textarea rows={2} value={active.conclusion} onChange={(e) => update({ conclusion: e.target.value })} className={inputCls} />
                </label>
              </Section>
            )}

            <Section
              title="Questions after the experiment"
              hint="Asked automatically when students finish."
              action={<button type="button" onClick={() => update({ questions: [...(active.questions || []), { question: '', options: ['', '', '', ''], correctAnswer: 0 }] })} className="inline-flex items-center gap-1 rounded-full bg-emerald-600 px-3 py-1 text-xs font-semibold text-white"><Plus size={12} /> Question</button>}
            >
              <ol className="space-y-3">
                {(active.questions || []).map((q, qi) => (
                  <li key={qi} className="rounded-xl border border-slate-200 p-3">
                    <div className="flex items-start gap-2">
                      <span className="mt-2 text-xs font-bold text-slate-500">{qi + 1}.</span>
                      <input aria-label={`Question ${qi + 1}`} value={q.question} onChange={(e) => setListItem('questions', qi, { question: e.target.value })} placeholder="Question" className={inputCls} />
                      <button type="button" onClick={() => removeListItem('questions', qi)} aria-label={`Remove question ${qi + 1}`} className="mt-1.5 rounded p-1.5 text-slate-400 hover:bg-red-50 hover:text-red-600"><Trash2 size={14} /></button>
                    </div>
                    <div className="mt-2 grid gap-1.5 pl-5 sm:grid-cols-2">
                      {(q.options || []).map((opt, oi) => (
                        <label key={oi} className="flex items-center gap-2">
                          <input type="radio" name={`correct-${active.id}-${qi}`} checked={Number(q.correctAnswer) === oi} onChange={() => setListItem('questions', qi, { correctAnswer: oi })} title="Correct answer" />
                          <input value={opt} onChange={(e) => setListItem('questions', qi, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })} placeholder={`Option ${String.fromCharCode(65 + oi)}`} className={inputCls} />
                        </label>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </Section>

            <Section title="XP rewards">
              <div className="grid gap-3 sm:grid-cols-3">
                {[['complete', 'Completing the experiment'], ['observations', 'Recording 3+ observations'], ['quiz', 'All questions correct']].map(([key, label]) => (
                  <label key={key}><span className={labelCls}>{label}</span>
                    <input type="number" min={0} max={100} value={active.xp?.[key] ?? 0} onChange={(e) => update({ xp: { ...active.xp, [key]: Math.max(0, Number(e.target.value) || 0) } })} className={inputCls} />
                  </label>
                ))}
              </div>
            </Section>
          </>
        )}
      </div>
    </div>
  );
};

export default LabExperimentBuilder;
