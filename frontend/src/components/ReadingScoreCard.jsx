import React, { useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import {
  Mic, Zap, BookOpen, Target, Wind, Shield,
  TrendingUp, AlertTriangle, ChevronDown, ChevronUp,
  Download, RotateCcw, CheckCircle2, XCircle,
} from 'lucide-react';
import LanguageRadarChart from './LanguageRadarChart';

const ScoreRing = ({ score, size = 120, strokeWidth = 10, color }) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const ringColor = color || (score >= 80 ? '#22c55e' : score >= 60 ? '#f59e0b' : '#ef4444');

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={strokeWidth} />
      <Motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={ringColor}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.4, ease: 'easeOut' }}
      />
    </svg>
  );
};

const MetricCard = ({ icon: Icon, label, value, color, sub }) => (
  <Motion.div
    initial={{ opacity: 0, y: 12 }}
    animate={{ opacity: 1, y: 0 }}
    className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 flex items-center gap-3"
  >
    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
      <Icon className="w-5 h-5" />
    </div>
    <div className="min-w-0">
      <p className="text-xs text-gray-500 font-medium">{label}</p>
      <p className="text-lg font-bold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400">{sub}</p>}
    </div>
  </Motion.div>
);

const TagList = ({ items, color, emptyText }) => {
  if (!items || items.length === 0) {
    return <p className="text-sm text-gray-400 italic">{emptyText || 'None'}</p>;
  }
  return (
    <div className="flex flex-wrap gap-2">
      {items.map((w, i) => (
        <span key={i} className={`text-xs px-2.5 py-1 rounded-full font-medium ${color}`}>
          {w}
        </span>
      ))}
    </div>
  );
};

