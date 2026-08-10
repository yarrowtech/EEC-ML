/* global jest, describe, beforeEach, test, expect */
import React from 'react';
import { render, screen } from '@testing-library/react';
import { StudentDashboardProvider, useStudentDashboard } from '../StudentDashboardContext';
import { fetchCachedJson } from '../../utils/studentApiCache';

jest.mock('../../utils/studentApiCache', () => ({
  fetchCachedJson: jest.fn(),
}));

jest.mock('../../utils/studentCache', () => ({
  clearCacheEntry: jest.fn(),
  readCacheEntry: jest.fn(() => null),
  writeCacheEntry: jest.fn(),
}));

const DashboardState = () => {
  const { loading, profile, classTeacher } = useStudentDashboard();
  return (
    <div>
      <span>{loading ? 'Loading dashboard' : profile?.name || 'No profile'}</span>
      <span>{classTeacher?.name || 'Teacher pending'}</span>
    </div>
  );
};

describe('StudentDashboardProvider loading priority', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    localStorage.setItem('token', 'student-token');
    localStorage.setItem('userType', 'Student');
  });

  test('renders dashboard data without waiting for class-teacher metadata', async () => {
    fetchCachedJson.mockImplementation((url) => {
      if (url.includes('/class-teacher')) return new Promise(() => {});
      return Promise.resolve({
        data: {
          profile: { name: 'Asha' },
          stats: { attendancePercentage: 92 },
          recentAttendance: [],
        },
      });
    });

    render(
      <StudentDashboardProvider>
        <DashboardState />
      </StudentDashboardProvider>
    );

    expect(await screen.findByText('Asha')).toBeInTheDocument();
    expect(screen.getByText('Teacher pending')).toBeInTheDocument();
  });
});
