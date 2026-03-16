/* app_06_fixed_tables.js
 * Central specs for fixed tables (ToDo, Project, Routines)
 * v4
 */
(function(){
  "use strict";
  var USP = (window.USP = window.USP || {});
  var App = (USP.App = USP.App || {});

  App.FixedTables = App.FixedTables || {};

  function uidFx(prefix){
    try{
      if (USP && USP.App && typeof USP.App._uid === "function") return USP.App._uid(prefix||"f");
    }catch(e){}
    return String((prefix||"f") + "_" + Date.now() + "_" + Math.floor(Math.random()*1e9));

  function stableStringify(obj){
    const seen = new WeakSet();
    function sortAny(x){
      if (x && typeof x === "object"){
        if (seen.has(x)) return null;
        seen.add(x);
        if (Array.isArray(x)) return x.map(sortAny);
        const out = {};
        Object.keys(x).sort().forEach(k=>{ out[k]=sortAny(x[k]); });
        return out;
      }
      return x;
    }
    try{ return JSON.stringify(sortAny(obj)); }catch(e){ try{ return JSON.stringify(obj); }catch(e2){ return String(obj); } }
  }

  }


  App.FixedTables.TODO = {
    key: (App.Tabs && App.Tabs.TODO) ? App.Tabs.TODO : "todo",
    title: "ToDo",
    version: 2,
    columns: [
      { name: "Kategori", type: "dropdown_todo_kategori",  width: "17ch" },
      { name: "Beskrivning", type: "text", mods: { initials: true }, key: true, width: "100%" },
      { name: "Klart", type: "date", width: "15ch", mods: { overdue: true } }
    ]
  };

  App.FixedTables.PROJECT = {
    key: (App.Tabs && App.Tabs.PROJECT) ? App.Tabs.PROJECT : "project",
    title: "Projekt",
    columns: [
      { name: "Projektnamn", type: "text", mods: { initials: true }, key: true },
      { name: "Kategori", type: "dropdown_project_kategori", 
 width: "17ch" },
      { name: "Start", type: "date", width: "15ch" },
      { name: "Aktuell", type: "text", mods: { corner: true, notes:true } },
      { name: "Nästa", type: "text", mods: { notes: true } },
      { name: "Kommande", type: "text", mods: {  notes: true  } },
      { name: "Slut", type: "date", width: "15ch" }
    ]
  };

// ---------------------------
// Fixed DEV schema (Utveckling)
// Columns: Produktidé, Kategori, Design-Po, Sample test, Stort sample, Q-test, Prissättning
// All columns: corner + notes
// ---------------------------
App.FixedTables.DEV = {
    key: (App.Tabs && App.Tabs.DEV) ? App.Tabs.DEV : "dev",
    title: "Utveckling",
    version: 5,
    columns: [
      { name: "Produktidé", type: "text", mods: { initials: true }, key: true },
      { name: "Kategori", type: "dropdown_dev_kategori", width: "14ch", mods: { } },
      { name: "Syfte", type: "dropdown_dev_syfte", width: "14ch", mods: { } },
      { name: "Design-Po", type: "text", mods: { corner: true, notes: true } },
      { name: "Sample test", type: "text", mods: { corner: true, notes: true } },
      { name: "Stort sample", type: "text", mods: { corner: true, notes: true } },
      { name: "Q-test", type: "text", mods: { corner: true, notes: true } },
      { name: "Prissättning", type: "text", mods: { corner: true, notes: true } }
    ]
  };

// ---------------------------
// Fixed PRODUCT schema (Sälj)
// Columns: Produkt, Kategori, Kollektion Q, PO beslut, Shopify-ready, B2B-ready, Drop
// All columns: corner + notes
// ---------------------------
App.FixedTables.PRODUCT = {
    key: (App.Tabs && App.Tabs.PRODUCT) ? App.Tabs.PRODUCT : "product",
    title: "Produkter",
    version: 4,
    columns: [
      { name: "Produkt", type: "text", mods: { initials: true }, key: true },
      { name: "Kategori", type: "dropdown_product_kategori", width: "17ch", mods: { } },
      { name: "Koll. Q", type: "kvartal", mods: { } },
      { name: "PO beslut", type: "text", mods: { corner: true, notes: true } },
      { name: "Media", type: "text", mods: { corner: true, notes: true } },
      { name: "Shopify-ready", type: "text", mods: { corner: true, notes: true } },
      { name: "B2B-ready", type: "text", mods: { corner: true, notes: true } },
      { name: "Drop", type: "veckonummer", width: "10ch", mods: {  } }
    ]
  };

  
App.FixedTables.ROUTINES = {
    key: (App.Tabs && App.Tabs.ROUTINES) ? App.Tabs.ROUTINES : "routines",
    title: "Rutiner",
    version: 5,
    columns: [
      { name: "Rutin", type: "text", key: true, mods: { pdf: true } }
    ]
  };
function buildSchemaFromSpec(spec, current) {
  var cols = Array.isArray(spec.columns) ? spec.columns : [];
  var fields = [];
  // Create a stable signature so schema refreshes even if version is unchanged but column defs changed.
  var sigCols = [];
  for (var i=0;i<cols.length;i++) {
    var c = cols[i] || {};
    var mods = {};
    // Deep-clone mods to avoid accidental mutation through shared references.
    try { mods = JSON.parse(JSON.stringify(c.mods || {})); } catch(eM) { mods = Object.assign({}, (c.mods || {})); }

    var f = {
      id: (function(){
        try{
          var curFields = (current && Array.isArray(current.fields)) ? current.fields : [];
          var cur = curFields[i];
          var curName = cur ? String(cur.name||"").trim().toLowerCase() : "";
          var newName = String(c.name||"").trim().toLowerCase();
          if (cur && cur.id && curName && newName && curName === newName) return String(cur.id);
        }catch(e){}
        return uidFx("f");
      })(),
      order: i,
      name: String(c.name || "").trim(),
      type: String(c.type || "text").trim(),
      mods: mods
    };
    if (c.width) f.width = c.width;
    if (c.registry) f.registry = c.registry;
    if (c.key) f.key = true;
    fields.push(f);

    sigCols.push({
      name: f.name,
      type: f.type,
      width: f.width || "",
      registry: f.registry || "",
      key: !!f.key,
      mods: mods
    });
  }

  var fixedSig = "";
  try { fixedSig = stableStringify(sigCols); } catch(eS) { fixedSig = String(sigCols.length); }

  return {
    version: spec.version || 1,
    fixed: true,
    fixedKey: spec.key,
    fixedVersion: spec.version || 1,
    fixedSig: fixedSig,
    fields: fields
  };
}

// Ensure that fixed tables always have their schema in state.
// Safe: only sets schema if missing or out of date.
App.FixedTables.ensureSchema = function(tabKey, state){
  try {
    var spec = App.getFixedTableSpec(tabKey);
    if (!spec) return false;
    var current = (typeof App.getSchema === "function") ? App.getSchema(tabKey, state) : null;
    var desired = buildSchemaFromSpec(spec, current);
    if (current && current.fixed && current.fixedKey === spec.key && current.fixedVersion === (spec.version || 1) && current.fixedSig === desired.fixedSig) {
      return false;
    }
    var desired = buildSchemaFromSpec(spec, current);
    if (typeof App.setSchema === "function") {
      App.setSchema(tabKey, desired);
      return true;
    }
    // If App.setSchema is not available (should not happen), do nothing.
    return false;
  } catch(e) {
    console.warn("FixedTables.ensureSchema failed", e);
    return false;
  }
};

  App.getFixedTableSpec = function(tabKey){
    var t = App.FixedTables.TODO, p = App.FixedTables.PROJECT, r = App.FixedTables.ROUTINES, d = App.FixedTables.DEV, pr = App.FixedTables.PRODUCT;
    if (tabKey === t.key) return t;
    if (tabKey === p.key) return p;
    if (tabKey === r.key) return r;
    if (d && tabKey === d.key) return d;
    if (pr && tabKey === pr.key) return pr;
    return null;
  };
})();