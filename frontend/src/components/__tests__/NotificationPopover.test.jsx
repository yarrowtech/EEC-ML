/* eslint-disable no-undef */
import React from 'react';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationPopover from '../NotificationPopover';

const notifications = [
  {
    _id: 'notification-1',
    title: 'Exam routine published',
    message: 'The Class 5 exam schedule is now available.',
    createdAt: new Date().toISOString(),
    isRead: false,
  },
  {
    _id: 'notification-2',
    title: 'New notice: Sports day',
    message: 'Sports day is on Friday.',
    createdAt: '2026-08-20T10:00:00.000Z',
    isRead: true,
  },
];

describe('NotificationPopover', () => {
  test('groups notifications and preserves the open / mark-all actions', async () => {
    const user = userEvent.setup();
    const onMarkAllRead = jest.fn();
    const onOpenNotification = jest.fn();
    render(
      <NotificationPopover
        notifications={notifications}
        unreadCount={1}
        onMarkAllRead={onMarkAllRead}
        onOpenNotification={onOpenNotification}
      />
    );

    expect(screen.getByTestId('notification-popover')).toHaveClass('bg-white');
    expect(screen.getByText('Today')).toBeInTheDocument();
    expect(screen.getByText('Earlier')).toBeInTheDocument();
    expect(screen.getByText('The Class 5 exam schedule is now available.')).toBeInTheDocument();
    expect(screen.getByText('20 Aug')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /^Mark all as read$/i }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: 'Exam routine published' }));
    expect(onOpenNotification).toHaveBeenCalledWith(notifications[0]);
  });

  test('shows the poster photo and filters with search', async () => {
    const user = userEvent.setup();
    const withAvatar = [{ ...notifications[0], senderAvatar: 'https://example.com/admin.jpg' }, notifications[1]];
    const { container } = render(<NotificationPopover notifications={withAvatar} unreadCount={1} />);

    expect(container.querySelector('img[src="https://example.com/admin.jpg"]')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Notification options/i })).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Search notifications' }));
    await user.type(screen.getByRole('textbox', { name: 'Search notifications' }), 'sports');
    const panel = screen.getByTestId('notification-popover');
    expect(within(panel).queryByText('Exam routine published')).not.toBeInTheDocument();
    expect(within(panel).getByText('New notice: Sports day')).toBeInTheDocument();
  });
});
