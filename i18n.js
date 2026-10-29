// ══════════════════════════════════════════════════════════════════════════
//  MOFIE i18n — English, Spanish, Swahili
// ══════════════════════════════════════════════════════════════════════════
const TRANSLATIONS = {
  en: {
    chats: "Chats", calls: "Calls", profile: "Profile", newChat: "New Chat",
    search: "Search name or @username...", groups: "Groups", unread: "Unread",
    contacts: "Contacts", send: "Send", message: "Message", online: "online",
    offline: "offline", typing: "typing…", reply: "Reply", cancel: "Cancel",
    save: "Save", delete: "Delete", edit: "Edit", close: "Close", back: "Back",
    today: "Today", yesterday: "Yesterday", uploading: "Uploading…",
    recording: "Recording…", noChats: "No chats yet",
    noChatsBody: "Tap New Chat to find people.", startChat: "Start a Conversation",
    createGroup: "Create a New Group", findPhonebook: "Find from Phonebook",
    searchUsername: "Search by Username", appearance: "Appearance",
    starredMsgs: "Starred Messages", account: "Account", phoneNumber: "Phone Number",
    syncPhonebook: "Sync Phonebook", logout: "Log Out", deleteAccount: "Delete Account",
    callLog: "Calls", noCalls: "No calls yet", missed: "Missed", declined: "Declined",
    busy: "Busy", incoming: "Incoming", outgoing: "Outgoing", connected: "Connected",
    calling: "Calling…", ringing: "Ringing…", decline: "Decline", accept: "Accept",
    end: "End", mute: "Mute", unmute: "Unmute", speaker: "Speaker", earpiece: "Earpiece",
    statusUpdates: "Status Updates", addStatus: "Add", myStatus: "Mine",
    repliedToStatus: "Replied to status", replyPrivately: "Reply privately…",
    language: "Language", dataSaver: "Data Saver", on: "On", off: "Off",
    theme: "Theme", light: "Light", dark: "Dark", neon: "Neon",
    resetTheme: "Reset to Default", appAccent: "App Accent Color",
    bubbleColor: "Chat Bubble Color", adminPanel: "Admin Panel",
    broadcast: "Send Broadcast", syncing: "Syncing…", error: "Error", retry: "Retry",
    networkError: "Network error — check your connection",
    fileTooLarge: "File too large", loading: "Loading…",
    react: "React", forward: "Forward", copy: "Copy", star: "Star", unstar: "Unstar",
    deleteForMe: "Delete for me", deleteForAll: "Delete for everyone",
    themesAndBubbles: "Themes and Chat Bubbles", quickAccess: "Quick access to saved messages",
    changePassDesc: "Change password, Delete account", findFriends: "Find friends already on Mofie",
    sendBroadcastDesc: "Send a global broadcast", notLinked: "Not linked", preferences: "PREFERENCES",
    accountPrivacy: "ACCOUNT & PRIVACY", chat: "Chat", selectChat: "Select Chat", timer24: "24 Hours",
    autoDelete: "🔒 Messages auto-delete in 24 hours."
  },
  es: {
    chats: "Chats", calls: "Llamadas", profile: "Perfil", newChat: "Nuevo Chat",
    search: "Buscar nombre o @usuario...", groups: "Grupos", unread: "No leídos",
    contacts: "Contactos", send: "Enviar", message: "Mensaje", online: "en línea",
    offline: "desconectado", typing: "escribiendo…", reply: "Responder",
    cancel: "Cancelar", save: "Guardar", delete: "Eliminar", edit: "Editar",
    close: "Cerrar", back: "Atrás", today: "Hoy", yesterday: "Ayer",
    uploading: "Subiendo…", recording: "Grabando…", noChats: "Sin chats aún",
    noChatsBody: "Toca Nuevo Chat para buscar personas.", startChat: "Iniciar conversación",
    createGroup: "Crear nuevo grupo", findPhonebook: "Buscar en agenda",
    searchUsername: "Buscar por usuario", appearance: "Apariencia", starredMsgs: "Mensajes destacados",
    account: "Cuenta", phoneNumber: "Número de teléfono", syncPhonebook: "Sincronizar agenda",
    logout: "Cerrar sesión", deleteAccount: "Eliminar cuenta", callLog: "Llamadas",
    noCalls: "Sin llamadas aún", missed: "Perdida", declined: "Rechazada",
    busy: "Ocupado", incoming: "Entrante", outgoing: "Saliente", connected: "Conectado",
    calling: "Llamando…", ringing: "Sonando…", decline: "Rechazar", accept: "Aceptar",
    end: "Colgar", mute: "Silenciar", unmute: "Activar", speaker: "Altavoz",
    earpiece: "Auricular", statusUpdates: "Estados", addStatus: "Añadir", myStatus: "Mío",
    repliedToStatus: "Respondió al estado", replyPrivately: "Responder en privado…",
    language: "Idioma", dataSaver: "Ahorro de datos", on: "Activado", off: "Desactivado",
    theme: "Tema", light: "Claro", dark: "Oscuro", neon: "Neón", resetTheme: "Restablecer",
    appAccent: "Color de acento", bubbleColor: "Color de burbuja", adminPanel: "Panel Admin",
    broadcast: "Enviar difusión", syncing: "Sincronizando…", error: "Error",
    retry: "Reintentar", networkError: "Error de red — revisa tu conexión",
    fileTooLarge: "Archivo muy grande", loading: "Cargando…", react: "Reaccionar",
    forward: "Reenviar", copy: "Copiar", star: "Destacar", unstar: "Quitar",
    deleteForMe: "Eliminar para mí", deleteForAll: "Eliminar para todos",
    themesAndBubbles: "Temas y burbujas", quickAccess: "Acceso rápido a guardados",
    changePassDesc: "Cambiar contraseña, Eliminar cuenta", findFriends: "Buscar amigos en Mofie",
    sendBroadcastDesc: "Enviar difusión global", notLinked: "No vinculado", preferences: "PREFERENCIAS",
    accountPrivacy: "CUENTA Y PRIVACIDAD", chat: "Chat", selectChat: "Seleccionar chat", timer24: "24 Horas",
    autoDelete: "🔒 Los mensajes se eliminan en 24 horas."
  },
  sw: {
    chats: "Gumzo", calls: "Simu", profile: "Wasifu", newChat: "Gumzo Mpya",
    search: "Tafuta jina au @jina la mtumiaji...", groups: "Vikundi", unread: "Haijasomwa",
    contacts: "Anwani", send: "Tuma", message: "Ujumbe", online: "yupo mtandaoni",
    offline: "hayupo mtandaoni", typing: "anaandika…", reply: "Jibu", cancel: "Ghairi",
    save: "Hifadhi", delete: "Futa", edit: "Hariri", close: "Funga", back: "Rudi",
    today: "Leo", yesterday: "Jana", uploading: "Inapakia…", recording: "Inarekodi…",
    noChats: "Hakuna gumzo bado", noChatsBody: "Gusa Gumzo Mpya kupata watu.",
    startChat: "Anzisha mazungumzo", createGroup: "Unda kikundi kipya",
    findPhonebook: "Tafuta kwenye anwani", searchUsername: "Tafuta kwa jina la mtumiaji",
    appearance: "Muonekano", starredMsgs: "Ujumbe uliowekwa nyota", account: "Akaunti",
    phoneNumber: "Namba ya simu", syncPhonebook: "Sawazisha anwani", logout: "Toka",
    deleteAccount: "Futa akaunti", callLog: "Simu", noCalls: "Hakuna simu bado",
    missed: "Iliyokosa", declined: "Iliyokataliwa", busy: "Nina shughuli",
    incoming: "Inayoingia", outgoing: "Inayotoka", connected: "Imeunganishwa",
    calling: "Inapiga…", ringing: "Inaita…", decline: "Kataa", accept: "Kubali",
    end: "Maliza", mute: "Nyamazisha", unmute: "Sikiliza", speaker: "Spika",
    earpiece: "Kipokea sauti", statusUpdates: "Hali", addStatus: "Ongeza", myStatus: "Yangu",
    repliedToStatus: "Amejibu hali", replyPrivately: "Jibu kwa faragha…", language: "Lugha",
    dataSaver: "Hifadhi data", on: "Imewashwa", off: "Imezimwa", theme: "Mandhari",
    light: "Nyepesi", dark: "Nyeusi", neon: "Neon", resetTheme: "Weka upya",
    appAccent: "Rangi ya programu", bubbleColor: "Rangi ya kiputo", adminPanel: "Paneli ya Msimamizi",
    broadcast: "Tuma tangazo", syncing: "Inasawazisha…", error: "Hitilafu", retry: "Jaribu tena",
    networkError: "Hitilafu ya mtandao — angalia muunganisho wako", fileTooLarge: "Faili ni kubwa sana",
    loading: "Inapakia…", react: "Jibu", forward: "Tuma mbele", copy: "Nakili", star: "Weka nyota",
    unstar: "Ondoa nyota", deleteForMe: "Futa kwangu", deleteForAll: "Futa kwa wote",
    themesAndBubbles: "Mandhari na Viputo vya Gumzo", quickAccess: "Ufikiaji wa haraka wa ujumbe",
    changePassDesc: "Badilisha nenosiri, Futa akaunti", findFriends: "Pata marafiki waliopo Mofie",
    sendBroadcastDesc: "Tuma tangazo kwa wote", notLinked: "Haijaunganishwa", preferences: "MAPENDELEO",
    accountPrivacy: "AKAUNTI NA FARAGHA", chat: "Gumzo", selectChat: "Chagua Gumzo", timer24: "Saa 24",
    autoDelete: "🔒 Ujumbe hufutwa baada ya saa 24."
  }
};

const LANGUAGE_NAMES = {
  en: "English",
  es: "Español",
  sw: "Kiswahili"
};

let currentLang = "en";

export function initI18n() {
  const saved = localStorage.getItem("mofie-lang");
  const browser = (navigator.language || "en").split("-")[0].toLowerCase();
  currentLang = saved || (TRANSLATIONS[browser] ? browser : "en");
  applyLang();
}

export function setLanguage(lang) {
  if (!TRANSLATIONS[lang]) return;
  currentLang = lang;
  localStorage.setItem("mofie-lang", lang);
  applyLang();
  window.dispatchEvent(new CustomEvent("mofie:langchange", { detail: { lang } }));
}

export function getLanguage() { return currentLang; }
export function getLanguages() { return LANGUAGE_NAMES; }
export function isRTL() { return false; } // RTL removed

export function t(key, fallback = "") {
  return TRANSLATIONS[currentLang]?.[key]
      ?? TRANSLATIONS.en[key]
      ?? fallback
      ?? key;
}

function applyLang() {
  document.documentElement.lang = currentLang;
  document.documentElement.dir = "ltr"; // Always LTR
}