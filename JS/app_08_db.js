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

    // Coalesce rapid saves and send them in order.
    // Without this, multiple overlapping POSTs can race and an older state can land last.
    App.DB.__saveQueue = App.DB.__saveQueue || {
      inFlight: false,
      pendingState: null,
      pendingPromise: null,
      lastResult: null
    };

    const q = App.DB.__saveQueue;
    try {
      // Deep-clone snapshot to avoid later mutation while queued
      q.pendingState = JSON.parse(JSON.stringify(state));

      if (q.inFlight && q.pendingPromise) {
        return q.pendingPromise;
      }

      q.inFlight = true;
      q.pendingPromise = (async function flushQueue() {
        let result = { ok: true, skipped: true };
        while (q.pendingState) {
          const snapshot = q.pendingState;
          q.pendingState = null;

          try {
            console.log("💾 Saving state to /api/state...", snapshot);
            const res = await fetch("/api/state", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ state: snapshot })
            });

            if (!res.ok) {
              const text = await res.text();
              throw new Error("Failed to save state: " + res.status + " " + text);
            }

            const payload = await res.json();
            result = { ok: true, updated_at: payload.updated_at };
            q.lastResult = result;
            console.log("💾 Saved state:", payload);
          } catch (err) {
            console.error("DB saveState error:", err);
            q.inFlight = false;
            q.pendingPromise = null;
            throw err;
          }
        }

        q.inFlight = false;
        q.pendingPromise = null;
        return result;
      })();

      return q.pendingPromise;
    } catch (err) {
      console.error("DB saveState error:", err);
      q.inFlight = false;
      q.pendingPromise = null;
      throw err;
    }
  };
})();