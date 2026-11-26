/* global jest, describe, test, expect, beforeEach */
import React from 'react';
import { render, screen, fireEvent, within, waitFor } from '@testing-library/react';
import VirtualLab from '../VirtualLab';
import {
  SEED_GERMINATION_TEMPLATE, jarOutcome, growthStage, labXp,
} from '../../utils/virtualLab';

describe('germination rules', () => {
  const [good, noWater, flooded, dark] = SEED_GERMINATION_TEMPLATE().jars;
  test('outcomes match the science', () => {
    expect(jarOutcome(good)).toBe('good');
    expect(jarOutcome(noWater)).toBe('none');
    expect(jarOutcome(flooded)).toBe('poor');
    expect(jarOutcome(dark)).toBe('good'); // light is not needed to germinate
    expect(jarOutcome({ ...good, warm: false })).toBe('none');
  });
  test('growth by day', () => {
    expect(growthStage(good, 7)).toBe(7);
    expect(growthStage(noWater, 7)).toBe(0);
    expect(growthStage(flooded, 7)).toBe(3);
  });
  test('XP', () => {
    const exp = SEED_GERMINATION_TEMPLATE();
    expect(labXp(exp, { completed: true, observationsCount: 3, quizCorrect: 5, quizTotal: 5 })).toBe(25);
    expect(labXp(exp, { completed: true, observationsCount: 1, quizCorrect: 4, quizTotal: 5 })).toBe(10);
  });
});

const experiment = { ...SEED_GERMINATION_TEMPLATE(), id: 'exp-1' };
const MAP = {
  subjects: [{
    key: 'science', title: 'Science',
    chapters: [{ title: 'Chapter 2: Plants', topics: [{ title: 'Seeds' }] }],
    topics: [{ title: 'Seeds', tryoutSections: [], labExperiments: [experiment] }],
  }, {
    key: 'maths', title: 'Maths', chapters: [{ title: 'Chapter 1', topics: [{ title: 'Numbers' }] }], topics: [{ title: 'Numbers', labExperiments: [] }],
  }],
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('token', 't');
  localStorage.setItem('userType', 'Student');
  global.fetch = jest.fn((url, opts) => {
    const u = String(url);
    if (u.includes('smart-learning-map')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(MAP) });
    if (u.includes('lab-results')) return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({ results: [] }) });
    if (u.includes('lab-submit')) return Promise.resolve({ ok: true, status: 201, json: () => Promise.resolve({ result: { xp: JSON.parse(opts.body).xp } }) });
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve({}) });
  });
});

describe('Student Virtual Lab', () => {
  test('subjects → chapters → topics → experiments, then a full run with XP', async () => {
    render(<VirtualLab />);
    // only subjects that have experiments
    const science = await screen.findByRole('button', { name: /Science/ });
    expect(screen.queryByRole('button', { name: /Maths/ })).not.toBeInTheDocument();
    fireEvent.click(science);
    expect(screen.getByText('Chapter 2: Plants')).toBeInTheDocument();
    expect(screen.getByText('Seeds')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Start experiment/ }));

    // 1. stages, in order
    expect(screen.getByRole('heading', { name: 'How Does a Seed Germinate?' })).toBeInTheDocument();
    const next = () => screen.getByRole('button', { name: /^(Next|Finish)$/ });
    expect(next()).toBeDisabled();
    for (let i = 0; i < 5; i += 1) fireEvent.click(screen.getAllByRole('button', { name: 'Do it' })[0]);
    expect(next()).not.toBeDisabled();
    fireEvent.click(next());

    // 2. observe — advance to day 7; the no-water jar shows no germination
    for (let i = 0; i < 7; i += 1) fireEvent.click(screen.getByRole('button', { name: /Next day/ }));
    expect(screen.getByText('Day 7 / 7')).toBeInTheDocument();
    const noWaterJar = screen.getByText('Jar B – No Water').closest('button');
    expect(within(noWaterJar).getByText('No germination')).toBeInTheDocument();
    fireEvent.click(next());

    // 3. notebook — three observations
    [1, 2, 3].forEach((d) => {
      fireEvent.click(screen.getByRole('button', { name: new RegExp(`^Day ${d}$`) }));
      fireEvent.change(screen.getByPlaceholderText(new RegExp(`day ${d}`)), { target: { value: `Note for day ${d}` } });
      fireEvent.click(screen.getByRole('button', { name: 'Save observation' }));
    });
    expect(screen.getByText('3 observations recorded')).toBeInTheDocument();
    fireEvent.click(next());

    // 4. quiz — answer all correctly
    experiment.questions.forEach((q) => fireEvent.click(screen.getByRole('button', { name: new RegExp(q.options[q.correctAnswer].replace(/[.*+?^${}()|[\]\\]/g, '\\$&')) })));
    fireEvent.click(screen.getByRole('button', { name: 'Check answers' }));
    expect(screen.getByText('You got 5 of 5 right.')).toBeInTheDocument();
    fireEvent.click(next());

    // 5. result: 10 + 5 + 10 XP, saved
    expect(screen.getByText('25 XP')).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/Saved to your lab record/)).toBeInTheDocument());
    const submit = global.fetch.mock.calls.find(([u]) => String(u).includes('lab-submit'));
    expect(JSON.parse(submit[1].body)).toMatchObject({ experimentId: 'exp-1', xp: 25, quizCorrect: 5, quizTotal: 5, completed: true });
  });
});
