import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { motion as Motion, AnimatePresence } from 'framer-motion';
import { ChevronLeft, ChevronRight, RotateCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TutorMessageContent } from './TutorMessageContent';

const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/+$/, '');

const cardSlide = {
  enter: (dir) => ({ x: dir * 240, opacity: 0, rotate: dir * 3 }),
  center: { x: 0, opacity: 1, rotate: 0 },
  exit: (dir) => ({ x: dir * -240, opacity: 0, rotate: dir * -3 }),
};

export function parseFlashcards(text) {
  const cards = [];
  let q = null, a = null;
  const push = () => {
    if (q !== null && a !== null) cards.push({ q: q.trim(), a: a.trim() });
    q = null; a = null;
  };
  for (const raw of (text || '').split('\n')) {
    const t = raw.trim()
      .replace(/\*\*/g, '')
      .replace(/^[-*>•]\s*/, '')
      .replace(/^(?:card\s*)?\d+\s*[:.)-]\s*/i, '');
    if (!t) continue;
    const qMatch = t.match(/^(?:q(?:uestion)?|front)\s*\d*\s*[:.)\-–]\s*(.+)/i);
    const aMatch = t.match(/^(?:a(?:nswer)?|back)\s*\d*\s*[:.)\-–]\s*(.+)/i);
    if (qMatch) {
      push();
      q = qMatch[1]; a = null;
    } else if (aMatch && q !== null) {
      a = a === null ? aMatch[1] : `${a} ${aMatch[1]}`;
    } else if (a !== null) {
      a += ` ${t}`;
    } else if (q !== null) {
      q += ` ${t}`;
    }
  }
  push();
  return cards;
}

