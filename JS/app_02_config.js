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


  // VERSION 69: Data mode toggle (localhost => localStorage, otherwise Supabase)
  App.Config.isLocalHost = function isLocalHost() {
    const h = String(location && location.hostname ? location.hostname : "");
    return (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local"));
  };

  App.Config.getDataMode = function getDataMode() {
    return App.Config.isLocalHost() ? "local" : "supabase";
  };

  // Default Supabase (can be overridden via window.__ENV__)
  App.Config.getSupabaseUrl = function () {
    return App.Config.get("NEXT_PUBLIC_SUPABASE_URL", "https://nchgudsqleylfdysgabi.supabase.co");
  };
  App.Config.getSupabaseKey = function () {
    return App.Config.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "sb_publishable_TBIHlzs-Cw-fJfjUvkzzfw_mhrTLuLw");
  };

})();
