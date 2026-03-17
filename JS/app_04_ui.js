
  function computeInitials(u){
    try{
      if (!u) return "";
      const v = String(u.initials || u.short || u.abbr || "").trim();
      if (v) return v;
      const name = String(u.name || u.fullName || u.email || "").trim();
      if (!name) return "";
      const parts = name.split(/\s+/).filter(Boolean);
      const a = (parts[0] || "").charAt(0);
      const b = (parts.length > 1 ? parts[parts.length-1].charAt(0) : "");
      return (a + b).toUpperCase();
    }catch(e){ return ""; }
  }

// [ui v238]
/* app_04_ui_92.js
   USP UI (design-restored via style.css classes)
   - Keeps v60+ deterministic router: tab + role -> view
   - Uses existing CSS classes (.topbar, .tabs, .hero, .table-wrap, etc.)
   - Adds menu: Change user (always available) + Settings + Manage users (admin)
*/
(function () {
  "use strict";

  window.USP = window.USP || {};
  const USP = window.USP;
  const UI = (USP.UI = USP.UI || {});

  // USP debug v14: Robust event tracing with visual indicator.
  // Enable: localStorage.USP_DEBUG_EVENTS="1" then reload.
  (function installUspEventDebugV14(){
    if (window.__uspEventDebugV14Installed) return;
    window.__uspEventDebugV14Installed = true;

    function isOn(){
      try { return String(localStorage.getItem("USP_DEBUG_EVENTS")||"") === "1"; } catch(e) { return false; }
    }

    const on = isOn();
    if (on) {
      console.log("[USP debug v14] enabled (USP_DEBUG_EVENTS=1)");
      try{
        const badge = document.createElement("div");
        badge.textContent = "USP DEBUG ON";
        badge.style.position = "fixed";
        badge.style.right = "8px";
        badge.style.bottom = "8px";
        badge.style.zIndex = "999999";
        badge.style.padding = "4px 8px";
        badge.style.font = "12px/1.2 sans-serif";
        badge.style.background = "rgba(0,0,0,0.75)";
        badge.style.color = "#fff";
        badge.style.borderRadius = "6px";
        badge.style.pointerEvents = "none";
        document.addEventListener("DOMContentLoaded", function(){
          document.body.appendChild(badge);
        });
      }catch(e){}
    }

    function shortEl(el){
      if (!el) return "(null)";
      const tag = (el.tagName||"").toLowerCase();
      const id = el.id ? ("#" + el.id) : "";
      const cls = (el.className && typeof el.className === "string") ? ("." + el.className.trim().split(/\s+/).slice(0,5).join(".")) : "";
      return tag + id + cls;
    }

    function chain(el, limit){
      const out = [];
      let cur = el;
      for (let i=0;i<(limit||10) && cur;i++){
        out.push(shortEl(cur));
        cur = cur.parentElement;
      }
      return out.join(" <- ");
    }

    function log(phase, e){
      if (!on) return;
      try{
        const t = e && e.target;
        const ini = (t && t.closest) ? t.closest(".act-initials, [data-usp-initials='1']") : null;
        const note = (t && t.closest) ? t.closest(".act-notes, [data-usp-notes='1']") : null;
        console.log("[USP debug v14]", {
          phase,
          type: e && e.type,
          button: e && e.button,
          defaultPrevented: !!(e && e.defaultPrevented),
          target: shortEl(t),
          chain: chain(t, 10),
          hasClosestInitials: !!ini,
          closestInitials: shortEl(ini),
          hasClosestNotes: !!note,
          closestNotes: shortEl(note),
          closestButton: (t && t.closest) ? shortEl(t.closest("button")) : "(no closest)",
          actionButton: (t && t.closest) ? shortEl(t.closest("button[data-action]")) : "(none)",
          actionId: (t && t.closest && t.closest("button[data-action]")) ? String(t.closest("button[data-action]").getAttribute("data-action")||"") : "",
          tabAttr: (t && t.closest && t.closest("button[data-action]")) ? String(t.closest("button[data-action]").getAttribute("data-tab")||"") : "",
          tab: (App && typeof App.getTab === "function") ? App.getTab() : "(no App.getTab)",
          time: new Date().toISOString()
        });
      }catch(err){
        console.log("[USP debug v14] error", err);
      }
    }

    const opts = { capture:true, passive:false };
    document.addEventListener("contextmenu", function(e){ log("contextmenu(capture)", e); }, opts);
    document.addEventListener("mousedown", function(e){
      if (!e) return;
      if (e.button === 2) log("mousedown-right(capture)", e);
    }, opts);
    document.addEventListener("click", function(e){ log("click(capture)", e); }, opts);
  })();


  // USP fix v13: Suppress browser context menu on initials and on USP modals (capture phase).
  // This removes the native browser menu that was still appearing in Dev/Project/ToDo.
  (function installUspContextSuppress(){
    if (window.__uspCtxSuppressInstalled) return;
    window.__uspCtxSuppressInstalled = true;

    function suppressIfMatches(e){
      try{
        const t = e && e.target;
        if (!t) return false;

        // 1) If a USP modal overlay is present and user right-clicks it, suppress browser menu.
        const overlay = (t && t.closest) ? t.closest(".usp-modal-overlay") : null;
        if (overlay) {
          e.preventDefault();
          e.stopImmediatePropagation();
          e.stopPropagation();
          return true;
        }

        // 2) Suppress on initials ring/button
        const ini = (t && t.closest) ? t.closest(".act-initials, [data-usp-initials='1'], [data-usp-initials]") : null;
        if (ini) {
          e.preventDefault();
          e.stopImmediatePropagation();
          e.stopPropagation();
          // Prefer explicit handler attached by FieldTypes
          const fn = ini.__uspNotesClick;
          if (typeof fn === "function") {
            try{ fn(e); }catch(err){}
          }
          return true;
        }
      }catch(err){}
      return false;
    }

    document.addEventListener("contextmenu", suppressIfMatches, { capture:true, passive:false });
  })();


// ------------------------
// R4A: TabSpec registry (no behavior change yet)
// Central place to describe per-tab UI/actions/modals. Used in later steps (R4B/R4C).
// NOTE: This step only introduces the registry + helpers; existing rendering remains unchanged.
// ------------------------
if (!USP.UI) USP.UI = {};
USP.UI.TabSpec = USP.UI.TabSpec || (function(){
  // Keys must match App.getTab() values (lowercase)
  return {
    dev: {
      key: "dev",
      label: "Utveckling",
      newRow: { action: "new_row", buttonText: "+ Ny Utveckling", modal: { fields: ["Produktidé","Kategori","Syfte"] } }
    },
    product: {
      key: "product",
      label: "Sälj",
      newRow: { action: "new_row", buttonText: "+ Ny Produkt", modal: { fields: ["Produkt","Kategori"] } }
    },
    project: {
      key: "project",
      label: "Projekt",
      newRow: { action: "new_row", buttonText: "+ Nytt projekt", modal: { fields: ["Projektnamn","Kategori"] } }
    },
    todo: {
      key: "todo",
      label: "ToDo",
      newRow: { action: "new_row", buttonText: "+ Ny ToDo", modal: { fields: ["Kategori","Beskrivning"] } }
    },
    routines: {
      key: "routines",
      label: "Rutiner"
      // intentionally no newRow in R4A
    },
    statistics: {
      key: "statistics",
      label: "Statistik"
      // no newRow for statistics
    }
  };
})();

USP.UI.getTabSpec = function(tabKey){
  try{
    const k = String(tabKey || "").toLowerCase();
    return (USP.UI.TabSpec && USP.UI.TabSpec[k]) ? USP.UI.TabSpec[k] : null;
  }catch(e){ return null; }
};



// R4C: Central tab action dispatcher
USP.UI.dispatchTabAction = function(tabKey, actionId, state){
  try{
    const spec = USP.UI.getTabSpec(tabKey);
    if (!spec) return false;

    if (actionId === "new_row" && spec.newRow && spec.newRow.modal) {
      const wanted = (spec.newRow.modal.fields || []).slice();
      const title = (spec.newRow.buttonText || "Ny rad").replace(/^\+\s*/,"").trim();

      // Resolve requested field names against FixedTables first, then schema.
      // This keeps NyRad aligned with current FixedTables definitions (types/mods/order).
      let onlyFields = wanted;
      try{
        const t = String(tabKey || "").toLowerCase();
        let names = [];
        try{
          let spec = null;
          if (App && App.FixedTables) {
            if (t === "dev" && App.FixedTables.DEV) spec = App.FixedTables.DEV;
            if (t === "product" && App.FixedTables.PRODUCT) spec = App.FixedTables.PRODUCT;
            if (t === "project" && App.FixedTables.PROJECT) spec = App.FixedTables.PROJECT;
          }
          if (spec && Array.isArray(spec.columns)) {
            names = spec.columns.map(c => String((c && c.name) || "").trim()).filter(Boolean);
          }
        }catch(_){}

        if (!names.length) {
          const schema = (USP.App && typeof USP.App.getSchema === "function") ? USP.App.getSchema(tabKey)
                        : ((App && typeof App.getSchema === "function") ? App.getSchema(tabKey) : null);
          names = (schema && Array.isArray(schema.fields)) ? schema.fields.map(f => String((f && f.name) || "").trim()).filter(Boolean) : [];
        }

        const matched = wanted.filter(n => names.includes(String(n).trim()));
        if (matched.length > 0) onlyFields = matched;
      }catch(_){}

      // Keep NyRad limited to the requested visible columns.
      if (String(tabKey || "").toLowerCase() === "product") onlyFields = ["Produkt","Kategori"];
      if (String(tabKey || "").toLowerCase() === "project") onlyFields = ["Projektnamn","Kategori"];
      if (String(tabKey || "").toLowerCase() === "dev") onlyFields = ["Produktidé","Kategori","Syfte"];

      const opts = { title, onlyFields };
      if (String(tabKey).toLowerCase() === "todo") opts.todoNew = true;

      const orm = (USP.App && typeof USP.App.openRowModal === "function") ? USP.App.openRowModal : ((USP.UI && typeof USP.UI.openRowModal === "function") ? USP.UI.openRowModal : ((typeof openRowModal === "function") ? openRowModal : (typeof window.openRowModal === "function" ? window.openRowModal : null)));
      if (orm) {
        try{
          orm(tabKey, opts);
          return true;
        }catch(err){
          try{ console.error("[ui] openRowModal threw", err); }catch(e){}
        }
      } else {
        try{ console.warn("[ui] openRowModal function not found", { tabKey, actionId, hasUSPApp: !!(USP&&USP.App), hasUSPUi: !!(USP&&USP.UI), winHas: (typeof window.openRowModal==="function") }); }catch(e){}
      }
    }
  }catch(e){
  }
  return false;
};

// R4C: Listen for data-action clicks and dispatch
(function installTabActionRouter(){
  if (window.__uspTabActionRouterInstalled) return;
  window.__uspTabActionRouterInstalled = true;

  document.addEventListener("click", function(e){
    try{
      const t = e && e.target;
      if (!t || !t.closest) return;

      // Ignore inside modal
      if (t.closest(".usp-modal-overlay") || t.closest(".usp-modal")) return;

      const btn = t.closest('button[data-action]');
      if (!btn) return;
      const actionId = String(btn.getAttribute("data-action") || "");
      if (!actionId) return;

      const tabAttr = btn.getAttribute("data-tab");
      const tabKey = tabAttr ? String(tabAttr) : ((App && typeof App.getTab === "function") ? App.getTab() : "");
      const st = (App && typeof App.getState === "function") ? App.getState() : null;

      if (USP.UI.dispatchTabAction(tabKey, actionId, st)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }catch(err){}
  }, { capture:true, passive:false });
})();


// R3: Unified new_row router (capture). Avoid relying on button text per-view.
(function installNewRowRouter(){
  if (window.__uspNewRowRouterInstalled) return;
  window.__uspNewRowRouterInstalled = true;

  function currentTab(){
    try { return (App && typeof App.getTab === "function") ? App.getTab() : null; } catch(e){ return null; }
  }

  function isUserTabWithModal(tabKey){
    try {
      return tabKey === App.Tabs.DEV || tabKey === App.Tabs.PRODUCT || tabKey === App.Tabs.PROJECT || tabKey === App.Tabs.TODO;
    } catch(e){ return false; }
  }

  function looksLikeNewRowButton(btn){
    if (!btn) return false;
    // explicit marker (future-proof)
    const a = (btn.getAttribute && (btn.getAttribute("data-action") || "")) || "";
    if (String(a).toLowerCase() === "new_row") return true;

    // Heuristics for existing UI: primary button with "Ny" in label, but not modal Save
    const txt = String(btn.textContent || "").trim().toLowerCase();
    if (!txt) return false;
    if (txt.includes("spara") || txt.includes("save") || txt.includes("cancel") || txt.includes("avbryt")) return false;
    if (txt.includes("arkiv")) return false;
    // "+ ny ..." / "ny ..." / "nytt ..."
    if (txt.includes("ny")) return true;
    return false;
  }

  document.addEventListener("click", function(e){
    try{
      const t = e && e.target;
      if (!t || !t.closest) return;

      // Don't interfere with clicks inside modal
      if (t.closest(".usp-modal-overlay") || t.closest(".usp-modal")) return;

      const tabKey = currentTab();
      if (!tabKey || !isUserTabWithModal(tabKey)) return;

      const btn = t.closest("button");
      if (!btn) return;
      if (!looksLikeNewRowButton(btn)) return;

      // Guard: only treat as new_row if explicitly marked or inside table hero-actions
      const isExplicitNewRow = !!(btn.dataset && btn.dataset.action === "new_row");
      const inHeroActions = !!(btn.closest && btn.closest(".hero-actions"));
      if (!isExplicitNewRow && !inHeroActions) return;

      // Attempt to open modal; if it succeeds, stop legacy behavior.
      const st = (App && typeof App.getState === "function") ? App.getState() : null;
      if (USP && USP.UI && typeof USP.UI.dispatchTabAction === "function" && USP.UI.dispatchTabAction(tabKey, "new_row", st)) {
        e.preventDefault();
        e.stopPropagation();
      }
    }catch(err){}
  }, { capture:true, passive:false });
})();


  // ---------------------------
  // Shared helpers (global scope)
  // ---------------------------
  function tableTitleForTab(tabKey) {
    try {
      if (tabKey === App.Tabs.DEV) return "Utveckling";
      if (tabKey === App.Tabs.PRODUCT) return "Sälj-intro";
      if (tabKey === App.Tabs.TODO) return "ToDo";
      if (tabKey === App.Tabs.PROJECT) return "Projekt";
      if (tabKey === App.Tabs.ROUTINES) return "Rutiner";
      if (tabKey === App.Tabs.SETTINGS) return "Settings";
    } catch(e) {}
    return String(tabKey || "");
  }

  function openInitialsPicker(tabKey, rowId, fieldName, currentValue, onPick) {
    if (typeof closeAnyModal === "function") closeAnyModal();
    const st = (App && App.getState) ? App.getState() : {};
    const users = (App && typeof App.listUsers === "function") ? (App.listUsers(st) || []) : [];
    const title = (tableTitleForTab ? tableTitleForTab(tabKey) : String(tabKey)) + " - " + String(fieldName || "");

    const overlay = el("div", { class: "usp-modal-overlay usp-notes-overlay" }, []);
    const modal = el("div", { class: "usp-modal" }, []);
    modal.appendChild(el("div", { class: "modal-title" }, [title]));

    const list = el("div", { class: "modal-list" }, []);
    let selected = String(currentValue || "").trim() || "--";

    users.forEach(function(u){
      const ini = (u && u.initials) ? String(u.initials) : "";
      if (!ini) return;
      const lab = el("label", { class: "modal-check" }, []);
      const cb = el("input", { type:"checkbox" }, []);
      cb.checked = (ini === selected);
      cb.addEventListener("change", function(){
        if (cb.checked) {
          selected = ini;
          const cbs = list.querySelectorAll("input[type=checkbox]");
          cbs.forEach(function(x){ if (x !== cb) x.checked = false; });
        } else {
          selected = "--";
        }
      });
      const name = (u && u.name) ? String(u.name) : ini;
      lab.appendChild(cb);
      lab.appendChild(el("span", { class:"modal-check-name" }, [ini]));
      list.appendChild(lab);
    });

    const actions = el("div", { class: "modal-actions" }, []);
    const btnCancel = el("button", { class:"btn", type:"button" }, ["Cancel"]);
    const btnSave = el("button", { class:"btn", type:"button" }, ["Save"]);
    btnCancel.addEventListener("click", function(){ overlay.remove(); });
    btnSave.addEventListener("click", function(){
      if (typeof onPick === "function") onPick(selected);
      overlay.remove();
    });
    actions.appendChild(btnCancel);
  
actions.appendChild(btnSave);


    modal.appendChild(list);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  // ---------------------------
  // Settings popover (compact)
  // ---------------------------
  let _settingsOpen = false;
  let _routinesSchemaEnsured = false;
  let _renderTick = 0;
  let _todoRenderedTick = -1;

  function closeSettingsPopover() {
    _settingsOpen = false;
    const elp = document.getElementById("usp-settings-popover");
    if (elp && elp.parentNode) elp.parentNode.removeChild(elp);
    document.removeEventListener("mousedown", onDocMouseDown, true);
    document.removeEventListener("keydown", onDocKeyDown, true);
  }

  function onDocKeyDown(e) {
    if (e && e.key === "Escape") closeSettingsPopover();
  }

  function onDocMouseDown(e) {
    const pop = document.getElementById("usp-settings-popover");
    const btn = document.getElementById("usp-settings-btn");
    if (!pop) return;
    const t = e && e.target ? e.target : null;
    if (t && (pop.contains(t) || (btn && btn.contains(t)))) return;
    closeSettingsPopover();
  }

  function toggleSettingsPopover(state) {
    if (_settingsOpen) { closeSettingsPopover(); return; }
    _settingsOpen = true;
    renderSettingsPopover(state || App.getState());
    document.addEventListener("mousedown", onDocMouseDown, true);
    document.addEventListener("keydown", onDocKeyDown, true);
  }


  // ---------------------------
  // Routine links (fallback config + admin UI + preview modal)
  // ---------------------------
  function getRoutineLinksAllowedMap() {
    try {
      if (window.USP && window.USP.App && window.USP.App.RoutineLinks && window.USP.App.RoutineLinks.allowed) {
        return window.USP.App.RoutineLinks.allowed;
      }
    } catch (e) {}
    // Fallback so feature works even if app_12_routine_links.js is not loaded yet.
    return {
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
    };
  }

  function isRoutineLinkAllowed(tabKey, fieldName) {
    try {
      const t = String(tabKey || "").toLowerCase();
      const f = String(fieldName || "").trim();
      const m = getRoutineLinksAllowedMap();
      return !!(m[t] && m[t][f] && m[t][f].enabled);
    } catch (e) { return false; }
  }

  function getRoutineBindings(state) {
    try {
      const st = state || (App.getState ? App.getState() : null) || {};
      const s = st.settings || {};
      return (s.routineBindings && typeof s.routineBindings === "object") ? s.routineBindings : {};
    } catch (e) { return {}; }
  }

  function setRoutineBindings(nextBindings) {
    try {
      const st = App.getState ? App.getState() : {};
      const next = (App.cloneState ? App.cloneState(st) : JSON.parse(JSON.stringify(st || {})));
      next.settings = next.settings || {};
      next.settings.routineBindings = nextBindings || {};
      next.updatedAt = new Date().toISOString();
      App.commitState(next);
      return true;
    } catch (e) {
      console.error("[RoutineLinks] setRoutineBindings failed", e);
      return false;
    }
  }

  function getRoutineRows(state) {
    try {
      const st = state || (App.getState ? App.getState() : null) || {};
      const rows = st && st.data && Array.isArray(st.data.routines) ? st.data.routines : [];
      return rows.slice();
    } catch (e) { return []; }
  }

  function getRoutineRowLabel(row) {
    try {
      const f = (row && row.fields) ? row.fields : {};
      return String(f.Rutin || f.rutin || f.Name || f.name || f.Titel || row.id || "").trim() || String(row && row.id || "");
    } catch (e) { return ""; }
  }

  function getRoutineRowById(rowId, state) {
    const rows = getRoutineRows(state);
    return rows.find(r => String(r && r.id) === String(rowId)) || null;
  }

  function normRoutineKey(v) {
    try { return String(v == null ? '' : v).trim().toLowerCase().replace(/\s+/g, ' '); } catch (e) { return ''; }
  }

  function resolveRoutineBinding(tabKey, fieldName, state) {
    try {
      const bindings = getRoutineBindings(state);
      const t = String(tabKey || '').toLowerCase();
      const f = String(fieldName || '').trim();
      const tabMap = (bindings && bindings[t] && typeof bindings[t] === 'object') ? bindings[t] : {};
      if (tabMap && Object.prototype.hasOwnProperty.call(tabMap, f) && tabMap[f]) return String(tabMap[f]);
      const want = normRoutineKey(f);
      const keys = Object.keys(tabMap || {});
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (normRoutineKey(k) === want && tabMap[k]) return String(tabMap[k]);
      }
    } catch (e) {}
    return '';
  }

  function findRoutinePdfValue(routineRow) {
    try {
      const fields = (routineRow && routineRow.fields) ? routineRow.fields : {};
      if (fields && fields['Rutin__pdf'] && fields['Rutin__pdf'].dataUrl) return fields['Rutin__pdf'];
      if (fields && fields['Dokument__pdf'] && fields['Dokument__pdf'].dataUrl) return fields['Dokument__pdf'];
      const keys = Object.keys(fields || {});
      for (let i = 0; i < keys.length; i++) {
        const k = keys[i];
        if (String(k).indexOf('__pdf') < 0) continue;
        const v = fields[k];
        if (v && v.dataUrl) return v;
      }
    } catch (e) {}
    return null;
  }

  function resolveRoutineRowForBinding(tabKey, fieldName, state) {
    try {
      const rows = getRoutineRows(state);
      const rid = resolveRoutineBinding(tabKey, fieldName, state);
      if (!rid) return null;
      let row = rows.find(r => String(r && r.id) === String(rid)) || null;
      if (row) return row;
      const want = normRoutineKey(rid);
      row = rows.find(r => normRoutineKey(getRoutineRowLabel(r)) === want) || null;
      return row || null;
    } catch (e) { return null; }
  }

  function openBoundRoutinePdf(tabKey, fieldName, state) {
    try {
      const st = state || (App.getState ? App.getState() : null) || {};
      const rr = resolveRoutineRowForBinding(tabKey, fieldName, st);
      if (!rr) return openRoutineMissingModal();
      const pdfVal = findRoutinePdfValue(rr);
      if (pdfVal && pdfVal.dataUrl) return openPdfViewerModal(pdfVal);
      return openPdfMissingModal();
    } catch (e) {
      try { console.error('[RoutineLinks] openBoundRoutinePdf failed', e); } catch(_) {}
      return openRoutineMissingModal();
    }
  }

  function openRoutinePreviewModal(tabKey, fieldName, routineRow) {
    try {
      closeAnyModal();
      const overlay = el("div", { class: "usp-modal-overlay" }, []);

      function getRoutineSpec() {
        try {
          if (App && typeof App.getFixedTableSpec === "function") {
            const s = App.getFixedTableSpec((App.Tabs && App.Tabs.ROUTINES) ? App.Tabs.ROUTINES : "routines");
            if (s && Array.isArray(s.columns)) return s;
          }
        } catch (_) {}
        try {
          if (App && App.FixedTables) {
            if (App.FixedTables.ROUTINES && Array.isArray(App.FixedTables.ROUTINES.columns)) return App.FixedTables.ROUTINES;
            if (App.FixedTables.routines && Array.isArray(App.FixedTables.routines.columns)) return App.FixedTables.routines;
          }
        } catch (_) {}
        return { columns: [] };
      }

      const spec = getRoutineSpec();
      const cols = (spec && Array.isArray(spec.columns) ? spec.columns : []).map(function(c){
        return {
          name: String((c && c.name) || "").trim(),
          type: String((c && c.type) || "text").trim(),
          registry: (c && c.registry) ? String(c.registry) : null,
          width: (c && c.width) ? String(c.width) : null,
          mods: (c && c.mods) ? (function(){ try { return JSON.parse(JSON.stringify(c.mods)); } catch(e){ return Object.assign({}, c.mods); } })() : {}
        };
      }).filter(function(c){ return !!c.name; });

      const modal = el("div", {
        class: "usp-modal routine-preview-modal",
        style:"width:calc(100vw - 48px) !important;max-width:calc(100vw - 48px) !important;"
      }, []);

      const title = routineRow
        ? ("Rutin – " + getRoutineRowLabel(routineRow))
        : "Rutin";
      modal.appendChild(el("div", { class:"modal-title" }, [title]));

      // Local styling just for the routine preview so the full row fits without scroll.
      modal.appendChild(el("style", {}, [`
        .routine-preview-modal .routine-preview-wrap{margin-top:12px;border:1px solid rgba(17,24,39,.12);border-radius:14px;overflow:hidden;background:#fff;width:100%;max-width:none;}
        .routine-preview-modal .routine-preview-head,
        .routine-preview-modal .routine-preview-row{
          display:grid;
          grid-template-columns:repeat(6, minmax(0, 1fr));
          width:100%;
        }
        .routine-preview-modal .routine-preview-head{
          background:#f8fafc;
          border-bottom:1px solid rgba(17,24,39,.10);
        }
        .routine-preview-modal .routine-preview-head > div{
          padding:9px 10px;
          font-size:12px;
          font-weight:800;
          color:#475569;
          border-right:1px solid rgba(17,24,39,.08);
          min-width:0;
        }
        .routine-preview-modal .routine-preview-head > div:last-child,
        .routine-preview-modal .routine-preview-row > div:last-child{
          border-right:none;
        }
        .routine-preview-modal .routine-preview-row > div{
          padding:8px;
          border-right:1px solid rgba(17,24,39,.08);
          min-width:0;
        }
        .routine-preview-modal .routine-preview-row .act-field{
          width:100%;
          min-width:0 !important;
        }
        .routine-preview-modal .routine-preview-row .act-cell{
          min-width:0 !important;
        }
        .routine-preview-modal .routine-preview-row .act-value-input{
          width:100% !important;
          min-width:0 !important;
          font-size:13px !important;
          padding:6px 10px !important;
        }
        .routine-preview-modal .routine-preview-row .act-date-display,
        .routine-preview-modal .routine-preview-row .week-display,
        .routine-preview-modal .routine-preview-row .quarter-display{
          min-width:0 !important;
          font-size:13px !important;
        }
        .routine-preview-modal .routine-preview-row .pdf-icon{
          width:34px !important;
          height:22px !important;
          font-size:10px !important;
          padding:0 6px !important;
          flex:0 0 auto;
        }
      `]));

      if (routineRow) {
        const fieldsBag = (routineRow && routineRow.fields) ? routineRow.fields : {};
        const fieldTypes = (window.USP && window.USP.App && window.USP.App.FieldTypes) ? window.USP.App.FieldTypes : null;

        const tableWrap = el("div", { class:"routine-preview-wrap" }, []);

        const header = el("div", { class:"routine-preview-head" }, []);
        cols.forEach(function(c){
          header.appendChild(el("div", {}, [c.name]));
        });
        tableWrap.appendChild(header);

        const rowGrid = el("div", { class:"routine-preview-row" }, []);

        function pdfKeyFor(name){ return String(name) + "__pdf"; }

        cols.forEach(function(c){
          const value = (fieldsBag && fieldsBag[c.name] != null) ? fieldsBag[c.name] : "";
          let cellInner = null;

          try {
            if (fieldTypes && typeof fieldTypes.renderEditor === "function") {
              const ctx = {
                type: c.type || "text",
                baseType: c.type || "text",
                registry: c.registry || null,
                mods: c.mods || {},
                value: value,
                disabled: true,
                style: "width:100%;min-width:0;",
                onChange: function(){},
                pdfHas: !!(fieldsBag && fieldsBag[pdfKeyFor(c.name)]),
                onPdfClick: (c.mods && c.mods.pdf) ? function(ev){
                  try{
                    const pdfVal = (fieldsBag || {})[pdfKeyFor(c.name)];
                    const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
                    if (pdfVal && pdfVal.dataUrl) {
                      if (UI && typeof UI.openPdfViewerModal === "function") UI.openPdfViewerModal(pdfVal);
                    } else {
                      if (UI && typeof UI.openPdfMissingModal === "function") UI.openPdfMissingModal();
                    }
                  }catch(_){}
                } : null,
                onPdfUpload: null,
                notesHas: false,
                onNotesClick: null,
                initialsValue: "",
                initialsNotesHas: false,
                onInitialsClick: null,
                onCornerChange: null,
                onRoutineContextmenu: null
              };
              cellInner = fieldTypes.renderEditor(ctx);
            }
          } catch (_) {
            cellInner = null;
          }

          if (!cellInner) {
            cellInner = el("div", {
              style:"padding:6px 10px;min-height:40px;display:flex;align-items:center;min-width:0;"
            }, [String(value == null ? "" : value)]);
          }

          rowGrid.appendChild(el("div", {}, [cellInner]));
        });

        tableWrap.appendChild(rowGrid);
        modal.appendChild(tableWrap);
      } else {
        modal.appendChild(el("div", { class:"hint", style:"margin-top:10px;" }, ["Ingen rutin är kopplad"]));
      }

      const actions = el("div", { class:"modal-actions" }, []);
      const btnClose = el("button", { class:"btn", type:"button" }, ["Stäng"]);
      btnClose.addEventListener("click", function(){ overlay.remove(); });
      actions.appendChild(btnClose);
      modal.appendChild(actions);
      overlay.appendChild(modal);
      overlay.addEventListener("click", function(ev){ if (ev && ev.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      return true;
    } catch (e) {
      console.error("[RoutineLinks] openRoutinePreviewModal failed", e);
      return false;
    }
  }

  function openRoutineMissingModal() {
    try {
      closeAnyModal();
      const overlay = el("div", { class: "usp-modal-overlay" }, []);
      const modal = el("div", { class: "usp-modal", style:"max-width:420px;" }, []);
      modal.appendChild(el("div", { class:"modal-title" }, ["Kopplad rutin"]));
      modal.appendChild(el("div", { class:"hint", style:"margin-top:10px;" }, ["Ingen rutin är kopplad"]));
      const actions = el("div", { class:"modal-actions" }, []);
      const btnClose = el("button", { class:"btn", type:"button" }, ["Stäng"]);
      btnClose.addEventListener("click", function(){ overlay.remove(); });
      actions.appendChild(btnClose);
      modal.appendChild(actions);
      overlay.appendChild(modal);
      overlay.addEventListener("click", function(ev){ if (ev && ev.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      return true;
    } catch (e) {
      console.error("[RoutineLinks] openRoutineMissingModal failed", e);
      return false;
    }
  }

  function openPdfMissingModal() {
    try {
      closeAnyModal();
      const overlay = el("div", { class: "usp-modal-overlay" }, []);
      const modal = el("div", { class: "usp-modal", style:"max-width:420px;" }, []);
      modal.appendChild(el("div", { class:"modal-title" }, ["PDF"]));
      modal.appendChild(el("div", { class:"hint", style:"margin-top:10px;" }, ["Ingen PDF finns"]));
      const actions = el("div", { class:"modal-actions" }, []);
      const btnClose = el("button", { class:"btn", type:"button" }, ["Stäng"]);
      btnClose.addEventListener("click", function(){ overlay.remove(); });
      actions.appendChild(btnClose);
      modal.appendChild(actions);
      overlay.appendChild(modal);
      overlay.addEventListener("click", function(ev){ if (ev && ev.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      return true;
    } catch (e) {
      console.error("[PDF] openPdfMissingModal failed", e);
      return false;
    }
  }

  function openPdfViewerModal(pdfVal) {
    try {
      closeAnyModal();
      const info = pdfVal || {};
      const name = String(info.name || "document.pdf");
      const dataUrl = String(info.dataUrl || "");
      if (!dataUrl) return openPdfMissingModal();

      const overlay = el("div", { class: "usp-modal-overlay" }, []);
      const modal = el("div", { class: "usp-modal", style:"max-width:1400px;width:min(1400px,96vw);height:min(92vh,980px);display:flex;flex-direction:column;" }, []);
      modal.appendChild(el("div", { class:"modal-title" }, [name]));

      const frameWrap = el("div", {
        style:"flex:1;min-height:0;margin-top:10px;border:1px solid rgba(17,24,39,.12);border-radius:14px;overflow:hidden;background:#fff;"
      }, []);
      const iframe = el("iframe", {
        src: dataUrl,
        title: name,
        style:"width:100%;height:100%;min-height:70vh;border:0;background:#fff;"
      }, []);
      frameWrap.appendChild(iframe);
      modal.appendChild(frameWrap);

      const actions = el("div", { class:"modal-actions" }, []);
      const btnOpen = el("button", { class:"btn btn-secondary", type:"button" }, ["Öppna i ny flik"]);
      const btnClose = el("button", { class:"btn", type:"button" }, ["Stäng"]);
      btnOpen.addEventListener("click", function(){
        try { window.open(dataUrl, "_blank"); } catch(_) {}
      });
      btnClose.addEventListener("click", function(){ overlay.remove(); });
      actions.appendChild(btnOpen);
      actions.appendChild(btnClose);
      modal.appendChild(actions);

      overlay.appendChild(modal);
      overlay.addEventListener("click", function(ev){ if (ev && ev.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      return true;
    } catch (e) {
      console.error("[PDF] openPdfViewerModal failed", e);
      return false;
    }
  }

  function openColumnRoutineBindingsModal() {
    try {
      closeSettingsPopover();
      const st = App.getState ? App.getState() : {};
      const allowed = getRoutineLinksAllowedMap();
      const bindings = JSON.parse(JSON.stringify(getRoutineBindings(st) || {}));
      const routineRows = getRoutineRows(st);
      const routineOptions = [{ value:"", label:"-- Ingen koppling --" }]
        .concat(routineRows.map(r => ({ value: String(r.id), label: getRoutineRowLabel(r) })));

      const overlay = el("div", { class:"usp-modal-overlay" }, []);
      const modal = el("div", { class:"usp-modal", style:"max-width:820px;" }, []);
      modal.appendChild(el("div", { class:"modal-title" }, ["Koppla kolumn-rutin"]));
      modal.appendChild(el("div", { class:"hint", style:"margin-bottom:12px;" }, [
        "Välj vilken rutin som ska öppnas via R-badge i vald kolumn."
      ]));

      const wrap = el("div", { style:"display:flex;flex-direction:column;gap:16px;max-height:60vh;overflow:auto;" }, []);

      ["dev","product","project"].forEach(function(tabKey){
        const cols = allowed && allowed[tabKey] ? Object.keys(allowed[tabKey]) : [];
        if (!cols.length) return;

        const card = el("div", {
          style:"border:1px solid rgba(17,24,39,.12);border-radius:14px;padding:12px;background:#fff;"
        }, []);
        const tabLabel = tabKey === "dev" ? "DEV" : (tabKey === "product" ? "PRODUCT" : "PROJECT");
        card.appendChild(el("div", { class:"label", style:"margin-bottom:10px;" }, [tabLabel]));

        cols.forEach(function(fieldName){
          bindings[tabKey] = bindings[tabKey] || {};
          const row = el("div", {
            style:"display:grid;grid-template-columns:170px 1fr auto;gap:10px;align-items:center;margin-bottom:10px;"
          }, []);
          row.appendChild(el("div", { class:"hint", style:"font-weight:700;" }, [fieldName]));

          const sel = el("select", { class:"input full" }, []);
          routineOptions.forEach(function(opt){
            const option = el("option", { value: opt.value }, [opt.label]);
            if (String(bindings[tabKey][fieldName] || "") === String(opt.value || "")) option.selected = true;
            sel.appendChild(option);
          });
          sel.addEventListener("change", function(){
            const v = String(sel.value || "");
            if (v) bindings[tabKey][fieldName] = v;
            else delete bindings[tabKey][fieldName];
          });
          row.appendChild(sel);

          const btnTest = el("button", { class:"btn btn-secondary", type:"button" }, ["Testa"]);
          btnTest.addEventListener("click", function(){
            const localBindings = JSON.parse(JSON.stringify(bindings || {}));
            localBindings[tabKey] = localBindings[tabKey] || {};
            if (sel.value) localBindings[tabKey][fieldName] = String(sel.value);
            else delete localBindings[tabKey][fieldName];
            const fakeState = (App.getState ? App.getState() : st) || st || {};
            const nextState = Object.assign({}, fakeState, { settings: Object.assign({}, (fakeState && fakeState.settings) || {}, { routineBindings: localBindings }) });
            openBoundRoutinePdf(tabKey, fieldName, nextState);
          });
          row.appendChild(btnTest);

          card.appendChild(row);
        });

        wrap.appendChild(card);
      });

      if (!routineRows.length) {
        wrap.appendChild(el("div", {
          style:"border:1px dashed rgba(17,24,39,.18);border-radius:12px;padding:12px;"
        }, [
          el("div", { class:"hint" }, ["Inga rutiner finns ännu. Skapa rutiner först och koppla sedan."])
        ]));
      }

      modal.appendChild(wrap);

      const actions = el("div", { class:"modal-actions" }, []);
      const btnCancel = el("button", { class:"btn", type:"button" }, ["Cancel"]);
      const btnSave = el("button", { class:"btn btn-primary", type:"button" }, ["Save"]);
      btnCancel.addEventListener("click", function(){ overlay.remove(); });
      btnSave.addEventListener("click", function(){
        try {
          setRoutineBindings(bindings);
          overlay.remove();
        } catch (e) {
          console.error("[RoutineLinks] save bindings failed", e);
          try { alert("Kunde inte spara kopplingar"); } catch(_) {}
        }
      });
      actions.appendChild(btnCancel);
      actions.appendChild(btnSave);
      modal.appendChild(actions);

      overlay.appendChild(modal);
      overlay.addEventListener("click", function(ev){ if (ev && ev.target === overlay) overlay.remove(); });
      document.body.appendChild(overlay);
      return true;
    } catch (e) {
      console.error("[RoutineLinks] open bindings modal failed", e);
      return false;
    }
  }

  window.USP = window.USP || {};
  window.USP.UI = window.USP.UI || {};
  window.USP.UI.isRoutineLinkAllowed = isRoutineLinkAllowed;
  window.USP.UI.openRoutinePreviewModal = openRoutinePreviewModal;
  window.USP.UI.openRoutineMissingModal = openRoutineMissingModal;
  window.USP.UI.openPdfMissingModal = openPdfMissingModal;
  window.USP.UI.openPdfViewerModal = openPdfViewerModal;
  window.USP.UI.resolveRoutineBinding = resolveRoutineBinding;
  window.USP.UI.resolveRoutineRowForBinding = resolveRoutineRowForBinding;
  window.USP.UI.openBoundRoutinePdf = openBoundRoutinePdf;
  window.USP.UI.openColumnRoutineBindingsModal = openColumnRoutineBindingsModal;

  function renderSettingsPopover(state) {
    const old = document.getElementById("usp-settings-popover");
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const role = App.role(state);
    const acting = (App.getActingUser ? App.getActingUser(state) : state.user) || null;
    const who = (acting && (acting.name || acting.email)) ? (acting.name || acting.email) : "User";

    const pop = el("div", {
      id:"usp-settings-popover",
      class:"menu",
      style:"position:fixed;top:72px;right:24px;min-width:300px;max-width:420px;padding:14px;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.12);z-index:9999;background:#fff;"
    }, []);

    pop.appendChild(el("div", { class:"label", style:"margin-bottom:6px;" }, ["Settings"]));
    pop.appendChild(el("div", { class:"hint", style:"margin-bottom:12px;" }, [who + " • " + role]));

    const row = el("div", { style:"display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;" }, []);
    if (role === "admin") {
      row.appendChild(el("button", { class:"btn btn-danger", type:"button", onclick: () => {
        if (!confirm("Töm all lokal data (localStorage)? Detta kan inte ångras.")) return;
        try { localStorage.clear(); } catch(e) { console.error(e); }
        location.reload();
      } }, ["Clean local data"]));
      row.appendChild(el("button", { class:"btn btn-secondary", type:"button", onclick: () => {
  try{
    closeSettingsPopover();
    var fn = (window.USP && window.USP.UI && typeof window.USP.UI.openManageUsers === "function") ? window.USP.UI.openManageUsers : (typeof openManageUsers === "function" ? openManageUsers : null);
    if (!fn) { console.error("[ui] openManageUsers not available"); return; }
    fn(App.getState());
  }catch(e){
    console.error("[ui] Manage users click failed", e);
    try{ alert("Manage users failed: " + (e && e.message ? e.message : e)); }catch(_){ }
  }
} }, ["Manage users"]));
      row.appendChild(el("button", { class:"btn btn-secondary", type:"button", onclick: () => {
  try{
    closeSettingsPopover();
    var fn = (window.USP && window.USP.UI && typeof window.USP.UI.openColumnRoutineBindingsModal === "function") ? window.USP.UI.openColumnRoutineBindingsModal : null;
    if (!fn) { console.error("[ui] openColumnRoutineBindingsModal not available"); return; }
    fn();
  }catch(e){
    console.error("[ui] Koppla kolumn-rutin click failed", e);
    try{ alert("Koppla kolumn-rutin failed: " + (e && e.message ? e.message : e)); }catch(_){ }
  }
} }, ["Koppla kolumn-rutin"]));
    }
    row.appendChild(el("button", { class:"btn btn-secondary", type:"button", onclick: () => { closeSettingsPopover(); if (App.toggleUser) App.toggleUser(); } }, ["Change user (Dick ↔ Benny)"]));
    pop.appendChild(row);

    document.body.appendChild(pop);
  }
  const App = USP.App;

  // =============================
  // VERSION 200
  // Fixed Tables Registry
  // =============================
  const FIXED_TABLES = {};

  function registerFixedTables() {
    if (FIXED_TABLES._initialized) return;
    FIXED_TABLES._initialized = true;

    if (App && App.Tabs) {
      if (App.Tabs.TODO) {
        FIXED_TABLES[App.Tabs.TODO] = {
          type: "todo"
        };
      }
      if (App.Tabs.PROJECT) {
        FIXED_TABLES[App.Tabs.PROJECT] = { type: "project" };
      }
      if (App.Tabs.ROUTINES) {
        FIXED_TABLES[App.Tabs.ROUTINES] = {
          type: "routines"
        };
      }
    }
  }



  
// ---------------------------
// Fixed Rutiner schema (Rutin + Steg1..Steg5, text + notes)
// VERSION 95
// ---------------------------
let _fixingRoutinesSchema = false;

function fixedRoutinesSchema() {
  const cols = Object.keys(fields || {});
  return {
    version: 1,
    fields: cols.map((name, i) => ({
      id: "r_" + i,
      order: i,
      name,
      type: "text",
      mods: { pdf: true }
    }))
  };
}

function ensureFixedRoutinesSchema(tabKey, state) {
  try {
    if (App.FixedTables && typeof App.FixedTables.ensureSchema === "function") {
      App.FixedTables.ensureSchema(tabKey, state);
    }
  } catch (e) {
    console.warn("ensureFixedRoutinesSchema failed", e);
  }
}


// ---------------------------
// Fixed ToDo schema (Kategori, Beskrivning, Klart)
// VERSION 99
// ---------------------------
function fixedTodoSchema() {
  return {
    version: 1,
    fields: [
      { id:"t_0", order:0, name:"Kategori", type:"todokategori", mods:{} },
      { id:"t_1", order:1, name:"Beskrivning", type:"text", mods:{ initials:true, notes:true, notesOnInitialsRightClick:true } },
      { id:"t_2", order:2, name:"Klart", type:"date", mods:{} },
    ]
  };
}

let _fixingTodoSchema = false;
function ensureFixedTodoSchema(tabKey, state) {
  try {
    if (App.FixedTables && typeof App.FixedTables.ensureSchema === "function") {
      App.FixedTables.ensureSchema(tabKey, state);
    }
  } catch (e) {
    console.warn("ensureFixedTodoSchema failed", e);
  }
}



// ---------------------------
// Fixed Projekt schema (Projektnamn, Kategori, Start, Aktuell, Nästa, Kommande, Slut)
// VERSION 226
// ---------------------------
function fixedProjectSchema() {
  return {
    version: 1,
    fields: [
      { id:"p_0", order:0, name:"Projektnamn", type:"text", mods:{ initials:true, notes:true, notesOnInitialsRightClick:true } },
      { id:"p_1", order:1, name:"Kategori", type:"projektkategori", mods:{} },
      { id:"p_2", order:2, name:"Start", type:"date", mods:{} },
      { id:"p_3", order:3, name:"Aktuell", type:"text", mods:{ initials:true, notes:true, notesOnInitialsRightClick:true, corner:true } },
      { id:"p_4", order:4, name:"Nästa", type:"text", mods:{ initials:true, notes:true, notesOnInitialsRightClick:true } },
      { id:"p_5", order:5, name:"Kommande", type:"text", mods:{ initials:true, notes:true, notesOnInitialsRightClick:true } },
      { id:"p_6", order:6, name:"Slut", type:"date", mods:{} },
    ]
  };
}

let _fixingProjectSchema = false;
function ensureFixedProjectSchema(tabKey, state) {
  try {
    if (App.FixedTables && typeof App.FixedTables.ensureSchema === "function") {
      App.FixedTables.ensureSchema(tabKey, state);
    }
  } catch (e) {
    console.warn("ensureFixedProjectSchema failed", e);
  }
}



const TODO_CATEGORIES = (function(){
    const cfgCats =
      (App.Config && App.Config.registers && App.Config.registers.todokategori) ? App.Config.registers.todokategori :
      (App.Config && App.Config.DEFAULT_REGISTRIES && App.Config.DEFAULT_REGISTRIES.todokategori) ? App.Config.DEFAULT_REGISTRIES.todokategori :
      (App.Config && App.Config.todokategori) ? App.Config.todokategori :
      null;
    const base = Array.isArray(cfgCats) ? cfgCats : ["Allmänt","Info","Sälj/Marknad","Shopify-B2C/B2B","Logistik","Privat"];
    const a = base.map(v => (v==null ? "" : String(v)).trim()).filter(v => v && v !== "Alla");
    const seen = {};
    return a.filter(v => (seen[v] ? false : (seen[v]=true)));
  })();

function isoWeek(d) {
  const dt = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = dt.getUTCDay() || 7;
  dt.setUTCDate(dt.getUTCDate() + 4 - day);
  const yearStart = new Date(Date.UTC(dt.getUTCFullYear(), 0, 1));
  return Math.ceil((((dt - yearStart) / 86400000) + 1) / 7);
}

function weekRangeMondaySunday(d) {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = x.getDay() || 7; // Mon=1..Sun=7
  const monday = new Date(x); monday.setDate(x.getDate() - (day - 1));
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6);
  function fmt(dt) {
    const yyyy = dt.getFullYear();
    const mm = String(dt.getMonth()+1).padStart(2,"0");
    const dd = String(dt.getDate()).padStart(2,"0");
    return `${yyyy}-${mm}-${dd}`;
  }
  return { monday, sunday, from: fmt(monday), to: fmt(sunday) };
}

function todoOwnerKey() {
  const u = (App.getActingUser ? App.getActingUser(App.getState()) : null) || {};
  return String(u.email || u.id || "");
}

function todoWeekHousekeeping(state) {
  const st = state || App.getState();
  const now = new Date();
  const w = isoWeek(now);
  const prev = Number((st.session && st.session.todoWeek) || 0);
  if (prev === w) return;

  // When week changes: archive all green rows
  if (prev > 0) {
    const rows = (App.listRows(App.Tabs.TODO, st) || []);
    rows.forEach(r => {
      if (r && !r.archived && r.meta && r.meta.green) {
        App.archiveRow(App.Tabs.TODO, r.id);
      }
    });
  }

  // persist new week number
  const next = App.getState();
  next.session = next.session || {};
  next.session.todoWeek = w;
  App.commitState(next);
}

function isOverdueDate(val) {
  if (!val) return false;
  const d = new Date(String(val));
  if (isNaN(d.getTime())) return false;
  const now = new Date();
  // Compare date-only
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  return dd < today;
}


// ---------------------------
  // Field type registry integration (Admin schema dropdown)
  // ---------------------------
  function getFieldTypeOptions() {
    try {
      if (App.FieldTypes && typeof App.FieldTypes.list === "function") {
        const list = App.FieldTypes.list() || [];
        return list.map(x => ({ value: x.key, label: x.label }));
      }
    } catch (e) {}
    return [
      { value:"text", label:"Text" },
      { value:"date", label:"Datum" },
      { value:"week", label:"Vecka" },
      { value:"status", label:"Status" },
    ];
  }

  function makeTypeConfigEditor(field, onChange) {
    const f = field || {};
    const mods = (f.mods && typeof f.mods === "object") ? f.mods : {};
    const base = String(f.type || "text");

    const bases = (App.FieldTypes && App.FieldTypes.listBase) ? App.FieldTypes.listBase() : [
      { key:"text", label:"Text" },{ key:"status", label:"Status" },{ key:"date", label:"Datum" },{ key:"week", label:"Vecka" },{ key:"produktkategori", label:"Produktkategori" }
    ];
    const modsList = (App.FieldTypes && App.FieldTypes.listMods) ? App.FieldTypes.listMods() : [
      { key:"corner", label:"Hörnmarkör" },{ key:"initials", label:"Initialer" },{ key:"notes", label:"Notes" }
    ];

    const baseSel = el("select", { class: inputClass() }, []);
    bases.forEach(b => {
      const opt = el("option", { value: b.key }, [b.label]);
      if (String(b.key) === String(base)) opt.selected = true;
      baseSel.appendChild(opt);
    });
    baseSel.addEventListener("change", function () {
      const next = Object.assign({}, f, { type: baseSel.value });
      if (typeof onChange === "function") onChange(next);
    });

    const modsWrap = el("div", { style:"display:flex;gap:10px;flex-wrap:wrap;align-items:center;" }, []);
    modsList.forEach(m => {
      const id = "m_" + m.key + "_" + Math.random().toString(16).slice(2);
      const cb = el("input", { type:"checkbox", id:id }, []);
      cb.checked = !!mods[m.key];

      cb.addEventListener("change", function () {
        const nextMods = Object.assign({}, (f.mods || {}), { [m.key]: cb.checked });
        // remove false flags
        Object.keys(nextMods).forEach(k => { if (!nextMods[k]) delete nextMods[k]; });
        const next = Object.assign({}, f, { mods: nextMods });
        if (typeof onChange === "function") onChange(next);
      });

      const lab = el("label", { for:id, style:"display:flex;gap:6px;align-items:center;cursor:pointer;" }, [
        cb, el("span", { class:"muted", text: m.label }, [])
      ]);
      modsWrap.appendChild(lab);
    });

    const grid = el("div", { style:"display:grid;grid-template-columns: 1fr 2fr;gap:12px;align-items:start;" }, [
      el("div", {}, [ baseSel ]),
      modsWrap
    ]);

    return grid;
  }


  function makeModCheckbox(field, modKey, onChange) {
    const f = field || {};
    const mods = (f.mods && typeof f.mods === "object") ? f.mods : {};
    const cb = el("input", { type:"checkbox" }, []);
    cb.checked = !!mods[modKey];
    cb.addEventListener("change", function () {
      const nextMods = Object.assign({}, mods, { [modKey]: cb.checked });
      Object.keys(nextMods).forEach(k => { if (!nextMods[k]) delete nextMods[k]; });
      const next = Object.assign({}, f, { mods: nextMods });
      if (typeof onChange === "function") onChange(next);
    });
    return el("div", { style:"display:flex;justify-content:center;align-items:center;" }, [cb]);
  }


  function makeTypeSelect(current, onChange, full) {
    const opts = getFieldTypeOptions();
    const sel = el("select", { class: full ? "input full" : "input" }, []);
    opts.forEach(o => {
      const opt = el("option", { value:o.value }, [o.label]);
      if (String(o.value) === String(current)) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => { if (typeof onChange === "function") onChange(sel.value); });
    return sel;
  }


  function currentInitials() {
    try {
      const st = App.getState ? App.getState() : {};
      const cand = [
        st.currentUser && st.currentUser.initials,
        st.user && st.user.initials,
        st.session && st.session.user && st.session.user.initials,
        st.auth && st.auth.user && st.auth.user.initials,
        st.authUser && st.authUser.initials,
      ].filter(Boolean)[0];
      return String(cand || "??");
    } catch (e) { return "??"; }
  }


  function cornerKeyFor(fieldName) { return String(fieldName) + "__corner"; }
  function initialsKeyFor(fieldName) { return String(fieldName) + "__initials"; }

  function listAvailableInitials() {
    try {
      const st = App.getState ? App.getState() : {};
      const users = (st && (st.users || (st.auth && st.auth.users) || (st.settings && st.settings.users))) || [];
      const arr = Array.isArray(users) ? users : [];
      const ini = arr.map(u => (u && (u.initials || u.ini)) ? String(u.initials || u.ini).trim() : "").filter(Boolean);
      // fall back to two demo users
      const fallback = ["DE","BB"];
      const out = (ini.length ? ini : fallback);
      // unique
      return Array.from(new Set(out));
    } catch (e) { return ["DE","BB"]; }
  }

  function promptPickInitials(current) {
    const list = listAvailableInitials();
    const msg = "Välj initialer:\n" + list.map((x,i)=> (i+1)+": "+x).join("\n") + "\n\nSkriv nummer eller initialer. Tomt = --";
    const v = window.prompt(msg, String(current || ""));
    if (v === null) return null;
    const t = String(v || "").trim();
    if (!t) return "--";
    const n = parseInt(t, 10);
    if (Number.isFinite(n) && n >= 1 && n <= list.length) return list[n-1];
    return t.toUpperCase();
  }

  function notesKeyFor(fieldName) { return String(fieldName) + "__notes_log"; }

  function readNotesLog(fields, fieldName) {
    const k = notesKeyFor(fieldName);
    const kLegacy = String(fieldName) + "__notes"; // legacy key (older builds)
    const v = fields ? (fields[k] != null ? fields[k] : fields[kLegacy]) : null;

    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim()) {
      // allow either JSON array or plain text (wrap as one entry)
      if (v.trim().startsWith("[")) {
        try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
      }
      return [{ ts: new Date().toISOString(), text: v.trim() }];
    }
    return [];
  }

  function writeNotesLog(fields, fieldName, logArr) {
    const k = notesKeyFor(fieldName);
    const kLegacy = String(fieldName) + "__notes";
    const arr = Array.isArray(logArr) ? logArr : [];
    fields[k] = arr;
    // keep legacy in sync as string (best-effort)
    try { fields[kLegacy] = JSON.stringify(arr); } catch (e) {}
  }

  function formatNotesLog(logArr) {
    const a = Array.isArray(logArr) ? logArr : [];
    if (!a.length) return "";
    return a.map((x) => {
      const ts = x && x.ts ? String(x.ts) : "";
      const by = x && x.by ? String(x.by) : "";
      const txt = x && x.text ? String(x.text) : "";
      return (ts ? ts : "") + (by ? " " + by : "") + (txt ? "\n" + txt : "");
    }).join("\n\n---\n\n");
  }

  
  function openNotesModal(tabKey, a, b, c, d) {
    // Backwards-compatible Notes modal.
    // Supports:
    // 1) openNotesModal(tabKey, rowId, displayField, storageField)
    // 2) openNotesModal(tabKey, fieldName, existingLog, onSave, opts)
    if (typeof a === "string" && (Array.isArray(b) || typeof c === "function")) {
  // Signature (2)
  const fieldName = a;
  const existingLog = Array.isArray(b) ? b : [];
  const onSave = (typeof c === "function") ? c : null;
  const opts = d || {};
  // Do NOT close other modals (e.g. NyRad). Only close existing Notes overlays.
  try {
    document.querySelectorAll('.usp-notes-overlay').forEach(function(el){ try{ el.remove(); }catch(e){} });
  } catch(e) {}

  function entryTitle(it){
    try{
      if (!it) return "Anteckning";
      const t = String(it.title || it.rubrik || it.heading || "").trim();
      if (t) return t;
      const body = String(it.text || it.note || it.value || "").trim();
      if (!body) return "Anteckning";
      return body.split(/\r?\n/)[0].slice(0, 60);
    }catch(e){ return "Anteckning"; }
  }
  function entryBody(it){
    try{ return String((it && (it.text || it.note || it.value)) || "").trim(); }catch(e){ return ""; }
  }
  function openReadOnlyEntry(it){
    try{
      const t = entryTitle(it);
      const overlay2 = el("div", { class: "usp-modal-overlay usp-notes-overlay" }, []);
      const modal2 = el("div", { class: "usp-modal" }, []);
      modal2.appendChild(el("div", { class:"modal-title" }, [t]));
      const body = entryBody(it);
      modal2.appendChild(el("pre", { class:"modal-notes-pre", style:"white-space:pre-wrap;background:#fff;border:1px solid rgba(17,24,39,.15);border-radius:12px;padding:12px;max-height:45vh;overflow:auto;" }, [body || ""]));
      const actions2 = el("div", { class:"modal-actions" }, []);
      const btnClose2 = el("button", { class:"btn", type:"button" }, ["Stäng"]);
      btnClose2.addEventListener("click", function(){ overlay2.remove(); });
      actions2.appendChild(btnClose2);
      modal2.appendChild(actions2);
      overlay2.appendChild(modal2);
      overlay2.addEventListener("click", function(e){ if (e && e.target === overlay2) overlay2.remove(); });
      document.body.appendChild(overlay2);
      return;
    }catch(e){}
  }

  const label = String((opts && opts.label) ? opts.label : (fieldName || "Anteckning"));
  const parts = [tableTitleForTab(tabKey)];
  if (opts && opts.rowName) parts.push(String(opts.rowName));
  parts.push(label);
  const title = parts.join(" – ");

  const readOnly = !!(opts && opts.readOnly);
  const overlay = el("div", { class: "usp-modal-overlay" }, []);
  const modal = el("div", { class: "usp-modal" }, []);
  modal.appendChild(el("div", { class: "modal-title" }, [title]));

  // Existing notes: show titles as clickable rows (read-only view)
  if (existingLog && existingLog.length) {
    const existing = el("div", { class: "modal-notes-existing" }, []);
    existing.appendChild(el("div", { class:"modal-notes-label" }, ["Befintliga anteckningar:"]));

    const list = el("div", { class:"modal-notes-list", style:"display:flex;flex-direction:column;gap:8px;margin-top:8px;" }, []);
    (existingLog || []).slice().reverse().forEach(function(it){
      const t = entryTitle(it);
      const btn = el("button", { type:"button", class:"btn btn-secondary", style:"text-align:left;justify-content:flex-start;" }, [t]);
      btn.addEventListener("click", function(e){
        try{ e.preventDefault(); e.stopPropagation(); }catch(_){}
        openReadOnlyEntry(it);
      });
      list.appendChild(btn);
    });
    existing.appendChild(list);
    modal.appendChild(existing);
  }

  if (!readOnly) {
    // New note inputs: Rubrik + Anteckning
    const rub = el("input", { class:"input full", placeholder:"Rubrik...", type:"text" }, []);
    const ta = el("textarea", { class:"modal-textarea", rows:"6", placeholder:"Skriv anteckning..." }, []);
    modal.appendChild(el("div", { class:"label", style:"margin-top:10px;" }, ["Rubrik"]));
    modal.appendChild(rub);
    modal.appendChild(el("div", { class:"label", style:"margin-top:10px;" }, ["Anteckning"]));
    modal.appendChild(ta);

    const actions = el("div", { class: "modal-actions" }, []);
    const btnCancel = el("button", { class:"btn", type:"button" }, ["Cancel"]);
    const btnSave = el("button", { class:"btn", type:"button" }, ["Save"]);
    btnCancel.addEventListener("click", function(){ overlay.remove(); });
    btnSave.addEventListener("click", function(){
      const body = String(ta.value || "").trim();
      const head = String(rub.value || "").trim();
      if (!body && !head) { overlay.remove(); return; }

      const entry = {
        ts: new Date().toISOString(),
        by: (typeof currentInitials === "function") ? String(currentInitials() || "").trim() : "",
        title: head,
        text: body
      };

      const nextLog = (Array.isArray(existingLog) ? existingLog.slice() : []);
      nextLog.push(entry);

      // Call onSave in a backwards-compatible way.
      if (onSave) {
        try { onSave(nextLog); }
        catch (e1) { try { onSave(body); } catch (e2) {} }
      }
      overlay.remove();
    });
    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);
    modal.appendChild(actions);

    try { rub.focus(); } catch(e){}
  } else {
    const actions = el("div", { class: "modal-actions" }, []);
    const btnClose = el("button", { class:"btn", type:"button" }, ["Stäng"]);
    btnClose.addEventListener("click", function(){ overlay.remove(); });
    actions.appendChild(btnClose);
    modal.appendChild(actions);
  }

  overlay.appendChild(modal);
  overlay.addEventListener("click", function(e){
    if (e && e.target === overlay) overlay.remove();
  });
  document.body.appendChild(overlay);
  return;
}

// Signature (1)
    const rowId = a;
    const displayField = b;
    const storageField = c;

    const fieldName = storageField || displayField;
    const rows = (typeof App.listRows === "function") ? (App.listRows(tabKey) || []) : [];
    const row = (rows || []).find(r => r && String(r.id) === String(rowId)) || null;
    if (!row) return;

    // Row label (best effort)
    let rowName = "";
    try{
      const spec = (App.getFixedTableSpec ? App.getFixedTableSpec(tabKey) : null) || null;
      const firstCol = (spec && spec.columns && spec.columns[0]) ? spec.columns[0].name : "";
      rowName = (row && row.fields && firstCol) ? String(row.fields[firstCol] || "").trim() : "";
    }catch(e){}

    closeAnyModal();

    const colTitle = String(displayField || fieldName || "Anteckning");
    const parts = [tableTitleForTab(tabKey)];
    if (rowName) parts.push(rowName);
    parts.push(colTitle);
    const title = parts.join(" – ");

    // Existing notes log
    const existingLog = readNotesLog((row && row.fields) ? row.fields : {}, fieldName);

    const overlay = el("div", { class: "usp-modal-overlay" }, []);
    const modal = el("div", { class: "usp-modal" }, []);
    const h = el("div", { class: "modal-title" }, [title]);

    const existing = el("div", { class: "modal-notes-existing" }, []);
    if (existingLog && existingLog.length) {
      existing.appendChild(el("div", { class:"modal-notes-label" }, ["Befintliga anteckningar:"]));
      existing.appendChild(el("pre", { class:"modal-notes-pre" }, [formatNotesLog(existingLog)]));
    }

    const ta = el("textarea", { class:"modal-textarea", rows:"5", placeholder:"Skriv anteckning..." }, []);

    const actions = el("div", { class: "modal-actions" }, []);
    const btnCancel = el("button", { class:"btn", type:"button" }, ["Cancel"]);
    const btnSave = el("button", { class:"btn", type:"button" }, ["Save"]);

    btnCancel.addEventListener("click", function(){ overlay.remove(); });

    btnSave.addEventListener("click", function(){
      const t = String(ta.value || "").trim();
      if (!t) { overlay.remove(); return; }

      const st = (typeof App.getState === "function") ? App.getState() : null;
      const cur = getRowSafe(tabKey, rowId, st) || row;
      if (!cur) { overlay.remove(); return; }

      const nextRow = Object.assign({}, cur, {
        updatedAt: new Date().toISOString(),
        fields: Object.assign({}, cur.fields || {})
      });

      const log = readNotesLog(nextRow.fields, fieldName);
      log.push({ ts: new Date().toISOString(), by: currentInitials(), text: t });
      writeNotesLog(nextRow.fields, fieldName, log);

      if (typeof App.upsertRow === "function") App.upsertRow(tabKey, nextRow);
      overlay.remove();
    });

    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);

    modal.appendChild(h);
    if (existingLog && existingLog.length) modal.appendChild(existing);
    modal.appendChild(ta);
    modal.appendChild(actions);
    overlay.appendChild(modal);

    overlay.addEventListener("click", function(e){
      if (e && e.target === overlay) overlay.remove();
    });

    document.body.appendChild(overlay);
    try { ta.focus(); } catch(e) {}
  }



// ===== R3: Row modal (Cancel/Save) for selected tabs (GLOBAL) =====
function openRowModal(tabKey, opts) {
  const st = App.getState();
  try { if (App.FixedTables && typeof App.FixedTables.ensureSchema === "function") App.FixedTables.ensureSchema(tabKey, st); } catch(e) {}
  const st2 = App.getState();
  const schema = App.getSchema(tabKey, st2) || { fields: [] };
let fieldsAll = sortFields(schema.fields || []);
  // For fixed tables (DEV/PRODUCT/PROJECT), build modal fields directly from FixedTables spec.
  // This avoids relying on state schema sync in the modal flow and guarantees hidden default-columns exist.
  try {
    const t = String(tabKey||"").toLowerCase();
    let spec = null;
    if (t === "dev" && App.FixedTables && App.FixedTables.DEV) spec = App.FixedTables.DEV;
    if (t === "product" && App.FixedTables && App.FixedTables.PRODUCT) spec = App.FixedTables.PRODUCT;
    if (t === "project" && App.FixedTables && App.FixedTables.PROJECT) spec = App.FixedTables.PROJECT;

    if (spec && Array.isArray(spec.columns)) {
      const cols = spec.columns;
      const specFields = cols.map((c, i) => {
        const f = {
          id: "fx_" + t + "_" + i,
          order: i,
          name: String((c && c.name) || "").trim(),
          type: String((c && c.type) || "text").trim(),
          mods: (c && c.mods) ? (function(){ try { return JSON.parse(JSON.stringify(c.mods)); } catch(e){ return Object.assign({}, c.mods); } })() : {}
        };
        if (c && c.width) f.width = c.width;
        if (c && c.registry) f.registry = c.registry;
        if (c && c.key) f.key = true;
        return f;
      }).filter(f => f.name);
      fieldsAll = sortFields(specFields);
      _logDefaults("[NyRad] using FixedTables columns", {tabKey:t, n: fieldsAll.length, names: fieldsAll.map(f=>f.name)});
    }
  } catch(eFT) { _logDefaults("[NyRad] FixedTables override failed", eFT); }
const todoNew = !!(opts && opts.todoNew) && (App.Tabs && tabKey === App.Tabs.TODO);
let onlyFields = (opts && Array.isArray(opts.onlyFields)) ? opts.onlyFields.map(x => String(x)) : null;

const fields = onlyFields
  ? onlyFields.map(n => fieldsAll.find(f => String(f.name||"").trim() === String(n).trim())).filter(Boolean)
  : ((todoNew && String(tabKey||"").toLowerCase()==="todo") ? fieldsAll.filter(f => ["Kategori","Beskrivning","Klart"].includes(String(f.name||"").trim())) : fieldsAll);
  _logDefaults("[NyRad] modal fields computed", {
    tabKey: tabKey,
    onlyFields: !!onlyFields,
    fieldsLen: Array.isArray(fields) ? fields.length : null,
    fields: Array.isArray(fields) ? fields.map(f=>String(f.name||"").trim()) : null,
    fieldsAllLen: Array.isArray(fieldsAll) ? fieldsAll.length : null,
    fieldsAll: Array.isArray(fieldsAll) ? fieldsAll.map(f=>String(f.name||"").trim()).slice(0,30) : null
  });
  // DEV: ensure "Syfte" is included in NyRad modal (some configs only request first fields)
  if (String(tabKey||"").toLowerCase() === "dev") {
    try {
      if (Array.isArray(fieldsAll) && fieldsAll.find(f => String(f.name||"").trim() === "Syfte")) {
        if (Array.isArray(fields)) {
          const has = fields.some(f => String(f.name||"").trim() === "Syfte");
          if (!has) {
            // Insert after Kategori if present, else append
            const idx = fields.findIndex(f => String(f.name||"").trim() === "Kategori");
            const syfte = fieldsAll.find(f => String(f.name||"").trim() === "Syfte");
            if (syfte) {
              if (idx >= 0) fields.splice(idx+1, 0, syfte);
              else fields.push(syfte);
            }
          }
        }
      }
    } catch(eSy) {}
  }

  const title = (opts && opts.title) ? String(opts.title) : ("Ny rad – " + tableTitleForTab(tabKey));

  // Build initial fields
  const tmp = Object.assign({}, (opts && opts.initialFields) ? opts.initialFields : {});
  fields.forEach(f => {
    const k = String(f.name || "").trim();
    if (!k) return;
    if (!(k in tmp)) tmp[k] = "";
  });
  _logDefaults("[NyRad] tmp keys after init", {tabKey: tabKey, n: Object.keys(tmp||{}).length, keys: Object.keys(tmp||{}), snapshot: Object.fromEntries(Object.keys(tmp||{}).slice(0,20).map(k=>[k,tmp[k]]))});

  // PRODUCT: apply admin-defined DEFAULT/PRODUCT values + Notes when creating a new row (Ny rad).
  try {
    if (String(tabKey||"").toLowerCase() === "product") {
      const normKey = (s) => String(s || "")
        .toLowerCase()
        .replace(/[åä]/g, "a")
        .replace(/ö/g, "o")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      const readDefaultByNorm = (norm) => {
        // Prefer in-memory (no reload required)
        try {
          const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
          const st2 = UI && UI._defaultsDraftProduct ? UI._defaultsDraftProduct : null;
          const saved = st2 && st2.saved ? st2.saved : null;
          if (saved && saved[norm] != null && String(saved[norm]).trim()) return String(saved[norm]);
        } catch(e0) {}
        // Persisted key (normalized)
        try {
          const v = localStorage.getItem("USP_DEFAULTS_PRODUCT__" + norm);
          if (v != null && String(v).trim()) return v;
        } catch(e1) {}
        // Fallback: scan keys
        try {
          for (let i=0;i<localStorage.length;i++){
            const k = localStorage.key(i);
            if (!k || !k.startsWith("USP_DEFAULTS_PRODUCT__")) continue;
            const tail = k.substring("USP_DEFAULTS_PRODUCT__".length);
            if (normKey(tail) === norm) {
              const v = localStorage.getItem(k);
              if (v != null && String(v).trim()) return v;
            }
          }
        } catch(e2) {}
        return "";
      };

      const readDefaultNotesByNorm = (norm) => {
        // Prefer in-memory notes defaults
        try {
          const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
          const st2 = UI && UI._defaultsDraftProduct ? UI._defaultsDraftProduct : null;
          const savedN = st2 && st2.savedNotes ? st2.savedNotes : null;
          const kNotes = String(norm) + "__notes";
          const v = savedN && savedN[kNotes] != null ? savedN[kNotes] : null;
          if (Array.isArray(v) && v.length) return v;
        } catch(e0) {}
        // Persisted key
        try {
          const s = localStorage.getItem("USP_DEFAULTS_PRODUCT__NOTES__" + norm);
          if (s && String(s).trim()) {
            const a = JSON.parse(s);
            if (Array.isArray(a) && a.length) return a;
          }
        } catch(e1) {}
        // Fallback scan
        try {
          for (let i=0;i<localStorage.length;i++){
            const k = localStorage.key(i);
            if (!k || !k.startsWith("USP_DEFAULTS_PRODUCT__NOTES__")) continue;
            const tail = k.substring("USP_DEFAULTS_PRODUCT__NOTES__".length);
            if (normKey(tail) === norm) {
              const s = localStorage.getItem(k);
              if (s && String(s).trim()) {
                const a = JSON.parse(s);
                if (Array.isArray(a) && a.length) return a;
              }
            }
          }
        } catch(e2) {}
        return [];
      };

      const keyByNorm = {};
      Object.keys(tmp || {}).forEach((k) => { keyByNorm[normKey(k)] = k; });

      const spec = (App && App.FixedTables) ? App.FixedTables.PRODUCT : null;
      const cols = (spec && Array.isArray(spec.columns)) ? spec.columns : [];
      cols.forEach((c) => {
        const colName = String((c && c.name) || "").trim();
        if (!colName) return;
        const nk = normKey(colName);
        const fieldKey = keyByNorm[nk];
        if (!fieldKey) return;

        // Only apply if empty
        if (tmp[fieldKey] != null && String(tmp[fieldKey]).trim()) return;

        const dv = readDefaultByNorm(nk);
        if (dv != null && String(dv).trim()) tmp[fieldKey] = dv;

        // Notes defaults (only if no notes exist yet)
        try {
          const hasN = ((readNotesLog(tmp, fieldKey) || []).length > 0);
          if (!hasN) {
            const nlog = readDefaultNotesByNorm(nk);
            if (Array.isArray(nlog) && nlog.length) writeNotesLog(tmp, fieldKey, nlog);
          }
        } catch(eN) {}
      });

      _logDefaults("[NyRad/PRODUCT] applied defaults on init", {nKeys: Object.keys(tmp||{}).length});
    }
  } catch(eP) {}

  // PROJECT: apply admin-defined DEFAULT/PROJECT values when creating a new row (Ny rad).
  try {
    if (String(tabKey||"").toLowerCase() === "project") {

      function normKey(s){
        return String(s || "")
          .toLowerCase()
          .replace(/[åä]/g, "a")
          .replace(/ö/g, "o")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }

      function readDefaultByNorm(norm){
        try {
          const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
          const st2 = UI && UI._defaultsDraftProject ? UI._defaultsDraftProject : null;
          const saved = st2 && st2.saved ? st2.saved : null;
          if (saved && saved[norm] != null && String(saved[norm]).trim()) return String(saved[norm]);
        } catch(e0) {}
        try {
          const v = localStorage.getItem("USP_DEFAULTS_PROJECT__" + norm);
          if (v != null && String(v).trim()) return v;
        } catch(e1) {}
        try {
          for (let i=0;i<localStorage.length;i++){
            const k = localStorage.key(i);
            if (!k || !k.startsWith("USP_DEFAULTS_PROJECT__")) continue;
            const tail = k.substring("USP_DEFAULTS_PROJECT__".length);
            if (normKey(tail) === norm) {
              const v = localStorage.getItem(k);
              if (v != null && String(v).trim()) return v;
            }
          }
        } catch(e2) {}
        return "";
      }

      function readDefaultNotesByNorm(norm){
        try {
          const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
          const st2 = UI && UI._defaultsDraftProject ? UI._defaultsDraftProject : null;
          const savedN = st2 && st2.savedNotes ? st2.savedNotes : null;
          const kNotes = String(norm) + "__notes";
          const v = savedN && savedN[kNotes] != null ? savedN[kNotes] : null;
          if (Array.isArray(v) && v.length) return v;
        } catch(e0) {}
        try {
          const s = localStorage.getItem("USP_DEFAULTS_PROJECT__NOTES__" + norm);
          if (s && String(s).trim()) {
            const a = JSON.parse(s);
            if (Array.isArray(a) && a.length) return a;
          }
        } catch(e1) {}
        return [];
      }

      const keyByNorm = {};
      Object.keys(tmp || {}).forEach((k) => { keyByNorm[normKey(k)] = k; });

      const spec = (App && App.FixedTables) ? App.FixedTables.PROJECT : null;
      const cols = (spec && Array.isArray(spec.columns)) ? spec.columns : [];
      cols.forEach((c) => {
        const colName = String((c && c.name) || "").trim();
        if (!colName) return;
        const nk = normKey(colName);
        const fieldKey = keyByNorm[nk];
        if (!fieldKey) return;

        // Only apply if field is empty
        if (tmp[fieldKey] != null && String(tmp[fieldKey]).trim()) return;

        const dv = readDefaultByNorm(nk);
        if (dv != null && String(dv).trim()) tmp[fieldKey] = dv;

        // Apply notes defaults if allowed and none exist yet
        try {
          const allowNotes = !!(c && c.mods && (c.mods.notes || c.mods.Notes));
          if (allowNotes) {
            const hasN = ((readNotesLog(tmp, fieldKey) || []).length > 0);
            if (!hasN) {
              const nlog = readDefaultNotesByNorm(nk);
              if (Array.isArray(nlog) && nlog.length) writeNotesLog(tmp, fieldKey, nlog);
            }
          }
        } catch(eN) {}
      });

      _logDefaults("[NyRad/PROJECT] applied defaults on init", {nKeys: Object.keys(tmp||{}).length});
    }
  } catch(ePj) {}




  // Tab-specific defaults (user perspective)
  try {
    if (tabKey === App.Tabs.TODO) {
      // default category: filter if set, otherwise "matta"
      const fc = st && st.session ? String(st.session.todoFilterCat || "") : "";
      if (fc && fc !== "Alla" && !tmp["Kategori"]) tmp["Kategori"] = fc;
      if (!tmp["Kategori"]) tmp["Kategori"] = "Allmänt";
      // default initials for Beskrivning
      const a = (App.getActingUser ? App.getActingUser(st) : (st.user||{})) || {};
      const ini = computeInitials(a);
      if (ini) {
        const ik = initialsKeyFor("Beskrivning");
        if (!tmp[ik]) tmp[ik] = ini;
      }
    }
    if (String(tabKey||"").toLowerCase() === "dev") {
      // Apply admin-defined defaults from DEFAULT/DEV when creating a new row (Ny rad).
      // We match modal fields by normalized name so casing differences (Design-Po vs Design-PO) still work.
      function normKey(s){
        return String(s || "")
          .toLowerCase()
          .replace(/[åä]/g, "a")
          .replace(/ö/g, "o")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }

      function readDefaultByNorm(norm){
        // Prefer in-memory saved defaults from DEFAULT view (no reload needed)
        try {
          const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
          const st2 = UI && UI._defaultsDraftDev ? UI._defaultsDraftDev : null;
          const saved = st2 && st2.saved ? st2.saved : null;
          if (saved && saved[norm] != null && String(saved[norm]).trim()) return String(saved[norm]);
        } catch(e0) {}

        // Primary persisted key (normalized)
        try {
          const v = localStorage.getItem("USP_DEFAULTS_DEV__" + norm);
          if (v != null && String(v).trim()) return v;
        } catch(e1) {}

        // Fallback: scan all DEV defaults keys and match by normalized suffix
        try {
          for (let i=0;i<localStorage.length;i++){
            const k = localStorage.key(i);
            if (!k || !k.startsWith("USP_DEFAULTS_DEV__")) continue;
            const tail = k.substring("USP_DEFAULTS_DEV__".length);
            if (normKey(tail) === norm) {
              const v = localStorage.getItem(k);
              if (v != null && String(v).trim()) return v;
            }
          }
        } catch(e2) {}

        return "";
      }

      function readDefaultNotesByNorm(norm){
        // Prefer in-memory saved notes from DEFAULT view (no reload needed)
        try {
          const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
          const st2 = UI && UI._defaultsDraftDev ? UI._defaultsDraftDev : null;
          const savedN = st2 && st2.savedNotes ? st2.savedNotes : null;
          const kNotes = String(norm) + "__notes";
          const v = savedN && savedN[kNotes] != null ? savedN[kNotes] : null;
          if (Array.isArray(v) && v.length) return v;
        } catch(e0) {}
        // Primary persisted key (normalized)
        try {
          const s = localStorage.getItem("USP_DEFAULTS_DEV__NOTES__" + norm);
          if (s && String(s).trim()) {
            const a = JSON.parse(s);
            if (Array.isArray(a) && a.length) return a;
          }
        } catch(e1) {}
        // Fallback: scan all notes keys and match by normalized suffix
        try {
          for (let i=0;i<localStorage.length;i++){
            const k = localStorage.key(i);
            if (!k || !k.startsWith("USP_DEFAULTS_DEV__NOTES__")) continue;
            const tail = k.substring("USP_DEFAULTS_DEV__NOTES__".length);
            if (normKey(tail) === norm) {
              const s = localStorage.getItem(k);
              if (s && String(s).trim()) {
                const a = JSON.parse(s);
                if (Array.isArray(a) && a.length) return a;
              }
            }
          }
        } catch(e2) {}
        return [];
      }

      // Build lookup of modal field keys by normalized name
      const keyByNorm = {};
      Object.keys(tmp || {}).forEach((k) => { keyByNorm[normKey(k)] = k; });

      // Canonical list from FixedTables.DEV.columns
      try {
        const spec = (App && App.FixedTables) ? App.FixedTables.DEV : null;
        const cols = (spec && Array.isArray(spec.columns)) ? spec.columns : [];
        cols.forEach((c) => {
          const colName = String((c && c.name) || "").trim();
          if (!colName) return;
          const nk = normKey(colName);
          const fieldKey = keyByNorm[nk];
          if (!fieldKey) return;
          if (tmp[fieldKey] != null && String(tmp[fieldKey]).trim()) return; // user/initial value wins
          const dv = readDefaultByNorm(nk);
          if (dv != null && String(dv).trim()) tmp[fieldKey] = dv;
          // Apply DEFAULT/DEV notes if none exist yet for this field
          try {
            const hasN = ((readNotesLog(tmp, fieldKey) || []).length > 0);
            if (!hasN) {
              const nlog = readDefaultNotesByNorm(nk);
              if (Array.isArray(nlog) && nlog.length) writeNotesLog(tmp, fieldKey, nlog);
            }
          } catch(eN) {}
        });
      } catch(e3) {}
    }

} catch(e) {}

  
  // Default initials for any field marked with mod "initials"
  try {
    const a2 = (App.getActingUser ? App.getActingUser(st) : (st.user || {})) || {};
    const ini2 = computeInitials(a2);
    if (ini2) {
      (fieldsAll || []).forEach((f) => {
        const name = String((f && f.name) || "").trim();
        if (!name) return;
        const mods = (f && (f.mods || f.addons)) || null;
        let has = false;
        if (mods) {
          if (Array.isArray(mods)) has = mods.map(String).includes("initials");
          else if (typeof mods === "object") has = !!mods["initials"];
          else if (typeof mods === "string") has = String(mods).includes("initials");
        }
        // Also support type add-ons "text+initials"
        if (!has) {
          const tr = String((f && f.type) || "");
          if (tr.includes("+")) has = tr.split("+").slice(1).map(s=>String(s).trim()).includes("initials");
        }
        if (!has) return;
        const ik = initialsKeyFor(name);
        if (!tmp[ik]) tmp[ik] = ini2;
      });
    }
  } catch(e) {}
closeAnyModal();

  const overlay = el("div", { class: "usp-modal-overlay" }, []);
  const modal = el("div", { class: "usp-modal", style:"max-width:820px;width:min(820px, 92vw);" }, []);
  modal.appendChild(el("div", { class: "modal-title" }, [title]));

  const form = el("div", { class:"modal-form", style:"display:flex;flex-direction:column;gap:10px;margin-top:12px;" }, []);


// ToDo: require Beskrivning (red border until non-empty)
function _setInvalidBorder(elm, invalid){
  if (!elm) return;
  if (invalid){
    elm.style.borderColor = "#d11";
    elm.style.boxShadow = "0 0 0 1px #d11";
  } else {
    elm.style.borderColor = "";
    elm.style.boxShadow = "";
  }


}


  fields.forEach(f => {
    const name = String(f.name || "").trim();
    if (!name) return;
    // Skip technical helper columns for modal (notes/initials-only)
    const baseType = (App.FieldTypes && App.FieldTypes.normalizeBaseType) ? App.FieldTypes.normalizeBaseType(f.type) : String(f.type || "text");
    if (baseType === "notes") return;

    const rowWrap = el("div", { "data-field-name": name, style:"display:grid;grid-template-columns: 180px 1fr;gap:12px;align-items:center;" }, []);
    rowWrap.appendChild(el("div", { class:"muted", style:"font-weight:700;" }, [name]));

    const ctx = {
      tabKey,
      fieldName: name,
      field: (todoNew ? Object.assign({}, f, { addons: [] }) : f),
      baseType,
      type: f.type,
      mods: todoNew ? [] : ((App.FieldTypes && App.FieldTypes.typeMods) ? App.FieldTypes.typeMods(f.type) : []),
      registry: f.registry || f.reg || f.registryName,
      value: tmp[name],
      state: st,
      row: { id:"__new__", fields: tmp },
      onChange: function(v){ tmp[name] = v; },
      onNotesClick: (todoNew && (name === "Kategori" || name === "Klart")) ? null : function(){},
      hasNotes: (todoNew && (name === "Kategori" || name === "Klart")) ? null : function(){ return false; }
    };



    // --- R10: Make NyRad follow FixedTables spec mods (initials/notes/corner) like Project ---
    // In modals, schema fields include `mods` as an object (e.g. {initials:true}).
    // Previously we derived mods from type string which loses spec behavior.
    const _mods0 = (f && typeof f.mods === "object" && f.mods) ? f.mods : {};
    const modsObj = Object.assign({}, _mods0);
    if (modsObj.initials && modsObj.notesOnInitialsRightClick == null) modsObj.notesOnInitialsRightClick = true;

    const notesFieldName = name;
    // Back-compat: older builds stored notes on initials-meta field for initials columns.
    try{
      if (modsObj && modsObj.initials) {
        var altN = initialsKeyFor(name);
        var hasBaseN = (App && App.Notes && typeof App.Notes.has==="function") ? App.Notes.has(tmp, name) : ((readNotesLog(tmp, name) || []).length > 0);
        var hasAltN  = (App && App.Notes && typeof App.Notes.has==="function") ? App.Notes.has(tmp, altN) : ((readNotesLog(tmp, altN) || []).length > 0);
        if (!hasBaseN && hasAltN) notesFieldName = altN;
      }
    }catch(eNF){}

    function _syncInitialsUI(){
      try{
        const btn = rowWrap.querySelector(".act-initials");
        if (!btn) return;
        const v = String(tmp[initialsKeyFor(name)] || "").trim();
        if (v) btn.textContent = v;
      }catch(e){}
    }
    function _syncNotesUI(){
      try{
        const btn = rowWrap.querySelector(".act-initials");
        const has = (readNotesLog(tmp, notesFieldName) || []).length > 0;
        if (btn){
          if (has) btn.classList.add("is-notes");
          else btn.classList.remove("is-notes");
        }
      }catch(e){}
    }

    // Override ctx properties so FieldTypes can render the same addons as in table cells
    ctx.mods = modsObj;
    ctx.initialsValue = tmp[initialsKeyFor(name)] || "";
    ctx.initialsNotesHas = (modsObj && modsObj.initials) ? (function(){ try{ if(App && App.Notes && typeof App.Notes.has==="function") return App.Notes.has(tmp, notesFieldName); }catch(e){} return ((readNotesLog(tmp, notesFieldName) || []).length > 0); })() : false;
    ctx.notesHas = (function(){ try{ if(App && App.Notes && typeof App.Notes.has==="function") return App.Notes.has(tmp, notesFieldName); }catch(e){} return ((readNotesLog(tmp, notesFieldName) || []).length > 0); })();

    ctx.onInitialsClick = (modsObj && modsObj.initials) ? function(){
      try{
        const cur = String(tmp[initialsKeyFor(name)] || "").trim();
        const save = function(v){
          tmp[initialsKeyFor(name)] = String(v || "").trim();
          _syncInitialsUI();
        };
        if (window.USP && window.USP.UI && typeof window.USP.UI.openInitialsPicker === "function") {
          window.USP.UI.openInitialsPicker(tabKey, "__new__", name, cur, save);
        } else if (typeof openInitialsPicker === "function") {
          openInitialsPicker(tabKey, "__new__", name, cur, save);
        }
      }catch(e){}
    } : null;

    ctx.onNotesClick = (modsObj && (modsObj.notes || modsObj.initials || modsObj.notesOnInitialsRightClick)) ? function(ev){
      try{
        // Open notes modal on the correct storage field (Project behavior: initials notes stored under initialsKeyFor(name))
        const existing = readNotesLog(tmp, notesFieldName) || [];
        const onSave = function(t){
          const now = new Date().toISOString();
          const log = (readNotesLog(tmp, notesFieldName) || []).concat([{ ts: now, text: String(t||"").trim() }]);
          writeNotesLog(tmp, notesFieldName, log);
          _syncNotesUI();
        };
        const opts = { label: name, rowName: "__new__" };
        if (window.USP && window.USP.UI && typeof window.USP.UI.openNotesModal === "function") {
          window.USP.UI.openNotesModal(tabKey, notesFieldName, existing, onSave, opts);
        } else if (typeof openNotesModal === "function") {
          openNotesModal(tabKey, notesFieldName, existing, onSave, opts);
        }
      }catch(e){}
    } : null;

    // Initial sync (in case initialFields already included initials/notes)
    _syncInitialsUI();
    _syncNotesUI();
    // --- end R10 ---


// Ensure dropdown registry is correctly resolved for modals (schema may have normalized types)
try{
  let regKey = ctx.registry ? String(ctx.registry) : "";
  const t0 = String(ctx.type || "").toLowerCase();
  if (!regKey && t0.startsWith("dropdown_")) regKey = t0;
  if (!regKey && baseType === "dropdown_registry") {
    const nm = String(name).trim();
    if (nm === "Kategori") {
      if (tabKey === App.Tabs.DEV) regKey = "dropdown_dev_kategori";
      else if (tabKey === App.Tabs.PRODUCT) regKey = "dropdown_product_kategori";
      else if (tabKey === App.Tabs.TODO) regKey = "dropdown_todo_kategori";
      else if (tabKey === App.Tabs.PROJECT) regKey = "dropdown_project_kategori";
    }
  }
  if (regKey) {
    ctx.registry = regKey;
    ctx.type = regKey; // let FieldTypes pick it up
  }
}catch(e){}

if (todoNew && name === "Beskrivning") {
  const prevOnChange = ctx.onChange;
  ctx.onChange = function(v){
    prevOnChange(v);
  };
}


    let editor = null;
    try {
      editor = (App.FieldTypes && typeof App.FieldTypes.renderEditor === "function")
        ? App.FieldTypes.renderEditor(ctx)
        : null;
    } catch(e) { editor = null; }

    if (!editor) {
      // fallback text
      editor = el("input", { class:"input", value: String(tmp[name]||""), oninput: (ev)=>{ tmp[name]=String(ev.target.value||""); } }, []);
    }

    // Adjust field widths in Ny ToDo to match table proportions
    if (todoNew && (name === "Kategori" || name === "Klart")) {
      try {
        const inputEl = (editor && typeof editor.querySelector === "function") 
          ? (editor.querySelector("input,select") || editor) 
          : editor;
        if (inputEl) {
          inputEl.style.width = (name === "Kategori") ? "18ch" : "14ch";
          inputEl.style.maxWidth = "100%";
        }
      } catch(e){}
    }

    rowWrap.appendChild(el("div", {}, [editor]));
    form.appendChild(rowWrap);
  });

  const btnRow = el("div", { style:"display:flex;justify-content:flex-end;gap:10px;margin-top:18px;" }, []);
  const btnCancel = el("button", { class: btnClass("secondary"), type:"button", onclick: () => { closeAnyModal(); } }, ["Cancel"]);
  const btnSave = el("button", { class: btnClass("primary"), type:"button", disabled: null ? "disabled" : null, onclick: () => {
    const ts = new Date().toISOString();
    if (todoNew) { try{ btnSave.disabled = (String(tmp["Beskrivning"]||"").trim().length===0); }catch(e){} }
    // DEV: apply admin-defined DEFAULT/DEV values right before saving the new row
    if (tabKey === App.Tabs.DEV) {
      try {
        _logDefaults("[NyRad/DEV] before apply", {tabKey: tabKey, nKeys: Object.keys(tmp||{}).length, keys: Object.keys(tmp||{}), snapshot: Object.fromEntries(Object.keys(tmp||{}).slice(0,15).map(k=>[k,tmp[k]]))});

        const normKey = (s) => String(s || "")
          .toLowerCase()
          .replace(/[åä]/g, "a")
          .replace(/ö/g, "o")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const readDefault = (norm) => {
          // in-memory defaults from DEFAULT view
          try {
            const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
            const st2 = UI && UI._defaultsDraftDev ? UI._defaultsDraftDev : null;
            const saved = st2 && st2.saved ? st2.saved : null;
            if (saved && saved[norm] != null && String(saved[norm]).trim()) return String(saved[norm]);
          } catch(e0) {}
          // direct key
          try {
            const v = localStorage.getItem("USP_DEFAULTS_DEV__" + norm);
            if (v != null && String(v).trim()) return v;
          } catch(e1) {}
          // scan keys (handles legacy/non-normalized tails)
          try {
            for (let i=0;i<localStorage.length;i++){
              const k = localStorage.key(i);
              if (!k || !k.startsWith("USP_DEFAULTS_DEV__")) continue;
              const tail = k.substring("USP_DEFAULTS_DEV__".length);
              if (normKey(tail) === norm) {
                const v = localStorage.getItem(k);
                if (v != null && String(v).trim()) return v;
              }
            }
          } catch(e2) {}
          _logDefaults("[NyRad/DEV] no default", {norm: norm});
          return "";
        };

        const readDefaultNotes = (norm) => {
          // in-memory notes defaults from DEFAULT view
          try {
            const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
            const st2 = UI && UI._defaultsDraftDev ? UI._defaultsDraftDev : null;
            const savedN = st2 && st2.savedNotes ? st2.savedNotes : null;
            const kNotes = String(norm) + "__notes";
            const v = savedN && savedN[kNotes] != null ? savedN[kNotes] : null;
            if (Array.isArray(v) && v.length) return v;
          } catch(e0) {}
          // direct key
          try {
            const s = localStorage.getItem("USP_DEFAULTS_DEV__NOTES__" + norm);
            if (s && String(s).trim()) {
              const a = JSON.parse(s);
              if (Array.isArray(a) && a.length) return a;
            }
          } catch(e1) {}
          // scan keys
          try {
            for (let i=0;i<localStorage.length;i++){
              const k = localStorage.key(i);
              if (!k || !k.startsWith("USP_DEFAULTS_DEV__NOTES__")) continue;
              const tail = k.substring("USP_DEFAULTS_DEV__NOTES__".length);
              if (normKey(tail) === norm) {
                const s = localStorage.getItem(k);
                if (s && String(s).trim()) {
                  const a = JSON.parse(s);
                  if (Array.isArray(a) && a.length) return a;
                }
              }
            }
          } catch(e2) {}
          return [];
        };


        // Ensure hidden DEV columns are present before applying defaults.
        // NyRad shows only a subset, but DEFAULT/DEV values must still be saved on the new row.
        try {
          (fieldsAll || []).forEach((f) => {
            const k = String((f && f.name) || "").trim();
            if (!k) return;
            if (!(k in tmp)) tmp[k] = "";
          });
        } catch(eHidden) {}

        // apply for any empty field that has a stored default
        Object.keys(tmp || {}).forEach((k) => {
          try {
            if (tmp[k] != null && String(tmp[k]).trim()) return;
            const dv = readDefault(normKey(k));
            if (dv != null && String(dv).trim()) { tmp[k] = dv; _logDefaults("[NyRad/DEV] applied default", {field: k, norm: normKey(k), val: dv}); }
            // Also apply DEFAULT/DEV notes if none exist yet for this field
            try {
              const hasN = ((readNotesLog(tmp, k) || []).length > 0);
              if (!hasN) {
                const nlog = readDefaultNotes(normKey(k));
                if (Array.isArray(nlog) && nlog.length) { writeNotesLog(tmp, k, nlog); _logDefaults("[NyRad/DEV] applied default notes", {field: k, n: nlog.length}); }
              }
            } catch(eN) {}
          } catch(e3) {}
        });
      } catch(e4) {}
    }

    // PRODUCT: apply admin-defined DEFAULT/PRODUCT values + Notes right before saving the new row
    if (tabKey === App.Tabs.PRODUCT) {
      try {
        _logDefaults("[NyRad/PRODUCT] before apply", {tabKey: tabKey, nKeys: Object.keys(tmp||{}).length, keys: Object.keys(tmp||{}), snapshot: Object.fromEntries(Object.keys(tmp||{}).slice(0,15).map(k=>[k,tmp[k]]))});

        const normKey = (s) => String(s || "")
          .toLowerCase()
          .replace(/[åä]/g, "a")
          .replace(/ö/g, "o")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const readDefault = (norm) => {
          try {
            const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
            const st2 = UI && UI._defaultsDraftProduct ? UI._defaultsDraftProduct : null;
            const saved = st2 && st2.saved ? st2.saved : null;
            if (saved && saved[norm] != null && String(saved[norm]).trim()) return String(saved[norm]);
          } catch(e0) {}
          try {
            const v = localStorage.getItem("USP_DEFAULTS_PRODUCT__" + norm);
            if (v != null && String(v).trim()) return v;
          } catch(e1) {}
          try {
            for (let i=0;i<localStorage.length;i++){
              const k = localStorage.key(i);
              if (!k || !k.startsWith("USP_DEFAULTS_PRODUCT__")) continue;
              const tail = k.substring("USP_DEFAULTS_PRODUCT__".length);
              if (normKey(tail) === norm) {
                const v = localStorage.getItem(k);
                if (v != null && String(v).trim()) return v;
              }
            }
          } catch(e2) {}
          return "";
        };

        const readDefaultNotes = (norm) => {
          try {
            const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
            const st2 = UI && UI._defaultsDraftProduct ? UI._defaultsDraftProduct : null;
            const savedN = st2 && st2.savedNotes ? st2.savedNotes : null;
            const kNotes = String(norm) + "__notes";
            const v = savedN && savedN[kNotes] != null ? savedN[kNotes] : null;
            if (Array.isArray(v) && v.length) return v;
          } catch(e0) {}
          try {
            const s = localStorage.getItem("USP_DEFAULTS_PRODUCT__NOTES__" + norm);
            if (s && String(s).trim()) {
              const a = JSON.parse(s);
              if (Array.isArray(a) && a.length) return a;
            }
          } catch(e1) {}
          try {
            for (let i=0;i<localStorage.length;i++){
              const k = localStorage.key(i);
              if (!k || !k.startsWith("USP_DEFAULTS_PRODUCT__NOTES__")) continue;
              const tail = k.substring("USP_DEFAULTS_PRODUCT__NOTES__".length);
              if (normKey(tail) === norm) {
                const s = localStorage.getItem(k);
                if (s && String(s).trim()) {
                  const a = JSON.parse(s);
                  if (Array.isArray(a) && a.length) return a;
                }
              }
            }
          } catch(e2) {}
          return [];
        };

        // Ensure hidden PRODUCT columns are present before applying defaults.
        // NyRad shows only Produkt + Kategori, but DEFAULT/PRODUCT values must still be saved.
        try {
          (fieldsAll || []).forEach((f) => {
            const k = String((f && f.name) || "").trim();
            if (!k) return;
            if (!(k in tmp)) tmp[k] = "";
          });
        } catch(eHidden) {}

        Object.keys(tmp || {}).forEach((k) => {
          if (tmp[k] != null && String(tmp[k]).trim()) return;

          const dv = readDefault(normKey(k));
          if (dv != null && String(dv).trim()) { tmp[k] = dv; _logDefaults("[NyRad/PRODUCT] applied default", {field: k, norm: normKey(k), val: dv}); }

          try {
            const hasN = ((readNotesLog(tmp, k) || []).length > 0);
            if (!hasN) {
              const nlog = readDefaultNotes(normKey(k));
              if (Array.isArray(nlog) && nlog.length) { writeNotesLog(tmp, k, nlog); _logDefaults("[NyRad/PRODUCT] applied default notes", {field: k, n: nlog.length}); }
            }
          } catch(eN) {}
        });
      } catch (e) {}
    }

    // PROJECT: apply admin-defined DEFAULT/PROJECT values right before saving the new row
    if (tabKey === App.Tabs.PROJECT) {
      try {
        _logDefaults("[NyRad/PROJECT] before apply", {tabKey: tabKey, nKeys: Object.keys(tmp||{}).length, keys: Object.keys(tmp||{}), snapshot: Object.fromEntries(Object.keys(tmp||{}).slice(0,15).map(k=>[k,tmp[k]]))});

        const normKey = (s) => String(s || "")
          .toLowerCase()
          .replace(/[åä]/g, "a")
          .replace(/ö/g, "o")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");

        const readDefault = (norm) => {
          try {
            const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
            const st2 = UI && UI._defaultsDraftProject ? UI._defaultsDraftProject : null;
            const saved = st2 && st2.saved ? st2.saved : null;
            if (saved && saved[norm] != null && String(saved[norm]).trim()) return String(saved[norm]);
          } catch(e0) {}
          try {
            const v = localStorage.getItem("USP_DEFAULTS_PROJECT__" + norm);
            if (v != null && String(v).trim()) return v;
          } catch(e1) {}
          return "";
        };

        const readDefaultNotes = (norm) => {
          try {
            const UI = (window.USP && window.USP.UI) ? window.USP.UI : null;
            const st2 = UI && UI._defaultsDraftProject ? UI._defaultsDraftProject : null;
            const savedN = st2 && st2.savedNotes ? st2.savedNotes : null;
            const kNotes = String(norm) + "__notes";
            const v = savedN && savedN[kNotes] != null ? savedN[kNotes] : null;
            if (Array.isArray(v) && v.length) return v;
          } catch(e0) {}
          try {
            const s = localStorage.getItem("USP_DEFAULTS_PROJECT__NOTES__" + norm);
            if (s && String(s).trim()) {
              const a = JSON.parse(s);
              if (Array.isArray(a) && a.length) return a;
            }
          } catch(e1) {}
          return [];
        };

        // Ensure hidden PROJECT columns are present before applying defaults.
        // NyRad shows only Projektnamn + Kategori, but DEFAULT/PROJECT values must still be saved.
        try {
          (fieldsAll || []).forEach((f) => {
            const k = String((f && f.name) || "").trim();
            if (!k) return;
            if (!(k in tmp)) tmp[k] = "";
          });
        } catch(eHidden) {}

        Object.keys(tmp || {}).forEach((k) => {
          if (tmp[k] != null && String(tmp[k]).trim()) return;
          const dv = readDefault(normKey(k));
          if (dv != null && String(dv).trim()) { tmp[k] = dv; _logDefaults("[NyRad/PROJECT] applied default", {field: k, norm: normKey(k), val: dv}); }
        });

        // Notes defaults only for columns that allow notes
        try {
          const spec = (App && App.FixedTables) ? App.FixedTables.PROJECT : null;
          const cols = (spec && Array.isArray(spec.columns)) ? spec.columns : [];
          const allow = {};
          cols.forEach(c => { if (c && c.name) allow[normKey(c.name)] = !!(c.mods && (c.mods.notes || c.mods.Notes)); });
          Object.keys(tmp || {}).forEach((k) => {
            const nk = normKey(k);
            if (!allow[nk]) return;
            const hasN = ((readNotesLog(tmp, k) || []).length > 0);
            if (hasN) return;
            const nlog = readDefaultNotes(nk);
            if (Array.isArray(nlog) && nlog.length) { writeNotesLog(tmp, k, nlog); _logDefaults("[NyRad/PROJECT] applied default notes", {field: k, n: nlog.length}); }
          });
        } catch(eN) {}
      } catch (e) {}
    }


    const row = {
      id: "row_" + Date.now() + "_" + Math.random().toString(16).slice(2),
      createdAt: ts,
      updatedAt: ts,
      fields: Object.assign({}, tmp),
      meta: {}
    };
    // owner for ToDo
    try {
      if (tabKey === App.Tabs.TODO) {
        const a = (App.getActingUser ? App.getActingUser(st) : (st.user||{})) || {};
        row.meta.owner = String(a.id || a.email || "");
      }
    } catch(e) {}
    App.upsertRow(tabKey, row);
    closeAnyModal();
  } }, ["Save"]);

  btnRow.appendChild(btnCancel);
  btnRow.appendChild(btnSave);

  modal.appendChild(form);
  modal.appendChild(btnRow);
  overlay.appendChild(modal);

  overlay.addEventListener("click", function(e){
    try{ if (e.target === overlay) closeAnyModal(); }catch(err){}
  });

  document.body.appendChild(overlay);
}
  function hasNotesInCell(row, fieldName) {
    try {
      const fields = (row && row.fields) ? row.fields : {};
      const log1 = readNotesLog(fields, fieldName);
      return Array.isArray(log1) && log1.length > 0;
    } catch (e) {
      return false;
    }
  }

  // Notes associated specifically with the initials-addon for a given field
  function hasNotesForInitials(row, fieldName) {
    try {
      const fields = (row && row.fields) ? row.fields : {};
      const ik = (typeof initialsKeyFor === "function")
        ? initialsKeyFor(fieldName)
        : (String(fieldName) + "__initials");
      const log = readNotesLog(fields, ik);
      return Array.isArray(log) && log.length > 0;
    } catch (e) {
      return false;
    }
  }



  function addNoteToCell(tabKey, rowId, fieldName, opts) {
    opts = opts || {};
    const displayField = opts.labelField || fieldName;
    // openNotesModal(tabKey, rowId, displayField, storageField)
    openNotesModal(tabKey, rowId, displayField, fieldName);
  }

  function closeAnyModal() {
    try {
      const els = document.querySelectorAll(".usp-modal-overlay, .usp-modal, .modal-overlay, .modal");
      els.forEach(el => { try { el.remove(); } catch(e){} });
    } catch(e) {}


  function tableTitleForTab(tabKey) {
    if (tabKey === App.Tabs.DEV) return "Utveckling";
    if (tabKey === App.Tabs.PRODUCT) return "Sälj-intro";
    if (tabKey === App.Tabs.TODO) return "ToDo";
    if (tabKey === App.Tabs.PROJECT) return "Projekt";
    if (tabKey === App.Tabs.ROUTINES) return "Rutiner";
    if (tabKey === App.Tabs.SETTINGS) return "Settings";
    return String(tabKey || "");
  }


  function openInitialsPicker(tabKey, rowId, fieldName, currentValue, onPick) {
    closeAnyModal();
    const st = App.getState();
    const users = (typeof App.listUsers === "function") ? (App.listUsers(st) || []) : [];
    const title = tableTitleForTab(tabKey) + " – " + String(fieldName || "Ansvarig");
    const overlay = el("div", { class: "usp-modal-overlay" }, []);
    const modal = el("div", { class: "usp-modal" }, []);
    const h = el("div", { class: "modal-title" }, [title]);
    const list = el("div", { class: "modal-list" }, []);

    let selected = String(currentValue || "").trim() || "--";
    users.forEach(function(u){
      const ini = (u && u.initials) ? String(u.initials) : "";
      if (!ini) return;
      const row = el("label", { class: "modal-check" }, []);
      const cb = el("input", { type:"checkbox" }, []);
      cb.checked = (ini === selected);
      cb.addEventListener("change", function(){
        // single select behavior
        if (cb.checked) {
          selected = ini;
          const cbs = list.querySelectorAll("input[type=checkbox]");
          cbs.forEach(function(x){ if (x !== cb) x.checked = false; });
        } else {
          selected = "--";
        }
      });
      const name = (u && u.name) ? String(u.name) : ini;
      row.appendChild(cb);
      row.appendChild(el("span", { class:"modal-check-name" }, [ini]));
      list.appendChild(row);
    });

    const actions = el("div", { class: "modal-actions" }, []);
    const btnCancel = el("button", { class:"btn", type:"button" }, ["Cancel"]);
    const btnSave = el("button", { class:"btn", type:"button" }, ["Save"]);
    btnCancel.addEventListener("click", function(){
      overlay.remove();
    });
    btnSave.addEventListener("click", function(){
      if (typeof onPick === "function") onPick(selected);
      overlay.remove();
    });
    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);

    modal.appendChild(h);
    modal.appendChild(list);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
  }

  }


  function getRowSafe(tabKey, rowId, state) {
    try {
      if (App.getRow && typeof App.getRow === "function") return App.getRow(tabKey, rowId, state);
    } catch (e) {}
    try {
      if (App.getRows && typeof App.getRows === "function") {
        const rows = App.getRows(tabKey, state) || [];
        return rows.find(r => String(r.id) === String(rowId)) || null;
      }
    } catch (e) {}
    const st = state || {};
    const candidates = [];
    if (st.data && typeof st.data === "object" && Array.isArray(st.data[tabKey])) candidates.push(st.data[tabKey]);
    if (st.rowsByTab && typeof st.rowsByTab === "object" && Array.isArray(st.rowsByTab[tabKey])) candidates.push(st.rowsByTab[tabKey]);
    if (st.tabs && typeof st.tabs === "object" && st.tabs[tabKey] && Array.isArray(st.tabs[tabKey].rows)) candidates.push(st.tabs[tabKey].rows);
    for (const arr of candidates) {
      const found = arr.find(r => String(r.id) === String(rowId));
      if (found) return found;
    }
    return null;
  }



  // ---------------------------
  // DOM helpers
  // ---------------------------
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (k === "class") n.className = v;
        else if (k === "html") n.innerHTML = v;
        else if (k === "style") n.setAttribute("style", v);
        else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null) n.setAttribute(k, v);
      });
    }
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      if (typeof c === "string") n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    });
    return n;
  }

  // Debug flags (set in console): localStorage.USP_DEBUG_DEFAULTS=1
function _dbgDefaults() {
  try { return String(localStorage.getItem("USP_DEBUG_DEFAULTS")||"") === "1"; } catch(e){ return false; }
}
function _logDefaults() {
  if (!_dbgDefaults()) return;
  try { console.log.apply(console, arguments); } catch(e){}
}

function byId(id) { return document.getElementById(id); }
  function setHtml(node, html) { node.innerHTML = html || ""; }

  function ensureRoot() {
    let root = byId("app");
    if (!root) {
      root = el("div", { id: "app" }, []);
      document.body.appendChild(root);
    }
    return root;
  }

  // ---------------------------
  // Base layout (design)
  // ---------------------------
  UI.mountBase = function mountBase() {
    const root = ensureRoot();

    
    // Remove duplicate view wrappers if any (can happen after older versions appended layout twice)
    try {
      const wraps = root.querySelectorAll(".table-wrap");
      if (wraps && wraps.length > 1) {
        for (let i = 1; i < wraps.length; i++) wraps[i].remove();
      }
    } catch(e) {}
// Always enforce a single root + single view/topbar to prevent duplicate renders.
    try {
      const apps = document.querySelectorAll("#app");
      if (apps && apps.length > 1) {
        for (let i = 1; i < apps.length; i++) apps[i].remove();
      }
    } catch (e) {}

    try {
      const tAll = document.querySelectorAll("#usp-topbar");
      if (tAll && tAll.length > 1) {
        for (let i = 1; i < tAll.length; i++) tAll[i].remove();
      }
      const vAll = document.querySelectorAll("#usp-view");
      if (vAll && vAll.length > 1) {
        for (let i = 1; i < vAll.length; i++) vAll[i].remove();
      }
    } catch (e) {}

    // If layout already exists, reuse it.
    if (byId("usp-topbar") && byId("usp-view")) return;

    setHtml(root, "");

    const topbar = el("div", { id: "usp-topbar", class: "topbar" }, []);
    const viewWrap = el("div", { class: "table-wrap" }, [
      el("div", { id: "usp-view" }, []),
    ]);

    root.appendChild(topbar);
    root.appendChild(viewWrap);

  };

  // ---------------------------
  // Topbar with tabs + user menu
  // ---------------------------
  function tabLabel(key) {
    if (key === App.Tabs.DEV) return "UTVECKLING";
    if (key === App.Tabs.PRODUCT) return "SÄLJINTRO";
    if (key === App.Tabs.TODO) return "TODO";
    if (key === App.Tabs.PROJECT) return "PROJEKT";
    if (key === App.Tabs.ROUTINES) return "RUTINER";
    if (key === App.Tabs.STATISTICS) return "STATISTIK";
    return String(key || "").toUpperCase();
  }

  function renderTopbar(state) {
    const bar = byId("usp-topbar");
    if (!bar) return;
    setHtml(bar, "");

    const left = el("div", { class: "brand" }, [
      el("div", { class: "logo" }, ["U"]),
      el("div", {}, [
        el("div", { class: "brand-title" }, ["USP"]),
        el("div", { class: "brand-sub" }, [""]),
      ]),
    ]);

    const tabs = el("div", { class: "tabs", id: "tabs" }, []);
    const current = App.getTab(state);
    [App.Tabs.DEV, App.Tabs.PRODUCT, App.Tabs.PROJECT, App.Tabs.TODO, App.Tabs.ROUTINES, App.Tabs.STATISTICS].forEach((k) => {
      tabs.appendChild(el("button", {
        class: "tab " + ((current === k || (k === (App.Tabs && App.Tabs.PROJECT) && String(current) === "project")) ? "is-active" : ""),
        type: "button",
        onclick: () => { const __t = k; App.setTab((__t === (App.Tabs && App.Tabs.PROJECT)) ? "project" : __t); },
      }, [tabLabel(k)]));
    });

    // Admin-only tab: DEFAULT (shown far right)
    if (((App && App.role) ? App.role(state) : (state && state.user && state.user.role)) === "admin") {
      tabs.appendChild(el("button", {
        class: "tab " + ((String(current || "") === "default") ? "is-active" : ""),
        type: "button",
        onclick: () => { App.setTab("default"); },
      }, ["DEFAULT"]));
    }

    const actions = el("div", { class: "top-actions" }, []);
    const acting = (App.getActingUser ? App.getActingUser(state) : state.user) || null;
    const role = App.role(state);

    // Single stable Settings button
    actions.appendChild(el("button", {
      id:"usp-settings-btn",
      class: "btn btn-secondary",
      type:"button",
      onclick: () => toggleSettingsPopover(state)
    }, ["Settings"]));

    // Small status label (not a menu)
    actions.appendChild(el("div", { class:"hint", style:"margin-left:10px;white-space:nowrap;" }, [
      (acting && (acting.name || acting.email) ? (acting.name || acting.email) : "User"),
      "  ",
      role
    ]));

    bar.appendChild(left);
    bar.appendChild(tabs);
    bar.appendChild(actions);
  }

  function hideMenu() { /* removed */ }
 {
    const m = byId("usp-menu");
    if (m) m.classList.add("hidden");
  }

  // ---------------------------
  // View helpers
  // ---------------------------
  function hero(title, subtitle, actionsNodes) {
    return el("div", { class: "hero" }, [
      el("div", {}, [
        el("div", { style: "font-weight:1000;font-size:20px;letter-spacing:.2px;" }, [title]),
        subtitle ? el("div", { class: "hint", style:"margin-top:4px;" }, [subtitle]) : null,
      ]),
      el("div", { class: "hero-actions" }, actionsNodes || []),
    ]);
  }

  function sortFields(fields) {
    const arr = Array.isArray(fields) ? fields.slice() : [];
    arr.sort((a,b)=> (((a && a.order) != null ? (a && a.order) : 0) - (((b && b.order) != null ? (b && b.order) : 0))));
    return arr;
  }

  function inputClass() { return "input"; }
  
  // UI helper: delete a row (hard delete) when App.deleteRow isn't provided by bootstrap.
  if (!App.deleteRow) {
    App.deleteRow = function deleteRow(tabKey, rowId) {
      const s0 = (App.getState ? App.getState() : {}) || {};
      const st = (typeof structuredClone === "function")
        ? structuredClone(s0)
        : JSON.parse(JSON.stringify(s0 || {}));
      const k = tabKey;
      st.data = st.data || {};
      st.data[k] = Array.isArray(st.data[k]) ? st.data[k] : [];
      st.data[k] = st.data[k].filter(r => !(r && r.id === rowId));
      return App.commitState(st);
    };
  }

function btnClass(kind) {
    if (kind === "primary") return "btn btn-primary";
    if (kind === "secondary") return "btn btn-secondary";
    return "btn";
  }

  // ---------------------------
  // Admin view: schema definitions
  // ---------------------------
  
  function makeTypeConfigEditor(field, onChange) {
    const f = field || {};
    const mods = (f.mods && typeof f.mods === "object") ? f.mods : {};
    const base = String(f.type || "text");

    const bases = (App.FieldTypes && App.FieldTypes.listBase) ? App.FieldTypes.listBase() : [];
    const modsList = (App.FieldTypes && App.FieldTypes.listMods) ? App.FieldTypes.listMods() : [];

    const baseSel = el("select", { class: inputClass(), style:"min-width:180px;" }, []);
    bases.forEach(b => {
      const opt = el("option", { value: b.key }, [b.label]);
      if (String(b.key) === String(base)) opt.selected = true;
      baseSel.appendChild(opt);
    });
    baseSel.addEventListener("change", function () {
      const next = Object.assign({}, f, { type: baseSel.value });
      if (typeof onChange === "function") onChange(next);
    });

    const modsWrap = el("div", { style:"display:flex;gap:60px;align-items:center;" }, []);
    modsList.forEach(m => {
      const id = "m_" + m.key + "_" + Math.random().toString(16).slice(2);
      const cb = el("input", { type:"checkbox", id:id }, []);
      cb.checked = !!mods[m.key];

      cb.addEventListener("change", function () {
        const nextMods = Object.assign({}, (f.mods || {}), { [m.key]: cb.checked });
        Object.keys(nextMods).forEach(k => { if (!nextMods[k]) delete nextMods[k]; });
        const next = Object.assign({}, f, { mods: nextMods });
        if (typeof onChange === "function") onChange(next);
      });

      const lab = el("label", {
        for:id,
        style:"display:flex;flex-direction:column;align-items:center;gap:8px;cursor:pointer;min-width:110px;"
      }, [
        el("span", { class:"muted", text: m.label }),
        cb
      ]);
      modsWrap.appendChild(lab);
    });

    const header = el("div", {
      style:"display:grid;grid-template-columns:220px 1fr;gap:30px;margin-bottom:10px;font-weight:600;"
    }, [
      el("div", { text:"Grundtyp" }),
      el("div", { text:"Attribut" })
    ]);

    const body = el("div", {
      style:"display:grid;grid-template-columns:220px 1fr;gap:30px;align-items:center;"
    }, [
      el("div", {}, [ baseSel ]),
      modsWrap
    ]);

    return el("div", { style:"display:flex;flex-direction:column;gap:12px;padding:12px 0;" }, [ header, body ]);
  }

function adminSchemaView(state, tabKey, title, opts) {
    opts = opts || {};

    const view = byId("usp-view");
    if (!view) return;
    if (!opts.append) setHtml(view, "");

    const schema = App.getSchema(tabKey, state);
    schema.fields = Array.isArray(schema.fields) ? schema.fields : [];

    view.appendChild(hero(
      "ADMIN: " + title,
      "Definiera kolumner/fält (admin ändrar inte data).",
      [
        el("button", { class: btnClass("primary"), type:"button", onclick: () => {
          const next = sortFields(schema.fields);
          next.push({ id: "f_" + Date.now(), name: "Nytt fält", type: "text", order: next.length });
          schema.fields = next;
          App.setSchema(tabKey, schema);
        }}, ["+ Ny rad"]),
      ]
    ));

    const table = el("table", { class:"table" }, []);
    table.appendChild(el("thead", {}, [
      el("tr", {}, [
        el("th", {}, ["Ordning"]),
        el("th", {}, ["Namn"]),
        el("th", {}, ["Grundtyp"]),
          el("th", {}, ["Hörnmarkör"]),
          el("th", {}, ["Initialer"]),
          el("th", {}, ["Notes"]),
      ])
    ]));
    const tbody = el("tbody", {}, []);
    table.appendChild(tbody);

    view.appendChild(table);

    function rerender() {
      setHtml(tbody, "");
      const fields = sortFields(schema.fields);

      fields.forEach((f, idx) => {
        const tr = el("tr", {}, []);

        // Ordning
        tr.appendChild(el("td", {}, [
          el("input", { class: inputClass(), value: String((f.order != null ? f.order : idx)), style:"width:72px;", onchange: (e) => {
            f.order = parseInt(e.target.value, 10);
            if (!Number.isFinite(f.order)) f.order = idx;
            App.setSchema(tabKey, schema);
          }}, [])
        ]));

        // Namn (nyckel). Tillåt edit vid ny fält, men rename blockas i App.setSchema (A).
        const nameInp = el("input", { class: inputClass(), value: String(f.name || ""), onchange: (e)=>{ f.name=e.target.value; App.setSchema(tabKey, schema);} }, []);
        const delBtn = el("button", { class:"btn btn-small", type:"button", onclick: () => {
          const ok = window.confirm("Ta bort fältet?");
          if (!ok) return;
          schema.fields = sortFields(schema.fields).filter(x => x !== f);
          schema.fields.forEach((x,i)=>x.order=i);
          App.setSchema(tabKey, schema);
        }}, ["Ta bort"]);
        tr.appendChild(el("td", {}, [ nameInp ]));

        // Grundtyp + attribut (separata kolumner för tydliga rubriker)
        const typeSel = makeTypeSelect(f.type || "text", (val) => { f.type = val; persist(); });

        const tdBase = el("td", {}, [typeSel]);
        const tdCorner = el("td", {}, [makeModCheckbox(f, "corner", (nf) => { f.mods = nf.mods; persist(); })]);
        const tdInitials = el("td", {}, [makeModCheckbox(f, "initials", (nf) => { f.mods = nf.mods; persist(); })]);
        const tdNotes = el("td", {}, [makeModCheckbox(f, "notes", (nf) => { f.mods = nf.mods; persist(); })]);

        tr.appendChild(tdBase);
        tr.appendChild(tdCorner);
        tr.appendChild(tdInitials);
        tr.appendChild(tdNotes);

        tr.appendChild(el("td", { style:"text-align:right;padding-left:18px;white-space:nowrap;width:8ch;" }, [ delBtn ]));
        tbody.appendChild(tr);
      });
    }

    rerender();
  }

  // ---------------------------
  // User view: data manipulation
  // ---------------------------
  
  // ---------------------------
  // Archive modal (read-only list + restore)
  // ---------------------------
  function openArchiveModal(state, tabKey, title) {
  const rowsAll = (App.listRows(tabKey, state) || []);
  const rows = rowsAll.filter(r => !!(r && r.archived));
  const schema = App.getSchema(tabKey, state) || { fields: [] };
  const fields = (schema.fields || []);
  const fieldNames = fields.map(f => String(f.name || "").trim()).filter(Boolean);

  const overlay = el("div", {
    class: "usp-modal-overlay",
    onclick: (e) => { if (e && e.target === overlay) overlay.remove(); },
    style: "position:fixed;inset:0;background:rgba(0,0,0,.35);z-index:9999;display:flex;align-items:flex-start;justify-content:center;padding:20px;overflow:auto;"
  }, []);

  const modal = el("div", {
    class:"usp-modal",
    style:"width:calc(100vw - 48px) !important;max-width:calc(100vw - 48px) !important;background:#fff;border-radius:10px;box-shadow:0 10px 30px rgba(0,0,0,.25);"
  }, [
    el("div", { class:"modal-head", style:"display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 16px;border-bottom:1px solid #ddd;" }, [
      el("div", { class:"title", style:"font-weight:700;" }, [String(title || "") + " – Arkiv"]),
      el("button", { class:"btn btn-secondary", type:"button", onclick: () => overlay.remove() }, ["Stäng"]),
    ]),
    el("div", { class:"modal-body", style:"padding:14px 16px;max-height:70vh;overflow:auto;" }, [
      rows.length ? (function(){
        const table = el("table", { class:"table", style:"width:100%;table-layout:auto;" }, []);
        table.appendChild(el("thead", {}, [
          el("tr", {}, [
            ...fieldNames.map(n => el("th", { style:"white-space:nowrap;" }, [n])),
            el("th", { style:"width:64px;text-align:center;white-space:nowrap;" }, [""])
          ])
        ]));
        const tbody = el("tbody", {}, []);
        rows.forEach(r => {
          const tr = el("tr", {}, []);
          fieldNames.forEach(n => {
            const v = (r && r.fields) ? r.fields[n] : "";
            tr.appendChild(el("td", {}, [ (v == null) ? "" : String(v) ]));
          });

          const delBtn = el("button", {
            class:"btn btn-secondary",
            type:"button",
            title:"Ta bort permanent",
            style:"padding:6px 10px;min-width:42px;",
            onclick: (ev) => {
              const rowNode = (ev && ev.target && typeof ev.target.closest === "function") ? ev.target.closest("tr") : null;
              openInlineConfirm({
                anchor: ev.currentTarget || ev.target,
                rowNode: rowNode,
                message: "Ta bort raden permanent från Arkiv?",
                onConfirm: function(){
                  try {
                    if (App && typeof App.deleteRow === "function") App.deleteRow(tabKey, r.id);
                  } catch(e) { console.error(e); }
                  try { overlay.remove(); } catch(_) {}
                  try { openArchiveModal(App.getState(), tabKey, title); } catch(_) {}
                }
              });
            }
          }, ["🗑"]);

          tr.appendChild(el("td", { style:"text-align:center;white-space:nowrap;" }, [delBtn]));
          tbody.appendChild(tr);
        });
        table.appendChild(tbody);
        return table;
      })() : el("div", { class:"hint" }, ["Arkivet är tomt."])
    ])
  ]);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);
}

  
function doneLabel() { return "Done"; }

function clearInlineConfirm() {
  try {
    document.querySelectorAll(".usp-inline-confirm").forEach(function(node){ node.remove(); });
  } catch(e) {}
  try {
    document.querySelectorAll(".is-pending-delete").forEach(function(node){ node.classList.remove("is-pending-delete"); });
  } catch(e) {}
}

function openInlineConfirm(opts){
  opts = opts || {};
  clearInlineConfirm();

  const anchorNode = opts.anchor || null;
  const rowNode = opts.rowNode || null;
  const message = String(opts.message || "Är du säker?");
  const onConfirm = (typeof opts.onConfirm === "function") ? opts.onConfirm : function(){};
  const onCancel = (typeof opts.onCancel === "function") ? opts.onCancel : function(){};

  if (rowNode && rowNode.classList) rowNode.classList.add("is-pending-delete");

  const box = el("div", { class:"usp-inline-confirm" }, [
    el("div", { class:"usp-inline-confirm__text" }, [message]),
    el("div", { class:"usp-inline-confirm__actions" }, [
      el("button", { class:"btn btn-danger", type:"button" }, ["Ja"]),
      el("button", { class:"btn btn-secondary", type:"button" }, ["Avbryt"])
    ])
  ]);

  const btnYes = box.querySelector(".btn-danger");
  const btnNo = box.querySelector(".btn-secondary");

  function cleanup(){
    try { box.remove(); } catch(_) {}
    try { if (rowNode && rowNode.classList) rowNode.classList.remove("is-pending-delete"); } catch(_) {}
    try { document.removeEventListener("mousedown", onDocDown, true); } catch(_) {}
    try { window.removeEventListener("resize", positionBox, true); } catch(_) {}
    try { window.removeEventListener("scroll", positionBox, true); } catch(_) {}
  }

  function positionBox(){
    if (!box.isConnected) return;
    const rect = (anchorNode && anchorNode.getBoundingClientRect) ? anchorNode.getBoundingClientRect() : null;
    if (!rect) {
      box.style.top = "24px";
      box.style.left = "24px";
      return;
    }
    const top = Math.max(8, rect.bottom + 8 + window.scrollY);
    const left = Math.max(8, rect.right - 220 + window.scrollX);
    box.style.top = top + "px";
    box.style.left = left + "px";
  }

  function onDocDown(ev){
    try {
      if (!box.contains(ev.target) && !(anchorNode && anchorNode.contains && anchorNode.contains(ev.target))) {
        cleanup();
        onCancel();
      }
    } catch(_) {}
  }

  btnYes.addEventListener("click", function(ev){
    try { ev.preventDefault(); ev.stopPropagation(); } catch(_) {}
    cleanup();
    onConfirm();
  });

  btnNo.addEventListener("click", function(ev){
    try { ev.preventDefault(); ev.stopPropagation(); } catch(_) {}
    cleanup();
    onCancel();
  });

  document.body.appendChild(box);
  positionBox();
  document.addEventListener("mousedown", onDocDown, true);
  window.addEventListener("resize", positionBox, true);
  window.addEventListener("scroll", positionBox, true);

  return { close: cleanup };
}

window.openInlineConfirm = openInlineConfirm;

  function handleDone(state, tabKey, row) {
    if (!row) return;
    // R1 refactor: prefer centralized actions (non-breaking fallback below)
    try{
      if (App && App.Actions && typeof App.Actions.run === "function") {
        App.Actions.run(tabKey, "done", row, state);
        return;
      }
    }catch(e){}

    const ok = window.confirm("Markera som DONE?");
    if (!ok) return;

    if (tabKey === App.Tabs.DEV) {
      // DEV DONE: archive in DEV, create a new row in PRODUCT (Sälj)
      App.archiveRow(tabKey, row.id);

      const prodSchema = App.getSchema(App.Tabs.PRODUCT, App.getState());
      const prodFields = sortFields((prodSchema && prodSchema.fields) ? prodSchema.fields : []);
      const devSchema = App.getSchema(App.Tabs.DEV, App.getState());
      const devFields = sortFields((devSchema && devSchema.fields) ? devSchema.fields : []);

      const newRow = { id: "row_" + Date.now(), createdAt: new Date().toISOString(), fields: {} };

      // Copy by matching field names
      const devMap = {};
      devFields.forEach((f) => {
        const n = String(f.name || "").trim();
        if (n) devMap[n.toLowerCase()] = n;
      });

      prodFields.forEach((pf) => {
        const pn = String(pf.name || "").trim();
        if (!pn) return;
        const matchKey = devMap[pn.toLowerCase()];
        if (matchKey && row.fields && Object.prototype.hasOwnProperty.call(row.fields, matchKey)) {
          newRow.fields[pn] = row.fields[matchKey];
        } else {
          newRow.fields[pn] = "";
        }
      });

      // Fallback: put first DEV field into first PRODUCT field if empty
      const devFirst = devFields[0] ? String(devFields[0].name || "").trim() : "";
      const prodFirst = prodFields[0] ? String(prodFields[0].name || "").trim() : "";
      if (devFirst && prodFirst) {
        const v = (row.fields && row.fields[devFirst]) ? String(row.fields[devFirst]) : "";
        if (v && !newRow.fields[prodFirst]) newRow.fields[prodFirst] = v;
      }

      App.upsertRow(App.Tabs.PRODUCT, newRow);
      return;
    }

    if (tabKey === App.Tabs.PRODUCT) {
      // PRODUCT Done: archive
      App.archiveRow(tabKey, row.id);
      return;
    }

    if (tabKey === App.Tabs.PROJECT || tabKey === "project") {
      // PROJECT Done: archive
      App.archiveRow(tabKey, row.id);
      return;
    }

    if (tabKey === App.Tabs.TODO) {
      // TODO DONE: archive in TODO
      App.archiveRow(tabKey, row.id);
      return;
    }
  }


// ===== Row actions (R2) =====
function _fmtYMD(d){
  const y = d.getFullYear();
  const m = String(d.getMonth()+1).padStart(2,"0");
  const da = String(d.getDate()).padStart(2,"0");
  return `${y}-${m}-${da}`;
}

function legacyRowActions(tabKey, schema, row){
  // R3 refactor: prefer centralized actions menu when available
  try{
    if (App && App.Actions && typeof App.Actions.getMenu === "function" && typeof App.Actions.run === "function") {
      const menu = App.Actions.getMenu(tabKey) || [];
      return menu.map(mi => ({
        id: mi.id,
        label: mi.label,
        run: function(){ try{ App.Actions.run(tabKey, mi.id, row, App.getState()); }catch(e){} }
      }));
    }
  }catch(e){}

  try{ if (App && App.Tabs && tabKey === App.Tabs.ROUTINES) return []; }catch(e){}
  const fields = (schema && Array.isArray(schema.fields)) ? schema.fields : [];
  const byName = new Map(fields.map(f => [String(f.name||""), f]));
  const byLower = new Map(fields.map(f => [String(f.name||"").toLowerCase(), f]));
  const actions = [];

  const klartField = byName.get("Klart") || byLower.get("klart");
  const statusField = byName.get("Status") || byLower.get("status");

  actions.push({
    id: "done",
    label: doneLabel(),
    run: function(){
      try{
        if (typeof handleDone === "function") { handleDone(App.getState(), tabKey, row); return; }
      }catch(e){}
      try{
        if (klartField) {
          const today = _fmtYMD(new Date());
          const next = Object.assign({}, row);
          next.fields = Object.assign({}, row.fields || {});
          next.fields[klartField.name] = today;
          App.upsertRow(tabKey, next);
          return;
        }
        if (statusField) {
          const next = Object.assign({}, row);
          next.fields = Object.assign({}, row.fields || {});
          next.fields[statusField.name] = "green";
          App.upsertRow(tabKey, next);
          return;
        }
        const next = Object.assign({}, row);
        next.fields = Object.assign({}, row.fields || {});
        next.fields["Done"] = "1";
        App.upsertRow(tabKey, next);
      }catch(e){}
    }
  });

  actions.push({
    id: "remove",
    label: "Ta bort",
    run: function(){
      try{
        if (typeof App.archiveRow === "function") App.archiveRow(tabKey, row.id);
        else {
          const next = Object.assign({}, row, { archived: true, updatedAt: new Date().toISOString() });
          App.upsertRow(tabKey, next);
        }
      }catch(e){}
    }
  });

  return actions;
}


// R5 refactor: Single gateway for row actions (override -> App.Actions -> legacy)
function getRowActions(tabKey, schema, row, actions){
  // 1) Caller override (function/array) wins
  if (typeof actions === "function") return (actions(row, tabKey, schema) || []);
  if (Array.isArray(actions)) return actions;

  // 2) Central actions
  try{
    if (App && App.Actions && typeof App.Actions.getMenu === "function" && typeof App.Actions.run === "function") {
      const menu = App.Actions.getMenu(tabKey) || [];
      return menu.map(mi => ({
        id: mi.id,
        label: mi.label,
        run: function(){ try{ App.Actions.run(tabKey, mi.id, row, App.getState()); }catch(e){} }
      }));
    }
  }catch(e){}

  // 3) Legacy fallback
  return legacyRowActions(tabKey, schema, row);
}

// Back-compat: keep old API name but route through gateway
function defaultRowActions(tabKey, schema, row){
  return getRowActions(tabKey, schema, row, null);
}

function renderRowActionsCell(tabKey, schema, row, actions){
  const acts = getRowActions(tabKey, schema, row, actions);
  if (!acts || acts.length === 0) return el("div", {}, [""]);
  const sel = el("select", { class: "row-actions", onchange: (ev) => {
    const v = String(ev.target.value||"");
    if (!v) return;
    const a = acts.find(x => String(x.id) === v);
    try { if (a && typeof a.run === "function") a.run(); } catch(e){}
    try { ev.target.value = ""; } catch(e){}
  }}, [
    el("option", { value: "" }, ["Action"]),
    ...acts.map(a => el("option", { value: a.id }, [a.label]))
  ]);
  return sel;
}

function dataTableView(state, tabKey, title, opts) {
    // VERSION 247: shared renderer (stable helpers)
    // Fixed tables: ensure schema is present (Dev/Product/ToDo/Project/Routines)
    try {
      if (App.FixedTables && typeof App.FixedTables.ensureSchema === "function") {
        App.FixedTables.ensureSchema(tabKey, state);
      }
    } catch (e) {}
    
function onNotesClick(rowId, fieldName) {
  const st = App.getState();
  const row = getRowSafe(tabKey, rowId, st);
  if (!row) return;
  const fields = Object.assign({}, row.fields || {});
  const existing = readNotesLog(fields, fieldName);

  const isRoutinesTab = (App && App.Tabs && tabKey === App.Tabs.ROUTINES);
  const isAdmin = (App && typeof App.isAdminUser === "function") ? !!App.isAdminUser(st) : !!(App && App.isAdmin);
  const canEditNotes = !isRoutinesTab || isAdmin;

  openNotesModal(
    tabKey,
    fieldName,
    existing,
    canEditNotes ? function(t){
      if (!t) return;
      const byIni = (App.getActingUser ? ((App.getActingUser(st).initials)||"") : "");
      const nextLog = existing.concat([{ ts: new Date().toISOString(), by: byIni, text: t }]);
      writeNotesLog(fields, fieldName, nextLog);
      const nextRow = Object.assign({}, row, { fields, updatedAt: new Date().toISOString() });
      App.upsertRow(tabKey, nextRow);
    } : null,
    canEditNotes ? {} : { readOnly: true }
  );
}

function hasNotesInCell(row, fieldName) {
      try {
        const log = readNotesLog((row && row.fields) || {}, fieldName);
        return Array.isArray(log) && log.length > 0;
      } catch (e) {
        return false;
      }
    }

    function updateCell(rowId, fieldName, val) {
      const st = App.getState();
      const cur = (getRowSafe(tabKey, rowId, st) || null);
      if (!cur) return;
      const next = {
        id: cur.id,
        createdAt: cur.createdAt,
        updatedAt: new Date().toISOString(),
        archived: !!cur.archived,
        fields: Object.assign({}, cur.fields || {})
      };
      next.fields[String(fieldName||"")] = val;
      App.upsertRow(tabKey, next);
    }

    const view = byId("usp-view");
    if (!view) return;
    if (!(opts && opts.append)) setHtml(view, "");

    const isRoutines = (tabKey === App.Tabs.ROUTINES);
    const _noActions = !!(opts && opts.noActions);
    const _addActionsCol = !_noActions && !isRoutines;
      if (isRoutines && !_routinesSchemaEnsured) { _routinesSchemaEnsured = true; try{ if (App.FixedTables && typeof App.FixedTables.ensureSchema === "function") App.FixedTables.ensureSchema(tabKey, state); }catch(e){} }

    // Re-read schema after potential routines patch
    const schema = App.getSchema(tabKey, state);
  const fieldsAll = sortFields(schema.fields || []);
const todoNew = !!(opts && opts.todoNew) && (App.Tabs && tabKey === App.Tabs.TODO);
const onlyFields = (opts && Array.isArray(opts.onlyFields)) ? opts.onlyFields.map(x => String(x)) : null;
const fields = onlyFields
  ? onlyFields.map(n => fieldsAll.find(f => String(f.name||"").trim() === String(n).trim())).filter(Boolean)
  : (todoNew ? fieldsAll.filter(f => ["Kategori","Beskrivning","Klart"].includes(String(f.name||"").trim())) : fieldsAll);


    const isAdmin = (App && typeof App.isAdminUser === "function") ? !!App.isAdminUser(state) : (String(role||"") === "admin");
    const routinesEditable = isRoutines && isAdmin;
    const routinesReadOnly = isRoutines && !routinesEditable;
    const allowDelete = (!isRoutines) && (opts && typeof opts.allowDelete === "boolean" ? opts.allowDelete : (tabKey === App.Tabs.DEV || tabKey === App.Tabs.PRODUCT));

    // User works with data; routines are read-only.
    const rowsAll = (App.listRows(tabKey, state) || []);
    let rows = rowsAll.filter(r => !r.archived);
    if (opts && Array.isArray(opts.rows)) rows = opts.rows;
    if (opts && typeof opts.filterRows === "function") {
      try { rows = opts.filterRows(rows, rowsAll) || rows; } catch(e) {}
    }

    // Buttons
    // - Rutiner: admin kan skapa nya rutiner (+ Ny rad). User har inga actions.
    // - Övriga tabs: + Ny rad + Arkiv
    const heroButtons = [];
    if (isRoutines) {
      if (routinesEditable) {
        
heroButtons.push(el("button", { class: btnClass("primary"), type:"button", "data-action":"new_row", "data-tab": tabKey, onclick: () => {
        try{
  if (typeof openRowModal === "function") {
    openRowModal(tabKey, { title: "Ny rutin", onlyFields: ["Rutin","Steg1","Steg2","Steg 3","Steg 4","Steg5"] });
    return;
  }
}catch(e){}
        const base = { id: "row_" + Date.now(), createdAt: new Date().toISOString(), fields: {} };
          fields.forEach(f => { const k = String(f.name || "").trim(); if (k) base.fields[k] = ""; });
          App.upsertRow(tabKey, base);
        }}, ["+ Ny rad"]));
      }
    } else {
      heroButtons.push(el("button", { class: btnClass("primary"), type:"button", "data-action":"new_row", "data-tab": tabKey, onclick: (e) => {
        try{
          const st = (App && typeof App.getState === "function") ? App.getState() : null;
          if (USP && USP.UI && typeof USP.UI.dispatchTabAction === "function") {
            const handled = USP.UI.dispatchTabAction(tabKey, "new_row", st);
            if (handled) return;
          }
        }catch(err){}

        // If modal router is unavailable or failed, do NOT create a row silently.
        try{ console.warn("[ui] new_row modal not available for tab", tabKey); }catch(e){}
      } }, [ (tabKey === (App.Tabs && App.Tabs.DEV ? App.Tabs.DEV : "dev") ? "+ Ny Utveckling" : (tabKey === (App.Tabs && App.Tabs.PRODUCT ? App.Tabs.PRODUCT : "product") ? "+ Ny Produkt" : "+ Ny rad")) ]));

      heroButtons.push(el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
        openArchiveModal(App.getState(), tabKey, title);
      }}, ["Arkiv"]));
    }
    if (!(opts && opts.noHero)) {

    view.appendChild(hero(
      title,
      isRoutines ? (routinesEditable ? "Admin skapar rutiner (ny rutin = Ny rad). User kan bara läsa." : "Rutiner är en passiv beskrivning som kan läsas av alla.") : "",
      heroButtons
    ));
    }

    const fieldNames = fields.map(f => String(f.name || "").trim()).filter(Boolean);

    const table = el("table", { class: isRoutines ? "table routines-table" : "table" }, []);
    table.appendChild(el("thead", {}, [
      el("tr", {}, [
        ...fieldNames.map(n => el("th", { style: (n==="Kategori" ? "width:17ch;" : (n==="Klart" ? "width:12ch;" : null)) }, [n])),
        ...( _addActionsCol ? [el("th", { style:"width:12ch;" }, ["Action"])] : []),
      ])
    ]));

    const tbody = el("tbody", {}, []);
    table.appendChild(tbody);
    view.appendChild(table);

    function rerender() {
      setHtml(tbody, "");
      const freshRows = (App.listRows(tabKey, App.getState()) || []).filter(r => !r.archived);

      freshRows.forEach((r) => {
        const tr = el("tr", {}, []);
        fieldNames.forEach((n) => {
          if (routinesReadOnly) {
            const field = (fields || []).find(x => String(x.name || "").trim() === n) || { name: n, type: "text", mods: { notes: true } };
            let tkey = (App.FieldTypes && App.FieldTypes.normalizeBaseType) ? App.FieldTypes.normalizeBaseType(field.type) : String(field.type || "text");
            const cellVal = ((r.fields && r.fields[n]) != null ? (r.fields && r.fields[n]) : "");
            tr.appendChild(el("td", {}, [
              (App.FieldTypes && typeof App.FieldTypes.renderEditor === "function")
                ? App.FieldTypes.renderEditor({
                    baseType: tkey,
                    type: (field && field.type) ? field.type : tkey,
                    mods: (field && field.mods) ? field.mods : { notes: true },
                    registry: (field && (field.registry || field.reg || field.registryName)) ? (field.registry || field.reg || field.registryName) : null,
                    value: cellVal,
                    disabled: false,
                    onChange: function(v){ updateCell(r.id, n, v); },
                    notesHas: hasNotesInCell(r, n),
          initialsNotesHas: (field && field.mods && field.mods.initials) ? hasNotesForInitials(r, n) : false,
onNotesClick: (field && field.mods && (field.mods.notes || field.mods.initials)) ? (() => addNoteToCell(tabKey, r.id, (field.mods && field.mods.initials) ? initialsKeyFor(n) : n, { labelField: n })) : null,
                    onChange: function(){},
                  })
                : String(cellVal)
            ]));
            return;
          }
          tr.appendChild(el("td", {}, [
            (function () {
              const field = (fields || []).find(x => String(x.name || "").trim() === n) || { name: n, type: "text" };
              let tkey = (App.FieldTypes && App.FieldTypes.normalizeBaseType) ? App.FieldTypes.normalizeBaseType(field.type) : String(field.type || "text");
              const cellVal = ((r.fields && r.fields[n]) != null ? (r.fields && r.fields[n]) : "");

              // Custom per-field renderer hook (used by fixed tables like Project).
              if (opts && typeof opts.fieldCellRenderer === "function") {
                try {
                  const node = opts.fieldCellRenderer({ tabKey, row: r, field, fieldName: n, value: cellVal, updateCell });
                  if (node) return node;
                } catch(e) {}
              }

              // Routines: read-only already handled above.
              if (App.FieldTypes && typeof App.FieldTypes.renderEditor === "function") {
                return App.FieldTypes.renderEditor({
                  baseType: tkey,
                    type: (field && field.type) ? field.type : tkey,
                  mods: (field && field.mods) ? field.mods : {},
                  registry: (field && (field.registry || field.reg || field.registryName)) ? (field.registry || field.reg || field.registryName) : null,
                  value: cellVal,
                  disabled: false,
                  notesHas: hasNotesInCell(r, n),
          initialsNotesHas: (field && field.mods && field.mods.initials) ? hasNotesForInitials(r, n) : false,
onNotesClick: (field && field.mods && (field.mods.notes || field.mods.initials)) ? (() => addNoteToCell(tabKey, r.id, (field.mods && field.mods.initials) ? initialsKeyFor(n) : n, { labelField: n })) : null,
                  // base value change
                  onChange: (val) => { updateCell(r.id, n, val); },
                  // corner addon (stored separately)
                  cornerValue: ((r.fields && r.fields[cornerKeyFor(n)]) != null ? (r.fields && r.fields[cornerKeyFor(n)]) : ""),
                  onCornerChange: ((field && field.mods && field.mods.corner) || tkey === "status") ? (cval) => {
                    const st = App.getState();
                    const cur = (getRowSafe(tabKey, r.id, st) || r);
                    const next = { id: cur.id, createdAt: cur.createdAt, updatedAt: new Date().toISOString(), archived: !!cur.archived, fields: Object.assign({}, cur.fields || {}) };
                    next.fields[cornerKeyFor(n)] = String(cval || "");
                    // if base is status, also store in main value for consistency
                    if (tkey === "status") next.fields[n] = String(cval || "");
                    App.upsertRow(tabKey, next);
                  } : undefined,
                  // initials addon
                  initialsValue: ((r.fields && r.fields[initialsKeyFor(n)]) != null ? (r.fields && r.fields[initialsKeyFor(n)]) : "--"),
                  onInitialsClick: (field && field.mods && field.mods.initials) ? () => {
                    const curIni = ((r.fields && r.fields[initialsKeyFor(n)]) != null ? (r.fields && r.fields[initialsKeyFor(n)]) : "--");
                    openInitialsPicker(tabKey, r.id, n, curIni, function(pick){
                      if (!pick) pick = "--";
                      const st = App.getState();
                      const cur = (getRowSafe(tabKey, r.id, st) || r);
                      const next = { id: cur.id, createdAt: cur.createdAt, updatedAt: new Date().toISOString(), fields: Object.assign({}, cur.fields || {}) };
                      next.fields[initialsKeyFor(n)] = String(pick || "--");
                      App.upsertRow(tabKey, next);
                    });
                  } : undefined,
                });
              }

              // fallback to text input
              const inp = el("input", { class: inputClass(), value: String(((r.fields && r.fields[n]) != null ? (r.fields && r.fields[n]) : "")) }, []);
              inp.addEventListener("input", (e) => {
                const st = App.getState();
                const cur = (getRowSafe(tabKey, r.id, st) || r);
                const next = { id: cur.id, createdAt: cur.createdAt, updatedAt: new Date().toISOString(), archived: !!cur.archived, fields: Object.assign({}, cur.fields || {}) };
                next.fields[n] = e.target.value;
                App.upsertRow(tabKey, next);
              });
              return inp;
            })()
          ]));

  });

  if (_addActionsCol) {
    tr.appendChild(el("td", { class:"cell-actions" }, [
      renderRowActionsCell(tabKey, schema, r, (opts && opts.rowActions) ? opts.rowActions : null)
    ]));
  }

  tbody.appendChild(tr);
});
    }

    // re-render after commits
    const prev = window.USP && window.USP.Actions && window.USP.Actions.onAfterCommit;
    if (window.USP && window.USP.Actions) {
      window.USP.Actions.onAfterCommit = function () {
        try { if (typeof prev === "function") prev(); } catch (e) {}
        rerender();
      };
    }

    rerender();
  }


  // Backwards-compatible alias (call sites may still use userDataView)
  function userDataView(state, tabKey, title, opts) {
    // Delegate table rendering for selected tabs to TabCore (split out from this large file).
    try {
      if (window.USP && window.USP.UI && window.USP.UI.TabCore && typeof window.USP.UI.TabCore.renderTab === "function") {
        var t = String(tabKey || "").toLowerCase();
        if (t === "dev" || t === "product" || t === "routines") {
          window.USP.UI.TabCore.renderTab(state, tabKey, title, opts);
          return;
        }
      }
    } catch (e) {}
    return dataTableView(state, tabKey, title, opts);
  }


