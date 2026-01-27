/**
 * Design Spec (PO + Dispatch)
 * Spec highlights implemented:
 * - Login by name (roles: user/admin/manufacturer/forwarder) + logout
 * - Purchase Orders:
 *   - Columns: checkbox, expand, PO, Type, External, Qty, Delivery, Date, Shipping Address, Incoterms, Actions
 *   - Delivery set at PO creation (Air/Boat)
 *   - Actions:
 *       - If Type=stock -> InStock (enabled only when ERD fulfilled)
 *       - Else -> Dispatch (moves PO to Archive + next Dispatch date)
 *       - Admin sees NewPO + New Row
 * - Variants (expanded):
 *   - Columns: Name, SKU, Category, Balance, Amount, ERD, Notes (PDF icon), Actions (… -> Delete)
 *   - ERD: date picker; turns red if changed after first time set
 *   - Notes: PDF icon filled if attached; empty if not. Always clickable to upload/replace a PDF.
 * - Dispatch:
 *   - Rows with fixed dates: 15th for next 4 months (plus manually added)
 *   - Columns: Date, Content, Action
 *   - Expandable only if content exists
 *   - Action: To Forwarder (marks row visible to forwarder) + Done (enabled only if all tracking filled)
 *   - Expanded content columns: checkbox, PO, Delivery, External, Qty, Date, Shipping Address, Incoterms, Tracking
 */

'use strict';

const USERS = [
  { name: "Abbas", role: "manufacturer" },
  { name: "Mohit", role: "forwarder" },

  // Roles per request
  { name: "Dick", role: "admin" },
  { name: "David", role: "buyer" },   // inköpare
  { name: "Jacob", role: "sales" }   // säljare
];

const CATEGORY_VALUES = ["Rug", "Colonnade", "Tapestry", "Covers"];
const DELIVERY_VALUES = ["Air", "Boat"];

const TRANSFER_ADDRESS =
  "Partnerlogistik\ninfo@partnerlogistik.se\nÖsterängsgatan 6\n521 39 Falköping";
const WAREHOUSE_BHADOHI_ADDRESS =
  "Warehouse Bhadohi";

const PRODUCT_DB = [
  { name: "Snowflakex150x150", sku: "Snowflakex150x150", category: "Rug" },
  { name: "no.010x180x240", sku: "no010x180x240", category: "Rug" },
  { name: "no.01x120x180", sku: "no01x120x180", category: "Rug" },
  { name: "no.01x85x120", sku: "no01x85x120", category: "Rug" },
  { name: "no.02x180x240", sku: "no02x180x240", category: "Rug" },
  { name: "no.02x220x280", sku: "no02x220x280", category: "Rug" },
  { name: "no.02x280x360", sku: "no02x280x360", category: "Rug" },
  { name: "no.03x180x240", sku: "no03x180x240", category: "Rug" },
  { name: "no.03x230x280", sku: "no03x230x280", category: "Rug" },
  { name: "no.03x290x350", sku: "no03x290x350", category: "Rug" },
  { name: "no.04x180x240", sku: "no04x180x240", category: "Rug" },
  { name: "no.04x220x280", sku: "no04x220x280", category: "Rug" },
  { name: "no.04x280x360", sku: "no04x280x360", category: "Rug" },
  { name: "no.05x180x240", sku: "no05x180x240", category: "Rug" },
  { name: "no.05x230x280", sku: "no05x230x280", category: "Rug" },
  { name: "no.05x290x350", sku: "no05x290x350", category: "Rug" },
  { name: "no.06x120x180", sku: "no06x120x180", category: "Rug" },
  { name: "no.06x85x120", sku: "no06x85x120", category: "Rug" },
  { name: "no.07x180x240", sku: "no07x180x240", category: "Rug" },
  { name: "no.07x230x280", sku: "no07x230x280", category: "Rug" },
  { name: "no.07x290x350", sku: "no07x290x350", category: "Rug" },
  { name: "no.08x220x260", sku: "no08x220x260", category: "Rug" },
  { name: "no.08x290x350", sku: "no08x290x350", category: "Rug" },
  { name: "no.09x220x260", sku: "no09x220x260", category: "Rug" },
  { name: "no.09x290x350", sku: "no09x290x350", category: "Rug" },
  { name: "no.10x230x280", sku: "no10x230x280", category: "Rug" },
  { name: "no.10x290x350", sku: "no10x290x350", category: "Rug" },
  { name: "no.11x200x260", sku: "no11x200x260", category: "Rug" },
  { name: "no.11x240x320", sku: "no11x240x320", category: "Rug" },
  { name: "no.12x200x260", sku: "no12x200x260", category: "Rug" },
  { name: "no.12x240x320", sku: "no12x240x320", category: "Rug" },
  { name: "no.13x230x280", sku: "no13x230x280", category: "Rug" },
  { name: "no.13x290x350", sku: "no13x290x350", category: "Rug" },
  { name: "no.14x220x280", sku: "no14x220x280", category: "Rug" },
  { name: "no.15x230x280", sku: "no15x230x280", category: "Rug" },
  { name: "no.16x230x280", sku: "no16x230x280", category: "Rug" },
  { name: "no.17x230x280", sku: "no17x230x280", category: "Rug" },
  { name: "no.18x230x280", sku: "no18x230x280", category: "Rug" },
  { name: "no.20x230x280", sku: "no20x230x280", category: "Rug" },
  { name: "no.20x290x350", sku: "no20x290x350", category: "Rug" },
  { name: "no.21x230x280", sku: "no21x230x280", category: "Rug" },
  { name: "no.21x290x350", sku: "no21x290x350", category: "Rug" },
  { name: "no.22x230x280", sku: "no22x230x280", category: "Rug" },
  { name: "no.22x290x350", sku: "no22x290x350", category: "Rug" },
  { name: "no.23x230x280", sku: "no23x230x280", category: "Rug" },
  { name: "no.23x290x350", sku: "no23x290x350", category: "Rug" },
  { name: "no.24x230x280", sku: "no24x230x280", category: "Rug" },
  { name: "no.24x290x350", sku: "no24x290x350", category: "Rug" },
  { name: "no.25x230x280", sku: "no25x230x280", category: "Rug" },
  { name: "no.25x290x350", sku: "no25x290x350", category: "Rug" },
  { name: "cno.01x100x240", sku: "cno01x100x240", category: "Colonnade" },
  { name: "cno.02x100x240", sku: "cno02x100x240", category: "Colonnade" },
  { name: "cno.03x100x240", sku: "cno03x100x240", category: "Colonnade" },
  { name: "cno.04x100x240", sku: "cno04x100x240", category: "Colonnade" },
  { name: "cno.05x100x240", sku: "cno05x100x240", category: "Colonnade" },
  { name: "cno.06x100x240", sku: "cno06x100x240", category: "Colonnade" },
  { name: "cno.07x100x240", sku: "cno07x100x240", category: "Colonnade" },
  { name: "cno.08x85x240", sku: "cno08x85x240", category: "Colonnade" },
  { name: "cno.09x85x240", sku: "cno09x85x240", category: "Colonnade" },
  { name: "tno.01x120x140", sku: "tno01x120x140", category: "Tapestry" },
  { name: "tno.02x70x70", sku: "tno02x70x70", category: "Tapestry" },
  { name: "tno.03x120x120", sku: "tno03x120x120", category: "Tapestry" },
  { name: "tno.04x85x95", sku: "tno04x85x95", category: "Tapestry" },
  { name: "tno.05x80x100", sku: "tno05x80x100", category: "Tapestry" },
  { name: "cov.01x150x230", sku: "cov01x150x230", category: "Covers" },
  { name: "cov.02x150x240", sku: "cov02x150x240", category: "Covers" },
];

// Manufacturer-specific product databases.
// - Anisa: full product DB (existing/default data)
// - IERA: only Tapestry products
const PRODUCT_DB_BY_MANUFACTURER = {
  Anisa: PRODUCT_DB,
  IERA: PRODUCT_DB.filter(p => p.category === "Tapestry")

};

function activeManufacturer() {
  const m = String(state?.settings?.manufacturer || "").trim();
  const list = Array.isArray(state?.settings?.manufacturers) ? state.settings.manufacturers : ["Anisa", "IERA"];
  if (m && list.includes(m)) return m;
  return list[0] || "Anisa";
}

function productDbForActiveManufacturer() {
  const m = activeManufacturer();
  return PRODUCT_DB_BY_MANUFACTURER[m] || PRODUCT_DB;
}
function poMatchesActiveManufacturer(po) {
  const m = activeManufacturer();
  const pm = String(po?.manufacturer || "Anisa");
  return pm === m;
}


function filterPosByActiveManufacturer(list) {
  return (Array.isArray(list) ? list : []).filter(poMatchesActiveManufacturer);
}


function ensureManufacturerOnExistingPos() {
  const mfg = activeManufacturer();
  (state.purchaseOrders || []).forEach(po => { if (!po.manufacturer) po.manufacturer = "Anisa"; });
  (state.archive || []).forEach(po => { if (!po.manufacturer) po.manufacturer = "Anisa"; });
  (state.dispatchRows || []).forEach(r => (r.pos || []).forEach(po => { if (!po.manufacturer) po.manufacturer = "Anisa"; }));
  (state.dispatchArchiveRows || []).forEach(r => (r.pos || []).forEach(po => { if (!po.manufacturer) po.manufacturer = "Anisa"; }));
}


const state = {
  // Split into logical buckets, but keep backwards-compatible top-level fields via accessors.
  ui: {
    activeTab: "purchaseorders",
    poView: "list",
    modal: { open: false, kind: null, data: {} },

    crmCoop: {
      filters: { region: "all", country: "all", town: "all", responsible: "all" }
    },

    expandedPoId: null,
    expandedArchivePoId: null,
    expandedDispatchId: null,
    expandedDispatchPoKey: null,

    dispatchView: "active", // active | archive
    openMenuKey: null,

    selectedPoIds: new Set(),
    selectedDispatchPoKeys: new Set() // `${dispatchRowId}|${idx}`
  },

  data: {
    purchaseOrders: [],
    archive: [],
    dispatchRows: [],
    dispatchArchiveRows: []
  },

  // Domain-ish settings
  settings: { manufacturers: ["Anisa", "IERA"], manufacturer: "Anisa" },

  // Analytical PO (admin) — kept at top-level for now (mixed UI/data), but still grouped.
  analytical: {
    filter: "selected",       // rugs | colonnade | tapestry | covers | selected
    mode: "prod_to_local",    // prod_to_local | transfer_aircargo | transfer_boat
    rows: []                      // legacy/placeholder
  },

  // Session
  session: { user: null }
};

function defineStateAlias(key, getFn, setFn) {
  Object.defineProperty(state, key, {
    configurable: true,
    enumerable: true,
    get: getFn,
    set: setFn
  });
}

defineStateAlias('activeTab', () => state.ui.activeTab, v => { state.ui.activeTab = v; });
defineStateAlias('poView', () => state.ui.poView, v => { state.ui.poView = v; });
defineStateAlias('modal', () => state.ui.modal, v => { state.ui.modal = v; });
defineStateAlias('expandedPoId', () => state.ui.expandedPoId, v => { state.ui.expandedPoId = v; });
defineStateAlias('expandedArchivePoId', () => state.ui.expandedArchivePoId, v => { state.ui.expandedArchivePoId = v; });
defineStateAlias('expandedDispatchId', () => state.ui.expandedDispatchId, v => { state.ui.expandedDispatchId = v; });
defineStateAlias('dispatchView', () => state.ui.dispatchView, v => { state.ui.dispatchView = v; });
defineStateAlias('openMenuKey', () => state.ui.openMenuKey, v => { state.ui.openMenuKey = v; });
defineStateAlias('selectedPoIds', () => state.ui.selectedPoIds, v => { state.ui.selectedPoIds = v; });
defineStateAlias('selectedDispatchPoKeys', () => state.ui.selectedDispatchPoKeys, v => { state.ui.selectedDispatchPoKeys = v; });

defineStateAlias('purchaseOrders', () => state.data.purchaseOrders, v => { state.data.purchaseOrders = v; });
defineStateAlias('archive', () => state.data.archive, v => { state.data.archive = v; });
defineStateAlias('dispatchRows', () => state.data.dispatchRows, v => { state.data.dispatchRows = v; });
defineStateAlias('dispatchArchiveRows', () => state.data.dispatchArchiveRows, v => { state.data.dispatchArchiveRows = v; });



/* =========================
   Helpers
========================= */
function normalize(s) { return String(s || "").trim().toLowerCase(); }

const DOM = {
  qs(sel, root = document) { return root.querySelector(sel); },
  qsa(sel, root = document) { return Array.from(root.querySelectorAll(sel)); },
  clear(node) { if (node) node.innerHTML = ""; },
  el(tag, props = {}, children = []) {
    const n = document.createElement(tag);
    Object.entries(props || {}).forEach(([k, v]) => {
      if (v === undefined || v === null) return;
      if (k === "class") n.className = String(v);
      else if (k === "dataset") Object.entries(v).forEach(([dk, dv]) => { n.dataset[dk] = String(dv); });
      else if (k === "style") Object.assign(n.style, v);
      else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
      else if (k in n) n[k] = v;
      else n.setAttribute(k, String(v));
    });
    (Array.isArray(children) ? children : [children]).forEach(ch => {
      if (ch === undefined || ch === null) return;
      if (typeof ch === "string") n.appendChild(document.createTextNode(ch));
      else n.appendChild(ch);
    });
    return n;
  },
  btn(label, onClick, className = "btn btn-secondary") {
    return DOM.el("button", { type: "button", class: className, onclick: onClick }, [label]);
  }
};

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function multilineToHtml(text) {
  return escapeHtml(text ?? "").replaceAll("\n", "<br>");
}

function todayYYYYMMDD() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfToday() {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
}

function parseDateYYYYMMDD(s) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 0, 0, 0, 0);
}

function toYYYYMMDD(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function addMonths(date, months) {
  const d = new Date(date.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) d.setDate(0);
  return d;
}

function isAdmin() { return ["admin","buyer"].includes(state.session.user?.role); }
function isManufacturer() { return state.session.user?.role === "manufacturer"; }
function isForwarder() { return state.session.user?.role === "forwarder"; }
function canSeeNewPoNewRow() { return isAdmin(); }
function canDispatchPO() { return isAdmin() || isManufacturer(); }

/* =========================
   Session (localStorage)
========================= */
function setSessionUser(user) {
  state.session.user = user;
  try { localStorage.setItem("ds_user", JSON.stringify(user)); } catch {}
}
function clearSession() {
  state.session.user = null;
  try { localStorage.removeItem("ds_user"); } catch {}
}
function loadSession() {
  try {
    const raw = localStorage.getItem("ds_user");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.name && parsed?.role) state.session.user = parsed;
  } catch {}
}
/* =========================
   Analytical SKU DB (localStorage)
   - Persists per-SKU stock/sales so it does NOT re-randomize on each login
   - Keys:
     stock1 = Lager Bhadohi (1–10)
     stock2 = Lager Falköping (2–15)
     sales3 = Sales 3 månader (2–10)
========================= */
const STORAGE_KEY_ANALYTICAL_SKU_DB = "ds_analytical_sku_db";

function randInt(min, max) {
  const a = Number(min), b = Number(max);
  const lo = Math.min(a, b), hi = Math.max(a, b);
  return lo + Math.floor(Math.random() * (hi - lo + 1));
}

function loadAnalyticalSkuDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ANALYTICAL_SKU_DB);
    const parsed = raw ? JSON.parse(raw) : {};
    const obj = (parsed && typeof parsed === "object") ? parsed : {};
    const out = {};
    Object.keys(obj).forEach((sku) => {
      const rec = obj[sku] || {};
      const stock1 = Number(rec.stock1);
      const stock2 = Number(rec.stock2);
      const sales3 = Number(rec.sales3);
      out[sku] = {
        stock1: Number.isFinite(stock1) ? stock1 : randInt(1, 10),
        stock2: Number.isFinite(stock2) ? stock2 : randInt(2, 15),
        sales3: Number.isFinite(sales3) ? sales3 : randInt(2, 10),
        inProduction: Number.isFinite(Number(rec.inProduction)) ? Number(rec.inProduction) : 0,
        incoming: Number.isFinite(Number(rec.incoming)) ? Number(rec.incoming) : 0,
        amount: 0
      };
    });
    return out;
  } catch {
    return {};
  }
}

function saveAnalyticalSkuDb(map) {
  try {
    const srcMap = (map && typeof map === "object") ? map : {};
    const persist = {};
    Object.keys(srcMap).forEach((sku) => {
      const rec = srcMap[sku] || {};
      persist[sku] = {
  stock1: Number(rec.stock1) || 0,
  stock2: Number(rec.stock2) || 0,
  sales3: Number(rec.sales3) || 0,
  inProduction: Number(rec.inProduction) || 0,
  incoming: Number(rec.incoming) || 0
};
    });
    localStorage.setItem(STORAGE_KEY_ANALYTICAL_SKU_DB, JSON.stringify(persist));
  } catch {}
}

loadSession();

/* =========================
   Data helpers
========================= */
function poQty(po) {
  return (po.variants || []).reduce((sum, v) => {
    const n = Number(v.amount);
    return sum + (Number.isFinite(n) ? n : 0);
  }, 0);
}


function poErdValue(po) {
  const vars = Array.isArray(po?.variants) ? po.variants : [];
  if (vars.length === 0) return { kind: "none", value: "none", date: null };
  // none if ANY ERD missing/invalid
  let maxDate = null;
  let maxStr = "";
  for (const v of vars) {
    const s = String(v?.erd || "").trim();
    const d = parseDateYYYYMMDD(s);
    if (!d) return { kind: "none", value: "none", date: null };
    if (!maxDate || d.getTime() > maxDate.getTime()) {
      maxDate = d;
      maxStr = s;
    }
  }
  return { kind: "date", value: maxStr || "none", date: maxDate };
}

function comparePoByErd(a, b) {
  const ea = poErdValue(a);
  const eb = poErdValue(b);
  if (ea.kind !== eb.kind) {
    // Put "none" first so buyers can quickly see incomplete ERDs
    return ea.kind === "none" ? -1 : 1;
  }
  if (ea.kind === "none") return 0;
  // Both dates: newest first
  return eb.date.getTime() - ea.date.getTime();
}

// Sum ordered amount for a SKU across all OPEN POs (i.e., the ones currently in Purchase Orders).
// Used by Analytical PO as the 'InProduction' indicator.
function inProductionForSku(sku) {
  const key = String(sku || '').trim();
  if (!key) return 0;
  const rec = (state.analytical && state.analytical.bySku && state.analytical.bySku[key]) ? state.analytical.bySku[key] : null;
  return rec ? (Number(rec.inProduction) || 0) : 0;
}

// Sum 'incoming' for a SKU:
// - All OPEN POs in Purchase Orders where type is transfer_aircargo or transfer_boat
// - All POs currently in Dispatch rows (any type)
function incomingForSku(sku) {
  const key = String(sku || '').trim();
  if (!key) return 0;
  const rec = (state.analytical && state.analytical.bySku && state.analytical.bySku[key]) ? state.analytical.bySku[key] : null;
  return rec ? (Number(rec.incoming) || 0) : 0;
}



function nextPoNumber() {
  let max = 1000;
  const all = [...state.purchaseOrders, ...state.archive];
  for (const po of all) {
    const m = /^PO-(\d+)$/.exec(po.po || "");
    if (m) max = Math.max(max, Number(m[1]));
  }
  return `PO-${max + 1}`;
}

function erdFulfilled(po) {
  const today = startOfToday().getTime();
  if (!po.variants || po.variants.length === 0) return false;
  return po.variants.every(v => {
    const d = parseDateYYYYMMDD(v.erd);
    return d && d.getTime() <= today;
  });
}

/* =========================
   Seed demo data
========================= */
function seedIfEmpty() {
  if (state.purchaseOrders.length > 0 || state.dispatchRows.length > 0) return;

  state.purchaseOrders = [];

  seedDispatchRowsIfEmpty();
}
seedIfEmpty();

/* =========================
   Dispatch rows (fixed dates)
========================= */
function seedDispatchRowsIfEmpty() {
  if (state.dispatchRows.length > 0) return;

  const base = startOfToday();
  const dates = [];
  for (let i = 1; i <= 4; i++) {
    const d = addMonths(base, i);
    const fifteenth = new Date(d.getFullYear(), d.getMonth(), 15, 0, 0, 0, 0);
    dates.push(toYYYYMMDD(fifteenth));
  }

  state.dispatchRows = dates.map(dt => ({
    id: `disp-${dt}`,
    date: dt,
    toForwarderSent: false,
    pos: []
  }));

  sortDispatchRows();
}

function sortDispatchRows() {
  state.dispatchRows.sort((a, b) => {
    const da = parseDateYYYYMMDD(a.date)?.getTime() ?? 0;
    const db = parseDateYYYYMMDD(b.date)?.getTime() ?? 0;
    return da - db;
  });
}

