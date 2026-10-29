// ══════════════════════════════════════════════════════════════════════════
//  Mofie — Advanced Build (Replies First · No Feed)
// ══════════════════════════════════════════════════════════════════════════
import * as E2EE from "./crypto.js";
const unb64 = (str) => Uint8Array.from(atob(str), c => c.charCodeAt(0));
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  onAuthStateChanged, updatePassword, deleteUser, sendPasswordResetEmail }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { initializeFirestore, getFirestore, persistentLocalCache,
  persistentMultipleTabManager, collection, doc, setDoc, getDoc, getDocs,
  query, where, addDoc, onSnapshot, orderBy, serverTimestamp, updateDoc,
  deleteDoc, arrayUnion, increment, arrayRemove, Timestamp, collectionGroup }
  from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

// ══════════════════════════════════════════════════════════════════════════
//  CONFIG
// ══════════════════════════════════════════════════════════════════════════


const firebaseConfig = {
  apiKey: "AIzaSyBxfzb0kvBoTErQTkB_UH33-RTMpd0NjNs",
  authDomain: "mhail-fdb0f.firebaseapp.com",
  projectId: "mhail-fdb0f",
  storageBucket: "mhail-fdb0f.firebasestorage.app",
  messagingSenderId: "850385336150",
  appId: "1:850385336150:web:594aa53199a318209f08f7"
};

let currentAudioPlayer = null;

window.toggleAudio = (btn) => {
  const playerDiv = btn.closest(".custom-voice-player");
  const url = playerDiv.dataset.audioUrl;
  const progress = playerDiv.querySelector(".cvp-progress");
  const timeText = playerDiv.querySelector(".cvp-time");
  const playIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>`;
  const pauseIcon = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z"/></svg>`;

  if (currentAudioPlayer && currentAudioPlayer.src !== url) {
    currentAudioPlayer.pause();
    document.querySelectorAll(".cvp-play-btn").forEach(b => b.innerHTML = playIcon);
  }

  if (!currentAudioPlayer || currentAudioPlayer.src !== url) {
    currentAudioPlayer = new Audio(url);
    currentAudioPlayer.ontimeupdate = () => {
      const pct = (currentAudioPlayer.currentTime / currentAudioPlayer.duration) * 100;
      progress.style.width = pct + "%";
      const mins = Math.floor(currentAudioPlayer.currentTime / 60);
      const secs = Math.floor(currentAudioPlayer.currentTime % 60);
      timeText.textContent = `${mins}:${secs.toString().padStart(2, '0')}`;
    };
    currentAudioPlayer.onended = () => {
      btn.innerHTML = playIcon;
      progress.style.width = "0%";
      timeText.textContent = "0:00";
    };
  }

  if (currentAudioPlayer.paused) {
    currentAudioPlayer.play();
    btn.innerHTML = pauseIcon;
  } else {
    currentAudioPlayer.pause();
    btn.innerHTML = playIcon;
  }
};

window.seekAudio = (e, trackWrap) => {
  if (!currentAudioPlayer) return;
  const rect = trackWrap.getBoundingClientRect();
  const pct = (e.clientX - rect.left) / rect.width;
  currentAudioPlayer.currentTime = pct * currentAudioPlayer.duration;
};

// ══════════════════════════════════════════════════════════════════════════
//  FIREBASE INIT
// ══════════════════════════════════════════════════════════════════════════
const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.warn("[Mofie] Persistent cache failed, using default:", e.message);
  db = getFirestore(app);
}

function getOptimizedUrl(url) {
  if (!url) return url;
  if (url.includes("cloudinary.com")) {
    return url.replace("/upload/", "/upload/q_auto,f_auto,w_600/");
  }
  return url;
}
const appEl = document.getElementById("app");

// styleFix

const styleFix = document.createElement('style');
styleFix.textContent = `
  /* ═══ SCROLL BOTTOM BUTTON FIXES ═══ */
  #scroll-bottom-btn::after, #scroll-bottom-btn::before,
  #scroll-bottom-btn .unread-badge, #scroll-bottom-btn .badge {
    display: none !important;
    content: none !important;
  }
  
  #scroll-bottom-btn {
    width: 40px !important; height: 40px !important;
    background: var(--bg-main) !important; 
    border: 1px solid var(--border) !important;
    border-radius: 50% !important;
    box-shadow: 0 2px 5px rgba(0,0,0,0.2) !important; 
    opacity: 0.85;
    transition: all 0.2s ease; padding: 0 !important;
    display: flex; align-items: center; justify-content: center;
    right: 16px !important; bottom: 85px !important;
    z-index: 100;
  }
  #scroll-bottom-btn:hover, #scroll-bottom-btn:active { opacity: 1; transform: scale(1.05); }
  #scroll-bottom-btn svg { width: 24px !important; height: 24px !important; color: var(--text) !important; }

  /* ═══ WHATSAPP STYLE CHAT BUBBLES ═══ */
  .bubble {
    box-shadow: 0 1px 0.5px rgba(11, 20, 26, 0.13) !important;
    border-radius: 8px !important;
    padding: 6px 7px 8px 9px !important;
    font-size: 15px !important;
    line-height: 20px !important;
    position: relative;
    max-width: 85% !important;
    word-wrap: break-word;
  }
  
  .msg-row.me .bubble {
    border-top-right-radius: 0px !important;
    background-color: var(--bubble-color) !important;
    background-image: none !important;
  }
  .msg-row.them .bubble {
    border-top-left-radius: 0px !important;
  }

  /* ═══ MESSAGE META (TIME & DOTS) ═══ */
  .msg-meta {
    display: inline-flex !important;
    align-items: center !important;
    justify-content: flex-end !important;
    float: right !important;
    margin: 4px 0 -3px 8px !important;
    font-size: 11px !important;
    letter-spacing: 0.3px;
    white-space: nowrap !important;
    gap: 4px;
    opacity: 0.85;
  }
  
  .msg-status-dot {
    width: 10px !important; 
    height: 10px !important;
    border-radius: 50% !important;
    display: inline-block !important;
    margin-bottom: 1px;
  }
  
  .msg-status-dot.read { background-color: #10b981 !important; }   
  .msg-status-dot.online { background-color: #f59e0b !important; } 
  .msg-status-dot.offline { background-color: #ef4444 !important; }

  /* ═══ LIGHT THEME COLORS ═══ */
  [data-theme="light"] .msg-row.them .bubble { background: #ffffff !important; color: #111b21 !important; }
  [data-theme="light"] .msg-row.me .bubble { color: #111b21 !important; }
  [data-theme="light"] .msg-row .msg-meta { color: #667781 !important; }

  /* ═══ DARK THEME COLORS ═══ */
  [data-theme="dark"] .msg-row.them .bubble { background: #202c33 !important; color: #e9edef !important; }
  [data-theme="dark"] .msg-row.me .bubble { color: #e9edef !important; }
  [data-theme="dark"] .msg-row .msg-meta { color: #8696a0 !important; }

  /* ═══ REPLY QUOTE BOX ═══ */
  .reply-quote {
    background: rgba(0, 0, 0, 0.06) !important;
    border-left: 4px solid #00a884 !important;
    border-radius: 4px !important;
    padding: 6px 8px !important;
    margin-bottom: 5px !important;
    display: flex; flex-direction: column; gap: 2px; max-width: 100%;
  }
  [data-theme="dark"] .reply-quote { background: rgba(255, 255, 255, 0.08) !important; }
  [data-theme="dark"] .msg-row.them .reply-quote { border-left-color: #53bdeb !important; }
  [data-theme="dark"] .msg-row.me .reply-quote { border-left-color: #fff !important; }
  .reply-quote .q-name { font-weight: 700 !important; font-size: 13px !important; color: #00a884 !important; }
  [data-theme="dark"] .msg-row.them .reply-quote .q-name { color: #53bdeb !important; }
  [data-theme="dark"] .msg-row.me .reply-quote .q-name { color: #fff !important; }
  .reply-quote .q-text { font-size: 13.5px !important; white-space: nowrap !important; overflow: hidden !important; text-overflow: ellipsis !important; opacity: 0.9 !important; }

/* ═══════════════════════════════════════════════════════ */
/* ═══ PERFECT CHAT HEADER & TEXT ALIGNMENT ═══ */
/* ═══════════════════════════════════════════════════════ */

.chat-header {
  padding: 8px 12px !important;
  min-height: 64px !important;
  height: auto !important; /* Allows it to grow if text is tall */
  display: flex !important;
  align-items: center !important;
  gap: 8px !important;
  border-bottom-left-radius: 20px !important;
  border-bottom-right-radius: 20px !important;
  box-shadow: 0 2px 10px rgba(0,0,0,0.05) !important;
}

/* Fix the Back Button */
.chat-header #back-btn {
  width: 32px !important; 
  height: 32px !important;
  border-radius: 50% !important; 
  display: flex !important;
  align-items: center !important; 
  justify-content: center !important;
  padding: 0 !important; 
  margin: 0 4px 0 0 !important;
  background: transparent !important;
  flex-shrink: 0 !important;
}
.chat-header #back-btn svg { fill: var(--text) !important; }

/* Fix the Avatar */
.chat-header #header-profile-btn {
  width: 40px !important; 
  height: 40px !important;
  border-radius: 50% !important; 
  margin: 0 !important; 
  flex-shrink: 0 !important;
}
.chat-header #other-av {
  width: 100% !important; 
  height: 100% !important; 
  font-size: 16px !important;
}

/* The Middle Text Area (Name, Status, Timer) */
.chat-header > div:nth-child(3) {
  flex: 1 !important;
  min-width: 0 !important;
  display: flex !important;
  flex-direction: column !important;
  justify-content: center !important;
  gap: 2px !important;
}

/* Chat Name */
.chat-header .chat-name {
  font-size: 16px !important;
  font-weight: 600 !important;
  color: var(--text) !important;
  margin: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  line-height: 1.2 !important;
}

/* Online/Offline Status */
.chat-header .chat-status {
  font-size: 12px !important;
  color: var(--text-muted) !important;
  margin: 0 !important;
  white-space: nowrap !important;
  overflow: hidden !important;
  text-overflow: ellipsis !important;
  line-height: 1.2 !important;
}

/* The 24 Hours Timer (Made small and neat) */
.chat-header .timer-btn {
  display: inline-flex !important;
  align-items: center !important;
  width: fit-content !important;
  background: var(--user-accent-tint) !important;
  color: var(--user-accent-1) !important;
  padding: 2px 8px !important;
  border-radius: 12px !important;
  font-size: 10px !important;
  font-weight: 600 !important;
  margin-top: 2px !important;
  gap: 4px !important;
}
.chat-header .timer-btn svg {
  width: 12px !important;
  height: 12px !important;
}

/* Right Side Action Icons (Call, Search, Info, Menu) */
.chat-header .header-actions {
  display: flex !important;
  align-items: center !important;
  gap: 0px !important;
  flex-shrink: 0 !important;
  margin-left: auto !important;
}
.chat-header .header-actions .icon {
  width: 36px !important; 
  height: 36px !important;
  border-radius: 50% !important; 
  display: flex !important;
  align-items: center !important; 
  justify-content: center !important;
  padding: 0 !important; 
  margin: 0 !important;
  background: transparent !important;
  transition: background 0.2s !important;
}
.chat-header .header-actions .icon:hover { 
  background: rgba(128, 128, 128, 0.1) !important; 
}
.chat-header .header-actions .icon svg {
  width: 20px !important; 
  height: 20px !important;
  fill: var(--text) !important;
}

/* ═══════════════════════════════════════════════════════ */
/* ═══ FIX NEW CHAT BUTTON (SQUARE FAB) ═══ */
/* ═══════════════════════════════════════════════════════ */

#new-chat-fab {
  width: 56px !important;
  height: 56px !important;
  padding: 0 !important;
  border-radius: 16px !important; /* Rounded square */
  background: var(--user-accent-1) !important; /* Green */
  color: #FFFFFF !important;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
  box-shadow: 0 4px 15px rgba(0, 168, 132, 0.3) !important;
  position: absolute !important;
  bottom: 85px !important;
  right: 20px !important;
  z-index: 100 !important;
  
  /* Hide the "New Chat" text */
  font-size: 0 !important; 
  overflow: hidden !important;
  
  border: none !important;
  transition: transform 0.2s ease !important;
}

#new-chat-fab:active {
  transform: scale(0.92) !important;
}

#new-chat-fab svg {
  width: 28px !important;
  height: 28px !important;
  fill: #FFFFFF !important;
  margin: 0 !important;
}

  /* ═══════════════════════════════════════════════════════ */
  /* ═══ FORCE COMPACT MODALS & FIX MENUS ═══ */
  /* ═══════════════════════════════════════════════════════ */

  /* 1. Make ALL Modals Small */
  .modal {
    max-width: 320px !important;
    width: 90% !important;
    padding: 20px 16px !important;
    border-radius: 24px !important;
  }
  
  .modal h3 {
    font-size: 18px !important;
    margin-bottom: 16px !important;
  }

  /* 2. Fix the Message Menu (Image 2) */
  .emoji-picker {
    display: flex !important;
    justify-content: space-between !important;
    background: var(--bg-main) !important;
    padding: 8px 12px !important;
    border-radius: 16px !important;
    margin-bottom: 16px !important;
  }
  .emoji-picker span {
    font-size: 24px !important;
    padding: 4px !important;
    cursor: pointer;
  }

  /* Force buttons to be clean and transparent, killing the blue glitch */
  .msg-menu-overlay .modal button {
    background: transparent !important;
    border: none !important;
    box-shadow: none !important;
    border-radius: 12px !important;
    padding: 12px 16px !important;
    font-size: 15px !important;
    font-weight: 500 !important;
    color: var(--text) !important;
    margin: 0 !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 100% !important;
  }
  .msg-menu-overlay .modal button:active { background: rgba(128, 128, 128, 0.1) !important; }
  
  /* Fix the Cancel button specifically */
  .msg-menu-overlay .modal button[data-act="cancel"] {
    color: var(--text-muted) !important;
    border-top: 1px solid var(--border) !important;
    border-radius: 0 0 24px 24px !important;
    margin-top: 8px !important;
    padding-bottom: 16px !important;
  }
  
  /* Delete All Button */
  .msg-menu-overlay .modal button[data-act="delete-all"] {
    color: #ef4444 !important;
    font-weight: 600 !important;
  }
  
  /* Kill any weird pseudo-elements causing the blue glitch */
  .msg-menu-overlay .modal button::before,
  .msg-menu-overlay .modal button::after {
    display: none !important;
    content: none !important;
  }

  /* 3. Fix the Appearance Menu (Image 1) */
  .custom-theme-selector {
    display: flex !important;
    gap: 8px !important;
    justify-content: center !important;
    margin-bottom: 16px !important;
  }
  .custom-theme-selector button {
    flex: 1 !important;
    padding: 8px !important;
    font-size: 13px !important;
    border-radius: 10px !important;
  }

  .custom-color-palette {
    display: flex !important;
    flex-wrap: wrap !important;
    gap: 10px !important;
    justify-content: center !important;
    margin-bottom: 16px !important;
  }
  .color-swatch {
    width: 32px !important;
    height: 32px !important;
    min-width: 32px !important;
    min-height: 32px !important;
    border-radius: 50% !important;
    cursor: pointer !important;
  }
  .color-swatch.active {
    box-shadow: 0 0 0 2px var(--bg-main), 0 0 0 4px var(--text) !important;
    transform: scale(1.05) !important;
  }

  /* Make the bottom buttons in Appearance menu smaller */
  #reset-theme-btn, .modal [data-act="close"] {
    padding: 10px !important;
    font-size: 14px !important;
    border-radius: 12px !important;
    margin-top: 8px !important;
  }

  /* ═══════════════════════════════════════════════════════ */
  /* ═══ MODERN SLEEK PROFILE PAGE ═══ */
  /* ═══════════════════════════════════════════════════════ */
  
  #view-profile {
    background: var(--bg-main);
    overflow-y: auto;
    padding-bottom: 80px; /* Space for bottom nav */
  }

  .profile-header-bar {
    padding: 20px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: var(--bg-main);
    position: sticky;
    top: 0;
    z-index: 10;
  }

  .profile-header-bar h2 {
    font-size: 24px;
    font-weight: 800;
    margin: 0;
    letter-spacing: -0.5px;
  }

  .profile-top-card {
    margin: 0 20px 24px 20px;
    background: linear-gradient(145deg, var(--bg-card), var(--bg-main));
    border-radius: 28px;
    padding: 30px 20px;
    text-align: center;
    box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
    border: 1px solid rgba(255, 255, 255, 0.05);
    position: relative;
    overflow: hidden;
  }

  .profile-top-card::before {
    content: "";
    position: absolute;
    top: 0; left: 0; right: 0; height: 100px;
    background: linear-gradient(180deg, var(--user-accent-1), transparent);
    opacity: 0.1;
    z-index: 0;
  }

  .profile-avatar-wrap {
    width: 110px;
    height: 110px;
    margin: 0 auto 16px auto;
    border-radius: 50%;
    position: relative;
    z-index: 1;
    cursor: pointer;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
    border: 4px solid var(--bg-main);
    background: var(--bg-card);
  }

  .profile-avatar-wrap img, .profile-avatar-wrap .avatar-initial {
    width: 100%;
    height: 100%;
    border-radius: 50%;
    object-fit: cover;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 40px;
    font-weight: bold;
    color: var(--text-muted);
  }

  .profile-avatar-edit-badge {
    position: absolute;
    bottom: 0; right: 0;
    background: var(--user-accent-1);
    color: white;
    width: 32px; height: 32px;
    border-radius: 50%;
    display: flex; align-items: center; justify-content: center;
    border: 3px solid var(--bg-main);
    font-size: 14px;
    box-shadow: 0 4px 10px rgba(0,0,0,0.2);
  }

  .profile-name {
    font-size: 26px;
    font-weight: 800;
    margin: 0 0 4px 0;
    color: var(--text);
    z-index: 1; position: relative;
  }

  .profile-handle {
    font-size: 15px;
    color: var(--text-muted);
    margin: 0;
    font-weight: 500;
    z-index: 1; position: relative;
  }

  .settings-section {
    margin: 0 20px 24px 20px;
  }

  .section-title {
    font-size: 13px;
    text-transform: uppercase;
    letter-spacing: 1px;
    color: var(--text-muted);
    margin: 0 0 10px 8px;
    font-weight: 700;
  }

  .settings-card {
    background: var(--bg-card);
    border-radius: 20px;
    overflow: hidden;
    box-shadow: 0 4px 15px rgba(0,0,0,0.03);
  }

  .modern-settings-item {
    display: flex;
    align-items: center;
    padding: 16px 20px;
    cursor: pointer;
    transition: background 0.2s, transform 0.1s;
    border-bottom: 1px solid var(--border);
  }
  
  .modern-settings-item:last-child {
    border-bottom: none;
  }

  .modern-settings-item:active {
    background: rgba(128, 128, 128, 0.08);
    transform: scale(0.98);
  }

  .ms-icon {
    width: 42px; height: 42px;
    border-radius: 12px;
    display: flex; align-items: center; justify-content: center;
    margin-right: 16px;
    font-size: 20px;
    flex-shrink: 0;
  }

  .ms-info {
    flex: 1;
    min-width: 0;
  }

  .ms-info h4 {
    margin: 0 0 2px 0;
    font-size: 16px;
    font-weight: 600;
    color: var(--text);
  }

  .ms-info p {
    margin: 0;
    font-size: 13px;
    color: var(--text-muted);
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .ms-arrow {
    color: var(--text-muted);
    opacity: 0.5;
    font-size: 20px;
  }

  /* Special Styling for Admin Panel */
  .admin-card {
    background: linear-gradient(135deg, rgba(245, 158, 11, 0.1), rgba(245, 158, 11, 0.05));
    border: 1px solid rgba(245, 158, 11, 0.3);
  }
  
  .admin-card .modern-settings-item {
    border-bottom: none;
  }

  .admin-card .ms-info h4 {
    color: #f59e0b;
  }

  .sleek-footer {
    text-align: center;
    padding: 20px 20px 40px 20px;
    color: var(--text-muted);
    font-size: 12px;
    line-height: 1.6;
  }

  .sleek-footer b {
    color: var(--user-accent-1);
    font-weight: 700;
    letter-spacing: 0.5px;
  }

  /* ═══════════════════════════════════════════════════════ */
  /* ═══ FIX INVISIBLE BACK BUTTON ON SETTINGS PAGES ═══ */
  /* ═══════════════════════════════════════════════════════ */
  .settings-header .icon {
    color: var(--text) !important;
    background: transparent !important;
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 40px !important;
    height: 40px !important;
    border-radius: 50% !important;
    transition: background 0.2s !important;
    padding: 0 !important;
  }
  
  .settings-header .icon:active {
    background: rgba(128, 128, 128, 0.15) !important;
  }

  .settings-header .icon svg {
    fill: var(--text) !important;
    width: 24px !important;
    height: 24px !important;
  }
  
  /* ═══ FIX CHAT BACKGROUND IN DARK MODE ═══ */
[data-theme="dark"] .messages {
  background-color: #0b141a !important; /* Matches WhatsApp dark background */
}

/* ═══ STYLE THE "REPLIED TO STATUS" PREVIEW ═══ */
.status-reply-preview {
  display: flex !important;
  align-items: center !important;
  background: rgba(0, 0, 0, 0.2) !important;
  border-left: 3px solid #00a884 !important;
  border-radius: 6px !important;
  padding: 6px 10px 6px 6px !important;
  margin-bottom: 6px !important;
  gap: 10px !important;
  max-width: 100% !important;
}

.status-reply-preview img, 
.status-reply-preview video {
  width: 36px !important;
  height: 36px !important;
  border-radius: 4px !important;
  object-fit: cover !important;
  flex-shrink: 0 !important;
}

.status-reply-preview .sr-text {
  font-size: 13px !important;
  font-weight: 600 !important;
  color: #e9edef !important;
}

/* ═══ MAKE TIMESTAMPS READABLE ON GREEN BUBBLES ═══ */
.msg-row.me .msg-meta {
  color: rgba(255, 255, 255, 0.75) !important;
}

/* ═══ CLEAN UP RAW LINKS ═══ */
.bubble a {
  color: #53bdeb !important;
  text-decoration: underline !important;
  word-break: break-all !important;
}

/* ═══ FIX THE WHITE TRIANGLE TAILS ═══ */
.msg-row.me .bubble::after,
.msg-row.me .bubble::before {
  border-top-color: var(--bubble-color) !important;
}

[data-theme="dark"] .msg-row.them .bubble::after,
[data-theme="dark"] .msg-row.them .bubble::before {
  border-top-color: #202c33 !important; /* Matches dark bubble */
}

[data-theme="light"] .msg-row.them .bubble::after,
[data-theme="light"] .msg-row.them .bubble::before {
  border-top-color: #ffffff !important; /* Matches light bubble */
}

/* ═══ FIX THE HUGE STATUS VIDEO THUMBNAIL ═══ */
.status-reply-preview {
  max-height: 54px !important;
  overflow: hidden !important;
  padding: 4px 8px !important;
}

.status-reply-preview img, 
.status-reply-preview video {
  width: 42px !important;
  height: 42px !important;
  min-width: 42px !important;
  max-width: 42px !important;
  object-fit: cover !important;
  border-radius: 6px !important;
  margin: 0 !important;
  padding: 0 !important;
  flex-shrink: 0 !important;
}

/* ═══ KILL THE WHITE TRIANGLES COMPLETELY ═══ */
.bubble::after,
.bubble::before {
  display: none !important;
  content: none !important;
  border: none !important;
  background: none !important;
}

/* Round the corners nicely since the tails are gone */
.msg-row.me .bubble {
  border-top-right-radius: 12px !important;
}
.msg-row.them .bubble {
  border-top-left-radius: 12px !important;
}

/* ═══ FORCE THE STATUS THUMBNAIL TO BE SMALL ═══ */
.status-reply-preview video,
.status-reply-preview img {
  width: 40px !important;
  height: 40px !important;
  min-width: 40px !important;
  max-width: 40px !important;
  max-height: 40px !important;
  object-fit: cover !important;
  border-radius: 4px !important;
}

.status-reply-preview {
  padding: 4px 8px !important;
  max-height: 48px !important;
}

/* ═══════════════════════════════════════════════════════════════════════
   🌙 ULTIMATE DARK MODE FIX (OVERRIDES ALL UN-SCOPED LIGHT RULES)
   ═══════════════════════════════════════════════════════════════════════ */

/* 1. Force all main containers to match the dark background */
[data-theme="dark"] .sidebar,
[data-theme="dark"] .header,
[data-theme="dark"] .search-row,
[data-theme="dark"] .tabs-row,
[data-theme="dark"] .chat-list,
[data-theme="dark"] .chat-item {
  background-color: var(--bg-panel) !important;
  background: var(--bg-panel) !important;
}

/* 2. Fix the Tabs (Overrides premium.css hardcoded light grey) */
[data-theme="dark"] .tab-btn {
  background-color: var(--bg-main) !important;
  color: var(--text-muted) !important;
  border: 1px solid transparent !important;
}
[data-theme="dark"] .tab-btn.active {
  background-color: var(--user-accent-tint) !important;
  color: var(--user-accent-1) !important;
  border-color: var(--user-accent-1) !important;
}

/* 3. Fix the Search Bar (Overrides premium.css hardcoded light grey) */
[data-theme="dark"] .search-row input {
  background-color: var(--bg-main) !important;
  color: var(--text) !important;
  border: 1px solid transparent !important;
}
[data-theme="dark"] .search-row input::placeholder {
  color: var(--text-dim) !important;
}

/* 4. Fix the Status Camera Button */
[data-theme="dark"] #status-btn {
  background-color: var(--bg-main) !important;
  color: var(--user-accent-1) !important;
  border: 1px solid var(--border-light) !important;
}

/* 5. Ensure chat text is bright and readable */
[data-theme="dark"] .chat-name {
  color: var(--text) !important;
}
[data-theme="dark"] .chat-preview {
  color: var(--text-muted) !important;
}
  
`;
document.head.appendChild(styleFix);



// ══════════════════════════════════════════════════════════════════════════
//  CONSTANTS
// ══════════════════════════════════════════════════════════════════════════
const MESSAGE_TTL_MS       = 24 * 60 * 60 * 1000;
const STATUS_TTL_MS        = 5  * 60 * 60 * 1000;
const MEDIA_LIMITS         = { image: 5e6, audio: 5e6, video: 3e6, document: 2e6 };
const USER_CACHE_TTL       = 5 * 60 * 1000;
const PRESENCE_INTERVAL_MS = 30000;
const TYPING_TIMEOUT_MS    = 3000;
const SWIPE_REPLY_PX       = 60;
const LONG_PRESS_MS        = 480;

// ══════════════════════════════════════════════════════════════════════════
//  STATE
// ══════════════════════════════════════════════════════════════════════════
let currentUser       = null;
let currentView       = "chats";
let currentTab        = "friends";
let currentChatId     = null;
let currentOtherId    = null;
let currentConvData   = null;
let currentChatMeta   = null;
let currentMessages   = [];

let unsubMessages, unsubChats, unsubConvMeta, unsubBroadcast,
    unsubExplore, unsubStatuses, unsubUsers;

let latestChatsSnap   = null;
let presenceInterval  = null;
let mediaRecorder     = null, audioChunks = [], isRecording = false;
let replyToMsg        = null, isSending = false;
let knownChatTimestamps = new Map();
let activeStatusUsers = new Set();
let typingTimeout     = null, lastTypingUpdate = 0;
let userCache         = new Map();
let chatListRenderTimer = null;
let mediaViewerIndex  = 0;
let activeMessageContext = null;


// ══════════════════════════════════════════════════════════════════════════
//  UTILS
// ══════════════════════════════════════════════════════════════════════════
function toMillis(v) {
  if (!v) return 0;
  if (typeof v === "number") return v;
  if (typeof v.toMillis === "function") return v.toMillis();
  return 0;
}
function isUserOnline(ls) {
  return ls ? Date.now() - toMillis(ls) < 60000 : false;
}
function escapeHtml(s) {
  return String(s ?? "").replace(/[&<>"']/g, c =>
    ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]));
}
function normalizePhone(raw) {
  if (!raw) return null;
  const s = String(raw).replace(/[^\d+]/g, "");
  return s.length >= 8 ? s : null;
}
function formatDateLabel(ms) {
  const d = new Date(ms), t = new Date(), y = new Date(); y.setDate(t.getDate() - 1);
  const same = (a, b) => a.getFullYear() === b.getFullYear() &&
                          a.getMonth() === b.getMonth() &&
                          a.getDate() === b.getDate();
  if (same(d, t)) return "Today";
  if (same(d, y)) return "Yesterday";
  return d.toLocaleDateString([], { day: "numeric", month: "short", year: "numeric" });
}
function formatFileSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / 1048576).toFixed(1)} MB`;
}
function safeError(msg) {
  console.error("[Mofie]", msg);
  if (document.getElementById("app")?.children.length === 0) {
    renderFatalError(msg);
  }
}
function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

async function ensureE2EE() {
  if (E2EE.isE2EEUnlocked()) return true;

  // Ask for the password via a custom, stylish modal
  return new Promise((resolve) => {
    const { modal, close } = createModal(`
      <h3 style="text-align:center;margin-bottom:8px;display:flex;align-items:center;justify-content:center;gap:8px">
        <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--user-accent-1)"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5S7 3.24 7 6v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zm-6 9c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2zm3.1-9H8.9V6c0-1.71 1.39-3.1 3.1-3.1 1.71 0 3.1 1.39 3.1 3.1v2z"/></svg>
        Unlock Encryption
      </h3>
      <p style="text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:16px">
        Enter your password to read and send encrypted messages.
      </p>
      
      <input id="e2ee-pw" type="password" placeholder="Password"
        autocomplete="current-password"
        style="width:100%;padding:14px 16px;border-radius:12px;border:1px solid var(--border);background:var(--bg-main);color:var(--text);margin-bottom:8px;font-size:16px;text-align:center;">
      
      <div id="e2ee-err" style="color:#ef4444;font-size:13px;text-align:center;min-height:20px;margin-bottom:12px;font-weight:600"></div>
      
      <button class="btn-primary" data-act="ok" style="width:100%;padding:14px;font-size:16px">Unlock</button>
      <button class="btn-secondary" data-act="cancel" style="width:100%;padding:14px;font-size:16px">Cancel</button>
    `, { dismissible: false }); // Prevent closing by tapping outside

    const input = modal.querySelector("#e2ee-pw");
    const err = modal.querySelector("#e2ee-err");
    input.focus();

    const submit = async () => {
      const pw = input.value;
      if (!pw) {
        err.textContent = "Password is required";
        return;
      }
      
      // Show loading state
      const btn = modal.querySelector('[data-act="ok"]');
      const originalText = btn.textContent;
      btn.textContent = "Unlocking...";
      btn.disabled = true;
      err.textContent = "";

      try {
        await E2EE.initE2EE(db, currentUser, pw);
        close();
        resolve(true);
      } catch (e) {
        // Wrong password - shake the input and show error
        err.textContent = "Incorrect password. Try again.";
        input.value = "";
        input.focus();
        btn.textContent = originalText;
        btn.disabled = false;
        
        // Optional: Add a little shake animation
        input.animate([
          { transform: 'translateX(0)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(-6px)' },
          { transform: 'translateX(6px)' },
          { transform: 'translateX(0)' }
        ], { duration: 300 });
      }
    };

    modal.querySelector('[data-act="ok"]').onclick = submit;
    modal.querySelector('[data-act="cancel"]').onclick = () => {
      close();
      resolve(false);
    };
    
    // Submit on "Enter" key
    input.onkeydown = (e) => {
      if (e.key === "Enter") submit();
    };
  });
}

// ══════════════════════════════════════════════════════════════════════════
//  CALL LOGS · MISSED CALLS · SPEAKER
// ══════════════════════════════════════════════════════════════════════════

let unsubCallLogs        = null;
let hasLoggedCurrentCall = false;
let isSpeakerOn          = false;
let callWasAnswered      = false;

/* NEW — video-call state */
let currentFacingMode    = "user";  // "user" | "environment"
let isVideoOn            = true;

function formatCallDuration(sec) {
  sec = Math.max(0, Math.round(sec || 0));
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatCallDate(ms) {
  const d = new Date(ms);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const day = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const diffDays = Math.floor((today - day) / 86400000);
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  if (diffDays === 0) return `Today, ${timeStr}`;
  if (diffDays === 1) return `Yesterday, ${timeStr}`;
  if (diffDays < 7)   return `${d.toLocaleDateString([], { weekday: "long" })}, ${timeStr}`;
  return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${timeStr}`;
}

async function logCallEntry(callId, callData, role, startTimeMs) {
  if (!currentUser || !callData || !callId) return;

  const isCaller = role === "caller";
  const otherUid   = isCaller ? callData.calleeId   : callData.callerId;
  const otherName  = isCaller ? callData.calleeName : callData.callerName;
  const otherPhoto = isCaller ? callData.calleePhoto: callData.callerPhoto;

  const answered = !!(startTimeMs || callData.answeredAt);
  const reason   = callData.endedReason || "";

  let type;
  if (answered) {
    type = isCaller ? "outgoing" : "incoming";
  } else if (reason === "declined") {
    type = isCaller ? "outgoing" : "declined";   // 🆕 new type
  } else if (reason === "busy") {
    type = isCaller ? "outgoing" : "busy";       // 🆕
  } else {
    type = isCaller ? "outgoing" : "missed";
  }

  const duration = answered && startTimeMs
    ? Math.floor((Date.now() - startTimeMs) / 1000)
    : 0;

  try {
    await addDoc(collection(db, "users", currentUser.uid, "callLogs"), {
      callId, otherUserId: otherUid || "", otherUserName: otherName || "User",
      otherUserPhoto: otherPhoto || null, type, endedReason: reason,
      duration, timestamp: serverTimestamp(), read: false
    });
  } catch (e) { console.warn("[CallLog] write failed:", e.message); }
}

// ══════════════════════════════════════════════════════════════════════════
//  CALL LOGS · sync missed calls (real-time)
// ══════════════════════════════════════════════════════════════════════════
let unsubMissedSync = null;

