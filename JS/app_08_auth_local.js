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


  // Upsert user in auth directory (creates if missing).
  // Matches by username (case-insensitive) and optionally email.
  function upsertUser(user) {
    const u = user || {};
    const username = String(u.username || u.name || "").trim();
    const email = String(u.email || "").trim();
    if (!username && !email) return { ok:false, message:"Missing username/email" };

    const users = getUsers() || [];
    let target = null;

    for (let i=0;i<users.length;i++){
      const au = users[i] || {};
      const un = String(au.username || "").trim();
      if (username && un && un.toLowerCase() === username.toLowerCase()) { target = au; break; }
      const em = String(au.email || "").trim();
      if (email && em && em.toLowerCase() === email.toLowerCase()) { target = au; break; }
    }

    if (!target) {
      target = { id: uid("u"), username: username || (email ? email.split("@")[0] : "User"), name: username || (email ? email.split("@")[0] : "User"), password: "", initials:"", role:"user", createdAt: Date.now() };
      if (email) target.email = email;
      users.push(target);
    } else {
      if (email && !target.email) target.email = email;
      // Keep username in sync if directory renamed user
      if (username && String(target.username||"").trim().toLowerCase() !== username.toLowerCase()) {
        target.username = username;
        // Keep legacy name in sync too
        target.name = username;
      }
    }

    if ("password" in u) target.password = String(u.password || "");
    if (u.initials != null) target.initials = String(u.initials || "").trim();
    if (u.role != null) target.role = String(u.role || "").trim() || target.role;

    setUsers(users);
    return { ok:true, user: target };
  }
  function getSession() { return loadJson(AUTH_SESSION_KEY); }
  function setSession(sess) { saveJson(AUTH_SESSION_KEY, sess); }
  function clearSession() { localStorage.removeItem(AUTH_SESSION_KEY); }

  function logout(){ clearSession(); return { ok:true }; }


  function findUser(identifier) {
    const id = String(identifier || "").trim();
    const idLow = id.toLowerCase();
    const users = getUsers() || [];
    if (!idLow) return null;

    // Match by username OR name (legacy) OR email
    let hit = users.find((u) => {
      const un = String((u && (u.username || u.name)) || "").trim().toLowerCase();
      if (un && un === idLow) return true;

      const em = String((u && u.email) || "").trim().toLowerCase();
      if (em && em === idLow) return true;

      // Allow login with local-part of email
      if (em && em.includes("@")) {
        const lp = em.split("@")[0];
        if (lp && lp === idLow) return true;
      }
      return false;
    }) || null;

    return hit;
  }

  
  // Fallback: if auth store is out of sync, try directory users in App state (settings/users)
  function findDirectoryUser(identifier){
    try{
      const id = String(identifier || "").trim();
      const idLow = id.toLowerCase();
      if (!idLow) return null;

      const App = (window.USP && window.USP.App) ? window.USP.App : (window.App || null);
      const st = (App && typeof App.getState === "function") ? (App.getState() || {}) : {};
      const dir = (st && st.settings && Array.isArray(st.settings.users)) ? st.settings.users
                : (st && Array.isArray(st.users) ? st.users : []);
      if (!Array.isArray(dir)) return null;

      return dir.find(u => {
        if (!u) return false;
        const un = String(u.username || u.name || "").trim().toLowerCase();
        if (un && un === idLow) return true;

        const em = String(u.email || "").trim().toLowerCase();
        if (em && em === idLow) return true;

        if (em && em.includes("@")) {
          const lp = em.split("@")[0];
          if (lp && lp === idLow) return true;
        }
        return false;
      }) || null;
    }catch(e){
      return null;
    }
  }

function login(username, password) {
    const pw = String(password || "");
    // 1) Try auth store first
    let u = findUser(username);
    if (u && String(u.password || "") === pw) {
      setSession({ userId: u.id, username: u.username, role: u.role, loggedInAt: Date.now() });
      return { ok: true, user: u };
    }

    // 2) Fallback: try directory user in App state (Manage users)
    const du = findDirectoryUser(username);
    if (du) {
      const duPw = String(du.password || "");
      if (duPw && duPw === pw) {
        // Ensure auth store is synced so future logins work
        try {
          upsertUser({
            username: du.username || du.name || "",
            name: du.name || du.username || "",
            email: du.email || "",
            password: du.password || "",
            initials: du.initials || "",
            role: du.role || "user"
          });
        } catch(e) {}

        // Re-read from auth store to get stored id, then log in
        u = findUser(du.username || du.name || du.email);
        if (!u) u = findUser(username);

        const userOut = u || Object.assign({}, du);
        setSession({ userId: userOut.id || (u && u.id) || uid("u"), username: userOut.username || userOut.name || String(username||""), role: userOut.role || du.role || "user", loggedInAt: Date.now() });
        return { ok: true, user: userOut };
      }
    }

    // 3) If we found auth user but password mismatch, show same generic error
    return { ok: false, message: "Fel användarnamn eller lösenord." };
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
if (typeof setUsers === "function") window.USP.Auth.setUsers = setUsers;
if (typeof upsertUser === "function") window.USP.Auth.upsertUser = upsertUser;
if (typeof currentUser === "function") window.USP.Auth.currentUser = currentUser;
if (typeof login === "function") window.USP.Auth.login = login;
if (typeof logout === "function") window.USP.Auth.logout = logout;

// Legacy global alias (some builds call window.logout())
try{ if (typeof logout === "function" && typeof window.logout !== "function") window.logout = logout; }catch(e){}
