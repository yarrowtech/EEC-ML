import React from 'react';
import { render, screen } from '@testing-library/react';
import TutorGeneratedVisuals from '../TutorGeneratedVisuals';


test('renders responsive angle-turn diagrams from a safe visual spec', () => {
  render(<TutorGeneratedVisuals visuals={[{
    id: 'angle-turns',
    type: 'angle_turns',
    title: 'Angles as turns',
    caption: 'Follow each turn.',
    items: [
      { label: 'Quarter turn', degrees: 90, angle_name: 'Right angle' },
      { label: 'Half turn', degrees: 180, angle_name: 'Straight angle' },
    ],
  }]} />);

  expect(screen.getByText('Angles as turns')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Quarter turn: 90 degrees' })).toBeInTheDocument();
  expect(screen.getAllByText('Right angle')).toHaveLength(2);
  expect(screen.getByRole('img', { name: 'Half turn: 180 degrees' })).toBeInTheDocument();
  expect(screen.getByText('Part of a full turn')).toBeInTheDocument();
  expect(screen.getByText('1/2')).toBeInTheDocument();
});
