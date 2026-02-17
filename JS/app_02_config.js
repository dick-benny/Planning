/* app_02_config.js
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

  // Data mode toggle: localhost => localStorage, otherwise Express server
  App.Config.isLocalHost = function isLocalHost() {
    const h = String(location && location.hostname ? location.hostname : "");
    return (h === "localhost" || h === "127.0.0.1" || h.endsWith(".local"));
  };

  App.Config.getDataMode = function getDataMode() {
    return App.Config.isLocalHost() ? "local" : "server";
  };

})();
