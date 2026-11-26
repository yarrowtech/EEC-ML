/* global jest, describe, test, expect, beforeEach */
import React from 'react';
import { render, screen, within, fireEvent } from '@testing-library/react';
import HealthUpdatesAdvanced from '../HealthUpdatesAdvanced';

jest.mock('react-hot-toast', () => ({ __esModule: true, default: { success: jest.fn(), error: jest.fn() } }));

const todayAt = (h) => { const d = new Date(); d.setHours(h, 0, 0, 0); return d.toISOString(); };
const daysAgoAt = (n, h) => { const d = new Date(); d.setDate(d.getDate() - n); d.setHours(h, 0, 0, 0); return d.toISOString(); };

beforeEach(() => {
  localStorage.setItem('token', 't');
  localStorage.setItem('userType', 'Teacher');
  global.fetch = jest.fn((url) => {
    const u = String(url);
    if (u.includes('/api/attendance/teacher/students')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({
        students: [
          { _id: 's1', name: 'Ayan Das', className: '5', section: 'A', roll: 1 },
          { _id: 's2', name: 'Priya Sen', className: '5', section: 'A', roll: 2 },
        ],
        options: { sessions: [], classes: [], sections: [] },
      }) });
    }
    if (u.includes('/api/health-records/logs')) {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, data: {
        logs: [],
        interventions: [],
        studentMoods: [
          { studentId: 's1', mood: 'Happy', at: todayAt(8) },
          { studentId: 's1', mood: 'Sad', at: todayAt(14) }, // later today → wins
          { studentId: 's1', mood: 'Calm', at: daysAgoAt(2, 9) },
        ],
        tryoutStats: [{ studentId: 's1', attempts: 4, avgScore: 80, lastAt: todayAt(10) }],
      } }) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
  });
});

describe('Health & Wellbeing — student diary moods', () => {
  test('shows each student\'s latest mood from their diary today', async () => {
    render(<HealthUpdatesAdvanced />);
    const ayanRow = (await screen.findAllByText('Ayan Das'))[0].closest('tr');
    expect(within(ayanRow).getByText('Sad')).toBeInTheDocument(); // latest of today
    const priyaRow = screen.getAllByText('Priya Sen')[0].closest('tr');
    expect(within(priyaRow).queryByText(/Sad|Happy|Calm/)).not.toBeInTheDocument();

    expect(screen.getByText(/Today: 1 of 2 students shared their mood/)).toBeInTheDocument();
    expect(screen.getByText('1 feeling low')).toBeInTheDocument();
    // detail opens in a modal only when the student is clicked
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    fireEvent.click(ayanRow);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/shared by the student in their diary/)).toBeInTheDocument();
    expect(within(dialog).getByText('Sad')).toBeInTheDocument();
    // the summary cards are gone from the page
    expect(screen.queryByText('Checked In')).not.toBeInTheDocument();
    expect(screen.queryByText(/Moderate \(40/)).not.toBeInTheDocument();
  });

  test('search and status filter open from icons beside Refresh', async () => {
    render(<HealthUpdatesAdvanced />);
    await screen.findAllByText('Ayan Das');
    // old dropdowns are gone
    expect(screen.queryByText('All Years')).not.toBeInTheDocument();
    expect(screen.queryByText('All Classes')).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Search students' }));
    fireEvent.change(screen.getByPlaceholderText(/Search by name or roll/), { target: { value: 'Priya' } });
    expect(screen.queryByText('Ayan Das')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Close search' }));
    expect(screen.getAllByText('Ayan Das').length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole('button', { name: 'Filter by status' }));
    fireEvent.click(screen.getByRole('menuitemradio', { name: /At Risk/ }));
    expect(screen.getByRole('button', { name: /Status: At Risk/ })).toBeInTheDocument();
    expect(screen.queryByText('Ayan Das')).not.toBeInTheDocument();
  });

  test('modal: mood %, behaviour, engagement from tryouts; no Confidential tab / View Full Report / At Risk list', async () => {
    render(<HealthUpdatesAdvanced />);
    const ayanRow = (await screen.findAllByText('Ayan Das'))[0].closest('tr');
    fireEvent.click(ayanRow);
    const dialog = await screen.findByRole('dialog');
    // diary moods: today = Sad (20), 2 days ago = Calm (85) → mood 53%; no teacher entries
    const card = (label) => within(dialog).getByText(label).closest('div.rounded-xl');
    expect(within(card('Mood')).getByText('53%')).toBeInTheDocument();
    expect(within(card('Behavior')).getByText('53%')).toBeInTheDocument(); // follows mood when no teacher score
    // engagement: 80 * 0.75 + 4 * 2.5 = 70
    expect(within(card('Engagement')).getByText('70%')).toBeInTheDocument();
    expect(within(dialog).getByText(/2 diary mood days, 0 health entries and 4 tryout attempts/)).toBeInTheDocument();

    expect(within(dialog).queryByRole('button', { name: /Confidential/ })).not.toBeInTheDocument();
    expect(within(dialog).queryByText('View Full Report')).not.toBeInTheDocument();
    expect(within(dialog).queryByText('At Risk Students')).not.toBeInTheDocument();
  });

  test('never asks for or shows diary text — only the mood', async () => {
    render(<HealthUpdatesAdvanced />);
    await screen.findAllByText('Ayan Das');
    const logsCall = global.fetch.mock.calls.map(([u]) => String(u)).find((u) => u.includes('/api/health-records/logs'));
    expect(logsCall).toBeTruthy();
    expect(screen.queryByText(/Dear Diary/)).not.toBeInTheDocument();
  });
});
