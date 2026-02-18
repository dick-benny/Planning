// [ui v237]
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

  function rowDisplayNameForNotes(tabKey, row, st) {
    try {
      const r = row || {};
      const f = r.fields || {};
      if (tabKey === App.Tabs.TODO) return String(f["Beskrivning"] || "");
      if (tabKey === App.Tabs.PROJECT) return String(f["Projektnamn"] || "");
      if (tabKey === App.Tabs.ROUTINES) return String(f["Rutin"] || "");
      const schema = (App.getSchema ? App.getSchema(tabKey, st) : null) || {};
      const cols = schema.fields || schema.columns || [];
      if (cols && cols.length) {
        const first = cols[0];
        const name = first.name || first.key || first.label || first.title;
        if (name) return String(f[name] || "");
      }
      const keys = Object.keys(f);
      if (keys.length) return String(f[keys[0]] || "");
    } catch(e) {}
    return "";
  }
    return String(tabKey || "");
  }

  function openInitialsPicker(tabKey, rowId, fieldName, currentValue, onPick) {
    if (typeof closeAnyModal === "function") closeAnyModal();
    const st = (App && App.getState) ? App.getState() : {};
    const users = (App && typeof App.listUsers === "function") ? (App.listUsers(st) || []) : [];
    const title = tableTitleForTab(tabKey) + " – " + String(fieldName || "Ansvarig");

    const overlay = el("div", { class: "usp-modal-overlay" }, []);
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
      lab.appendChild(el("span", { class:"modal-check-name" }, [ini + " – " + name]));
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
      row.appendChild(el("button", { class:"btn btn-secondary", type:"button", onclick: () => { closeSettingsPopover(); openManageUsers(App.getState()); } }, ["Manage users"]));
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
  const cols = ["Rutin", "Steg1", "Steg2", "Steg3", "Steg4", "Steg5"];
  return {
    version: 1,
    fields: cols.map((name, i) => ({
      id: "r_" + i,
      order: i,
      name,
      type: "text",
      mods: { notes: true }
    }))
  };
}

function ensureFixedRoutinesSchema(tabKey, state) {
  // Prevent infinite loops if setSchema triggers a rerender that calls this again.
  if (_fixingRoutinesSchema) return;

  try {
    if (String(tabKey) !== String(App.Tabs.ROUTINES)) return;

    const st = state || App.getState();
    const cur = App.getSchema(tabKey, st) || {};
    const want = fixedRoutinesSchema();

    const curFields = Array.isArray(cur.fields) ? cur.fields : [];
    const wantFields = want.fields;

    // Fast check: count + names
    const sameCount = curFields.length === wantFields.length;
    const sameNames =
      sameCount &&
      wantFields.every((wf, idx) => String((curFields[idx] || {}).name || "") === wf.name);

    // Check whether any field needs patching (type/notes/order)
    let needsPatch = !sameCount || !sameNames;

    if (!needsPatch) {
      for (let i = 0; i < wantFields.length; i++) {
        const f = curFields[i] || {};
        const hasNotes = !!(f.mods && f.mods.notes);
        const typeOk = String(f.type || "") === "text";
        const orderOk = Number.isFinite(f.order) ? f.order === i : true;
        if (!hasNotes || !typeOk || !orderOk) {
          needsPatch = true;
          break;
        }
      }
    }

    if (!needsPatch) return;

    _fixingRoutinesSchema = true;

    const patchedFields = wantFields.map((wf, idx) => {
      const f = curFields[idx] || {};
      return Object.assign({}, f, {
        id: f.id || wf.id,
        order: idx,
        name: wf.name,
        type: "text",
        mods: { notes: true }
      });
    });

    App.setSchema(
      tabKey,
      Object.assign({}, cur, { version: cur.version || 1, fields: patchedFields })
    );
  } catch (e) {
    console.warn("ensureFixedRoutinesSchema failed", e);
  } finally {
    _fixingRoutinesSchema = false;
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
    if (String(tabKey) !== String(App.Tabs.TODO)) return;
    if (_fixingTodoSchema) return;
    _fixingTodoSchema = true;

    const st = state || App.getState();
    const cur = App.getSchema(tabKey, st) || {};
    const want = fixedTodoSchema();
    const curFields = Array.isArray(cur.fields) ? cur.fields : [];
    const wantFields = want.fields;

    const sameCount = curFields.length === wantFields.length;
    const sameNames = sameCount && wantFields.every((wf, idx) => String((curFields[idx]||{}).name||"") === wf.name);
    const sameTypes = sameCount && wantFields.every((wf, idx) => String((curFields[idx]||{}).type||"") === wf.type);

    if (!sameCount || !sameNames || !sameTypes) {
      App.setSchema(tabKey, want);
      return;
    }

    // ensure mods for description (initials + notes + rightclick behavior)
    const patched = wantFields.map((wf, idx) => {
      const f = curFields[idx] || {};
      return Object.assign({}, f, {
        id: f.id || wf.id,
        order: idx,
        name: wf.name,
        type: wf.type,
        mods: Object.assign({}, (f.mods||{}), (wf.mods||{}))
      });
    });

    App.setSchema(tabKey, Object.assign({}, cur, { version: cur.version || 1, fields: patched }));
  } catch (e) {
    console.warn("ensureFixedTodoSchema failed", e);
  } finally {
    _fixingTodoSchema = false;
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
    if (String(tabKey) !== String(App.Tabs.PROJECT)) return;
    if (_fixingProjectSchema) return;
    _fixingProjectSchema = true;

    const current = App.getSchema(tabKey, state);
    const desired = fixedProjectSchema();

    const ok = current && Array.isArray(current.fields) && current.fields.length === desired.fields.length
      && current.fields.map(f => f.name).join("|") === desired.fields.map(f => f.name).join("|");

    if (!ok) {
      App.setSchema(tabKey, desired, state);
    }
  } catch (e) {
    console.error("ensureFixedProjectSchema failed", e);
  } finally {
    _fixingProjectSchema = false;
  }
}


