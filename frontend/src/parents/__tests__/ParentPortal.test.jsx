import React from 'react';
import { render, screen, waitFor, fireEvent, act, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import '@testing-library/jest-dom';
import ParentPortal from '../ParentPortal';
import {
  mockParentProfile,
} from './__mocks__/mockData';
import {
  mockAuthToken,
  clearAllMocks,
  createMockFetch,
  mockMatchMedia,
} from './__utils__/testUtils';

// Mock child components
jest.mock('../AttendanceReport', () => {
  return function AttendanceReport() {
    return <div data-testid="attendance-report">Attendance Report</div>;
  };
});

jest.mock('../AcademicReport', () => {
  return function AcademicReport() {
    return <div data-testid="academic-report">Academic Report</div>;
  };
});

jest.mock('../FeesPayment', () => {
  return function FeesPayment() {
    return <div data-testid="fees-payment">Fees Payment</div>;
  };
});

jest.mock('../HealthReport', () => {
  return function HealthReport() {
    return <div data-testid="health-report">Health Report</div>;
  };
});

jest.mock('../ComplaintManagementSystem', () => {
  return function ComplaintManagementSystem() {
    return <div data-testid="complaint-system">Complaint System</div>;
  };
});

jest.mock('../AchievementsView', () => {
  return function AchievementsView() {
    return <div data-testid="achievements-view">Achievements View</div>;
  };
});

jest.mock('../PTMPortal', () => {
  return function PTMPortal() {
    return <div data-testid="ptm-portal">PTM Portal</div>;
  };
});

jest.mock('../ParentDashboard', () => {
  return function ParentDashboard({ parentName, childrenNames }) {
    return (
      <div data-testid="parent-dashboard">
        <div data-testid="parent-name">{parentName}</div>
        <div data-testid="children-count">{childrenNames?.length || 0}</div>
      </div>
    );
  };
});

jest.mock('../ParentObservationNonAcademic', () => {
  return function ParentObservationNonAcademic() {
    return <div data-testid="parent-observation">Parent Observation</div>;
  };
});

jest.mock('../ParentChat', () => {
  return function ParentChat() {
    return <div data-testid="parent-chat">Parent Chat</div>;
  };
});

jest.mock('../ClassRoutine', () => {
  return function ClassRoutine() {
    return <div data-testid="class-routine">Class Routine</div>;
  };
});

jest.mock('../HolidayList', () => {
  return function HolidayList() {
    return <div data-testid="holiday-list">Holiday List</div>;
  };
});

jest.mock('../../utils/authSession', () => ({
  AUTH_NOTICE: {
    LOGGED_OUT: 'Logged out successfully',
    EXPIRED: 'expired',
  },
  apiFetch: jest.fn((url, options) => global.fetch(url, options)),
  logoutAndRedirect: jest.fn(),
}));

describe('ParentPortal', () => {
  let mockFetch;

  beforeEach(() => {
    jest.clearAllMocks();
    // Mock localStorage to return token
    global.localStorage.getItem = jest.fn((key) => {
      if (key === 'token') return 'test-token';
      return null;
    });
    mockMatchMedia(false); // Desktop by default

    mockFetch = createMockFetch({
      'http://localhost:5000/api/parent/auth/profile': {
        ok: true,
        data: mockParentProfile,
      },
      '/api/parent/auth/profile': {
        ok: true,
        data: mockParentProfile,
      },
    });
    global.fetch = mockFetch;

    // Reset window size
    global.innerWidth = 1024;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Render Tests', () => {
    test('renders without crashing', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });
    });

    test('displays all navigation menu items', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      const nav = within(screen.getByLabelText('Sidebar navigation'));
      [
        'Dashboard',
        'Growth Analytics',
        'Report Card',
        'Attendance',
        'Achievements',
        'Health Record',
        'Class Routine',
        'Holidays',
        'Fees',
        'Chat',
        'Meetings',
        'Complaints',
        'Observations',
        'Excuse Letters',
      ].forEach((label) => {
        expect(nav.getByText(label)).toBeInTheDocument();
      });
      // Grouped navigation headings
      ['Progress', 'Schedule', 'Money', 'Talk to school'].forEach((heading) => {
        expect(nav.getByText(heading)).toBeInTheDocument();
      });
    });
  });

  describe('Profile Loading Tests', () => {
    test('loads parent profile on mount', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(
          expect.stringContaining('/api/parent/auth/profile'),
          expect.objectContaining({
            method: 'GET',
            headers: expect.objectContaining({
              authorization: 'Bearer test-token',
            }),
          })
        );
      }, { timeout: 5000 });
    });

    test('displays parent name when profile is loaded', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(mockParentProfile.name).length).toBeGreaterThan(0);
      }, { timeout: 5000 });
    });

    test('displays children count correctly', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent === '2 children';
        })).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    test('handles profile loading failure gracefully', async () => {
      mockFetch = createMockFetch({
        '/api/parent/auth/profile': {
          ok: false,
          status: 500,
        },
      });
      global.fetch = mockFetch;

      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      consoleSpy.mockRestore();
    });

    test('does not load profile if no token exists', async () => {
      global.localStorage.getItem = jest.fn(() => null);

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      expect(mockFetch).not.toHaveBeenCalled();
    });
  });

  describe('Navigation Tests', () => {
    test('navigates to attendance report', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      const attendanceLink = screen.getByText('Attendance');
      fireEvent.click(attendanceLink);

      await waitFor(() => {
        expect(screen.getByTestId('attendance-report')).toBeInTheDocument();
      });
    });

    test('navigates to academic report', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      const academicLink = screen.getByText('Report Card');
      fireEvent.click(academicLink);

      await waitFor(() => {
        expect(screen.getByTestId('academic-report')).toBeInTheDocument();
      });
    });

    test('navigates to fees payment', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      const feesLink = screen.getAllByText('Fees')[0];
      fireEvent.click(feesLink);

      await waitFor(() => {
        expect(screen.getByTestId('fees-payment')).toBeInTheDocument();
      });
    });

    test('navigates to PTM portal', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      const ptmLink = screen.getByText('Meetings');
      fireEvent.click(ptmLink);

      await waitFor(() => {
        expect(screen.getByTestId('ptm-portal')).toBeInTheDocument();
      });
    });

    test('navigates to chat', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      const chatLink = screen.getByText('Chat');
      fireEvent.click(chatLink);

      await waitFor(() => {
        expect(screen.getByTestId('parent-chat')).toBeInTheDocument();
      });
    });
  });

  describe('Sidebar Tests', () => {
    test('sidebar is open by default on desktop', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        const sidebar = screen.getByLabelText('Sidebar navigation');
        expect(sidebar).toHaveClass('lg:w-80');
      });
    });

    test('sidebar can be collapsed', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Sidebar navigation')).toBeInTheDocument();
      });

      const collapseButton = screen.getByLabelText('Collapse sidebar');
      fireEvent.click(collapseButton);

      await waitFor(() => {
        const sidebar = screen.getByLabelText('Sidebar navigation');
        expect(sidebar).toHaveClass('w-20');
      });
    });

    test('sidebar can be expanded', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Sidebar navigation')).toBeInTheDocument();
      });

      // Collapse first
      const collapseButton = screen.getByLabelText('Collapse sidebar');
      fireEvent.click(collapseButton);

      await waitFor(() => {
        const sidebar = screen.getByLabelText('Sidebar navigation');
        expect(sidebar).toHaveClass('w-20');
      });

      // Expand
      const expandButton = screen.getByLabelText('Expand sidebar');
      fireEvent.click(expandButton);

      await waitFor(() => {
        const sidebar = screen.getByLabelText('Sidebar navigation');
        expect(sidebar).toHaveClass('lg:w-80');
      });
    });

    test('mobile "More" sheet lists navigation and closes after a pick', async () => {
      global.innerWidth = 500;
      mockMatchMedia(true); // Mobile

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      fireEvent.click(screen.getByLabelText('More'));
      const sheet = await screen.findByRole('dialog', { name: 'Menu' });
      const attendanceLink = within(sheet).getByText('Attendance');
      fireEvent.click(attendanceLink);

      await waitFor(() => {
        expect(screen.getByTestId('attendance-report')).toBeInTheDocument();
      });
      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
    });

    test('shows mobile menu button when sidebar is closed', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText('Sidebar navigation')).toBeInTheDocument();
      });

      // Collapse sidebar
      const collapseButton = screen.getByLabelText('Collapse sidebar');
      fireEvent.click(collapseButton);

      // Temporarily modify window size to mobile
      global.innerWidth = 500;

      // The mobile button might be shown
      await waitFor(() => {
        const sidebar = screen.getByLabelText('Sidebar navigation');
        expect(sidebar).toHaveClass('w-20');
      });
    });
  });

  describe('Logout Tests', () => {
    test('logout button is visible', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });
    });

    test('clicking logout opens a confirmation, then calls logoutAndRedirect', async () => {
      const { logoutAndRedirect } = require('../../utils/authSession');

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Logout')).toBeInTheDocument();
      });

      // Sidebar "Logout" opens the confirmation dialog — it does not log out immediately.
      fireEvent.click(screen.getByText('Logout'));
      expect(logoutAndRedirect).not.toHaveBeenCalled();

      const dialog = within(screen.getByText('Confirm Logout').closest('div'));
      fireEvent.click(dialog.getByRole('button', { name: 'Logout' }));

      expect(logoutAndRedirect).toHaveBeenCalled();
    });
  });

  describe('Active Route Highlighting', () => {
    test('dashboard link is highlighted when on dashboard route', async () => {
      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      const nav = within(screen.getByLabelText('Sidebar navigation'));
      const dashboardLink = nav.getByText('Dashboard').closest('a');
      expect(dashboardLink).toHaveAttribute('aria-current', 'page');
      expect(dashboardLink).toHaveClass('bg-violet-50');
      expect(dashboardLink).toHaveClass('border-violet-600');
    });

    test('attendance link is highlighted when on attendance route', async () => {
      render(
        <MemoryRouter initialEntries={['/parents/attendance']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        const attendanceLink = screen.getAllByText('Attendance')[0].closest('a');
        expect(attendanceLink).toHaveAttribute('aria-current', 'page');
        expect(attendanceLink).toHaveClass('bg-violet-50');
        expect(attendanceLink).toHaveClass('border-violet-600');
      });
    });
  });

  describe('Responsive Behavior', () => {
    test('mobile shell renders the app bar and bottom navigation', async () => {
      global.innerWidth = 500;

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      const bottomNav = screen.getByRole('navigation', { name: 'Primary' });
      expect(within(bottomNav).getByText('Dashboard')).toBeInTheDocument();
      expect(within(bottomNav).getByText('Fees')).toBeInTheDocument();
      expect(within(bottomNav).getByLabelText('More')).toBeInTheDocument();
    });

    test('mobile bell opens the notifications sheet with items', async () => {
      global.innerWidth = 500;
      mockFetch = createMockFetch({
        '/api/parent/auth/profile': { ok: true, data: mockParentProfile },
        'http://localhost:5000/api/parent/auth/profile': { ok: true, data: mockParentProfile },
        'http://localhost:5000/api/notifications/user': {
          ok: true,
          data: [{ _id: 'n1', title: 'Fee due soon', message: 'Pay by Friday', isRead: false, createdAt: new Date().toISOString(), type: 'fee' }],
        },
      });
      global.fetch = mockFetch;

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByTestId('parent-dashboard')).toBeInTheDocument();
      });

      expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
      const appBar = screen.getByRole('banner');
      fireEvent.click(within(appBar).getByLabelText('Notifications'));

      const sheet = await screen.findByRole('dialog', { name: 'Notifications' });
      await waitFor(() => {
        expect(within(sheet).getByText('Fee due soon')).toBeInTheDocument();
      });
    });

    test('opening then dismissing the mobile menu sheet', async () => {
      global.innerWidth = 500;

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
      fireEvent.click(screen.getByLabelText('More'));
      expect(await screen.findByRole('dialog', { name: 'Menu' })).toBeInTheDocument();

      fireEvent.click(screen.getByLabelText('Close menu'));
      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Menu' })).not.toBeInTheDocument();
      });
    });
  });

  describe('Edge Cases', () => {
    test('handles parent profile with no children', async () => {
      mockFetch = createMockFetch({
        'http://localhost:5000/api/parent/auth/profile': {
          ok: true,
          data: {
            ...mockParentProfile,
            children: [],
          },
        },
        '/api/parent/auth/profile': {
          ok: true,
          data: {
            ...mockParentProfile,
            children: [],
          },
        },
      });
      global.fetch = mockFetch;

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent === 'Your children';
        })).toBeInTheDocument();
      });
    });

    test('handles parent profile with single child', async () => {
      mockFetch = createMockFetch({
        'http://localhost:5000/api/parent/auth/profile': {
          ok: true,
          data: {
            ...mockParentProfile,
            children: [mockParentProfile.children[0]],
          },
        },
        '/api/parent/auth/profile': {
          ok: true,
          data: {
            ...mockParentProfile,
            children: [mockParentProfile.children[0]],
          },
        },
      });
      global.fetch = mockFetch;

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText((content, element) => {
          return element?.textContent === '1 child';
        })).toBeInTheDocument();
      }, { timeout: 5000 });
    });

    test('displays default text when parent profile is not loaded', async () => {
      mockFetch = createMockFetch({});
      global.fetch = mockFetch;

      render(
        <MemoryRouter initialEntries={['/parents']}>
          <Routes>
            <Route path="/parents/*" element={<ParentPortal />} />
          </Routes>
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText('Parent Portal')).toBeInTheDocument();
      });
    });
  });
});
