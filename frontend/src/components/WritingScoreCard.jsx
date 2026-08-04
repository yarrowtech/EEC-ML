import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  PenLine, BookOpen, Layers, Target, Heart,
  TrendingUp, AlertTriangle, CheckCircle2, Download,
  RotateCcw, ChevronDown, ChevronUp, Sparkles,
} from 'lucide-react';
import LanguageRadarChart from './LanguageRadarChart';

const ScoreRing = ({ score, size = 120, strokeWidth = 10 }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      <Motion.circle
        cx={size / 2} cy={size / 2} r={radius}
        fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
      />
    </svg>
  );
};

const MetricBar = ({ label, value, color }) => (
  <div>
    <div className="flex justify-between text-sm mb-1">
      <span className="text-gray-600 font-medium">{label}</span>
      <span className="font-bold text-gray-800">{value}/100</span>
    </div>
    <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
      <Motion.div
        className={`h-full rounded-full ${color}`}
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.9, ease: 'easeOut' }}
      />
    </div>
  </div>
);

const CorrectionCard = ({ correction, idx }) => {
  const typeColors = {
    grammar: 'bg-red-50 border-red-200 text-red-700',
    spelling: 'bg-orange-50 border-orange-200 text-orange-700',
    verb_tense: 'bg-purple-50 border-purple-200 text-purple-700',
    punctuation: 'bg-blue-50 border-blue-200 text-blue-700',
    word_choice: 'bg-amber-50 border-amber-200 text-amber-700',
  };
  const colorClass = typeColors[correction.type] || 'bg-gray-50 border-gray-200 text-gray-700';

  return (
    <Motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: idx * 0.08 }}
      className={`rounded-xl border p-4 ${colorClass}`}
    >
      <div className="flex items-start gap-2 mb-2">
        <span className="text-xs font-bold uppercase tracking-wide opacity-70">{correction.type?.replace('_', ' ')}</span>
      </div>
      <div className="flex flex-col gap-1">
        <span className="line-through text-sm opacity-60">{correction.original}</span>
        <span className="font-semibold text-sm">✓ {correction.corrected}</span>
        {correction.explanation && (
          <span className="text-xs opacity-70 mt-1">{correction.explanation}</span>
        )}
      </div>
    </Motion.div>
  );
};

