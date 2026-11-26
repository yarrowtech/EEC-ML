/* global jest, describe, test, expect, beforeEach, afterEach */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PracticeTryouts from '../PracticeTryouts';

const mcq = (id, q) => ({ id, type: 'mcq', question: q, options: ['a', 'b'], correctAnswer: 0 });
const MAP = {
  subjects: [
    {
      key: 'computer', title: 'Computer',
      chapters: [
        { title: 'Chapter 2: Hardware', topics: [{ title: 'Input Devices' }] },
        { title: 'Chapter 1: Basics', topics: [{ title: 'Introduction to Computers' }] },
      ],
      topics: [
        { title: 'Input Devices', tryoutSections: [mcq('q3', 'Which is an input device?')] },
        { title: 'Introduction to Computers', tryoutSections: [mcq('q1', 'What is a CPU?'), { id: 'q2', type: 'match_list', items: ['a'], pairs: ['b'] }] },
      ],
    },
    { key: 'art', title: 'Art', chapters: [], topics: [{ title: 'Colours', tryoutSections: [] }] },
  ],
};

beforeEach(() => {
  localStorage.setItem('token', 't');
  localStorage.setItem('userType', 'Student');
  global.fetch = jest.fn((url) => Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve(String(url).includes('tryout-results') ? { results: [] } : MAP),
  }));
  document.documentElement.requestFullscreen = jest.fn(() => Promise.resolve());
});
afterEach(() => { localStorage.clear(); });

describe('PracticeTryouts', () => {
  test('shows only subjects that have tryouts, then that subject\'s tryouts in chapter order', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PracticeTryouts /></MemoryRouter>);
    const subject = await screen.findByRole('button', { name: /Computer/ });
    expect(screen.queryByRole('button', { name: /Art/ })).not.toBeInTheDocument();
    expect(subject).toHaveTextContent('2 chapters · 2 topics · 3 questions');

    await user.click(subject);
    // Chapters in chapter-number order; the first one starts open.
    const chapters = screen.getAllByRole('button').filter((b) => b.hasAttribute('aria-expanded'));
    expect(chapters.map((c) => c.textContent)).toEqual([
      expect.stringContaining('Chapter 1: Basics'),
      expect.stringContaining('Chapter 2: Hardware'),
    ]);
    expect(screen.getByRole('heading', { level: 3, name: 'Introduction to Computers' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 3, name: 'Input Devices' })).not.toBeInTheDocument();

    // Opening chapter 2 shows its topic.
    await user.click(chapters[1]);
    expect(screen.getByRole('heading', { level: 3, name: 'Input Devices' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Practice now/ })).toHaveLength(2);
  });

  test('a second visit paints instantly from the cache without another request', async () => {
    const first = render(<MemoryRouter><PracticeTryouts /></MemoryRouter>);
    await screen.findByRole('button', { name: /Computer/ });
    first.unmount();
    const callsAfterFirstVisit = global.fetch.mock.calls.length;

    render(<MemoryRouter><PracticeTryouts /></MemoryRouter>);
    // Synchronous query: no spinner, the cached subjects are there on first paint.
    expect(screen.getByRole('button', { name: /Computer/ })).toBeInTheDocument();
    expect(screen.queryByText(/Loading your tryouts/)).not.toBeInTheDocument();
    await new Promise((r) => setTimeout(r, 0));
    expect(global.fetch.mock.calls.length).toBe(callsAfterFirstVisit); // still fresh → no network
  });

  test('Practice now opens the tryout straight in the full-screen exam', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PracticeTryouts /></MemoryRouter>);
    await user.click(await screen.findByRole('button', { name: /Computer/ }));
    await user.click(screen.getAllByRole('button', { name: /Practice now/ })[0]);

    expect(await screen.findByText('Question No. 1')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Start Practice/ })).not.toBeInTheDocument();

    // Exiting returns to the same subject's tryout list.
    await user.click(screen.getByRole('button', { name: 'Exit practice' }));
    expect(await screen.findAllByRole('button', { name: /Practice now/ })).toHaveLength(1);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Computer');
  });
});
