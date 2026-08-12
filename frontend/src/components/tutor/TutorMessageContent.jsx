/**
 * Copyright (c) 2026 HouseofMusa and YarrowTech
 * All rights reserved. Unauthorized copying, modification, distribution,
 * or duplication is prohibited without prior written permission.
 */

import React from 'react';

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

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

export const TutorMessageContent = ({ text }) => {
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

export default TutorMessageContent;
