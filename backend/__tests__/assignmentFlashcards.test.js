const { normalizeFlashcards } = require('../utils/assignmentFlashcards');
test('optional decks normalize question/answer text', () => {
  expect(normalizeFlashcards()).toEqual([]);
  expect(normalizeFlashcards([{ front: ' Half ', back: ' 1/2 ' }])).toEqual([{ front: 'Half', back: '1/2' }]);
});
test('rejects incomplete, malformed and oversized decks', () => {
  for (const value of [null, {}, [{ front: 'Half', back: '' }], Array(101).fill({ front: 'x', back: 'y' }), [{ front: 'x'.repeat(2001), back: 'y' }]]) expect(() => normalizeFlashcards(value)).toThrow();
});
