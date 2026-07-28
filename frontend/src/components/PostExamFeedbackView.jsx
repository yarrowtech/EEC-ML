import React, { useEffect, useState } from 'react';
import { motion as Motion } from 'framer-motion';
import { Sparkles, Loader2, TrendingUp, AlertCircle, ChevronRight, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent } from './ui/card';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const SECTION_META = {
  'What you did well': { icon: '🌟', color: 'emerald' },
  'Where to improve':  { icon: '📈', color: 'amber' },
  'Your next step':    { icon: '🎯', color: 'indigo' },
  'Keep going!':       { icon: '🚀', color: 'violet' },
};

function parseFeedback(text) {
  const sections = [];
  let current = null;
  for (const line of text.split('\n')) {
    const heading = line.replace(/^#+\s*/, '').replace(/\*\*/g, '').trim();
    const isHeading = Object.keys(SECTION_META).some((k) => heading === k);
    if (isHeading) {
      if (current) sections.push(current);
      current = { title: heading, lines: [] };
    } else if (current && line.trim()) {
      current.lines.push(line.replace(/\*\*/g, '').replace(/^-\s*/, '').trim());
    }
  }
  if (current) sections.push(current);
  return sections.length ? sections : [{ title: 'Feedback', lines: text.split('\n').filter(Boolean) }];
}

function FeedbackSection({ section, delay }) {
  const meta = SECTION_META[section.title] || { icon: '💡', color: 'gray' };
  const colorMap = {
    emerald: 'bg-emerald-50 border-emerald-200',
    amber:   'bg-amber-50 border-amber-200',
    indigo:  'bg-indigo-50 border-indigo-200',
    violet:  'bg-violet-50 border-violet-200',
    gray:    'bg-gray-50 border-gray-200',
  };
  const titleMap = {
    emerald: 'text-emerald-800',
    amber:   'text-amber-800',
    indigo:  'text-indigo-800',
    violet:  'text-violet-800',
    gray:    'text-gray-800',
  };

  return (
    <Motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
    >
      <Card className={`border ${colorMap[meta.color]}`}>
        <CardContent className="p-4 space-y-2">
          <p className={`font-bold text-sm flex items-center gap-1.5 ${titleMap[meta.color]}`}>
            <span>{meta.icon}</span> {section.title}
          </p>
          <ul className="space-y-1">
            {section.lines.map((line, i) => (
              <li key={i} className="flex items-start gap-2 text-sm text-gray-700">
                <ChevronRight className="w-3.5 h-3.5 mt-0.5 shrink-0 text-gray-400" />
                {line}
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </Motion.div>
  );
}

export default function PostExamFeedbackView({ subject, marksScored, totalMarks, examTitle, onClose }) {
  const [loading, setLoading] = useState(true);
  const [sections, setSections] = useState([]);
  const [pct, setPct] = useState(0);

  const fetchFeedback = async () => {
    setLoading(true);
    setSections([]);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_BASE}/api/ai-tutor/exam-feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ subject, marksScored, totalMarks, examTitle }),
      });
      const payload = await r.json();
      if (payload.success) {
        setPct(payload.data.percentage);
        setSections(parseFeedback(payload.data.content || ''));
      } else {
        toast.error(payload.error || 'AI feedback failed');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchFeedback(); }, [subject, marksScored, totalMarks, examTitle]);

  const tierColor = pct >= 80 ? 'text-emerald-600' : pct >= 40 ? 'text-amber-600' : 'text-rose-600';

  return (
    <div className="space-y-5 p-4 sm:p-6">
      <div className="flex items-start justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <h2 className="font-black text-gray-900">AI Post-Exam Feedback</h2>
          </div>
          <p className="text-sm text-gray-500 mt-0.5">{examTitle || subject}</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchFeedback} disabled={loading}
            className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
          {onClose && (
            <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">Close</button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3 rounded-2xl bg-gray-50 border border-gray-100 p-4">
        <div className={`text-4xl font-black ${tierColor}`}>{pct || Math.round((marksScored / totalMarks) * 100)}%</div>
        <div>
          <p className="text-sm text-gray-500">{examTitle || subject}</p>
          <p className="text-xs text-gray-400">{marksScored} / {totalMarks} marks</p>
        </div>
      </div>

      {loading ? (
        <div className="flex flex-col items-center gap-3 py-10">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-400" />
          <p className="text-sm text-gray-400">Generating personalised feedback…</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sections.map((s, i) => <FeedbackSection key={i} section={s} delay={i * 0.1} />)}
        </div>
      )}
    </div>
  );
}
