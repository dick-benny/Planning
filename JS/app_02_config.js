/* app_02_config_66.js
   Safe config extender (does NOT overwrite USP.App).
   Keep this file even if mostly empty; it can hold env/config later.
*/
(function () {
  "use strict";
  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};

  const App = window.USP.App;

  App.Config = App.Config || {};

  // Read env-like config (works for plain HTML builds too)
  App.Config.get = function getConfig(key, fallback) {
    try {
      // If you later inject window.__ENV__ = {...} you can read it here
      if (window.__ENV__ && Object.prototype.hasOwnProperty.call(window.__ENV__, key)) return window.__ENV__[key];
    } catch (e) {}
    return fallback;
  };

  // Convenience accessors used by bootstrap/db modules (if any)
  App.Config.getSupabaseUrl = function () {
    return App.Config.get("NEXT_PUBLIC_SUPABASE_URL", "");
  };
  App.Config.getSupabaseKey = function () {
    return App.Config.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "");
  };
})();