function nearestUpcomingDispatchRow() {
  const now = startOfToday().getTime();
  sortDispatchRows();
  const upcoming = state.dispatchRows.find(r => (parseDateYYYYMMDD(r.date)?.getTime() ?? 0) >= now);
  if (upcoming) return upcoming;

  const next = addMonths(startOfToday(), 1);
  const fifteenth = new Date(next.getFullYear(), next.getMonth(), 15, 0, 0, 0, 0);
  const dt = toYYYYMMDD(fifteenth);

  const row = { id: `disp-${dt}`, date: dt, toForwarderSent: false, pos: [] };
  state.dispatchRows.push(row);
  sortDispatchRows();
  return row;
}

/* =========================
   Menu helpers
========================= */
function closeMenus() {
  state.openMenuKey = null;
}

document.addEventListener("click", () => {
  if (state.openMenuKey !== null) {
    closeMenus();
    render();
  }
});

/* =========================
   UI: topbar + tabs
========================= */
function ensureTabs() {
  const tabs = document.querySelector(".tabs");
  if (!tabs) return;

  const role = state.session.user?.role || "";
  const isAdminUser = role === "admin";
  const isBuyerUser = role === "buyer";
  const isSalesUser = role === "sales";

  // Role-based allowed tabs (top tabs)
  const ALLOWED = {
    admin: null, // all
    buyer: new Set(["purchaseorders", "dispatch", "analytical-po"]),
    sales: new Set(["crm", "crm-coop"])
  };

  // Ensure Analytical PO tab exists for admin + buyer
  const analyticalSel = '.tab[data-tab="analytical-po"]';
  const existingAnalytical = tabs.querySelector(analyticalSel);
  if ((isAdminUser || isBuyerUser) && !existingAnalytical) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.dataset.tab = "analytical-po";
    btn.textContent = "Analytical PO";

    // Place Analytical PO after Inventory if possible, else append.
    const inventoryBtn = tabs.querySelector('.tab[data-tab="inventory"]');
    const dispatchBtn = tabs.querySelector('.tab[data-tab="dispatch"]');
    if (inventoryBtn && inventoryBtn.nextSibling) tabs.insertBefore(btn, inventoryBtn.nextSibling);
    else if (dispatchBtn && dispatchBtn.nextSibling) tabs.insertBefore(btn, dispatchBtn.nextSibling);
    else tabs.appendChild(btn);
  }
  if (!(isAdminUser || isBuyerUser) && existingAnalytical) {
    if (state.activeTab === "analytical-po") state.activeTab = isSalesUser ? "crm" : "purchaseorders";
    existingAnalytical.remove();
  }

  // Ensure CRM tab exists for admin + sales (CRM Contracts)
  const crmSel = '.tab[data-tab="crm"]';
  const existingCrm = tabs.querySelector(crmSel);
  if ((isAdminUser || isSalesUser) && !existingCrm) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.dataset.tab = "crm";
    btn.textContent = "CRM Contracts";
    tabs.appendChild(btn);
  }
  // If CRM tab exists (from HTML), ensure label is correct
  const crmNow = tabs.querySelector(crmSel);
  if (crmNow) crmNow.textContent = "CRM Contracts";

  // Ensure Form design exists ONLY for admin
  const formSel = '.tab[data-tab="form-design"]';
  const existingForm = tabs.querySelector(formSel);
  if (isAdminUser && !existingForm) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.dataset.tab = "form-design";
    btn.textContent = "Form design";
    tabs.appendChild(btn);
  }
  if (!isAdminUser && existingForm) {
    if (state.activeTab === "form-design") state.activeTab = isSalesUser ? "crm" : "purchaseorders";
    existingForm.remove();
  }

  // Keep CRM tabs at the end (CRM Contracts -> CRM Coop -> Form design)
  function moveCrmTabsToEnd() {
    const crm = tabs.querySelector('.tab[data-tab="crm"]');
    const coop = tabs.querySelector('.tab[data-tab="crm-coop"]');
    const form = tabs.querySelector('.tab[data-tab="form-design"]');
    if (crm) tabs.appendChild(crm);
    if (coop) tabs.appendChild(coop);
    if (form) tabs.appendChild(form);
  }
  moveCrmTabsToEnd();

  // Apply role-based visibility
  const allowedSet = isAdminUser ? null : (isBuyerUser ? ALLOWED.buyer : (isSalesUser ? ALLOWED.sales : null));

  const allTabBtns = Array.from(tabs.querySelectorAll(".tab"));
  allTabBtns.forEach(btn => {
    const tabId = btn.dataset.tab;
    const ok = (!allowedSet) ? true : allowedSet.has(tabId);
    btn.style.display = ok ? "" : "none";
  });

  // If current active tab isn't allowed, jump to first allowed visible tab
  if (allowedSet && !allowedSet.has(state.activeTab)) {
    const firstVisible = allTabBtns.find(b => b.style.display !== "none");
    if (firstVisible) state.activeTab = firstVisible.dataset.tab;
  }

  // Bind click handlers
  tabs.querySelectorAll(".tab").forEach(btn => {
    if (btn.__bound) return;
    btn.__bound = true;
    btn.addEventListener("click", () => {
      tabs.querySelectorAll(".tab").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const rawTab = btn.dataset.tab;
      state.activeTab = rawTab;

      // Entering Purchase Orders should always show the current PPO list (not its archive sub-view).
      if (state.activeTab === "purchaseorders") {
        state.poView = "list";
        state.expandedPoId = null;
      }

      // Entering Analytical PO should start with empty temporary order
      if (state.activeTab === "analytical-po") {
        if (!state.analytical) state.analytical = {};
        state.analytical.tempOrder = {};
        state.analytical.view = "list";
        // Reset amounts so temporary order is truly empty
        if (state.analytical.bySku) {
          Object.values(state.analytical.bySku).forEach(rec => { rec.amount = 0; });
        }
      }

      // Entering Form design should open empty (no default form)
      if (state.activeTab === "form-design") {
        if (!state.ui) state.ui = {};
        if (!state.ui.formDesign) state.ui.formDesign = {};
        state.ui.formDesign.selectedForm = "";
        // Close any open modal so the tab starts blank
        state.modal = { kind: null, data: null };
      }

      render();
    });
  });

  // Mark active tab button
  tabs.querySelectorAll(".tab").forEach(b => b.classList.remove("is-active"));
  const activeBtn = tabs.querySelector(`.tab[data-tab="${state.activeTab}"]`);
  if (activeBtn) activeBtn.classList.add("is-active");
}

function updateTopbarUserAndLogout() {
  const topActions = document.querySelector(".top-actions");
  if (!topActions) return;

  document.getElementById("userPill")?.remove();
  document.getElementById("logoutBtn")?.remove();
  document.getElementById("settingsBtn")?.remove();

  if (!state.session.user) return;

  const pill = document.createElement("div");
  pill.id = "userPill";
  pill.className = "userpill";
  pill.innerHTML = `
    <div class="userpill-line">
      <span>${escapeHtml(state.session.user.name)}</span>
      <span class="role">${escapeHtml(state.session.user.role)}</span>
    </div>
    <div class="userpill-sub" style="opacity:.7;font-size:12px;margin-top:2px;">Manufacturer: ${escapeHtml(activeManufacturer())}</div>
  `;

  // Settings menu (Manufacturer + Logout)
  const settingsWrap = document.createElement("div");
  settingsWrap.id = "settingsBtn";
  settingsWrap.className = "menu-wrap";

  const settingsBtn = document.createElement("button");
  settingsBtn.className = "icon-btn";
  settingsBtn.type = "button";
  settingsBtn.title = "Settings";
  settingsBtn.textContent = "Settings";
  settingsBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    state.openMenuKey = (state.openMenuKey === "settings") ? null : "settings";
    render();
  });
  settingsWrap.appendChild(settingsBtn);

  if (state.openMenuKey === "settings") {
    const menu = document.createElement("div");
    menu.className = "menu";

    const mfg = document.createElement("button");
    mfg.type = "button";
    mfg.textContent = "Manufacturer";
    mfg.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenus();
      openModal("settings", {});
    });
    menu.appendChild(mfg);

    const logoutItem = document.createElement("button");
    logoutItem.type = "button";
    logoutItem.textContent = "Logout";
    logoutItem.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenus();
      state.modal.open = false;
      state.modal.kind = null;
      state.modal.data = {};
      clearSession();
      render();
    });
    menu.appendChild(logoutItem);

    settingsWrap.appendChild(menu);
  }

  topActions.prepend(settingsWrap);
  topActions.prepend(pill);
}


/* =========================
   Actions: move PO to Dispatch + Archive
========================= */
function markPoDone(poId) {
  // Ensure archive exists
  if (!Array.isArray(state.archive)) state.archive = [];

  const idx = state.purchaseOrders.findIndex(p => p.id === poId);
  if (idx < 0) return;

  const po = state.purchaseOrders[idx];
// === Inventory rules on PO Done ===
// When PO type=prod_to_local is Done:
// - Increase Lager Bhadohi (stock1) by Amount for each variant
// - Decrease InProduction by the same Amount
if (po && po.type === "prod_to_local") {
  if (!state.analytical.bySku) state.analytical.bySku = loadAnalyticalSkuDb();
  for (const v of (po.variants || [])) {
    const sku = String(v.sku || '').trim();
    if (!sku) continue;
    if (!state.analytical.bySku[sku]) continue;
    const rec = state.analytical.bySku[sku];
    const amt = Number(v.amount) || 0;
    if (amt <= 0) continue;
    rec.stock1 = (Number(rec.stock1) || 0) + amt;
    rec.inProduction = Math.max(0, (Number(rec.inProduction) || 0) - amt);
  }
  saveAnalyticalSkuDb(state.analytical.bySku);
}


  // Move PO to Archive
  state.purchaseOrders.splice(idx, 1);
  state.archive.unshift(po);

  // Keep user in Purchase Orders list. Archive should only be shown when the user clicks "Archive".
  state.activeTab = "purchaseorders";
  state.poView = "list";

  // Cleanup UI state
  state.selectedPoIds?.delete?.(poId);
  if (state.expandedPoId === poId) state.expandedPoId = null;

  render();
}


function movePoToDispatch(poId) {
  const idx = state.purchaseOrders.findIndex(p => p.id === poId);
  if (idx < 0) return;
  const po = state.purchaseOrders[idx];
// === Inventory rules on ToDispatch ===
// When ToDispatch is clicked for prod_to_local:
// - Move Amount from InProduction to Incoming for each variant
if (po && po.type === "prod_to_local") {
  if (!state.analytical.bySku) state.analytical.bySku = loadAnalyticalSkuDb();
  for (const v of (po.variants || [])) {
    const sku = String(v.sku || '').trim();
    if (!sku) continue;
    if (!state.analytical.bySku[sku]) continue;
    const rec = state.analytical.bySku[sku];
    const amt = Number(v.amount) || 0;
    if (amt <= 0) continue;
    rec.inProduction = Math.max(0, (Number(rec.inProduction) || 0) - amt);
    rec.incoming = (Number(rec.incoming) || 0) + amt;
  }
  saveAnalyticalSkuDb(state.analytical.bySku);
}


  const row = nearestUpcomingDispatchRow();
  const commInvoiceUrl = createCommercialInvoiceDummyPdfUrl(po.po);
  row.pos.push({
    po: po.po,
    manufacturer: po.manufacturer || activeManufacturer(),
    delivery: po.delivery || "",
    external: po.external,
    qty: poQty(po),
    date: po.date,
    shippingAddress: po.shippingAddress,
    incoterms: po.incoterms,
    commInvoice: { label: 'Commercial Invoice', url: commInvoiceUrl },
    tracking: "",
    // Snapshot variants so Dispatch POs can be expanded to show details
    variants: JSON.parse(JSON.stringify(po.variants || []))
  });

  // Commercial Invoice PDF is generated and stored on the Dispatch PO (opened only when clicking the icon).

  // move to archive
  state.purchaseOrders.splice(idx, 1);
  state.archive.unshift(po);

  state.selectedPoIds.delete(poId);
  state.activeTab = "dispatch";
  state.expandedPoId = null;
  state.expandedDispatchId = null;
  render();
}


/* =========================
   Actions: Dispatch archive
========================= */
function markDispatchDone(dispatchRowId) {
  const idx = state.dispatchRows.findIndex(r => r.id === dispatchRowId);
  if (idx < 0) return;
  const row = state.dispatchRows[idx];
  moveDispatchRowToArchive(row);
  state.dispatchRows.splice(idx, 1);
  if (state.expandedDispatchId === dispatchRowId) state.expandedDispatchId = null;
  // clear any selected keys for that row
  if (state.selectedDispatchPoKeys && typeof state.selectedDispatchPoKeys.forEach === 'function') {
    const toDelete = [];
    state.selectedDispatchPoKeys.forEach(k => {
      if (String(k).startsWith(dispatchRowId + '|')) toDelete.push(k);
    });
    toDelete.forEach(k => state.selectedDispatchPoKeys.delete(k));
  }
  render();
}

function moveDispatchRowToArchive(row) {
  if (!Array.isArray(state.dispatchArchiveRows)) state.dispatchArchiveRows = [];
  const snapshot = JSON.parse(JSON.stringify(row));
  snapshot.doneAt = new Date().toISOString();
  state.dispatchArchiveRows.unshift(snapshot);
}
/* =========================
   Rendering entry
========================= */
function renderShell() {
  // Normalize legacy spelling
  if (state.activeTab === "archieve") state.activeTab = "archive";

  ensureTabs();
  updateTopbarUserAndLogout();
}

function renderMain() {
  const area = document.getElementById("contentArea");
  if (!area) return;
  area.innerHTML = "";

  const mount = (node) => {
    if (node) area.appendChild(node);
  };

  // Login
  if (!state.session.user) {
    mount(renderLogin());
    return;
  }

  // Views
  switch (state.activeTab) {
    case "purchaseorders": {
      const node = (state.poView === "archive")
        ? renderArchive("purchaseorders")
        : renderPurchaseOrders();
      mount(node);
      return;
    }
    case "dispatch": {
      mount(renderDispatch());
      return;
    }
    case "analytical-po": {
      // Safety: only admin
      if (!["admin","buyer"].includes(state.session.user?.role)) {
        state.activeTab = "purchaseorders";
        render();
        return;
      }
      const node = (state.analytical && state.analytical.view === "archive")
        ? renderArchive("analytical")
        : renderAnalyticalPO();
      mount(node);
      return;
    }
    case "crm": {
      mount(renderCRM());
      return;
    }
    case "crm-coop": {
      mount(renderCrmCoop());
      return;
    }
    case "form-design": {
  mount(renderFormDesign());
  return;
}
case "inventory": {
      area.innerHTML = `
        <div data-owned="app" style="padding:24px;">
          <h2 style="margin:0 0 6px;">Inventory</h2>
          <p style="opacity:.7; margin:0;">Placeholder.</p>
        </div>
      `;
      return;
    }
    case "archive": {
      mount(renderArchive());
      return;
    }

default: {
      area.innerHTML = `<div data-owned="app" style="padding:24px;">Not implemented.</div>`;
      return;
    }
  }
}

function render() {
  renderShell();
  renderMain();
  renderModal();
}

function renderHeaderRow(title, extras = []) {
  const hero = document.createElement("div");
  hero.className = "hero";
  hero.setAttribute("data-owned", "app");

  const left = document.createElement("div");
  left.innerHTML = `<h1>${escapeHtml(title)}</h1>`;

  const actions = document.createElement("div");
  actions.className = "hero-actions";

  // (A previous refactor accidentally referenced an undefined variable `archiveBtn` here,
  // which would throw a ReferenceError and make the whole UI appear "frozen".)
  const archiveBtn = document.createElement("button");
  archiveBtn.className = "btn btn-secondary";
  archiveBtn.type = "button";

  function labelAndHandler() {
    // Default: hide on login screen (renderHeaderRow isn't used there).
    if (state.activeTab === "purchaseorders") {
      const inArchive = state.poView === "archive";
      archiveBtn.textContent = inArchive ? "Back" : "Archive";
      archiveBtn.onclick = () => {
        state.poView = inArchive ? "list" : "archive";
        state.expandedPoId = null;
        state.expandedArchivePoId = null;
        closeMenus();
        render();
      };
      return;
    }

    if (state.activeTab === "dispatch") {
      const inArchive = state.dispatchView === "archive";
      archiveBtn.textContent = inArchive ? "Back" : "Archive";
      archiveBtn.onclick = () => {
        state.dispatchView = inArchive ? "active" : "archive";
        state.expandedDispatchId = null;
        state.expandedDispatchPoKey = null;
        closeMenus();
        render();
      };
      return;
    }

    if (state.activeTab === "analytical-po") {
      const inArchive = state.analytical?.view === "archive";
      archiveBtn.textContent = inArchive ? "Back" : "Archive";
      archiveBtn.onclick = () => {
        if (!state.analytical) state.analytical = {};
        state.analytical.view = inArchive ? "list" : "archive";
        closeMenus();
        render();
      };
      return;
    }

    if (state.activeTab === "archive") {
      archiveBtn.textContent = "Back";
      archiveBtn.onclick = () => {
        state.activeTab = "purchaseorders";
        state.poView = "list";
        closeMenus();
        render();
      };
      return;
    }

    archiveBtn.textContent = "Archive";
    archiveBtn.onclick = () => {
      state.activeTab = "purchaseorders";
      state.poView = "list";
      closeMenus();
      render();
    };
  }

  labelAndHandler();

  const printBtn = document.createElement("button");
  printBtn.className = "btn btn-secondary";
  printBtn.type = "button";
  printBtn.textContent = "Print";
  printBtn.addEventListener("click", () => printSelectedForCurrentTab());
  actions.appendChild(printBtn);
  actions.appendChild(archiveBtn);
  extras.forEach(n => actions.appendChild(n));

  hero.appendChild(left);
  hero.appendChild(actions);
  return hero;
}



/* =========================
   CRM Coop (Leads + Notes + Messages) — Local DB
   DB1: leads (email PK): email, company, region, country, town, responsible, applied, createdDate, lastUpdated
   DB2: notes: email -> [{date,text}]
   DB3: messages: email -> [{date, subject, body}]
========================= */
const STORAGE_KEY_CRM_COOP_LEADS = "butler_crm_coop_leads_v1";
const STORAGE_KEY_CRM_COOP_NOTES = "butler_crm_coop_notes_v1";
const STORAGE_KEY_CRM_COOP_MESSAGES = "butler_crm_coop_messages_v1";
const STORAGE_KEY_CRM_COOP_LAST_IMPORT = "butler_crm_coop_last_import_v1";

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}
function randomEmail() {
  const first = Math.random().toString(36).slice(2, 8);
  const last = Math.random().toString(36).slice(2, 10);
  const domains = ["example.com", "mail.com", "prospect.se", "inbox.io"];
  return `${first}.${last}@${domains[Math.floor(Math.random() * domains.length)]}`;
}

function nowISO() { return new Date().toISOString(); }
function todayYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function loadCrmCoopLeads() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRM_COOP_LEADS);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch { return {}; }
}
function saveCrmCoopLeads(map) {
  try { localStorage.setItem(STORAGE_KEY_CRM_COOP_LEADS, JSON.stringify(map || {})); } catch {}
}
function loadCrmCoopNotes() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRM_COOP_NOTES);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch { return {}; }
}
function saveCrmCoopNotes(map) {
  try { localStorage.setItem(STORAGE_KEY_CRM_COOP_NOTES, JSON.stringify(map || {})); } catch {}
}
function loadCrmCoopMessages() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRM_COOP_MESSAGES);
    const parsed = raw ? JSON.parse(raw) : {};
    return (parsed && typeof parsed === "object") ? parsed : {};
  } catch { return {}; }
}
function saveCrmCoopMessages(map) {
  try { localStorage.setItem(STORAGE_KEY_CRM_COOP_MESSAGES, JSON.stringify(map || {})); } catch {}
}
function loadCrmCoopLastImport() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRM_COOP_LAST_IMPORT);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}
function saveCrmCoopLastImport(list) {
  try { localStorage.setItem(STORAGE_KEY_CRM_COOP_LAST_IMPORT, JSON.stringify(Array.isArray(list) ? list : [])); } catch {}
}

function crmCoopGetDistinctValues(leadsArr, key) {
  const set = new Set();
  leadsArr.forEach(l => {
    const v = String(l[key] || "").trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort((a,b)=>a.localeCompare(b));
}

function crmCoopParseXlsxToLeads(arrayBuffer) {
  if (!window.XLSX) throw new Error("XLSX library missing");
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: "" });

  // Accept a few header variants (case-insensitive-ish)
  const out = [];
  rows.forEach(obj => {
    const email = normalizeEmail(obj.email ?? obj.Email ?? obj["E-mail"] ?? obj.mail ?? obj.Mail);
    if (!email) return;

    const lead = {
      email,
      company: String(obj.company ?? obj.Company ?? obj["företag"] ?? obj["Företag"] ?? "").trim(),
      region: String(obj.region ?? obj.Region ?? "").trim(),
      country: String(obj.country ?? obj.Country ?? obj.category ?? obj.Category ?? "").trim(), // legacy category -> country
      town: String(obj.town ?? obj.Town ?? obj.city ?? obj.City ?? "").trim(),
      responsible: String(obj.responsible ?? obj.Responsible ?? "").trim()
    };
    out.push(lead);
  });

  // Dedupe by email within file (keep first)
  const seen = new Set();
  return out.filter(l => {
    if (seen.has(l.email)) return false;
    seen.add(l.email);
    return true;
  });
}

