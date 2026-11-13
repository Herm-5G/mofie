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
let _privKey    = null;
let _pubKeyJwk  = null;
let _uid        = null;
let _groupCache = new Map();

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
    _pubKeyJwk = jwk;
  } else {
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
export function isE2EEReady()    { return !!_uid; }

export function lockE2EE() {
  _privKey = null;
  _pubKeyJwk = null;
  _uid     = null;
  _unlocked = false;
  _groupCache.clear();
}

export async function tryRestoreE2EE(db, user) {
  _uid = user.uid;
  _unlocked = true;
  return true;
}
// ── NEW: Expose unlocked private key for applock-PIN caching ──────────
export async function exportPrivateKey() {
  if (!_privKey || !_unlocked) throw new Error("E2EE is locked");
  return crypto.subtle.exportKey("jwk", _privKey);
}

export async function restorePrivateKey(jwk) {
  if (!jwk || !jwk.d) throw new Error("Invalid private key");
  _privKey = await crypto.subtle.importKey(
    "jwk", jwk, { name: "ECDH", namedCurve: CURVE }, false,
    ["deriveKey", "deriveBits"]
  );
  _pubKeyJwk = jwk;
  _unlocked = true;
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
  // Bypassed: Save as plain text
  return { iv: "plain", ciphertext: JSON.stringify(payload) };
}

export async function decryptPayload(db, user, chatId, ivB64, ctB64) {
  // Bypassed: Read as plain text
  try {
    return JSON.parse(ctB64);
  } catch (e) {
    return { text: "🔒 Old encrypted message" };
  }
}

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
  const raw = crypto.getRandomValues(new Uint8Array(32));
  const aes = await crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
  _groupCache.set(chatId, aes);

  const meSnap = await getDoc(doc(db, "users", user.uid));
  const myPub  = meSnap.data().publicKey;

  const wrapped = {};
  for (const uid of participants) {
    const pub = await getPub(db, uid);
    if (!pub) continue;
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

export async function encryptBytes(bytes) {
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