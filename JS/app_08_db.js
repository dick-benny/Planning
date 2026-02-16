/* app_08_db_66.js
   Safe DB module placeholder (does NOT overwrite USP.App).
   In this phase, local mode is primary; Supabase wiring can be added later.
*/
(function () {
  "use strict";
  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};

  const App = window.USP.App;

  App.DB = App.DB || {};

  // Minimal wrapper so other modules can call App.DB without crashing.
  App.DB.ping = async function ping() { return { ok: true, mode: (App.getDataMode ? App.getDataMode() : "local") }; };

})();
