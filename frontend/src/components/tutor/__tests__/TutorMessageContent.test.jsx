import React from 'react';
import { render, screen } from '@testing-library/react';

import { TutorMessageContent } from '../TutorMessageContent';


describe('TutorMessageContent STEM notation', () => {
  it('typesets valid inline notation with KaTeX', () => {
    const { container } = render(<TutorMessageContent text="Newton's law is $F = ma$." />);
    expect(container.querySelector('.katex')).not.toBeNull();
  });

  it('typesets valid block notation with KaTeX inside a horizontally scrollable box', () => {
    const { container } = render(<TutorMessageContent text="$$E = mc^2$$" />);
    const box = container.querySelector('.overflow-x-auto');
    expect(box).not.toBeNull();
    expect(box.querySelector('.katex')).not.toBeNull();
  });

  it('falls back to plain code text when the expression is not valid LaTeX', () => {
    render(<TutorMessageContent text="Set is $\unknownmacrofoo$ here." />);
    const formula = screen.getByText('\\unknownmacrofoo');
    expect(formula.tagName).toBe('CODE');
  });
});
