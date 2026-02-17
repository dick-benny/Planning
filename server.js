const express = require("express");
const fs = require("fs");
const path = require("path");
const Database = require("better-sqlite3");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));

// Servera dina statiska filer (main.html, CSS, JS, data, images, libs)
app.use(express.static(path.join(__dirname)));

// SQLite database
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const DB_FILE = path.join(DATA_DIR, "app.db");
const db = new Database(DB_FILE);

// Initialize tables
db.exec(`
  CREATE TABLE IF NOT EXISTS app_state (
    key TEXT PRIMARY KEY,
    state TEXT,
    updated_at TEXT
  )
`);

// Insert default state if not exists
const checkState = db.prepare("SELECT key FROM app_state WHERE key = ?").get("main");
if (!checkState) {
  db.prepare("INSERT INTO app_state (key, state, updated_at) VALUES (?, ?, ?)").run(
    "main",
    null,
    new Date().toISOString()
  );
}

// Sökväg till JSON-"databasen" (legacy for customers)
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

// GET: hämta app state
app.get("/api/state", (req, res) => {
  try {
    const row = db.prepare("SELECT * FROM app_state WHERE key = ?").get("main");
    if (!row) {
      return res.json({ key: "main", state: null, updated_at: null });
    }
    res.json({
      key: row.key,
      state: row.state ? JSON.parse(row.state) : null,
      updated_at: row.updated_at
    });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

// POST: spara app state
app.post("/api/state", (req, res) => {
  try {
    const state = req.body?.state;
    const stateJson = JSON.stringify(state);
    const updated_at = new Date().toISOString();
    
    db.prepare(`
      INSERT INTO app_state (key, state, updated_at) 
      VALUES (?, ?, ?)
      ON CONFLICT(key) DO UPDATE SET 
        state = excluded.state,
        updated_at = excluded.updated_at
    `).run("main", stateJson, updated_at);
    
    res.json({ ok: true, updated_at });
  } catch (err) {
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}/index.html`);
});
