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
 * - Print:
 *   - Print in Purchase Orders prints selected POs (opens print window; user can Save as PDF)
 *   - Print in Dispatch prints selected Dispatch POs
 */

const USERS = [
  { name: "Abbas", role: "manufacturer" },
  { name: "David", role: "admin" },
  { name: "Dick", role: "admin" },
  { name: "Mohit", role: "forwarder" },
  { name: "Jacob", role: "user" }
];

const CATEGORY_VALUES = ["Rug", "Colonnade", "Tapestry", "Covers"];
const DELIVERY_VALUES = ["Air", "Boat"];

const TRANSFER_ADDRESS =
  "Partnerlogistik\ninfo@partnerlogistik.se\nÖsterängsgatan 6\n521 39 Falköping";
const WAREHOUSE_BHADOHI_ADDRESS =
  "Warehouse Bhadohi";

const PRODUCT_DB = [
  { name: "no.01 80x120", sku: "no01x80x120", category: "Rug" },
  { name: "colonnade no.01 140x200", sku: "cno01x140x200", category: "Colonnade" }
];


const state = {
  activeTab: "purchaseorders",
  expandedPoId: null,
  expandedDispatchId: null,
  openMenuKey: null,

  selectedPoIds: new Set(),
  selectedDispatchPoKeys: new Set(), // `${dispatchRowId}|${idx}`

  purchaseOrders: [],
  archive: [],
  dispatchRows: [],

  // Analytical PO (admin)
  analytical: {
    filter: "selected",       // all | rugs | colonnade | tapestry | covers
    mode: "local",       // local | transfer
    rows: []             // [{ id, product, stock1, stock2, speedWeeks, amount }]
  },

  modal: { open: false, kind: null, data: {} },
  session: { user: null }
};


/* =========================
   Helpers
========================= */
function normalize(s) { return String(s || "").trim().toLowerCase(); }

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

function isAdmin() { return state.session.user?.role === "admin"; }
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

  state.purchaseOrders = [
    {
      id: "po-1001",
      po: "PO-1001",
      type: "transfer",
      delivery: "Boat",
      external: "#B2B-2001",
      date: todayYYYYMMDD(),
      shippingAddress: TRANSFER_ADDRESS,
      incoterms: "DAP",
      variants: [
        {
          id: "v1",
          name: "no.02 220x280",
          sku: "no02x220x280",
          category: "Rug",
          balance: 18,
          amount: 10,
          erd: "",
          erdOriginal: "",
          notesPdf: null
        }
      ]
    },
    {
      id: "po-1002",
      po: "PO-1002",
      type: "stock",
      delivery: "Air",
      external: "#B2B-2002",
      date: todayYYYYMMDD(),
      shippingAddress: "Cappelen Dimyr\ninfo@cappelendimyr.com\nStockholm",
      incoterms: "DAP",
      variants: [
        {
          id: "v2",
          name: "colonnade no.02 100x240",
          sku: "cno2x100x240",
          category: "Colonnade",
          balance: 6,
          amount: 3,
          erd: "",
          erdOriginal: "",
          notesPdf: null
        }
      ]
    }
  ];

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

  const isAdminUser = state.session.user?.role === "admin";
  const analyticalSel = '.tab[data-tab="analytical-po"]';
  const existingAnalytical = tabs.querySelector(analyticalSel);

  // Add/remove Analytical PO tab based on role
  if (isAdminUser && !existingAnalytical) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "tab";
    btn.dataset.tab = "analytical-po";
    btn.textContent = "Analytical PO";

    const archiveBtn = tabs.querySelector('.tab[data-tab="archive"]');
    if (archiveBtn) tabs.insertBefore(btn, archiveBtn);
    else tabs.appendChild(btn);
  }

  if (!isAdminUser && existingAnalytical) {
    if (state.activeTab === "analytical-po") state.activeTab = "purchaseorders";
    existingAnalytical.remove();
  }

  // Bind click handlers
  tabs.querySelectorAll(".tab").forEach(btn => {
    if (btn.__bound) return;
    btn.__bound = true;
    btn.addEventListener("click", () => {
      tabs.querySelectorAll(".tab").forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      state.activeTab = btn.dataset.tab;
      state.expandedPoId = null;
      state.expandedDispatchId = null;
      closeMenus();
      render();
    });
  });

  // Highlight current tab
  const current = Array.from(tabs.querySelectorAll(".tab")).find(b => b.dataset.tab === state.activeTab);
  if (current) {
    tabs.querySelectorAll(".tab").forEach(b => b.classList.remove("is-active"));
    current.classList.add("is-active");
  }
}


