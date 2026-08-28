/* eslint-disable no-undef */
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import NotificationPopover from '../NotificationPopover';

const notifications = [{
  _id: 'notification-1',
  title: 'Exam routine published',
  message: 'The Class 5 exam schedule is now available.',
  createdAt: '2026-08-20T10:00:00.000Z',
  isRead: false,
}];

describe('NotificationPopover', () => {
  test('renders live notification content and preserves notification actions', async () => {
    const user = userEvent.setup();
    const onMarkAllRead = jest.fn();
    const onOpenNotification = jest.fn();
    render(
      <NotificationPopover
        notifications={notifications}
        unreadCount={1}
        onMarkAllRead={onMarkAllRead}
        onOpenNotification={onOpenNotification}
        onDismissNotification={jest.fn()}
        formatTime={() => '1 Aug'}
      />
    );

    expect(screen.getByTestId('notification-popover')).toHaveClass('bg-white');
    expect(screen.getByText('The Class 5 exam schedule is now available.')).toBeInTheDocument();
    expect(screen.getByText('1 Aug')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /Mark all read/i }));
    expect(onMarkAllRead).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole('button', { name: /Exam routine published.*Swipe left/i }));
    expect(onOpenNotification).toHaveBeenCalledWith(notifications[0]);
  });

  test('supports accessible dismissal in addition to swipe dismissal', () => {
    const onDismissNotification = jest.fn();
    render(
      <NotificationPopover
        notifications={notifications}
        onDismissNotification={onDismissNotification}
        formatTime={() => '1 Aug'}
      />
    );

    fireEvent.keyDown(screen.getByRole('button', { name: /Exam routine published.*Swipe left/i }), { key: 'Delete' });
    expect(onDismissNotification).toHaveBeenCalledWith('notification-1');
  });
});
