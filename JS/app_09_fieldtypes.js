// [fieldtypes v120]
/* app_09_fieldtypes_10.js
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
    if (x0 === "kvartal" || x0 === "quarter" || x0 === "quarters") return "quarter";
    if (x0 === "dropdown_todo_kategori") return "dropdown_registry";
    if (x0 === "dropdown_dev_kategori") return "dropdown_registry";
    if (x0 === "dropdown_dev_syfte") return "dropdown_registry";
    if (x0 === "dropdown_product_kategori") return "dropdown_registry";
    if (x0 === "dropdown_project_kategori") return "dropdown_registry";
    if (x0 === "dropdown_registry") return "dropdown_registry";
    if (["text","status","date","week","quarter","produktkategori","dropdown_produktkategori","projektkategori","todokategori","dropdown_registry"].includes(x0)) return x0;
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
    if (t === "quarter") {
      const v = normStr(value).toUpperCase().replace(/\s+/g, "");
      return /^(Q[1-4]|[1-4])$/.test(v) ? (v.length === 1 ? ("Q" + v) : v) : "";
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

    // Only render when the field declares notes support
    const mods = ctx && ctx.mods ? ctx.mods : {};
    if (!mods || !mods.notes) return null;

    const has = !!ctx.notesHas;

    const btn = el("button", {
      class: "note-icon" + (has ? " is-notes" : ""),
      type:"button",
      style: has
        ? "width:20px;height:20px;border-radius:50%;background:transparent;border:2px solid #60a5fa;color:#0f172a;padding:0;font-size:12px;line-height:16px;display:inline-flex;align-items:center;justify-content:center;"
        : "width:20px;height:20px;border-radius:50%;background:transparent;border:1px solid rgba(15,23,42,.35);color:rgba(15,23,42,.55);padding:0;font-size:12px;line-height:18px;display:inline-flex;align-items:center;justify-content:center;"
    }, ["📝"]);

    btn.addEventListener("click", function (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (e2) {}
      ctx.onNotesClick(e);
    });

    return btn;
  }

  function renderRoutineBadge(ctx) {
    if (!ctx || typeof ctx.onRoutineClick !== 'function') return null;
    if (!ctx.routineHas) return null;

    const btn = el('button', {
      class: 'routine-badge',
      type:'button',
      title:'Öppna rutin',
      style:'width:22px;height:22px;border-radius:999px;background:#efe9ff;border:1px solid #c7b8ff;color:#4c2fd6;padding:0;font-size:11px;font-weight:900;display:inline-flex;align-items:center;justify-content:center;cursor:pointer;flex:0 0 auto;'
    }, ['R']);

    btn.addEventListener('click', function (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
      ctx.onRoutineClick(e);
    });

    return btn;
  }

  function renderPdfIcon(ctx) {
    if (!ctx || typeof ctx.onPdfClick !== "function") return null;
    const mods = ctx && ctx.mods ? ctx.mods : {};
    if (!mods || !mods.pdf) return null;

    const has = !!ctx.pdfHas;
    const btn = el("button", {
      class: "pdf-icon" + (has ? " has-file" : ""),
      type:"button",
      title: has ? "Öppna PDF" : "Ladda upp PDF",
      style: has
        ? "width:30px;height:22px;border-radius:8px;background:#dfe7ff;border:1px solid #98b1ff;color:#111;padding:0 6px;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;"
        : "width:30px;height:22px;border-radius:8px;background:#fff;border:1px solid rgba(15,23,42,.25);color:rgba(15,23,42,.7);padding:0 6px;font-size:11px;font-weight:800;display:inline-flex;align-items:center;justify-content:center;"
    }, ["PDF"]);

    btn.addEventListener("click", function (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (_) {}
      ctx.onPdfClick(e);
    });
    btn.addEventListener("contextmenu", function (e) {
      try {
        if (typeof ctx.onPdfUpload === "function") {
          e.preventDefault(); e.stopPropagation();
          ctx.onPdfUpload(e);
          return false;
        }
      } catch (_) {}
    });
    btn.addEventListener("mouseup", function (e) {
      try {
        var b = (e && e.button != null) ? e.button : (e ? e.which : null);
        if (b !== 2) return;
        if (typeof ctx.onPdfUpload === "function") {
          e.preventDefault(); e.stopPropagation();
          ctx.onPdfUpload(e);
          return false;
        }
      } catch (_) {}
    });

    return btn;
  }

  function renderInitialsRing(ctx) {
    if (!ctx || typeof ctx.onInitialsClick !== "function") return null;
    const v = normStr(ctx.initialsValue) || "--";
    const cls = "act-initials" + ((ctx.initialsNotesHas || ctx.notesHas) ? " is-notes" : "");
    const btn = el("button", { class: cls, type:"button" }, [v]);

    // Prefer shared helper to get consistent behavior:
    // - left click -> initials picker
    // - right click -> notes (context menu suppressed)
    try {
      const Helpers = (window.USP && window.USP.UI && window.USP.UI.Helpers) ? window.USP.UI.Helpers : null;
      if (Helpers && typeof Helpers.bindInitials === "function") {
        Helpers.bindInitials(btn, {
          mods: (ctx && ctx.mods) ? ctx.mods : { initials:true },
          onInitialsClick: function(){ try { ctx.onInitialsClick(); } catch (e) {} },
          onNotesClick: (typeof ctx.onNotesClick === "function") ? function(ev){ try { ctx.onNotesClick(ev); } catch (e) {} } : null
        });

        // Extra guards: some browsers/environments may not fire contextmenu reliably on buttons inside tables.
        // Support right-button down as well.
        function rc(ev){
          try {
            if (!ev) return;
            const b = (ev.button != null) ? ev.button : ev.which;
            if (b !== 2) return;
            if (typeof ctx.onNotesClick !== "function") return;
            ev.preventDefault(); ev.stopPropagation();
            ctx.onNotesClick(ev);
          } catch (_) {}
        }
        btn.addEventListener("pointerdown", rc);
        btn.addEventListener("mousedown", rc);
        return btn;
      }
    } catch (e) {}

    // Fallback (if helper missing): left click opens initials picker, right click opens notes (if available)
    btn.addEventListener("click", function (e) {
      e.preventDefault(); e.stopPropagation();
      ctx.onInitialsClick();
    });
    btn.addEventListener("contextmenu", function (e) {
      if (!ctx.onNotesClick) return;
      e.preventDefault(); e.stopPropagation();
      ctx.onNotesClick(e);
      return false;
    });
    btn.addEventListener("pointerdown", function(e){
      try { if (!e || e.button !== 2 || !ctx.onNotesClick) return; e.preventDefault(); e.stopPropagation(); ctx.onNotesClick(e); } catch (_) {}
    });
    btn.addEventListener("mousedown", function(e){
      try { if (!e || e.button !== 2 || !ctx.onNotesClick) return; e.preventDefault(); e.stopPropagation(); ctx.onNotesClick(e); } catch (_) {}
    });

    return btn;
  }

  function wrapActField(inner, ctx) {
    const base = normalizeBaseType(ctx && (ctx.baseType || ctx.type));
    const disabled = !!(ctx && ctx.disabled);

    // Corner applies if base=status OR ctx.onCornerChange exists
    const cornerEnabled = (base === "status") || (typeof (ctx && ctx.onCornerChange) === "function");
    const cornerVal = normalizeValue("status", ctx && ctx.cornerValue);
    let cornerState = cornerVal;

    const cls = ["act-field"];
    if (cornerVal) cls.push("status-" + cornerVal);

    const wrap = el("div", { class: cls.join(" ") }, []);

    if (cornerEnabled) {
      const cornerCls = "act-status-corner"; // use same round corner everywhere (Project-style)
      const cornerBtn = el("button", { class: cornerCls, type:"button", disabled }, []);
      cornerBtn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        if (disabled) return;

        const nx = nextCorner(cornerState);
        cornerState = nx;

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

    const routineBtn = renderRoutineBadge(ctx);
    if (routineBtn) wrap.appendChild(routineBtn);

    const pdfBtn = renderPdfIcon(ctx);
    if (pdfBtn) wrap.appendChild(pdfBtn);

    // Notes icon whenever notes support exists for the field
    const notesBtn = renderNotesIcon(ctx);
    if (notesBtn) wrap.appendChild(notesBtn);

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

    function commit() {
      if (disabled) return;
      if (ctx && typeof ctx.onChange === "function") ctx.onChange(input.value);
    }

    // Commit on blur/enter only (avoids rerender loops that can truncate to 1 char)
    input.addEventListener("blur", function () { commit(); });
    input.addEventListener("keydown", function (e) {
      if (disabled) return;
      if (e.key === "Enter") { e.preventDefault(); try { input.blur(); } catch(_) {} commit(); }
    });

    return wrapActField(input, ctx);
  }

  function renderDate(ctx) {
    const disabled = !!(ctx && ctx.disabled);
    const value = normalizeValue("date", ctx && ctx.value);

    const display = el("div", { class:"act-date-display", text: value || "-- -- --", style:"width:15ch;min-width:15ch;max-width:15ch;font-size:0.85em;text-align:center;" }, []);
    const picker = el("input", { class:"act-date-picker", type:"date", value, disabled, style:"width:15ch;min-width:15ch;max-width:15ch;font-size:0.85em;text-align:center;" }, []);

    const isOverdue = !!((ctx && ctx.overdue) || (ctx && ctx.mods && ctx.mods.overdue));
    if (isOverdue) {
      // Only show overdue border when a valid date exists and it is before today.
      let overdueNow = false;
      try{
        const v = String(value || "").trim();
        if (v) {
          const d = new Date(v + "T00:00:00");
          const today = new Date();
          today.setHours(0,0,0,0);
          if (!isNaN(d.getTime()) && d.getTime() < today.getTime()) overdueNow = true;
        }
      }catch(e){}
      const border = overdueNow ? "3px solid red" : "";
      try { display.style.border = border; } catch(e) {}
      try { picker.style.border = border; } catch(e) {}
    }

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


  function quarterFromDate(dtUtc) {
    try {
      const m = dtUtc.getUTCMonth() + 1;
      if (m <= 3) return "Q1";
      if (m <= 6) return "Q2";
      if (m <= 9) return "Q3";
      return "Q4";
    } catch (e) { return ""; }
  }

  function renderQuarter(ctx) {
    const disabled = !!(ctx && ctx.disabled);
    const value = normalizeValue("quarter", ctx && ctx.value);
    const label = value || "–";

    const display = el("div", { class:"quarter-display", style:"width:100%;justify-content:flex-start;" }, [
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
      const q = dt ? quarterFromDate(dt) : "";
      display.querySelector("span").textContent = q || "–";
      if (ctx && typeof ctx.onChange === "function") ctx.onChange(q);
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
  const PROJECT_CATEGORIES = getRegistryValues("projektkategori", ["kundprojekt","volymprojekt","samarbetsprojekt"]);

  // Produktkategori från register (state.settings)
  
  function getRegistryValues(name, fallbackArr) {
    try {
      const cfg = (App && App.Config) ? App.Config : null;
      const a =
        (cfg && cfg.registers && Array.isArray(cfg.registers[name])) ? cfg.registers[name] :
        (cfg && cfg.DEFAULT_REGISTRIES && Array.isArray(cfg.DEFAULT_REGISTRIES[name])) ? cfg.DEFAULT_REGISTRIES[name] :
        null;
      if (a && a.length) return a.map(x => String(x)).filter(Boolean);
    } catch (e) {}
    if (Array.isArray(fallbackArr) && fallbackArr.length) return fallbackArr.map(x => String(x)).filter(Boolean);
    return [];
  }

function getProduktkategoriRegisterValues() {
    // Prefer App.Config registries
    const fromCfg = getRegistryValues("produktkategori", null);
    if (fromCfg && fromCfg.length) return fromCfg;
try {
      const st = (App && typeof App.getState === "function") ? App.getState() : null;
      const s = st && st.settings ? st.settings : null;
      // allow several possible shapes
      const a =
        (s && Array.isArray(s.produktkategori)) ? s.produktkategori :
        (s && Array.isArray(s.productCategories)) ? s.productCategories :
        (s && s.registries && Array.isArray(s.registries.produktkategori)) ? s.registries.produktkategori :
        null;
      if (a && a.length) return a.map(x => String(x)).filter(Boolean);
    } catch (e) {}
    // fallback: use the hardcoded list from renderProduktkategori
    return ["Matta","Tapestry","Colonnade","Paketering","Soft ass"];
  }

  function renderDropdownProduktkategori(ctx) {
    const disabled = !!(ctx && ctx.disabled);
    const value = normalizeValue("dropdown_produktkategori", ctx && ctx.value);
    const values = getProduktkategoriRegisterValues();
    const allowed = [{ v:"", label:"--" }].concat(values.map(v => ({ v, label:v })));

    const sel = el("select", { class:"act-value-input", disabled }, []);
    allowed.forEach(o => {
      const opt = el("option", { value:o.v }, [o.label]);
      if (String(o.v) === String(value)) opt.selected = true;
      sel.appendChild(opt);
    });
    sel.addEventListener("change", () => {
      if (typeof ctx.onChange === "function") ctx.onChange(sel.value);
    });
    const inner = el("div", { class:"act-field" }, [sel]);
    return wrapActField(inner, ctx);
  }


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

    // Prevent table-level click handlers from hijacking dropdown interaction
    sel.addEventListener("click", function(e){ try{ e.stopPropagation(); }catch(_){} });
    sel.addEventListener("pointerdown", function(e){ try{ e.stopPropagation(); }catch(_){} });
    sel.addEventListener("click", function(e){ e.stopPropagation(); });
    return wrapActField(sel, Object.assign({}, ctx || {}, { value }));
  }

  // ToDo kategori dropdown (fixed list)
  // NOTE: hard-coded to match DEV behavior (no registry dependency)
  const TODO_CATEGORIES = ["Allmänt","Info","Kontor","Shopify B2C","Shopify B2B","Logistik","Privat"];

// Dev kategori dropdown (fixed list)
  const DEV_CATEGORIES = getRegistryValues("dropdown_dev_kategori", ["matta","colonnade","tapestry","Softass","design"]);

  // Dev syfte dropdown (fixed list)
  const DEV_SYFTE = ["kund","samarbete","design"];

  // Project kategori dropdown (fixed list)
    // Project kategori dropdown (fixed list)
  // NOTE: hard-coded to match DEV behavior (no registry dependency)
  const PROJECT_KATEGORIES = ["kund","samarbete","volym","utveckling"];

// Product kategori dropdown (defaults to ToDo categories unless overridden)
    // Product categories base list (from config registry `produktkategori`)
  const PRODUCT_CATEGORIES = getRegistryValues("produktkategori", ["matta","tapestry","colonnade","softass","paketering"]);

const PRODUCT_KATEGORIES_DROPDOWN = getRegistryValues("dropdown_product_kategori", (typeof PRODUCT_CATEGORIES !== "undefined" ? PRODUCT_CATEGORIES.slice() : []));

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


function renderDropdownRegistry(ctx) {
  const disabled = !!(ctx && ctx.disabled);
  const value = String(ctx && ctx.value != null ? ctx.value : "");
  const reg = String((ctx && (ctx.registry || ctx.reg)) || "");
  let items = [];
  try {
    if (reg && App && App.Config && typeof App.Config.getRegistry === "function") {
      items = App.Config.getRegistry(reg) || [];
    }
  } catch (e) {}
  
  // Hard override for known registries that we want to behave exactly like DEV (local list)
  // This avoids issues where registry/state/config differs between tabs.
  if (reg === "dropdown_todo_kategori") items = TODO_CATEGORIES.slice();
  if (reg === "dropdown_project_kategori") items = PROJECT_KATEGORIES.slice();
  if (reg === "dropdown_dev_syfte") items = DEV_SYFTE.slice();

if (!Array.isArray(items) || items.length === 0) {
    // Fallbacks for known registries
    if (reg === "todokategori") items = TODO_CATEGORIES.slice();
    if (reg === "dropdown_todo_kategori") items = TODO_CATEGORIES.slice();
    if (reg === "produktkategori") items = PRODUCT_CATEGORIES.slice();
    if (reg === "dropdown_dev_kategori") items = DEV_CATEGORIES.slice();
    if (reg === "dropdown_dev_syfte") items = DEV_SYFTE.slice();
    if (reg === "dropdown_project_kategori") items = PROJECT_KATEGORIES.slice();
    if (reg === "dropdown_product_kategori") items = PRODUCT_KATEGORIES_DROPDOWN.slice();
  }

  const sel = el("select", {
    class: "input dropdown-registry",
    style: (ctx && ctx.style) ? ctx.style : "width:17ch;min-width:17ch;max-width:17ch;",
    disabled: disabled ? "disabled" : null
  }, [
    el("option", { value: "" }, [""]),
    ...(items || []).map(v => el("option", { value: v }, [v]))
  ]);

  sel.value = value;

  // Prevent table-level click handlers from hijacking dropdown interaction
  sel.addEventListener("pointerdown", function(e){ try{ e.stopPropagation(); }catch(_){} }, true);
  sel.addEventListener("mousedown", function(e){ try{ e.stopPropagation(); }catch(_){} }, true);
  sel.addEventListener("touchstart", function(e){ try{ e.stopPropagation(); }catch(_){} }, true);
  sel.addEventListener("click", function(e){ try{ e.stopPropagation(); }catch(_){} }, true);

  // Also stop in bubble phase for good measure
  sel.addEventListener("pointerdown", function(e){ try{ e.stopPropagation(); }catch(_){} });
  sel.addEventListener("mousedown", function(e){ try{ e.stopPropagation(); }catch(_){} });
  sel.addEventListener("touchstart", function(e){ try{ e.stopPropagation(); }catch(_){} });
  sel.addEventListener("click", function(e){ try{ e.stopPropagation(); }catch(_){} });
  sel.addEventListener("change", function(){
    if (ctx && typeof ctx.onChange === "function") ctx.onChange(sel.value);
  });
  sel.addEventListener("click", function(e){ e.stopPropagation(); });

  // Ensure right-click initials/notes binder sees the field wrapper
  return wrapActField(sel, Object.assign({}, ctx || {}, { value }));
}
  function renderEditor(ctx) {
    const base = normalizeBaseType(ctx && (ctx.baseType || ctx.type));
    const val = normalizeValue(base, ctx && ctx.value);
    const next = Object.assign({}, ctx || {}, { baseType: base, value: val });

    if (base === "date") return renderDate(next);
    if (base === "week") return renderWeek(next);
    if (base === "quarter") return renderQuarter(next);
    
if (base === "dropdown_registry") {
  // If a specific dropdown_* key was used as the field type, pass it through as registry id
  const t0 = normStr(ctx && (ctx.type || ctx.baseType)).toLowerCase();
  if (t0.startsWith("dropdown_")) next.registry = t0;
  return renderDropdownRegistry(next);
}
    if (base === "produktkategori") return renderProduktkategori(next);
    if (base === "dropdown_produktkategori") return renderDropdownProduktkategori(next);
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
    { key:"quarter", label:"Kvartal" },
    { key:"produktkategori", label:"Produktkategori (fast lista)" },
    { key:"dropdown_produktkategori", label:"Produktkategori (register)" },
    { key:"todokategori", label:"ToDo-kategori (fast lista)" },
    { key:"dropdown_registry", label:"Dropdown (register)" },
    { key:"dropdown_todo_kategori", label:"ToDo-kategori (register)" },
  ];

  const modList = [
    { key:"corner", label:"Hörnmarkör" },
    { key:"initials", label:"Initialer" },
    { key:"notes", label:"Notes" },
    { key:"pdf", label:"PDF" },
  ];

  App.FieldTypes = App.FieldTypes || {};
  App.FieldTypes.VERSION = VERSION;
  App.FieldTypes.normalizeBaseType = normalizeBaseType;
  App.FieldTypes.normalizeValue = normalizeValue;
  App.FieldTypes.isoWeekKeyFromDate = isoWeekKeyFromDate;

  App.FieldTypes.list = function () { return baseList.slice(); };

  App.FieldTypes.listBase = function () { return baseList.slice(); };
  App.FieldTypes.listMods = function () { return modList.slice(); };

  App.FieldTypes.renderEditor = function (ctx) { return renderEditor(ctx); };

})()