function crmCoopImportLeadsFromFile(file) {
  return file.arrayBuffer().then(buf => {
    const incoming = crmCoopParseXlsxToLeads(buf);
    const db = loadCrmCoopLeads();

    const unique = [];
    incoming.forEach(l => {
      if (!db[l.email]) {
        db[l.email] = {
          email: l.email,
          company: l.company,
          region: l.region,
          country: l.country,
          town: l.town,
          responsible: l.responsible,
          applied: false,
          createdDate: todayYYYYMMDD(),
          lastUpdated: ""
        };
        unique.push(db[l.email]);
      }
    });

    saveCrmCoopLeads(db);
    saveCrmCoopLastImport(unique.map(x => x.email));
    return { uniqueCount: unique.length, uniqueEmails: unique.map(x => x.email) };
  });
}

function crmCoopSetApplied(email) {
  const e = normalizeEmail(email);
  const db = loadCrmCoopLeads();
  if (!db[e]) return;
  if (db[e].applied) return; // cannot unset
  db[e].applied = true;
  db[e].lastUpdated = todayYYYYMMDD();
  saveCrmCoopLeads(db);
}

function crmCoopAddNote(email, text) {
  const e = normalizeEmail(email);
  const t = String(text || "").trim();
  if (!t) return;

  const notes = loadCrmCoopNotes();
  if (!Array.isArray(notes[e])) notes[e] = [];
  notes[e].push({ date: todayYYYYMMDD(), text: t });
  saveCrmCoopNotes(notes);

  const db = loadCrmCoopLeads();
  if (db[e]) {
    db[e].lastUpdated = todayYYYYMMDD();
    saveCrmCoopLeads(db);
  }
}

function crmCoopAddMessage(email, subject, body) {
  const e = normalizeEmail(email);
  const s = String(subject || "").trim();
  const b = String(body || "").trim();
  if (!s || !b) return;

  const msgs = loadCrmCoopMessages();
  if (!Array.isArray(msgs[e])) msgs[e] = [];
  msgs[e].push({ date: todayYYYYMMDD(), subject: s, body: b });
  saveCrmCoopMessages(msgs);

  const db = loadCrmCoopLeads();
  if (db[e]) {
    db[e].lastUpdated = todayYYYYMMDD();
    saveCrmCoopLeads(db);
  }
}

function crmCoopGetNoteCount(email) {
  const e = normalizeEmail(email);
  const notes = loadCrmCoopNotes();
  return Array.isArray(notes[e]) ? notes[e].length : 0;
}
function crmCoopGetMessageCount(email) {
  const e = normalizeEmail(email);
  const msgs = loadCrmCoopMessages();
  return Array.isArray(msgs[e]) ? msgs[e].length : 0;
}

function makeSelect(label, values, current, onChange) {
  const wrap = document.createElement("div");
  wrap.style.display = "flex";
  wrap.style.flexDirection = "column";
  wrap.style.gap = "6px";

  const lab = document.createElement("div");
  lab.style.fontSize = "12px";
  lab.style.opacity = ".75";
  lab.textContent = label;

  const sel = document.createElement("select");
  sel.className = "input";
  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "All";
  sel.appendChild(allOpt);
  values.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v;
    sel.appendChild(o);
  });
  sel.value = current || "all";
  sel.addEventListener("change", () => onChange(sel.value));

  wrap.append(lab, sel);
  return wrap;
}

function formatAppliedBadge(applied) {
  if (applied) return `<span class="badge" style="background:#1f9d55;color:white;">Applied</span>`;
  return `<span class="badge" style="background:#ddd;color:#333;">Not applied</span>`;
}

function renderCrmCoop() {
  const container = document.createElement("div");
  container.setAttribute("data-owned", "app");

  const extras = [];

  const uploadBtn = document.createElement("button");
  uploadBtn.className = "btn btn-secondary";
  uploadBtn.type = "button";
  uploadBtn.textContent = "Upload";
  uploadBtn.addEventListener("click", () => openModal("crm-coop-upload", {}));
  extras.push(uploadBtn);

  container.appendChild(renderHeaderRow("CRM Coop", extras));

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const db = loadCrmCoopLeads();
  const leads = Object.values(db || {}).sort((a,b) => (b.createdDate || "").localeCompare(a.createdDate || ""));

  // Filters (cascading)
  const filterRow = document.createElement("div");
  filterRow.className = "filters";
  filterRow.style.display = "grid";
  filterRow.style.gridTemplateColumns = "repeat(4, minmax(0, 1fr))";
  filterRow.style.gap = "12px";
  filterRow.style.padding = "0 24px 16px";

  const f = state.ui.crmCoop?.filters || { region:"all", country:"all", town:"all", responsible:"all" };

  // Region options are always based on full dataset
  const distinctRegion = crmCoopGetDistinctValues(leads, "region");

  // Country options depend on selected region
  const leadsForCountry = leads.filter(l => (f.region === "all") || (String(l.region || "") === f.region));
  const distinctCountry = crmCoopGetDistinctValues(leadsForCountry, "country");

  // Town options depend on selected country (and region, if selected)
  const leadsForTown = leads.filter(l => {
    if (f.region !== "all" && String(l.region || "") !== f.region) return false;
    if (f.country !== "all" && String(l.country || "") !== f.country) return false;
    return true;
  });
  const distinctTown = crmCoopGetDistinctValues(leadsForTown, "town");

  // Responsible stays global (can be tightened later if needed)
  const distinctResp = crmCoopGetDistinctValues(leads, "responsible");

  // If current selections are no longer valid due to cascading, reset them safely.
  if (f.country !== "all" && !distinctCountry.includes(f.country)) {
    f.country = "all";
    f.town = "all";
  }
  if (f.town !== "all" && !distinctTown.includes(f.town)) {
    f.town = "all";
  }

  // Persist back (in case we mutated invalid selections)
  if (!state.ui.crmCoop) state.ui.crmCoop = {};
  if (!state.ui.crmCoop.filters) state.ui.crmCoop.filters = { region:"all", country:"all", town:"all", responsible:"all" };
  state.ui.crmCoop.filters = f;

  filterRow.appendChild(makeSelect("Region", distinctRegion, f.region, (v)=>{ 
    state.ui.crmCoop.filters.region = v; 
    // Reset dependent filters when region changes
    if (state.ui.crmCoop.filters.country !== "all") state.ui.crmCoop.filters.country = "all";
    if (state.ui.crmCoop.filters.town !== "all") state.ui.crmCoop.filters.town = "all";
    render(); 
  }));
  filterRow.appendChild(makeSelect("Country", distinctCountry, f.country, (v)=>{ 
    state.ui.crmCoop.filters.country = v; 
    // Reset dependent filter when country changes
    if (state.ui.crmCoop.filters.town !== "all") state.ui.crmCoop.filters.town = "all";
    render(); 
  }));
  filterRow.appendChild(makeSelect("Town", distinctTown, f.town, (v)=>{ 
    state.ui.crmCoop.filters.town = v; 
    render(); 
  }));
  filterRow.appendChild(makeSelect("Responsible", distinctResp, f.responsible, (v)=>{ 
    state.ui.crmCoop.filters.responsible = v; 
    render(); 
  }));

  container.appendChild(filterRow);

  const filtered = leads.filter(l => {
    if (f.region !== "all" && String(l.region||"") !== f.region) return false;
    if (f.country !== "all" && String(l.country||"") !== f.country) return false;
    if (f.town !== "all" && String(l.town||"") !== f.town) return false;
    if (f.responsible !== "all" && String(l.responsible||"") !== f.responsible) return false;
    return true;
  });

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
      <thead>
        <tr>
          <th style="width:18%; text-align:left;">Email</th>
          <th style="width:18%; text-align:left;">Company</th>
          <th style="width:10%; text-align:left;">Region</th>
          <th style="width:10%; text-align:left;">Country</th>
          <th style="width:12%; text-align:left;">Town</th>
          <th style="width:12%; text-align:left;">Responsible</th>
          <th style="width:12%; text-align:left;">Last updated</th>
          <th style="width:4%; text-align:center;"></th>
          <th style="width:2%; text-align:center;"></th>
          <th style="width:2%; text-align:center;"></th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
  const tbody = table.querySelector("tbody");

  filtered.forEach(lead => {
    const tr = document.createElement("tr");

    const tdEmail = document.createElement("td");
    tdEmail.style.backgroundColor = "transparent";
    tdEmail.textContent = lead.email;

    const tdCompany = document.createElement("td");
    tdCompany.style.backgroundColor = "transparent";
    tdCompany.textContent = lead.company || "";

    const tdRegion = document.createElement("td");
    tdRegion.style.backgroundColor = "transparent";
    tdRegion.textContent = lead.region || "";

    const tdCountry = document.createElement("td");
    tdCountry.style.backgroundColor = "transparent";
    tdCountry.textContent = lead.country || "";

    const tdTown = document.createElement("td");
    tdTown.style.backgroundColor = "transparent";
    tdTown.textContent = lead.town || "";

    const tdResp = document.createElement("td");
    tdResp.style.backgroundColor = "transparent";
    tdResp.textContent = lead.responsible || "";

    const tdLast = document.createElement("td");
    tdLast.style.backgroundColor = "transparent";
    tdLast.textContent = lead.lastUpdated || "";

    const tdApplied = document.createElement("td");
    tdApplied.style.backgroundColor = "transparent";
    const appliedWrap = document.createElement("div");
    appliedWrap.style.display = "flex";
    appliedWrap.style.alignItems = "center";
    appliedWrap.style.gap = "8px";

    const chk = document.createElement("input");
    chk.type = "checkbox";
    chk.checked = !!lead.applied;
    chk.disabled = !!lead.applied;
    chk.addEventListener("change", () => {
      if (lead.applied) return;
      crmCoopSetApplied(lead.email);
      render();
    });

    const badge = document.createElement("span");
    badge.innerHTML = lead.applied ? `<span style="display:inline-block;padding:2px 8px;border-radius:999px;background:#1f9d55;color:#fff;font-size:12px;">✔</span>` : "";

    appliedWrap.append(chk, badge);
    tdApplied.appendChild(appliedWrap);

    const tdNotes = document.createElement("td");
    tdNotes.style.backgroundColor = "transparent";
    const noteBtn = document.createElement("button");
    noteBtn.className = "btn btn-secondary";
    noteBtn.type = "button";
    const nCount = crmCoopGetNoteCount(lead.email);
    noteBtn.textContent = nCount ? `Notes (${nCount})` : "Notes";
    noteBtn.addEventListener("click", () => openModal("crm-coop-notes", { email: lead.email }));
    tdNotes.appendChild(noteBtn);

    const tdMsg = document.createElement("td");
    tdMsg.style.backgroundColor = "transparent";
    const msgBtn = document.createElement("button");
    msgBtn.className = "btn btn-secondary";
    msgBtn.type = "button";
    const mCount = crmCoopGetMessageCount(lead.email);
    msgBtn.textContent = mCount ? `Message (${mCount})` : "Message";
    msgBtn.addEventListener("click", () => openModal("crm-coop-messages", { email: lead.email }));
    tdMsg.appendChild(msgBtn);

    tr.append(tdEmail, tdCompany, tdRegion, tdCountry, tdTown, tdResp, tdLast, tdApplied, tdNotes, tdMsg);
    tbody.appendChild(tr);
  });

  if (filtered.length === 0) {
    const empty = document.createElement("div");
    empty.style.padding = "12px 24px";
    empty.style.opacity = ".7";
    empty.textContent = "No leads to show (check filters or upload an Excel).";
    container.appendChild(empty);
  } else {
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  return container;
}

function renderCrmCoopUploadModal() {
  const frag = document.createDocumentFragment();

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `<div class="modal-title">CRM Coop – Upload</div>`;

  const body = document.createElement("div");
  body.className = "modal-body";

  const info = document.createElement("div");
  info.style.opacity = ".75";
  info.style.marginBottom = "10px";
  info.innerHTML = `
    <div>Upload Excel med kolumner: <code>email</code>, <code>company</code>, <code>region</code>, <code>country</code>, <code>town</code>, <code>responsible</code>.</div>
    <div style="margin-top:6px;">Unika emails (som inte finns i databasen) sparas. Nya leads får <code>applied=false</code> och <code>lastUpdated</code> tomt.</div>
  `;

  const warn = document.createElement("div");
  if (!window.XLSX) {
    warn.style.marginTop = "10px";
    warn.style.padding = "10px";
    warn.style.border = "1px solid #f3c";
    warn.style.borderRadius = "10px";
    warn.innerHTML = `XLSX-bibliotek saknas. Lägg till script-tag i HTML: <code>&lt;script src="https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js"&gt;&lt;/script&gt;</code>`;
  }

  const file = document.createElement("input");
  file.type = "file";
  file.accept = ".xlsx,.xls";
  file.className = "input";

  const status = document.createElement("div");
  status.style.marginTop = "10px";
  status.style.opacity = ".75";
  status.style.fontSize = "13px";

  body.append(info, file, warn, status);

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  const cancel = document.createElement("button");
  cancel.className = "btn btn-secondary";
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.onclick = closeModal;

  const upload = document.createElement("button");
  upload.className = "btn btn-primary";
  upload.type = "button";
  upload.textContent = "Upload";
  upload.onclick = async () => {
    if (!file.files || !file.files[0]) { status.textContent = "Välj en fil först."; return; }
    if (!window.XLSX) { status.textContent = "XLSX-bibliotek saknas."; return; }

    status.textContent = "Importerar...";
    try {
      const res = await crmCoopImportLeadsFromFile(file.files[0]);
      status.textContent = `Klart. ${res.uniqueCount} unika leads sparade.`;
      // close and refresh view
      setTimeout(() => { closeModal(); }, 200);
    } catch (e) {
      console.error(e);
      status.textContent = "Fel vid import. Kontrollera att headers matchar.";
    }
  };

  footer.append(cancel, upload);
  frag.append(header, body, footer);
  return frag;
}

function renderCrmCoopNotesModal() {
  const email = normalizeEmail(state.modal.data?.email);
  const notesMap = loadCrmCoopNotes();
  const list = Array.isArray(notesMap[email]) ? notesMap[email] : [];

  const frag = document.createDocumentFragment();

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `<div class="modal-title">Notes – ${escapeHtml(email)}</div>`;

  const body = document.createElement("div");
  body.className = "modal-body";

  const prev = document.createElement("div");
  prev.style.display = "flex";
  prev.style.flexDirection = "column";
  prev.style.gap = "10px";

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.style.opacity = ".7";
    empty.textContent = "No notes yet.";
    prev.appendChild(empty);
  } else {
    list.slice().reverse().forEach(n => {
      const item = document.createElement("div");
      item.innerHTML = `<div style="font-size:12px; opacity:.7;">${escapeHtml(n.date || "")}</div>
        <div style="font-style:italic; white-space:pre-wrap;">${escapeHtml(n.text || "")}</div>`;
      prev.appendChild(item);
    });
  }

  const textarea = document.createElement("textarea");
  textarea.className = "input";
  textarea.style.width = "100%";
  textarea.style.minHeight = "120px";
  textarea.placeholder = "Write a new note here...";
  textarea.style.marginTop = "14px";

  body.append(prev, textarea);

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  const close = document.createElement("button");
  close.className = "btn btn-secondary";
  close.type = "button";
  close.textContent = "Close";
  close.onclick = () => {
    // Save on close if new text exists
    const t = String(textarea.value || "").trim();
    if (t) crmCoopAddNote(email, t);
    closeModal();
  };

  const save = document.createElement("button");
  save.className = "btn btn-primary";
  save.type = "button";
  save.textContent = "Create";
  save.onclick = () => {
    const t = String(textarea.value || "").trim();
    if (t) crmCoopAddNote(email, t);
    closeModal();
  };

  footer.append(close, save);
  frag.append(header, body, footer);
  return frag;
}

function renderCrmCoopMessagesModal() {
  const email = normalizeEmail(state.modal.data?.email);
  const msgMap = loadCrmCoopMessages();
  const list = Array.isArray(msgMap[email]) ? msgMap[email] : [];

  // newest first
  const sorted = list.slice().sort((a,b) => String(b.date||"").localeCompare(String(a.date||"")));

  const frag = document.createDocumentFragment();

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `<div class="modal-title">Messages – ${escapeHtml(email)}</div>`;

  const body = document.createElement("div");
  body.className = "modal-body";

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `<thead><tr><th style="width:120px;">Date</th><th>Subject</th></tr></thead><tbody></tbody>`;
  const tbody = table.querySelector("tbody");

  sorted.forEach((msg, idx) => {
    const tr = document.createElement("tr");
    tr.style.cursor = "pointer";
    tr.innerHTML = `<td>${escapeHtml(msg.date||"")}</td><td>${escapeHtml(msg.subject||"")}</td>`;
    tr.addEventListener("click", () => openModal("crm-coop-message-view", { email, index: idx }));
    tbody.appendChild(tr);
  });

  if (sorted.length === 0) {
    const empty = document.createElement("div");
    empty.style.opacity = ".7";
    empty.textContent = "No messages yet.";
    body.appendChild(empty);
  } else {
    body.appendChild(table);
  }

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  const close = document.createElement("button");
  close.className = "btn btn-secondary";
  close.type = "button";
  close.textContent = "Close";
  close.onclick = closeModal;

  const newMsg = document.createElement("button");
  newMsg.className = "btn btn-primary";
  newMsg.type = "button";
  newMsg.textContent = "Nytt meddelande";
  newMsg.onclick = () => openModal("crm-coop-message-new", { email });

  footer.append(close, newMsg);
  frag.append(header, body, footer);
  return frag;
}

function renderCrmCoopMessageViewModal() {
  const email = normalizeEmail(state.modal.data?.email);
  const idx = Number(state.modal.data?.index ?? -1);

  const msgMap = loadCrmCoopMessages();
  const list = Array.isArray(msgMap[email]) ? msgMap[email] : [];
  const sorted = list.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||"")));
  const msg = sorted[idx];

  const frag = document.createDocumentFragment();
  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `<div class="modal-title">${escapeHtml(email)} – ${escapeHtml(msg?.subject || "Message")}</div>`;

  const body = document.createElement("div");
  body.className = "modal-body";

  if (!msg) {
    const empty = document.createElement("div");
    empty.style.opacity = ".7";
    empty.textContent = "Message not found.";
    body.appendChild(empty);
  } else {
    const meta = document.createElement("div");
    meta.style.opacity = ".7";
    meta.style.fontSize = "12px";
    meta.textContent = msg.date || "";

    const content = document.createElement("div");
    content.style.whiteSpace = "pre-wrap";
    content.style.marginTop = "10px";
    content.textContent = msg.body || "";

    body.append(meta, content);
  }

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  const back = document.createElement("button");
  back.className = "btn btn-secondary";
  back.type = "button";
  back.onclick = () => openModal("crm-coop-messages", { email });

  const close = document.createElement("button");
  close.className = "btn btn-secondary";
  close.type = "button";
  close.textContent = "Close";
  close.onclick = closeModal;

  footer.append(back, close);
  frag.append(header, body, footer);
  return frag;
}

function renderCrmCoopMessageNewModal() {
  const email = normalizeEmail(state.modal.data?.email);

  const frag = document.createDocumentFragment();

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `<div class="modal-title">New message – ${escapeHtml(email)}</div>`;

  const body = document.createElement("div");
  body.className = "modal-body";

  const subject = document.createElement("input");
  subject.className = "input";
  subject.type = "text";
  subject.placeholder = "Subject";

  const msg = document.createElement("textarea");
  msg.className = "input";
  msg.style.width = "100%";
  msg.style.minHeight = "140px";
  msg.placeholder = "Write message...";

  body.append(subject, document.createElement("div"));
  body.append(msg);

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  const cancel = document.createElement("button");
  cancel.className = "btn btn-secondary";
  cancel.type = "button";
  cancel.textContent = "Cancel";
  cancel.onclick = () => openModal("crm-coop-messages", { email });

  const save = document.createElement("button");
  save.className = "btn btn-primary";
  save.type = "button";
  save.textContent = "Create";
  save.onclick = () => {
    crmCoopAddMessage(email, subject.value, msg.value);
    openModal("crm-coop-messages", { email });
  };

  footer.append(cancel, save);
  frag.append(header, body, footer);
  return frag;
}



