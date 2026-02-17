/* app_08_db_69.js
   DB adapter:
   - localhost: handled by bootstrap localStorage (no remote)
   - non-localhost: Supabase PostgREST (table public.usp_state, key="main")
   IMPORTANT: This is Option A (no Supabase Auth). RLS must allow anon read/write or be disabled.
*/
(function () {
  "use strict";
  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};
  const App = window.USP.App;

  App.DB = App.DB || {};

  function cfgUrl() { return (App.Config && App.Config.getSupabaseUrl) ? App.Config.getSupabaseUrl() : ""; }
  function cfgKey() { return (App.Config && App.Config.getSupabaseKey) ? App.Config.getSupabaseKey() : ""; }
  function mode() { return (App.Config && App.Config.getDataMode) ? App.Config.getDataMode() : "local"; }

  function restUrl(path) {
    const base = String(cfgUrl() || "").replace(/\/+$/, "");
    return base + path;
  }

  async function rest(method, path, body) {
    const k = cfgKey();
    const headers = {
      "apikey": k,
      "Authorization": "Bearer " + k,
      "Content-Type": "application/json",
      "Accept": "application/json"
    };
    const opts = { method, headers };
    if (body !== undefined) opts.body = JSON.stringify(body);
    const res = await fetch(restUrl(path), opts);
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch (e) { json = null; }
    if (!res.ok) {
      const err = new Error("Supabase REST " + res.status + " " + res.statusText);
      err.status = res.status;
      err.body = text;
      throw err;
    }
    return json;
  }

  App.DB.ping = async function ping() {
    return { ok: true, mode: mode() };
  };

  App.DB.loadState = async function loadStateRemote() {
    if (mode() !== "supabase") return null;
    // GET single row
    const rows = await rest("GET", "/rest/v1/usp_state?key=eq.main&select=state,updated_at", undefined);
    if (!Array.isArray(rows) || !rows[0] || !rows[0].state) return null;
    return rows[0].state;
  };

  App.DB.saveState = async function saveStateRemote(state) {
    if (mode() !== "supabase") return { ok: true, skipped: true };
    const payload = [{ key: "main", state: state }];
    // upsert
    const res = await fetch(restUrl("/rest/v1/usp_state?on_conflict=key"), {
      method: "POST",
      headers: {
        "apikey": cfgKey(),
        "Authorization": "Bearer " + cfgKey(),
        "Content-Type": "application/json",
        "Accept": "application/json",
        "Prefer": "resolution=merge-duplicates,return=minimal"
      },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const t = await res.text();
      const err = new Error("Supabase upsert failed " + res.status);
      err.status = res.status;
      err.body = t;
      throw err;
    }
    return { ok: true };
  };
})();