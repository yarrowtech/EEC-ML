/* eslint-disable no-undef, react/display-name */
import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import PracticePapersPortal from '../PracticePapersPortal';
import AILearningCoursesLanding from '../AILearningCoursesLanding';


const jsonResponse = (body, ok = true) => Promise.resolve({
  ok,
  json: () => Promise.resolve(body),
});

const renderPracticeRoutes = () => {
  render(
    <MemoryRouter initialEntries={['/student/practice-papers']}>
      <Routes>
        <Route path="/student/practice-papers" element={<PracticePapersPortal />} />
        <Route path="/student/smart-learning-courses/*" element={<AILearningCoursesLanding />} />
      </Routes>
    </MemoryRouter>
  );
};

describe('PracticePapersPortal', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'student-token');
    // AILearningTryoutSection (rendered by the "start tryout" flow below)
    // refuses to fetch unless userType is exactly 'Student'.
    localStorage.setItem('userType', 'Student');
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
              id: 'lesson-3',
              title: 'Fractions',
              meta: { unitNumber: 2, unitTitle: 'Fractions' },
              topics: [{ id: 'topic-3', title: 'Equivalent Fractions' }],
            }, {
              id: 'chapter-1',
              title: 'Numbers',
              meta: { unitNumber: 1, unitTitle: 'Computer Basics' },
              topics: [{ id: 'topic-1', title: 'Living Things' }],
            }, {
              id: 'lesson-2',
              title: 'Counting',
              meta: { unitNumber: 1, unitTitle: 'Computer Basics' },
              topics: [{ id: 'topic-2', title: 'Counting' }],
            }],
            topics: [{
              title: 'Living Things',
              tryoutSections: [
                { type: 'mcq', question: 'What is life?' },
                { type: 'plain_text', question: 'Describe a living thing.' },
              ],
            }, {
              title: 'Equivalent Fractions',
              tryoutSections: [{ type: 'mcq', question: 'Which fractions are equivalent?' }],
            }],
          }],
        });
      }
      return jsonResponse({});
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.clearAllMocks();
  });

  test('merges chapter tryouts by question type in one test', async () => {
    const user = userEvent.setup();
    renderPracticeRoutes();
    await user.click(await screen.findByRole('button', { name: /Mathematics/ }));
    await user.click(screen.getByRole('button', { name: /Practice whole subject/ }));

    expect(await screen.findByText('What is life?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save & Next/ }));
    expect(screen.getByText('Which fractions are equivalent?')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Save & Next/ }));
    expect(screen.getByText('Describe a living thing.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Save & Finish' })).toBeInTheDocument();
    global.fetch.mockClear();
    await user.click(screen.getByRole('button', { name: 'Exit practice' }));
    expect(await screen.findByRole('button', { name: /Chapter 1 Computer Basics/ })).toBeVisible();
    expect(global.fetch.mock.calls.some(([url]) =>
      /student\/meta|student\/smart-learning-map/.test(String(url))
    )).toBe(false);
  });

  test('opens an assigned tryout once a subject and topic are selected', async () => {
    const user = userEvent.setup();
    renderPracticeRoutes();

    await user.click(await screen.findByRole('button', { name: /Mathematics/ }));
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent))
      .toEqual([expect.stringMatching(/Computer Basics/), expect.stringMatching(/Fractions/)]);
    expect(screen.getByRole('button', { name: /1\.2 Counting/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /2\.1 Equivalent Fractions/ })).toBeVisible();
    await user.click(await screen.findByRole('button', { name: /1\.1 Living Things/ }));
    expect(screen.getByRole('button', { name: /Written Response.*1 question available/ })).toBeVisible();
    expect(screen.queryByRole('button', { name: /Start Blanks/ })).toBeNull();
    await user.click(await screen.findByRole('button', { name: /Multiple Choice.*1 question available/ }));
    expect(await screen.findByText('What is life?')).toBeInTheDocument();
    expect(screen.queryByText('Describe a living thing.')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Exit practice' }));
    expect(await screen.findByRole('button', { name: /Multiple Choice.*1 question available/ })).toBeVisible();
    expect(screen.getByRole('button', { name: /Written Response.*1 question available/ })).toBeVisible();
  });

  test('still lists a chapter that has no Topic Tryout assigned', async () => {
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
              id: 'chapter-2',
              title: 'Fractions',
              // No tryoutSections on this topic — the chapter must still show up.
              topics: [{ id: 'topic-2', title: 'Basic Fractions' }],
            }],
            topics: [{ title: 'Basic Fractions', tryoutSections: [] }],
          }],
        });
      }
      return jsonResponse({});
    });

    render(<MemoryRouter><PracticePapersPortal /></MemoryRouter>);

    await userEvent.setup().click(await screen.findByRole('button', { name: /Mathematics/ }));

    expect(await screen.findByRole('button', { name: /^Chapter 1 Fractions/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /1\.1 Basic Fractions/ })).toBeVisible();
  });
});
