(function(){
  "use strict";
  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};
  const App = window.USP.App;

  App.RoutineLinks = App.RoutineLinks || {
    version: 1,
    allowed: {
      dev: {
        "Q-test": { enabled: true, label: "Q-test" },
        "Prissättning": { enabled: true, label: "Prissättning" }
      },
      product: {
        "Shopify-Ready": { enabled: true, label: "Shopify-Ready" },
        "B2B-ready": { enabled: true, label: "B2B-ready" }
      },
      project: {
        "Projektnamn": { enabled: true, label: "Projektnamn" }
      }
    }
  };

  App.getRoutineLinkAllowed = function(tabKey, fieldName){
    try{
      const t = String(tabKey || "").toLowerCase();
      const f = String(fieldName || "").trim();
      const root = (App.RoutineLinks && App.RoutineLinks.allowed) ? App.RoutineLinks.allowed : {};
      return !!(root[t] && root[t][f] && root[t][f].enabled);
    }catch(e){ return false; }
  };
})();