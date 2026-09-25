import { useCallback, useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { apiFetch } from '../utils/authSession';
import { notificationId, readModuleSeenState, writeModuleSeenState } from '../utils/moduleNotificationUtils';
import { normalizeAdminPath, resolveAdminNotificationPath } from './adminNotificationUtils';

const API_BASE = (import.meta.env.VITE_API_URL || window.location.origin).replace(/\/$/, '');

// Single source of truth for admin notifications, shared by AdminHeader (bell
// dropdown), AdminSidebar and AdminBottomNav (per-module badge counts) so
// they all read the same poll instead of each running its own fetch loop.
export const useAdminNotifications = ({ isSuperAdmin = false } = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [notifications, setNotifications] = useState([]);
  const [notifLoading, setNotifLoading] = useState(false);
  const [notifError, setNotifError] = useState('');
  const [seenState, setSeenState] = useState(() => readModuleSeenState('admin'));

  const fetchNotifs = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) { setNotifications([]); return; }
    setNotifLoading(true);
    setNotifError('');
    try {
      const res = await apiFetch(`${API_BASE}/api/notifications/user?kind=notification`, {
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (res.status === 304) return;
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error(data?.error || 'Failed to load notifications');
      const all = Array.isArray(data) ? data : [];
      const filtered = all
        .filter((n) => {
          if (isSuperAdmin) return true;
          const aud = String(n?.audience || 'All').toLowerCase();
          return aud === 'all' || aud === 'admin' || aud === 'school_admin' || aud === 'school admin';
        })
        .sort((a, b) => new Date(b?.createdAt || 0) - new Date(a?.createdAt || 0))
        .slice(0, 20);
      setNotifications(filtered);
    } catch (err) {
      setNotifError(err.message || 'Failed to load');
      setNotifications([]);
    } finally {
      setNotifLoading(false);
    }
  }, [isSuperAdmin, navigate]);

  useEffect(() => {
    fetchNotifs();

    const poll = setInterval(() => {
      if (document.visibilityState === 'visible') fetchNotifs();
    }, 15_000);

    const socket = window.io?.(API_BASE, {
      transports: ['websocket', 'polling'],
      auth: { token: localStorage.getItem('token') },
    });
    socket?.on('new_notification', () => fetchNotifs());

    const onVisible = () => { if (document.visibilityState === 'visible') fetchNotifs(); };
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      clearInterval(poll);
      socket?.disconnect?.();
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [fetchNotifs]);

  const unreadCount = useMemo(
    () => notifications.filter((n) => !n?.isRead).length,
    [notifications]
  );

  const markRead = useCallback(async (id) => {
    if (!id) return;
    const token = localStorage.getItem('token');
    if (!token) return;
    setNotifications((prev) =>
      prev.map((n) => (String(n?._id || n?.id || '') === String(id) ? { ...n, isRead: true } : n))
    );
    try {
      const res = await apiFetch(`${API_BASE}/api/notifications/user/${id}/read`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!res.ok) throw new Error('Failed to mark notification as read');
      await fetchNotifs();
    } catch (err) {
      setNotifications((prev) =>
        prev.map((n) => (String(n?._id || n?.id || '') === String(id) ? { ...n, isRead: false } : n))
      );
      setNotifError(err.message || 'Failed to mark notification as read');
    }
  }, [fetchNotifs, navigate]);

  const markAllRead = useCallback(async () => {
    const token = localStorage.getItem('token');
    if (!token) return;
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
    try {
      const res = await apiFetch(`${API_BASE}/api/notifications/user/read-all?kind=notification`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', authorization: `Bearer ${token}` },
      }, navigate);
      if (!res.ok) throw new Error('Failed to mark all notifications as read');
      await fetchNotifs();
    } catch (err) {
      setNotifError(err.message || 'Failed to mark all as read');
      await fetchNotifs();
    }
  }, [fetchNotifs, navigate]);

  // Per-module "seen" tracking is independent of `isRead` — opening the bell
  // dropdown marks everything isRead, but a sidebar badge should only clear
  // once the admin actually visits that module.
  const markModuleVisited = useCallback((path) => {
    const target = normalizeAdminPath(path);
    const matches = notifications.filter(
      (n) => normalizeAdminPath(resolveAdminNotificationPath(n)) === target
    );
    const ids = matches.map(notificationId).filter(Boolean);
    if (ids.length === 0) return;
    setSeenState((prev) => {
      const current = new Set(Array.isArray(prev?.[target]) ? prev[target] : []);
      let changed = false;
      ids.forEach((id) => { if (!current.has(id)) { current.add(id); changed = true; } });
      if (!changed) return prev;
      const next = { ...prev, [target]: [...current] };
      writeModuleSeenState('admin', next);
      return next;
    });
  }, [notifications]);

  useEffect(() => {
    const path = location.pathname;
    const target = normalizeAdminPath(path);
    const visited = notifications.filter(
      (n) => normalizeAdminPath(resolveAdminNotificationPath(n)) === target
    );
    if (visited.length > 0) markModuleVisited(path);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname, notifications]);

  const getModuleCount = useCallback((path) => {
    const target = normalizeAdminPath(path);
    const seenIds = new Set(Array.isArray(seenState?.[target]) ? seenState[target] : []);
    return notifications.filter((n) => {
      const id = notificationId(n);
      if (!id || seenIds.has(id)) return false;
      return normalizeAdminPath(resolveAdminNotificationPath(n)) === target;
    }).length;
  }, [notifications, seenState]);

  return {
    notifications,
    notifLoading,
    notifError,
    unreadCount,
    markRead,
    markAllRead,
    resolveNotifPath: resolveAdminNotificationPath,
    getModuleCount,
  };
};
