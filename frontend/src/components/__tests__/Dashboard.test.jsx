import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import Dashboard from '../Dashboard';

const mockNavigate = jest.fn();
let mockPathname = '/student';
const mockAssignmentHandle = { saveJournal: jest.fn() };
let latestMobileNavProps = null;
let latestDashboardHomeProps = null;

jest.mock('react-router-dom', () => ({
  useLocation: () => ({ pathname: mockPathname }),
  useNavigate: () => mockNavigate,
}));

jest.mock('../Sidebar', () => {
  const React = require('react');
  return ({ activeView }) => React.createElement('div', { 'data-testid': 'sidebar', 'data-active-view': activeView });
});

jest.mock('../Header', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'header' });
});

jest.mock('../DashboardHome', () => {
  const React = require('react');
  return (props) => {
    latestDashboardHomeProps = props;
    return React.createElement('div', { 'data-testid': 'dashboard-home' });
  };
});

jest.mock('../AttendanceView', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'attendance-view' });
});

jest.mock('../RoutineView', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'routine-view' });
});

jest.mock('../AssignmentView', () => {
  const React = require('react');
  return React.forwardRef((props, ref) => {
    React.useImperativeHandle(ref, () => mockAssignmentHandle);
    return React.createElement('div', { 'data-testid': `assignment-view-${props.defaultType || 'default'}` });
  });
});

jest.mock('../CoursesView', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'courses-view' });
});

jest.mock('../ResultsView', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'results-view' });
});

jest.mock('../AchievementsView', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'achievements-view' });
});

jest.mock('../ThemeCustomizer', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'theme-customizer' });
});

jest.mock('../ProfileUpdate', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'profile-update' });
});

jest.mock('../NoticeBoard', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'noticeboard-view' });
});

jest.mock('../TeacherFeedback', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'teacher-feedback-view' });
});

jest.mock('../StudentChat', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'student-chat-view' });
});

jest.mock('../ExcuseLetter', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'excuse-letter-view' });
});

jest.mock('../LearningHub', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'learning-hub-view' });
});

jest.mock('../AcademicAlcove', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'academic-alcove-view' });
});

jest.mock('../StudentWellbeing', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'student-wellbeing-view' });
});

jest.mock('../LessonPlanStatusView', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'lesson-plan-status-view' });
});

jest.mock('../StudyMaterials', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'study-materials-view' });
});

jest.mock('../StudentDashboardContext', () => {
  const React = require('react');
  return {
    StudentDashboardProvider: ({ children }) => React.createElement('div', { 'data-testid': 'student-dashboard-provider' }, children),
  };
});

jest.mock('../MobileBottomNav', () => {
  const React = require('react');
  return (props) => {
    latestMobileNavProps = props;
    return React.createElement('div', { 'data-testid': 'mobile-bottom-nav' });
  };
});

jest.mock('../HolidayListView', () => {
  const React = require('react');
  return () => React.createElement('div', { 'data-testid': 'holiday-list-view' });
});

describe('Dashboard', () => {
  beforeEach(() => {
    mockPathname = '/student';
    mockNavigate.mockClear();
    mockAssignmentHandle.saveJournal.mockClear();
    latestMobileNavProps = null;
    latestDashboardHomeProps = null;
  });

  test('renders attendance view for /student/attendance', () => {
    mockPathname = '/student/attendance';

    render(<Dashboard />);

    expect(screen.getByTestId('attendance-view')).toBeInTheDocument();
    expect(latestMobileNavProps?.activeView).toBe('attendance');
  });

  test('normalizes /dashboard paths to /student equivalents', async () => {
    mockPathname = '/dashboard/assignments';

    render(<Dashboard />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/student/assignments', { replace: true });
    });
    expect(screen.getByTestId('assignment-view-school')).toBeInTheDocument();
  });

  test('navigates to /student when active view is unknown', async () => {
    mockPathname = '/student/unknown-section';

    render(<Dashboard />);

    await waitFor(() => {
      expect(mockNavigate).toHaveBeenCalledWith('/student', { replace: true });
    });
    expect(screen.getByTestId('dashboard-home')).toBeInTheDocument();
  });

  test('setActiveView navigates to the derived route', () => {
    mockPathname = '/student';

    render(<Dashboard />);

    expect(latestDashboardHomeProps).toBeTruthy();
    act(() => {
      latestDashboardHomeProps.setActiveView('attendance');
    });
    expect(mockNavigate).toHaveBeenCalledWith('/student/attendance');
  });

  test('tapping save journal triggers AssignmentView ref handler', () => {
    mockPathname = '/student/assignments-journal';

    render(<Dashboard />);

    expect(screen.getByTestId('assignment-view-journal')).toBeInTheDocument();
    expect(latestMobileNavProps?.activeView).toBe('assignments-journal');

    act(() => {
      latestMobileNavProps.onSaveJournal();
    });

    expect(mockAssignmentHandle.saveJournal).toHaveBeenCalled();
  });
});
