/* global jest, describe, beforeEach, test, expect */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AILearningCoursesLanding from '../AILearningCoursesLanding';
import { fetchCachedJson } from '../../utils/studentApiCache';

jest.mock('../../utils/studentApiCache', () => ({
  fetchCachedJson: jest.fn(),
}));

jest.mock('../AILearningCoursesReference', () => ({
  __esModule: true,
  default: () => {
    const { useLocation } = jest.requireActual('react-router-dom');
    const location = useLocation();
    return (
      <div>
        Scoped topic page
        {location.state?.smartLearningSubject && <span>Seeded topic data</span>}
      </div>
    );
  },
}));

describe('AILearningCoursesLanding loading', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'student-token');
    localStorage.setItem('userType', 'Student');
  });

  test('shows assigned subjects without waiting for the curriculum map', async () => {
    const neverResolvingMap = new Promise(() => {});
    fetchCachedJson.mockImplementation((url) => {
      if (url.includes('/smart-learning-map')) return neverResolvingMap;
      return Promise.resolve({
        data: {
          subjects: [{
            _id: 'subject-1',
            name: 'Mathematics',
            teachers: [{ id: 'teacher-1', name: 'Ms Rao' }],
          }],
        },
      });
    });

    render(
      <MemoryRouter initialEntries={['/student/smart-learning-courses']}>
        <AILearningCoursesLanding />
      </MemoryRouter>
    );

    expect(await screen.findByRole('heading', { name: 'Mathematics' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Loading lessons…' })).toBeDisabled();
    expect(screen.queryByText('No real smart-learning data found')).not.toBeInTheDocument();
  });

  test('mounts a deep topic route without starting landing-page requests', async () => {
    render(
      <MemoryRouter initialEntries={['/student/smart-learning-courses/subject/english_(second_language)/topic/Engish_Chapter_007']}>
        <AILearningCoursesLanding />
      </MemoryRouter>
    );

    expect(await screen.findByText('Scoped topic page')).toBeInTheDocument();
    expect(fetchCachedJson).not.toHaveBeenCalled();
  });

  test('does not start curriculum loading before allocated subjects resolve', async () => {
    let resolveAllocation;
    const allocationRequest = new Promise((resolve) => {
      resolveAllocation = resolve;
    });
    fetchCachedJson.mockImplementation((url) => {
      if (url.includes('/allocated-subjects')) return allocationRequest;
      return Promise.resolve({ data: { subjects: [] } });
    });

    render(
      <MemoryRouter initialEntries={['/student/smart-learning-courses']}>
        <AILearningCoursesLanding />
      </MemoryRouter>
    );

    await waitFor(() => expect(fetchCachedJson).toHaveBeenCalledTimes(1));
    expect(fetchCachedJson.mock.calls[0][0]).toContain('/allocated-subjects');

    await act(async () => {
      resolveAllocation({ data: { subjects: [] } });
    });

    await waitFor(() => expect(fetchCachedJson).toHaveBeenCalledTimes(2));
    expect(fetchCachedJson.mock.calls[1][0]).toContain('/smart-learning-map?summary=true');
  });

  test('carries the loaded subject data into Start Learning navigation', async () => {
    fetchCachedJson.mockImplementation((url) => {
      if (url.includes('/allocated-subjects')) {
        return Promise.resolve({
          data: {
            subjects: [{ _id: 'subject-1', name: 'English (Second Language)', teachers: [] }],
          },
        });
      }
      return Promise.resolve({
        data: {
          subjects: [{
            key: 'english (second language)',
            subjectId: 'subject-1',
            title: 'English (Second Language)',
            chapters: [{
              id: 'chapter-7',
              title: 'Chapter 7',
              topics: [{ title: 'Engish Chapter 007', subtopics: [] }],
            }],
            topics: [{ title: 'Engish Chapter 007', subtopics: [] }],
          }],
        },
      });
    });

    render(
      <MemoryRouter initialEntries={['/student/smart-learning-courses/subject/english_(second_language)']}>
        <AILearningCoursesLanding />
      </MemoryRouter>
    );

    fireEvent.click(await screen.findByRole('button', { name: 'Start Learning' }));

    expect(await screen.findByText('Scoped topic page')).toBeInTheDocument();
    expect(screen.getByText('Seeded topic data')).toBeInTheDocument();
  });
});
