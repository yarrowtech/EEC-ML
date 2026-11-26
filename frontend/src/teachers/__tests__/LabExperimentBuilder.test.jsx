/* global jest, describe, test, expect */
import React, { useState } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import LabExperimentBuilder from '../components/lesson-plan-builder/LabExperimentBuilder';

const Harness = ({ onSave }) => {
  const [list, setList] = useState([]);
  return <LabExperimentBuilder experiments={list} onChange={(l) => { setList(l); onSave(l); }} />;
};

describe('LabExperimentBuilder (lesson plan → Practical)', () => {
  test('adds the Seed Germination template and edits it', () => {
    const save = jest.fn();
    render(<Harness onSave={save} />);
    expect(screen.getByText(/No experiments in this chapter yet/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Seed Germination/ }));
    const saved = save.mock.calls.at(-1)[0];
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ kind: 'germination', title: 'How Does a Seed Germinate?' });
    expect(saved[0].jars).toHaveLength(4);
    expect(saved[0].questions).toHaveLength(5);
    expect(screen.getByText('Ready for students')).toBeInTheDocument();

    fireEvent.change(screen.getByRole('textbox', { name: 'Experiment title' }), { target: { value: 'Seed germination lab' } });
    expect(save.mock.calls.at(-1)[0][0].title).toBe('Seed germination lab');

    // jar outcome follows its conditions
    expect(screen.getByText('No germination')).toBeInTheDocument();
    expect(screen.getByText('Poor germination')).toBeInTheDocument();
  });

  test('a blank experiment is not ready until it has a title and a stage', () => {
    const save = jest.fn();
    render(<Harness onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: /Blank step-by-step/ }));
    expect(screen.getByText(/Add a title and at least one stage/)).toBeInTheDocument();
    fireEvent.change(screen.getByRole('textbox', { name: 'Experiment title' }), { target: { value: 'Magnets' } });
    fireEvent.change(screen.getByRole('textbox', { name: 'Stage 1 title' }), { target: { value: 'Bring the magnet close' } });
    expect(screen.getByText('Ready for students')).toBeInTheDocument();
  });
});
