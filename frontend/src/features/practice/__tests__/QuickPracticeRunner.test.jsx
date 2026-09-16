import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import QuickPracticeRunner from '../../../components/QuickPracticeRunner';
const response = (data, ok = true) => ({ ok, json: async () => data });
afterEach(() => { delete global.fetch; });
test('true/false answers persist and show server results, then reset for retry', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response({ questions: [{ id: 'q1', type: 'true_false', question: 'The sun is a planet.', options: ['True', 'False'] }] }))
    .mockResolvedValueOnce(response({ results: [{ questionId: 'q1', isCorrect: true, correctAnswer: 'False', explanation: 'It is a star.' }] }));
  render(<QuickPracticeRunner subject={{ id: 'subject', name: 'Science' }} initialType="true_false" onBack={() => {}} />);
  fireEvent.click(await screen.findByRole('button', { name: /B False/ }));
  fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
  await screen.findByText('Score 100%');
  expect(JSON.parse(global.fetch.mock.calls[1][1].body).answers).toEqual([{ questionId: 'q1', answer: 'False' }]);
  expect(screen.getByText('It is a star.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(screen.getByRole('button', { name: 'Submit answers' })).toBeDisabled();
});
test('matching requires all pairs and retains answers on save failure', async () => {
  global.fetch = jest.fn().mockResolvedValueOnce(response({ questions: [{ id: 'q1', type: 'matching', question: 'Match objects', matchingLeft: ['Sun', 'Earth'], options: ['Planet', 'Star'] }] }))
    .mockResolvedValueOnce(response({ error: 'Save failed' }, false))
    .mockResolvedValueOnce(response({ results: [{ questionId: 'q1', isCorrect: false, correctAnswer: '["Star","Planet"]' }] }));
  render(<QuickPracticeRunner subject={{ id: 'subject' }} initialType="matching" onBack={() => {}} />);
  fireEvent.change(await screen.findByLabelText('Match Sun'), { target: { value: 'Planet' } });
  expect(screen.getByRole('button', { name: 'Submit answers' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Match Earth'), { target: { value: 'Star' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Save failed');
  expect(screen.getByLabelText('Match Sun')).toHaveValue('Planet');
  fireEvent.click(screen.getByRole('button', { name: 'Submit answers' }));
  await screen.findByText('Score 0%');
  expect(screen.getByText(/Sun → Star; Earth → Planet/)).toBeInTheDocument();
  await waitFor(() => expect(JSON.parse(global.fetch.mock.calls[2][1].body).answers[0].answer).toBe('["Planet","Star"]'));
});
