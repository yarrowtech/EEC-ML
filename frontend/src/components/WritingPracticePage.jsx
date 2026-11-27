import React, { useState, useEffect, useRef, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  PenLine, Send, Clock, BookOpen, ChevronRight,
  Loader2, FileText, History, AlignLeft, Hash,
  Save, ArrowLeft, CheckCircle,
} from 'lucide-react';
import toast from 'react-hot-toast';
import WritingScoreCard from './WritingScoreCard';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');
const AUTOSAVE_DELAY_MS = 3000;

const DIFFICULTY_COLORS = {
  easy: 'bg-emerald-600 text-white',
  medium: 'bg-amber-600 text-white',
  hard: 'bg-red-600 text-white',
};

const TYPE_LABELS = {
  essay: 'Essay',
  paragraph: 'Paragraph',
  question: 'Answer',
  letter: 'Letter',
  creative: 'Creative',
};

const TYPE_COLORS = {
  essay: 'bg-violet-600 text-white',
  paragraph: 'bg-blue-600 text-white',
  question: 'bg-cyan-600 text-white',
  letter: 'bg-rose-600 text-white',
  creative: 'bg-orange-600 text-white',
};

// Left accent colour, cycled per card
const CARD_ACCENTS = ['border-l-indigo-500', 'border-l-emerald-500', 'border-l-amber-500', 'border-l-rose-500', 'border-l-sky-500', 'border-l-violet-500'];

const PromptCard = ({ prompt, onStart, index = 0 }) => (
  <Motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className={`bg-white rounded-2xl border border-gray-100 border-l-[5px] ${CARD_ACCENTS[index % CARD_ACCENTS.length]} shadow-sm hover:shadow-md transition-all cursor-pointer group`}
    onClick={() => onStart(prompt)}
  >
    <div className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-base group-hover:text-emerald-700 transition-colors line-clamp-2">
            {prompt.title}
          </h3>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0 mt-0.5" />
      </div>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${TYPE_COLORS[prompt.promptType] || 'bg-slate-600 text-white'}`}>
          {TYPE_LABELS[prompt.promptType] || prompt.promptType}
        </span>
        {prompt.difficulty && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-semibold capitalize ${DIFFICULTY_COLORS[prompt.difficulty] || 'bg-slate-600 text-white'}`}>
            {prompt.difficulty}
          </span>
        )}
        {prompt.wordLimit > 0 && (
          <span className="flex items-center gap-1 text-xs text-gray-400">
            <Hash className="w-3.5 h-3.5" /> {prompt.wordLimit} words max
          </span>
        )}
      </div>
    </div>
  </Motion.div>
);

