self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (_err) {
    payload = { title: 'Notification', body: event.data ? String(event.data.text()) : '' };
  }

  const title = payload.title || 'New Notification';
  const options = {
    body: payload.body || '',
    tag: payload.tag || `push-${Date.now()}`,
    data: payload.data || {},
  };
  if (payload.icon) options.icon = payload.icon;
  if (payload.badge) options.badge = payload.badge;

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      self.clients
        .matchAll({ type: 'window', includeUncontrolled: true })
        .then((clientList) => {
          clientList.forEach((client) => {
            client.postMessage({ type: 'push-notification-received', data: payload.data || {} });
          });
        }),
    ])
  );
});

self.addEventListener('notificationclick', (event) => {
  const targetPath = event.notification?.data?.path || '/';
  event.notification.close();

  event.waitUntil((async () => {
    const clientList = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of clientList) {
      if ('focus' in client) {
        await client.focus();
        if (targetPath && 'navigate' in client) {
          await client.navigate(targetPath);
        }
        return;
      }
    }
    if (clients.openWindow) {
      await clients.openWindow(targetPath);
    }
  })());
});
