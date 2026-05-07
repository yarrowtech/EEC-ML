import React, { useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { ArrowLeft, ChevronRight, GripVertical, Pencil, Trash2, Upload } from 'lucide-react';

const QUESTION_SETS = {
  basic: [
    {
      prompt: 'Determine the derivative of f(x) = 3x² + 2x - 5 with respect to x.',
      options: ['A) 6x + 2', 'B) 3x + 2', 'C) 6x - 5', 'D) 2x + 3'],
      points: 5,
      time: '2 mins',
    },
  ],
  intermediate: [
    {
      prompt: 'If f(x) = x³ - 4x² + x - 7, find f\'(2).',
      options: ['A) -3', 'B) -1', 'C) 2', 'D) 5'],
      points: 8,
      time: '3 mins',
    },
    {
      prompt: 'Find the slope of the tangent to y = 2x² + 5x - 1 at x = -1.',
      options: ['A) 1', 'B) 3', 'C) 5', 'D) 7'],
      points: 8,
      time: '3 mins',
    },
  ],
  advanced: [
    {
      prompt: 'For f(x) = (x² + 1)(x - 3), compute f\'(x).',
      options: ['A) 3x² - 6x + 1', 'B) 2x(x - 3)', 'C) x² + 1', 'D) 3x² - 9x + 1'],
      points: 10,
      time: '4 mins',
    },
    {
      prompt: 'If y = (3x + 1)/(x - 2), find dy/dx.',
      options: ['A) 7/(x - 2)²', 'B) -7/(x - 2)²', 'C) (3x - 5)/(x - 2)²', 'D) 3/(x - 2)'],
      points: 10,
      time: '4 mins',
    },
    {
      prompt: 'Given f(x) = x⁴ - 2x² + 6, find the critical points.',
      options: ['A) x = 0 only', 'B) x = ±1 only', 'C) x = 0, ±1', 'D) No critical points'],
      points: 12,
      time: '5 mins',
    },
  ],
};

const AILearningPracticePaperPage = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const topicMatch = location.pathname.match(/\/topic\/([^/]+)/);
  const subjectMatch = location.pathname.match(/\/subject\/([^/]+)/);

  const topic = topicMatch?.[1] ? decodeURIComponent(topicMatch[1]) : 'Topic';
  const subject = subjectMatch?.[1] ? decodeURIComponent(subjectMatch[1]) : 'Subject';
  const [activeDifficulty, setActiveDifficulty] = useState('basic');
  const activeQuestions = QUESTION_SETS[activeDifficulty] || [];
  const counts = useMemo(
    () => ({
      basic: QUESTION_SETS.basic.length,
      intermediate: QUESTION_SETS.intermediate.length,
      advanced: QUESTION_SETS.advanced.length,
    }),
    []
  );

  return (
    <div className="min-h-screen bg-[#f8f9ff] px-4 py-6 sm:px-6 lg:px-8" style={{ fontFamily: 'Lexend, sans-serif' }}>
      <div className="mx-auto w-full max-w-[1280px] space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <button
              onClick={() => navigate(-1)}
              className="mb-3 inline-flex items-center gap-2 rounded-lg border border-[#d8dce8] bg-white px-3 py-1.5 text-sm font-semibold text-[#00288e] hover:bg-[#eef4ff]"
            >
              <ArrowLeft size={16} /> Back
            </button>
            <div className="mb-2 flex items-center gap-1 text-xs font-semibold text-[#64748b]">
              <span>Assessments</span>
              <ChevronRight size={14} />
              <span className="text-[#00288e]">New Assessment</span>
            </div>
            <h1 className="text-3xl font-bold text-[#0f172a]">Make Question Paper</h1>
            <p className="mt-1 text-sm text-[#475569]">
              {subject} • {topic} • Design institutional-grade assessments with multi-level difficulty.
            </p>
          </div>

          <div className="flex gap-2">
            <button className="rounded-lg border border-[#b8c4ff] bg-white px-5 py-2 text-sm font-semibold text-[#173bab] hover:bg-[#eef4ff]">
              Save Draft
            </button>
            <button className="inline-flex items-center gap-2 rounded-lg bg-[#1e40af] px-5 py-2 text-sm font-semibold text-white hover:brightness-110">
              <Upload size={15} /> Finalize Paper
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
          <div className="rounded-xl border border-[#dbe4f4] bg-white p-4 shadow-sm lg:col-span-8">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-[#444653]">Assessment Title</label>
                <input
                  type="text"
                  placeholder="e.g., Advanced Calculus Midterm"
                  className="w-full rounded-lg border border-[#c4c5d5] bg-[#f8f9ff] px-3 py-2.5 text-sm outline-none focus:border-[#3755c3]"
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-medium text-[#444653]">Subject / Module</label>
                <select className="w-full rounded-lg border border-[#c4c5d5] bg-[#f8f9ff] px-3 py-2.5 text-sm outline-none focus:border-[#3755c3]">
                  <option>{subject} - {topic}</option>
                  <option>{subject} - Mixed Practice</option>
                  <option>{subject} - Revision Set</option>
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-[#dbe4f4] bg-[#eef4ff] p-4 shadow-sm lg:col-span-4">
            <h2 className="text-sm font-bold text-[#173bab]">Paper Controls</h2>
            <p className="mt-2 text-xs text-[#475569]">Choose section difficulty and compose questions for the selected topic.</p>
          </div>

          <div className="overflow-hidden rounded-xl border border-[#dbe4f4] bg-white shadow-sm lg:col-span-12">
            <div className="grid grid-cols-3 border-b border-[#e5e7eb] bg-[#eef4ff] text-sm font-semibold">
              <button
                onClick={() => setActiveDifficulty('basic')}
                className={`px-4 py-3 ${activeDifficulty === 'basic' ? 'border-b-2 border-[#00288e] bg-white text-[#00288e]' : 'text-[#64748b] hover:text-[#00288e]'}`}
              >
                Basic ({String(counts.basic).padStart(2, '0')})
              </button>
              <button
                onClick={() => setActiveDifficulty('intermediate')}
                className={`px-4 py-3 ${activeDifficulty === 'intermediate' ? 'border-b-2 border-[#00288e] bg-white text-[#00288e]' : 'text-[#64748b] hover:text-[#00288e]'}`}
              >
                Intermediate ({String(counts.intermediate).padStart(2, '0')})
              </button>
              <button
                onClick={() => setActiveDifficulty('advanced')}
                className={`px-4 py-3 ${activeDifficulty === 'advanced' ? 'border-b-2 border-[#00288e] bg-white text-[#00288e]' : 'text-[#64748b] hover:text-[#00288e]'}`}
              >
                Advanced ({String(counts.advanced).padStart(2, '0')})
              </button>
            </div>

            <div className="space-y-4 p-4 sm:p-6">
              {activeQuestions.map((question, questionIndex) => (
                <div key={`${activeDifficulty}-${questionIndex}`} className="rounded-lg border border-[#d9e3f4] bg-white p-4 shadow-sm">
                  <div className="mb-3 flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#e5eeff] text-xs font-bold text-[#173bab]">
                        {String(questionIndex + 1).padStart(2, '0')}
                      </span>
                      <span className="rounded-full bg-[#82f5c1] px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-[#005137]">Multiple Choice</span>
                    </div>
                    <div className="flex items-center gap-1 text-[#64748b]">
                      <button className="rounded p-1 hover:bg-slate-100"><GripVertical size={14} /></button>
                      <button className="rounded p-1 hover:bg-slate-100"><Pencil size={14} /></button>
                      <button className="rounded p-1 hover:bg-red-50 hover:text-[#ba1a1a]"><Trash2 size={14} /></button>
                    </div>
                  </div>

                  <h3 className="mb-4 text-base font-semibold text-[#121c28]">
                    {question.prompt}
                  </h3>

                  <div className="grid grid-cols-1 gap-2 border-l-2 border-[#b8c4ff] pl-4 sm:grid-cols-2">
                    {question.options.map((option) => (
                      <div key={option} className="rounded border border-[#eef2f7] bg-[#ffffff] p-2.5 text-sm text-[#334155]">
                        {option}
                      </div>
                    ))}
                  </div>

                  <div className="mt-4 flex flex-wrap items-center gap-5 border-t border-[#f1f5f9] pt-3 text-xs text-[#64748b]">
                    <span>Points: {String(question.points).padStart(2, '0')}</span>
                    <span>Est. Time: {question.time}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AILearningPracticePaperPage;
