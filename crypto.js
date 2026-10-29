// ══════════════════════════════════════════════════════════════════════════
//  MOFIE E2EE — Real implementation
//  ECDH P-256 + AES-256-GCM + PBKDF2 password wrapping
// ══════════════════════════════════════════════════════════════════════════
import { doc, getDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const CURVE = "P-256";
const TE = new TextEncoder();
const TD = new TextDecoder();
const PBKDF2_ITER = 150_000;

const b64   = b => btoa(String.fromCharCode(...new Uint8Array(b)));
const unb64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));

let _unlocked   = false;
let _privKey    = null;   // CryptoKey (ECDH private)
let _uid        = null;
let _groupCache = new Map();

// ── Password → KEK ─────────────────────────────────────────────────────
async function deriveKek(pw, salt) {
  const base = await crypto.subtle.importKey(
    "raw", TE.encode(pw), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: PBKDF2_ITER, hash: "SHA-256" },
    base,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

// ── Lifecycle ──────────────────────────────────────────────────────────
export async function initE2EE(db, user, password) {
  _uid = user.uid;
  const ref  = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  const data = snap.data() || {};

  if (data.publicKey && data.encPrivKey && data.privSalt && data.privIv) {
    const kek = await deriveKek(password, unb64(data.privSalt));
    let jwk;
    try {
      const plain = await crypto.subtle.decrypt(
        { name: "AES-GCM", iv: unb64(data.privIv) },
        kek,
        unb64(data.encPrivKey)
      );
      jwk = JSON.parse(TD.decode(plain));
    } catch {
      throw new Error("Wrong password");
    }
    _privKey = await crypto.subtle.importKey(
      "jwk", jwk, { name: "ECDH", namedCurve: CURVE }, false,
      ["deriveKey", "deriveBits"]
    );
  } else {
    // First-time setup: generate key pair
    const kp = await crypto.subtle.generateKey(
      { name: "ECDH", namedCurve: CURVE }, true, ["deriveKey", "deriveBits"]
    );
    _privKey = kp.privateKey;

    const pubSpki = await crypto.subtle.exportKey("spki", kp.publicKey);
    const privJwk = await crypto.subtle.exportKey("jwk", kp.privateKey);

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv   = crypto.getRandomValues(new Uint8Array(12));
    const kek  = await deriveKek(password, salt);
    const enc  = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv }, kek, TE.encode(JSON.stringify(privJwk))
    );

    await updateDoc(ref, {
      publicKey:   b64(pubSpki),
      encPrivKey:  b64(enc),
      privSalt:    b64(salt),
      privIv:      b64(iv)
    });
  }
  _unlocked = true;
}

export function isE2EEUnlocked() { return _unlocked; }

export function lockE2EE() {
  _privKey = null;
  _uid     = null;
  _unlocked = false;
  _groupCache.clear();
}

export async function tryRestoreE2EE(db, user) {
  // Cannot restore without the password — the caller must call initE2EE()
  _uid = user.uid;
  return false;
}

// ── Helpers ────────────────────────────────────────────────────────────
async function sharedAes(theirPubB64) {
  const theirPub = await crypto.subtle.importKey(
    "spki", unb64(theirPubB64),
    { name: "ECDH", namedCurve: CURVE }, false, []
  );
  return crypto.subtle.deriveKey(
    { name: "ECDH", public: theirPub },
    _privKey,
    { name: "AES-GCM", length: 256 },
    false, ["encrypt", "decrypt"]
  );
}

async function getPub(db, uid) {
  const s = await getDoc(doc(db, "users", uid));
  return s.exists() ? s.data().publicKey : null;
}

// ── DM encryption ──────────────────────────────────────────────────────
export async function encryptPayload(db, user, chatId, payload) {
  if (!_unlocked) throw new Error("E2EE is locked");

  const conv = (await getDoc(doc(db, "conversations", chatId))).data() || {};
  const text = JSON.stringify(payload);

  let aes;
  if (conv.isGroup) {
    aes = await groupKeyFor(db, chatId, conv);
  } else {
    const other = (conv.participants || []).find(id => id !== user.uid);
    const pub = await getPub(db, other);
    if (!pub) throw new Error(`User ${other} has not enabled E2EE yet`);
    aes = await sharedAes(pub);
  }

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, TE.encode(text));
  return { iv: b64(iv), ciphertext: b64(ct) };
}

