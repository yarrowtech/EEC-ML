import React from 'react';
import PropTypes from 'prop-types';
export default function AssessmentExplanation({ assessment, mode }) {
  const evaluation = assessment.rawEvaluation || assessment;
  return <section aria-label="Score explanation" className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-sm space-y-2">
    <h3 className="font-semibold">About these scores</h3>
    <p>These are AI-generated practice scores, not a teacher-assigned grade. Use the detailed feedback and original response together when reviewing them.</p>
    {mode === 'reading' ? <p>Reading scores describe pronunciation, fluency, grammar and delivery. Reading speed is measured in words per minute; other scores use a 0–100 scale. Recording quality can affect the transcript and pronunciation feedback.</p> : <p>Writing scores use a 0–100 scale for grammar, vocabulary, tone, coherence, verb tense, sentence structure and creativity. Corrections explain suggested edits; the improved version is an example, not your submitted work.</p>}
    {(evaluation.needsReview || evaluation.needs_review) && <p role="status" className="font-semibold">This result needs teacher review.</p>}
    <p>Ask your teacher about a score or correction that does not match your work.</p>
  </section>;
}
AssessmentExplanation.propTypes = { assessment: PropTypes.object.isRequired, mode: PropTypes.oneOf(['reading', 'writing']).isRequired };
