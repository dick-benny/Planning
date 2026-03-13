/* app_02_config_67.js
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

  
  // -----------------------------
  // Single source of truth: DataMode
  // Always run in server mode so all pages hydrate from /api/state.
  // -----------------------------
  App.Config.getDataMode = function getDataMode() {
    return "server";
  };

  // Optional alias namespace for clarity (does not change behavior)
  App.Env = App.Env || {};
  App.Env.getDataMode = App.Config.getDataMode;


  // Convenience accessors used by bootstrap/db modules (if any)
  App.Config.getSupabaseUrl = function () {
    return App.Config.get("NEXT_PUBLIC_SUPABASE_URL", "");
  };
  App.Config.getSupabaseKey = function () {
    return App.Config.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY", "");
  };
  // VERSION 70 (refactor): Host-based DataMode/DB_MODE
  (function(){
    const host = String((location && location.hostname) || "").toLowerCase();
    const dm = App.Config.getDataMode();
    // Keep existing flag for compatibility.
    App.Config.DB_MODE = "server";

    // Legacy placeholders (kept to avoid breaking any future code that expects them)
    App.Config.SUPABASE_URL = App.Config.SUPABASE_URL || "https://nchgudsqleylfdysgabi.supabase.co";
    App.Config.SUPABASE_PUBLISHABLE_KEY = App.Config.SUPABASE_PUBLISHABLE_KEY || "sb_publishable_TBIHlzs-Cw-fJfjUvkzzfw_mhrTLuLw";

    try { console.log("[config] host=", host, "dataMode=", dm, "DB_MODE=", App.Config.DB_MODE); } catch(e) {}
  })();


  // VERSION 72: Registries (hardcoded lists)
  App.Config.registers = App.Config.registers || {
    // legacy keys (kept for backward compat)
    produktkategori: ["matta","tapestry","colonnade","softass","paketering"],
    projektkategori: ["kundprojekt","volymprojekt","samarbetsprojekt"],
    todokategori: ["Allmänt","Info","Kontor","Sälj/Marknad","Shopify-B2C","Shopify-B2B","Logistik","Privat"],

    // canonical dropdown registries (used by schema / dropdown_*_kategori)
    dropdown_dev_kategori: ["matta","colonnade","tapestry","Softass"],
    dropdown_product_kategori: ["matta","tapestry","colonnade","softass","paketering"],
    dropdown_project_kategori: ["kundprojekt","volymprojekt","samarbetsprojekt"],
    dropdown_todo_kategori: ["Allmänt","Info","Kontor","Sälj/Marknad","Shopify-B2C","Shopify-B2B","Logistik","Privat"]
  };

  // Backward compat alias
  App.Config.DEFAULT_REGISTRIES = App.Config.DEFAULT_REGISTRIES || App.Config.registers;



})();


// --- Registry helpers (v01) ---
(function(){
  var USP = (window.USP = window.USP || {});
  var App = (USP.App = USP.App || {});
  App.Config = App.Config || {};

  function sanitize(list){
    var arr = Array.isArray(list) ? list.slice() : [];
    arr = arr.map(function(v){ return (v==null ? "" : String(v)).trim(); }).filter(function(v){ return !!v; });
    var seen = {};
    var out = [];
    for (var i=0;i<arr.length;i++){
      var s = arr[i];
      if (!seen[s]) { seen[s]=true; out.push(s); }
    }
    return out;
  }

  App.Config.getRegistry = function(name){
    try {
      if (App.Config.registers && Array.isArray(App.Config.registers[name])) return sanitize(App.Config.registers[name]);
      if (App.Config.DEFAULT_REGISTRIES && Array.isArray(App.Config.DEFAULT_REGISTRIES[name])) return sanitize(App.Config.DEFAULT_REGISTRIES[name]);
      if (Array.isArray(App.Config[name])) return sanitize(App.Config[name]);
    } catch(e){}
    return [];
  };

  App.Config.getRegistryWithAll = function(name){
    var r = App.Config.getRegistry(name).filter(function(v){ return v !== "Alla"; });
    return ["Alla"].concat(r);
  };
})();
