const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));

// Servera dina statiska filer (main.html, CSS, JS, data, images, libs)
app.use(express.static(path.join(__dirname)));

// Sökväg till JSON-"databasen"
const DB_PATH = path.join(__dirname, "data", "db.json");

function readDb() {
  const raw = fs.readFileSync(DB_PATH, "utf-8");
  const data = JSON.parse(raw);
  if (!Array.isArray(data)) throw new Error("db.json måste vara en array");
  return data;
}

function writeDb(rows) {
  fs.writeFileSync(DB_PATH, JSON.stringify(rows, null, 2), "utf-8");
}

// GET: hämta alla kunder
app.get("/api/customers", (req, res) => {
  try {
    const data = readDb();
    res.json(data);
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// POST: lägg till nya kunder (append, unik på email)
app.post("/api/customers", (req, res) => {
  try {
    const incoming = req.body?.rows;
    if (!Array.isArray(incoming)) {
      return res.status(400).json({ error: "Body måste vara { rows: [...] }" });
    }

    const db = readDb();
    const normalizeEmail = (v) => String(v ?? "").trim().toLowerCase();
    const emailSet = new Set(db.map((r) => normalizeEmail(r.email)));

    const toAdd = incoming
      .map(r => ({
        email: String(r.email ?? "").trim(),
        company: String(r.company ?? "").trim(),
        country: String(r.country ?? "").trim(),
      }))
      .filter(r => normalizeEmail(r.email)) // måste ha email
      .filter(r => !emailSet.has(normalizeEmail(r.email)));

    const next = [...db, ...toAdd];
    writeDb(next);

    res.json({ added: toAdd.length, total: next.length });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}/main.html`);
});
