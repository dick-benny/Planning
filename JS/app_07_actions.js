/* app_07_actions_66.js
   Safe Actions module (does NOT overwrite USP.App).
   Only attaches helpers under USP.App.Actions.
*/
(function () {
  "use strict";
  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};

  const App = window.USP.App;
  App.Actions = App.Actions || {};

  // Optional hooks; keep no-op defaults.
  App.Actions.onAfterCommit = function () {};
})();
