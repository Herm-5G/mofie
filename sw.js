// ══════════════════════════════════════════════════════════════════════════
//  MOFIE SERVICE WORKER — HEADS-UP FIX
//  Handles:
//    • FCM background messages (data-only OR notification)
//    • Notification click → focus existing tab or open new one
//    • Token rotation (pushsubscriptionchange)
// ══════════════════════════════════════════════════════════════════════════
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey:            "AIzaSyBxfzb0kvBoTErQTkB_UH33-RTMpd0NjNs",
  authDomain:        "mhail-fdb0f.firebaseapp.com",
  projectId:         "mhail-fdb0f",
  storageBucket:     "mhail-fdb0f.firebasestorage.app",
  messagingSenderId: "850385336150",
  appId:             "1:850385336150:web:594aa53199a318209f08f7"
});

const messaging = firebase.messaging();
const DEFAULT_ICON = "https://res.cloudinary.com/rirfqxoz/image/upload/IMG-20261022-WA0000.jpg";

// ── Background message handler ─────────────────────────────────────────
// FCM calls this ONLY for data-only messages (no `notification` object).
// If a `notification` object is present, FCM displays it automatically
// and this handler is NOT called.
messaging.onBackgroundMessage((payload) => {
  console.log("[SW] background message received:", payload);

  const d = payload.data || {};
  const n = payload.notification || {};

  const title  = n.title || d.senderName  || "Mofie";
  const body   = n.body  || d.messageText || "New message";
  const chatId = d.chatId || "";

  return self.registration.showNotification(title, {
    body,
    icon:    DEFAULT_ICON,
    badge:   DEFAULT_ICON,
    tag:     chatId || "mofie-default",
    renotify: true,
    requireInteraction: false, // ✅ Allows the notification to auto-dismiss
    silent:  false,            // ✅ Ensures sound plays
    vibrate: [200, 100, 200],  // ✅ Triggers Heads-Up vibration
    data: {
      chatId,
      senderName:  d.senderName || "Mofie",
      messageText: d.messageText || "",
      clickUrl:    `https://herm-5g.github.io/mofie/` +
                   (chatId ? `?chat=${encodeURIComponent(chatId)}` : "")
    }
  });
});

// ── Notification click → focus existing tab or open a new one ────────
self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const data   = event.notification.data || {};
  const chatId = data.chatId || "";
  const base   = `${self.location.origin}/mofie/`;
  const url    = chatId ? `${base}?chat=${encodeURIComponent(chatId)}` : base;

  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      // 1) If a Mofie tab is already open, focus it + send chatId
      for (const c of list) {
        if (c.url.startsWith(self.location.origin + "/mofie") && "focus" in c) {
          c.postMessage({ type: "OPEN_CHAT", chatId });
          return c.focus();
        }
      }
      // 2) Otherwise open a fresh tab
      if (clients.openWindow) return clients.openWindow(url);
    })
  );
});

// ── Token rotation → ask any active page to re-register ─────────────
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true })
      .then((list) => list.forEach(c => c.postMessage({ type: "RESUBSCRIBE_PUSH" })))
      .catch(() => {})
  );
});

// ── Activate → take control of open tabs immediately ────────────────
self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});
