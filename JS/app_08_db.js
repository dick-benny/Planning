// [db v70]
/* app_08_db_67.js
   Safe DB module placeholder (does NOT overwrite USP.App).
   In this phase, local mode is primary; Supabase wiring can be added later.
*/
(function () {
  "use strict";
  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};

  const App = window.USP.App;

  App.DB = App.DB || {};

  
  App.DB._remoteDisabled = false;
  App.DB._remoteLastError = "";
function mode() {
    return (App.Config && App.Config.dataMode) ? App.Config.dataMode() : "local";
  }

  function supaUrl() { return (App.Config && App.Config.getSupabaseUrl) ? App.Config.getSupabaseUrl() : ""; }
  function supaKey() { return (App.Config && App.Config.getSupabaseKey) ? App.Config.getSupabaseKey() : ""; }

  function hasSupabaseCreds() {
    return !!(supaUrl() && supaKey());
  }

  // Persisted payload (we intentionally do NOT store session/ui in DB)
  function pickPersisted(st) {
    const o = {};
    if (st && typeof st === "object") {
      o.schemas = st.schemas || null;
      o.data = st.data || null;
      o.settings = st.settings || null;
    }
    return o;
  }

  function applyPersisted(into, persisted) {
    const st = into && typeof into === "object" ? into : {};
    if (!persisted || typeof persisted !== "object") return st;
    if (persisted.schemas) st.schemas = persisted.schemas;
    if (persisted.data) st.data = persisted.data;
    if (persisted.settings) st.settings = persisted.settings;
    return st;
  }

  async function restGetPersisted() {
    const url = supaUrl();
    const key = supaKey();
    const endpoint = url.replace(/\/$/, "") + "/rest/v1/usp_state?key=eq.main&select=state";
    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        Accept: "application/json"
      }
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error("Supabase GET failed: " + res.status + " " + txt);
    }
    const arr = await res.json();
    if (!Array.isArray(arr) || !arr[0] || !arr[0].state) return null;
    return arr[0].state;
  }

  async function restUpsertPersisted(persisted) {
    const url = supaUrl();
    const key = supaKey();
    const endpoint = url.replace(/\/$/, "") + "/rest/v1/usp_state";
    const body = [{ key: "main", state: persisted }];
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: "Bearer " + key,
        "Content-Type": "application/json",
        Prefer: "resolution=merge-duplicates"
      },
      body: JSON.stringify(body)
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error("Supabase UPSERT failed: " + res.status + " " + txt);
    }
    return true;
  }

  // Public API
  App.DB.mode = mode;
  App.DB.hasSupabaseCreds = hasSupabaseCreds;

  // Called once during init on prod host: fetch persisted payload and merge into current state.
  App.DB.bootstrapRemoteLoad = async function bootstrapRemoteLoad(getCurrentState, commitMerged) {
    if (mode() !== "supabase") return { ok: true, skipped: true, mode: mode() };
    if (!hasSupabaseCreds()) return { ok: false, error: "Missing Supabase creds" };
    try {
      const persisted = await restGetPersisted();
      if (!persisted) return { ok: true, empty: true };
      const cur = (typeof getCurrentState === "function") ? getCurrentState() : null;
      const merged = applyPersisted(cur, persisted);
      if (typeof commitMerged === "function") commitMerged(merged);
      return { ok: true, loaded: true };
    } catch (e) {
      console.error("[DB] bootstrapRemoteLoad failed", e);
      return { ok: false, error: String((e && e.message) || e) };
    }
  };

  // Called on every commit (prod host): upsert persisted payload.
  App.DB.saveRemote = async function saveRemote(state) {
    if (mode() !== "supabase") return { ok: true, skipped: true, mode: mode() };
    if (!hasSupabaseCreds()) return { ok: false, error: "Missing Supabase creds" };
    try {
      const persisted = pickPersisted(state);
      await restUpsertPersisted(persisted);
      return { ok: true };
    } catch (e) {
      console.error("[DB] saveRemote failed", e);
      return { ok: false, error: String((e && e.message) || e) };
    }
  };

  App.DB.ping = async function ping() { return { ok: true, mode: mode() }; };

})();
