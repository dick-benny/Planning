const express = require("express");
const fs = require("fs");
const path = require("path");

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: "5mb" }));

// Servera dina statiska filer (main.html, CSS, JS, data, images, libs)
app.use(express.static(path.join(__dirname)));

// SQLite database - with fallback to JSON if native module fails
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let db = null;
let useSQLite = false;

try {
  const Database = require("better-sqlite3");
  const DB_FILE = path.join(DATA_DIR, "app.db");
  db = new Database(DB_FILE);
  
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
  
  useSQLite = true;
  console.log("✓ Using SQLite database");
} catch (err) {
  console.warn("⚠ SQLite failed, falling back to JSON file:", err.message);
  useSQLite = false;
}

// JSON fallback for state storage
const STATE_JSON_PATH = path.join(DATA_DIR, "state.json");

function readStateFromJSON() {
  try {
    if (!fs.existsSync(STATE_JSON_PATH)) {
      return { key: "main", state: null, updated_at: new Date().toISOString() };
    }
    const raw = fs.readFileSync(STATE_JSON_PATH, "utf-8");
    return JSON.parse(raw);
  } catch (err) {
    console.error("Error reading state JSON:", err);
    return { key: "main", state: null, updated_at: new Date().toISOString() };
  }
}

function writeStateToJSON(state, updated_at) {
  const data = { key: "main", state, updated_at };
  fs.writeFileSync(STATE_JSON_PATH, JSON.stringify(data, null, 2), "utf-8");
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
    if (useSQLite && db) {
      const row = db.prepare("SELECT * FROM app_state WHERE key = ?").get("main");
      console.log("📤 GET /api/state (SQLite):", row);
      if (!row) {
        return res.json({ key: "main", state: null, updated_at: null });
      }
      res.json({
        key: row.key,
        state: row.state ? JSON.parse(row.state) : null,
        updated_at: row.updated_at
      });
    } else {
      // JSON fallback
      const data = readStateFromJSON();
      console.log("📤 GET /api/state (JSON):", data);
      res.json(data);
    }
  } catch (err) {
    console.error("GET /api/state error:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

// POST: spara app state
app.post("/api/state", (req, res) => {
  try {
    const state = req.body?.state;
    const updated_at = new Date().toISOString();
    
    console.log("📥 POST /api/state - State size:", JSON.stringify(state).length, "bytes");
    
    if (useSQLite && db) {
      const stateJson = JSON.stringify(state);
      db.prepare(`
        INSERT INTO app_state (key, state, updated_at) 
        VALUES (?, ?, ?)
        ON CONFLICT(key) DO UPDATE SET 
          state = excluded.state,
          updated_at = excluded.updated_at
      `).run("main", stateJson, updated_at);
      console.log("💾 Saved to SQLite successfully");
      res.json({ ok: true, updated_at });
    } else {
      // JSON fallback
      writeStateToJSON(state, updated_at);
      console.log("💾 Saved to JSON successfully");
      res.json({ ok: true, updated_at });
    }
  } catch (err) {
    console.error("POST /api/state error:", err);
    res.status(500).json({ error: String(err.message || err) });
  }
});

app.listen(PORT, () => {
  console.log(`Server running: http://localhost:${PORT}/index.html`);
});
