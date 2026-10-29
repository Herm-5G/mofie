importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyBxfzb0kvBoTErQTkB_UH33-RTMpd0NjNs",
  authDomain: "mhail-fdb0f.firebaseapp.com",
  projectId: "mhail-fdb0f",
  storageBucket: "mhail-fdb0f.firebasestorage.app",
  messagingSenderId: "850385336150",
  appId: "1:850385336150:web:594aa53199a318209f08f7"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const n = payload.notification || {};

  const chatId = d.chatId || 'mofie';
  const title = d.senderName || n.title || 'Mofie';
  const body = d.messageText || n.body || 'New message';

  if (!payload.notification) {
    self.registration.showNotification(title, {
      body: body,
      icon: 'https://res.cloudinary.com/rirfqxoz/image/upload/IMG-20261022-WA0000.jpg',
      badge: 'https://res.cloudinary.com/rirfqxoz/image/upload/IMG-20261022-WA0000.jpg',
      tag: chatId,
      renotify: true,
      silent: false,
      data: { chatId: chatId }
    });
  }
});

self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const chatId = e.notification.data?.chatId || e.notification.tag || 'mofie';

  // ✅ FIXED: /Mhail-frontend/ → /mofie/
  const url = chatId && chatId !== 'mofie'
    ? `${self.location.origin}/mofie/?chat=${encodeURIComponent(chatId)}`
    : `${self.location.origin}/mofie/`;

  e.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && 'focus' in c) {
          c.postMessage({ type: 'OPEN_CHAT', chatId });
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});