function todoView(state) {
  const tabKey = App.Tabs.TODO;
  const title = "ToDo";

  const view = byId("usp-view");
  if (!view) return;

  const st0 = App.getState();
  const session0 = (st0 && st0.session) ? st0.session : {};

  // Ensure predictable defaults once per session (oförstörande)
  if (!session0.__todoFilterInitDone) {
    const st2 = (App.cloneState ? App.cloneState(st0) : JSON.parse(JSON.stringify(st0)));
    st2.session = st2.session || {};
    st2.session.__todoFilterInitDone = true;
    if (!st2.session.todoFilterCat) st2.session.todoFilterCat = "Alla";
    if (st2.session.todoOnlyMine == null) st2.session.todoOnlyMine = false;
    if (st2.session.todoUserFilterId == null) st2.session.todoUserFilterId = "";
    App.commitState(st2);
    return;
  }

  setHtml(view, "");

  const st = App.getState();
  const session = (st && st.session) ? st.session : {};
  const filterCat = String(session.todoFilterCat || "Alla");
  const onlyMine = !!session.todoOnlyMine;
  const userFilterId = String(session.todoUserFilterId || "");
  const isAdminTodo = String(App.role ? App.role(st) : "").toLowerCase() === "admin";

  // Logged in initials (for Private rule in TableUI)
  let meIni = "";
  try {
    const a = (App.getActingUser ? App.getActingUser(st) : (st.user || {})) || {};
    meIni = computeInitials(a) || "";
  } catch(e) {}

  const cats = ["Alla","Allmänt","Info","Kontor","Shopify B2C","Shopify B2B","Logistik","Privat"];

  const filterSelect = el("select", {
    onchange: (ev) => {
      const v = String(ev.target.value || "Alla");
      const s0 = App.getState();
      const s2 = (App.cloneState ? App.cloneState(s0) : JSON.parse(JSON.stringify(s0)));
      s2.session = s2.session || {};
      s2.session.todoFilterCat = v;
      s2.session.todoOnlyMine = false; // filter styr
      App.commitState(s2);
    }
  }, cats.map(v => el("option", { value: v }, [v])));
  try { filterSelect.value = String(filterCat || "Alla"); } catch(e) {}

  const filterRow = el("div", { style:"display:flex;align-items:center;gap:12px;margin:10px 0 18px 0;" }, [
    el("div", { class:"muted", style:"font-weight:600;" }, ["Filter:"]),
    filterSelect
  ]);

  const todoUsers = (() => {
    try {
      const all = (App.listUsers && typeof App.listUsers === "function") ? (App.listUsers(st) || []) : [];
      const seen = {};
      return all.filter(u => {
        const id = String((u && u.id) || "").trim();
        if (!id || seen[id]) return false;
        seen[id] = true;
        return true;
      });
    } catch(e) { return []; }
  })();

  const userFilterSelect = el("select", {
    class:"input",
    style:"min-width:170px;",
    onchange: (ev) => {
      const v = String(ev.target.value || "");
      const s0 = App.getState();
      const s2 = (App.cloneState ? App.cloneState(s0) : JSON.parse(JSON.stringify(s0)));
      s2.session = s2.session || {};
      s2.session.todoUserFilterId = v;
      s2.session.todoOnlyMine = false;
      App.commitState(s2);
    }
  }, [
    el("option", { value:"" }, ["Välj användare"])
  ].concat(todoUsers.map(u => {
    const ini = computeInitials(u) || "";
    const label = String((u && u.name) || (u && u.email) || ini || "User");
    const txt = ini ? (ini + " • " + label) : label;
    return el("option", { value: String((u && u.id) || "") }, [txt]);
  })));
  try { userFilterSelect.value = userFilterId; } catch(e) {}

  const btnMineClass = btnClass("secondary") + (onlyMine ? " btn-mine-active" : "");
  const btnUserClass = btnClass("secondary") + (userFilterId ? " btn-mine-active" : "");
  const heroButtons = [];
  if (isAdminTodo) {
    heroButtons.push(
      el("button", { class: btnUserClass, type:"button", onclick: () => {
        const s0 = App.getState();
        const s2 = (App.cloneState ? App.cloneState(s0) : JSON.parse(JSON.stringify(s0)));
        s2.session = s2.session || {};
        if (String(s2.session.todoUserFilterId || "")) {
          s2.session.todoUserFilterId = "";
        } else {
          const firstUser = (todoUsers && todoUsers.length) ? String((todoUsers[0] && todoUsers[0].id) || "") : "";
          s2.session.todoUserFilterId = firstUser;
          s2.session.todoOnlyMine = false;
        }
        App.commitState(s2);
      }}, ["USER"])
    );
    heroButtons.push(userFilterSelect);
  }
  heroButtons.push(
    el("button", { class: btnMineClass, type:"button", onclick: () => {
      const s0 = App.getState();
      const s2 = (App.cloneState ? App.cloneState(s0) : JSON.parse(JSON.stringify(s0)));
      s2.session = s2.session || {};
      s2.session.todoOnlyMine = !onlyMine;
      if (s2.session.todoOnlyMine) s2.session.todoUserFilterId = "";
      App.commitState(s2);
    }}, ["Mina ToDo"])
  );
  heroButtons.push(
    el("button", { class: btnClass("primary"), type:"button", onclick: () => {
      openRowModal(tabKey, { todoNew: true, title: "Ny ToDo" });
    }}, ["Ny ToDo"])
  );
  heroButtons.push(
    el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
      openArchiveModal(App.getState(), tabKey, title);
    }}, ["Arkiv"])
  );

  // Keep the week badge like before (pure UI)
  let weekNo = "";
  let wr = null;
  try {
    weekNo = String(isoWeekNumber(new Date()));
    wr = weekRange(new Date());
  } catch(e) {}

  const headerLeft = el("div", { style:"display:flex;flex-direction:column;gap:6px;" }, [
    el("div", { style:"display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;" }, [
      el("div", { class:"hero-title", style:"font-size:40px;line-height:1.05;font-weight:800;" }, [title]),
      weekNo ? el("div", { class:"hero-subtitle", style:"font-size:20px;font-weight:700;" }, ["Vecka " + weekNo]) : null
    ].filter(Boolean)),
    (wr && wr.from && wr.to) ? el("div", { class:"hint", style:"font-size:12px;margin-left:0;" }, [`${wr.from} – ${wr.to}`]) : null
  ].filter(Boolean));

  const header = el("div", { class:"hero", style:"display:flex;align-items:flex-start;justify-content:space-between;gap:16px;flex-wrap:wrap;" }, [
    headerLeft,
    el("div", { style:"display:flex;gap:10px;align-items:center;flex-wrap:wrap;" }, heroButtons)
  ]);

  view.appendChild(header);
  view.appendChild(filterRow);

  // Render table via TableUI (single source of truth for row selection + filtering)
  try{
    const t = (window.USP && USP.UI && USP.UI.TableUI && typeof USP.UI.TableUI.renderFixedTable === "function")
      ? USP.UI.TableUI.renderFixedTable(App.getState(), tabKey, title)
      : null;
    if (t) view.appendChild(t);
    else dataTableView(App.getState(), tabKey, title, { append:true, noHero:true });
  }catch(e){
    try{ console.error("todoView render table failed", e); }catch(_){}
  }
}


  // ===========================
  // Projekt view (fixed table + modal add)
  // VERSION 226
  // ===========================
  const PROJECT_CATEGORIES_UI = ["kundprojekt","volymprojekt","samarbetsprojekt"];

  function projectArchiveKey() { return "project_archive"; }

  function renderProjectCategoryCell(row, tabKey, onPick) {
    const value = String((row && row.fields && row.fields["Kategori"]) || "");
    const label = value || "Välj";
    const wrap = el("div", { style:"position:relative;display:inline-block;overflow:hidden;width:17ch;min-width:17ch;max-width:17ch;" }, []);

    const disp = el("div", {
      class:"input",
      style:"display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;user-select:none;width:100%;padding-right:26px;"
    }, [ label ]);

    const caret = el("span", { style:"position:absolute;right:8px;top:50%;transform:translateY(-50%);pointer-events:none;opacity:0.7;" }, ["▾"]);

    const sel = el("select", {
      style:"position:absolute;inset:0;opacity:0;cursor:pointer;width:100%;height:100%;pointer-events:auto;",
      title:"Kategori"
    }, [
      el("option", { value:"" }, ["Välj"]),
      ...PROJECT_CATEGORIES_UI.map(v => el("option", { value:v }, [v]))
    ]);
    sel.value = value;

    sel.addEventListener("change", function(){
      const v = sel.value;
      if (typeof onPick === "function") onPick(v);
      // update visible label
      disp.textContent = v || "Välj";
    });

    disp.addEventListener("click", function(){
      try { sel.focus(); sel.click(); } catch(e) {}
    });

    wrap.appendChild(disp);
    wrap.appendChild(caret);
    wrap.appendChild(sel);
    return wrap;
  }

  let _projectNewModalOpen = false;
  function openNewProjectModal(tabKey, state) {
    // R3: open modal for new Project row
    const k = (App.Tabs && App.Tabs.PROJECT) ? App.Tabs.PROJECT : (tabKey || "project");
  }

  function projectView(state, tabKey, title) {
  // 4B: Unified renderer for fixed Project table via dataTableView()
  try { if (App.FixedTables && typeof App.FixedTables.ensureSchema === "function") App.FixedTables.ensureSchema(tabKey, state); } catch(e) {}

  const PROJECT_CATEGORIES = ["kundprojekt", "volymprojekt", "samarbetsprojekt"];

  function nextCategory(v) {
    const cur = String(v || "").trim().toLowerCase();
    const i = PROJECT_CATEGORIES.indexOf(cur);
    const ni = (i < 0) ? 0 : ((i + 1) % PROJECT_CATEGORIES.length);
    return PROJECT_CATEGORIES[ni];
  }

  return dataTableView(state, tabKey, title, {
    fixed: true,
    fieldCellRenderer: ({ row, fieldName, value, updateCell }) => {
      if (String(fieldName) !== "Kategori") return null;

      const opts = ["", "samarbete", "volym", "kund"];
      // Ensure required option exists (non-destructive)
      if (opts.indexOf("utveckling") === -1) opts.splice(2, 0, "utveckling");
      try { if (localStorage && String(localStorage.USP_DEBUG_PROJECT_KATEGORI) === "1") console.info("[UI][ProjectKategori] options", opts.slice()); } catch (e) {}

      const sel = el("select", {
        class: "usp-select usp-select--compact",
        value: (value == null ? "" : String(value)),
        onchange: (e) => {
          try { e && e.stopPropagation && e.stopPropagation(); } catch (_) {}
          const v = e && e.target ? e.target.value : "";
          updateCell(row.id, "Kategori", v);
        },
        onclick: (e) => { try { e && e.stopPropagation && e.stopPropagation(); } catch (_) {} },
        onmousedown: (e) => { try { e && e.stopPropagation && e.stopPropagation(); } catch (_) {} },
        onmouseup: (e) => { try { e && e.stopPropagation && e.stopPropagation(); } catch (_) {} },
      }, opts.map((o) => el("option", { value: o }, o === "" ? "Välj" : o)));

      return sel;
    }
  });
}

  // ---------------------------
  // Change user (always available)
  // ---------------------------
  function openChangeUser(state) {
    const view = byId("usp-view");
    if (!view) return;
    if (!(opts && opts.append)) setHtml(view, "");

    const users = App.listUsers(state);

    const wrap = el("div", { class:"manage-users-wrap" }, []);
    wrap.appendChild(el("div", { class:"manage-users-header" }, [
      el("div", { class:"manage-users-title" }, ["Change user"]),
      el("button", { class:"btn btn-small", type:"button", onclick: () => App.setTab(App.getTab(state)) }, ["Tillbaka"]),
    ]));

    const list = el("div", { class:"manage-users-list" }, []);
    users.forEach((u) => {
      const row = el("div", { class:"manage-user-row" }, [
        el("button", { class:"link-btn manage-user-name", type:"button", onclick: () => {
          // Special shortcut: selecting the test user "Dev Ny rad" should switch to admin user instead
          try{
            const name = String(u && u.name || "");
            if (name.toLowerCase() === "dev ny rad") {
              const st2 = App.getState ? App.getState() : state;
              const users2 = App.listUsers ? App.listUsers(st2) : [];
              const admin = users2.find(x => String(x && x.role || "").toLowerCase() === "admin");
              if (admin && admin.id) { App.setCurrentUser(admin.id); return; }
              // If no admin exists, promote this user
              if (App.updateUser) { App.updateUser(Object.assign({}, u, { role: "admin" })); }
            }
          }catch(e){}
          App.setCurrentUser(u.id);
        }}, [ (u.name || "User") + (u.email ? " • " + u.email : "") ]),
      ]);
      list.appendChild(row);
    });
    wrap.appendChild(list);

    view.appendChild(wrap);
  }

  // ---------------------------
  // Manage users (admin)
  // ---------------------------
  function openManageUsers(state) {
    const view = byId("usp-view");
    if (!view) { try{ console.error("[ui] usp-view missing in openManageUsers"); }catch(e){} return; }
    setHtml(view, "");
const role = App.role(state);
    if (role !== "admin") {
      view.appendChild(hero("Manage users", "Endast admin.", []));
      return;
    }

    const wrap = el("div", { class:"manage-users-wrap" }, []);
    view.appendChild(wrap);

    const header = el("div", { class:"manage-users-header" }, [
      el("div", { class:"manage-users-title" }, ["Manage users"]),
      el("div", { style:"display:flex;gap:10px;align-items:center;" }, [
        el("button", { class:"btn btn-small btn-secondary", type:"button", onclick: () => openChangeUser(App.getState()) }, ["Change user"]),
        el("button", { class:"btn btn-small btn-primary", type:"button", onclick: () => {
          const id = "u_" + Date.now();
          App.addUser({ id, name:"New user", initials:"", email:"", role:"user" });
          openUserEditor(id);
        }}, ["+ Add user"]),
      ])
    ]);
    wrap.appendChild(header);

    const list = el("div", { class:"manage-users-list" }, []);
    wrap.appendChild(list);

    function renderList() {
      setHtml(list, "");
      const users = App.listUsers(App.getState());

      if (!users.length) {
        list.appendChild(el("div", { class:"hint", style:"padding:12px;" }, ["Inga användare ännu. Klicka + Add user."]));
        return;
      }

      users.forEach((u) => {
        const row = el("div", { class:"manage-user-row" }, []);
        const left = el("div", { style:"display:flex;flex-direction:column;gap:2px;" }, [
          el("button", { class:"link-btn manage-user-name", type:"button", onclick: () => openUserEditor(u.id) }, [
            (u.name || "User")
          ]),
          el("div", { class:"hint" }, [
            (u.email ? u.email : "(no email)") + (u.role ? " • " + u.role : "")
          ]),
        ]);
        const right = el("div", { style:"display:flex;gap:8px;align-items:center;" }, [
          el("button", { class:"btn btn-small btn-secondary", type:"button", onclick: () => {
            App.setCurrentUser(u.id);
          }}, ["Act as"]),
          el("button", { class:"icon-btn manage-user-delete", type:"button", onclick: (ev) => {
            const rowNode = (ev && ev.target && typeof ev.target.closest === "function") ? ev.target.closest(".manage-user-row") : null;
            openInlineConfirm({
              anchor: ev.currentTarget || ev.target,
              rowNode: rowNode,
              message: "Delete user?",
              onConfirm: function(){
                App.deleteUser(u.id);
                renderList();
              }
            });
          }}, ["🗑"]),
        ]);

        row.appendChild(left);
        row.appendChild(right);
        list.appendChild(row);
      });
    }

    function openUserEditor(userId) {
      const st = App.getState();
      const users = App.listUsers(st);
      const user = users.find(x => x && String(x.id) === String(userId));
      if (!user) { window.alert("User not found"); renderList(); return; }

      setHtml(view, "");
      const card = el("div", { class:"manage-users-wrap" }, []);
      view.appendChild(card);

      card.appendChild(el("div", { class:"manage-users-header" }, [
        el("div", { class:"manage-users-title" }, ["Edit user"]),
        el("div", { style:"display:flex;gap:10px;align-items:center;" }, [
          el("button", { class:"btn btn-small btn-secondary", type:"button", onclick: () => openManageUsers(App.getState()) }, ["Tillbaka"]),
          el("button", { class:"btn btn-small btn-secondary", type:"button", onclick: () => { App.setCurrentUser(user.id); } }, ["Act as"]),
        ])
      ]));

      const form = el("div", { class:"form-grid" }, []);

      const idInp = el("input", { class:"input full", value: String(user.id || ""), disabled:"true" }, []);
      const nameInp = el("input", { class:"input full", value: String(user.name || ""), placeholder:"Name" }, []);
      const initialsInp = el("input", { class:"input full", value: String(user.initials || ""), placeholder:"Initials (e.g. DE)" }, []);
      const emailInp = el("input", { class:"input full", value: String(user.email || ""), placeholder:"Email" }, []);
      const passInp = el("input", { class:"input full", value: String(user.password || ""), placeholder:"Password" }, []);

      const roleSel = el("select", { class:"input full" }, [
        el("option", { value:"user" }, ["user"]),
        el("option", { value:"admin" }, ["admin"]),
      ]);
      roleSel.value = user.role === "admin" ? "admin" : "user";

      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["ID (read-only)"]), idInp]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Name"]), nameInp]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Initials"]), initialsInp, el("div", { class:"hint" }, ["Används i TODO/Rutiner (t.ex. ägare/assignee)."])]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Email"]), emailInp]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Password"]), passInp, el("div", { class:"hint" }, ["Lokal demo: sparas i state (ingen hashing ännu)."])]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Role (metadata)"]), roleSel, el("div", { class:"hint" }, ["Roll här är metadata för framtida auth. Adminläge styrs av 'Switch role' i denna lokal-demo."])]));
      card.appendChild(form);

      const actions = el("div", { style:"display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;" }, []);
      const save = el("button", { class:"btn btn-primary", type:"button", onclick: () => {
        App.updateUser(user.id, { name: nameInp.value, initials: initialsInp.value, email: emailInp.value, role: roleSel.value });
        openManageUsers(App.getState());
      }}, ["Save"]);

      const del = el("button", { class:"btn btn-secondary", type:"button", onclick: (ev) => {
        const rowNode = (ev && ev.target && typeof ev.target.closest === "function") ? ev.target.closest(".manage-user-card, .usp-card, .card") : null;
        openInlineConfirm({
          anchor: ev.currentTarget || ev.target,
          rowNode: rowNode,
          message: "Delete user?",
          onConfirm: function(){
            App.deleteUser(user.id);
            openManageUsers(App.getState());
          }
        });
      }}, ["Delete"]);

      actions.appendChild(save);
      actions.appendChild(del);
      card.appendChild(actions);
    }

    renderList();
  }

  // ---------------------------
  // Settings (layout restored)
  // ---------------------------
  function settingsView(state) {
    const view = byId("usp-view");
    if (!view) return;
    if (!(opts && opts.append)) setHtml(view, "");
    view.appendChild(hero("Settings", "Öppna via Settings-knappen uppe till höger.", []));
  }


  // ---------------------------
  // DEFAULT view (admin-only placeholder)
  // ---------------------------

  function defaultView(state) {
    const view = byId("usp-view");
    if (!view) return;

    setHtml(view, "");

    const LS_KEY = "USP_DEFAULT_TABLE";
    function getSel() { try { return localStorage.getItem(LS_KEY) || "DEV"; } catch (e) { return "DEV"; } }
    function setSel(v) { try { localStorage.setItem(LS_KEY, v); } catch (e) {} }

    const sel = String(getSel() || "DEV").toUpperCase();

    const btnRow = el("div", { class:"tabs", style:"display:flex;gap:8px;align-items:center;justify-content:flex-end;" }, []);

    function mkBtn(label) {
      const active = sel === label;
      return el("button", {
        class: "tab " + (active ? "is-active" : ""),
        type: "button",
        onclick: () => { setSel(label); defaultView(state); }
      }, [label]);
    }

    ["DEV","PRODUCT","PROJECT"].forEach((k) => btnRow.appendChild(mkBtn(k)));

    view.appendChild(hero("DEFAULT", "", [btnRow]));

    // DEV: render a single defaults row using the same column definitions as FixedTables.DEV
    if (sel === "DEV") {
      const App = (window.USP && window.USP.App) ? window.USP.App : null;
      const FieldTypes = (App && App.FieldTypes) ? App.FieldTypes : null;
      const spec = (App && App.FixedTables) ? App.FixedTables.DEV : null;

      const wanted = [
        { name: "Design-Po" },
        { name: "Sample test" },
        { name: "Stort sample" },
        { name: "Q-test" },
        { name: "Prissättning" }
      ];

      function normName(s) {
        return String(s || "")
          .toLowerCase()
          .replace(/[åä]/g, "a")
          .replace(/ö/g, "o")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }

      function findColByName(name) {
        if (!spec || !Array.isArray(spec.columns)) return null;
        const target = normName(name);
        for (let i=0;i<spec.columns.length;i++){
          const c = spec.columns[i];
          if (normName(c && c.name) === target) return c;
        }
        return null;
      }

      function valueStorageKey(colDef) {
        return "USP_DEFAULTS_DEV__" + normName(colDef && colDef.name);
      }
      function notesStorageKey(colDef) {
        return "USP_DEFAULTS_DEV__NOTES__" + normName(colDef && colDef.name);
      }

      function readSavedValue(colDef) {
        const k = valueStorageKey(colDef);
        try { return localStorage.getItem(k) || ""; } catch (e) { return ""; }
      }
      function writeSavedValue(colDef, v) {
        const k = valueStorageKey(colDef);
        try { localStorage.setItem(k, String(v == null ? "" : v)); } catch (e) {}
      }

      function readSavedNotes(colDef) {
        const k = notesStorageKey(colDef);
        let raw = "";
        try { raw = localStorage.getItem(k) || ""; } catch (e) { raw = ""; }
        if (!raw || !String(raw).trim()) return [];
        const s = String(raw).trim();
        if (s.startsWith("[")) {
          try {
            const a = JSON.parse(s);
            return Array.isArray(a) ? a : [];
          } catch (e2) { return []; }
        }
        // legacy/plain text
        return [{ ts: new Date().toISOString(), title: s.split(/\r?\n/)[0].slice(0,60), text: s }];
      }
      function writeSavedNotes(colDef, logArr) {
        const k = notesStorageKey(colDef);
        let s = "[]";
        try { s = JSON.stringify(Array.isArray(logArr) ? logArr : []); } catch (e) { s = "[]"; }
        try { localStorage.setItem(k, s); } catch (e2) {}
      }
      function hasNotes(logArr) {
        const a = Array.isArray(logArr) ? logArr : [];
        for (let i=0;i<a.length;i++){
          const it = a[i] || {};
          const body = (it.text != null) ? it.text : (it.note != null ? it.note : (it.value != null ? it.value : ""));
          if (body != null && String(body).trim()) return true;
        }
        return false;
      }

      const cols = wanted.map((w) => ({ label: w.name, def: findColByName(w.name) }));

      // Draft state (in-memory, non-destructive until Save)
      const draftKey = "_defaultsDraftDev";
      const UI = (window.USP && window.USP.UI) ? window.USP.UI : (window.USP.UI = {});
      if (!UI[draftKey]) UI[draftKey] = {};
      if (!UI[draftKey].saved) UI[draftKey].saved = {};
      if (!UI[draftKey].draft) UI[draftKey].draft = {};
      if (!UI[draftKey].savedNotes) UI[draftKey].savedNotes = {};
      if (!UI[draftKey].draftNotes) UI[draftKey].draftNotes = {};
      if (UI[draftKey].dirty == null) UI[draftKey].dirty = false;

      function cloneArr(a){
        try { return JSON.parse(JSON.stringify(Array.isArray(a) ? a : [])); } catch(e){ return []; }
      }

      // Initialize saved+draft from localStorage on first render
      cols.forEach((c) => {
        if (!c.def) return;
        const kVal = normName(c.label);
        const kNotes = normName(c.def.name) + "__notes";
        if (UI[draftKey].saved[kVal] == null) UI[draftKey].saved[kVal] = readSavedValue(c.def);
        if (UI[draftKey].draft[kVal] == null) UI[draftKey].draft[kVal] = UI[draftKey].saved[kVal];

        if (UI[draftKey].savedNotes[kNotes] == null) UI[draftKey].savedNotes[kNotes] = readSavedNotes(c.def);
        if (UI[draftKey].draftNotes[kNotes] == null) UI[draftKey].draftNotes[kNotes] = cloneArr(UI[draftKey].savedNotes[kNotes]);
      });

      function isDirty() {
        if (UI[draftKey].dirty) return true;
        let dirty = false;
        cols.forEach((c) => {
          if (!c.def) return;
          const kVal = normName(c.label);
          const kNotes = normName(c.def.name) + "__notes";
          if (String(UI[draftKey].draft[kVal] || "") !== String(UI[draftKey].saved[kVal] || "")) dirty = true;
          // Notes dirty check: compare JSON strings
          let a = UI[draftKey].draftNotes[kNotes] || [];
          let b = UI[draftKey].savedNotes[kNotes] || [];
          let sa = "", sb = "";
          try { sa = JSON.stringify(a); } catch(e){ sa = ""; }
          try { sb = JSON.stringify(b); } catch(e){ sb = ""; }
          if (sa != sb) dirty = true;
        });
        return dirty;
      }

      const table = el("table", { class:"table", style:"margin-top:12px;" }, []);
      table.appendChild(el("thead", {}, [
        el("tr", {}, cols.map((c) => el("th", {}, [c.label])).concat([el("th", { style:"text-align:right;" }, ["Save"])]))
      ]));

      const saveBtn = el("button", {
        class: "btn btn-primary",
        type: "button",
        disabled: !isDirty(),
        onclick: () => {
          if (!isDirty()) return;

          cols.forEach((c) => {
            if (!c.def) return;
            const kVal = normName(c.label);
            const kNotes = normName(c.def.name) + "__notes";

            const v = UI[draftKey].draft[kVal];
            UI[draftKey].saved[kVal] = v;
            writeSavedValue(c.def, v);

            const log = UI[draftKey].draftNotes[kNotes] || [];
            UI[draftKey].savedNotes[kNotes] = cloneArr(log);
            writeSavedNotes(c.def, log);
            _logDefaults("[DEFAULT/DEV] saved", {col: c.def && c.def.name, keyVal: "USP_DEFAULTS_DEV__"+normName(c.def&&c.def.name), keyNotes: "USP_DEFAULTS_DEV__NOTES__"+normName(c.def&&c.def.name), val: v, notesLen: (log||[]).length});
          });

          UI[draftKey].dirty = false;
          try { saveBtn.disabled = true; } catch(e){}
        }
      }, ["Save"]);

      function refreshSaveState() {
        try { saveBtn.disabled = !isDirty(); } catch (e) {}
      }

      const tds = cols.map((c) => {
        const td = el("td", {}, []);
        if (!c.def || !FieldTypes || typeof FieldTypes.renderEditor !== "function") {
          td.appendChild(el("div", { class:"muted" }, [""]));
          return td;
        }

        const keyVal = normName(c.label);
        const keyNotes = normName(c.def.name) + "__notes";

        const ctx = {
          type: c.def.type,
          baseType: c.def.type,
          mods: c.def.mods || {},
          value: UI[draftKey].draft[keyVal],
          notesHas: hasNotes(UI[draftKey].draftNotes[keyNotes]),
          onNotesClick: (ev) => {
            openNotesModal("dev", c.def.name, UI[draftKey].draftNotes[keyNotes], (nextLog) => {
              UI[draftKey].draftNotes[keyNotes] = Array.isArray(nextLog) ? nextLog : [];
              UI[draftKey].dirty = true;
              refreshSaveState();
              defaultView(state);
            }, { title: "Anteckningar" });
          },
          onChange: (next) => {
            UI[draftKey].draft[keyVal] = next;
            UI[draftKey].dirty = true;
            refreshSaveState();
          }
        };

        const editor = FieldTypes.renderEditor(ctx);
        if (editor) td.appendChild(editor);
        return td;
      });

      const saveTd = el("td", { style:"text-align:right;white-space:nowrap;" }, [saveBtn]);

      table.appendChild(el("tbody", {}, [
        el("tr", {}, tds.concat([saveTd]))
      ]));

      view.appendChild(table);
      view.appendChild(el("div", { class:"hint", style:"margin-top:10px;font-size:14px;" }, ["to be continued"]));
      return;
    }

    // PRODUCT: render defaults editor using FixedTables.PRODUCT columns (single row)
    if (sel === "PRODUCT") {
      const App = (window.USP && window.USP.App) ? window.USP.App : null;
      const FieldTypes = (App && App.FieldTypes) ? App.FieldTypes : null;
      const spec = (App && App.FixedTables) ? App.FixedTables.PRODUCT : null;

      const normName = (s) => String(s || "")
        .toLowerCase()
        .replace(/[åä]/g, "a")
        .replace(/ö/g, "o")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Dynamic DEFAULT/PRODUCT columns from FixedTables.PRODUCT.
      // Keep the first two setup fields (Produkt, Kategori) out of DEFAULT and
      // let everything after them appear automatically.
      const allProductCols = (spec && Array.isArray(spec.columns)) ? spec.columns.slice() : [];
      const cols = allProductCols
        .filter((c, idx) => {
          const name = String((c && c.name) || "").trim();
          if (!name) return false;
          if (idx < 2) return false;
          return true;
        })
        .map((c) => ({ label: String((c && c.name) || "").trim(), def: c }));

      if (!cols.length) {
        view.appendChild(el("div", { class:"muted", style:"margin-top:12px;" }, ["Inga DEFAULT-kolumner hittades i FixedTables.PRODUCT."]));
        return;
      }

      // In-memory draft state (so Notes won't persist until Save)
      const UI = (window.USP && window.USP.UI) ? window.USP.UI : (window.USP.UI = {});
      if (!UI._defaultsDraftProduct) UI._defaultsDraftProduct = { saved:{}, draft:{}, savedNotes:{}, draftNotes:{}, dirty:false };
      const mem = UI._defaultsDraftProduct;

      const keyVal = (colDef) => "USP_DEFAULTS_PRODUCT__" + normName(colDef && colDef.name);
      const keyNotes = (colDef) => "USP_DEFAULTS_PRODUCT__NOTES__" + normName(colDef && colDef.name);

      const readSavedValue = (colDef) => { try { return localStorage.getItem(keyVal(colDef)) || ""; } catch(e){ return ""; } };
      const writeSavedValue = (colDef, v) => { try { localStorage.setItem(keyVal(colDef), String(v==null?"":v)); } catch(e){} };

      const readSavedNotes = (colDef) => {
        const k = keyNotes(colDef);
        try {
          const s = localStorage.getItem(k);
          if (s && String(s).trim()) {
            const a = JSON.parse(s);
            return Array.isArray(a) ? a : [];
          }
        } catch(e) {}
        return [];
      };
      const writeSavedNotes = (colDef, logArr) => {
        const k = keyNotes(colDef);
        let s = "[]";
        try { s = JSON.stringify(Array.isArray(logArr) ? logArr : []); } catch(e) { s = "[]"; }
        try { localStorage.setItem(k, s); } catch(e2) {}
      };

      const cloneArr = (a) => { try { return JSON.parse(JSON.stringify(Array.isArray(a)?a:[])); } catch(e){ return []; } };
      const hasNotes = (a) => Array.isArray(a) && a.some(it => it && ((it.text||it.note||it.value||"")+"").trim());

      cols.forEach((c) => {
        if (!c.def) return;
        const nk = normName(c.def.name);
        if (mem.saved[nk] == null) mem.saved[nk] = readSavedValue(c.def);
        if (mem.draft[nk] == null) mem.draft[nk] = mem.saved[nk];

        const kN = nk + "__notes";
        if (mem.savedNotes[kN] == null) mem.savedNotes[kN] = readSavedNotes(c.def);
        if (mem.draftNotes[kN] == null) mem.draftNotes[kN] = cloneArr(mem.savedNotes[kN]);
      });

      const isDirty = () => {
        if (mem.dirty) return true;
        let d = false;
        cols.forEach((c) => {
          if (!c.def) return;
          const nk = normName(c.def.name);
          const kN = nk + "__notes";
          if (String(mem.draft[nk]||"") !== String(mem.saved[nk]||"")) d = true;
          let sa="", sb="";
          try { sa = JSON.stringify(mem.draftNotes[kN]||[]); } catch(e){ sa=""; }
          try { sb = JSON.stringify(mem.savedNotes[kN]||[]); } catch(e){ sb=""; }
          if (sa !== sb) d = true;
        });
        return d;
      };

      const table = el("table", { class:"table", style:"margin-top:12px;" }, []);
      table.appendChild(el("thead", {}, [el("tr", {}, cols.map(c => el("th", {}, [c.label])).concat([el("th", { style:"text-align:right;" }, ["Save"])]))]));

      const saveBtn = el("button", {
        class: "btn btn-primary",
        type: "button",
        disabled: !isDirty(),
        onclick: () => {
          if (!isDirty()) return;
          cols.forEach((c) => {
            if (!c.def) return;
            const nk = normName(c.def.name);
            const kN = nk + "__notes";

            writeSavedValue(c.def, mem.draft[nk]);
            mem.saved[nk] = mem.draft[nk];

            writeSavedNotes(c.def, mem.draftNotes[kN] || []);
            mem.savedNotes[kN] = cloneArr(mem.draftNotes[kN] || []);
            _logDefaults("[DEFAULT/PRODUCT] saved", {col: c.def.name, keyVal: keyVal(c.def), keyNotes: keyNotes(c.def), val: mem.draft[nk], notesLen: (mem.draftNotes[kN]||[]).length});
          });
          mem.dirty = false;
          saveBtn.disabled = true;
        }
      }, ["Save"]);

      const refreshSave = () => { try { saveBtn.disabled = !isDirty(); } catch(e){} };

      const rowTr = el("tr", {}, []);
      cols.forEach((c) => {
        const td = el("td", {}, []);
        if (!c.def) { td.appendChild(el("div", { class:"muted" }, [""])); rowTr.appendChild(td); return; }

        const nk = normName(c.def.name);
        const kN = nk + "__notes";
        const host = el("div", { style:"min-width:10ch;" }, []);

        const rowObj = { [c.def.name]: mem.draft[nk] || "" };
        try {
          const App2 = (window.USP && window.USP.App) ? window.USP.App : null;
          const FT = (App2 && App2.FieldTypes) ? App2.FieldTypes : null;

          let editor = null;
          if (FT && typeof FT.renderEditor === "function") {
            const baseType = (typeof FT.normalizeBaseType === "function") ? FT.normalizeBaseType(c.def.type) : (c.def.type || "text");
            const kNotes = normName(c.def.name) + "__notes";
            const hasN = hasNotes(mem.draftNotes[kNotes] || []);
            const ctx = {
              tabKey: (App2 && App2.Tabs) ? App2.Tabs.PRODUCT : "product",
              name: c.def.name,
              type: c.def.type,
              baseType: baseType,
              mods: c.def.mods || {},
              value: mem.draft[nk] || "",
              disabled: false,
              notesHas: hasN,
              onNotesClick: () => {
                try {
                  openNotesModal((App2 && App2.Tabs) ? App2.Tabs.PRODUCT : "product", c.def.name, mem.draftNotes[kNotes] || [], (newLog) => {
                    mem.draftNotes[kNotes] = Array.isArray(newLog) ? newLog : [];
                    mem.dirty = true;
                    refreshSave();
                  }, { title: "DEFAULT/PRODUCT: " + c.def.name });
                } catch(eN) {}
              },
              onChange: (v) => { mem.draft[nk] = v; mem.dirty = true; refreshSave(); }
            };
            // dropdown registry fix (not used by these columns, but harmless)
            try {
              let regKey = ctx.registry ? String(ctx.registry) : "";
              const t0 = String(ctx.type || "").toLowerCase();
              if (!regKey && t0.startsWith("dropdown_")) regKey = t0;
              if (regKey) { ctx.registry = regKey; ctx.type = regKey; }
            } catch(eR) {}
            editor = FT.renderEditor(ctx);
          }

          if (!editor) {
            editor = el("input", { class:"input", value: mem.draft[nk] || "", oninput: (ev)=>{ mem.draft[nk] = String(ev.target.value||""); mem.dirty=true; refreshSave(); } }, []);
          }

          host.appendChild(editor);
        } catch(e) {
          const inp = el("input", { class:"input", value: mem.draft[nk] || "", oninput: (ev)=>{ mem.draft[nk] = String(ev.target.value||""); mem.dirty=true; refreshSave(); } }, []);
          host.appendChild(inp);
        }

        td.appendChild(host);
        rowTr.appendChild(td);
      });

      rowTr.appendChild(el("td", { style:"text-align:right;vertical-align:top;" }, [saveBtn]));
      table.appendChild(el("tbody", {}, [rowTr]));
      view.appendChild(table);
    }

    // PROJECT: render a single defaults row using the same column definitions as FixedTables.PROJECT
    if (sel === "PROJECT") {
      const App = (window.USP && window.USP.App) ? window.USP.App : null;
      const spec = (App && App.FixedTables) ? App.FixedTables.PROJECT : null;

      function normName(s) {
        return String(s || "")
          .toLowerCase()
          .replace(/[åä]/g, "a")
          .replace(/ö/g, "o")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-+|-+$/g, "");
      }

      const cols = (spec && Array.isArray(spec.columns)) ? spec.columns.slice() : [];
      if (!cols.length) {
        view.appendChild(el("div", { class:"muted", style:"margin-top:12px;" }, ["Ingen FixedTables.PROJECT spec hittades."]));
        return;
      }

      function valueStorageKey(colDef) { return "USP_DEFAULTS_PROJECT__" + normName(colDef && colDef.name); }
      function notesStorageKey(colDef) { return "USP_DEFAULTS_PROJECT__NOTES__" + normName(colDef && colDef.name); }

      function readSavedValue(colDef) {
        try { return localStorage.getItem(valueStorageKey(colDef)) || ""; } catch (e) { return ""; }
      }
      function writeSavedValue(colDef, v) {
        try { localStorage.setItem(valueStorageKey(colDef), String(v == null ? "" : v)); } catch (e) {}
      }

      function readSavedNotes(colDef) {
        const k = notesStorageKey(colDef);
        let raw = "";
        try { raw = localStorage.getItem(k) || ""; } catch (e) { raw = ""; }
        if (!raw || !String(raw).trim()) return [];
        const s = String(raw).trim();
        if (s.startsWith("[")) {
          try { const a = JSON.parse(s); return Array.isArray(a) ? a : []; } catch (e2) { return []; }
        }
        return [{ ts: new Date().toISOString(), title: s.split(/\r?\n/)[0].slice(0,60), text: s }];
      }
      function writeSavedNotes(colDef, logArr) {
        const k = notesStorageKey(colDef);
        let s = "[]";
        try { s = JSON.stringify(Array.isArray(logArr) ? logArr : []); } catch (e) { s = "[]"; }
        try { localStorage.setItem(k, s); } catch (e2) {}
      }
      function hasNotes(logArr) {
        const a = Array.isArray(logArr) ? logArr : [];
        for (let i=0;i<a.length;i++){
          const it = a[i] || {};
          const body = (it.text != null) ? it.text : (it.note != null ? it.note : (it.value != null ? it.value : ""));
          if (body != null && String(body).trim()) return true;
        }
        return false;
      }

      const draftKey = "_defaultsDraftProject";
      const UI = (window.USP && window.USP.UI) ? window.USP.UI : (window.USP.UI = {});
      if (!UI[draftKey]) UI[draftKey] = {};
      const mem = UI[draftKey];
      if (!mem.saved) mem.saved = {};
      if (!mem.draft) mem.draft = {};
      if (!mem.savedNotes) mem.savedNotes = {};
      if (!mem.draftNotes) mem.draftNotes = {};
      if (mem.dirty == null) mem.dirty = false;

      function cloneArr(a){ try { return JSON.parse(JSON.stringify(Array.isArray(a) ? a : [])); } catch(e){ return []; } }

      cols.forEach((c) => {
        const nk = normName(c.name);
        if (mem.saved[nk] == null) mem.saved[nk] = readSavedValue(c);
        if (mem.draft[nk] == null) mem.draft[nk] = mem.saved[nk];

        const kNotes = nk + "__notes";
        if (mem.savedNotes[kNotes] == null) mem.savedNotes[kNotes] = readSavedNotes(c);
        if (mem.draftNotes[kNotes] == null) mem.draftNotes[kNotes] = cloneArr(mem.savedNotes[kNotes]);
      });

      function isDirty() {
        if (mem.dirty) return true;
        let dirty = false;
        cols.forEach((c) => {
          const nk = normName(c.name);
          if (String(mem.draft[nk] || "") !== String(mem.saved[nk] || "")) dirty = true;

          const allowNotes = !!(c && c.mods && (c.mods.notes || c.mods.Notes));
          if (allowNotes) {
            const kNotes = nk + "__notes";
            let a = mem.draftNotes[kNotes] || [];
            let b = mem.savedNotes[kNotes] || [];
            let sa = "", sb = "";
            try { sa = JSON.stringify(a); } catch(e){ sa = ""; }
            try { sb = JSON.stringify(b); } catch(e){ sb = ""; }
            if (sa != sb) dirty = true;
          }
        });
        return dirty;
      }

      const table = el("table", { class:"table", style:"margin-top:12px;" }, []);
      table.appendChild(el("thead", {}, [
        el("tr", {}, cols.map((c) => el("th", {}, [c.name])).concat([el("th", { style:"text-align:right;" }, ["Save"])]))
      ]));

      const saveBtn = el("button", {
        class: "btn btn-primary",
        type: "button",
        disabled: !isDirty(),
        onclick: () => {
          if (!isDirty()) return;

          cols.forEach((c) => {
            const nk = normName(c.name);
            const v = mem.draft[nk];
            mem.saved[nk] = v;
            writeSavedValue(c, v);

            const allowNotes = !!(c && c.mods && (c.mods.notes || c.mods.Notes));
            if (allowNotes) {
              const kNotes = nk + "__notes";
              const log = mem.draftNotes[kNotes] || [];
              mem.savedNotes[kNotes] = cloneArr(log);
              writeSavedNotes(c, log);
            }

            _logDefaults("[DEFAULT/PROJECT] saved", {col: c && c.name, keyVal: "USP_DEFAULTS_PROJECT__"+normName(c&&c.name), val: v});
          });

          mem.dirty = false;
          try { saveBtn.disabled = true; } catch(e){}
        }
      }, ["Save"]);

      function refreshSaveState() { try { saveBtn.disabled = !isDirty(); } catch (e) {} }

      const tds = cols.map((c) => {
        const td = el("td", {}, []);
        const nk = normName(c.name);

        const host = el("div", { style:"min-width:10ch;" }, []);

        try {
          const App2 = (window.USP && window.USP.App) ? window.USP.App : null;
          const FT = (App2 && App2.FieldTypes) ? App2.FieldTypes : null;

          let editor = null;
          if (FT && typeof FT.renderEditor === "function") {
            const baseType = (typeof FT.normalizeBaseType === "function") ? FT.normalizeBaseType(c.type) : (c.type || "text");
            const allowNotes = !!(c && c.mods && (c.mods.notes || c.mods.Notes));
            const kNotes = nk + "__notes";
            const hasN = allowNotes ? hasNotes(mem.draftNotes[kNotes] || []) : false;

            const ctx = {
              tabKey: (App2 && App2.Tabs) ? App2.Tabs.PROJECT : "project",
              name: c.name,
              type: c.type,
              baseType: baseType,
              mods: c.mods || {},
              value: mem.draft[nk] || "",
              disabled: false,
              notesHas: hasN,
              onNotesClick: allowNotes ? () => {
                try {
                  openNotesModal((App2 && App2.Tabs) ? App2.Tabs.PROJECT : "project", c.name, mem.draftNotes[kNotes] || [], (newLog) => {
                    mem.draftNotes[kNotes] = Array.isArray(newLog) ? newLog : [];
                    mem.dirty = true;
                    refreshSaveState();
                  }, { title: "DEFAULT/PROJECT: " + c.name });
                } catch(eN) {}
              } : null,
              onChange: (v) => { mem.draft[nk] = v; mem.dirty = true; refreshSaveState(); }
            };

            editor = FT.renderEditor(ctx);
          }

          if (!editor) {
            editor = el("input", { class:"input", value: mem.draft[nk] || "", oninput: (ev)=>{ mem.draft[nk] = String(ev.target.value||""); mem.dirty=true; refreshSaveState(); } }, []);
          }

          host.appendChild(editor);
        } catch(e) {
          const inp = el("input", { class:"input", value: mem.draft[nk] || "", oninput: (ev)=>{ mem.draft[nk] = String(ev.target.value||""); mem.dirty=true; refreshSaveState(); } }, []);
          host.appendChild(inp);
        }

        td.appendChild(host);
        return td;
      });

      const tr = el("tr", {}, tds.concat([el("td", { style:"text-align:right;vertical-align:top;" }, [saveBtn])]));
      table.appendChild(el("tbody", {}, [tr]));
      view.appendChild(table);
    }



    view.appendChild(el("div", { class:"hint", style:"margin-top:14px;font-size:16px;" }, ["to be continued"]));
  }


  // ---------------------------
  // Statistics view
  // ---------------------------
  function statisticsView(state) {
    const view = byId("usp-view");
    if (!view) return;

    // Delegate to separate statistics module (app_13_statistics.js)
    if (window.USP && window.USP.Statistics && typeof window.USP.Statistics.render === "function") {
      window.USP.Statistics.render(state, view);
    } else {
      // Fallback if statistics module not loaded
      view.innerHTML = "";
      view.appendChild(el("div", { 
        class: "hero",
        style: "padding:40px;text-align:center;color:#999;" 
      }, [
        el("div", {}, ["Statistics module not loaded"]),
        el("div", { style: "margin-top:10px;font-size:14px;" }, ["Please ensure app_13_statistics.js is included"])
      ]));
      console.error("[UI] Statistics module (USP.Statistics) not available");
    }
  }











  
  // ---------------------------
  // Login view (uses USP.Auth + App.setLoggedInUser)
  // ---------------------------
  function renderLoginView(state){
    try{
      if (!byId("usp-view") && UI && typeof UI.mountBase === "function") UI.mountBase();
    }catch(e){}
    const view = byId("usp-view");
    const topbar = byId("usp-topbar");
    if (!view) return;

    // Minimal topbar while logged out
    try{
      if (topbar) {
        topbar.classList.add("logged-out");
        setHtml(topbar, "");
        topbar.appendChild(el("div", { class:"brand" }, ["USP"]));
      }
    }catch(e){}

    setHtml(view, "");

    const card = el("div", { class:"login-card" }, []);
    card.appendChild(el("div", { class:"login-title" }, ["Logga in"]));
    card.appendChild(el("div", { class:"login-sub" }, ["Ange användarnamn och lösenord."]));

    const errBox = el("div", { class:"login-error", style:"margin-top:10px; display:none;" }, []);
    card.appendChild(errBox);

    const userInp = el("input", { class:"input full", placeholder:"Användarnamn", autocomplete:"username" }, []);
    const passInp = el("input", { class:"input full", placeholder:"Lösenord", type:"password", autocomplete:"current-password" }, []);
    card.appendChild(el("div", { style:"margin-top:14px;" }, [userInp]));
    card.appendChild(el("div", { style:"margin-top:10px;" }, [passInp]));

    function showErr(msg){
      try{
        errBox.style.display = "";
        errBox.textContent = msg;
      }catch(e){}
    }

    function doLogin(){
      try{
        errBox.style.display = "none";
      }catch(e){}
      const username = String(userInp.value || "").trim();
      const password = String(passInp.value || "");
      if (!username || !password){
        showErr("Fyll i användarnamn och lösenord.");
        return;
      }
      const USPNS = window.USP || {};
      const AppNS = USPNS.App;
      const AuthNS = USPNS.Auth;
      if (!AppNS || !AuthNS || typeof AuthNS.login !== "function"){
        showErr("Login-modulen är inte redo ännu. Ladda om sidan.");
        return;
      }
      const res = AuthNS.login(username, password);
      if (res && res.ok && res.user){
        try{
          // App.setLoggedInUser handles leaving login screen + render
          if (typeof AppNS.setLoggedInUser === "function") {
            AppNS.setLoggedInUser(res.user);
            return;
          }
        }catch(eSet){}
        // Fallback: force rerender
        try{
          const st = (typeof AppNS.getState === "function") ? AppNS.getState() : (state || {});
          st.ui = st.ui || {};
          delete st.ui.screen;
          st.session = st.session || {};
          st.session.authUser = res.user;
          st.user = res.user;
          if (typeof AppNS.commitState === "function") AppNS.commitState(st);
          if (UI && typeof UI.render === "function") UI.render(st);
        }catch(e2){}
        return;
      }
      showErr("Fel användarnamn eller lösenord.");
    }

    const btn = el("button", { class:"btn primary", onclick: doLogin }, ["Logga in"]);
    const actions = el("div", { class:"login-actions" }, [btn]);
    card.appendChild(actions);

    function onKey(e){
      if (e && e.key === "Enter") doLogin();
    }
    userInp.addEventListener("keydown", onKey);
    passInp.addEventListener("keydown", onKey);

    const wrap = el("div", { class:"login-wrap" }, [card]);
    view.appendChild(wrap);

    try{ userInp.focus(); }catch(e){}
  }


