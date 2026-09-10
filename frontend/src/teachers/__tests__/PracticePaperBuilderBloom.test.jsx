/* global jest, describe, beforeEach, test, expect, global */
import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import PracticePaperBuilder from '../components/PracticePaperBuilder';

jest.mock('react-hot-toast', () => ({
  __esModule: true,
  default: { error: jest.fn(), success: jest.fn() },
}));

const jsonResponse = (data, ok = true) => Promise.resolve({ ok, json: () => Promise.resolve(data) });

describe('PracticePaperBuilder — AI question generator Bloom level', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'teacher-token');
    global.fetch = jest.fn((url) => {
      if (String(url).includes('/api/practice-sections/teacher')) {
        return jsonResponse({ sections: [] });
      }
      return jsonResponse({
        success: true,
        data: {
          questions: [{
            questionText: 'Why does the pattern break at n=5?',
            options: [
              { text: 'Because the base case fails', isCorrect: true },
              { text: 'Because n is odd', isCorrect: false },
              { text: 'Because n is even', isCorrect: false },
              { text: 'Because n is prime', isCorrect: false },
            ],
            explanation: 'The base case only holds for n<5.',
            difficulty: 'hard',
            bloomLevel: 'analyse',
          }],
        },
      });
    });
  });

  test('defaults to "Mixed" and sends the chosen Bloom level with the generation request', async () => {
    render(<PracticePaperBuilder classId="class-1" sectionId="section-1" />);

    expect(screen.getByTitle("Bloom's Taxonomy level")).toHaveValue('');

    fireEvent.change(screen.getByPlaceholderText('Subject (e.g. Mathematics)'), { target: { value: 'Mathematics' } });
    fireEvent.change(screen.getByPlaceholderText('Topic (e.g. Fractions)'), { target: { value: 'Induction' } });
    fireEvent.change(screen.getByTitle("Bloom's Taxonomy level"), { target: { value: 'analyse' } });
    fireEvent.click(screen.getByText('Generate 5 Questions'));

    await waitFor(() => expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/ai-teacher/quiz-generate'),
      expect.objectContaining({
        body: expect.stringContaining('"bloomLevel":"analyse"'),
      })
    ));

    await waitFor(() => expect(screen.getByText(/Questions \(2\)/)).toBeInTheDocument());
  });
});
