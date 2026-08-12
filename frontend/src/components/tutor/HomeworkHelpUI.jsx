import React, { useMemo } from 'react';
import { motion as Motion } from 'framer-motion';
import { Lightbulb } from 'lucide-react';
import { TutorMessageContent } from './TutorMessageContent';

export function parseHomeworkHelp(text) {
  if (!text) return { content: '', question: null, tail: '' };
  const trimmed = text.trim();
  const lastQ = trimmed.lastIndexOf('?');
  if (lastQ === -1) return { content: trimmed, question: null, tail: '' };

  const before = trimmed.slice(0, lastQ);
  const startCandidates = [
    before.lastIndexOf('. ') + 2,
    before.lastIndexOf('!\n') + 2,
    before.lastIndexOf('?\n') + 2,
    before.lastIndexOf('\n\n') + 2,
    0,
  ];
  const sentenceStart = Math.max(...startCandidates);
  return {
    content: trimmed.slice(0, sentenceStart).trim(),
    question: trimmed.slice(sentenceStart, lastQ + 1).trim(),
    tail: trimmed.slice(lastQ + 1).trim(),
  };
}

export function HomeworkHelpUI({ text }) {
  const { content, question, tail } = useMemo(() => parseHomeworkHelp(text), [text]);

  if (!question) return <TutorMessageContent text={text} />;

  return (
    <Motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      className="w-full overflow-hidden rounded-2xl rounded-bl-sm border border-[#eedbc9] bg-white shadow-sm"
    >
      <div className="flex items-center gap-2 border-b border-[#F4E9DE] bg-[#FBF7F2] px-4 py-2">
        <span className="flex size-6 items-center justify-center rounded-lg bg-[#F4E9DE] text-[13px]">🦉</span>
        <p className="text-[11px] font-bold uppercase tracking-wide text-[#C07A4C]">Homework coach</p>
        <p className="ml-auto hidden text-[11px] text-[#a3aaa2] sm:block">I guide — you solve</p>
      </div>

      <div className="space-y-3 px-4 py-3.5">
        {content && (
          <Motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.12 }}
            className="text-[13px] leading-relaxed text-slate-600"
          >
            <TutorMessageContent text={content} />
          </Motion.div>
        )}

        <Motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 22, delay: content ? 0.25 : 0.1 }}
          className="rounded-xl border-l-[3px] border-[#C07A4C] bg-[#F4E9DE]/60 px-3.5 py-3"
        >
          <span className="mb-1 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-[#C07A4C]">
            <Lightbulb className="size-3" /> Your turn
          </span>
          <p className="font-[Nunito] text-[15px] font-bold leading-relaxed text-[#26332E]">{question}</p>
        </Motion.div>

        <Motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: content ? 0.45 : 0.25 }}
          className="flex items-center gap-1.5 text-[11px] font-medium text-[#C07A4C]"
        >
          <span className="flex gap-1">
            {[0, 0.18, 0.36].map((delay) => (
              <Motion.span
                key={delay}
                animate={{ y: [0, -3, 0] }}
                transition={{ duration: 0.8, repeat: Infinity, repeatDelay: 1.4, delay }}
                className="size-1.5 rounded-full bg-[#dcb18e]"
              />
            ))}
          </span>
          {tail || 'Type your answer below to keep going'}
        </Motion.div>
      </div>
    </Motion.div>
  );
}

export default HomeworkHelpUI;
