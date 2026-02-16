/* =========================================================
   USP APP - Auth (standalone) v04
   - Extracted from original app.js
   - Keeps legacy global functions (seedUsersIfMissing, login, etc.)
   - Also exposes optional namespace: window.USP.Auth
   ========================================================= */
"use strict";
  // -------------------------------
  // AUTH (localStorage)
  // -------------------------------
  const AUTH_USERS_KEY = "up_auth_users_v1";
  const AUTH_SESSION_KEY = "up_auth_session_v1";

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  function truncateText(str, maxLen = 26) {
    const full = (str ?? "").toString();
    if (full.length <= maxLen) return { short: full, full, truncated: false };
    return { short: full.slice(0, Math.max(0, maxLen - 1)) + "…", full, truncated: true };
  }

  function loadJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function seedUsersIfMissing() {
    const users = loadJson(AUTH_USERS_KEY);
    if (Array.isArray(users) && users.length) {
      const dick = users.find((u) => (u.username || "").toLowerCase() === "dick");
      if (dick && (!dick.initials || dick.initials !== "DE")) {
        dick.initials = "DE";
        saveJson(AUTH_USERS_KEY, users);
      }
      return users;
    }

    const seeded = [
      { id: uid("u"), username: "Dick", password: "admin", initials: "DE", role: "admin", createdAt: Date.now() },
    ];
    saveJson(AUTH_USERS_KEY, seeded);
    return seeded;
  }

  function getUsers() { return seedUsersIfMissing(); }
  function setUsers(users) { saveJson(AUTH_USERS_KEY, users); }
  function getSession() { return loadJson(AUTH_SESSION_KEY); }
  function setSession(sess) { saveJson(AUTH_SESSION_KEY, sess); }
  function clearSession() { localStorage.removeItem(AUTH_SESSION_KEY); }

  function findUser(username) {
    const users = getUsers();
    return users.find((u) => (u.username || "").toLowerCase() === (username || "").toLowerCase()) || null;
  }

  function login(username, password) {
    const u = findUser(username);
    if (!u) return { ok: false, message: "Fel användarnamn eller lösenord." };
    if ((u.password || "") !== (password || "")) return { ok: false, message: "Fel användarnamn eller lösenord." };
    setSession({ userId: u.id, username: u.username, role: u.role, loggedInAt: Date.now() });
    return { ok: true, user: u };
  }

  function currentUser() {
    const sess = getSession();
    if (!sess?.userId) return null;
    const u = getUsers().find((x) => x.id === sess.userId);
    return u ? { ...u } : null;
  }

  // -------------------------------

// Optional namespace (doesn't change existing behavior)
window.USP = window.USP || {};
window.USP.Auth = window.USP.Auth || {};
if (typeof seedUsersIfMissing === "function") window.USP.Auth.seedUsersIfMissing = seedUsersIfMissing;
if (typeof getUsers === "function") window.USP.Auth.getUsers = getUsers;
if (typeof currentUser === "function") window.USP.Auth.currentUser = currentUser;
if (typeof login === "function") window.USP.Auth.login = login;
