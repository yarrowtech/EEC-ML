import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { API_BASE } from '../../config/api';

export function FlashcardDeck({ assignment }) {
  const [cards, setCards] = useState(() => assignment.flashcards.map((card, id) => ({ ...card, id })));
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [ratings, setRatings] = useState({});
  const card = cards[index];
  const rated = Object.keys(ratings).length;
  function move(next) { setIndex(next); setFlipped(false); }
  function rate(known) {
    setRatings((previous) => ({ ...previous, [card.id]: known }));
    if (index < cards.length - 1) move(index + 1);
  }
  function shuffle() {
    const next = [...cards];
    for (let i = next.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [next[i], next[j]] = [next[j], next[i]];
    }
    setCards(next); move(0);
  }
  if (!card) return <p>No flashcards in this assignment.</p>;
  return <section aria-label="Flashcard deck" className="space-y-4">
    <h2 className="text-xl font-bold">{assignment.title}</h2>
    <p>Card {index + 1} of {cards.length} · {rated} reviewed</p>
    <button type="button" aria-label={flipped ? 'Show question' : 'Show answer'} aria-pressed={flipped} onClick={() => setFlipped(!flipped)} className="min-h-48 w-full whitespace-pre-wrap break-words rounded-2xl border bg-white p-6 text-left text-lg shadow-sm">
      <span className="mb-3 block text-xs font-semibold uppercase text-violet-700">{flipped ? 'Answer' : 'Question'}</span>
      {flipped ? card.back : card.front}
    </button>
    <p className="text-sm">Select the card or press Enter/Space while focused to flip it. These self-ratings are for this study session, not assignment grades.</p>
    <div className="flex flex-wrap gap-3">
      <button type="button" disabled={index === 0} onClick={() => move(index - 1)}>Previous card</button>
      <button type="button" disabled={!flipped} onClick={() => rate(false)}>Study again</button>
      <button type="button" disabled={!flipped} onClick={() => rate(true)}>I know this</button>
      <button type="button" disabled={index === cards.length - 1} onClick={() => move(index + 1)}>Next card</button>
      <button type="button" onClick={shuffle}>Shuffle cards</button>
      <button type="button" onClick={() => { setRatings({}); move(0); }}>Restart deck</button>
    </div>
    {rated === cards.length && <p role="status">Deck reviewed: {Object.values(ratings).filter(Boolean).length} known, {Object.values(ratings).filter((value) => !value).length} to study again.</p>}
  </section>;
}
FlashcardDeck.propTypes = { assignment: PropTypes.object.isRequired };

export default function AssignmentFlashcards() {
  const [assignments, setAssignments] = useState([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [reload, setReload] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError('');
    fetch(`${API_BASE}/api/assignment/student/assignments`, { signal: controller.signal, headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` } })
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load assignment flashcards');
        if (!Array.isArray(data)) throw new Error('Unable to load assignment flashcards');
        if (!controller.signal.aborted) setAssignments(data.filter((assignment) => assignment.flashcards?.length));
      }).catch((err) => { if (!controller.signal.aborted) setError(err.message); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [reload]);
  const assignment = assignments.find((item) => item._id === selected);
  return <div className="space-y-5 rounded-2xl border bg-white/70 p-5">
    <h1 className="text-2xl font-bold">Assignment flashcards</h1>
    {loading ? <p role="status">Loading decks…</p> : error ? <div><p role="alert">{error}</p><button onClick={() => setReload((value) => value + 1)}>Retry decks</button></div> : <>
      {assignments.length === 0 ? <p>Your teachers haven’t published assignment flashcards yet.</p> : <label className="block">Assignment
        <select className="ml-3 max-w-full rounded border p-2" value={selected} onChange={(event) => setSelected(event.target.value)}><option value="">Choose an assignment</option>
          {assignments.map((item) => <option key={item._id} value={item._id}>{item.subject} — {item.title}</option>)}
        </select>
      </label>}
      {assignment && <FlashcardDeck key={assignment._id} assignment={assignment} />}
    </>}
  </div>;
}
