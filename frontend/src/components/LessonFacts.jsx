import React from 'react';
import { Lightbulb, Monitor, Orbit, Rocket, Settings, Sparkles, Timer } from 'lucide-react';

/*
 * Shared lesson-content pieces used by BOTH the student topic reader and the
 * teacher's chapter preview, so the teacher sees exactly what students see.
 */

// "Did You Know?" fact cards — colour cycles orange → blue → purple → green.
export const FACT_THEMES = [
  { card: 'border-[#FBE2B0] bg-[#FFF8EA]', pill: 'bg-gradient-to-b from-[#FFB23E] to-[#F7871E]', title: 'bg-[#FDEBC2]', divider: 'bg-[#F6D9A2]', icon: 'text-[#F7A21E]', Icon: Sparkles },
  { card: 'border-[#CFE4FB] bg-[#EEF6FF]', pill: 'bg-gradient-to-b from-[#3D9BF5] to-[#1E6FE0]', title: 'bg-[#D9E9FC]', divider: 'bg-[#C3DAF5]', icon: 'text-[#5AA7F2]', Icon: Settings },
  { card: 'border-[#E2D7FA] bg-[#F5F0FF]', pill: 'bg-gradient-to-b from-[#9B5CF6] to-[#7C3AED]', title: 'bg-[#E9DFFC]', divider: 'bg-[#DCCDF7]', icon: 'text-[#A78BFA]', Icon: Timer },
  { card: 'border-[#CBEFD8] bg-[#EEFBF3]', pill: 'bg-gradient-to-b from-[#2FCB6B] to-[#16A34A]', title: 'bg-[#D4F3E0]', divider: 'bg-[#BFE8CF]', icon: 'text-[#4ADE80]', Icon: Orbit },
];

// "Title: description" / "Title – description" → bold title + text.
// A colon wins over a dash; a web link's "https:" is never treated as a title.
export const splitFact = (text) => {
  const t = String(text || '').trim();
  const m = t.match(/^([^:]{3,90}):(?!\/\/)\s*(.+)$/) || t.match(/^(.{3,80}?)\s[–—-]\s(.+)$/);
  if (m && !/https?$/i.test(m[1])) return { title: m[1].trim(), body: m[2].trim() };
  return { title: '', body: t };
};

export const DidYouKnowHeader = ({ scale = 1 }) => (
  <div className="relative flex items-center justify-center pb-5 pt-2">
    <Monitor aria-hidden="true" className="absolute left-0 top-1 hidden size-9 -rotate-6 text-sky-400 sm:block" strokeWidth={1.75} />
    <Rocket aria-hidden="true" className="absolute right-0 top-0 hidden size-9 rotate-12 text-rose-400 sm:block" strokeWidth={1.75} />
    <div className="flex items-center gap-3 rounded-full bg-white px-5 py-2 shadow-[0_6px_24px_-8px_rgba(73,62,229,0.35)] ring-1 ring-[#eef0ff]">
      <span className="flex size-10 items-center justify-center rounded-full bg-amber-100">
        <Lightbulb className="size-6 text-amber-500" fill="#fde68a" />
      </span>
      <h2 className="relative font-extrabold tracking-tight text-[#0d1c2e]" style={{ fontSize: `${26 * scale}px` }}>
        Did You <span className="text-[#8B5CF6]">Know?</span>
        <span aria-hidden="true" className="absolute -bottom-1 left-1/4 h-1.5 w-2/3 rounded-full bg-[#F5C518]" />
      </h2>
    </div>
  </div>
);

export const FactCard = ({ n, text, scale = 1 }) => {
  const theme = FACT_THEMES[(n - 1) % FACT_THEMES.length];
  const { title, body } = splitFact(text);
  return (
    <div className={`relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 shadow-sm sm:gap-4 sm:p-4 ${theme.card}`}>
      <span className={`shrink-0 rounded-full px-3.5 py-1.5 font-extrabold text-white shadow-md ${theme.pill}`} style={{ fontSize: `${15 * scale}px` }}>
        Fact {n}
      </span>
      <span aria-hidden="true" className={`w-0.5 self-stretch rounded-full ${theme.divider}`} />
      <div className="min-w-0 flex-1 pr-6">
        {title && (
          <p className={`mb-1 inline-block rounded-full px-3 py-0.5 font-extrabold text-[#0d1c2e] ${theme.title}`} style={{ fontSize: `${15.5 * scale}px` }}>
            {title}
          </p>
        )}
        <p className="leading-[1.6] text-[#1e293b]" style={{ fontSize: `${14 * scale}px` }}>{body}</p>
      </div>
      <theme.Icon aria-hidden="true" className={`absolute right-3 top-1/2 size-7 -translate-y-1/2 opacity-80 ${theme.icon}`} />
    </div>
  );
};

// Removes anything unsafe from rich text before showing it (scripts, embeds,
// inline event handlers, javascript: links). Formatting and images stay.
const BLOCKED_TAGS = 'script,style,iframe,object,embed,form,input,button,textarea,select,link,meta';
export const sanitizeRichHtml = (html) => {
  if (!html || typeof DOMParser === 'undefined') return '';
  const doc = new DOMParser().parseFromString(String(html), 'text/html');
  doc.querySelectorAll(BLOCKED_TAGS).forEach((el) => el.remove());
  doc.body.querySelectorAll('*').forEach((el) => {
    Array.from(el.attributes).forEach((attr) => {
      const name = attr.name.toLowerCase();
      const value = String(attr.value || '').trim().toLowerCase();
      if (name.startsWith('on') || ((name === 'href' || name === 'src') && value.startsWith('javascript:'))) el.removeAttribute(attr.name);
    });
    if (el.tagName === 'A') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener noreferrer'); }
  });
  return doc.body.innerHTML;
};

// "Did You Know?" is a list of facts. Older chapters stored one rich-text
// blob; split that into facts (list items / paragraphs / lines).
export const getDidYouKnowFacts = (chapter = {}) => {
  if (Array.isArray(chapter.didYouKnowFacts)) return chapter.didYouKnowFacts;
  const raw = String(chapter.didYouKnow || '');
  if (!raw.trim()) return [];
  const parts = /<li[\s>]/i.test(raw)
    ? raw.split(/<\/li>/i)
    : raw.split(/<\/p>|<br\s*\/?>|\n/i);
  return parts
    .map((p) => p.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean);
};