export async function decryptPayload(db, user, chatId, ivB64, ctB64) {
  if (!_unlocked) throw new Error("E2EE is locked");

  const conv = (await getDoc(doc(db, "conversations", chatId))).data() || {};

  let aes;
  if (conv.isGroup) {
    aes = await groupKeyFor(db, chatId, conv);
  } else {
    const other = (conv.participants || []).find(id => id !== user.uid);
    const pub = await getPub(db, other);
    if (!pub) throw new Error("Missing public key");
    aes = await sharedAes(pub);
  }

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivB64) }, aes, unb64(ctB64)
  );
  return JSON.parse(TD.decode(plain));
}

// ── Group keys ─────────────────────────────────────────────────────────
async function groupKeyFor(db, chatId, conv) {
  if (_groupCache.has(chatId)) return _groupCache.get(chatId);

  const mine = (conv.encryptedGroupKeys || {})[_uid];
  if (!mine) throw new Error("Group key not available. Ask admin to re-share.");

  const shared = await sharedAes(mine.senderPub);
  const raw = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(mine.iv) }, shared, unb64(mine.encKey)
  );
  const aes = await crypto.subtle.importKey(
    "raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]
  );
  _groupCache.set(chatId, aes);
  return aes;
}

export async function distributeGroupKey(db, user, chatId, participants) {
  if (!_unlocked) throw new Error("E2EE is locked");

  // Fresh random group key
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const aes = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  _groupCache.set(chatId, aes);

  const meSnap = await getDoc(doc(db, "users", user.uid));
  const myPub  = meSnap.data().publicKey;

  const wrapped = {};
  for (const uid of participants) {
    const pub = await getPub(db, uid);
    if (!pub) continue;                 // member hasn't set up E2EE yet
    const shared = await sharedAes(pub);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const enc = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, shared, raw);
    wrapped[uid] = { encKey: b64(enc), iv: b64(iv), senderPub: myPub };
  }

  await updateDoc(doc(db, "conversations", chatId), {
    encryptedGroupKeys: wrapped,
    groupKeyVersion:    Date.now()
  });
}

export function invalidateKey(chatId) {
  _groupCache.delete(chatId);
}

// ── File / media encryption (random AES key per file) ─────────────────
export async function encryptBytes(bytes) {
  if (!_unlocked) throw new Error("E2EE is locked");
  const key = crypto.getRandomValues(new Uint8Array(32));
  const aes = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["encrypt"]);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, aes, bytes);
  return { iv: b64(iv), ciphertext: new Uint8Array(ct), key };
}

export async function decryptBytes(key, ivB64, ciphertext) {
  const aes = await crypto.subtle.importKey("raw", key, { name: "AES-GCM" }, false, ["decrypt"]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: unb64(ivB64) }, aes, ciphertext
  );
  return new Uint8Array(plain);
}

// ── Password change ────────────────────────────────────────────────────
export async function rewrapAfterPasswordChange(db, user, oldPw, newPw) {
  if (!_unlocked) throw new Error("E2EE is locked");
  const ref  = doc(db, "users", user.uid);
  const data = (await getDoc(ref)).data() || {};
  if (!data.encPrivKey) return;

  const oldKek = await deriveKek(oldPw, unb64(data.privSalt));
  let jwk;
  try {
    const plain = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: unb64(data.privIv) }, oldKek, unb64(data.encPrivKey)
    );
    jwk = JSON.parse(TD.decode(plain));
  } catch {
    throw new Error("Wrong current password");
  }

  const newSalt = crypto.getRandomValues(new Uint8Array(16));
  const newIv   = crypto.getRandomValues(new Uint8Array(12));
  const newKek  = await deriveKek(newPw, newSalt);
  const newEnc  = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: newIv }, newKek, TE.encode(JSON.stringify(jwk))
  );

  await updateDoc(ref, {
    encPrivKey: b64(newEnc),
    privSalt:   b64(newSalt),
    privIv:     b64(newIv)
  });
}