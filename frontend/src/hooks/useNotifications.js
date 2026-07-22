import { useState, useEffect, useCallback, useRef } from 'react';

const POLLING_INTERVAL = 45000; // 45 seconds

export const useNotifications = () => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const pollingIntervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');

      if (!token || userType !== 'Student') {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notifications/user`,
        {
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch notifications');
      }

      const data = await response.json();
      const notificationsArray = Array.isArray(data) ? data : [];

      setNotifications(notificationsArray);
      setUnreadCount(notificationsArray.filter(n => !n.isRead).length);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch notifications:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  const markAsRead = useCallback(async (notificationId) => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notifications/user/${notificationId}/read`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to mark as read');
      }

      // Update local state
      setNotifications(prev =>
        prev.map(n => n._id === notificationId ? { ...n, isRead: true } : n)
      );
      setUnreadCount(prev => Math.max(0, prev - 1));

      return true;
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
      return false;
    }
  }, []);

  const dismissNotification = useCallback(async (notificationId) => {
    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notifications/user/${notificationId}/dismiss`,
        {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to dismiss notification');
      }

      // Remove from local state
      setNotifications(prev => prev.filter(n => n._id !== notificationId));
      setUnreadCount(prev => {
        const notification = notifications.find(n => n._id === notificationId);
        return notification && !notification.isRead ? Math.max(0, prev - 1) : prev;
      });

      return true;
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
      return false;
    }
  }, [notifications]);

  const markAllAsRead = useCallback(async () => {
    const previousNotifications = notifications;
    const hadUnread = previousNotifications.some((notification) => !notification.isRead);

    if (!hadUnread) {
      return true;
    }

    // Clear the badge immediately when the notification center is opened.
    setNotifications((prev) => prev.map((notification) => ({ ...notification, isRead: true })));
    setUnreadCount(0);

    try {
      const token = localStorage.getItem('token');

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notifications/user/read-all`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to mark all as read');
      }

      return true;
    } catch (err) {
      console.error('Failed to mark all as read:', err);
      setNotifications(previousNotifications);
      setUnreadCount(previousNotifications.filter((notification) => !notification.isRead).length);
      return false;
    }
  }, [notifications]);

  // Start polling on mount
  useEffect(() => {
    fetchNotifications(); // Initial fetch

    // Set up polling
    pollingIntervalRef.current = setInterval(() => {
      fetchNotifications();
    }, POLLING_INTERVAL);

    // Refetch immediately when the tab regains focus/visibility, since
    // background tabs get their setInterval throttled by the browser and
    // the 45s poll can otherwise take much longer than expected to catch up.
    const onFocus = () => fetchNotifications();
    const onVisible = () => {
      if (document.visibilityState === 'visible') fetchNotifications();
    };
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    // Refetch instantly when a push notification actually arrives (sw.js
    // postMessages every client on 'push'), so the badge updates live
    // instead of waiting for the next poll tick.
    const onServiceWorkerMessage = (event) => {
      if (event?.data?.type === 'push-notification-received') {
        fetchNotifications();
      }
    };
    navigator.serviceWorker?.addEventListener?.('message', onServiceWorkerMessage);

    // Cleanup on unmount
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
      }
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
      navigator.serviceWorker?.removeEventListener?.('message', onServiceWorkerMessage);
    };
  }, [fetchNotifications]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
    markAsRead,
    dismissNotification,
    markAllAsRead,
    refresh: fetchNotifications
  };
};
