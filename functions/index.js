const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const admin = require("firebase-admin");
admin.initializeApp();
const db = admin.firestore();

const GROQ_API_KEY = process.env.GROQ_API_KEY; // set via `firebase functions:secrets:set GROQ_API_KEY`
const CLOUDINARY_API_KEY = process.env.CLOUDINARY_API_KEY;
const CLOUDINARY_API_SECRET = process.env.CLOUDINARY_API_SECRET;
const CLOUDINARY_CLOUD_NAME = "rirfqxoz";

// ── AI chat proxy (rate limited, signed-in only) ─────────────────────
exports.chat = onCall(
  { region: "us-central1", cors: true, enforceAppCheck: false },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
    const uid = req.auth.uid;

    const { systemPrompt = "", history = [], message = "" } = req.data || {};
    if (typeof message !== "string" || !message.trim()) {
      throw new HttpsError("invalid-argument", "message required");
    }
    if (message.length > 4000) throw new HttpsError("invalid-argument", "message too long");

    // Rate limit: 30 requests per 10 min per uid
    const now = Date.now();
    const windowMs = 10 * 60 * 1000;
    const ref = db.doc(`users/${uid}/rate_limits/ai`);
    const snap = await ref.get();
    const hist = (snap.exists ? snap.data().timestamps || [] : [])
      .filter(t => t > now - windowMs);
    if (hist.length >= 30) {
      throw new HttpsError("resource-exhausted", "Too many requests. Slow down.");
    }
    hist.push(now);
    await ref.set({ timestamps: hist }, { merge: true });

    const messages = [
      { role: "system", content: systemPrompt },
      ...history.slice(-8),
      { role: "user", content: message }
    ];

    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: "openai/gpt-oss-120b",
        messages,
        temperature: 0.85,
        max_tokens: 1500
      })
    });
    const data = await res.json();
    if (!res.ok) {
      console.error("[AI]", data);
      throw new HttpsError("internal", data.error?.message || "AI failed");
    }
    return { reply: data.choices?.[0]?.message?.content || "…" };
  }
);

// ── Cloudinary signature (upload must be Signed in dashboard) ────────
exports.signUpload = onCall(
  { region: "us-central1", cors: true },
  async (req) => {
    if (!req.auth) throw new HttpsError("unauthenticated", "Sign in required");
    const folder = "mofie";
    const timestamp = Math.floor(Date.now() / 1000);

    // Cloudinary signature = sha1 of sorted params + api_secret
    const crypto = require("crypto");
    const toSign = `folder=${folder}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");

    return {
      timestamp, signature, folder,
      api_key: CLOUDINARY_API_KEY,
      cloud_name: CLOUDINARY_CLOUD_NAME
    };
  }
);

// ── Send Push Notification on New Message ──────────────────────────────
exports.sendChatNotification = onDocumentCreated(
  "conversations/{conversationId}/messages/{messageId}",
  async (event) => {
    const snapshot = event.data;
    if (!snapshot) return;

    const message = snapshot.data();
    const conversationId = event.params.conversationId;
    const senderId = message.senderId;
    const senderName = message.senderName || "Someone";

    // 1. Fetch the conversation to find who to send the notification to
    const convSnap = await db.doc(`conversations/${conversationId}`).get();
    if (!convSnap.exists) return;
    const conv = convSnap.data();

    // 2. Filter out the sender, so we only notify the receivers
    const recipients = (conv.participants || []).filter(uid => uid !== senderId);
    if (recipients.length === 0) return;

    // 3. Format the message text based on type
    let text = message.text || "New message";
    if (message.type === "image") text = "📷 Photo";
    if (message.type === "video") text = "🎬 Video";
    if (message.type === "audio") text = "🎙️ Voice note";
    if (message.type === "document") text = "📄 Document";
    if (message.type === "sticker") text = "🖼️ Sticker";

    // 4. Get the FCM tokens for all recipients
    const tokens = [];
    for (const uid of recipients) {
      const userSnap = await db.doc(`users/${uid}`).get();
      if (userSnap.exists) {
        const userData = userSnap.data();
        if (Array.isArray(userData.fcmTokens)) {
          tokens.push(...userData.fcmTokens);
        }
      }
    }

    // If no one has registered a device token, stop here
    if (tokens.length === 0) return;

    // 5. Build the DATA-ONLY payload (so your sw.js handles the title perfectly)
    const payload = {
      data: {
        senderName: senderName,
        messageText: text,
        chatId: conversationId
      },
      tokens: [...new Set(tokens)] // Remove duplicates
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(payload);
      console.log(`✅ Sent ${response.successCount} notifications for chat ${conversationId}`);
    } catch (error) {
      console.error("❌ Error sending notification:", error);
    }
  }
);
