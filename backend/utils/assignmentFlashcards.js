function normalizeFlashcards(cards = []) {
  if (!Array.isArray(cards) || cards.length > 100) throw new Error('Provide at most 100 flashcards');
  return cards.map((card) => {
    if (!card || typeof card.front !== 'string' || typeof card.back !== 'string'
      || !card.front.trim() || !card.back.trim() || card.front.length > 2000 || card.back.length > 2000) {
      throw new Error('Each flashcard needs a question and answer of 1–2000 characters');
    }
    return { front: card.front.trim(), back: card.back.trim() };
  });
}
module.exports = { normalizeFlashcards };
