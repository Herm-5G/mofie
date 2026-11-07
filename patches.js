// ══════════════════════════════════════════════════════════════════════════
//  MOFIE PATCHES
// ══════════════════════════════════════════════════════════════════════════
import { initI18n, t, getLanguage, getLanguages, setLanguage } from "./i18n.js";

initI18n();
document.documentElement.lang = getLanguage();
document.documentElement.dir = "ltr"; // Force Left-to-Right

window.openLanguageModal = function () {
  const langs = getLanguages();
  const current = getLanguage();
  const flags = { en: "🇬🇧", es: "🇪🇸", sw: "🇰🇪" };

  const overlay = document.createElement("div");
  overlay.className = "modal-overlay";
  overlay.setAttribute("role", "dialog");
  overlay.setAttribute("aria-modal", "true");
  overlay.innerHTML = `
    <div class="modal">
      <h3 style="margin-bottom:16px">${t("language")}</h3>
      <div class="lang-picker">
        ${Object.entries(langs).map(([code, name]) => `
          <div class="lang-option ${code === current ? "active" : ""}" data-lang="${code}">
            <span class="lang-flag">${flags[code] || "🌐"}</span>
            <span>${name}</span>
          </div>
        `).join("")}
      </div>
      <button class="btn-secondary" data-act="close">${t("close")}</button>
    </div>`;
  document.body.appendChild(overlay);

  const close = () => overlay.remove();
  overlay.querySelector('[data-act="close"]').onclick = close;
  overlay.addEventListener("click", e => { if (e.target === overlay) close(); });

  overlay.querySelectorAll(".lang-option").forEach(el => {
    el.onclick = () => {
      setLanguage(el.dataset.lang);
      close();
      setTimeout(() => location.reload(), 100);
    };
  });
};

function injectProfileRows() {
  const prefsCard = document.querySelector("#view-profile .clean-settings-card");
  if (!prefsCard || prefsCard.dataset.patched) return;
  prefsCard.dataset.patched = "1";

  const langRow = document.createElement("div");
  langRow.className = "clean-settings-item";
  langRow.innerHTML = `
    <div class="clean-icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
        <circle cx="12" cy="12" r="10"/>
        <line x1="2" y1="12" x2="22" y2="12"/>
        <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
      </svg>
    </div>
    <div class="clean-info">
      <h4>${t("language")}</h4>
      <p>${getLanguages()[getLanguage()] || "English"}</p>
    </div>`;
  langRow.onclick = () => window.openLanguageModal();

  prefsCard.appendChild(langRow);
}

new MutationObserver(() => {
  if (document.querySelector("#view-profile.active .clean-settings-card")) {
    injectProfileRows();
  }
}).observe(document.body, { childList: true, subtree: true });

