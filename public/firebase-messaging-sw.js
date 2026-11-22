/* eslint-disable no-undef */
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.0.1/firebase-messaging-compat.js');

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'INIT_FCM' && event.data.config) {
    if (!firebase.apps.length) {
      firebase.initializeApp(event.data.config);
      const messaging = firebase.messaging();
      messaging.onBackgroundMessage((payload) => {
        const title = payload.notification?.title || payload.data?.title || 'GMS Pamposh Colony Alert';
        const body = payload.notification?.body || payload.data?.message || '';
        self.registration.showNotification(title, {
          body,
          icon: '/icon.svg',
          badge: '/icon.svg',
          data: payload.data || {},
        });
      });
    }
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow('/');
      return undefined;
    })
  );
});
