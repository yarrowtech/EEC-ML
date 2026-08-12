/* eslint-disable react/prop-types */
import React, { useState } from 'react';
import { Check, RefreshCw, ThumbsDown, ThumbsUp } from 'lucide-react';

const ADJUSTMENTS = [
  { label: 'Make it simpler', text: 'Explain that again using simpler words and shorter steps', chip: "Explain Like I'm 10" },
  { label: 'Show more detail', text: 'Explain this in more detail and verify each step', chip: 'Custom Chat' },
  { label: 'Use a visual', text: 'Explain this with a clear visual walkthrough', chip: 'Visual Explain' },
];

export default function TutorAnswerActions({ onRetry, onAdjust }) {
  const [rating, setRating] = useState('');

  return (
    <div className="mt-3 border-t border-[#F1EEE7] pt-2.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="mr-1 text-[11px] font-semibold text-[#8D968F]">Did this help?</span>
        <button
          type="button"
          onClick={() => setRating('helpful')}
          aria-pressed={rating === 'helpful'}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${rating === 'helpful' ? 'bg-emerald-100 text-emerald-700' : 'text-[#78827B] hover:bg-emerald-50 hover:text-emerald-700'}`}
        >
          {rating === 'helpful' ? <Check className="size-3" /> : <ThumbsUp className="size-3" />} Helpful
        </button>
        <button
          type="button"
          onClick={() => setRating('adjust')}
          aria-pressed={rating === 'adjust'}
          className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-colors ${rating === 'adjust' ? 'bg-amber-100 text-amber-800' : 'text-[#78827B] hover:bg-amber-50 hover:text-amber-800'}`}
        >
          <ThumbsDown className="size-3" /> Adjust
        </button>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-[11px] font-semibold text-[#78827B] transition-colors hover:bg-[#FEF3C7] hover:text-[#B45309]"
          >
            <RefreshCw className="size-3" /> Try again
          </button>
        )}
      </div>
      {rating === 'adjust' && (
        <div className="mt-2 flex flex-wrap gap-1.5" aria-label="Adjust the tutor answer">
          {ADJUSTMENTS.map((adjustment) => (
            <button
              type="button"
              key={adjustment.label}
              onClick={() => onAdjust(adjustment)}
              className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-900 hover:border-amber-400 hover:bg-amber-100"
            >
              {adjustment.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
