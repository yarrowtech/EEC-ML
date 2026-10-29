import React from 'react';
import PropTypes from 'prop-types';
export default function FlashcardEditor({ cards = [], onChange }) {
  return <fieldset className="space-y-3 rounded-xl border p-4">
    <legend className="font-semibold">Assignment flashcards (optional)</legend>
    <p className="text-sm">Add question and answer cards for students to study with this assignment.</p>
    {cards.map((card, index) => <div key={index} className="space-y-2 rounded border p-3">
      {['front', 'back'].map((side) => <label key={side} className="block text-sm">Card {index + 1} {side === 'front' ? 'question' : 'answer'}
        <textarea required maxLength={2000} className="block w-full rounded border p-2" value={card[side]} onChange={(event) => onChange(cards.map((item, i) => i === index ? { ...item, [side]: event.target.value } : item))} />
      </label>)}
      <button type="button" onClick={() => onChange(cards.filter((_, i) => i !== index))}>Remove card {index + 1}</button>
    </div>)}
    <button type="button" disabled={cards.length >= 100} className="rounded border px-3 py-2" onClick={() => onChange([...cards, { front: '', back: '' }])}>Add flashcard</button>
  </fieldset>;
}
FlashcardEditor.propTypes = { cards: PropTypes.array, onChange: PropTypes.func.isRequired };