function syncMissedCalls() {
  if (!currentUser) return;

  // Kill any previous listener before starting a new one
  if (unsubMissedSync) { unsubMissedSync(); unsubMissedSync = null; }

  const since = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000);

  unsubMissedSync = onSnapshot(
    query(
      collection(db, "calls"),
      where("calleeId", "==", currentUser.uid),
      where("createdAt", ">=", since)
    ),
    async (snap) => {
      // Only calls that are truly over and never got answered
      const ended = snap.docs.filter(d => {
        const c = d.data();
        if (c.answeredAt) return false;
        if (c.status === "ringing" || c.status === "active") return false;
        return true;
      });
      if (!ended.length) return;

      // Grab the existing log once per batch (cheap)
      const logSnap = await getDocs(
        collection(db, "users", currentUser.uid, "callLogs")
      );
      const logged = new Set(logSnap.docs.map(d => d.data().callId));

      for (const docSnap of ended) {
        if (logged.has(docSnap.id)) continue;
        const c = docSnap.data();
        const reason = c.endedReason || "";

        // 🆕 Distinguish declined / busy / missed
        const type =
          reason === "declined" ? "declined" :
          reason === "busy"     ? "busy"     :
                                  "missed";

        try {
          await addDoc(
            collection(db, "users", currentUser.uid, "callLogs"),
            {
              callId: docSnap.id,
              otherUserId: c.callerId || "",
              otherUserName: c.callerName || "User",
              otherUserPhoto: c.callerPhoto || null,
              type,
              endedReason: reason,
              duration: 0,
              timestamp: c.createdAt || serverTimestamp(),
              read: false
            }
          );
        } catch (e) {
          console.warn("[syncMissedCalls] write failed:", e.message);
        }
      }
    },
    err => console.warn("[syncMissedCalls]", err.message)
  );
}

function loadCallLogs() {
  if (!currentUser) return;
  const list = document.getElementById("calls-list");
  if (!list) return;

  if (unsubCallLogs) { unsubCallLogs(); unsubCallLogs = null; }

  if (!list.children.length) {
    list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">Loading calls…</div>`;
  }

  unsubCallLogs = onSnapshot(
    query(
      collection(db, "users", currentUser.uid, "callLogs"),
      orderBy("timestamp", "desc")
    ),
    snap => {
      // Count unread missed & declined calls for the badge
      const unreadBad = snap.docs.filter(d => {
        const c = d.data();
        return (c.type === "missed" || c.type === "declined") && !c.read;
      }).length;

      const badge = document.getElementById("calls-badge");
      if (badge) {
        if (unreadBad > 0) {
          badge.textContent = unreadBad > 9 ? "9+" : String(unreadBad);
          badge.style.display = "flex";
        } else {
          badge.style.display = "none";
        }
      }

      if (snap.empty) {
        list.innerHTML = `
          <div class="empty-state">
            <div class="empty-state-icon">📞</div>
            <h3>No calls yet</h3>
            <p>Your call history will appear here. Tap any contact to start a call.</p>
          </div>`;
        return;
      }

      // Icons for the different call types
      const icons = {
        missed:   `<svg viewBox="0 0 24 24" fill="#ef4444"><path d="M20 5.41L18.59 4 7 15.59V9H5v10h10v-2H8.41z"/></svg>`,
        declined: `<svg viewBox="0 0 24 24" fill="#ef4444"><path d="M20 5.41L18.59 4 7 15.59V9H5v10h10v-2H8.41z"/></svg>`,
        busy:     `<svg viewBox="0 0 24 24" fill="#f59e0b"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
        incoming:`<svg viewBox="0 0 24 24" fill="#10b981"><path d="M4 8.59L5.41 7 17 18.59V12h2v10H9v-2h6.59z"/></svg>`,
        outgoing:  `<svg viewBox="0 0 24 24" fill="#10b981"><path d="M20 15.59L18.59 17 7 5.41V12H5V2h10v2H8.41z"/></svg>`
      };

      const labelMap = {
        missed: "Missed", declined: "Declined", busy: "Busy",
        incoming: "Incoming", outgoing: "Outgoing"
      };

      // Render the list
      list.innerHTML = snap.docs.map(d => {
        const c = d.data();
        const ts = toMillis(c.timestamp) || Date.now();
        const isBad = c.type === "missed" || c.type === "declined";
        const icon = icons[c.type] || icons.outgoing;

        // ✅ FIXED: previewParts is now correctly defined INSIDE the loop
        const mediaEmoji = c.callType === "video" ? "📹 ": "";
const previewParts = [];
previewParts.push(`${mediaEmoji} ${labelMap[c.type] || "Call"}`);
if (c.duration > 0) previewParts.push(formatCallDuration(c.duration));

        return `<li class="call-log-item ${isBad ? "missed" : ""} ${(isBad && !c.read) ? "unread-missed" : ""}"
                    data-uid="${escapeHtml(c.otherUserId || "")}"
                    data-name="${escapeHtml(c.otherUserName || "User")}"
                    data-photo="${escapeHtml(c.otherUserPhoto || "")}"
                    data-logid="${d.id}">
          <div class="avatar-wrap">
            <div class="avatar">${c.otherUserPhoto
              ? `<img loading="lazy" src="${escapeHtml(c.otherUserPhoto)}" style="width:100%;height:100%;object-fit:cover" alt="">`
              : escapeHtml((c.otherUserName || "?")[0])}</div>
          </div>
          <div class="chat-info">
            <div class="chat-name">${escapeHtml(c.otherUserName || "User")}</div>
            <div class="call-log-preview" style="color:${isBad ? "#ef4444" : "var(--text-muted)"}">
              ${icon}
              <span>${previewParts.join(" · ")}</span>
            </div>
            <span class="call-log-time">${formatCallDate(ts)}</span>
          </div>
          <button class="icon call-back-btn"
                  data-uid="${escapeHtml(c.otherUserId || "")}"
                  data-name="${escapeHtml(c.otherUserName || "User")}"
                  data-photo="${escapeHtml(c.otherUserPhoto || "")}"
                  aria-label="Call back">
            ${ICONS.callTab}
          </button>
        </li>`;
      }).join("");

      list.querySelectorAll(".call-log-item").forEach(el => {
        el.onclick = (e) => {
          if (e.target.closest(".call-back-btn")) return;
          if (!el.dataset.uid) return;
          window.startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
        };
      });
      
      list.querySelectorAll(".call-back-btn").forEach(btn => {
        btn.onclick = (e) => {
          e.stopPropagation();
          if (!btn.dataset.uid) return;
          window.startVoiceCall(btn.dataset.uid, btn.dataset.name, btn.dataset.photo);
        };
      });

      if (currentView === "calls") {
        snap.docs.forEach(d => {
          if (!d.data().read) updateDoc(d.ref, { read: true }).catch(() => {});
        });
      }
    },
    err => {
      console.warn("[CallLogs sub]", err.message);
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <h3>Failed to load calls</h3>
          <p style="color:var(--text-muted);font-size:13px">${escapeHtml(err.message)}</p>
        </div>`;
    }
  );
}

function markCallsAsReadAndReload() {
  loadCallLogs();
}

// ══════════════════════════════════════════════════════════════════════════
//  UI: TOAST
// ══════════════════════════════════════════════════════════════════════════
window.showToast = (msg, ms = 2500) => {
  let stack = document.getElementById("toast-stack");
  if (!stack) {
    stack = document.createElement("div");
    stack.id = "toast-stack";
    stack.style.cssText =
      "position:fixed;bottom:96px;left:0;right:0;display:flex;flex-direction:column;" +
      "align-items:center;gap:8px;pointer-events:none;z-index:1200";
    document.body.appendChild(stack);
  }
  const t = document.createElement("div");
  t.className = "toast";
  t.textContent = msg;
  t.style.pointerEvents = "auto";
  stack.appendChild(t);
  requestAnimationFrame(() => t.classList.add("show"));
  setTimeout(() => {
    t.classList.remove("show");
    setTimeout(() => t.remove(), 350);
  }, ms);
};

// ══════════════════════════════════════════════════════════════════════════
//  UI: MODAL
// ══════════════════════════════════════════════════════════════════════════
function createModal(html, { dismissible = true, onClose = null } = {}) {
  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `<div class="modal">${html}</div>`;
  document.body.appendChild(overlay);

  const modal = overlay.querySelector(".modal");
  const focusables = modal.querySelectorAll(
    'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
  );
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  if (first) setTimeout(() => first.focus(), 60);

  const close = () => {
    overlay.remove();
    document.removeEventListener("keydown", handler);
    if (onClose) onClose();
  };

  const handler = (e) => {
    if (e.key === "Escape" && dismissible) close();
    if (e.key === "Tab") {
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };
  document.addEventListener("keydown", handler);

  if (dismissible) {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) close();
    });
  }
  return { overlay, modal, close };
}

window.showAlert = (title, message, isConfirm = false, onConfirm = null) => {
  const { overlay, modal, close } = createModal(`
    <h3>${escapeHtml(title)}</h3>
    <p style="font-size:14px;margin-bottom:20px;color:var(--text-muted);text-align:center">
      ${escapeHtml(message)}
    </p>
    <div style="display:flex;gap:10px">
      ${isConfirm ? `<button class="btn-secondary" data-act="cancel" style="flex:1;margin:0">Cancel</button>` : ""}
      <button class="btn-primary" data-act="ok" style="flex:1;margin:0">${isConfirm ? "Confirm" : "OK"}</button>
    </div>
  `);
  modal.querySelector('[data-act="ok"]').onclick = () => {
    close();
    if (onConfirm) onConfirm();
  };
  modal.querySelector('[data-act="cancel"]')?.addEventListener("click", close);
};



// ══════════════════════════════════════════════════════════════════════════
//  GLOWING SMART AI ASSISTANT (Full-Screen Mobile Edition)
// ══════════════════════════════════════════════════════════════════════════

// Groq is now proxied through Cloudflare Worker — key stays server-side.
const AI_PROXY_URL = "https://mofie-api.hermanedaru.workers.dev";

function injectAIAssistant() {
  if (document.getElementById("ai-assistant-btn")) return;

  // ── Styles (injected once, theme-aware) ────────────────────────────
  if (!document.getElementById("mofie-ai-styles")) {
    const s = document.createElement("style");
    s.id = "mofie-ai-styles";
    s.textContent = `
      /* ─── FAB ─────────────────────────────────────────────────────── */
      .ai-fab-container {
        position: fixed; right: 20px; bottom: 160px; z-index: 9999;
        display: flex; align-items: center; justify-content: center;
        transition: transform .2s, opacity .2s;
      }
      .ai-fab-container:active { transform: scale(.9); }

      .ai-fab-glow {
        position: absolute; width: 50px; height: 50px;
        background: var(--user-accent-1, #00A884);
        border-radius: 50%; filter: blur(12px); opacity: .55;
        animation: aiPulseGlow 2s infinite alternate;
      }
      @keyframes aiPulseGlow {
        0%   { transform: scale(.8); opacity: .4; }
        100% { transform: scale(1.3); opacity: .75; }
      }

      .ai-fab-btn {
        width: 52px; height: 52px; border-radius: 50%;
        background: var(--surface-elevated, #fff);
        display: flex; align-items: center; justify-content: center;
        cursor: pointer; z-index: 1;
        box-shadow: 0 4px 15px rgba(0,0,0,.18);
        border: 1px solid var(--border-light, rgba(0,0,0,.06));
      }
      .ai-fab-btn svg {
        width: 26px; height: 26px;
        fill: var(--user-accent-1, #00A884);
      }

      /* ─── FULL SCREEN MOBILE WINDOW ───────────────────────────────── */
      .ai-chat-window {
        position: fixed; top: 0; left: 0; right: 0; bottom: 0;
        width: 100%; height: 100dvh;
        background: var(--bg-panel, #fff) !important;
        display: flex; flex-direction: column;
        z-index: 999999; /* Forces it above bottom nav */
        opacity: 0; pointer-events: none;
        transform: translateY(100%);
        transition: all .3s cubic-bezier(.16, 1, .3, 1);
      }
      .ai-chat-window.open {
        opacity: 1; pointer-events: auto;
        transform: translateY(0);
      }

      /* Desktop/Tablet override: Floating Modal */
      @media (min-width: 600px) {
        .ai-chat-window {
          top: 50%; left: 50%; bottom: auto; right: auto;
          width: 90%; max-width: 500px; height: 85dvh; max-height: 750px;
          border-radius: 24px;
          border: 1px solid var(--border);
          box-shadow: 0 20px 60px rgba(0,0,0,0.4);
          transform: translate(-50%, -45%) scale(.95);
        }
        .ai-chat-window.open {
          transform: translate(-50%, -50%) scale(1);
        }
      }

      /* ─── HEADER ──────────────────────────────────────────────────── */
      .ai-chat-header {
        padding: 16px 20px;
        display: flex; justify-content: space-between; align-items: center;
        background: var(--bg-panel, #f8f9fa) !important;
        border-bottom: 1px solid var(--border-light);
        padding-top: calc(16px + env(safe-area-inset-top, 0px));
      }
      .ai-chat-header h4 {
        margin: 0; font-size: 18px; font-weight: 800;
        display: flex; align-items: center; gap: 10px;
        color: var(--text, #000);
      }
      .ai-dot {
        width: 10px; height: 10px; background: #10b981;
        border-radius: 50%; box-shadow: 0 0 10px #10b981;
      }
      .ai-header-actions { display: flex; gap: 8px; }
      .ai-header-btn {
        background: transparent; border: none; cursor: pointer;
        color: var(--text-muted, #6b7280);
        padding: 8px; border-radius: 50%;
        display: flex; align-items: center; justify-content: center;
        transition: background .2s, color .2s;
      }
      .ai-header-btn:hover { background: rgba(128,128,128,.15); color: var(--text, #000); }
      .ai-header-btn.active { color: var(--user-accent-1, #00A884); }

      /* ─── MESSAGES AREA ───────────────────────────────────────────── */
      .ai-chat-messages {
        flex: 1; min-height: 0; overflow-y: auto; padding: 20px;
        display: flex; flex-direction: column; gap: 16px;
        background: var(--bg-main, #fff) !important;
      }
      .ai-chat-messages::-webkit-scrollbar { width: 6px; }
      .ai-chat-messages::-webkit-scrollbar-thumb {
        background: rgba(128,128,128,.25); border-radius: 10px;
      }

      .ai-msg {
        max-width: 90%; font-size: 15.5px; line-height: 1.5;
        word-wrap: break-word;
        animation: aiSlideUp .25s ease-out;
      }
      @keyframes aiSlideUp {
        from { opacity: 0; transform: translateY(10px); }
        to   { opacity: 1; transform: translateY(0); }
      }

      /* Clean AI Text */
      .ai-msg.bot {
        align-self: flex-start;
        background: transparent !important;
        color: var(--text, #000) !important;
        border: none !important;
        box-shadow: none !important;
        padding: 0;
      }
      
      /* User Bubble */
      .ai-msg.user {
        align-self: flex-end;
        background: var(--user-accent-1, #00A884) !important;
        color: #fff !important;
        padding: 12px 18px;
        border-radius: 20px 20px 4px 20px;
        box-shadow: 0 2px 8px rgba(0,168,132,.2);
      }

      /* ─── IMAGE RESULT ────────────────────────────────────────────── */
      .ai-generated-image {
        margin-top: 12px; border-radius: 16px; overflow: hidden;
        background: rgba(128,128,128,.1);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        min-height: 150px; width: 100%; max-width: 300px;
        border: 1px solid var(--border-light);
      }
      .ai-generated-image img {
        width: 100%; height: auto; display: none;
        animation: aiFadeIn .5s ease;
      }
      @keyframes aiFadeIn { from { opacity: 0; } to { opacity: 1; } }
      .ai-img-loading {
        padding: 20px; font-size: 13px; color: var(--text-muted);
        display: flex; align-items: center; gap: 8px;
      }
      .ai-img-loading::after {
        content: ""; width: 12px; height: 12px;
        border: 2px solid var(--text-muted);
        border-top-color: transparent; border-radius: 50%;
        animation: aiSpin 1s linear infinite;
      }
      @keyframes aiSpin { to { transform: rotate(360deg); } }
      .ai-img-download {
        display: block; width: 100%; text-align: center;
        padding: 12px; background: rgba(128,128,128,.15);
        color: var(--text, #000); text-decoration: none;
        font-size: 13px; font-weight: 700;
        transition: background .2s;
      }
      .ai-img-download:hover { background: rgba(128,128,128,.25); }

      /* ─── TYPING DOTS ─────────────────────────────────────────────── */
      .typing-dots { display: flex; gap: 5px; padding: 8px 0 !important; background: transparent !important; }
      .typing-dots span {
        width: 6px; height: 6px; background: var(--text-muted);
        border-radius: 50%;
        animation: aiBounce 1.4s infinite ease-in-out both;
      }
      .typing-dots span:nth-child(1) { animation-delay: -.32s; }
      .typing-dots span:nth-child(2) { animation-delay: -.16s; }
      @keyframes aiBounce {
        0%, 80%, 100% { transform: scale(0); }
        40% { transform: scale(1); }
      }

      /* ─── INPUT BAR ───────────────────────────────────────────────── */
      .ai-chat-input-area {
        padding: 12px 16px; display: flex; gap: 10px; align-items: center;
        background: var(--bg-panel, #f8f9fa) !important;
        border-top: 1px solid var(--border-light);
        padding-bottom: calc(12px + env(safe-area-inset-bottom, 0px));
      }
      .ai-chat-input-area input {
        flex: 1; min-width: 0;
        border: none;
        background: var(--bg-main, #fff);
        padding: 14px 20px; border-radius: 24px;
        color: var(--text, #000); font-size: 15px; outline: none;
        box-shadow: inset 0 1px 4px rgba(0,0,0,.05);
      }
      .ai-chat-input-area input:focus {
        box-shadow: 0 0 0 2px var(--user-accent-1, #00A884);
      }
      .ai-chat-input-area input::placeholder {
        color: var(--text-dim, #9ca3af);
      }
      .ai-send-btn {
        width: 48px; height: 48px; border-radius: 50%;
        background: var(--user-accent-1, #00A884);
        border: none; cursor: pointer; color: #fff;
        display: flex; align-items: center; justify-content: center;
        flex-shrink: 0;
        box-shadow: 0 4px 12px rgba(0,168,132,.3);
        transition: transform .2s;
      }
      .ai-send-btn:active { transform: scale(.9); }

      /* ─── MARKDOWN ────────────────────────────────────────────────── */
      .ai-msg pre {
        background: rgba(128,128,128,.12);
        padding: 12px; border-radius: 12px;
        overflow-x: auto; font-family: monospace; font-size: 13px;
        margin: 10px 0; color: var(--text, inherit);
        border: 1px solid var(--border-light);
      }
      .ai-msg code {
        background: rgba(128,128,128,.12);
        padding: 3px 6px; border-radius: 6px;
        font-family: monospace; font-size: 13.5px; color: var(--text, inherit);
      }
    `;
    document.head.appendChild(s);
  }

  // ── Context ────────────────────────────────────────────────────────
  const userName = currentUser?.displayName
    ? currentUser.displayName.split(" ")[0]
    : "there";
  const isCreator = currentUser?.email === "hermanedaru@gmail.com";

  const greeting = isCreator
    ? `Hello Herman! 👋 I'm <b>Mofie</b>. I'm fully online. I can answer questions, speak out loud, and even generate images for you!`
    : `Hello ${userName}! 👋 I'm <b>Mofie</b>. Ask me anything — I can answer questions, generate images, or help you navigate the app.`;

  // ── FAB ────────────────────────────────────────────────────────────
  const fab = document.createElement("div");
  fab.className = "ai-fab-container";
  fab.id = "ai-assistant-btn";
  fab.innerHTML = `
    <div class="ai-fab-glow"></div>
    <div class="ai-fab-btn">
      <svg viewBox="0 0 24 24"><path d="M12 2a2 2 0 0 1 2 2c0 .74-.4 1.39-1 1.73V7h1a7 7 0 0 1 7 7h1a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v1a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-1H2a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h1a7 7 0 0 1 7-7h1V5.73c-.6-.34-1-.99-1-1.73a2 2 0 0 1 2-2M7.5 13a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3m9 0a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3Z"/></svg>
    </div>
  `;
  document.body.appendChild(fab);

  // ── Window ─────────────────────────────────────────────────────────
  const chatWin = document.createElement("div");
  chatWin.className = "ai-chat-window";
  chatWin.id = "ai-chat-window";
  chatWin.innerHTML = `
    <div class="ai-chat-header">
      <h4><span class="ai-dot"></span> Mofie AI</h4>
      <div class="ai-header-actions">
        <button class="ai-header-btn active" id="ai-voice-toggle" title="Toggle Voice" type="button">
          <svg id="ai-voice-icon" viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>
          </svg>
        </button>
        <button class="ai-header-btn" id="close-ai-chat" title="Close" type="button">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
            <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
          </svg>
        </button>
      </div>
    </div>
    <div class="ai-chat-messages" id="ai-messages">
      <div class="ai-msg bot">${greeting}</div>
    </div>
    <div class="ai-chat-input-area">
      <input id="ai-input" placeholder="Ask me anything…" autocomplete="off">
      <button class="ai-send-btn" id="ai-send-btn" type="button">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
          <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
        </svg>
      </button>
    </div>
  `;
  document.body.appendChild(chatWin);

  // ── Auto-hide FAB when a chat is open ──────────────────────────────
  const chatWindowEl = document.getElementById("chat-window");
  if (chatWindowEl) {
    new MutationObserver(() => {
      if (chatWindowEl.classList.contains("active")) {
        fab.style.display = "none";
        chatWin.classList.remove("open");
        try { window.speechSynthesis?.cancel(); } catch (e) {}
      } else {
        fab.style.display = "flex";
      }
    }).observe(chatWindowEl, { attributes: true, attributeFilter: ["class"] });
  }

  // ── State ──────────────────────────────────────────────────────────
  let chatHistory = [];
  let isVoiceEnabled = true;

  const voiceBtn = document.getElementById("ai-voice-toggle");
  const voiceIcon = document.getElementById("ai-voice-icon");
  const MUTE_ICON = `<path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/>`;
  const UNMUTE_ICON = `<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/>`;

  const setVoiceUI = () => {
    voiceBtn.classList.toggle("active", isVoiceEnabled);
    voiceIcon.innerHTML = isVoiceEnabled ? UNMUTE_ICON : MUTE_ICON;
  };
  setVoiceUI();

  voiceBtn.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    isVoiceEnabled = !isVoiceEnabled;
    setVoiceUI();
    if (!isVoiceEnabled) { try { window.speechSynthesis?.cancel(); } catch (err) {} }
  };

  fab.onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    chatWin.classList.add("open");
    setTimeout(() => document.getElementById("ai-input")?.focus(), 300);
  };

  document.getElementById("close-ai-chat").onclick = (e) => {
    e.preventDefault(); e.stopPropagation();
    try { window.speechSynthesis?.cancel(); } catch (err) {}
    chatWin.classList.remove("open");
  };

  const input = document.getElementById("ai-input");
  const sendBtn = document.getElementById("ai-send-btn");
  const msgsContainer = document.getElementById("ai-messages");

