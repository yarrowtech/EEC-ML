import React from 'react';
import { render, screen, fireEvent, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import AdminHeader from '../AdminHeader';

jest.mock('../../hooks/useDesktopNotificationBridge', () => ({
  useDesktopNotificationBridge: () => ({
    showPermissionModal: false,
    pendingCount: 0,
    syncNotifications: jest.fn(),
    requestPermissionFromModal: jest.fn(),
    dismissPermissionModal: jest.fn(),
  }),
}));

jest.mock('../../components/DesktopNotificationPermissionModal', () => () => null);

const flush = () => act(() => new Promise((r) => setTimeout(r, 0)));

const NOTIFS = [
  { _id: 'n1', title: 'Fee reminder', message: 'Due soon', audience: 'Admin', isRead: false, createdAt: new Date().toISOString() },
];

beforeEach(() => {
  localStorage.setItem('token', 'x.y.z');
  global.fetch = jest.fn((url) => {
    if (String(url).includes('/api/notifications/user') && !String(url).includes('read')) {
      return Promise.resolve({ ok: true, status: 200, json: async () => NOTIFS });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });
});

const renderHeader = (props = {}) =>
  render(
    <MemoryRouter>
      <AdminHeader
        adminUser={{ name: 'Priya', role: 'School Admin', schoolName: 'Kelomal Santoshini High School' }}
        onOpenMobileSidebar={jest.fn()}
        onLogoutRequest={jest.fn()}
        {...props}
      />
    </MemoryRouter>,
  );

test('renders the glass header with school identity and search', async () => {
  renderHeader();
  expect(screen.getAllByText('Kelomal Santoshini High School').length).toBeGreaterThan(0);
  expect(screen.getByPlaceholderText('Search modules…')).toBeInTheDocument();
  await flush();
});

test('shows the unread notification badge and opens the panel', async () => {
  renderHeader();
  await flush();
  await flush();
  const bell = screen.getByLabelText('Notifications');
  expect(screen.getByText('1')).toBeInTheDocument(); // unread badge
  fireEvent.click(bell);
  await flush();
  expect(screen.getByText('Fee reminder')).toBeInTheDocument();
});

test('search suggestions navigate; profile menu exposes logout', async () => {
  const onLogoutRequest = jest.fn();
  renderHeader({ onLogoutRequest });
  const input = screen.getByPlaceholderText('Search modules…');
  fireEvent.focus(input);
  fireEvent.change(input, { target: { value: 'teacher' } });
  expect(screen.getByText('Teachers')).toBeInTheDocument();

  // Profile pill shows the school identity + role; open it and log out.
  fireEvent.click(screen.getByText('School Admin').closest('button'));
  expect(screen.getByText('Priya')).toBeInTheDocument(); // dropdown user card
  fireEvent.click(screen.getByText('Logout'));
  expect(onLogoutRequest).toHaveBeenCalled();
});
