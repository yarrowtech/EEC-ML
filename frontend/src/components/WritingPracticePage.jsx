import React, { useState, useEffect, useRef, useCallback } from 'react';
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
  easy: 'bg-emerald-100 text-emerald-700',
  medium: 'bg-amber-100 text-amber-700',
  hard: 'bg-red-100 text-red-700',
};

const TYPE_LABELS = {
  essay: 'Essay',
  paragraph: 'Paragraph',
  question: 'Answer',
  letter: 'Letter',
  creative: 'Creative',
};

const TYPE_COLORS = {
  essay: 'bg-violet-50 text-violet-700',
  paragraph: 'bg-blue-50 text-blue-700',
  question: 'bg-cyan-50 text-cyan-700',
  letter: 'bg-rose-50 text-rose-700',
  creative: 'bg-amber-50 text-amber-700',
};

const PromptCard = ({ prompt, onStart }) => (
  <Motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition-all cursor-pointer group"
    onClick={() => onStart(prompt)}
  >
    <div className="p-5">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-900 text-base group-hover:text-emerald-700 transition-colors line-clamp-2">
            {prompt.title}
          </h3>
          <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{prompt.question}</p>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-300 group-hover:text-emerald-500 transition-colors shrink-0 mt-0.5" />
      </div>
      <div className="flex flex-wrap gap-2">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[prompt.promptType] || 'bg-gray-100 text-gray-600'}`}>
          {TYPE_LABELS[prompt.promptType] || prompt.promptType}
        </span>
        {prompt.difficulty && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${DIFFICULTY_COLORS[prompt.difficulty]}`}>
            {prompt.difficulty}
          </span>
        )}
        {prompt.subject && (
          <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">{prompt.subject}</span>
        )}
      </div>
      {prompt.wordLimit > 0 && (
        <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
          <Hash className="w-3 h-3" /> Word limit: {prompt.wordLimit}
        </p>
      )}
    </div>
  </Motion.div>
);

const WritingEditor = ({ prompt, token, onComplete, onCancel }) => {
  const [text, setText] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [assessment, setAssessment] = useState(null);
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
    <div className="max-w-3xl mx-auto space-y-5">
      <button onClick={onCancel} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Back to prompts
      </button>

      {/* Prompt header */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex flex-wrap gap-2 mb-3">
          <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${TYPE_COLORS[prompt.promptType] || 'bg-gray-100 text-gray-600'}`}>
            {TYPE_LABELS[prompt.promptType] || prompt.promptType}
          </span>
          {prompt.difficulty && (
            <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${DIFFICULTY_COLORS[prompt.difficulty]}`}>
              {prompt.difficulty}
            </span>
          )}
          {prompt.subject && (
            <span className="text-xs px-2.5 py-1 rounded-full bg-indigo-50 text-indigo-700 font-medium">{prompt.subject}</span>
          )}
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">{prompt.title}</h2>
        <div className="bg-emerald-50 rounded-xl p-4 border border-emerald-100">
          <p className="text-sm font-medium text-emerald-800 leading-relaxed">{prompt.question}</p>
        </div>
        {prompt.instructions && (
          <div className="mt-3 bg-blue-50 rounded-xl p-3">
            <p className="text-xs text-blue-700 leading-relaxed"><span className="font-semibold">Instructions:</span> {prompt.instructions}</p>
          </div>
        )}
        {prompt.wordLimit > 0 && (
          <p className="mt-2 text-xs text-gray-400 flex items-center gap-1">
            <Hash className="w-3 h-3" /> Word limit: {prompt.wordLimit} words
          </p>
        )}
      </div>

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

      {/* Submit */}
      <div className="flex items-center justify-between gap-4">
        <p className="text-xs text-gray-400">
          {isUnderMinimum ? `Write at least ${20 - wordCount} more words to submit.` : 'Your draft auto-saves every few seconds.'}
        </p>
        <button
          onClick={handleSubmit}
          disabled={submitting || isUnderMinimum || isOverLimit}
          className="flex items-center gap-2 px-6 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {submitting ? (
            <><Loader2 className="w-4 h-4 animate-spin" /> Evaluating...</>
          ) : (
            <><Send className="w-4 h-4" /> Submit & Evaluate</>
          )}
        </button>
      </div>
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

const WritingPracticePage = () => {
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
      .then((d) => setPrompts(d.data || []))
      .catch(() => toast.error('Failed to load writing prompts'))
      .finally(() => setLoading(false));
  }, [token]);

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
      <div className="flex gap-1 bg-gray-100 rounded-xl p-1 w-fit">
        {['browse', 'history'].map((t) => (
          <button
            key={t}
            onClick={() => setActiveTab(t)}
            className={`px-4 py-1.5 rounded-lg text-sm font-semibold transition-all capitalize ${
              activeTab === t ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t === 'browse' ? 'Browse Prompts' : 'My History'}
          </button>
        ))}
      </div>

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
              {prompts.map((p) => (
                <PromptCard
                  key={p._id}
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