// ── Helpers ────────────────────────────────────────────────────────
  const formatMarkdown = (text) =>
    text
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
      .replace(/\*(.+?)\*/g, "<i>$1</i>")
      .replace(/```([\s\S]*?)```/g, "<pre><code>$1</code></pre>")
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\n/g, "<br>");

  const addMessage = (text, sender) => {
    const div = document.createElement("div");
    div.className = `ai-msg ${sender}`;
    div.innerHTML = formatMarkdown(text);
    msgsContainer.appendChild(div);
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
  };

  const typeMessage = (text, rawHtml = "") => {
    const div = document.createElement("div");
    div.className = "ai-msg bot";
    msgsContainer.appendChild(div);

    let i = 0;
    const speed = 15; 
    const chunkSize = 2; 

    const interval = setInterval(() => {
      i += chunkSize;
      if (i >= text.length) {
        clearInterval(interval);
        div.innerHTML = formatMarkdown(text) + (rawHtml || "");
      } else {
        div.innerHTML = formatMarkdown(text.substring(0, i));
      }
      msgsContainer.scrollTop = msgsContainer.scrollHeight;
    }, speed);
  };

  const showTyping = () => {
    const d = document.createElement("div");
    d.className = "ai-msg bot typing-dots";
    d.id = "ai-typing";
    d.innerHTML = "<span></span><span></span><span></span>";
    msgsContainer.appendChild(d);
    msgsContainer.scrollTop = msgsContainer.scrollHeight;
  };
  const removeTyping = () => document.getElementById("ai-typing")?.remove();

  const speakText = (text) => {
    if (!isVoiceEnabled || !("speechSynthesis" in window)) return;
    try { window.speechSynthesis.cancel(); } catch (e) {}

    const clean = text
      .replace(/\[ACTION:.*?\]/g, "")
      .replace(/\[IMAGE:.*?\]/g, "Here is the image you requested.")
      .replace(/```[\s\S]*?```/g, "Code block omitted.")
      .replace(/`[^`]*`/g, "")
      .replace(/\*\*(.+?)\*\*/g, "$1")
      .replace(/\*(.+?)\*/g, "$1")
      .replace(/<[^>]*>/g, "")
      .trim();
    if (!clean) return;

    const u = new SpeechSynthesisUtterance(clean);
    const voices = window.speechSynthesis.getVoices();
    const preferred = voices.find(v =>
      v.name.includes("Google") || v.name.includes("Samantha") || v.name.includes("Female"));
    if (preferred) u.voice = preferred;
    u.rate = 1.05; u.pitch = 1.0;
    window.speechSynthesis.speak(u);
  };

  // ── Direct Groq API Call (No Cloud Function Required) ──────────────
  const askGemini = async (userText) => {
    const creatorCtx = isCreator
      ? `The person you're speaking to is Herman — your brilliant creator, developer, and owner. Address him naturally.`
      : `The person you're speaking to is ${userName}. If they ask who made you, say Herman. For support: hermanedaru@gmail.com / +256790311166.`;

    const systemPrompt = `
You are Mofie, an advanced AI assistant living inside the Mofie messaging app.
You are helpful, sharp, and conversational.

CONTEXT: ${creatorCtx}

IMAGE DIRECTIVE:
If the user asks to draw / create / generate an image, output only a tag: [IMAGE: detailed description]. Do NOT describe the image in text.

APP ACTION DIRECTIVE:
If the user asks to navigate, append tags at the END:
[ACTION:go_to_chats] [ACTION:go_to_profile] [ACTION:dark_mode] [ACTION:light_mode]
[ACTION:open_theme_modal] [ACTION:open_status] [ACTION:create_group]
[ACTION:open_starred] [ACTION:open_timer]

STRICT RULES:
- Your name is "Mofie".
- Use Markdown (**bold**, *italic*, \`code\`, \`\`\`blocks\`\`\`).
- Be concise unless deep detail is needed.`;

    const messages = [
      { role: "system", content: systemPrompt },
      ...chatHistory.map(msg => ({
        role: msg.role === "model" ? "assistant" : "user",
        content: msg.parts[0].text
      })),
      { role: "user", content: userText }
    ];

    try {
      const res = await fetch(`${AI_PROXY_URL}/ai`, {
  method: "POST",
  headers: {
    "Content-Type": "application/json"
  },
        body: JSON.stringify({
          model: "openai/gpt-oss-120b",
          messages: messages,
          temperature: 0.85,
          max_tokens: 1500
        })
      });

      const data = await res.json();
      
      if (!res.ok || data.error) {
        return `⚠️ Error: ${data.error?.message || "Unknown error"}.`;
      }

      if (data.choices && data.choices[0] && data.choices[0].message) {
        const aiText = data.choices[0].message.content;
        
        chatHistory.push({ role: "user", parts: [{ text: userText }] });
        chatHistory.push({ role: "model", parts: [{ text: aiText }] });
        
        if (chatHistory.length > 10) chatHistory = chatHistory.slice(-10);
        
        return aiText;
      }
      return "I got an empty response. Try again?";
    } catch (err) {
      console.error("[AI] network:", err);
      return "Network error — check your connection.";
    }
  };

 // ── Main pipeline ──────────────────────────────────────────────────
  const processUserMessage = async () => {
    const text = input.value.trim();
    if (!text) return;

    try { window.speechSynthesis?.cancel(); } catch (e) {}

    addMessage(text, "user");
    input.value = "";
    showTyping();

    const raw = await askGemini(text);
    removeTyping();

    // App actions
    if (raw.includes("[ACTION:go_to_chats]"))      window.switchView?.("chats");
    if (raw.includes("[ACTION:go_to_profile]"))    window.switchView?.("profile");
    if (raw.includes("[ACTION:dark_mode]"))        { localStorage.setItem("mofie-theme", "dark"); applyTheme(); }
    if (raw.includes("[ACTION:light_mode]"))       { localStorage.setItem("mofie-theme", "light"); applyTheme(); }
    if (raw.includes("[ACTION:open_theme_modal]")) window.openThemeModal?.();
    if (raw.includes("[ACTION:open_status]"))      window.openStatusTab?.();
    if (raw.includes("[ACTION:create_group]"))     window.openNewGroupModal?.();
    if (raw.includes("[ACTION:open_starred]"))     window.openStarredMessages?.();
    if (raw.includes("[ACTION:open_timer]"))       window.openTimerModal?.();

    let clean = raw.replace(/\[ACTION:.*?\]/g, "").trim();
    let imageHtml = "";

    const imgMatch = clean.match(/\[IMAGE:\s*(.*?)\]/i);
    if (imgMatch) {
      const prompt = imgMatch[1];
      clean = clean.replace(/\[IMAGE:\s*.*?\]/i, "").trim();
      const imgUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=600&height=600&nologo=true`;
      imageHtml = `
        <div class="ai-generated-image">
          <div class="ai-img-loading">Generating…</div>
          <img src="${imgUrl}" alt="${escapeHtml(prompt)}"
               onload="this.style.display='block'; this.previousElementSibling.style.display='none';">
          <a href="${imgUrl}" download="${escapeHtml(prompt)}.jpg" target="_blank" class="ai-img-download">Download Image</a>
        </div>`;
    }

    typeMessage(clean, imageHtml);
    speakText(clean);
  };

  sendBtn.onclick = processUserMessage;
  input.onkeydown = (e) => { if (e.key === "Enter") processUserMessage(); };

  console.log("[AI] Assistant injected ✅ (Groq Edition)");
}

// ══════════════════════════════════════════════════════════════════════════
//  AI OBSERVER
// ══════════════════════════════════════════════════════════════════════════
const aiObserver = new MutationObserver(() => {
  if (document.getElementById("view-chats") && !document.getElementById("ai-assistant-btn")) {
    try { injectAIAssistant(); } catch (e) { console.warn("[AI] inject failed:", e); }
  }
});
aiObserver.observe(document.body, { childList: true, subtree: true });

setTimeout(() => {
  if (document.getElementById("view-chats") && !document.getElementById("ai-assistant-btn")) {
    try { injectAIAssistant(); } catch (e) { console.warn("[AI] fallback inject failed:", e); }
  }
}, 800);

// ══════════════════════════════════════════════════════════════════════════
//  ICONS
// ══════════════════════════════════════════════════════════════════════════
const ICONS = {
  back:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/></svg>`,
  dots:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 8c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2zm0 2c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm0 6c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2z"/></svg>`,
  attach:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16.5 6v11.5c0 2.21-1.79 4-4 4s-4-1.79-4-4V5c0-1.38 1.12-2.5 2.5-2.5s2.5 1.12 2.5 2.5v10.5c0 .55-.45 1-1 1s-1-.45-1-1V6H10v9.5c0 1.38 1.12 2.5 2.5 2.5s2.5-1.12 2.5-2.5V5c0-2.21-1.79-4-4-4S7 2.79 7 5v12.5c0 3.04 2.46 5.5 5.5 5.5s5.5-2.46 5.5-5.5V6h-1.5z"/></svg>`,
  mic:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`,
  send:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>`,
  clock:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>`,
  group:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
  forward:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M14 9V5l7 7-7 7v-4.1c-5 0-8.5 1.6-11 5.1 1-5 4-10 11-11z"/></svg>`,
  info:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
  emoji:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>`,
  explore:`<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm-5.5-2.5l7.51-3.49L17.5 6.5 9.99 9.99 6.5 17.5zm5.5-6.6c.61 0 1.1.49 1.1 1.1s-.49 1.1-1.1 1.1-1.1-.49-1.1-1.1.49-1.1 1.1-1.1z"/></svg>`,
  status:`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h3l2-3h4l2 3h3a2 2 0 0 1 2 2v5.5"/><circle cx="12" cy="13" r="4"/><line x1="19" y1="4" x2="19" y2="10"/><line x1="16" y1="7" x2="22" y2="7"/></svg>`,
  search:`<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27a6.5 6.5 0 1 0-.7.7l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0A4.5 4.5 0 1 1 14 9.5 4.5 4.5 0 0 1 9.5 14z"/></svg>`,
  pin:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M14 4v5c0 1.12.37 2.16 1 3H9c.65-.86 1-1.9 1-3V4h4m3-2H7c-.55 0-1 .45-1 1s.45 1 1 1h1v5c0 1.66-1.34 3-3 3v2h5.97v7l1 1 1-1v-7H19v-2c-1.66 0-3-1.34-3-3V4h1c.55 0 1-.45 1-1s-.45-1-1-1z"/></svg>`,
  mute:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`,
  download:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/></svg>`,
  close:`<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/></svg>`,
  reply:`<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z"/></svg>`,
  phonebook:`<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M18 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zm-7 3a3 3 0 1 1 0 6 3 3 0 0 1 0-6zm6 14H7v-1c0-2 4-3.1 6-3.1s6 1.1 6 3.1v1z"/></svg>`,
  chatTab:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M20 2H4c-1.1 0-1.99.9-1.99 2L2 22l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg>`,
  profileTab:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
  callTab:`<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`
};

// ══════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════
let audioContext = null, audioUnlocked = false;

function unlockAudio() {
  if (audioUnlocked && audioContext && audioContext.state === "running") return;
  try {
    if (!audioContext) audioContext = new (window.AudioContext || window.webkitAudioContext)();
    if (audioContext.state === "suspended") audioContext.resume();
    audioUnlocked = true;
  } catch (_) {}
}
["pointerdown", "keydown", "touchstart"].forEach(ev =>
  document.addEventListener(ev, unlockAudio, { passive: true }));

function playChime() {
  try {
    unlockAudio();
    if (!audioContext) return;
    if (audioContext.state === "suspended") audioContext.resume();
    const now = audioContext.currentTime;
    const tone = (freq, start, dur, vol = 0.18) => {
      const o = audioContext.createOscillator(), g = audioContext.createGain();
      o.connect(g); g.connect(audioContext.destination);
      o.type = "sine"; o.frequency.setValueAtTime(freq, start);
      g.gain.setValueAtTime(0, start);
      g.gain.linearRampToValueAtTime(vol, start + 0.01);
      g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
      o.start(start); o.stop(start + dur);
    };
    tone(880, now, 0.15);
    tone(1175, now + 0.08, 0.25);
  } catch (_) {}
}

function notifyForeground(senderName, text, chatId) {
  const win = document.getElementById("chat-window");
  const viewingThis = chatId === currentChatId &&
    currentView === "chats" &&
    win && win.classList.contains("active") &&
    document.visibilityState === "visible";
  if (viewingThis) return;
  playChime();
  if (document.visibilityState === "visible") {
    let banner = document.getElementById("mofie-in-app-banner");
    if (!banner) {
      banner = document.createElement("div");
      banner.id = "mofie-in-app-banner";
      banner.className = "in-app-banner";
      document.body.appendChild(banner);
    }
    banner.innerHTML = `
      <div class="banner-avatar">${(senderName || "M")[0].toUpperCase()}</div>
      <div class="banner-content">
        <div class="banner-title">${escapeHtml(senderName || "Mofie")}</div>
        <div class="banner-body">${escapeHtml(text || "New message")}</div>
      </div>`;
    banner.onclick = () => {
      banner.classList.remove("show");
      openChatById(chatId);
    };
    requestAnimationFrame(() => banner.classList.add("show"));
    clearTimeout(window._mofieBannerTO);
    window._mofieBannerTO = setTimeout(() => banner.classList.remove("show"), 4000);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  USER CACHE
// ══════════════════════════════════════════════════════════════════════════
async function getUserCached(uid) {
  if (!uid) return { displayName: "Unknown", username: "user" };
  const hit = userCache.get(uid);
  if (hit && Date.now() - hit.ts < USER_CACHE_TTL) return hit.data;
  try {
    const snap = await getDoc(doc(db, "users", uid));
    const data = snap.exists() ? snap.data() : { displayName: "Unknown" };
    userCache.set(uid, { data, ts: Date.now() });
    return data;
  } catch (e) {
    return (hit && hit.data) ? hit.data : { displayName: "Unknown" };
  }
}

function subscribeToUsers() {
  if (unsubUsers) unsubUsers();
  unsubUsers = onSnapshot(collection(db, "users"), snap => {
    snap.forEach(d => userCache.set(d.id, { data: d.data(), ts: Date.now() }));
    scheduleChatListRender();
  }, e => console.warn("users sub:", e.message));
}

// ══════════════════════════════════════════════════════════════════════════
//  PRESENCE & SWEEP
// ══════════════════════════════════════════════════════════════════════════
function startPresence() {
  if (!currentUser) return;
  const ref = doc(db, "users", currentUser.uid);
  const update = () => {
    if (document.visibilityState === "visible") {
      setDoc(ref, { lastSeen: serverTimestamp() }, { merge: true }).catch(() => {});
    }
  };
  update();
  clearInterval(presenceInterval);
  presenceInterval = setInterval(update, PRESENCE_INTERVAL_MS);
  document.addEventListener("visibilitychange", update);
}

function startExpirySweep() {
  const sweep = async () => {
    const now = Timestamp.now();
    try {
      const st = await getDocs(query(collection(db, "statuses"), where("expireAt", "<=", now)));
      await Promise.all(st.docs.map(d => deleteDoc(d.ref).catch(e =>
        console.warn("[sweep status]", d.id, e.code, e.message))));
    } catch (e) { console.warn("[sweep statuses]", e.code, e.message); }

    try {
      const ms = await getDocs(query(collectionGroup(db, "messages"), where("expireAt", "<=", now)));
      await Promise.all(ms.docs.map(d => deleteDoc(d.ref).catch(e =>
        console.warn("[sweep msg]", d.id, e.code, e.message))));
    } catch (e) { console.warn("[sweep messages]", e.code, e.message); }
  };

  sweep(); // Runs immediately on app open
  setInterval(sweep, 15 * 60 * 1000); // Then runs every 15 minutes
}

function subscribeToStatuses() {
  if (unsubStatuses) unsubStatuses();
  unsubStatuses = onSnapshot(collection(db, "statuses"), snap => {
    const now = Date.now();
    activeStatusUsers.clear();
    snap.forEach(d => {
      const s = d.data();
      const ex = toMillis(s.expireAt);
      if (ex && ex < now) { deleteDoc(d.ref).catch(() => {}); return; }
      activeStatusUsers.add(s.userId);
    });
    document.querySelectorAll("#chats-list .chat-item[data-uid]").forEach(el => {
      const wrap = el.querySelector(".avatar-wrap");
      const uid = el.dataset.uid;
      if (wrap && uid) wrap.classList.toggle("has-status", activeStatusUsers.has(uid));
    });
  }, e => console.warn("statuses sub:", e.message));
}

// ══════════════════════════════════════════════════════════════════════════
//  THEME
// ══════════════════════════════════════════════════════════════════════════
function applyTheme() {
  const themeMode = localStorage.getItem("mofie-theme") || "dark";
  document.documentElement.setAttribute("data-theme", themeMode);

  const defaultAccent1 = "#00A884"; 
  const defaultAccent2 = "#25D366";
  
  // WhatsApp Default Bubble Colors
  const defaultBubbleColor = themeMode === "light" ? "#D9FDD3" : "#005C4B";
  
  const accent1 = localStorage.getItem("mofie-accent1") || defaultAccent1;
  const accent2 = localStorage.getItem("mofie-accent2") || defaultAccent2;
  
  document.documentElement.style.setProperty("--user-accent-1", accent1);
  document.documentElement.style.setProperty("--user-accent-2", accent2);
  
  const bubbleColor = localStorage.getItem("mofie-bubble-color") || defaultBubbleColor;
  document.documentElement.style.setProperty("--bubble-color", bubbleColor);
  
  document.body.style.backgroundColor = "var(--bg-main)";
}
applyTheme();

// ══════════════════════════════════════════════════════════════════════════
//  UPLOAD
// ══════════════════════════════════════════════════════════════════════════
async function uploadToCloudinary(file) {
  if (!currentUser) throw new Error("Not signed in");
  if (!file) throw new Error("No file");
  if (file.size > 10 * 1024 * 1024) throw new Error("File exceeds 10MB");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "Ehdra_Preset"); // Using your existing signed preset
  formData.append("folder", `mofie/${currentUser.uid}/${new Date().toISOString().slice(0, 7)}`);
  formData.append("public_id", `${Date.now()}_${crypto.randomUUID().slice(0, 8)}`);

  // ✅ We use AI_PROXY_URL here to connect to your Cloudflare Worker
  const res = await fetch(`${AI_PROXY_URL}/upload`, {
    method: "POST",
    body: formData
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`Upload failed (${res.status}) ${t.slice(0, 80)}`);
  }
  const data = await res.json();
  if (!data.secure_url) throw new Error("Upload returned no URL");
  return data.secure_url;
}

// ══════════════════════════════════════════════════════════════════════════
//  SPLASH & FATAL
// ══════════════════════════════════════════════════════════════════════════
function renderFatalError(msg) {
  appEl.innerHTML = `
    <div class="auth-wrap">
      <div class="auth-card" style="text-align:center">
        <h2 style="color:#ef4444;margin-bottom:12px">⚠️ App Error</h2>
        <p style="color:var(--text-muted);font-size:13px;margin-bottom:20px">${escapeHtml(msg)}</p>
        <button class="btn-primary" onclick="location.reload()">Reload</button>
      </div>
    </div>`;
}

// ══════════════════════════════════════════════════════════════════════════
//  AUTH SCREEN
// ══════════════════════════════════════════════════════════════════════════
function renderAuth() {
  document.getElementById("ai-assistant-btn")?.remove();
  document.getElementById("ai-chat-window")?.remove();

  // existing HTML, plus:
  //   • phone-group becomes display:block at register (was display:none)
  //   • add a hidden section for OTP:
  //       <div id="otp-step" style="display:none">…</div>
  // To keep the patch small, we inject the OTP screen via JS on demand.

  appEl.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <div class="logo-container">
        <svg class="butterfly-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
        <h1 class="logo-text">Mofie</h1>
      </div>
      <div class="auth-tagline">Pure, Fast and convenient</div>
      <div class="tabs" role="tablist">
        <button id="tab-login" class="active" type="button" role="tab">Login</button>
        <button id="tab-reg" type="button" role="tab">Register</button>
      </div>
      <form class="form" id="auth-form" novalidate autocomplete="on">
        <div class="input-group"><input id="email" type="email" placeholder="Email" required><div class="field-msg" id="email-msg"></div></div>
        <div class="input-group" id="username-group" style="display:none"><input id="username" placeholder="Username (a-z, 0-9)"><div class="field-msg" id="username-msg"></div></div>
        <div class="input-group" id="phone-group" style="display:none"><input id="reg-phone" type="tel" placeholder="Phone with country code (required)"><div class="field-msg" id="phone-msg"></div></div>
        <div class="input-group"><input id="pass" type="password" placeholder="Password" required><div class="field-msg" id="pass-msg"></div></div>
        <button type="submit" id="submit-btn"><span class="btn-text">Login</span></button>
        <div id="forgot-pass-btn" style="text-align:center;margin-top:15px;font-size:13px;color:var(--user-accent-2);cursor:pointer">Forgot Password?</div>
        <div class="error" id="err" aria-live="polite"></div>
        <div class="auth-status" id="auth-status" aria-live="polite"></div>
      </form>
    </div></div>`;

  const $ = id => document.getElementById(id);
  const emailInput = $("email"), userInput = $("username"), passInput = $("pass"),
        phoneInput = $("reg-phone"), form = $("auth-form"), errEl = $("err"),
        authStatus = $("auth-status"), usernameGroup = $("username-group"),
        phoneGroup = $("phone-group");
  let isLogin = true, isSubmitting = false, usernameTimer;

  const lastEmail = localStorage.getItem("mofie-last-email");
  if (lastEmail) emailInput.value = lastEmail;

  const isEmailValid = v => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());
  const isUsernameValid = v => /^[a-z0-9]{3,20}$/.test(v);
  const setField = (i, m, s, msg="") => { i.classList.remove("valid","invalid"); if (s) i.classList.add(s); if (m){m.textContent=msg; m.className="field-msg "+s;} };
  const showStatus = (m,t="info") => { authStatus.textContent=m; authStatus.className="auth-status show "+t; };

  emailInput.addEventListener("input", () => {
    const v = emailInput.value; if (!v) return setField(emailInput,$("email-msg"),null);
    setField(emailInput,$("email-msg"), isEmailValid(v)?"valid":"invalid",
      isEmailValid(v)?"Looks good":"Enter a valid email");
  });
  userInput.addEventListener("input", () => {
    const v = userInput.value.toLowerCase().trim(); userInput.value = v;
    if (!v) return setField(userInput,$("username-msg"),null);
    if (!isUsernameValid(v)) return setField(userInput,$("username-msg"),"invalid","3–20 chars: a-z, 0-9");
    clearTimeout(usernameTimer);
    setField(userInput,$("username-msg"),null,"Checking...");
    usernameTimer = setTimeout(async () => {
      try {
        const snap = await getDoc(doc(db,"usernames",v));
        setField(userInput,$("username-msg"), snap.exists()?"invalid":"valid",
          snap.exists()?"Already taken":"Available");
      } catch { setField(userInput,$("username-msg"),null,""); }
    }, 350);
  });
  passInput.addEventListener("input", () => {
    const v = passInput.value; if (!v) return setField(passInput,$("pass-msg"),null);
    if (v.length < 6) setField(passInput,$("pass-msg"),"invalid","At least 6 characters");
    else setField(passInput,$("pass-msg"),"valid","");
  });

  const switchTab = (login) => {
    isLogin = login;
    $("tab-login").classList.toggle("active", login);
    $("tab-reg").classList.toggle("active", !login);
    usernameGroup.style.display = login ? "none" : "block";
    phoneGroup.style.display    = login ? "none" : "block";
    $("submit-btn").querySelector(".btn-text").textContent = login ? "Login" : "Create Account";
    passInput.setAttribute("autocomplete", login ? "current-password" : "new-password");
    errEl.textContent = ""; authStatus.className = "auth-status";
  };
  $("tab-login").onclick = () => switchTab(true);
  $("tab-reg").onclick   = () => switchTab(false);

  $("forgot-pass-btn").onclick = async () => {
    const email = emailInput.value.trim();
    if (!isEmailValid(email)) { setField(emailInput,$("email-msg"),"invalid","Enter your email first"); return; }
    try { showStatus("Sending reset email...","info"); await sendPasswordResetEmail(auth,email); showStatus("Reset email sent","success"); }
    catch (e) { showStatus(e.message.replace("Firebase: ",""),"error"); }
  };

  form.onsubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;
    errEl.textContent = "";
    const email = emailInput.value.trim();
    const username = userInput.value.toLowerCase().trim();
    const phone = phoneGroup.style.display !== "none" ? normalizePhone(phoneInput.value) : null;
    const pass = passInput.value;

    if (!isEmailValid(email)) { setField(emailInput,$("email-msg"),"invalid","Enter a valid email"); return; }
    if (!isLogin) {
      if (!isUsernameValid(username)) { setField(userInput,$("username-msg"),"invalid","3–20 chars: a-z, 0-9"); return; }
      if (!phone) { setField(phoneInput,$("phone-msg"),"invalid","Phone number is required"); return; }
    }
    if (pass.length < 6) { setField(passInput,$("pass-msg"),"invalid","At least 6 characters"); return; }

    isSubmitting = true;
    const btn = $("submit-btn");
    btn.disabled = true;
    btn.querySelector(".btn-text").textContent = "Please wait...";
    localStorage.setItem("mofie-last-email", email);

    try {
      if (isLogin) {
        showStatus("Signing in...","info");
        await signInWithEmailAndPassword(auth, email, pass);
        // After login we call initE2EE with the password we have right now
        await E2EE.initE2EE(db, { uid: auth.currentUser.uid }, pass).catch(e =>
          console.warn("[E2EE] init on login failed:", e));
      } else {
        showStatus("Checking username...","info");
        if ((await getDoc(doc(db,"usernames",username))).exists()) {
          setField(userInput,$("username-msg"),"invalid","Taken");
          throw new Error("Username already taken");
        }
        showStatus("Creating account...","info");
        const cred = await createUserWithEmailAndPassword(auth, email, pass);
        await Promise.all([
          setDoc(doc(db,"usernames",username),{ uid: cred.user.uid }),
          setDoc(doc(db,"users",cred.user.uid),{
            username, email, displayName: username, uid: cred.user.uid,
            phoneNumber: phone,                       // required
            lastSeen: serverTimestamp(),
            photoURL: null, blockedUsers: [],
            emailVerified: false
          })
        ]);
        // Init E2EE right away so the key is ready
        await E2EE.initE2EE(db, { uid: cred.user.uid }, pass).catch(()=>{});
        // Trigger OTP
        await requestEmailOtp(cred.user);
        showVerificationScreen(cred.user, email);
      }
    } catch (error) {
      const msg = (error.message || "Something went wrong").replace("Firebase: ","");
      errEl.textContent = msg; showStatus(msg,"error");
    } finally {
      isSubmitting = false;
      btn.disabled = false;
      btn.querySelector(".btn-text").textContent = isLogin ? "Login" : "Create Account";
    }
  };
}

// ══════════════════════════════════════════════════════════════════════════
//  EMAIL OTP — request + verify via worker
// ══════════════════════════════════════════════════════════════════════════
async function requestEmailOtp(fbUser) {
  const idToken = await fbUser.getIdToken();
  const r = await fetch(`${AI_PROXY_URL}/otp/send`, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ idToken })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Could not send verification email");
  return d;
}

async function verifyEmailOtp(fbUser, otp) {
  const idToken = await fbUser.getIdToken();
  const r = await fetch(`${AI_PROXY_URL}/otp/verify`, {
    method:"POST", headers:{ "Content-Type":"application/json" },
    body: JSON.stringify({ idToken, otp })
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || "Verification failed");
  return d;
}

function showVerificationScreen(fbUser, email) {
  appEl.innerHTML = `
    <div class="auth-wrap"><div class="auth-card">
      <div class="logo-container">
        <svg class="butterfly-svg" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
        <h1 class="logo-text">Mofie</h1>
      </div>
      <h2 style="text-align:center;font-size:18px;margin-bottom:8px">Verify your email</h2>
      <p style="text-align:center;font-size:13px;color:var(--text-muted);margin-bottom:20px">
        We sent a 6-digit code to <b>${escapeHtml(email)}</b>. Enter it below.
      </p>
      <form class="form" id="otp-form">
        <input id="otp-input" inputmode="numeric" autocomplete="one-time-code"
          placeholder="000000" maxlength="6"
          style="font-size:24px;letter-spacing:12px;text-align:center;font-weight:700">
        <button type="submit">Verify</button>
        <button type="button" id="resend-otp"
          style="background:transparent;color:var(--user-accent-2);font-weight:600;padding:10px">
          Resend code
        </button>
        <div class="error" id="otp-err"></div>
      </form>
    </div></div>`;

  const form = document.getElementById("otp-form");
  const input = document.getElementById("otp-input");
  const err = document.getElementById("otp-err");

  form.onsubmit = async (e) => {
    e.preventDefault();
    const code = input.value.trim();
    if (code.length !== 6) { err.textContent = "Enter the 6-digit code"; return; }
    err.textContent = "";
    try {
      await verifyEmailOtp(fbUser, code);
      // Re-init E2EE has already happened; reload app
      location.reload();
    } catch (e) {
      err.textContent = e.message;
    }
  };
  document.getElementById("resend-otp").onclick = async () => {
    try {
      await requestEmailOtp(fbUser);
      err.textContent = "";
      showToast("Code resent");
    } catch (e) { err.textContent = e.message; }
  };
  input.focus();
}

// ══════════════════════════════════════════════════════════════════════════
//  MAIN APP SHELL (NO FEED)
// ══════════════════════════════════════════════════════════════════════════
function renderMain() {
  try {
    const name = escapeHtml(currentUser.displayName || "User");
    const uname = escapeHtml(currentUser.username || "user");
    const photo = currentUser.photoURL ? escapeHtml(currentUser.photoURL) : "";
    const initial = (currentUser.displayName || "U")[0].toUpperCase();

    appEl.innerHTML = `
      <div class="app-container">

        <!-- CHATS VIEW -->
        <div class="app-view active" id="view-chats">
<aside class="sidebar" id="sidebar">
  <div class="header">
    <div style="display:flex;align-items:center;gap:8px">
      <svg class="butterfly-svg" style="width:26px;height:26px" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z"/></svg>
      <h1>Mofie</h1>
    </div>
  </div>
  
<div class="search-row">
<input id="search" placeholder="Search name or @username..." aria-label="Search users">
  <button class="icon" id="status-btn" aria-label="Status"
    style="width:40px;height:40px;border-radius:50%;background:var(--bg-main);border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:var(--user-accent-1)">
    ${ICONS.status}
  </button>
</div>
  
  <div class="tabs-row" role="tablist">
    <button class="tab-btn" data-tab="groups">Groups</button>
    <button class="tab-btn" data-tab="unread">Unread</button>
    <button class="tab-btn active" data-tab="friends">Chats</button>
    <button class="tab-btn" data-tab="contacts">Contacts</button>
  </div>
  
  <ul class="chat-list" id="chats-list"></ul>
  
  <button class="explore-fab" id="new-chat-fab">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/></svg> 
    
  </button>
</aside>
          <main class="chat-window" id="chat-window">
            <div class="chat-header">
              <button id="back-btn" aria-label="Back">${ICONS.back}</button>
              <div class="avatar-wrap" id="header-profile-btn">
                <div class="avatar" id="other-av"></div>
                <div class="status-dot" id="header-status-dot"></div>
              </div>
              <div style="flex:1;min-width:0">
                <div class="chat-name" id="other-name">Select Chat</div>
                <div class="chat-status" id="other-status"></div>
                <div class="timer-btn" id="timer-btn">${ICONS.clock} <span id="timer-text">24 Hours</span></div>
              </div>
              <div class="header-actions">
                <button class="icon" id="chat-search-btn" title="Search" aria-label="Search messages">${ICONS.search}</button>
                <button class="icon" id="group-info-btn" title="Group Info" style="display:none" aria-label="Group Info">${ICONS.info}</button>
                <button class="icon" id="chat-menu-btn" title="Menu" aria-label="Chat menu">${ICONS.dots}</button>
              </div>
            </div>
            
            <div class="chat-search-bar" id="chat-search-bar">
              <input id="chat-search-input" placeholder="Search messages..." aria-label="Search messages">
              <span class="cs-count" id="cs-count"></span>
              <button class="icon" id="close-chat-search" aria-label="Close search">${ICONS.close}</button>
            </div>
            
            <div class="messages" id="messages"></div>

            <div class="reply-banner" id="reply-banner" role="status" aria-live="polite">
              <div class="rb-icon">${ICONS.reply}</div>
              <div class="rb-content">
                <div class="rb-name" id="rb-name">Replying to</div>
                <div class="rb-text" id="rb-text"></div>
              </div>
              <button class="rb-close" onclick="cancelReply()" aria-label="Cancel reply">✕</button>
            </div>

            <div class="emoji-panel" id="emoji-panel">
              <div class="panel-tabs">
                <button id="tab-emojis" class="active" onclick="switchPanelTab('emoji')">😀 Emojis</button>
                <button id="tab-stickers" onclick="switchPanelTab('sticker')">🖼️ Stickers</button>
              </div>
              <div class="panel-content">
                <div class="emoji-grid" id="emoji-grid"></div>
                <div class="sticker-grid" id="sticker-grid" style="display:none"></div>
              </div>
            </div>

            <div class="composer">
              <button class="icon" id="attach-btn" aria-label="Attach">${ICONS.attach}</button>
              <button class="icon" id="emoji-btn" style="margin-right:4px" aria-label="Emoji">${ICONS.emoji}</button>
              <div class="input-wrap">
                <input id="msg-input" placeholder="Message" autocomplete="off" aria-label="Message">
              </div>
              <button class="send-btn" id="send-btn" data-mode="mic" aria-label="Send">${ICONS.mic}</button>
            </div>
          </main>
        </div>

<!-- CALLS VIEW -->
<div class="app-view" id="view-calls">
  <div class="clean-profile-header">
    <h2>Calls</h2>
    <button class="icon" id="clear-calls-btn" aria-label="Clear call log" title="Clear call log"
      style="margin-left:auto; padding:8px; border-radius:50%">
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
    </button>
  </div>
  <ul class="chat-list" id="calls-list"></ul>
</div>

       <!-- PROFILE VIEW -->
<div class="app-view" id="view-profile">
  
  <!-- Clean Header -->
  <div class="clean-profile-header">
    <h2>Profile</h2>
  </div>

<!-- WhatsApp Style Profile Row -->
<div class="wa-profile-row" onclick="openEditProfileModal()">
  <div class="wa-avatar-wrap">
    ${photo 
      ? `<img src="${photo}" alt="Profile Photo">` 
      : `<div class="wa-avatar-initial">${initial}</div>`}
  </div>
  <div class="wa-profile-info">
    <h2>${name}</h2>
    <p>@${uname}.mofie</p>
  </div>
  
  <div class="wa-qr-icon" onclick="event.stopPropagation(); window.showMyQRCode();">
    <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M3 11h8V3H3v8zm2-6h4v4H5V5zM3 21h8v-8H3v8zm2-6h4v4H5v-4zm8-10v8h8V3h-8zm6 6h-4V5h4v4zm-6 10h2v-2h-2v2zm2 2h2v-2h-2v2zm-2 2h2v-2h-2v2zm4-4h2v-2h-2v2zm2 2h2v-2h-2v2zm2-2h2v-2h-2v2zm-4-4h2v-2h-2v2zm2 2h2v-2h-2v2zm2-2h2v-2h-2v2z"/></svg>
  </div>
</div>

<!-- Preferences Section -->
<div class="clean-settings-section">
  <h4 class="clean-section-title">Preferences</h4>
  
  <div class="clean-settings-card">
    <div class="clean-settings-item" onclick="openThemeModal()">
      <div class="clean-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 3c-4.97 0-9 4.03-9 9s4.03 9 9 9c.83 0 1.5-.67 1.5-1.5 0-.39-.15-.74-.39-1.01-.23-.26-.38-.61-.38-.99 0-.83.67-1.5 1.5-1.5H16c2.76 0 5-2.24 5-5 0-4.42-4.03-8-9-8zm-5.5 9c-.83 0-1.5-.67-1.5-1.5S5.67 9 6.5 9 8 9.67 8 10.5 7.33 12 6.5 12zm3-4C8.67 8 8 7.33 8 6.5S8.67 5 9.5 5s1.5.67 1.5 1.5S10.33 8 9.5 8zm5 0c-.83 0-1.5-.67-1.5-1.5S13.67 5 14.5 5s1.5.67 1.5 1.5S15.33 8 14.5 8zm3 4c-.83 0-1.5-.67-1.5-1.5S16.67 9 17.5 9s1.5.67 1.5 1.5-.67 1.5-1.5 1.5z"/></svg>
      </div>
      <div class="clean-info">
        <h4>Appearance</h4>
        <p>Themes and Chat Bubbles</p>
      </div>
    </div>
    
    <div class="clean-settings-item" onclick="openStarredMessages()">
      <div class="clean-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
      </div>
      <div class="clean-info">
        <h4>Starred Messages</h4>
        <p>Quick access to saved messages</p>
      </div>
    </div>
  </div>
</div>

<!-- Account & Security Section -->

<!-- Account & Security Section -->
<div class="clean-settings-section">
  <h4 class="clean-section-title">Account & Privacy</h4>
  <div class="clean-settings-card">
    
    <div class="clean-settings-item" onclick="openAccountModal()">
      <div class="clean-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
      </div>
      <div class="clean-info">
        <h4>Account</h4>
        <p>Change password, Delete account</p>
      </div>
    </div>
    
    <div class="clean-settings-item" onclick="promptPhoneNumber()">
      <div class="clean-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/></svg>
      </div>
      <div class="clean-info">
        <h4>Phone Number</h4>
        <p>${currentUser.phoneNumber ? escapeHtml(currentUser.phoneNumber) : "Not linked"}</p>
      </div>
    </div>
    
    <div class="clean-settings-item" onclick="openPhonebookPicker()">
      <div class="clean-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M21 2v6h-6"/><path d="M3 12a9 9 0 0 1 15-6.7L21 8"/><path d="M3 22v-6h6"/><path d="M21 12a9 9 0 0 1-15 6.7L3 16"/></svg>
      </div>
      <div class="clean-info">
        <h4>Sync Phonebook</h4>
        <p>Find friends already on Mofie</p>
      </div>
    </div>
    
  </div>
</div>

<!-- Admin Section -->
${currentUser.email === "hermanedaru@gmail.com"
  ? `<div class="clean-settings-section">
       <h4 class="clean-section-title" style="color:#f59e0b">Admin Control</h4>
       <div class="clean-settings-card">
         <div class="clean-settings-item" onclick="openAdminModal()">
           <div class="clean-icon" style="color:#f59e0b;">
             <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
           </div>
           <div class="clean-info">
             <h4>Admin Panel</h4>
             <p>Send a global broadcast</p>
           </div>
         </div>
       </div>
     </div>` : ""}

  <!-- Minimal Footer -->
  <div class="clean-footer">
    <div>Designed by <b>Herman</b></div>
    <div style="font-size: 12px; opacity: 0.6; margin-top: 4px;">Mofie v2.0 · Pure, Fast, Convenient</div>
  </div>

</div>

<!-- BOTTOM NAV -->
<div class="bottom-nav">
  <button class="bottom-nav-btn active" id="nav-chats" onclick="switchView('chats')" aria-label="Chats">
    ${ICONS.chatTab}<span>Chats</span>
  </button>
  <button class="bottom-nav-btn" id="nav-calls" onclick="switchView('calls')" aria-label="Calls">
    ${ICONS.callTab}<span>Calls</span>
    <span class="calls-badge" id="calls-badge" style="display:none">0</span>
  </button>
  <button class="bottom-nav-btn" id="nav-profile" onclick="switchView('profile')" aria-label="Profile">
    ${ICONS.profileTab}<span>Profile</span>
  </button>
</div>

        <!-- HIDDEN FILE INPUTS -->
        <input type="file" id="chat-upload-image" accept="image/*" style="display:none">
        <input type="file" id="chat-upload-audio" accept="audio/*" style="display:none">
        <input type="file" id="chat-upload-video" accept="video/*" style="display:none">
        <input type="file" id="chat-upload-doc" style="display:none">
        <input type="file" id="status-upload" accept="image/*,video/*" style="display:none">
        <input type="file" id="profile-upload" accept="image/*" style="display:none">
      </div>`;

    populatePanels();
    wireUpMain();
    loadMyChats();
    loadCallLogs();
    subscribeToUsers();
  } catch (e) {
    safeError("Failed to render app: " + e.message);
  }
}

function populatePanels() {
  const EMOJIS = ["😀","😃","😄","😁","😆","😅","😂","🤣","😊","😇","🙂","🙃","😉","😌","😍","🥰","😘","😋","😎","🥳","😏","😒","😞","😔","😟","😕","🙁","☹️","😣","😖","😫","😩","🥺","😢","😭","😤","😠","😡","🤬","😳","😱","😨","😰","🤗","🤔","🤭","😶","😐","😑","🙄","😯","😮","😲","😴","😪","😵","🤐","🤢","🤮","😷","🤒","💩","👻","💀","👽","🤖","🎃","👍","❤️","🔥","🎉"];
  const STICKERS = [
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f44d/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/2764_fe0f/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f602/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f525/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f389/512.gif",
    "https://fonts.gstatic.com/s/e/notoemoji/latest/1f60e/512.gif"
  ];
  const eg = document.getElementById("emoji-grid");
  const sg = document.getElementById("sticker-grid");
  if (eg) eg.innerHTML = EMOJIS.map(e => `<span onclick="insertEmoji('${e}')">${e}</span>`).join("");
  if (sg) sg.innerHTML = STICKERS.map(s => `<img src="${s}" onclick="sendSticker('${s}')" alt="sticker" />`).join("");
}

function wireUpMain() {
  const $ = id => document.getElementById(id);

// ═══════════════════════════════════════════════════════════
//  GLOBAL SEARCH — searches all users + your contacts
// ═══════════════════════════════════════════════════════════
const searchEl = $("search");
if (searchEl) {
  searchEl.addEventListener("input", debounce(async (e) => {
    const term = e.target.value.trim();
    if (!term) {
      // Restore the correct list for the active tab
      if (currentTab === "contacts") loadMyContacts();
      else if (currentTab === "explore") loadExploreUsers();
      else scheduleChatListRender();
      return;
    }
    await handleSearch(term);
  }, 220));
}

  $("back-btn").onclick = () => {
    $("chat-window").classList.remove("active");
    document.querySelector(".app-container").classList.remove("chat-open");
    cancelReply();
  };
  $("group-info-btn").onclick = openGroupInfoModal;
  $("chat-menu-btn").onclick = openChatMenu;
  $("chat-search-btn").onclick = openChatSearch;
  $("close-chat-search").onclick = () => {
    $("chat-search-bar").classList.remove("show");
    document.querySelectorAll(".msg-row.search-hit").forEach(n => n.classList.remove("search-hit"));
  };
  $("chat-search-input").addEventListener("input", e => searchInChat(e.target.value));
  $("send-btn").onclick = handleSendOrRecord;
  $("msg-input").oninput = handleInputTyping;
  $("attach-btn").onclick = openAttachMenu;
  $("emoji-btn").onclick = toggleEmojiPanel;
  $("status-btn").onclick = openStatusTab;
  $("header-profile-btn").onclick = () => {
    if (!currentChatId || !currentOtherId) return;
    const nm = $("other-name").textContent;
    const imgEl = $("other-av").querySelector("img");
    openFriendProfileModal(currentOtherId, nm, imgEl ? imgEl.src : "");
  };
  
  // ── Clear call log ────────────────────────────────────────────────
const clearCallsBtn = $("clear-calls-btn");
if (clearCallsBtn) {
  clearCallsBtn.onclick = () => {
    showAlert("Clear Call Log", "Delete all call history?", true, async () => {
      try {
        const snap = await getDocs(collection(db, "users", currentUser.uid, "callLogs"));
        await Promise.all(snap.docs.map(d => deleteDoc(d.ref)));
        showToast("Call log cleared");
      } catch (e) { showAlert("Error", e.message); }
    });
  };
}
  
 // ✅ NEW BLOCK ✅
$("new-chat-fab").onclick = () => {
  const { modal, close } = createModal(`
    <h3 style="margin-bottom: 12px; font-size: 17px; text-align: center;">Start a Conversation</h3>
    
    <div class="action-menu-list">
      <button class="action-menu-item" data-act="phonebook">
        <div class="action-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M20 0H4v2h16V0zM4 24h16v-2H4v2zM20 4H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 2.75c1.24 0 2.25 1.01 2.25 2.25s-1.01 2.25-2.25 2.25S9.75 10.24 9.75 9 10.76 6.75 12 6.75zM17 17H7v-1.5c0-1.67 3.33-2.5 5-2.5s5 .83 5 2.5V17z"/></svg>
        </div>
        <span>Find from Phonebook</span>
      </button>
      
      <button class="action-menu-item" data-act="search">
        <div class="action-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/></svg>
        </div>
        <span>Search by Username</span>
      </button>
      
      <button class="action-menu-item" data-act="group">
        <div class="action-icon">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>
        </div>
        <span>Create a New Group</span>
      </button>
    </div>
    
    <button class="btn-secondary" data-act="cancel" style="margin-top: 8px; border-radius: 12px; padding: 12px;">Cancel</button>
  `);

  modal.classList.add("action-modal");

  modal.querySelector('[data-act="cancel"]').onclick = close;
  
  modal.querySelector('[data-act="phonebook"]').onclick = () => {
    close();
    window.openPhonebookPicker();
  };

  modal.querySelector('[data-act="search"]').onclick = () => {
    close();
    document.getElementById("search").focus();
    showToast("Type a username to search");
  };

  modal.querySelector('[data-act="group"]').onclick = () => {
    close();
    window.openNewGroupModal();
  };
};

  document.getElementById("nav-chats").onclick = () => window.switchView("chats");
  document.getElementById("nav-profile").onclick = () => window.switchView("profile");

  document.querySelectorAll(".tab-btn").forEach(btn => {
  btn.onclick = () => {
    // Clear search when switching tabs
    const sEl = document.getElementById("search");
    if (sEl && sEl.value) sEl.value = "";

    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");

    currentTab = btn.dataset.tab;

    if (unsubExplore) { unsubExplore(); unsubExplore = null; }

    if (currentTab === "contacts") {
      loadMyContacts();
    } else {
      scheduleChatListRender();
    }
  };
});

  document.addEventListener("click", e => {
    if (e.target.closest("#timer-btn")) window.openTimerModal();
    const p = document.getElementById("emoji-panel");
    if (!p || !p.classList.contains("show")) return;
    if (p.contains(e.target) || e.target.closest("#emoji-btn")) return;
    p.classList.remove("show");
  });

  document.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (document.querySelector(".modal-overlay")) return; 
    if (replyToMsg) { cancelReply(); return; }
    const win = document.getElementById("chat-window");
    if (win && win.classList.contains("active")) win.classList.remove("active");
    document.querySelector(".app-container").classList.remove("chat-open");
  });
}

