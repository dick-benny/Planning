/**
 * Regler:
 * - ERD (Expected Ready Date) är tomt vid skapande.
 * - Alla ERD uppfyllda = alla varianter har ett datum OCH datumet har inträffat (<= idag).
 * - Då blir To Dispatch / InStock klickbar.
 */

const state = {
  activeTab: "purchaseorders",
  expandedRowId: null,
  selectedPoIds: new Set(),
  purchaseOrders: []
};

// ---- Demo-data
state.purchaseOrders = [
  {
    id: "po-1001",
    po: "PO-1001",
    type: "Standard",
    external: "#B2B-2001",
    qty: 180,
    date: "2026-01-03",
    shippingAddress: "Partnerlogistik\ninfo@partnerlogistik.se\nÖsterängsgatan 6\n521 39 Falköping",
    incoterms: "DAP",
    hasCommercialInvoice: true,
    variants: [
      { sku: "SKU-001", name: "Sofa – Sand", category: "standard", erd: "", notePdf: null },
      { sku: "SKU-002", name: "Sofa – Coal", category: "standard", erd: "", notePdf: null }
    ]
  },
  {
    id: "po-1002",
    po: "PO-1002",
    type: "Stock",
    external: "#B2B-2002",
    qty: 42,
    date: "2026-01-02",
    shippingAddress: "N/A",
    incoterms: "FCA",
    hasCommercialInvoice: false,
    variants: [
      { sku: "SKU-010", name: "Cushion – Ivory", category: "stock", erd: "2026-01-07", notePdf: "notes_SKU-010.pdf" },
      { sku: "SKU-011", name: "Cushion – Mocha", category: "stock", erd: "", notePdf: null }
    ]
  },
  {
    id: "po-1003",
    po: "PO-1003",
    type: "Standard",
    external: "#B2B-2003",
    qty: 12,
    date: "2026-01-01",
    shippingAddress: "Älvvägen 5\n902 20 Umeå\nSweden",
    incoterms: "EXW",
    hasCommercialInvoice: true,
    variants: [
      { sku: "SKU-020", name: "Table – Walnut", category: "standard", erd: "", notePdf: null }
    ]
  }
];

// ---- Utilities
function normalize(s) {
  return String(s || "").trim().toLowerCase();
}

function escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function multilineToHtml(text) {
  return escapeHtml(text ?? "").replaceAll("\n", "<br>");
}

function parseDateYYYYMMDD(s) {
  // Parse som lokal dag (utan tidszon-problem)
  // "2026-01-07" => new Date(2026,0,7)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(s || "").trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  return new Date(y, mo, d, 0, 0, 0, 0);
}

function todayLocalStart() {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
}

function isErdFulfilledAndOccurred(erd) {
  const dt = parseDateYYYYMMDD(erd);
  if (!dt) return false;
  return dt.getTime() <= todayLocalStart().getTime();
}

// ---- Tabs
document.querySelectorAll(".tab").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab").forEach(b => b.classList.remove("is-active"));
    btn.classList.add("is-active");
    state.activeTab = btn.dataset.tab;
    state.expandedRowId = null;
    render();
  });
});

// ---- Top buttons
document.getElementById("newPoBtn")?.addEventListener("click", () => {
  alert("New PO (placeholder)");
});

document.getElementById("printBtn")?.addEventListener("click", () => {
  printSelectedPos();
});

