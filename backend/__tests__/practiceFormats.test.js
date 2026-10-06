const { normalizeQuestion, gradeAnswer } = require('../utils/practiceFormats');

test('true/false accepts false and stores a canonical answer', () => {
  const question = { type: 'true_false', ...normalizeQuestion({ type: 'true_false', correctAnswer: false }) };
  expect(question.options).toEqual(['True', 'False']);
  expect(question.correctAnswer).toBe('False');
  expect(gradeAnswer(question, 'false')).toBe(true);
  expect(gradeAnswer(question, 'True')).toBe(false);
  expect(() => gradeAnswer(question, '')).toThrow();
});
test('matching separates choices from the answer key and scores every pair', () => {
  const question = { type: 'matching', ...normalizeQuestion({ type: 'matching', matchingLeft: ['Sun', 'Earth'], correctAnswer: '["Star","Planet"]' }) };
  expect(question.options).toEqual(['Planet', 'Star']);
  expect(gradeAnswer(question, '["Star","Planet"]')).toBe(true);
  expect(gradeAnswer(question, '["Planet","Star"]')).toBe(false);
  for (const answer of ['[]', '["Star","Star"]', '["Star","Unknown"]', 'broken']) expect(() => gradeAnswer(question, answer)).toThrow();
});
test('matching rejects ambiguous keys or incomplete pairs', () => {
  expect(() => normalizeQuestion({ type: 'matching', matchingLeft: ['A', 'B'], correctAnswer: '["Same","Same"]' })).toThrow();
  expect(() => normalizeQuestion({ type: 'matching', matchingLeft: ['A', ''], correctAnswer: '["One","Two"]' })).toThrow();
});
test('existing MCQ and blank scoring is preserved', () => {
  expect(gradeAnswer({ type: 'blank', correctAnswer: 'Earth' }, ' earth ')).toBe(true);
  expect(gradeAnswer({ type: 'mcq', correctAnswer: 'Earth' }, 'Mars')).toBe(false);
});
