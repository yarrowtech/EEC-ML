/* global jest, describe, beforeEach, afterEach, test, expect, global */
/* eslint-disable react/display-name, react/prop-types */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import AIPoweredTeaching from '../AIPoweredTeaching';

jest.mock('../components/lesson-plan-builder/HeaderActions', () => ({ autosaveStatus }) => (
  <div data-testid="autosave-status">{autosaveStatus}</div>
));

jest.mock('../components/lesson-plan-builder/Sidebar', () => ({ chapters, onSelect }) => (
  <div>
    {chapters.map((chapter) => (
      <button key={chapter.id} type="button" onClick={() => onSelect(chapter.id)}>
        {chapter.title}
      </button>
    ))}
  </div>
));

jest.mock('../components/lesson-plan-builder/DrawerModal', () => ({
  __esModule: true,
  DEFAULT_INSTRUCTIONAL_FLOW: [],
  default: ({ chapter }) => (
    <div>
      <span>{chapter.introductionText}</span>
      <span data-testid="published-plan-id">{chapter.publishedPlanId}</span>
    </div>
  ),
}));

jest.mock('react-hot-toast', () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    loading: jest.fn(),
  },
}));

const jsonResponse = (data) => Promise.resolve({
  ok: true,
  json: () => Promise.resolve(data),
});

describe('AIPoweredTeaching persistence', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('token', 'teacher-token');
    localStorage.setItem('userType', 'Teacher');
    localStorage.setItem('aiPoweredTeachingSelection', JSON.stringify({
      classId: 'class-1',
      sectionId: 'section-1',
      subjectId: 'subject-1',
    }));

    global.fetch = jest.fn((url) => {
      if (String(url).includes('/teacher/options')) {
        return jsonResponse({ classes: [], sections: [], subjects: [] });
      }

      if (String(url).includes('/teacher/my')) {
        return jsonResponse([
          {
            _id: 'published-plan-old',
            classId: 'class-1',
            sectionId: 'section-1',
            subjectId: 'subject-1',
            status: 'published',
            isDraft: false,
            title: 'English Chapter 008',
            plannerContent: {
              chapters: [{ id: 'chapter-1', title: 'English Chapter 008' }],
            },
            updatedAt: '2026-08-10T10:00:00.000Z',
          },
          {
            _id: 'published-plan-new',
            classId: 'class-1',
            sectionId: 'section-1',
            subjectId: 'subject-1',
            status: 'published',
            isDraft: false,
            title: 'English Chapter 008',
            plannerContent: {
              chapters: [{ id: 'chapter-1', title: 'English Chapter 008' }],
            },
            updatedAt: '2026-08-11T09:00:00.000Z',
          },
          {
            _id: 'draft-plan-1',
            classId: 'class-1',
            sectionId: 'section-1',
            subjectId: 'subject-1',
            status: 'draft',
            isDraft: true,
            rawChapters: [
              {
                id: 'local-chapter-1',
                title: 'English Chapter 008',
                introductionText: 'The teacher’s latest saved update',
              },
              {
                id: 'published-plan-old',
                publishedPlanId: 'published-plan-old',
                title: 'English Chapter 008',
                introductionText: 'Older duplicate content',
              },
              {
                id: 'local-chapter-6',
                title: 'English Chapter 006',
                introductionText: 'Chapter six content',
              },
            ],
            updatedAt: '2026-08-11T10:00:00.000Z',
          },
        ]);
      }

      return jsonResponse({});
    });
  });

  afterEach(() => {
    localStorage.clear();
    jest.restoreAllMocks();
  });

  test('restores the latest edited draft when the teacher revisits', async () => {
    render(<AIPoweredTeaching />);

    const chapterButton = await screen.findByRole('button', { name: 'English Chapter 008' });
    expect(screen.getByTestId('autosave-status')).toHaveTextContent('Draft restored');

    fireEvent.click(chapterButton);

    expect(screen.getByText('The teacher’s latest saved update')).toBeInTheDocument();
    expect(screen.getByTestId('published-plan-id')).toHaveTextContent('published-plan-new');
    expect(localStorage.getItem('currentLessonPlanDraft')).toBe('draft-plan-1');
  });

  test('shows only the chapter most recently selected in the sidebar', async () => {
    render(<AIPoweredTeaching />);

    fireEvent.click(await screen.findByRole('button', { name: 'English Chapter 008' }));
    expect(screen.getByText('The teacher’s latest saved update')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'English Chapter 006' }));

    expect(screen.getByText('Chapter six content')).toBeInTheDocument();
    expect(screen.queryByText('The teacher’s latest saved update')).not.toBeInTheDocument();
  });
});
