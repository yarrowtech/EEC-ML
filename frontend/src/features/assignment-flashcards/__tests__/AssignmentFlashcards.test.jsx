import { render, screen, fireEvent } from '@testing-library/react';
import AssignmentFlashcards, { FlashcardDeck } from '../AssignmentFlashcards';
const assignment = { _id: 'one', title: 'Fractions', flashcards: [{ front: 'Half', back: '1/2' }, { front: 'Quarter', back: '1/4' }] };
jest.mock('../../../config/api', () => ({ API_BASE: '' }));
test('flip, rate, finish and restart an assignment deck', () => {
  render(<FlashcardDeck assignment={assignment} />);
  expect(screen.getByRole('button', { name: 'I know this' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
  expect(screen.getByText('1/2')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'I know this' }));
  expect(screen.getByText('Quarter')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
  fireEvent.click(screen.getByRole('button', { name: 'Study again' }));
  expect(screen.getByRole('status')).toHaveTextContent('1 known, 1 to study again');
  fireEvent.click(screen.getByRole('button', { name: 'Restart deck' }));
  expect(screen.getByText('Half')).toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
});
test('load failure can be retried and changing assignments resets the deck', async () => {
  global.fetch = jest.fn().mockRejectedValueOnce(new Error('Offline')).mockResolvedValueOnce({ ok: true, json: async () => [assignment, { ...assignment, _id: 'two', title: 'Second deck' }] });
  render(<AssignmentFlashcards />);
  fireEvent.click(await screen.findByRole('button', { name: 'Retry decks' }));
  fireEvent.change(await screen.findByRole('combobox'), { target: { value: 'one' } });
  fireEvent.click(screen.getByRole('button', { name: 'Show answer' }));
  fireEvent.change(screen.getByRole('combobox'), { target: { value: 'two' } });
  expect(screen.getByText('Half')).toBeInTheDocument();
  expect(screen.queryByText('1/2')).not.toBeInTheDocument();
  delete global.fetch;
});
