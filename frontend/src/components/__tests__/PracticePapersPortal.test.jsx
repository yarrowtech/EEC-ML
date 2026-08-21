/* eslint-disable no-undef, react/display-name */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import PracticePapersPortal from '../PracticePapersPortal';

jest.mock('../ReadingPracticePage', () => () => <div>Reading practice</div>);
jest.mock('../WritingPracticePage', () => () => <div>Writing practice</div>);

const jsonResponse = (body, ok = true) => Promise.resolve({
  ok,
  json: () => Promise.resolve(body),
});

describe('PracticePapersPortal', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'student-token');
    global.fetch = jest.fn((input) => {
      const url = String(input);
      if (url.includes('/api/assignment/student/assignments')) return jsonResponse([]);
      if (url.includes('/api/practice-papers/student/papers')) return jsonResponse({ papers: [] });
      if (url.includes('/api/practice/student/meta')) {
        return jsonResponse({ subjects: [{ id: 'subject-1', name: 'Mathematics' }] });
      }
      if (url.includes('/api/lesson-plans/student/smart-learning-map')) {
        return jsonResponse({
          subjects: [{
            title: 'Science',
            topics: [{ title: 'Living Things', tryoutSections: [{ type: 'mcq', question: 'What is life?' }] }],
          }],
        });
      }
      if (url.includes('/api/practice/student/questions') && url.includes('type=blank')) {
        return jsonResponse({ questions: [{ id: 'blank-1', type: 'blank', question: 'Two plus two is ___.' }] });
      }
      if (url.includes('/api/practice/student/questions')) {
        return jsonResponse({ questions: [{ id: 'mcq-1', type: 'mcq', question: 'What is 2 + 2?', options: ['3', '4'] }] });
      }
      return jsonResponse({});
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('shows teacher MCQs, fill blanks, tryouts, practice papers and homework filters together', async () => {
    render(<MemoryRouter><PracticePapersPortal /></MemoryRouter>);

    expect(await screen.findByText('Quick Activities')).toBeInTheDocument();
    expect(await screen.findAllByText('Mathematics')).toHaveLength(2);
    expect(screen.getByText('Assigned Tryouts')).toBeInTheDocument();
    expect(screen.getByText('Living Things')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Practice papers' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Homework' })).toBeInTheDocument();
  });

  test('opens a teacher MCQ inside the practice-papers page', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PracticePapersPortal /></MemoryRouter>);

    const activityButtons = await screen.findAllByRole('button', { name: /Multiple choice.*Mathematics/i });
    await user.click(activityButtons[0]);

    await waitFor(() => expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Back to activities' })).toBeInTheDocument();
  });

  test('opens an assigned tryout inside the same practice portal', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/student/practice-papers']}><PracticePapersPortal /></MemoryRouter>);

    await user.click(await screen.findByRole('button', { name: /Science.*Living Things.*Open tryout/i }));

    expect(await screen.findByText('Assigned Tryout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Activities/i })).toBeInTheDocument();
  });
});
