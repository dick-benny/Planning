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

const CATEGORY_VALUES = ["Rug", "Colonnade", "Tapestry", "Soft"];
const DELIVERY_VALUES = ["Air", "Boat"];

const TRANSFER_ADDRESS =
  "Partnerlogistik\ninfo@partnerlogistik.se\nÖsterängsgatan 6\n521 39 Falköping";

const PRODUCT_DB = [
  { name: "no.02 220x280", sku: "no02x220x280", category: "Rug", balance: 18 },
  { name: "colonnade no.02 100x240", sku: "cno2x100x240", category: "Colonnade", balance: 6 },
  { name: "no.03 170x240", sku: "no03x170x240", category: "Rug", balance: 9 },
  { name: "soft no.02 60x90", sku: "sno02x60x90", category: "Soft", balance: 22 }
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
        type: "stock",
        delivery: "Air",
        external: "",
        date: todayYYYYMMDD(),
        incoterms: "",
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
        e.stopPropagation();
        openModal("new-row", { poId: po.id });
      });
      actions.appendChild(newRowBtn);
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
  head.style.gridTemplateColumns = "1.6fr 160px 140px 110px 110px 140px 90px 90px";
  head.innerHTML = `
    <div>Name</div>
    <div>SKU</div>
    <div>Category</div>
    <div>Balance</div>
    <div>Amount</div>
    <div>ERD</div>
    <div>Notes</div>
    <div>Actions</div>
  `;
  wrap.appendChild(head);

  po.variants.forEach(v => {
    const row = document.createElement("div");
    row.className = "variant-row";
    row.style.gridTemplateColumns = "1.6fr 160px 140px 110px 110px 140px 90px 90px";

    const nameCell = document.createElement("div");
    nameCell.textContent = v.name || "";

    const skuCell = document.createElement("div");
    skuCell.textContent = v.sku || "";

    const catCell = document.createElement("div");
    const catPill = document.createElement("span");
    catPill.className = "readonly-pill";
    catPill.textContent = v.category || "";
    catCell.appendChild(catPill);

    const balCell = document.createElement("div");
    balCell.textContent = String(v.balance ?? "");

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

    row.append(nameCell, skuCell, catCell, balCell, amtCell, erdCell, notesCell, actionsCell);
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
  const root = document.getElementById("modalRoot");
  if (!root) return;
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
    const typeOk = ["stock", "transfer"].includes(String(data.type || "").trim());
    const deliveryOk = DELIVERY_VALUES.includes(String(data.delivery || "").trim());
    const externalOk = String(data.external || "").trim().length > 0;
    const dateOk = String(data.date || "").trim().length > 0;
    const incOk = String(data.incoterms || "").trim().length > 0;

    const shipVal = (String(data.type || "").trim() === "transfer")
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
  ["stock", "transfer"].forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    if ((data.type || "stock") === t) opt.selected = true;
    typeSelect.appendChild(opt);
  });
  typeSelect.addEventListener("change", () => {
    data.type = typeSelect.value;
    if (data.type === "transfer") data.shippingAddress = TRANSFER_ADDRESS;
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
  const externalField = field("External");
  const externalInput = inputText(data.external || "");
  externalInput.placeholder = "#B2B-2001";
  externalInput.addEventListener("input", () => { data.external = externalInput.value; syncDisabled(); });
  externalField.appendChild(externalInput);

  // Date
  const dateField = field("Date");
  const dateInput = document.createElement("input");
  dateInput.type = "date";
  dateInput.className = "input";
  dateInput.value = data.date || todayYYYYMMDD();
  dateInput.addEventListener("change", () => { data.date = dateInput.value; syncDisabled(); });
  dateField.appendChild(dateInput);

  // Incoterms
  const incField = field("Incoterms");
  const incInput = inputText(data.incoterms || "");
  incInput.placeholder = "DAP";
  incInput.addEventListener("input", () => { data.incoterms = incInput.value; syncDisabled(); });
  incField.appendChild(incInput);

  // Shipping Address
  const shipField = field("Shipping Adress");
  shipField.classList.add("full");
  const shipArea = document.createElement("textarea");
  shipArea.className = "input";
  shipArea.style.minHeight = "90px";

  const isTransfer = String(data.type || "stock") === "transfer";
  shipArea.value = isTransfer ? TRANSFER_ADDRESS : (data.shippingAddress || "");
  shipArea.readOnly = isTransfer;

  shipArea.addEventListener("input", () => {
    data.shippingAddress = shipArea.value;
    syncDisabled();
  });
  shipField.appendChild(shipArea);

  create.onclick = () => {
    if (!validate()) return;

    const poNo = nextPoNumber();
    const isTransferNow = String(data.type || "stock") === "transfer";

    const newPo = {
      id: `po-${poNo.toLowerCase()}`,
      po: poNo,
      type: data.type || "stock",
      delivery: data.delivery || "Air",
      external: data.external.trim(),
      date: data.date,
      shippingAddress: isTransferNow ? TRANSFER_ADDRESS : String(data.shippingAddress || "").trim(),
      incoterms: data.incoterms.trim(),
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

  const add = document.createElement("button");
  add.className = "btn btn-primary";
  add.textContent = "Add Row";

  // Fields
  const nameField = field("Name");
  nameField.classList.add("full");
  const nameInput = inputText("");
  nameInput.placeholder = "Sök… (minst 2 tecken)";
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

  const balField = field("Balance");
  const balInput = inputText("");
  balInput.readOnly = true;
  balField.appendChild(balInput);

  const amtField = field("Amount");
  const amtInput = document.createElement("input");
  amtInput.type = "number";
  amtInput.min = "0";
  amtInput.step = "1";
  amtInput.className = "input";
  amtInput.value = "";
  amtField.appendChild(amtInput);

  let selectedProduct = null;

  function setSelectedProduct(p) {
    selectedProduct = p;
    nameInput.value = p.name;
    skuInput.value = p.sku;
    catInput.value = p.category;
    balInput.value = String(po?.type === "transfer" ? (p.balance ?? 0) : "");
    suggestBox.style.display = "none";
    suggestBox.innerHTML = "";
    syncDisabled();
  }

  function refreshSuggestions() {
    const q = String(nameInput.value || "").trim();
    if (q.length < 2) {
      suggestBox.style.display = "none";
      suggestBox.innerHTML = "";
      return;
    }
    const hits = PRODUCT_DB
      .filter(p => normalize(p.name).includes(normalize(q)))
      .slice(0, 6);

    if (hits.length === 0) {
      suggestBox.style.display = "none";
      suggestBox.innerHTML = "";
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

  nameInput.addEventListener("input", () => {
    selectedProduct = null;
    skuInput.value = "";
    catInput.value = "";
    balInput.value = "";
    refreshSuggestions();
    syncDisabled();
  });

  function canAdd() {
    if (!po) return false;
    if (!selectedProduct) return false;
    const amt = Number(amtInput.value);
    return Number.isFinite(amt) && amt > 0;
  }
  function syncDisabled() { add.disabled = !canAdd(); }
  amtInput.addEventListener("input", syncDisabled);

  add.onclick = () => {
    if (!po) return;
    if (!canAdd()) return;

    const amt = Number(amtInput.value);
    po.variants.push({
      id: `v-${Math.random().toString(16).slice(2)}`,
      name: selectedProduct.name,
      sku: selectedProduct.sku,
      category: selectedProduct.category,
      balance: po.type === "transfer" ? (selectedProduct.balance ?? 0) : "",
      amount: amt,
      erd: "",
      erdOriginal: "",
      notesPdf: null
    });

    closeModal();
  };

  grid.append(nameField, skuField, catField, balField, amtField);
  body.appendChild(grid);
  footer.append(cancel, add);
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
            <td>${escapeHtml(String(v.balance??""))}</td>
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
