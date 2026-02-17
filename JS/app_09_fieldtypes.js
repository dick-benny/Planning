// [fieldtypes v111]
/* app_09_fieldtypes_07.js
   Dynamic FieldTypes: base + addons (mods)

   Base types:
     text, status, date, week, produktkategori

   Addons (mods):
     corner     : corner marker toggle (default/green/yellow/red) stored by UI (not here)
     initials   : initials ring ("--" default)
     notes      : notes (log owned by UI); UI provides notesHas + onNotesClick

   Rendering:
   - Rounded rectangle .act-field
   - Base editor inside .act-cell
   - Optional corner button (if base=status OR mods.corner) toggles stored value via onCornerChange
   - Optional initials ring (mods.initials) via onInitialsClick
   - Optional notes icon (mods.notes) via onNotesClick; icon gets .is-notes when notesHas

   API:
     USP.App.FieldTypes.listBase()
     USP.App.FieldTypes.listMods()
     USP.App.FieldTypes.normalizeBaseType(t)
     USP.App.FieldTypes.renderEditor(ctx)

   ctx:
     {
       baseType,        // text|status|date|week|produktkategori
       value, onChange, // base value
       disabled,
       // corner
       cornerValue, onCornerChange,
       // initials
       initialsValue, onInitialsClick,
       // notes
       notesHas, onNotesClick
     }
*/

