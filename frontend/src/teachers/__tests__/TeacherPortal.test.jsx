import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import TeacherPortal from '../TeacherPortal';

const mockCreateComponent = (label) => {
  const Component = () => <div data-testid={`${label.replace(/\s+/g, '-')}-page`}>{label}</div>;
  return { __esModule: true, default: Component };
};

const componentMocks = {
  '../TeacherDashboard': 'Teacher Dashboard',
  '../MyWorkPortal': 'My Work Portal',
  '../ClassRoutine': 'Class Routine',
  '../HolidayList': 'Holiday List',
  '../AttendanceManagement': 'Attendance',
  '../StudentAnalyticsPortal': 'Student Analytics',
  '../HealthUpdatesAdvanced': 'Health Updates',
  '../ParentMeetings': 'Parent Meetings',
  '../AssignmentPortal': 'Assignments',
  '../LessonPlanDashboard': 'Lesson Plans',
  '../TeacherChat': 'Teacher Chat',
  '../AILearningPath': 'AI Learning',
  '../AIPoweredTeaching': 'Smart Teaching',
  '../StudentObservationOverview': 'Student Observations',
  '../ClassNotes': 'Class Notes',
  '../PracticeQuestions': 'Practice Questions',
  '../TeacherFeedbackPortal': 'Teacher Feedback',
  '../ExcuseLetters': 'Excuse Letters',
  '../ExamManagement': 'Exam Management',
  '../ResultManagement': 'Result Management',
  '../TestTeacherPortal': 'Test Portal',
};

Object.entries(componentMocks).forEach(([path, mockLabel]) => {
  jest.mock(path, () => mockCreateComponent(mockLabel));
});

jest.mock('../../utils/authSession', () => ({
  AUTH_NOTICE: { LOGGED_OUT: 'LOGGED_OUT' },
  logoutAndRedirect: jest.fn(),
}));

  const renderPortal = (initialEntry = '/teacher/dashboard') =>
    render(
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/teacher/*" element={<TeacherPortal />} />
        </Routes>
    </MemoryRouter>
  );

describe('TeacherPortal', () => {
  const profileResponse = {
    name: 'Priya Sharma',
    department: 'Mathematics',
    profilePic: '',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    window.innerWidth = 1280;
    localStorage.setItem('token', 'test-token');
    global.fetch = jest.fn(() =>
      Promise.resolve({
        ok: true,
        json: () => Promise.resolve(profileResponse),
      })
    );
  });

  afterEach(() => {
    localStorage.clear();
  });

  test('renders teacher dashboard header information', async () => {
    renderPortal('/teacher/dashboard');

    expect(global.fetch).toHaveBeenCalled();
    const priyaMentions = await screen.findAllByText(/Priya/i);
    expect(priyaMentions.length).toBeGreaterThan(0);
    expect(screen.getAllByText('PS')[0]).toBeInTheDocument();
    expect(screen.getAllByText('Dashboard').length).toBeGreaterThan(0);
  });

  test('opens student section and navigates to analytics page', async () => {
    renderPortal('/teacher/classes/current/students');

    const analyticsLink = await screen.findByRole('link', { name: /Student Analytics/i });
    await userEvent.click(analyticsLink);

    const analyticsMentions = await screen.findAllByText('Student Analytics');
    expect(analyticsMentions.length).toBeGreaterThan(0);
  });

  test('opens profile dropdown when avatar is clicked', async () => {
    renderPortal('/teacher/dashboard');
    const profileButton = await screen.findByLabelText(/profile menu/i);

    await userEvent.click(profileButton);

    expect(screen.getByText(/My Profile/i)).toBeInTheDocument();
    const signOutNodes = screen.getAllByText(/Sign out/i).map((node) => node.textContent?.trim());
    expect(signOutNodes).toContain('Sign out');
  });
});
