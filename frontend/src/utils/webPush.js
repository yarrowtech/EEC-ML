const API_BASE = (import.meta.env.VITE_API_URL || 'http://localhost:5000').replace(/\/$/, '');

const urlBase64ToUint8Array = (base64String) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) outputArray[i] = rawData.charCodeAt(i);
  return outputArray;
};

export const isPushSupported = () =>
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window;

export const getActivePushSubscription = async () => {
  if (!isPushSupported()) return null;
  try {
    const registration = await navigator.serviceWorker.ready;
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
};

export const isPushEnabled = async () => {
  if (!isPushSupported()) return false;
  if (Notification.permission !== 'granted') return false;
  const subscription = await getActivePushSubscription();
  return Boolean(subscription);
};

export const subscribeToPush = async () => {
  if (!isPushSupported()) {
    throw new Error('Push notifications are not supported on this device.');
  }
  const token = localStorage.getItem('token');
  if (!token) throw new Error('Please login again.');

  let permission = Notification.permission;
  if (permission === 'default') {
    permission = await Notification.requestPermission();
  }
  if (permission !== 'granted') {
    throw new Error('Notification permission was not granted.');
  }

  const registration = await navigator.serviceWorker.register('/sw.js');

  const keyRes = await fetch(`${API_BASE}/api/notifications/push/public-key`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const keyData = await keyRes.json().catch(() => ({}));
  if (!keyRes.ok || !keyData?.enabled || !keyData?.publicKey) {
    throw new Error('Push notifications are not enabled for this school right now.');
  }

  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(String(keyData.publicKey)),
    });
  }

  await fetch(`${API_BASE}/api/notifications/push/subscribe`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ subscription: subscription.toJSON ? subscription.toJSON() : subscription }),
  });

  return subscription;
};

export const unsubscribeFromPush = async () => {
  const subscription = await getActivePushSubscription();
  if (!subscription) return;
  const token = localStorage.getItem('token');
  const endpoint = subscription.endpoint;
  try {
    await subscription.unsubscribe();
  } finally {
    if (token && endpoint) {
      await fetch(`${API_BASE}/api/notifications/push/unsubscribe`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ endpoint }),
      }).catch(() => {});
    }
  }
};
