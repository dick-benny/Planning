/* app_08_db.js
   DB adapter:
   - Always uses Express + SQLite backend (/api/state endpoint)
*/
(function () {
  "use strict";
  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};
  const App = window.USP.App;

  App.DB = App.DB || {};

  function mode() { 
    return (App.Config && App.Config.getDataMode) ? App.Config.getDataMode() : "local"; 
  }

  App.DB.ping = async function ping() {
    return { ok: true, mode: mode() };
  };

  App.DB.loadState = async function loadState() {
    if (mode() !== "server") return null;
    
    try {
      console.log("📥 Loading state from /api/state...");
      const res = await fetch("/api/state");
      if (!res.ok) {
        throw new Error("Failed to load state: " + res.status);
      }
      const data = await res.json();
      console.log("📥 Loaded state:", data);
      return data.state;
    } catch (err) {
      console.error("DB loadState error:", err);
      throw err;
    }
  };

  App.DB.saveState = async function saveState(state) {
    if (mode() !== "server") return { ok: true, skipped: true };
    
    try {
      console.log("💾 Saving state to /api/state...", state);
      const res = await fetch("/api/state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ state })
      });
      
      if (!res.ok) {
        const text = await res.text();
        throw new Error("Failed to save state: " + res.status + " " + text);
      }
      
      const result = await res.json();
      console.log("💾 Saved state:", result);
      return { ok: true, updated_at: result.updated_at };
    } catch (err) {
      console.error("DB saveState error:", err);
      throw err;
    }
  };
})();