UI.render = function render(state) {
    // If logged out, show login view
    try{
      if (state && state.ui && state.ui.screen === "login") {
        return renderLoginView(state);
      }
    }catch(e){}



    

    registerFixedTables();
    try{ if (App.FixedTables && typeof App.FixedTables.ensureAllSchemas === "function") App.FixedTables.ensureAllSchemas(state); }catch(e){}
    const activeTab = state && state.session ? state.session.tab : null;
    if (activeTab && FIXED_TABLES[activeTab]) {
      const type = FIXED_TABLES[activeTab].type;
      if (type === "todo" && typeof todoView === "function") {
        const k = (App.Tabs && App.Tabs.TODO) ? App.Tabs.TODO : "todo";
        return todoView(state, k, "ToDo");
      }
      if (type === "project" && typeof projectView === "function") {
        const k = (App.Tabs && App.Tabs.PROJECT) ? App.Tabs.PROJECT : "project";
        return projectView(state, k, "Projekt");
      }
      if (type === "routines" && typeof userDataView === "function") {
        return userDataView(state);
      }
    }


    
    // VERSION 107: hard-sanitize duplicate roots/views created by older builds
    try {
      const root = document.getElementById("app");
      if (root) {
        const wraps = root.querySelectorAll(".table-wrap");
        if (wraps && wraps.length > 1) {
          for (let i = 1; i < wraps.length; i++) wraps[i].remove();
        }
        const views = document.querySelectorAll("#usp-view");
        if (views && views.length > 1) {
          for (let i = 1; i < views.length; i++) views[i].remove();
        }
      }
    } catch(e) {}
    const tab0 = App.getTab(state);
    if (tab0 === App.Tabs.TODO) {
      try { const root0 = document.getElementById("app"); if (root0) root0.innerHTML = ""; } catch(e) {}
    }

    UI.mountBase();
    renderTopbar(state);

    // Ensure view is fully cleared on every render to avoid leftover DOM when switching tabs
    try {
      const v = document.getElementById("usp-view");
      if (v) v.innerHTML = "";
    } catch(e) {}

    _renderTick++;
    _routinesSchemaEnsured = false;

    const tab = App.getTab(state);
try{ if(String(location.hostname)!=="planning.cappelendimyr.com") console.log("[ui tab debug] tab=", tab); }catch(e){}
    const role = App.role(state);
    const roleMode = (App.getRoleMode ? App.getRoleMode(state) : role);

    if (tab === App.Tabs.SETTINGS) return settingsView(state);

    if (tab === App.Tabs.STATISTICS) return statisticsView(state);

    if (String(tab) === "default") {
      if (role === "admin") return defaultView(state);
      // Non-admin: ignore and fall back
    }

    if (role === "admin") {
      if (tab === App.Tabs.DEV) return userDataView(state, App.Tabs.DEV, "Utveckling");
      if (tab === App.Tabs.PRODUCT) return userDataView(state, App.Tabs.PRODUCT, "Sälj");
      if (tab === App.Tabs.TODO) return todoView(state, App.Tabs.TODO, "ToDo");
    if (tab === App.Tabs.PROJECT || tab === "project") return projectView(state, App.Tabs.PROJECT || "project", "Projekt");
      if (tab === App.Tabs.ROUTINES) return userDataView(state, App.Tabs.ROUTINES, "Rutiner", { routinesEditable: true });
    }

    if (tab === App.Tabs.DEV) return userDataView(state, App.Tabs.DEV, "Utveckling");
    if (tab === App.Tabs.PRODUCT) return userDataView(state, App.Tabs.PRODUCT, "Sälj");
    if (tab === App.Tabs.TODO) return todoView(state, App.Tabs.TODO, "ToDo");
    if (tab === App.Tabs.PROJECT || tab === "project") return projectView(state, App.Tabs.PROJECT || "project", "Projekt");
    if (tab === App.Tabs.ROUTINES) return userDataView(state, App.Tabs.ROUTINES, "Rutiner");

    return todoView(state, App.Tabs.TODO, "ToDo");
  };


// Ensure row modal is exported after it is defined (inside IIFE scope)
try{
  if (typeof openRowModal === "function") {
    if (window.USP && USP.App) USP.App.openRowModal = openRowModal;
    if (window.USP && USP.UI) USP.UI.openRowModal = openRowModal;
    window.openRowModal = openRowModal;

// R9: expose initials/notes modals so TableUI/TabCore tabs (dev/product/routines) can use the same UX as Project/ToDo
try{
  if (window.USP) {
    if (!USP.UI) USP.UI = {};
    if (typeof openInitialsPicker === "function") USP.UI.openInitialsPicker = openInitialsPicker;
    if (typeof openNotesModal === "function") USP.UI.openNotesModal = openNotesModal;
    if (typeof openArchiveModal === "function") USP.UI.openArchiveModal = openArchiveModal;
  }
  // Back-compat globals
  if (typeof openInitialsPicker === "function") window.openInitialsPicker = openInitialsPicker;
  if (typeof openNotesModal === "function") window.openNotesModal = openNotesModal;
  if (typeof openArchiveModal === "function") window.openArchiveModal = openArchiveModal;
}catch(e){}

  }
}catch(e){}

})();

    function promptAddNote(){ return null; }
