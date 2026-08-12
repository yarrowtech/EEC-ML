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


test('renders an exact different-sized chocolate fraction comparison', () => {
  render(<TutorGeneratedVisuals visuals={[{
    id: 'fraction-different-wholes',
    type: 'fraction_wholes',
    title: 'Fractions of different-sized wholes',
    caption: 'Compare equal blocks.',
    items: [
      { label: 'Smaller chocolate', rows: 2, columns: 2, numerator: 1, denominator: 2, highlighted_blocks: 2, color: '#f59e0b' },
      { label: 'Larger chocolate', rows: 3, columns: 3, numerator: 1, denominator: 3, highlighted_blocks: 3, color: '#7c3aed' },
    ],
    comparison: 'In this picture, 2 equal blocks < 3 equal blocks.',
    rule: 'Compare actual amounts when wholes differ.',
    source_activity_note: 'The source grids are blank activities.',
  }]} />);

  expect(screen.getByRole('img', { name: 'Smaller chocolate: 2 of 4 equal blocks highlighted' })).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Larger chocolate: 3 of 9 equal blocks highlighted' })).toBeInTheDocument();
  expect(screen.getByText(/2 equal blocks < 3 equal blocks/)).toBeInTheDocument();
  expect(screen.getByText(/Compare actual amounts/)).toBeInTheDocument();
});


test('renders verified groups, printed totals, and swap arithmetic', () => {
  render(<TutorGeneratedVisuals visuals={[{
    id: 'making-sums-equal',
    type: 'balance_swaps',
    title: 'Making sums equal',
    caption: 'Totals are not swappable numbers.',
    rule: 'A one-pair swap must transfer half the gap.',
    problems: [{
      label: 'a',
      left: [1, 2, 7, 9],
      right: [3, 4, 5, 9],
      left_total: 19,
      right_total: 21,
      gap: 2,
      required_transfer: 1,
      example_swaps: [[2, 3]],
      minimum_moves: 1,
    }],
  }]} />);

  expect(screen.getByText('Problem (a)')).toBeInTheDocument();
  expect(screen.getByText('= 19')).toBeInTheDocument();
  expect(screen.getByText('= 21')).toBeInTheDocument();
  expect(screen.getAllByText('printed total')).toHaveLength(2);
  expect(screen.getByText(/Verified example: 2 ↔ 3/)).toBeInTheDocument();
  expect(screen.getByText(/Minimum 1 move/)).toBeInTheDocument();
});
