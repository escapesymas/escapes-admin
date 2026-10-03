// Service Worker del panel de Escapes y Más: avisos push en el móvil.
// v2: icono PNG, agrupación por asunto, contador en el icono de la app y
// apertura directa de la pestaña / pedido del aviso.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {
    title: 'Escapes y Más',
    body: 'Tienes un aviso nuevo en el panel.',
    url: '/?tab=notifications',
    tag: undefined,
    badgeCount: undefined,
    data: {},
  };

  if (event.data) {
    try {
      data = { ...data, ...event.data.json() };
    } catch (e) {
      data.body = event.data.text();
    }
  }

  const options = {
    body: data.body,
    icon: '/icon-192.png',
    badge: '/badge-96.png',
    tag: data.tag,
    // Si llega otro aviso del mismo asunto, vuelve a sonar.
    renotify: !!data.tag,
    timestamp: Date.now(),
    data: { url: data.url || '/?tab=notifications', ...(data.data || {}) },
  };

  const tasks = [self.registration.showNotification(data.title, options)];
  // Contador de avisos sin leer en el icono de la app (iOS 16.4+, Chrome).
  if (typeof data.badgeCount === 'number' && self.navigator && 'setAppBadge' in self.navigator) {
    tasks.push(data.badgeCount > 0 ? self.navigator.setAppBadge(data.badgeCount) : self.navigator.clearAppBadge());
  }
  event.waitUntil(Promise.all(tasks).catch(() => {}));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = new URL(event.notification.data?.url || '/?tab=notifications', self.location.origin).href;

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          // El panel abierto cambia de pestaña sin recargar.
          client.postMessage({ type: 'open-url', url: targetUrl });
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(targetUrl) : undefined;
    })
  );
});
