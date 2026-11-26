/* global jest, describe, test, expect */
import React, { useState } from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import LabExperimentBuilder from '../components/lesson-plan-builder/LabExperimentBuilder';
import VirtualLabPlayer from '../../components/virtualLab/VirtualLabPlayer';
import {
  SIMULATION_CATALOG, isAllowedSimUrl, toEmbeddableSimUrl, experimentFromSimulation,
} from '../../utils/simulationCatalog';
import { isExperimentReady, newLabId } from '../../utils/virtualLab';

describe('simulation catalogue', () => {
  test('every entry is an https PhET link with board, class, subject and chapter', () => {
    expect(SIMULATION_CATALOG.length).toBeGreaterThan(40);
    SIMULATION_CATALOG.forEach((s) => {
      expect(isAllowedSimUrl(s.url)).toBe(true);
      expect(s.boards).toEqual(expect.arrayContaining(['CBSE']));
      expect(s.className).toMatch(/^\d+$/);
      expect(s.subject && s.chapter && s.title).toBeTruthy();
    });
  });

  test('only approved hosts can be embedded', () => {
    expect(isAllowedSimUrl('https://phet.colorado.edu/sims/html/density/latest/density_all.html')).toBe(true);
    expect(isAllowedSimUrl('http://phet.colorado.edu/sims/html/density/latest/density_all.html')).toBe(false);
    expect(isAllowedSimUrl('https://evil.example.com/phet.colorado.edu')).toBe(false);
    expect(isAllowedSimUrl('javascript:alert(1)')).toBe(false);
  });

  test('a pasted PhET page link becomes the embeddable simulation', () => {
    expect(toEmbeddableSimUrl('https://phet.colorado.edu/en/simulations/friction')).toBe('https://phet.colorado.edu/sims/html/friction/latest/friction_all.html');
    expect(toEmbeddableSimUrl('https://youtube.com/watch?v=1')).toBe('');
  });

  test('imported simulation is ready for students', () => {
    const exp = experimentFromSimulation(SIMULATION_CATALOG[0], newLabId);
    expect(exp.kind).toBe('embed');
    expect(isExperimentReady(exp)).toBe(true);
    expect(isExperimentReady({ ...exp, simUrl: 'https://bad.example.com/x' })).toBe(false);
  });
});

const Harness = ({ onSave }) => {
  const [list, setList] = useState([]);
  return <LabExperimentBuilder experiments={list} onChange={(l) => { setList(l); onSave(l); }} classLabel="Class 8" subjectName="Science" />;
};

describe('teacher: import from simulation library', () => {
  test('filters by board / class / subject and imports with one click', () => {
    const save = jest.fn();
    render(<Harness onSave={save} />);
    fireEvent.click(screen.getByRole('button', { name: /Import from simulation library/ }));
    const dialog = screen.getByRole('dialog', { name: 'Simulation library' });

    // starts on the chapter's class + subject
    expect(within(dialog).getByRole('combobox', { name: 'Class' })).toHaveValue('8');
    expect(within(dialog).getByRole('combobox', { name: 'Subject' })).toHaveValue('Science');
    expect(within(dialog).getByText('Friction')).toBeInTheDocument();
    expect(within(dialog).queryByText('Molarity')).not.toBeInTheDocument(); // class 12

    fireEvent.click(within(dialog).getByRole('button', { name: 'Import Friction' }));
    const saved = save.mock.calls.at(-1)[0];
    expect(saved[0]).toMatchObject({ kind: 'embed', title: 'Friction', provider: 'phet' });
    expect(saved[0].simUrl).toBe('https://phet.colorado.edu/sims/html/friction/latest/friction_all.html');
    expect(saved[0].source).toMatchObject({ className: '8', subject: 'Science', chapter: 'Friction' });
    expect(within(dialog).getByRole('button', { name: 'Import Friction' })).toBeDisabled(); // already imported
  });
});

describe('student: imported simulation', () => {
  test('is embedded with attribution and a checklist', () => {
    const exp = experimentFromSimulation(SIMULATION_CATALOG.find((s) => s.slug === 'friction'), newLabId);
    render(<VirtualLabPlayer experiment={exp} subjectName="science" onExit={() => {}} />);
    const frame = screen.getByTitle('Friction');
    expect(frame.tagName).toBe('IFRAME');
    expect(frame).toHaveAttribute('src', exp.simUrl);
    expect(screen.getByText(/PhET Interactive Simulations/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Next$/ })).toBeDisabled();
    screen.getAllByRole('checkbox').forEach((c) => fireEvent.click(c));
    expect(screen.getByRole('button', { name: /^Next$/ })).not.toBeDisabled();
  });

  test('a non-approved link is never embedded', () => {
    const exp = { ...experimentFromSimulation(SIMULATION_CATALOG[0], newLabId), simUrl: 'https://evil.example.com/x' };
    render(<VirtualLabPlayer experiment={exp} onExit={() => {}} />);
    expect(document.querySelector('iframe')).toBeNull();
  });
});
