/* app_07_actions_67.js
   Safe Actions module (does NOT overwrite USP.App).
   Only attaches helpers under USP.App.Actions.

   R1 refactor: Centralize row actions (Done / Ta bort) in one place.
*/
(function () {
  "use strict";
  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};

  const App = window.USP.App;
  App.Actions = App.Actions || {};

  function _getState() {
    try { return (typeof App.getState === "function") ? App.getState() : null; } catch(e) { return null; }
  }

  function _fmtYMD(d){
    const y=d.getFullYear();
    const m=String(d.getMonth()+1).padStart(2,"0");
    const da=String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+da;
  }

  // Soft-delete: archive
  function archive(tabKey, rowId){
    if (!tabKey || !rowId) return false;
    try{
      if (typeof App.archiveRow === "function") { App.archiveRow(tabKey, rowId); return true; }
    }catch(e){}
    return false;
  }

  // Hard-delete: remove row from dataset (NOT archived)
  function hardDelete(tabKey, rowId){
    try{
      if (!tabKey || !rowId) return false;
      const st = _getState();
      if (!st || !st.data) return false;
      const next = JSON.parse(JSON.stringify(st));
      const list = Array.isArray(next.data[tabKey]) ? next.data[tabKey] : [];
      next.data[tabKey] = list.filter(r => !(r && r.id === rowId));
      if (typeof App.commitState === "function") { App.commitState(next); return true; }
    }catch(e){}
    return false;
  }


  // DEV Done: archive DEV row and create new PRODUCT row copying Produktidé + Kategori
  function devDone(row){
    if (!row) return false;
    const devId = row.id;
    archive(App.Tabs && App.Tabs.DEV ? App.Tabs.DEV : "dev", devId);

    const idea = row.fields && row.fields["Produktidé"] != null ? row.fields["Produktidé"] : "";
    const cat  = row.fields && row.fields["Kategori"] != null ? row.fields["Kategori"] : "";

    const newRow = { id: "row_" + Date.now(), createdAt: new Date().toISOString(), fields: {} };
    newRow.fields["Produkt"]  = (idea == null) ? "" : idea;
    newRow.fields["Kategori"] = (cat == null) ? "" : cat;

    // Ensure schema-aligned empty keys exist (keeps UI stable)
    try{
      const st = _getState();
      const prodKey = (App.Tabs && App.Tabs.PRODUCT) ? App.Tabs.PRODUCT : "product";
      const schema = (typeof App.getSchema === "function") ? App.getSchema(prodKey, st) : null;
      const fields = (schema && Array.isArray(schema.fields)) ? schema.fields : [];
      fields.forEach(f => {
        const n = String((f && f.name) || "").trim();
        if (!n) return;
        if (!Object.prototype.hasOwnProperty.call(newRow.fields, n)) newRow.fields[n] = "";
      });
    }catch(eS){}

    try{
      const prodKey = (App.Tabs && App.Tabs.PRODUCT) ? App.Tabs.PRODUCT : "product";
      if (typeof App.upsertRow === "function") { App.upsertRow(prodKey, newRow); return true; }
    }catch(eU){}
    return false;
  }

  // Public: menu per tab
  App.Actions.getMenu = function(tabKey){
    const key = String(tabKey||"").toLowerCase();
    // Routines has no row actions
    if (App.Tabs && App.Tabs.ROUTINES && String(tabKey) === String(App.Tabs.ROUTINES)) return [];
    if (key === "routines") return [];

    // Project: Done + Ta bort
    if (App.Tabs && App.Tabs.PROJECT && String(tabKey) === String(App.Tabs.PROJECT)) {
      return [{ id:"done", label:"Done" }, { id:"remove", label:"Ta bort" }];
    }
    if (key === "project") return [{ id:"done", label:"Done" }, { id:"remove", label:"Ta bort" }];

    // DEV / PRODUCT: Done + Ta bort
    const isDev = (App.Tabs && App.Tabs.DEV && String(tabKey) === String(App.Tabs.DEV)) || key === "dev";
    const isProd = (App.Tabs && App.Tabs.PRODUCT && String(tabKey) === String(App.Tabs.PRODUCT)) || key === "product";
    if (isDev || isProd) return [{ id:"done", label:"Done" }, { id:"remove", label:"Ta bort" }];

    // Default: Ta bort only
    return [{ id:"remove", label:"Ta bort" }];
  };

  // Public: run action on a row
  // actionId: "done" | "remove"
  App.Actions.run = function(tabKey, actionId, row, state){
    const act = String(actionId||"").toLowerCase();
    if (!row || !row.id) return false;

    const isDev = (App.Tabs && App.Tabs.DEV && String(tabKey) === String(App.Tabs.DEV)) || String(tabKey||"").toLowerCase() === "dev";
    const isProd = (App.Tabs && App.Tabs.PRODUCT && String(tabKey) === String(App.Tabs.PRODUCT)) || String(tabKey||"").toLowerCase() === "product";
    const isProj = (App.Tabs && App.Tabs.PROJECT && String(tabKey) === String(App.Tabs.PROJECT)) || String(tabKey||"").toLowerCase() === "project";

    if (act === "done") {
      // Confirm once
      const ok = window.confirm("Markera som Done?");
      if (!ok) return false;

      if (isDev) return devDone(row);
      if (isProd) return archive(tabKey, row.id);
      if (isProj) return archive(tabKey, row.id);
      // fallback: try set Klart/Status if present, else archive
      try{
        const st = state || _getState();
        const schema = (typeof App.getSchema === "function") ? App.getSchema(tabKey, st) : null;
        const fields = (schema && Array.isArray(schema.fields)) ? schema.fields : [];
        const byLower = new Map(fields.map(f => [String(f.name||"").toLowerCase(), f]));
        const klart = byLower.get("klart");
        const status = byLower.get("status");
        if (klart && typeof App.upsertRow === "function") {
          const next = Object.assign({}, row);
          next.fields = Object.assign({}, row.fields||{});
          next.fields[klart.name] = _fmtYMD(new Date());
          App.upsertRow(tabKey, next);
          return true;
        }
        if (status && typeof App.upsertRow === "function") {
          const next = Object.assign({}, row);
          next.fields = Object.assign({}, row.fields||{});
          next.fields[status.name] = "green";
          App.upsertRow(tabKey, next);
          return true;
        }
      }catch(eF){}
      return archive(tabKey, row.id);
    }

    if (act === "remove") {
      try {
        if (window.__uspSkipNextRemoveConfirm) {
          window.__uspSkipNextRemoveConfirm = false;
          return hardDelete(tabKey, row.id);
        }
      } catch(e) {}
      const ok = window.confirm("Ta bort raden?");
      if (!ok) return false;
      return hardDelete(tabKey, row.id);
    }

    return false;
  };

  // Optional hook; keep no-op default.
  App.Actions.onAfterCommit = App.Actions.onAfterCommit || function () {};

  // ---------------------------------------------------------
  // R-Notes: Central notes helpers (read/has + legacy support)
  // Canonical storage key: "__notes:<fieldName>"
  // Legacy keys supported: "__notes_<fieldName>", "<fieldName>__notes_log", "<fieldName>__notes"
  // ---------------------------------------------------------
  App.Notes = App.Notes || {};

  App.Notes.key = function(fieldName){
    return "__notes:" + String(fieldName||"");
  };

  App.Notes.legacyKeys = function(fieldName){
    const f = String(fieldName||"");
    return [
      "__notes_" + f,
      f + "__notes_log",
      f + "__notes"
    ];
  };

  function normalizeNoteEntry(it){
    try{
      if (it == null) return null;
      if (typeof it === "string"){
        const s = it.trim();
        if (!s) return null;
        const first = s.split(/\r?\n/)[0].slice(0,60);
        return { ts: nowIso(), title: first, text: s };
      }
      if (typeof it === "object"){
        const out = Object.assign({}, it);
        const body = (out.text != null) ? out.text : (out.note != null ? out.note : (out.value != null ? out.value : ""));
        out.text = (body != null) ? String(body) : "";
        const t = String(out.title || out.rubrik || out.heading || "").trim();
        if (!t){
          const first = String(out.text||"").trim().split(/\r?\n/)[0].slice(0,60);
          if (first) out.title = first;
        }
        if (!out.ts) out.ts = nowIso();
        return out;
      }
    }catch(e){}
    return null;
  }


  App.Notes.read = function(fields, fieldName){
    try{
      if (!fields) return [];
      const k = App.Notes.key(fieldName);
      let v = (fields[k] != null) ? fields[k] : null;

      if (v == null){
        const legs = App.Notes.legacyKeys(fieldName);
        for (let i=0;i<legs.length;i++){
          const kk = legs[i];
          if (fields[kk] != null) { v = fields[kk]; break; }
        }
      }

      if (v == null) return [];
      if (Array.isArray(v)) {
        const out = [];
        for (let i=0;i<v.length;i++){
          const n = normalizeNoteEntry(v[i]);
          if (n) out.push(n);
        }
        return out;
      }

      if (typeof v === "string"){
        const s = v.trim();
        if (!s) return [];
        if (s.startsWith("[")){
          try{ const a = JSON.parse(s); return Array.isArray(a) ? a.map(normalizeNoteEntry).filter(Boolean) : []; }catch(e){ return []; }
        }
        return [{ ts: new Date().toISOString(), text: s }];
      }

      // last resort: try JSON parse
      try{
        const a = JSON.parse(String(v));
        return Array.isArray(a) ? a.map(normalizeNoteEntry).filter(Boolean) : [];
      }catch(e2){}
      return [];
    }catch(e){ return []; }
  };

  App.Notes.has = function(fields, fieldName){
    const log = App.Notes.read(fields, fieldName);
    if (!log || !log.length) return false;
    for (let i=0;i<log.length;i++){
      const it = log[i];
      const t = (it && (it.text != null ? it.text : it.note != null ? it.note : it.value)) ;
      if (t != null && String(t).trim()) return true;
    }
    return false;
  };


})();