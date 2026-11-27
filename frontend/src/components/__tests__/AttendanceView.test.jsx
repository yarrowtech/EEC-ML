import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AttendanceView from '../AttendanceView';

const renderAttendance = (path = '/student/attendance') => render(
  <MemoryRouter initialEntries={[path]}>
    <AttendanceView />
  </MemoryRouter>
);

describe('AttendanceView', () => {
  beforeEach(() => {
    localStorage.setItem('token', 'student-token');
    const today = new Date();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const date = (day) => today.getFullYear() + '-' + month + '-' + day + 'T00:00:00.000Z';
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        summary: { totalClasses: 20, presentDays: 18, absentDays: 2, attendancePercentage: 90 },
        attendance: [
          { date: date('01'), status: 'present' },
          { date: date('02'), status: 'absent' },
        ],
      }),
    });
  });

  afterEach(() => localStorage.clear());

  test('shows total attendance before the calendar', async () => {
    renderAttendance();
    expect(await screen.findByRole('heading', { name: 'Total Attendance' })).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
    expect(screen.getAllByRole('heading', { level: 2 }).map((heading) => heading.textContent.trim()))
      .toEqual(['Total Attendance', expect.any(String)]);
    const absentDay = screen.getByRole('button', { name: /: Absent$/ });
    fireEvent.click(absentDay);
    expect(absentDay).toHaveAttribute('aria-pressed', 'true');
    expect(screen.queryByText('0 present, 1 absent')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next month' })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    fireEvent.click(screen.getByRole('button', { name: 'Next month' }));
    expect(screen.queryByRole('button', { name: 'Next month' })).not.toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Total Attendance' })).toBeInTheDocument();
    expect(screen.getByText('90%')).toBeInTheDocument();
  });

  test('opens the attendance history and respects the daily filter query', async () => {
    renderAttendance('/student/attendance?filter=present');
    expect(await screen.findByRole('heading', { name: /Day-by-Day Attendance/ })).toHaveTextContent('(1 day)');
    expect(screen.getByRole('button', { name: /^present$/i })).toHaveAttribute('aria-pressed', 'true');
    fireEvent.click(screen.getByRole('button', { name: 'Back to overview' }));
    fireEvent.click(screen.getByRole('button', { name: 'View All' }));
    expect(screen.getByRole('heading', { name: /Day-by-Day Attendance/ })).toHaveTextContent('(2 days)');
  });

  test('limits calendar navigation to the assigned class session', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        session: { name: '2024-2025', className: '6', startDate: '2024-04-02', endDate: '2025-03-28' },
        attendance: [{ date: '2025-03-28T00:00:00.000Z', dateKey: '2025-03-28', status: 'present' }],
      }),
    });
    renderAttendance();

    expect(await screen.findByRole('heading', { name: 'March 2025' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Refresh attendance' })).toHaveTextContent(/^$/);
    expect(screen.getByRole('button', { name: /Mar 28, 2025: Present/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Mar 29, 2025/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Next month' })).not.toBeInTheDocument();
    for (let month = 0; month < 11; month += 1) {
      fireEvent.click(screen.getByRole('button', { name: 'Previous month' }));
    }
    expect(screen.getByRole('heading', { name: 'April 2024' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Previous month' })).not.toBeInTheDocument();
  });
});
