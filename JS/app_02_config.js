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
  // VERSION 70: Use Supabase ONLY on production host
  App.Config = App.Config || {};
  (function(){
    const host = String((location && location.hostname) || "");
    const isProdHost = (host === "planning.cappelendimyr.com");
    App.Config.DB_MODE = isProdHost ? "supabase" : "local";
    // Supabase public credentials (only used when DB_MODE === "supabase")
    App.Config.SUPABASE_URL = "https://nchgudsqleylfdysgabi.supabase.co";
    App.Config.SUPABASE_PUBLISHABLE_KEY = "sb_publishable_TBIHlzs-Cw-fJfjUvkzzfw_mhrTLuLw";
    try { console.log("[config] host=", host, "DB_MODE=", App.Config.DB_MODE); } catch(e) {}
  })();


  // VERSION 71: Default registries (hardcoded lists)
  App.Config = App.Config || {};
  App.Config.DEFAULT_REGISTRIES = App.Config.DEFAULT_REGISTRIES || {
    produktkategori: ["matta","tapestry","colonnade","softass","paketering"],
    projektkategori: ["kundprojekt","volymprojekt","samarbetsprojekt"],
    todokategori: ["Allmänt","Info","Shopify-B2C","Shopify-B2B","Logistik","Privat"]
  };


})();
