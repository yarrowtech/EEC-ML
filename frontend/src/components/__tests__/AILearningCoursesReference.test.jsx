/* global jest, describe, beforeEach, test, expect */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AILearningCoursesReference from '../AILearningCoursesReference';
import { fetchCachedJson } from '../../utils/studentApiCache';

jest.mock('../../utils/studentApiCache', () => ({
  fetchCachedJson: jest.fn(),
}));

describe('AILearningCoursesReference loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'student-token');
    localStorage.setItem('userType', 'Student');
  });

  test('renders the requested topic without waiting for allocation metadata', async () => {
    fetchCachedJson.mockImplementation((url) => {
      if (url.includes('/allocated-subjects')) return new Promise(() => {});
      if (url.includes('/student/materials')) return Promise.resolve({ data: { materials: [] } });
      return Promise.resolve({
        data: {
          subjects: [{
            key: 'english (second language)',
            subjectId: 'subject-1',
            title: 'English (Second Language)',
            chapters: [{
              id: 'chapter-7',
              title: 'Engish Chapter 007',
              meta: {},
              topics: [],
            }],
            topics: [],
          }],
        },
      });
    });

    render(
      <MemoryRouter initialEntries={['/student/smart-learning-courses/subject/english_(second_language)/topic/Engish_Chapter_007']}>
        <AILearningCoursesReference />
      </MemoryRouter>
    );

    expect(await screen.findByText('✦ Topic Reader')).toBeInTheDocument();
    expect(screen.queryByText('Loading published learning data…')).not.toBeInTheDocument();
    expect(fetchCachedJson).toHaveBeenCalledWith(
      expect.stringContaining('subject=english+%28second+language%29'),
      expect.any(Object),
    );
  });

  test('renders navigation data immediately while the richer subject request refreshes', async () => {
    fetchCachedJson.mockImplementation((url) => {
      if (url.includes('/smart-learning-map')) return new Promise(() => {});
      if (url.includes('/allocated-subjects')) return new Promise(() => {});
      return Promise.resolve({ data: { materials: [] } });
    });

    render(
      <MemoryRouter initialEntries={[{
        pathname: '/student/smart-learning-courses/subject/english_(second_language)/topic/Engish_Chapter_007',
        state: {
          smartLearningSubject: {
            key: 'english (second language)',
            subjectId: 'subject-1',
            title: 'English (Second Language)',
            chapters: [{
              id: 'chapter-7',
              title: 'Engish Chapter 007',
              meta: {},
              topics: [],
            }],
            topics: [],
          },
        },
      }]}
      >
        <AILearningCoursesReference />
      </MemoryRouter>
    );

    expect(screen.getByText('✦ Topic Reader')).toBeInTheDocument();
    expect(screen.queryByText('Loading published learning data…')).not.toBeInTheDocument();
  });
});
