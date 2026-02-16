/* app_05_handlers_68.js
   Diagnoses load order / overwrites. Does not overwrite USP.App.
*/
(function () {
  "use strict";
  var VERSION = 68;

  function log() { try { console.log.apply(console, arguments); } catch (e) {} }
  function warn() { try { console.warn.apply(console, arguments); } catch (e) {} }
  function err() { try { console.error.apply(console, arguments); } catch (e) {} }

  function dump() {
    var USP = window.USP || {};
    var App = USP.App || {};
    var UI = USP.UI || {};
    warn("[handlers v"+VERSION+"] dump:",
      "USP?", !!window.USP,
      "App keys:", Object.keys(App).slice(0, 50),
      "UI keys:", Object.keys(UI).slice(0, 50),
      "typeof App.init:", typeof App.init
    );
  }

  function isReady() {
    return !!(window.USP && window.USP.App && typeof window.USP.App.init === "function" &&
              window.USP.UI && typeof window.USP.UI.render === "function");
  }

  function tryInit() {
    if (!isReady()) return false;
    try {
      if (window.USP.__handlers_inited) return true;
      window.USP.__handlers_inited = true;
      log("[handlers v"+VERSION+"] init()");
      window.USP.App.init();
      return true;
    } catch (e) {
      err("[handlers v"+VERSION+"] init failed:", e);
      return false;
    }
  }

  function waitAndInit() {
    var start = Date.now();
    var maxMs = 8000;

    function tick() {
      if (tryInit()) return;
      if (Date.now() - start > maxMs) {
        err("[handlers v"+VERSION+"] USP.App.init is not available after " + maxMs + "ms.");
        dump();
        err("[handlers] If App.init disappeared, one of your scripts overwrote USP.App. Ensure app_02_config/app_08_db/app_07_actions ONLY extend USP.App (never assign USP.App = {}).");
        return;
      }
      setTimeout(tick, 50);
    }
    tick();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", waitAndInit);
  else waitAndInit();
})();