// ---- Render
function render() {
  const area = document.getElementById("contentArea");
  area.innerHTML = "";

  if (state.activeTab !== "purchaseorders") {
    area.innerHTML = `
      <div class="empty">
        <h2>${escapeHtml(state.activeTab)}</h2>
        <p>Den här vyn är inte implementerad i prototypen.</p>
      </div>
    `;
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "table-wrap";

  const table = document.createElement("table");
  table.innerHTML = `
    <thead>
      <tr>
        <th class="col-check"></th>
        <th class="col-expand"></th>
        <th>PO</th>
        <th>Type</th>
        <th>External</th>
        <th>Qty</th>
        <th>Date</th>
        <th>Shipping Adress</th>
        <th>Incoterms</th>
        <th class="pdf-cell">Com Invoice</th>
        <th>Actions</th>
      </tr>
    </thead>
    <tbody></tbody>
  `;

  const tbody = table.querySelector("tbody");

  state.purchaseOrders.forEach(po => {
    const isExpanded = state.expandedRowId === po.id;
    const isSelected = state.selectedPoIds.has(po.id);

    const shippingText =
      normalize(po.type) === "stock" ? "local warehouse" : (po.shippingAddress || "");

    // ===== Beställningsrad
    const tr = document.createElement("tr");
    if (isExpanded) tr.classList.add("is-expanded");

    tr.innerHTML = `
      <td class="col-check"></td>
      <td class="col-expand">
        <button class="icon-btn" type="button" aria-label="${isExpanded ? "Minska beställningsrad" : "Expandera beställningsrad"}">
          ${isExpanded ? "▾" : "▸"}
        </button>
      </td>
      <td>${escapeHtml(po.po)}</td>
      <td>${escapeHtml(po.type)}</td>
      <td>${escapeHtml(po.external)}</td>
      <td>${escapeHtml(String(po.qty))}</td>
      <td>${escapeHtml(po.date)}</td>
      <td class="shipping">${multilineToHtml(shippingText)}</td>
      <td>${escapeHtml(po.incoterms)}</td>
      <td class="pdf-cell"></td>
      <td class="po-actions-cell"></td>
    `;

    // Checkbox
    const checkCell = tr.querySelector(".col-check");
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.className = "po-check";
    checkbox.checked = isSelected;
    checkbox.addEventListener("click", (e) => {
      e.stopPropagation();
      if (checkbox.checked) state.selectedPoIds.add(po.id);
      else state.selectedPoIds.delete(po.id);
    });
    checkCell.appendChild(checkbox);

    // Expand/collapse
    tr.querySelector(".icon-btn").onclick = (e) => {
      e.stopPropagation();
      state.expandedRowId = isExpanded ? null : po.id;
      render();
    };

    // Com Invoice icon
    const pdfCell = tr.children[9];
    if (po.hasCommercialInvoice) {
      const pdf = document.createElement("button");
      pdf.type = "button";
      pdf.className = "pdf-icon";
      pdf.title = "Open Commercial Invoice (placeholder)";
      pdf.textContent = "PDF";
      pdf.addEventListener("click", (e) => {
        e.stopPropagation();
        alert(`Öppna Commercial Invoice för ${po.po} (placeholder)`);
      });
      pdfCell.appendChild(pdf);
    }

    // Actions — klickbar när alla ERD har datum och datumet har inträffat
    const actionsCell = tr.querySelector(".po-actions-cell");
    const isStockType = normalize(po.type) === "stock";
    const allErdOk =
      po.variants.length > 0 &&
      po.variants.every(v => isErdFulfilledAndOccurred(v.erd));

    const actionBtn = document.createElement("button");
    actionBtn.type = "button";
    actionBtn.className = "action-btn";
    actionBtn.textContent = isStockType ? "InStock" : "To Dispatch";
    actionBtn.disabled = !allErdOk;
    if (!allErdOk) {
      actionBtn.title = "Åtgärden är endast möjlig när ERD (Expected Ready Date) är ifylld och har inträffat för alla varianter.";
    }
    actionBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (!allErdOk) return;
      alert(`${actionBtn.textContent} – ${po.po} (placeholder)`);
    });
    actionsCell.appendChild(actionBtn);

    tbody.appendChild(tr);

    // ===== Expanderat: varianttabell
    if (isExpanded) {
      const detailTr = document.createElement("tr");
      detailTr.className = "detail-row";

      const td = document.createElement("td");
      td.colSpan = 11;

      td.appendChild(renderVariantTable(po));

      detailTr.appendChild(td);
      tbody.appendChild(detailTr);
    }
  });

  wrap.appendChild(table);
  area.appendChild(wrap);
}

