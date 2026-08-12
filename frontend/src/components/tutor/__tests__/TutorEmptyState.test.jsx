/* global jest, test, expect */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import TutorEmptyState from '../TutorEmptyState';

const baseProps = {
  studentName: 'Asha',
  subjects: [{ key: 'math', title: 'Mathematics' }],
  topics: [{ type: 'Chapter', title: 'Fractions' }],
  starters: [{ mode: 'Visual Explain', text: 'Show me the diagram' }],
  onChooseSubject: jest.fn(),
  onChooseTopic: jest.fn(),
  onChooseStarter: jest.fn(),
};

test('guides the student through subject, topic, and learning-action steps', () => {
  const { rerender } = render(<TutorEmptyState {...baseProps} />);

  expect(screen.getByText('What would you like to learn, Asha?')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Mathematics/ }));
  expect(baseProps.onChooseSubject).toHaveBeenCalledWith('math');

  rerender(<TutorEmptyState {...baseProps} selectedSubject={baseProps.subjects[0]} />);
  expect(screen.getByText('Choose a chapter in Mathematics')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Fractions/ }));
  expect(baseProps.onChooseTopic).toHaveBeenCalledWith('Fractions');

  rerender(<TutorEmptyState {...baseProps} selectedSubject={baseProps.subjects[0]} selectedTopic="Fractions" />);
  expect(screen.getByText('Ready for Fractions')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: /Show me the diagram/ }));
  expect(baseProps.onChooseStarter).toHaveBeenCalledWith(baseProps.starters[0]);
});
