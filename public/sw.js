self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('push', (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { body: event.data ? event.data.text() : '' };
  }

  const title = data.title || '🔔 تنبيه جديد — إعلاناتي';
  const body = data.body || 'يوجد طلب جديد بانتظارك في لوحة الإدارة.';
  const tag = data.tag || 'elanati-admin-push';
  const targetUrl = typeof data.url === 'string' && data.url.startsWith('/') && !data.url.startsWith('//')
    ? data.url
    : '/admin/automation';
  const whatsappUrl =
    typeof data.whatsappUrl === 'string' && data.whatsappUrl.startsWith('https://wa.me/')
      ? data.whatsappUrl
      : null;

  const actions = whatsappUrl
    ? [
        { action: 'send_wa', title: '📲 إرسال واتساب الآن' },
        { action: 'open_admin', title: 'فتح لوحة المدير' },
      ]
    : [{ action: 'open_admin', title: 'فتح لوحة المدير' }];

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      renotify: true,
      requireInteraction: true,
      vibrate: [250, 120, 250],
      data: { url: targetUrl, whatsappUrl },
      actions,
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const noteData = event.notification.data || {};
  const whatsappUrl =
    typeof noteData.whatsappUrl === 'string' && noteData.whatsappUrl.startsWith('https://wa.me/')
      ? noteData.whatsappUrl
      : null;
  const targetPath =
    typeof noteData.url === 'string' && noteData.url.startsWith('/') && !noteData.url.startsWith('//')
      ? noteData.url
      : '/admin/automation';

  if (event.action === 'send_wa' && whatsappUrl) {
    event.waitUntil(self.clients.openWindow(whatsappUrl));
    return;
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetPath);
          }
          return client;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetPath);
      }
      return undefined;
    })
  );
});
