/* global jest, describe, test, expect, beforeEach */
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { StudentDashboardProvider, useStudentDashboard } from '../StudentDashboardContext';

jest.mock('../../hooks/useNotifications', () => ({ useNotifications: () => ({ notifications: [], unreadCount: 0, markRead: jest.fn(), markAllRead: jest.fn(), refresh: jest.fn() }) }));

const mcq = (id) => ({ id, type: 'mcq', question: 'Q', options: ['a', 'b'], correctAnswer: 0 });
const MAP = {
  subjects: [{
    key: 'computer', title: 'Computer',
    chapters: [{ title: 'Chapter 1: Basics', topics: [{ title: 'Introduction to Computers' }, { title: 'Input Devices' }, { title: 'Output Devices' }] }],
    topics: [
      { title: 'Introduction to Computers', tryoutSections: [mcq('a'), mcq('b')] },
      { title: 'Input Devices', tryoutSections: [mcq('c')] },
      { title: 'Output Devices', tryoutSections: [mcq('d')] },
    ],
  }],
};
const RESULTS = {
  results: [
    { subjectName: 'computer', topicTitle: 'Introduction to Computers', autoScore: 40 }, // newest
    { subjectName: 'computer', topicTitle: 'Introduction to Computers', autoScore: 90 },
    { subjectName: 'computer', topicTitle: 'Input Devices', autoScore: 85 },
  ],
};

const Probe = () => {
  const { smartLearningReminders } = useStudentDashboard();
  return <pre data-testid="reminders">{JSON.stringify(smartLearningReminders)}</pre>;
};

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('token', 't');
  localStorage.setItem('userType', 'Student');
  global.fetch = jest.fn((url) => {
    const u = String(url);
    const json = u.includes('smart-learning-map') ? MAP : u.includes('tryout-results') ? RESULTS : {};
    return Promise.resolve({ ok: true, status: 200, json: () => Promise.resolve(json) });
  });
});

describe('Smart Learning reminders', () => {
  test('lists tryouts (not practice papers) with the student\'s latest score, unpractised first', async () => {
    render(<StudentDashboardProvider><Probe /></StudentDashboardProvider>);
    await waitFor(() => expect(JSON.parse(screen.getByTestId('reminders').textContent)).toHaveLength(3));
    const reminders = JSON.parse(screen.getByTestId('reminders').textContent);

    expect(reminders.map((r) => r.topic)).toEqual(['Output Devices', 'Introduction to Computers', 'Input Devices']);
    expect(reminders.every((r) => r.kind === 'Tryout')).toBe(true);
    expect(reminders[0]).toMatchObject({ status: 'not_started', progress: 0, detail: 'Not practised yet · 1 question' });
    expect(reminders[1]).toMatchObject({ status: 'attempted', progress: 40, attempts: 2, detail: 'Your score 40% · 2 attempts' });
    // opens the topic straight on its Practice (tryout) tab
    expect(reminders[1].path).toMatch(/^\/student\/smart-learning-courses\/subject\/computer\/topic\/[^/?]+\?view=details&mode=practice$/);
    expect(global.fetch.mock.calls.some(([u]) => String(u).includes('practice-papers'))).toBe(false);
  });
});
