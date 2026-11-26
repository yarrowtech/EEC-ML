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
        {location.search && <span>Query: {location.search}</span>}
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

    fireEvent.click(await screen.findByRole('link', { name: 'Open Chapter 7' }));

    expect(await screen.findByText('Scoped topic page')).toBeInTheDocument();
    expect(screen.getByText('Query: ?view=details')).toBeInTheDocument();
    expect(screen.getByText('Seeded topic data')).toBeInTheDocument();
  });
  test('"Mark as done" survives a page refresh (topics load after the page)', async () => {
    const subjects = { data: { subjects: [{ _id: 'subject-1', name: 'Computer', teachers: [{ id: 't1', name: 'Koushik' }] }] } };
    const map = { data: { subjects: [{
      key: 'computer', title: 'Computer', subjectId: 'subject-1',
      chapters: [{ id: 'c1', title: 'Introduction to Computers', topics: [{ title: 'Introduction to Computers', subtopics: [{ title: 'Overview' }] }] }],
      topics: [{ title: 'Introduction to Computers', subtopics: ['Overview'] }],
    }] } };
    // The curriculum map arrives a moment after the subjects, like a real refresh.
    fetchCachedJson.mockImplementation((url) => (url.includes('/smart-learning-map')
      ? new Promise((resolve) => setTimeout(() => resolve(map), 30))
      : Promise.resolve(subjects)));
    const route = ['/student/smart-learning-courses/subject/computer'];

    const first = render(<MemoryRouter initialEntries={route}><AILearningCoursesLanding /></MemoryRouter>);
    const box = await screen.findByRole('checkbox', { name: 'Mark Introduction to Computers as done' });
    fireEvent.click(box);
    expect(box).toBeChecked();
    // ticking the box must not open the lesson
    expect(screen.queryByText('Scoped topic page')).not.toBeInTheDocument();
    first.unmount();

    // "refresh"
    render(<MemoryRouter initialEntries={route}><AILearningCoursesLanding /></MemoryRouter>);
    await waitFor(() => expect(screen.getByRole('checkbox', { name: 'Mark Introduction to Computers as done' })).toBeChecked());

    // clicking the lesson card opens the topic page
    fireEvent.click(screen.getByRole('link', { name: 'Open Introduction to Computers' }));
    expect(await screen.findByText('Scoped topic page')).toBeInTheDocument();
    expect(screen.getByText('Query: ?view=details')).toBeInTheDocument();
    expect(JSON.parse(localStorage.getItem('smart-learning-progress-computer'))).toEqual({ 'Introduction to Computers': ['Overview'] });
  });
});