(function () {
  "use strict";

  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};
  const App = window.USP.App;

  const VERSION = 7;

  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (v === undefined || v === null) return;
        if (k === "class") n.className = String(v);
        else if (k === "style") n.setAttribute("style", String(v));
        else if (k === "text") n.textContent = String(v);
        else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
        else if (k === "disabled") n.disabled = !!v;
        else if (k === "value") n.value = String(v);
        else n.setAttribute(k, String(v));
      });
    }
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      if (typeof c === "string") n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    });
    return n;
  }

  function normStr(s) { return String(s || "").trim(); }
  function pad2(n) { return String(n).padStart(2, "0"); }

  // -------- week helpers
  function parseDateYYYYMMDD(s) {
    const t = normStr(s);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(t)) return null;
    const [y, m, d] = t.split("-").map((x) => parseInt(x, 10));
    const dt = new Date(Date.UTC(y, m - 1, d));
    if (Number.isNaN(dt.getTime())) return null;
    return dt;
  }

  function isoWeek(dtUtc) {
    const d = new Date(Date.UTC(dtUtc.getUTCFullYear(), dtUtc.getUTCMonth(), dtUtc.getUTCDate()));
    const day = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - day);
    const year = d.getUTCFullYear();

    const jan4 = new Date(Date.UTC(year, 0, 4));
    const jan4Day = jan4.getUTCDay() || 7;
    const mondayWeek1 = new Date(jan4);
    mondayWeek1.setUTCDate(jan4.getUTCDate() - (jan4Day - 1));

    const diffDays = Math.round((d - mondayWeek1) / 86400000);
    const week = 1 + Math.floor(diffDays / 7);
    return { year, week };
  }

  function isoWeekKeyFromDate(dtUtc) {
    const w = isoWeek(dtUtc);
    return String(w.year) + "-W" + pad2(w.week);
  }

  // -------- base type normalize/value
  function normalizeBaseType(t) {
    const x0 = normStr(t).toLowerCase();
    if (!x0) return "text";
    if (x0 === "datum" || x0 === "calendar" || x0 === "kalender") return "date";
    if (x0 === "veckonummer" || x0 === "veckokalender" || x0 === "weeknumber" || x0 === "weekcalendar") return "week";
    if (["text","status","date","week","produktkategori"].includes(x0)) return x0;
    return "text";
  }

  function normalizeValue(base, value) {
    const t = normalizeBaseType(base);
    if (t === "status") {
      const v = normStr(value).toLowerCase();
      if (["","green","yellow","red"].includes(v)) return v;
      return "";
    }
    if (t === "date") {
      const v = normStr(value);
      return /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : "";
    }
    if (t === "week") {
      const v = normStr(value);
      return /^\d{4}-W\d{2}$/.test(v) ? v : "";
    }
    if (t === "produktkategori") {
      const v = normStr(value).toLowerCase();
      const allowed = ["matta","tapestry","colonnade","paketering","soft ass"];
      return allowed.includes(v) ? v : "";
    }
    return String(value ?? "");
  }

  // -------- addons
  const STATUS_ORDER = ["", "green", "yellow", "red"];
  function nextCorner(cur) {
    const v = normStr(cur).toLowerCase();
    const i = STATUS_ORDER.indexOf(v);
    return STATUS_ORDER[(i < 0 ? 0 : (i + 1) % STATUS_ORDER.length)];
  }

  function renderNotesIcon(ctx) {
    if (!ctx || typeof ctx.onNotesClick !== "function") return null;
    const cls = "note-icon" + (ctx.notesHas ? " is-notes" : "");
    const btn = el("button", { class: cls, type:"button" }, ["📝"]);
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      ctx.onNotesClick();
    });
    return btn;
  }

  function renderInitialsRing(ctx) {
    if (!ctx || typeof ctx.onInitialsClick !== "function") return null;
    const v = normStr(ctx.initialsValue) || "--";
    const cls = "act-initials" + (ctx.notesHas ? " is-notes" : "");
    const btn = el("button", { class: cls, type:"button" }, [v]);
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      ctx.onInitialsClick();
    });
    // Right click opens notes if available
    btn.addEventListener("contextmenu", function (e) {
      if (!ctx.onNotesClick) return;
      e.preventDefault(); e.stopPropagation();
      ctx.onNotesClick();
    });
    return btn;
  }

  function wrapActField(inner, ctx) {
    const base = normalizeBaseType(ctx && (ctx.baseType || ctx.type));
    const disabled = !!(ctx && ctx.disabled);

    // Corner applies if base=status OR ctx.onCornerChange exists
    const cornerEnabled = (base === "status") || (typeof (ctx && ctx.onCornerChange) === "function");
    const cornerVal = normalizeValue("status", ctx && ctx.cornerValue);

    const cls = ["act-field"];
    if (cornerVal) cls.push("status-" + cornerVal);

    const wrap = el("div", { class: cls.join(" ") }, []);

    if (cornerEnabled) {
      const cornerBtn = el("button", { class:"act-status-corner", type:"button", disabled }, []);
      cornerBtn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (disabled) return;

        const cur = normalizeValue("status", ctx && ctx.cornerValue);
        const nx = nextCorner(cur);

        // Immediate UI
        wrap.classList.remove("status-green","status-yellow","status-red");
        if (nx) wrap.classList.add("status-" + nx);

        if (ctx && typeof ctx.onCornerChange === "function") ctx.onCornerChange(nx);
        else if (base === "status" && ctx && typeof ctx.onChange === "function") ctx.onChange(nx);
      });
      wrap.appendChild(cornerBtn);
    }

    wrap.appendChild(el("div", { class:"act-cell", style:"flex:1;min-width:0;" }, [inner]));

    const ring = renderInitialsRing(ctx);
    if (ring) wrap.appendChild(ring);

    // Notes icon only when there is no initials addon (notes via right-click on initials)
    if (!ring) {
      const notesBtn = renderNotesIcon(ctx);
      if (notesBtn) wrap.appendChild(notesBtn);
    }

    return wrap;
  }

  // base editors
  function renderText(ctx) {
    const disabled = !!(ctx && ctx.disabled);
    const value = String((ctx && ctx.value) ?? "");
    const placeholder = (ctx && ctx.placeholder) ? String(ctx.placeholder) : "";

    const input = el("input", {
      class:"act-value-input",
      type:"text",
      value,
      placeholder,
      disabled,
      style:"width:100%;min-width:12ch;"
    }, []);

    let t = null;
    function flush() {
      if (t) { clearTimeout(t); t = null; }
      if (ctx && typeof ctx.onChange === "function") ctx.onChange(input.value);
    }

    input.addEventListener("input", function () {
      if (disabled) return;
      if (t) clearTimeout(t);
      t = setTimeout(flush, 250);
    });
    input.addEventListener("blur", function () { flush(); });

    return wrapActField(input, ctx);
  }

  function renderDate(ctx) {
    const disabled = !!(ctx && ctx.disabled);
    const value = normalizeValue("date", ctx && ctx.value);

    const display = el("div", { class:"act-date-display", text: value || "-- -- --", style:"width:15ch;min-width:15ch;max-width:15ch;font-size:0.85em;text-align:center;" }, []);
    const picker = el("input", { class:"act-date-picker", type:"date", value, disabled, style:"width:15ch;min-width:15ch;max-width:15ch;font-size:0.85em;text-align:center;" }, []);

    function openPicker() {
      if (disabled) return;
      try { if (picker.showPicker) picker.showPicker(); } catch (e) {}
      try { picker.focus(); picker.click(); } catch (e) {}
    }
    display.addEventListener("click", openPicker);

    picker.addEventListener("change", function () {
      const v = normalizeValue("date", picker.value);
      display.textContent = v || "-- -- --";
      if (ctx && typeof ctx.onChange === "function") ctx.onChange(v);
    });

    const inner = el("div", { class:"act-date-wrap", style:"width:100%;" }, [display, picker]);
    return wrapActField(inner, ctx);
  }

  function renderWeek(ctx) {
    const disabled = !!(ctx && ctx.disabled);
    const value = normalizeValue("week", ctx && ctx.value);
    const label = value ? ("v" + value.slice(-2)) : "--";

    const display = el("div", { class:"week-display", style:"width:100%;justify-content:flex-start;" }, [
      el("span", { text: label }, [])
    ]);

    const picker = el("input", { class:"act-date-picker", type:"date", value:"", disabled }, []);
    function openPicker() {
      if (disabled) return;
      try { if (picker.showPicker) picker.showPicker(); } catch (e) {}
      try { picker.focus(); picker.click(); } catch (e) {}
    }
    display.addEventListener("click", openPicker);

    picker.addEventListener("change", function () {
      const dt = parseDateYYYYMMDD(picker.value);
      const key = dt ? isoWeekKeyFromDate(dt) : "";
      display.querySelector("span").textContent = key ? ("v" + key.slice(-2)) : "--";
      if (ctx && typeof ctx.onChange === "function") ctx.onChange(key);
    });

    const inner = el("div", { class:"act-date-wrap", style:"width:100%;" }, [display, picker]);
    return wrapActField(inner, ctx);
  }

  function renderProduktkategori(ctx) {
    const disabled = !!(ctx && ctx.disabled);
    const value = normalizeValue("produktkategori", ctx && ctx.value);
    const allowed = [
      { v:"", label:"--" },
      { v:"matta", label:"Matta" },
      { v:"tapestry", label:"Tapestry" },
      { v:"colonnade", label:"Colonnade" },
      { v:"paketering", label:"Paketering" },
      { v:"soft ass", label:"Soft ass" },
    ];

    const sel = el("select", { class:"act-value-input", disabled }, []);
    allowed.forEach(o => {
      const opt = el("option", { value:o.v }, [o.label]);
      if (String(o.v) === String(value)) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", function () {
      const v = normalizeValue("produktkategori", sel.value);
      if (ctx && typeof ctx.onChange === "function") ctx.onChange(v);
    });

    return wrapActField(sel, ctx);
  }

  // VERSION 103: ToDo kategori dropdown (fixed list)
  
  // VERSION 109: Projekt kategori dropdown (fixed list)
  const PROJECT_CATEGORIES = ["kundprojekt","volymprojekt","samarbetsprojekt"];

  function renderProjektkategori(ctx) {
    const disabled = !!(ctx && ctx.disabled);
    const value = String(ctx && ctx.value != null ? ctx.value : "");
    const sel = el("select", {
      class:"input project-cat",
      style:"width:17ch;min-width:17ch;max-width:17ch;",
      disabled: disabled ? "disabled" : null
    }, [
      el("option", { value:"" }, ["Välj"]),
      ...PROJECT_CATEGORIES.map(v => el("option", { value:v }, [v]))
    ]);
    sel.value = value;
    sel.addEventListener("change", function(){
      if (ctx && typeof ctx.onChange === "function") ctx.onChange(sel.value);
    });
    sel.addEventListener("click", function(e){ e.stopPropagation(); });
    return wrapActField(sel, Object.assign({}, ctx || {}, { value }));
  }