function renderFormDesign() {
  const container = document.createElement("div");
  container.setAttribute("data-owned", "app");

  const extras = [];

  if (!state.ui) state.ui = {};
  if (!state.ui.formDesign) state.ui.formDesign = {};
  if (typeof state.ui.formDesign.selectedForm !== "string") state.ui.formDesign.selectedForm = "";

  // "Open form" dropdown (no default selection)
  const openSel = document.createElement("select");
  openSel.className = "input";
  openSel.style.minWidth = "220px";

  const opt0 = document.createElement("option");
  opt0.value = "";
  opt0.textContent = "Open form…";
  opt0.disabled = true;
  opt0.selected = true;
  openSel.appendChild(opt0);

  const optApply = document.createElement("option");
  optApply.value = "apply";
  optApply.textContent = "Apply";
  openSel.appendChild(optApply);

  const optPrice = document.createElement("option");
  optPrice.value = "price";
  optPrice.textContent = "Price";
  openSel.appendChild(optPrice);

  openSel.addEventListener("change", () => {
    const v = String(openSel.value || "");
    if (!v) return;

    state.ui.formDesign.selectedForm = v;
    openModal("form-design", { form: v });

    // Reset dropdown so the tab stays "empty" by default
    openSel.value = "";
    render();
  });

  extras.push(openSel);

  const header = renderHeaderRow("Form design", extras);
  container.appendChild(header);

  // Blank state: Form design is standalone and shows nothing until a form is opened.
  const hint = document.createElement("div");
  hint.style.padding = "14px 16px";
  hint.style.color = "rgba(0,0,0,0.6)";
  hint.textContent = "Choose a form from “Open form…” to preview/design it.";
  container.appendChild(hint);

  return container;
}




function renderFormDesignModal() {
  const data = (state.modal && state.modal.data) ? state.modal.data : {};
  const formType = String(data.form || "apply").toLowerCase();

  const box = document.createElement("div");
  box.className = "modal-box";
  box.style.width = "min(720px, 92vw)";
  box.style.borderRadius = "22px";
  box.style.background = "#fff";
  box.style.boxShadow = "0 18px 50px rgba(0,0,0,0.18)";
  box.style.overflow = "hidden";

  const header = document.createElement("div");
  header.style.padding = "18px 20px";
  header.style.borderBottom = "1px solid rgba(0,0,0,0.08)";
  header.style.display = "flex";
  header.style.alignItems = "center";
  header.style.justifyContent = "space-between";

  const title = document.createElement("div");
  title.style.fontSize = "18px";
  title.style.fontWeight = "700";
  title.textContent = (formType === "price") ? "Request a price" : "Apply for an account";

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-secondary";
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", closeModal);

  header.append(title, closeBtn);

  const body = document.createElement("div");
  body.style.padding = "18px 20px 20px";

  const grid = document.createElement("div");
  grid.style.display = "grid";
  grid.style.gridTemplateColumns = "1fr 1fr";
  grid.style.gap = "14px 14px";

  const mkInput = (type="text", readOnly=false, value="") => {
    const el = document.createElement("input");
    el.type = type;
    el.value = value;
    el.readOnly = readOnly;
    el.style.width = "100%";
    el.style.padding = "12px 12px";
    el.style.borderRadius = "12px";
    el.style.border = "1px solid rgba(0,0,0,0.14)";
    el.style.outline = "none";
    el.style.fontSize = "14px";
    if (readOnly) el.style.background = "rgba(0,0,0,0.03)";
    return el;
  };

  const mkField = (labelText, control, span2=false) => {
    const wrap = document.createElement("div");
    if (span2) wrap.style.gridColumn = "1 / -1";

    const lbl = document.createElement("div");
    lbl.style.fontSize = "12px";
    lbl.style.fontWeight = "700";
    lbl.style.color = "rgba(0,0,0,0.55)";
    lbl.style.marginBottom = "6px";
    lbl.textContent = labelText;

    wrap.append(lbl, control);
    return wrap;
  };

  const email = mkInput("email", false, "");
  const company = mkInput("text", false, "");

  const message = document.createElement("textarea");
  message.value = "";
  message.rows = 4;
  message.style.width = "100%";
  message.style.resize = "vertical";
  message.style.padding = "12px 12px";
  message.style.borderRadius = "12px";
  message.style.border = "1px solid rgba(0,0,0,0.14)";
  message.style.outline = "none";
  message.style.fontSize = "14px";

  if (formType === "price") {
    const product = mkInput("text", false, "");
    const qty = mkInput("number", false, "1");

    grid.append(
      mkField("Email", email, true),
      mkField("Company", company, true),
      mkField("Product", product, true),
      mkField("Quantity", qty, false),
      mkField("Message", message, true)
    );
  } else {
    const firstName = mkInput("text", false, "");
    const lastName = mkInput("text", false, "");

    const country = document.createElement("select");
    country.style.width = "100%";
    country.style.padding = "12px 12px";
    country.style.borderRadius = "12px";
    country.style.border = "1px solid rgba(0,0,0,0.14)";
    country.style.outline = "none";
    country.style.fontSize = "14px";

    const countries = ["Sweden", "Norway", "Denmark", "Finland", "Other"];
    countries.forEach(c => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      country.appendChild(o);
    });

    grid.append(
      mkField("Email", email, true),
      mkField("First name", firstName),
      mkField("Last name", lastName),
      mkField("Company", company, false),
      mkField("Country", country, false),
      mkField("Message", message, true)
    );
  }

  const footer = document.createElement("div");
  footer.style.marginTop = "16px";
  footer.style.display = "flex";
  footer.style.justifyContent = "flex-end";

  const primaryBtn = document.createElement("button");
  primaryBtn.className = "btn btn-primary";
  primaryBtn.type = "button";
  primaryBtn.textContent = (formType === "price") ? "Request price" : "Apply";
  primaryBtn.addEventListener("click", () => {
    alert("to be added.");
  });

  footer.appendChild(primaryBtn);

  body.append(grid, footer);
  box.append(header, body);
  return box;
}



function renderCRM() {
  const container = document.createElement("div");
  container.setAttribute("data-owned", "app");

  if (!state.ui) state.ui = {};
  if (!state.ui.crm) state.ui.crm = {};

  if (typeof state.ui.crm.showInfo !== "boolean") state.ui.crm.showInfo = true;
  if (!Array.isArray(state.ui.crm.lastUploadRows)) state.ui.crm.lastUploadRows = [];

  const extras = [];

  const uploadBtn = document.createElement("button");
  uploadBtn.className = "btn btn-secondary";
  uploadBtn.type = "button";
  uploadBtn.textContent = "Upload";

  // Hidden file input (triggered by Upload)
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.accept = ".xlsx,.xls";
  fileInput.style.display = "none";

  uploadBtn.addEventListener("click", () => {
    state.ui.crm.showInfo = false;
    fileInput.value = ""; // allow selecting same file again
    fileInput.click();
    render(); // remove info box immediately
  });

  fileInput.addEventListener("change", async () => {
    if (!fileInput.files || !fileInput.files[0]) return;
    if (!window.XLSX) {
      alert("XLSX-bibliotek saknas (script-tag).");
      return;
    }

    try {
      const buf = await fileInput.files[0].arrayBuffer();

      // Rows from Excel (deduped by email)
      const incoming = dedupeByEmail(parseCrmRowsFromXlsx(buf));
      state.ui.crm.shopifyProcessed = false;

      state.ui.crm.lastUploadRows = (incoming || []).map(r => ({ ...r, shopify: r.shopify || "", mailSent: r.mailSent || "" }));

      // Persist only new emails to DB
      const db = loadCrmDb();
      const existingEmails = new Set(db.map(x => normalizeEmail(x.email)));
      const unique = incoming.filter(r => !existingEmails.has(normalizeEmail(r.email)));

      // Store category in legacy field "country" for backwards compatibility
      const toAdd = unique.map(r => ({
        email: normalizeEmail(r.email),
        company: "",
        country: String(r.country || "").trim()
      }));

      saveCrmDb(db.concat(toAdd));
      saveCrmLastUnique(unique);

      // Open the table modal
      openModal("crm-prospects", {});
      render();
    } catch (e) {
      console.error(e);
      alert("Fel vid import. Kontrollera att filen har headers: EMAIL + CATEGORI.");
    }
  });

  extras.push(uploadBtn);

  const header = renderHeaderRow("CRM", extras);
  Array.from(header.querySelectorAll("button")).forEach(btn => {
    if (btn.textContent && btn.textContent.trim().toLowerCase() === "back") btn.remove();
  });

  container.appendChild(header);
  container.appendChild(fileInput);

  // Information box (shown when CRM opens; hidden after Upload)
  if (state.ui.crm.showInfo) {
    const infoBox = document.createElement("div");
    infoBox.style.margin = "16px 24px";
    infoBox.style.padding = "26px 28px";
    infoBox.style.border = "6px solid #111";
    infoBox.style.borderRadius = "28px";
    infoBox
    infoBox.style.maxWidth = "820px";

    const p1 = document.createElement("div");
    p1.style.fontSize = "18px";
    p1.style.lineHeight = "1.55";
    p1.textContent = "Här kan du ladda upp en Excel-fil med två kolumner:";

    const codeLine = document.createElement("div");
    codeLine.style.marginTop = "14px";
    codeLine.style.fontFamily = "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace";
    codeLine.style.fontSize = "18px";
    codeLine.textContent = "EMAIL–CATEGORI";

    const p2 = document.createElement("div");
    p2.style.marginTop = "14px";
    p2.style.fontSize = "18px";
    p2.style.lineHeight = "1.55";
    p2.innerHTML = 'där CATEGORI = <span style="text-decoration: underline;">contract</span> eller <span style="text-decoration: underline;">architect</span>';

    const p3 = document.createElement("div");
    p3.style.marginTop = "18px";
    p3.style.fontSize = "18px";
    p3.style.lineHeight = "1.55";
    p3.innerHTML = 'Klicka på <span style="text-decoration: underline;">Upload</span> för att välja en Excel-fil. Tabellen öppnas i en <span style="text-decoration: underline;">popup</span> efter import';

    infoBox.append(p1, codeLine, p2, p3);
    container.appendChild(infoBox);
  }

  return container;
}