function updateTopbarUserAndLogout() {
  const topActions = document.querySelector(".top-actions");
  if (!topActions) return;

  document.getElementById("userPill")?.remove();
  document.getElementById("logoutBtn")?.remove();

  if (!state.session.user) return;

  const pill = document.createElement("div");
  pill.id = "userPill";
  pill.className = "userpill";
  pill.innerHTML = `
    <span>${escapeHtml(state.session.user.name)}</span>
    <span class="role">${escapeHtml(state.session.user.role)}</span>
  `;

  const logout = document.createElement("button");
  logout.id = "logoutBtn";
  logout.className = "icon-btn";
  logout.type = "button";
  logout.title = "Logout";
  logout.textContent = "⎋";
  logout.addEventListener("click", () => {
    closeMenus();
    state.modal.open = false;
    state.modal.kind = null;
    state.modal.data = {};
    clearSession();
    render();
  });

  topActions.prepend(logout);
  topActions.prepend(pill);
}

/* =========================
   Actions: move PO to Dispatch + Archive
========================= */
function movePoToDispatch(poId) {
  const idx = state.purchaseOrders.findIndex(p => p.id === poId);
  if (idx < 0) return;
  const po = state.purchaseOrders[idx];

  const row = nearestUpcomingDispatchRow();
  row.pos.push({
    po: po.po,
    delivery: po.delivery || "",
    external: po.external,
    qty: poQty(po),
    date: po.date,
    shippingAddress: po.shippingAddress,
    incoterms: po.incoterms,
    tracking: ""
  });

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
   Rendering entry
========================= */
function render() {
  ensureTabs();
  updateTopbarUserAndLogout();

  const area = document.getElementById("contentArea");
  if (!area) return;
  area.innerHTML = "";

  if (!state.session.user) {
    area.appendChild(renderLogin());
    renderModal();
    return;
  }

  if (state.activeTab === "purchaseorders") {
    area.appendChild(renderPurchaseOrders());
    renderModal();
    return;
  }

  if (state.activeTab === "dispatch") {
    area.appendChild(renderDispatch());
    renderModal();
    return;
  }
   {
    // Safety: only admin
    if (state.session.user?.role !== "admin") {
      state.activeTab = "purchaseorders";
      render();
      return;
    }
    area.appendChild(renderAnalyticalPO());
    renderModal();
    return;
  }

  if (state.activeTab === "inventory") {
    area.innerHTML = `
      <div data-owned="app" style="padding:24px;">
        <h2 style="margin:0 0 6px;">Inventory</h2>
        <p style="opacity:.7; margin:0;">Placeholder.</p>
      </div>
    `;
    renderModal();
    return;
  }
    


  if (state.activeTab === "archive") {
    area.appendChild(renderArchive());
    renderModal();
    return;
  }

  area.innerHTML = `<div data-owned="app" style="padding:24px;">Not implemented.</div>`;
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

  // Print BEFORE Archive
  const printBtn = document.createElement("button");
  printBtn.className = "btn btn-secondary";
  printBtn.type = "button";
  printBtn.textContent = "Print";
  printBtn.addEventListener("click", () => printSelectedForCurrentTab());

  const archiveBtn = document.createElement("button");
  archiveBtn.className = "btn btn-secondary";
  archiveBtn.type = "button";
  archiveBtn.textContent = "Archive";
  archiveBtn.addEventListener("click", () => {
    state.activeTab = "archive";
    state.expandedPoId = null;
    state.expandedDispatchId = null;
    closeMenus();
    render();
  });

  actions.appendChild(printBtn);
  actions.appendChild(archiveBtn);
  extras.forEach(n => actions.appendChild(n));

  hero.appendChild(left);
  hero.appendChild(actions);
  return hero;
}
function renderAnalyticalPO() {
  const container = document.createElement("div");
  container.setAttribute("data-owned", "app");

  // Safety: only admin
  if (state.session.user?.role !== "admin") {
    const box = document.createElement("div");
    box.style.padding = "24px";
    box.textContent = "Not authorized.";
    container.appendChild(box);
    return container;
  }

  // Ensure state defaults
  if (!state.analytical) state.analytical = {};
  if (!state.analytical.filter) state.analytical.filter = "selected";     // default = rugs
  if (!state.analytical.mode) state.analytical.mode = "local";        // local | transfer

  // Per-SKU data store (stable placeholders + amount input)
  if (!state.analytical.bySku) state.analytical.bySku = {};           // sku -> { stock1, stock2, sales3, amount }

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
    if (filter === "covers") return "Soft"; // tills ni har egen "Covers"-kategori
    return null;
  }

  function ensureSkuRecord(sku) {
    if (state.analytical.bySku[sku]) return state.analytical.bySku[sku];

    // Placeholder numbers (stable after first creation)
    const stock1 = Math.floor(Math.random() * 50);  // 0..49
    const stock2 = Math.floor(Math.random() * 50);  // 0..49
    const sales3 = 10 + Math.floor(Math.random() * 140); // 10..149

    state.analytical.bySku[sku] = {
      stock1,
      stock2,
      sales3,
      amount: 0
    };
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
    const bySku = state.analytical.bySku || {};
    const picked = Object.keys(bySku)
      .map(sku => ({ sku, rec: bySku[sku] }))
      .filter(x => Number(x.rec.amount) > 0);

    if (picked.length === 0) {
      alert("Välj minst en variant med Amount > 0.");
      return;
    }

    const mode = String(state.analytical.mode || "local"); // local | transfer
    const shippingAddress = (mode === "local") ? WAREHOUSE_BHADOHI_ADDRESS : TRANSFER_ADDRESS;

    const poObj = {
      id: `po-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      po: nextPoNumber(),
      type: mode,
      delivery: "Local",
      external: "",
      date: todayYYYYMMDD(),
      shippingAddress,
      incoterms: "local",
      variants: picked.map((x, idx) => {
        const prod = (PRODUCT_DB || []).find(p => p.sku === x.sku);
        return {
          id: `apv-${Date.now()}-${idx}-${Math.random().toString(16).slice(2)}`,
          name: prod?.name || "",
          sku: x.sku,
          category: prod?.category || "",
          amount: Number(x.rec.amount) || 0,

          // keep compatible fields (other views ignore)
          balance: 0,
          erd: "",
          erdOriginal: "",
          notesPdf: null,

          // analytical extras (optional)
          stock1: Number(x.rec.stock1) || 0,
          stock2: Number(x.rec.stock2) || 0,
          sales3: Number(x.rec.sales3) || 0
        };
      })
    };

    state.purchaseOrders.unshift(poObj);
    state.activeTab = "purchaseorders";
    state.expandedPoId = null;
    state.expandedDispatchId = null;
    render();
  }

  // Header actions (no Add row anymore)
  const createBtn = document.createElement("button");
  createBtn.className = "btn btn-primary";
  createBtn.type = "button";
  createBtn.textContent = "Create PO";
  createBtn.addEventListener("click", createPOFromAnalytical);

  container.appendChild(renderHeaderRow("Analytical PO", [createBtn]));

  // Controls (filter + type)
  const controls = document.createElement("div");
  controls.style.padding = "0 24px 12px";
  controls.style.display = "flex";
  controls.style.gap = "12px";
  controls.style.alignItems = "center";

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
    ["local", "local"],
    ["transfer", "transfer"]
  ].forEach(([val, label]) => {
    const o = document.createElement("option");
    o.value = val;
    o.textContent = label;
    modeSel.appendChild(o);
  });
  modeSel.value = state.analytical.mode;
  modeSel.addEventListener("change", () => {
    state.analytical.mode = modeSel.value;
  });

  modeWrap.append(modeLbl, modeSel);
  controls.append(filterWrap, modeWrap);
  container.appendChild(controls);

  // Build list of products to show
  
// Build list of products to show
const allProducts = PRODUCT_DB || [];
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
[
  ["Variant", "44%"],
  ["Lager 1", "9%"],
  ["Lager 2", "9%"],
  ["Sales-3", "10%"],
  ["Status", "8%"],
  ["Amount", "10%"],
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
    if (isDone) tr.style.background = "rgba(34, 197, 94, 0.08)"; // light green tint

    // Variant
    const tdVar = document.createElement("td");
    tdVar.textContent = p.name;
tdVar.style.textAlign = "left";
tdVar.style.padding = "12px 10px";
tdVar.style.overflow = "hidden";
tdVar.style.textOverflow = "ellipsis";
tdVar.style.whiteSpace = "nowrap";
    // Lager 1 / Lager 2
    const tdS1 = document.createElement("td");
    tdS1.textContent = String(rec.stock1 ?? 0);

    const tdS2 = document.createElement("td");
    tdS2.textContent = String(rec.stock2 ?? 0);

    // Sales-3
    const tdSales = document.createElement("td");
    tdSales.textContent = String(rec.sales3 ?? 0);
tdS1.style.textAlign = "center";
tdS2.style.textAlign = "center";
tdSales.style.textAlign = "center";
tdS1.style.padding = "12px 10px";
tdS2.style.padding = "12px 10px";
tdSales.style.padding = "12px 10px";

    // Status
    const tdStatus = document.createElement("td");
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

    // Amount input
    const tdAmt = document.createElement("td");
        tdAmt.style.textAlign = "center";
tdAmt.style.padding = "10px";
    const amt = document.createElement("input");
    amt.type = "number";
    amt.min = "0";
    amt.step = "1";
    amt.className = "input";
    amt.value = String(rec.amount ?? 0);

amt.style.textAlign = "center";
amt.style.width = "90px";

    amt.addEventListener("input", () => {
      rec.amount = Number(amt.value) || 0;

      // update row highlight live
      if (Number(rec.amount) > 0) tr.style.background = "rgba(34, 197, 94, 0.08)";
      else tr.style.background = "";

      // If filter is "selected", update table as soon as something becomes 0
      if (state.analytical.filter === "selected") render();
    });
    tdAmt.appendChild(amt);

    // Action: clear amount
  

    tr.append(tdVar, tdS1, tdS2, tdSales, tdStatus, tdAmt);
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
  if (canSeeNewPoNewRow()) {
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
        <th>Shipping Adress</th>
        <th>Incoterms</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;
  const tbody = table.querySelector("tbody");

  state.purchaseOrders.forEach(po => {
    const isExpanded = state.expandedPoId === po.id;
    const isSelected = state.selectedPoIds.has(po.id);

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
      <td class="shipping">${multilineToHtml(po.shippingAddress || "")}</td>
      <td>${escapeHtml(po.incoterms || "")}</td>
      <td class="po-actions-cell"></td>
    `;

    // checkbox
    const checkCell = tr.querySelector(".col-check");
    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = isSelected;
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

    // actions
    const actionsCell = tr.querySelector(".po-actions-cell");
    const actions = document.createElement("div");
    actions.className = "po-actions";

    if (po.type === "stock") {
      const inStockBtn = document.createElement("button");
      inStockBtn.type = "button";
      inStockBtn.className = "pill";
      inStockBtn.textContent = "InStock";
      inStockBtn.disabled = !erdFulfilled(po);
      inStockBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (inStockBtn.disabled) return;
        alert("InStock (placeholder) – senare kopplas detta till lagerflöde.");
      });
      actions.appendChild(inStockBtn);
    } else if (canDispatchPO()) {
      const dispatchBtn = document.createElement("button");
      dispatchBtn.type = "button";
      dispatchBtn.className = "pill pill-dispatch";
      dispatchBtn.textContent = "To Dispatch";
      dispatchBtn.disabled = !erdFulfilled(po);
dispatchBtn.title = dispatchBtn.disabled
  ? "To Dispatch är låst tills alla ERD är ifyllda och <= idag"
  : "To Dispatch";

      dispatchBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        movePoToDispatch(po.id);
      });
      actions.appendChild(dispatchBtn);
    }

  if (canSeeNewPoNewRow()) {
  const newRowBtn = document.createElement("button");
  newRowBtn.type = "button";
  newRowBtn.className = "pill pill-newrow";
  newRowBtn.textContent = "New Row";

  newRowBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openModal("new-row", { poId: po.id });
  });

  actions.appendChild(newRowBtn);
}