function scheduleChatListRender() {
  clearTimeout(chatListRenderTimer);
  chatListRenderTimer = setTimeout(() => {
    if (currentTab === "explore") loadExploreUsers();
    else if (currentTab === "contacts") loadMyContacts();
    else renderChatList();
  }, 80);
}

window.switchView = function (view) {
  const target = document.getElementById(`view-${view}`);
  const btn = document.getElementById(`nav-${view}`);
  if (!target || !btn) return;

  currentView = view;
  document.querySelectorAll(".app-view").forEach(el => el.classList.remove("active"));
  document.querySelectorAll(".bottom-nav-btn").forEach(el => el.classList.remove("active"));
  target.classList.add("active");
  btn.classList.add("active");

  if (view !== "chats") {
    document.getElementById("chat-window")?.classList.remove("active");
    document.querySelector(".app-container")?.classList.remove("chat-open");
  } else {
    if (document.getElementById("chat-window")?.classList.contains("active")) {
      document.querySelector(".app-container")?.classList.add("chat-open");
    }
  }

  // ▶️ Load call logs + mark as read when Calls tab is opened
  if (view === "calls") {
    markCallsAsReadAndReload();
  }
};


let isInitialChatLoad = true;
function loadMyChats() {
  if (unsubChats) unsubChats();

  // Show Skeleton Loaders on first load
  const list = document.getElementById("chats-list");
  if (list && isInitialChatLoad) {
    list.innerHTML = Array(6).fill(0).map(() => `
      <div class="skeleton-item">
        <div class="skeleton-avatar"></div>
        <div class="skeleton-text-wrap">
          <div class="skeleton-line-1"></div>
          <div class="skeleton-line-2"></div>
        </div>
      </div>
    `).join("");
  }

  const q = query(collection(db, "conversations"),
    where("participants", "array-contains", currentUser.uid));
    
  unsubChats = onSnapshot(q, snap => {
    latestChatsSnap = snap;
    
    if (isInitialChatLoad) {
      snap.forEach(d => knownChatTimestamps.set(d.id, toMillis(d.data().lastMessageTime)));
      isInitialChatLoad = false;
    } else {
      snap.docChanges().forEach(async change => {
        const data = change.doc.data();
        const chatId = change.doc.id;
        const newTime = toMillis(data.lastMessageTime);
        const oldTime = knownChatTimestamps.get(chatId) || 0;
        
        knownChatTimestamps.set(chatId, newTime);
        
        if (newTime > oldTime && data.lastMessageSenderId !== currentUser.uid) {
          let senderName = data.lastMessageSenderName;
          
          if (!senderName && data.lastMessageSenderId) {
             const u = await getUserCached(data.lastMessageSenderId);
             senderName = u?.displayName;
          }
          
          notifyForeground(senderName || "Mofie", data.lastMessage || "New message", chatId);
        }
      });
    }
    scheduleChatListRender();
  }, e => console.warn("chats sub:", e.message));
}

async function renderChatList() {
  const list = document.getElementById("chats-list");
  if (!list) return;
  if (currentTab === "contacts" || currentTab === "explore") return;
  const snap = latestChatsSnap;
  if (!snap || snap.empty) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💬</div>
        <h3>No chats yet</h3>
        <p>Search for a username above, or tap <b>New Chat</b> to find people.</p>
      </div>`;
    return;
  }

  const sorted = snap.docs.slice().sort((a, b) => {
    const da = a.data(), db_ = b.data();
    const pa = (da.pinnedBy || []).includes(currentUser.uid) ? 1 : 0;
    const pb = (db_.pinnedBy || []).includes(currentUser.uid) ? 1 : 0;
    if (pa !== pb) return pb - pa;
    return toMillis(db_.lastMessageTime) - toMillis(da.lastMessageTime);
  });

 const unique = new Map();
  for (const d of sorted) {
    const data = d.data();
    if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) continue;
    const key = data.isGroup ? d.id : (data.participants || []).find(id => id !== currentUser.uid);
    if (!key) continue;
    if (!unique.has(key)) unique.set(key, { id: d.id, data, isGroup: data.isGroup });
  }

  const visible = [];
  for (const v of unique.values()) {
    if (currentTab === "groups" && !v.isGroup) continue;
    if (currentTab === "unread" && (!v.data.unreadCounts || !v.data.unreadCounts[currentUser.uid])) continue;
    visible.push(v);
  }
  if (!visible.length) {
    const icon = currentTab === "groups" ? "👥" : currentTab === "unread" ? "✓" : "💬";
    const title = currentTab === "groups" ? "No groups yet" :
                  currentTab === "unread" ? "You're all caught up" : "No chats";
    const body = currentTab === "groups" ? "Create a group from the icon above." :
                 currentTab === "unread" ? "No unread messages." :
                 "Start a conversation to see it here.";
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">${icon}</div>
        <h3>${title}</h3>
        <p>${body}</p>
      </div>`;
    return;
  }

  let html = "";
  for (const v of visible) {
    let displayName, photoURL, otherUid = "", online = false;
    if (v.isGroup) {
      displayName = v.data.groupName || "Group";
      photoURL = v.data.groupPhotoURL;
    } else {
      otherUid = v.data.participants.find(id => id !== currentUser.uid);
      const u = (await getUserCached(otherUid)) || {};
      displayName = u.displayName || "Unknown";
      photoURL = u.photoURL;
      online = isUserOnline(u.lastSeen);
    }
    const unread = (v.data.unreadCounts && v.data.unreadCounts[currentUser.uid]) || 0;
    const badge = unread > 0 ? `<div class="unread-badge">${unread}</div>` : "";
    const isPinned = (v.data.pinnedBy || []).includes(currentUser.uid);
    const isMuted = !!(v.data.mutedBy && v.data.mutedBy[currentUser.uid]);
    const pinIcon = isPinned ? `<span class="chat-top-icons">${ICONS.pin}</span>` : "";
    const muteIcon = isMuted ? `<span class="chat-top-icons">${ICONS.mute}</span>` : "";
    const hasStatus = !v.isGroup && activeStatusUsers.has(otherUid);
    const pEsc = photoURL ? escapeHtml(photoURL) : "";

    html += `<li class="chat-item ${isPinned ? "pinned" : ""}"
              data-uid="${escapeHtml(otherUid)}"
              data-chatid="${v.id}"
              data-name="${escapeHtml(displayName)}"
              data-photo="${pEsc}"
              data-isgroup="${!!v.isGroup}">
      <div class="avatar-wrap ${hasStatus ? "has-status" : ""}">
        <div class="avatar">${photoURL
          ? `<img loading="lazy" src="${pEsc}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : escapeHtml(displayName[0] || "?")}</div>
        ${v.isGroup ? "" : `<div class="status-dot ${online ? "online" : "offline"}"></div>`}
      </div>
      <div class="chat-info">
        <div class="chat-top">
          <span class="chat-name">${escapeHtml(displayName)}</span>${pinIcon}${muteIcon}${badge}
        </div>
        <div class="chat-bottom">
          <span class="chat-preview">${escapeHtml(v.data.lastMessage || "")}</span>
        </div>
      </div>
    </li>`;
  }
  list.innerHTML = html;
  list.querySelectorAll(".chat-item").forEach(el => {
    el.onclick = () => openChat(
      el.dataset.chatid, el.dataset.uid, el.dataset.name,
      el.dataset.photo, el.dataset.isgroup === "true");
  });
}

async function openChat(chatId, otherId, name, photoURL, isGroup) {
  if (currentView !== "chats") switchView("chats");
  currentChatId = chatId;
  currentOtherId = otherId;
  currentChatMeta = { isGroup, name, otherId };
  currentMessages = [];
  cancelReply();

  const win = document.getElementById("chat-window");
  win.classList.add("active");
  document.querySelector(".app-container").classList.add("chat-open"); 
  document.getElementById("other-name").textContent = name || "";
  document.getElementById("other-av").innerHTML = photoURL
    ? `<img src="${escapeHtml(photoURL)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%" alt="">`
    : escapeHtml((name || "?")[0]);
  document.getElementById("emoji-panel").classList.remove("show");
  document.getElementById("chat-search-bar").classList.remove("show");

  const inp = document.getElementById("msg-input");
  if (inp) { inp.value = ""; inp.placeholder = "Message"; inp.disabled = false; }
  const sb = document.getElementById("send-btn");
  if (sb) { sb.innerHTML = ICONS.mic; sb.dataset.mode = "mic"; sb.classList.remove("recording"); }

  const msgsEl = document.getElementById("messages");
  msgsEl.innerHTML = '<div class="system-msg">🔒 Messages auto-delete in 24 hours.</div>';

  if (unsubMessages) unsubMessages();
  if (unsubConvMeta) unsubConvMeta();

  // ═════ 1. Load conversation data FIRST ═════
  try {
    const snap = await getDoc(doc(db, "conversations", chatId));
    currentConvData = snap.exists() ? snap.data() : {};
  } catch (e) {
    console.warn("[openChat] failed to load conversation:", e);
    currentConvData = {};
  }

  // ═════ 2. Legacy group bootstrap ═════
  if (isGroup && !currentConvData.encryptedGroupKeys) {
    try {
      await ensureE2EE();
      await E2EE.distributeGroupKey(db, currentUser, chatId, currentConvData.participants);
      E2EE.invalidateKey(chatId);
      const fresh = await getDoc(doc(db, "conversations", chatId));
      currentConvData = fresh.data();
    } catch (e) { console.warn("[group key bootstrap]", e); }
  }

  updateTimerUI(currentConvData.timer || 0);
  document.getElementById("group-info-btn").style.display = isGroup ? "block" : "none";
  
  injectCallButton();
  ["voice-call-btn", "video-call-btn"].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.style.display = isGroup ? "none" : "flex";
  });

  unsubConvMeta = onSnapshot(doc(db, "conversations", chatId), async (docSnap) => {
    if (!docSnap.exists()) return;
    const data = docSnap.data();

    // ═════ 3. Invalidate cached key if group key rotated ═════
    if (data.groupKeyVersion && data.groupKeyVersion !== currentConvData?.groupKeyVersion) {
      E2EE.invalidateKey(chatId);
    }

    currentConvData = data;
    updateTimerUI(data.timer || 0);
    const statusEl = document.getElementById("other-status");
    if (!isGroup && data.typing && data.typing[otherId] && (Date.now() - data.typing[otherId]) < 5000) {
      statusEl.textContent = "typing…";
      statusEl.classList.add("typing-active");
    } else {
      statusEl.classList.remove("typing-active");
      if (isGroup) {
        statusEl.textContent = `${data.participants.length} members`;
      } else {
        const u = await getUserCached(otherId);
        const online = isUserOnline(u.lastSeen);
        statusEl.textContent = online ? "online" : "offline";
        const dot = document.getElementById("header-status-dot");
        if (dot) dot.className = `status-dot ${online ? "online" : "offline"}`;
      }
    }
  }, e => console.warn("convMeta sub:", e.message));

  updateDoc(doc(db, "conversations", chatId), {
    [`readAt.${currentUser.uid}`]: serverTimestamp(),
    [`unreadCounts.${currentUser.uid}`]: 0
  }).catch(() => {});

  const q = query(collection(db, "conversations", chatId, "messages"));
  let initialLoad = true;
  
  unsubMessages = onSnapshot(q, async (snap) => {
    if (!(await ensureE2EE())) { 
      msgsEl.innerHTML = '<div class="system-msg">🔒 Enter your password to unlock messages.</div>'; 
      return; 
    }

    const convData = currentConvData || {};

    const decryptedDocs = await Promise.all(snap.docs.map(async (d) => {
      const data = d.data();
      if (!data.ciphertext) return d;
      try {
        const payload = await E2EE.decryptPayload(db, currentUser, chatId, data.iv, data.ciphertext);
        return { id: d.id, ref: d.ref, data: () => ({ ...data, ...payload }) };
      } catch (e) {
        console.warn("[decrypt]", e);
        return { id: d.id, ref: d.ref, data: () => ({ ...data, text: "🔒 Unable to decrypt" }) };
      }
    }));

    const sorted = decryptedDocs.slice().sort((a,b) => {
      const ta = toMillis(a.data().createdAt) || a.data().clientTs || 0;
      const tb = toMillis(b.data().createdAt) || b.data().clientTs || 0;
      return ta - tb;
    });

    if (initialLoad) {
      renderFullMessages(sorted, convData, chatId, otherId, isGroup);
      initialLoad = false;
      attachScrollListener();
      const scrollBottom = () => { if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight; };
      requestAnimationFrame(() => { scrollBottom(); setTimeout(scrollBottom,50); setTimeout(scrollBottom,200); });
    } else {
      snap.docChanges().forEach(async (change) => {
        const d = change.doc;
        if (change.type === "added") {
          const raw = d.data();
          let payload = raw;
          if (raw.ciphertext) {
            try { payload = { ...raw, ...(await E2EE.decryptPayload(db, currentUser, chatId, raw.iv, raw.ciphertext)) }; }
            catch { payload = { ...raw, text: "🔒 Unable to decrypt" }; }
          }
          const wrapped = { id: d.id, ref: d.ref, data: () => payload };
          const near = msgsEl.scrollHeight - msgsEl.scrollTop - msgsEl.clientHeight < 150;
          if (payload.senderId !== currentUser.uid)
            notifyForeground(payload.senderName || name, payload.text || "New message", chatId);
          appendMessageRow(wrapped, convData, chatId, otherId, isGroup);
          if (payload.senderId === currentUser.uid || near) msgsEl.scrollTop = msgsEl.scrollHeight;
        } else if (change.type === "modified") {
          const raw = d.data();
          let payload = raw;
          if (raw.ciphertext) {
            try { payload = { ...raw, ...(await E2EE.decryptPayload(db, currentUser, chatId, raw.iv, raw.ciphertext)) }; }
            catch { payload = { ...raw, text: "🔒 Unable to decrypt" }; }
          }
          updateMessageRow({ id: d.id, ref: d.ref, data: () => payload }, convData, chatId, otherId, isGroup);
        } else if (change.type === "removed") {
          document.querySelector(`.msg-row[data-msg-id="${d.id}"]`)?.remove();
        }
      });
    }
    
    updateDoc(doc(db, "conversations", chatId), {
      [`readAt.${currentUser.uid}`]: serverTimestamp(),
      [`unreadCounts.${currentUser.uid}`]: 0
    }).catch(() => {});
  }, e => console.warn("messages sub:", e.message));

  setTimeout(() => document.getElementById("msg-input")?.focus(), 450);
}

window.openChatById = async function (chatId) {
  try {
    const snap = await getDoc(doc(db, "conversations", chatId));
    if (!snap.exists()) return;
    const d = snap.data();
    if (!d.participants.includes(currentUser.uid)) return;
    switchView("chats");
    if (d.isGroup) {
      openChat(chatId, null, d.groupName, d.groupPhotoURL, true);
    } else {
      const otherId = d.participants.find(id => id !== currentUser.uid);
      const u = await getUserCached(otherId);
      openChat(chatId, otherId, u.displayName, u.photoURL, false);
    }
  } catch (e) { console.warn(e); }
};

async function decodeE2EEMedia(container) {
  if (!container) return;
  const nodes = container.querySelectorAll("[data-e2ee-media]");
  for (const el of nodes) {
    try {
      const key = unb64(el.dataset.keyB64);
      const res = await fetch(el.dataset.url);
      const bytes = new Uint8Array(await res.arrayBuffer());
      const plain = await E2EE.decryptBytes(key, el.dataset.iv, bytes);
      const blob  = new Blob([plain], { type: el.dataset.mime || "application/octet-stream" });
      const url   = URL.createObjectURL(blob);
      if (el.tagName === "IMG") el.src = url;
      else if (el.tagName === "VIDEO") { el.src = url; el.load(); }
      else if (el.tagName === "AUDIO") { el.src = url; }
      else if (el.tagName === "A") { el.href = url; el.removeAttribute("onclick"); }
    } catch (err) {
      console.warn("[E2EE media decode]", err);
      el.alt = "🔒 Unable to decrypt";
    }
  }
}

function renderFullMessages(docs, convData, chatId, otherId, isGroup) {
  const msgsEl = document.getElementById("messages");
  if (!msgsEl) return;
  currentMessages = [];
  let html = '<div class="system-msg">🔒 Messages auto-delete in 24 hours.</div>';
  let lastDateKey = "";
  docs.forEach(d => {
    const m = d.data();
    m._id = d.id;
    
    if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return;
    
    if (m.expireAt && toMillis(m.expireAt) <= Date.now()) return;
    
    currentMessages.push(m);

    const ms = toMillis(m.createdAt) || Date.now();
    const dateKey = new Date(ms).toDateString();
    if (dateKey !== lastDateKey) {
      html += `<div class="date-sep"><span>${formatDateLabel(ms)}</span></div>`;
      lastDateKey = dateKey;
    }
    html += buildMessageRowHTML(m, d.id, convData, otherId, isGroup);
  });
  msgsEl.innerHTML = html;
  bindMessageEvents();
  decodeE2EEMedia(msgsEl); // <--- THIS FIXES THE MEDIA
}

function appendMessageRow(docSnap, convData, chatId, otherId, isGroup) {
  const msgsEl = document.getElementById("messages");
  if (!msgsEl) return;
  const m = docSnap.data();
  m._id = docSnap.id;
  if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) return;
  
  if (m.expireAt && toMillis(m.expireAt) <= Date.now()) return;
  
  currentMessages.push(m);

  const ms = toMillis(m.createdAt) || Date.now();
  const seps = msgsEl.querySelectorAll(".date-sep");
  const lastSep = seps[seps.length - 1];
  const lastLabel = lastSep ? lastSep.textContent.trim() : "";
  if (formatDateLabel(ms) !== lastLabel) {
    const sep = document.createElement("div");
    sep.className = "date-sep";
    sep.innerHTML = `<span>${formatDateLabel(ms)}</span>`;
    msgsEl.appendChild(sep);
  }
  const wrap = document.createElement("div");
  wrap.innerHTML = buildMessageRowHTML(m, docSnap.id, convData, otherId, isGroup);
  const row = wrap.firstElementChild;
  msgsEl.appendChild(row);
  bindBubbleEvents(row, m, docSnap.id, chatId, otherId, isGroup);
}

function updateMessageRow(docSnap, convData, chatId, otherId, isGroup) {
  const m = docSnap.data();
  m._id = docSnap.id;
  const el = document.querySelector(`.msg-row[data-msg-id="${docSnap.id}"]`);
  if (!el) return;
  if (m.deletedBy && m.deletedBy.includes(currentUser.uid)) { el.remove(); return; }
  const wrap = document.createElement("div");
  wrap.innerHTML = buildMessageRowHTML(m, docSnap.id, convData, otherId, isGroup);
  const newRow = wrap.firstElementChild;
  el.replaceWith(newRow);
  bindBubbleEvents(newRow, m, docSnap.id, chatId, otherId, isGroup);
}

function buildReplyQuoteHTML(m) {
  if (!m.replyToId) return "";
  const quoteText = m.replyToText || "Media";
  const quoteSender = m.replyToSender || "User";
  return `<div class="reply-quote" role="button" tabindex="0"
    onclick="event.stopPropagation();scrollToMessage('${m.replyToId}')"
    onkeydown="if(event.key==='Enter'||event.key===' '){event.preventDefault();event.stopPropagation();scrollToMessage('${m.replyToId}')}">
    <div class="q-name">↩ ${escapeHtml(quoteSender)}</div>
    <div class="q-text">${escapeHtml(quoteText)}</div>
  </div>`;
}

function buildMessageRowHTML(m, docId, convData, otherId, isGroup) {
  const isMe = m.senderId === currentUser.uid;
  const ms = toMillis(m.createdAt) || Date.now();
  const timeStr = new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  let statusDotHTML = "";
  if (isMe) {
    const readTime = convData.readAt && convData.readAt[otherId] ? toMillis(convData.readAt[otherId]) : 0;
    const isRead = (ms <= readTime && !isGroup);
    
    if (isRead) {
      statusDotHTML = `<span class="msg-status-dot read" title="Read"></span>`;
    } else {
      const otherUser = otherId ? userCache.get(otherId)?.data : null;
      const isOnline = isUserOnline(otherUser?.lastSeen);
      
      if (isOnline) {
        statusDotHTML = `<span class="msg-status-dot online" title="Delivered, User Online"></span>`;
      } else {
        statusDotHTML = `<span class="msg-status-dot offline" title="Delivered, User Offline"></span>`;
      }
    }
  }

  let statusReplyHTML = "";
  if (m.statusReply) {
    statusReplyHTML = `
      <div class="status-reply-preview" onclick="event.stopPropagation();window.viewUserStatus('${m.statusReply.userId || m.senderId}', false)">
        ${m.statusReply.mediaType === 'video'
          ? `<video src="${escapeHtml(m.statusReply.mediaUrl)}" muted preload="metadata"></video>`
          : `<img src="${escapeHtml(m.statusReply.mediaUrl)}" alt="status">`}
        <span class="sr-text">Replied to status</span>
      </div>`;
  }
  
  let contentHTML;
  switch (m.type) {
    case "image":
  contentHTML = `<img loading="lazy" data-e2ee-media
    data-url="${escapeHtml(m.mediaUrl)}"
    data-key-b64="${escapeHtml(m.fileKeyB64)}"
    data-iv="${escapeHtml(m.fileIv)}"
    data-mime="image/jpeg"
    alt="🔒"
    style="max-width:100%;border-radius:10px;min-height:80px;background:rgba(0,0,0,.08)"
    onclick="event.stopPropagation();openMediaViewer('image','${docId}')">`;
  break;
case "video":
  contentHTML = `<video data-e2ee-media controls playsinline preload="metadata"
    data-url="${escapeHtml(m.mediaUrl)}"
    data-key-b64="${escapeHtml(m.fileKeyB64)}"
    data-iv="${escapeHtml(m.fileIv)}"
    data-mime="video/mp4"
    style="max-width:100%;border-radius:10px;max-height:320px;background:rgba(0,0,0,.15)"></video>`;
  break;
case "audio":
  contentHTML = `<div class="custom-voice-player" data-audio-e2ee
    data-url="${escapeHtml(m.mediaUrl)}"
    data-key-b64="${escapeHtml(m.fileKeyB64)}"
    data-iv="${escapeHtml(m.fileIv)}">
      <button class="cvp-play-btn" onclick="window.toggleAudio(this)">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
      </button>
      <div class="cvp-track-wrap"><div class="cvp-progress"></div></div>
      <span class="cvp-time">0:00</span>
    </div>`;
  break;
case "document":
  contentHTML = `<a class="doc-msg" data-e2ee-media
      data-url="${escapeHtml(m.mediaUrl)}"
      data-key-b64="${escapeHtml(m.fileKeyB64)}"
      data-iv="${escapeHtml(m.fileIv)}"
      data-mime="application/octet-stream"
      href="#" onclick="event.stopPropagation();return false;">📄 ${escapeHtml(m.fileName || "Document")}</a>`;
  break;
    case "contact":
      contentHTML = `<div class="contact-card">
        <div class="avatar-wrap"><div class="avatar">${m.contactPhoto
          ? `<img src="${escapeHtml(m.contactPhoto)}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : escapeHtml((m.contactName || "?")[0])}</div></div>
        <div class="cc-info">
          <div class="cc-name">${escapeHtml(m.contactName || "Contact")}</div>
          <div class="cc-sub">@${escapeHtml(m.contactUsername || "user")}.mofie</div>
        </div>
        <button class="cc-btn" data-contact-uid="${escapeHtml(m.contactUid || "")}"
          data-contact-name="${escapeHtml(m.contactName || "")}"
          data-contact-photo="${escapeHtml(m.contactPhoto || "")}">Message</button>
      </div>`;
      break;
    case "sticker":
      contentHTML = `<img src="${escapeHtml(m.mediaUrl)}" class="sticker-img" alt="sticker">`;
      break;
    default:
      contentHTML = statusReplyHTML + escapeHtml(m.text || "");
  }

  const bubbleClass = m.type === "sticker" ? "bubble sticker-bubble" : "bubble";
  const replyHTML = buildReplyQuoteHTML(m);
  const senderHTML = (!isMe && isGroup) ? `<div class="sender-name">${escapeHtml(m.senderName || "")}</div>` : "";
  const starHTML = (m.starredBy || []).includes(currentUser.uid) ? `<span class="msg-star-indicator">★</span>` : "";

  let reactionsHTML = "";
  if (m.reactions && Object.keys(m.reactions).length) {
    const counts = {};
    Object.values(m.reactions).forEach(e => { counts[e] = (counts[e] || 0) + 1; });
    reactionsHTML = '<div class="reactions-container">';
    Object.keys(counts).forEach(e => {
      const active = m.reactions[currentUser.uid] === e;
      reactionsHTML += `<div class="reaction-pill ${active ? "active" : ""}"
        onclick="event.stopPropagation();toggleReaction('${currentChatId}','${docId}','${e}')">${e} ${counts[e]}</div>`;
    });
    reactionsHTML += "</div>";
  }

  // THIS IS THE PART THAT WAS DUPLICATING - IT IS NOW CLEAN
  return `<div class="msg-row ${isMe ? "me" : "them"}" data-msg-id="${docId}">
    <div class="${bubbleClass}">
      <span class="swipe-reply-icon" aria-hidden="true">${ICONS.reply}</span>
      ${senderHTML}${replyHTML}${starHTML}${contentHTML}
      <div class="msg-meta">${m.edited ? '<span style="font-size:10px; opacity:0.7; margin-right:4px">(edited)</span>' : ''}${timeStr}${statusDotHTML}</div>
    </div>${reactionsHTML}
  </div>`;
}

function bindMessageEvents() {
  document.querySelectorAll("#messages .msg-row").forEach(row => {
    const docId = row.dataset.msgId;
    const m = currentMessages.find(x => x._id === docId);
    if (!m) return;
    bindBubbleEvents(row, m, docId, currentChatId, currentOtherId, currentChatMeta?.isGroup);
  });
}

function bindBubbleEvents(row, m, docId, chatId, otherId, isGroup) {
  const bubble = row.querySelector(".bubble");
  if (!bubble) return;
  const isMe = m.senderId === currentUser.uid;
  const senderName = isMe ? currentUser.displayName : (m.senderName || "User");

  const contactBtn = bubble.querySelector("[data-contact-uid]");
  if (contactBtn) {
    contactBtn.onclick = (ev) => {
      ev.stopPropagation();
      window.startDM(contactBtn.dataset.contactUid,
        contactBtn.dataset.contactName, contactBtn.dataset.contactPhoto);
    };
  }

  let startX = 0, startY = 0, tracking = false;
  bubble.addEventListener("touchstart", (e) => {
    if (e.touches.length !== 1) return;
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    tracking = true;
  }, { passive: true });

  bubble.addEventListener("touchmove", (e) => {
    if (!tracking) return;
    const dx = e.touches[0].clientX - startX;
    const dy = e.touches[0].clientY - startY;
    if (Math.abs(dy) > Math.abs(dx)) { tracking = false; bubble.style.transform = ""; return; }
    if (dx > 10) {
      const capped = Math.min(dx, 80);
      bubble.style.transform = `translateX(${capped}px)`;
      const icon = bubble.querySelector(".swipe-reply-icon");
      if (icon) icon.style.opacity = String(capped / 80);
    }
  }, { passive: true });

  bubble.addEventListener("touchend", () => {
    if (!tracking) return;
    tracking = false;
    const match = (bubble.style.transform || "").match(/translateX\((\d+)px\)/);
    const dx = match ? parseInt(match[1], 10) : 0;
    bubble.style.transform = "";
    const icon = bubble.querySelector(".swipe-reply-icon");
    if (icon) icon.style.opacity = "0";
    if (dx >= SWIPE_REPLY_PX) {
      setReply({ id: docId, text: m.text, type: m.type, mediaUrl: m.mediaUrl }, senderName, isMe);
      try { navigator.vibrate?.(25); } catch (_) {}
    }
  }, { passive: true });

  let pressTimer;
  const openMenu = () => showMessageMenu(chatId, docId, isMe, m, senderName);
  bubble.addEventListener("mousedown", () => { pressTimer = setTimeout(openMenu, LONG_PRESS_MS); });
  bubble.addEventListener("mouseup", () => clearTimeout(pressTimer));
  bubble.addEventListener("mouseleave", () => clearTimeout(pressTimer));
  bubble.addEventListener("touchstart", () => { pressTimer = setTimeout(openMenu, LONG_PRESS_MS); }, { passive: true });
  bubble.addEventListener("touchend", () => clearTimeout(pressTimer));
  bubble.addEventListener("touchmove", () => clearTimeout(pressTimer), { passive: true });

  bubble.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    showMessageMenu(chatId, docId, isMe, m, senderName);
  });
}

window.cancelReply = () => {
  replyToMsg = null;
  document.getElementById("reply-banner")?.classList.remove("show");
  document.querySelector(".composer")?.classList.remove("replying");
  const inp = document.getElementById("msg-input");
  if (inp && !inp.value.trim()) {
    const btn = document.getElementById("send-btn");
    if (btn) { btn.innerHTML = ICONS.mic; btn.dataset.mode = "mic"; }
  }
};

function setReply(msg, senderName, senderIsMe = false) {
  const preview = msg.text ||
    (msg.type === "image" ? "📷 Photo"
     : msg.type === "video" ? "🎬 Video"
     : msg.type === "audio" ? "🎙️ Voice note"
     : msg.type === "sticker" ? "🖼️ Sticker"
     : msg.type === "document" ? "📄 Document"
     : msg.type === "contact" ? "👤 Contact" : "Message");

  replyToMsg = {
    id: msg.id,
    text: preview,
    senderName: senderIsMe ? "You" : (senderName || "User")
  };

  const banner = document.getElementById("reply-banner");
  if (banner) {
    const nameEl = document.getElementById("rb-name");
    const textEl = document.getElementById("rb-text");
    if (nameEl) nameEl.textContent = `Replying to ${replyToMsg.senderName}`;
    if (textEl) textEl.textContent = replyToMsg.text;
    banner.classList.add("show");
  }
  document.querySelector(".composer")?.classList.add("replying");
  const inp = document.getElementById("msg-input");
  inp?.focus();

  if (inp && inp.value.trim()) {
    const btn = document.getElementById("send-btn");
    if (btn) { btn.innerHTML = ICONS.send; btn.dataset.mode = "send"; }
  }
}

window.scrollToMessage = (msgId) => {
  const el = document.querySelector(`.msg-row[data-msg-id="${msgId}"]`);
  if (!el) {
    showToast("Original message not available (may have expired)");
    return;
  }
  el.scrollIntoView({ behavior: "smooth", block: "center" });
  el.classList.add("message-flash");
  setTimeout(() => el.classList.remove("message-flash"), 1500);
};