const TODO_CATEGORIES = ["Allmänt","Info","Shopify-B2C","Shopify-B2B","Logistik","Privat"];

  function renderTodoKategori(ctx) {
    const disabled = !!(ctx && ctx.disabled);
    const value = String(ctx && ctx.value != null ? ctx.value : "");
    const sel = el("select", {
      class:"input todo-cat",
      style:"width:17ch;min-width:17ch;max-width:17ch;",
      disabled: disabled ? "disabled" : null
    }, [
      el("option", { value:"" }, [""]),
      ...TODO_CATEGORIES.map(v => el("option", { value:v }, [v]))
    ]);
    sel.value = value;
    sel.addEventListener("change", function(){
      if (ctx && typeof ctx.onChange === "function") ctx.onChange(sel.value);
    });
    sel.addEventListener("click", function(e){ e.stopPropagation(); });
    return wrapActField(sel, Object.assign({}, ctx || {}, { value }));
  }


  function renderEditor(ctx) {
    const base = normalizeBaseType(ctx && (ctx.baseType || ctx.type));
    const val = normalizeValue(base, ctx && ctx.value);
    const next = Object.assign({}, ctx || {}, { baseType: base, value: val });

    if (base === "date") return renderDate(next);
    if (base === "week") return renderWeek(next);
    if (base === "produktkategori") return renderProduktkategori(next);
    if (base === "projektkategori") return renderProjektkategori(next);
    if (base === "todokategori") return renderTodoKategori(next);
    // status base uses text-less field; the corner is the editor itself
    if (base === "status") return wrapActField(el("div", { class:"muted", text:"" }, []), next);
    return renderText(next);
  }

  const baseList = [
    { key:"text", label:"Text" },
    { key:"status", label:"Status" },
    { key:"date", label:"Datum" },
    { key:"week", label:"Vecka" },
    { key:"produktkategori", label:"Produktkategori" },
    { key:"todokategori", label:"ToDo-kategori" },
  ];

  const modList = [
    { key:"corner", label:"Hörnmarkör" },
    { key:"initials", label:"Initialer" },
    { key:"notes", label:"Notes" },
  ];

  App.FieldTypes = App.FieldTypes || {};
  App.FieldTypes.VERSION = VERSION;
  App.FieldTypes.normalizeBaseType = normalizeBaseType;
  App.FieldTypes.normalizeValue = normalizeValue;
  App.FieldTypes.isoWeekKeyFromDate = isoWeekKeyFromDate;

  App.FieldTypes.listBase = function () { return baseList.slice(); };
  App.FieldTypes.listMods = function () { return modList.slice(); };

  App.FieldTypes.renderEditor = function (ctx) { return renderEditor(ctx); };

})()