// Delete PO (trash) — ALWAYS LAST
const deletePoBtn = document.createElement("button");
deletePoBtn.type = "button";
deletePoBtn.className = "pill";
deletePoBtn.textContent = "🗑";
deletePoBtn.title = "Delete PO";

deletePoBtn.addEventListener("click", (e) => {
  e.preventDefault();
  e.stopPropagation();

  const ok = confirm(`Delete PO ${po.po}? This cannot be undone.`);
  if (!ok) return;

  state.purchaseOrders = state.purchaseOrders.filter(p => p.id !== po.id);
  state.selectedPoIds?.delete?.(po.id);
  if (state.expandedPoId === po.id) state.expandedPoId = null;

  render();
});

actions.appendChild(deletePoBtn);



    actionsCell.appendChild(actions);
    tbody.appendChild(tr);

    // expanded details
    if (isExpanded) {
      const detailTr = document.createElement("tr");
      const td = document.createElement("td");
      td.colSpan = 11;

      const details = document.createElement("div");
      details.className = "details";

      const variantTable = renderVariantTable(po);
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

function renderVariantTable(po) {
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
  <div>Actions</div>
`;

  wrap.appendChild(head);

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
    amt.addEventListener("change", () => {
      v.amount = Number(amt.value || 0);
      render();
    });
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

    erd.addEventListener("change", () => {
      const newVal = erd.value || "";
      if (!v.erdOriginal && newVal) v.erdOriginal = newVal; // first set
      v.erd = newVal;
      applyErdChangedStyle();
      render();
    });

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

    notesCell.appendChild(icon);
    notesCell.appendChild(fileInput);

    // Actions: 3 dots menu with Delete
    const actionsCell = document.createElement("div");
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

    row.append(nameCell, skuCell, catCell, amtCell, erdCell, notesCell, actionsCell);

    wrap.appendChild(row);
  });

  return wrap;
}

function deleteVariant(poId, variantId) {
  const po = state.purchaseOrders.find(p => p.id === poId);
  if (!po) return;
  po.variants = (po.variants || []).filter(v => v.id !== variantId);
}

/* =========================
   Dispatch view
========================= */
function renderDispatch() {
  const container = document.createElement("div");
  container.setAttribute("data-owned", "app");

  const extras = [];
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

  const visibleRows = isForwarder()
    ? state.dispatchRows.filter(r => r.toForwarderSent)
    : state.dispatchRows;

  visibleRows.forEach(row => {
    const hasContent = (row.pos || []).length > 0;
    const isExpanded = state.expandedDispatchId === row.id;

    const tr = document.createElement("tr");
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
      closeMenus();
      render();
    });

    const actionsCell = tr.querySelector(".po-actions-cell");
    const actions = document.createElement("div");
    actions.className = "po-actions";

    const toFwd = document.createElement("button");
    toFwd.type = "button";
    toFwd.className = "pill";
    toFwd.textContent = "To Forwarder";
    toFwd.disabled = !hasContent;
    toFwd.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!hasContent) return;
      row.toForwarderSent = true;
      alert(`Email to forwarder (placeholder) for Dispatch ${row.date}`);
      render();
    });

    const done = document.createElement("button");
    done.type = "button";
    done.className = "pill pill-accent";
    done.textContent = "Done";
    done.disabled = !dispatchRowAllTrackingFilled(row);
    done.addEventListener("click", (e) => {
      e.stopPropagation();
      if (done.disabled) return;
      alert(`Dispatch ${row.date} marked Done (placeholder)`);
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

function renderDispatchContentTable(row) {
  const wrap = document.createElement("div");
  wrap.className = "variant-table";

  const head = document.createElement("div");
  head.className = "variant-head";
  head.style.gridTemplateColumns = "42px 120px 120px 140px 80px 110px 1fr 120px 160px";
  head.innerHTML = `
    <div></div>
    <div>PO</div>
    <div>Delivery</div>
    <div>External</div>
    <div>Qty</div>
    <div>Date</div>
    <div>Shipping Adress</div>
    <div>Incoterms</div>
    <div>Tracking</div>
  `;
  wrap.appendChild(head);

  (row.pos || []).forEach((p, idx) => {
    const r = document.createElement("div");
    r.className = "variant-row";
    r.style.gridTemplateColumns = "42px 120px 120px 140px 80px 110px 1fr 120px 160px";

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
    tracking.readOnly = !(isForwarder() && row.toForwarderSent);
    tracking.addEventListener("input", () => {
      p.tracking = tracking.value;
      render();
    });

    r.append(
      wrapNode(cb),
      cellText(p.po),
      cellText(p.delivery || ""),
      cellText(p.external || ""),
      cellText(String(p.qty ?? "")),
      cellText(p.date || ""),
      cellTextMultiline(p.shippingAddress || ""),
      cellText(p.incoterms || ""),
      wrapNode(tracking)
    );

    wrap.appendChild(r);
  });

  return wrap;
}

/* =========================
   Archive view
========================= */
function renderArchive() {
  const container = document.createElement("div");
  container.setAttribute("data-owned", "app");
  container.appendChild(renderHeaderRow("Archive", []));

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.className = "table";
  table.innerHTML = `
    <thead>
      <tr>
        <th>PO</th>
        <th>Type</th>
        <th>External</th>
        <th>Qty</th>
        <th>Delivery</th>
        <th>Date</th>
        <th>Shipping Adress</th>
        <th>Incoterms</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");
  state.archive.forEach(po => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${escapeHtml(po.po)}</td>
      <td>${escapeHtml(po.type)}</td>
      <td>${escapeHtml(po.external)}</td>
      <td>${escapeHtml(String(poQty(po)))}</td>
      <td>${escapeHtml(po.delivery || "")}</td>
      <td>${escapeHtml(po.date || "")}</td>
      <td class="shipping">${multilineToHtml(po.shippingAddress || "")}</td>
      <td>${escapeHtml(po.incoterms || "")}</td>
    `;
    tbody.appendChild(tr);
  });

  wrap.appendChild(table);
  container.appendChild(wrap);
  return container;
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
state.modal.open = true;
  state.modal.kind = kind;
  state.modal.data = data || {};
  closeMenus();
  render();
}
function closeModal() {
  state.modal.open = false;
  state.modal.kind = null;
  state.modal.data = {};
  closeMenus();
  render();
}

function renderModal() {
  let root = document.getElementById("modalRoot");
  if (!root) {
    root = document.createElement("div");
    root.id = "modalRoot";
    document.body.appendChild(root);
  }
  root.innerHTML = "";


  const backdrop = document.createElement("div");
  backdrop.className = `modal-backdrop ${state.modal.open ? "is-open" : ""}`;
  backdrop.addEventListener("click", (e) => { if (e.target === backdrop) closeModal(); });

  if (!state.modal.open) {
    root.appendChild(backdrop);
    return;
  }

  const modal = document.createElement("div");
  modal.className = "modal";
  modal.addEventListener("click", (e) => e.stopPropagation());

  if (state.modal.kind === "create-po") modal.appendChild(renderCreatePoModal());
  if (state.modal.kind === "new-row") modal.appendChild(renderNewRowModal());
  if (state.modal.kind === "new-dispatch") modal.appendChild(renderNewDispatchModal());

  backdrop.appendChild(modal);
  root.appendChild(backdrop);
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
   Modal: Create PO
========================= */
function renderCreatePoModal() {
  const data = state.modal.data;
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
  save.textContent = "Save";

  // ----- Fields -----

  // Name + dropdown
  const nameField = field("Name");
  nameField.classList.add("full");
  const nameInput = inputText("");
  nameInput.placeholder = "Klicka för att välja…";
  nameField.appendChild(nameInput);

  const suggestBox = document.createElement("div");
  suggestBox.className = "suggest";
  suggestBox.style.display = "none";
  nameField.appendChild(suggestBox);

  const skuField = field("SKU");
  const skuInput = inputText("");
  skuInput.readOnly = true;
  skuField.appendChild(skuInput);

  const catField = field("Category");
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
  amtField.appendChild(amtInput);

  // Notes (TXT icon + textarea)
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

  // Design (PDF icon + upload)
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
  let selectedProduct = null;

  function setSelectedProduct(p) {
    selectedProduct = p;
    nameInput.value = p.name;
    skuInput.value = p.sku;
    catInput.value = p.category;
    suggestBox.style.display = "none";
    suggestBox.innerHTML = "";
    syncDisabled();
  }

  function hideSuggestions() {
    suggestBox.style.display = "none";
    suggestBox.innerHTML = "";
  }

  function refreshSuggestions(forceShowAll = false) {
    const q = String(nameInput.value || "").trim();
    const nq = normalize(q);

    const hits = PRODUCT_DB
      .filter(p => {
        if (forceShowAll && !q) return true;
        if (!q) return true;
        return normalize(p.name).includes(nq);
      })
      .slice(0, 12);

    if (hits.length === 0) {
      hideSuggestions();
      return;
    }

    suggestBox.innerHTML = "";
    hits.forEach(p => {
      const b = document.createElement("button");
      b.type = "button";
      b.innerHTML = `${escapeHtml(p.name)} <small>(${escapeHtml(p.sku)} · ${escapeHtml(p.category)})</small>`;
      b.addEventListener("click", () => setSelectedProduct(p));
      suggestBox.appendChild(b);
    });

    suggestBox.style.display = "block";
  }

  nameInput.addEventListener("focus", () => refreshSuggestions(true));
  nameInput.addEventListener("click", () => refreshSuggestions(true));

  nameInput.addEventListener("input", () => {
    selectedProduct = null;
    skuInput.value = "";
    catInput.value = "";
    refreshSuggestions(false);
    syncDisabled();
  });

  nameInput.addEventListener("blur", () => {
    setTimeout(hideSuggestions, 150);
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

    closeModal();
  };

  // Layout
  grid.append(nameField, skuField, catField, amtField, designField, notesField);
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
   Printing (opens print window)
========================= */
function printSelectedForCurrentTab() {
  if (state.activeTab === "purchaseorders") {
    const selected = state.purchaseOrders.filter(po => state.selectedPoIds.has(po.id));
    if (selected.length === 0) {
      alert("Välj minst en PO att skriva ut.");
      return;
    }
    openPrintWindow(renderPrintHtmlForPOs(selected, "Purchase Orders"));
    return;
  }

  if (state.activeTab === "dispatch") {
    const selected = [];
    for (const row of state.dispatchRows) {
      (row.pos || []).forEach((p, idx) => {
        const key = `${row.id}|${idx}`;
        if (state.selectedDispatchPoKeys.has(key)) selected.push({ dispatchDate: row.date, ...p });
      });
    }
    if (selected.length === 0) {
      alert("Välj minst en PO i Dispatch att skriva ut.");
      return;
    }
    openPrintWindow(renderPrintHtmlForDispatch(selected));
    return;
  }

  alert("Print finns bara för Purchase Orders och Dispatch.");
}

function openPrintWindow(html) {
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
}

function renderPrintHtmlForPOs(pos, title) {
  const rows = pos.map(po => `
    <div class="card">
      <h2>${escapeHtml(po.po)}</h2>
      <div class="meta">
        <div><b>Type:</b> ${escapeHtml(po.type)}</div>
        <div><b>Delivery:</b> ${escapeHtml(po.delivery || "")}</div>
        <div><b>External:</b> ${escapeHtml(po.external)}</div>
        <div><b>Date:</b> ${escapeHtml(po.date || "")}</div>
        <div><b>Incoterms:</b> ${escapeHtml(po.incoterms || "")}</div>
      </div>
      <div class="addr"><b>Shipping Address</b><br>${multilineToHtml(po.shippingAddress || "")}</div>
      <h3>Variants</h3>
      <table>
        <thead><tr><th>Name</th><th>SKU</th><th>Category</th><th>Balance</th><th>Amount</th><th>ERD</th></tr></thead>
        <tbody>
          ${(po.variants||[]).map(v => `<tr>
            <td>${escapeHtml(v.name||"")}</td>
            <td>${escapeHtml(v.sku||"")}</td>
            <td>${escapeHtml(v.category||"")}</td>
            
            <td>${escapeHtml(String(v.amount??""))}</td>
            <td>${escapeHtml(v.erd||"")}</td>
          </tr>`).join("")}
        </tbody>
      </table>
    </div>
  `).join("");

  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;}
      h1{margin:0 0 16px;}
      .card{page-break-inside:avoid;border:1px solid #ddd;border-radius:12px;padding:14px;margin:0 0 14px;}
      .meta{display:grid;grid-template-columns:1fr 1fr;gap:6px;margin:8px 0 10px;}
      .addr{margin:8px 0 10px;}
      table{width:100%;border-collapse:collapse;}
      th,td{border-top:1px solid #eee;padding:8px;text-align:left;font-size:12px;}
      th{font-size:12px;color:#555;}
    </style>
  </head><body>
    <h1>${escapeHtml(title)}</h1>
    ${rows}
  </body></html>`;
}

function renderPrintHtmlForDispatch(items) {
  const rows = items.map(p => `
    <tr>
      <td>${escapeHtml(p.po||"")}</td>
      <td>${escapeHtml(p.delivery||"")}</td>
      <td>${escapeHtml(p.external||"")}</td>
      <td>${escapeHtml(String(p.qty??""))}</td>
      <td>${escapeHtml(p.date||"")}</td>
      <td>${multilineToHtml(p.shippingAddress||"")}</td>
      <td>${escapeHtml(p.incoterms||"")}</td>
      <td>${escapeHtml(p.tracking||"")}</td>
      <td>${escapeHtml(p.dispatchDate||"")}</td>
    </tr>
  `).join("");

  return `<!doctype html><html><head><meta charset="utf-8" />
    <title>Dispatch</title>
    <style>
      body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial;margin:24px;}
      table{width:100%;border-collapse:collapse;}
      th,td{border-top:1px solid #eee;padding:8px;text-align:left;font-size:12px;vertical-align:top;}
      th{font-size:12px;color:#555;}
    </style>
  </head><body>
    <h1>Dispatch</h1>
    <table>
      <thead>
        <tr>
          <th>PO</th><th>Delivery</th><th>External</th><th>Qty</th><th>Date</th><th>Shipping</th><th>Incoterms</th><th>Tracking</th><th>Dispatch Date</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  </body></html>`;
}

/* =========================
   Init
========================= */
render();