function showMessageMenu(chatId, msgId, isMe, msgData, senderName) {
  if (document.querySelector(".msg-menu-overlay")) return;
  
  const emojis = ["👍", "❤️", "😂", "😮", "😢", "🙏"];
  const starred = (msgData.starredBy || []).includes(currentUser.uid);
  
  // Check if message is under 1 hour old for deleting/editing
  const msgTime = toMillis(msgData.createdAt) || Date.now();
  const canEdit = isMe && msgData.type === "text" && (Date.now() - msgTime < 3600000);
  const canDeleteAll = isMe && (Date.now() - msgTime < 3600000);

  const { overlay, modal, close } = createModal(`
    <div class="emoji-picker">
      ${emojis.map(e => `<span data-emoji="${e}">${e}</span>`).join("")}
    </div>
    <div class="menu-actions-list">
      <button class="menu-action-btn" data-act="star">${starred ? "★ Unstar" : "★ Star"}</button>
      ${msgData.type === "text" ? `<button class="menu-action-btn" data-act="copy">Copy text</button>` : ""}
      <button class="menu-action-btn" data-act="forward">Forward</button>
      ${canEdit ? `<button class="menu-action-btn" data-act="edit">Edit Message</button>` : ""}
      <button class="menu-action-btn" data-act="delete-me">Delete for me</button>
      ${canDeleteAll ? `<button class="menu-action-btn text-danger" data-act="delete-all">Delete for everyone</button>` : ""}
      <button class="menu-action-btn text-muted" data-act="cancel">Cancel</button>
    </div>
  `);
  overlay.classList.add("msg-menu-overlay");

  modal.querySelectorAll("[data-emoji]").forEach(el => {
    el.onclick = () => { close(); window.toggleReaction(chatId, msgId, el.dataset.emoji); };
  });
  
  modal.querySelector('[data-act="star"]').onclick = async () => {
    close(); await window.toggleStarMessage(chatId, msgId);
  };

  if (modal.querySelector('[data-act="copy"]')) {
    modal.querySelector('[data-act="copy"]').onclick = () => {
      close();
      navigator.clipboard.writeText(msgData.text).then(() => showToast("Copied"), () => showToast("Could not copy"));
    };
  }

  modal.querySelector('[data-act="forward"]').onclick = () => {
    close(); window.openForwardModal({ ...msgData, _id: msgId });
  };
  
  if (canEdit) {
    modal.querySelector('[data-act="edit"]').onclick = () => {
      close();
      
      window.openEditMessageModal(chatId, msgId, msgData.text);
    };
  }

  modal.querySelector('[data-act="delete-me"]').onclick = async () => {
    close(); await window.deleteMessage(chatId, msgId, false);
  };
  
  if (canDeleteAll) {
    modal.querySelector('[data-act="delete-all"]').onclick = async () => {
      close(); await window.deleteMessage(chatId, msgId, true);
    };
  }
  
  modal.querySelector('[data-act="cancel"]').onclick = close;
}

// Add this new function right below showMessageMenu

window.openEditMessageModal = (chatId, msgId, oldText) => {
  const { modal, close } = createModal(`
    <h3>Edit Message</h3>
    <input id="edit-msg-input" value="${escapeHtml(oldText)}" style="width:100%; padding:12px; border-radius:10px; border:1px solid var(--border); background:var(--bg-main); color:var(--text); margin-bottom:15px;">
    <button class="btn-primary" data-act="save">Save Changes</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  const input = modal.querySelector("#edit-msg-input");
  input.focus();

  modal.querySelector('[data-act="cancel"]').onclick = close;
  
  modal.querySelector('[data-act="save"]').onclick = async () => {
    const newText = input.value.trim();
    if (!newText || newText === oldText) return close();
    if (!(await ensureE2EE())) return;
    
    try {
      const existing = currentMessages.find(m => m._id === msgId) || {};
      const payload = { ...existing, text: newText };
      delete payload._id;
      delete payload.ciphertext;
      delete payload.iv;

      const enc = await E2EE.encryptPayload(db, currentUser, chatId, payload);

      await updateDoc(doc(db, "conversations", chatId, "messages", msgId), {
        iv: enc.iv,
        ciphertext: enc.ciphertext,
        edited: true
      });

      close();
      showToast("Message edited");
    } catch (e) {
      showAlert("Error", "Could not save edit: " + e.message);
    }
  };
};

function handleInputTyping(e) {
  const btn = document.getElementById("send-btn");
  if (!btn || btn.dataset.mode === "recording") return;
  const hasText = !!e.target.value.trim();
  if (hasText && btn.dataset.mode !== "send") { btn.innerHTML = ICONS.send; btn.dataset.mode = "send"; }
  else if (!hasText && btn.dataset.mode !== "mic") { btn.innerHTML = ICONS.mic; btn.dataset.mode = "mic"; }

  if (!currentChatId || !e.target.value.trim()) return;
  const now = Date.now();
  if (now - lastTypingUpdate > 2000) {
    lastTypingUpdate = now;
    updateDoc(doc(db, "conversations", currentChatId), { [`typing.${currentUser.uid}`]: now }).catch(() => {});
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    updateDoc(doc(db, "conversations", currentChatId), { [`typing.${currentUser.uid}`]: null }).catch(() => {});
    lastTypingUpdate = 0;
  }, TYPING_TIMEOUT_MS);
}

function handleSendOrRecord(e) {
  if (e) e.preventDefault();
  const inp = document.getElementById("msg-input");
  if (inp.value.trim()) sendAction();
  else toggleRecording();
}

async function sendAction() {
  if (isSending) return;
  if (!(await ensureE2EE())) return;
  
  const inp = document.getElementById("msg-input");
  const text = inp.value.trim();
  if (!text || !currentChatId || !currentConvData) return;
  
  if (!currentConvData.isGroup && currentUser.blockedUsers?.includes(currentOtherId))
    return showToast("You have blocked this user. Unblock them to send messages.");
  if (!currentConvData.participants?.length) return showToast("Chat not ready");
  
  isSending = true;

  const savedReply = replyToMsg;
  const expireAt = Timestamp.fromMillis(Date.now() +
    (currentConvData.timer || MESSAGE_TTL_MS));

  // ── Build payload (goes inside ciphertext) ─────────────────────────
  const payload = { text };
  if (savedReply) {
    payload.replyToId = savedReply.id;
    payload.replyToText = savedReply.text;
    payload.replyToSender = savedReply.senderName;
  }

  try {
    const enc = await E2EE.encryptPayload(db, currentUser, currentChatId, payload);

    const msgData = {
      senderId: currentUser.uid,
      senderName: currentUser.displayName,
      createdAt: serverTimestamp(),
      type: "text",
      iv: enc.iv,
      ciphertext: enc.ciphertext,
      expireAt,
      reactions: {},
      clientTs: Date.now()
    };

    inp.value = ""; cancelReply();
    const sb = document.getElementById("send-btn");
    if (sb) { 
      sb.classList.add("sending"); 
      setTimeout(()=>sb.classList.remove("sending"),320);
      sb.innerHTML = ICONS.mic; 
      sb.dataset.mode = "mic"; 
    }

    const updates = {
      lastMessage: "🔒 Encrypted message",
      lastMessageType: "text",
      lastMessageSenderId: currentUser.uid,
      lastMessageSenderName: currentUser.displayName || currentUser.username || "User",
      lastMessageTime: serverTimestamp(),
      updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...currentConvData.participants),
      [`typing.${currentUser.uid}`]: null
    };
    
    currentConvData.participants.forEach(p => {
      if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
    });

    await Promise.all([
      addDoc(collection(db,"conversations",currentChatId,"messages"), msgData),
      updateDoc(doc(db,"conversations",currentChatId), updates)
    ]);
    
  } catch (err) {
    // ✅ NEW ERROR HANDLING HERE
    if (err.message && err.message.includes("has not enabled E2EE yet")) {
      showAlert(
        "Encryption Not Ready", 
        "This user hasn't opened the app recently to generate their security keys. Ask them to open Mofie and log in before you can send encrypted messages.",
        false
      );
    } else {
      showAlert("Error", err.message);
    }
    
    // Restore the text so the user doesn't lose their message
    inp.value = text;
    if (savedReply) setReply(savedReply, savedReply.senderName, savedReply.senderName === "You");
  } finally {
    isSending = false;
    const sb = document.getElementById("send-btn");
    if (sb) {
      sb.innerHTML = inp.value.trim() ? ICONS.send : ICONS.mic;
      sb.dataset.mode = inp.value.trim() ? "send" : "mic";
    }
  }
}

window.openMediaViewer = (type, docId) => {
  const mediaMsgs = currentMessages.filter(x => x.type === "image" || x.type === "video");
  if (!mediaMsgs.length) return;
  mediaViewerIndex = Math.max(0, mediaMsgs.findIndex(m => m._id === docId));
  renderMediaViewer(mediaMsgs);
};

function renderMediaViewer(mediaMsgs) {
  document.querySelectorAll(".media-viewer").forEach(n => n.remove());
  const idx = mediaViewerIndex;
  const m = mediaMsgs[idx];
  const v = document.createElement("div");
  v.className = "media-viewer";
  v.innerHTML = `
    <div class="mv-counter">${idx + 1} / ${mediaMsgs.length}</div>
    <div class="mv-controls">
      <a class="mv-btn" href="${escapeHtml(m.mediaUrl)}" download target="_blank" rel="noopener" aria-label="Download">${ICONS.download}</a>
      <button class="mv-btn" id="mv-close" aria-label="Close">${ICONS.close}</button>
    </div>
    ${m.type === "video"
      ? `<video src="${escapeHtml(m.mediaUrl)}" controls autoplay playsinline></video>`
      : `<img src="${escapeHtml(m.mediaUrl)}" alt="media">`}
    ${mediaMsgs.length > 1 ? `
      <button class="mv-nav prev" id="mv-prev" aria-label="Previous">‹</button>
      <button class="mv-nav next" id="mv-next" aria-label="Next">›</button>` : ""}`;
  document.body.appendChild(v);

  v.querySelector("#mv-close").onclick = () => v.remove();
  const prev = v.querySelector("#mv-prev"), next = v.querySelector("#mv-next");
  if (prev) prev.onclick = () => {
    mediaViewerIndex = (mediaViewerIndex - 1 + mediaMsgs.length) % mediaMsgs.length;
    renderMediaViewer(mediaMsgs);
  };
  if (next) next.onclick = () => {
    mediaViewerIndex = (mediaViewerIndex + 1) % mediaMsgs.length;
    renderMediaViewer(mediaMsgs);
  };
}

function ensureScrollBtn() {
  let btn = document.getElementById("scroll-bottom-btn");
  if (btn) return btn;
  btn = document.createElement("button");
  btn.id = "scroll-bottom-btn";
  btn.className = "scroll-bottom-btn";
  btn.setAttribute("aria-label", "Scroll to bottom");
  btn.innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor"><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6z"/></svg>`;
  
  btn.onclick = () => {
    const m = document.getElementById("messages");
    if (m) m.scrollTo({ top: m.scrollHeight, behavior: "smooth" });
    // Hide immediately on click, don't wait for scroll event
    btn.classList.remove("show");
  };
  
  document.getElementById("chat-window")?.appendChild(btn);
  return btn;
}

function attachScrollListener() {
  const m = document.getElementById("messages");
  const btn = ensureScrollBtn();
  if (!m || !btn) return;
  m.onscroll = () => {
    // Changed 120 to 50 for a tighter, more accurate threshold
    const near = m.scrollHeight - m.scrollTop - m.clientHeight < 50;
    btn.classList.toggle("show", !near);
  };
}

function openChatSearch() {
  const bar = document.getElementById("chat-search-bar");
  bar.classList.toggle("show");
  if (bar.classList.contains("show")) {
    const input = document.getElementById("chat-search-input");
    input.value = "";
    input.focus();
    document.getElementById("cs-count").textContent = "";
    document.querySelectorAll(".msg-row.search-hit").forEach(n => n.classList.remove("search-hit"));
  }
}

function searchInChat(term) {
  const t = term.toLowerCase().trim();
  const rows = document.querySelectorAll("#messages .msg-row");
  let hits = 0, firstHit = null;
  rows.forEach(r => {
    r.classList.remove("search-hit");
    if (t.length < 2) return;
    if ((r.textContent || "").toLowerCase().includes(t)) {
      r.classList.add("search-hit");
      hits++;
      if (!firstHit) firstHit = r;
    }
  });
  document.getElementById("cs-count").textContent = hits ? `${hits}` : "0";
  if (firstHit) firstHit.scrollIntoView({ behavior: "smooth", block: "center" });
}

async function openChatMenu() {
  if (!currentChatId) return;
  
  const d = currentConvData || {};
  const pinned = (d.pinnedBy || []).includes(currentUser.uid);
  const muted = !!(d.mutedBy && d.mutedBy[currentUser.uid]);

const { modal, close } = createModal(`
    <button class="btn-secondary" data-act="pin">${pinned ? "📌 Unpin" : "📌 Pin Chat"}</button>
    <button class="btn-secondary" data-act="mute">${muted ? "🔔 Unmute" : "🔕 Mute"}</button>
    <button class="btn-secondary" data-act="media"> Media Gallery</button>
    <button class="btn-danger" data-act="delete"> Delete Chat</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);

  modal.querySelector('[data-act="pin"]').onclick = async () => {
    close();
    if (pinned) await updateDoc(doc(db, "conversations", currentChatId), { pinnedBy: arrayRemove(currentUser.uid) });
    else await updateDoc(doc(db, "conversations", currentChatId), { pinnedBy: arrayUnion(currentUser.uid) });
    showToast(pinned ? "Unpinned" : "Pinned");
  };
  modal.querySelector('[data-act="mute"]').onclick = async () => {
    close();
    if (muted) await updateDoc(doc(db, "conversations", currentChatId), { [`mutedBy.${currentUser.uid}`]: null });
    else await updateDoc(doc(db, "conversations", currentChatId), { [`mutedBy.${currentUser.uid}`]: Date.now() + 365 * 24 * 3600 * 1000 });
    showToast(muted ? "Unmuted" : "Muted");
  };
  modal.querySelector('[data-act="media"]').onclick = () => {
    close();
    const media = currentMessages.filter(x => x.type === "image" || x.type === "video");
    if (!media.length) return showToast("No media in this chat");
    window.openMediaViewer(media[0].type, media[0]._id);
  };
  modal.querySelector('[data-act="delete"]').onclick = () => {
    close();
    handleDeleteChat();
  };
  modal.querySelector('[data-act="cancel"]').onclick = close;
}

async function handleDeleteChat() {
  if (!currentChatId) return;
  const d = currentConvData || {};
  const newCleared = [...new Set([...(d.clearedBy || []), currentUser.uid])];
  try {
    await updateDoc(doc(db, "conversations", currentChatId), {
      clearedBy: newCleared,
      lastMessage: "New Chat",
      [`unreadCounts.${currentUser.uid}`]: 0
    });
    document.getElementById("chat-window").classList.remove("active");
    document.querySelector(".app-container").classList.remove("chat-open");
    currentChatId = null;
    currentOtherId = null;
    currentConvData = null;
    currentMessages = [];
    scheduleChatListRender();
    showToast("Chat cleared");
  } catch (e) { showAlert("Error", e.message); }
}

function openAttachMenu() {
  const { modal, close } = createModal(`
    <h3>Send</h3>
    <button class="btn-secondary" data-act="image"> Photo (max 5MB)</button>
    <button class="btn-secondary" data-act="audio"> Music (max 5MB)</button>
    <button class="btn-secondary" data-act="video"> Video (max 3MB)</button>
    <button class="btn-secondary" data-act="document"> Document (max 2MB)</button>
    <button class="btn-secondary" data-act="contact"> Share Contact</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="image"]').onclick = () => { close(); document.getElementById("chat-upload-image").click(); };
  modal.querySelector('[data-act="audio"]').onclick = () => { close(); document.getElementById("chat-upload-audio").click(); };
  modal.querySelector('[data-act="video"]').onclick = () => { close(); document.getElementById("chat-upload-video").click(); };
  modal.querySelector('[data-act="document"]').onclick = () => { close(); document.getElementById("chat-upload-doc").click(); };
  modal.querySelector('[data-act="contact"]').onclick = () => { close(); window.openShareContactModal(); };
  modal.querySelector('[data-act="cancel"]').onclick = close;
}

async function handleMediaUpload(e, kind) {
  const file = e.target.files[0]; e.target.value = "";
  if (!file || !currentChatId || !currentConvData) return;
  if (!(await ensureE2EE())) return;
  if (file.size > MEDIA_LIMITS[kind])
    return showAlert("File too large", `Limit ${formatFileSize(MEDIA_LIMITS[kind])}`);

  try {
    showToast(`Encrypting ${kind}…`);

    // ── Encrypt file bytes ─────────────────────────────────────────
    const fileBytes = new Uint8Array(await file.arrayBuffer());
    const { iv: fileIv, ciphertext, key: fileKey } = await E2EE.encryptBytes(fileBytes);

    // ── Upload encrypted blob as raw (Cloudinary stores ciphertext) ─
    const blob = new Blob([ciphertext], { type:"application/octet-stream" });
    const form = new FormData();
    form.append("file", new File([blob], "enc.bin", { type:"application/octet-stream" }));
    form.append("upload_preset","Ehdra_Preset");
    form.append("raw","true");
    const upRes = await fetch(`${AI_PROXY_URL}/upload`, { method:"POST", body: form });
    if (!upRes.ok) throw new Error("Upload failed: " + (await upRes.text()).slice(0,120));
    const upJson = await upRes.json();
    const url = upJson.secure_url || upJson.url;
    if (!url) throw new Error("Upload returned no URL");

    // ── Build & encrypt payload ────────────────────────────────────
    const payload = {
      text: { image:"📷 Photo", audio:"🎵 Audio", video:"🎬 Video", document:"📄 Document" }[kind],
      mediaUrl: url,
      fileIv,
      fileKeyB64: btoa(String.fromCharCode(...fileKey)),
      fileName: kind === "document" ? file.name : null
    };
    const enc = await E2EE.encryptPayload(db, currentUser, currentChatId, payload);

    await addDoc(collection(db,"conversations",currentChatId,"messages"), {
      senderId: currentUser.uid, senderName: currentUser.displayName,
      createdAt: serverTimestamp(), type: kind,
      iv: enc.iv, ciphertext: enc.ciphertext,
      expireAt: Timestamp.fromMillis(Date.now() + (currentConvData.timer || MESSAGE_TTL_MS)),
      reactions: {}, clientTs: Date.now()
    });

    const updates = {
      lastMessage: payload.text, lastMessageType: kind,
      lastMessageSenderId: currentUser.uid,
      lastMessageSenderName: currentUser.displayName || currentUser.username || "User",
      lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...currentConvData.participants)
    };
    currentConvData.participants.forEach(p => {
      if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
    });
    await updateDoc(doc(db,"conversations",currentChatId), updates);
  } catch (err) { showAlert("Upload Error", err.message); }
}

window.openShareContactModal = () => {
  const { modal, close } = createModal(`
    <h3>Share Contact</h3>
    <input id="share-search" placeholder="Search @username...">
    <div class="user-select-list" id="share-list"></div>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;

  modal.querySelector("#share-search").oninput = debounce(async (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length < 2) return;
    const q = query(collection(db, "users"),
      where("username", ">=", term), where("username", "<=", term + "\uf8ff"));
    const snap = await getDocs(q);
    const list = document.getElementById("share-list");
    if (!list) return;
    list.innerHTML = snap.docs.filter(d => d.id !== currentUser.uid).map(d => {
      const u = d.data();
      return `<div class="user-select-item" data-uid="${d.id}"
        data-uname="${escapeHtml(u.username || "")}"
        data-dname="${escapeHtml(u.displayName || "")}"
        data-photo="${escapeHtml(u.photoURL || "")}">
        <div class="avatar">${u.photoURL
          ? `<img src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
          : escapeHtml((u.displayName || "?")[0])}</div>
        <div style="flex:1">${escapeHtml(u.displayName || "User")}</div>
        <div style="color:var(--user-accent-1)">→</div>
      </div>`;
    }).join("");
    list.querySelectorAll(".user-select-item").forEach(el => {
      el.onclick = () => {
        sendContactCard(el.dataset.uid, el.dataset.dname, el.dataset.uname, el.dataset.photo);
        close();
      };
    });
  }, 250);
};

async function sendContactCard(uid, name, username, photo) {
  if (!currentChatId || !currentConvData) return;
  if (!(await ensureE2EE())) return;

  const expireAt = Timestamp.fromMillis(Date.now() + (currentConvData.timer || MESSAGE_TTL_MS));
  const payload = {
    text: "Contact",
    contactUid: uid,
    contactName: name,
    contactUsername: username,
    contactPhoto: photo
  };
  
  const enc = await E2EE.encryptPayload(db, currentUser, currentChatId, payload);

  await addDoc(collection(db, "conversations", currentChatId, "messages"), {
    senderId: currentUser.uid, senderName: currentUser.displayName,
    createdAt: serverTimestamp(), type: "contact",
    iv: enc.iv, ciphertext: enc.ciphertext,
    expireAt, reactions: {}, clientTs: Date.now()
  });

  const updates = {
    lastMessage: "👤 Contact", lastMessageSenderId: currentUser.uid,
    lastMessageSenderName: currentUser.displayName || currentUser.username || "User",
    lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
    clearedBy: arrayRemove(...(currentConvData.participants || []))
  };
  (currentConvData.participants || []).forEach(p => {
    if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
  });
  await updateDoc(doc(db, "conversations", currentChatId), updates);
  showToast("Contact shared");
}

window.openTimerModal = () => {
  createModal(`
    <h3>Disappearing Messages</h3>
    <p style="font-size:13px;color:var(--text-muted);text-align:center;margin-bottom:20px">
      Messages auto-delete from Firestore.
    </p>
    <button class="timer-option" onclick="window.setTimer(0); this.closest('.modal-overlay').remove();">24 Hours (Default)</button>
    <button class="timer-option" onclick="window.setTimer(300000); this.closest('.modal-overlay').remove();">5 Minutes</button>
    <button class="timer-option" onclick="window.setTimer(3600000); this.closest('.modal-overlay').remove();">1 Hour</button>
    <button class="timer-option" onclick="window.setTimer(43200000); this.closest('.modal-overlay').remove();">12 Hours</button>
    <button class="btn-secondary" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
  `);
};

window.setTimer = async (ms) => {
  if (!currentChatId) return;
  await updateDoc(doc(db, "conversations", currentChatId), { timer: ms });
  updateTimerUI(ms);
};

function updateTimerUI(ms) {
  const el = document.getElementById("timer-text");
  if (!el) return;
  el.textContent = !ms || ms === 0 ? "24 Hours"
    : ms === 300000 ? "5 Mins"
    : ms === 3600000 ? "1 Hour"
    : ms === 43200000 ? "12 Hours" : "24 Hours";
}

function toggleEmojiPanel(e) {
  if (e) { e.preventDefault(); e.stopPropagation(); }
  const panel = document.getElementById("emoji-panel");
  const input = document.getElementById("msg-input");
  if (panel.classList.contains("show")) panel.classList.remove("show");
  else {
    input.setAttribute("readonly", "readonly");
    input.blur();
    setTimeout(() => input.removeAttribute("readonly"), 150);
    panel.classList.add("show");
  }
}

window.switchPanelTab = (tab) => {
  document.getElementById("tab-emojis").classList.toggle("active", tab === "emoji");
  document.getElementById("tab-stickers").classList.toggle("active", tab === "sticker");
  document.getElementById("emoji-grid").style.display = tab === "emoji" ? "grid" : "none";
  document.getElementById("sticker-grid").style.display = tab === "sticker" ? "grid" : "none";
};

window.insertEmoji = (emoji) => {
  const input = document.getElementById("msg-input");
  input.value += emoji;
  const btn = document.getElementById("send-btn");
  if (input.value.trim() && btn.dataset.mode !== "send") { btn.innerHTML = ICONS.send; btn.dataset.mode = "send"; }
};

window.sendSticker = async (url) => {
  if (!currentChatId || isSending || !currentConvData) return;
  isSending = true;
  document.getElementById("emoji-panel").classList.remove("show");
  try {
    const timerMs = currentConvData.timer || 0;
    const expireAt = Timestamp.fromMillis(Date.now() + (timerMs > 0 ? timerMs : MESSAGE_TTL_MS));
    await addDoc(collection(db, "conversations", currentChatId, "messages"), {
      text: "Sticker", senderId: currentUser.uid, senderName: currentUser.displayName,
      createdAt: serverTimestamp(), type: "sticker", mediaUrl: url,
      expireAt, reactions: {}, clientTs: Date.now()
    });
    const updates = {
      lastMessage: "🖼️ Sticker", lastMessageSenderId: currentUser.uid,
      lastMessageSenderName: currentUser.displayName || currentUser.username || "User",
      lastMessageTime: serverTimestamp(), updatedAt: serverTimestamp(),
      clearedBy: arrayRemove(...(currentConvData.participants || []))
    };
    (currentConvData.participants || []).forEach(p => {
      if (p !== currentUser.uid) updates[`unreadCounts.${p}`] = increment(1);
    });
    await updateDoc(doc(db, "conversations", currentChatId), updates);
  } catch (err) { showAlert("Error", err.message); }
  finally { isSending = false; }
};

window.openStatusTab = async () => {
  if (document.getElementById("floating-status-widget")) return;
  showToast("Loading statuses...");

  try {
    const q = query(collection(db, "statuses"), where("expireAt", ">", Timestamp.now()));
    const snap = await getDocs(q);
    
    const byUser = {};
    snap.forEach(d => {
      const s = d.data();
      if (!byUser[s.userId]) byUser[s.userId] = [];
      byUser[s.userId].push({ id: d.id, ...s });
    });
    
    const userIds = Object.keys(byUser);
    const usersData = {};
    
    await Promise.all(userIds.map(async uid => {
      try {
        const u = await getUserCached(uid);
        if (u.displayName) usersData[uid] = u;
      } catch (_) {}
    }));
    
    const myStatuses = byUser[currentUser.uid] || [];
    myStatuses.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
    
    const otherUsers = userIds.filter(uid => uid !== currentUser.uid && usersData[uid]);

    const widget = document.createElement("div");
    widget.id = "floating-status-widget";
    widget.className = "status-floating-widget";
    
    widget.innerHTML = `
      <div class="sw-header">
        <span class="sw-title">Status Updates</span>
        <button class="sw-close" onclick="document.getElementById('floating-status-widget').remove()">✕</button>
      </div>
      <div class="sw-list">
        <div class="sw-item-group" id="sw-add-new">
          <div class="sw-add"><span>+</span></div>
          <span class="sw-label">Add</span>
        </div>

        ${myStatuses.length > 0 ? `
        <div class="sw-item-group" id="sw-view-mine">
          <div class="sw-item" style="border-color: var(--text-muted)">
            ${myStatuses[0].mediaType === "video"
              ? `<video src="${escapeHtml(myStatuses[0].mediaUrl)}" muted preload="metadata"></video>`
              : `<img src="${escapeHtml(getOptimizedUrl(myStatuses[0].mediaUrl))}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`}
            ${myStatuses.length > 1 ? `<div class="sw-badge">${myStatuses.length}</div>` : ''}
          </div>
          <span class="sw-label">Mine</span>
        </div>` : ''}

        ${otherUsers.map(uid => {
          const u = usersData[uid];
          const userStatuses = byUser[uid].sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
          const first = userStatuses[0];
          return `<div class="sw-item-group" data-status-uid="${uid}">
            <div class="sw-item">
              ${first.mediaType === "video"
                ? `<video src="${escapeHtml(first.mediaUrl)}" muted preload="metadata"></video>`
                : `<img src="${escapeHtml(getOptimizedUrl(first.mediaUrl))}" alt="">`}
              ${userStatuses.length > 1 ? `<div class="sw-badge">${userStatuses.length}</div>` : ''}
            </div>
            <span class="sw-label">${escapeHtml((u.displayName || "?").split(" ")[0])}</span>
          </div>`;
        }).join("")}
      </div>
    `;
      
    document.body.appendChild(widget);
    
    userIds.forEach(uid => {
      if (byUser[uid][0] && byUser[uid][0].mediaType === "image") {
        const img = new Image();
        img.src = getOptimizedUrl(byUser[uid][0].mediaUrl);
      }
    });
    
    document.getElementById("sw-add-new").onclick = () => {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "image/*,video/*";
      input.onchange = (e) => { handleStatusUpload(e); widget.remove(); };
      input.click();
    };

    if (myStatuses.length > 0) {
      document.getElementById("sw-view-mine").onclick = () => {
        widget.remove();
        window.viewUserStatus(currentUser.uid, true, myStatuses);
      };
    }
    
    widget.querySelectorAll("[data-status-uid]").forEach(el => {
      el.onclick = () => {
        widget.remove(); 
        window.viewUserStatus(el.dataset.statusUid, false, byUser[el.dataset.statusUid]);
      };
    });
    
  } catch (err) {
    console.error("[status]", err);
    showToast("Failed to load statuses");
  }
};

window.viewUserStatus = async (userId, isMe = false, preloadedStatuses = null) => {
  let statuses = preloadedStatuses;

  if (!statuses) {
    const snap = await getDocs(query(collection(db, "statuses"), where("userId", "==", userId)));
    const now = Date.now();
    statuses = [];
    snap.forEach(d => {
      const s = d.data();
      const ex = toMillis(s.expireAt);
      if (!ex || ex > now) statuses.push({ id: d.id, ...s });
    });
    statuses.sort((a, b) => toMillis(a.createdAt) - toMillis(b.createdAt));
  }

  if (!statuses || !statuses.length) return showAlert("No Status", "This user has no active status.");

  let idx = 0;
  let autoTimer = null;
  const clearAuto = () => { if (autoTimer) { clearTimeout(autoTimer); autoTimer = null; } };

  const overlay = document.createElement("div");
  overlay.className = "status-viewer-overlay";
  document.body.appendChild(overlay);

  // 🛑 Hide AI Assistant Button so it doesn't block the reply button
  const aiFab = document.getElementById("ai-assistant-btn");
  if (aiFab) aiFab.style.display = "none";

  const render = () => {
    clearAuto();
    if (idx >= statuses.length) { 
      overlay.remove(); 
      if (aiFab) aiFab.style.display = "flex"; // Bring AI button back
      return; 
    }
    if (idx < 0) idx = 0;
    const s = statuses[idx];
    
    const mediaUrl = getOptimizedUrl(s.mediaUrl);

    overlay.innerHTML = `
      <div class="status-viewer-card">
        <div class="status-progress">${statuses.map((_, i) =>
          `<div class="status-progress-bar ${i < idx ? "done" : i === idx ? "active" : ""}"><div></div></div>`).join("")}</div>
          
        <div class="status-media">
          ${s.mediaType === "video"
            ? `<video src="${escapeHtml(mediaUrl)}" autoplay playsinline preload="auto"></video>`
            : `<img src="${escapeHtml(mediaUrl)}" alt="" loading="eager" style="opacity:0; transition:opacity 0.2s;" onload="this.style.opacity=1">`}
        </div>
          
        ${isMe ? `
          <button class="st-viewers-btn" id="st-viewers">
            Views ${(s.viewers || []).length}
          </button>
          <button class="status-close" id="st-delete" style="right: 60px; color:#ef4444; font-size:16px">🗑️ Delete</button>` : ''}
          
        <button class="status-close" id="st-close" aria-label="Close">✕</button>
        <button class="status-nav prev" id="st-prev" aria-label="Previous">‹</button>
        <button class="status-nav next" id="st-next" aria-label="Next">›</button>
        
        ${!isMe ? `
          <div class="status-reply-bar">
            <input id="status-reply-input" placeholder="Reply privately...">
            <button id="status-reply-send" aria-label="Send reply">${ICONS.send}</button>
          </div>` : ''}
      </div>`;

    if (!isMe) updateDoc(doc(db, "statuses", s.id), { viewers: arrayUnion(currentUser.uid) }).catch(() => {});

    const closeViewer = () => {
      clearAuto(); 
      overlay.remove(); 
      if (aiFab) aiFab.style.display = "flex"; // Bring AI button back
    };

    document.getElementById("st-close").onclick = closeViewer;
    document.getElementById("st-prev").onclick = () => { clearAuto(); idx--; render(); };
    document.getElementById("st-next").onclick = () => { clearAuto(); idx++; render(); };

    if (isMe) {
      document.getElementById("st-viewers").onclick = () => viewStatusViewers(s.id);
      document.getElementById("st-delete").onclick = () => {
        showAlert("Delete Status", "Delete this status for everyone?", true, async () => {
          await deleteDoc(doc(db, "statuses", s.id));
          closeViewer();
          window.openStatusTab(); 
        });
      };
    } else {
      const inp = document.getElementById("status-reply-input");
      const btn = document.getElementById("status-reply-send");
      
      // ⏸️ Pause the auto-timer and video when user starts typing
      if (inp) {
        inp.onfocus = () => {
          clearAuto(); // Stops the 5-second auto-advance
          const videoEl = overlay.querySelector(".status-media video");
          if (videoEl) videoEl.pause(); // Pauses video if it is a video status
        };
        
        // ▶️ Resume video if user clicks away without sending
        inp.onblur = () => {
          const videoEl = overlay.querySelector(".status-media video");
          if (videoEl && !inp.value.trim()) {
            videoEl.play().catch(() => {});
          }
        };
      }

      const send = async () => {
        const txt = inp.value.trim();
        if (!txt) return;
        inp.value = "";
        try {
          await replyToStatus(s, txt);
          showToast("Reply sent!");
          closeViewer(); // Close viewer after sending
        } catch (e) {
          showToast("Failed to send reply");
        }
      };
      btn.onclick = send;
      inp.onkeydown = e => { if (e.key === "Enter") send(); };
    }

    const mediaEl = overlay.querySelector(".status-media img, .status-media video");
    if (mediaEl) {
      const startTimer = () => {
        // Only start auto-timer if the input is NOT focused
        if (s.mediaType !== "video" && document.activeElement !== document.getElementById("status-reply-input")) {
          autoTimer = setTimeout(() => {
            if (overlay.parentNode) { idx++; render(); }
          }, 5000);
        }
      };
      if (mediaEl.tagName === "IMG") {
        if (mediaEl.complete) startTimer();
        else mediaEl.onload = startTimer;
      } else if (mediaEl.tagName === "VIDEO") {
        if (mediaEl.readyState >= 2) startTimer();
        else mediaEl.oncanplay = startTimer;
      }
    }
  };
  render();
};

