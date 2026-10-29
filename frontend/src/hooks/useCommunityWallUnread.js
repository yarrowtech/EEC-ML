import { useCallback, useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';

const API = import.meta.env.VITE_API_URL;
const POLL_MS = 60000;
// CommunityWall dispatches this after it records a view, so badges clear right away.
export const COMMUNITY_WALL_CHANGED_EVENT = 'community-wall:changed';

const resolveSocketUrl = () => {
  const configured = String(API || '').trim().replace(/\/$/, '').replace(/\/api$/, '');
  if (configured) return configured;
  return typeof window !== 'undefined' ? window.location.origin : 'http://localhost:5000';
};

// One socket per tab, shared by every hook instance (header + sidebar), so a new
// post shows up in the bell and badge the moment it's created.
let sharedSocket = null;
let socketUsers = 0;
const acquireSocket = () => {
  const token = localStorage.getItem('token');
  if (!token) return null;
  if (!sharedSocket) {
    sharedSocket = io(resolveSocketUrl(), { auth: { token }, transports: ['websocket', 'polling'] });
  }
  socketUsers += 1;
  return sharedSocket;
};
const releaseSocket = () => {
  socketUsers = Math.max(0, socketUsers - 1);
  if (socketUsers === 0 && sharedSocket) {
    sharedSocket.disconnect?.();
    sharedSocket = null;
  }
};

// Listen to any server push event on the shared socket. Returns an unsubscribe function.
export const subscribeSocketEvent = (event, handler) => {
  const socket = acquireSocket();
  if (!socket) return () => {};
  socket.on?.(event, handler);
  return () => {
    socket.off?.(event, handler);
    releaseSocket();
  };
};

// For screens that aren't badges (the wall feed itself): calls onChange(payload) whenever
// the school's wall changes. Returns an unsubscribe function.
export const subscribeWallChanges = (onChange) => {
  const socket = acquireSocket();
  if (!socket) return () => {};
  socket.on?.('community-wall:changed', onChange);
  return () => {
    socket.off?.('community-wall:changed', onChange);
    releaseSocket();
  };
};

const authHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

// Unread Community Wall posts for one portal: a count for the sidebar badge and
// bell-ready items. `wallPath` is that portal's wall route; items link to
// `${wallPath}?post=<id>`, which opens the post's details modal.
const useCommunityWallUnread = ({ enabled = true, wallPath }) => {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);
  const inFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled || inFlight.current || !localStorage.getItem('token')) return;
    inFlight.current = true;
    try {
      const res = await fetch(`${API}/api/alcove/unread`, { headers: authHeaders() });
      if (!res.ok) return;
      const data = await res.json().catch(() => ({}));
      setCount(Number(data.count) || 0);
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch {
      // keep the last known values
    } finally {
      inFlight.current = false;
    }
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return undefined;
    refresh();
    const timer = setInterval(refresh, POLL_MS);
    const onChanged = () => refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    window.addEventListener(COMMUNITY_WALL_CHANGED_EVENT, onChanged);
    document.addEventListener('visibilitychange', onVisible);
    const socket = acquireSocket();
    socket?.on?.('community-wall:changed', onChanged);
    return () => {
      socket?.off?.('community-wall:changed', onChanged);
      releaseSocket();
      clearInterval(timer);
      window.removeEventListener(COMMUNITY_WALL_CHANGED_EVENT, onChanged);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [enabled, refresh]);

  const markSeen = useCallback(async (body) => {
    try {
      await fetch(`${API}/api/alcove/unread/seen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...authHeaders() },
        body: JSON.stringify(body),
      });
    } finally {
      refresh();
    }
  }, [refresh]);

  const markAllSeen = useCallback(() => {
    setCount(0);
    setItems((prev) => prev.map((item) => ({ ...item, isRead: true })));
    return markSeen({ all: true });
  }, [markSeen]);

  const markPostSeen = useCallback((postId) => {
    setItems((prev) => prev.map((item) => (item.postId === postId ? { ...item, isRead: true } : item)));
    setCount((prev) => Math.max(0, prev - 1));
    return markSeen({ postIds: [postId] });
  }, [markSeen]);

  // Shaped like the portals' bell notifications so they can be merged into the same list.
  const bellItems = items.map((item) => ({
    _id: `community-post-${item.postId}`,
    id: `community-post-${item.postId}`,
    title: `${item.authorName} posted on Community Wall`,
    message: item.preview,
    senderAvatar: item.authorPhoto || '', // poster's profile photo for the bell avatar
    createdAt: item.createdAt,
    isRead: Boolean(item.isRead),
    type: 'community_post',
    isCommunityPost: true,
    postId: item.postId,
    path: `${wallPath}?post=${item.postId}`,
  }));

  return { count, items, bellItems, refresh, markAllSeen, markPostSeen };
};

export default useCommunityWallUnread;