const WritingScoreCard = ({ assessment, prompt, onRetry, onBack }) => {
  const [showImproved, setShowImproved] = useState(false);
  const { scores = {}, suggestions = [], corrections = [], improvedVersion = '', cefrLevel = '', strengths = [], weaknesses = [], submission = '' } = assessment;

  const radarData = [
    { label: 'Grammar', value: scores.grammar || 0 },
    { label: 'Vocabulary', value: scores.vocabulary || 0 },
    { label: 'Coherence', value: scores.coherence || 0 },
    { label: 'Tone', value: scores.tone || 0 },
    { label: 'Creativity', value: scores.creativity || 0 },
    { label: 'Structure', value: scores.sentence_structure || 0 },
  ];

  const overall = scores.overall || 0;
  const ringColor = overall >= 80 ? '#22c55e' : overall >= 60 ? '#f59e0b' : '#ef4444';

  const handleDownload = () => {
    const lines = [
      `Writing Assessment Report`,
      `Prompt: ${prompt?.title || 'Unknown'}`,
      `Date: ${new Date(assessment.createdAt).toLocaleDateString()}`,
      ``,
      `=== SCORES ===`,
      `Overall: ${overall}/100`,
      `Grammar: ${scores.grammar}/100`,
      `Vocabulary: ${scores.vocabulary}/100`,
      `Tone: ${scores.tone}/100`,
      `Coherence: ${scores.coherence}/100`,
      `Verb Tense: ${scores.verb_tense}/100`,
      `Sentence Structure: ${scores.sentence_structure}/100`,
      `Creativity: ${scores.creativity}/100`,
      `CEFR Level: ${cefrLevel}`,
      ``,
      `=== STRENGTHS ===`,
      ...strengths.map(s => `• ${s}`),
      ``,
      `=== AREAS TO IMPROVE ===`,
      ...weaknesses.map(w => `• ${w}`),
      ``,
      `=== SUGGESTIONS ===`,
      ...suggestions.map(s => `• ${s}`),
      ``,
      `=== CORRECTIONS ===`,
      ...corrections.map(c => `[${c.type}] "${c.original}" → "${c.corrected}": ${c.explanation}`),
      ``,
      `=== IMPROVED VERSION ===`,
      improvedVersion,
      ``,
      `=== YOUR SUBMISSION ===`,
      submission,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `writing-report-${Date.now()}.txt`;
    a.click();
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="max-w-3xl mx-auto space-y-6 pb-10"
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Writing Report</h2>
          <p className="text-sm text-gray-500 mt-0.5">{prompt?.title}</p>
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <button onClick={onRetry} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors">
              <RotateCcw className="w-4 h-4" /> Rewrite
            </button>
          )}
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors">
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Overall + radar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <ScoreRing score={overall} size={140} strokeWidth={12} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold" style={{ color: ringColor }}>{overall}</span>
            <span className="text-xs text-gray-400 font-medium">/ 100</span>
            {cefrLevel && (
              <span className="mt-1 text-xs font-bold bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">{cefrLevel}</span>
            )}
          </div>
        </div>
        <div className="flex-1 w-full">
          <LanguageRadarChart data={radarData} color="#10b981" />
        </div>
      </div>

      {/* Score bars */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
        <h3 className="font-semibold text-gray-800 text-sm">Detailed Scores</h3>
        <MetricBar label="Grammar" value={scores.grammar || 0} color="bg-blue-500" />
        <MetricBar label="Vocabulary" value={scores.vocabulary || 0} color="bg-purple-500" />
        <MetricBar label="Tone & Style" value={scores.tone || 0} color="bg-pink-500" />
        <MetricBar label="Coherence" value={scores.coherence || 0} color="bg-cyan-500" />
        <MetricBar label="Verb Tense" value={scores.verb_tense || 0} color="bg-indigo-500" />
        <MetricBar label="Sentence Structure" value={scores.sentence_structure || 0} color="bg-emerald-500" />
        <MetricBar label="Creativity" value={scores.creativity || 0} color="bg-amber-500" />
      </div>

      {/* Strengths & weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-emerald-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-emerald-800 text-sm">What You Did Well</h3>
          </div>
          {strengths.length > 0
            ? <ul className="space-y-1.5">{strengths.map((s, i) => <li key={i} className="text-sm text-emerald-700">• {s}</li>)}</ul>
            : <p className="text-sm text-emerald-600 italic">Keep practising!</p>}
        </div>
        <div className="bg-amber-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-amber-800 text-sm">Focus Areas</h3>
          </div>
          {weaknesses.length > 0
            ? <ul className="space-y-1.5">{weaknesses.map((w, i) => <li key={i} className="text-sm text-amber-700">• {w}</li>)}</ul>
            : <p className="text-sm text-amber-600 italic">Excellent work!</p>}
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-indigo-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-indigo-800 text-sm">How to Improve</h3>
          </div>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-700">
                <span className="font-bold text-indigo-400 shrink-0">{i + 1}.</span> {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Corrections */}
      {corrections.length > 0 && (
        <div className="space-y-3">
          <h3 className="font-semibold text-gray-800 text-sm flex items-center gap-2">
            <PenLine className="w-4 h-4 text-rose-500" /> Corrections
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {corrections.map((c, i) => <CorrectionCard key={i} correction={c} idx={i} />)}
          </div>
        </div>
      )}

      {/* Improved version */}
      {improvedVersion && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowImproved((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" /> AI-Improved Version
            </span>
            {showImproved ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showImproved && (
              <Motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5">
                  <p className="text-sm text-gray-700 leading-relaxed bg-amber-50 rounded-xl p-4 border border-amber-100 whitespace-pre-wrap">
                    {improvedVersion}
                  </p>
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {onBack && (
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Back to prompts
        </button>
      )}
    </Motion.div>
  );
};

export default WritingScoreCard;