async function viewStatusViewers(statusId) {
  const snap = await getDoc(doc(db, "statuses", statusId));
  if (!snap.exists()) return;
  const viewers = snap.data().viewers || [];
  
  if (!viewers.length) return showAlert("No Views Yet", "Nobody has viewed this status yet.");

  const rows = [];
  for (const uid of viewers) {
    const u = await getUserCached(uid);
    rows.push(`
      <div class="viewer-item">
        <div class="viewer-avatar">
          ${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="">` : `<span>${escapeHtml((u.displayName || "?")[0])}</span>`}
        </div>
        <div class="viewer-name">${escapeHtml(u.displayName || "User")}</div>
      </div>
    `);
  }

  const { modal, close } = createModal(`
    <h3 style="margin-bottom:20px">Viewed by ${viewers.length}</h3>
    <div class="viewers-list">${rows.join("")}</div>
    <button class="btn-secondary" data-act="close">Close</button>
  `);
  modal.querySelector('[data-act="close"]').onclick = close;
}

async function replyToStatus(status, text) {
  if (!text.trim()) return;
  if (!(await ensureE2EE())) return;

  const participants = [currentUser.uid, status.userId].sort();
  const chatId = participants.join("_");
  const chatSnap = await getDoc(doc(db, "conversations", chatId));
  if (!chatSnap.exists()) {
    await setDoc(doc(db, "conversations", chatId), {
      participants, updatedAt: serverTimestamp(), lastMessage: "New Chat",
      clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
    });
  }

  const payload = {
    text,
    statusReply: { 
      mediaUrl: status.mediaUrl,
      mediaType: status.mediaType,
      statusId: status.id,
      userId: status.userId 
    }
  };
  const enc = await E2EE.encryptPayload(db, currentUser, chatId, payload);

  await addDoc(collection(db, "conversations", chatId, "messages"), {
    senderId: currentUser.uid, senderName: currentUser.displayName,
    createdAt: serverTimestamp(), type: "text",
    iv: enc.iv, ciphertext: enc.ciphertext,
    expireAt: Timestamp.fromMillis(Date.now() + MESSAGE_TTL_MS),
    reactions: {}, clientTs: Date.now()
  });

  await updateDoc(doc(db, "conversations", chatId), {
    lastMessage: "↩ Replied to status",
    lastMessageSenderId: currentUser.uid,
    lastMessageSenderName: currentUser.displayName || currentUser.username || "User",
    lastMessageTime: serverTimestamp()
  });
}

async function handleStatusUpload(e) {
  const file = e.target.files[0];
  e.target.value = "";
  if (!file || !currentUser) return;
  if (file.size > 5 * 1024 * 1024) return showAlert("Too Large", "Status must be under 5MB.");
  try {
    showToast("Uploading status…");
    const url = await uploadToCloudinary(file);
    await addDoc(collection(db, "statuses"), {
      userId: currentUser.uid,
      userDisplayName: currentUser.displayName,
      mediaUrl: url,
      mediaType: file.type.startsWith("video") ? "video" : "image",
      createdAt: serverTimestamp(),
      expireAt: Timestamp.fromMillis(Date.now() + STATUS_TTL_MS),
      viewers: []
    });
    showToast("Status posted! Auto-deletes in 5 hours.");
    window.openStatusTab();
  } catch (err) { showAlert("Error", err.message); }
}

window.startDM = async function (otherUid, otherName, photoURL) {
  if (!otherUid) return showAlert("Error", "User not found");
  const participants = [currentUser.uid, otherUid].sort();
  const chatId = participants.join("_");
  try {
    const snap = await getDoc(doc(db, "conversations", chatId));
    if (!snap.exists()) {
      await setDoc(doc(db, "conversations", chatId), {
        participants, updatedAt: serverTimestamp(), lastMessage: "New Chat",
        clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
      });
    }
  } catch (e) {
    await setDoc(doc(db, "conversations", chatId), {
      participants, updatedAt: serverTimestamp(), lastMessage: "New Chat",
      clearedBy: [], unreadCounts: {}, timer: 0, isGroup: false
    }).catch(() => {});
  }
  openChat(chatId, otherUid, otherName, photoURL, false);
  const searchEl = document.getElementById("search");
  if (searchEl) searchEl.value = "";
  scheduleChatListRender();
};

// Race-condition guard: only the latest search request can render
let _searchReqId = 0;

async function handleSearch(term) {
  const list = document.getElementById("chats-list");
  if (!list) return;

  const lower = term.toLowerCase().trim();
  if (!lower) {
    scheduleChatListRender();
    return;
  }

  const myReqId = ++_searchReqId;

  // Skeleton loaders while we query
  list.innerHTML = Array(4).fill(0).map(() => `
    <div class="skeleton-item">
      <div class="skeleton-avatar"></div>
      <div class="skeleton-text-wrap">
        <div class="skeleton-line-1"></div>
        <div class="skeleton-line-2"></div>
      </div>
    </div>
  `).join("");

  // uid -> { uid, displayName, username, photoURL, lastSeen, source }
  const results = new Map();

  try {
    // ── 1. Scan ALL users (matches displayName OR username) ──
    const userSnap = await getDocs(collection(db, "users"));
    userSnap.forEach(d => {
      if (d.id === currentUser.uid) return;
      const u = d.data();
      const name = (u.displayName || "").toLowerCase();
      const uname = (u.username || "").toLowerCase();
      if (name.includes(lower) || uname.includes(lower)) {
        results.set(d.id, {
          uid: d.id,
          displayName: u.displayName || u.username || "User",
          username: u.username || "",
          photoURL: u.photoURL || "",
          lastSeen: u.lastSeen,
          source: "user"
        });
      }
    });

    // ── 2. Scan the user's own saved contacts ──
    try {
      const contactSnap = await getDocs(
        collection(db, "users", currentUser.uid, "mofieContacts")
      );
      contactSnap.forEach(d => {
        if (d.id === currentUser.uid) return;
        const c = d.data();
        const cname = (c.customName || "").toLowerCase();
        const cuser = (c.mofieUsername || "").toLowerCase();
        if (cname.includes(lower) || cuser.includes(lower)) {
          if (!results.has(d.id)) {
            results.set(d.id, {
              uid: d.id,
              displayName: c.customName || c.mofieUsername || "Contact",
              username: c.mofieUsername || "",
              photoURL: c.photoURL || "",
              source: "contact"
            });
          }
        }
      });
    } catch (_) { /* contacts subcollection may not exist */ }

    // Stale-request guard
    if (myReqId !== _searchReqId) return;

    // ── 3. Render ──
    if (!results.size) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <h3>No results</h3>
          <p>No users or contacts found for "${escapeHtml(term)}"</p>
        </div>`;
      return;
    }

    const arr = Array.from(results.values());
    arr.sort((a, b) => {
      // Contacts first, then alphabetical
      if (a.source !== b.source) return a.source === "contact" ? -1 : 1;
      return (a.displayName || "").localeCompare(b.displayName || "");
    });

    list.innerHTML = arr.map(u => {
      const online = isUserOnline(u.lastSeen);
      const isContact = u.source === "contact";
      const initial = escapeHtml((u.displayName || "?")[0]);
      return `<li class="chat-item search-result"
                  data-uid="${escapeHtml(u.uid)}"
                  data-name="${escapeHtml(u.displayName)}"
                  data-photo="${escapeHtml(u.photoURL)}">
        <div class="avatar-wrap ${isContact ? "has-status" : ""}">
          <div class="avatar">${u.photoURL
            ? `<img loading="lazy" src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
            : initial}</div>
          ${!isContact ? `<div class="status-dot ${online ? "online" : "offline"}"></div>` : ""}
        </div>
        <div class="chat-info">
          <div class="chat-top">
            <span class="chat-name">${escapeHtml(u.displayName)}</span>
            ${isContact ? `<span class="search-badge">Contact</span>` : ""}
          </div>
          <div class="chat-bottom">
            <span class="chat-preview">@${escapeHtml(u.username)}.mofie</span>
          </div>
        </div>
      </li>`;
    }).join("");

    // Tap result → clear search, restore tab list, open DM
    list.querySelectorAll(".chat-item").forEach(el => {
      el.onclick = () => {
        const sEl = document.getElementById("search");
        if (sEl) sEl.value = "";

        // Restore the active tab's list so closing the chat feels clean
        if (currentTab === "contacts") loadMyContacts();
        else if (currentTab === "explore") loadExploreUsers();
        // For friends/groups/unread, startDM -> scheduleChatListRender handles it

        window.startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
      };
    });

  } catch (err) {
    if (myReqId !== _searchReqId) return;
    console.error("[Search]", err);
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <h3>Search failed</h3>
        <p>${escapeHtml(err.message || "Try again.")}</p>
      </div>`;
  }
}

function activateExplore() {
  currentTab = "explore";
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const fab = document.getElementById("explore-btn");
  fab.classList.add("active");
  fab.innerHTML = `${ICONS.back} Back`;
  document.getElementById("search").value = "";
  loadExploreUsers();
}

function exitExplore() {
  currentTab = "friends";
  const fab = document.getElementById("explore-btn");
  fab.classList.remove("active");
  fab.innerHTML = `${ICONS.explore} Explore`;
  document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  const t = document.querySelector('.tab-btn[data-tab="friends"]');
  if (t) t.classList.add("active");
  document.getElementById("search").value = "";
  if (unsubExplore) { unsubExplore(); unsubExplore = null; }
  scheduleChatListRender();
}

function loadExploreUsers() {
  const list = document.getElementById("chats-list");
  if (!list) return;
  if (unsubExplore) { unsubExplore(); unsubExplore = null; }

  // Show Skeleton Loaders
  list.innerHTML = Array(6).fill(0).map(() => `
    <div class="skeleton-item">
      <div class="skeleton-avatar"></div>
      <div class="skeleton-text-wrap">
        <div class="skeleton-line-1"></div>
        <div class="skeleton-line-2"></div>
      </div>
    </div>
  `).join("");

  unsubExplore = onSnapshot(collection(db, "users"), (snap) => {
    if (currentTab !== "explore") return;
    const users = [];
    snap.forEach(d => {
      if (d.id === currentUser.uid) return;
      const u = d.data();
      if (!u.displayName) return;
      users.push({ id: d.id, ...u });
    });
    
    users.sort((a, b) => (a.username || "").localeCompare(b.username || ""));
    
    if (!users.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🌍</div>
          <h3>No users yet</h3>
          <p>Be the first — invite a friend!</p>
        </div>`;
      return;
    }
    
    list.innerHTML = users.map(u => {
      const online = isUserOnline(u.lastSeen);
      const hasStatus = activeStatusUsers.has(u.id);
      return `<li class="chat-item" data-uid="${u.id}" data-name="${escapeHtml(u.displayName)}" data-photo="${escapeHtml(u.photoURL || "")}">
        <div class="avatar-wrap ${hasStatus ? "has-status" : ""}">
          <div class="avatar">${u.photoURL
            ? `<img loading="lazy" src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
            : escapeHtml((u.displayName || "?")[0])}</div>
          <div class="status-dot ${online ? "online" : "offline"}"></div>
        </div>
        <div class="chat-info">
          <div class="chat-top"><span class="chat-name">${escapeHtml(u.displayName)}</span></div>
          <div class="chat-bottom"><span class="chat-preview">@${escapeHtml(u.username)}.mofie</span></div>
        </div>
      </li>`;
    }).join("");
    
    list.querySelectorAll(".chat-item").forEach(el => {
      el.onclick = () => window.startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
    });
  });
}

async function loadMyContacts() {
  const list = document.getElementById("chats-list");
  if (!list) return;
  list.innerHTML = '<div style="text-align:center;padding:20px;color:var(--text-muted)">Loading contacts…</div>';
  let snap;
  try { snap = await getDocs(collection(db, "users", currentUser.uid, "mofieContacts")); }
  catch (e) { snap = { empty: true, docs: [] }; }

  const pickerBtn = `<button onclick="openPhonebookPicker()" style="margin-top:8px;padding:8px 16px;border-radius:20px;border:1px solid var(--border);background:var(--bg-main);color:var(--text);cursor:pointer;font-weight:600;display:inline-flex;align-items:center;gap:6px">${ICONS.phonebook} Sync from Phonebook</button>`;

  if (snap.empty) {
    list.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📒</div>
        <h3>No contacts yet</h3>
        <p>Pull your phonebook to find friends on Mofie.</p>
        <div style="margin-top:16px">${pickerBtn}</div>
      </div>`;
    return;
  }

  const contacts = [];
  await Promise.all(snap.docs.map(async d => {
    const c = d.data();
    const u = await getUserCached(d.id);
    if (!u.displayName) return;
    contacts.push({
      uid: d.id,
      username: c.mofieUsername || u.username,
      displayName: c.customName || u.displayName,
      photoURL: c.photoURL || u.photoURL,
      lastSeen: u.lastSeen
    });
  }));
  contacts.sort((a, b) => (a.displayName || "").localeCompare(b.displayName || ""));

  list.innerHTML = `<div class="contacts-hint" style="padding:12px;text-align:center">
    ${contacts.length} contact${contacts.length !== 1 ? "s" : ""} on Mofie
    <div style="margin-top:6px">${pickerBtn}</div>
  </div>` + contacts.map(c => {
    const online = isUserOnline(c.lastSeen);
    const hasStatus = activeStatusUsers.has(c.uid);
    return `<li class="chat-item" data-uid="${c.uid}"
              data-name="${escapeHtml(c.displayName)}"
              data-photo="${escapeHtml(c.photoURL || "")}">
      <div class="avatar-wrap ${hasStatus ? "has-status" : ""}">
        <div class="avatar">${c.photoURL
          ? `<img loading="lazy" src="${escapeHtml(c.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : escapeHtml((c.displayName || "?")[0])}</div>
        <div class="status-dot ${online ? "online" : "offline"}"></div>
      </div>
      <div class="chat-info">
        <div class="chat-top"><span class="chat-name">${escapeHtml(c.displayName)}</span></div>
        <div class="chat-bottom"><span class="chat-preview">@${escapeHtml(c.username)}.mofie</span></div>
      </div>
      <button class="icon" style="padding:8px" data-save-vcf title="Save to phone" aria-label="Save to phone">${ICONS.download}</button>
    </li>`;
  }).join("");

  list.querySelectorAll(".chat-item").forEach((el) => {
    el.onclick = (e) => {
      if (e.target.closest("[data-save-vcf]")) return;
      window.startDM(el.dataset.uid, el.dataset.name, el.dataset.photo);
    };
    const btn = el.querySelector("[data-save-vcf]");
    if (btn) btn.onclick = (ev) => {
      ev.stopPropagation();
      const uid = el.dataset.uid;
      const c = contacts.find(x => x.uid === uid);
      if (c) window.saveMofieContactToPhone({
        username: c.username, displayName: c.displayName, photoURL: c.photoURL
      });
    };
  });
}

const canPickContacts = "contacts" in navigator && "ContactsManager" in window;

window.openPhonebookPicker = async () => {
  if (!currentUser.phoneNumber) { window.promptPhoneNumber(); return; }
  
  if (!canPickContacts) {
    showAlert("Phonebook not available",
      "Your browser does not support reading the phonebook. Open in Chrome on Android.");
    return;
  }

  try {
    showToast("Tip: Tap 'Select All' to find all your friends!");

    const contacts = await navigator.contacts.select(["name", "tel"], { multiple: true });
    
    if (!contacts || !contacts.length) return;
    
    const phones = [];
    contacts.forEach(c => (c.tel || []).forEach(t => {
      const n = normalizePhone(t);
      if (n) phones.push(n);
    }));
    
    if (!phones.length) { showToast("No phone numbers found"); return; }

    const chunks = [];
    for (let i = 0; i < phones.length; i += 30) chunks.push(phones.slice(i, i + 30));

    const found = new Map();
    await Promise.all(chunks.map(async batch => {
      try {
        const snap = await getDocs(query(collection(db, "users"), where("phoneNumber", "in", batch)));
        snap.forEach(d => {
          const u = d.data();
          const n = normalizePhone(u.phoneNumber);
          if (n) found.set(n, { uid: d.id, ...u });
        });
      } catch (e) { console.warn("phone lookup", e.message); }
    }));

    renderPickedContacts(contacts, found);
  } catch (err) {
    if (err.name !== "AbortError") showToast("Could not open phonebook");
  }
};

function renderPickedContacts(rawContacts, foundMap) {
  // ── 1. Build a flat list of { name, phone, user } ──────────────────
  const rows = [];
  const seen = new Set();
  rawContacts.forEach(c => {
    const name = (c.name && c.name[0]) || "Unknown";
    (c.tel || []).forEach(t => {
      const n = normalizePhone(t);
      if (!n || seen.has(n)) return;
      seen.add(n);
      rows.push({ name, phone: n, user: foundMap.get(n) });
    });
  });

  // ── 2. SORT: on-Mofie first, then invite-only (A→Z inside each group) ──
  rows.sort((a, b) => {
    if (!!a.user !== !!b.user) return a.user ? -1 : 1;
    return (a.name || "").localeCompare(b.name || "");
  });

  if (!rows.length) {
    showAlert("No Contacts", "No phone numbers were found in your selection.");
    return;
  }

  const onMofie  = rows.filter(r => r.user);
  const offMofie = rows.filter(r => !r.user);

  // ── 3. Create Full-Screen Overlay ──────────────────────────────────
  const overlay = document.createElement("div");
  overlay.className = "contact-picker-overlay";
  
  overlay.innerHTML = `
    <div class="cp-header">
      <button class="cp-back-btn" id="cp-close">←</button>
      <h2>Select contact</h2>
      <span style="font-size:13px; color:var(--text-muted);">${rows.length} contacts</span>
    </div>
    
    <div class="cp-list">
      <!-- ON MOFIE SECTION -->
      ${onMofie.map(r => `
        <div class="cp-row on-mofie" data-uid="${escapeHtml(r.user.uid)}" data-name="${escapeHtml(r.user.displayName || r.name)}" data-photo="${escapeHtml(r.user.photoURL || '')}" data-username="${escapeHtml(r.user.username || '')}">
          <div class="avatar" style="width:48px;height:48px;min-width:48px;font-size:18px">
            ${r.user.photoURL
              ? `<img src="${escapeHtml(r.user.photoURL)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">`
              : escapeHtml((r.name || "?").charAt(0).toUpperCase())}
          </div>
          <div class="cp-info">
            <div class="cp-name">${escapeHtml(r.name)}</div>
            <div class="cp-sub">@${escapeHtml(r.user.username)}.mofie</div>
          </div>
        </div>
      `).join("")}

      <!-- INVITE SECTION -->
      ${offMofie.length > 0 ? `
        <div class="cp-section-header">Invite to Mofie</div>
        ${offMofie.map(r => `
          <div class="cp-row not-on-mofie">
            <div class="avatar" style="width:48px;height:48px;min-width:48px;font-size:18px; background:var(--bg-main);">
              <svg viewBox="0 0 24 24" width="24" height="24" fill="var(--text-muted)"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
            </div>
            <div class="cp-info">
              <div class="cp-name">${escapeHtml(r.name)}</div>
              <div class="cp-sub">${escapeHtml(r.phone)}</div>
            </div>
            <button class="cp-invite-btn" data-phone="${escapeHtml(r.phone)}" data-name="${escapeHtml(r.name)}">
              Invite
            </button>
          </div>
        `).join("")}
      ` : ""}
    </div>
  `;

  document.body.appendChild(overlay);

  // ── 4. Wire up events ──────────────────────────────────────────────
  
  // ── Clear call log ────────────────────────────────────────────────

  
  document.getElementById("cp-close").onclick = () => overlay.remove();

  // Tap "On Mofie" row -> Save & Open Chat
  overlay.querySelectorAll('.cp-row.on-mofie').forEach(row => {
    row.onclick = async () => {
      const { uid, name, photo, username } = row.dataset;
      
      try {
        await setDoc(doc(db, "users", currentUser.uid, "mofieContacts", uid), {
          mofieUsername: username,
          customName: name,
          photoURL: photo || null,
          savedAt: serverTimestamp()
        }, { merge: true });
      } catch (_) {}

      overlay.remove();
      window.startDM(uid, name, photo);
    };
  });

  // Tap "Invite" button -> Share Sheet
  overlay.querySelectorAll('.cp-invite-btn').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      window.inviteContact(btn.dataset.phone, btn.dataset.name);
    };
  });
}

window.inviteContact = (phone, name) => {
  // ✅ FIXED: includes subpath (/mofie/) instead of bare domain
  const inviteLink = window.location.href.split("?")[0].replace(/[^/]*$/, "");
  const message =
    `Hey ${name || "friend"}! 👋\n\n` +
    `Join me on *Mofie* — a fast, private, and convenient messaging app.\n\n` +
    `👉 ${inviteLink}`;`;

  if (navigator.share) {
    navigator.share({
      title: "Join me on Mofie",
      text: message
    }).catch((err) => {
      if (err.name === "AbortError") return;
      if (phone) {
        window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
      } else {
        navigator.clipboard.writeText(message).then(
          () => showToast("Invite link copied!"),
          () => showToast("Could not copy invite link")
        );
      }
    });
    return;
  }

  if (phone) {
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
    return;
  }

  navigator.clipboard.writeText(message).then(
    () => showToast("Invite link copied!"),
    () => showToast("Could not copy invite link")
  );
};

window.saveMofieContactToPhone = (user) => {
  const handle = `@${user.username}.mofie`;
  // ✅ FIXED: includes subpath (/mofie/)
  const baseUrl = window.location.href.split("?")[0].replace(/[^/]*$/, "");
  const url = `${baseUrl}?u=${encodeURIComponent(user.username)}`;
  const lines = ["BEGIN:VCARD", "VERSION:3.0", `FN:${handle}`, "ORG:Mofie",
    `URL:${url}`, `NOTE:Open in Mofie → ${handle}`];
  if (user.phoneNumber) lines.push(`TEL;TYPE=CELL:${user.phoneNumber}`);
  lines.push("END:VCARD");
  const blob = new Blob([lines.join("\r\n")], { type: "text/vcard;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${user.username}.vcf`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  showToast(`Contact saved as ${handle}`);
};

window.promptPhoneNumber = () => {
  const { modal, close } = createModal(`
    <h3>Add your phone number</h3>
    <p style="font-size:13px;color:var(--text-muted);margin-bottom:12px;text-align:center">
      Used so friends can find you in their phonebook.<br>Include country code.
    </p>
    <input id="phone-input" type="tel" placeholder="+256 700 000 000" value="${escapeHtml(currentUser.phoneNumber || "")}">
    <button class="btn-primary" data-act="save">Save</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="save"]').onclick = async () => {
    const norm = normalizePhone(document.getElementById("phone-input").value.trim());
    if (!norm) { showToast("Invalid phone number"); return; }
    try {
      await setDoc(doc(db, "users", currentUser.uid), { phoneNumber: norm }, { merge: true });
      currentUser.phoneNumber = norm;
      close();
      showToast("Phone number saved");
      window.openPhonebookPicker();
    } catch (e) { showAlert("Error", e.message); }
  };
};  

window.openStarredMessages = async () => {
  const page = document.createElement("div");
  page.className = "settings-page active";
  page.innerHTML = `
    <div class="settings-header">
      <button class="icon" id="close-starred" aria-label="Back">${ICONS.back}</button>
      <h2>Starred Messages</h2>
    </div>
    <div class="settings-list" id="starred-list" style="padding:0">
      <div style="text-align:center;padding:20px;color:var(--text-muted)">Loading…</div>
    </div>`;
  document.querySelector(".app-container").appendChild(page);
  document.getElementById("close-starred").onclick = () => page.remove();

  try {
    const convSnap = await getDocs(query(
      collection(db, "conversations"), where("participants", "array-contains", currentUser.uid)));
    const items = [];
    await Promise.all(convSnap.docs.map(async c => {
      const data = c.data();
      if (data.clearedBy && data.clearedBy.includes(currentUser.uid)) return;
      const msgs = await getDocs(collection(db, "conversations", c.id, "messages"));
      msgs.forEach(d => {
        const m = d.data();
        if ((m.starredBy || []).includes(currentUser.uid)) {
          items.push({ chatId: c.id, chatName: data.isGroup ? data.groupName : (m.senderName || "Chat"), msg: m });
        }
      });
    }));
    const list = document.getElementById("starred-list");
    if (!items.length) {
      list.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">★</div>
          <h3>No starred messages</h3>
          <p>Long-press any message to star it for quick access.</p>
        </div>`;
      return;
    }
    items.sort((a, b) => toMillis(b.msg.createdAt) - toMillis(a.msg.createdAt));
    list.innerHTML = items.map(it => `
      <div class="starred-item" data-chat="${it.chatId}">
        <div class="si-icon">★</div>
        <div class="si-body">
          <div class="si-text">${escapeHtml((it.msg.text || it.msg.type || "Media").slice(0, 60))}</div>
          <div class="si-meta">${escapeHtml(it.chatName)} · ${new Date(toMillis(it.msg.createdAt) || Date.now()).toLocaleDateString()}</div>
        </div>
      </div>`).join("");
    list.querySelectorAll(".starred-item").forEach(el => {
      el.onclick = () => { page.remove(); openChatById(el.dataset.chat); };
    });
  } catch (e) {
    const list = document.getElementById("starred-list");
    if (list) list.innerHTML = `<div style="text-align:center;padding:40px;color:var(--text-muted)">${escapeHtml(e.message)}</div>`;
  }
};

window.openThemeModal = () => {
  const themeColors = [
    { hex: "#00A884" }, { hex: "#0088CC" }, { hex: "#8B5CF6" },
    { hex: "#F97316" }, { hex: "#EF4444" }, { hex: "#EC4899" }
  ];

  // Beautifully organized WhatsApp colors + extras
  const bubbleColors = [
    { hex: "#005C4B" }, { hex: "#D9FDD3" }, { hex: "#00A884" }, 
    { hex: "#0078D4" }, { hex: "#6B46C1" }, { hex: "#D97706" }, 
    { hex: "#DC2626" }, { hex: "#BE185D" }, { hex: "#4B5563" }
  ];

  const t = localStorage.getItem("mofie-theme") || "dark";
  const a1 = localStorage.getItem("mofie-accent1") || "#00A884";
  const defaultBubble = t === "light" ? "#D9FDD3" : "#005C4B";
  const bColor = localStorage.getItem("mofie-bubble-color") || defaultBubble;
  
  const themeSwatchesHTML = themeColors.map(c => `
    <div class="color-swatch ${a1.toLowerCase() === c.hex.toLowerCase() ? "active" : ""}" 
         style="background: ${c.hex};" 
         data-color="${c.hex}">
    </div>
  `).join("");

  const bubbleSwatchesHTML = bubbleColors.map(c => `
    <div class="color-swatch ${bColor.toLowerCase() === c.hex.toLowerCase() ? "active" : ""}" 
         style="background: ${c.hex};" 
         data-bubble-color="${c.hex}">
    </div>
  `).join("");

  const { modal, close } = createModal(`
    <h3 style="margin-bottom: 15px;">Appearance</h3>
    
    <div class="custom-theme-selector" style="margin-bottom: 20px;">
      <button class="theme-btn ${t === 'light' ? 'active' : ''}" data-theme="light">Light</button>
      <button class="theme-btn ${t === 'dark' ? 'active' : ''}" data-theme="dark">Dark</button>
      <button class="theme-btn ${t === 'neon' ? 'active' : ''}" data-theme="neon">Neon</button>
    </div>
    
    <h4 style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;">App Accent Color</h4>
    <div class="custom-color-palette" style="margin-bottom: 20px;">
      ${themeSwatchesHTML}
    </div>

    <h4 style="color: var(--text-muted); font-size: 13px; margin-bottom: 8px;">Chat Bubble Color</h4>
    <div class="custom-color-palette" style="margin-bottom: 20px;">
      ${bubbleSwatchesHTML}
    </div>

    <button class="btn-secondary" id="reset-theme-btn" style="color: #ef4444; border-color: rgba(239, 68, 68, 0.3); font-weight: 700; margin-top: 5px;">Reset to Default</button>
    <button class="btn-secondary" data-act="close" style="margin-top: 10px;">Close</button>
  `);
  
  modal.querySelector('[data-act="close"]').onclick = close;

  // Theme Mode Toggles
  modal.querySelectorAll(".theme-btn").forEach(btn => {
    btn.onclick = () => {
      modal.querySelectorAll(".theme-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      localStorage.setItem("mofie-theme", btn.dataset.theme);
      applyTheme();
    };
  });

  // App Accent Colors
  modal.querySelectorAll("[data-color]").forEach(swatch => {
    swatch.onclick = () => {
      modal.querySelectorAll("[data-color]").forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      const color = swatch.dataset.color;
      localStorage.setItem("mofie-accent1", color);
      localStorage.setItem("mofie-accent2", color); 
      applyTheme();
    };
  });

  // Chat Bubble Colors
  modal.querySelectorAll("[data-bubble-color]").forEach(swatch => {
    swatch.onclick = () => {
      modal.querySelectorAll("[data-bubble-color]").forEach(s => s.classList.remove("active"));
      swatch.classList.add("active");
      const color = swatch.dataset.bubbleColor;
      localStorage.setItem("mofie-bubble-color", color);
      applyTheme();
    };
  });

  // Reset Everything
  modal.querySelector("#reset-theme-btn").onclick = () => {
    localStorage.removeItem("mofie-theme");
    localStorage.removeItem("mofie-accent1");
    localStorage.removeItem("mofie-accent2");
    localStorage.removeItem("mofie-bubble-color");
    applyTheme();
    close();
    showToast("Theme reset to defaults!");
  };
};

window.openEditProfileModal = () => {
  const { modal, close } = createModal(`
    <h3>Edit Profile</h3>
    <div class="avatar-wrap" style="margin:0 auto 15px;width:80px;height:80px;cursor:pointer"
      id="profile-pic-wrap">
      <div class="avatar">${currentUser.photoURL
        ? `<img src="${escapeHtml(currentUser.photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
        : escapeHtml((currentUser.displayName || "U")[0])}</div>
    </div>
    <input id="set-name" placeholder="Display name" value="${escapeHtml(currentUser.displayName || "")}">
    <input id="set-phone" type="tel" placeholder="Phone with country code" value="${escapeHtml(currentUser.phoneNumber || "")}">
    <button class="btn-primary" data-act="save">Save</button>
    <button class="btn-secondary" data-act="cancel">Close</button>
  `);
  modal.querySelector("#profile-pic-wrap").onclick = () =>
    document.getElementById("profile-upload").click();
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="save"]').onclick = async () => {
    const name = document.getElementById("set-name").value.trim();
    const phone = normalizePhone(document.getElementById("set-phone").value);
    if (!name) return showToast("Name required");
    const updates = { displayName: name };
    if (phone) updates.phoneNumber = phone;
    await updateDoc(doc(db, "users", currentUser.uid), updates);
    currentUser.displayName = name;
    if (phone) currentUser.phoneNumber = phone;
    close();
    showToast("Saved");
    renderMain();
    switchView("profile");
  };

document.getElementById("profile-upload").onchange = async (e) => {
    const f = e.target.files[0]; e.target.value = "";
    if (!f) return;
    try {
      const url = await uploadToCloudinary(f);
      await updateDoc(doc(db, "users", currentUser.uid), { photoURL: url });
      currentUser.photoURL = url;
      close();
      showToast("Photo updated");
      renderMain();
      switchView("profile");
    } catch (err) { showAlert("Error", err.message); }
  };
};

window.showMyQRCode = () => {
  const username = currentUser?.username;
  if (!username) {
    return showAlert("Error", "Your username is missing. Update your profile first.");
  }

  const profileLink = window.location.href.split("?")[0] + "?u=" + encodeURIComponent(username);
  console.log("[QR] Link:", profileLink);

  const qrUrl    = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(profileLink)}`;
  const qrFallbk = `https://quickchart.io/qr?size=250&text=${encodeURIComponent(profileLink)}`;

  const { modal, close } = createModal(`
    <h3 style="text-align:center;margin-bottom:8px;font-size:18px;">Your QR Code</h3>
    <p style="text-align:center;color:var(--text-muted);font-size:13px;margin-bottom:16px;">
      Scan to chat with me on Mofie.
    </p>
    <div style="display:flex;justify-content:center;margin-bottom:16px;">
      <div style="padding:16px;background:#FFF;border-radius:20px;box-shadow:0 4px 15px rgba(0,0,0,0.1);">
        <img id="qr-img" src="${qrUrl}" alt="QR"
             style="width:200px;height:200px;border-radius:10px;display:block;"
             onerror="if(this.dataset.fb){this.style.display='none';this.nextElementSibling.style.display='block';}
                      else{this.dataset.fb='1';this.src='${qrFallbk}';}">
        <div style="display:none;padding:20px;text-align:center;font-size:12px;color:#666;">
          QR image blocked.<br>Copy the link instead.
        </div>
      </div>
    </div>
    
    <p style="text-align:center;font-weight:700;font-size:16px;margin-bottom:16px;">@${escapeHtml(username)}.mofie</p>
    
    <button class="btn-primary" data-act="share">Share Link</button>

  `);

  modal.querySelector('[data-act="close"]').onclick = close;
  modal.querySelector('[data-act="copy"]').onclick = () =>
    navigator.clipboard.writeText(profileLink)
      .then(() => showToast("Link copied!"), () => showToast("Copy failed"));
      
  modal.querySelector('[data-act="share"]').onclick = () => {
    if (navigator.share) {
      navigator.share({ title: "Chat with me on Mofie", text: "Scan my QR to chat with me!", url: profileLink }).catch(() => {});
    } else {
      navigator.clipboard.writeText(profileLink).then(() => showToast("Link copied!"));
    }
  };
};

window.openAccountModal = () => {
  const { modal, close } = createModal(`
    <h3>Account</h3>
    <input id="set-pass" type="password" placeholder="New password (min 6 chars)">
    <button class="btn-primary" data-act="pass">Change Password</button>
    <button class="btn-secondary" data-act="logout"
      style="color:var(--user-accent-1);border:1px solid var(--user-accent-1)">Log Out</button>
    <button class="btn-danger" data-act="delete">Delete Account</button>
    <button class="btn-secondary" data-act="cancel">Close</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;
 modal.querySelector('[data-act="pass"]').onclick = async () => {
  const oldPw = prompt("Current password");
  const np = document.getElementById("set-pass").value;
  if (!oldPw) return;
  if (np.length < 6) return showToast("Min 6 chars");
  try {
    await E2EE.rewrapAfterPasswordChange(db, currentUser, oldPw, np);
    await updatePassword(auth.currentUser, np);
    showToast("Password changed");
    close();
  } catch (e) {
    if (e.code === "auth/requires-recent-login") showAlert("Security","Log out and back in first.");
    else showAlert("Error", e.message);
  }
};
  modal.querySelector('[data-act="logout"]').onclick = () => signOut(auth);
  modal.querySelector('[data-act="delete"]').onclick = () => {
    close();
    showAlert("Delete Account", "Permanently delete your account?", true, async () => {
      try {
        await deleteDoc(doc(db, "users", currentUser.uid));
        await deleteDoc(doc(db, "usernames", currentUser.username));
        await deleteUser(auth.currentUser);
        setTimeout(() => window.location.reload(), 800);
      } catch (e) {
        if (e.code === "auth/requires-recent-login") showAlert("Security", "Log out and back in first.");
        else showAlert("Error", e.message);
      }
    });
  };
};

window.openAdminModal = () => {
  const { modal, close } = createModal(`
    <h3>Send Broadcast</h3>
    <textarea id="bc-message" placeholder="Broadcast message..." rows="4"></textarea>
    <button class="btn-primary" data-act="send">Send to All</button>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="send"]').onclick = async () => {
    const msg = document.getElementById("bc-message").value.trim();
    if (!msg) return showToast("Message required");
    try {
      await setDoc(doc(db, "system", "broadcast"), { message: msg, timestamp: Date.now() });
      showToast("Broadcast sent");
      close();
    } catch (e) { showAlert("Error", e.message); }
  };
};

