import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { BookOpen, Headphones, PenLine, Monitor, ChevronRight, CheckCircle2, Sparkles } from 'lucide-react';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const SUBJECTS = ['Mathematics', 'Science', 'English', 'Social Studies', 'Hindi', 'Computer Science', 'Physics', 'Chemistry', 'Biology', 'History', 'Geography'];

const LEARNING_STYLES = [
  { key: 'visual', label: 'Visual', icon: Monitor, desc: 'I learn best through diagrams, charts and videos' },
  { key: 'reading', label: 'Reading', icon: BookOpen, desc: 'I prefer reading notes and textbooks' },
  { key: 'hands-on', label: 'Hands-On', icon: PenLine, desc: 'I learn by doing exercises and practice' },
  { key: 'listening', label: 'Listening', icon: Headphones, desc: 'I understand better by listening to explanations' },
];

const STEPS = ['Welcome', 'Subjects', 'Style'];

const StudentOnboarding = ({ studentName = 'Student', onComplete }) => {
  const [step, setStep] = useState(0);
  const [selectedSubjects, setSelectedSubjects] = useState([]);
  const [learningStyle, setLearningStyle] = useState('');
  const [saving, setSaving] = useState(false);

  const toggleSubject = (s) => {
    setSelectedSubjects((prev) =>
      prev.includes(s) ? prev.filter((x) => x !== s) : prev.length < 5 ? [...prev, s] : prev
    );
  };

  const save = async () => {
    setSaving(true);
    try {
      const token = localStorage.getItem('token');
      await fetch(`${API_BASE}/api/student/auth/onboarding`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subjects: selectedSubjects, learningStyle }),
      });
    } catch (_) {}
    finally { setSaving(false); }
    onComplete?.();
  };

  const firstName = (studentName || '').split(' ')[0] || 'Student';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-sm p-4">
      <Motion.div
        initial={{ scale: 0.92, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden"
      >
        {/* Progress bar */}
        <div className="h-1.5 bg-slate-100">
          <Motion.div
            className="h-full bg-gradient-to-r from-amber-400 to-orange-500"
            animate={{ width: `${((step + 1) / STEPS.length) * 100}%` }}
            transition={{ duration: 0.4 }}
          />
        </div>

        <div className="p-6 sm:p-8">
          {/* Step label */}
          <div className="flex items-center gap-2 mb-5">
            {STEPS.map((label, i) => (
              <React.Fragment key={label}>
                <span className={`text-xs font-bold ${i === step ? 'text-amber-600' : i < step ? 'text-emerald-600' : 'text-slate-300'}`}>
                  {i < step ? <CheckCircle2 className="inline size-3.5" /> : `${i + 1}.`} {label}
                </span>
                {i < STEPS.length - 1 && <span className="text-slate-200 text-xs">›</span>}
              </React.Fragment>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {/* Step 0 — Welcome */}
            {step === 0 && (
              <Motion.div key="welcome" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-200">
                  <Sparkles className="size-8 text-white" />
                </div>
                <h2 className="text-2xl font-black text-slate-900 mb-2">Welcome, {firstName}! 🎉</h2>
                <p className="text-slate-500 text-sm leading-relaxed">
                  Let's take 30 seconds to personalise your learning experience. We'll use your preferences to suggest the right study materials and activities for you.
                </p>
                <div className="mt-6 grid grid-cols-3 gap-3 text-center text-xs text-slate-500">
                  {['Smart AI Tutor', 'Personalised Paths', 'Progress Tracking'].map((label) => (
                    <div key={label} className="rounded-xl bg-amber-50 border border-amber-100 px-2 py-3 font-semibold text-amber-700">{label}</div>
                  ))}
                </div>
              </Motion.div>
            )}

            {/* Step 1 — Subjects */}
            {step === 1 && (
              <Motion.div key="subjects" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
                <h2 className="text-xl font-black text-slate-900 mb-1">Your favourite subjects</h2>
                <p className="text-sm text-slate-500 mb-4">Pick up to 5 subjects you enjoy or want to focus on.</p>
                <div className="flex flex-wrap gap-2">
                  {SUBJECTS.map((s) => {
                    const active = selectedSubjects.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleSubject(s)}
                        className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                          active
                            ? 'border-amber-500 bg-amber-500 text-white shadow-sm'
                            : 'border-slate-200 bg-white text-slate-600 hover:border-amber-300'
                        }`}
                      >
                        {active && '✓ '}{s}
                      </button>
                    );
                  })}
                </div>
                {selectedSubjects.length > 0 && (
                  <p className="mt-3 text-xs text-amber-600 font-semibold">{selectedSubjects.length}/5 selected</p>
                )}
              </Motion.div>
            )}

            {/* Step 2 — Learning Style */}
            {step === 2 && (
              <Motion.div key="style" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
                <h2 className="text-xl font-black text-slate-900 mb-1">How do you learn best?</h2>
                <p className="text-sm text-slate-500 mb-4">This helps us tailor AI explanations just for you.</p>
                <div className="space-y-2.5">
                  {LEARNING_STYLES.map((style) => {
                    const Icon = style.icon;
                    const active = learningStyle === style.key;
                    return (
                      <button
                        key={style.key}
                        type="button"
                        onClick={() => setLearningStyle(style.key)}
                        className={`w-full flex items-center gap-3 rounded-2xl border p-3.5 text-left transition-all ${
                          active
                            ? 'border-amber-400 bg-amber-50 shadow-sm'
                            : 'border-slate-100 bg-white hover:border-amber-200'
                        }`}
                      >
                        <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${active ? 'bg-amber-500 text-white' : 'bg-slate-100 text-slate-500'}`}>
                          <Icon className="size-5" />
                        </div>
                        <div>
                          <p className={`text-sm font-bold ${active ? 'text-amber-800' : 'text-slate-700'}`}>{style.label}</p>
                          <p className="text-xs text-slate-400">{style.desc}</p>
                        </div>
                        {active && <CheckCircle2 className="ml-auto size-5 text-amber-500 shrink-0" />}
                      </button>
                    );
                  })}
                </div>
              </Motion.div>
            )}
          </AnimatePresence>

          {/* Navigation */}
          <div className="mt-6 flex gap-3">
            {step > 0 && (
              <button
                type="button"
                onClick={() => setStep((s) => s - 1)}
                className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
            )}
            <button
              type="button"
              disabled={saving}
              onClick={() => {
                if (step < STEPS.length - 1) setStep((s) => s + 1);
                else save();
              }}
              className="ml-auto flex items-center gap-2 rounded-xl bg-gradient-to-r from-amber-400 to-orange-500 px-5 py-2.5 text-sm font-bold text-white shadow-md hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              {saving ? 'Saving…' : step < STEPS.length - 1 ? 'Continue' : "Let's Go!"}
              {!saving && <ChevronRight className="size-4" />}
            </button>
          </div>

          {step < STEPS.length - 1 && (
            <button type="button" onClick={save} className="mt-3 w-full text-center text-xs text-slate-400 hover:text-slate-500 transition-colors">
              Skip for now
            </button>
          )}
        </div>
      </Motion.div>
    </div>
  );
};

export default StudentOnboarding;
