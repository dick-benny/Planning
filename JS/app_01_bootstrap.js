/* app_01_bootstrap_71.js
   USP restart architecture (role-first, tab-first)
   - No import/export
   - Single source of truth: state.ui.tab + App.role(state)
   - Each tab has {adminView, userView}
*/
(function () {
  "use strict";

  // ---------------------------
  // Namespace
  // ---------------------------
  window.USP = window.USP || {};
  const USP = window.USP;

  // ---------------------------
  // App core
  // ---------------------------
  const App = (USP.App = USP.App || {});
  USP.Env = USP.Env || {};
  App.VERSION = 76;

  // Storage keys
  const LS_STATE = "usp_state_latest_v2";
  const LS_USER = "usp_user_v1";

  function getDataMode(){
    try { return (App.Config && App.Config.getDataMode) ? App.Config.getDataMode() : "local"; } catch(e){ return "local"; }
  }

  // ---------------------------
  // Utilities
  // ---------------------------
  function nowIso() { return new Date().toISOString(); }
  function uid(prefix) { return (prefix || "id") + "_" + Date.now() + "_" + Math.random().toString(16).slice(2); }

  // ---------------------------
  // Schema helpers (name is key; no field.key)
  // ---------------------------
  function normStr(s) { return String(s || "").trim(); }

  function normalizeSchema(schema) {
    // Prefer centralized schema normalization (App.Schema) when available.
    try{
      if (USP && USP.App && USP.App.Schema && typeof USP.App.Schema.normalizeSchema === "function") {
        return USP.App.Schema.normalizeSchema(schema);
      }
    }catch(e){}
    const s = deepClone(schema || { fields: [] });
    s.fields = Array.isArray(s.fields) ? s.fields : [];
    s.fields = s.fields.map((f, idx) => {
      const o = Object.assign({}, f || {});
      if (!o.name && o.key) o.name = o.key;
      delete o.key;
      o.name = normStr(o.name) || ("Fält " + (idx + 1));
      const tRaw = normStr(o.type) || "text";
      o.type = tRaw.includes("+") ? tRaw.split("+")[0] : tRaw;
      o.order = Number.isFinite(o.order) ? o.order : idx;
      if (!o.id) o.id = "f_" + Date.now() + "_" + idx;
      // Normalize mods/addons in bootstrap too (fallback)
      o.mods = (USP && USP.App && USP.App.Schema && typeof USP.App.Schema.normalizeFieldMods === "function")
        ? USP.App.Schema.normalizeFieldMods(o)
        : (o.mods || {});
      return o;
    }).sort((a,b) => (a.order ?? 0) - (b.order ?? 0));
    s.fields.forEach((f,i)=>{ f.order = i; });
    return s;
  }



  function migrateFieldTypeToMods(fields) {
    (fields || []).forEach((f) => {
      if (!f) return;
      const t = String(f.type || "").trim();
      if (!t) { f.type = "text"; return; }
      if (f.mods && typeof f.mods === "object") return;

      // old combined strings -> base + mods
      const map = {
        "text_notes": { base:"text", mods:{ notes:true } },
        "status_notes": { base:"status", mods:{ notes:true } },
        "date_notes": { base:"date", mods:{ notes:true } },
        "week_notes": { base:"week", mods:{ notes:true } },
        "produktkategori_notes": { base:"produktkategori", mods:{ notes:true } },
        // plus-sign forms (if any were stored)
        "text+notes": { base:"text", mods:{ notes:true } },
        "status+notes": { base:"status", mods:{ notes:true } },
        "date+notes": { base:"date", mods:{ notes:true } },
        "week+notes": { base:"week", mods:{ notes:true } },
        "produktkategori+notes": { base:"produktkategori", mods:{ notes:true } },
      };

      const key = t.toLowerCase().replace(/\s+/g, "");
      if (map[key]) {
        f.type = map[key].base;
        f.mods = map[key].mods;
        // regenerate id to avoid rename-lock weirdness if we had to touch schema
        try { f.id = uid("f"); } catch (e) {}
        return;
      }

      // plain base types stay
      f.type = key;
      f.mods = f.mods || {};
    });
    return fields;
  }

  function dedupeFieldNames(fields) {
    const used = Object.create(null);
    (fields || []).forEach((f) => {
      if (!f) return;
      const base = String(f.name || "").trim() || "Fält";
      let name = base;
      let k = name.toLowerCase();
      if (!used[k]) { used[k] = 1; f.name = name; return; }
      // If duplicate, append " 2", " 3", ...
      let n = used[k] + 1;
      while (true) {
        const cand = base + " " + n;
        const ck = cand.toLowerCase();
        if (!used[ck]) {
          f.name = cand;
          // If we had to rename due to duplicate, regenerate id so rename-lock does not fire
          try { f.id = uid("f"); } catch (e) { f.id = "f_" + Date.now() + "_" + Math.random().toString(16).slice(2); }
          used[ck] = 1;
          used[k] = n; // advance counter for base
          break;
        }
        n += 1;
      }
    });
    return fields;
  }

  function validateSchema(schema) {
    const s = normalizeSchema(schema);
    const seen = Object.create(null);
    const errs = [];
    s.fields.forEach((f) => {
      const k = normStr(f.name);
      if (!k) errs.push("Tomt fältnamn.");
      const low = k.toLowerCase();
      if (seen[low]) errs.push("Dubbelt fältnamn: " + k);
      seen[low] = true;
    });
    return { ok: errs.length === 0, errors: errs, schema: s };
  }

  function safeJsonParse(raw, fallback) {
    try { return raw ? JSON.parse(raw) : fallback; } catch (e) { return fallback; }
  }

  function deepClone(obj) {
    try { return JSON.parse(JSON.stringify(obj)); } catch (e) { return obj; }
  }

  function mergeShallowKeepDefined(base, next) {
    const out = Object.assign({}, base || {});
    Object.keys(next || {}).forEach((k) => {
      const v = next[k];
      if (v !== undefined) out[k] = v;
    });
    return out;
  }

  // ---------------------------
  // Tabs (single canonical keys)
  // ---------------------------
  App.Tabs = {
    DEV: "dev",
    PRODUCT: "product",
    TODO: "todo",
    ROUTINES: "routines",
    SETTINGS: "settings",
    STATISTICS: "statistics",
  };

  // ---------------------------
  // Default State
  // ---------------------------
  function defaultSchemas() {
    // "definitions" only; no owner column
    return {
      dev: { fields: [{ id: uid("f"), name: "Titel", type: "text", order: 0 }] },
      product: { fields: [{ id: uid("f"), name: "Produkt", type: "text", order: 0 }] },
      todo: { fields: [{ id: uid("f"), name: "Att göra", type: "text", order: 0 }] },
      routines: { fields: [{ id: uid("f"), name: "Rutin", type: "text", order: 0 }] },
      statistics: { fields: [{ id: uid("f"), name: "Statistic", type: "text", order: 0 }] },
    };
  }

  function defaultData() {
    return {
      dev: [],
      product: [],
      todo: [],
      routines: [],
      statistics: [],
    };
  }

  function defaultSettings() {
    return {
      // Hard-coded admin
      adminEmails: ["d.eriksson@cappelendimyr.com"],
      adminIds: [],
      adminNames: ["dick eriksson", "dick"],

      // Optional deterministic override (debug/local): "admin" | "user" | ""
      forceRole: "",

      // If true: reuse stored auth session and skip login screen on startup.
      // Default false: always show login screen on startup.
      autoLogin: false,


      // Local user directory (for Change user / Manage users)
      users: [
        { id: "u_dick", username:"dick", name: "Dick Eriksson", initials:"DE", email: "d.eriksson@cappelendimyr.com", role:"admin" },
        { id: "u_benny", username:"benny", name: "Benny", initials:"B", email: "benny@example.com", role:"user" }
      ]
    };
  }

  function defaultUi() {
    return {
      tab: App.Tabs.TODO,
    };
  }

  function defaultState() {
    return {
      _v: App.VERSION,
      updatedAt: nowIso(),
      session: { authUser: null, actingUserId: "", roleMode: "admin" },
      user: null,
      ui: defaultUi(),
      schemas: defaultSchemas(),
      data: defaultData(),
      settings: defaultSettings(),
      messages: [],
      messageThreads: [],
    };
  }

  // ---------------------------
  // User (local auth stub)
  // ---------------------------
  function loadOrCreateLocalUser(state) {
    // Pick from user directory (settings.users) + localStorage selection (acting user)
    const st = state || App.getState() || null;
    const dir = (st && st.settings && Array.isArray(st.settings.users)) ? st.settings.users : defaultSettings().users;

    const SEL = "usp_selected_user_id";
    let sel = "";
    if (getDataMode() === "local") {
      try { sel = String(localStorage.getItem(SEL) || ""); } catch (e) { sel = ""; }
    }

    let user = null;
    if (sel) user = dir.find(u => u && String(u.id) === sel) || null;
    if (!user) user = dir.find(u => u && u.email === "d.eriksson@cappelendimyr.com") || dir[0] || null;

    if (!user) user = { id: uid("u"), email: "d.eriksson@cappelendimyr.com", name: "Dick Eriksson", createdAt: nowIso() };

    if (getDataMode() === "local") { try { localStorage.setItem(SEL, String(user.id)); } catch (e) {} }
    return user;
  }

  function loadAdminUser(state) {
    const st = state || App.getState() || null;
    const dir = (st && st.settings && Array.isArray(st.settings.users)) ? st.settings.users : defaultSettings().users;
    return dir.find(u => u && u.email === "d.eriksson@cappelendimyr.com") ||
           dir.find(u => u && String(u.name || "").toLowerCase().includes("dick")) ||
           (dir[0] || null) ||
           { id: "u_admin", name: "Dick Eriksson", email: "d.eriksson@cappelendimyr.com" };
  }



// ---------------------------
// Auth helpers (login/localStorage based)
// ---------------------------
function getAuthApi(){
  try{
    if (window.USP && window.USP.Auth) return window.USP.Auth;
  }catch(e){}
  return null;
}

function getCurrentAuthUser(){
  try{
    var api = getAuthApi();
    if (api && typeof api.currentUser === "function") return api.currentUser();
  }catch(e){}
  try{
    if (typeof currentUser === "function") return currentUser();
  }catch(e2){}
  return null;
}

function ensureUserFromAuth(state, authUser){
  var st = state || defaultState();
  var au = authUser || {};
  var username = String(au.username || au.email || au.name || "User").trim();
  var role = String(au.role || "").trim() || "user";
  var initials = String(au.initials || "").trim();
  if (!initials) {
    try{ initials = (username.split(/\s+/)[0].charAt(0) + username.split(/\s+/).slice(-1)[0].charAt(0)).toUpperCase(); }catch(eI){ initials = ""; }
  }

  st.settings = st.settings || defaultSettings();
  st.settings.users = Array.isArray(st.settings.users) ? st.settings.users : [];
  var existing = null;
  for (var i=0;i<st.settings.users.length;i++){
    var u = st.settings.users[i];
    if (!u) continue;
    if (au.id && String(u.id) === String(au.id)) { existing = u; break; }
    if (au.email && u.email && String(u.email).toLowerCase() === String(au.email).toLowerCase()) { existing = u; break; }
    if (u.username && String(u.username).toLowerCase() === String(username).toLowerCase()) { existing = u; break; }
  }

  if (!existing){
    existing = {
      id: au.id ? String(au.id) : uid("u"),
      username: username,
      name: String(au.name || username),
      initials: initials,
      email: String(au.email || ""),
      role: role
    };
    st.settings.users.push(existing);
  } else {
    // keep fresh
    if (!existing.initials && initials) existing.initials = initials;
    if (role) existing.role = role;
    if (au.email && !existing.email) existing.email = String(au.email);
    if (au.name && !existing.name) existing.name = String(au.name);
  }
  return existing;
}

function startServerHydration(){
  try{
    if (getDataMode() !== "local" && App.DB && typeof App.DB.loadState === "function") {
      console.log("🚀 Starting state hydration from server...");
      App.DB.loadState().then(function (remote) {
        console.log("🔄 Hydrating state from server...", remote);
        if (!remote || typeof remote !== "object") {
          console.warn("⚠️ No remote state or invalid format:", remote);
          _hydrationComplete = true;
          return;
        }
        var cur = App.getState();
        var merged = deepClone(cur);
        if (remote.schemas) merged.schemas = remote.schemas;
        if (remote.data) merged.data = remote.data;
        if (remote.settings) merged.settings = remote.settings;
        merged.updatedAt = remote.updatedAt || merged.updatedAt || nowIso();
        _hydrationComplete = true;
        App.commitState(merged);
        try{ if (USP.UI && typeof USP.UI.render === "function") USP.UI.render(App.getState()); }catch(eR){}
      }).catch(function(err){
        console.error("DB loadState error:", err);
        _hydrationComplete = true;
      });
    }
  }catch(eH){
    _hydrationComplete = true;
  }
}

// Public hook called by UI after successful login
App.setLoggedInUser = function(user){
  try{
    var st = App.getState ? App.getState() : (_state || defaultState());
    st.session = st.session || {};
    st.ui = st.ui || {};
    var acting = ensureUserFromAuth(st, user);
    st.session.authUser = acting;
    st.session.actingUserId = String(acting.id || "");
    st.user = acting;
    delete st.ui.screen; // leave login screen
    st.updatedAt = nowIso();
    App.commitState(st);
    try{ if (USP.UI && typeof USP.UI.render === "function") USP.UI.render(App.getState()); }catch(eR2){}
    // After login: hydrate remote state in server mode
    startServerHydration();
    return true;
  }catch(e){
    return false;
  }
};

// Public: Logout (works for both role=user and role=admin)
// - Clears auth session
// - Switches UI to login overlay
App.logout = function logout(){
  try{
    if (window.USP && window.USP.Auth && typeof window.USP.Auth.logout === "function") {
      window.USP.Auth.logout();
    } else if (typeof logout === "function") {
      // legacy global
      logout();
    }
  }catch(e){}

  try{
    var st = App.getState ? (App.getState() || defaultState()) : (_state || defaultState());
    st.session = st.session || {};
    st.ui = st.ui || {};

    st.session.authUser = null;
    st.session.actingUserId = "";
    // keep tab selection but force login screen
    st.ui.screen = "login";
    st.updatedAt = nowIso();
    App.commitState(st);

    try{ if (USP && USP.UI && typeof USP.UI.render === "function") USP.UI.render(App.getState()); }catch(eR){}
    return true;
  }catch(e2){
    return false;
  }
};

  // ---------------------------
  // Role detection (single source of truth)
  // ---------------------------
  function norm(x) { return String(x || "").toLowerCase().trim(); }

  App.isAdmin = function isAdmin(user, state) {
    try {
      if (!user) return false;
      const st = state || App.getState();
      const force = st && st.settings && st.settings.forceRole ? norm(st.settings.forceRole) : "";
      if (force === "admin") return true;
      if (force === "user") return false;

      // explicit flags if they exist
      if (user.isAdmin === true) return true;
      if (user.role && norm(user.role) === "admin") return true;

      const email = norm(user.email || user.mail || user.username);
      const id = norm(user.id || user.user_id || user.uid || user.sub);
      const name = norm(user.name || user.full_name || user.display_name);

      const settings = (st && st.settings) ? st.settings : defaultSettings();
      const allowEmails = (settings.adminEmails || []).map(norm).filter(Boolean);
      const allowIds = (settings.adminIds || []).map(norm).filter(Boolean);
      const allowNames = (settings.adminNames || []).map(norm).filter(Boolean);

      if (email && allowEmails.includes(email)) return true;
      if (id && allowIds.includes(id)) return true;
      if (name && (allowNames.includes(name) || allowNames.some(n => n && name.includes(n)))) return true;

      return false;
    } catch (e) {
      return false;
    }
  };

  App.isAdminUser = function isAdminUser(user) {
    if (!user) return false;
    const email = String(user.email || "").toLowerCase();
    if (email === "d.eriksson@cappelendimyr.com") return true;
    return false;
  };

  // Role is derived from the currently "logged in" user (authUser).
  // The optional roleMode toggle only matters if the authUser is admin.
  App.role = function role(state) {
    const st = state || _state || defaultState();
    const auth = (st.session && st.session.authUser) ? st.session.authUser : (st.user || null);
    const isAdmin = App.isAdminUser(auth);
    const mode = (st.session && st.session.roleMode) ? String(st.session.roleMode) : "user";
    if (isAdmin && mode === "admin") return "admin";
    return "user";
  };

  // ---------------------------
  // State store
  // ---------------------------
  let _state = null;
  let _hydrationComplete = false;

  App.getState = function getState() { return _state; };

  function persistState(st) {
    const m = getDataMode();
    if (m === "local") {
      try { localStorage.setItem(LS_STATE, JSON.stringify(st)); } catch (e) {}
      return;
    }
    
    // Block saves until hydration completes in server mode
    if (m === "server" && !_hydrationComplete) {
      console.log("⏸️ Blocking save until hydration completes...");
      return;
    }
    
    // Server mode: save to remote
    try {
      if (App.DB && typeof App.DB.saveState === "function") {
        App.DB.saveState(st).catch(function (e) { console.warn("DB.saveState failed", e); });
      }
    } catch (e) { console.warn("persistState server failed", e); }
  }

  function loadState() {
    const m = getDataMode();
    if (m !== "local") {
      // Server mode: start from default; remote hydration happens after UI mount.
      return defaultState();
    }
    const raw = localStorage.getItem(LS_STATE);
    const st = safeJsonParse(raw, null);
    if (!st || typeof st !== "object") return defaultState();

    // Minimal migration
    st._v = App.VERSION;
    st.session = st.session || { authUser: null, actingUserId: "", roleMode: "admin" };
    if (!st.session.roleMode) st.session.roleMode = "admin";
    st.ui = st.ui || defaultUi();
    if (!st.ui.tab) st.ui.tab = App.Tabs.TODO;

    st.schemas = st.schemas || defaultSchemas();
    st.data = st.data || defaultData();
    st.settings = mergeShallowKeepDefined(defaultSettings(), st.settings || {});
    st.updatedAt = st.updatedAt || nowIso();
    return st;
  }

  function ensureStateInvariants(st) {
    st.ui = st.ui || defaultUi();
    st.ui.tab = st.ui.tab || App.Tabs.TODO;

    st.schemas = st.schemas || defaultSchemas();

    // Normalize all schemas (adds canonical `mods` etc.)
    try{
      Object.keys(st.schemas || {}).forEach((k) => {
        st.schemas[k] = normalizeSchema(st.schemas[k]);
      });
    }catch(e){}
    st.schemas.dev = st.schemas.dev || { fields: [] };
    if (!Array.isArray(st.schemas.dev.fields) || st.schemas.dev.fields.length === 0) st.schemas.dev = defaultSchemas().dev;
    st.schemas.product = st.schemas.product || { fields: [] };
    if (!Array.isArray(st.schemas.product.fields) || st.schemas.product.fields.length === 0) st.schemas.product = defaultSchemas().product;
    st.schemas.todo = st.schemas.todo || { fields: [] };
    if (!Array.isArray(st.schemas.todo.fields) || st.schemas.todo.fields.length === 0) st.schemas.todo = defaultSchemas().todo;
    st.schemas.routines = st.schemas.routines || { fields: [] };
    if (!Array.isArray(st.schemas.routines.fields) || st.schemas.routines.fields.length === 0) st.schemas.routines = defaultSchemas().routines;

    st.data = st.data || defaultData();
    st.data.dev = Array.isArray(st.data.dev) ? st.data.dev : [];
    st.data.product = Array.isArray(st.data.product) ? st.data.product : [];
    st.data.todo = Array.isArray(st.data.todo) ? st.data.todo : [];
    st.data.routines = Array.isArray(st.data.routines) ? st.data.routines : [];

    st.settings = mergeShallowKeepDefined(defaultSettings(), st.settings || {});
    st.messages = Array.isArray(st.messages) ? st.messages : [];
    st.messageThreads = Array.isArray(st.messageThreads) ? st.messageThreads : [];

    if (!st.messageThreads.length && st.messages.length) {
      st.messageThreads = st.messages.map(function(m){
        const fromId = String((m && m.fromUserId) || "");
        const toId = String((m && m.toUserId) || "");
        const createdAt = String((m && m.createdAt) || nowIso());
        const participants = [];
        if (fromId) participants.push(fromId);
        if (toId && participants.indexOf(toId) < 0) participants.push(toId);
        const subject = String((m && (m.title || (m.content && m.content.title) || (m.payload && m.payload.title))) || "").trim()
          || String((((m && (m.body || (m.content && m.content.body) || (m.payload && m.payload.body))) || "").trim().split(/\r?\n/)[0]) || "").trim()
          || String(((m && m.context && (m.context.label || m.context.fieldName)) || "Meddelande")).trim()
          || "Meddelande";
        const body = String((m && (m.body || (m.content && m.content.body) || (m.payload && m.payload.body))) || "").trim();
        const unread = String((m && m.status) || "unread") !== "read";
        const unreadBy = {};
        participants.forEach(function(uid){
          unreadBy[uid] = (uid === toId) ? unread : false;
        });
        return {
          id: String((m && m.threadId) || uid("thr")),
          subject: subject,
          context: (m && m.context && typeof m.context === "object") ? deepClone(m.context) : ((m && m.source && typeof m.source === "object") ? deepClone(m.source) : null),
          participants: participants,
          createdBy: fromId,
          createdAt: createdAt,
          updatedAt: createdAt,
          deletedFor: [],
          unreadBy: unreadBy,
          messages: [{
            id: String((m && m.id) || uid("msg")),
            fromUserId: fromId,
            body: body,
            createdAt: createdAt
          }]
        };
      });
    }

    st.updatedAt = nowIso();
    return st;
  }

  App.commitState = function commitState(next) {
    // Preserve user + ui.tab deterministically
    const prev = _state || defaultState();
    const out = ensureStateInvariants(deepClone(next || prev));

    if (!out.session && prev.session) out.session = prev.session;
    if (out.session && prev.session) {
      if (!out.session.authUser && prev.session.authUser) out.session.authUser = prev.session.authUser;
      if (!out.session.actingUserId && prev.session.actingUserId) out.session.actingUserId = prev.session.actingUserId;
      if (!out.session.roleMode && prev.session.roleMode) out.session.roleMode = prev.session.roleMode;
    }
    if (!out.user && prev.user) out.user = prev.user;
    if (!out.ui) out.ui = prev.ui || defaultUi();
    if (!out.ui.tab && prev.ui && prev.ui.tab) out.ui.tab = prev.ui.tab;

    // persist
    _state = out;
    persistState(out);

    // render
    if (USP.UI && typeof USP.UI.render === "function") {
      try { USP.UI.render(out); } catch (e) { console.error(e); }
    }
    return out;
  };

  // ---------------------------
  // Tab helpers
  // ---------------------------
  App.getTab = function getTab(state) {
    const st = state || _state;
    return (st && st.ui && st.ui.tab) ? st.ui.tab : App.Tabs.TODO;
  };

  App.setTab = function setTab(tabKey) {
    const st = deepClone(_state || defaultState());
    st.ui = st.ui || {};
    st.ui.tab = tabKey;
    return App.commitState(st);

  // ---------------------------
  // Role mode (stable across tab switches)
  // ---------------------------
  App.getRoleMode = function getRoleMode(state) {
    const st = state || _state;
    return (st && st.session && st.session.roleMode) ? String(st.session.roleMode) : "admin";
  };

  App.setRoleMode = function setRoleMode(mode) {
    const st = deepClone(_state || defaultState());
    st.session = st.session || { authUser: null, actingUserId: "", roleMode: "admin" };
    st.session.roleMode = (mode === "user") ? "user" : "admin";
    return App.commitState(st);
  };

  App.toggleRoleMode = function toggleRoleMode() {
    const cur = App.getRoleMode();
    return App.setRoleMode(cur === "admin" ? "user" : "admin");
  };

  };

  // ---------------------------
  // Schema helpers
  // ---------------------------
  App.getSchema = function getSchema(tabKey, state) {
    // Fixed tables should follow FixedTables spec, but avoid recursive sync:
    // ensureSchema() itself calls App.getSchema(), so we use a guard.
    const st = state || _state;
    const k = tabKey || App.getTab(st);
    st.schemas = st.schemas || defaultSchemas();

    App.__fixedSchemaSyncing = App.__fixedSchemaSyncing || Object.create(null);

    try {
      if (!App.__fixedSchemaSyncing[k] &&
          typeof App.getFixedTableSpec === "function" &&
          App.getFixedTableSpec(k) &&
          App.FixedTables && typeof App.FixedTables.ensureSchema === "function") {
        App.__fixedSchemaSyncing[k] = true;
        try { App.FixedTables.ensureSchema(k, st); } catch(e) {}
        App.__fixedSchemaSyncing[k] = false;
      }
    } catch(eOuter) {
      try { App.__fixedSchemaSyncing[k] = false; } catch(_) {}
    }

    const latest = (typeof App.getState === "function") ? App.getState() : st;
    latest.schemas = latest.schemas || defaultSchemas();
    return latest.schemas[k] || { fields: [] };
  };

  App.setSchema = function setSchema(tabKey, schema) {
    const st = deepClone(_state || defaultState());
    st.schemas = st.schemas || {};
    const raw = schema || { fields: [] };

    const prev = st.schemas[tabKey] || (_state && _state.schemas ? _state.schemas[tabKey] : null) || { fields: [] };
    const prevById = Object.create(null);
    (Array.isArray(prev.fields) ? prev.fields : []).forEach((f) => { if (f && f.id) prevById[String(f.id)] = f; });

    const res = validateSchema(raw);
    if (!res.ok) throw new Error(res.errors.join(" "));

    // A: Renaming not allowed (name is key). If same id has different name -> reject.
    res.schema.fields.forEach((f) => {
      const old = (f && f.id) ? prevById[String(f.id)] : null;
      if (!old) return;
      const oldName = String(old.name || "").trim();
      const newName = String(f.name || "").trim();
      if (oldName && newName && oldName !== newName) {
        throw new Error("Ändring av fältnamn är inte tillåten. Ta bort och skapa nytt fält.");
      }
    });

    
    // Avoid infinite render loops: if schema did not change, don't commit.
    try{
      const prevSchema = prev || { fields: [] };
      const a = JSON.stringify(prevSchema);
      const b = JSON.stringify(res.schema);
      if (a === b) return _state;
    }catch(e){}
st.schemas[tabKey] = res.schema;
    return App.commitState(st);
  };

  // ---------------------------
  // Data helpers
  // ---------------------------
  App.listRows = function listRows(tabKey, state) {
    const st = state || _state;
    const k = tabKey || App.getTab(st);
    st.data = st.data || defaultData();
    return Array.isArray(st.data[k]) ? st.data[k] : [];
  };

  // ---------------------------
  // ToDo visibility filters (non-destructive)
  // - Enforce "Privat" visibility: only creator/owner can see private ToDo rows
  // - Support "Mina ToDo" via state.session.todoOnlyMine (filters to creator/owner)
  // This is implemented here (data helper) so it applies consistently regardless of UI renderer.
  // Toggle debug with: localStorage.USP_DEBUG_TODO=1
  // ---------------------------
  (function () {
    const _origListRows = App.listRows;
    function _normStr(v) { return (v == null) ? "" : String(v); }
    function _lower(v) { return _normStr(v).toLowerCase(); }

    function _getMe(st) {
      // Prefer explicit current user id getter if present
      const meId = (typeof App.getCurrentUserId === "function") ? App.getCurrentUserId(st) : (st && st.session && st.session.userId);
      const me = (typeof App.getActingUser === "function") ? App.getActingUser(st) : (typeof App.getAuthUser === "function" ? App.getAuthUser(st) : null);
      const meInitials = (me && (me.initials || me.Initials)) || (st && st.session && st.session.initials) || "";
      const meEmail = (me && (me.email || me.Email)) || (st && st.session && st.session.email) || "";
      return { meId, meInitials: _normStr(meInitials), meEmail: _normStr(meEmail) };
    }

    function _rowOwnerSignals(row) {
      const meta = (row && row.meta) ? row.meta : {};
      const fields = (row && row.fields) ? row.fields : {};
      return {
        owner: _normStr(meta.owner || meta.Owner),
        createdById: _normStr(meta.createdById || meta.created_by_id || meta.createdBy || meta.created_by),
        createdByEmail: _normStr(meta.createdByEmail || meta.created_by_email),
        createdByInitials: _normStr(meta.createdByInitials || meta.created_by_initials),
        descInitials: _normStr(fields["Beskrivning__initials"] || fields["beskrivning__initials"] || fields["Description__initials"])
      };
    }

    function _isMineRow(row, me) {
      const s = _rowOwnerSignals(row);
      if (me.meId && (s.createdById === me.meId || s.owner === me.meId)) return true;
      if (me.meEmail && s.createdByEmail && _lower(s.createdByEmail) === _lower(me.meEmail)) return true;
      if (me.meInitials) {
        if (s.createdByInitials && _lower(s.createdByInitials) === _lower(me.meInitials)) return true;
        // last resort: description initials (legacy / editor-generated)
        if (s.descInitials && _lower(s.descInitials) === _lower(me.meInitials)) return true;
      }
      return false;
    }

    function _isPrivateTodo(row) {
      const fields = (row && row.fields) ? row.fields : {};
      const cat = fields.Kategori ?? fields.kategori ?? fields.Category ?? fields.category ?? "";
      return _lower(cat) === "privat";
    }

    function _dbgEnabled() {
      try { return String(localStorage.getItem("USP_DEBUG_TODO") || "0") === "1"; } catch (e) { return false; }
    }

    App.listRows = function listRowsFiltered(tabKey, state) {
      const st = state || _state;
      const k = tabKey || App.getTab(st);
      const rows = _origListRows(k, st);

      // Only apply for ToDo tab/table
      if (_lower(k) !== "todo") return rows;

      const me = _getMe(st);
      const onlyMine = !!(st && st.session && st.session.todoOnlyMine);

      let out = rows;

      // Always enforce private visibility
      out = out.filter(r => !_isPrivateTodo(r) || _isMineRow(r, me));

      // Apply "Mina ToDo" when enabled
      if (onlyMine) out = out.filter(r => _isMineRow(r, me));

      if (_dbgEnabled()) {
        try {
          console.log("[App.listRows][TODO] filtered", { before: rows.length, after: out.length, onlyMine, meId: me.meId, meInitials: me.meInitials });
        } catch (e) {}
      }
      return out;
    };
  })();

  App.upsertRow = function upsertRow(tabKey, row) {
    const st = deepClone(_state || defaultState());
    const k = tabKey;
    st.data = st.data || {};
    st.data[k] = Array.isArray(st.data[k]) ? st.data[k] : [];
    const list = st.data[k];
    const id = row && row.id ? row.id : uid("row");
    const idx = list.findIndex(r => r && r.id === id);
    const nextRow = Object.assign({}, row, { id, updatedAt: nowIso() });
    if (idx >= 0) list[idx] = nextRow; else list.unshift(nextRow);
    return App.commitState(st);
  };

  App.archiveRow = function archiveRow(tabKey, rowId) {
    const st = deepClone(_state || defaultState());
    const list = (st.data && Array.isArray(st.data[tabKey])) ? st.data[tabKey] : [];
    const idx = list.findIndex(r => r && r.id === rowId);
    if (idx >= 0) {
      list[idx].archived = true;
      list[idx].updatedAt = nowIso();
    }
    st.data[tabKey] = list;
    return App.commitState(st);
  };

  App.unarchiveRow = function unarchiveRow(tabKey, rowId) {
    const st = deepClone(_state || defaultState());
    const list = (st.data && Array.isArray(st.data[tabKey])) ? st.data[tabKey] : [];
    const idx = list.findIndex(r => r && r.id === rowId);
    if (idx >= 0) {
      list[idx].archived = false;
      list[idx].updatedAt = nowIso();
    }
    st.data[tabKey] = list;
    return App.commitState(st);
  };



  // ---------------------------
  // Auth user vs Acting user (impersonation)
  // - authUser controls role (admin/user)
  // - acting user controls "who we are working as" in UI/data
  // ---------------------------
  App.getAuthUser = function getAuthUser(state) {
    const st = state || _state;
    return (st && st.session && st.session.authUser) ? st.session.authUser : null;
  };

  App.getActingUser = function getActingUser(state) {
    // Prefer Auth.currentUser() if auth module is present
    try {
      if (window.USP && window.USP.Auth && typeof window.USP.Auth.currentUser === "function") {
        const u = window.USP.Auth.currentUser();
        if (u) return u;
      }
    } catch (e) {}
    const st = state || _state;
    if (st && st.user) return st.user;
    // fallback: actingUserId in session
    const id = (st && st.session) ? String(st.session.actingUserId || "") : "";
    const dir = (st && st.settings && Array.isArray(st.settings.users)) ? st.settings.users : [];
    return dir.find(x => x && String(x.id) === id) || null;
  };

  // ---------------------------
  // User directory (Change user / Manage users)
  // ---------------------------
  
  // Toggle between two hardcoded users (Dick <-> Benny)
  App.toggleUser = function toggleUser() {
    const st = deepClone(_state || defaultState());
    st.session = st.session || { authUser: null, actingUserId: "", roleMode: "admin" };

    const users = (st.settings && Array.isArray(st.settings.users)) ? st.settings.users : [];
    const dick = users.find(u => u && String(u.email || "").toLowerCase() === "d.eriksson@cappelendimyr.com")
              || users.find(u => u && String(u.name || "").toLowerCase().includes("dick"));
    const benny = users.find(u => u && String(u.name || "").toLowerCase() === "benny")
               || users.find(u => u && String(u.email || "").toLowerCase().includes("benny"));

    if (!dick) throw new Error("Dick user not found (needs d.eriksson@cappelendimyr.com).");
    if (!benny) throw new Error("Benny user not found (create user named 'Benny').");

    const curId = String(st.session.actingUserId || st.user?.id || dick.id || "");
    const next = (curId === String(benny.id)) ? dick : benny;

    st.session.actingUserId = String(next.id);
    st.user = next;

    
    st.session.authUser = next;
    st.session.roleMode = (App.isAdminUser(next) ? "admin" : "user");
// Keep local selection (UI state)
    try { localStorage.setItem("usp_selected_user_id", String(next.id)); } catch (e) {}

    // Also switch "logged in" user for the local auth shim (so USP.Auth.currentUser() changes)
    try {
      localStorage.setItem("up_auth_session_v1", JSON.stringify({ userId: String(next.id), ts: Date.now() }));
    } catch (e) {}

    return App.commitState(st);
  };

App.listUsers = function listUsers(state) {
    const st = state || _state;
    const dir = (st && st.settings && Array.isArray(st.settings.users)) ? st.settings.users : [];
    return dir.slice();
  };

  App.getUserById = function getUserById(userId, state) {
    const users = App.listUsers(state);
    return users.find(function(u){ return u && String(u.id) === String(userId); }) || null;
  };

  
App.Messages = App.Messages || {};

App.Messages.listThreadsForUser = function listThreadsForUser(userId, state) {
  const st = state || _state || defaultState();
  const uidValue = String(userId || "");
  const list = Array.isArray(st.messageThreads) ? st.messageThreads.slice() : [];
  return list.filter(function(thread){
    if (!thread) return false;
    const participants = Array.isArray(thread.participants) ? thread.participants.map(String) : [];
    const deletedFor = Array.isArray(thread.deletedFor) ? thread.deletedFor.map(String) : [];
    return participants.indexOf(uidValue) >= 0 && deletedFor.indexOf(uidValue) < 0;
  }).sort(function(a,b){
    return new Date((b && (b.updatedAt || b.createdAt)) || 0) - new Date((a && (a.updatedAt || a.createdAt)) || 0);
  });
};

App.Messages.getThread = function getThread(threadId, state) {
  const st = state || _state || defaultState();
  const list = Array.isArray(st.messageThreads) ? st.messageThreads : [];
  return list.find(function(t){ return t && String(t.id) === String(threadId); }) || null;
};

App.Messages.listForUser = function listForUser(userId, state) {
  return App.Messages.listThreadsForUser(userId, state);
};

App.Messages.getUnreadCount = function getUnreadCount(userId, state) {
  const uidValue = String(userId || "");
  return App.Messages.listThreadsForUser(uidValue, state).filter(function(thread){
    return !!(thread && thread.unreadBy && thread.unreadBy[uidValue]);
  }).length;
};

App.Messages.createThread = function createThread(payload) {
  const st = deepClone(_state || defaultState());
  st.messageThreads = Array.isArray(st.messageThreads) ? st.messageThreads : [];
  const me = App.getActingUser(st) || {};
  const toUserIds = Array.isArray(payload && payload.toUserIds) ? payload.toUserIds : [];
  const subject = String((payload && (payload.subject || payload.title)) || "").trim();
  const body = String((payload && payload.body) || "").trim();
  const context = (payload && payload.context && typeof payload.context === 'object') ? deepClone(payload.context) : null;
  const participants = [];
  const seen = Object.create(null);
  [me.id].concat(toUserIds).forEach(function(id){
    const k = String(id || "").trim();
    if (!k || seen[k]) return;
    seen[k] = true;
    participants.push(k);
  });
  if (participants.length <= 1) return st;

  const now = nowIso();
  const thread = {
    id: uid("thr"),
    subject: subject || (body ? body.split(/\r?\n/)[0].slice(0, 80) : (context && (context.label || context.fieldName)) || "Meddelande"),
    context: context,
    participants: participants,
    createdBy: String(me.id || ""),
    createdAt: now,
    updatedAt: now,
    deletedFor: [],
    unreadBy: {},
    messages: [{
      id: uid("msg"),
      fromUserId: String(me.id || ""),
      body: body,
      createdAt: now
    }]
  };
  participants.forEach(function(uidValue){
    thread.unreadBy[uidValue] = String(uidValue) !== String(me.id || "");
  });
  st.messageThreads.push(thread);
  return App.commitState(st);
};

App.Messages.send = function sendMessage(payload) {
  return App.Messages.createThread(payload);
};

App.Messages.replyToThread = function replyToThread(threadId, body) {
  const st = deepClone(_state || defaultState());
  st.messageThreads = Array.isArray(st.messageThreads) ? st.messageThreads : [];
  const thread = st.messageThreads.find(function(t){ return t && String(t.id) === String(threadId); });
  if (!thread) return st;

  const me = App.getActingUser(st) || {};
  const now = nowIso();
  thread.messages = Array.isArray(thread.messages) ? thread.messages : [];
  thread.participants = Array.isArray(thread.participants) ? thread.participants : [];
  if (thread.participants.indexOf(String(me.id || "")) < 0 && me.id) thread.participants.push(String(me.id));

  thread.messages.push({
    id: uid("msg"),
    fromUserId: String(me.id || ""),
    body: String(body || "").trim(),
    createdAt: now
  });
  thread.updatedAt = now;
  thread.deletedFor = Array.isArray(thread.deletedFor) ? thread.deletedFor.filter(function(uidValue){
    return String(uidValue) !== String(me.id || "");
  }) : [];
  thread.unreadBy = (thread.unreadBy && typeof thread.unreadBy === "object") ? thread.unreadBy : {};
  thread.participants.forEach(function(uidValue){
    thread.unreadBy[String(uidValue)] = String(uidValue) !== String(me.id || "");
  });

  return App.commitState(st);
};

App.Messages.markThreadRead = function markThreadRead(threadId, userId) {
  const st = deepClone(_state || defaultState());
  st.messageThreads = Array.isArray(st.messageThreads) ? st.messageThreads : [];
  const thread = st.messageThreads.find(function(t){ return t && String(t.id) === String(threadId); });
  if (!thread) return st;
  thread.unreadBy = (thread.unreadBy && typeof thread.unreadBy === "object") ? thread.unreadBy : {};
  thread.unreadBy[String(userId || "")] = false;
  return App.commitState(st);
};

App.Messages.markRead = function markRead(messageOrThreadId) {
  const st = _state || defaultState();
  const me = App.getActingUser(st) || {};
  return App.Messages.markThreadRead(messageOrThreadId, me.id);
};

App.Messages.deleteThreadForUser = function deleteThreadForUser(threadId, userId) {
  const st = deepClone(_state || defaultState());
  st.messageThreads = Array.isArray(st.messageThreads) ? st.messageThreads : [];
  const thread = st.messageThreads.find(function(t){ return t && String(t.id) === String(threadId); });
  if (!thread) return st;
  thread.deletedFor = Array.isArray(thread.deletedFor) ? thread.deletedFor : [];
  const uidValue = String(userId || "");
  if (uidValue && thread.deletedFor.indexOf(uidValue) < 0) thread.deletedFor.push(uidValue);
  return App.commitState(st);
};


  App.getCurrentUserId = function getCurrentUserId() {
    try { return String(localStorage.getItem("usp_selected_user_id") || ""); } catch (e) { return ""; }
  };

  App.setCurrentUser = function setCurrentUser(userId) {
    const st = deepClone(_state || defaultState());
    const dir = (st.settings && Array.isArray(st.settings.users)) ? st.settings.users : [];
    const u = dir.find(x => x && String(x.id) === String(userId)) || null;
    if (!u) throw new Error("User not found");
    st.session = st.session || { authUser: null, actingUserId: "", roleMode: "admin" };
    if (!st.session.roleMode) st.session.roleMode = "admin";
    st.session.actingUserId = String(u.id);
    st.user = u;
    try { localStorage.setItem("usp_selected_user_id", String(u.id)); } catch (e) {}
    return App.commitState(st);
  };

  App.addUser = function addUser(user) {
    const st = deepClone(_state || defaultState());
    st.settings = st.settings || defaultSettings();
    st.settings.users = Array.isArray(st.settings.users) ? st.settings.users : [];
    const u = Object.assign({ id: uid("u") }, user || {});
    st.settings.users.push(u);
    return App.commitState(st);
  };

  App.updateUser = function updateUser(userId, patch) {
    const st = deepClone(_state || defaultState());
    st.settings = st.settings || defaultSettings();
    st.settings.users = Array.isArray(st.settings.users) ? st.settings.users : [];
    const idx = st.settings.users.findIndex(u => u && String(u.id) === String(userId));
    if (idx < 0) throw new Error("User not found");
    st.settings.users[idx] = Object.assign({}, st.settings.users[idx], patch || {});
    // keep current user updated
    if (st.user && String(st.user.id) === String(userId)) st.user = st.settings.users[idx];
    return App.commitState(st);
  };

  App.deleteUser = function deleteUser(userId) {
    const st = deepClone(_state || defaultState());
    st.settings = st.settings || defaultSettings();
    st.settings.users = Array.isArray(st.settings.users) ? st.settings.users : [];
    st.settings.users = st.settings.users.filter(u => u && String(u.id) !== String(userId));
    // if deleted current user, switch to admin
    if (st.user && String(st.user.id) === String(userId)) {
      st.user = loadOrCreateLocalUser(st);
    }
    return App.commitState(st);
  };

  // ---------------------------
  // Init / mount
  // ---------------------------
  App.init = function init() {
    _state = ensureStateInvariants(loadState());
    
    // In local mode, hydration is complete immediately
    if (getDataMode() === "local") {
      _hydrationComplete = true;
    }

    // Attach auth user (controls role) + acting user
_state.session = _state.session || { authUser: null, actingUserId: "" };
_state.ui = _state.ui || {};

var cu = getCurrentAuthUser();
var autoLogin = !!(App && App.Config && App.Config.autoLogin);

// Default UX: always show the defined login screen on startup.
// If autoLogin=true, we will attach the existing auth session automatically.
if (autoLogin && cu) {
  var acting = ensureUserFromAuth(_state, cu);
  _state.session.authUser = acting;
  _state.session.actingUserId = String(acting.id || "");
  _state.user = acting;
  delete _state.ui.screen;
} else {
  // Force login overlay at start (even if there is an old session in localStorage)
  try{
    if (!autoLogin && cu && window.USP && window.USP.Auth && typeof window.USP.Auth.logout === "function") {
      window.USP.Auth.logout();
    }
  }catch(e){}
  _state.session.authUser = null;
  _state.session.actingUserId = "";
  _state.user = null;
  _state.ui.screen = "login";
}

// Persist state in local mode (login screen also persists so refresh keeps it)
if (getDataMode() === "local") {
  persistState(_state);
}

// Ensure base UI exists
    if (USP.UI && typeof USP.UI.mountBase === "function") {
      USP.UI.mountBase();
    }

    // First render
    if (USP.UI && typeof USP.UI.render === "function") {
      USP.UI.render(_state);

    // Server mode: hydrate state from DB after first paint (only after login)
try{
  if (_state && _state.session && _state.session.authUser) startServerHydration();
  else _hydrationComplete = true;
}catch(eH2){ _hydrationComplete = true; }


    }

    return _state;
  };

  // Convenience for debugging
  App._debugResetState = function () {
    localStorage.removeItem(LS_STATE);
    _state = ensureStateInvariants(defaultState());
    if (getDataMode() === "local") {
      persistState(_state);
    }
    if (USP.UI && typeof USP.UI.render === "function") USP.UI.render(_state);

    // Server mode: hydrate state from DB after first paint (only after login)
try{
  if (_state && _state.session && _state.session.authUser) startServerHydration();
}catch(eH3){}

  };

})();