// Render the reference passage with per-word colour coding from wav2vec2 scores
const PassageHighlight = ({ passageText, wordScores = [] }) => {
  if (!wordScores.length) return (
    <p className="text-sm leading-8 text-slate-700 font-serif">{passageText}</p>
  );

  // Build lookup: clean word → best score seen (a word may appear multiple times)
  const scoreMap = {};
  wordScores.forEach(({ word, score, heard }) => {
    const key = word.toLowerCase();
    if (scoreMap[key] === undefined || score < scoreMap[key].score) {
      scoreMap[key] = { score, heard };
    }
  });

  const passageWords = passageText.split(/(\s+)/);

  return (
    <p className="text-sm leading-9 font-serif text-slate-700">
      {passageWords.map((token, i) => {
        if (/^\s+$/.test(token)) return token;
        const clean = token.replace(/[.,!?;:'"()\-–]/g, '').toLowerCase();
        const entry = scoreMap[clean];
        if (!entry) return <span key={i}>{token}</span>;
        const { score, heard } = entry;
        const color = score >= 80
          ? 'bg-emerald-100 text-emerald-800'
          : score >= 62
          ? 'bg-amber-100 text-amber-800'
          : 'bg-red-100 text-red-800 underline decoration-wavy decoration-red-400';
        const tip = score >= 80
          ? `✓ "${clean}" — ${score}%`
          : `✗ Said "${heard || '?'}" — ${score}%`;
        return (
          <span
            key={i}
            className={`rounded px-0.5 cursor-default transition-colors ${color}`}
            title={tip}
          >
            {token}
          </span>
        );
      })}
    </p>
  );
};

const ReadingScoreCard = ({ assessment, material, onRetry, onBack }) => {
  const [showTranscript, setShowTranscript] = useState(false);
  const [showPassage, setShowPassage] = useState(false);
  const { scores = {}, mispronounced_words = [], missed_words = [], suggestions = [], strengths = [], weaknesses = [], transcript = '' } = assessment;
  const wordScores = assessment._computed?.word_scores || assessment.rawEvaluation?._computed?.word_scores || [];

  const radarData = [
    { label: 'Pronunciation', value: scores.pronunciation || 0 },
    { label: 'Grammar', value: scores.grammar || 0 },
    { label: 'Fluency', value: scores.fluency || 0 },
    { label: 'Confidence', value: scores.confidence || 0 },
    { label: 'Accent', value: scores.accent || 0 },
  ];

  const overallScore = scores.overall || 0;
  const ringColor = overallScore >= 80 ? '#22c55e' : overallScore >= 60 ? '#f59e0b' : '#ef4444';

  const handleDownload = () => {
    const lines = [
      `Reading Assessment Report`,
      `Material: ${material?.title || 'Unknown'}`,
      `Date: ${new Date(assessment.createdAt).toLocaleDateString()}`,
      ``,
      `=== SCORES ===`,
      `Overall: ${overallScore}/100`,
      `Pronunciation: ${scores.pronunciation}/100`,
      `Grammar: ${scores.grammar}/100`,
      `Fluency: ${scores.fluency}/100`,
      `Confidence: ${scores.confidence}/100`,
      `Accent: ${scores.accent}/100`,
      `Reading Speed: ${scores.reading_speed} WPM`,
      ``,
      `=== STRENGTHS ===`,
      ...strengths.map(s => `• ${s}`),
      ``,
      `=== AREAS FOR IMPROVEMENT ===`,
      ...weaknesses.map(w => `• ${w}`),
      ``,
      `=== SUGGESTIONS ===`,
      ...suggestions.map(s => `• ${s}`),
      ``,
      `=== MISPRONOUNCED WORDS ===`,
      mispronounced_words.join(', ') || 'None',
      ``,
      `=== MISSED WORDS ===`,
      missed_words.join(', ') || 'None',
      ``,
      `=== TRANSCRIPT ===`,
      transcript,
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `reading-report-${Date.now()}.txt`;
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
          <h2 className="text-2xl font-bold text-gray-900">Reading Report</h2>
          <p className="text-sm text-gray-500 mt-0.5">{material?.title}</p>
        </div>
        <div className="flex gap-2">
          {onRetry && (
            <button onClick={onRetry} className="flex items-center gap-1.5 px-4 py-2 rounded-xl border border-gray-200 text-sm font-medium hover:bg-gray-50 transition-colors">
              <RotateCcw className="w-4 h-4" /> Try Again
            </button>
          )}
          <button onClick={handleDownload} className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition-colors">
            <Download className="w-4 h-4" /> Download
          </button>
        </div>
      </div>

      {/* Overall score + radar */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col sm:flex-row items-center gap-6">
        <div className="relative flex-shrink-0 flex items-center justify-center">
          <ScoreRing score={overallScore} size={140} strokeWidth={12} color={ringColor} />
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-extrabold" style={{ color: ringColor }}>{overallScore}</span>
            <span className="text-xs text-gray-400 font-medium">/ 100</span>
            <span className="text-xs text-gray-500 mt-1">Overall</span>
          </div>
        </div>
        <div className="flex-1 w-full">
          <LanguageRadarChart data={radarData} color="#6366f1" />
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <MetricCard icon={Mic} label="Pronunciation" value={`${scores.pronunciation || 0}/100`} color="bg-purple-50 text-purple-600" />
        <MetricCard icon={BookOpen} label="Grammar" value={`${scores.grammar || 0}/100`} color="bg-blue-50 text-blue-600" />
        <MetricCard icon={Wind} label="Fluency" value={`${scores.fluency || 0}/100`} color="bg-cyan-50 text-cyan-600" />
        <MetricCard icon={Shield} label="Confidence" value={`${scores.confidence || 0}/100`} color="bg-emerald-50 text-emerald-600" />
        <MetricCard icon={Target} label="Accent" value={`${scores.accent || 0}/100`} color="bg-amber-50 text-amber-600" />
        <MetricCard icon={Zap} label="Speed" value={`${scores.reading_speed || 0}`} sub="words / min" color="bg-rose-50 text-rose-600" />
      </div>

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-emerald-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <h3 className="font-semibold text-emerald-800 text-sm">Strengths</h3>
          </div>
          {strengths.length > 0
            ? <ul className="space-y-1.5">{strengths.map((s, i) => <li key={i} className="text-sm text-emerald-700">• {s}</li>)}</ul>
            : <p className="text-sm text-emerald-600 italic">Keep practising!</p>}
        </div>
        <div className="bg-amber-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-amber-600" />
            <h3 className="font-semibold text-amber-800 text-sm">Areas to Improve</h3>
          </div>
          {weaknesses.length > 0
            ? <ul className="space-y-1.5">{weaknesses.map((w, i) => <li key={i} className="text-sm text-amber-700">• {w}</li>)}</ul>
            : <p className="text-sm text-amber-600 italic">Great job!</p>}
        </div>
      </div>

      {/* Suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-indigo-50 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-indigo-600" />
            <h3 className="font-semibold text-indigo-800 text-sm">Practice Suggestions</h3>
          </div>
          <ul className="space-y-2">
            {suggestions.map((s, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-indigo-700">
                <span className="font-bold text-indigo-400 shrink-0">{i + 1}.</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Mispronounced / Missed words */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Mispronounced Words</p>
          <TagList items={mispronounced_words} color="bg-red-100 text-red-700" emptyText="None — great pronunciation!" />
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Missed Words</p>
          <TagList items={missed_words} color="bg-orange-100 text-orange-700" emptyText="None — you read everything!" />
        </div>
      </div>

      {/* Passage with per-word pronunciation colour coding */}
      {material?.content && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowPassage((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span className="flex items-center gap-2">
              Word-by-word pronunciation
              <span className="flex items-center gap-1 text-[11px] font-normal text-gray-400">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block" /> correct
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400 inline-block ml-1" /> needs work
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 inline-block ml-1" /> mispronounced
              </span>
            </span>
            {showPassage ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showPassage && (
              <Motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5">
                  {wordScores.length > 0 ? (
                    <>
                      <p className="text-[11px] text-gray-400 mb-3">Hover over any word to see what was heard and the score.</p>
                      <PassageHighlight passageText={material.content} wordScores={wordScores} />
                    </>
                  ) : (
                    <p className="text-sm text-gray-500 italic">Word-level scores not available for this attempt.</p>
                  )}
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Transcript toggle */}
      {transcript && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <button
            onClick={() => setShowTranscript((v) => !v)}
            className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            <span>Your Transcript</span>
            {showTranscript ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <AnimatePresence>
            {showTranscript && (
              <Motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="px-5 pb-5">
                  <p className="text-sm text-gray-600 leading-relaxed bg-gray-50 rounded-xl p-4">{transcript}</p>
                </div>
              </Motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Model accuracy debug panel — shows computed ground-truth vs LLM scores */}
      {assessment._computed && (
        <details className="rounded-xl border border-slate-200 bg-slate-50 text-xs">
          <summary className="cursor-pointer px-4 py-2 font-semibold text-slate-500 select-none hover:text-slate-700">
            Model accuracy breakdown
          </summary>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1 px-4 pb-3 pt-1 font-mono text-slate-600">
            {[
              ['Word accuracy (computed)', `${assessment._computed.word_accuracy_pct}%`],
              ['LLM pronunciation score', `${assessment.scores?.pronunciation ?? '—'}/100`],
              ['Acoustic pronunciation', `${assessment._computed.acoustic_pronunciation}/100`],
              ['Whisper avg confidence', assessment._computed.whisper_confidence_avg != null ? `${assessment._computed.whisper_confidence_avg}%` : '—'],
              ['Reading speed', `${assessment._computed.reading_speed_wpm} WPM`],
              ['Words in transcript', assessment._computed.words_in_transcript],
              ['Words in reference', assessment._computed.words_in_reference],
              ['Missed words', assessment._computed.missed_word_count],
              ['Mispronounced', assessment._computed.mispronounced_count],
            ].map(([label, val]) => (
              <React.Fragment key={label}>
                <span className="text-slate-400">{label}</span>
                <span className="font-semibold">{val}</span>
              </React.Fragment>
            ))}
          </div>
        </details>
      )}

      {onBack && (
        <button onClick={onBack} className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
          ← Back to materials
        </button>
      )}
    </Motion.div>
  );
};

export default ReadingScoreCard;
