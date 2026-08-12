import React, { useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TutorMessageContent } from './TutorMessageContent';

export function parseQuiz(text) {
  const questions = [];
  const lines = (text || '').split('\n');
  let current = null;
  for (const line of lines) {
    const t = line.trim();
    const qMatch = t.match(/^\d+[.)]\s+(.+)/);
    const optMatch = t.match(/^([A-D])[.)]\s+(.+)/);
    const ansMatch = t.match(/^[*_]*Answer[*_]*:\s*\*?([A-D])\*?/i);
    if (qMatch) {
      if (current) questions.push(current);
      current = { question: qMatch[1], options: {}, answer: null };
    } else if (optMatch && current) {
      current.options[optMatch[1]] = optMatch[2];
    } else if (ansMatch && current) {
      current.answer = ansMatch[1].toUpperCase();
    }
  }
  if (current) questions.push(current);
  return questions.filter(q => Object.keys(q.options).length >= 2);
}

export function QuizUI({ text, onMisconception, onQuizComplete, subject, topic }) {
  const questions = useMemo(() => parseQuiz(text), [text]);
  const [idx, setIdx] = useState(0);
  const [picks, setPicks] = useState({});
  const [shown, setShown] = useState({});
  const [done, setDone] = useState(false);

  const finishQuiz = () => {
    setDone(true);
    if (onQuizComplete && (subject || topic)) {
      const correct = questions.filter((q, i) => picks[i] === q.answer).length;
      const pct = Math.round((correct / questions.length) * 100);
      onQuizComplete(pct, subject, topic);
    }
  };

  if (!questions.length) return <TutorMessageContent text={text} />;

  if (done) {
    const correct = questions.filter((q, i) => picks[i] === q.answer).length;
    const emoji = correct === questions.length ? '🎉' : correct >= Math.ceil(questions.length / 2) ? '👍' : '📚';
    return (
      <Motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="rounded-2xl border border-violet-100 bg-gradient-to-br from-violet-50 to-purple-50 p-6 text-center"
      >
        <p className="text-4xl mb-1">{emoji}</p>
        <p className="text-3xl font-extrabold text-violet-800">{correct}/{questions.length}</p>
        <p className="text-sm text-violet-600 mt-1">Questions correct</p>
        <button
          onClick={() => { setIdx(0); setPicks({}); setShown({}); setDone(false); }}
          className="mt-4 rounded-xl bg-violet-500 px-5 py-2 text-sm font-semibold text-white hover:bg-violet-600 transition-colors"
        >
          Try Again
        </button>
      </Motion.div>
    );
  }

  const q = questions[idx];
  const picked = picks[idx];
  const isShown = shown[idx];
  const isCorrect = picked === q.answer;

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between text-xs">
        <span className="font-bold text-violet-500">Q {idx + 1}/{questions.length}</span>
        <div className="flex gap-1">
          {questions.map((q2, i) => (
            <div
              key={i}
              className={cn('h-1.5 rounded-full transition-all duration-300',
                i < idx
                  ? (picks[i] === questions[i].answer ? 'w-6 bg-emerald-400' : 'w-6 bg-rose-300')
                  : i === idx ? 'w-6 bg-violet-500' : 'w-4 bg-slate-200'
              )}
            />
          ))}
        </div>
      </div>

      <AnimatePresence mode="wait">
        <Motion.div
          key={idx}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="rounded-xl border border-violet-100 bg-violet-50/70 p-4"
        >
          <p className="text-sm font-semibold leading-relaxed text-slate-800">{q.question}</p>
        </Motion.div>
      </AnimatePresence>

      <div className="space-y-2">
        {Object.entries(q.options).map(([letter, optText]) => {
          const isPicked = picked === letter;
          const isAnswer = letter === q.answer;
          let cls = 'border-slate-200 bg-white hover:border-violet-200 hover:bg-violet-50/50';
          if (isShown) {
            if (isAnswer) cls = 'border-emerald-300 bg-emerald-50';
            else if (isPicked) cls = 'border-rose-300 bg-rose-50';
          } else if (isPicked) {
            cls = 'border-violet-400 bg-violet-50 shadow-sm';
          }
          return (
            <Motion.button
              key={letter}
              whileHover={!isShown ? { scale: 1.01 } : {}}
              whileTap={!isShown ? { scale: 0.99 } : {}}
              disabled={isShown}
              onClick={() => !isShown && setPicks(p => ({ ...p, [idx]: letter }))}
              className={cn('flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors', cls)}
            >
              <span className={cn('flex size-6 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
                isShown && isAnswer ? 'bg-emerald-500 text-white' :
                isShown && isPicked ? 'bg-rose-400 text-white' :
                isPicked ? 'bg-violet-500 text-white' : 'bg-slate-100 text-slate-500'
              )}>{letter}</span>
              <span className="flex-1 text-sm text-slate-700">{optText}</span>
              {isShown && isAnswer && <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />}
            </Motion.button>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-1">
        {!isShown ? (
          <button
            disabled={!picked}
            onClick={() => setShown(s => ({ ...s, [idx]: true }))}
            className="rounded-xl bg-violet-500 px-4 py-1.5 text-xs font-semibold text-white hover:bg-violet-600 disabled:opacity-40 transition-colors"
          >
            Check Answer
          </button>
        ) : (
          <>
            <span className={cn('flex-1 rounded-xl px-3 py-1.5 text-xs font-semibold',
              isCorrect ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            )}>
              {isCorrect ? '✓ Correct!' : `✗ Answer: ${q.answer}`}
            </span>
            {!isCorrect && onMisconception && (
              <button
                onClick={() => onMisconception(q.question, picked, q.answer)}
                className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-700 hover:bg-rose-100 transition-colors"
              >
                Explain my mistake
              </button>
            )}
            <button
              onClick={() => idx < questions.length - 1 ? setIdx(i => i + 1) : finishQuiz()}
              className="rounded-xl bg-slate-800 px-4 py-1.5 text-xs font-semibold text-white hover:bg-slate-900 transition-colors"
            >
              {idx < questions.length - 1 ? 'Next →' : 'Finish'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default QuizUI;