const EN_TO_KEY = {
  "Chats": "chats", "Calls": "calls", "Profile": "profile",
  "Groups": "groups", "Unread": "unread", "Contacts": "contacts",
  "Search name or @username...": "search", "New Chat": "newChat",
  "Message": "message", "Send": "send", "Cancel": "cancel",
  "Save": "save", "Delete": "delete", "Edit": "edit",
  "Close": "close", "Back": "back", "Reply": "reply",
  "online": "online", "offline": "offline", "typing…": "typing",
  "Log Out": "logout", "Delete Account": "deleteAccount",
  "Pure, Fast and convenient": "tagline", "Email": "email", "Password": "password",
  "Login": "login", "Register": "register", "Create Account": "createAccount",
  "Forgot Password?": "forgotPassword", "Star": "star", "Unstar": "unstar",
  "Copy text": "copy", "Copy": "copy", "Forward": "forward", "Edit Message": "editMsg",
  "Delete for me": "deleteForMe", "Delete for everyone": "deleteForAll",
  "Pin Chat": "pinChat", "Unpin": "unpin", "Pin": "pin", "Mute": "mute",
  "Unmute": "unmute", "Media Gallery": "mediaGallery", "Delete Chat": "deleteChat",
  "Chat cleared": "chatCleared", "🔒 Messages auto-delete in 24 hours.": "autoDelete",
  "Replying to": "replyingTo", "Replied to status": "repliedToStatus",
  "📷 Photo": "photo", "🎬 Video": "video", "🎙️ Voice note": "voiceNote",
  "Share Contact": "shareContact", "File too large": "fileTooLarge",
  "Group Info": "groupInfo", "Group Name": "groupName", "Members": "members",
  "Add Member": "addMember", "Save Name": "saveName", "Leave Group": "leaveGroup",
  "Delete Group": "deleteGroup", "Remove": "remove", "Admin": "admin",
  "Start a Conversation": "startConversation", "Find from Phonebook": "findPhonebook",
  "Search by Username": "searchUsername", "Create a New Group": "createGroup",
  "Select contact": "selectContact", "Edit Profile": "editProfile", "Display name": "displayName",
  "Phone with country code": "phoneCC", "Saved": "saved", "Your QR Code": "qrTitle",
  "Share Link": "shareLink", "New password (min 6 chars)": "newPass",
  "Change Password": "changePass", "Security": "security", "No starred messages": "noStarred",
  "Appearance": "appearance", "Reset to Default": "resetTheme", "Light": "light",
  "Dark": "dark", "Neon": "neon", "No Status": "noStatus", "Delete Status": "deleteStatus",
  "Status Updates": "statusUpdates", "Add": "addStatus", "Mine": "myStatus",
  "Voice Call": "voiceCall", "No calls yet": "noCalls", "Call": "call",
  "Admin Control": "adminControl", "Admin Panel": "adminPanel",
  "Preferences": "preferences", "Account & Privacy": "accountPrivacy",
  "Starred Messages": "starredMsgs", "Account": "account",
  "Phone Number": "phoneNumber", "Sync Phonebook": "syncPhonebook",
  "Language": "language", "Data Saver": "dataSaver", "Error": "error", "Retry": "retry",
  "Themes and Chat Bubbles": "themesAndBubbles",
  "Quick access to saved messages": "quickAccess",
  "Change password, Delete account": "changePassDesc",
  "Find friends already on Mofie": "findFriends",
  "Send a global broadcast": "sendBroadcastDesc",
  "Not linked": "notLinked",
  "Chat": "chat",
  "Select Chat": "selectChat",
  "24 Hours": "timer24"
};

function translateNode(node) {
  if (node.nodeType === 3) {
    const raw = node.nodeValue;
    if (!raw) return;
    const trimmed = raw.trim();
    if (!trimmed) return;
    const key = EN_TO_KEY[trimmed];
    if (key) {
      const translated = t(key);
      if (translated && translated !== key && translated !== trimmed) {
        node.nodeValue = raw.replace(trimmed, translated);
      }
    }
  } else if (node.nodeType === 1) {
    ["placeholder", "aria-label", "title"].forEach(attr => {
      const val = node.getAttribute(attr);
      if (!val) return;
      const key = EN_TO_KEY[val.trim()];
      if (key) {
        const tr = t(key);
        if (tr && tr !== key && tr !== val) node.setAttribute(attr, tr);
      }
    });
    for (let i = 0; i < node.childNodes.length; i++) {
      translateNode(node.childNodes[i]);
    }
  }
}

if (getLanguage() !== "en") {
  const translatorObserver = new MutationObserver(muts => {
    for (const m of muts) {
      m.addedNodes.forEach(node => {
        if (node.nodeName === "INPUT" || node.nodeName === "TEXTAREA") return;
        translateNode(node);
      });
    }
  });

  translatorObserver.observe(document.body, { childList: true, subtree: true });
  translateNode(document.body);
  
  let checks = 0;
  const interval = setInterval(() => {
    translateNode(document.body);
    checks++;
    if (checks > 10) clearInterval(interval);
  }, 200);
}