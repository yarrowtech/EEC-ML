import React, { useEffect, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { XCircle, CheckCircle2, Loader2, Sparkles, ChevronDown, ChevronUp, Brain } from 'lucide-react';
import toast from 'react-hot-toast';
import { Card, CardContent } from './ui/card';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

function ExplanationBlock({ text }) {
  const lines = text.split('\n').filter(Boolean);
  return (
    <div className="mt-3 space-y-1.5 text-sm text-gray-700">
      {lines.map((line, i) => (
        <p key={i} className={line.startsWith('**') ? 'font-semibold text-indigo-800' : ''}>{line.replace(/\*\*/g, '')}</p>
      ))}
    </div>
  );
}

function WrongItem({ item, index }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [explanation, setExplanation] = useState('');

  const fetchExplanation = async () => {
    if (explanation) { setOpen((o) => !o); return; }
    setOpen(true);
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const r = await fetch(`${API_BASE}/api/ai-tutor/exam-explanation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          question: item.question,
          studentAnswer: item.studentAnswer,
          correctAnswer: item.correctAnswer,
          subject: item.subject,
          topicTitle: item.topicTitle,
        }),
      });
      const payload = await r.json();
      if (payload.success) {
        setExplanation(payload.data.content || 'No explanation generated.');
      } else {
        toast.error(payload.error || 'AI explanation failed');
        setOpen(false);
      }
    } catch {
      toast.error('Network error');
      setOpen(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="border-rose-100">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <span className="shrink-0 flex h-6 w-6 items-center justify-center rounded-full bg-rose-100 text-rose-600 text-xs font-bold mt-0.5">
            {index + 1}
          </span>
          <p className="text-gray-800 font-medium text-sm leading-relaxed">{item.question}</p>
        </div>
        <div className="pl-9 space-y-1.5">
          <div className="flex items-center gap-2 text-sm">
            <XCircle className="w-4 h-4 text-rose-500 shrink-0" />
            <span className="text-rose-600">Your answer: <span className="font-medium">{item.studentAnswer || '(no answer)'}</span></span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span className="text-emerald-700">Correct answer: <span className="font-medium">{item.correctAnswer}</span></span>
          </div>
          {item.topicTitle && (
            <span className="inline-block text-xs text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full">{item.topicTitle}</span>
          )}
        </div>

        <button
          onClick={fetchExplanation}
          disabled={loading}
          className="ml-9 flex items-center gap-1.5 text-xs font-semibold text-indigo-600 hover:text-indigo-800 transition-colors"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
          {explanation ? (open ? 'Hide explanation' : 'Show explanation') : 'Explain why with AI'}
          {!loading && (open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />)}
        </button>

        <AnimatePresence>
          {open && explanation && (
            <Motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.22 }}
              className="overflow-hidden"
            >
              <div className="ml-9 mt-1 rounded-xl bg-indigo-50 border border-indigo-100 p-3">
                <p className="text-xs font-bold text-indigo-700 flex items-center gap-1 mb-2">
                  <Brain className="w-3.5 h-3.5" /> AI Explanation
                </p>
                <ExplanationBlock text={explanation} />
              </div>
            </Motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

export default function WrongAnswerReviewView({ examId, examTitle, onClose }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!examId) return;
    const token = localStorage.getItem('token');
    fetch(`${API_BASE}/api/mock-exam/attempt/${examId}/wrong-answers`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.json())
      .then((payload) => {
        if (payload.success) setItems(payload.data || []);
        else toast.error(payload.error || 'Could not load review');
      })
      .catch(() => toast.error('Network error'))
      .finally(() => setLoading(false));
  }, [examId]);

  if (loading) {
    return (
      <div className="flex h-48 items-center justify-center">
        <Loader2 className="w-7 h-7 animate-spin text-indigo-400" />
      </div>
    );
  }

  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="font-black text-gray-900">Wrong Answer Review</h2>
          {examTitle && <p className="text-sm text-gray-500">{examTitle}</p>}
        </div>
        {onClose && (
          <button onClick={onClose} className="text-sm text-gray-400 hover:text-gray-600">Close</button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-emerald-400" />
          <p className="font-semibold text-gray-700">No wrong answers!</p>
          <p className="text-sm text-gray-400">You answered every question correctly.</p>
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">{items.length} incorrect answer{items.length !== 1 ? 's' : ''} — click any to get an AI explanation</p>
          {items.map((item, i) => <WrongItem key={i} item={item} index={i} />)}
        </div>
      )}
    </div>
  );
}
