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
const BACKUP_DIR = path.join(DATA_DIR, "backups");
if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
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

  db.exec(`
    CREATE TABLE IF NOT EXISTS app_state_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      key TEXT NOT NULL,
      state TEXT,
      reason TEXT,
      created_at TEXT NOT NULL
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

function safeParseJson(raw, fallback = null) {
  try {
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function readCurrentPersistedState() {
  if (useSQLite && db) {
    const row = db.prepare("SELECT state FROM app_state WHERE key = ?").get("main");
    return row && row.state ? safeParseJson(row.state, null) : null;
  }
  const json = readStateFromJSON();
  return json && typeof json === "object" ? (json.state || null) : null;
}

function hasAnyRows(state) {
  const data = state && state.data;
  if (!data || typeof data !== "object") return false;
  return Object.keys(data).some((k) => Array.isArray(data[k]) && data[k].length > 0);
}

function hasAnyMessages(state) {
  if (!state || typeof state !== "object") return false;
  const msgs = Array.isArray(state.messages) ? state.messages.length : 0;
  const threads = Array.isArray(state.messageThreads) ? state.messageThreads.length : 0;
  return msgs > 0 || threads > 0;
}

function isLikelyEmptyState(state) {
  if (!state || typeof state !== "object") return true;
  return !hasAnyRows(state) && !hasAnyMessages(state);
}

function shouldBlockDestructiveOverwrite(previousState, nextState) {
  return !isLikelyEmptyState(previousState) && isLikelyEmptyState(nextState);
}

function sanitizeReason(reason) {
  return String(reason || "snapshot").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64);
}

function pruneBackupFiles(maxFiles = 80) {
  const files = fs.readdirSync(BACKUP_DIR)
    .filter((name) => name.startsWith("state_") && name.endsWith(".json"))
    .map((name) => {
      const fullPath = path.join(BACKUP_DIR, name);
      const stat = fs.statSync(fullPath);
      return { fullPath, mtimeMs: stat.mtimeMs };
    })
    .sort((a, b) => b.mtimeMs - a.mtimeMs);

  files.slice(maxFiles).forEach((f) => {
    try { fs.unlinkSync(f.fullPath); } catch {}
  });
}

function writeBackupSnapshot(state, reason) {
  if (!state || typeof state !== "object") return;
  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const fileName = `state_${stamp}_${sanitizeReason(reason)}.json`;
  const filePath = path.join(BACKUP_DIR, fileName);
  const payload = {
    reason: reason || "snapshot",
    created_at: new Date().toISOString(),
    state
  };
  fs.writeFileSync(filePath, JSON.stringify(payload, null, 2), "utf-8");
  pruneBackupFiles();
}

function appendStateHistory(state, reason) {
  if (!useSQLite || !db || !state || typeof state !== "object") return;
  db.prepare("INSERT INTO app_state_history (key, state, reason, created_at) VALUES (?, ?, ?, ?)")
    .run("main", JSON.stringify(state), String(reason || "snapshot"), new Date().toISOString());
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
    if (!state || typeof state !== "object") {
      return res.status(400).json({ error: "Body måste vara { state: {...} }" });
    }

    const updated_at = new Date().toISOString();
    const previousState = readCurrentPersistedState();
    const allowEmptyOverwrite = String(req.headers["x-allow-empty-overwrite"] || "").toLowerCase() === "true";

    if (!allowEmptyOverwrite && shouldBlockDestructiveOverwrite(previousState, state)) {
      writeBackupSnapshot(previousState, "blocked_empty_overwrite");
      appendStateHistory(previousState, "blocked_empty_overwrite");
      console.warn("🛑 Blocked destructive overwrite attempt (empty state over existing data)");
      return res.status(409).json({
        error: "Blocked potentially destructive overwrite. Existing data was kept.",
        code: "DESTRUCTIVE_OVERWRITE_BLOCKED"
      });
    }

    if (previousState) {
      writeBackupSnapshot(previousState, "pre_overwrite");
      appendStateHistory(previousState, "pre_overwrite");
    }
    
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