const WritingEditor = ({ prompt, token, onComplete, onCancel }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [assessment, setAssessment] = useState(null);
  const [showInstructions, setShowInstructions] = useState(false);
  const autosaveRef = useRef(null);
  const DRAFT_KEY = `writing_draft_${prompt._id}`;

  // Load draft from localStorage
  useEffect(() => {
    const draft = localStorage.getItem(DRAFT_KEY);
    if (draft) {
      setText(draft);
      toast('Draft restored', { icon: '📝' });
    }
  }, [DRAFT_KEY]);

  // Autosave
  useEffect(() => {
    if (!text) return;
    clearTimeout(autosaveRef.current);
    autosaveRef.current = setTimeout(() => {
      localStorage.setItem(DRAFT_KEY, text);
      setLastSaved(new Date());
    }, AUTOSAVE_DELAY_MS);
    return () => clearTimeout(autosaveRef.current);
  }, [text, DRAFT_KEY]);

  const wordCount = text.trim() ? text.trim().split(/\s+/).filter(Boolean).length : 0;
  const charCount = text.length;
  const readingTime = Math.max(1, Math.ceil(wordCount / 200));

  const isOverLimit = prompt.wordLimit > 0 && wordCount > prompt.wordLimit;
  const isUnderMinimum = wordCount < 20;

  const handleSubmit = async () => {
    if (isUnderMinimum) {
      toast.error('Please write at least 20 words before submitting.');
      return;
    }
    setSubmitting(true);
    try {
      const resp = await fetch(`${API_BASE}/api/writing-assessment/student/evaluate`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ promptId: prompt._id, submission: text }),
      });
      if (!resp.ok) throw new Error(await resp.text());
      const data = await resp.json();
      localStorage.removeItem(DRAFT_KEY);
      setAssessment(data.data);
    } catch (err) {
      console.error(err);
      toast.error('Submission failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (assessment) {
    return (
      <WritingScoreCard
        assessment={assessment}
        prompt={prompt}
        onRetry={() => {
          setAssessment(null);
          setText('');
        }}
        onBack={onCancel}
      />
    );
  }

  return (
    <div className="max-w-3xl mx-auto space-y-5 p-1 sm:p-6">
      {/* Prompt header */}
      <div>
        <h2 className="text-xl font-bold text-gray-900 sm:text-2xl">{prompt.title}</h2>
        <div className="mt-2 mb-4 flex flex-wrap items-center gap-2">
          <span className={`text-xs px-3 py-1 rounded-full font-semibold ${TYPE_COLORS[prompt.promptType] || 'bg-slate-600 text-white'}`}>
            {TYPE_LABELS[prompt.promptType] || prompt.promptType}
          </span>
          {prompt.difficulty && (
            <span className={`text-xs px-3 py-1 rounded-full font-semibold capitalize ${DIFFICULTY_COLORS[prompt.difficulty] || 'bg-slate-600 text-white'}`}>
              {prompt.difficulty}
            </span>
          )}
          {prompt.wordLimit > 0 && (
            <span className="flex items-center gap-1.5 text-xs font-medium text-slate-500 bg-slate-100 px-3 py-1 rounded-full">
              <Hash className="w-3.5 h-3.5" /> {prompt.wordLimit} words max
            </span>
          )}
          {prompt.instructions && (
            <button
              type="button"
              onClick={() => setShowInstructions(true)}
              className="inline-flex items-center gap-1.5 rounded-full bg-blue-600 px-3 py-1 text-xs font-semibold text-white transition-colors hover:bg-blue-700"
            >
              <BookOpen className="w-3.5 h-3.5" /> Instructions
            </button>
          )}
        </div>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <p className="text-sm font-medium text-emerald-800 leading-relaxed">{prompt.question}</p>
        </div>
      </div>

      {/* Instructions modal */}
      {showInstructions && typeof document !== 'undefined' && createPortal(
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setShowInstructions(false)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="writing-instructions-title"
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 id="writing-instructions-title" className="flex items-center gap-2 text-base font-bold text-gray-900">
                <BookOpen className="w-4 h-4 text-blue-600" /> Instructions
              </h3>
              <button type="button" onClick={() => setShowInstructions(false)} aria-label="Close" className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">{prompt.instructions}</p>
            <button type="button" onClick={() => setShowInstructions(false)} className="mt-5 w-full rounded-full bg-blue-600 py-2.5 text-sm font-semibold text-white hover:bg-blue-700">Got it</button>
          </div>
        </div>,
        document.body,
      )}

      {/* Editor */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Your Writing</span>
          {lastSaved && (
            <span className="flex items-center gap-1 text-xs text-emerald-600">
              <Save className="w-3 h-3" /> Saved {lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
        </div>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Start writing here..."
          className="w-full h-64 p-5 text-gray-800 text-base leading-8 resize-none focus:outline-none font-['Georgia',serif]"
          style={{ fontFamily: 'Georgia, serif' }}
          disabled={submitting}
        />
        {/* Stats bar */}
        <div className="px-5 py-3 border-t border-gray-100 flex flex-wrap items-center gap-4 bg-gray-50">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${isOverLimit ? 'text-red-600' : 'text-gray-500'}`}>
            <AlignLeft className="w-3.5 h-3.5" />
            {wordCount} words
            {prompt.wordLimit > 0 && ` / ${prompt.wordLimit}`}
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Hash className="w-3.5 h-3.5" /> {charCount} chars
          </span>
          <span className="flex items-center gap-1.5 text-xs text-gray-400">
            <Clock className="w-3.5 h-3.5" /> ~{readingTime} min read
          </span>
          {isOverLimit && (
            <span className="text-xs text-red-600 font-medium">Over limit by {wordCount - prompt.wordLimit} words</span>
          )}
        </div>
      </div>

      {/* Footer: compact floating bar fixed to the bottom of the screen */}
      <div className="h-20" aria-hidden="true" />
      {typeof document !== 'undefined' && createPortal(
        <div className="pointer-events-none fixed inset-x-0 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-[55] flex justify-center px-3 md:bottom-[calc(1rem+env(safe-area-inset-bottom))]">
          <div className="pointer-events-auto flex w-full max-w-3xl items-center gap-2 rounded-2xl border border-slate-100 bg-white px-2.5 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.12)] sm:gap-3 sm:px-3">
            <button
              type="button"
              onClick={onCancel}
              disabled={submitting}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-4 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:opacity-40 disabled:pointer-events-none"
            >
              <ArrowLeft className="w-4 h-4" /> <span className="hidden sm:inline">Back</span>
            </button>
            <span className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />

            <div className="min-w-0 flex-1 text-center">
              <p className={`truncate text-sm font-bold ${isOverLimit ? 'text-red-600' : 'text-slate-900'}`}>
                {wordCount} words{prompt.wordLimit > 0 ? ` / ${prompt.wordLimit}` : ''}
              </p>
              <p className="truncate text-[11px] font-medium text-slate-500">
                {isOverLimit
                  ? `Over the limit by ${wordCount - prompt.wordLimit} words`
                  : isUnderMinimum
                    ? `Write ${20 - wordCount} more words to submit`
                    : lastSaved ? `Draft saved ${lastSaved.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : 'Ready to submit'}
              </p>
            </div>

            <span className="hidden h-8 w-px shrink-0 bg-slate-200 sm:block" aria-hidden="true" />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || isUnderMinimum || isOverLimit}
              className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-emerald-600 px-5 text-sm font-bold text-white shadow-[0_4px_14px_rgba(5,150,105,0.35)] transition-colors hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Checking…</> : <><Send className="w-4 h-4" /> Submit</>}
            </button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

// History view
const WritingHistory = ({ token }) => {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  useEffect(() => {
    fetch(`${API_BASE}/api/writing-assessment/student/history`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setHistory(d.data || []))
      .catch(() => toast.error('Failed to load history'))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div className="flex justify-center py-16">
      <Loader2 className="w-8 h-8 text-emerald-400 animate-spin" />
    </div>
  );

  if (selected) {
    return (
      <WritingScoreCard
        assessment={selected}
        prompt={selected.promptId}
        onBack={() => setSelected(null)}
      />
    );
  }

  if (history.length === 0) {
    return (
      <div className="text-center py-16">
        <History className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-400 text-sm">No writing assessments yet. Start your first one!</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {history.map((h) => (
        <Motion.div
          key={h._id}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          onClick={() => setSelected(h)}
          className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-4 cursor-pointer hover:shadow-md transition-all"
        >
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-white font-bold text-lg shrink-0 ${
            (h.scores?.overall || 0) >= 80 ? 'bg-emerald-500' : (h.scores?.overall || 0) >= 60 ? 'bg-amber-500' : 'bg-red-500'
          }`}>
            {h.scores?.overall || 0}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm line-clamp-1">{h.promptId?.title || 'Writing'}</p>
            <div className="flex items-center gap-3 text-xs text-gray-400 mt-0.5">
              <span>{new Date(h.createdAt).toLocaleDateString()}</span>
              <span>{h.wordCount || 0} words</span>
              {h.cefrLevel && (
                <span className="px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700 font-medium">{h.cefrLevel}</span>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-gray-300 shrink-0" />
        </Motion.div>
      ))}
    </div>
  );
};

// ─── Main page ────────────────────────────────────────────────────────────────

// When `topics` is given (e.g. on a topic page), keep only items the teacher
// made for that chapter/topic.
const normTopic = (v) => String(v || '').trim().toLowerCase().replace(/[_\s]+/g, ' ');
const filterByTopics = (items, topics) => {
  const wanted = (topics || []).map(normTopic).filter(Boolean);
  if (!wanted.length) return items;
  return items.filter((x) => wanted.includes(normTopic(x.chapter)) || wanted.includes(normTopic(x.topic)));
};

const WritingPracticePage = ({ topics, heading, subheading, onSessionChange } = {}) => {
  const token = localStorage.getItem('token');
  const [view, setView] = useState('list');
  const [prompts, setPrompts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedPrompt, setSelectedPrompt] = useState(null);
  const [activeTab, setActiveTab] = useState('browse');

  useEffect(() => {
    fetch(`${API_BASE}/api/writing-assessment/student/prompts`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((d) => setPrompts(filterByTopics(d.data || [], topics)))
      .catch(() => toast.error('Failed to load writing prompts'))
      .finally(() => setLoading(false));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, (topics || []).join('|')]);

  const inSession = view === 'editor' && Boolean(selectedPrompt);
  useEffect(() => {
    onSessionChange?.(inSession);
  }, [inSession, onSessionChange]);
  useEffect(() => () => onSessionChange?.(false), [onSessionChange]);

  if (view === 'editor' && selectedPrompt) {
    return (
      <WritingEditor
        prompt={selectedPrompt}
        token={token}
        onCancel={() => { setView('list'); setSelectedPrompt(null); }}
        onComplete={() => { setView('list'); setSelectedPrompt(null); }}
      />
    );
  }

  return (
    <div className="space-y-6">
      {activeTab === 'history' ? (
        /* History: Back on the left, "My History" centred */
        <div className="relative flex min-h-9 items-center justify-center">
          <button
            type="button"
            onClick={() => setActiveTab('browse')}
            className="absolute left-0 top-1/2 inline-flex -translate-y-1/2 items-center gap-1.5 rounded-full bg-emerald-50 px-3 py-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ArrowLeft className="w-4 h-4" /> Back
          </button>
          <h2 className="text-base font-bold text-[#0d1c2e]">My History</h2>
        </div>
      ) : (
        /* Heading on the left, History on the right */
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            {heading && <h2 className="text-base font-bold text-[#0d1c2e]">{heading}</h2>}
            {subheading && <p className="text-xs text-[#64748b]">{subheading}</p>}
          </div>
          <button
            type="button"
            onClick={() => setActiveTab('history')}
            className="ml-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-emerald-50 px-4 py-1.5 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <Clock className="w-4 h-4" /> History
          </button>
        </div>
      )}

      {activeTab === 'browse' ? (
        <>
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 h-36 animate-pulse" />
              ))}
            </div>
          ) : prompts.length === 0 ? (
            <div className="text-center py-16">
              <PenLine className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-400 text-sm">No writing prompts yet. Ask your teacher to publish some!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {prompts.map((p, i) => (
                <PromptCard
                  key={p._id}
                  index={i}
                  prompt={p}
                  onStart={(pr) => { setSelectedPrompt(pr); setView('editor'); }}
                />
              ))}
            </div>
          )}
        </>
      ) : (
        <WritingHistory token={token} />
      )}
    </div>
  );
};

export default WritingPracticePage;