function openFriendProfileModal(uid, name, photoURL) {
  // NO 'await' here! It loads instantly using local data.
  const isBlocked = (currentUser.blockedUsers || []).includes(uid);

  const { modal, close } = createModal(`
    <div style="text-align:center">
      <div class="avatar-wrap" style="width:80px;height:80px;margin:0 auto 12px">
        <div class="avatar" style="font-size:32px">${photoURL
          ? `<img src="${escapeHtml(photoURL)}" style="width:100%;height:100%;object-fit:cover" alt="">`
          : escapeHtml((name || "?")[0])}</div>
      </div>
      <h3>${escapeHtml(name || "User")}</h3>
      <button class="btn-secondary" data-act="block" style="color: ${isBlocked ? 'var(--user-accent-1)' : '#ef4444'}; border-color: ${isBlocked ? 'var(--user-accent-1)' : 'rgba(239,68,68,0.3)'}">
        ${isBlocked ? "Unblock User" : "Block User"}
      </button>
      <button class="btn-secondary" data-act="close">Close</button>
    </div>
  `);
  
  modal.querySelector('[data-act="close"]').onclick = close;
  
  modal.querySelector('[data-act="block"]').onclick = () => {
    // 1. Close the modal INSTANTLY
    close(); 
    
    // 2. Change the local data instantly so the app knows immediately
    if (isBlocked) {
      showToast("User unblocked");
      currentUser.blockedUsers = (currentUser.blockedUsers || []).filter(id => id !== uid);
      // 3. Update the database in the background (no await)
      updateDoc(doc(db, "users", currentUser.uid), { blockedUsers: arrayRemove(uid) }).catch(() => {});
    } else {
      showToast("User blocked");
      currentUser.blockedUsers = [...(currentUser.blockedUsers || []), uid];
      // 3. Update the database in the background (no await)
      updateDoc(doc(db, "users", currentUser.uid), { blockedUsers: arrayUnion(uid) }).catch(() => {});
    }
  };
}