function renderAnalyticalPO() {
  const container = document.createElement("div");
  container.setAttribute("data-owned", "app");

  // Safety: only admin
  if (!["admin","buyer"].includes(state.session.user?.role)) {
    const box = document.createElement("div");
    box.style.padding = "24px";
    box.textContent = "Not authorized.";
    container.appendChild(box);
    return container;
  }

  // Ensure state defaults
  if (!state.analytical) state.analytical = {};
  if (!state.analytical.filter) state.analytical.filter = "selected";     // default = rugs
  // Analytical "Type" values are also used as the created PO.type.
  // Keep defaults aligned with the Type dropdown values.
  if (!state.analytical.mode) state.analytical.mode = "prod_to_local";
  // Manufacturer selection (future-proof). Only one manufacturer exists now.
  if (!state.analytical.manufacturer) state.analytical.manufacturer = "Anisa";
if (!state.analytical.tempOrder) state.analytical.tempOrder = {}; // sku -> amount
if (!state.analytical.view) state.analytical.view = "list";       // list | temp

  // Per-SKU data store (persisted placeholders + amount input)
  if (!state.analytical.bySku) state.analytical.bySku = loadAnalyticalSkuDb();           // sku -> { stock1, stock2, sales3, amount }

  const FILTERS = [
    ["rugs", "rugs"],
    ["colonnade", "colonnade"],
    ["tapestry", "tapestry"],
    ["covers", "covers"],
    ["selected", "selected"] // Amount > 0 oavsett category
  ];

  function filterToCategory(filter) {
    // Map filter labels to PRODUCT_DB categories
    if (filter === "rugs") return "Rug";
    if (filter === "colonnade") return "Colonnade";
    if (filter === "tapestry") return "Tapestry";
    if (filter === "covers") return "Covers"; // tills ni har egen "Covers"-kategori
    return null;
  }

  function ensureSkuRecord(sku) {
    if (state.analytical.bySku[sku]) return state.analytical.bySku[sku];

    // Persisted placeholders (created once per SKU, then stored locally)
const stock1 = randInt(1, 10);   // Lager Bhadohi: 1..10
const stock2 = randInt(2, 15);   // Lager Falköping: 2..15
const sales3 = randInt(2, 10);   // Sales 3 månader: 2..10

state.analytical.bySku[sku] = {
  stock1,
  stock2,
  sales3,
  inProduction: 0,
  incoming: 0,
  amount: 0
};
saveAnalyticalSkuDb(state.analytical.bySku);
return state.analytical.bySku[sku];
  }

  function statusColor(sales3, stock1, stock2) {
    const total = Number(stock1) + Number(stock2);
    const s = Number(sales3);

    if (s > total) return "red";             // röd
    if (s <= total / 2) return "green";      // grön
    return "gold";                           // gul
  }

function createPOFromAnalytical() {
  const temp = state.analytical.tempOrder || {};
  const picked = Object.keys(temp)
    .map(sku => ({ sku, amount: Number(temp[sku]) || 0 }))
    .filter(x => x.amount > 0);

  if (picked.length === 0) {
    alert("Temporary order är tom. Sätt Amount > 0 på minst en variant.");
    return;
  }

  const mode = String(state.analytical.mode || "prod_to_local");
const isLocal = mode === "prod_to_local";
const isTransfer = (mode === "transfer_aircargo" || mode === "transfer_boat");

// For transfer_aircargo / transfer_boat: Amount must be <= InProduction + Bhadohi(stock1) for every row
if (isTransfer) {
  const bad = picked.find(x => {
    const rec = (state.analytical.bySku && state.analytical.bySku[x.sku]) ? state.analytical.bySku[x.sku] : null;
    const inProd = inProductionForSku(x.sku) ?? 0;
    const bhadohi = rec ? (Number(rec.stock1) || 0) : 0;
    const max = (Number(inProd) || 0) + bhadohi;
    return (Number(x.amount) || 0) > max;
  });
  if (bad) {
    const rec = state.analytical.bySku[bad.sku];
    const inProd = inProductionForSku(bad.sku) ?? 0;
    const bhadohi = rec ? (Number(rec.stock1) || 0) : 0;
    const max = (Number(inProd) || 0) + bhadohi;
    alert(`Amount för ${bad.sku} måste vara <= InProduction + Bhadohi (${max}).`);
    return;
  }
}
// For transfer POs: set ERD to yesterday so Done is clickable in Purchase Orders
let erdForNewPo = "";
if (isTransfer) {
  const y = startOfToday();
  y.setDate(y.getDate() - 1);
  erdForNewPo = toYYYYMMDD(y);
}

// Shipping address mapping from Analytical Type
// - transfer_aircargo / transfer_boat -> Partnerlogistik
// - prod_to_local -> Warehouse Bhadohi
const shippingAddress =
  (mode === "transfer_aircargo" || mode === "transfer_boat")
    ? TRANSFER_ADDRESS
    : WAREHOUSE_BHADOHI_ADDRESS;

  const poObj = {
    id: `po-${Date.now()}-${Math.random().toString(16).slice(2)}`,
    // Always allocate a fresh PO number at creation time.
    po: nextPoNumber(),
    manufacturer: activeManufacturer(),
    // Persist the selected Analytical Type into the created PO.
    type: mode,
    delivery: isLocal ? "Local" : (mode === "transfer_boat" ? "Boat" : "Air"),
    external: "",
    date: todayYYYYMMDD(),
    shippingAddress,
    incoterms: (mode === "prod_to_local") ? "none" : "DDP",

    variants: picked.map((x, idx) => {
      const prod = (productDbForActiveManufacturer() || []).find(p => p.sku === x.sku);
      const rec = (state.analytical.bySku && state.analytical.bySku[x.sku]) ? state.analytical.bySku[x.sku] : null;

      return {
        id: `apv-${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
        name: prod?.name || "",
        sku: x.sku,
        category: prod?.category || "",
        amount: x.amount,

        // keep compatible fields (other views ignore)
        balance: 0,
        erd: erdForNewPo,
        erdOriginal: erdForNewPo,
        notesPdf: null,

        // analytical extras (optional)
        stock1: rec ? Number(rec.stock1) || 0 : 0,
        stock2: rec ? Number(rec.stock2) || 0 : 0,
        sales3: rec ? Number(rec.sales3) || 0 : 0
      };
    })
  };

  // Add PO and jump to Purchase Orders
  if (!Array.isArray(state.purchaseOrders)) state.purchaseOrders = [];
  // === Inventory rules (Analytical SKU DB) ===
// On PO creation:
// - prod_to_local -> increase InProduction by Amount
// - transfer_aircargo / transfer_boat -> increase Incoming by Amount
if (!state.analytical.bySku) state.analytical.bySku = loadAnalyticalSkuDb();
for (const v of (poObj.variants || [])) {
  const sku = String(v.sku || '').trim();
  if (!sku) continue;
  if (!state.analytical.bySku[sku]) {
    // create a base record if missing (keeps existing random ranges)
    state.analytical.bySku[sku] = {
      stock1: randInt(1, 10),
      stock2: randInt(2, 15),
      sales3: randInt(2, 10),
      inProduction: 0,
      incoming: 0,
      amount: 0
    };
  }
  const rec = state.analytical.bySku[sku];
  const amt = Number(v.amount) || 0;
  if (amt <= 0) continue;

  if (poObj.type === "prod_to_local") {
    rec.inProduction = (Number(rec.inProduction) || 0) + amt;
  } else if (poObj.type === "transfer_aircargo" || poObj.type === "transfer_boat") {
    rec.incoming = (Number(rec.incoming) || 0) + amt;
  }
}
saveAnalyticalSkuDb(state.analytical.bySku);

state.purchaseOrders.unshift(poObj);
  state.activeTab = "purchaseorders";
  // Ensure Purchase Orders shows the active list after creating a PO.
  state.poView = "list";
  state.expandedPoId = null;
  state.expandedDispatchId = null;

  // Clear temporary order + amounts
  state.analytical.tempOrder = {};
  if (state.analytical.bySku) {
    Object.values(state.analytical.bySku).forEach(rec => { rec.amount = 0; });
  }
  state.analytical.view = "list";

  render();
}


  // Header actions (no Add row anymore)
const createBtn = document.createElement("button");
createBtn.className = "btn btn-primary";
createBtn.type = "button";
createBtn.textContent = "Create PO";

// Enable only if there is at least one variant in temporary order
const temp = state.analytical.tempOrder || {};
const hasTempLines = Object.keys(temp).some(
  sku => Number(temp[sku]) > 0
);

createBtn.disabled = !hasTempLines;

function updateCreateBtnState() {
  const tempNow = state.analytical.tempOrder || {};
  const has = Object.keys(tempNow).some(sku => Number(tempNow[sku]) > 0);
  createBtn.disabled = !has;
  const isSelected = String(state.analytical.filter || "") === "selected";
  if (isSelected && has) createBtn.classList.add("btn-ready");
  else createBtn.classList.remove("btn-ready");
  createBtn.title = has ? "Create PO from Temporary order" : "Sätt Amount > 0 på minst en variant först";
}

// Visual rule:
// - Button should be GREEN only when filter === "selected" AND there are selected lines (Amount > 0)
// - Otherwise keep normal styling (still enabled if hasTempLines)
const isSelectedFilter = String(state.analytical.filter || "") === "selected";
if (isSelectedFilter && hasTempLines) createBtn.classList.add("btn-ready");
else createBtn.classList.remove("btn-ready");

createBtn.title = hasTempLines
  ? "Create PO from Temporary order"
  : "Sätt Amount > 0 på minst en variant först";

createBtn.addEventListener("click", () => {
  if (createBtn.disabled) return;
  try {
    createPOFromAnalytical();
  } catch (e) {
    console.error(e);
    alert("CreatePO failed: " + (e && e.message ? e.message : String(e)));
  }
});



  container.appendChild(renderHeaderRow("Analytical PO", [createBtn]));

  // Controls (filter + type)
  const controls = document.createElement("div");
  controls.style.padding = "0 24px 12px";
  controls.style.display = "flex";
  controls.style.gap = "12px";
  controls.style.alignItems = "center";

  // Manufacturer selector
  const mfgWrap = document.createElement("div");
  mfgWrap.style.display = "flex";
  mfgWrap.style.flexDirection = "column";
  mfgWrap.style.gap = "6px";

  const mfgLbl = document.createElement("div");
  mfgLbl.className = "label";
  mfgLbl.textContent = "Manufacturer";

  const mfgSel = document.createElement("select");
  mfgSel.className = "input";
  // Only one manufacturer for now
  [{ value: "Anisa", label: "Anisa" }].forEach(({ value, label }) => {
    const o = document.createElement("option");
    o.value = value;
    o.textContent = label;
    mfgSel.appendChild(o);
  });
  mfgSel.value = state.analytical.manufacturer;
  mfgSel.addEventListener("change", () => {
    state.analytical.manufacturer = mfgSel.value;
    render();
  });

  mfgWrap.append(mfgLbl, mfgSel);

  const filterWrap = document.createElement("div");
  filterWrap.style.display = "flex";
  filterWrap.style.flexDirection = "column";
  filterWrap.style.gap = "6px";

  const filterLbl = document.createElement("div");
  filterLbl.className = "label";
  filterLbl.textContent = "Filter";

  const filterSel = document.createElement("select");
  filterSel.className = "input";
  FILTERS.forEach(([val, label]) => {
    const o = document.createElement("option");
    o.value = val;
    o.textContent = label;
    filterSel.appendChild(o);
  });
  filterSel.value = state.analytical.filter;
  filterSel.addEventListener("change", () => {
    state.analytical.filter = filterSel.value;
    render();
  });

  filterWrap.append(filterLbl, filterSel);

  const modeWrap = document.createElement("div");
  modeWrap.style.display = "flex";
  modeWrap.style.flexDirection = "column";
  modeWrap.style.gap = "6px";

  const modeLbl = document.createElement("div");
  modeLbl.className = "label";
  modeLbl.textContent = "Type";

 const modeSel = document.createElement("select");
modeSel.className = "input";

[
  ["prod_to_local", "prod_to_local"],
  ["transfer_aircargo", "transfer_aircargo"],
  ["transfer_boat", "transfer_boat"]
].forEach(([val, label]) => {
  const o = document.createElement("option");
  o.value = val;
  o.textContent = label;
  modeSel.appendChild(o);
});

modeSel.value = state.analytical.mode;
modeSel.addEventListener("change", () => {
  state.analytical.mode = modeSel.value;
  render();
});


  modeWrap.append(modeLbl, modeSel);

controls.append(mfgWrap, filterWrap, modeWrap);


  container.appendChild(controls);

  // Build list of products to show
  
// Build list of products to show
const allProducts = productDbForActiveManufacturer() || [];
let rows = [];

const filterVal = String(state.analytical.filter || "selected");

// selected = visa endast de som har Amount > 0 (oavsett category)
if (filterVal === "selected") {
  const bySku = state.analytical.bySku || {};
  const selectedSkus = Object.keys(bySku).filter(sku => Number(bySku[sku]?.amount) > 0);

  rows = selectedSkus
    .map(sku => allProducts.find(p => p.sku === sku))
    .filter(Boolean);
} else {
  const cat = filterToCategory(filterVal);
  rows = cat ? allProducts.filter(p => p.category === cat) : allProducts.slice();
}


  // Table
  const table = document.createElement("table");
  table.className = "po-table";

  const thead = document.createElement("thead");
  const hr = document.createElement("tr");

  // Dynamic column labels for stock locations based on manufacturer
  const mfg = String(state.analytical.manufacturer || "");
  const stock1Label = (mfg === "Anisa") ? "Bhadohi" : "Lager 1";
  const stock2Label = (mfg === "Anisa") ? "Falköping" : "Lager 2";
[
  ["Variant", "36%"],
  ["InProduction", "9%"],
  [stock1Label, "9%"],
  [stock2Label, "9%"],
  ["InComing", "9%"],
  ["Sales 3 månader", "10%"],
  ["Status", "8%"],
  ["Amount", "10%"],
  ["Action", "10%"],
].forEach(([label, w], idx) => {
  const th = document.createElement("th");
  th.textContent = label;
  th.style.width = w;
  th.style.padding = "12px 10px";
  th.style.whiteSpace = "nowrap";
  th.style.overflow = "hidden";
  th.style.textOverflow = "ellipsis";
  th.style.textAlign = (idx === 0) ? "left" : "center";
  hr.appendChild(th);
});

  thead.appendChild(hr);

  const tbody = document.createElement("tbody");

  rows.forEach(p => {
    const rec = ensureSkuRecord(p.sku);

    const tr = document.createElement("tr");

    // highlight row if Amount > 0
    const isDone = Number(rec.amount) > 0;
    if (isDone) {
      tr.style.backgroundColor = "rgba(0, 200, 0, 0.10)";
    }

    // Variant
    const tdVar = document.createElement("td");
    tdVar.style.backgroundColor = "transparent";
    tdVar.textContent = p.name;
tdVar.style.textAlign = "left";
tdVar.style.padding = "12px 10px";
tdVar.style.overflow = "hidden";
tdVar.style.textOverflow = "ellipsis";
tdVar.style.whiteSpace = "nowrap";

    // InProduction (tracked per rules from PO actions)
    const tdInProd = document.createElement("td");
    tdInProd.style.backgroundColor = "transparent";
    tdInProd.textContent = String(inProductionForSku(p.sku) ?? 0);
    tdInProd.style.textAlign = "center";
    tdInProd.style.padding = "12px 10px";

    // Lager 1 / Lager 2
    const tdS1 = document.createElement("td");
    tdS1.style.backgroundColor = "transparent";
    tdS1.textContent = String(rec.stock1 ?? 0);

    const tdS2 = document.createElement("td");
    tdS2.style.backgroundColor = "transparent";
    tdS2.textContent = String(rec.stock2 ?? 0);

    // InComing (transfer POs + Dispatch)
    const tdIncoming = document.createElement("td");
    tdIncoming.style.backgroundColor = "transparent";
    tdIncoming.textContent = String(incomingForSku(p.sku) ?? 0);

    const tdSales = document.createElement("td");
    tdSales.style.backgroundColor = "transparent";
    tdSales.textContent = String(rec.sales3 ?? 0);
tdS1.style.textAlign = "center";
tdS2.style.textAlign = "center";
tdIncoming.style.textAlign = "center";
tdSales.style.textAlign = "center";
tdS1.style.padding = "12px 10px";
tdS2.style.padding = "12px 10px";
tdIncoming.style.padding = "12px 10px";
tdSales.style.padding = "12px 10px";

    // Status
    const tdStatus = document.createElement("td");
    tdStatus.style.backgroundColor = "transparent";
    const dot = document.createElement("span");
    tdStatus.style.textAlign = "center";
tdStatus.style.padding = "12px 10px";

    dot.style.display = "inline-block";
dot.style.width = "14px";
dot.style.height = "14px";
dot.style.boxShadow = "0 0 0 3px rgba(0,0,0,0.04)";

    dot.style.borderRadius = "999px";
    dot.style.verticalAlign = "middle";
    dot.style.background = statusColor(rec.sales3, rec.stock1, rec.stock2);
    tdStatus.appendChild(dot);

    // Amount input (manual antal, digits-only)
    const tdAmt = document.createElement("td");
    tdAmt.style.backgroundColor = "transparent";
    tdAmt.style.textAlign = "center";
    tdAmt.style.padding = "10px";

    const amt = document.createElement("input");
    // Use text + inputmode to enforce digits-only reliably (no e/+/-.)
    amt.type = "text";
    amt.inputMode = "numeric";
    amt.autocomplete = "off";
    amt.spellcheck = false;
    amt.className = "input";
    amt.value = String(rec.amount ?? 0);

    amt.style.textAlign = "center";
    amt.style.width = "90px";

    function updateAmountValidation() {
      const mode = String(state.analytical.mode || "prod_to_local");
      const isTransfer = (mode === "transfer_aircargo" || mode === "transfer_boat");

      if (!isTransfer) {
        amt.style.borderColor = "";
        amt.style.color = "";
        return;
      }

      const inProd = Number(inProductionForSku(p.sku) ?? 0) || 0;
      const bhadohi = Number(rec.stock1 ?? 0) || 0;
      const max = inProd + bhadohi;

      if ((Number(rec.amount) || 0) > max) {
        amt.style.borderColor = "red";
        amt.style.color = "red";
      } else {
        amt.style.borderColor = "";
        amt.style.color = "";
      }
    }

    // Initial validation
    updateAmountValidation();

    amt.addEventListener("input", () => {
      // Keep only digits
      const cleaned = String(amt.value || "").replace(/[^0-9]/g, "");
      if (cleaned !== amt.value) amt.value = cleaned;

      const v = cleaned === "" ? 0 : Number(cleaned);

      rec.amount = Number.isFinite(v) ? v : 0;

      // Keep temporary order in sync (unique per SKU)
      if (!state.analytical.tempOrder) state.analytical.tempOrder = {};
      if (rec.amount > 0) state.analytical.tempOrder[p.sku] = rec.amount;
      else delete state.analytical.tempOrder[p.sku];

      // Row highlight rule: any row with Amount > 0 becomes green
      if (Number(rec.amount) > 0) tr.style.backgroundColor = "rgba(0, 200, 0, 0.10)";
      else tr.style.backgroundColor = "";

      // Transfer rule: mark amount red if Amount > InProduction + Bhadohi
      updateAmountValidation();

      // Update Create PO button state without re-render (keeps caret so multi-digit input works)
      updateCreateBtnState();
    });

    // Re-render when leaving the field so "selected" filter view can update cleanly
    amt.addEventListener("blur", () => {
      render();
    });

    tdAmt.appendChild(amt);
    // Action: analyze
    const tdAction = document.createElement("td");
    tdAction.style.backgroundColor = "transparent";
    tdAction.style.textAlign = "center";
    tdAction.style.padding = "10px";
    const analyzeBtn = document.createElement("button");
    analyzeBtn.type = "button";
    analyzeBtn.className = "btn btn-secondary";
    analyzeBtn.textContent = "Analyze";
    analyzeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      alert("To be added.");
    });
    tdAction.appendChild(analyzeBtn);


    tr.append(tdVar, tdInProd, tdS1, tdS2, tdIncoming, tdSales, tdStatus, tdAmt, tdAction);
    tbody.appendChild(tr);
  });

  table.append(thead, tbody);

  const wrap = document.createElement("div");
  wrap.style.padding = "0 24px 24px";
  wrap.appendChild(table);

  // empty state
  if (rows.length === 0) {
    const hint = document.createElement("div");
    hint.style.opacity = ".7";
    hint.style.marginTop = "10px";
    hint.textContent = (state.analytical.filter === "selected")
      ? "Inga rader med Amount > 0."
      : "Inga produkter i detta filter.";
    wrap.appendChild(hint);
  }

  container.appendChild(wrap);
  return container;
}


/* =========================
   Purchase Orders view
========================= */
function renderPurchaseOrders() {
  const container = document.createElement("div");
  container.setAttribute("data-owned", "app");

  const extras = [];
  const isArchiveView = state.poView === "archive";

  // NewPO is only allowed in the active PPO list.
  if (!isArchiveView && canSeeNewPoNewRow()) {
    const newPo = document.createElement("button");
    newPo.className = "btn btn-primary";
    newPo.type = "button";
    newPo.textContent = "NewPO";
    newPo.addEventListener("click", () => {
      openModal("create-po", {
        type: "customer_to_falköping",
        delivery: "Air",
        external: "",
        date: todayYYYYMMDD(),
        incoterms: "DAP",
        shippingAddress: ""
      });
    });
    extras.push(newPo);
  }
  
  // ERD filter (based on latest variant ERD; "none" if any ERD missing)
  if (!state.ui) state.ui = {};
  if (!state.ui.poErdFilter) state.ui.poErdFilter = "all";

  const erdFilterWrap = document.createElement("div");
  erdFilterWrap.className = "toolbar-field";
  const erdLabel = document.createElement("div");
  erdLabel.className = "toolbar-label";
  erdLabel.textContent = "ERD";
  const erdSelect = document.createElement("select");
  erdSelect.className = "input";
  erdSelect.style.minWidth = "160px";

  // Build options from current list (manufacturer filtered)
  const listForFilterRaw = isArchiveView
    ? (Array.isArray(state.archive) ? state.archive : [])
    : (Array.isArray(state.purchaseOrders) ? state.purchaseOrders : []);
  const listForFilter = filterPosByActiveManufacturer(listForFilterRaw);

  const values = new Set();
  values.add("none");
  listForFilter.forEach(po => values.add(poErdValue(po).value));
  const dates = Array.from(values).filter(v => v && v !== "none").sort((a,b) => String(b).localeCompare(String(a)));
  const options = ["all", "none", ...dates];

  options.forEach(v => {
    const o = document.createElement("option");
    o.value = v;
    o.textContent = v === "all" ? "All" : v;
    erdSelect.appendChild(o);
  });

  erdSelect.value = state.ui.poErdFilter || "all";
  erdSelect.addEventListener("change", () => {
    state.ui.poErdFilter = erdSelect.value;
    render();
  });

  erdFilterWrap.append(erdLabel, erdSelect);
  extras.push(erdFilterWrap);

  container.appendChild(renderHeaderRow("Purchase Orders", extras));

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-check"></th>
        <th class="col-expand"></th>
        <th>PO</th>
        <th>Type</th>
        <th>External</th>
        <th>Qty</th>
        <th>Delivery</th>
        <th>Date</th>
        <th>ERD</th>
        <th>Shipping Adress</th>
        <th>Incoterms</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  const listRaw = isArchiveView
    ? (Array.isArray(state.archive) ? state.archive : [])
    : (Array.isArray(state.purchaseOrders) ? state.purchaseOrders : []);

  let list = filterPosByActiveManufacturer(listRaw);
  // Apply ERD filter + sort
  const erdFilter = state.ui?.poErdFilter || "all";
  if (erdFilter !== "all") {
    list = list.filter(po => poErdValue(po).value === erdFilter);
  }
  list = list.slice().sort(comparePoByErd);

  list.forEach(po => {
    const isExpanded = state.expandedPoId === po.id;
    const isSelected = !isArchiveView && state.selectedPoIds.has(po.id);

    const tr = document.createElement("tr");
    if (isExpanded) tr.classList.add("is-expanded");

    tr.innerHTML = `
      <td class="col-check"></td>
      <td class="col-expand">
        <button class="icon-btn" type="button" aria-label="${isExpanded ? "Collapse" : "Expand"}">
          ${isExpanded ? "▾" : "▸"}
        </button>
      </td>
      <td>${escapeHtml(po.po)}</td>
      <td>${escapeHtml(po.type)}</td>
      <td>${escapeHtml(po.external)}</td>
      <td>${escapeHtml(String(poQty(po)))}</td>
      <td>${escapeHtml(po.delivery || "")}</td>
      <td>${escapeHtml(po.date || "")}</td>
      <td>${escapeHtml(poErdValue(po).value)}</td>
      <td class="shipping">${multilineToHtml(po.shippingAddress || "")}</td>
      <td>${escapeHtml(po.incoterms || "")}</td>
      <td class="po-actions-cell"></td>
    `;

    // checkbox
    const checkCell = tr.querySelector(".col-check");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isSelected;
    cb.disabled = isArchiveView;
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
      if (cb.checked) state.selectedPoIds.add(po.id);
      else state.selectedPoIds.delete(po.id);
    });
    checkCell.appendChild(cb);

    // expand toggle
    tr.querySelector(".icon-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenus();
      state.expandedPoId = isExpanded ? null : po.id;
      render();
    });

    // Also allow clicking the row (outside checkbox/actions) to expand/collapse.
    // Makes archive rows expand reliably even if the user clicks the row text.
    tr.addEventListener("click", (e) => {
      const t = e.target;
      // Ignore interactions on checkbox or any button inside the row.
      if (t && (t.closest?.(".col-check") || t.closest?.("button") || t.closest?.("a") || t.closest?.("input"))) return;
      closeMenus();
      state.expandedPoId = (state.expandedPoId === po.id) ? null : po.id;
      render();
    });
    // actions
    const actionsCell = tr.querySelector('.po-actions-cell');
    const actions = document.createElement('div');
    actions.className = 'po-actions';


    
    // In archive view, POs are locked (no actions / no edits).
    if (isArchiveView) {
      actionsCell.appendChild(document.createTextNode(""));
      tbody.appendChild(tr);

      if (isExpanded) {
        const detailTr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 12;

        const details = document.createElement("div");
        details.className = "details";
        details.appendChild(renderVariantTable(po, { readonly: true }));
        td.appendChild(details);
        detailTr.appendChild(td);
        tbody.appendChild(detailTr);
      }
      return;
    }

    const isStock = normalize(po.type) === 'stock';

    // ERD gating for actions:
    // - Buttons are enabled only when *all* variant ERD dates are set AND have passed (<= today).
    const erdReady = Array.isArray(po.variants) && po.variants.length > 0
      ? po.variants.every(v => {
          const d = parseDateYYYYMMDD(v.erd);
          return !!d && d.getTime() <= startOfToday().getTime();
        })
      : false;

    const isProdToLocal = normalize(po.type) === 'prod_to_local';

    if (isStock) {
      const inStock = document.createElement('button');
      inStock.type = 'button';
      inStock.className = 'pill pill-done';
      inStock.textContent = 'InStock';
      // Keep original permission model, but align gating with ERD dates passed.
      inStock.disabled = !canDispatchPO() || !erdReady;
      inStock.title = inStock.disabled ? 'InStock is locked until all ERD dates have passed' : 'Move PO to Archive';
      if (!inStock.disabled) inStock.classList.add('pill-ready');
      inStock.addEventListener('click', (e) => {
        e.stopPropagation();
        if (inStock.disabled) return;
        markPoDone(po.id);
      });
      actions.appendChild(inStock);
    } else {
      if (isProdToLocal) {
        const done = document.createElement('button');
        done.type = 'button';
        done.className = 'pill pill-done';
        done.textContent = 'Done';
        done.disabled = !canDispatchPO() || !erdReady;
        done.title = done.disabled ? 'Done is locked until all ERD dates have passed' : 'Move PO to Archive';
        if (!done.disabled) done.classList.add('pill-ready');
        done.addEventListener('click', (e) => {
          e.stopPropagation();
          if (done.disabled) return;
          markPoDone(po.id);
        });
        actions.appendChild(done);
      } else {
        const toDispatch = document.createElement('button');
        toDispatch.type = 'button';
        toDispatch.className = 'pill pill-dispatch';
        toDispatch.textContent = 'To Dispatch';
        toDispatch.disabled = !canDispatchPO() || !erdReady;
        toDispatch.title = toDispatch.disabled
          ? 'To Dispatch is locked until all ERD dates have passed'
          : 'Move PO to next Dispatch + Archive';
        if (!toDispatch.disabled) toDispatch.classList.add('pill-ready');
        toDispatch.addEventListener('click', (e) => {
          e.stopPropagation();
          if (toDispatch.disabled) return;
          movePoToDispatch(po.id);
        });
        actions.appendChild(toDispatch);
      }
    }

    actionsCell.appendChild(actions);

    tbody.appendChild(tr);

    // expanded details
    if (isExpanded) {
      const detailTr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 11;

      const details = document.createElement("div");
      details.className = "details";

      const variantTable = renderVariantTable(po, { readonly: false });
      details.appendChild(variantTable);

      td.appendChild(details);
      detailTr.appendChild(td);
      tbody.appendChild(detailTr);
    }
  });

  wrap.appendChild(table);
  container.appendChild(wrap);
  return container;
}

function renderVariantTable(po, opts = {}) {
  const readonly = !!opts.readonly;
  const wrap = document.createElement("div");
  wrap.className = "variant-table";

  const head = document.createElement("div");
  head.className = "variant-head";
  head.style.gridTemplateColumns = "1.6fr 160px 140px 110px 140px 90px 90px";
head.innerHTML = `
  <div>Name</div>
  <div>SKU</div>
  <div>Category</div>
  <div>Amount</div>
  <div>ERD</div>
  <div>Notes</div>
  <div style="display:flex; align-items:center; justify-content:flex-end; gap:8px;">
    <span>Actions</span>
    <button class="pill pill-secondary" type="button" data-action="variant-newrow">NewRow</button>
  </div>
`;

  wrap.appendChild(head);
  // Header NewRow: add a new variant row to this PO
  const headerNewRowBtn = head.querySelector('[data-action="variant-newrow"]');
  if (headerNewRowBtn) {
    headerNewRowBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeMenus();
      openModal("new-row", { poId: po.id });
    });
  }


  po.variants.forEach(v => {
    const row = document.createElement("div");
    row.className = "variant-row";
    row.style.gridTemplateColumns = "1.6fr 160px 140px 110px 140px 90px 90px";


    const nameCell = document.createElement("div");
    nameCell.textContent = v.name || "";

    const skuCell = document.createElement("div");
    skuCell.textContent = v.sku || "";

    const catCell = document.createElement("div");
    const catPill = document.createElement("span");
    catPill.className = "readonly-pill";
    catPill.textContent = v.category || "";
    catCell.appendChild(catPill);



    const amtCell = document.createElement("div");
    const amt = document.createElement("input");
    amt.type = "number";
    amt.min = "0";
    amt.step = "1";
    amt.className = "input";
    amt.value = String(v.amount ?? "");
    if (readonly) {
      amt.readOnly = true;
      amt.disabled = true;
    } else {
      amt.addEventListener("change", () => {
        v.amount = Number(amt.value || 0);
        render();
      });
    }
    amtCell.appendChild(amt);

    // ERD date picker + red on change after first set
    const erdCell = document.createElement("div");
    const erd = document.createElement("input");
    erd.type = "date";
    erd.className = "input";
    erd.value = v.erd || "";

    const tryShowPicker = () => {
      if (typeof erd.showPicker === "function") {
        try { erd.showPicker(); } catch {}
      }
    };
    erd.addEventListener("focus", tryShowPicker);
    erd.addEventListener("click", tryShowPicker);

    function applyErdChangedStyle() {
      const hasOriginal = typeof v.erdOriginal === "string" && v.erdOriginal.length > 0;
      const isChanged = hasOriginal && (v.erd || "") !== v.erdOriginal;
      erd.classList.toggle("erd-changed", isChanged);
    }

    if (readonly) {
      erd.readOnly = true;
      erd.disabled = true;
    } else {
      erd.addEventListener("change", () => {
        const newVal = erd.value || "";
        if (!v.erdOriginal && newVal) v.erdOriginal = newVal; // first set
        v.erd = newVal;
        applyErdChangedStyle();
        render();
      });
    }

    applyErdChangedStyle();
    erdCell.appendChild(erd);

    // Notes PDF icon (always clickable)
    const notesCell = document.createElement("div");
    const icon = document.createElement("div");
    const hasFile = !!v.notesPdf;
    icon.className = `pdf-icon ${hasFile ? "has-file" : "empty"}`;
    icon.title = hasFile ? "View / Replace PDF" : "Upload PDF";
    icon.innerHTML = `<span>PDF</span>`;

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/pdf";
    fileInput.style.display = "none";

    if (readonly) {
      icon.title = hasFile ? "PDF (locked in archive)" : "No PDF (locked in archive)";
      icon.classList.add("is-locked");
      fileInput.disabled = true;
    } else {
      icon.addEventListener("click", (e) => {
        e.stopPropagation();
        fileInput.click();
      });

      fileInput.addEventListener("change", () => {
        const f = fileInput.files && fileInput.files[0];
        if (!f) return;
        v.notesPdf = { name: f.name, size: f.size };
        render();
        alert(`PDF attached: ${f.name} (placeholder – not uploaded anywhere yet)`);
      });
    }

    notesCell.appendChild(icon);
    notesCell.appendChild(fileInput);

    // Actions: 3 dots menu with Delete
    const actionsCell = document.createElement("div");
    if (!readonly) {
      const menuWrap = document.createElement("div");
      menuWrap.className = "menu-wrap";

      const dots = document.createElement("button");
      dots.type = "button";
      dots.className = "icon-btn";
      dots.textContent = "⋯";

      const menuKey = `variant:${po.id}:${v.id}`;
      dots.addEventListener("click", (e) => {
        e.stopPropagation();
        state.openMenuKey = (state.openMenuKey === menuKey) ? null : menuKey;
        render();
      });

      menuWrap.appendChild(dots);

      if (state.openMenuKey === menuKey) {
        const menu = document.createElement("div");
        menu.className = "menu";

        const del = document.createElement("button");
        del.className = "danger";
        del.type = "button";
        del.textContent = "Delete";
        del.addEventListener("click", (e) => {
          e.stopPropagation();
          deleteVariant(po.id, v.id);
          closeMenus();
          render();
        });

        menu.appendChild(del);
        menuWrap.appendChild(menu);
      }

      actionsCell.appendChild(menuWrap);

    } else {
      actionsCell.textContent = "";
    }

    row.append(nameCell, skuCell, catCell, amtCell, erdCell, notesCell, actionsCell);

    wrap.appendChild(row);
  });

  return wrap;
}

function deleteVariant(poId, variantId) {
  const po = state.purchaseOrders.find(p => p.id === poId);
  if (!po) return;

  const vars = Array.isArray(po.variants) ? po.variants : [];
  const v = vars.find(x => x.id === variantId);
  if (!v) return;

  // === Inventory rules on variant delete (Analytical SKU DB) ===
  // - prod_to_local  -> decrease InProduction by Amount
  // - transfer_*     -> decrease Incoming by Amount
  if (!state.analytical) state.analytical = {};
  if (!state.analytical.bySku) state.analytical.bySku = loadAnalyticalSkuDb();

  const sku = String(v.sku || "").trim();
  const amt = Number(v.amount) || 0;
  if (sku && amt > 0) {
    const rec = ensureSkuRecord(sku);
    if (po.type === "prod_to_local") {
      rec.inProduction = Math.max(0, (Number(rec.inProduction) || 0) - amt);
    } else if (po.type === "transfer_aircargo" || po.type === "transfer_boat") {
      rec.incoming = Math.max(0, (Number(rec.incoming) || 0) - amt);
    }
    saveAnalyticalSkuDb(state.analytical.bySku);
  }

  po.variants = vars.filter(x => x.id !== variantId);
}

/* =========================
   Dispatch view
========================= */
function renderDispatch() {
  const container = document.createElement("div");
  container.setAttribute("data-owned", "app");

  const extras = [];

  // NOTE: No separate Archive button here.
  const newDispatchBtn = document.createElement("button");
  newDispatchBtn.className = "btn btn-primary";
  newDispatchBtn.type = "button";
  newDispatchBtn.textContent = "New Dispatch";
  newDispatchBtn.addEventListener("click", () => openModal("new-dispatch", { date: "" }));
  extras.push(newDispatchBtn);

  container.appendChild(renderHeaderRow("Dispatch", extras));

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-expand"></th>
        <th>Date</th>
        <th>Content</th>
        <th>Action</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");
  const baseRows = state.dispatchView === 'archive'
    ? (state.dispatchArchiveRows || [])
    : (state.dispatchRows || []);

  const visibleRows = isForwarder()
    ? baseRows.filter(r => r.toForwarderSent)
    : baseRows;

  visibleRows.forEach(row => {
    const hasContent = (row.pos || []).filter(poMatchesActiveManufacturer).length > 0;
    const isExpanded = state.expandedDispatchId === row.id;
    const isArchiveView = state.dispatchView === 'archive';
    const anyExpanded = state.expandedDispatchId !== null;

    const tr = document.createElement("tr");
    // Match Purchase Orders behavior: when one row is expanded, visually gray out the others.
    if (isExpanded) {
      tr.classList.add("is-expanded");
    } else if (anyExpanded) {
      tr.classList.add("is-dimmed");
      // Inline fallback (in case host CSS doesn't style .is-dimmed)
      tr.style.opacity = ".45";
    }
    tr.innerHTML = `
      <td class="col-expand">
        <button class="icon-btn" type="button" aria-label="${isExpanded ? "Collapse" : "Expand"}" ${hasContent ? "" : "disabled"}>
          ${isExpanded ? "▾" : "▸"}
        </button>
      </td>
      <td>${escapeHtml(row.date)}</td>
      <td>${hasContent ? "YES" : "EMPTY"}</td>
      <td class="po-actions-cell"></td>
    `;

    tr.querySelector(".icon-btn").addEventListener("click", (e) => {
      e.stopPropagation();
      if (!hasContent) return;
      state.expandedDispatchId = isExpanded ? null : row.id;
      state.expandedDispatchPoKey = null;
      closeMenus();
      render();
    });

    // Also allow clicking the row (outside buttons/inputs) to expand/collapse,
    // consistent with Purchase Orders.
    tr.addEventListener("click", (e) => {
      const t = e.target;
      if (t && (t.closest?.("button") || t.closest?.("a") || t.closest?.("input") || t.closest?.("select") || t.closest?.("textarea"))) return;
      if (!hasContent) return;
      state.expandedDispatchId = (state.expandedDispatchId === row.id) ? null : row.id;
      state.expandedDispatchPoKey = null;
      closeMenus();
      render();
    });
    // actions
    const actionsCell = tr.querySelector(".po-actions-cell");
    const actions = document.createElement("div");
    actions.className = "po-actions";

    // Send row to forwarder (admin/manufacturer only)
    const toFwd = document.createElement("button");
    toFwd.type = "button";
    toFwd.className = "pill pill-dispatch";
    toFwd.textContent = row.toForwarderSent ? "Sent" : "To Forwarder";
    toFwd.disabled = isArchiveView || isForwarder() || !hasContent || row.toForwarderSent;
    toFwd.title = isForwarder()
      ? "Forwarder cannot send dispatch"
      : (row.toForwarderSent ? "Already sent" : "Send to forwarder");
    toFwd.addEventListener("click", (e) => {
      e.stopPropagation();
      if (toFwd.disabled) return;
      row.toForwarderSent = true;
      render();
    });

    // Done (requires tracking filled; admin/manufacturer only)
    const done = document.createElement("button");
    done.type = "button";
    done.className = "pill pill-done";
    done.textContent = "Done";
    const canDone = dispatchRowAllTrackingFilled(row);
    done.disabled = isArchiveView || isForwarder() || !canDone;
    done.title = canDone
      ? "Mark dispatch as done"
      : "Done is locked until all tracking fields are filled";
    if (canDone && !isForwarder()) done.classList.add("pill-ready");
    done.addEventListener("click", (e) => {
      e.stopPropagation();
      if (done.disabled) return;
      markDispatchDone(row.id);
    });

    actions.appendChild(toFwd);
    actions.appendChild(done);
    actionsCell.appendChild(actions);

    tbody.appendChild(tr);

    if (isExpanded && hasContent) {
      const dtr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 4;
      td.appendChild(renderDispatchContentTable(row));
      dtr.appendChild(td);
      tbody.appendChild(dtr);
    }
  });

  wrap.appendChild(table);
  container.appendChild(wrap);
  return container;
}

function dispatchRowAllTrackingFilled(row) {
  if (!row.pos || row.pos.length === 0) return false;
  return row.pos.every(p => String(p.tracking || "").trim().length > 0);
}



function renderCommInvoiceButton(p) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "icon-btn";
  btn.textContent = "📄";

  const label = p?.commInvoice?.label || "Commercial Invoice";
  btn.title = label;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();

    // Generate once, but do NOT open at ToDispatch time.
    let url = p?.commInvoice?.url;
    if (!url) {
      url = createCommercialInvoiceDummyPdfUrl(p?.po);
      if (p) {
        if (!p.commInvoice) p.commInvoice = { label };
        p.commInvoice.url = url;
      }
    }

    openPdfUrl(url);
  });

  return btn;
}

function renderDispatchContentTable(row) {
  const wrap = document.createElement("div");
  wrap.className = "variant-table";

  const head = document.createElement("div");
  head.className = "variant-head";
  head.style.gridTemplateColumns = "42px 42px 120px 120px 140px 80px 110px 1fr 120px 140px 160px";
  head.innerHTML = `
    <div></div>
    <div></div>
    <div>PO</div>
    <div>Delivery</div>
    <div>External</div>
    <div>Qty</div>
    <div>Date</div>
    <div>Shipping Adress</div>
    <div>Incoterms</div>
    <div>Comm Invoice</div>
    <div>Tracking</div>
  `;
  wrap.appendChild(head);

  (row.pos || []).filter(poMatchesActiveManufacturer).forEach((p, idx) => {
    const r = document.createElement("div");
    r.className = "variant-row";
    r.style.gridTemplateColumns = "42px 42px 120px 120px 140px 80px 110px 1fr 120px 140px 160px";

    const key = `${row.id}|${idx}`;
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = state.selectedDispatchPoKeys.has(key);
    cb.addEventListener("click", (e) => {
      e.stopPropagation();
      if (cb.checked) state.selectedDispatchPoKeys.add(key);
      else state.selectedDispatchPoKeys.delete(key);
    });

    const tracking = document.createElement("input");
    tracking.type = "text";
    tracking.className = "input";
    tracking.placeholder = "Tracking…";
    tracking.value = p.tracking || "";
    tracking.readOnly = state.dispatchView === 'archive' || !(isForwarder() && row.toForwarderSent);
    tracking.addEventListener("input", () => {
      p.tracking = tracking.value;
      render();
    });

    const hasVariants = Array.isArray(p?.variants) && p.variants.length > 0;

    const expBtn = document.createElement("button");
    expBtn.type = "button";
    expBtn.className = "icon-btn";
    expBtn.textContent = (state.expandedDispatchPoKey === key) ? "▾" : "▸";
    expBtn.disabled = !hasVariants;
    expBtn.title = hasVariants ? "Expand PO" : "No variants";
    expBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      state.expandedDispatchPoKey = (state.expandedDispatchPoKey === key) ? null : key;
      render();
    });

    r.append(
      wrapNode(cb),
      wrapNode(expBtn),
      cellText(p.po),
      cellText(p.delivery || ""),
      cellText(p.external || ""),
      cellText(String(p.qty ?? "")),
      cellText(p.date || ""),
      cellTextMultiline(p.shippingAddress || ""),
      cellText(p.incoterms || ""),
      wrapNode(renderCommInvoiceButton(p)),
      wrapNode(tracking)
    );

    wrap.appendChild(r);

    // Expanded PO details (variants snapshot)
    if (state.expandedDispatchPoKey === key && Array.isArray(p?.variants) && p.variants.length > 0) {
      const detail = document.createElement("div");
      detail.style.margin = "6px 0 10px";
      detail.style.padding = "10px";
      detail.style.border = "1px solid rgba(0,0,0,0.06)";
      detail.style.borderRadius = "10px";
      // Reuse the existing Variant table renderer in readonly mode
      detail.appendChild(renderVariantTable({ id: `disp-po-${p.po}`, variants: p.variants }, { readonly: true }));
      wrap.appendChild(detail);
    }
  });

  return wrap;
}


/* =========================
   Archive view
========================= */
function renderArchive(source) {
  const wrap = document.createElement("div");
  wrap.setAttribute("data-owned", "app");
  wrap.style.padding = "18px";

  const title = document.createElement("div");
  title.style.display = "flex";
  title.style.alignItems = "center";
  title.style.justifyContent = "space-between";
  title.style.marginBottom = "12px";

  const h = document.createElement("div");
  h.style.fontSize = "18px";
  h.style.fontWeight = "800";
  h.textContent = "Archive";
  title.appendChild(h);

  if (source === "purchaseorders" || source === "analytical") {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "btn btn-secondary";
    back.addEventListener("click", () => {
      if (source === "purchaseorders") {
        state.poView = "list";
        state.activeTab = "purchaseorders";
      }
      if (source === "analytical") {
        if (!state.analytical) state.analytical = {};
        state.analytical.view = "list";
        state.activeTab = "analytical-po";
      }
      render();
    });
    title.appendChild(back);
  }
  wrap.appendChild(title);

  const itemsAll = Array.isArray(state.archive) ? state.archive : [];
  const ANALYTICAL_TYPES = new Set(["prod_to_local", "transfer_aircargo", "transfer_boat"]);
  let items = itemsAll;
  if (source === "analytical") {
    items = itemsAll.filter(po => ANALYTICAL_TYPES.has(String(po.type || "").trim()));
  }

  function buildPoArchiveTable(poItems, emptyText) {
    if (!poItems || poItems.length === 0) {
      const empty = document.createElement("div");
      empty.style.opacity = ".7";
      empty.textContent = emptyText || "No archived POs.";
      return empty;
    }

    const table = document.createElement("table");
    table.className = "table";
    table.innerHTML = `
      <thead>
        <tr>
          <th class="col-expand"></th>
          <th>PO</th>
          <th>Type</th>
          <th>Date</th>
          <th>Incoterms</th>
          <th>Shipping</th>
          <th>Variants</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;

    const tbody = table.querySelector("tbody");
    poItems.forEach(po => {
      const isExpanded = state.expandedArchivePoId === po.id;
      const tr = document.createElement("tr");
      if (isExpanded) tr.classList.add("is-expanded");

      const vcount = Array.isArray(po.variants) ? po.variants.length : 0;
      tr.innerHTML = `
        <td class="col-expand">
          <button class="icon-btn" type="button" aria-label="${isExpanded ? "Collapse" : "Expand"}">
            ${isExpanded ? "▾" : "▸"}
          </button>
        </td>
        <td>${escapeHtml(String(po.po || ""))}</td>
        <td>${escapeHtml(String(po.type || ""))}</td>
        <td>${escapeHtml(String(po.date || ""))}</td>
        <td>${escapeHtml(String(po.incoterms || ""))}</td>
        <td class="shipping">${multilineToHtml(String(po.shippingAddress || ""))}</td>
        <td>${escapeHtml(String(vcount))}</td>
      `;

      const toggle = () => {
        state.expandedArchivePoId = isExpanded ? null : po.id;
        render();
      };

      tr.querySelector(".icon-btn").addEventListener("click", (e) => {
        e.stopPropagation();
        toggle();
      });

      tr.addEventListener("click", (e) => {
        const t = e.target;
        if (t && (t.closest?.("button") || t.closest?.("a") || t.closest?.("input"))) return;
        toggle();
      });

      tbody.appendChild(tr);

      if (isExpanded) {
        const detailTr = document.createElement("tr");
        const td = document.createElement("td");
        td.colSpan = 7;
        const details = document.createElement("div");
        details.className = "details";
        details.appendChild(renderVariantTable(po, { readonly: true }));
        td.appendChild(details);
        detailTr.appendChild(td);
        tbody.appendChild(detailTr);
      }
    });

    return table;
  }

  // Global Archive tab shows both PO archive and Dispatch archive.
  // Contextual archives (source provided) show only the relevant PO subset.
  if (!source) {
    const sectionTitle = (text) => {
      const d = document.createElement("div");
      d.style.margin = "14px 0 8px";
      d.style.fontWeight = "800";
      d.textContent = text;
      return d;
    };

    wrap.appendChild(sectionTitle("Purchase Orders"));
    wrap.appendChild(buildPoArchiveTable(itemsAll, "No archived POs."));

    wrap.appendChild(sectionTitle("Dispatch"));
    const rows = Array.isArray(state.dispatchArchiveRows) ? state.dispatchArchiveRows : [];
    if (rows.length === 0) {
      const empty = document.createElement("div");
      empty.style.opacity = ".7";
      empty.textContent = "No archived dispatch rows.";
      wrap.appendChild(empty);
      return wrap;
    }

    const t = document.createElement("table");
    t.className = "table";
    t.innerHTML = `
      <thead>
        <tr>
          <th>Date</th>
          <th>Content</th>
          <th>Done</th>
          <th>POs</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = t.querySelector("tbody");
    rows.forEach(r => {
  r.shopify = (Math.random() < 0.5) ? "yes" : "no";
  // Rule: Shopify=yes => Mail sent=yes, otherwise no
  r.mailSent = (r.shopify === "yes") ? "yes" : "no";
});
wrap.appendChild(t);
    return wrap;
  }

  wrap.appendChild(buildPoArchiveTable(items, "No archived POs."));
  return wrap;
}


/* =========================
   Login
========================= */
function renderLogin() {
  const wrap = document.createElement("div");
  wrap.className = "login-wrap";
  wrap.setAttribute("data-owned", "app");

  wrap.innerHTML = `
    <div class="login-card">
      <div class="login-title">Login</div>
      <div class="login-sub">Skriv ditt namn för att logga in.</div>

      <div class="form-field">
        <div class="label">Namn</div>
        <input id="loginName" class="input" type="text" placeholder="e.g. Dick" />
        <div class="hint">Tillåtna namn: ${USERS.map(u => u.name).join(", ")}</div>
      </div>

      <div class="login-actions">
        <button id="loginBtn" class="btn btn-primary" type="button">Login</button>
      </div>

      <div id="loginError" class="hint" style="color:#ef4444; display:none; margin-top:10px;"></div>
    </div>
  `;

  const input = wrap.querySelector("#loginName");
  const btn = wrap.querySelector("#loginBtn");
  const err = wrap.querySelector("#loginError");

  function attempt() {
    const name = String(input.value || "").trim();
    const found = USERS.find(u => normalize(u.name) === normalize(name));
    if (!found) {
      err.style.display = "block";
      err.textContent = "Namnet finns inte.";
      return;
    }
    setSessionUser({ name: found.name, role: found.role });
    err.style.display = "none";
    render();
  }

  btn.addEventListener("click", attempt);
  input.addEventListener("keydown", (e) => { if (e.key === "Enter") attempt(); });

  return wrap;
}

/* =========================
   Modal plumbing
========================= */
function openModal(kind, data) {
  console.log("[openModal]", kind, data);
  state.modal = {
    open: true,
    kind,
    data: data || {}
  };
  closeMenus();
  render();
}


function closeModal() {
  if (state.modal && state.modal.kind === "crm-prospects") {
    if (state.ui && state.ui.crm) {
      state.ui.crm.lastUploadRows = [];
      state.ui.crm.shopifyProcessed = false;
      state.ui.crm.showInfo = true;
    }
    try { saveCrmLastUnique([]); } catch {}
  }
  const backdrop = document.querySelector("#modalRoot .modal-backdrop");
  if (backdrop) {
    const box = backdrop.querySelector(".modal-box");

    backdrop.style.opacity = "0";
    if (box) {
      box.style.transform = "scale(0.98)";
      box.style.opacity = "0";
    }

    const onKeyDown = backdrop._onKeyDown;
    if (onKeyDown) {
      try { window.removeEventListener("keydown", onKeyDown); } catch {}
    }

    const prevOverflow = backdrop.dataset.prevOverflow || "";
    setTimeout(() => {
      try { document.body.style.overflow = prevOverflow; } catch {}
      if (state.modal) state.modal.open = false;
      try { backdrop.remove(); } catch {}
      render();
    }, 180);

    return;
  }

  if (!state.modal) state.modal = { open: false, kind: "", data: {} };
  state.modal.open = false;
  render();
}




function renderCrmProspectsModal() {
  const wrap = document.createElement("div");
  wrap.className = "modal-box";
        wrap.style.borderRadius = "40px";
  wrap.style.overflow = "hidden";
  // Size: hug the table instead of creating empty space
  wrap.style.display = "inline-block";
  wrap.style.width = "fit-content";
  wrap.style.maxWidth = "92vw";

  wrap
  wrap.style.boxShadow = "0 18px 50px rgba(0,0,0,0.18)";
  wrap.style.margin = "0";

  // Top bar
  const top = document.createElement("div");
  top.style.display = "flex";
  top.style.alignItems = "center";
  top.style.justifyContent = "space-between";
  top.style.gap = "12px";
  top.style.padding = "18px 20px";
  top
  top.style.borderBottom = "1px solid rgba(0,0,0,0.06)";

  const titleWrap = document.createElement("div");

  const title = document.createElement("div");
  title.style.fontWeight = "900";
  title.style.fontSize = "18px";
  title.textContent = "Här är dina prospects";

  const sub = document.createElement("div");
  sub.style.marginTop = "6px";
  sub.style.fontSize = "12px";
  sub.style.opacity = ".7";
  sub.textContent = "EMAIL • CATEGORI • MAIL SENT";

  titleWrap.append(title, sub);

  const actions = document.createElement("div");
  actions.style.display = "flex";
  actions.style.gap = "10px";
  actions.style.alignItems = "center";
  actions.style.flexWrap = "wrap";
  actions.style.justifyContent = "flex-end";

  const toShopifyBtn = document.createElement("button");
  toShopifyBtn.className = "btn btn-primary";
  toShopifyBtn.type = "button";
  toShopifyBtn.textContent = "ToShopify";

  const alreadyRun = !!(state.ui && state.ui.crm && state.ui.crm.shopifyProcessed);
  if (alreadyRun) {
    toShopifyBtn.disabled = true;
    toShopifyBtn.style.opacity = "0.5";
    toShopifyBtn.style.cursor = "not-allowed";
  }

  const closeBtn = document.createElement("button");
  closeBtn.className = "btn btn-secondary";
  closeBtn.type = "button";
  closeBtn.textContent = "Close";
  closeBtn.addEventListener("click", () => {
    if (state.ui && state.ui.crm) {
      state.ui.crm.lastUploadRows = [];
      state.ui.crm.shopifyProcessed = false;
      state.ui.crm.showInfo = true;
    }
    try { saveCrmLastUnique([]); } catch {}
    closeModal();
  });
actions.append(toShopifyBtn, closeBtn);
  top.append(titleWrap, actions);

  // Body
  const body = document.createElement("div");
  body.className = "modal-body";
  body.style.padding = "16px 18px 18px";
  body
  body.style.display = "flex";
  body.style.flexDirection = "column";
  body.style.alignItems = "flex-start";

  const rows = (state.ui && state.ui.crm && Array.isArray(state.ui.crm.lastUploadRows))
    ? state.ui.crm.lastUploadRows
    : [];

  // Small helper line above table
  const meta = document.createElement("div");
  meta.style.display = "flex";
  meta.style.alignItems = "center";
  meta.style.justifyContent = "space-between";
  meta.style.gap = "10px";
  meta.style.marginBottom = "10px";

  const count = document.createElement("div");
  count.style.fontSize = "12px";
  count.style.opacity = ".7";
  count.textContent = `${rows.length} rader`;

  meta.appendChild(count);
  body.appendChild(meta);

  const divider = document.createElement("div");
  divider.style.height = "1px";
  divider
  divider.style.margin = "10px 0 14px";
  body.appendChild(divider);

  toShopifyBtn.addEventListener("click", () => {
    // Run once
    if (state.ui && state.ui.crm && state.ui.crm.shopifyProcessed) return;

    rows.forEach(r => {
      r.shopify = (Math.random() < 0.5) ? "yes" : "no";
      // Rules:
      // Shopify=yes => Mail sent=yes
      // Shopify=no  => Mail sent=no
      r.mailSent = (r.shopify === "yes") ? "yes" : "no";
    });

    if (state.ui && state.ui.crm) {
      state.ui.crm.lastUploadRows = rows;
      state.ui.crm.shopifyProcessed = true;
    }

    // Dim/disable after click
    toShopifyBtn.disabled = true;
    toShopifyBtn.style.opacity = "0.5";
    toShopifyBtn.style.cursor = "not-allowed";

    render();
    alert("Alla rader har gåtts igenom");
  });

  const scroll = document.createElement("div");
  scroll.style.maxHeight = "62vh";
  scroll.style.width = "fit-content";
  scroll.style.maxWidth = "92vw";
  scroll.style.overflow = "auto";
  scroll.style.overflowX = "hidden";
  scroll.style.boxSizing = "border-box";
  scroll.style.padding = "0";
  scroll.style.scrollbarGutter = "stable";

  // Ensure right-side framing matches left even with scrollbar
  scroll.style.boxSizing = "border-box";
  scroll.style.paddingRight = "0";
  scroll.style.scrollbarGutter = "stable";
    scroll.style.padding = "0";
  scroll.style.border = "2px solid rgba(0,0,0,0.12)";
  scroll.style.borderRadius = "18px";
  scroll

  const table = document.createElement("table");
  table.className = "table";
  table.style.width = "100%";
  table.style.margin = "0";
  table.style.borderCollapse = "collapse";
  

  table.innerHTML = `
    <thead>
      <tr>
        <th style="width:56%; text-align:left; position:sticky; top:0; background:transparent; z-index:1; padding-left:16px; padding-top:16px; padding-bottom:16px;">EMAIL</th>
        <th style="width:20%; text-align:center; position:sticky; top:0; background:transparent; z-index:1; padding:16px 12px;">CATEGORI</th>
        <th style="width:12%; text-align:center; position:sticky; top:0; background:transparent; z-index:1; padding:16px 12px;">SHOPIFY</th>
        <th style="width:12%; text-align:center; position:sticky; top:0; background:transparent; z-index:1; padding:16px 12px;">MAIL SENT</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  rows.forEach((r, i) => {
    const tr = document.createElement("tr");

    const ms = String(r.mailSent || "").trim().toLowerCase();
    if (ms === "yes") {
      tr.style.backgroundColor = "rgba(34,197,94,0.18)";
    } else if (i % 2 === 1) {
      tr.style.backgroundColor = "rgba(0,0,0,0.03)";
    }
    if (String(r.mailSent).toLowerCase() === "yes") {
    }
    if (i % 2 === 1) tr

    const tdEmail = document.createElement("td");
    tdEmail.style.backgroundColor = "transparent";
    tdEmail.textContent = r.email;
    tdEmail.style.textAlign = "left";
    tdEmail.style.paddingLeft = "14px";

    const tdCat = document.createElement("td");
    tdCat.style.backgroundColor = "transparent";
    tdCat.textContent = String(r.country || "");
    tdCat.style.textAlign = "center";
    tdCat.style.padding = "18px 12px";

    const tdShopify = document.createElement("td");
    tdShopify.style.backgroundColor = "transparent";
    tdShopify.textContent = String(r.shopify || "");
    tdShopify.style.textAlign = "center";
    tdShopify.style.padding = "18px 12px";

    const tdMail = document.createElement("td");
    tdMail.style.backgroundColor = "transparent";
    tdMail.textContent = String(r.mailSent || "");
    tdMail.style.textAlign = "center";
    tdMail.style.padding = "18px 12px";

    tr.append(tdEmail, tdCat, tdShopify, tdMail);
    tbody.appendChild(tr);
  });

  scroll.appendChild(table);
  body.appendChild(scroll);

  wrap.append(top, body);
  return wrap;
}




function renderModal() {
  let root = document.getElementById("modalRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "modalRoot";
    document.body.appendChild(root);
  }
  root.innerHTML = "";

  if (!state.modal || !state.modal.open) return;

  const backdrop = document.createElement("div");
  backdrop.className = "modal-backdrop is-open";
  backdrop.style.position = "fixed";
  backdrop.style.inset = "0";
  backdrop.style.display = "flex";
  backdrop.style.alignItems = "center";
  backdrop.style.justifyContent = "center";
  backdrop.style.padding = "24px";
  backdrop
  backdrop.style.zIndex = "1000";
  backdrop.style.opacity = "0";
  backdrop.style.transition = "opacity 180ms ease";

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeModal();
  });

  // Container that holds the actual modal box
  const modal = document.createElement("div");
  modal.className = "modal";
  modal.addEventListener("click", (e) => e.stopPropagation());

  // Render the correct modal content (must return an element with class .modal-box)
  if (state.modal.kind === "create-po") modal.appendChild(renderCreatePoModal());
  if (state.modal.kind === "new-row") modal.appendChild(renderNewRowModal());
  if (state.modal.kind === "new-dispatch") modal.appendChild(renderNewDispatchModal());
  if (state.modal.kind === "settings") modal.appendChild(renderSettingsModal());
  if (state.modal.kind === "crm-prospects") modal.appendChild(renderCrmProspectsModal());
  if (state.modal.kind === "form-design") modal.appendChild(renderFormDesignModal());

  // CRM Coop modals
  if (state.modal.kind === "crm-coop-upload") modal.appendChild(renderCrmCoopUploadModal());
  if (state.modal.kind === "crm-coop-notes") modal.appendChild(renderCrmCoopNotesModal());
  if (state.modal.kind === "crm-coop-messages") modal.appendChild(renderCrmCoopMessagesModal());
  if (state.modal.kind === "crm-coop-message-view") modal.appendChild(renderCrmCoopMessageViewModal());
  if (state.modal.kind === "crm-coop-message-new") modal.appendChild(renderCrmCoopMessageNewModal());

  backdrop.appendChild(modal);
  root.appendChild(backdrop);

  // Lock background scroll while open
  const prevOverflow = document.body.style.overflow;
  backdrop.dataset.prevOverflow = prevOverflow || "";
  document.body.style.overflow = "hidden";

  // ESC closes modal
  const onKeyDown = (e) => {
    if (e.key === "Escape") closeModal();
  };
  window.addEventListener("keydown", onKeyDown);
  backdrop._onKeyDown = onKeyDown;

  // Animate in (fade + slight scale)
  const box = backdrop.querySelector(".modal-box");
  if (box) {
    box.style.transformOrigin = "50% 40%";
    box.style.transform = "scale(0.98)";
    box.style.opacity = "0";
    box.style.transition = "transform 200ms ease, opacity 200ms ease";
  }

  requestAnimationFrame(() => {
    backdrop.style.opacity = "1";
    if (box) {
      box.style.transform = "scale(1)";
      box.style.opacity = "1";
    }
  });
}


function field(labelText) {
  const wrap = document.createElement("div");
  wrap.className = "form-field";
  const label = document.createElement("div");
  label.className = "label";
  label.textContent = labelText;
  wrap.appendChild(label);
  return wrap;
}
function inputText(value) {
  const i = document.createElement("input");
  i.type = "text";
  i.className = "input";
  i.value = value || "";
  return i;
}
function cellText(text) {
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d;
}
function cellTextMultiline(text) {
  const d = document.createElement("div");
  d.innerHTML = multilineToHtml(text ?? "");
  return d;
}
function wrapNode(...nodes) {
  const d = document.createElement("div");
  nodes.forEach(n => d.appendChild(n));
  return d;
}

/* =========================
   Modal: Settings
========================= */
function renderSettingsModal() {
  // Ensure settings exist
  if (!state.settings) state.settings = { manufacturers: ["Anisa", "IERA"], manufacturer: "Anisa" };
  if (!Array.isArray(state.settings.manufacturers) || state.settings.manufacturers.length === 0) {
    state.settings.manufacturers = ["Anisa", "IERA"];
  }
  if (!state.settings.manufacturer) state.settings.manufacturer = state.settings.manufacturers[0];

  const wrap = document.createElement("div");
  wrap.className = "modal-body";

  const title = document.createElement("div");
  title.className = "modal-title";
  title.textContent = "Settings";

  const f = field("Manufacturer");
  const sel = document.createElement("select");
  sel.className = "input";

  state.settings.manufacturers.forEach(m => {
    const o = document.createElement("option");
    o.value = m;
    o.textContent = m;
    sel.appendChild(o);
  });
  sel.value = activeManufacturer();

  sel.addEventListener("change", () => {
    state.settings.manufacturer = sel.value;
  });

  f.appendChild(sel);

  const actions = document.createElement("div");
  actions.className = "modal-actions";

  const ok = document.createElement("button");
  ok.className = "btn btn-primary";
  ok.type = "button";
  ok.textContent = "OK";
  ok.addEventListener("click", () => {
    closeModal();
    // When switching manufacturer, collapse expanded rows and rerender.
    state.expandedPoId = null;
    state.expandedDispatchId = null;
    state.expandedArchivePoId = null;
    render();
  });

  actions.appendChild(ok);
  wrap.append(title, f, actions);
  return wrap;
}

/* =========================
   Modal: Create PO
========================= */
function renderCreatePoModal() {
  const data = state.modal.data;
    const ANALYTICAL_TYPES = new Set([
    "prod_to_local",
    "transfer_aircargo",
    "transfer_boat"
  ]);

  const isAnalyticalType = ANALYTICAL_TYPES.has(
    String(data.type || "").trim()
  );

  const frag = document.createDocumentFragment();

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `
    <div>
      <div class="modal-title">Create PO</div>
      <div class="modal-sub">Alla fält måste vara ifyllda.</div>
    </div>
    <button class="icon-btn" type="button" aria-label="Close">✕</button>
  `;
  header.querySelector("button").onclick = closeModal;

  const body = document.createElement("div");
  body.className = "modal-body";
  const grid = document.createElement("div");
  grid.className = "form-grid";

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  const cancel = document.createElement("button");
  cancel.className = "btn btn-secondary";
  cancel.textContent = "Cancel";
  cancel.onclick = closeModal;

  const create = document.createElement("button");
  create.className = "btn btn-primary";
  create.textContent = "Create PO";

    function validate() {
    const typeVal = String(data.type || "").trim();
    const typeOk = ["customer", "customer_to_falköping"].includes(typeVal);

    const deliveryOk = DELIVERY_VALUES.includes(String(data.delivery || "").trim());

    // External krävs bara för customer_to_falköping
    const externalOk = (typeVal === "customer_to_falköping")
      ? (String(data.external || "").trim().length > 0)
      : true;

    const dateOk = String(data.date || "").trim().length > 0;

    // Incoterms måste vara DDP eller DAP
    const incVal = String(data.incoterms || "").trim();
    const incOk = ["DDP", "DAP"].includes(incVal);

    // Shipping address:
    // - customer_to_falköping => alltid TRANSFER_ADDRESS
    // - customer => måste vara ifyllt av användaren
    const shipVal = (typeVal === "customer_to_falköping")
      ? TRANSFER_ADDRESS
      : String(data.shippingAddress || "").trim();
    const shipOk = shipVal.length > 0;

    return typeOk && deliveryOk && externalOk && dateOk && incOk && shipOk;
  }

  function syncDisabled() { create.disabled = !validate(); }

  // Type
    

const typeField = field("Type");
const typeSelect = document.createElement("select");
typeSelect.className = "input";
if (isAnalyticalType) {
  // Show analytical type but lock it (cannot be changed in Purchase Orders)
  const opt = document.createElement("option");
  opt.value = String(data.type);
  opt.textContent = String(data.type);
  opt.selected = true;
  typeSelect.appendChild(opt);
  typeSelect.disabled = true;
} else {
  ["customer", "customer_to_falköping"].forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    if ((data.type || "customer") === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });

  typeSelect.addEventListener("change", () => {
    data.type = typeSelect.value;
    if (data.type === "customer_to_falköping") data.shippingAddress = TRANSFER_ADDRESS;
    syncDisabled();
    renderModal(); // update shipping field readonly
  });
}

typeField.appendChild(typeSelect);



  // Delivery
  const delField = field("Delivery");
  const delSelect = document.createElement("select");
  delSelect.className = "input";
  DELIVERY_VALUES.forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v;
    if ((data.delivery || "Air") === v) opt.selected = true;
    delSelect.appendChild(opt);
  });
  delSelect.addEventListener("change", () => { data.delivery = delSelect.value; syncDisabled(); });
  delField.appendChild(delSelect);

  // External
   // External
  const externalField = field("External");
const externalInput = inputText(data.external || "");
  // Help text + info tooltip (robust: syns alltid)
  const externalHelp = document.createElement("div");
  externalHelp.style.display = "flex";
  externalHelp.style.alignItems = "center";
  externalHelp.style.gap = "6px";
  externalHelp.style.marginTop = "4px";
  externalHelp.style.fontSize = "12px";
  externalHelp.style.color = "#666";

  const externalInfoBtn = document.createElement("button");
  externalInfoBtn.type = "button";
  externalInfoBtn.className = "icon-btn";
  externalInfoBtn.textContent = "ℹ︎";
  externalInfoBtn.title = "Required for customer_to_falköping";
  externalInfoBtn.style.width = "22px";
  externalInfoBtn.style.height = "22px";
  externalInfoBtn.style.lineHeight = "22px";

  const externalHelpText = document.createElement("span");
  externalHelpText.textContent = "Required for customer_to_falköping";

  externalHelp.appendChild(externalInfoBtn);
  externalHelp.appendChild(externalHelpText);

externalInput.title = "Required for customer_to_falköping";
  function syncExternalRequired() {
  const isFalkoping = String(data.type || "") === "customer_to_falköping";
  const isEmpty = String(externalInput.value || "").trim() === "";

  // röd kant bara när det krävs och är tomt
  externalInput.style.borderColor =
    (isFalkoping && isEmpty) ? "red" : "";

  // visa hjälptyp bara när customer_to_falköping
  externalHelp.style.display = isFalkoping ? "flex" : "none";
}


  externalInput.addEventListener("input", () => {
    data.external = externalInput.value;
    syncExternalRequired();
    syncDisabled();
  });

  // initial state
  syncExternalRequired();

  externalField.appendChild(externalInput);
externalField.appendChild(externalHelp);


  // Date
  const dateField = field("Date");
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "input";
  dateInput.value = data.date || todayYYYYMMDD();
  dateInput.addEventListener("change", () => { data.date = dateInput.value; syncDisabled(); });
  dateField.appendChild(dateInput);

  // Incoterms
    // Incoterms
  const incField = field("Incoterms");
  const incSelect = document.createElement("select");
  incSelect.className = "input";

  ["", "DDP", "DAP"].forEach(v => {
    const opt = document.createElement("option");
    opt.value = v;
    opt.textContent = v === "" ? "Select…" : v;
    if ((data.incoterms || "") === v) opt.selected = true;
    incSelect.appendChild(opt);
  });

  incSelect.addEventListener("change", () => {
    data.incoterms = incSelect.value;
    syncDisabled();
  });

  incField.appendChild(incSelect);


  // Shipping Address
  // Shipping Address
  const shipField = field("Shipping Adress");
  shipField.classList.add("full");

  const shipArea = document.createElement("textarea");
  shipArea.className = "input";
  shipArea.style.minHeight = "90px";

  const isFalkoping = String(data.type || "customer") === "customer_to_falköping";
  shipArea.value = isFalkoping ? TRANSFER_ADDRESS : (data.shippingAddress || "");
  shipArea.readOnly = isFalkoping;

  shipArea.addEventListener("input", () => {
    data.shippingAddress = shipArea.value;
    syncDisabled();
  });

  shipField.appendChild(shipArea);


  create.onclick = () => {
    if (!validate()) return;

        const poNo = nextPoNumber();
    const typeVal = String(data.type || "customer").trim();
    const isFalkoping = typeVal === "customer_to_falköping";

    const newPo = {
      id: `po-${poNo.toLowerCase()}`,
      po: poNo,
        manufacturer: activeManufacturer(),
      type: typeVal,
      delivery: data.delivery || "Air",
      external: String(data.external || "").trim(),
      date: data.date,
      shippingAddress: isFalkoping ? TRANSFER_ADDRESS : String(data.shippingAddress || "").trim(),
      incoterms: String(data.incoterms || "").trim(),
      variants: []
    };


    state.purchaseOrders.unshift(newPo);
    state.expandedPoId = newPo.id;
    closeModal();
  };

  grid.append(typeField, delField, externalField, dateField, incField, shipField);
  body.appendChild(grid);

  footer.append(cancel, create);
  syncDisabled();

  frag.append(header, body, footer);
    // Initial markering


  return frag;
}

