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
      if (url.includes('/api/practice/student/meta')) {
        return jsonResponse({ subjects: [{ id: 'subject-1', name: 'Mathematics' }] });
      }
      if (url.includes('/api/lesson-plans/student/smart-learning-map')) {
        return jsonResponse({
          subjects: [{
            subjectId: 'subject-1',
            title: 'Mathematics',
            chapters: [{
              id: 'chapter-1',
              title: 'Numbers',
              topics: [{ id: 'topic-1', title: 'Living Things' }],
            }],
            topics: [{
              title: 'Living Things',
              tryoutSections: [{ type: 'mcq', question: 'What is life?' }],
            }],
          }],
        });
      }
      if (url.includes('/api/practice/student/questions') && url.includes('type=blank')) {
        return jsonResponse({ questions: [{ id: 'blank-1', type: 'blank', question: 'Two plus two is ___.' }] });
      }
      if (url.includes('/api/practice/student/questions')) {
        return jsonResponse({ questions: [{ id: 'mcq-1', type: 'mcq', question: 'What is 2 + 2?', options: ['3', '4'] }] });
      }
      if (url.includes('/api/reading-assessment/student/materials')) {
        // Teachers tag these by chapter in practice — subject is usually blank.
        return jsonResponse({ success: true, data: [{ _id: 'rm-1', subject: '', chapter: 'Numbers', title: 'Numbers Passage' }] });
      }
      if (url.includes('/api/writing-assessment/student/prompts')) {
        // No writing prompt published for the "Numbers" chapter — Writing
        // Practice should stay unavailable rather than defaulting to "on".
        return jsonResponse({ success: true, data: [{ _id: 'wp-1', subject: '', chapter: 'A Different Chapter', title: 'Explain photosynthesis' }] });
      }
      return jsonResponse({});
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('lets a student pick a subject and shows what they can practice', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PracticePapersPortal /></MemoryRouter>);

    expect(await screen.findByText('Please Select a Subject to see what you can practice.')).toBeInTheDocument();

    await screen.findByRole('option', { name: 'Mathematics' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Select Subject' }), 'subject-1');

    expect(await screen.findByText('Pick a chapter above to see what you can practice.')).toBeInTheDocument();
    expect(screen.queryByRole('combobox', { name: 'Select Topic' })).not.toBeInTheDocument();

    await screen.findByRole('option', { name: 'Numbers' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Select Chapter' }), 'chapter-1');

    // There's no separate topic step — the chapter's one assigned topic is
    // used automatically, so MCQ, Fill in the Blanks and Topic Tryout are
    // all available as soon as subject + chapter are picked.
    expect(await screen.findAllByText('1 question available')).toHaveLength(3);
    expect(screen.getByRole('button', { name: 'Start MCQ' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Blanks' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Start Tryout' })).toBeInTheDocument();
  });

  test('opens a teacher MCQ inside the practice-papers page', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PracticePapersPortal /></MemoryRouter>);

    await screen.findByRole('option', { name: 'Mathematics' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Select Subject' }), 'subject-1');
    await screen.findByRole('option', { name: 'Numbers' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Select Chapter' }), 'chapter-1');
    await user.click(await screen.findByRole('button', { name: 'Start MCQ' }));

    await waitFor(() => expect(screen.getByText('What is 2 + 2?')).toBeInTheDocument());
    expect(screen.getByRole('button', { name: 'Back to activities' })).toBeInTheDocument();
  });

  test('opens the assigned tryout for the chapter\'s topic', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter initialEntries={['/student/practice-papers']}><PracticePapersPortal /></MemoryRouter>);

    await screen.findByRole('option', { name: 'Mathematics' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Select Subject' }), 'subject-1');
    await screen.findByRole('option', { name: 'Numbers' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Select Chapter' }), 'chapter-1');
    await user.click(await screen.findByRole('button', { name: 'Start Tryout' }));

    expect(await screen.findByText('Assigned Tryout')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Back to Activities/i })).toBeInTheDocument();
  });

  test('gates Reading/Writing Practice on real published materials instead of always showing available', async () => {
    const user = userEvent.setup();
    render(<MemoryRouter><PracticePapersPortal /></MemoryRouter>);

    await screen.findByRole('option', { name: 'Mathematics' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Select Subject' }), 'subject-1');
    await screen.findByRole('option', { name: 'Numbers' });
    await user.selectOptions(screen.getByRole('combobox', { name: 'Select Chapter' }), 'chapter-1');

    // A reading passage is published for Mathematics — the card is enabled.
    const startReading = await screen.findByRole('button', { name: 'Start Reading' });
    expect(startReading).toBeEnabled();

    // No writing prompt is published for Mathematics (only for Science) —
    // the card must stay disabled rather than being assumed available.
    expect(screen.getByRole('button', { name: 'Start Writing' })).toBeDisabled();

    await user.click(startReading);
    expect(await screen.findByText('Reading practice')).toBeInTheDocument();
  });
});
