/* app_10_table_ui_17.js
   New generic table UI renderer built on FixedTables + FieldTypes.
   Goal: one deterministic rendering path for all fixed tables.
*/
(function(){
  "use strict";
  try { console.info("[TableUI] loaded: app_10_table_ui_50 (set localStorage.USP_DEBUG_NOTES=1 for notes logs)"); } catch(e){}
  window.USP = window.USP || {};
  // Bind USP.App into a stable local alias. Many functions use `App.*`.
  // NOTE: _getApp() is hoisted so it is safe to call here.
  var App = (typeof _getApp === "function") ? _getApp() : null;

  window.USP.UI = window.USP.UI || {};
  var UI = window.USP.UI;

  function getSpec(tabKey){
    if (!App) return null;
    var spec = null;
    try{
      if (typeof App.getFixedTableSpec === "function") spec = App.getFixedTableSpec(tabKey);
    }catch(e1){ spec = null; }
    if (!spec && App.Tabs) {
      try{
        var up = String(tabKey||"").toUpperCase();
        if (App.Tabs[up] && typeof App.getFixedTableSpec === "function") spec = App.getFixedTableSpec(App.Tabs[up]);
      }catch(e2){ spec = null; }
    }
    // last resort: scan FixedTables registry
    if (!spec && App.FixedTables) {
      try{
        for (var k in App.FixedTables){
          if (!App.FixedTables.hasOwnProperty(k)) continue;
          var s = App.FixedTables[k];
          if (!s) continue;
          if (String(s.key||"") === String(tabKey||"")) { spec = s; break; }
        }
      }catch(e3){ spec = null; }
    }
    return spec;
  }

  function safeGetState(){ try{ return (App.getState && App.getState()) || {}; }catch(e){ return {}; } }
  // Notes debug (enable by setting localStorage.USP_DEBUG_NOTES="1")
  function notesDebugEnabled(){
    try{
      if (window && window.localStorage && window.localStorage.getItem("USP_DEBUG_NOTES")==="1") return true;
    }catch(e){}
    try{
      return !!(App && App.Config && App.Config.DEBUG_NOTES);
    }catch(e2){}
    return false;
  }
  function dbgNotes(){
    if (!notesDebugEnabled()) return;
    try{
      var args = Array.prototype.slice.call(arguments);
      args.unshift("[NotesDBG]");
      console.log.apply(console, args);
    }catch(e){}
  }


  function notesKeyFor(fieldName){ return String(fieldName) + "__notes_log"; }
  function cornerKeyFor(fieldName){ return String(fieldName) + "__corner"; }
  function initialsKeyFor(fieldName){ return String(fieldName) + "__initials"; }

  function readNotesLog(fields, fieldName){
    var k = notesKeyFor(fieldName);
    var kLegacy = String(fieldName) + "__notes"; // legacy key (older builds)
    var kCanon = "__notes:" + String(fieldName); // canonical (App.Notes)
    var v = null;
    if (fields){
      if (fields[kCanon] != null) v = fields[kCanon];
      else if (fields[k] != null) v = fields[k];
      else if (fields[kLegacy] != null) v = fields[kLegacy];
    }

    if (v == null) return [];
    if (Array.isArray(v)) return v;

    if (typeof v === "string" && v.trim()) {
      // allow either JSON array or plain text (wrap as one entry)
      if (v.trim().startsWith("[")) {
        try { var a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
      }
      return [{ ts: new Date().toISOString(), text: v.trim() }];
    }

    try{
      var parsed = JSON.parse(String(v));
      if (Array.isArray(parsed)) return parsed;
    }catch(e2){}

    return [];
  }

  function notesHas(fields, fieldName){
    var a = readNotesLog(fields, fieldName) || [];
    if (!a.length) return false;
    for (var i=0;i<a.length;i++){
      var it = a[i] || {};
      var t = (it.text != null) ? it.text : (it.note != null ? it.note : (it.value != null ? it.value : ""));
      if (t != null && String(t).trim()) return true;
    }
    return false;
  }

  function getRows(tabKey, state){
    var st = state || safeGetState();
    // Resolve App late (USP.App may not exist when this file is loaded)
    var AppNow = (window.USP && window.USP.App) ? window.USP.App : (window.App || null);

    function _field(r, key){
      if (!r) return "";
      // common shape: {fields:{...}}
      try{
        if (r.fields && r.fields[key] != null) return r.fields[key];
      }catch(_){}
      try{
        if (r[key] != null) return r[key];
      }catch(_){}
      return "";
    }

    function _initialsFromRow(r){
      // "Mina ToDo" = Beskrivning__initials ONLY (per Dick)
      var v = _field(r, "Beskrivning__initials");
      if (v == null || v === "") v = _field(r, "Beskrivning.initials");
      if (v == null || v === "") v = _field(r, "BeskrivningInitials");
      return (v == null) ? "" : String(v).trim();
    }

    function _meInitials(){
      try{
        if (AppNow && typeof AppNow.getActingUser === "function") {
          var u = AppNow.getActingUser();
          if (u && u.initials) return String(u.initials).trim();
        }
      }catch(_){}
      try{
        if (AppNow && typeof AppNow.getAuthUser === "function") {
          var u2 = AppNow.getAuthUser();
          if (u2 && u2.initials) return String(u2.initials).trim();
        }
      }catch(_){}
      try{
        if (st && st.authUser && st.authUser.initials) return String(st.authUser.initials).trim();
      }catch(_){}
      return "";
    }

    var rows = [];
    try{
      if (AppNow && AppNow.listRows && typeof AppNow.listRows === "function") {
        // listRows(tabKey, state) in USP.App
        try { rows = AppNow.listRows(tabKey, st) || []; }
        catch(e1){ rows = AppNow.listRows(tabKey) || []; }
      } else if (AppNow && AppNow.getRows && typeof AppNow.getRows === "function") {
        rows = AppNow.getRows(tabKey, st) || [];
      } else if (st && st.data && st.data[tabKey]) {
        rows = st.data[tabKey] || [];
      }
    }catch(_){ rows = []; }

    // --- Built-in row filtering based on session state (DEV + TODO) ---
    try{
      var session = (st && st.session) ? st.session : {};
      if (tabKey === "todo") {
        var me = _meInitials();
        var filterCat = (session && session.todoFilterCat != null && session.todoFilterCat !== "") ? String(session.todoFilterCat) : "Alla";
        var onlyMine = !!(session && session.todoOnlyMine);

        rows = (rows || []).filter(function(r){
          var cat = _field(r, "Kategori");
          cat = (cat == null) ? "" : String(cat).trim();
          // Hide other people's private rows unless it's mine (applies for ALL filters)
          if (cat === "Privat" && me) {
            if (_initialsFromRow(r) !== me) return false;
          } else if (cat === "Privat" && !me) {
            // if not logged in / no initials, hide all private
            return false;
          }

          if (onlyMine) {
            return me ? (_initialsFromRow(r) === me) : false;
          }

          if (filterCat === "Alla") return true;
          if (filterCat === "Privat") {
            return (cat === "Privat") && me && (_initialsFromRow(r) === me);
          }
          return cat === filterCat;
        });
      }

      if (tabKey === "dev") {
        var fk = (session && session.devFilterKategori != null && session.devFilterKategori !== "") ? String(session.devFilterKategori) : "Alla";
        var fs = (session && session.devFilterSyfte != null && session.devFilterSyfte !== "") ? String(session.devFilterSyfte) : "Alla";

        rows = (rows || []).filter(function(r){
          var ok = true;
          if (fk !== "Alla") ok = ok && (String(_field(r,"Kategori")||"").trim() === fk);
          if (fs !== "Alla") ok = ok && (String(_field(r,"Syfte")||"").trim() === fs);
          return ok;
        });
      }
    }catch(_){}

    return rows || [];
  }

  function getRowById(tabKey, rowId, state){
    if (!rowId) return null;
    var st = state || safeGetState();
    try{
      // Prefer App.listRows if available (respects archived filtering etc.)
      var appNow = (window.USP && USP.App) ? USP.App : null;
      if (appNow && appNow.listRows && typeof appNow.listRows === "function"){
        var rows = null;
        try { rows = appNow.listRows(tabKey, st) || []; } catch(e1){ rows = appNow.listRows(tabKey) || []; }
        for (var i=0;i<rows.length;i++){ if (rows[i] && rows[i].id === rowId) return rows[i]; }
      }
    }catch(eL){}
    try{
      var data = (st && st.data && typeof st.data === "object") ? st.data : {};
      var key = String(tabKey||"");
      var list = Array.isArray(data[key]) ? data[key] : (Array.isArray(data[key.toLowerCase()]) ? data[key.toLowerCase()] : []);
      for (var j=0;j<list.length;j++){ if (list[j] && list[j].id === rowId) return list[j]; }
    }catch(eD){}
    return null;
  }


  function upsertRow(tabKey, row){
    var appNow = (window.USP && USP.App) ? USP.App : null;
    try{ if (appNow && appNow.upsertRow && typeof appNow.upsertRow === "function") return appNow.upsertRow(tabKey, row); }catch(e){}
  }

  function getSchema(tabKey, state){
    var st = state || safeGetState();
    var schemas = (st && st.schemas) ? st.schemas : {};
    return schemas[tabKey] || schemas[String(tabKey||"").toLowerCase()] || { fields: [] };
  }

  function ensureSchema(tabKey, state){
    try{
      if (App.FixedTables && typeof App.FixedTables.ensureSchema === "function"){
        App.FixedTables.ensureSchema(tabKey, state || safeGetState());
      }
    }catch(e){}
    return getSchema(tabKey, state);
  }

  function setCell(tabKey, row, fieldName, value){
    var cur = row || {};
    var next = {
      id: cur.id,
      createdAt: cur.createdAt,
      updatedAt: new Date().toISOString(),
      archived: !!cur.archived,
      fields: Object.assign({}, cur.fields || {})
    };
    next.fields[String(fieldName||"")] = value;
    upsertRow(tabKey, next);
  }

  function setMeta(tabKey, row, key, value){
    var cur = row || {};
    var next = {
      id: cur.id,
      createdAt: cur.createdAt,
      updatedAt: new Date().toISOString(),
      archived: !!cur.archived,
      fields: Object.assign({}, cur.fields || {})
    };
    next.fields[String(key||"")] = value;
    upsertRow(tabKey, next);
  }

  function setMetas(tabKey, row, kv){
    // IMPORTANT: App.upsertRow REPLACES the whole row object.
    // Therefore we MUST preserve the entire row shape and only update fields.
    var cur = row || {};
    var next = Object.assign({}, cur);
    next.id = cur.id;
    // Preserve createdAt if present; otherwise keep as-is
    if (cur.createdAt != null) next.createdAt = cur.createdAt;
    // Always bump updatedAt deterministically
    next.updatedAt = new Date().toISOString();
    // Ensure archived flag exists if it existed before
    if (cur.archived != null) next.archived = !!cur.archived;

    // Merge fields
    var f = Object.assign({}, (cur.fields || {}));
    try{
      for (var k in kv){
        if (!Object.prototype.hasOwnProperty.call(kv, k)) continue;
        f[String(k||"")] = kv[k];
      }
    }catch(e){}
    next.fields = f;

    // Preserve meta and any other properties (already via Object.assign)
    dbgNotes("setMetas/upsertRow", {tabKey: tabKey, rowId: next.id, keys: Object.keys(kv||{})});
    return upsertRow(tabKey, next);
  }

  function onNotesClick(tabKey, row, fieldName, ev){
    var rowId = (row && row.id) ? row.id : null;
    if (!rowId) return;
    var latest = null;
    try{ latest = getRowById(tabKey, rowId, safeGetState()); }catch(e0){ latest = null; }
    var useRow = latest || row || {};
    var fields = Object.assign({}, (useRow && useRow.fields) || {});
    var existing = readNotesLog(fields, fieldName) || [];
    dbgNotes("open", {tabKey:tabKey,rowId:rowId,field:fieldName, existingCount: existing.length, existingType: (Array.isArray(existing)?'array':typeof existing)});

    // Capture the clicked icon so we can toggle immediately (no reliance on rerender timing)
    var btnEl = null;
    try{
      if (ev && ev.currentTarget && ev.currentTarget.classList) btnEl = ev.currentTarget;
    }catch(e){ btnEl = null; }

    function _hasText(arr){
      var a = Array.isArray(arr) ? arr : [];
      for (var i=0;i<a.length;i++){
        var it = a[i] || {};
        var t = (it.text != null) ? it.text : (it.note != null ? it.note : (it.value != null ? it.value : ""));
        if (t != null && String(t).trim()) return true;
      }
      return false;
    }

    function _applyBtnState(has){
      if (!btnEl) return;
      try{
        btnEl.classList.toggle("is-notes", !!has);
        // Keep inline styling consistent with FieldTypes.renderNotesIcon()
        btnEl.style.cssText = has
          ? "width:20px;height:20px;border-radius:50%;background:transparent;border:2px solid #60a5fa;color:#0f172a;padding:0;font-size:12px;line-height:16px;display:inline-flex;align-items:center;justify-content:center;"
          : "width:20px;height:20px;border-radius:50%;background:transparent;border:1px solid rgba(15,23,42,.35);color:rgba(15,23,42,.55);padding:0;font-size:12px;line-height:18px;display:inline-flex;align-items:center;justify-content:center;";
      }catch(e){}
    }

    // Save callback: supports BOTH onSave("text") and onSave([log,...])
    var onSave = function(payload){
      // Robust persistence: always merge into the *latest* row from state,
      // and always write in a consistent format (array of {ts,title,text,by}).
      function normalizeEntry(it){
        try{
          if (it == null) return null;
          if (typeof it === "string"){
            var s = String(it||"").trim();
            if (!s) return null;
            var first = s.split(new RegExp("\\r?\\n"))[0].slice(0, 60);
            return { ts: new Date().toISOString(), title: first, text: s };
          }
          if (typeof it === "object"){
            var out = Object.assign({}, it);
            var body = (out.text != null) ? out.text : (out.note != null ? out.note : (out.value != null ? out.value : ""));
            out.text = (body != null) ? String(body) : "";
            var head = String(out.title || out.rubrik || out.heading || "").trim();
            if (!head){
              var first2 = String(out.text||"").trim().split(new RegExp("\\r?\\n"))[0].slice(0, 60);
              if (first2) out.title = first2;
            } else {
              out.title = head;
            }
            if (!out.ts) out.ts = new Date().toISOString();
            return out;
          }
        }catch(e){}
        return null;
      }

      function normalizeLog(arr){
        var a = Array.isArray(arr) ? arr : [];
        var out = [];
        for (var i=0;i<a.length;i++){
          var n = normalizeEntry(a[i]);
          if (n) out.push(n);
        }
        return out;
      }

      var nextLog = [];
      if (Array.isArray(payload)) {
        nextLog = normalizeLog(payload);
      } else {
        var t = String(payload || "").trim();
        if (t) {
          var base = normalizeLog(existing);
          base.push(normalizeEntry(t));
          nextLog = base;
        } else {
          nextLog = normalizeLog(existing);
        }
      }

// Build kv once
      var kv = {};
      kv["__notes:" + String(fieldName)] = nextLog;
      kv[notesKeyFor(fieldName)] = nextLog; // compatibility for old readers
      // Keep legacy text key as JSON string for any very old code paths.
      try { kv[String(fieldName) + "__notes"] = JSON.stringify(nextLog); } catch(e2) {}

      // Fetch latest row from state at save-time (avoid stale overwrites)
      var latestRow = null;
      try{ latestRow = getRowById(tabKey, rowId, safeGetState()); }catch(e0){ latestRow = null; }
      var baseRow = latestRow || useRow || row || {};
            setMetas(tabKey, baseRow, kv);
_applyBtnState(_hasText(nextLog));
    };

    // Use UI modal if available
    var UIM = (window.USP && window.USP.UI && typeof window.USP.UI.openNotesModal === "function") ? window.USP.UI.openNotesModal : null;
    var GM = (typeof window.openNotesModal === "function") ? window.openNotesModal : null;
    var open = UIM || GM;
    if (open){
      // Prefer signature (2) to keep the newer Notes UI:
      // - Separate Rubrik + Anteckning inputs
      // - Existing notes listed by title, click to open read-only body
      // This path also uses our onSave() which writes to the correct field keys.
      try{
        open(tabKey, fieldName, existing, onSave, { rowId: rowId, label: String(fieldName || "Anteckning") });
        return;
      }catch(eSig2){}

      // Fallback to legacy signature (1) if the UI modal implementation only supports it.
      try{
        open(tabKey, rowId, fieldName, fieldName);
        return;
      }catch(eSig1){}
    }

    // Minimal fallback: prompt
    var txt = prompt("Notes ("+fieldName+")", (existing||[]).map(function(x){ return (x && x.text) ? x.text : String(x||""); }).join("\n"));
    if (txt == null) return;
    onSave(String(txt));
  }

  function onInitialsClick(tabKey, row, fieldName){
    var fields = Object.assign({}, (row && row.fields) || {});
    var cur = String(fields[initialsKeyFor(fieldName)] || "").trim();
    var save = function(v){
      setMeta(tabKey, row, initialsKeyFor(fieldName), String(v||"").trim());
    };

    var UIP = (window.USP && window.USP.UI && typeof window.USP.UI.openInitialsPicker === "function") ? window.USP.UI.openInitialsPicker : null;
    var GP = (typeof window.openInitialsPicker === "function") ? window.openInitialsPicker : null;
    var pick = UIP || GP;
    if (pick){
      pick(tabKey, row.id, fieldName, cur, save);
      return;
    }

    var v = prompt("Initials", cur);
    if (v == null) return;
    save(v);
  }

  function renderCell(tabKey, row, field){
    var fieldName = String(field && field.name || "");
    var baseType = String(field && (field.type || "text") || "text");
    var registry = field && field.registry ? String(field.registry) : null;
    var mods = (field && field.mods) ? field.mods : {};
    // Ensure initials behaves like Project: right-click opens notes even if mods.notes is not set.
    // Clone to avoid mutating spec objects.
    var mods2 = Object.assign({}, mods);
    if (mods2 && mods2.initials && mods2.notesOnInitialsRightClick == null) mods2.notesOnInitialsRightClick = true;
    // Always resolve notes/value using latest row snapshot when possible (fixes initials-rightclick opening wrong notes after save)
    var latestRow = null;
    try{
      var rowId2 = (row && row.id) ? row.id : null;
      if (rowId2) latestRow = getRowById(tabKey, rowId2, safeGetState());
    }catch(eLR){ latestRow = null; }
    var useRow2 = latestRow || row || {};
    var rowForHandlers = useRow2;
    var fields = (useRow2 && useRow2.fields) ? useRow2.fields : {};

    var notesFieldName = fieldName;
    // Back-compat: older builds stored notes on initials-meta field for initials columns.
    try{
      if (mods2 && mods2.initials) {
        var alt = initialsKeyFor(fieldName);
        var AppX = _getApp();
        var hasBase = (AppX && AppX.Notes && typeof AppX.Notes.has==="function") ? AppX.Notes.has(fields, fieldName) : notesHas(fields, fieldName);
        var hasAlt  = (AppX && AppX.Notes && typeof AppX.Notes.has==="function") ? AppX.Notes.has(fields, alt)      : notesHas(fields, alt);
        if (!hasBase && hasAlt) notesFieldName = alt;
      }
    }catch(eNF){}
    var value = (fields && fields[fieldName] != null) ? fields[fieldName] : "";

    var ctx = {
      type: baseType,
      baseType,
      registry,
      mods: mods2,
      value,
      disabled: false,
      style: field && field.width ? ("width:"+field.width+";min-width:"+field.width+";max-width:"+field.width+";") : "",
      onChange: function(v){ setCell(tabKey, rowForHandlers, fieldName, v); },

      // addons
      cornerValue: fields[cornerKeyFor(fieldName)] || "",
      onCornerChange: (mods2 && mods2.corner) ? function(v){ setMeta(tabKey, rowForHandlers, cornerKeyFor(fieldName), v); } : null,

      notesHas: (function(){ try{ var App=_getApp(); if(App && App.Notes && typeof App.Notes.has==="function") return App.Notes.has(fields, notesFieldName); }catch(e){} return notesHas(fields, notesFieldName); })(),
      onNotesClick: (mods2 && (mods2.notes || mods2.initials || mods2.notesOnInitialsRightClick)) ? function(ev){ onNotesClick(tabKey, rowForHandlers, notesFieldName, ev); } : null,

      initialsValue: fields[initialsKeyFor(fieldName)] || "",
      initialsNotesHas: (mods2 && mods2.initials) ? notesHas(fields, notesFieldName) : false,
      onInitialsClick: (mods2 && mods2.initials) ? function(){ onInitialsClick(tabKey, rowForHandlers, fieldName); } : null,
      // For initials+rightclick notes: var FieldTypes handle right-click via notesOnInitialsRightClick;
      // We still supply onNotesClick so it has a handler.
      onNotesClickForInitials: (mods2 && mods2.notesOnInitialsRightClick) ? function(ev){ onNotesClick(tabKey, rowForHandlers, notesFieldName, ev); } : null
    };

    // If notes are only via initials right-click, expose handler as onNotesClick too.
    if (!ctx.onNotesClick && ctx.onNotesClickForInitials) ctx.onNotesClick = ctx.onNotesClickForInitials;

    try{
      if (window.USP && window.USP.App && window.USP.App.FieldTypes && typeof window.USP.App.FieldTypes.renderEditor === "function"){
        return window.USP.App.FieldTypes.renderEditor(ctx);
      }
    }catch(e){}

    // Fallback input
    var inp = el("input",{value:String(value||""), class:"cell-input"},[]);
    inp.addEventListener("change", function(){ setCell(tabKey, row, fieldName, inp.value); });
    return inp;
  }

  function resolveFixedSpec(tabKey){
    try{
      // 1) Prefer official resolver if present
      if (App.getFixedTableSpec && typeof App.getFixedTableSpec === "function") {
        var s = App.getFixedTableSpec(tabKey);
        if (s && s.columns) return s;
      }
    }catch(e){}
    try{
      if (!App.FixedTables) return null;
      // 2) Direct key lookup (as-is / upper)
      if (App.FixedTables[tabKey] && App.FixedTables[tabKey].columns) return App.FixedTables[tabKey];
      var up = String(tabKey||"").toUpperCase();
      if (App.FixedTables[up] && App.FixedTables[up].columns) return App.FixedTables[up];

      // 3) Match by spec.key (often lower-case like "dev")
      var k = String(tabKey||"");
      for (var name in App.FixedTables){
        var s = App.FixedTables[name];
        if (!s || !s.columns) continue;
        var sk = String(s.key||"");
        if (sk === k) return s;
      }

      // 4) Match by App.Tabs enum value
      if (App.Tabs){
        for (var name in App.FixedTables){
          var s = App.FixedTables[name];
          if (!s || !s.columns) continue;
          if (App.Tabs[name] && App.Tabs[name] === tabKey) return s;
        }
      }
    }catch(e){}
    return null;
  }


  // --- R11: Row Action column for DEV/PRODUCT (Done + Ta bort) ---
  function _getApp(){
    return (window.USP && window.USP.App) ? window.USP.App : (window.App || null);
  }

  function _fmtYMD(d){
    var y=d.getFullYear();
    var m=String(d.getMonth()+1).padStart(2,"0");
    var da=String(d.getDate()).padStart(2,"0");
    return y+"-"+m+"-"+da;
  }

  function _archiveRow(tabKey, rowId){
    var App = _getApp();
    try{
      if (App && typeof App.archiveRow === "function") { App.archiveRow(tabKey, rowId); return; }
    }catch(e){}
    try{
      var st = safeGetState();
      var rows = (App && typeof App.listRows === "function") ? (App.listRows(tabKey, st) || []) : [];
      var r = rows.find(function(x){ return x && x.id === rowId; });
      if (!r) return;
      var next = Object.assign({}, r, { archived: true, updatedAt: new Date().toISOString() });
      if (App && typeof App.upsertRow === "function") App.upsertRow(tabKey, next);
    }catch(e2){}
  }

  
  function _removeRow(tabKey, rowId){
    var App = _getApp();
    // R4 refactor: prefer centralized actions if available
    try{
      if (App && App.Actions && typeof App.Actions.run === "function") {
        App.Actions.run(tabKey, "remove", { id: rowId }, safeGetState());
        return;
      }
    }catch(e){}
    try{
      if (App) {
        if (typeof App.deleteRow === "function") { App.deleteRow(tabKey, rowId); return; }
        if (typeof App.removeRow === "function") { App.removeRow(tabKey, rowId); return; }
      }
    }catch(eDel){}
    // Fallback to archive (soft delete)
    _archiveRow(tabKey, rowId);
  }

function _handleDone(tabKey, row){
    var App = _getApp();
    // R4 refactor: prefer centralized actions if available
    try{
      if (App && App.Actions && typeof App.Actions.run === "function") {
        App.Actions.run(tabKey, "done", row, safeGetState());
        return;
      }
    }catch(e){}
    if (!row) return;
    var ok = window.confirm("Markera som DONE?");
    if (!ok) return;

    try{
      if (App && App.Tabs && tabKey === App.Tabs.DEV) {
        // DEV DONE: remove from DEV (archive) and create a new row in PRODUCT by copying only Produktidé + Kategori
        _archiveRow(tabKey, row.id);

        var newRow = { id: "row_" + Date.now(), createdAt: new Date().toISOString(), fields: {} };

        // Map DEV -> PRODUCT fields
        var devIdea = (row.fields && row.fields["Produktidé"] != null) ? row.fields["Produktidé"] : "";
        var devCat  = (row.fields && row.fields["Kategori"] != null) ? row.fields["Kategori"] : "";

        // In PRODUCT tab, the matching fields are "Produkt" and "Kategori"
        newRow.fields["Produkt"] = (devIdea == null) ? "" : devIdea;
        newRow.fields["Kategori"] = (devCat == null) ? "" : devCat;

        // Ensure schema-aligned empty fields exist (optional but keeps UI stable)
        try{
          var prodSchema = (App && typeof App.getSchema === "function") ? App.getSchema(App.Tabs.PRODUCT, safeGetState()) : null;
          var prodFields = ((prodSchema && prodSchema.fields) ? prodSchema.fields : []).slice();
          prodFields.forEach(function(f){
            var n = String((f && f.name) || "").trim();
            if (!n) return;
            if (!Object.prototype.hasOwnProperty.call(newRow.fields, n)) newRow.fields[n] = "";
          });
        }catch(eS){}

        if (App && typeof App.upsertRow === "function") App.upsertRow(App.Tabs.PRODUCT, newRow);
        return;
      }
    }catch(eD){}

    try{
      if (App && App.Tabs && tabKey === App.Tabs.PRODUCT) { _archiveRow(tabKey, row.id); return; }
    }catch(eP){}

    // Generic fallback: set Done/Klart/Status if present
    try{
      var schema = (App && typeof App.getSchema === "function") ? App.getSchema(tabKey, safeGetState()) : null;
      var flds = (schema && Array.isArray(schema.fields)) ? schema.fields : [];
      var klart = flds.find(function(f){ return f && String(f.name||"").toLowerCase() === "klart"; });
      var status = flds.find(function(f){ return f && String(f.name||"").toLowerCase() === "status"; });
      var next = Object.assign({}, row);
      next.fields = Object.assign({}, row.fields || {});
      if (klart) next.fields[klart.name] = _fmtYMD(new Date());
      else if (status) next.fields[status.name] = "green";
      else next.fields["Done"] = "1";
      if (App && typeof App.upsertRow === "function") App.upsertRow(tabKey, next);
    }catch(eF){}
  }

  function _renderActionSelect(tabKey, row, elFn){
    if (!elFn) {
      elFn = function(tag, attrs, children){
        var node = document.createElement(tag);
        attrs = attrs || {};
        for (var k in attrs){
          if (!attrs.hasOwnProperty(k)) continue;
          if (k === "class") node.className = attrs[k];
          else if (k === "style") node.setAttribute("style", attrs[k]);
          else if (k.slice(0,2) === "on" && typeof attrs[k] === "function") node.addEventListener(k.slice(2), attrs[k]);
          else node.setAttribute(k, attrs[k]);
        }
        (children||[]).forEach(function(ch){
          if (ch == null) return;
          if (typeof ch === "string" || typeof ch === "number") node.appendChild(document.createTextNode(String(ch)));
          else node.appendChild(ch);
        });
        return node;
      };
    }

    var App = _getApp();
    var menu = null;
    try{ if (App && App.Actions && typeof App.Actions.getMenu === "function") menu = App.Actions.getMenu(tabKey) || null; }catch(e){ menu = null; }
    var opts = [ elFn("option", { value: "" }, ["Action"]) ];
    if (menu && Array.isArray(menu) && menu.length) {
      menu.forEach(function(mi){
        if (!mi || !mi.id) return;
        opts.push(elFn("option", { value: String(mi.id) }, [String(mi.label || mi.id)]));
      });
    } else {
      // Legacy fallback (DEV/PRODUCT)
      opts.push(elFn("option", { value: "done" }, ["Done"]));
      opts.push(elFn("option", { value: "remove" }, ["Ta bort"]));
    }
    var sel = elFn("select", { class: "row-actions", onchange: function(ev){
      var v = String((ev && ev.target && ev.target.value) || "");
      if (!v) return;
      try{
        var App = _getApp();
        if (App && App.Actions && typeof App.Actions.run === "function") {
          App.Actions.run(tabKey, v, row, safeGetState());
        } else {
          if (v === "done") _handleDone(tabKey, row);
          else if (v === "remove") _removeRow(tabKey, row.id);
        }
      }catch(e){}
      try{ ev.target.value = ""; }catch(e2){}
    }}, opts);
    return sel;
  }
  // --- end R11 ---

function renderTable(state, tabKey, title){
    // Resolve App late (USP.App may not exist when this file is loaded)
    var App = (window.USP && window.USP.App) ? window.USP.App : (window.App || null);
    // Render table directly from FixedTables spec columns (single source of truth).
    // element factory (prefer existing helpers, else fallback)
    var elFn = (typeof window.el === "function") ? window.el
             : (App && App.DOM && typeof App.DOM.el === "function") ? App.DOM.el
             : null;

    if (!elFn) {
      elFn = function(tag, attrs, children){
        var node = document.createElement(tag);
        attrs = attrs || {};
        for (var k in attrs){
          if (!attrs.hasOwnProperty(k)) continue;
          if (k === "class") node.className = attrs[k];
          else if (k === "style") node.setAttribute("style", attrs[k]);
          else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") node[k.toLowerCase()] = attrs[k];
          else node.setAttribute(k, attrs[k]);
        }
        children = children || [];
        for (var i=0;i<children.length;i++){
          var c = children[i];
          if (c == null) continue;
          if (typeof c === "string" || typeof c === "number") node.appendChild(document.createTextNode(String(c)));
          else node.appendChild(c);
        }
        return node;
      };
    }

    var spec = null;
    try{ if (App && typeof App.getFixedTableSpec === "function") spec = App.getFixedTableSpec(tabKey); }catch(eS1){ spec = null; }
    if (!spec && App && App.FixedTables) { try{ spec = App.FixedTables[tabKey] || null; }catch(eS2){ spec = null; } }
    if (!spec && App && App.FixedTables) { try{ for (var k in App.FixedTables){ if (!App.FixedTables.hasOwnProperty(k)) continue; var s = App.FixedTables[k]; if (s && String(s.key||"") === String(tabKey||"")) { spec = s; break; } } }catch(eS3){ spec = null; } }
    if (!spec || !spec.columns) {
      return elFn("div", { class: "usp-fixed-table usp-empty" }, [
        elFn("div", { class: "hint" }, ["Spec saknas för tab=" + tabKey + " (FixedTables)."])
      ]);
    }

    // Debug: show spec vs schema (expanded) and highlight diffs
    try{
      if (window.__uspTableDebug) {
        var schema = (App && typeof App.getSchema === "function") ? App.getSchema(tabKey, state) : null;
        console.log("[TableUI debug] tab=", tabKey, "spec.key=", spec && spec.key, "spec.version=", spec && spec.version);
        if (spec && spec.columns) {
          try { console.table(spec.columns.map(function(c){ return { name:c.name, type:c.type, mods: JSON.stringify(c.mods||{}) }; })); } catch(e1){}
        }
        if (schema && schema.fields) {
          try { console.table(schema.fields.map(function(f){ return { name:f.name, type:f.type, mods: JSON.stringify(f.mods||{}) }; })); } catch(e2){}
        }
        if (spec && spec.columns && schema && schema.fields) {
          var diffs = [];
          for (var di=0; di<spec.columns.length; di++){
            var c = spec.columns[di];
            var f = schema.fields[di];
            if (!c || !f) continue;
            var cm = JSON.stringify(c.mods||{});
            var fm = JSON.stringify(f.mods||{});
            if (c.name !== f.name || c.type !== f.type || cm !== fm) {
              diffs.push({ idx: di, spec_name: c.name, schema_name: f.name, spec_type: c.type, schema_type: f.type, spec_mods: cm, schema_mods: fm });
            }
          }
          if (diffs.length) {
            console.warn("[TableUI debug] spec/schema diffs:", diffs);
            try { console.table(diffs); } catch(e3){}
          } else {
            console.log("[TableUI debug] spec/schema match (by index).");
          }
        }
      }
    }catch(eDbg){}


    var key = String(spec.key || tabKey || "");

    var showActions = false;
    try{
      var App = _getApp();
      if (App && App.Actions && typeof App.Actions.getMenu === "function") {
        var menu = App.Actions.getMenu(key) || [];
        showActions = Array.isArray(menu) && menu.length > 0;
      } else {
        var kLow = String(key||"").toLowerCase();
        showActions = (kLow === "dev" || kLow === "product");
      }
    }catch(eA){}


    var fields = (spec.columns || []).map(function(c){
      var f = {
        name: c.name,
        type: c.type || "text",
        registry: c.registry || null,
        width: c.width || null,
        key: !!c.key,
        mods: c.mods || {}
      };
      if (typeof f.type === "string" && f.type.indexOf("dropdown_") === 0) {
        if (!f.registry) f.registry = f.type;
      }
      return f;
    });

    // Ensure schema is aligned with FixedTables spec (adds missing fields + mods/meta helpers)
    try { ensureSchema(key, state || safeGetState()); } catch(eEns){}

    // Rows: prefer App.listRows (DB-backed) to avoid relying on state hydration.
    var rows = [];
    try {
      rows = getRows(key, state || safeGetState()) || [];
      // Hide archived rows from main table view
      try{ rows = (rows||[]).filter(function(r){ return !(r && r.archived); }); }catch(eF){}
    } catch(eRows) { rows = []; }

    try{
      if (window.__uspTableDebug) {
        console.log("[TableUI debug] tab=", tabKey, "rows=", rows ? rows.length : 0, "hasListRows=", !!(App && typeof App.listRows === "function"));
      }
    }catch(eRD){}

    if (!rows || !rows.length) {
      return elFn("div", { class: "usp-fixed-table usp-empty" }, [
        elFn("div", { class: "hint" }, ["Inga rader att visa (rows=0)."])
      ]);
    }

    var table = elFn("table", { class: "usp-table" }, []);
    var thead = elFn("thead", {}, []);
    thead.appendChild(elFn("tr", {}, (showActions ? fields.concat([{name:"Action", _action:true}]) : fields).map(function(f){
      var st = f.width ? ("width:"+f.width+";max-width:"+f.width+";") : null;
      return elFn("th", { style: st }, [f.name]);
    })));
    table.appendChild(thead);

    var tbody = elFn("tbody", {}, []);

    (rows || []).forEach(function(row){
      var tr = elFn("tr", {}, []);
      // normalize row to have .fields (legacy flat rows supported)
      var rowObj = row || {};
      var rowFields = (rowObj && rowObj.fields && typeof rowObj.fields === "object") ? rowObj.fields : null;
      if (!rowFields) {
        rowFields = {};
        // copy known field values (flat rows) into fields bag
        for (var fi=0; fi<fields.length; fi++){
          var fnm = fields[fi] && fields[fi].name;
          if (!fnm) continue;
          if (rowObj[fnm] != null) rowFields[fnm] = rowObj[fnm];
        }
        // carry any meta keys if present on flat rows
        for (var mk in rowObj){
          if (!rowObj.hasOwnProperty(mk)) continue;
          if (mk.indexOf("__corner") > 0 || mk.indexOf("__notes") > 0 || mk.indexOf("__initials") > 0) {
            rowFields[mk] = rowObj[mk];
          }
        }
        rowObj = {
          id: rowObj.id,
          createdAt: rowObj.createdAt,
          updatedAt: rowObj.updatedAt,
          archived: !!rowObj.archived,
          fields: rowFields
        };
      }

      fields.forEach(function(f){
        var mods = f.mods || {};
        var isDropdown = (typeof f.type === "string" && f.type.indexOf("dropdown_") === 0);

        // Rule: dropdown_* fields never get Notes addon.
        if (isDropdown) {
          try { mods = Object.assign({}, (mods || {})); } catch(eN) { mods = (mods || {}); }
          try { delete mods.notes; } catch(eN2) { mods.notes = false; }
        }

        var fieldObj = { name: f.name, type: f.type || "text", registry: f.registry || null, width: f.width || null, mods: mods || {} };

        var wrapped = null;
        try { wrapped = renderCell(key, rowObj, fieldObj); } catch(eC) { wrapped = null; }
        if (!wrapped) wrapped = elFn("span", {}, [String((rowObj.fields || {})[f.name] || "")]);

        var st = f.width ? ("width:"+f.width+";max-width:"+f.width+";") : null;
        tr.appendChild(elFn("td", { style: st }, [wrapped]));
      });
      if (showActions) {
        tr.appendChild(elFn("td", {}, [_renderActionSelect(key, rowObj, elFn)]));
      }
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    return elFn("div", { class: "usp-fixed-table" }, [
      table
    ]);
  }

  UI.TableUI = UI.TableUI || {};
  UI.TableUI.renderFixedTable = renderTable;

})();

// === Dropdown debug (enable via localStorage.USP_DEBUG_DROPDOWN="1") ===
(function(){
  try{
    if (!window.localStorage) return;
    if (localStorage.getItem("USP_DEBUG_DROPDOWN") !== "1") return;
  }catch(_){ return; }

  console.warn("[DropDBG] enabled (set localStorage.USP_DEBUG_DROPDOWN=0 to disable)");

  function miniEl(el){
    if (!el || el === document) return "document";
    if (el === window) return "window";
    var s = el.tagName ? el.tagName.toLowerCase() : String(el);
    if (el.id) s += "#" + el.id;
    if (el.classList && el.classList.length) s += "." + Array.from(el.classList).slice(0,3).join(".");
    return s;
  }

  function closestInfo(el){
    if (!el || !el.closest) return {};
    var td = el.closest("td,th");
    var tr = el.closest("tr");
    var table = el.closest("table");
    var info = {};
    if (td){
      info.td = miniEl(td);
      // dump common dataset keys if present
      try{
        var ds = td.dataset || {};
        var keys = Object.keys(ds);
        if (keys.length){
          info.tdDataset = {};
          keys.slice(0,15).forEach(function(k){ info.tdDataset[k] = ds[k]; });
        }
      }catch(_){}
      // also dump attributes that often exist in this app
      ["data-field","data-fieldname","data-col","data-colname","data-rowid","data-row"].forEach(function(a){
        try{
          var v = td.getAttribute && td.getAttribute(a);
          if (v != null) info[a] = v;
        }catch(_){}
      });
      // detect select presence
      try{
        var sel = td.querySelector("select");
        if (sel) info.hasSelectInCell = true;
      }catch(_){}
    }
    if (tr){
      try{
        var dsr = tr.dataset || {};
        if (dsr.rowid) info.trRowId = dsr.rowid;
        if (dsr.id) info.trId = dsr.id;
      }catch(_){}
    }
    if (table) info.table = miniEl(table);
    return info;
  }

  // Patch stopPropagation to see who is swallowing dropdown events
  (function(){
    var sp = Event.prototype.stopPropagation;
    var sip = Event.prototype.stopImmediatePropagation;
    Event.prototype.stopPropagation = function(){
      try{
        var t = this.target;
        if (t && (t.tagName === "SELECT" || (t.closest && t.closest("select")))){
          console.log("[DropDBG] stopPropagation()", this.type, "target=", miniEl(t), closestInfo(t));
        }
      }catch(_){}
      return sp.apply(this, arguments);
    };
    Event.prototype.stopImmediatePropagation = function(){
      try{
        var t = this.target;
        if (t && (t.tagName === "SELECT" || (t.closest && t.closest("select")))){
          console.log("[DropDBG] stopImmediatePropagation()", this.type, "target=", miniEl(t), closestInfo(t));
        }
      }catch(_){}
      return sip.apply(this, arguments);
    };
  })();

  function logEvt(phase, e){
    var t = e.target;
    var info = closestInfo(t);
    var isSel = t && t.tagName === "SELECT";
    var inSel = !isSel && t && t.closest && t.closest("select");
    // Also log interactions inside cells that look like 'Kategori' even if they are not <select>
    var inKategoriCell = false;
    try{
      var td0 = t && t.closest ? t.closest("td,th") : null;
      if (td0){
        var attrs = (td0.getAttribute("data-field") || td0.getAttribute("data-fieldname") || td0.getAttribute("data-col") || td0.getAttribute("data-colname") || "").toLowerCase();
        var txt0 = (td0.textContent || "").toLowerCase();
        if (attrs.includes("kategori") || txt0.includes("kategori")) inKategoriCell = true;
      }
    }catch(_){}
    if (!(isSel || inSel || inKategoriCell)) return;

    // Try to guess if this is Project/Kategori by attributes/text
    var guess = null;
    try{
      var td = t.closest("td,th");
      if (td){
        var txt = (td.getAttribute("data-field") || td.getAttribute("data-fieldname") || td.getAttribute("data-col") || td.getAttribute("data-colname") || "").toLowerCase();
        if (txt.includes("kategori")) guess = "kategori";
      }
    }catch(_){}

    console.log("[DropDBG]", phase, e.type, "target=", miniEl(t), "defaultPrevented=", e.defaultPrevented, "guess=", guess, info);
  }

  // Observe DOM changes to see what editor is being inserted for Kategori
  try{
    var mo = new MutationObserver(function(muts){
      muts.forEach(function(m){
        Array.from(m.addedNodes||[]).forEach(function(n){
          if (!n || !n.querySelector) return;
          var sel = n.matches && n.matches("select") ? n : n.querySelector("select");
          if (!sel) return;
          var td = sel.closest && sel.closest("td,th");
          if (!td) return;
          var a = (td.getAttribute("data-field") || td.getAttribute("data-fieldname") || td.getAttribute("data-col") || td.getAttribute("data-colname") || "").toLowerCase();
          var ttxt = (td.textContent || "").toLowerCase();
          if (a.includes("kategori") || ttxt.includes("kategori")){
            console.log("[DropDBG] select inserted into kategori cell", miniEl(sel), closestInfo(sel));
          }
        });
      });
    });
    mo.observe(document.body, {subtree:true, childList:true});
  }catch(e){
    console.log("[DropDBG] MutationObserver failed", e);
  }

  ["pointerdown","mousedown","click","change"].forEach(function(type){
    document.addEventListener(type, function(e){ logEvt("capture", e); }, true);
    document.addEventListener(type, function(e){ logEvt("bubble", e); }, false);
  });

})();

