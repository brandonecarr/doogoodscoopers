/**
 * Admin Service Worker — Push Notifications
 * Handles push events and notification clicks for the admin portal.
 */

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', () => self.clients.claim());

// Receive push from server and show notification
self.addEventListener('push', (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: 'DooGoodScoopers', body: event.data.text(), url: '/admin/quote-leads' };
  }

  const options = {
    body: data.body || '',
    icon: '/images/icons/icon-192.png',
    badge: '/images/icons/icon-192.png',
    data: { url: data.url || '/admin/quote-leads' },
    tag: data.tag || 'followup',
    requireInteraction: true,
    renotify: !!data.renotify,
  };

  event.waitUntil(
    self.registration.showNotification(data.title || 'DooGoodScoopers', options)
  );
});

// Open / focus the right URL when notification is tapped
self.addEventListener('notificationclick', (event) => {
  event.notification.close();

  const targetUrl = event.notification.data?.url || '/admin/quote-leads';

  event.waitUntil(
    clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes(targetUrl) && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow(targetUrl);
        }
      })
  );
});
