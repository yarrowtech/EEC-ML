import React from 'react';
import { render, screen } from '@testing-library/react';

import { TutorMessageContent } from '../TutorMessageContent';


describe('TutorMessageContent STEM notation', () => {
  it('renders inline notation as safe code text', () => {
    render(<TutorMessageContent text="Newton's law is $F = ma$." />);
    const formula = screen.getByText('F = ma');
    expect(formula.tagName).toBe('CODE');
  });

  it('contains long block notation in a horizontally scrollable box', () => {
    render(<TutorMessageContent text="$$E = mc^2 + a_very_long_expression$$" />);
    const formula = screen.getByText('E = mc^2 + a_very_long_expression');
    expect(formula.parentElement).toHaveClass('overflow-x-auto');
  });
});