/* =========================
   Modal: New Row (variant)
========================= */
function renderNewRowModal() {
  const data = state.modal.data;
  const po = state.purchaseOrders.find(p => p.id === data.poId);

  const frag = document.createDocumentFragment();
  

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `
    <div>
      <div class="modal-title">New Row</div>
      <div class="modal-sub">Lägg till variant i ${escapeHtml(po?.po || "")}</div>
    </div>
    <button class="icon-btn" type="button" aria-label="Close">✕</button>
  `;
  header.querySelector("button").onclick = closeModal;

  const body = document.createElement("div");
  body.className = "modal-body";
  const grid = document.createElement("div");
  grid.className = "form-grid";

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  const cancel = document.createElement("button");
  cancel.className = "btn btn-secondary";
  cancel.textContent = "Cancel";
  cancel.onclick = closeModal;

  const save = document.createElement("button");
  save.className = "btn btn-primary";
  save.textContent = "Create";

  // ----- Fields -----

  // Category filter (shows all categories)
  const categoryField = field("Category");
  const categorySelect = document.createElement("select");
  categorySelect.className = "input";
  categoryField.appendChild(categorySelect);

  // Variant picker (populated by category)
  const variantField = field("Välj variant");
  variantField.classList.add("full");
  const variantSelect = document.createElement("select");
  variantSelect.className = "input";
  variantField.appendChild(variantSelect);

  // Auto-filled fields
  const skuField = field("SKU");
  const skuInput = inputText("");
  skuInput.readOnly = true;
  skuField.appendChild(skuInput);

  const catField = field("Category (auto)");
  const catInput = inputText("");
  catInput.readOnly = true;
  catField.appendChild(catInput);

  // Amount
  const amtField = field("Amount");
  const amtInput = document.createElement("input");
  amtInput.type = "number";
  amtInput.min = "0";
  amtInput.step = "1";
  amtInput.className = "input";
  amtInput.value = "";
  // Amount is typically short; keep it narrow if CSS supports it.
  amtField.appendChild(amtInput);

  // Notes (TXT icon + textarea) — optional
  const notesField = field("Notes");
  notesField.classList.add("full");

  const notesBtn = document.createElement("button");
  notesBtn.type = "button";
  notesBtn.className = "pdf-icon empty";
  notesBtn.title = "Notes";
  notesBtn.textContent = "TXT";

  const notesArea = document.createElement("textarea");
  notesArea.className = "input";
  notesArea.rows = 4;
  notesArea.style.display = "none";
  notesArea.value = "";

  notesBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const open = notesArea.style.display !== "none";
    notesArea.style.display = open ? "none" : "block";
    if (!open) notesArea.focus();
  });

  notesArea.addEventListener("input", () => {
    const hasText = String(notesArea.value || "").trim().length > 0;
    notesBtn.className = `pdf-icon ${hasText ? "has-file" : "empty"}`;
    syncDisabled();
  });

  notesField.appendChild(notesBtn);
  notesField.appendChild(notesArea);

  // Design (PDF icon + upload) — optional
  const designField = field("Design");
  const designBtn = document.createElement("button");
  designBtn.type = "button";
  designBtn.className = "pdf-icon empty";
  designBtn.title = "Upload Design PDF";
  designBtn.textContent = "PDF";

  const designFileInput = document.createElement("input");
  designFileInput.type = "file";
  designFileInput.accept = "application/pdf";
  designFileInput.style.display = "none";

  let designPdf = null;

  designBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    designFileInput.click();
  });

  designFileInput.addEventListener("change", () => {
    const f = designFileInput.files && designFileInput.files[0];
    if (!f) return;
    designPdf = { name: f.name, size: f.size };
    designBtn.className = "pdf-icon has-file";
    syncDisabled();
  });

  designField.appendChild(designBtn);
  designField.appendChild(designFileInput);

  // ----- Selection logic -----
  const productDb = productDbForActiveManufacturer();
  const categories = Array.from(new Set(productDb.map(p => p.category))).filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b)));

  let selectedCategory = "all";
  let selectedProduct = null;

  function setSelectedProduct(p) {
    selectedProduct = p || null;
    if (!p) {
      skuInput.value = "";
      catInput.value = selectedCategory === "all" ? "" : selectedCategory;
      syncDisabled();
      return;
    }
    skuInput.value = p.sku;
    catInput.value = p.category;
    syncDisabled();
  }

  function rebuildCategoryOptions() {
    categorySelect.innerHTML = "";
    const optAll = document.createElement("option");
    optAll.value = "all";
    optAll.textContent = "All categories";
    categorySelect.appendChild(optAll);

    categories.forEach(c => {
      const o = document.createElement("option");
      o.value = c;
      o.textContent = c;
      categorySelect.appendChild(o);
    });

    categorySelect.value = selectedCategory;
  }

  function rebuildVariantOptions() {
    variantSelect.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = selectedCategory === "all" ? "Välj kategori först…" : "Välj variant…";
    variantSelect.appendChild(placeholder);

    const list = productDb
      .filter(p => selectedCategory === "all" ? true : String(p.category||"") === selectedCategory)
      .sort((a,b)=>String(a.name||"").localeCompare(String(b.name||"")));

    list.forEach(p => {
      const o = document.createElement("option");
      o.value = p.sku; // SKU is unique enough in this app context
      o.textContent = `${p.name} (${p.sku})`;
      variantSelect.appendChild(o);
    });

    variantSelect.value = selectedProduct ? selectedProduct.sku : "";
  }

  rebuildCategoryOptions();
  rebuildVariantOptions();
  setSelectedProduct(null);

  categorySelect.addEventListener("change", () => {
    selectedCategory = categorySelect.value || "all";
    selectedProduct = null;
    catInput.value = selectedCategory === "all" ? "" : selectedCategory;
    skuInput.value = "";
    rebuildVariantOptions();
    syncDisabled();
  });

  variantSelect.addEventListener("change", () => {
    const sku = variantSelect.value;
    const p = productDb.find(x => String(x.sku||"") === String(sku||""));
    setSelectedProduct(p || null);
  });

  // ----- Save logic -----
  function canSave() {
    if (!po) return false;
    if (!selectedProduct) return false;
    const amt = Number(amtInput.value);
    return Number.isFinite(amt) && amt > 0;
  }

  function syncDisabled() {
    save.disabled = !canSave();
  }

  amtInput.addEventListener("input", syncDisabled);

  save.onclick = () => {
    if (!po) return;
    if (!canSave()) return;

    const amt = Number(amtInput.value);
    const notesText = String(notesArea.value || "").trim();

    po.variants.push({
      id: `v-${Math.random().toString(16).slice(2)}`,
      name: selectedProduct.name,
      sku: selectedProduct.sku,
      category: selectedProduct.category,
      balance: "",
      amount: amt,
      notesText: notesText,
      designPdf: designPdf,

      // TEMP: för att din befintliga PDF-ikon i variant-tabellen ska visa nåt direkt
      // (den tittar på v.notesPdf idag)
      notesPdf: designPdf || null,

      erd: "",
      erdOriginal: ""
    });

    // === Inventory rules on variant add (Analytical SKU DB) ===
    // - prod_to_local  -> increase InProduction by Amount
    // - transfer_*     -> increase Incoming by Amount
    if (!state.analytical) state.analytical = {};
    if (!state.analytical.bySku) state.analytical.bySku = loadAnalyticalSkuDb();

    const sku = String(selectedProduct.sku || "").trim();
    if (sku && amt > 0) {
      const rec = ensureSkuRecord(sku);
      if (po.type === "prod_to_local") {
        rec.inProduction = (Number(rec.inProduction) || 0) + amt;
      } else if (po.type === "transfer_aircargo" || po.type === "transfer_boat") {
        rec.incoming = (Number(rec.incoming) || 0) + amt;
      }
      saveAnalyticalSkuDb(state.analytical.bySku);
    }

    closeModal();
  };

  // Layout
  grid.append(categoryField, variantField, skuField, catField, amtField, designField, notesField);
  body.appendChild(grid);

  footer.append(cancel, save);
  syncDisabled();

  frag.append(header, body, footer);
  return frag;
}