const TODO_CATEGORIES = ["Allmänt","Info","Shopify-B2C","Shopify-B2B","Logistik","Privat"];

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
    const v = fields ? fields[k] : null;
    if (Array.isArray(v)) return v;
    if (typeof v === "string" && v.trim().startsWith("[")) {
      try { const a = JSON.parse(v); return Array.isArray(a) ? a : []; } catch (e) { return []; }
    }
    return [];
  }

  function writeNotesLog(fields, fieldName, logArr) {
    const k = notesKeyFor(fieldName);
    fields[k] = Array.isArray(logArr) ? logArr : [];
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

  
  function openNotesModal(tabKey, fieldName, existingLog, onSave) {
    closeAnyModal();
    const rowName = String(arguments[4] || "");
    const title = tableTitleForTab(tabKey) + " – " + (rowName ? (rowName + " – ") : "") + String(fieldName || "Anteckning");
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
      if (typeof onSave === "function") onSave(t);
      overlay.remove();
    });
    actions.appendChild(btnCancel);
    actions.appendChild(btnSave);

    modal.appendChild(h);
    if (existingLog && existingLog.length) modal.appendChild(existing);
    modal.appendChild(ta);
    modal.appendChild(actions);
    overlay.appendChild(modal);
    document.body.appendChild(overlay);
    try { ta.focus(); } catch(e) {}
  }


  // VERSION 249: Global notes helpers (blue icon + click) used across views
  function hasNotesInCell(row, fieldName) {
    try {
      const fields = (row && row.fields) ? row.fields : {};
      const log = readNotesLog(fields, fieldName);
      return Array.isArray(log) && log.length > 0;
    } catch (e) {
      return false;
    }
  }

  function addNoteToCell(tabKey, rowId, fieldName) {
    const st = App.getState();
    const row = getRowSafe(tabKey, rowId, st);
    if (!row) return;
    const fields = Object.assign({}, row.fields || {});
    const existing = readNotesLog(fields, fieldName);
    openNotesModal(tabKey, fieldName, existing, function(t){
      if (!t) return;
      const nextLog = existing.concat([{ ts: new Date().toISOString(), by: (App.getActingUser ? ((App.getActingUser(st).initials)||"") : ""), text: t }]);
      writeNotesLog(fields, fieldName, nextLog);
      const nextRow = Object.assign({}, row, { fields, updatedAt: new Date().toISOString() });
      App.upsertRow(tabKey, nextRow);
    });
  }

  // Close any open modal overlays (prevents modals leaking into other tabs)
  function closeAnyModal() {
    try {
      const els = document.querySelectorAll(".usp-modal-overlay, .usp-modal, .modal-overlay, .modal");
      els.forEach(el => { try { el.remove(); } catch(e){} }, rowName);
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
    [App.Tabs.DEV, App.Tabs.PRODUCT, App.Tabs.PROJECT, App.Tabs.TODO, App.Tabs.ROUTINES].forEach((k) => {
      tabs.appendChild(el("button", {
        class: "tab " + ((current === k || (k === (App.Tabs && App.Tabs.PROJECT) && String(current) === "project")) ? "is-active" : ""),
        type: "button",
        onclick: () => { const __t = k; App.setTab((__t === (App.Tabs && App.Tabs.PROJECT)) ? "project" : __t); },
      }, [tabLabel(k)]));
    });

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

function adminSchemaView(state, tabKey, title) {
    const view = byId("usp-view");
    if (!view) return;
    setHtml(view, "");

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
    const rows = (App.listRows(tabKey, state) || []).filter(r => !!r.archived);
    const schema = App.getSchema(tabKey, state);
    const fields = sortFields(schema.fields || []);
    const fieldNames = fields.map(f => String(f.name || "").trim()).filter(Boolean);

    const modal = el("div", { class:"modal-backdrop" }, [
      el("div", { class:"usp-modal", style:"max-width:920px;" }, [
        el("div", { class:"modal-head" }, [
          el("div", { class:"title" }, [title + " – Arkiv"]),
          el("button", { class:"btn btn-secondary", type:"button", onclick: () => modal.remove() }, ["Stäng"]),
        ]),
        el("div", { class:"modal-body" }, [
          rows.length ? (
            el("div", { class:"table-wrap" }, [
              (function(){
                const table = el("table", { class:"table" }, []);
                table.appendChild(el("thead", {}, [el("tr", {}, [
                  ...fieldNames.map(n => el("th", { style: (n==="Kategori" ? "width:17ch;" : (n==="Klart" ? "width:12ch;" : null)) }, [n])),
        ...((allowDelete || routinesEditable) ? [el("th", { style:"text-align:right;width:16ch;" }, [ (routinesEditable ? "Ta bort" : "") ])] : []),
                ])]));
                const tb = el("tbody", {}, []);
                rows.forEach((r) => {
                  const tr = el("tr", {}, []);
                  fieldNames.forEach((n) => tr.appendChild(el("td", {}, [String(((r.fields && r.fields[n]) != null ? (r.fields && r.fields[n]) : ""))])));
                  tr.appendChild(el("td", { style:"white-space:nowrap;" }, [
                    el("button", { class:"btn btn-small", type:"button", onclick: () => {
                      const ok = window.confirm("Återställa raden från arkiv?");
                      if (!ok) return;
                      App.unarchiveRow(tabKey, r.id);
                      modal.remove();
                      App.callRender();
                    }}, ["Återställ"])
                  ]));
                  tb.appendChild(tr);
                });
                table.appendChild(tb);
                return table;
              })()
            ])
          ) : el("div", { class:"hint" }, ["Arkivet är tomt."])
        ])
      ])
    ]);
    document.body.appendChild(modal);
  }

  function doneLabel() { return "DONE"; }

  function handleDone(state, tabKey, row) {
    if (!row) return;
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
      // PRODUCT DONE: archive in PRODUCT
      App.archiveRow(tabKey, row.id);
      return;
    }

    if (tabKey === App.Tabs.TODO) {
      // TODO DONE: archive in TODO
      App.archiveRow(tabKey, row.id);
      return;
    }
  }
function userDataView(state, tabKey, title, opts) {
    // VERSION 246: notes helpers for user tables (incl routines)
    function onNotesClick(rowId, fieldName) {
      const st = App.getState();
      const row = getRowSafe(tabKey, rowId, st);
      if (!row) return;
      const fields = Object.assign({}, row.fields || {});
      const existing = readNotesLog(fields, fieldName);
      openNotesModal(tabKey, fieldName, existing, function(t){
        if (!t) return;
        const byIni = (App.getActingUser ? ((App.getActingUser(st).initials)||"") : "");
        const nextLog = existing.concat([{ ts: new Date().toISOString(), by: byIni, text: t }]);
        writeNotesLog(fields, fieldName, nextLog);
        const nextRow = Object.assign({}, row, { fields, updatedAt: new Date().toISOString() });
        App.upsertRow(tabKey, nextRow);
      });
      }

    function hasNotesInCell(row, fieldName) {
      try {
        const log = readNotesLog((row && row.fields) || {}, fieldName);
        return Array.isArray(log) && log.length > 0;
      } catch (e) {
        return false;
      }
    }
    const view = byId("usp-view");
    if (!view) return;
    setHtml(view, "");

    const isRoutines = (tabKey === App.Tabs.ROUTINES);
      if (isRoutines && !_routinesSchemaEnsured) { _routinesSchemaEnsured = true; ensureFixedRoutinesSchema(tabKey, state); }

    // Re-read schema after potential routines patch
    const schema = App.getSchema(tabKey, state);
    const fields = sortFields(schema.fields || []);

    const routinesEditable = isRoutines && !!(opts && opts.routinesEditable);
    const routinesReadOnly = isRoutines && !routinesEditable;
    const allowDelete = (!isRoutines) && (tabKey === App.Tabs.DEV || tabKey === App.Tabs.PRODUCT);

    // User works with data; routines are read-only.
    const rowsAll = (App.listRows(tabKey, state) || []);
    const rows = rowsAll.filter(r => !r.archived);

    // Buttons
    // - Rutiner: admin kan skapa nya rutiner (+ Ny rad). User har inga actions.
    // - Övriga tabs: + Ny rad + Arkiv
    const heroButtons = [];
    if (isRoutines) {
      if (routinesEditable) {
        heroButtons.push(el("button", { class: btnClass("primary"), type:"button", onclick: () => {
          const base = { id: "row_" + Date.now(), createdAt: new Date().toISOString(), fields: {} };
          fields.forEach(f => { const k = String(f.name || "").trim(); if (k) base.fields[k] = ""; });
          App.upsertRow(tabKey, base);
        }}, ["+ Ny rad"]));
      }
    } else {
      heroButtons.push(el("button", { class: btnClass("primary"), type:"button", onclick: () => {
        const base = { id: "row_" + Date.now(), createdAt: new Date().toISOString(), fields: {} };
        fields.forEach(f => { const k = String(f.name || "").trim(); if (k) base.fields[k] = ""; });
        App.upsertRow(tabKey, base);
      }}, [ (tabKey === (App.Tabs && App.Tabs.DEV ? App.Tabs.DEV : "dev") ? "+ Ny Utveckling" : (tabKey === (App.Tabs && App.Tabs.PRODUCT ? App.Tabs.PRODUCT : "product") ? "+ Ny Produkt" : "+ Ny rad")) ]));

      heroButtons.push(el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
        openArchiveModal(App.getState(), tabKey, title);
      }}, ["Arkiv"]));
    }

    view.appendChild(hero(
      title,
      isRoutines ? (routinesEditable ? "Admin skapar rutiner (ny rutin = Ny rad). User kan bara läsa." : "Rutiner är en passiv beskrivning som kan läsas av alla.") : "",
      heroButtons
    ));

    const fieldNames = fields.map(f => String(f.name || "").trim()).filter(Boolean);

    const table = el("table", { class: isRoutines ? "table routines-table" : "table" }, []);
    table.appendChild(el("thead", {}, [
      el("tr", {}, [
        ...fieldNames.map(n => el("th", { style: (n==="Kategori" ? "width:17ch;" : (n==="Klart" ? "width:12ch;" : null)) }, [n])),
        ...(allowDelete ? [el("th", { style:"text-align:right;width:16ch;" }, [""])] : []),
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
            const tkey = (App.FieldTypes && App.FieldTypes.normalizeType) ? App.FieldTypes.normalizeType(field.type) : String(field.type || "text");
            const cellVal = ((r.fields && r.fields[n]) != null ? (r.fields && r.fields[n]) : "");
            tr.appendChild(el("td", {}, [
              (App.FieldTypes && typeof App.FieldTypes.renderEditor === "function")
                ? App.FieldTypes.renderEditor({
                    baseType: tkey,
                    mods: (field && field.mods) ? field.mods : { notes: true },
                    value: cellVal,
                    disabled: true,
                    notesHas: hasNotesInCell(r, n),
                    onNotesClick: (field && field.mods && field.mods.notes) ? (() => addNoteToCell(tabKey, r.id, n)) : null,
                    onChange: function(){},
                  })
                : String(cellVal)
            ]));
            return;
          }
          tr.appendChild(el("td", {}, [
            (function () {
              const field = (fields || []).find(x => String(x.name || "").trim() === n) || { name: n, type: "text" };
              const tkey = (App.FieldTypes && App.FieldTypes.normalizeType) ? App.FieldTypes.normalizeType(field.type) : String(field.type || "text");
              const cellVal = ((r.fields && r.fields[n]) != null ? (r.fields && r.fields[n]) : "");

              // Routines: read-only already handled above.
              if (App.FieldTypes && typeof App.FieldTypes.renderEditor === "function") {
                return App.FieldTypes.renderEditor({
                  baseType: tkey,
                  mods: (field && field.mods) ? field.mods : {},
                  value: cellVal,
                  disabled: false,
                  notesHas: (field && field.mods && field.mods.notes) ? hasNotesInCell(r, n) : false,
                  onNotesClick: (field && field.mods && field.mods.notes) ? (() => addNoteToCell(tabKey, r.id, n)) : null,
                  // base value change
                  onChange: (val) => {
                    const st = App.getState();
                    const cur = (getRowSafe(tabKey, r.id, st) || r);
                    const next = { id: cur.id, createdAt: cur.createdAt, updatedAt: new Date().toISOString(), archived: !!cur.archived, fields: Object.assign({}, cur.fields || {}) };
                    const v = (App.FieldTypes.normalizeValue) ? App.FieldTypes.normalizeValue(tkey, val) : val;
                    next.fields[n] = v;
                    App.upsertRow(tabKey, next);
                  },
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
                  // notes addon (log)
                  notesHas: (function () {
                    try { const log = readNotesLog((r.fields || {}), n); return Array.isArray(log) && log.length > 0; } catch (e) { return false; }
                  })(),
                  onNotesClick: (field && field.mods && field.mods.notes) ? () => {
                    try {
                      const st2 = App.getState();
                      const cur2 = (getRowSafe(tabKey, r.id, st2) || r);
                      const next2 = { id: cur2.id, createdAt: cur2.createdAt, updatedAt: new Date().toISOString(), archived: !!cur2.archived, fields: Object.assign({}, cur2.fields || {}) };

                      const log = readNotesLog(next2.fields, n);
                      openNotesModal(tabKey, n, log, function(add){
                        if (!add) return;
                        log.push({ ts: new Date().toISOString(), by: currentInitials(), text: add });
                        writeNotesLog(next2.fields, n, log);
                        App.upsertRow(tabKey, next2);
                      });
                      } catch (e) { console.error(e); }
                  } : undefined
                });}

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

        if (allowDelete) {
          // DEV/PRODUCT: DONE + Ta bort
          tr.appendChild(el("td", { style:"white-space:nowrap;text-align:right;" }, [
            el("button", { class:"btn btn-small", type:"button", onclick: () => {
              const ok = window.confirm("Klarmarkera (DONE) och arkivera raden?");
              if (!ok) return;
              try { App.archiveRow(tabKey, r.id); } catch(e) { console.error(e); }
              rerender();
            }}, ["DONE"]),
            el("span", { style:"display:inline-block;width:8px;" }, [""]),
            el("button", { class:"btn btn-small", type:"button", onclick: () => {
              const ok = window.confirm("Ta bort raden permanent?");
              if (!ok) return;
              try {
                const st = App.getState();
                const list = Array.isArray(st.data && st.data[tabKey]) ? st.data[tabKey] : [];
                st.data = st.data || {};
                st.data[tabKey] = list.filter(x => x && x.id !== r.id);
                App.commitState(st);
              } catch(e) { console.error(e); }
              rerender();
            }}, ["Ta bort"])
          ]));
        } else if (routinesEditable) {
          // ROUTINES admin: only Ta bort
          tr.appendChild(el("td", { style:"white-space:nowrap;text-align:right;" }, [
            el("button", { class:"btn btn-small", type:"button", onclick: () => {
              const ok = window.confirm("Ta bort raden permanent?");
              if (!ok) return;
              try {
                const st = App.getState();
                const list = Array.isArray(st.data && st.data[tabKey]) ? st.data[tabKey] : [];
                st.data = st.data || {};
                st.data[tabKey] = list.filter(x => x && x.id !== r.id);
                App.commitState(st);
              } catch(e) { console.error(e); }
              rerender();
            }}, ["Ta bort"])
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

function todoView(state, tabKey, title) {
    // VERSION 106: ensure ToDo view is not duplicated
    try {
      const host = document.getElementById("usp-view");
      if (host) {
        const olds = host.querySelectorAll(".todo-root");
        olds.forEach(n => n.remove());
      }
    } catch(e) {}

  const views = (document && document.querySelectorAll) ? document.querySelectorAll("#usp-view") : [];
  const view = views && views.length ? views[0] : byId("usp-view");
  if (!view) return;
  if (_todoRenderedTick === _renderTick) return;
  _todoRenderedTick = _renderTick;

  try { (views || []).forEach(v => setHtml(v, "")); } catch (e) { setHtml(view, ""); }

  ensureFixedTodoSchema(tabKey, state);
  // housekeeping on week change
  try { todoWeekHousekeeping(state); } catch (e) {}

  const st = App.getState();
  const schema = App.getSchema(tabKey, st);
  const fields = sortFields(schema.fields || []);
  const fieldNames = fields.map(f => String(f.name||"").trim()).filter(Boolean);

  // Filters
  const acting = (App.getActingUser ? App.getActingUser(st) : st.user) || {};
  const ownerKey = String(acting.email || acting.id || "");

  const session = (st.session = st.session || {});
  const filterCat = String(session.todoFilterCat || "Alla");
  const onlyMine = !!session.todoOnlyMine;
  const showLatest = !!session.todoShowLatest;

  const now = new Date();
  const weekNo = isoWeek(now);
  const wr = weekRangeMondaySunday(now);

  

  // ToDo kategori-filter (Alla + kategorier)
  const todoCats = ["Allmänt","Info","Shopify-B2C","Shopify-B2B","Logistik","Privat"];
  const filterOpts = ["Alla"].concat(todoCats);
  const filterSelect = el("select", { class:"input", style:"width:17ch;min-width:17ch;max-width:17ch;", onchange: (ev) => {
      const next = App.getState();
      next.session = next.session || {};
      next.session.todoFilterCat = String(ev.target.value || "Alla");
      next.session.todoRecent = false;
      App.commitState(next);
    }}, filterOpts.map(v => el("option", { value: v, selected: String(v)===String(filterCat) ? "selected" : null }, [v])));

  const filterRow = el("div", { style:"display:flex;align-items:center;gap:12px;margin:10px 0 18px 0;" }, [
    el("div", { class:"muted", style:"font-weight:600;" }, ["Filter:"]),
    filterSelect
  ]);
// Header (week info left, actions right)
  const heroButtons = [
    el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
      const st = App.getState();
      const st2 = (App.cloneState ? App.cloneState(st) : JSON.parse(JSON.stringify(st)));
      st2.session = st2.session || {};
      st2.session.todoRecent = true;
      // In recent mode, use Alla by default
      st2.session.todoFilterCat = "Alla";
      App.commitState(st2);
    }}, ["Senaste"]),
    el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
      const next = App.getState();
      next.session = next.session || {};
      next.session.todoOnlyMine = !next.session.todoOnlyMine;
      App.commitState(next);
    }}, ["Mina ToDo"]),
    el("button", { class: btnClass("primary"), type:"button", onclick: () => { openNewTodoModal(tabKey, App.getState()); } }, ["Ny ToDo"]),
    el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
      openArchiveModal(App.getState(), tabKey, title);
    }}, ["Arkiv"])
  ];

  const headerLeft = el("div", { style:"display:flex;flex-direction:column;gap:6px;" }, [
    el("div", { style:"display:flex;align-items:baseline;gap:14px;flex-wrap:wrap;" }, [
      el("div", { class:"hero-title", style:"font-size:40px;line-height:1.05;font-weight:800;" }, [title]),
      el("div", { class:"hero-subtitle", style:"font-size:20px;font-weight:700;" }, ["Vecka " + String(weekNo)])
    ]),
    el("div", { class:"hint", style:"font-size:12px;margin-left:0;" }, [`${wr.from} – ${wr.to}`])
  ]);

  const headerRight = el("div", { style:"display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end;margin-left:auto;" }, heroButtons);

  const header = el("div", { class:"hero", style:"display:flex;justify-content:space-between;align-items:flex-start;gap:16px;flex-wrap:wrap;" }, [
    headerLeft,
    headerRight
  ]);

  view.appendChild(header);
  view.appendChild(filterRow);

  const table = el("table", { class:"table todo-table" }, []);
  table.appendChild(el("thead", {}, [
    el("tr", {}, [
      ...fieldNames.map(n => el("th", { style: (n==="Kategori" ? "width:17ch;" : (n==="Klart" ? "width:12ch;" : null)) }, [n])),
      el("th", { style:"text-align:right;width:8ch;" }, [""])
    ])
  ]));

  const tbody = el("tbody", {}, []);
  table.appendChild(tbody);
  view.appendChild(table);

  function filterRows(allRows) {
    let rows = (allRows || []).filter(r => r && !r.archived);
    const isNew = (r) => !!(r && r.meta && r.meta._new);

    // Privacy: Privat only visible to owner
    rows = rows.filter(r => {
      const cat = String((r.fields && r.fields["Kategori"]) || "");
      if (cat !== "Privat") return true;
      return String((r.meta && r.meta.owner) || "") === ownerKey;
    });

    // Category filter: if filter != "Alla", show only matching Kategori
    if (filterCat && filterCat !== "Alla") {
      rows = rows.filter(r => String((r.fields && r.fields["Kategori"]) || "") === filterCat);
    } else {
      // "Alla": include everything except other people's Privat (already handled above)
      rows = rows.filter(r => String((r.fields && r.fields["Kategori"]) || "") !== "Privat" || String((r.meta && r.meta.owner)||"")===ownerKey);
    }

    if (onlyMine) {
      const myIni = String(acting.initials || "").trim();
      rows = rows.filter(r => {
        const ownerOk = String((r.meta && r.meta.owner) || "") === ownerKey;
        const resp = String((r.fields && r.fields[initialsKeyFor("Beskrivning")]) || "").trim();
        const respOk = !!myIni && resp === myIni;
        return ownerOk || respOk;
      });
    }

    if (showLatest) {
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const yesterday = new Date(today); yesterday.setDate(today.getDate()-1);
      rows = rows.filter(r => {
        const ts = (r.updatedAt || r.createdAt || "");
        const d = new Date(String(ts));
        if (isNaN(d.getTime())) return false;
        const dd = new Date(d.getFullYear(), d.getMonth(), d.getDate());
        return dd.getTime() === today.getTime() || dd.getTime() === yesterday.getTime();
      });
    }

    return rows;
  }

  // VERSION 210: Kategori dropdown handled directly in ToDo view (independent of FieldTypes)
  const TODO_CATEGORIES = ["Allmänt","Info","Shopify-B2C","Shopify-B2B","Logistik","Privat"];

  function renderTodoCategoryCell(row, tabKey, onPick) {
    const value = String((row && row.fields && row.fields["Kategori"]) || "");
    const label = value || "Välj kategori";
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
      el("option", { value:"" }, [""]),
      ...TODO_CATEGORIES.map(v => el("option", { value:v }, [v]))
    ]);
    sel.value = value;

    sel.addEventListener("change", function(){
      const v = sel.value;
      if (typeof onPick === "function") onPick(v);
    });

    // clicking on display should open select dropdown (native)
    disp.addEventListener("click", function(){
      try { sel.focus(); sel.click(); } catch(e) {}
    });

    wrap.appendChild(disp);
    wrap.appendChild(caret);
    wrap.appendChild(sel);
    return wrap;
  }

  // VERSION 214: New ToDo uses a modal (avoids filter/category confusion)
  let _todoNewModalOpen = false;

  function openNewTodoModal(tabKey, state) {
    closeAnyModal();
    if (_todoNewModalOpen) return;
    _todoNewModalOpen = true;

    const st0 = state || App.getState();
    const acting = (App.getActingUser ? App.getActingUser(st0) : (st0 && st0.session && st0.session.actingUser) || (st0 && st0.session && st0.session.user) || {}) || {};
    const ownerKey = String(acting.email || acting.id || "");
    const initDefault = String((acting.initials || "").trim() || "--");

    const model = { kategori:"", beskrivning:"", klart:"", initials:initDefault };

    const overlay = el("div", { class:"usp-modal-overlay" }, []);
    const backdrop = el("div", { class:"usp-modal-backdrop" }, []);
    const modal = el("div", { class:"usp-modal" }, []);

    function close() {
      _todoNewModalOpen = false;
      try { overlay.remove(); } catch(e) {}
    }

    function save() {
      try {
        const k = (App.Tabs && App.Tabs.TODO) ? App.Tabs.TODO : "todo";
        // Validate required fields
        if (!String(model.kategori||"").trim()) { alert("Välj Kategori"); return; }
        if (!String(model.beskrivning||"").trim()) { alert("Fyll i Beskrivning"); return; }
        const base = App.blankRow ? App.blankRow(k) : { id:null, fields:{}, meta:{} };
        base.fields = base.fields || {};
        base.meta = Object.assign({}, base.meta || {}, { owner: ownerKey, green: false });

        base.fields["Kategori"] = String(model.kategori || "");
        base.fields["Beskrivning"] = String(model.beskrivning || "");
        base.fields["Klart"] = String(model.klart || "");

        const ik = initialsKeyFor("Beskrivning");
        base.fields[ik] = String(model.initials || "--").trim() || "--";

        App.upsertRow(k, base);

        // After save: set filter to saved category and show only that
        const st1 = App.getState();
        const chosen = String(model.kategori || "");
        if (chosen && st1 && st1.session) {
          const st2 = (App.cloneState ? App.cloneState(st1) : JSON.parse(JSON.stringify(st1)));
          st2.session = st2.session || {};
          st2.session.todoFilterCat = chosen;
            st2.session.todoRecent = false;
          App.commitState(st2);
        }

        close();
      } catch (e) {
        console.error("Save ToDo failed", e);
      }
    }

    const head = el("div", { class:"usp-modal-head" }, [
      el("div", { class:"usp-modal-title" }, ["Ny ToDo"]),
      el("div", { class:"usp-modal-subtitle" }, ["Fyll i Kategori, Beskrivning och Klart, och spara."])
    ]);

    // Kategori (clickable value opens dropdown)
    const catLabel = el("div", { class:"usp-modal-label" }, ["Kategori"]);
    const catCell = renderTodoCategoryCell({ fields:{ "Kategori": model.kategori } }, tabKey, (v) => {
      model.kategori = v;
      const vEl = catCell.querySelector(".input");
      if (vEl) vEl.textContent = v || "Välj kategori";
    });
    const vEl0 = catCell.querySelector(".input");
    if (vEl0) vEl0.textContent = "Välj kategori";
    const catField = el("div", { class:"usp-modal-field" }, [catLabel, catCell]);

    // Beskrivning + initials
    const descLabel = el("div", { class:"usp-modal-label" }, ["Beskrivning"]);
    const descInput = el("input", { class:"usp-modal-input", type:"text", value:model.beskrivning }, []);
    descInput.addEventListener("input", () => { model.beskrivning = descInput.value; });

    const iniBtn = el("button", { class:"act-initials", type:"button", title:"Initialer" }, [model.initials]);
    iniBtn.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      const pick = promptPickInitials(model.initials);
      if (pick === null) return;
      model.initials = pick;
      iniBtn.textContent = pick;
    });

    const descWrap = el("div", { class:"usp-modal-descwrap" }, [descInput, iniBtn]);
    const descField = el("div", { class:"usp-modal-field" }, [descLabel, descWrap]);

    // Klart (date)
    const dateLabel = el("div", { class:"usp-modal-label" }, ["Klart"]);
    const dateInput = el("input", { class:"usp-modal-input usp-modal-date", type:"date", value:model.klart }, []);
    dateInput.addEventListener("change", () => { model.klart = dateInput.value; });
    const dateField = el("div", { class:"usp-modal-field" }, [dateLabel, dateInput]);

    const fields = el("div", { class:"usp-modal-fields" }, [catField, descField, dateField]);

    const btnCancel = el("button", { class: btnClass("secondary"), type:"button" }, ["Cancel"]);
    btnCancel.addEventListener("click", (e) => { e.preventDefault(); close(); });

    const btnSave = el("button", { class: btnClass("primary"), type:"button" }, ["Save"]);
    btnSave.addEventListener("click", (e) => { e.preventDefault(); save(); });

    const btns = el("div", { class:"usp-modal-actions" }, [btnCancel, btnSave]);

    modal.appendChild(head);
    modal.appendChild(fields);
    modal.appendChild(btns);

    overlay.appendChild(backdrop);
    overlay.appendChild(modal);

    backdrop.addEventListener("click", () => close());
    document.addEventListener("keydown", function esc(e){
      if (!_todoNewModalOpen) { document.removeEventListener("keydown", esc); return; }
      if (e.key === "Escape") { e.preventDefault(); close(); document.removeEventListener("keydown", esc); }
    });

    document.body.appendChild(overlay);
    try { descInput.focus(); } catch(e) {}
  }




  function rerender() {
    setHtml(tbody, "");
    const freshRows = filterRows(App.listRows(tabKey, App.getState()) || []);
    freshRows.forEach(r => {
      const tr = el("tr", {}, []);
      if (r.meta && r.meta.green) tr.classList.add("usp-row-green");

      fieldNames.forEach(n => {
        const td = el("td", {}, []);
        if (n === "Start" || n === "Slut") td.style.textAlign = "center";
        // Right click on Kategori toggles green row
        if (n === "Kategori") {
          const catEl = renderProjectCategoryCell(r, (val) => {
            const st3 = App.getState();
            const cur3 = getRowSafe(tabKey, r.id, st3) || r;
            const next3 = Object.assign({}, cur3, { updatedAt: new Date().toISOString(), fields: Object.assign({}, cur3.fields||{}) });
            next3.fields["Kategori"] = val;
            App.upsertRow(tabKey, next3);
          });
          td.appendChild(catEl);
          tr.appendChild(td);
          return;
        }


        const field = (fields || []).find(x => String(x.name || "").trim() === n) || { name: n, type: "text", mods: {} };
        const tkey = (App.FieldTypes && App.FieldTypes.normalizeType) ? App.FieldTypes.normalizeType(field.type) : String(field.type || "text");

        const cellVal = ((r.fields && r.fields[n]) != null ? (r.fields && r.fields[n]) : "");
        const overdue = (tkey === "date") && isOverdueDate(cellVal);


        const editor = (App.FieldTypes && typeof App.FieldTypes.renderEditor === "function")
          ? App.FieldTypes.renderEditor({
              baseType: tkey,
              mods: Object.assign({}, field.mods||{}, overdue ? { overdue:true } : {}),
              overdue,
              value: ((r.fields && r.fields[n]) != null ? (r.fields && r.fields[n]) : ""),
              disabled: false,
              notesHas: (field && field.mods && field.mods.notes) ? hasNotesInCell(r, n) : false,
              onNotesClick: (field && field.mods && field.mods.notes) ? (() => addNoteToCell(tabKey, r.id, n)) : null,
              onChange: (val) => {
                const st3 = App.getState();
                const cur3 = getRowSafe(tabKey, r.id, st3) || r;
                const next3 = Object.assign({}, cur3, { updatedAt: new Date().toISOString(), fields: Object.assign({}, cur3.fields||{}) });
                const v = (App.FieldTypes.normalizeValue) ? App.FieldTypes.normalizeValue(tkey, val) : val;
                next3.fields[n] = v;
                App.upsertRow(tabKey, next3);
              },
              initialsValue: ((r.fields && r.fields[initialsKeyFor(n)]) != null ? (r.fields && r.fields[initialsKeyFor(n)]) : "--"),
              onInitialsClick: (field.mods && field.mods.initials) ? () => {
                const curIni = ((r.fields && r.fields[initialsKeyFor(n)]) != null ? (r.fields && r.fields[initialsKeyFor(n)]) : "--");
                const pick = promptPickInitials(curIni);
                if (pick === null) return;
                const st4 = App.getState();
                const cur4 = getRowSafe(tabKey, r.id, st4) || r;
                const next4 = Object.assign({}, cur4, { updatedAt: new Date().toISOString(), fields: Object.assign({}, cur4.fields||{}) });
                next4.fields[initialsKeyFor(n)] = String(pick || "--");
                App.upsertRow(tabKey, next4);
              } : undefined,
              notesHas: (function () {
                try { const log = readNotesLog((r.fields || {}), n); return Array.isArray(log) && log.length > 0; } catch (e) { return false; }
              })(),
              onNotesClick: (field.mods && field.mods.notes) ? () => {
                try {
                  const st5 = App.getState();
                  const cur5 = getRowSafe(tabKey, r.id, st5) || r;
                  const next5 = Object.assign({}, cur5, { updatedAt: new Date().toISOString(), fields: Object.assign({}, cur5.fields||{}) });
                  const log = readNotesLog(next5.fields, n);
                  const rowName = rowDisplayNameForNotes(tabKey, cur5, st5);
                  openNotesModal(tabKey, n, log, function(add){
                    if (!add) return;
                    log.push({ ts: new Date().toISOString(), by: currentInitials(), text: add });
                    writeNotesLog(next5.fields, n, log);
                    App.upsertRow(tabKey, next5);
                  });
                  } catch (e) { console.warn(e); }
              } : undefined,
            })
          : el("div", {}, [String(((r.fields && r.fields[n]) != null ? (r.fields && r.fields[n]) : ""))]);

        td.appendChild(editor);
        tr.appendChild(td);
      });

      // Delete button
      const tdDel = el("td", { style:"white-space:nowrap;" }, []);
      tdDel.appendChild(el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
        const ok = window.confirm("Ta bort raden permanent?");
        if (!ok) return;
        // delete by filtering list and committing
        const stDel = App.getState();
        const next = (function(){ try { return JSON.parse(JSON.stringify(stDel)); } catch(e) { return Object.assign({}, stDel); } })();
        next.data = next.data || {};
        next.data[tabKey] = (App.listRows(tabKey, stDel) || []).filter(x => !(x && x.id === r.id));
        App.commitState(next);
      }}, ["Ta bort"]));
      tr.appendChild(tdDel);

      // Right-click row toggles green highlight (ToDo)
      try {
        const isGreen = !!(r && r.meta && r.meta.green);
        if (isGreen) tr.classList.add("row-green");
        tr.addEventListener("contextmenu", function(e){
          e.preventDefault();
          const st = App.getState();
          const list = Array.isArray(st.data && st.data[tabKey]) ? st.data[tabKey] : [];
          const nextList = list.map(x => {
            if (!x || x.id !== r.id) return x;
            const meta = Object.assign({}, x.meta || {});
            meta.green = !meta.green;
            return Object.assign({}, x, { meta, updatedAt: new Date().toISOString() });
          });
          const next = (function(){ try { return JSON.parse(JSON.stringify(st)); } catch(e2) { return Object.assign({}, st); } })();
          next.data = next.data || {};
          next.data[tabKey] = nextList;
          App.commitState(next);
        });
      } catch(e) {}

      tbody.appendChild(tr);
    });
  }

  rerender();
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
    if (_projectNewModalOpen) return;
    _projectNewModalOpen = true;

    const st0 = state || App.getState();
    const acting = (App.getActingUser ? App.getActingUser(st0) : (st0 && st0.session && st0.session.actingUser) || (st0 && st0.session && st0.session.user) || {}) || {};
    const ownerKey = String(acting.email || acting.id || "");
    const initDefault = String((acting.initials || "").trim() || "--");

    const model = {
      projektnamn:"",
      projektnamnInit:initDefault,
      projektnamnNotes:[],
      kategori:"",
      start:"",
      aktuell:"",
      aktuellInit:initDefault,
      aktuellNotes:[],
      nasta:"",
      nastaInit:initDefault,
      nastaNotes:[],
      kommande:"",
      kommandeInit:initDefault,
      kommandeNotes:[],
      slut:""
    };

    const overlay = el("div", { class:"usp-modal-overlay" }, []);
    const backdrop = el("div", { class:"usp-modal-backdrop" }, []);
    const modal = el("div", { class:"usp-modal" }, []);

    function close() {
      _projectNewModalOpen = false;
      try { overlay.remove(); } catch(e) {}
    }

    function editNotes(fieldLabel, notesArrRefSetter, currentArr) {
      openNotesModal(tabKey, fieldLabel, (currentArr || []), function(t){
        if (!t) return;
      const ts = new Date().toISOString();
      const entry = { ts, by: (acting && acting.initials) ? acting.initials : "", text: t };
      const next = (currentArr || []).concat([entry]);
      notesArrRefSetter(next);
      });
    }

    function save() {
      try {
        const k = tabKey || (App.Tabs && App.Tabs.PROJECT ? App.Tabs.PROJECT : "project");
        const base = App.blankRow ? App.blankRow(k) : { id:null, fields:{}, meta:{} };
        base.fields = base.fields || {};
        base.meta = Object.assign({}, base.meta || {}, { owner: ownerKey });

        base.fields["Projektnamn"] = String(model.projektnamn || "");
        base.fields["Kategori"] = String(model.kategori || "");
        base.fields["Start"] = String(model.start || "");
        base.fields["Aktuell"] = String(model.aktuell || "");
        base.fields["Nästa"] = String(model.nasta || "");
        base.fields["Kommande"] = String(model.kommande || "");
        base.fields["Slut"] = String(model.slut || "");

        base.fields[initialsKeyFor("Projektnamn")] = String(model.projektnamnInit || "--");
        base.fields[initialsKeyFor("Aktuell")] = String(model.aktuellInit || "--");
        base.fields[initialsKeyFor("Nästa")] = String(model.nastaInit || "--");
        base.fields[initialsKeyFor("Kommande")] = String(model.kommandeInit || "--");

        base.fields[notesKeyFor("Projektnamn")] = model.projektnamnNotes || [];
        base.fields[notesKeyFor("Aktuell")] = model.aktuellNotes || [];
        base.fields[notesKeyFor("Nästa")] = model.nastaNotes || [];
        base.fields[notesKeyFor("Kommande")] = model.kommandeNotes || [];

        App.upsertRow(k, base);
        close();
      } catch (e) {
        console.error("Save Project failed", e);
      }
    }

    const head = el("div", { class:"usp-modal-head" }, [
      el("div", { class:"usp-modal-title" }, ["Nytt projekt"]),
      el("div", { class:"usp-modal-subtitle" }, ["Fyll i uppgifter och spara."])
    ]);

    function fieldRow(label, control) {
      return el("div", { class:"usp-modal-field" }, [
        el("div", { class:"usp-modal-label" }, [label]),
        control
      ]);
    }

    // Projektnamn + initials (click initials to notes)
    const pnInput = el("input", { class:"usp-modal-input", type:"text", value:model.projektnamn }, []);
    pnInput.addEventListener("input", () => { model.projektnamn = pnInput.value; });

    const pnIni = el("button", { class:"act-initials", type:"button", title:"Initialer / Notes" }, [model.projektnamnInit]);
    function refreshPnIni() {
      pnIni.textContent = model.projektnamnInit || "--";
      pnIni.style.color = (model.projektnamnNotes && model.projektnamnNotes.length) ? "#0b3d91" : "";
    }
    pnIni.addEventListener("click", (e) => {
      e.preventDefault(); e.stopPropagation();
      // click initials opens notes; shift-click changes initials
      if (e.shiftKey) {
        const pick = promptPickInitials(model.projektnamnInit);
        if (pick === null) return;
        model.projektnamnInit = pick;
        refreshPnIni();
        return;
      }
      editNotes("Projektnamn", (arr)=>{ model.projektnamnNotes = arr; refreshPnIni(); }, model.projektnamnNotes);
    });
    refreshPnIni();

    const pnWrap = el("div", { class:"usp-modal-descwrap" }, [pnInput, pnIni]);
    const pnField = fieldRow("Projektnamn", pnWrap);

    // Kategori dropdown
    const catCell = renderProjectCategoryCell({ fields:{ "Kategori": model.kategori } }, tabKey, (v)=>{ model.kategori=v; });
    const catField = fieldRow("Kategori", catCell);

    // Start date
    const startInput = el("input", { class:"usp-modal-input usp-modal-date", type:"date", value:model.start }, []);
    startInput.addEventListener("change", ()=>{ model.start = startInput.value; });
    const startField = fieldRow("Start", startInput);

    // Aktuell + initials + corner marker (click initials opens notes; shift-click changes initials)
    const aInput = el("input", { class:"usp-modal-input", type:"text", value:model.aktuell }, []);
    aInput.addEventListener("input", ()=>{ model.aktuell = aInput.value; });
    const aIni = el("button", { class:"act-initials has-corner", type:"button", title:"Initialer / Notes" }, [model.aktuellInit]);
    function refreshAIni() {
      aIni.textContent = model.aktuellInit || "--";
      aIni.style.color = (model.aktuellNotes && model.aktuellNotes.length) ? "#0b3d91" : "";
    }
    aIni.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) {
        const pick = promptPickInitials(model.aktuellInit);
        if (pick === null) return;
        model.aktuellInit = pick;
        refreshAIni();
        return;
      }
      editNotes("Aktuell", (arr)=>{ model.aktuellNotes = arr; refreshAIni(); }, model.aktuellNotes);
    });
    refreshAIni();
    const aWrap = el("div", { class:"usp-modal-descwrap" }, [aInput, aIni]);
    const aField = fieldRow("Aktuell", aWrap);

    // Nästa
    const nInput = el("input", { class:"usp-modal-input", type:"text", value:model.nasta }, []);
    nInput.addEventListener("input", ()=>{ model.nasta = nInput.value; });
    const nIni = el("button", { class:"act-initials", type:"button", title:"Initialer / Notes" }, [model.nastaInit]);
    function refreshNIni() {
      nIni.textContent = model.nastaInit || "--";
      nIni.style.color = (model.nastaNotes && model.nastaNotes.length) ? "#0b3d91" : "";
    }
    nIni.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) {
        const pick = promptPickInitials(model.nastaInit);
        if (pick === null) return;
        model.nastaInit = pick;
        refreshNIni();
        return;
      }
      editNotes("Nästa", (arr)=>{ model.nastaNotes = arr; refreshNIni(); }, model.nastaNotes);
    });
    refreshNIni();
    const nWrap = el("div", { class:"usp-modal-descwrap" }, [nInput, nIni]);
    const nField = fieldRow("Nästa", nWrap);

    // Kommande
    const kInput = el("input", { class:"usp-modal-input", type:"text", value:model.kommande }, []);
    kInput.addEventListener("input", ()=>{ model.kommande = kInput.value; });
    const kIni = el("button", { class:"act-initials", type:"button", title:"Initialer / Notes" }, [model.kommandeInit]);
    function refreshKIni() {
      kIni.textContent = model.kommandeInit || "--";
      kIni.style.color = (model.kommandeNotes && model.kommandeNotes.length) ? "#0b3d91" : "";
    }
    kIni.addEventListener("click", (e)=>{
      e.preventDefault(); e.stopPropagation();
      if (e.shiftKey) {
        const pick = promptPickInitials(model.kommandeInit);
        if (pick === null) return;
        model.kommandeInit = pick;
        refreshKIni();
        return;
      }
      editNotes("Kommande", (arr)=>{ model.kommandeNotes = arr; refreshKIni(); }, model.kommandeNotes);
    });
    refreshKIni();
    const kWrap = el("div", { class:"usp-modal-descwrap" }, [kInput, kIni]);
    const kField = fieldRow("Kommande", kWrap);

    // Slut date
    const slutInput = el("input", { class:"usp-modal-input usp-modal-date", type:"date", value:model.slut }, []);
    slutInput.addEventListener("change", ()=>{ model.slut = slutInput.value; });
    const slutField = fieldRow("Slut", slutInput);

    const fields = el("div", { class:"usp-modal-fields" }, [pnField, catField, startField, aField, nField, kField, slutField]);

    const btnCancel = el("button", { class: btnClass("secondary"), type:"button" }, ["Cancel"]);
    btnCancel.addEventListener("click", (e)=>{ e.preventDefault(); close(); });

    const btnSave = el("button", { class: btnClass("primary"), type:"button" }, ["Save"]);
    btnSave.addEventListener("click", (e)=>{ e.preventDefault(); save(); });

    const btns = el("div", { class:"usp-modal-actions" }, [btnCancel, btnSave]);

    modal.appendChild(head);
    modal.appendChild(fields);
    modal.appendChild(btns);

    overlay.appendChild(backdrop);
    overlay.appendChild(modal);

    backdrop.addEventListener("click", ()=>close());
    document.addEventListener("keydown", function esc(e){
      if (!_projectNewModalOpen) { document.removeEventListener("keydown", esc); return; }
      if (e.key === "Escape") { e.preventDefault(); close(); document.removeEventListener("keydown", esc); }
    });

    document.body.appendChild(overlay);
    try { pnInput.focus(); } catch(e) {}
  }

  function projectView(state, tabKey, title) {

    // VERSION 230: Kategori i tabellen visas som klickbar text (ej synlig dropdown)
    const PROJECT_CATEGORIES = ["kundprojekt","volymprojekt","samarbetsprojekt"];

    function renderProjectCategoryCell(row, onPick) {
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
        el("option", { value:"" }, [""]),
        ...PROJECT_CATEGORIES.map(v => el("option", { value:v }, [v]))
      ]);
      sel.value = value;

      sel.addEventListener("change", function(){
        const v = sel.value;
        if (typeof onPick === "function") onPick(v);
        // update display text
        disp.textContent = v || "Välj";
        disp.appendChild(caret);
      });

      disp.addEventListener("click", function(){
        try { sel.focus(); sel.click(); } catch(e) {}
      });

      wrap.appendChild(disp);
      wrap.appendChild(caret);
      wrap.appendChild(sel);
      return wrap;
    }


    ensureFixedProjectSchema(tabKey, state);

    const view = byId("usp-view");
    if (!view) return;
    setHtml(view, "");

    const heroButtons = [];
    heroButtons.push(el("button", { class: btnClass("primary"), type:"button", onclick: () => openNewProjectModal(tabKey, App.getState()) }, ["Nytt projekt"]));

    // Optional: Arkiv viewer
    heroButtons.push(el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
      const st = App.getState();
      const entries = (st && st.data && st.data[projectArchiveKey()]) ? st.data[projectArchiveKey()] : [];
      const txt = entries && entries.length ? entries.map(e => (e.ts||"") + " " + (e.projektnamn||"") + " — " + (e.text||"")).join("\n") : "(tomt)";
      alert("Projekt-arkiv\n\n" + txt);
    }}, ["Arkiv"]));

    view.appendChild(hero(title || "Projekt", "Projektlista", heroButtons));

    const schema = App.getSchema(tabKey, state) || fixedProjectSchema();
    const rows = App.listRows(tabKey, state) || [];
    const fieldNames = schema.fields.map(f => f.name);

    const table = el("table", { class:"grid" }, []);
    const thead = el("thead", {}, []);
    const htr = el("tr", {}, [
      ...fieldNames.map(n => el("th", { style: (n==="Kategori" ? "width:17ch;" : (n==="Start"||n==="Slut" ? "width:15ch;" : null)) }, [n])),
      el("th", { style:"text-align:right;white-space:nowrap;" }, [""])
    ]);
    thead.appendChild(htr);
    table.appendChild(thead);

    const tbody = el("tbody", {}, []);

    function onNotesClick(rowId, fieldName) {
      const st = App.getState();
      const row = getRowSafe(tabKey, rowId, st);
      if (!row) return;
      const fields = Object.assign({}, row.fields || {});
      const existing = readNotesLog(fields, fieldName);
      openNotesModal(tabKey, fieldName, existing, function(t){
        if (!t) return;
        const byIni = (App.getActingUser ? ((App.getActingUser(st).initials)||"") : "");
        const nextLog = existing.concat([{ ts: new Date().toISOString(), by: byIni, text: t }]);
        writeNotesLog(fields, fieldName, nextLog);
        const nextRow = Object.assign({}, row, { fields, updatedAt: new Date().toISOString() });
        App.upsertRow(tabKey, nextRow);
      });
      }

    function hasNotesInCell(row, fieldName) {
      const log = readNotesLog(row.fields || {}, fieldName);
      return log && log.length > 0;
    }

    function renderRow(r) {
      const tr = el("tr", {}, []);
      fieldNames.forEach((n) => {
        const td = el("td", {}, []);
        if (n === "Start" || n === "Slut") td.style.textAlign = "center";

        if (n === "Kategori") {
          td.appendChild(renderProjectCategoryCell(r, tabKey, (val) => {
            const st = App.getState();
            const cur = getRowSafe(tabKey, r.id, st) || r;
            const next = Object.assign({}, cur, { updatedAt: new Date().toISOString(), fields: Object.assign({}, cur.fields||{}) });
            next.fields["Kategori"] = val;
            App.upsertRow(tabKey, next);
          }));
          tr.appendChild(td);
          return;
        }

        const f = schema.fields.find(x => x.name === n) || { type:"text", mods:{} };
        const value = (r.fields && r.fields[n] != null) ? r.fields[n] : "";
        const iniKey = initialsKeyFor(n);
        const iniVal = (r.fields && r.fields[iniKey] != null) ? r.fields[iniKey] : "--";

        const editor = App.FieldTypes.renderEditor({
          type: f.type,
          value: value,
          mods: Object.assign({}, f.mods || {}),
          notesHas: (f.mods && f.mods.notes) ? hasNotesInCell(r, f.name) : false,
          onNotesClick: (f.mods && f.mods.notes) ? (() => addNoteToCell(tabKey, r.id, f.name)) : null,
          // initials addon (default --)
          initialsValue: iniVal,
          onInitialsClick: (f.mods && f.mods.initials) ? (() => {
            const curIni = (r.fields && r.fields[iniKey] != null) ? r.fields[iniKey] : "--";
            const pick = promptPickInitials(curIni);
            if (pick === null) return;
            const st = App.getState();
            const cur = getRowSafe(tabKey, r.id, st) || r;
            const fields = Object.assign({}, cur.fields || {});
            fields[iniKey] = String(pick || "--");
            const nextRow = Object.assign({}, cur, { fields, updatedAt: new Date().toISOString() });
            App.upsertRow(tabKey, nextRow);
          }) : null,
          // notes addon
          notesHas: (f.mods && f.mods.notes) ? hasNotesInCell(r, n) : false,
          onNotesClick: (f.mods && f.mods.notes) ? (() => addNoteToCell(tabKey, r.id, n)) : null,
          onChange: (nextVal) => {
            const st = App.getState();
            const cur = getRowSafe(tabKey, r.id, st) || r;
            const fields = Object.assign({}, cur.fields || {});
            fields[n] = nextVal;
            const nextRow = Object.assign({}, cur, { fields, updatedAt: new Date().toISOString() });
            App.upsertRow(tabKey, nextRow);
          }
        });

        // corner marker for Aktuell
        if (n === "Aktuell") {
          td.className = (td.className ? td.className + " " : "") + "has-corner-marker";
        }

        td.appendChild(editor);
        tr.appendChild(td);
      });

      const actionsTd = el("td", { style:"text-align:right;white-space:nowrap;" }, []);

      const btnDone = el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
        const st = App.getState();
        const row = getRowSafe(tabKey, r.id, st);
        if (!row) return;
        const text = String((row.fields && row.fields["Aktuell"]) || "").trim();
        if (!text) return;

        const entry = {
          ts: new Date().toISOString(),
          projectId: row.id,
          projektnamn: String((row.fields && row.fields["Projektnamn"]) || ""),
          kategori: String((row.fields && row.fields["Kategori"]) || ""),
          text: text,
          by: String((App.getActingUser ? (App.getActingUser(st).initials||"") : ""))
        };

        const st2 = (App.cloneState ? App.cloneState(st) : JSON.parse(JSON.stringify(st)));
        st2.data = st2.data || {};
        const ak = projectArchiveKey();
        st2.data[ak] = Array.isArray(st2.data[ak]) ? st2.data[ak] : [];
        st2.data[ak].push(entry);
        App.commitState(st2);

        // Clear Aktuell and its notes (keep initials)
        const fields = Object.assign({}, row.fields || {});
        fields["Aktuell"] = "";
        fields[notesKeyFor("Aktuell")] = [];
        const nextRow = Object.assign({}, row, { fields, updatedAt: new Date().toISOString() });
        App.upsertRow(tabKey, nextRow);
      }}, ["Aktuellt klar"]);

      const btnDel = el("button", { class: btnClass("danger"), type:"button", onclick: () => {
        if (!confirm("Ta bort raden?")) return;
        App.deleteRow ? App.deleteRow(tabKey, r.id) : App.upsertRow(tabKey, null);
      }}, ["Ta bort"]);

      actionsTd.appendChild(btnDone);
      actionsTd.appendChild(el("span", { style:"display:inline-block;width:8px;" }, [""]));
      actionsTd.appendChild(btnDel);

      tr.appendChild(actionsTd);
      return tr;
    }

    rows.filter(r => !r.archived).forEach(r => tbody.appendChild(renderRow(r)));
    table.appendChild(tbody);
    view.appendChild(table);
  }






  // ---------------------------
  // Change user (always available)
  // ---------------------------
  function openChangeUser(state) {
    const view = byId("usp-view");
    if (!view) return;
    setHtml(view, "");

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
    if (!view) return;
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
          el("button", { class:"icon-btn manage-user-delete", type:"button", onclick: () => {
            const ok = window.confirm("Delete user?");
            if (!ok) return;
            App.deleteUser(u.id);
            renderList();
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

      const del = el("button", { class:"btn btn-secondary", type:"button", onclick: () => {
        const ok = window.confirm("Delete user?");
        if (!ok) return;
        App.deleteUser(user.id);
        openManageUsers(App.getState());
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
    setHtml(view, "");
    view.appendChild(hero("Settings", "Öppna via Settings-knappen uppe till höger.", []));
  }





  UI.render = function render(state) {

    

    registerFixedTables();
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
    _renderTick++;
    _routinesSchemaEnsured = false;

    const tab = App.getTab(state);
try{ if(String(location.hostname)!=="planning.cappelendimyr.com") console.log("[ui tab debug] tab=", tab); }catch(e){}
    const role = App.role(state);
    const roleMode = (App.getRoleMode ? App.getRoleMode(state) : role);

    if (tab === App.Tabs.SETTINGS) return settingsView(state);

    if (role === "admin") {
      if (tab === App.Tabs.DEV) return adminSchemaView(state, App.Tabs.DEV, "Utveckling");
      if (tab === App.Tabs.PRODUCT) return adminSchemaView(state, App.Tabs.PRODUCT, "Sälj");
      if (tab === App.Tabs.TODO) return todoView(state, App.Tabs.TODO, "ToDo");
    if (tab === App.Tabs.PROJECT || tab === "project") return projectView(state, App.Tabs.PROJECT || "project", "Projekt");
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

})();

    function promptAddNote(){ return null; }