export function FlashcardUI({ text, subject, topic }) {
  const cards = useMemo(() => parseFlashcards(text), [text]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [dir, setDir] = useState(0);
  const [known, setKnown] = useState({});

  const goTo = useCallback((next) => {
    setIdx((current) => {
      const clamped = Math.max(0, Math.min(cards.length - 1, next));
      if (clamped !== current) {
        setDir(clamped > current ? 1 : -1);
        setFlipped(false);
      }
      return clamped;
    });
  }, [cards.length]);

  useEffect(() => {
    if (!cards.length) return;
    const onKey = (e) => {
      const el = e.target;
      if (el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable)) return;
      if (e.key === 'ArrowRight') goTo(idx + 1);
      else if (e.key === 'ArrowLeft') goTo(idx - 1);
      else if (e.key === ' ') { e.preventDefault(); setFlipped((f) => !f); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [idx, cards.length, goTo]);

  if (!cards.length) return <TutorMessageContent text={text} />;

  const card = cards[idx];
  const knownCount = Object.values(known).filter(Boolean).length;
  const rateCard = (gotIt) => {
    setKnown((k) => ({ ...k, [idx]: gotIt }));
    goTo(idx + 1);
    const token = localStorage.getItem('token');
    if (token && topic) {
      fetch(`${API_BASE}/api/student-dashboard/flashcard-result`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ topicId: topic, topicTitle: topic, subject: subject || '', result: gotIt ? 'got_it' : 'still_learning' }),
      }).catch(() => {});
    }
  };

  return (
    <div className="w-full space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-[#F59E0B]">Card {idx + 1} / {cards.length}</span>
        <span className="text-[11px] font-medium text-[#78827B]">
          <span className="font-bold text-[#F59E0B]">{knownCount}</span> / {cards.length} known
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {cards.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i)}
            aria-label={`Go to card ${i + 1}`}
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              i === idx ? 'w-8 bg-[#F59E0B]' : known[i] ? 'w-5 bg-[#8fbcae]' : 'w-4 bg-[#E7E3D9]'
            )}
          />
        ))}
      </div>

      <div className="relative h-56 select-none" style={{ perspective: '1400px' }}>
        {idx < cards.length - 1 && (
          <div className="absolute inset-x-3 bottom-0 top-2 rotate-[1.6deg] rounded-2xl border border-[#E7E3D9] bg-[#FBF9F4]" />
        )}
        {idx < cards.length - 2 && (
          <div className="absolute inset-x-5 bottom-0 top-4 -rotate-[1.2deg] rounded-2xl border border-[#E7E3D9] bg-[#F4F1EA]" />
        )}

        <AnimatePresence initial={false} custom={dir} mode="popLayout">
          <Motion.div
            key={idx}
            custom={dir}
            variants={cardSlide}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.26, ease: 'easeOut' }}
            drag={cards.length > 1 ? 'x' : false}
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.55}
            onDragEnd={(_, info) => {
              if (info.offset.x < -70 || info.velocity.x < -450) goTo(idx + 1);
              else if (info.offset.x > 70 || info.velocity.x > 450) goTo(idx - 1);
            }}
            onTap={() => setFlipped((f) => !f)}
            whileDrag={{ scale: 1.02 }}
            className="absolute inset-0 cursor-pointer"
          >
            <Motion.div
              animate={{ rotateY: flipped ? 180 : 0 }}
              transition={{ duration: 0.5, ease: [0.4, 0, 0.2, 1] }}
              style={{ transformStyle: 'preserve-3d', position: 'relative', width: '100%', height: '100%' }}
            >
              <div
                style={{ backfaceVisibility: 'hidden', position: 'absolute', inset: 0 }}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-[#E7E3D9] bg-white p-6 text-center shadow-[0_10px_30px_-18px_rgba(38,51,46,0.45)]"
              >
                <span className="rounded-full bg-[#FEF3C7] px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#F59E0B]">
                  Question
                </span>
                <p className="font-[Nunito] text-base font-bold leading-relaxed text-[#26332E]">{card.q}</p>
                <p className="mt-1 flex items-center gap-1.5 text-[11px] text-[#a3aaa2]">
                  <RotateCw className="size-3" />
                  <span>Tap to flip · swipe to browse</span>
                </p>
              </div>

              <div
                style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', position: 'absolute', inset: 0 }}
                className="flex flex-col items-center justify-center gap-3 rounded-2xl bg-[#F59E0B] p-6 text-center shadow-[0_10px_30px_-18px_rgba(38,51,46,0.6)]"
              >
                <span className="rounded-full bg-white/15 px-3 py-0.5 text-[10px] font-bold uppercase tracking-widest text-[#FDE9BD]">
                  Answer
                </span>
                <p className="font-[Nunito] text-base font-bold leading-relaxed text-white">{card.a}</p>
                <p className="mt-1 text-[11px] text-white/50">Tap to see the question again</p>
              </div>
            </Motion.div>
          </Motion.div>
        </AnimatePresence>
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => goTo(idx - 1)}
          disabled={idx === 0}
          aria-label="Previous card"
          className="flex items-center gap-1 rounded-xl border border-[#E7E3D9] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c655f] transition-colors hover:bg-[#FEF3C7] disabled:opacity-40"
        >
          <ChevronLeft className="size-3.5" /> Prev
        </button>

        <AnimatePresence mode="wait">
          {flipped ? (
            <Motion.div
              key="rating"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="flex flex-1 gap-2"
            >
              <button
                onClick={() => rateCard(false)}
                className="flex-1 rounded-xl border border-[#eedbc9] bg-[#F4E9DE] py-1.5 text-xs font-bold text-[#C07A4C] transition-colors hover:bg-[#eeddcb]"
              >
                ✗ Still learning
              </button>
              <button
                onClick={() => rateCard(true)}
                className="flex-1 rounded-xl border border-[#FDE68A] bg-[#FEF3C7] py-1.5 text-xs font-bold text-[#B45309] transition-colors hover:bg-[#FDE9BD]"
              >
                ✓ Got it!
              </button>
            </Motion.div>
          ) : (
            <Motion.div key="spacer" className="flex-1" />
          )}
        </AnimatePresence>

        <button
          onClick={() => goTo(idx + 1)}
          disabled={idx === cards.length - 1}
          aria-label="Next card"
          className="flex items-center gap-1 rounded-xl border border-[#E7E3D9] bg-white px-3 py-1.5 text-xs font-semibold text-[#5c655f] transition-colors hover:bg-[#FEF3C7] disabled:opacity-40"
        >
          Next <ChevronRight className="size-3.5" />
        </button>
      </div>

      <p className="text-center text-[10px] text-[#a3aaa2]">← → to navigate · Space or tap to flip · drag the card to swipe</p>
    </div>
  );
}

export default FlashcardUI;
