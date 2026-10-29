import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { subscriptionMatchesKey } from '../utils/webPush';

const PROMPT_COOLDOWN_MS = 24 * 60 * 60 * 1000;

const getNotificationId = (item) => String(item?._id || item?.id || '');
const isReadNotification = (item) => {
  if (typeof item?.isRead === 'boolean') return item.isRead;
  if (typeof item?.read === 'boolean') return item.read;
  return false;
};

const trimToText = (value, max = 180) => {
  const text = String(value || '').trim();
  if (!text) return '';
  return text.length > max ? `${text.slice(0, max)}...` : text;
};

export const useDesktopNotificationBridge = ({
  scopeKey = 'default',
  resolvePath,
  appName = 'EEC School',
}) => {
  const API_BASE = useMemo(
    () => (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, ''),
    []
  );
  const [permission, setPermission] = useState(() =>
    typeof window !== 'undefined' && 'Notification' in window
      ? Notification.permission
      : 'unsupported'
  );
  const [showPermissionModal, setShowPermissionModal] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  const hasHydratedRef = useRef(false);
  const seenIdsRef = useRef(new Set());
  const pendingItemsRef = useRef([]);
  const serviceWorkerRegistrationRef = useRef(null);
  const subscribedEndpointRef = useRef('');
  const webPushEnabledRef = useRef(null);

  const promptStorageKey = useMemo(
    () => `desktop_notification_prompt_at_${scopeKey}`,
    [scopeKey]
  );

  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    setPermission(Notification.permission);
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator)) return;
    navigator.serviceWorker.register('/sw.js')
      .then((registration) => {
        serviceWorkerRegistrationRef.current = registration;
      })
      .catch(() => {
        serviceWorkerRegistrationRef.current = null;
      });
  }, []);

  const urlBase64ToUint8Array = useCallback((base64String) => {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }, []);

  const saveSubscriptionOnServer = useCallback(async (subscription) => {
    const token = localStorage.getItem('token');
    if (!token || !subscription?.endpoint) return;
    await fetch(`${API_BASE}/api/notifications/push/subscribe`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ subscription }),
    });
    subscribedEndpointRef.current = subscription.endpoint;
  }, [API_BASE]);

  const syncWebPushSubscription = useCallback(async () => {
    if (typeof window === 'undefined') return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    if (permission !== 'granted') return;
    const token = localStorage.getItem('token');
    if (!token) return;

    try {
      let registration = serviceWorkerRegistrationRef.current;
      if (!registration) {
        registration = await navigator.serviceWorker.register('/sw.js');
        serviceWorkerRegistrationRef.current = registration;
      }

      const keyRes = await fetch(`${API_BASE}/api/notifications/push/public-key`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const keyData = await keyRes.json().catch(() => ({}));
      if (!keyRes.ok || !keyData?.enabled || !keyData?.publicKey) {
        webPushEnabledRef.current = false;
        return;
      }
      webPushEnabledRef.current = true;

      const serverKey = urlBase64ToUint8Array(String(keyData.publicKey));
      let subscription = await registration.pushManager.getSubscription();
      // Replace a subscription made with an old server key — it can't receive pushes.
      if (subscription && !subscriptionMatchesKey(subscription, serverKey)) {
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
      if (!subscription) {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: serverKey,
        });
      }
      if (subscription?.endpoint) {
        await saveSubscriptionOnServer(subscription.toJSON ? subscription.toJSON() : subscription);
      }
    } catch {
      // no-op
    }
  }, [API_BASE, permission, saveSubscriptionOnServer, urlBase64ToUint8Array]);

  useEffect(() => {
    syncWebPushSubscription();
  }, [syncWebPushSubscription]);

  const shouldPromptPermission = useCallback(() => {
    if (typeof window === 'undefined') return false;
    if (!('Notification' in window)) return false;
    if (Notification.permission !== 'default') return false;
    const lastPromptAt = Number(localStorage.getItem(promptStorageKey) || 0);
    if (!Number.isFinite(lastPromptAt) || lastPromptAt <= 0) return true;
    return Date.now() - lastPromptAt >= PROMPT_COOLDOWN_MS;
  }, [promptStorageKey]);

  const rememberPromptTime = useCallback(() => {
    if (typeof window === 'undefined') return;
    localStorage.setItem(promptStorageKey, String(Date.now()));
  }, [promptStorageKey]);

  const fireNotification = useCallback((item) => {
    if (typeof window === 'undefined' || !('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    const id = getNotificationId(item);
    if (!id) return;
    const title = trimToText(item?.title, 80) || appName;
    const body = trimToText(item?.message, 180) || 'You have a new update.';
    const path = typeof resolvePath === 'function' ? resolvePath(item) : '';
    const notification = new Notification(title, {
      body,
      tag: `notif-${scopeKey}-${id}`,
      renotify: false,
      data: { path },
    });
    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // no-op
      }
      if (path) {
        window.location.assign(path);
      }
      notification.close();
    };
  }, [appName, resolvePath, scopeKey]);

  const flushPendingItems = useCallback(() => {
    if (permission !== 'granted') return;
    const items = pendingItemsRef.current.slice(0, 3);
    pendingItemsRef.current = [];
    setPendingCount(0);
    items.forEach((item) => fireNotification(item));
  }, [fireNotification, permission]);

  const syncNotifications = useCallback((items = []) => {
    const list = Array.isArray(items) ? items : [];
    const withIds = list.filter((item) => getNotificationId(item));
    if (!hasHydratedRef.current) {
      withIds.forEach((item) => seenIdsRef.current.add(getNotificationId(item)));
      hasHydratedRef.current = true;
      return;
    }

    const newUnread = [];
    withIds.forEach((item) => {
      const id = getNotificationId(item);
      if (!id) return;
      if (seenIdsRef.current.has(id)) return;
      seenIdsRef.current.add(id);
      if (!isReadNotification(item)) {
        newUnread.push(item);
      }
    });

    if (newUnread.length === 0) return;

    if (permission === 'granted' && webPushEnabledRef.current === false) {
      newUnread.slice(0, 3).forEach((item) => fireNotification(item));
      return;
    }

    if (permission === 'default' && shouldPromptPermission()) {
      pendingItemsRef.current = [...pendingItemsRef.current, ...newUnread].slice(-10);
      setPendingCount(pendingItemsRef.current.length);
      setShowPermissionModal(true);
      rememberPromptTime();
    }
  }, [fireNotification, permission, rememberPromptTime, shouldPromptPermission]);

  const requestPermissionFromModal = useCallback(async () => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setShowPermissionModal(false);
      return;
    }
    setShowPermissionModal(false);
    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        await syncWebPushSubscription();
        flushPendingItems();
      } else {
        pendingItemsRef.current = [];
        setPendingCount(0);
      }
    } catch {
      pendingItemsRef.current = [];
      setPendingCount(0);
    }
  }, [flushPendingItems, syncWebPushSubscription]);

  const dismissPermissionModal = useCallback(() => {
    setShowPermissionModal(false);
  }, []);

  return {
    permission,
    showPermissionModal,
    pendingCount,
    syncNotifications,
    requestPermissionFromModal,
    dismissPermissionModal,
  };
};
