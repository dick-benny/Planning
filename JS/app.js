(() => {
  const els = {
    fileInput: document.getElementById("fileInput"),
    fileName: document.getElementById("fileName"),
    status: document.getElementById("status"),

    btnView: document.getElementById("btnView"),
    btnSave: document.getElementById("btnSave"),

    modal: document.getElementById("modal"),
    excelMeta: document.getElementById("excelMeta"),
    excelTable: document.getElementById("excelTable"),
    btnClose: document.getElementById("btnClose"),
  };

  let dbRows = [];
  let excelRows = [];
  let newRows = [];
  let excelSheetName = "";

  function show(el) { el.classList.remove("hidden"); }
  function hide(el) { el.classList.add("hidden"); }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function normalizeEmail(v) {
    return String(v ?? "").trim().toLowerCase();
  }

  function openModal() {
    els.modal.setAttribute("aria-hidden", "false");
    show(els.modal);
  }

  function closeModal() {
    els.modal.setAttribute("aria-hidden", "true");
    hide(els.modal);
  }

  async function loadDb() {
    try {
      // När du kör via node server.js ska detta funka:
      // GET http://localhost:3000/api/customers
      const res = await fetch("/api/customers", { cache: "no-store" });
      if (!res.ok) throw new Error(`Kunde inte läsa /api/customers (${res.status})`);

      const data = await res.json();
      if (!Array.isArray(data)) throw new Error("DB måste vara en JSON-array ([])");

      dbRows = data;
      els.status.textContent = `✅ DB laddad: ${dbRows.length} poster`;
    } catch (err) {
      console.error(err);
      els.status.textContent =
        "⚠️ DB kunde inte laddas. Kör du via node server.js och öppnar http://localhost:3000/main.html ?";
    }
  }

  function computeNewRows() {
    const dbEmailSet = new Set(dbRows.map(r => normalizeEmail(r.email)));

    newRows = excelRows.filter(r => {
      const email = normalizeEmail(r.email);
      return email && !dbEmailSet.has(email);
    });
  }

  function renderTable(rows, highlightEmailSet) {
    if (!rows || rows.length === 0) {
      els.excelTable.innerHTML = `<div style="padding:14px;">Inga rader hittades.</div>`;
      return;
    }

    const headers = ["email", "company", "country"];

    els.excelTable.innerHTML = `
      <table class="table">
        <thead>
          <tr>${headers.map(h => `<th>${escapeHtml(h)}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map(r => {
            const emailNorm = normalizeEmail(r.email);
            const isNew = highlightEmailSet?.has(emailNorm);

            return `
              <tr class="${isNew ? "row-new" : ""}">
                ${headers.map(h => {
                  const v = r[h];
                  const text = (v === null || v === undefined || v === "") ? "" : String(v);
                  return text
                    ? `<td title="${escapeHtml(text)}">${escapeHtml(text)}</td>`
                    : `<td class="cell-empty">–</td>`;
                }).join("")}
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
    `;
  }

  // --- init UI ---
  hide(els.btnView);
  hide(els.btnSave);
  hide(els.modal);
  els.modal.setAttribute("aria-hidden", "true");

  els.btnClose.addEventListener("click", closeModal);

  els.modal.addEventListener("click", (e) => {
    if (e.target?.dataset?.close === "true") closeModal();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !els.modal.classList.contains("hidden")) closeModal();
  });

  // Ladda DB direkt när sidan laddas
  loadDb();

  // --- Excel upload ---
  els.fileInput.addEventListener("change", async () => {
    const file = els.fileInput.files?.[0];

    // reset varje gång
    els.status.textContent = "";
    excelRows = [];
    newRows = [];
    excelSheetName = "";
    hide(els.btnView);
    hide(els.btnSave);

    if (!file) {
      els.fileName.textContent = "Ingen fil vald";
      return;
    }

    if (!file.name.toLowerCase().endsWith(".xlsx")) {
      els.fileName.textContent = "❌ Endast .xlsx-filer är tillåtna";
      els.fileInput.value = "";
      return;
    }

    els.fileName.textContent = file.name;
    els.status.textContent = "Läser Excel…";

    try {
      if (typeof XLSX === "undefined") {
        throw new Error("XLSX saknas. Kontrollera att libs/xlsx.full.min.js laddas.");
      }

      const buffer = await file.arrayBuffer();
      const wb = XLSX.read(buffer, { type: "array" });
      excelSheetName = wb.SheetNames[0];
      const sheet = wb.Sheets[excelSheetName];

      excelRows = XLSX.utils.sheet_to_json(sheet, { defval: "" })
        .map(r => ({
          email: r.email ?? r.Email ?? r.Epost ?? r["e-mail"] ?? "",
          company: r.company ?? r.Company ?? r.Företag ?? "",
          country: r.country ?? r.Country ?? r.Land ?? "",
        }))
        .map(r => ({
          email: String(r.email).trim(),
          company: String(r.company).trim(),
          country: String(r.country).trim(),
        }))
        .filter(r => r.email || r.company || r.country);

      const missingEmail = excelRows.filter(r => !normalizeEmail(r.email)).length;

      computeNewRows();

      els.status.textContent =
        `✅ Excel inläst. Rader: ${excelRows.length} (utan email: ${missingEmail}) • Nya: ${newRows.length}`;

      show(els.btnView);
      show(els.btnSave);
    } catch (err) {
      console.error(err);
      els.status.textContent = "❌ Kunde inte läsa Excel-filen. Se Console.";
    }
  });

  // --- View ---
  els.btnView.addEventListener("click", () => {
    const highlightSet = new Set(newRows.map(r => normalizeEmail(r.email)));

    els.excelMeta.textContent =
      `Blad: "${excelSheetName}" • Excel-rader: ${excelRows.length} • Nya (ej i DB): ${newRows.length}`;

    renderTable(excelRows, highlightSet);
    openModal();
  });

  // --- Save (append-only, IGNORERA dubletter) ---
  els.btnSave.addEventListener("click", async () => {
    if (newRows.length === 0) {
      els.status.textContent = "ℹ Inget att spara. Inga nya poster.";
      return;
    }

    try {
      els.status.textContent = "Sparar…";

      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: newRows }),
      });

      if (!res.ok) throw new Error(`Save misslyckades (${res.status})`);

      const result = await res.json();

      await loadDb();
      computeNewRows();

      els.status.textContent = `✅ Sparade ${result.added} nya poster. Totalt i DB: ${result.total}`;
    } catch (err) {
      console.error(err);
      els.status.textContent = "❌ Save misslyckades. Se Console.";
    }
  });
})();
