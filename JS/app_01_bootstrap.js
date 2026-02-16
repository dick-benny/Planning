/* app_01_bootstrap_68.js
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
  App.VERSION = 73;

  // Storage keys
  const LS_STATE = "usp_state_latest_v2";
  const LS_USER = "usp_user_v1";

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
    const s = deepClone(schema || { fields: [] });
    s.fields = Array.isArray(s.fields) ? s.fields : [];
    s.fields = s.fields.map((f, idx) => {
      const o = Object.assign({}, f || {});
      if (!o.name && o.key) o.name = o.key; // legacy migrate
      delete o.key;
      o.name = normStr(o.name) || ("Fält " + (idx + 1));
      o.type = normStr(o.type) || "text";
      o.order = Number.isFinite(o.order) ? o.order : idx;
      if (!o.id) o.id = uid("f");
      return o;
    }).sort((a,b)=> (a.order??0)-(b.order??0));
    s.fields.forEach((f,i)=>{ f.order=i; });
    return s;
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
    };
  }

  function defaultData() {
    return {
      dev: [],
      product: [],
      todo: [],
      routines: [],
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

      // Data mode (future): "local" | "supabase"
      dataMode: "local",
      supabase: { url: "", key: "", table: "usp_state", user_state_key: "latest" },

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
    try { sel = String(localStorage.getItem(SEL) || ""); } catch (e) { sel = ""; }

    let user = null;
    if (sel) user = dir.find(u => u && String(u.id) === sel) || null;
    if (!user) user = dir.find(u => u && u.email === "d.eriksson@cappelendimyr.com") || dir[0] || null;

    if (!user) user = { id: uid("u"), email: "d.eriksson@cappelendimyr.com", name: "Dick Eriksson", createdAt: nowIso() };

    try { localStorage.setItem(SEL, String(user.id)); } catch (e) {}
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

  App.getState = function getState() { return _state; };

  function persistState(st) {
    try { localStorage.setItem(LS_STATE, JSON.stringify(st)); } catch (e) {}
  }

  function loadState() {
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
    const st = state || _state;
    const k = tabKey || App.getTab(st);
    st.schemas = st.schemas || defaultSchemas();
    return st.schemas[k] || { fields: [] };
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

    // Attach auth user (controls role) + acting user (impersonation)
    _state.session = _state.session || { authUser: null, actingUserId: "" };
    const authUser = loadAdminUser(_state);
    _state.session.authUser = authUser;
    _state.session.roleMode = "admin";

    const acting = loadOrCreateLocalUser(_state);
    // Ensure deterministic default: Dick
    const actingId = String(acting && acting.id ? acting.id : "u_dick");
    _state.session.actingUserId = actingId || "u_dick";
    _state.user = acting || loadAdminUser(_state);

    
    // Use acting user as the "logged in" auth user in local demo
    _state.session.authUser = _state.user;
// Persist user into state so it survives tab switches
    persistState(_state);

    // Ensure base UI exists
    if (USP.UI && typeof USP.UI.mountBase === "function") {
      USP.UI.mountBase();
    }

    // First render
    if (USP.UI && typeof USP.UI.render === "function") {
      USP.UI.render(_state);
    }

    return _state;
  };

  // Convenience for debugging
  App._debugResetState = function () {
    localStorage.removeItem(LS_STATE);
    _state = ensureStateInvariants(defaultState());
    persistState(_state);
    if (USP.UI && typeof USP.UI.render === "function") USP.UI.render(_state);
  };

})();
