import { useState, useEffect, useCallback, useRef } from 'react';
import { subscribeSocketEvent } from './useCommunityWallUnread';
import { readCachedNotifications, writeCachedNotifications } from '../utils/notificationCache';

const POLLING_INTERVAL = 45000; // 45 seconds
const CACHE_KIND = 'student-bell';

export const useNotifications = () => {
  // Seed from the client cache so the bell opens instantly; polling refreshes it.
  const [notifications, setNotifications] = useState(() => readCachedNotifications(CACHE_KIND) || []);
  const [unreadCount, setUnreadCount] = useState(() => (readCachedNotifications(CACHE_KIND) || []).filter((n) => !n.isRead).length);
  const [loading, setLoading] = useState(() => !readCachedNotifications(CACHE_KIND));
  const [error, setError] = useState(null);
  const pollingIntervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      if (typeof fetch !== 'function') {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }
      const token = localStorage.getItem('token');
      const userType = localStorage.getItem('userType');

      if (!token || userType !== 'Student') {
        setNotifications([]);
        setUnreadCount(0);
        setLoading(false);
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/notifications/user?kind=notification`,
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
      writeCachedNotifications(notificationsArray, CACHE_KIND);
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
    const dismissedNotification = notifications.find(n => n._id === notificationId);

    // Remove immediately so the swipe gesture feels direct; refresh from the
    // server if persistence fails.
    setNotifications(prev => prev.filter(n => n._id !== notificationId));
    if (dismissedNotification && !dismissedNotification.isRead) {
      setUnreadCount(prev => Math.max(0, prev - 1));
    }

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

      return true;
    } catch (err) {
      console.error('Failed to dismiss notification:', err);
      await fetchNotifications();
      return false;
    }
  }, [fetchNotifications, notifications]);

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
        `${import.meta.env.VITE_API_URL}/api/notifications/user/read-all?kind=notification`,
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

    // Instant refresh when the server says a notification was just created.
    const unsubscribeSocket = subscribeSocketEvent('new_notification', () => fetchNotifications());

    // Cleanup on unmount
    return () => {
      unsubscribeSocket();
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