// ---- Variant-tabell
function renderVariantTable(po) {
  const wrap = document.createElement("div");
  wrap.className = "variant-table";

  const head = document.createElement("div");
  head.className = "variant-head";
  head.innerHTML = `
    <div>SKU</div>
    <div>Name</div>
    <div>Category</div>
    <div>ERD</div>
    <div>Notes</div>
    <div>Actions</div>
  `;
  wrap.appendChild(head);

  po.variants.forEach((v) => {
    const row = document.createElement("div");
    row.className = "variant-row";

    // ERD field (label + helper when empty)
    const erdField = document.createElement("div");
    erdField.className = "erd-field";

    const erdLabel = document.createElement("div");
    erdLabel.className = "erd-label";
    erdLabel.textContent = "ERD (Expected Ready Date)";

    const erdInput = document.createElement("input");
    erdInput.type = "date";
    erdInput.className = "erd-date";
    erdInput.value = v.erd || "";

    const helper = document.createElement("div");
    helper.className = "erd-helper";
    helper.textContent = "Select date";
    helper.style.display = (v.erd && v.erd.trim()) ? "none" : "block";

    erdInput.addEventListener("change", () => {
      v.erd = erdInput.value; // YYYY-MM-DD
      helper.style.display = (v.erd && v.erd.trim()) ? "none" : "block";
      render(); // uppdaterar huvudradens actions (enabled/disabled)
    });

    erdField.append(erdLabel, erdInput, helper);

    // Notes PDF icon (klickbar alltid)
    const notesBtn = document.createElement("button");
    notesBtn.type = "button";
    notesBtn.className = `note-pdf ${v.notePdf ? "has-file" : ""}`;
    notesBtn.textContent = "PDF";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "application/pdf";
    fileInput.style.display = "none";

    fileInput.addEventListener("change", () => {
      const file = fileInput.files && fileInput.files[0];
      if (!file) return;
      v.notePdf = file.name;
      render();
      alert(`PDF uppladdad för ${v.sku}: ${file.name} (placeholder)`);
    });

    notesBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (v.notePdf) {
        alert(`Öppna Notes-PDF för ${v.sku}: ${v.notePdf} (placeholder)`);
      } else {
        fileInput.click();
      }
    });

    // Actions (kebab)
    const kebab = document.createElement("button");
    kebab.type = "button";
    kebab.className = "kebab";
    kebab.textContent = "⋯";
    kebab.title = "Variant actions (placeholder)";
    kebab.addEventListener("click", (e) => {
      e.stopPropagation();
      alert(`Actions för variant ${v.sku} (placeholder)`);
    });

    row.append(
      cellText(v.sku),
      cellText(v.name),
      cellText(v.category),
      erdField,
      wrapNode(notesBtn, fileInput),
      kebab
    );

    wrap.appendChild(row);
  });

  return wrap;
}

function cellText(text) {
  const d = document.createElement("div");
  d.textContent = text ?? "";
  return d;
}

function wrapNode(...nodes) {
  const d = document.createElement("div");
  nodes.forEach(n => d.appendChild(n));
  return d;
}

// ---- Print (valda POs)
function printSelectedPos() {
  const selected = state.purchaseOrders.filter(po => state.selectedPoIds.has(po.id));
  if (selected.length === 0) {
    alert("Välj minst en PO att skriva ut.");
    return;
  }

  const w = window.open("", "_blank", "noopener,noreferrer,width=900,height=700");
  if (!w) {
    alert("Pop-up blockerad. Tillåt popups för att kunna skriva ut.");
    return;
  }

  const html = `
<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>Print POs</title>
  <style>
    body { font-family: Arial, sans-serif; margin: 28px; color: #111; }
    .po { page-break-after: always; }
    .po:last-child { page-break-after: auto; }
    h1 { margin: 0 0 10px; font-size: 22px; }
    .meta { margin: 0 0 14px; color: #444; font-size: 13px; }
    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
    th, td { border: 1px solid #ddd; padding: 8px; font-size: 12px; text-align: left; }
    th { background: #f5f5f5; }
    .addr { white-space: pre-line; }
  </style>
</head>
<body>
  ${selected.map(po => {
    const shipping = normalize(po.type) === "stock" ? "local warehouse" : (po.shippingAddress || "");
    return `
    <section class="po">
      <h1>${escapeHtml(po.po)}</h1>
      <p class="meta">
        <strong>Type:</strong> ${escapeHtml(po.type)} &nbsp; | &nbsp;
        <strong>External:</strong> ${escapeHtml(po.external)} &nbsp; | &nbsp;
        <strong>Qty:</strong> ${escapeHtml(String(po.qty))} &nbsp; | &nbsp;
        <strong>Date:</strong> ${escapeHtml(po.date)} &nbsp; | &nbsp;
        <strong>Incoterms:</strong> ${escapeHtml(po.incoterms)}
      </p>

      <div class="meta"><strong>Shipping Address:</strong><br><span class="addr">${escapeHtml(shipping)}</span></div>

      <table>
        <thead>
          <tr>
            <th>SKU</th>
            <th>Name</th>
            <th>Category</th>
            <th>ERD (Expected Ready Date)</th>
            <th>Notes PDF</th>
          </tr>
        </thead>
        <tbody>
          ${po.variants.map(v => `
            <tr>
              <td>${escapeHtml(v.sku)}</td>
              <td>${escapeHtml(v.name)}</td>
              <td>${escapeHtml(v.category)}</td>
              <td>${v.erd ? escapeHtml(v.erd) : "-"}</td>
              <td>${v.notePdf ? escapeHtml(v.notePdf) : "-"}</td>
            </tr>
          `).join("")}
        </tbody>
      </table>
    </section>
    `;
  }).join("")}
</body>
</html>
  `;

  w.document.open();
  w.document.write(html);
  w.document.close();

  w.focus();
  setTimeout(() => w.print(), 250);
}

// ---- Init
render();