window.openNewGroupModal = () => {
  window.selectedGroupUsers = new Map();
  const { modal, close } = createModal(`
    <h3 style="text-align:center; margin-top:0; margin-bottom:16px; font-size:18px;">New Group</h3>
    <input id="g-name" placeholder="Group Name">
    <input id="g-search" placeholder="Search users to add...">
    <div id="g-list"></div>
    <button class="btn-primary" data-act="create">Create Group</button>
    <button class="btn-secondary" data-act="cancel" style="color:var(--text-muted) !important; background:transparent !important; border:none !important; box-shadow:none !important;">Cancel</button>
  `);
  
  modal.querySelector('[data-act="cancel"]').onclick = close;
  modal.querySelector('[data-act="create"]').onclick = () => window.createGroup(close);

  const search = debounce(async (e) => {
    const term = e.target.value.toLowerCase().trim();
    const list = document.getElementById("g-list");
    if (!list) return;
    
    if (term.length < 2) {
      list.innerHTML = `<div style="text-align:center; padding:10px; font-size:12px; color:var(--text-muted)">Type to search users...</div>`;
      return;
    }

    const snap = await getDocs(query(collection(db, "users"),
      where("username", ">=", term), where("username", "<=", term + "\uf8ff")));
    
    list.innerHTML = snap.docs.filter(d => d.id !== currentUser.uid).map(d => {
      const u = d.data();
      const sel = window.selectedGroupUsers.has(d.id);
      return `<div class="user-select-item ${sel ? "selected" : ""}" data-guid="${d.id}" data-gname="${escapeHtml(u.displayName || "")}">
        <div class="avatar">
          ${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" alt="">` : escapeHtml((u.displayName || "?")[0])}
        </div>
        <div style="flex:1; font-size:14px; font-weight:500;">${escapeHtml(u.displayName)}</div>
        <div class="g-check" style="font-size:16px; font-weight:bold; color:var(--user-accent-1)">${sel ? "✓" : ""}</div>
      </div>`;
    }).join("") || `<div style="text-align:center; padding:10px; font-size:12px; color:var(--text-muted)">No users found</div>`;

    list.querySelectorAll("[data-guid]").forEach(el => {
      el.onclick = () => window.toggleGroupUser(el.dataset.guid, el.dataset.gname, el);
    });
  }, 250);
  
  modal.querySelector("#g-search").oninput = search;
};

window.toggleGroupUser = (uid, name, el) => {
  if (window.selectedGroupUsers.has(uid)) {
    window.selectedGroupUsers.delete(uid);
    el.classList.remove("selected");
    const check = el.querySelector(".g-check");
    if (check) check.textContent = "";
  } else {
    window.selectedGroupUsers.set(uid, name);
    el.classList.add("selected");
    const check = el.querySelector(".g-check");
    if (check) check.textContent = "✓";
  }
};

window.createGroup = async (closeModal) => {
  const name = document.getElementById("g-name").value.trim();
  if (!name) return showToast("Group name required");
  if (!window.selectedGroupUsers.size) return showToast("Select at least one person");
  if (!(await ensureE2EE())) return;

  const participants = [currentUser.uid, ...window.selectedGroupUsers.keys()];
  try {
    const ref = doc(collection(db, "conversations"));
    await setDoc(ref, {
      isGroup: true, groupName: name, groupBio: "", groupPhotoURL: null,
      participants, createdBy: currentUser.uid, admins: [currentUser.uid],
      restricted: false, pendingMembers: [],
      updatedAt: serverTimestamp(), lastMessage: "Group created",
      lastMessageTime: serverTimestamp(), clearedBy: [], unreadCounts: {}, timer: 0
    });
    // Distribute the group key to every member
    await E2EE.distributeGroupKey(db, currentUser, ref.id, participants);
    closeModal();
    openChat(ref.id, null, name, null, true);
    scheduleChatListRender();
  } catch (e) { showAlert("Error", e.message); }
};

function openGroupInfoModal() {
  if (!currentChatId) return;
  
  getDoc(doc(db, "conversations", currentChatId)).then(async (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    if (!data.isGroup) return showToast("Not a group chat");

    const isAdmin = (data.admins || []).includes(currentUser.uid);
    const creatorId = data.createdBy;
    
    // Generate the member list rows
    const members = await Promise.all((data.participants || []).map(async uid => {
      const u = await getUserCached(uid);
      const isTargetAdmin = (data.admins || []).includes(uid);
      const isTargetCreator = uid === creatorId;
      const displayName = u.displayName || "User";
      
      let actionButtons = "";
      if (isAdmin && uid !== currentUser.uid) {
        const promoteBtn = !isTargetCreator 
          ? `<div class="member-action-icon" style="color:${isTargetAdmin ? '#f59e0b' : 'var(--text-muted)'};" onclick="window.toggleGroupAdmin('${uid}', ${isTargetAdmin})" title="${isTargetAdmin ? 'Dismiss Admin' : 'Make Admin'}">
               ${isTargetAdmin ? '👑' : '☆'}
             </div>` 
          : '';
          
        actionButtons = `
          <div style="display:flex; gap:4px;">
            ${promoteBtn}
            <div class="member-action-icon" style="color:#ef4444;" onclick="window.removeGroupMember('${uid}')" title="Remove">✕</div>
          </div>
        `;
      }

      return `<div class="clean-member-row">
        <div class="avatar" style="width:32px; height:32px; font-size:14px; overflow:hidden; display:flex; align-items:center; justify-content:center; border-radius:50%;">
          ${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover;">` : escapeHtml(displayName[0])}
        </div>
        <div style="flex:1; font-size:14px; font-weight:500;">
          ${escapeHtml(displayName)} 
          ${isTargetAdmin ? '<span style="font-size:10px; color:var(--user-accent-1); margin-left:4px;">(Admin)</span>' : ""}
        </div>
        ${actionButtons}
      </div>`;
    }));

    const { modal, close } = createModal(`
      <h3 style="text-align:center; margin-top:0; margin-bottom:16px; font-size:18px;">Group Info</h3>
      
      <!-- Clickable Group Avatar -->
      <div style="text-align:center; margin-bottom:12px;">
        <div id="group-avatar-click" style="width:72px; height:72px; border-radius:50%; margin:0 auto; overflow:hidden; background:var(--bg-main); position:relative; cursor:${isAdmin ? 'pointer' : 'default'}; display:flex; align-items:center; justify-content:center;">
          ${data.groupPhotoURL 
            ? `<img src="${escapeHtml(data.groupPhotoURL)}" style="width:100%;height:100%;object-fit:cover;">` 
            : `<span style="font-size:28px; font-weight:bold; color:var(--text-muted);">${escapeHtml((data.groupName || "G")[0])}</span>`}
          ${isAdmin ? `<div style="position:absolute; inset:0; background:rgba(0,0,0,0.4); display:flex; align-items:center; justify-content:center; color:white; font-size:20px; opacity:0; transition:opacity 0.2s;" onmouseover="this.style.opacity=1" onmouseout="this.style.opacity=0">📷</div>` : ''}
        </div>
      </div>
      
      <!-- Group Name Input -->
      <input id="gi-name" class="clean-group-input" value="${escapeHtml(data.groupName || "")}" placeholder="Group Name" ${isAdmin ? "" : "disabled"}>
      
      <!-- Member List -->
      <h4 style="font-size:12px; color:var(--text-muted); margin:0 0 8px 4px; text-transform:uppercase; letter-spacing:0.5px;">Members (${(data.participants || []).length})</h4>
      <div style="max-height:160px; overflow-y:auto; margin-bottom:16px; padding-right:4px;">
        ${members.join("")}
      </div>
      
      <!-- Action Buttons -->
      <div style="display:flex; flex-direction:column; gap:4px;">
        ${isAdmin ? `<button class="modern-action-btn" data-act="add-member">+ Add Member</button>` : ""}
        ${isAdmin ? `<button class="modern-action-btn" data-act="save">Save Name</button>` : ""}
        <button class="modern-action-btn danger" data-act="leave-group">
          ${creatorId === currentUser.uid ? "Delete Group" : "Leave Group"}
        </button>
        <button class="modern-action-btn" data-act="close" style="margin-top:8px;">Close</button>
      </div>
    `);
    
    modal.classList.add("group-info-modal"); // Apply the new CSS class

    // Handle Group Name Update
    if (isAdmin) {
      modal.querySelector('[data-act="save"]').onclick = async () => {
        const nn = document.getElementById("gi-name").value.trim();
        if (!nn) return showToast("Group name cannot be empty");
        await updateDoc(doc(db, "conversations", currentChatId), { groupName: nn });
        showToast("Group name updated");
        document.getElementById("other-name").textContent = nn;
        close();
      };

      // Handle Group Photo Upload
      modal.querySelector('#group-avatar-click').onclick = () => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = "image/*";
        fileInput.onchange = async (e) => {
          const file = e.target.files[0];
          if (!file) return;
          try {
            showToast("Uploading...");
            const url = await uploadToCloudinary(file);
            await updateDoc(doc(db, "conversations", currentChatId), { groupPhotoURL: url });
            showToast("Group photo updated!");
            close();
            openGroupInfoModal(); 
          } catch (err) { showAlert("Error", err.message); }
        };
        fileInput.click();
      };

      // Handle Add Member
      modal.querySelector('[data-act="add-member"]').onclick = () => {
        close();
        window.openAddMemberToGroupModal(currentChatId, data.participants);
      };
    }

    // Handle Leave / Delete Group
    modal.querySelector('[data-act="leave-group"]').onclick = () => {
      close();
      const isCreator = creatorId === currentUser.uid;
      showAlert(
        isCreator ? "Delete Group" : "Leave Group",
        isCreator ? "Delete this group for everyone?" : "Leave this group?",
        true,
        async () => {
          try {
            if (isCreator) {
              await deleteDoc(doc(db, "conversations", currentChatId));
              showToast("Group deleted");
            } else {
              const newParticipants = data.participants.filter(id => id !== currentUser.uid);
              const newAdmins = (data.admins || []).filter(id => id !== currentUser.uid);
              if (newAdmins.length === 0 && newParticipants.length > 0) newAdmins.push(newParticipants[0]);
              
              await updateDoc(doc(db, "conversations", currentChatId), {
                participants: newParticipants,
                admins: newAdmins
              });
              showToast("You left the group");
            }
            document.getElementById("chat-window").classList.remove("active");
            document.querySelector(".app-container").classList.remove("chat-open");
          } catch (err) { showAlert("Error", err.message); }
        }
      );
    };
    
    modal.querySelector('[data-act="close"]').onclick = close;
  });
}

window.removeGroupMember = async (uidToRemove) => {
  showAlert("Remove Member", "Are you sure you want to remove this member?", true, async () => {
    await updateDoc(doc(db, "conversations", currentChatId), {
      participants: arrayRemove(uidToRemove),
      admins: arrayRemove(uidToRemove) // Remove admin status if they had it
    });
    document.querySelector(".modal-overlay")?.remove();
    showToast("Member removed");
    setTimeout(openGroupInfoModal, 500); // Reopen to show updated list
  });
};

window.openAddMemberToGroupModal = (chatId, existingParticipants) => {
  const { modal, close } = createModal(`
    <h3>Add Member</h3>
    <input id="add-member-search" placeholder="Search username...">
    <div id="add-member-list" style="max-height:200px; overflow-y:auto; margin-bottom:12px;"></div>
    <button class="btn-secondary" data-act="cancel">Cancel</button>
  `);
  modal.querySelector('[data-act="cancel"]').onclick = close;

  modal.querySelector("#add-member-search").oninput = debounce(async (e) => {
    const term = e.target.value.toLowerCase().trim();
    if (term.length < 2) return;
    const snap = await getDocs(query(collection(db, "users"), where("username", ">=", term), where("username", "<=", term + "\uf8ff")));
    const list = document.getElementById("add-member-list");
    list.innerHTML = snap.docs.filter(d => d.id !== currentUser.uid && !existingParticipants.includes(d.id)).map(d => {
      const u = d.data();
      return `<div class="user-select-item" onclick="window.addMemberToGroup('${chatId}', '${d.id}')">
        <div class="avatar">${u.photoURL ? `<img src="${escapeHtml(u.photoURL)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%">` : escapeHtml((u.displayName||"?")[0])}</div>
        <div style="flex:1; font-weight:600;">${escapeHtml(u.displayName)}</div>
        <div style="color:var(--user-accent-1); font-weight:bold;">+ Add</div>
      </div>`;
    }).join("") || `<div style="text-align:center; padding:10px; color:var(--text-muted); font-size:13px;">No users found</div>`;
  }, 300);
};

window.addMemberToGroup = async (chatId, newUid) => {
  if (!(await ensureE2EE())) return;
  const convSnap = await getDoc(doc(db,"conversations",chatId));
  const data = convSnap.data();
  const newParticipants = [...new Set([...(data.participants||[]), newUid])];

  await updateDoc(doc(db,"conversations",chatId), {
    participants: arrayUnion(newUid)
  });
  // Rotate + re-distribute so the new member can read future messages
  await E2EE.distributeGroupKey(db, currentUser, chatId, newParticipants);
  E2EE.invalidateKey(chatId);

  document.querySelector(".modal-overlay")?.remove();
  showToast("Member added");
  setTimeout(openGroupInfoModal, 500);
};

window.removeGroupMember = async (uidToRemove) => {
  showAlert("Remove Member", "Are you sure?", true, async () => {
    if (!(await ensureE2EE())) return;
    const snap = await getDoc(doc(db,"conversations",currentChatId));
    const data = snap.data();
    const remaining = (data.participants||[]).filter(u => u !== uidToRemove);

    await updateDoc(doc(db,"conversations",currentChatId), {
      participants: arrayRemove(uidToRemove),
      admins: arrayRemove(uidToRemove)
    });
    // Rotate so the removed member can no longer read new messages
    await E2EE.distributeGroupKey(db, currentUser, currentChatId, remaining);
    E2EE.invalidateKey(currentChatId);

    document.querySelector(".modal-overlay")?.remove();
    showToast("Member removed");
    setTimeout(openGroupInfoModal, 500);
  });
};

 function listenForBroadcasts() {
  if (unsubBroadcast) unsubBroadcast();
  unsubBroadcast = onSnapshot(doc(db, "system", "broadcast"), (docSnap) => {
    if (docSnap.exists()) {
      const d = docSnap.data();
      const last = Number(localStorage.getItem("mofie_last_broadcast") || 0);
      if (d.timestamp > last) {
        localStorage.setItem("mofie_last_broadcast", d.timestamp);
        showAlert("Mofie", d.message);
      }
    }
  });
}

async function handleDeepLink() {
  const params   = new URLSearchParams(window.location.search);
  const username = (params.get("u") || "").toLowerCase().trim();
  const chatParam = params.get("chat");
  if (!username && !chatParam) return;

  console.log("[DeepLink] params:", { username, chatParam });

  const ok = await new Promise(resolve => {
    if (currentUser) return resolve(true);
    const t = setInterval(() => { if (currentUser) { clearInterval(t); resolve(true); } }, 300);
    setTimeout(() => { clearInterval(t); resolve(false); }, 20000);
  });
  if (!ok) { console.warn("[DeepLink] auth timeout"); return; }

  switchView("chats");

  try {
    if (chatParam) {
      await openChatById(chatParam);
    } else if (username) {
      const snap = await getDocs(query(collection(db, "users"), where("username", "==", username)));
      if (snap.empty) {
        showToast(`No user found: @${username}.mofie`);
      } else {
        const u = snap.docs[0].data();
        await window.startDM(snap.docs[0].id, u.displayName, u.photoURL);
      }
    }
  } catch (e) {
    console.error("[DeepLink] failed:", e);
    showToast("Could not open the chat. Check your connection.");
    return; // ← don't clean URL on failure so the user can retry
  }

  // Only clean the URL after success, keeping the subpath
  try { history.replaceState({}, "", window.location.pathname); } catch (_) {}
}

// ══════════════════════════════════════════════════════════════════════════
//  ANDROID HARDWARE BACK BUTTON HANDLER
//  Intercepts popstate and walks the internal UI stack back one level at
//  a time. Falls through to the OS to actually exit at the root.
// ══════════════════════════════════════════════════════════════════════════

function mofieHandleBack() {
  // Priority = topmost z-index / most recently opened first

  // 1. Incoming call ──────────────────────────────────────────────────
  const incoming = document.getElementById("incoming-call-overlay");
  if (incoming) {
    const btn = incoming.querySelector("#incoming-decline");
    if (btn) btn.click();
    else incoming.remove();
    return true;
  }

  // 2. Active call ────────────────────────────────────────────────────
  if (document.getElementById("call-overlay")) {
    window.endCall?.("hungup");
    return true;
  }

  // 3. Contact picker (full-screen) ───────────────────────────────────
  const contactPicker = document.querySelector(".contact-picker-overlay");
  if (contactPicker) {
    contactPicker.remove();
    return true;
  }

  // 4. AI chat window ─────────────────────────────────────────────────
  const aiChat = document.getElementById("ai-chat-window");
  if (aiChat && aiChat.classList.contains("open")) {
    aiChat.classList.remove("open");
    try { window.speechSynthesis?.cancel(); } catch (_) {}
    return true;
  }

  // 5. Media viewer (full-screen image / video) ───────────────────────
  const mediaViewer = document.querySelector(".media-viewer");
  if (mediaViewer) {
    mediaViewer.remove();
    return true;
  }

  // 6. Status viewer (Story circle) ───────────────────────────────────
  const statusViewer = document.querySelector(".status-viewer-overlay");
  if (statusViewer) {
    statusViewer.remove();
    const aiFab = document.getElementById("ai-assistant-btn");
    if (aiFab) aiFab.style.display = "flex";
    return true;
  }

  // 7. Any modal — close ONLY the topmost one ─────────────────────────
  const modals = document.querySelectorAll(".modal-overlay");
  if (modals.length > 0) {
    const top = modals[modals.length - 1];
    const cancelBtn =
      top.querySelector('[data-act="cancel"], [data-act="close"]') ||
      Array.from(top.querySelectorAll("button"))
        .find(b => /^(cancel|close)$/i.test(b.textContent.trim()));
    if (cancelBtn) cancelBtn.click();
    else top.remove();
    return true;
  }

  // 8. Full-screen settings page (Starred Messages, etc.) ─────────────
  const settingsPage = document.querySelector(".app-container > .settings-page");
  if (settingsPage) {
    settingsPage.remove();
    return true;
  }

  // 9. Floating status widget ─────────────────────────────────────────
  const statusWidget = document.getElementById("floating-status-widget");
  if (statusWidget) {
    statusWidget.remove();
    return true;
  }

  // 10. Chat search bar ───────────────────────────────────────────────
  const chatSearch = document.getElementById("chat-search-bar");
  if (chatSearch && chatSearch.classList.contains("show")) {
    chatSearch.classList.remove("show");
    document.querySelectorAll(".msg-row.search-hit")
      .forEach(n => n.classList.remove("search-hit"));
    return true;
  }

  // 11. Emoji / sticker panel ─────────────────────────────────────────
  const emojiPanel = document.getElementById("emoji-panel");
  if (emojiPanel && emojiPanel.classList.contains("show")) {
    emojiPanel.classList.remove("show");
    return true;
  }

  // 12. Reply banner (cancel swipe-reply) ─────────────────────────────
  const replyBanner = document.getElementById("reply-banner");
  if (replyBanner && replyBanner.classList.contains("show")) {
    window.cancelReply?.();
    return true;
  }

  // 13. Active chat window ────────────────────────────────────────────
  const chatWindow = document.getElementById("chat-window");
  if (chatWindow && chatWindow.classList.contains("active")) {
    chatWindow.classList.remove("active");
    document.querySelector(".app-container")?.classList.remove("chat-open");
    window.cancelReply?.();
    return true;
  }

  // 14. Not on the Chats tab → return to Chats ────────────────────────
  if (typeof currentView !== "undefined" && currentView !== "chats") {
    window.switchView?.("chats");
    return true;
  }

  // 15. Root — hand control back to the OS so it can exit ─────────────
  return false;
}

// Install once per page load
(function installBackButtonHandler() {
  try { history.pushState({ mofie: "root" }, ""); } catch (_) {}

  window.addEventListener("popstate", () => {
    if (mofieHandleBack()) {
      try { history.pushState({ mofie: "root" }, ""); } catch (_) {}
    }
    // else: nothing to close — allow browser / OS to exit
  });
})();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    let userData = null;
    for (let i = 0; i < 3; i++) {
      try {
        const snap = await getDoc(doc(db,"users",user.uid));
        if (snap.exists()) { userData = snap.data(); break; }
      } catch (e) { console.warn("retry", i, e.message); }
      await new Promise(r => setTimeout(r, 600*(i+1)));
    }
    
    if (!userData) { 
      setTimeout(async()=>{ await signOut(auth); renderAuth(); },1500); 
      return; 
    }

    // ── Verification gate ────────────────────────────────────────────
    if (userData.emailVerified !== true) {
      currentUser = userData;
      showVerificationScreen(user, userData.email);
      return;
    }

    currentUser = userData;

    // ✅ AUTO-GENERATE E2EE KEYS FOR EXISTING USERS
    if (!userData.publicKey) {
      const askForPassword = prompt("Welcome to the new secure Mofie! Please enter your password once to generate your encryption keys.");
      if (askForPassword) {
        await E2EE.initE2EE(db, currentUser, askForPassword).catch(e => {
          console.warn("Could not auto-generate E2EE keys:", e);
        });
      }
    }

    // ── E2EE unlock (needed before any chat opens) ──────────────────
    const restored = await E2EE.tryRestoreE2EE(db, currentUser);
    if (!restored) {
      window.__e2eeNeedsUnlock = true;
    }

    // ── Reset in-memory state ────────────────────────────────────────
    currentView="chats"; currentTab="friends"; currentChatId=null; currentOtherId=null;
    currentConvData=null; currentMessages=[]; userCache.clear();
    knownChatTimestamps.clear(); activeStatusUsers.clear();
    latestChatsSnap=null; hasLoggedCurrentCall=false;

    startPresence();
    listenForBroadcasts();
    listenForIncomingCalls();
    subscribeToStatuses();
    startExpirySweep();
    renderMain();
    syncMissedCalls();
    
    // Push + FCM + deep-link remain unchanged
    /* … keep everything else from the original handler … */

  } else {
    currentUser = null;
    E2EE.lockE2EE();
    clearInterval(presenceInterval);
    clearTimeout(chatListRenderTimer);
    [unsubMessages, unsubChats, unsubConvMeta, unsubBroadcast,
     unsubExplore, unsubStatuses, unsubUsers, unsubCallLogs]
      .forEach(u => { try { u && u(); } catch(_) {} });
    unsubMessages = unsubChats = unsubConvMeta = unsubBroadcast =
      unsubExplore = unsubStatuses = unsubUsers = unsubCallLogs = null;
    latestChatsSnap=null; knownChatTimestamps.clear();
    activeStatusUsers.clear(); userCache.clear(); hasLoggedCurrentCall=false;
    renderAuth();
  }
});

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/mofie/sw.js", { scope: "/mofie/" }).catch(err =>
    console.warn("SW:", err.message));
}


// ══════════════════════════════════════════════════════════════════════════
//  VOICE & VIDEO CALLING — STUN-ONLY, QUALITY-TUNED, FAILURE-AWARE
// ══════════════════════════════════════════════════════════════════════════

let peerConnection     = null;
let localStream        = null;
let currentCallId      = null;
let currentCallData    = null;
let currentCallRole    = null;
let unsubCallDoc       = null;
let unsubRemoteCands   = null;
let callTimerInterval  = null;
let callStartTime      = null;
let unsubIncomingCall  = null;
let isCallMuted        = false;
let pendingCandidates  = [];
let ringingInterval    = null;

/* NOTE: callWasAnswered, currentFacingMode, and isVideoOn are already 
   declared at the top of the file, so we don't redeclare them here. */

/* NEW — quality monitoring */
let qualityInterval      = null;
let currentVideoBitrate  = 2_500_000;
let silenceCheckTimer    = null;

// ══════════════════════════════════════════════════════════════════════════
//  ICE CONFIGURATION — STUN-ONLY (FREE, NO SIGNUP)
//
//  Ten redundant free STUN servers. STUN is only used to discover the
//  public IP/port of each peer; no traffic flows through these servers.
//  More servers = higher chance one responds = faster & more reliable
//  connection setup.
//
//  ~15–25% of calls may fail on mobile data / strict corporate WiFi.
//  The failure UX below makes that transparent to users, not a bug.
// ══════════════════════════════════════════════════════════════════════════
const ICE_SERVERS = {
  iceServers: [
    // Google — most reliable free STUN in the world
    { urls: "stun:stun.l.google.com:19302" },
    { urls: "stun:stun1.l.google.com:19302" },
    { urls: "stun:stun2.l.google.com:19302" },
    { urls: "stun:stun3.l.google.com:19302" },
    { urls: "stun:stun4.l.google.com:19302" },

    // Mozilla
    { urls: "stun:stun.services.mozilla.com:3478" },

    // Nextcloud (443 — works through firewalls that allow HTTPS)
    { urls: "stun:stun.nextcloud.com:443" },

    // Sipgate
    { urls: "stun:stun.sipgate.net:3478" },

    // Twilio
    { urls: "stun:stun.twilio.com:3478" },

    // BlackBerry (legacy but still up)
    { urls: "stun:stun.voip.blackberry.com:3478" }
  ],
  iceCandidatePoolSize: 10,
  bundlePolicy: "max-bundle",
  rtcpMuxPolicy: "require",
  iceTransportPolicy: "all"
};

// ── Codec preferences (quality) ─────────────────────────────────────
const PREFERRED_AUDIO_CODECS = ["audio/opus"];
const PREFERRED_VIDEO_CODECS = ["video/VP9", "video/H264", "video/VP8"];

// ── Bitrate targets ─────────────────────────────────────────────────
const AUDIO_MAX_BITRATE   = 64_000;
const VIDEO_MAX_BITRATE   = 2_500_000;
const VIDEO_MAX_FRAMERATE = 30;

// ══════════════════════════════════════════════════════════════════════════
//  PEER CONNECTION FACTORY
// ══════════════════════════════════════════════════════════════════════════
function createPeerConnection(callType = "voice") {
  const pc = new RTCPeerConnection(ICE_SERVERS);

  pc.ontrack = (event) => {
    console.log("[Call] Remote track:", event.track.kind);

    if (event.track.kind === "audio") {
      let audioEl = document.getElementById("mofie-remote-audio");
      if (!audioEl) {
        audioEl = document.createElement("audio");
        audioEl.id = "mofie-remote-audio";
        audioEl.autoplay = true;
        audioEl.playsInline = true;
        audioEl.style.cssText =
          "position:fixed;width:1px;height:1px;opacity:0;pointer-events:none;top:-10px;left:-10px;";
        document.body.appendChild(audioEl);
      }
      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      audioEl.srcObject = remoteStream;
      audioEl.muted = false;
      audioEl.volume = 1.0;

      const tryPlay = () => {
        const p = audioEl.play();
        if (p && p.catch) {
          p.catch(() => {
            const retry = () => {
              audioEl.play().catch(() => {});
              document.removeEventListener("click", retry);
              document.removeEventListener("touchstart", retry);
            };
            document.addEventListener("click", retry, { once: true });
            document.addEventListener("touchstart", retry, { once: true });
          });
        }
      };
      tryPlay();
      event.track.enabled = true;

    } else if (event.track.kind === "video") {
      const remoteVideo = document.getElementById("remote-video");
      const placeholder = document.getElementById("remote-placeholder");
      if (!remoteVideo) return;

      const remoteStream = event.streams[0] || new MediaStream([event.track]);
      remoteVideo.srcObject = remoteStream;
      remoteVideo.muted = false;

      remoteVideo.play().then(() => {
        remoteVideo.classList.add("active");
        if (placeholder) placeholder.style.display = "none";
      }).catch(() => {
        const retry = () => {
          remoteVideo.play().catch(() => {});
          document.removeEventListener("click", retry);
          document.removeEventListener("touchstart", retry);
        };
        document.addEventListener("click", retry, { once: true });
        document.addEventListener("touchstart", retry, { once: true });
      });
      event.track.enabled = true;
    }
  };

  // ── ICE state: auto-restart once, then fail gracefully ───────────
  let iceRestartedOnce = false;
  pc.oniceconnectionstatechange = () => {
    const s = pc.iceConnectionState;
    console.log("[Call] ICE:", s);

    if (s === "failed") {
      if (!iceRestartedOnce && currentCallRole === "caller") {
        iceRestartedOnce = true;
        console.warn("[Call] ICE failed — attempting one restart");
        try { pc.restartIce(); } catch (_) {}
        setTimeout(() => {
          if (pc.iceConnectionState === "failed") {
            endCall("connection-failed");
          }
        }, 6000);
      } else {
        endCall("connection-failed");
      }
    }

    if (s === "disconnected") {
      setTimeout(() => {
        const now = pc.iceConnectionState;
        if (now === "disconnected" || now === "failed") {
          endCall("connection-lost");
        }
      }, 6000);
    }
  };

  // ── Watch for "connected but no media" silent failure ────────────
  pc.addEventListener("connectionstatechange", () => {
    if (pc.connectionState === "connected") {
      startSilenceDetector(pc);
    }
  });

  // ── Start live quality telemetry ─────────────────────────────────
  startQualityMonitor(pc);

  return pc;
}

// ══════════════════════════════════════════════════════════════════════════
//  CODEC & BITRATE TUNING
// ══════════════════════════════════════════════════════════════════════════
async function applyCodecPreferences(pc) {
  if (!pc.getTransceivers) return;

  const audioCaps = RTCRtpSender.getCapabilities("audio");
  const videoCaps = RTCRtpSender.getCapabilities("video");
  if (!audioCaps || !videoCaps) return;

  const prefAudio = audioCaps.codecs.filter(c =>
    PREFERRED_AUDIO_CODECS.includes(c.mimeType.toLowerCase())
  );
  const prefVideo = videoCaps.codecs.filter(c =>
    PREFERRED_VIDEO_CODECS.includes(c.mimeType.toLowerCase())
  );

  for (const tr of pc.getTransceivers()) {
    try {
      const kind = tr.receiver.track.kind;
      if (kind === "audio" && prefAudio.length) {
        const rest = audioCaps.codecs.filter(c => !prefAudio.includes(c));
        tr.setCodecPreferences([...prefAudio, ...rest]);
      } else if (kind === "video" && prefVideo.length) {
        const rest = videoCaps.codecs.filter(c => !prefVideo.includes(c));
        tr.setCodecPreferences([...prefVideo, ...rest]);
      }
    } catch (e) {
      console.warn("[Call] setCodecPreferences failed:", e.message);
    }
  }
}

async function tuneSenders(pc) {
  if (!pc) return;
  for (const sender of pc.getSenders()) {
    if (!sender.track) continue;
    const kind = sender.track.kind;
    const params = sender.getParameters();
    if (!params.encodings || !params.encodings.length) params.encodings = [{}];

    if (kind === "audio") {
      Object.assign(params.encodings[0], {
        maxBitrate: AUDIO_MAX_BITRATE,
        dtx: false,
        networkPriority: "high"
      });
      if ("priority" in params) params.priority = "high";
    } else if (kind === "video") {
      Object.assign(params.encodings[0], {
        maxBitrate: currentVideoBitrate,
        maxFramerate: VIDEO_MAX_FRAMERATE,
        networkPriority: "high"
      });
      if ("degradationPreference" in params) {
        params.degradationPreference = "balanced";
      }
    }

    try { await sender.setParameters(params); }
    catch (e) { console.warn("[Call] setParameters:", e.message); }
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  QUALITY MONITOR — adapts video bitrate to live network conditions
// ══════════════════════════════════════════════════════════════════════════
function startQualityMonitor(pc) {
  stopQualityMonitor();
  let lowStreak = 0;

  qualityInterval = setInterval(async () => {
    if (!pc || pc.connectionState !== "connected") return;
    try {
      const stats = await pc.getStats();
      let rtt = 0, jitter = 0;

      stats.forEach(r => {
        if (r.type === "candidate-pair" && r.state === "succeeded" && r.currentRoundTripTime) {
          rtt = r.currentRoundTripTime * 1000;
        }
        if (r.type === "inbound-rtp" && r.kind === "audio") {
          jitter = Math.max(jitter, (r.jitter || 0) * 1000);
        }
      });

      const poor = rtt > 350 || jitter > 60;

      if (poor && currentVideoBitrate > 800_000) {
        lowStreak++;
        if (lowStreak >= 2) {
          currentVideoBitrate = Math.max(800_000, Math.floor(currentVideoBitrate * 0.7));
          await applyNewVideoBitrate(pc, currentVideoBitrate);
          console.log("[Call] Downshift video →", currentVideoBitrate);
          lowStreak = 0;
        }
      } else if (!poor && currentVideoBitrate < VIDEO_MAX_BITRATE) {
        currentVideoBitrate = Math.min(
          VIDEO_MAX_BITRATE,
          Math.floor(currentVideoBitrate * 1.15)
        );
        await applyNewVideoBitrate(pc, currentVideoBitrate);
        lowStreak = 0;
      }
    } catch (_) {}
  }, 3000);
}

async function applyNewVideoBitrate(pc, bitrate) {
  if (!pc) return;
  for (const sender of pc.getSenders()) {
    if (!sender.track || sender.track.kind !== "video") continue;
    const p = sender.getParameters();
    if (!p.encodings || !p.encodings.length) p.encodings = [{}];
    p.encodings[0].maxBitrate = bitrate;
    try { await sender.setParameters(p); } catch (_) {}
  }
}

function stopQualityMonitor() {
  if (qualityInterval) { clearInterval(qualityInterval); qualityInterval = null; }
  currentVideoBitrate = VIDEO_MAX_BITRATE;
}

// ══════════════════════════════════════════════════════════════════════════
//  SILENT-FAILURE DETECTOR — "connected but no audio" watchdog
// ══════════════════════════════════════════════════════════════════════════
function startSilenceDetector(pc) {
  if (silenceCheckTimer) clearTimeout(silenceCheckTimer);
  silenceCheckTimer = setTimeout(async () => {
    if (!pc || pc.connectionState !== "connected") return;
    try {
      const stats = await pc.getStats();
      let bytes = 0;
      stats.forEach(r => {
        if (r.type === "inbound-rtp" && r.kind === "audio") {
          bytes += r.bytesReceived || 0;
        }
      });
      if (bytes < 5000) {
        console.warn("[Call] Connected but no audio — likely one-way path");
        showToast("⚠️ Poor connection — you may not hear the other person");
      }
    } catch (_) {}
  }, 5000);
}

function stopSilenceDetector() {
  if (silenceCheckTimer) { clearTimeout(silenceCheckTimer); silenceCheckTimer = null; }
}

// ══════════════════════════════════════════════════════════════════════════
//  LOCAL MEDIA ACQUISITION — tuned constraints + progressive fallback
// ══════════════════════════════════════════════════════════════════════════
async function getLocalStream(includeVideo = false) {
  if (localStream) {
    const hasVideo = localStream.getVideoTracks().length > 0;
    if (hasVideo === includeVideo) return localStream;
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  const isMobile = /Android|iPhone|iPad/i.test(navigator.userAgent);

  const audioConstraints = {
    echoCancellation: true,
    noiseSuppression: true,
    autoGainControl: true,
    channelCount: { ideal: 1 },
    sampleRate:   { ideal: 48000 },
    sampleSize:   { ideal: 16 }
  };

  const videoConstraints = includeVideo ? {
    facingMode: currentFacingMode,
    width:     { ideal: isMobile ? 1280 : 1920 },
    height:    { ideal: isMobile ? 720  : 1080 },
    frameRate: { ideal: 30, max: 30 },
    resizeMode: "crop-and-scale",
    aspectRatio: { ideal: 16 / 9 }
  } : false;

  try {
    localStream = await navigator.mediaDevices.getUserMedia({
      audio: audioConstraints,
      video: videoConstraints
    });

    localStream.getAudioTracks().forEach(t => { t.contentHint = "speech"; });
    localStream.getVideoTracks().forEach(t => { t.contentHint = "motion"; });

    return localStream;
  } catch (err) {
    console.warn("[Call] Stream error:", err.name, err.message);

    if (includeVideo) {
      // Fallback 1: lower resolution
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: audioConstraints,
          video: { facingMode: currentFacingMode, width: 640, height: 480, frameRate: 24 }
        });
        localStream.getAudioTracks().forEach(t => { t.contentHint = "speech"; });
        localStream.getVideoTracks().forEach(t => { t.contentHint = "motion"; });
        showToast("Camera limited — using 480p");
        return localStream;
      } catch (_) {
        showToast("Camera unavailable — continuing with audio only");
        return getLocalStream(false);
      }
    }
    throw err;
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  ICE CANDIDATE QUEUE
// ══════════════════════════════════════════════════════════════════════════
function safeAddCandidate(candidate) {
  if (peerConnection && peerConnection.currentRemoteDescription) {
    peerConnection.addIceCandidate(new RTCIceCandidate(candidate))
      .catch(e => console.warn("[Call] addIceCandidate:", e));
  } else {
    pendingCandidates.push(candidate);
  }
}

async function flushPendingCandidates() {
  if (!peerConnection || !peerConnection.currentRemoteDescription) return;
  const toFlush = [...pendingCandidates];
  pendingCandidates = [];
  for (const c of toFlush) {
    await peerConnection.addIceCandidate(new RTCIceCandidate(c))
      .catch(e => console.warn("[Call] flush candidate:", e));
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  PUBLIC API
// ══════════════════════════════════════════════════════════════════════════
window.startVoiceCall = (calleeUid, calleeName, calleePhoto) =>
  startCall(calleeUid, calleeName, calleePhoto, "voice");

window.startVideoCall = (calleeUid, calleeName, calleePhoto) =>
  startCall(calleeUid, calleeName, calleePhoto, "video");

// ══════════════════════════════════════════════════════════════════════════
//  CALLER: initiate
// ══════════════════════════════════════════════════════════════════════════
async function startCall(calleeUid, calleeName, calleePhoto, callType = "voice") {
  if (currentCallId) return showToast("You're already in a call");
  hasLoggedCurrentCall = false;
  callWasAnswered      = false;
  currentVideoBitrate  = VIDEO_MAX_BITRATE;

  if (!calleeUid || calleeUid === currentUser.uid) return;
  if ((currentUser.blockedUsers || []).includes(calleeUid))
    return showToast("You have blocked this user");

  try {
    showCallScreen(calleeName || "User", calleePhoto, "Calling…", callType);

    const stream = await getLocalStream(callType === "video");
    if (callType === "video") attachLocalVideo();

    peerConnection = createPeerConnection(callType);

    stream.getTracks().forEach(t => peerConnection.addTrack(t, stream));

    // Apply codec preferences AFTER tracks exist
    await applyCodecPreferences(peerConnection);

    const callRef = doc(collection(db, "calls"));
    currentCallId   = callRef.id;
    currentCallRole = "caller";

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        addDoc(collection(db, "calls", currentCallId, "callerCandidates"),
          e.candidate.toJSON()).catch(() => {});
      }
    };

    const offer = await peerConnection.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: callType === "video"
    });
    await peerConnection.setLocalDescription(offer);

    await setDoc(callRef, {
      callerId:     currentUser.uid,
      callerName:   currentUser.displayName || "User",
      callerPhoto:  currentUser.photoURL || null,
      calleeId:     calleeUid,
      calleeName:   calleeName || "User",
      calleePhoto:  calleePhoto || null,
      callType,
      status:       "ringing",
      offer:        { type: offer.type, sdp: offer.sdp },
      createdAt:    serverTimestamp(),
      endedAt:      null
    });

    listenToCallDoc();

    unsubRemoteCands = onSnapshot(
      collection(db, "calls", currentCallId, "calleeCandidates"),
      snap => snap.docChanges().forEach(ch => {
        if (ch.type === "added") safeAddCandidate(ch.doc.data());
      })
    );

    // Tune senders once connection is live
    peerConnection.addEventListener("connectionstatechange", () => {
      if (peerConnection && peerConnection.connectionState === "connected") {
        tuneSenders(peerConnection);
      }
    });

    startRingingTone();

    // ── Friendly timeout with explanation ─────────────────────────
    setTimeout(() => {
      if (currentCallId && currentCallData?.status === "ringing") {
        endCall("no-answer");
        // Explain the most common cause so it doesn't look like a bug
        showAlert(
          "Call didn't connect",
          "This can happen on mobile data or strict WiFi networks. " +
          "Try again on a different network, or ask the other person to call you back.",
          false
        );
      }
    }, 45000);

  } catch (err) {
    console.error("[Call] start error:", err);
    cleanupCall();
    showToast("Could not start call: " + err.message);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  Call document listener (shared by caller & callee)
// ══════════════════════════════════════════════════════════════════════════
function listenToCallDoc() {
  if (unsubCallDoc) unsubCallDoc();
  unsubCallDoc = onSnapshot(doc(db, "calls", currentCallId), async snap => {
    if (!snap.exists()) { cleanupCall(); return; }
    const data = snap.data();
    currentCallData = data;

    if (currentCallRole === "caller") {
      if (data.answer && peerConnection && !peerConnection.currentRemoteDescription) {
        try {
          await peerConnection.setRemoteDescription(new RTCSessionDescription(data.answer));
          await flushPendingCandidates();
          callWasAnswered = true;
          connectSuccess();
        } catch (e) { console.warn("[Call] SDP answer:", e); }
      }
      if (data.status === "declined") { showToast("Call declined"); cleanupCall(); }
      if (data.status === "busy")     { showToast("User is busy");  cleanupCall(); }
      if (data.status === "ended")    { cleanupCall(); }
      if (data.status === "active" && !callStartTime) connectSuccess();
    }

    if (currentCallRole === "callee") {
      if (data.status === "ended" || data.status === "declined") {
        if (document.getElementById("incoming-call-overlay")) {
          showToast("Missed call");
        }
        cleanupCall();
      }
    }
  });
}

function connectSuccess() {
  stopRingingTone();
  if (callStartTime) return;
  callStartTime = Date.now();
  const el = document.getElementById("call-status");
  if (el) el.textContent = "Connected";
  startCallTimer();
}

// ══════════════════════════════════════════════════════════════════════════
//  CALLEE: listen for incoming calls
// ══════════════════════════════════════════════════════════════════════════
window.listenForIncomingCalls = () => {
  if (unsubIncomingCall) unsubIncomingCall();
  if (!currentUser) return;

  unsubIncomingCall = onSnapshot(
    query(
      collection(db, "calls"),
      where("calleeId", "==", currentUser.uid),
      where("status", "==", "ringing")
    ),
    snap => {
      snap.docChanges().forEach(async change => {
        if (change.type !== "added") return;
        const callId = change.doc.id;
        const data   = change.doc.data();

        if (data.callerId === currentUser.uid) return;
        if ((currentUser.blockedUsers || []).includes(data.callerId)) {
          updateDoc(doc(db, "calls", callId), { status: "declined" }).catch(() => {});
          return;
        }
        if (data.createdAt && Date.now() - data.createdAt.toMillis() > 60000) {
          updateDoc(doc(db, "calls", callId), { status: "missed" }).catch(() => {});
          return;
        }
        if (currentCallId) {
          updateDoc(doc(db, "calls", callId), { status: "busy" }).catch(() => {});
          return;
        }
        showIncomingCall(callId, data);
      });
    }
  );
};

// ══════════════════════════════════════════════════════════════════════════
//  CALLEE: accept
// ══════════════════════════════════════════════════════════════════════════
window.acceptIncomingCall = async (callId) => {
  try {
    stopRingingTone();
    const snap = await getDoc(doc(db, "calls", callId));
    if (!snap.exists()) return showToast("Call no longer available");
    const callData = snap.data();
    if (callData.status !== "ringing") return showToast("Call already ended");

    hideIncomingCall();

    currentCallId   = callId;
    currentCallData = callData;
    currentCallRole = "callee";
    hasLoggedCurrentCall = false;
    callWasAnswered      = false;
    currentVideoBitrate  = VIDEO_MAX_BITRATE;

    const callType = callData.callType || "voice";
    showCallScreen(callData.callerName, callData.callerPhoto, "Connecting…", callType);

    const stream = await getLocalStream(callType === "video");
    if (callType === "video") attachLocalVideo();

    peerConnection = createPeerConnection(callType);
    stream.getTracks().forEach(t => peerConnection.addTrack(t, stream));

    await applyCodecPreferences(peerConnection);

    peerConnection.onicecandidate = (e) => {
      if (e.candidate) {
        addDoc(collection(db, "calls", callId, "calleeCandidates"),
          e.candidate.toJSON()).catch(() => {});
      }
    };

    await peerConnection.setRemoteDescription(
      new RTCSessionDescription(callData.offer)
    );
    await flushPendingCandidates();

    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await updateDoc(doc(db, "calls", callId), {
      status: "active",
      answer: { type: answer.type, sdp: answer.sdp },
      answeredAt: serverTimestamp()
    });

    unsubRemoteCands = onSnapshot(
      collection(db, "calls", callId, "callerCandidates"),
      snap => snap.docChanges().forEach(ch => {
        if (ch.type === "added") safeAddCandidate(ch.doc.data());
      })
    );

    listenToCallDoc();
    connectSuccess();

    peerConnection.addEventListener("connectionstatechange", () => {
      if (peerConnection && peerConnection.connectionState === "connected") {
        tuneSenders(peerConnection);
      }
    });

  } catch (err) {
    console.error("[Call] accept error:", err);
    showToast("Could not connect: " + err.message);
    endCall("error");
  }
};

// ══════════════════════════════════════════════════════════════════════════
//  CALLEE: decline
// ══════════════════════════════════════════════════════════════════════════
window.declineIncomingCall = async (callId) => {
  stopRingingTone();
  hideIncomingCall();
  try {
    const snap = await getDoc(doc(db, "calls", callId));
    const data = snap.data();

    await updateDoc(doc(db, "calls", callId), {
      status: "declined",
      endedAt: serverTimestamp(),
      endedReason: "declined"
    });

    if (data && !hasLoggedCurrentCall) {
      hasLoggedCurrentCall = true;
      await logCallEntry(callId, data, "callee", null);
    }
  } catch (_) {}
};

// ══════════════════════════════════════════════════════════════════════════
//  End + cleanup
// ══════════════════════════════════════════════════════════════════════════
window.endCall = async (reason = "ended") => {
  const id = currentCallId;
  try {
    if (id) {
      await updateDoc(doc(db, "calls", id), {
        status: "ended",
        endedAt: serverTimestamp(),
        endedReason: reason,
        endedBy: currentUser.uid
      }).catch(() => {});
    }
  } catch (_) {}
  cleanupCall();
};

function cleanupCall(options = {}) {
  const shouldLog = options.logCall !== false;

  const callIdToLog   = currentCallId;
  const callDataToLog = currentCallData;
  const roleToLog     = currentCallRole;
  const startToLog    = callStartTime;

  stopRingingTone();
  stopQualityMonitor();
  stopSilenceDetector();

  if (callTimerInterval) { clearInterval(callTimerInterval); callTimerInterval = null; }

  try { peerConnection?.close(); } catch (_) {}
  peerConnection = null;

  try { localStream?.getTracks().forEach(t => t.stop()); } catch (_) {}
  localStream = null;

  if (unsubCallDoc)     { unsubCallDoc();     unsubCallDoc = null; }
  if (unsubRemoteCands) { unsubRemoteCands(); unsubRemoteCands = null; }

  currentCallId     = null;
  currentCallData   = null;
  currentCallRole   = null;
  callStartTime     = null;
  isCallMuted       = false;
  isSpeakerOn       = false;
  callWasAnswered   = false;
  pendingCandidates = [];
  isVideoOn         = true;
  currentFacingMode = "user";
  currentVideoBitrate = VIDEO_MAX_BITRATE;

  const remoteVideoEl = document.getElementById("remote-video");
  if (remoteVideoEl) {
    try { remoteVideoEl.pause(); }          catch (_) {}
    try { remoteVideoEl.srcObject = null; } catch (_) {}
  }
  const localVideoEl = document.getElementById("local-video");
  if (localVideoEl) {
    try { localVideoEl.pause(); }          catch (_) {}
    try { localVideoEl.srcObject = null; } catch (_) {}
  }

  const remoteAudio = document.getElementById("mofie-remote-audio");
  if (remoteAudio) {
    try { remoteAudio.pause(); }          catch (_) {}
    try { remoteAudio.srcObject = null; } catch (_) {}
    remoteAudio.remove();
  }

  document.getElementById("call-overlay")?.remove();
  document.getElementById("incoming-call-overlay")?.remove();

  if (shouldLog && !hasLoggedCurrentCall &&
      callIdToLog && callDataToLog && roleToLog) {
    hasLoggedCurrentCall = true;
    logCallEntry(callIdToLog, callDataToLog, roleToLog, startToLog);
  }
}

// ══════════════════════════════════════════════════════════════════════════
//  ICONS
// ══════════════════════════════════════════════════════════════════════════
const MIC_ICON = `<svg viewBox="0 0 24 24"><path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z"/><path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z"/></svg>`;
const MIC_OFF_ICON = `<svg viewBox="0 0 24 24"><path d="M19 11h-1.7c0 .74-.16 1.43-.43 2.05l1.23 1.23c.56-.98.9-2.09.9-3.28zM15 11.17V5c0-1.66-1.34-3-3-3S9 3.34 9 5v.17L15 11.17zm3.27 6.36l-1.41-1.41L4.27 3.53 3 4.8l4.69 4.69c-.14.34-.21.7-.21 1.08V11h2c0 1.66 1.34 3 3 3 .35 0 .69-.06 1-.17L4.8 3 3 4.8l-1.41 1.41L5 9.62V11c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c.74-.11 1.44-.32 2.09-.61l3.58 3.58 1.41-1.41z"/></svg>`;

const SPEAKER_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z"/></svg>`;
const SPEAKER_OFF_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.5 12A4.5 4.5 0 0 0 14 7.97v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51A8.796 8.796 0 0 0 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06a8.99 8.99 0 0 0 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>`;

const VIDEO_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`;
const VIDEO_OFF_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M21 6.5l-4 4V7c0-.55-.45-1-1-1H9.82L21 17.18V6.5zM3.27 2L2 3.27 4.73 6H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.21 0 .39-.08.54-.18L19.73 21 21 19.73 3.27 2z"/></svg>`;

const SWITCH_CAM_ICON = `<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 6.5c2.76 0 5 2.24 5 5 0 .51-.1 1-.24 1.46l3.06 3.06c1.39-1.23 2.49-2.77 3.18-4.53C21.27 7.11 17 4 12 4c-1.27 0-2.49.2-3.64.57l2.17 2.17c.47-.14.96-.24 1.47-.24zM2.71 3.16c-.39.39-.39 1.02 0 1.41l1.97 1.97A11.892 11.892 0 0 0 1 11.5C2.73 15.89 7 19 12 19c1.52 0 2.97-.3 4.31-.82l2.72 2.72c.39.39 1.02.39 1.41 0 .39-.39.39-1.02 0-1.41L4.13 3.16c-.39-.39-1.03-.39-1.42 0zM12 16.5c-2.76 0-5-2.24-5-5 0-.77.18-1.5.49-2.14l1.57 1.57c-.03.18-.06.37-.06.57 0 1.66 1.34 3 3 3 .2 0 .38-.03.57-.07L14.14 16c-.65.32-1.37.5-2.14.5zm2.97-5.33a2.97 2.97 0 0 0-2.64-2.64l2.64 2.64z"/></svg>`;

// ══════════════════════════════════════════════════════════════════════════
//  UI: Active / Calling screen
// ══════════════════════════════════════════════════════════════════════════
function showCallScreen(name, photo, status, callType = "voice") {
  document.getElementById("call-overlay")?.remove();
  const isVideo = callType === "video";

  const overlay = document.createElement("div");
  overlay.id = "call-overlay";
  overlay.className = "call-overlay" + (isVideo ? " video-mode" : "");

  if (isVideo) {
    overlay.innerHTML = `
      <div class="remote-video-placeholder" id="remote-placeholder">
        <div class="call-avatar">
          ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : escapeHtml((name || "?").slice(0, 1).toUpperCase())}
        </div>
        <div class="call-name">${escapeHtml(name || "Video Call")}</div>
        <div class="call-status" id="call-status">${escapeHtml(status)}</div>
      </div>
      <video class="call-remote-video" id="remote-video" autoplay playsinline></video>
      <div class="call-local-wrap">
        <video class="call-local-video" id="local-video" autoplay playsinline muted></video>
        <div class="call-local-fallback" id="local-fallback">
          ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : escapeHtml((name || "?").slice(0, 1).toUpperCase())}
        </div>
      </div>
      <div class="call-info-overlay">
        <div class="call-name">${escapeHtml(name || "Video Call")}</div>
        <div class="call-status" id="call-status-top">${escapeHtml(status)}</div>
      </div>
      <div class="call-actions">
        <button class="call-btn mute" id="call-mute-btn" aria-label="Mute">${MIC_ICON}</button>
        <button class="call-btn video-toggle active" id="call-video-btn" aria-label="Video">${VIDEO_ICON}</button>
        <button class="call-btn switch-camera" id="call-switch-camera-btn" aria-label="Switch camera">${SWITCH_CAM_ICON}</button>
        <button class="call-btn end" id="call-end-btn" aria-label="End call">
          <svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
        </button>
      </div>`;
  } else {
    overlay.innerHTML = `
      <div class="call-avatar">
        ${photo ? `<img src="${escapeHtml(photo)}" alt="">` : escapeHtml((name || "?").slice(0, 1).toUpperCase())}
      </div>
      <div class="call-name">${escapeHtml(name || "Call")}</div>
      <div class="call-status" id="call-status">${escapeHtml(status)}</div>
      <div class="call-actions">
        <button class="call-btn mute" id="call-mute-btn" aria-label="Mute">${MIC_ICON}</button>
        <button class="call-btn speaker ${isSpeakerOn ? "active" : ""}" id="call-speaker-btn" aria-label="Speaker">
          ${isSpeakerOn ? SPEAKER_ICON : SPEAKER_OFF_ICON}
        </button>
        <button class="call-btn end" id="call-end-btn" aria-label="End call">
          <svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
        </button>
      </div>`;
  }
  document.body.appendChild(overlay);

  if (isVideo) {
    attachLocalVideo();
    overlay.querySelector("#call-video-btn").onclick        = toggleVideo;
    overlay.querySelector("#call-switch-camera-btn").onclick = switchCamera;
  } else {
    overlay.querySelector("#call-speaker-btn").onclick = toggleSpeaker;
  }
  overlay.querySelector("#call-end-btn").onclick  = () => endCall("hungup");
  overlay.querySelector("#call-mute-btn").onclick = toggleCallMute;
}

function attachLocalVideo() {
  const localVideo = document.getElementById("local-video");
  if (!localVideo || !localStream) return;

  const hasVideo = localStream.getVideoTracks().length > 0;
  if (!hasVideo) {
    localVideo.classList.add("off");
    document.getElementById("local-fallback")?.classList.add("show");
    return;
  }

  localVideo.srcObject = localStream;
  localVideo.play().catch(() => {});
  localVideo.style.transform = currentFacingMode === "user" ? "scaleX(-1)" : "none";
  localVideo.classList.remove("off");
  document.getElementById("local-fallback")?.classList.remove("show");
}

function toggleVideo() {
  if (!localStream) return;
  const videoTracks = localStream.getVideoTracks();
  if (!videoTracks.length) return;

  isVideoOn = !isVideoOn;
  videoTracks.forEach(t => t.enabled = isVideoOn);

  document.getElementById("local-video")?.classList.toggle("off", !isVideoOn);
  document.getElementById("local-fallback")?.classList.toggle("show", !isVideoOn);

  const btn = document.getElementById("call-video-btn");
  if (btn) {
    btn.classList.toggle("active", isVideoOn);
    btn.innerHTML = isVideoOn ? VIDEO_ICON : VIDEO_OFF_ICON;
  }
}

async function switchCamera() {
  if (!localStream) return;
  const oldTrack = localStream.getVideoTracks()[0];
  if (!oldTrack) return showToast("No camera available");

  try {
    const newFacing = currentFacingMode === "user" ? "environment" : "user";
    const newStream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: newFacing }
    });
    const newTrack = newStream.getVideoTracks()[0];
    newTrack.contentHint = "motion";

    if (peerConnection) {
      const sender = peerConnection.getSenders().find(s => s.track && s.track.kind === "video");
      if (sender) await sender.replaceTrack(newTrack);
    }

    const audioTracks = localStream.getAudioTracks();
    localStream = new MediaStream([...audioTracks, newTrack]);
    oldTrack.stop();

    currentFacingMode = newFacing;
    attachLocalVideo();
    showToast(newFacing === "user" ? "Front camera" : "Back camera");
  } catch (err) {
    console.warn("[SwitchCamera]", err);
    showToast("Cannot switch camera");
  }
}

function toggleCallMute() {
  if (!localStream) return;
  isCallMuted = !isCallMuted;
  localStream.getAudioTracks().forEach(t => t.enabled = !isCallMuted);
  const btn = document.getElementById("call-mute-btn");
  if (!btn) return;
  btn.classList.toggle("muted", isCallMuted);
  btn.innerHTML = isCallMuted ? MIC_OFF_ICON : MIC_ICON;
}

async function toggleSpeaker() {
  const btn = document.getElementById("call-speaker-btn");
  const audioEl = document.getElementById("mofie-remote-audio");
  if (!audioEl) { showToast("Audio not ready"); return; }

  isSpeakerOn = !isSpeakerOn;
  if (btn) {
    btn.classList.toggle("active", isSpeakerOn);
    btn.innerHTML = isSpeakerOn ? SPEAKER_ICON : SPEAKER_OFF_ICON;
  }

  if (typeof audioEl.setSinkId !== "function") {
    showToast(isSpeakerOn ? "🔊 Speaker" : "📞 Earpiece (device default)");
    return;
  }

  try {
    if (isSpeakerOn) {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const outputs = devices.filter(d => d.kind === "audiooutput");
      const speaker = outputs.find(d => /speaker|speakers|loud/i.test(d.label || ""));
      const alt     = outputs.find(d => d.deviceId && d.deviceId !== "default" && d.deviceId !== "communications");

      if (speaker)   await audioEl.setSinkId(speaker.deviceId);
      else if (alt)  await audioEl.setSinkId(alt.deviceId);
      else           throw new Error("No speaker device");
      showToast("🔊 Speaker");
    } else {
      await audioEl.setSinkId("default");
      showToast("📞 Earpiece");
    }
  } catch (err) {
    console.warn("[Speaker]", err.message);
    showToast(isSpeakerOn ? "🔊 Speaker (best effort)" : "📞 Earpiece");
  }
}

function startCallTimer() {
  if (callTimerInterval) clearInterval(callTimerInterval);
  const el = document.getElementById("call-status");
  callTimerInterval = setInterval(() => {
    if (!callStartTime || !el) return;
    const s = Math.floor((Date.now() - callStartTime) / 1000);
    el.textContent = `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  }, 500);
}

// ══════════════════════════════════════════════════════════════════════════
//  UI: Incoming call
// ══════════════════════════════════════════════════════════════════════════
function showIncomingCall(callId, data) {
  document.getElementById("incoming-call-overlay")?.remove();
  const isVideo = data.callType === "video";

  const overlay = document.createElement("div");
  overlay.id = "incoming-call-overlay";
  overlay.className = "call-overlay";
  overlay.innerHTML = `
    <div style="font-size:13px;color:rgba(255,255,255,0.65);margin-bottom:16px;letter-spacing:2px;text-transform:uppercase">
      Incoming ${isVideo ? "video" : "voice"} call
    </div>
    <div class="call-avatar">
      ${data.callerPhoto
        ? `<img src="${escapeHtml(data.callerPhoto)}" alt="">`
        : escapeHtml((data.callerName || "?")[0].toUpperCase())}
    </div>
    <div class="call-name">${escapeHtml(data.callerName || "Unknown")}</div>
    <div class="call-status">${isVideo ? "Video Call" : "Voice Call"}</div>
    <div class="call-actions">
      <button class="call-btn decline" id="incoming-decline" aria-label="Decline">
        <svg viewBox="0 0 24 24"><path d="M12 9c-1.6 0-3.15.25-4.6.72v3.1c0 .39-.23.74-.56.9-.98.49-1.87 1.12-2.66 1.85-.18.18-.43.28-.7.28-.28 0-.53-.11-.71-.29L.29 13.08c-.18-.17-.29-.42-.29-.7 0-.28.11-.53.29-.71C3.34 8.78 7.46 7 12 7s8.66 1.78 11.71 4.67c.18.18.29.43.29.71 0 .28-.11.53-.29.7l-2.48 2.48c-.18.18-.43.29-.71.29-.27 0-.52-.11-.7-.28-.79-.74-1.69-1.36-2.67-1.85-.33-.16-.56-.5-.56-.9v-3.1C15.15 9.25 13.6 9 12 9z"/></svg>
      </button>
      <button class="call-btn accept" id="incoming-accept" aria-label="Accept">
        ${isVideo ? VIDEO_ICON : `<svg viewBox="0 0 24 24"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`}
      </button>
    </div>`;
  document.body.appendChild(overlay);

  overlay.querySelector("#incoming-decline").onclick = () => declineIncomingCall(callId);
  overlay.querySelector("#incoming-accept").onclick  = () => acceptIncomingCall(callId);

  startRingingTone();

  setTimeout(() => {
    if (document.getElementById("incoming-call-overlay") && !currentCallId) {
      declineIncomingCall(callId);
    }
  }, 45000);
}

function hideIncomingCall() {
  document.getElementById("incoming-call-overlay")?.remove();
}

// ══════════════════════════════════════════════════════════════════════════
//  Ringtone
// ══════════════════════════════════════════════════════════════════════════
function startRingingTone() {
  stopRingingTone();
  let flip = false;
  const play = () => {
    try {
      unlockAudio();
      if (!audioContext) return;
      const now = audioContext.currentTime;
      const o = audioContext.createOscillator(), g = audioContext.createGain();
      o.connect(g); g.connect(audioContext.destination);
      o.type = "sine";
      o.frequency.setValueAtTime(flip ? 800 : 600, now);
      flip = !flip;
      g.gain.setValueAtTime(0, now);
      g.gain.linearRampToValueAtTime(0.15, now + 0.05);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
      o.start(now); o.stop(now + 0.45);
    } catch (_) {}
  };
  play();
  ringingInterval = setInterval(play, 1500);
}

function stopRingingTone() {
  if (ringingInterval) { clearInterval(ringingInterval); ringingInterval = null; }
}

// ══════════════════════════════════════════════════════════════════════════
//  Wire the call buttons into the chat header
// ══════════════════════════════════════════════════════════════════════════
function injectCallButton() {
  const headerActions = document.querySelector(".header-actions");
  if (!headerActions || document.getElementById("video-call-btn")) return;

  const videoBtn = document.createElement("button");
  videoBtn.className = "icon";
  videoBtn.id = "video-call-btn";
  videoBtn.title = "Video Call";
  videoBtn.setAttribute("aria-label", "Video call");
  videoBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M17 10.5V7c0-.55-.45-1-1-1H4c-.55 0-1 .45-1 1v10c0 .55.45 1 1 1h12c.55 0 1-.45 1-1v-3.5l4 4v-11l-4 4z"/></svg>`;
  videoBtn.onclick = () => {
    if (!currentOtherId || !currentChatMeta || currentChatMeta.isGroup) return;
    const nameEl  = document.getElementById("other-name");
    const photoEl = document.getElementById("other-av")?.querySelector("img");
    window.startVideoCall(
      currentOtherId,
      nameEl?.textContent || "User",
      photoEl?.src || null
    );
  };

  const voiceBtn = document.createElement("button");
  voiceBtn.className = "icon";
  voiceBtn.id = "voice-call-btn";
  voiceBtn.title = "Voice Call";
  voiceBtn.setAttribute("aria-label", "Voice call");
  voiceBtn.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M6.62 10.79c1.44 2.83 3.76 5.14 6.59 6.59l2.2-2.2c.27-.27.67-.36 1.02-.24 1.12.37 2.33.57 3.57.57.55 0 1 .45 1 1V20c0 .55-.45 1-1 1-9.39 0-17-7.61-17-17 0-.55.45-1 1-1h3.5c.55 0 1 .45 1 1 0 1.25.2 2.45.57 3.57.11.35.03.74-.25 1.02l-2.2 2.2z"/></svg>`;
  voiceBtn.onclick = () => {
    if (!currentOtherId || !currentChatMeta || currentChatMeta.isGroup) return;
    const nameEl  = document.getElementById("other-name");
    const photoEl = document.getElementById("other-av")?.querySelector("img");
    window.startVoiceCall(
      currentOtherId,
      nameEl?.textContent || "User",
      photoEl?.src || null
    );
  };

  headerActions.insertBefore(videoBtn, headerActions.firstChild);
  headerActions.insertBefore(voiceBtn, headerActions.firstChild);
}

window.__mofieInjectCallButton = injectCallButton;