/* =========================
   Modal: New Dispatch
========================= */
function renderNewDispatchModal() {
  const data = state.modal.data;

  const frag = document.createDocumentFragment();

  const header = document.createElement("div");
  header.className = "modal-header";
  header.innerHTML = `
    <div>
      <div class="modal-title">New Dispatch</div>
      <div class="modal-sub">Lägg till en ny Dispatch Date.</div>
    </div>
    <button class="icon-btn" type="button" aria-label="Close">✕</button>
  `;
  header.querySelector("button").onclick = closeModal;

  const body = document.createElement("div");
  body.className = "modal-body";

  const dateField = field("Date");
  dateField.classList.add("full");
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "input";
  dateInput.value = data.date || "";
  dateField.appendChild(dateInput);
  body.appendChild(dateField);

  const footer = document.createElement("div");
  footer.className = "modal-footer";

  const cancel = document.createElement("button");
  cancel.className = "btn btn-secondary";
  cancel.textContent = "Cancel";
  cancel.onclick = closeModal;

  const save = document.createElement("button");
  save.className = "btn btn-primary";
  save.textContent = "SAVE";
  save.disabled = !String(dateInput.value || "").trim();

  dateInput.addEventListener("change", () => {
    save.disabled = !String(dateInput.value || "").trim();
  });

  save.onclick = () => {
    const dt = String(dateInput.value || "").trim();
    if (!dt) return;
    const exists = state.dispatchRows.some(r => r.date === dt);
    if (!exists) {
      state.dispatchRows.push({
        id: `disp-${dt}-${Math.random().toString(16).slice(2)}`,
        date: dt,
        toForwarderSent: false,
        pos: []
      });
      sortDispatchRows();
    }
    closeModal();
  };

  footer.append(cancel, save);
  frag.append(header, body, footer);
  return frag;
}

