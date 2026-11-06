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
const DEFAULT_ICON = "https://res.cloudinary.com/rirfqxoz/image/upload/IMG-20261022-WA0000.jpg";

// Called when a push arrives while the app is closed/backgrounded
messaging.onBackgroundMessage((payload) => {
  const d = payload.data || {};
  const n = payload.notification || {};

  // If FCM auto-displayed (notification payload present), don't double-show.
  if (n.title || n.body) return;

  const chatId     = d.chatId || "";
  const senderName = d.senderName || "Mofie";
  const body       = d.messageText || "New message";

  self.registration.showNotification(senderName, {
    body,
    icon:  DEFAULT_ICON,
    badge: DEFAULT_ICON,
    tag:   chatId,               // groups notifications per chat
    renotify: true,              
    requireInteraction: false,   // auto-dismiss banner
    silent: false,
    vibrate: [120, 80, 120],
    data: { chatId, senderName }
  });
});

// Click -> open or focus the app on the correct chat
self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const chatId = e.notification.data?.chatId || e.notification.tag || "";
  const base   = `${self.location.origin}/mofie/`;
  const url    = chatId ? `${base}?chat=${encodeURIComponent(chatId)}` : base;

  e.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then(list => {
      for (const c of list) {
        if (c.url.startsWith(self.location.origin) && "focus" in c) {
          c.postMessage({ type: "OPEN_CHAT", chatId });
          return c.focus();
        }
      }
      return clients.openWindow(url);
    })
  );
});

// Subscription rotated -> ask the page to refresh the token
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then(list => list.forEach(c => c.postMessage({ type: "RESUBSCRIBE_PUSH" })))
      .catch(() => {})
  );
});
