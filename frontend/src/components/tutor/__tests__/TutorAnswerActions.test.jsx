/* global jest, test, expect */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TutorAnswerActions from '../TutorAnswerActions';

test('lets a student rate, retry, and request a specific answer adjustment', () => {
  const onRetry = jest.fn();
  const onAdjust = jest.fn();
  render(<TutorAnswerActions onRetry={onRetry} onAdjust={onAdjust} />);

  fireEvent.click(screen.getByRole('button', { name: 'Helpful' }));
  expect(screen.getByRole('button', { name: 'Helpful' })).toHaveAttribute('aria-pressed', 'true');

  fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
  expect(onRetry).toHaveBeenCalledTimes(1);

  fireEvent.click(screen.getByRole('button', { name: 'Adjust' }));
  fireEvent.click(screen.getByRole('button', { name: 'Use a visual' }));
  expect(onAdjust).toHaveBeenCalledWith(expect.objectContaining({ chip: 'Visual Explain' }));
});