/* =========================
========================= */
function printSelectedForCurrentTab() {
  // Print helper for Purchase Orders and Dispatch.
  // (This was previously corrupted during UI button cleanup; kept minimal and safe.)
  try {
    let title = "";
    let items = [];

    if (state.activeTab === "purchaseorders") {
      const selected = state.purchaseOrders.filter(po => state.selectedPoIds.has(po.id));
      if (selected.length === 0) {
        alert("Välj minst en PO att skriva ut.");
        return;
      }
      title = "Purchase Orders";
      items = selected;
    } else if (state.activeTab === "dispatch") {
      const selected = [];
      for (const row of state.dispatchRows) {
        (row.pos || []).filter(poMatchesActiveManufacturer).forEach((p, idx) => {
          const key = `${row.id}|${idx}`;
          if (state.selectedDispatchPoKeys.has(key)) selected.push({ dispatchDate: row.date, ...p });
        });
      }
      if (selected.length === 0) {
        alert("Välj minst en PO i Dispatch att skriva ut.");
        return;
      }
      title = "Dispatch";
      items = selected;
    } else {
      alert("Print finns bara i Purchase Orders och Dispatch.");
      return;
    }

    const html = `<!doctype html><html><head><meta charset="utf-8" />
      <title>${escapeHtml(title)}</title>
      <style>
        body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;}
        h1{margin:0 0 16px;}
        pre{white-space:pre-wrap;word-break:break-word;background:#f7f7f7;border:1px solid #e6e6e6;border-radius:12px;padding:12px;}
      </style>
    </head><body>
      <h1>${escapeHtml(title)}</h1>
      <pre>${escapeHtml(JSON.stringify(items, null, 2))}</pre>
    </body></html>`;

    const w = window.open("", "_blank");
    if (!w) {
      alert("Popup blockerad – tillåt popup för att skriva ut.");
      return;
    }
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    setTimeout(() => w.print(), 200);
  } catch (e) {
    console.error(e);
    alert("Print failed: " + (e && e.message ? e.message : String(e)));
  }
}

function openPdfUrl(url) {
  if (!url) return;
  const w = window.open(url, "_blank");
  if (!w) alert("Popup blocker – tillåt popup för att öppna PDF.");
}

// Creates a tiny, valid PDF with a single page and the text "Commercial Invoice".
// Returns an object URL (blob:...) that can be opened later.
function createCommercialInvoiceDummyPdfUrl(poNumber) {
  const po = String(poNumber || "").trim();
  const lines = ["Commercial Invoice"];
  if (po) lines.push(`PO: ${po}`);

  // Escape for PDF text strings
  const esc = (s) => String(s)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");

  // Simple content stream: write each line on a new row
  const y = 760;
  const lineHeight = 28;
  const parts = ["BT", "/F1 24 Tf", `72 ${y} Td`];
  lines.forEach((line, i) => {
    if (i > 0) parts.push(`0 -${lineHeight} Td`);
    parts.push(`(${esc(line)}) Tj`);
  });
  parts.push("ET");
  const contentStream = parts.join("\n") + "\n";

  // Build PDF objects (as template literals to preserve newlines)
  const objects = [];
  objects.push(`1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n`);
  objects.push(`2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n`);
  objects.push(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  objects.push(`4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n`);
  objects.push(`5 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}endstream\nendobj\n`);

  // Assemble with correct xref offsets
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  objects.forEach((obj) => {
    offsets.push(pdf.length);
    pdf += obj;
  });

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    pdf += String(offsets[i]).padStart(10, "0") + " 00000 n \n";
  }
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  const bytes = new TextEncoder().encode(pdf);
  const blob = new Blob([bytes], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

// Legacy name kept to avoid breaking any old click handlers.
// Opens a dummy PDF (generates on-demand). Not used when clicking ToDispatch.
function openCommercialInvoiceDummyPdf(poNumber) {
  const url = createCommercialInvoiceDummyPdfUrl(poNumber);
  openPdfUrl(url);
}

function loadCrmDb() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRM_DB);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveCrmDb(list) {
  try { localStorage.setItem(STORAGE_KEY_CRM_DB, JSON.stringify(Array.isArray(list) ? list : [])); } catch {}
}
function loadCrmLastUnique() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CRM_LAST_UNIQUE);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}
function saveCrmLastUnique(list) {
  try { localStorage.setItem(STORAGE_KEY_CRM_LAST_UNIQUE, JSON.stringify(Array.isArray(list) ? list : [])); } catch {}
}

function normalizeEmail(v) {
  return String(v || "").trim().toLowerCase();
}

function parseCrmRowsFromXlsx(arrayBuffer) {
  if (!window.XLSX) throw new Error("XLSX library missing");
  const wb = XLSX.read(arrayBuffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];

  // Read as objects keyed by the header row
  const json = XLSX.utils.sheet_to_json(ws, { defval: "" });

  const rows = [];

  json.forEach(obj => {
    // Normalize header keys: trim + lower-case (handles EMAIL vs Email vs " E-MAIL ")
    const o = {};
    Object.keys(obj || {}).forEach(k => {
      const key = String(k || "").trim().toLowerCase();
      o[key] = obj[k];
    });

    const email = normalizeEmail(
      o["email"] ?? o["e-mail"] ?? o["e_mail"] ?? o["mail"] ?? o["e-post"] ?? o["epost"]
    );

    const category = String(
      o["categori"] ?? o["kategori"] ?? o["category"] ?? o["kategori "] ?? ""
    ).trim().toLowerCase();

    if (!email) return;
    if (category !== "contract" && category !== "architect") return;

    // NOTE: Stored as "country" in CRM DB for backwards-compat with existing fields/UI.
    rows.push({ email, country: category, shopify: "", mailSent: "" });
  });

  return rows;
}


function dedupeByEmail(list) {
  const seen = new Set();
  const out = [];
  list.forEach(r => {
    const e = normalizeEmail(r.email);
    if (!e || seen.has(e)) return;
    seen.add(e);
    out.push({ email: e, country: String(r.country || "").trim() });
  });
  return out;
}



// (Removed duplicate renderCRM implementation)



function openCrmFormModal({ email, country }) {
  const emailVal = normalizeEmail(email);
  const initialCountry = String(country || "").trim();

  openModal((modalBody) => {
    modalBody.innerHTML = "";
    const h = document.createElement("div");
    h.className = "modal-title";
    h.textContent = "CRM – Formulär";
    modalBody.appendChild(h);

    const grid = document.createElement("div");
    grid.style.display = "grid";
    grid.style.gridTemplateColumns = "1fr 1fr";
    grid.style.gap = "12px";
    grid.style.marginTop = "12px";

    function field(label, inputEl) {
      const wrap = document.createElement("div");
      const lab = document.createElement("div");
      lab.style.fontSize = "12px";
      lab.style.opacity = ".75";
      lab.style.marginBottom = "6px";
      lab.textContent = label;
      wrap.append(lab, inputEl);
      return wrap;
    }
    function inputText(v, disabled = false) {
      const inp = document.createElement("input");
      inp.type = "text";
      inp.className = "input";
      inp.value = v || "";
      inp.disabled = !!disabled;
      return inp;
    }

    const firstInput = inputText("");
    const lastInput = inputText("");
    const emailInput = inputText(emailVal, true);
    const companyInput = inputText("");
    const countryInput = inputText(initialCountry);

    grid.append(
      field("Förnamn", firstInput),
      field("Efternamn", lastInput),
      field("Email", emailInput),
      field("Företag", companyInput),
      field("Country", countryInput),
      document.createElement("div")
    );
    modalBody.appendChild(grid);

    const actions = document.createElement("div");
    actions.className = "modal-actions";
    actions.style.marginTop = "16px";

    const cancel = document.createElement("button");
    cancel.className = "btn btn-secondary";
    cancel.textContent = "Cancel";
    cancel.onclick = closeModal;

    const send = document.createElement("button");
    send.className = "btn btn-primary";
    send.textContent = "Send for approval";

    function canSend() {
      return String(firstInput.value || "").trim() &&
        String(lastInput.value || "").trim() &&
        String(companyInput.value || "").trim() &&
        String(countryInput.value || "").trim() &&
        String(emailVal || "").trim();
    }
    function sync() { send.disabled = !canSend(); }
    [firstInput, lastInput, companyInput, countryInput].forEach(inp => inp.addEventListener("input", sync));
    sync();

    send.onclick = () => {
      if (!canSend()) return;

      const payload = {
        firstName: String(firstInput.value || "").trim(),
        lastName: String(lastInput.value || "").trim(),
        email: emailVal,
        company: String(companyInput.value || "").trim(),
        country: String(countryInput.value || "").trim(),
        createdAt: new Date().toISOString()
      };

      // Send email (mailto)
      const to = "dick.erixon56@gmail.com";
      const subject = `CRM approval: ${emailVal}`;
      const bodyText =
        `Please approve CRM contact:\n\n` +
        `First name: ${payload.firstName}\n` +
        `Last name: ${payload.lastName}\n` +
        `Email: ${payload.email}\n` +
        `Company: ${payload.company}\n` +
        `Country: ${payload.country}\n` +
        `Created: ${payload.createdAt}\n`;

      const mailto = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyText)}`;
      try { window.location.href = mailto; } catch {}

      closeModal();
    };

    actions.append(cancel, send);
    modalBody.appendChild(actions);
  });
}



function ensureBaseDom() {
  // If main.html is missing the expected containers, create them so the app can still render.
  // This avoids a blank page with no console errors when #contentArea doesn't exist.
  let contentArea = document.getElementById("contentArea");
  let modalRoot = document.getElementById("modalRoot");
  let tabs = document.querySelector(".tabs");

  if (contentArea && modalRoot && tabs) return;

  // Create root wrapper
  let root = document.getElementById("appRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "appRoot";
    document.body.appendChild(root);
  }

  // Topbar (tabs + actions)
  let topbar = root.querySelector(".topbar");
  if (!topbar) {
    topbar = document.createElement("div");
    topbar.className = "topbar";
    topbar.setAttribute("data-owned", "app");
    root.appendChild(topbar);
  }

  // Tabs container
  tabs = topbar.querySelector(".tabs");
  if (!tabs) {
    tabs = document.createElement("div");
    tabs.className = "tabs";
    topbar.appendChild(tabs);
  }

  // Actions container
  let actions = topbar.querySelector(".top-actions");
  if (!actions) {
    actions = document.createElement("div");
    actions.className = "top-actions";
    topbar.appendChild(actions);
  }

  // Ensure action elements exist (used by updateTopbarUserAndLogout)
  if (!document.getElementById("settingsBtn")) {
    const settingsBtn = document.createElement("button");
    settingsBtn.id = "settingsBtn";
    settingsBtn.type = "button";
    settingsBtn.className = "icon-btn";
    settingsBtn.textContent = "⚙";
    actions.appendChild(settingsBtn);
  }

  if (!document.getElementById("userPill")) {
    const userPill = document.createElement("div");
    userPill.id = "userPill";
    userPill.className = "user-pill";
    actions.appendChild(userPill);
  }

  if (!document.getElementById("logoutBtn")) {
    const logoutBtn = document.createElement("button");
    logoutBtn.id = "logoutBtn";
    logoutBtn.type = "button";
    logoutBtn.className = "btn btn-secondary";
    logoutBtn.textContent = "Logout";
    actions.appendChild(logoutBtn);
  }

  // Content area
  contentArea = document.getElementById("contentArea");
  if (!contentArea) {
    contentArea = document.createElement("div");
    contentArea.id = "contentArea";
    root.appendChild(contentArea);
  }

  // Modal root
  modalRoot = document.getElementById("modalRoot");
  if (!modalRoot) {
    modalRoot = document.createElement("div");
    modalRoot.id = "modalRoot";
    root.appendChild(modalRoot);
  }
}

/* =========================
   Init
========================= */
ensureManufacturerOnExistingPos();

function bootApp(){ ensureBaseDom(); clearSession(); render(); }
if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", bootApp, { once:true });
else bootApp();