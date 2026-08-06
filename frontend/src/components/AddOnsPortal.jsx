import React, { useState } from 'react';
import { Building2, Sparkles } from 'lucide-react';
import ExternalStudyResources from './ExternalStudyResources';

const SECTIONS = [
  {
    key: 'school',
    label: 'School',
    description: 'Resources selected by your school and teachers',
    icon: Building2,
  },
  {
    key: 'eec',
    label: 'EEC',
    description: 'Extra learning resources curated by EEC',
    icon: Sparkles,
  },
];

const AddOnsPortal = () => {
  const [activeSection, setActiveSection] = useState('school');

  return (
    <div className="space-y-5">
        <section className="overflow-hidden rounded-[28px] border border-slate-200/80 bg-white shadow-[0_18px_50px_-38px_rgba(15,23,42,0.35)]">
          <div className="bg-[radial-gradient(circle_at_top_right,_rgba(99,102,241,0.18),_transparent_28%),radial-gradient(circle_at_bottom_left,_rgba(249,115,22,0.14),_transparent_24%)] px-5 py-6 sm:px-7 sm:py-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" />
              Learning Add Ons
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl">Add Ons</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 sm:text-base">
              Explore additional videos, articles, PDFs, websites, and tools from your school and EEC.
            </p>

            <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2" role="tablist" aria-label="Add Ons sections">
              {SECTIONS.map((section) => {
                const Icon = section.icon;
                const active = activeSection === section.key;
                return (
                  <button
                    key={section.key}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setActiveSection(section.key)}
                    className={`flex items-center gap-3 rounded-2xl border px-4 py-4 text-left transition-all ${
                      active
                        ? 'border-indigo-300 bg-indigo-600 text-white shadow-lg shadow-indigo-200/60'
                        : 'border-slate-200 bg-white/80 text-slate-700 hover:border-indigo-200 hover:bg-indigo-50'
                    }`}
                  >
                    <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-white/20' : 'bg-indigo-100 text-indigo-700'}`}>
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-bold">{section.label}</span>
                      <span className={`block text-xs sm:text-sm ${active ? 'text-white/80' : 'text-slate-500'}`}>
                        {section.description}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <ExternalStudyResources key={activeSection} origin={activeSection} />
    </div>
  );
};

export default AddOnsPortal;
