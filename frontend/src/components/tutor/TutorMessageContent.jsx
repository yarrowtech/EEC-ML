/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React from 'react';

import MermaidBlock from './MermaidBlock';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;
// Fenced block: ``` optionally followed by a language token and trailing spaces,
// then a newline, then anything up to the next ```. Tolerant of ```mermaid,
// ``` mermaid, ```Mermaid, and a bare ``` with no language.
const FENCE_PATTERN = /```[ \t]*([a-zA-Z-]*)[ \t]*\r?\n([\s\S]*?)```/g;
const MERMAID_HEADER = /^\s*(flowchart|graph|sequencediagram|classdiagram|statediagram|erdiagram|journey|gantt|pie|mindmap|timeline|quadrantchart|gitgraph|c4context|block-beta|xychart-beta)\b/i;

/**
 * Split a tutor message into ordered plain-text and fenced-code segments so a
 * ```mermaid block anywhere in any answer renders as a diagram inline. A fenced
 * block with no language but a Mermaid-looking first line is treated as a diagram.
 */
const splitFencedSegments = (text) => {
  const source = String(text || '').replace(/\r\n/g, '\n');
  const segments = [];
  let cursor = 0;
  let match;

  FENCE_PATTERN.lastIndex = 0;
  while ((match = FENCE_PATTERN.exec(source)) !== null) {
    if (match.index > cursor) {
      segments.push({ type: 'text', content: source.slice(cursor, match.index) });
    }
    const lang = (match[1] || '').toLowerCase();
    const content = match[2].replace(/\s+$/, '');
    const isMermaid = lang === 'mermaid' || (!lang && MERMAID_HEADER.test(content));
    segments.push({ type: isMermaid ? 'mermaid' : 'code', content });
    cursor = match.index + match[0].length;
  }
  if (cursor < source.length) {
    segments.push({ type: 'text', content: source.slice(cursor) });
  }
  return segments.filter((s) => s.type !== 'text' || s.content.trim());
};

export const renderInlineTutorText = (text, keyPrefix) => {
  const parts = String(text || '').split(URL_PATTERN);

  return parts.flatMap((part, index) => {
    if (!part) return [];

    if (part.startsWith('http://') || part.startsWith('https://')) {
      const [, url, trailing = ''] = part.match(/^(.*?)([),.;:!?]*)$/) || [];
      return [
        <a
          key={`${keyPrefix}-url-${index}`}
          href={url || part}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-sky-700 underline decoration-sky-300 underline-offset-2 break-all hover:text-sky-900"
        >
          {url || part}
        </a>,
        trailing ? <React.Fragment key={`${keyPrefix}-trail-${index}`}>{trailing}</React.Fragment> : null,
      ].filter(Boolean);
    }

    return part.split(/(\$[^$\n]+\$|\*\*[^*]+\*\*)/g).filter(Boolean).map((segment, segmentIndex) => {
      if (segment.startsWith('**') && segment.endsWith('**')) {
        return <strong key={`${keyPrefix}-b-${index}-${segmentIndex}`}>{segment.slice(2, -2)}</strong>;
      }
      if (segment.startsWith('$') && segment.endsWith('$')) {
        return (
          <code
            key={`${keyPrefix}-math-${index}-${segmentIndex}`}
            className="mx-0.5 inline-block max-w-full overflow-x-auto rounded bg-sky-50 px-1.5 py-0.5 font-mono text-[0.95em] text-sky-950 align-middle"
          >
            {segment.slice(1, -1)}
          </code>
        );
      }
      return <React.Fragment key={`${keyPrefix}-t-${index}-${segmentIndex}`}>{segment}</React.Fragment>;
    });
  });
};

const TutorTextLines = ({ text }) => {
  const lines = String(text || '').replace(/\r\n/g, '\n').split('\n');

  return (
    <div className="min-w-0 max-w-full space-y-1.5 break-words overflow-hidden text-sm leading-relaxed">
      {lines.map((line, index) => {
        const raw = line || '';
        const trimmed = raw.trim();
        const indent = Math.min(3, Math.floor((raw.match(/^\s*/)?.[0]?.length || 0) / 2));

        if (!trimmed) {
          return <div key={`blank-${index}`} className="h-1.5" />;
        }

        const blockMathMatch = trimmed.match(/^\$\$(.+)\$\$$/);
        if (blockMathMatch) {
          return (
            <div key={`math-${index}`} className="max-w-full overflow-x-auto rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
              <code className="block w-max min-w-full whitespace-pre font-mono text-sm text-sky-950">
                {blockMathMatch[1].trim()}
              </code>
            </div>
          );
        }

        const headingMatch = trimmed.match(/^\*\*(.+)\*\*$/);
        if (headingMatch) {
          return (
            <div key={`heading-${index}`} className="pt-1 text-[15px] font-semibold text-slate-900">
              {headingMatch[1]}
            </div>
          );
        }

        const numberedMatch = trimmed.match(/^(\d+)\.\s+(.*)$/);
        if (numberedMatch) {
          return (
            <div key={`numbered-${index}`} className="grid grid-cols-[auto_1fr] gap-2 pt-1">
              <span className="font-semibold text-sky-700">{numberedMatch[1]}.</span>
              <span>{renderInlineTutorText(numberedMatch[2], `numbered-${index}`)}</span>
            </div>
          );
        }

        const optionMatch = trimmed.match(/^([A-D])\)\s+(.*)$/);
        if (optionMatch) {
          return (
            <div key={`option-${index}`} className="grid grid-cols-[auto_1fr] gap-2 pl-4">
              <span className="font-semibold text-slate-600">{optionMatch[1]})</span>
              <span>{renderInlineTutorText(optionMatch[2], `option-${index}`)}</span>
            </div>
          );
        }

        const answerMatch = trimmed.match(/^Answer:\s*(.*)$/i);
        if (answerMatch) {
          return (
            <div key={`answer-${index}`} className="mt-1 rounded-lg border border-emerald-200 bg-emerald-50 px-2.5 py-1.5 font-medium text-emerald-800">
              Answer: {renderInlineTutorText(answerMatch[1], `answer-${index}`)}
            </div>
          );
        }

        const bulletMatch = trimmed.match(/^[-*+]\s+(.*)$/);
        if (bulletMatch) {
          return (
            <div key={`bullet-${index}`} className="grid grid-cols-[auto_1fr] gap-2" style={{ paddingLeft: `${indent * 14}px` }}>
              <span className="mt-2 size-1.5 rounded-full bg-sky-400" />
              <span>{renderInlineTutorText(bulletMatch[1], `bullet-${index}`)}</span>
            </div>
          );
        }

        return (
          <div key={`line-${index}`} style={{ paddingLeft: `${indent * 14}px` }}>
            {renderInlineTutorText(trimmed, `line-${index}`)}
          </div>
        );
      })}
    </div>
  );
};

export const TutorMessageContent = ({ text }) => {
  const segments = splitFencedSegments(text);

  if (!segments.some((s) => s.type !== 'text')) {
    return <TutorTextLines text={text} />;
  }

  return (
    <div className="min-w-0 max-w-full space-y-2">
      {segments.map((segment, index) => {
        if (segment.type === 'mermaid') {
          return <MermaidBlock key={`mermaid-${index}`} code={segment.content} />;
        }
        if (segment.type === 'code') {
          return (
            <pre
              key={`code-${index}`}
              className="max-w-full overflow-x-auto rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700"
            >
              {segment.content}
            </pre>
          );
        }
        return <TutorTextLines key={`text-${index}`} text={segment.content} />;
      })}
    </div>
  );
};

export default TutorMessageContent;
