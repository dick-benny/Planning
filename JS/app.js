(() => {
  "use strict";
  // -------------------------------
  // AUTH (localStorage)
  // -------------------------------
  const AUTH_USERS_KEY = "up_auth_users_v1";
  const AUTH_SESSION_KEY = "up_auth_session_v1";

  function uid(prefix = "id") {
    return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
  }

  function truncateText(str, maxLen = 26) {
    const full = (str ?? "").toString();
    if (full.length <= maxLen) return { short: full, full, truncated: false };
    return { short: full.slice(0, Math.max(0, maxLen - 1)) + "…", full, truncated: true };
  }

  function loadJson(key) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  function saveJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function seedUsersIfMissing() {
    const users = loadJson(AUTH_USERS_KEY);
    if (Array.isArray(users) && users.length) {
      const dick = users.find((u) => (u.username || "").toLowerCase() === "dick");
      if (dick && (!dick.initials || dick.initials !== "DE")) {
        dick.initials = "DE";
        saveJson(AUTH_USERS_KEY, users);
      }
      return users;
    }

    const seeded = [
      { id: uid("u"), username: "Dick", password: "admin", initials: "DE", role: "admin", createdAt: Date.now() },
    ];
    saveJson(AUTH_USERS_KEY, seeded);
    return seeded;
  }

  function getUsers() { return seedUsersIfMissing(); }
  function setUsers(users) { saveJson(AUTH_USERS_KEY, users); }
  function getSession() { return loadJson(AUTH_SESSION_KEY); }
  function setSession(sess) { saveJson(AUTH_SESSION_KEY, sess); }
  function clearSession() { localStorage.removeItem(AUTH_SESSION_KEY); }

  function findUser(username) {
    const users = getUsers();
    return users.find((u) => (u.username || "").toLowerCase() === (username || "").toLowerCase()) || null;
  }

  function login(username, password) {
    const u = findUser(username);
    if (!u) return { ok: false, message: "Fel användarnamn eller lösenord." };
    if ((u.password || "") !== (password || "")) return { ok: false, message: "Fel användarnamn eller lösenord." };
    setSession({ userId: u.id, username: u.username, role: u.role, loggedInAt: Date.now() });
    return { ok: true, user: u };
  }

  function currentUser() {
    const sess = getSession();
    if (!sess?.userId) return null;
    const u = getUsers().find((x) => x.id === sess.userId);
    return u ? { ...u } : null;
  }

  // -------------------------------
  // APP STORAGE
  // -------------------------------
  const STORAGE_KEY_V16 = "up_planning_v16";

  // -------------------------------
  // Remote storage (Supabase) - optional
  // NOTE: This uses a publishable key (OK for frontend) but requires proper RLS policies in Supabase.
  // -------------------------------
  const SUPABASE_URL = "https://nchgudsqleylfdysgabi.supabase.co";
  const SUPABASE_KEY = "sb_publishable_TBIHlzs-Cw-fJfjUvkzzfw_mhrTLuLw";
  const SUPABASE_TABLE = "planning";      // create this table in Supabase
  const SUPABASE_ROW_KEY = "main";         // single shared row (temporary; later per-org/per-user)

  const IS_LOCAL_DEV = ["localhost", "127.0.0.1"].includes(location.hostname);
  const REMOTE_ENABLED_DEFAULT = true;

  let _supabaseClient = null;
  let _supabaseReady = null;
  let _remoteBootstrapped = false; // prevents overwriting remote before first remote load completes

  function ensureSupabase() {
    if (_supabaseReady) return _supabaseReady;

    _supabaseReady = new Promise((resolve) => {
      if (window.supabase && typeof window.supabase.createClient === "function") {
        _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        resolve(_supabaseClient);
        return;
      }

      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js";
      s.async = true;
      s.onload = () => {
        if (window.supabase && typeof window.supabase.createClient === "function") {
          _supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
          resolve(_supabaseClient);
        } else {
          console.warn("Supabase script loaded but client not available.");
          resolve(null);
        }
      };
      s.onerror = () => {
        console.warn("Could not load Supabase client (offline?).");
        resolve(null);
      };
      document.head.appendChild(s);
    });

    return _supabaseReady;
  }

  async function remoteLoadStateIfEnabled(currentState) {
    try {
      const enabled = (currentState?.settings?.remoteStorageEnabled ?? REMOTE_ENABLED_DEFAULT);
      if (!enabled) return null;

      const client = await ensureSupabase();
      if (!client) return null;

      const { data, error } = await client
        .from(SUPABASE_TABLE)
        .select("state")
        .eq("key", SUPABASE_ROW_KEY)
        .maybeSingle();

      if (error) {
        console.warn("Supabase load error:", error);
        return null;
      }
      if (!data || !data.state) return null;
      return data.state;
    } catch (e) {
      console.warn("Supabase load exception:", e);
      return null;
    }
  }

  let _remoteSaveTimer = null;
  async function remoteSaveStateIfEnabled(nextState) {
    try {
      const enabled = (nextState?.settings?.remoteStorageEnabled ?? REMOTE_ENABLED_DEFAULT);
      if (!enabled) return;
      if (!_remoteBootstrapped) return;

      const client = await ensureSupabase();
      if (!client) return;

      if (_remoteSaveTimer) clearTimeout(_remoteSaveTimer);
      _remoteSaveTimer = setTimeout(async () => {
      try {
        _remoteBootstrapped = false;
          const payload = {
            key: SUPABASE_ROW_KEY,
            state: nextState,          };
          const { error } = await client.from(SUPABASE_TABLE).upsert(payload, { onConflict: "key" });
          if (error) console.warn("Supabase save error:", error);
        } catch (e) {
          console.warn("Supabase save exception:", e);
        }
      }, 500);
    } catch (e) {
      console.warn("Supabase save outer exception:", e);
    }
  }


  const STORAGE_KEY_V15 = "up_planning_v15";
  const STORAGE_KEYS_OLD = [
    "up_planning_v15",
    "up_planning_v14",
    "up_planning_v13",
    "up_planning_v12",
    "up_planning_v11",
    "up_planning_v10",
    "up_planning_v9",
    "up_planning_v8",
    "up_planning_v7",
    "up_planning_v6",
    "up_planning_v5",
    "up_planning_v4",
    "up_planning_v3",
    "up_planning_v2",
    "up_planning_v1",
  ];

  const Tabs = { DEV: "dev", PRODUCT: "product", TODO: "todo", ROUTINES: "routines" };

  // Single source of truth for visible tabs.
  // Add new tabs here, and implement them in renderHero/renderView switches below.
  const TAB_CONFIG = [
    { key: Tabs.DEV, label: "Utvecklingsprocess", title: "Utvecklingsprocess" },
    { key: Tabs.PRODUCT, label: "Säljprocess", title: "Säljprocess Ny produkt" },
    { key: Tabs.TODO, label: "ToDo", title: "ToDo" },
    { key: Tabs.ROUTINES, label: "Rutiner", title: "Rutiner" },
  ];

  // ---- Role helpers (top-level) ----
  function isAdmin(user) {
    return String(user?.role || "").toLowerCase() === "admin";
  }


  // -------------------------------
  // USP Activity Field helpers (status + notes + owner)
  // -------------------------------
  function nextActivityStatus(cur) {
    if (!cur) return "green";
    if (cur === "green") return "yellow";
    if (cur === "yellow") return "red";
    return null;
  }

  function canEditActivityStatus(cell, user) {
    if (isAdmin(user)) return true;
    const me = (user?.initials || "").toUpperCase();
    const owner = (cell?.ownerInitials || "").toUpperCase();
    return Boolean(me && owner && me === owner);
  }

  function openOwnerPickerModal(state, cell) {
    const users = getUsers();
    const initials = users
      .map((u) => (u.initials || "").toUpperCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }));

    const wrap = el("div", { style: "display:flex;flex-wrap:wrap;gap:10px;" }, []);

    const mkBtn = (label, val) => el("button", {
      type: "button",
      class: "pill",
      onclick: () => {
        cell.ownerInitials = val || "";
        saveState(state);
        render(state);
        closeModal();
      },
    }, [label]);

    wrap.appendChild(mkBtn("--", ""));
    initials.forEach((ini) => wrap.appendChild(mkBtn(ini, ini)));

    openModal({
      title: "Ansvarig",
      sub: "Högerklick på initialerna för att välja ansvar.",
      bodyNode: wrap,
    });
  }

  
  function makeRowActionMenu({ onDone, onDelete }) {
    const wrap = el("div", { class: "row-actions" });
    const btn = el("button", { class: "btn btn-light btn-small action-btn", type: "button" }, ["Action ▾"]);
    const menu = el("div", { class: "action-menu hidden" }, [
      el("button", { class: "action-item", type: "button", onclick: () => { menu.classList.add("hidden"); onDone && onDone(); } }, ["Done"]),
      el("button", { class: "action-item danger", type: "button", onclick: () => { menu.classList.add("hidden"); onDelete && onDelete(); } }, ["Ta bort"]),
    ]);

    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      menu.classList.toggle("hidden");
    });

    document.addEventListener("click", () => menu.classList.add("hidden"));
    wrap.appendChild(btn);
    wrap.appendChild(menu);
    return wrap;
  }

function openActivityNotesModal(state, entryOrRow, activity, user) {
  const cell = ensureDevEntryCell(entryOrRow, activity);
  const me = ((user?.initials || "") + "").toUpperCase().slice(0, 2);

  // Normalize legacy notes/comments into an array of {ts, by, text}
  const raw = Array.isArray(cell.comments) ? cell.comments : [];
  const notes = raw
    .map((x) => {
      if (!x) return null;
      if (typeof x === "string") return { ts: Date.now(), by: "", text: x };
      if (typeof x === "object") {
        return {
          ts: typeof x.ts === "number" ? x.ts : Date.now(),
          by: (x.by || x.initials || "").toString().toUpperCase().slice(0, 2),
          text: (x.text || x.note || x.comment || "").toString(),
        };
      }
      return null;
    })
    .filter(Boolean);

  const wrap = el("div", {}, []);

  const list = el("div", { class: "notes-list" }, []);
  function renderList() {
    list.innerHTML = "";
    if (!notes.length) {
      list.appendChild(el("div", { style: "color:#6b7280;padding:8px 0;" }, ["Inga anteckningar ännu."]));
      return;
    }
    notes
      .slice()
      .sort((a, b) => b.ts - a.ts)
      .forEach((n) => {
        const d = new Date(n.ts);
        const dateStr = isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
        const meta = [dateStr, n.by].filter(Boolean).join(" • ");
        list.appendChild(
          el("div", { class: "note-item" }, [
            el("div", { class: "note-meta" }, [meta || ""]),
            el("div", { class: "note-text" }, [n.text]),
          ])
        );
      });
  }
  renderList();

  const input = el("textarea", {
    placeholder: "Skriv en kort anteckning…",
    rows: 2,
    style:
      "width:100%;resize:none;border:1px solid #e5e7eb;border-radius:12px;padding:10px 12px;font-size:14px;line-height:1.3;",
  });

  const actions = el(
    "div",
    { style: "display:flex;gap:8px;justify-content:flex-end;margin-top:10px;" },
    [
      el(
        "button",
        { class: "btn btn-light btn-small", type: "button", onclick: () => closeModal() },
        ["Stäng"]
      ),
      el(
        "button",
        {
          class: "btn btn-primary btn-small",
          type: "button",
          onclick: () => {
            const t = (input.value || "").trim();
            if (!t) return;
            notes.push({ ts: Date.now(), by: me, text: t });
            cell.comments = notes;
            saveState(state);
            input.value = "";
            renderList();
            render(state); // update initials highlight
          },
        },
        ["Lägg till"]
      ),
    ]
  );

  wrap.appendChild(list);
  wrap.appendChild(el("div", { style: "height:10px;" }, [""]));
  wrap.appendChild(input);
  wrap.appendChild(actions);

  openModal({
    title: "Notes",
    sub: activity.label || activity.key || "",
    bodyNode: wrap,
    showFooterClose: false,
  });

  setTimeout(() => input.focus(), 50);
}

  function isKnownTab(tabKey) {
    return TAB_CONFIG.some(t => t.key === tabKey);
  }

  function ensureValidActiveTab(state) {
    // Guard against corrupted state or mismatched tab config
    if (!state) return;
    if (!state.activeTab || !isKnownTab(state.activeTab)) {
      state.activeTab = Tabs.TODO;
    }
  }

  // Utvecklingsprocess (dynamisk)
  const DEV_ACTIVITY_TYPES = ["text", "date", "veckonummer", "status"];

  // Normalisera aktivitetstyp (bakåtkompatibel)
  function normalizeActivityType(t) {
    const x = (t || "").toString().trim().toLowerCase();
    if (!x) return "text";
    if (x === "kalender" || x === "date") return "date";
    if (x === "veckokalender" || x === "weekcalendar" || x === "veckokalendar" || x === "weeknumber" || x === "veckonummer") return "veckonummer";
    if (x === "status") return "status";
    if (x === "text") return "text";
    // fallback
    return "text";
  }


  // Produkt (behåll)
  const STEPS_DEFAULT = 5;
  const COLS_PRODUCT = [
    { key: "name", label: "Namn", type: "passive" },
    { key: "titleSku", label: "Titel/SKU", type: "active" },
    { key: "launchQ", label: "Lansering Q", type: "passive" },
    { key: "po", label: "PO", type: "active" },
    { key: "price", label: "Pris", type: "active" },
    { key: "msMaterial", label: "MS-mtrl", type: "active" },
    { key: "sellStartB2C", label: "Säljprocess Ny produktstart B2C", type: "passive" },
    { key: "sellStartB2B", label: "Säljprocess Ny produktstart B2B", type: "passive" },
  ];

  // Tasks
  const TODO_DEFAULT_CATEGORIES = ["Allmänt", "Kontor", "Shopify"];

  function uniqStrings(arr) {
    const seen = new Set();
    const out = [];
    (arr || []).forEach((x) => {
      const v = (x || "").toString().trim();
      if (!v) return;
      const key = v.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(v);
    });
    return out;
  }

  function scanTodoCategoriesFromTasks(state) {
    const cats = [];
    const add = (t) => {
      const c = (t?.category || "").toString().trim();
      if (!c) return;
      if (c.toLowerCase() === "alla") return;
      cats.push(c);
    };
    (state?.todo?.items || []).forEach(add);
    (state?.todo?.archive || []).forEach(add);
    return cats;
  }

  function getManagedTodoCategories(state) {
    // Admin-managed categories (defaults are only seeded once; after that admin controls the list)
    const existing = (state?.todo?.categories || []).slice();
    const merged = uniqStrings([
      ...existing,
      ...scanTodoCategoriesFromTasks(state),
    ]).filter((c) => c.toLowerCase() !== "privat" && c.toLowerCase() !== "alla");

    // Always keep a safe fallback category
    if (!merged.map((x) => x.toLowerCase()).includes("allmänt")) merged.unshift("Allmänt");

    // Sort (except keep Allmänt first if present)
    const rest = merged.filter((c) => c.toLowerCase() !== "allmänt")
                       .sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }));
    return uniqStrings(["Allmänt", ...rest]);
  }

  function getTodoCategories(state) {
    // Categories usable on a task (includes Privat as a special fixed option)
    return uniqStrings([...getManagedTodoCategories(state), "Privat"]);
  }

  function getTodoFilters(state, user) {
    // Filters include "Alla" + managed categories + "Privat"
    return ["Alla", ...getTodoCategories(state)];
  }

  function ensureTodoCategories(state) {
    state.todo = state.todo || { filter: "Alla", items: [], archive: [], lastWeek: null, selectedWeek: null };

    // Seed initial categories (once) with defaults + any already-used categories
    const hasCats = Array.isArray(state.todo.categories) && state.todo.categories.length > 0;
    if (!hasCats) {
      const seeded = uniqStrings([
        ...TODO_DEFAULT_CATEGORIES,
        ...scanTodoCategoriesFromTasks(state),
      ]).filter((c) => c.toLowerCase() !== "privat" && c.toLowerCase() !== "alla");
      // Always ensure fallback
      if (!seeded.map((x) => x.toLowerCase()).includes("allmänt")) seeded.unshift("Allmänt");
      state.todo.categories = uniqStrings(seeded);
    }

    const managed = getManagedTodoCategories(state);
    state.todo.categories = managed;

    const allowed = getTodoFilters(state);
    if (state.todo.filter === "All") state.todo.filter = "Alla";
    state.todo.filter = allowed.includes(state.todo.filter) ? state.todo.filter : "Alla";
  }

  function ensureDevTypes(state) {
    // devTypes används som register för dropdown (P-typ) i både Utvecklingsprocess och Säljprocess Ny produkt.
    // Viktigt: vi ska aldrig "tömma" listan pga en saknad/ändrad struktur – vi försöker istället
    // att bevara det som finns och återskapa från befintliga rader om det går.
    const asArr = (v) => (Array.isArray(v) ? v : []);
    const pickLegacy = () => {
      // olika historiska nycklar som kan ha förekommit
      return (
        state.devTypes ??
        state.dev_types ??
        state.dev_type ??
        state.devType ??
        state.devtype ??
        state.registerDevTypes ??
        state.register?.devTypes ??
        state.register?.dev_type ??
        state.registers?.devTypes ??
        state.registers?.dev_type ??
        null
      );
    };

    // Starta med nuvarande (om array), annars försök läsa legacy, annars tom array
    const legacy = pickLegacy();
    state.devTypes = asArr(state.devTypes);
    if (!state.devTypes.length && Array.isArray(legacy) && legacy.length) {
      state.devTypes = legacy.slice();
    }

    const found = [];
    const add = (v) => {
      if (v == null) return;
      const s = String(v).trim();
      if (!s) return;
      found.push(s);
    };

    // Från Utvecklingsprocess-rader (toppfält)
    (state.devEntries || []).forEach((e) => {
      if (!e) return;
      add(e.type);
      add(e.devType);
      add(e.ptype);
      add(e.pType);
    });

    // Från Produkt-rader (toppfält)
    (state.productRows || []).forEach((r) => {
      if (!r) return;
      add(r.type);
      add(r.devType);
      add(r.ptype);
      add(r.pType);
    });

    // Normalisera + slå ihop
    const merged = uniqStrings([...(state.devTypes || []), ...found]);

    // Om vi fortfarande är tomma: behåll tomt (admin kan lägga till manuellt).
    // Men om vi hittade något i data, spara det i registret så dropdown fungerar direkt.
    state.devTypes = merged;

    // Rensa vissa legacy-nycklar (men behåll register/registers.* så att andra delar av appen kan läsa dem)
    delete state.dev_types;
    delete state.dev_type;
    delete state.devType;
    delete state.devtype;

    // Spegla alltid devTypes in i register/registers för bakåtkompatibilitet
    state.register = state.register || {};
    state.registers = state.registers || {};
    state.register.dev_type = Array.isArray(state.devTypes) ? state.devTypes.slice() : [];
    state.registers.dev_type = Array.isArray(state.devTypes) ? state.devTypes.slice() : [];
  }

  function isTypeActivity(activity) {
    const n = (activity?.name || "").toString().trim().toLowerCase();
    const id = (activity?.id || "").toString().trim().toLowerCase();
    return n === "typ" || n === "type" || n === "dev_type" || n === "devtype" || id === "typ" || id === "type";
  }

function getDevTypes(state) {
    ensureDevTypes(state);
    return uniqStrings(state.devTypes.slice());
  }


  const COLS_TODO_UI = [
    { key: "__done__", label: "", type: "checkbox" },
    { key: "category", label: "Kategori", type: "category" },
    { key: "title", label: "Titel", type: "text" },
    { key: "assignee", label: "Ansvarig", type: "assignee" },
    { key: "dueDate", label: "Färdig", type: "date" },
    { key: "__notes__", label: "Notes", type: "notes" },
    { key: "__trash__", label: "", type: "trash" },
  ];

  
  
  function stampNowSv(ts = Date.now()) {
    try { return new Date(ts).toLocaleString("sv-SE"); } catch { return ""; }
  }


  // -------------------------------
  // Week picker helpers (ISO week)
  // -------------------------------
  function isoWeekKey(d = new Date()) {
    const date = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
    date.setUTCDate(date.getUTCDate() + 4 - (date.getUTCDay() || 7));
    const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((date - yearStart) / 86400000) + 1) / 7);
    return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, "0")}`;
  }

  function weekRangeFromKey(key) {
    const m = /^(\d{4})-W(\d{2})$/.exec(key || "");
    if (!m) return null;
    const year = parseInt(m[1], 10);
    const week = parseInt(m[2], 10);
    const jan4 = new Date(Date.UTC(year, 0, 4));
    const day = jan4.getUTCDay() || 7;
    const monWeek1 = new Date(jan4);
    monWeek1.setUTCDate(jan4.getUTCDate() - (day - 1));
    const start = new Date(monWeek1);
    start.setUTCDate(monWeek1.getUTCDate() + (week - 1) * 7);
    const end = new Date(start);
    end.setUTCDate(start.getUTCDate() + 6);
    return { start, end };
  }

  function fmtDateSv(d) {
    try { return new Date(d).toLocaleDateString("sv-SE"); } catch { return ""; }
  }

// -------------------------------
  // Notes mail helper (mailto)
  // -------------------------------
  function emailForInitials(initials) {
    const u = getUsers().find((x) => (x.initials || "").toUpperCase() === (initials || "").toUpperCase());
    return (u && u.email) ? u.email : "";
  }

  function sendNotesMail(toInitialsList, subject, body) {
    const emails = (toInitialsList || [])
      .map((ini) => emailForInitials(ini))
      .filter((e) => !!e);

    if (!emails.length) return;

    const qs = new URLSearchParams();
    qs.set("subject", subject);
    qs.set("body", body);

    // Use bcc for multiple recipients
    const bcc = encodeURIComponent(emails.join(","));
    const url = `mailto:?bcc=${bcc}&${qs.toString()}`;

    // Open mail client
    window.location.href = url;
  }


  /* ==============================
     UI / DOM Helpers
     ============================== */

// -------------------------------
  // DOM helpers
  // -------------------------------
  function el(tag, attrs = {}, children = []) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (k === "class") node.className = v;
      else if (k === "dataset") Object.assign(node.dataset, v);
      else if (k.startsWith("on") && typeof v === "function") node.addEventListener(k.slice(2), v);
      else if (k === "html") node.innerHTML = v;
      else node.setAttribute(k, v);
    }
    for (const c of [].concat(children)) {
      if (c == null) continue;
      node.appendChild(typeof c === "string" ? document.createTextNode(c) : c);
    }
    return node;
  }

  function saveState(state) {
    localStorage.setItem(STORAGE_KEY_V16, JSON.stringify(state));
  
    // Best-effort remote persistence
    remoteSaveStateIfEnabled(state);
  }


  function defaultState() {
    return {
      activeTab: Tabs.DEV,

      // Utvecklingsprocess: schema + entries
      devSchema: {
        activities: [
          // {id, name, type: 'status'|'kalender'|'text', createdAt, tasks:[{id,name,enabled,order}]}
        ],
      },
      devEntries: [
        // {id, name, fields: { [activityId]: {text/date} or { tasksData: {[taskId]: bool} } }, createdAt }
      ],

      // Produkt: schema + rows + archive
      productSchema: { activities: [] },
      productRows: [],
      archive: { dev: [], product: [] },

      // Register: dev_type (dropdown för P-typ)
      devTypes: [],

      // Tasks)
      todo: { filter: "Alla", items: [], archive: [], lastWeek: null, categories: TODO_DEFAULT_CATEGORIES.slice() },
    };
  }

  // -------------------------------
  // ISO week number (Mon start)
  // -------------------------------
  function isoWeekNumber(date = new Date()) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNo = Math.ceil((((d - yearStart) / 86400000) + 1) / 7);
    return weekNo;
  }

  function ensureWeeklyRollover(state) {
    const nowWeek = isoWeekNumber(new Date());
    if (state.todo.lastWeek == null) {
      state.todo.lastWeek = nowWeek;
      saveState(state);
      return;
    }
    if (state.todo.lastWeek !== nowWeek) {
      const done = (state.todo.items || []).filter((t) => !!t.done);
      const remaining = (state.todo.items || []).filter((t) => !t.done);

      done.forEach((t) => {
        t.archivedAt = Date.now();
        state.todo.archive.push(t);
      });

      state.todo.items = remaining;
      state.todo.lastWeek = nowWeek;
      saveState(state);
      render(state);
    }
  }

  // -------------------------------
  // Migration (best effort)
  // -------------------------------
  function migrateBestEffort() {
    const cur = loadJson(STORAGE_KEY_V16);
    if (cur) return normalizeState(cur);

    for (const k of STORAGE_KEYS_OLD) {
      const old = loadJson(k);
      if (!old) continue;
      return normalizeState(mapOldState(old));
    }
    return normalizeState(defaultState());
  }

  function mapOldState(old) {
    const s = defaultState();

    // active tab
    if (old.activeTab === "product" || old.activeTab === "prod") s.activeTab = Tabs.PRODUCT;
    else if (old.activeTab === "todo") s.activeTab = Tabs.TODO;
    else s.activeTab = Tabs.DEV;

    // product rows
    s.productRows = old.productRows || old.prodRows || old.product?.rows || [];

    
// dev_type register
s.devTypes =
  old.devTypes ||
  old.dev_types ||
  old.dev_type ||
  (old.register && (old.register.devTypes || old.register.dev_type)) ||
  (old.registers && (old.registers.devTypes || old.registers.dev_type)) ||
  [];
// archives
    if (old.archive) {
      s.archive.product = old.archive.product || old.archive.prod || [];
      s.archive.dev = old.archive.dev || [];
    }

    // todo
    const ot = old.todo || {};
    const f = ot.filter || old.todoFilter;
    s.todo.filter = (f === "All" ? "Alla" : (f || "Alla"));
    s.todo.items = ot.items || old.todos || [];
    s.todo.archive = ot.archive || ot.archived || [];
    s.todo.lastWeek = ot.lastWeek ?? null;
    ensureTodoCategories(s);


    // dev: try to carry over names from previous dev rows if present
    const devRows = old.devRows || old.dev?.rows || [];
    if (Array.isArray(devRows) && devRows.length) {
      s.devEntries = devRows.map((r) => ({
        id: uid("devE"),
        name: r.name || "",
        fields: {},
        createdAt: r.createdAt || Date.now(),
      }));
    }

    return s;
  }

  function normalizeState(state) {
    state.activeTab = state.activeTab || Tabs.DEV;
    if (!Object.values(Tabs).includes(state.activeTab)) state.activeTab = Tabs.DEV;

    state.devSchema = state.devSchema || { activities: [] };
    state.devSchema.activities = Array.isArray(state.devSchema.activities) ? state.devSchema.activities : [];

    state.productSchema = state.productSchema || { activities: [] };
    state.productSchema.activities = Array.isArray(state.productSchema.activities) ? state.productSchema.activities : [];

    // Normalisera typer + säkerställ ordning (så USER-tabeller följer Admin)
    state.devSchema.activities.forEach((a, idx) => {
      if (!a) return;
      a.type = normalizeActivityType(a.type);
      if (a.order == null && a.sortOrder == null && a.position == null) a.order = idx + 1;
    });
    state.productSchema.activities.forEach((a, idx) => {
      if (!a) return;
      a.type = normalizeActivityType(a.type);
      if (a.order == null && a.sortOrder == null && a.position == null) a.order = idx + 1;
    });

    const sortActivitiesInPlace = (activities) => {
      if (!Array.isArray(activities) || !activities.length) return;
      const hasOrder = activities.some((a) => a?.order != null || a?.sortOrder != null || a?.position != null);
      if (!hasOrder) return;
      const ord = (x) => (x?.order ?? x?.sortOrder ?? x?.position ?? 0);
      activities.sort((a, b) => ord(a) - ord(b));
      // Re-sequence to remove gaps/duplicates and make Admin+User consistent
      activities.forEach((a, i) => { if (a) a.order = i + 1; });
    };

    sortActivitiesInPlace(state.devSchema.activities);
    sortActivitiesInPlace(state.productSchema.activities);
// Merge tasks for activities with same name (prevents "duplicate columns" causing missing tasks in user)
    const mergeTasksAcrossSameName = (activities) => {
      const byName = new Map();
      activities.forEach((a) => {
        const key = (a?.name || "").trim().toLowerCase();
        if (!key) return;
        if (!byName.has(key)) byName.set(key, []);
        byName.get(key).push(a);
      });
      byName.forEach((list) => {
        if (list.length < 2) return;

        const all = [];
        const seen = new Set();

        list.forEach((a) => {
          a.tasks = Array.isArray(a.tasks) ? a.tasks : [];
          a.tasks.forEach((t) => {
            const k = ((t?.name || "").trim().toLowerCase()) || t?.id;
            if (!k || seen.has(k)) return;
            if (t.enabled === undefined) t.enabled = true;
            all.push(t);
            seen.add(k);
          });
        });

        if (!all.length) return;

        all.sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));

        list.forEach((a) => {
          const existing = new Set((Array.isArray(a.tasks) ? a.tasks : []).map((t) => ((t?.name || "").trim().toLowerCase()) || t?.id));
          const add = all.filter((t) => {
            const k = ((t?.name || "").trim().toLowerCase()) || t?.id;
            return k && !existing.has(k);
          });
          if (add.length) a.tasks = (Array.isArray(a.tasks) ? a.tasks : []).concat(add);
          a.tasks.forEach((t) => { if (t.enabled === undefined) t.enabled = true; });
        });
      });
    };

    mergeTasksAcrossSameName(state.devSchema.activities);

    state.devEntries = Array.isArray(state.devEntries) ? state.devEntries : [];

    state.productSchema = state.productSchema || { activities: [] };
    state.productSchema.activities = Array.isArray(state.productSchema.activities) ? state.productSchema.activities : [];
    mergeTasksAcrossSameName(state.productSchema.activities);

    state.productRows = Array.isArray(state.productRows) ? state.productRows : [];

    // Register: dev_type
    ensureDevTypes(state);
    state.archive = state.archive || { dev: [], product: [] };
    state.archive.dev = Array.isArray(state.archive.dev) ? state.archive.dev : [];
    state.archive.product = Array.isArray(state.archive.product) ? state.archive.product : [];

    state.todo = state.todo || { filter: "Alla", items: [], archive: [], lastWeek: null, selectedWeek: null };
    if (state.todo.filter === "All") state.todo.filter = "Alla";
    /* validated after ensureTodoCategories(state) */
    state.todo.items = Array.isArray(state.todo.items) ? state.todo.items : [];
    state.todo.archive = Array.isArray(state.todo.archive) ? state.todo.archive : [];

    ensureTodoCategories(state);
    ensureDevTypes(state);

    state.todo.lastWeek = state.todo.lastWeek ?? null;

    // Normalize todo items
    const fixTodo = (t) => {
      const cat = getTodoCategories(state).includes(t.category) ? t.category : (t.category === "Alla" ? "Allmänt" : (t.category || "Allmänt"));
      return {
        id: t.id || uid("todo"),
        category: cat,
        title: t.title ?? "",
        assignee: t.assignee || "Alla",
        dueDate: t.dueDate || t.date || "",
        notes: t.notes ?? "",
        comments: Array.isArray(t.comments) ? t.comments : [],
        done: !!t.done,
        week: Number.isFinite(t.week) ? t.week : isoWeekNumber(new Date(t.createdAt || Date.now())),
        createdAt: t.createdAt || Date.now(),
        archivedAt: t.archivedAt,
      };
    };
    state.todo.items = state.todo.items.map(fixTodo);
    state.todo.archive = state.todo.archive.map((t) => ({ ...fixTodo(t), done: true }));

    // Normalize dev schema
    state.devSchema.activities = state.devSchema.activities.map((a) => ({
      id: a.id || uid("act"),
      name: (a.name || "").trim(),
      type: DEV_ACTIVITY_TYPES.includes(a.type) ? a.type : "text",
      createdAt: a.createdAt || Date.now(),
      tasks: Array.isArray(a.tasks) ? a.tasks.map((t, idx) => ({
        id: t.id || uid("dt"),
        name: (t.name || "").trim(),
        enabled: !!t.enabled,
        order: Number.isFinite(t.order) ? t.order : idx,
        createdAt: t.createdAt || Date.now(),
      })) : [],
    })).filter((a) => a.name.length > 0);

    // Ensure task ordering per activity
    state.devSchema.activities.forEach((a) => {
      a.tasks.sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
      // normalize sequential order
      a.tasks.forEach((t, i) => { t.order = i; });
    });

    // Normalize dev entries
    state.devEntries = state.devEntries.map((e) => ({
      id: e.id || uid("devE"),
      name: e.name ?? "",
      type: e.type ?? e.devType ?? "", // dev_type
      fields: e.fields && typeof e.fields === "object" ? e.fields : {},
      createdAt: e.createdAt || Date.now(),
    }));

    // Normalize product schema (endast aktiviteter, inte fasta kolumnerna Namn/Typ)
    state.productSchema.activities = state.productSchema.activities.map((a, idx) => ({
      id: a.id || uid("pact"),
      name: (a.name || "").trim(),
      type: DEV_ACTIVITY_TYPES.includes(a.type) ? a.type : "text",
      // behåll explicit ordning om den finns
      order: Number.isFinite(a.order) ? a.order : (Number.isFinite(a.sortOrder) ? a.sortOrder : (Number.isFinite(a.position) ? a.position : idx)),
      createdAt: a.createdAt || Date.now(),
      tasks: Array.isArray(a.tasks) ? a.tasks.map((t, tIdx) => ({
        id: t.id || uid("pt"),
        name: (t.name || "").trim(),
        enabled: !!t.enabled,
        order: Number.isFinite(t.order) ? t.order : tIdx,
        createdAt: t.createdAt || Date.now(),
      })) : [],
    })).filter((a) => a.name.length > 0);

    state.productSchema.activities.forEach((a) => {
      a.tasks.sort((x, y) => (x.order ?? 0) - (y.order ?? 0));
      a.tasks.forEach((t, i) => { t.order = i; });
    });

    // Normalize product rows
    state.productRows = state.productRows.map((r) => {
      const row = (r && typeof r === "object") ? r : {};
      const name = row.name ?? row.prodName ?? row.title ?? "";
      const type = row.type ?? row.devType ?? "";
      const fields = (row.fields && typeof row.fields === "object") ? row.fields : {};
      return {
        id: row.id || uid("product"),
        name,
        type,
        fields,
        createdAt: row.createdAt || Date.now(),
      };
    });

    return state;
  }

  // -------------------------------
  // Modal
  // -------------------------------
    let modalOnClose = null;

  function openModal({ title, sub, bodyNode, onClose, showFooterClose = true }) {
    const backdrop = document.getElementById("modalBackdrop");
    const titleEl = document.getElementById("modalTitle");
    const subEl = document.getElementById("modalSub");
    const body = document.getElementById("modalBody");
    if (!backdrop || !titleEl || !subEl || !body) {
      console.error("Modal elements missing in DOM.");
      return;
    }

    // Reset + tvinga reflow så att modal kan öppnas igen direkt
    backdrop.classList.remove("is-open");

    titleEl.textContent = title || "";
    subEl.textContent = sub || "";
    body.innerHTML = "";
    body.appendChild(bodyNode);

    // Optional close behavior per modal
    modalOnClose = (typeof onClose === "function") ? onClose : null;
    const footerClose = document.getElementById("modalCloseBtn2");
    if (footerClose) footerClose.style.display = showFooterClose ? "inline-flex" : "none";

    // reflow
    void backdrop.offsetHeight;

    backdrop.classList.add("is-open");
  }

  function closeModal() {
    document.getElementById("modalBackdrop").classList.remove("is-open");
  }

  function wireModalClose() {
    const backdrop = document.getElementById("modalBackdrop");

    const handleClose = () => {
      if (typeof modalOnClose === "function") {
        const fn = modalOnClose;
        modalOnClose = null; // prevent loops
        fn();
        return;
      }
      closeModal();
    };

    const closeBtn1 = document.getElementById("modalCloseBtn");
    if (closeBtn1) closeBtn1.addEventListener("click", handleClose);
    const closeBtn2 = document.getElementById("modalCloseBtn2");
    if (closeBtn2) closeBtn2.addEventListener("click", handleClose);

    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) handleClose();
    });

    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") handleClose();
    });
  }

  // -------------------------------
  // Layout + Settings
  // -------------------------------
  function mountBase(app, user) {
    app.innerHTML = "";

    const initials = (user?.initials || user?.username || "?").toString().slice(0, 3).toUpperCase();

    const topbar = el("div", { class: "topbar" }, [
      el("div", { class: "brand" }, [
        el("div", { class: "logo" }, ["USP"]),
        el("div", {}, [
          el("div", { class: "brand-title" }, ["US-planning"]),
          el("div", { class: "brand-sub" }, ["USP"]),
        ]),
      ]),
      el("div", { class: "tabs", id: "tabs" }),
      el("div", { class: "top-actions" }, [
        el("div", { class: "userpill", id: "userPill" }, [
          el("span", {}, [user?.username || ""]),
          el("span", { class: "role" }, [user?.role || "user"]),
          el("span", { class: "pill", style: "margin-left:6px;" }, [initials]),
        ]),
        el("div", { class: "settings-wrap" }, [
          el("button", { class: "icon-btn", id: "settingsBtn", type: "button", title: "Settings" }, ["⚙️"]),
          el("div", { class: "settings-menu", id: "settingsMenu" }),
        ]),
      ]),
    ]);

    const hero = el("div", { class: "hero" }, [
      el("div", { class: "hero-left" }, [
        el("h1", { id: "heroTitle" }, ["Utvecklingsprocess"]),
        el("div", { id: "heroInline" }),
      ]),
      el("div", { class: "hero-actions", id: "heroActions" }),
    ]);

    const main = el("div", { class: "table-wrap" }, [el("div", { id: "view" })]);

    const modalBackdrop = el("div", { class: "modal-backdrop", id: "modalBackdrop" }, [
      el("div", { class: "modal" }, [
        el("div", { class: "modal-header" }, [
          el("div", {}, [
            el("div", { class: "modal-title", id: "modalTitle" }, [""]),
            el("div", { class: "modal-sub", id: "modalSub" }, [""]),
          ]),
          el("button", { class: "icon-btn", id: "modalCloseBtn", type: "button", title: "Stäng" }, ["✕"]),
        ]),
        el("div", { class: "modal-body", id: "modalBody" }),
        el("div", { class: "modal-footer" }, [
          ]),
      ]),
    ]);

    app.appendChild(topbar);
    app.appendChild(hero);
    app.appendChild(main);
    app.appendChild(modalBackdrop);
  }

  function wireSettingsMenu(user) {
    const btn = document.getElementById("settingsBtn");
    const menu = document.getElementById("settingsMenu");

    function closeMenu() { menu.classList.remove("is-open"); }
    function toggleMenu() { menu.classList.toggle("is-open"); }
    function item(label, onClick) {
      return el("button", {
        type: "button",
        class: "settings-item",
        onclick: () => { closeMenu(); onClick(); },
      }, [label]);
    }

    function openMyPages() {
      const state = migrateBestEffort();

    // Remote sync (Supabase). If remote has state, replace local and re-render.
    (async () => {
      try {
        const remote = await remoteLoadStateIfEnabled(state);
        if (remote && typeof remote === "object") {
          // Preserve current session
          const session = loadSession();
          // Replace
          Object.keys(state).forEach((k) => { try { delete state[k]; } catch {} });
          Object.assign(state, remote);
          state.settings = state.settings || {};
          if (session) saveSession(session);
          saveState(state);
          render(state);
        }
      } catch (e) {
        console.warn("Remote sync skipped:", e);
      } finally {
        _remoteBootstrapped = true;
      }
    })();


      const me = currentUser();
      const myInit = (me?.initials || "").toUpperCase();

      const visible = (t) => {
        const a = (t.assignee || "Alla");
        if (a === "Alla") return true;
        if (myInit && a.toUpperCase() === myInit) return true;
        return false;
      };

      const canSee = (t) => {
        if ((t.category || "") === "Privat") return (t.assignee || "").toUpperCase() === myInit;
        return true;
      };

      const active = (state.todo?.items || []).filter((t) => canSee(t) && visible(t));
      const archived = (state.todo?.archive || []).filter((t) => canSee(t) && visible(t));

      const rowCard = (t, where) => {
        const title = t.title || "(titel saknas)";
        const meta = [
          `Kategori: ${t.category || "Allmänt"}`,
          `Ansvarig: ${t.assignee || "Alla"}`,
          t.dueDate ? `Färdig: ${t.dueDate}` : null,
          `Vecka: ${t.week || "-"}`,
          where,
        ].filter(Boolean).join(" • ");

        return el("div", {
          style: "padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;display:flex;flex-direction:column;gap:6px;",
        }, [
          el("div", { style: "font-weight:1000;" }, [title]),
          el("div", { style: "font-size:12px;opacity:.75;" }, [meta]),
        ]);
      };

      const body = el("div", {}, [
        el("div", { class: "label" }, ["Tasks som berör mig (Ansvarig = Alla eller mina initialer)"]),
        active.length === 0
          ? el("div", { style: "margin-bottom:12px;" }, ["Inga aktiva poster."])
          : el("div", { style: "display:flex;flex-direction:column;gap:10px;margin-bottom:16px;" }, active.map((t) => rowCard(t, "Aktiv"))),

        el("div", { class: "label" }, ["Archive"]),
        archived.length === 0
          ? el("div", {}, ["Inga arkiverade poster."])
          : el("div", { style: "display:flex;flex-direction:column;gap:10px;" }, archived.slice().reverse().map((t) => rowCard(t, "Arkiverad"))),
      ]);

      openModal({ title: "Mina sidor", sub: "Översikt", bodyNode: body });
    }

    function openManageUsers() {
      openModal({ title: "Manage user", sub: "Hantera användare", bodyNode: renderManageUsers(user) });
    }

    
    function openManageRegisters() {
      const state = migrateBestEffort();
      ensureTodoCategories(state);
      openModal({
        title: "Register",
        sub: "Hantera register: Kategori och Dev_type",
        bodyNode: renderManageRegisters(state),
      });
    }

    

    function doSwitchUser(targetUsername) {
      const users = getUsers();
      const target = users.find((u) => (u.username || "").toLowerCase() === String(targetUsername || "").toLowerCase());
      if (!target) {
        alert(`Hittar inte användaren "${targetUsername}". Lägg till användaren i Manage user först.`);
        return;
      }
      setSession({ userId: target.id, ts: Date.now() });
      // Automatisk refresh så att rätt innehåll laddas
      location.reload();
    }

function doLogout() { clearSession(); location.reload(); }

    // -------------------------------
    // Export / Import (localStorage migration)
    // -------------------------------
    function exportAppData() {
      try {
        const keys = [STORAGE_KEY_V16, AUTH_USERS_KEY, AUTH_SESSION_KEY, ROUTINES_KEY, STORAGE_KEY_V15];
        const data = {};
        keys.forEach((k) => {
          const v = localStorage.getItem(k);
          if (v !== null && v !== undefined) data[k] = v; // keep as raw string
        });

        const payload = {
          schema: "usp-export-v1",
          exportedAt: new Date().toISOString(),
          keys: data,
        };

        const yyyy = new Date().getFullYear();
        const mm = String(new Date().getMonth() + 1).padStart(2, "0");
        const dd = String(new Date().getDate()).padStart(2, "0");
        const filename = `usp-export-${yyyy}-${mm}-${dd}.json`;

        const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json;charset=utf-8" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);

        alert("Export klar. Filen laddades ner till din dator (oftast Hämtade filer/Downloads).");
      } catch (e) {
        console.error(e);
        alert("Export misslyckades.");
      }
    }

    function importAppData() {
      const input = document.createElement("input");
      input.type = "file";
      input.accept = "application/json";
      input.style.display = "none";
      document.body.appendChild(input);

      input.addEventListener("change", async () => {
        try {
          const file = input.files && input.files[0];
          if (!file) return;

          const text = await file.text();
          const payload = JSON.parse(text);

          if (!payload || (payload.schema !== "usp-export-v1" && !payload.keys)) {
            alert("Filen ser inte ut som en USP-export.");
            return;
          }

          const keys = payload.keys || {};
          const willOverwrite = Object.keys(keys).length > 0;
          if (!willOverwrite) {
            alert("Inget att importera i filen.");
            return;
          }

          const ok = confirm("Importera och skriva över lokal data för den här sajten?");
          if (!ok) return;

          Object.keys(keys).forEach((k) => {
            const v = keys[k];
            if (v === null || v === undefined) localStorage.removeItem(k);
            else localStorage.setItem(k, String(v));
          });

          alert("Import klar. Sidan laddas om.");
          location.reload();
        } catch (e) {
          console.error(e);
          alert("Import misslyckades. Kontrollera att filen är korrekt JSON.");
        } finally {
          input.remove();
        }
      });

      input.click();
    }

    menu.innerHTML = "";
    menu.appendChild(item("Mina sidor", openMyPages));
    if (user?.role === "admin") menu.appendChild(item("Manage user", openManageUsers));
    if (user?.role === "admin") menu.appendChild(item("Register", openManageRegisters));
    if (user?.role === "admin") menu.appendChild(item("Export data", exportAppData));
    if (user?.role === "admin") menu.appendChild(item("Import data", importAppData));
    
    if (user?.role === "admin") menu.appendChild(item("Change user", () => doSwitchUser("Benny")));
    if (user?.role !== "admin" && (user?.username || "").toLowerCase() === "benny") menu.appendChild(item("Change user", () => doSwitchUser("Dick")));

menu.appendChild(item("Logout", doLogout));

    btn.addEventListener("click", (e) => { e.stopPropagation(); toggleMenu(); });
    document.addEventListener("click", () => closeMenu());
    menu.addEventListener("click", (e) => e.stopPropagation());
  }

  // -------------------------------
  // Manage user
  // -------------------------------
  
function renderManageUsers(current) {
    const wrap = el("div", { class: "manage-users-wrap" }, []);
    const header = el("div", { class: "manage-users-header" });

    const title = el("div", { class: "manage-users-title" }, ["Users"]);
    const newBtn = el("button", { class: "btn btn-primary btn-small", type: "button", onclick: (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); openFormForUser(null); } }, ["New User"]);
    header.appendChild(title);
    header.appendChild(newBtn);

    const list = el("div", { class: "manage-users-list" });

    const backToManage = () => {
      openModal({ title: "Manage user", sub: "Hantera användare", bodyNode: renderManageUsers(current) });
    };

    function openFormForUser(userObjOrNull) {
      const existing = userObjOrNull || null;
      const body = renderForm(existing);
      openModal({ title: existing ? "Edit user" : "New user", sub: existing ? (existing.username || "") : "", bodyNode: body, onClose: backToManage, showFooterClose: false });
    }

    function renderList() {
      list.innerHTML = "";
      const users = getUsers();

      users.forEach((u) => {
        const row = el("div", { class: "manage-user-row" });

        const nameBtn = el("button", {
          type: "button",
          class: "link-btn manage-user-name",
          title: "Öppna",
          onclick: () => openFormForUser(u),
        }, [u.username || "(saknar namn)"]);

        const del = el("button", {
          class: "icon-btn up-trash manage-user-delete",
          type: "button",
          title: "Ta bort användaren",
          onclick: () => {
            if (u.id === current.id) { alert("Du kan inte ta bort dig själv."); return; }
            const ok = confirm(`Ta bort användaren "${u.username}"?`);
            if (!ok) return;
            const next = users.filter((x) => x.id !== u.id);
            setUsers(next);
            renderList();
          },
        }, ["🗑️"]);

        row.appendChild(nameBtn);
        row.appendChild(del);
        list.appendChild(row);
      });
    }

    function renderForm(existing) {
      const card = el("div", { style: "padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;" });
      const grid = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;" });

      const inUser = el("input", { class: "input", placeholder: "Namn/user", value: existing?.username || "" });
      const inPass = el("input", { class: "input", placeholder: "Password", type: "text", value: existing?.password || "" });
      const inEmail = el("input", { class: "input", placeholder: "Email", type: "email", value: existing?.email || "" });
      const inInit = el("input", { class: "input", placeholder: "Initials", value: existing?.initials || "" });

      const inRole = el("select", { class: "input" }, [
        el("option", { value: "user" }, ["user"]),
        el("option", { value: "admin" }, ["admin"]),
      ]);
      inRole.value = (existing?.role === "admin") ? "admin" : "user";
      
      // ToDo-filterkategorier (exkl. Privat) - vilka delade kategorier användaren ser i ToDo-filter
      const st = current;
      ensureTodoCategories(st);
      const allCats = getTodoCategories(st).filter((c) => c !== "Privat" && c !== "Alla");
      const picked = new Set(Array.isArray(existing?.todoFilterCategories) ? existing.todoFilterCategories : []);
      const catWrap = el("div", { style: "display:flex;flex-wrap:wrap;gap:8px;margin-top:6px;" });
      allCats.forEach((c) => {
        const chip = el("button", { type: "button", class: "pill", style: "font-weight:900;" }, [c]);
        if (picked.has(c)) chip.classList.add("pill-done");
        chip.addEventListener("click", () => {
          if (picked.has(c)) { picked.delete(c); chip.classList.remove("pill-done"); }
          else { picked.add(c); chip.classList.add("pill-done"); }
        });
        catWrap.appendChild(chip);
      });


      grid.appendChild(el("div", {}, [el("div", { class: "label" }, ["Namn/user"]), inUser]));
      grid.appendChild(el("div", {}, [el("div", { class: "label" }, ["Password"]), inPass]));
      grid.appendChild(el("div", {}, [el("div", { class: "label" }, ["Email"]), inEmail]));
      grid.appendChild(el("div", {}, [el("div", { class: "label" }, ["Initials"]), inInit]));
      grid.appendChild(el("div", {}, [el("div", { class: "label" }, ["Roll"]), inRole]));
      grid.appendChild(el("div", { style: "grid-column:1 / -1;" }, [el("div", { class: "label" }, ["ToDo-filterkategorier"]), el("div", { style: "font-size:12px;color:#6b7280;margin-bottom:6px;" }, ["Välj vilka kategorier som ska visas i ToDo-filter (Privat styrs separat)."]), catWrap]));

      const actions = el("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;" });
      const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Save"]);

      saveBtn.addEventListener("click", () => {
        const username = (inUser.value || "").trim();
        const password = (inPass.value || "").trim();
        const email = (inEmail.value || "").trim();
        const initials = (inInit.value || "").trim();
        const role = inRole.value || "user";
        const todoFilterCategories = Array.from(picked);

        if (!username || !password || !initials) { alert("Fyll i Namn/user, Password och Initials."); return; }
        if (email && !email.includes("@")) { alert("Email verkar inte korrekt."); return; }

        const users = getUsers();
        const lower = username.toLowerCase();

        if (!existing) {
          if (users.some((x) => (x.username || "").toLowerCase() === lower)) { alert("Användarnamnet finns redan."); return; }
          users.push({
            id: uid("u"),
            username,
            password,
            email,
            initials: initials.toUpperCase(),
            role: role === "admin" ? "admin" : "user",
            todoFilterCategories,
            createdAt: Date.now(),
          });
        } else {
          const other = users.find((x) => x.id !== existing.id && (x.username || "").toLowerCase() === lower);
          if (other) { alert("Användarnamnet finns redan."); return; }
          const u = users.find((x) => x.id === existing.id);
          if (!u) return;

          u.username = username;
          u.password = password;
          u.email = email;
          u.initials = initials.toUpperCase();
          u.role = role === "admin" ? "admin" : "user";
          u.todoFilterCategories = todoFilterCategories;

          if (u.id === current.id) {
            setUsers(users);
            alert("Din användare uppdaterades. Appen laddas om för att uppdatera sessionen.");
            location.reload();
            return;
          }
        }

        setUsers(users);
        backToManage();
      });

      actions.appendChild(saveBtn);

      card.appendChild(grid);
      card.appendChild(actions);

      return card;
    }

    wrap.appendChild(header);
    wrap.appendChild(list);

    renderList();
    return wrap;
  }

  
    function renderManageRegisters(state) {
    ensureTodoCategories(state);
    ensureDevTypes(state);

    // Custom registers (admin-defined)
    state.customRegisters = Array.isArray(state.customRegisters) ? state.customRegisters : [];

    const wrap = el("div", { class: "manage-reg-wrap" }, []);

    // --- Top / toolbar ---
    const top = el("div", { class: "reg-toolbar" });

    // Dropdown
    const regSel = el("select", { class: "input up-select reg-select" }, [
      el("option", { value: "kategori" }, ["Kategori"]),
      el("option", { value: "dev_type" }, ["Dev_type"]),
      ...state.customRegisters.map((r) => el("option", { value: r.id }, [r.name || "(Namnlös)"])),
    ]);

    // Återställ senast valda register i admin
    if (state.adminRegisterSelected && state.adminRegisterSelected !== regSel.value) {
      const opt = Array.from(regSel.options || []).some(o => o.value === state.adminRegisterSelected);
      if (opt) regSel.value = state.adminRegisterSelected;
    }


    // Actions (after dropdown)
    const btnDeleteReg = el("button", { class: "btn btn-small", type: "button" }, ["Ta bort"]);
    const btnNewReg = el("button", { class: "btn btn-primary btn-small", type: "button" }, ["Nytt register"]);
    const actions = el("div", { class: "reg-toolbar-actions" }, [btnDeleteReg, btnNewReg]);

    const hint = el("div", { class: "reg-hint" }, [
      "Kategori används i Tasks-filter. Dev_type används som dropdown (P-typ) i Utvecklingsprocess och Säljprocess Ny produkt.",
    ]);

    top.appendChild(el("div", { class: "label", style: "margin:0;" }, ["Register"]));
    top.appendChild(regSel);
    top.appendChild(actions);

    const body = el("div", {});

    function saveAndRerender() {
      // Ensure devTypes are mirrored for all consumers
      ensureDevTypes(state);
      state.register = state.register || {};
      state.registers = state.registers || {};
      state.register.dev_type = Array.isArray(state.devTypes) ? state.devTypes.slice() : [];
      state.registers.dev_type = Array.isArray(state.devTypes) ? state.devTypes.slice() : [];

      saveState(state);
      renderActive();
    }

    function clearKategoriRegister() {
      const ok = confirm('Ta bort hela registret "Kategori"? Alla tasks som använder kategorier sätts till "Allmänt".');
      if (!ok) return;

      // Töm managed list (reserved hanteras av ensureTodoCategories)
      state.todo = state.todo || {};
      state.todo.categories = [];

      // Replace on tasks + archive
      const fix = (t) => {
        if (!t) return;
        if ((t.category || "").toLowerCase() !== "privat") t.category = "Allmänt";
      };
      (state.todo.items || []).forEach(fix);
      (state.todo.archive || []).forEach(fix);
      state.todo.filter = "Alla";

      ensureTodoCategories(state);
      saveState(state);
      // categories påverkar huvud-UI => full render
      render(state);
      // och re-render modalen
      openModal({
        title: "Register",
        sub: "Hantera register",
        bodyNode: renderManageRegisters(state),
      });
    }

    function clearDevTypeRegister() {
      const ok = confirm('Ta bort hela registret "Dev_type"? (Detta tömmer dropdownen P-typ.)');
      if (!ok) return;
      state.devTypes = [];
      saveAndRerender();
    }

    function deleteCustomRegister(regId) {
      const reg = state.customRegisters.find((r) => r.id === regId);
      const name = reg?.name || "valt register";
      const ok = confirm(`Ta bort registret "${name}"?`);
      if (!ok) return;
      state.customRegisters = state.customRegisters.filter((r) => r.id !== regId);
      // hoppa tillbaka till kategori
      state.adminRegisterSelected = "kategori";
      regSel.value = "kategori";
      saveAndRerender();
    }

    btnDeleteReg.addEventListener("click", () => {
      const which = regSel.value;
      if (which === "kategori") return clearKategoriRegister();
      if (which === "dev_type") return clearDevTypeRegister();
      return deleteCustomRegister(which);
    });

    btnNewReg.addEventListener("click", () => {
      const name = prompt("Namn på nytt register:");
      const n = (name || "").trim();
      if (!n) return;

      // unikhet (case-insensitive)
      const low = n.toLowerCase();
      if (["kategori", "dev_type"].includes(low)) {
        alert("Det namnet är reserverat.");
        return;
      }
      if (state.customRegisters.some((r) => (r.name || "").trim().toLowerCase() === low)) {
        alert("Det registret finns redan.");
        return;
      }

      const reg = { id: uid("reg"), name: n, items: [] };
      state.customRegisters.push(reg);
      saveState(state);

      state.adminRegisterSelected = reg.id;
      saveState(state);

      openModal({
        title: "Register",
        sub: "Hantera register",
        bodyNode: renderManageRegisters(state),
      });
    });

    function renderDevType() {
      const list = el("div", { class: "reg-list" });
      const items = getDevTypes(state);

      items.forEach((name) => {
        const row = el("div", { class: "reg-row" });
        const input = el("input", { class: "input", value: name });
        const saveBtn = el("button", { class: "btn btn-small", type: "button" }, ["Spara"]);
        const delBtn = el("button", { class: "btn btn-small", type: "button" }, ["Ta bort"]);

        saveBtn.addEventListener("click", () => {
          const v = (input.value || "").trim();
          if (!v) return alert("Namn saknas.");
          state.devTypes = (state.devTypes || []).map((x) => (x === name ? v : x));
          state.devTypes = uniqStrings(state.devTypes);
          saveAndRerender();
        });

        delBtn.addEventListener("click", () => {
          const ok = confirm(`Ta bort "${name}"?`);
          if (!ok) return;
          state.devTypes = (state.devTypes || []).filter((x) => x !== name);
          saveAndRerender();
        });

        row.appendChild(input);
        row.appendChild(saveBtn);
        row.appendChild(delBtn);
        list.appendChild(row);
      });

      const addRow = el("div", { class: "reg-add-row" });
      const addIn = el("input", { class: "input", placeholder: "Ny dev_type..." });
      const addBtn = el("button", { class: "btn btn-primary btn-small", type: "button" }, ["Lägg till"]);

      addBtn.addEventListener("click", () => {
        const v = (addIn.value || "").trim();
        if (!v) return;
        state.devTypes = uniqStrings([...(state.devTypes || []), v]);
        addIn.value = "";
        saveAndRerender();
      });

      addRow.appendChild(addIn);
      addRow.appendChild(addBtn);

      body.appendChild(el("div", { class: "label" }, ["Dev_type"]));
      body.appendChild(list);
      body.appendChild(addRow);
    }

    function renderCustomRegister(regId) {
      const reg = state.customRegisters.find((r) => r.id === regId);
      if (!reg) return body.appendChild(el("div", { style: "color:#6b7280;font-size:13px;" }, ["Hittar inte registret."]));

      reg.items = Array.isArray(reg.items) ? reg.items : [];

      const list = el("div", { class: "reg-list" });

      reg.items.forEach((name) => {
        const row = el("div", { class: "reg-row" });
        const input = el("input", { class: "input", value: name });
        const saveBtn = el("button", { class: "btn btn-small", type: "button" }, ["Spara"]);
        const delBtn = el("button", { class: "btn btn-small", type: "button" }, ["Ta bort"]);

        saveBtn.addEventListener("click", () => {
          const v = (input.value || "").trim();
          if (!v) return alert("Namn saknas.");
          reg.items = uniqStrings(reg.items.map((x) => (x === name ? v : x)));
          saveAndRerender();
        });

        delBtn.addEventListener("click", () => {
          const ok = confirm(`Ta bort "${name}"?`);
          if (!ok) return;
          reg.items = reg.items.filter((x) => x !== name);
          saveAndRerender();
        });

        row.appendChild(input);
        row.appendChild(saveBtn);
        row.appendChild(delBtn);
        list.appendChild(row);
      });

      const addRow = el("div", { class: "reg-add-row" });
      const addIn = el("input", { class: "input", placeholder: "Nytt värde..." });
      const addBtn = el("button", { class: "btn btn-primary btn-small", type: "button" }, ["Lägg till"]);

      addBtn.addEventListener("click", () => {
        const v = (addIn.value || "").trim();
        if (!v) return;
        reg.items = uniqStrings([...(reg.items || []), v]);
        addIn.value = "";
        saveAndRerender();
      });

      addRow.appendChild(addIn);
      addRow.appendChild(addBtn);

      body.appendChild(el("div", { class: "label" }, [reg.name || "Register"]));
      body.appendChild(list);
      body.appendChild(addRow);
    }

    function renderActive() {
      body.innerHTML = "";
      const which = regSel.value;
      if (which === "kategori") body.appendChild(renderManageCategories(state));
      else if (which === "dev_type") renderDevType();
      else renderCustomRegister(which);
    }

    regSel.addEventListener("change", () => { state.adminRegisterSelected = regSel.value; saveState(state); renderActive(); });

    wrap.appendChild(top);
    wrap.appendChild(hint);
    wrap.appendChild(body);
    renderActive();
    return wrap;
  }


function renderManageCategories(state) {
    const wrap = el("div", {}, []);
    const header = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;" });

    const title = el("div", { style: "font-weight:1000;" }, ["Kategorier"]);
    const newBtn = el("button", { class: "btn btn-primary btn-small", type: "button" }, ["Ny kategori"]);
    header.appendChild(title);
    header.appendChild(newBtn);

    const hint = el("div", { style: "font-size:12px;color:#6b7280;margin-bottom:10px;" }, [
      'Dessa används i Tasks-kategori och i dropdown-filtret. "Alla" finns alltid med. "Privat" är en specialkategori och kan inte tas bort här.',
    ]);

    const list = el("div", { class: "reg-list" });

    function normalize(s) { return (s || "").toString().trim(); }
    function isReserved(name) {
      const low = (name || "").toString().trim().toLowerCase();
      return low === "alla" || low === "privat";
    }

    function refreshFromTasks() {
      ensureTodoCategories(state);
      saveState(state);
    }

    function rerenderEverything() {
      // Categories affect tasks + filters, so a full render is safest.
      ensureTodoCategories(state);
      saveState(state);
      render(state);
    }

    function renderList() {
      refreshFromTasks();
      list.innerHTML = "";

      const cats = getManagedTodoCategories(state);

      cats.forEach((name) => {
        const row = el("div", { class: "reg-row" });
        const input = el("input", { class: "input", value: name });
        const saveBtn = el("button", { class: "btn btn-small", type: "button" }, ["Spara"]);
        const delBtn = el("button", { class: "btn btn-small", type: "button" }, ["Ta bort"]);

        saveBtn.addEventListener("click", () => {
          const v = normalize(input.value);
          if (!v) return alert("Namn saknas.");
          if (isReserved(v)) return alert('"' + v + '" är reserverat.');
          const oldLow = name.toLowerCase();
          const newLow = v.toLowerCase();

          // Prevent duplicates (case-insensitive) except when it is the same item
          const others = getManagedTodoCategories(state).filter((x) => x.toLowerCase() !== oldLow);
          if (others.map((x) => x.toLowerCase()).includes(newLow)) return alert("Den kategorin finns redan.");

          // Rename in managed list
          state.todo = state.todo || {};
          const current = getManagedTodoCategories(state);
          state.todo.categories = current.map((x) => (x.toLowerCase() === oldLow ? v : x));

          // Rename on tasks
          const ren = (t) => {
            if (!t) return;
            if ((t.category || "").toLowerCase() === oldLow) t.category = v;
          };
          (state.todo.items || []).forEach(ren);
          (state.todo.archive || []).forEach(ren);

          // Rename active filter if needed
          if ((state.todo.filter || "").toLowerCase() === oldLow) state.todo.filter = v;

          rerenderEverything();
        });

        delBtn.addEventListener("click", () => {
          const low = name.toLowerCase();
          if (low === "privat") return alert('"Privat" kan inte tas bort här.');
          const ok = confirm(`Ta bort kategorin "${name}"? Alla tasks med denna kategori sätts till "Allmänt".`);
          if (!ok) return;

          state.todo = state.todo || {};

          // Remove from managed list
          state.todo.categories = getManagedTodoCategories(state).filter((x) => x.toLowerCase() !== low);

          // Replace on tasks
          const fix = (t) => {
            if (!t) return;
            if ((t.category || "").toLowerCase() === low) t.category = "Allmänt";
          };
          (state.todo.items || []).forEach(fix);
          (state.todo.archive || []).forEach(fix);

          if ((state.todo.filter || "").toLowerCase() === low) state.todo.filter = "Alla";

          rerenderEverything();
        });

        row.appendChild(input);
        row.appendChild(saveBtn);
        row.appendChild(delBtn);
        list.appendChild(row);
      });
    }

    const addRow = el("div", { class: "reg-add-row" });
    const addIn = el("input", { class: "input", placeholder: "Ny kategori..." });
    const addBtn = el("button", { class: "btn btn-primary btn-small", type: "button" }, ["Lägg till"]);

    function addCategoryFromInput() {
      const v = normalize(addIn.value);
      if (!v) return;
      if (isReserved(v)) return alert('"' + v + '" är reserverat.');
      const low = v.toLowerCase();

      const cats = getManagedTodoCategories(state);
      if (cats.map((x) => x.toLowerCase()).includes(low)) return alert("Den kategorin finns redan.");

      state.todo = state.todo || {};
      state.todo.categories = uniqStrings([...cats, v]);

      addIn.value = "";
      rerenderEverything();
    }

    addBtn.addEventListener("click", addCategoryFromInput);
    addIn.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        addCategoryFromInput();
      }
    });

    newBtn.addEventListener("click", () => {
      addIn.focus();
    });

    addRow.appendChild(addIn);
    addRow.appendChild(addBtn);

    wrap.appendChild(header);
    wrap.appendChild(hint);
    wrap.appendChild(list);
    wrap.appendChild(addRow);

    renderList();
    return wrap;
  }

  // -------------------------------
  // Login screen

  // -------------------------------
  function mountLogin(app) {
    app.innerHTML = "";

    const users = getUsers();
    const card = el("div", { class: "login-card" }, [
      el("div", { class: "login-title" }, ["Logga in"]),
      el("div", { class: "login-sub" }, ["Login krävs innan appen öppnas."]),
    ]);

    const form = el("form", { class: "login-form" });
    const userSel = el("select", { class: "input" }, users.map((u) => el("option", { value: u.username }, [u.username])));
    const pw = el("input", { class: "input", type: "password", placeholder: "Lösenord" });
    const msg = el("div", { class: "login-msg" }, [""]);

    const btn = el("button", { class: "btn btn-primary", type: "submit" }, ["Logga in"]);

    form.appendChild(el("div", { class: "label" }, ["Användare"]));
    form.appendChild(userSel);
    form.appendChild(el("div", { class: "label", style: "margin-top:10px;" }, ["Lösenord"]));
    form.appendChild(pw);
    form.appendChild(btn);
    form.appendChild(msg);

    form.addEventListener("submit", (e) => {
      e.preventDefault();
      const res = login(userSel.value, pw.value);
      if (!res.ok) {
        msg.textContent = res.message;
        msg.classList.add("is-error");
        return;
      }
      location.reload();
    });

    const seedHint = el("div", { class: "login-hint" }, ["Seed: ", el("b", {}, ["Dick"]), " (admin), lösenord ", el("b", {}, ["admin"]), "."]);
    const wrap = el("div", { class: "login-wrap" }, [card, form, seedHint]);
    app.appendChild(wrap);
  }

  // -------------------------------
  // Generic progress bar
  // -------------------------------
  function progressNode(doneCount, totalSteps) {
    const wrap = el("div", { class: "up-progress", role: "progressbar" });
    const steps = Math.max(0, totalSteps || 0);
    if (steps === 0) {
      wrap.appendChild(el("span", { class: "up-step" }));
      return wrap;
    }
    for (let i = 0; i < steps; i++) wrap.appendChild(el("span", { class: `up-step ${i < doneCount ? "is-done" : ""}` }));
    return wrap;
  }

  // -------------------------------
  // Utvecklingsprocess (admin schema)
  // -------------------------------
  function allTasks(activity) {
    const tasks = Array.isArray(activity?.tasks) ? activity.tasks : [];
    return tasks.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
  }

  function enabledTasks(activity) {
    const tasks = Array.isArray(activity?.tasks) ? activity.tasks : [];
    // Bakåtkompatibilitet: om 'enabled' saknas -> räknas som aktiv
    return tasks
      .filter((t) => t?.enabled !== false)
      .slice()
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  function openDevSchemaModal(state) {
    const user = currentUser();

    ensureDevTypes(state);
    const devTypes = getDevTypes(state);
    if (user?.role !== "admin") return;

    const wrap = el("div", {}, []);
    const header = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;" });
    header.appendChild(el("div", { style: "font-weight:1000;" }, ["Aktiviteter"]));

    const newBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Ny aktivitet"]);
    header.appendChild(newBtn);

    const list = el("div", { class: "reg-list" });

    function renderList() {
      list.innerHTML = "";
      const acts = state.devSchema.activities;

      if (!acts.length) {
        list.appendChild(el("div", { style: "padding:12px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;" }, [
          "Inga aktiviteter ännu. Klicka på “Ny aktivitet”.",
        ]));
        return;
      }

      acts.forEach((a) => {
        const row = el("div", { style: "display:flex;align-items:center;",
          style: "display:grid;grid-template-columns:1fr 120px 140px 40px;gap:10px;align-items:center;padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;",
        });

        const name = el("input", {
          class: "input",
          value: a.name || "",
          oninput: (e) => { a.name = e.target.value; saveState(state); render(state); },
        });

        const typeSel = el("select", {
          class: "input",
          onchange: (e) => { a.type = e.target.value; saveState(state); render(state); },
        }, DEV_ACTIVITY_TYPES.map((t) => {
          const opt = el("option", { value: t }, [t]);
          if (a.type === t) opt.selected = true;
          return opt;
        }));

        const defTasksBtn = el("button", {
          class: "pill",
          type: "button",
          onclick: () => openDefTasksModal(state, a),
          title: "Definiera tasks",
        }, ["Def Tasks"]);

        const delBtn = el("button", {
          class: "icon-btn up-trash",
          type: "button",
          title: "Ta bort aktivitet",
          onclick: () => {
            const ok = confirm(`Ta bort aktiviteten "${a.name}"?`);
            if (!ok) return;
            // Remove activity and related entry fields
            state.devSchema.activities = state.devSchema.activities.filter((x) => x.id !== a.id);
            state.devEntries.forEach((e) => { delete e.fields[a.id]; });
            saveState(state);
            render(state);
            renderList();
          },
        }, ["🗑️"]);

        row.appendChild(name);
        row.appendChild(typeSel);
        row.appendChild(defTasksBtn);
        row.appendChild(delBtn);

        list.appendChild(row);
      });
    }

    newBtn.addEventListener("click", () => {
      openNewActivityForm(state, () => { renderList(); });
    });

    wrap.appendChild(header);
    wrap.appendChild(list);
    renderList();

    openModal({ title: "Definiera utvecklingstabell", sub: "Admin: aktiviteter", bodyNode: wrap });
  }

  // Admin view for Utvecklingsprocess (inline, not using Ny utveckling)
  function renderDevAdminView(state) {
    const view = document.getElementById("view");
    view.innerHTML = "";

    const user = currentUser();
    if (user?.role !== "admin") return;

    const wrap = el("div", {}, []);

    const header = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;" }, [
      el("div", { style: "font-weight:1000;font-size:16px;" }, ["Definiera utvecklingstabell"]),
    ]);

    const newBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Ny aktivitet"]);
    header.appendChild(newBtn);

    const list = el("div", { class: "reg-list" });

    function renderList() {

      function moveActivity(idx, dir) {
        const acts = state.devSchema.activities;
        const j = idx + dir;
        if (j < 0 || j >= acts.length) return;
        const tmp = acts[idx];
        acts[idx] = acts[j];
        acts[j] = tmp;
        // Sätt/uppdatera ordning så att USER-tabeller följer Admin (även efter omstart)
        acts.forEach((a, i) => { if (a) a.order = i + 1; });
        saveState(state);
        render(state);
      }

      list.innerHTML = "";
      const acts = state.devSchema.activities;

      if (!acts.length) {
        list.appendChild(el("div", { style: "padding:12px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;" }, [
          "Inga aktiviteter ännu. Klicka på “Ny aktivitet”.",
        ]));
        return;
      }

      acts.forEach((a, idx) => {
        const row = el("div", {
          style: "display:grid;grid-template-columns:20px 1fr 140px 140px 40px;gap:10px;align-items:center;padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;",
        });

      const sel = el("input", { type: "checkbox", style: "width:14px;height:14px;margin:0 6px 0 0;flex:0 0 auto;" });
      sel.addEventListener("keydown", (e) => {
        if (!sel.checked) return;
        if (e.key === "ArrowUp") { e.preventDefault(); moveActivity(idx, -1); }
        if (e.key === "ArrowDown") { e.preventDefault(); moveActivity(idx, +1); }
      });
      row.appendChild(sel);
        const name = el("input", {
          class: "input",
          value: a.name || "",
          oninput: (e) => { a.name = e.target.value; saveState(state); },
        });

        const typeSel = el("select", {
          class: "input",
          onchange: (e) => { a.type = e.target.value; saveState(state); render(state); },
        }, DEV_ACTIVITY_TYPES.map((t) => {
          const opt = el("option", { value: t }, [t]);
          if (a.type === t) opt.selected = true;
          return opt;
        }));

        const defTasksBtn = el("button", {
          class: "pill",
          type: "button",
          onclick: () => openDefTasksModal(state, a),
          title: "Definiera tasks",
        }, ["Def Tasks"]);

        const delBtn = el("button", {
          class: "icon-btn up-trash",
          type: "button",
          title: "Ta bort aktivitet",
          onclick: () => {
            const ok = confirm(`Ta bort aktiviteten "${a.name}"?`);
            if (!ok) return;
            state.devSchema.activities = state.devSchema.activities.filter((x) => x.id !== a.id);
            state.devEntries.forEach((e) => { delete e.fields[a.id]; });
            saveState(state);
            render(state);
            renderList();
          },
        }, ["🗑️"]);

        row.appendChild(name);
        row.appendChild(typeSel);
        row.appendChild(defTasksBtn);
        row.appendChild(delBtn);

        list.appendChild(row);
      });
    }

    newBtn.addEventListener("click", () => {
      openNewActivityForm(state, () => renderList());
    });

    wrap.appendChild(header);
    wrap.appendChild(list);
    renderList();

    view.appendChild(wrap);
  }

  // Admin view for Produkt (samma admin-UI som Utvecklingsprocess)
  function renderProductAdminView(state) {
    const view = document.getElementById("view");
    view.innerHTML = "";

    const user = currentUser();
    if (user?.role !== "admin") return;

    const wrap = el("div", {}, []);

    const header = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;" }, [
      el("div", { style: "font-weight:1000;font-size:16px;" }, ["Definiera säljtabell"]),
    ]);

    const newBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Ny aktivitet"]);
    header.appendChild(newBtn);

    const list = el("div", { class: "reg-list" });

    function renderList() {

      function moveActivity(idx, dir) {
        const acts = state.productSchema.activities;
        const j = idx + dir;
        if (j < 0 || j >= acts.length) return;
        const tmp = acts[idx];
        acts[idx] = acts[j];
        acts[j] = tmp;
        // Sätt/uppdatera ordning så att USER-tabeller följer Admin (även efter omstart)
        acts.forEach((a, i) => { if (a) a.order = i + 1; });
        saveState(state);
        render(state);
      }

      list.innerHTML = "";
      const acts = state.productSchema.activities;

      if (!acts.length) {
        list.appendChild(el("div", { style: "padding:12px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;" }, [
          "Inga aktiviteter ännu. Klicka på “Ny aktivitet”.",
        ]));
        return;
      }

      acts.forEach((a, idx) => {
        const row = el("div", {
          style: "display:grid;grid-template-columns:20px 1fr 140px 140px 40px;gap:10px;align-items:center;padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;",
        });

      const sel = el("input", { type: "checkbox", style: "width:14px;height:14px;margin:0 6px 0 0;flex:0 0 auto;" });
      sel.addEventListener("keydown", (e) => {
        if (!sel.checked) return;
        if (e.key === "ArrowUp") { e.preventDefault(); moveActivity(idx, -1); }
        if (e.key === "ArrowDown") { e.preventDefault(); moveActivity(idx, +1); }
      });
      row.appendChild(sel);
        const name = el("input", {
          class: "input",
          value: a.name || "",
          oninput: (e) => { a.name = e.target.value; saveState(state); },
        });

        const typeSel = el("select", {
          class: "input",
          onchange: (e) => { a.type = e.target.value; saveState(state); render(state); },
        }, DEV_ACTIVITY_TYPES.map((t) => {
          const opt = el("option", { value: t }, [t]);
          if (a.type === t) opt.selected = true;
          return opt;
        }));

        const defTasksBtn = el("button", {
          class: "pill",
          type: "button",
          onclick: () => openDefTasksModal(state, a),
          title: "Definiera tasks",
        }, ["Def Tasks"]);

        const delBtn = el("button", {
          class: "icon-btn up-trash",
          type: "button",
          title: "Ta bort aktivitet",
          onclick: () => {
            const ok = confirm(`Ta bort aktiviteten "${a.name}"?`);
            if (!ok) return;
            state.productSchema.activities = state.productSchema.activities.filter((x) => x.id !== a.id);
            state.devEntries.forEach((e) => { delete e.fields[a.id]; });
            saveState(state);
            render(state);
            renderList();
          },
        }, ["🗑️"]);

        row.appendChild(name);
        row.appendChild(typeSel);
        row.appendChild(defTasksBtn);
        row.appendChild(delBtn);

        list.appendChild(row);
      });
    }

    newBtn.addEventListener("click", () => {
      openNewProductActivityForm(state, () => renderList());
    });

    wrap.appendChild(header);
    wrap.appendChild(list);
    renderList();

    view.appendChild(wrap);
  }

// Admin view for Produkt (samma admin-UI som Utvecklingsprocess)
  

  function openNewActivityForm(state, onAfterSave) {
    const nameIn = el("input", { class: "input", placeholder: "Namn" });
    const typeSel = el("select", { class: "input" }, DEV_ACTIVITY_TYPES.map((t) => el("option", { value: t }, [t])));

    const form = el("div", {}, [
      el("div", { class: "label" }, ["Ny aktivitet"]),
      el("div", { style: "display:grid;grid-template-columns:1fr 160px;gap:10px;align-items:end;" }, [
        el("div", {}, [el("div", { class: "label" }, ["Namn"]), nameIn]),
        el("div", {}, [el("div", { class: "label" }, ["Akt-typ"]), typeSel]),
      ]),
    ]);

    const actions = el("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;" });
    const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Save"]);
    const cancelBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Cancel"]);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    cancelBtn.addEventListener("click", () => { closeModal(); render(state); });
    saveBtn.addEventListener("click", () => {
      const name = (nameIn.value || "").trim();
      const type = typeSel.value;
      if (!name) { alert("Namn krävs."); return; }
      state.devSchema.activities.push({
        id: uid("act"),
        name,
        type: DEV_ACTIVITY_TYPES.includes(type) ? type : "text",
        tasks: [],
        createdAt: Date.now(),
      });
      saveState(state);
      closeModal();
      onAfterSave && onAfterSave();
      });

    openModal({ title: "Ny aktivitet", sub: "Admin", bodyNode: el("div", {}, [form, actions]) });
  }

  // Product: new activity form (admin)
  function openNewProductActivityForm(state, onAfterSave) {
    const nameIn = el("input", { class: "input", placeholder: "Namn" });
    const typeSel = el("select", { class: "input" }, DEV_ACTIVITY_TYPES.map((t) => el("option", { value: t }, [t])));

    const form = el("div", {}, [
      el("div", { class: "label" }, ["Ny sälj-aktivitet"]),
      el("div", { style: "display:grid;grid-template-columns:1fr 160px;gap:10px;align-items:end;" }, [
        el("div", {}, [el("div", { class: "label" }, ["Namn"]), nameIn]),
        el("div", {}, [el("div", { class: "label" }, ["Akt-typ"]), typeSel]),
      ]),
    ]);

    const actions = el("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;" });
    const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Save"]);
    const cancelBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Cancel"]);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    cancelBtn.addEventListener("click", () => { closeModal(); render(state); });
    saveBtn.addEventListener("click", () => {
      const name = (nameIn.value || "").trim();
      const type = typeSel.value;
      if (!name) { alert("Namn krävs."); return; }
      state.productSchema.activities.push({
        id: uid("act"),
        name,
        type: DEV_ACTIVITY_TYPES.includes(type) ? type : "text",
        tasks: [],
        createdAt: Date.now(),
      });
      saveState(state);
      closeModal();
      onAfterSave && onAfterSave();
      });

    openModal({ title: "Ny sälj-aktivitet", sub: "Admin", bodyNode: el("div", {}, [form, actions]) });
  }


  // Product: new activity form (admin)
  

  function openDefTasksModal(state, activity) {
    const user = currentUser();
    if (user?.role !== "admin") return;

    const wrap = el("div", {}, []);
    const header = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;" }, [
      el("div", { style: "font-weight:1000;" }, [`Tasks – ${activity.name || ""}`]),
    ]);
    const newBtn = el("button", { class: "btn btn-primary", type: "button" }, ["New Task"]);
    header.appendChild(newBtn);

    const table = el("table", { class: "table dev-table" });
    const thead = el("thead", {}, [
      el("tr", {}, [
        el("th", {}, [""]),
        el("th", {}, ["Namn"]),
        el("th", {}, [""]),
        el("th", {}, [""]),
        el("th", {}, [""]),
      ]),
    ]);
    const tbody = el("tbody");

    function renumberOrders() {
      activity.tasks.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      activity.tasks.forEach((t, i) => { t.order = i; });
    }

    function moveTask(taskId, dir) {
      renumberOrders();
      const tasks = activity.tasks.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
      const idx = tasks.findIndex((t) => t.id === taskId);
      if (idx < 0) return;

      const current = tasks[idx];
      // Bara tasks som är ikryssade (enabled) ska kunna flyttas
      if (current.enabled === false) return;

      const swapIdx = dir === "up" ? idx - 1 : idx + 1;
      if (swapIdx < 0 || swapIdx >= tasks.length) return;

      const other = tasks[swapIdx];

      // swap order med närmaste task i listan (oavsett enabled-status)
      const a = activity.tasks.find((x) => x.id === current.id);
      const b = activity.tasks.find((x) => x.id === other.id);
      if (!a || !b) return;

      const tmp = a.order;
      a.order = b.order;
      b.order = tmp;

      renumberOrders();
      saveState(state);
      render(state);
      renderTasks();
    }

    function renderTasks() {
      tbody.innerHTML = "";
      renumberOrders();

      const tasks = activity.tasks.slice().sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

      if (!tasks.length) {
        const tr = el("tr", {}, [
          el("td", { colspan: "5", style: "padding:14px;color:#6b7280;" }, ["Inga tasks ännu. Klicka på “New Task”."]),
        ]);
        tbody.appendChild(tr);
        return;
      }

      tasks.forEach((t) => {
        const tr = el("tr");

        const cb = el("input", {
          type: "checkbox",
          onchange: (e) => {
            t.enabled = !!e.target.checked;
            saveState(state);
            render(state);
            renderTasks();
          },
        });
        cb.checked = (t.enabled !== false);
        if (t.enabled === undefined) { t.enabled = true; }

        const nameIn = el("input", {
          class: "input",
          value: t.name || "",
          oninput: (e) => {
            t.name = e.target.value;
            saveState(state);
            render(state);
          },
        });

        const upBtn = el("button", {
          type: "button",
          class: "icon-btn",
          title: "Upp",
          onclick: () => moveTask(t.id, "up"),
        }, ["⬆️"]);
        const downBtn = el("button", {
          type: "button",
          class: "icon-btn",
          title: "Ner",
          onclick: () => moveTask(t.id, "down"),
        }, ["⬇️"]);

        if (t.enabled === false) { upBtn.disabled = true; downBtn.disabled = true; }

        const delBtn = el("button", {
          type: "button",
          class: "icon-btn up-trash",
          title: "Ta bort task",
          onclick: () => {
            const ok = confirm(`Ta bort task "${t.name}"?`);
            if (!ok) return;
            activity.tasks = activity.tasks.filter((x) => x.id !== t.id);
            // Also remove done flags from all entries
            state.devEntries.forEach((e) => {
              const cell = e.fields?.[activity.id];
              if (cell?.tasksData) delete cell.tasksData[t.id];
            });
            saveState(state);
            render(state);
            renderTasks();
          },
        }, ["🗑️"]);

        tr.appendChild(el("td", {}, [cb]));
        tr.appendChild(el("td", {}, [nameIn]));
        tr.appendChild(el("td", {}, [upBtn]));
        tr.appendChild(el("td", {}, [downBtn]));
        tr.appendChild(el("td", {}, [delBtn]));
        tbody.appendChild(tr);
      });
    }

    newBtn.addEventListener("click", () => {
      openNewTaskForm(state, activity, () => renderTasks());
    });

    table.appendChild(thead);
    table.appendChild(tbody);

    wrap.appendChild(header);
    wrap.appendChild(table);
    renderTasks();

    openModal({ title: "Def tasks", sub: "Admin: definiera tasks för aktivitet", bodyNode: wrap });
  }

  function openNewTaskForm(state, activity, onAfterSave) {
    const nameIn = el("input", { class: "input", placeholder: "Namn" });

    const actions = el("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;" });
    const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Save"]);
    const cancelBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Cancel"]);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    cancelBtn.addEventListener("click", () => { closeModal(); render(state); });
    saveBtn.addEventListener("click", () => {
      const name = (nameIn.value || "").trim();
      if (!name) { alert("Namn krävs."); return; }
      activity.tasks = Array.isArray(activity.tasks) ? activity.tasks : [];
      activity.tasks.push({
        id: uid("dt"),
        name,
        enabled: true,
        order: activity.tasks.length,
        createdAt: Date.now(),
      });
      saveState(state);
      closeModal();
      onAfterSave && onAfterSave();
      // reopen Def tasks modal for convenience
      openDefTasksModal(state, activity);
    });

    const body = el("div", {}, [
      el("div", { class: "label" }, ["New Task"]),
      el("div", {}, [el("div", { class: "label" }, ["Namn"]), nameIn]),
      actions,
    ]);

    openModal({ title: "New Task", sub: activity.name || "", bodyNode: body });
  }

  // -------------------------------
  // Utvecklingsprocess (user table)
  // -------------------------------
  function ensureDevEntryCell(entry, activity) {
  entry.fields = entry.fields || {};

  let cell = entry.fields[activity.id];

  // Create if missing
  if (!cell || typeof cell !== "object") {
    cell = entry.fields[activity.id] = (activity.type === "status") ? { tasksData: {} } : { value: "" };
  }

  // Normalize per type
  if (activity.type === "status") {
    cell.tasksData = (cell.tasksData && typeof cell.tasksData === "object") ? cell.tasksData : {};

    // Migrate / normalize each task-data record
    Object.keys(cell.tasksData).forEach((tid) => {
      const td = cell.tasksData[tid];
      if (td && typeof td === "object") {
        cell.tasksData[tid] = {
          done: !!td.done,
          date: td.date || "",
          notes: Array.isArray(td.notes) ? td.notes : [],
        };
      } else {
        // old shape: boolean done
        cell.tasksData[tid] = { done: !!td, date: "", notes: [] };
      }
    });
  } else {
    if (!("value" in cell)) cell.value = "";
    // for vecka-kalender we also use cell.date (keep as-is)
  }

  // Notess live on the activity-cell (per entry/row + activity)
  cell.comments = Array.isArray(cell.comments) ? cell.comments : [];

  return cell;
}

  function countDoneSteps(entry, activity) {
    const tasks = allTasks(activity);
    if (!tasks.length) return 0;
    const cell = entry.fields?.[activity.id];
    const data = cell?.tasksData || {};
    let c = 0;
    tasks.forEach((t) => { if (data[t.id]?.done) c++; });
    return c;
  }


  function openUserTaskNotesModal(state, entry, activity, task) {
    const cell = ensureDevEntryCell(entry, activity);
    const data = cell.tasksData || (cell.tasksData = {});
    const td = data[task.id] || (data[task.id] = { done: false, date: "", notes: [] });

    const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;margin-top:10px;" });

    function renderList() {
      list.innerHTML = "";
      const notes = Array.isArray(td.notes) ? td.notes.slice() : [];
      notes.sort((a, b) => (b.at ?? 0) - (a.at ?? 0));

      if (notes.length === 0) {
        list.appendChild(el("div", { style: "padding:12px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;" }, [
          "Inga anteckningar ännu.",
        ]));
        return;
      }

      notes.forEach((n) => {
        const dt = new Date(n.at || Date.now());
        const stamp = dt.toLocaleString();
        list.appendChild(el("div", { style: "padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;display:flex;flex-direction:column;gap:6px;" }, [
          el("div", { style: "font-size:12px;color:#6b7280;font-weight:800;" }, [stamp]),
          el("div", { style: "white-space:pre-wrap;" }, [n.text || ""]),
        ]));
      });
    }

    const input = el("textarea", { class: "input todo-notes", placeholder: "Skriv anteckning…" });
    const addBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Add"]);
    const closeBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Close"]);

    addBtn.addEventListener("click", () => {
      const text = (input.value || "").trim();
      if (!text) return;
      td.notes = Array.isArray(td.notes) ? td.notes : [];
      td.notes.unshift({ id: uid("note"), text, at: Date.now() });
      input.value = "";
      saveState(state);
      render(state);
      renderList();
    });

    closeBtn.addEventListener("click", () => {
      closeModal();
      render(state);
    });

    const actions = el("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;" }, [
      closeBtn, addBtn,
    ]);

    const body = el("div", {}, [
      el("div", { class: "label" }, ["Notes"]),
      el("div", { style: "font-weight:1000;margin-top:4px;" }, [task.name || ""]),
      el("div", { style: "margin-top:10px;" }, [input]),
      actions,
      el("div", { style: "margin-top:12px;" }, [list]),
    ]);

    renderList();
    openModal({ title: "Task – Notes", sub: entry.name || "", bodyNode: body });
  }

  function openUserTasksModal(state, entry, activity) {
    const tasks = allTasks(activity);
    const cell = ensureDevEntryCell(entry, activity);
    const data = cell.tasksData || (cell.tasksData = {});

    const wrap = el("div", {}, []);

    const table = el("table", { class: "table" });
    const thead = el("thead", {}, [
      el("tr", {}, [
        el("th", {}, [""]),
        el("th", {}, ["Namn"]),
        el("th", {}, ["Prel datum"]),
        el("th", {}, ["Notes"]),
      ]),
    ]);
    const tbody = el("tbody");

    function renderRows() {
      tbody.innerHTML = "";

      if (!tasks.length) {
        tbody.appendChild(el("tr", {}, [
          el("td", { colspan: "4", style: "padding:14px;color:#6b7280;" }, ["Inga tasks definierade (eller inga markerade i admin)."]),
        ]));
        return;
      }

      tasks.forEach((t) => {
        const td = data[t.id] || (data[t.id] = { done: false, date: "", notes: [] });

        const tr = el("tr");

        const cb = el("input", {
          type: "checkbox",
          onchange: (e) => {
            td.done = !!e.target.checked;
            saveState(state);
            render(state);
            renderRows();
          },
        });
        cb.checked = !!td.done;

        const name = el("div", { style: "font-weight:900;" }, [t.name || ""]);

        const dateIn = el("input", {
          class: "input",
          type: "date",
          value: td.date || "",
          onchange: (e) => {
            td.date = e.target.value;
            saveState(state);
            render(state);
          },
        });

        const hasNotes = Array.isArray(td.notes) && td.notes.length > 0;
        const notesBtn = el("button", {
          type: "button",
          class: `icon-btn note-btn ${hasNotes ? "is-notes" : ""}`,
          title: "Notes",
          onclick: () => openUserTaskNotesModal(state, entry, activity, t),
        }, ["🗒️"]);

        tr.appendChild(el("td", {}, [cb]));
        tr.appendChild(el("td", {}, [name]));
        tr.appendChild(el("td", {}, [dateIn]));
        tr.appendChild(el("td", {}, [notesBtn]));

        tbody.appendChild(tr);
      });
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    wrap.appendChild(table);

    renderRows();

    openModal({
      title: `Tasks – ${activity.name || ""}`,
      sub: entry.name ? entry.name : "",
      bodyNode: wrap,
    });
  }

  function renderDevTable(state) {
    const view = document.getElementById("view");
    view.innerHTML = "";

    const user = currentUser();
    ensureDevTypes(state);
    const devTypes = getDevTypes(state);
        const acts = state.devSchema.activities.slice();
    // Normalisera legacy-typer
    state.devSchema.activities.forEach((a) => { if (a) a.type = normalizeActivityType(a.type); });
    // Respektera admin-ordningen: använd order/sortOrder/position om den finns, annars behåll array-ordningen.
    const hasOrder = acts.some((a) => a?.order != null || a?.sortOrder != null || a?.position != null);
    if (hasOrder) {
      const ord = (x) => (x?.order ?? x?.sortOrder ?? x?.position ?? 0);
      acts.sort((a, b) => ord(a) - ord(b) || (a.createdAt ?? 0) - (b.createdAt ?? 0));
    }

    const cols = [
      { key: "name", label: "Namn", type: "passive" },
      { key: "__type__", label: "P-typ", type: "type" },
      ...acts.map((a) => ({ key: a.id, label: a.name, type: a.type, activity: a })),
    ];

    if (!acts.length) {
      view.appendChild(el("div", { style: "padding:18px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;" }, [
        user?.role === "admin"
          ? "Inga aktiviteter definierade. Klicka på “Definiera utvecklingstabell”."
          : "Inga aktiviteter definierade ännu. Be admin definiera utvecklingstabellen.",
      ]));
      return;
    }

    const table = el("table", { class: "table" });
    const thead = el("thead", {}, [
      el("tr", {}, [
        ...cols.map((c) => el("th", {}, [c.label])),
        el("th", {}, [""]),
      ]),
    ]);
const tbody = el("tbody");

    state.devEntries.forEach((entry) => {
      const tr = el("tr");

      // name
      tr.appendChild(el("td", {}, [
        el("input", {
          class: "input",
          value: entry.name ?? "",
          placeholder: "Skriv namn…",
          oninput: (e) => { entry.name = e.target.value; saveState(state); },
        }),
      ]));

      // typ (dev_type register)
      tr.appendChild(el("td", {}, [
        el("select", {
          class: "select ptype-select",
          value: entry.type ?? "",
          onchange: (e) => {
            entry.type = e.target.value || "";
            saveState(state);
          },
        }, [
          el("option", { value: "" }, ["—"]),
          ...devTypes.map((t) => el("option", { value: t }, [t])),
        ]),
      ]));

      // dynamic activity cols
acts.forEach((a) => {
  const td = el("td");
  const cell = ensureDevEntryCell(entry, a);

  // Normalize
  cell.comments = Array.isArray(cell.comments) ? cell.comments : [];
  if (!("status" in cell)) cell.status = null;
  if (!("ownerInitials" in cell)) cell.ownerInitials = "";

  // Main editor/control for this activity (value)
  let valueNode = null;

  const at = String(a.type || "").toLowerCase().trim();

  if (at === "text") {
    valueNode = el("input", {
      class: "act-value-input",
      value: cell.value ?? "",
      placeholder: "",
      oninput: (e) => { cell.value = e.target.value; saveState(state); },
    });

  } else if (at === "veckonummer" || at === "weeknumber" || at === "veckokalender" || at === "weekcalendar" || at === "veckokalendar") {
    // Week picker: store ISO week key (YYYY-WNN) and show as "vNN"
    const wrap = el("div", { class: "act-date-wrap" });

    const wk = (cell.value || "").toString().trim();
    const mm = /^(\d{4})-W(\d{2})$/.exec(wk);
    const shownTxt = mm ? `v${mm[2]}` : (wk ? wk : "---");

    const shown = el("div", { class: "act-value act-date-display", title: wk }, [shownTxt]);

    // Set picker value from stored date (preferred) or from week key range start
    let pickVal = (cell.date || "").toString();
    if (!pickVal && mm) {
      const r = weekRangeFromKey(wk);
      if (r && r.start) pickVal = new Date(r.start).toISOString().slice(0, 10);
    }

    const picker = el("input", {
      type: "date",
      value: pickVal,
      class: "act-date-picker",
    });
    // Ensure clicks go to the visible display/wrap (works even if CSS lacks pointer-events:none)
    picker.style.pointerEvents = "none";

    shown.addEventListener("click", () => {
      if (typeof picker.showPicker === "function") picker.showPicker();
      else { picker.focus(); picker.click(); }
    });

    // Make the whole date field area clickable (not just the text)
    wrap.addEventListener("click", () => {
      if (typeof picker.showPicker === "function") picker.showPicker();
      else { picker.focus(); picker.click(); }
    });

    picker.addEventListener("change", (e) => {
      const v = e.target.value || "";
      cell.date = v;
      if (!v) cell.value = "";
      else cell.value = isoWeekKey(new Date(v + "T00:00:00"));
      saveState(state);
      render(state);
    });

    wrap.appendChild(shown);
    wrap.appendChild(picker);
    valueNode = wrap;

  } else if (at === "date" || at === "kalender") {
    // Date field: click on display to open native picker
    const wrap = el("div", { class: "act-date-wrap" });
    const shown = el("div", { class: "act-value act-date-display", title: cell.value ?? "" }, [cell.value ? cell.value : "-- -- --"]);
    const picker = el("input", {
      type: "date",
      value: cell.value ?? "",
      class: "act-date-picker",
    });
    // Ensure clicks go to the visible display/wrap (works even if CSS lacks pointer-events:none)
    picker.style.pointerEvents = "none";

    shown.addEventListener("click", () => {
      if (typeof picker.showPicker === "function") picker.showPicker();
      else { picker.focus(); picker.click(); }
    });

    picker.addEventListener("change", (e) => {
      cell.value = e.target.value || "";
      saveState(state);
      render(state);
    });
    wrap.appendChild(shown);
    wrap.appendChild(picker);
    valueNode = wrap;

  } else if (at === "status" || at === "steg") {
    // Status-only activity
    valueNode = el("div", { class: "act-value act-status-only" }, [""]);
  } else {
    valueNode = el("div", { class: "act-value" }, [cell.value ?? ""]);
  }

  // Build unified activity field (brick)
  const statusClass = cell.status === "green" ? "status-green" : (cell.status === "yellow" ? "status-yellow" : (cell.status === "red" ? "status-red" : ""));
  const field = el("div", { class: `act-field ${statusClass} act-type-${at || "unknown"}` });

  const statusCorner = el("div", {
    class: "act-status-corner",
    title: "Ändra status",
    onclick: () => {
      cell.status = nextActivityStatus(cell.status);
      saveState(state);
      render(state);
    },
  });

  const ownerTxt = ((cell.ownerInitials || "").toUpperCase() || "--").slice(0, 2);
  const ownerBtn = el("span", {
    class: `owner-badge ${cell.comments.length > 0 ? "has-notes" : ""}`,
    title: cell.comments.length ? `Notes (${cell.comments.length})` : "Notes",
    onclick: () => openActivityNotesModal(state, entry, a, user),
    oncontextmenu: (e) => {
      e.preventDefault();
      openOwnerPickerModal(state, cell);
    },
  }, [ownerTxt]);

  const valueWrap = el("div", { style: "flex:1;min-width:0;" }, [valueNode]);

  // Make text fields easier to click: focus input when clicking the brick/value area
  if (at === "text" && valueNode && typeof valueNode.focus === "function") {
    field.style.cursor = "text";
    const focusInput = () => { try { valueNode.focus(); } catch(_) {} };
    valueWrap.addEventListener("click", (e) => {
      // don't steal click from the input itself
      if (e.target === valueNode) return;
      focusInput();
    });
    field.addEventListener("click", (e) => {
      // ignore clicks on status corner / owner badge
      const t = e.target;
      if (t === statusCorner || t === ownerBtn) return;
      if (t && t.closest && (t.closest(".act-status-corner") || t.closest(".owner-badge"))) return;
      focusInput();
    });
  }

  field.appendChild(statusCorner);
  field.appendChild(valueWrap);
  field.appendChild(ownerBtn);

  td.appendChild(field);
  tr.appendChild(td);
});
      // Actions (Done / Ta bort)
      tr.appendChild(el("td", {}, [
        makeRowActionMenu({
          onDone: () => {
            const ok = confirm("Markera som DONE och flytta till Archive?");
            if (!ok) return;
            archiveDevEntry(state, entry);
          },
          onDelete: () => {
            const ok = confirm("Ta bort raden? Detta går inte att ångra.");
            if (!ok) return;
            state.devEntries = state.devEntries.filter((x) => x.id !== entry.id);
            saveState(state);
            render(state);
          }
        })
      ]));

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);

    if (state.devEntries.length === 0) {
      view.appendChild(el("div", { style: "padding:18px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;" }, [
        "Inga rader ännu. Klicka på “Ny utveckling”.",
      ]));
    } else {
      view.appendChild(table);
    }
  }

  function newDevEntry() {
    return { id: uid("devE"), name: "", fields: {}, createdAt: Date.now() };
  }


  // User: Ny utveckling – formulär
  function openNewDevEntryForm(state) {
    const nameIn = el("input", { class: "input", placeholder: "Namn" });

    // Typ: ska spegla admin-definierade Settings → Register → dev_type (state.devTypes)
    ensureDevTypes(state);
    const devTypes = getDevTypes(state);

    const typeSel = el("select", { class: "input ptype-select" }, []);

    // Default = inget valt
    const placeholderOpt = el(
      "option",
      { value: "", selected: true, disabled: devTypes.length === 0 },
      [devTypes.length === 0 ? "Inga typer definierade" : "Välj typ..."]
    );
    typeSel.appendChild(placeholderOpt);

    // Lista alla dev_type (namn)
    devTypes.forEach((t) => {
      typeSel.appendChild(el("option", { value: t }, [t]));
    });
const actions = el("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:12px;" });
    const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Save"]);
    const cancelBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Cancel"]);
    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    cancelBtn.addEventListener("click", () => closeModal());
    saveBtn.addEventListener("click", () => {
      const name = (nameIn.value || "").trim();
      const type = typeSel.value;
      if (!name) {
        alert("Namn krävs.");
        return;
      }
      state.devEntries.push({
        id: uid("devE"),
        name,
        type,
        fields: {},
        createdAt: Date.now(),
      });
      saveState(state);
      closeModal();
      render(state);
    });

    const body = el("div", {}, [
      el("div", { class: "label" }, ["Ny utveckling"]),
      el("div", {}, [el("div", { class: "label" }, ["Namn"]), nameIn]),
      el("div", {}, [el("div", { class: "label" }, ["P-typ"]), typeSel]),
      actions,
    ]);

    openModal({ title: "Ny utveckling", sub: "User", bodyNode: body });
  }

  // -------------------------------
  // Produkt table (behåll förenklad)
  // -------------------------------
  function renderPlaceholderModal() {
    return el("div", {}, [
      el("div", { class: "label" }, ["Tasks"]),
      el("div", { style: "padding:12px;border:1px dashed #d1d5db;border-radius:12px;background:#fff;color:#111827;" }, ["To be added"]),
    ]);
  }

  function openProductActiveModal() {
    openModal({ title: "Säljprocess Ny produkt", sub: "Aktiv aktivitet (klickbar)", bodyNode: renderPlaceholderModal() });
  }

  

function renderProductTable(state) {
    const view = document.getElementById("view");
    view.innerHTML = "";

    const user = currentUser();
    ensureDevTypes(state);
    const devTypes = getDevTypes(state);
    const acts = (state.productSchema?.activities || []).slice();
    // Normalize legacy activity types
    state.productSchema.activities.forEach((a) => { if (a && a.type === "kalender") a.type = "date"; });
    // Viktigt: respektera admin-ordningen från "Definiera produkttabell".
    // Om admin sparar en explicit ordning (order/sortOrder/position) använder vi den, annars behåller vi array-ordningen.
    const hasOrder = acts.some((a) => a?.order != null || a?.sortOrder != null || a?.position != null);
    if (hasOrder) {
      const ord = (x) => (x?.order ?? x?.sortOrder ?? x?.position ?? 0);
      acts.sort((a, b) => ord(a) - ord(b));
    }
// Produkt: fasta kolumner först (Namn + Typ/dev_type), därefter admin-definierade aktiviteter
    const cols = [
      { key: "name", label: "Namn", type: "passive" },
      { key: "__type__", label: "P-typ", type: "type" },
      ...acts.map((a) => ({ key: a.id, label: a.name, type: a.type, activity: a })),
    ];
    const rows = state.productRows || [];

    if (!acts.length) {
      view.appendChild(el("div", { style: "padding:12px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;margin-bottom:12px;" }, [
        isAdmin(user)
          ? "Inga säljaktiviteter definierade. Klicka på “Definiera produkttabell” för att lägga till kolumner."
          : "Inga säljaktiviteter definierade ännu. Be admin definiera säljtabellen.",
      ]));
    }

    const table = el("table", { class: "table" });
    const thead = el("thead", {}, [
      el("tr", {}, [
        ...cols.map((c) => el("th", {}, [c.label])),
        el("th", {}, [""]),
      ]),
    ]);
const tbody = el("tbody");

    rows.forEach((row) => {
      row.fields = row.fields || {};
      const tr = el("tr");

      // Namn (fast)
      tr.appendChild(el("td", {}, [
        el("input", {
          class: "input",
          value: row.name ?? "",
          placeholder: "Skriv namn…",
          oninput: (e) => { row.name = e.target.value; saveState(state); },
        }),
      ]));

      // Typ (fast, dev_type)
      tr.appendChild(el("td", {}, [
        el("select", {
          class: "select ptype-select",
          value: row.type ?? "",
          onchange: (e) => { row.type = e.target.value || ""; saveState(state); },
        }, [
          el("option", { value: "" }, ["—"]),
          ...devTypes.map((t) => el("option", { value: t }, [t])),
        ]),
      ]));

      // Aktivitet-kolumner
      acts.forEach((a) => {
        const td = el("td");
        const cell = ensureDevEntryCell(row, a);

  // Normalize
  cell.comments = Array.isArray(cell.comments) ? cell.comments : [];
  if (!("status" in cell)) cell.status = null;
  if (!("ownerInitials" in cell)) cell.ownerInitials = "";

  // Main editor/control for this activity (value)
  let valueNode = null;

  const at = String(a.type || "").toLowerCase().trim();

  if (at === "text") {
    valueNode = el("input", {
      class: "act-value-input",
      value: cell.value ?? "",
      placeholder: "",
      oninput: (e) => { cell.value = e.target.value; saveState(state); },
    });
  } else if (at === "veckokalender" || at === "veckonummer" || at === "weeknumber" || at === "weekcalendar") {
    // Week picker: store ISO week key (YYYY-WNN) and show as "vNN". Default: ---
    const wrap = el("div", { class: "act-date-wrap" });

    const wk = (cell.value || "").toString().trim();
    const mm = /^(\d{4})-W(\d{2})$/.exec(wk);
    const shownTxt = mm ? `v${mm[2]}` : (wk ? wk : "---");

    const shown = el("div", { class: "act-value act-date-display", title: wk }, [shownTxt]);

    // picker value comes from cell.date if present
    const picker = el("input", {
      type: "date",
      value: (cell.date || "").toString(),
      class: "act-date-picker",
    });
    // Ensure clicks go to the visible display/wrap (works even if CSS lacks pointer-events:none)
    picker.style.pointerEvents = "none";

    shown.addEventListener("click", () => {
      if (typeof picker.showPicker === "function") picker.showPicker();
      else { picker.focus(); picker.click(); }
    });

    picker.addEventListener("change", (e) => {
      const v = e.target.value || "";
      cell.date = v;
      if (!v) cell.value = "";
      else cell.value = isoWeekKey(new Date(v + "T00:00:00"));
      saveState(state);
      render(state);
    });

    wrap.appendChild(shown);
    wrap.appendChild(picker);
    valueNode = wrap;
  } else if (at === "date" || at === "kalender") {
    // Date field: click on display to open native picker
    const wrap = el("div", { class: "act-date-wrap" });
    const shown = el("div", { class: "act-value act-date-display", title: cell.value ?? "" }, [cell.value ? cell.value : "-- -- --"]);
    const picker = el("input", {
      type: "date",
      value: cell.value ?? "",
      class: "act-date-picker",
    });
    // Ensure clicks go to the visible display/wrap (works even if CSS lacks pointer-events:none)
    picker.style.pointerEvents = "none";

    shown.addEventListener("click", () => {
      if (typeof picker.showPicker === "function") picker.showPicker();
      else { picker.focus(); picker.click(); }
    });
    picker.addEventListener("change", (e) => {
      cell.value = e.target.value || "";
      saveState(state);
      render(state);
    });
    wrap.appendChild(shown);
    wrap.appendChild(picker);
    valueNode = wrap;
  } else if (at === "status" || at === "steg") {
    // Status-only activity (no tasks UI in process view)
    valueNode = el("div", { class: "act-value act-status-only" }, [""]);
  } else {
    valueNode = el("div", { class: "act-value" }, [cell.value ?? ""]);
  }

  // Build unified activity field (brick)
  const statusClass = cell.status === "green" ? "status-green" : (cell.status === "yellow" ? "status-yellow" : (cell.status === "red" ? "status-red" : ""));
  const field = el("div", { class: `act-field ${statusClass} act-type-${at || "unknown"}` });

  const statusCorner = el("div", {
    class: "act-status-corner",
    title: "Ändra status",
    onclick: () => {
      cell.status = nextActivityStatus(cell.status);
      saveState(state);
      render(state);
    },
  });

  const ownerTxt = ((cell.ownerInitials || "").toUpperCase() || "--").slice(0, 2);
  const ownerBtn = el("span", {
    class: `owner-badge ${cell.comments.length > 0 ? "has-notes" : ""}`,
    title: cell.comments.length ? `Notes (${cell.comments.length})` : "Notes",
    onclick: () => openActivityNotesModal(state, row, a, user),
    oncontextmenu: (e) => {
      e.preventDefault();
      openOwnerPickerModal(state, cell);
    },
  }, [ownerTxt]);

  const valueWrap = el("div", { style: "flex:1;min-width:0;" }, [valueNode]);

  // Make text fields easier to click: focus input when clicking the brick/value area
  if (at === "text" && valueNode && typeof valueNode.focus === "function") {
    field.style.cursor = "text";
    const focusInput = () => { try { valueNode.focus(); } catch(_) {} };
    valueWrap.addEventListener("click", (e) => {
      // don't steal click from the input itself
      if (e.target === valueNode) return;
      focusInput();
    });
    field.addEventListener("click", (e) => {
      // ignore clicks on status corner / owner badge
      const t = e.target;
      if (t === statusCorner || t === ownerBtn) return;
      if (t && t.closest && (t.closest(".act-status-corner") || t.closest(".owner-badge"))) return;
      focusInput();
    });
  }

  field.appendChild(statusCorner);
  field.appendChild(valueWrap);
  field.appendChild(ownerBtn);

  td.appendChild(field);
  tr.appendChild(td);
      });

      // Actions (Done / Ta bort)
      tr.appendChild(el("td", {}, [
        makeRowActionMenu({
          onDone: () => {
            const ok = confirm("Markera som DONE och flytta till Archive?");
            if (!ok) return;
            archiveProductRow(state, row);
          },
          onDelete: () => {
            const ok = confirm("Ta bort raden? Detta går inte att ångra.");
            if (!ok) return;
            state.productRows = (state.productRows || []).filter((x) => x !== row);
            saveState(state);
            render(state);
          }
        })
      ]));

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);

    view.appendChild(table);

    if (!acts.length) {
      view.appendChild(el("div", { style: "margin-top:12px;color:#6b7280;font-size:12px;" }, [
        user?.role === "admin"
          ? "Inga aktiviteter definierade. Som admin: lägg till aktiviteter under Säljprocess Ny produkt (admin-läget)."
          : "Inga aktiviteter definierade ännu. Be admin definiera säljtabellen.",
      ]));
    }
  }




  function defaultRowForProduct(fromName = "", fromType = "") {
    return {
      id: uid("product"),
      name: fromName || "",
      type: fromType || "", // dev_type
      fields: {},
      createdAt: Date.now(),
    };
  }

  // -------------------------------
  // Tasks (v14 features)
  // -------------------------------
  function assigneeOptions() {
    const initials = getUsers()
      .map((u) => (u.initials || "").toString().trim().toUpperCase())
      .filter((x) => x.length > 0);
    const uniq = Array.from(new Set(initials));
    return ["Alla", ...uniq];
  }

  
  function openTodoNotesModal(state, todo, user) {
    if ((todo.category || "") === "Privat") {
      const myInit = (user?.initials || "").toUpperCase();
      if ((todo.assignee || "").toUpperCase() !== myInit) {
        alert("Du kan inte öppna andras privata Tasks.");
        return;
      }
    }

    const textarea = el("textarea", { class: "input todo-notes", placeholder: "Skriv notes…" });
    textarea.value = todo.notes || "";

    textarea.addEventListener("input", () => {
      todo.notes = textarea.value;
      saveState(state);
      render(state);
    });

    const body = el("div", {}, [
      el("div", { class: "label" }, ["Notes"]),
      textarea,
      el("div", { style: "margin-top:10px;font-size:12px;color:#6b7280;" }, ["Stäng när du är klar. Notes sparas direkt."]),
    ]);

    openModal({ title: "Tasks – Notes", sub: todo.title ? todo.title : "", bodyNode: body });
  }

  // -------------------------------
  // Notes (User, manuellt, 1+ mottagare, badge, ingen mail)
  // -------------------------------
  
  // -------------------------------
  // ToDo: Notes (plain text on the task)
  // -------------------------------
  function openTodoNotesTextModal(state, todo, user) {
    const meInit = (user?.initials || "").toUpperCase();
    if ((todo.category || "") === "Privat") {
      if ((todo.assignee || "").toUpperCase() !== meInit) {
        alert("Du kan inte öppna andras privata Tasks.");
        return;
      }
    }

    const wrap = el("div", {}, []);
    const ta = el("textarea", {
      class: "input",
      placeholder: "Skriv Notes...",
      style: "min-height:160px;white-space:pre-wrap;",
    });
    ta.value = (todo.notes || "").toString();

    const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Spara"]);
    saveBtn.addEventListener("click", () => {
      todo.notes = (ta.value || "").toString();
      saveState(state);
      render(state);
      closeModal();
    });

    wrap.appendChild(el("div", { class: "label" }, ["Notes"]));
    wrap.appendChild(ta);
    wrap.appendChild(el("div", { style: "display:flex;justify-content:flex-end;margin-top:12px;" }, [saveBtn]));

    openModal({ title: "Notes", sub: todo.title ? todo.title : "", bodyNode: wrap });
  }

  // Comment-modal (messages/history). Reuse existing implementation.
  function openTodoCommentModal(state, todo, user) {
    const meInit = (user?.initials || "").toUpperCase();

    // Private tasks: only the assignee may view/add messages
    if ((todo.category || "") === "Privat") {
      if ((todo.assignee || "").toUpperCase() !== meInit) {
        alert("Du kan inte öppna andras privata Tasks.");
        return;
      }
    }

    todo.comments = Array.isArray(todo.comments) ? todo.comments : [];

    const wrap = el("div", {}, []);

    const list = el("div", { class: "todo-msg-list", style: "display:flex;flex-direction:column;gap:8px;max-height:260px;overflow:auto;padding:8px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;" });

    const fmt = (iso) => {
      try {
        const d = new Date(iso);
        return d.toLocaleString();
      } catch(e) { return iso || ""; }
    };

    if (todo.comments.length === 0) {
      list.appendChild(el("div", { style: "font-size:12px;color:#6b7280;" }, ["Inga meddelanden ännu."]));
    } else {
      todo.comments.forEach((c) => {
        const header = el("div", { style: "display:flex;justify-content:space-between;gap:10px;font-size:12px;color:#6b7280;" }, [
          el("span", {}, [(c.by || "").toString() || ""]),
          el("span", {}, [fmt(c.date)]),
        ]);
        const bubble = el("div", { style: "padding:10px 12px;border:1px solid #e5e7eb;border-radius:12px;background:#f9fafb;" }, [
          el("div", { style: "white-space:pre-wrap;" }, [(c.message || "").toString()]),
        ]);
        const row = el("div", {}, [header, bubble]);
        list.appendChild(row);
      });
    }

    const ta = el("textarea", { class: "input", placeholder: "Skriv meddelande…", style: "min-height:90px;white-space:pre-wrap;" });
    const send = el("button", { class: "btn btn-primary", type: "button" }, ["Skicka"]);

    send.addEventListener("click", () => {
      const msg = (ta.value || "").trim();
      if (!msg) return;
      todo.comments.push({
        by: meInit,
        to: "",
        message: msg,
        date: new Date().toISOString(),
        seen: false,
      });
      ta.value = "";
      saveState(state);
      render(state);
      closeModal();
    });

    wrap.appendChild(el("div", { class: "label" }, ["Message"]));
    wrap.appendChild(list);
    wrap.appendChild(el("div", { style: "margin-top:10px;" }, [ta]));
    wrap.appendChild(el("div", { style: "display:flex;justify-content:flex-end;margin-top:12px;" }, [send]));

    openModal({ title: "Message", sub: todo.title ? todo.title : "", bodyNode: wrap });
  }


function openTodoNotesModal(state, todo, user) {
    const meInit = (user?.initials || "").toUpperCase();
    todo.comments = Array.isArray(todo.comments) ? todo.comments : [];

    const users = getUsers();
    const initials = users
      .map((u) => (u.initials || "").toUpperCase())
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }));

    const wrap = el("div", {}, []);

    const recipWrap = el("div", { style: "display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;" });
    const selected = new Set();

    initials.forEach((ini) => {
      const id = `c_to_${ini}_${Math.random().toString(16).slice(2)}`;
      const cb = el("input", { type: "checkbox", id });
      const lab = el("label", { for: id, style: "display:flex;align-items:center;gap:6px;cursor:pointer;" }, [
        cb,
        el("span", {}, [ini]),
      ]);
      cb.addEventListener("change", () => {
        if (cb.checked) selected.add(ini);
        else selected.delete(ini);
      });
      recipWrap.appendChild(lab);
    });

    const msg = el("textarea", { class: "input", placeholder: "Meddelande...", style: "min-height:120px;" });

    const saveBtn = el("button", { class: "btn btn-primary", type: "button", title: "Öppnar din e-postklient och förifyller ett mail" }, ["Send"]);
    const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;margin-top:14px;" });

    function renderList() {
      list.innerHTML = "";
      const items = Array.isArray(todo.comments) ? todo.comments.slice().reverse() : [];
      if (!items.length) {
        list.appendChild(el("div", { style: "font-size:13px;color:#6b7280;" }, ["Inga kommentarer ännu."]));
        return;
      }
      items.forEach((c) => {
        const to = Array.isArray(c.to) ? c.to.join(", ") : "";
        const when = c.date ? new Date(c.date).toLocaleString("sv-SE") : "";
        const by = c.by || "";
        const card = el("div", { style: "border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;" });
        card.appendChild(
          el(
            "div",
            { style: "display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px;" },
            [el("div", { style: "font-weight:600;" }, [`${by} → ${to}`]), el("div", { style: "font-size:12px;color:#6b7280;" }, [when])]
          )
        );
        card.appendChild(el("div", { style: "white-space:pre-wrap;" }, [c.message || ""]));
        list.appendChild(card);
      });
    }

    saveBtn.addEventListener("click", () => {
      const to = Array.from(selected);
      const message = (msg.value || "").trim();
      if (!to.length) return alert("Välj minst en mottagare (initial).");
      if (!message) return alert("Skriv ett meddelande.");

      todo.comments = Array.isArray(todo.comments) ? todo.comments : [];
      todo.comments.push({
        by: meInit,
        to,
        message,
        date: new Date().toISOString(),
        seen: false,
      });


      // Skicka mail (samma mottagare som kommentaren)
      const subj = `ToDo: ${todo.title || "Task"} (Kommentar)`;
      const mailBody = [
        `Från: ${meInit}`,
        `Till: ${to.join(", ")}`,
        "",
        message,
      ].join("\n");
sendMail({ toInitials: to, subject: subj, body: mailBody });


      msg.value = "";
      selected.clear();
      recipWrap.querySelectorAll("input[type=checkbox]").forEach((c) => (c.checked = false));
      saveState(state);
      render(state); // uppdaterar badge i listan
      renderList();
    });

    renderList();

    wrap.appendChild(el("div", { class: "label" }, ["Mottagare (initialer)"]));
    wrap.appendChild(recipWrap);
    wrap.appendChild(el("div", { class: "label" }, ["Meddelande"]));
    wrap.appendChild(msg);
    wrap.appendChild(el("div", { style: "display:flex;justify-content:flex-end;margin-top:12px;" }, [saveBtn]));
    wrap.appendChild(el("hr", { style: "margin:14px 0;border:none;border-top:1px solid #e5e7eb;" }));
    wrap.appendChild(el("div", { class: "label" }, ["Historik"]));
    wrap.appendChild(list);

    openModal({ title: "Notes", sub: todo.title ? todo.title : "", bodyNode: wrap });
  }
// -------------------------------
// Notes (Activity-cell: Utvecklingsprocess + Produkt)
// -------------------------------
function openActivityNotesModalLegacy(state, entryOrRow, activity, user) {
  const meInit = (user?.initials || "").toUpperCase();
  const cell = ensureDevEntryCell(entryOrRow, activity);
  cell.comments = Array.isArray(cell.comments) ? cell.comments : [];

  const users = getUsers();
  const initials = users
    .map((u) => (u.initials || "").toUpperCase())
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }));

  const wrap = el("div", {}, []);

  const recipWrap = el("div", { style: "display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;" });
  const selected = new Set();

  initials.forEach((ini) => {
    const id = `c_to_${ini}_${Math.random().toString(16).slice(2)}`;
    const cb = el("input", { type: "checkbox", id });
    const lab = el("label", { for: id, style: "display:flex;align-items:center;gap:6px;cursor:pointer;" }, [
      cb,
      el("span", {}, [ini]),
    ]);
    cb.addEventListener("change", () => {
      if (cb.checked) selected.add(ini);
      else selected.delete(ini);
    });
    recipWrap.appendChild(lab);
  });

  const msg = el("textarea", { class: "input", placeholder: "Meddelande...", style: "min-height:120px;" });

  const saveBtn = el("button", { class: "btn btn-primary", type: "button", title: "Öppnar din e-postklient och förifyller ett mail" }, ["Send"]);
  const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;margin-top:14px;" });

  function renderList() {
    list.innerHTML = "";
    const items = Array.isArray(cell.comments) ? cell.comments.slice().reverse() : [];
    if (!items.length) {
      list.appendChild(el("div", { style: "font-size:13px;color:#6b7280;" }, ["Inga kommentarer ännu."]));
      return;
    }
    items.forEach((c) => {
      const to = Array.isArray(c.to) ? c.to.join(", ") : "";
      const when = c.date ? new Date(c.date).toLocaleString("sv-SE") : "";
      const by = c.by || "";
      const card = el("div", { style: "border:1px solid #e5e7eb;border-radius:12px;padding:10px;background:#fff;" });
      card.appendChild(
        el(
          "div",
          { style: "display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:6px;" },
          [el("div", { style: "font-weight:600;" }, [`${by} → ${to}`]), el("div", { style: "font-size:12px;color:#6b7280;" }, [when])]
        )
      );
      card.appendChild(el("div", { style: "white-space:pre-wrap;" }, [c.message || ""]));
      list.appendChild(card);
    });
  }

  saveBtn.addEventListener("click", () => {
    const to = Array.from(selected);
    const message = (msg.value || "").trim();
    if (!to.length) return alert("Välj minst en mottagare (initial).");
    if (!message) return alert("Skriv ett meddelande.");

    cell.comments = Array.isArray(cell.comments) ? cell.comments : [];
    cell.comments.push({
      by: meInit,
      to,
      message,
      date: new Date().toISOString(),
      seen: false,
    });


    // Skicka mail (samma mottagare som kommentaren)
    const ctxName = entryOrRow?.name || entryOrRow?.title || "";
    const actName = activity?.name || "";
    const subj = `${actName}: ${ctxName || "Rad"} (Kommentar)`;
    const mailBody = [
      `Från: ${meInit}`,
      `Till: ${to.join(", ")}`,
      ctxName ? `Rad: ${ctxName}` : null,
      actName ? `Aktivitet: ${actName}` : null,
      "",
      message,
    ].filter(Boolean).join("\n");
    sendMail({ toInitials: to, subject: subj, body: mailBody });


    msg.value = "";
    selected.clear();
    recipWrap.querySelectorAll("input[type=checkbox]").forEach((c) => (c.checked = false));
    saveState(state);
    render(state); // uppdaterar badge i tabellen
    renderList();
  });

  renderList();

  const entryName = (entryOrRow?.name || entryOrRow?.title || "").toString();
  const actName = (activity?.name || "").toString();

  wrap.appendChild(el("div", { class: "label" }, ["Mottagare (initialer)"]));
  wrap.appendChild(recipWrap);
  wrap.appendChild(el("div", { class: "label" }, ["Meddelande"]));
  wrap.appendChild(msg);
  wrap.appendChild(el("div", { style: "display:flex;justify-content:flex-end;margin-top:12px;" }, [saveBtn]));
  wrap.appendChild(el("hr", { style: "margin:14px 0;border:none;border-top:1px solid #e5e7eb;" }));
  wrap.appendChild(el("div", { class: "label" }, ["Historik"]));
  wrap.appendChild(list);

  openModal({ title: "Notes", sub: `${entryName}${entryName && actName ? " – " : ""}${actName}`, bodyNode: wrap });
}

function defaultTodo(state, category = "Allmänt", currentUserInitials = "Alla") {
    const cat = getTodoCategories(state).includes(category) ? category : "Allmänt";
    const assignee = cat === "Privat" ? currentUserInitials : "Alla";
    return {
      id: uid("todo"),
      category: cat,
      title: "",
      assignee,
      dueDate: "",
      notes: "",
      comments: [],
      done: false,
      week: isoWeekNumber(new Date()),
      createdAt: Date.now(),
    };
  }

  function openNewTodoForm(state, user) {
    const myInit = (user?.initials || "").toUpperCase() || "DE";
    const initialCategory = (state.todo.filter === "Alla") ? "Allmänt" : state.todo.filter;
    const todoDraft = defaultTodo(state, initialCategory, myInit);

    const catSel = el("select", { class: "input" }, getTodoCategories(state).map((c) => el("option", { value: c }, [c])));
    catSel.value = todoDraft.category;

    const titleIn = el("input", { class: "input", placeholder: "Titel", value: "" });

    const assignees = assigneeOptions();
    const assSel = el("select", { class: "input" }, assignees.map((a) => el("option", { value: a }, [a])));
    assSel.value = todoDraft.assignee;
    assSel.disabled = todoDraft.category === "Privat";

    const due = el("input", { class: "input", type: "date", value: "" });
    const notes = el("textarea", { class: "input todo-notes", placeholder: "Notes…" });

    function applyPrivacyRules() {
      todoDraft.category = catSel.value;
      if (todoDraft.category === "Privat") {
        todoDraft.assignee = myInit;
        assSel.value = myInit;
        assSel.disabled = true;
      } else {
        assSel.disabled = false;
        todoDraft.assignee = assSel.value || "Alla";
      }
    }

    catSel.addEventListener("change", () => applyPrivacyRules());
    assSel.addEventListener("change", () => { todoDraft.assignee = assSel.value; });

    const grid = el("div", { style: "display:grid;grid-template-columns:1fr 1fr;gap:10px;" }, [
      el("div", {}, [el("div", { class: "label" }, ["Kategori"]), catSel]),
      el("div", {}, [el("div", { class: "label" }, ["Ansvarig"]), assSel]),
      el("div", { style: "grid-column:1 / -1;" }, [el("div", { class: "label" }, ["Titel"]), titleIn]),
      el("div", {}, [el("div", { class: "label" }, ["Färdig"]), due]),
      el("div", { style: "grid-column:1 / -1;" }, [el("div", { class: "label" }, ["Notes"]), notes]),
    ]);

    const actions = el("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:12px;flex-wrap:wrap;" });
    const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Save"]);
    const cancelBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Cancel"]);

    saveBtn.addEventListener("click", () => {
      applyPrivacyRules();
      todoDraft.title = (titleIn.value || "").trim();
      todoDraft.dueDate = due.value || "";
      todoDraft.notes = notes.value || "";
      todoDraft.week = isoWeekNumber(new Date());
      todoDraft.createdAt = Date.now();

      if (!todoDraft.title) { alert("Titel krävs."); return; }

      state.todo.items.unshift(todoDraft);
      saveState(state);
      closeModal();
      render(state);
    });

    cancelBtn.addEventListener("click", () => { closeModal(); render(state); });

    actions.appendChild(cancelBtn);
    actions.appendChild(saveBtn);

    applyPrivacyRules();

    const body = el("div", {}, [
      el("div", { class: "label" }, ["Ny task"]),
      grid,
      actions,
    ]);

    openModal({ title: "Ny task", sub: "Skapa en ny post", bodyNode: body });
  }

  function renderTodoTable(state, user) {
    const view = document.getElementById("view");
    view.innerHTML = "";

    ensureWeeklyRollover(state);

    const myInit = (user?.initials || "").toUpperCase();
    const itemsAll = state.todo.items || [];

    const filtered = itemsAll.filter((t) => {
      const cat = (t.category || "Allmänt");
      if (cat === "Privat") {
        // Privat visas endast när filter=Privat (och bara för den inloggade användaren)
        if (state.todo.filter !== "Privat") return false;
        return (t.assignee || "").toUpperCase() === myInit;
      }

      if (state.todo.filter === "Alla") return true;
      return cat === state.todo.filter;
    });

    const table = el("table", { class: "table todo-table" });
    const thead = el("thead", {}, [el("tr", {}, COLS_TODO_UI.map((c) => el("th", {}, [c.label])))]);
    const tbody = el("tbody");

    const assignees = assigneeOptions();

    filtered.forEach((t) => {
      const tr = el("tr", { class: `${t.done ? "todo-done" : ""} ${(t.category === "Privat") ? "todo-private" : ""}`.trim() });

      // checkbox
      const cb = el("input", {
        type: "checkbox",
        onchange: (e) => { t.done = !!e.target.checked; saveState(state); render(state); },
      });
      cb.checked = !!t.done;
      tr.appendChild(el("td", {}, [cb]));

      // category
      const catSel = el("select", {
        class: "input",
        onchange: (e) => {
          t.category = e.target.value;
          if (t.category === "Privat") t.assignee = myInit || "Alla";
          saveState(state);
          render(state);
        },
      }, getTodoCategories(state).map((c) => {
        const opt = el("option", { value: c }, [c]);
        if ((t.category || "Allmänt") === c) opt.selected = true;
        return opt;
      }));
      tr.appendChild(el("td", {}, [catSel]));

      // title
      tr.appendChild(el("td", {}, [
        el("input", {
          class: "input",
          value: t.title || "",
          placeholder: "Tasks…",
          oninput: (e) => { t.title = e.target.value; saveState(state); },
        }),
      ]));

      // assignee (allow multiple for non-Privat) - custom picker that shows initials
      const parseAssignees = (val) => {
        const s = (val || "").toString().trim();
        if (!s || s === "Alla") return ["Alla"];
        return s.split(",").map(x => x.trim()).filter(Boolean);
      };
      const fmtSelected = (arr) => (arr.includes("Alla") ? "Alla" : arr.join(", "));

      const selected = parseAssignees(t.assignee);

      const cellWrap = el("div", { style: "position:relative;display:inline-block;min-width:110px;" }, []);
      const btn = el("button", {
        type: "button",
        class: "input",
        style: "width:100%;text-align:left;display:flex;align-items:center;justify-content:space-between;gap:8px;cursor:pointer;",
        title: "Välj ansvarig(a)",
      }, [
        el("span", {}, [fmtSelected(selected)]),
        el("span", { style: "color:#6b7280;font-size:12px;" }, ["▾"])
      ]);

      const menu = el("div", {
        style: "position:absolute;z-index:50;top:calc(100% + 6px);left:0;background:#fff;border:1px solid #e5e7eb;border-radius:12px;box-shadow:0 10px 25px rgba(0,0,0,.08);padding:10px;min-width:180px;display:none;",
      }, []);

      const closeMenu = () => (menu.style.display = "none");
      const openMenu = () => (menu.style.display = "block");
      const toggleMenu = () => (menu.style.display === "none" ? openMenu() : closeMenu());

      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (btn.disabled) return;
        toggleMenu();
      });

      const setSelected = (arr) => {
        // Alla is exclusive
        let next = arr.length ? arr : ["Alla"];
        if (next.includes("Alla") && next.length > 1) next = ["Alla"];
        t.assignee = next.includes("Alla") ? "Alla" : next.join(", ");
        saveState(state);
        render(state);
      };

      const mkItem = (value) => {
        const row = el("label", { style: "display:flex;align-items:center;gap:10px;padding:6px 6px;border-radius:10px;cursor:pointer;" }, []);
        row.addEventListener("mouseenter", () => (row.style.background = "#f9fafb"));
        row.addEventListener("mouseleave", () => (row.style.background = "transparent"));

        const cb = el("input", { type: "checkbox" });
        cb.checked = selected.includes(value);

        cb.addEventListener("change", () => {
          let cur = parseAssignees(t.assignee);
          // toggle
          if (cb.checked) {
            if (!cur.includes(value)) cur.push(value);
          } else {
            cur = cur.filter(x => x !== value);
          }
          // exclusivity for Alla
          if (value === "Alla" && cb.checked) {
            cur = ["Alla"];
          } else if (value !== "Alla") {
            cur = cur.filter(x => x !== "Alla");
          }
          setSelected(cur);
        });

        row.appendChild(cb);
        row.appendChild(el("span", {}, [value]));
        return row;
      };

      // Build menu items (Alla first)
      const items = ["Alla", ...assignees.filter(a => a !== "Alla")];
      items.forEach(v => menu.appendChild(mkItem(v)));

      // Click outside closes
      document.addEventListener("click", () => closeMenu(), { once: true });

      cellWrap.appendChild(btn);
      cellWrap.appendChild(menu);

      if (t.category === "Privat") {
        btn.disabled = true;
        btn.style.opacity = "0.7";
        btn.style.cursor = "not-allowed";
        btn.firstChild.textContent = (myInit || "Alla");
        // Also persist the lock for safety
        t.assignee = (myInit || "Alla");
      }

      tr.appendChild(el("td", {}, [cellWrap]));

      // due date (red if overdue)
      const todayIso = new Date().toISOString().slice(0, 10);
      const isOverdue = !!(t.dueDate && t.dueDate < todayIso && !t.done);
      tr.appendChild(el("td", {}, [
        el("input", {
          class: `input ${isOverdue ? "is-overdue" : ""}`,
          type: "date",
          value: t.dueDate || "",
          onchange: (e) => { t.dueDate = e.target.value; saveState(state); render(state); },
        }),
      ]));

      // Notes (text) – green + badge if has content
      const hasNotes = !!(t.notes && t.notes.trim().length);
      const notesBtn = el("button", {
        type: "button",
        class: `pill pill-notes ${hasNotes ? "is-notes" : ""}`,
        title: "Notes",
        onclick: () => openTodoNotesTextModal(state, t, user),
      }, ["Notes"]);
      const notesWrap = el("span", { class: "pill-badge-wrap" }, [notesBtn]);
      if (hasNotes) notesWrap.appendChild(el("span", { class: "badge" }, ["1"]));
      tr.appendChild(el("td", {}, [notesWrap]));


      // trash
      const trashBtn = el("button", {
        type: "button",
        class: "icon-btn up-trash",
        title: "Ta bort",
        onclick: () => {
          if ((t.category || "") === "Privat" && (t.assignee || "").toUpperCase() !== myInit) {
            alert("Du kan inte ta bort andras privata Tasks.");
            return;
          }
          const ok = confirm("Ta bort Tasks? Detta går inte att ångra.");
          if (!ok) return;
          state.todo.items = state.todo.items.filter((x) => x.id !== t.id);
          saveState(state);
          render(state);
        },
      }, ["🗑️"]);
      tr.appendChild(el("td", {}, [trashBtn]));

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);

    if (filtered.length === 0) {
      const emptyMsg =
        state.todo.filter === "Privat"
          ? "Inga privata Tasks ännu. Klicka på “Ny task” och välj Privat."
          : "Inga Tasks i detta filter ännu. Klicka på “Ny task”.";
      view.appendChild(el("div", { style: "padding:18px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;" }, [emptyMsg]));
    } else {
      view.appendChild(table);
    }
  }


  // -------------------------------
  // Archive helpers (Dev/Product/ToDo)
  // -------------------------------
  function ensureArchives(state) {
    state.archive = state.archive || { dev: [], product: [] };
    state.archive.dev = Array.isArray(state.archive.dev) ? state.archive.dev : [];
    state.archive.product = Array.isArray(state.archive.product) ? state.archive.product : [];
  }

  function addProductRowFromDev(state, devEntry) {
    // Skapar en produkt-rad med endast Namn + Typ från en Utvecklingsprocess-rad
    state.productRows = Array.isArray(state.productRows) ? state.productRows : [];
    const row = { id: uid("prod"), fields: {}, createdAt: Date.now() };

    const acts = (state.productSchema?.activities || []).slice();
    // Normalize legacy activity types
    state.productSchema.activities.forEach((a) => { if (a && a.type === "kalender") a.type = "date"; });

    const norm = (s) => String(s || "").trim().toLowerCase();
    const byName = (wanted) => acts.find((a) => norm(a.name) === norm(wanted));

    const nameAct = byName("Namn") || byName("Name");
    const typeAct = byName("P-typ") || byName("Typ") || byName("Type");

    const devName = devEntry?.name ?? devEntry?.title ?? "";
    const devType = devEntry?.type ?? devEntry?.devType ?? devEntry?.category ?? "";

    if (nameAct) {
      row.fields[nameAct.id] = { value: devName };
    } else {
      // fallback if schema saknar Namn-kolumn (bör inte hända)
      row.name = devName;
    }

    if (typeAct) {
      row.fields[typeAct.id] = { value: devType };
    } else {
      row.type = devType;
    }

    state.productRows.push(row);
  }

  function archiveDevEntry(state, entry) {
    ensureArchives(state);

    // 1) Lägg i dev-archive
    const copy = JSON.parse(JSON.stringify(entry));
    copy.archivedAt = Date.now();
    state.archive.dev.push(copy);

    // 2) Skapa en rad i Produkt med endast Namn + Typ
    addProductRowFromDev(state, entry);

    // 3) Ta bort från aktiv lista
    state.devEntries = (state.devEntries || []).filter((x) => x.id !== entry.id);

    saveState(state);
    render(state);
  }

  function archiveProductRow(state, row) {
    ensureArchives(state);
    const copy = JSON.parse(JSON.stringify(row));
    copy.archivedAt = Date.now();
    state.archive.product.push(copy);
    state.productRows = (state.productRows || []).filter((x) => x.id !== row.id);
    saveState(state);
    render(state);
  }


  function emailsFromInitials(initials) {
    const users = getUsers();
    const map = new Map(
      (users || []).map((u) => [(u.initials || "").toUpperCase(), (u.email || "").trim()])
    );
    return (initials || [])
      .map((ini) => map.get(String(ini || "").toUpperCase()) || "")
      .filter((e) => !!e);
  }

  function sendMail({ toInitials = [], subject = "", body = "" }) {
    const emails = emailsFromInitials(toInitials);
    if (!emails.length) {
      alert("Hittade ingen e-postadress för valda mottagare. Kontrollera att användare har e-post sparad.");
      return;
    }
    const to = emails.join(";");
    const qs = `subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    // Öppnar användarens mail-klient
    window.location.href = `mailto:${to}?${qs}`;
  }

  function fmtDateTime(ts) {
    if (!ts) return "";
    const d = new Date(ts);
    const pad = (n) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  }

  function openDevArchiveModal(state) {
    ensureArchives(state);
    const archived = (state.archive.dev || []).slice().reverse();
    const body = archived.length === 0
      ? el("div", { style: "color:#6b7280;" }, ["Inga arkiverade rader ännu."])
      : el("div", { style: "display:flex;flex-direction:column;gap:10px;" },
          archived.map((e) => el("div", { class: "archive-card" }, [
            el("div", { style: "font-weight:900;" }, [e.name || "(namn saknas)"]),
            el("div", { style: "font-size:12px;opacity:.75;" }, [`Arkiverad: ${fmtDateTime(e.archivedAt)}`]),
          ]))
        );
    openModal({ title: "Archive", sub: "Utvecklingsprocess", bodyNode: body });
  }

  function openProductArchiveModal(state) {
    ensureArchives(state);
    const archived = (state.archive.product || []).slice().reverse();
    const body = archived.length === 0
      ? el("div", { style: "color:#6b7280;" }, ["Inga arkiverade rader ännu."])
      : el("div", { style: "display:flex;flex-direction:column;gap:10px;" },
          archived.map((r) => el("div", { class: "archive-card" }, [
            el("div", { style: "font-weight:900;" }, [r.name || "(namn saknas)"]),
            el("div", { style: "font-size:12px;opacity:.75;" }, [`Arkiverad: ${fmtDateTime(r.archivedAt)}`]),
          ]))
        );
    openModal({ title: "Archive", sub: "Säljprocess Ny produkt", bodyNode: body });
  }

  function openTodoArchiveModal(state, user) {
    ensureWeeklyRollover(state);

    const myInit = (user?.initials || "").toUpperCase();
    const canSee = (t) => {
      if ((t.category || "") === "Privat") return (t.assignee || "").toUpperCase() === myInit;
      return true;
    };

    const archived = (state.todo?.archive || []).filter(canSee).slice().reverse();

    const rowCard = (t) => {
      const title = t.title || "(titel saknas)";
      const meta = [
        `Kategori: ${t.category || "Allmänt"}`,
        `Ansvarig: ${t.assignee || "Alla"}`,
        t.dueDate ? `Färdig: ${t.dueDate}` : null,
        `Vecka: ${t.week || "-"}`,
        t.archivedAt ? `Arkiverad: ${fmtDateTime(t.archivedAt)}` : null,
      ].filter(Boolean).join(" • ");

      return el("div", { class: "archive-card" }, [
        el("div", { style: "font-weight:900;" }, [title]),
        el("div", { style: "font-size:12px;opacity:.75;" }, [meta]),
      ]);
    };

    const body = archived.length === 0
      ? el("div", { style: "color:#6b7280;" }, ["Inga arkiverade Tasks ännu."])
      : el("div", { style: "display:flex;flex-direction:column;gap:10px;" }, archived.map(rowCard));

    openModal({ title: "Archive", sub: "ToDo", bodyNode: body });
  }

  // -------------------------------
  // Tabs + Hero
  // -------------------------------
  function renderTabs(state) {
    ensureValidActiveTab(state);

    const tabsEl = document.getElementById("tabs");
    tabsEl.innerHTML = "";

    const mkTab = (key, label) =>
      el("button", {
        class: `tab ${state.activeTab === key ? "is-active" : ""}`,
        type: "button",
        onclick: () => { state.activeTab = key; saveState(state); render(state); },
      }, [label]);

    TAB_CONFIG.forEach(t => tabsEl.appendChild(mkTab(t.key, t.label)));
  }

  function renderHero(state, user) {
    ensureValidActiveTab(state);

    const heroTitle = document.getElementById("heroTitle");
    const heroInline = document.getElementById("heroInline");
    const heroActions = document.getElementById("heroActions");
    heroInline.innerHTML = "";
    heroActions.innerHTML = "";

    switch (state.activeTab) {
      case Tabs.DEV: {
      heroTitle.textContent = "Utvecklingsprocess";

      // Admin: inga knappar här (admin hanterar struktur i admin-vyn)
      if (user?.role === "admin") return;

      // User: skapa rader i utvecklingstabellen
      heroActions.appendChild(el("button", {
        class: "btn btn-primary",
        type: "button",
        onclick: () => openNewDevEntryForm(state),
      }, ["Ny utveckling"]));


      heroActions.appendChild(el("button", {
        class: "btn",
        type: "button",
        onclick: () => openDevArchiveModal(state),
      }, ["Archive"]));

      return;
      }

      case Tabs.PRODUCT: {
      heroTitle.textContent = "Säljprocess Ny produkt";

      // User: skapa rader i produkttabellen
      if (user?.role !== "admin") {
        heroActions.appendChild(el("button", {
          class: "btn btn-primary",
          type: "button",
          onclick: () => {
            const actsNow = (state.productSchema?.activities || []).filter(Boolean);
            state.productRows = state.productRows || [];
            state.productRows.push(defaultRowForProduct("")); 
            saveState(state);
            render(state);
          },
        }, ["Ny produkt"]));
      

      heroActions.appendChild(el("button", {
        class: "btn",
        type: "button",
        onclick: () => openProductArchiveModal(state),
      }, ["Archive"]));
}

      return;
      }

      case Tabs.ROUTINES: {
        heroTitle.textContent = "Rutiner";

        if (isAdmin(user)) {
          heroActions.appendChild(el("button", {
            class: "btn btn-primary",
            type: "button",
            onclick: () => openNewRoutineModal(state),
          }, ["Ny rutin"]));
        }
        return;
      }

      case Tabs.TODO: {
// Tasks
    heroTitle.textContent = "ToDo";

    const todoFilterSelect = el("select", {
      class: "input up-select",
      onchange: (e) => { state.todo.filter = e.target.value; saveState(state); render(state); },
    }, getTodoFilters(state).map((f) => {
      const opt = el("option", { value: f }, [f]);
      if (state.todo.filter === f) opt.selected = true;
      return opt;
    }));
    heroInline.appendChild(todoFilterSelect);

    // Vecka (ISO) - endast visning (auto uppdateras vid ny vecka)
    ensureWeeklyRollover(state);
    const wkKey = isoWeekKey(new Date()); // ex: 2026-W06
    state.todo.selectedWeek = wkKey;

    const parts = String(wkKey).split("-W");
    const wkYear = parts[0] || "";
    const wkNo = parts[1] || "";

    const weekBox = el("div", { class: "input up-select week-display", style: "max-width:180px;" }, [
      `Vecka ${wkNo}  ${wkYear}`
    ]);

    const range = weekRangeFromKey(wkKey);
    const weekHint = el("div", { style: "font-size:12px;color:#6b7280;min-width:190px;align-self:center;" }, [
      range ? `${fmtDateSv(range.start)} – ${fmtDateSv(range.end)}` : ""
    ]);

    heroInline.appendChild(weekBox);
    heroInline.appendChild(weekHint);


    heroActions.appendChild(el("button", {
      class: "btn btn-primary",
      type: "button",
      onclick: () => openNewTodoForm(state, user),
    }, ["Ny task"]));

      heroActions.appendChild(el("button", {
        class: "btn",
        type: "button",
        onclick: () => openTodoArchiveModal(state, user),
      }, ["Archive"]));

        return;
      }

      default: {
        // Unknown tab: don't silently fall back.
        heroTitle.textContent = "Okänd vy";
        heroInline.appendChild(el("div", { style: "color:#b91c1c;font-size:13px;" }, [
          "Okänd flik: ", String(state.activeTab || "(tom)"),
        ]));
        return;
      }
    }
  }

  function render(state) {
    const user = currentUser();
    ensureValidActiveTab(state);

    renderTabs(state);
    renderHero(state, user);

    switch (state.activeTab) {
      case Tabs.DEV:
        if (isAdmin(user)) renderDevAdminView(state);
        else renderDevTable(state);
        return;

      case Tabs.PRODUCT:
        if (isAdmin(user)) renderProductAdminView(state);
        else renderProductTable(state);
        return;

      case Tabs.TODO:
        renderTodoTable(state, user);
        return;

      case Tabs.ROUTINES:
        renderRoutinesTab(state, user);
        return;

      default: {
        // This should never happen unless state is corrupted or TAB_CONFIG and render() are out of sync.
        const view = document.getElementById("view");
        view.innerHTML = "";
        view.appendChild(el("div", { class: "card", style: "padding:12px;border:1px solid rgba(185,28,28,.35);" }, [
          el("div", { style: "font-weight:900;color:#b91c1c;margin-bottom:6px;" }, ["Okänd flik"]),
          el("div", { style: "font-size:13px;color:rgba(17,24,39,.75);" }, [
            "activeTab=", String(state.activeTab || "(tom)"),
          ]),
        ]));
        console.warn("Unknown activeTab:", state.activeTab);
        return;
      }
    }
  }



  // -------------------------------
  // CSS additions

  // -------------------------------
  // CSS additions (overlay on existing style.css)
  // -------------------------------
  function injectExtraCss() {
    const css = `
      .up-progress{ display:flex; gap:6px; align-items:center; }
      .up-step{ width:18px; height:10px; border-radius:999px; background: rgba(17,24,39,.12); border: 1px solid rgba(17,24,39,.12); }
      .up-step.is-done{ background: rgba(34,197,94,.55); border-color: rgba(34,197,94,.65); }
      .up-active-cell{ text-align:left; }
      .up-select{ min-width: 140px; }
      .hero-left{ display:flex; align-items:center; gap: 12px; flex-wrap: wrap; }
      .hero-actions{ gap: 10px; flex-wrap: wrap; align-items: center; justify-content: flex-end; }
      .up-trash{ width: 40px; height: 40px; display:inline-flex; align-items:center; justify-content:center; }
      .modal-body .label{ margin-bottom: 8px; }

      .settings-wrap{ position: relative; }
      .settings-menu{
        position: absolute;
        right: 0;
        top: 44px;
        min-width: 180px;
        background: #fff;
        border: 1px solid rgba(17,24,39,.12);
        border-radius: 12px;
        box-shadow: 0 10px 22px rgba(17,24,39,.12);
        padding: 8px;
        display: none;
        z-index: 30;
      }
      .settings-menu.is-open{ display: block; }
      .settings-item{
        width: 100%;
        text-align: left;
        border: 0;
        background: transparent;
        padding: 10px 10px;
        border-radius: 10px;
        cursor: pointer;
        font-weight: 800;
      }
      .settings-item:hover{ background: rgba(17,24,39,.06); }

      .login-wrap{ max-width: 420px; margin: 60px auto; padding: 18px; }
      .login-card{ background: #fff; border: 1px solid rgba(17,24,39,.12); border-radius: 16px; padding: 16px; margin-bottom: 12px; }
      .login-title{ font-size: 22px; font-weight: 1000; }
      .login-sub{ margin-top: 6px; color: rgba(17,24,39,.7); }
      .login-form{ background: #fff; border: 1px solid rgba(17,24,39,.12); border-radius: 16px; padding: 16px; display: flex; flex-direction: column; gap: 10px; }
      .login-msg{ min-height: 18px; font-size: 12px; color: rgba(17,24,39,.7); }
      .login-msg.is-error{ color: #b91c1c; font-weight: 800; }
      .login-hint{ margin-top: 10px; font-size: 12px; color: rgba(17,24,39,.65); }

      .todo-table td:first-child, .todo-table th:first-child{ width: 56px; }
      .todo-done{ background: rgba(34,197,94,.10); }
      .todo-done td{ border-top-color: rgba(34,197,94,.25); }

      .todo-private{ background: rgba(17,24,39,.06); }
      .todo-private.todo-done{ background: rgba(17,24,39,.06); }

      .link-btn{
        border: 0;
        background: transparent;
        padding: 0;
        margin: 0;
        cursor: pointer;
        font-weight: 1000;
        text-decoration: underline;
        text-underline-offset: 2px;
      }

      .todo-notes{ min-height: 120px; width: 100%; resize: vertical; }
      .pill-notes{ min-width: 78px; justify-content:center; }
      .pill-notes.is-notes{
        background: rgba(34,197,94,.14);
        border-color: rgba(34,197,94,.35);
        color: rgba(17,24,39,1);
        font-weight: 1000;
      }
      .note-btn.is-notes{
        background: rgba(34,197,94,.14);
        border-color: rgba(34,197,94,.35);
      }

      
.icon-badge-wrap{ position:relative; display:inline-flex; }
.icon-badge-wrap .badge{ position:absolute; top:-6px; right:-6px; }
.badge{
  display:inline-flex;
  align-items:center;
  justify-content:center;
  min-width:18px;
  height:18px;
  padding:0 6px;
  border-radius:999px;
  font-size:12px;
  font-weight:600;
  background:#111827;
  color:#fff;
  line-height:1;
}

.is-overdue{
        border-color: rgba(239,68,68,.65) !important;
        box-shadow: 0 0 0 3px rgba(239,68,68,.12);
      }
    `;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

  // -------------------------------
  // Init
  // -------------------------------
  function init() {
    seedUsersIfMissing();

    const app = document.getElementById("app");
    if (!app) {
      console.error("Missing #app root. Add <div id='app'></div> in body.");
      return;
    }

    injectExtraCss();

    const user = currentUser();
    if (!user) {
      mountLogin(app);
      return;
    }

    mountBase(app, user);
    wireModalClose();
    wireSettingsMenu(user);

    const state = migrateBestEffort();
    if (state.todo.lastWeek == null) state.todo.lastWeek = isoWeekNumber(new Date());
    saveState(state);

    ensureWeeklyRollover(state);
    setInterval(() => ensureWeeklyRollover(state), 60 * 1000);

    render(state);
  }


  /* =========================
     TOPBAR: RUTINER
     ========================= */

  const ROUTINES_KEY = "routines";

  function loadRoutines() {
    try { return JSON.parse(localStorage.getItem(ROUTINES_KEY) || "[]"); }
    catch { return []; }
  }

  function saveRoutines(routines) {
    localStorage.setItem(ROUTINES_KEY, JSON.stringify(routines || []));
  }

  function ensureRoutinesSelected(state, routines) {
    state.routines = state.routines || {};
    const sel = state.routines.selectedId;
    if (sel && routines.some(r => r.id === sel)) return sel;
    if (routines[0]) {
      state.routines.selectedId = routines[0].id;
      saveState(state);
      return routines[0].id;
    }
    state.routines.selectedId = null;
    saveState(state);
    return null;
  }

  function renderRoutinesHero(state, user) {
    const heroInline = document.getElementById("heroInline");
    const heroActions = document.getElementById("heroActions");
    heroInline.innerHTML = "";
    heroActions.innerHTML = "";

    const routines = loadRoutines();
    const selectedId = ensureRoutinesSelected(state, routines);

    // Dropdown
    const select = el("select", {
      class: "input up-select",
      onchange: (e) => {
        state.routines = state.routines || {};
        state.routines.selectedId = e.target.value || null;
        saveState(state);
        render(state);
      }
    }, []);

    if (!routines.length) {
      select.appendChild(el("option", { value: "" }, ["(Inga rutiner)"]));
      select.disabled = true;
    } else {
      routines.forEach(r => {
        const opt = el("option", { value: r.id }, [r.namn || "(Namnlös)"]);
        if (r.id === selectedId) opt.selected = true;
        select.appendChild(opt);
      });
    }

    heroInline.appendChild(select);

    // Admin actions
    if (user?.role === "admin") {
      heroActions.appendChild(el("button", {
        class: "btn btn-primary",
        type: "button",
        onclick: () => openNewRoutineModal(state),
      }, ["Ny rutin"]));

      heroActions.appendChild(el("button", {
        class: "btn",
        type: "button",
        onclick: () => {
          const routines2 = loadRoutines();
          const sid = state?.routines?.selectedId;
          if (!sid) return;
          const r = routines2.find(x => x.id === sid);
          const name = r?.namn || "vald rutin";
          if (!confirm(`Ta bort "${name}"?`)) return;
          saveRoutines(routines2.filter(x => x.id !== sid));
          const after = loadRoutines();
          ensureRoutinesSelected(state, after);
          render(state);
        },
      }, ["Ta bort rutin"]));
    }
  }
// ---- Rutiner: Notes modal (per steg) ----
function openRoutineStepNotesModal({ mode, stepIndex, getText, setText }) {
  const isEdit = mode === "admin-edit";
  const ta = el("textarea", { class: "textarea", rows: 10, placeholder: "Notes" }, [getText() || ""]);
  if (!isEdit) ta.setAttribute("readonly", "readonly");

  const saveBtn = el("button", {
    class: "btn btn-primary",
    type: "button",
    disabled: !isEdit,
    onclick: () => { setText(ta.value || ""); closeModal(); }
  }, ["Save"]);

  const body = el("div", {}, [
    el("div", { class: "label" }, [`Status ${stepIndex + 1} – Notes`]),
    ta,
    el("div", { class: "routines-notes-actions" }, isEdit ? [saveBtn] : []),
  ]);

  openModal({
    title: "Notes",
    sub: isEdit ? "Redigera notes för detta steg." : "Read-only.",
    bodyNode: body,
    showFooterClose: false,
    onClose: () => closeModal(),
  });
}

// ---- Rutiner: gemensamt UI för Ny / Redigera ----
function openRoutineFormModal(state, mode) {
  const routines = loadRoutines();
  state.routines = state.routines || {};
  const selectedId = state.routines.selectedId || routines[0]?.id;

  if (mode === "edit" && !selectedId) { alert("Det finns inga rutiner att redigera."); return; }

  const existing = mode === "edit" ? routines.find(r => r.id === selectedId) : null;
  if (mode === "edit" && !existing) { alert("Kan inte hitta vald rutin."); return; }

  const working = {
    id: existing?.id || null,
    namn: existing?.namn || "",
    steg: (existing?.steg || []).map(s => ({ name: s.name || "", notes: s.notes || "" })),
  };
  if (mode === "new" && working.steg.length === 0) working.steg.push({ name: "", notes: "" });

  const nameIn = el("input", { class: "input", value: working.namn, placeholder: "Rutinens namn" }, []);
  nameIn.addEventListener("input", () => { working.namn = nameIn.value; });

  const stepsWrap = el("div", { class: "routines-steps-edit" }, []);

  function renderSteps() {
    stepsWrap.innerHTML = "";
    working.steg.forEach((step, idx) => {
      const stepName = el("input", { class: "input", value: step.name, placeholder: `Status ${idx + 1} namn` }, []);
      stepName.addEventListener("input", () => { working.steg[idx].name = stepName.value; });

      const notesBtn = el("button", {
        class: "icon-btn routines-notes-btn",
        type: "button",
        title: "Notes",
        onclick: () => openRoutineStepNotesModal({
          mode: "admin-edit",
          stepIndex: idx,
          getText: () => working.steg[idx].notes || "",
          setText: (t) => { working.steg[idx].notes = t; }
        })
      }, ["📝"]);

      const rowTop = el("div", { class: "routines-step-edit-row" }, [stepName, notesBtn]);

      const removeBtn = el("button", {
        class: "btn btn-small",
        type: "button",
        onclick: () => { working.steg.splice(idx, 1); renderSteps(); }
      }, ["Ta bort steg"]);

      stepsWrap.appendChild(el("div", { class: "card", style: "padding:10px;" }, [
        el("div", { class: "label" }, [`Status ${idx + 1}`]),
        rowTop,
        el("div", { style: "display:flex;justify-content:flex-end;margin-top:8px;" }, [removeBtn])
      ]));
    });
  }

  const addBtn = el("button", {
    class: "btn btn-small",
    type: "button",
    onclick: () => { working.steg.push({ name: "", notes: "" }); renderSteps(); }
  }, ["+ Lägg till steg"]);

  const saveBtn = el("button", {
    class: "btn btn-primary",
    type: "button",
    onclick: () => {
      const name = (working.namn || "").trim();
      if (!name) { alert("Ange namn för rutinen."); return; }

      const steps = (working.steg || [])
        .map(s => ({ name: (s.name || "").trim(), notes: (s.notes || "").toString() }))
        .filter(s => s.name.length > 0);

      if (!steps.length) { alert("Rutinen måste ha minst ett steg."); return; }

      const id = working.id || ("r_" + Math.random().toString(16).slice(2) + Date.now().toString(16));
      const updated = { id, namn: name, steg: steps };

      const i = routines.findIndex(r => r.id === id);
      if (i >= 0) routines[i] = updated; else routines.push(updated);

      saveRoutines(routines);
      state.routines.selectedId = id;

      closeModal();
      render(state);
    }
  }, ["Save"]);

  renderSteps();

  openModal({
    title: mode === "new" ? "Ny rutin" : "Redigera rutin",
    bodyNode: el("div", {}, [
      el("div", { class: "label" }, ["Namn"]),
      nameIn,
      el("div", { style: "display:flex;justify-content:space-between;align-items:center;margin-top:10px;" }, [
        el("div", { class: "label" }, ["Status"]),
        addBtn
      ]),
      stepsWrap,
      el("div", { class: "routines-new-actions" }, [saveBtn])
    ]),
    showFooterClose: false,
    onClose: () => { closeModal(); render(state); }
  });
}

  
  function openRoutineViewerModal(state, routine) {
    const steps = Array.isArray(routine?.steg) ? routine.steg : [];
    const body = el("div", { style: "display:flex;flex-direction:column;gap:10px;" }, [
      el("div", { style: "font-size:13px;color:#6b7280;" }, [`Visar ${steps.length} steg (read-only)`]),
      ...steps.map((s, i) => {
        const row = el("div", { class: "viewer-step" }, []);
        row.appendChild(el("div", { class: "viewer-step-index" }, [`Status ${i+1}`]));
        row.appendChild(el("input", { class: "input", value: (s?.name || "").toString(), readonly: true }));
        return row;
      }),
    ]);
    openModal({
      title: routine?.namn ? `Rutin: ${routine.namn}` : "Rutin",
      sub: "Status (read-only)",
      bodyNode: body
    });
  }


function renderRoutinesTab(state, user) {
    const view = document.getElementById("view");
    view.innerHTML = "";

    const routines = loadRoutines();
    ensureRoutinesSelected(state, routines);

    if (!routines.length) {
      view.appendChild(el("div", { class: "card", style: "padding:12px;" }, [
        el("div", { style: "font-weight:900;margin-bottom:6px;" }, ["Inga rutiner ännu"]),
        el("div", { style: "color: rgba(17,24,39,.7);font-size:13px;" }, [
          user?.role === "admin"
            ? "Skapa en rutin med knappen “Ny rutin”."
            : "Be en admin skapa en rutin."
        ])
      ]));
      return;
    }

    const table = el("table", { class: "table table-compact routines-ui" }, []);
    const thead = el("thead", {}, []);
    const headRow = el("tr", {}, []);
    headRow.appendChild(el("th", {}, ["Namn"]));
    for (let i = 1; i <= 5; i++) headRow.appendChild(el("th", {}, [`Status ${i}`]));
    // Admin only: delete column
    headRow.appendChild(el("th", {}, [""]));
    thead.appendChild(headRow);

    const tbody = el("tbody", {}, []);

    routines.forEach((routine) => {
      const tr = el("tr", {}, []);

      // Namn (admin: klickbar för redigera)
      if (user?.role === "admin") {
        const nameBtn = el("button", {
          class: "link-btn",
          type: "button",
          title: `Redigera rutin: ${routine.namn || ""}`,
          onclick: () => openRoutineEditorModal(state, { mode: "edit", routineId: routine.id }),
        }, [truncateText(routine.namn || "", 32).short]);

        tr.appendChild(el("td", { class: "routines-name-cell" }, [
          el("div", { style: "display:flex;align-items:center;gap:8px;" }, [
            nameBtn,
          ])
        ]));
      } else {
        tr.appendChild(el("td", { class: "routines-name-cell" }, [
          (() => { const tn = truncateText(routine.namn || "", 32); return el("div", { style: "font-weight:900;", title: tn.truncated ? tn.full : "" }, [tn.short]); })()
        ]));
      }

      const steps = Array.isArray(routine.steg) ? routine.steg : [];
      const overflow = Math.max(0, steps.length - 5);

      // Status 1–6
      for (let i = 0; i < 4; i++) {
        const step = steps[i] || null;

        const t = truncateText((step?.name || "").toString(), 26);
        const stepName = el("input", {
          class: "input",
          value: t.short,
          title: t.truncated ? t.full : "",
          readonly: true,
          style: "min-width:140px;",
        });

        const notesBtn = step
          ? el("button", {
              class: "comment-icon",
              type: "button",
              title: "Notes",
              onclick: () => openNotesModal({ state, routineId: routine.id, stepIndex: i, role: user?.role || "user" }),
            }, ["📝"])
          : el("span", { style: "width:24px;display:inline-block;" }, [""]);

        tr.appendChild(el("td", {}, [
          el("div", { class: "act-cell" }, [stepName, notesBtn]),
        ]));
      }

      // Status 5 (sista)
      if (overflow > 0) {
        const step7 = steps[4] || null;

        const t7 = truncateText((step7?.name || "").toString(), 26);

        const stepName = el("input", {
          class: "input",
          value: t7.short,
          title: t7.truncated ? t7.full : "",
          readonly: true,
          style: "min-width:140px;",
        });

        const moreBtn = el("button", {
          class: "btn btn-more",
          type: "button",
          title: "Visa alla steg",
          onclick: () => openRoutineViewerModal(state, routine),
        }, [`+${overflow}`]);

        tr.appendChild(el("td", {}, [
          el("div", { class: "act-cell" }, [stepName, moreBtn]),
        ]));
      } else {
        const step = steps[4] || null;

        const t = truncateText((step?.name || "").toString(), 26);
        const stepName = el("input", {
          class: "input",
          value: t.short,
          title: t.truncated ? t.full : "",
          readonly: true,
          style: "min-width:140px;",
        });

        const notesBtn = step
          ? el("button", {
              class: "comment-icon",
              type: "button",
              title: "Notes",
              onclick: () => openNotesModal({ state, routineId: routine.id, stepIndex: 4, role: user?.role || "user" }),
            }, ["📝"])
          : el("span", { style: "width:24px;display:inline-block;" }, [""]);

        tr.appendChild(el("td", {}, [
          el("div", { class: "act-cell" }, [stepName, notesBtn]),
        ]));
      }

      // Delete (admin only)
      const delTd = el("td", {}, []);
      if (user?.role === "admin") {
        const delBtn = el("button", {
          class: "icon-btn trash-btn",
          type: "button",
          title: "Ta bort rutin",
          onclick: () => {
            const ok = confirm(`Ta bort rutin “${routine.namn || ""}”?`);
            if (!ok) return;
            const next = loadRoutines().filter((r) => r.id !== routine.id);
            saveRoutines(next);
            ensureRoutinesSelected(state, next);
            render(state);
          }
        }, ["🗑"]);
        delTd.appendChild(delBtn);
      }
      tr.appendChild(delTd);

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);
    view.appendChild(table);
  }


  function openNotesModal({ state, routineId, stepIndex, role }) {
    const routines = loadRoutines();
    const rIndex = routines.findIndex(r => r.id === routineId);
    if (rIndex < 0) return;
    const routine = routines[rIndex];
    const step = (routine.steg || [])[stepIndex] || {};

    const isAdmin = role === "admin";

    const textarea = el("textarea", {
      class: "input",
      style: "width:100%; min-height: 220px; resize: vertical;",
    }, []);
    textarea.value = (step.notes || "").toString();
    textarea.readOnly = !isAdmin;

    const actions = el("div", { style: "display:flex; gap:10px; justify-content:flex-end; margin-top: 10px;" }, []);
    if (isAdmin) {
      actions.appendChild(el("button", {
        class: "btn btn-primary",
        type: "button",
        onclick: () => {
          // persist safely
          const routines2 = loadRoutines();
          const ri = routines2.findIndex(r => r.id === routineId);
          if (ri < 0) return closeModal();
          const r2 = routines2[ri];
          r2.steg = r2.steg || [];
          r2.steg[stepIndex] = r2.steg[stepIndex] || {};
          r2.steg[stepIndex].notes = textarea.value;
          saveRoutines(routines2);
          closeModal();
          render(state);
        }
      }, ["Save"]));
    }

    const body = el("div", {}, [
      el("div", { class: "label" }, ["Notes"]),
      textarea,
      actions
    ]);

    openModal({
      title: `${routine.namn || "Rutin"} – Status ${stepIndex + 1}`,
      sub: isAdmin ? "Skriv anteckningar och tryck Save." : "Read-only.",
      bodyNode: body,
      showFooterClose: false,
      onClose: () => { closeModal(); render(state); },
    });
  }

  
  
  
  function openRoutineEditorModal(state, { mode = "new", routineId = null } = {}) {
    const routines = loadRoutines();

    const existing = (mode === "edit" && routineId)
      ? routines.find(r => r.id === routineId)
      : null;

    if (mode === "edit" && !existing) {
      alert("Kan inte hitta rutinen att redigera.");
      return;
    }

    const working = existing
      ? {
          id: existing.id,
          namn: existing.namn || "",
          steg: (existing.steg || []).map(s => ({ name: s?.name || "", notes: s?.notes || "" })),
        }
      : {
          id: uid("routine"),
          namn: "",
          steg: [],
        };

    const nameIn = el("input", { class: "input", value: working.namn, placeholder: "Rutinens namn" }, []);
    nameIn.addEventListener("input", () => { working.namn = nameIn.value; });

    // Ny rutin: skapa X steg
    const countIn = el("input", { class: "input", type: "number", min: 1, max: 50, value: 5, style: "max-width:110px;" }, []);
    const genBtn = el("button", { class: "btn", type: "button" }, ["Skapa"]);
    const addBtn = el("button", { class: "btn", type: "button" }, ["+ Lägg till steg"]);

    const stepsViewport = el("div", {
      style: "border:1px solid #e5e7eb;border-radius:14px;padding:10px;overflow:auto;max-height:46vh;background:#fff;"
    }, []);
    const stepsList = el("div", { style: "display:flex;flex-direction:column;gap:8px;" }, []);
    stepsViewport.appendChild(stepsList);

    function renderSteps() {
      stepsList.innerHTML = "";

      if (!working.steg.length) {
        stepsList.appendChild(el("div", { style: "font-size:13px;color:#6b7280;padding:6px 0;" }, [
          mode === "new"
            ? "Skapa steg med Antal steg + Skapa, eller lägg till manuellt."
            : "Lägg till ett steg."
        ]));
        return;
      }

      working.steg.forEach((step, idx) => {
        const name = el("input", {
          class: "input",
          value: step.name,
          placeholder: `Status ${idx + 1} namn`,
        }, []);
        name.addEventListener("input", () => { working.steg[idx].name = name.value; });

        const notesBtn = el("button", {
          class: "comment-icon",
          type: "button",
          title: step.notes ? "Notes (finns)" : "Notes (tom)",
          onclick: () => {
            const ta = el("textarea", { class: "textarea", rows: 8 }, [working.steg[idx].notes || ""]);
            const save = el("button", { class: "btn btn-primary", type: "button" }, ["Save"]);
            save.addEventListener("click", () => {
              working.steg[idx].notes = ta.value || "";
              closeModal();
              openRoutineEditorModal(state, { mode, routineId: working.id });
            });
            openModal({
              title: `Notes – Status ${idx + 1}`,
              sub: "Admin",
              bodyNode: el("div", { style: "display:flex;flex-direction:column;gap:10px;" }, [
                ta,
                el("div", { style: "display:flex;justify-content:flex-end;" }, [save]),
              ]),
              showFooterClose: true,
            });
          }
        }, ["📝"]);

        const up = el("button", { class: "btn", type: "button", title: "Upp", style: "padding:6px 10px;border-radius:999px;" }, ["↑"]);
        const down = el("button", { class: "btn", type: "button", title: "Ner", style: "padding:6px 10px;border-radius:999px;" }, ["↓"]);
        up.addEventListener("click", () => {
          if (idx === 0) return;
          const tmp = working.steg[idx - 1];
          working.steg[idx - 1] = working.steg[idx];
          working.steg[idx] = tmp;
          renderSteps();
        });
        down.addEventListener("click", () => {
          if (idx === working.steg.length - 1) return;
          const tmp = working.steg[idx + 1];
          working.steg[idx + 1] = working.steg[idx];
          working.steg[idx] = tmp;
          renderSteps();
        });

        const del = el("button", { class: "icon-btn trash-btn", type: "button", title: "Ta bort steg" }, ["🗑"]);
        del.addEventListener("click", () => {
          const ok = confirm(`Ta bort Status ${idx + 1}?`);
          if (!ok) return;
          working.steg.splice(idx, 1);
          renderSteps();
        });

        const row = el("div", { style: "display:grid;grid-template-columns:44px 1fr auto;gap:10px;align-items:center;" }, [
          el("div", { style: "font-weight:900;color:#6b7280;text-align:center;" }, [`${idx + 1}`]),
          name,
          el("div", { style: "display:flex;gap:8px;align-items:center;" }, [notesBtn, up, down, del]),
        ]);

        stepsList.appendChild(row);
      });
    }

    genBtn.addEventListener("click", () => {
      const n = Math.max(1, Math.min(50, parseInt(countIn.value || "0", 10) || 0));
      if (!n) { alert("Ange antal steg."); return; }
      working.steg = Array.from({ length: n }).map((_, i) => ({ name: `Status ${i + 1}`, notes: "" }));
      renderSteps();
    });

    addBtn.addEventListener("click", () => {
      working.steg.push({ name: "", notes: "" });
      renderSteps();
    });

    const cancelBtn = el("button", { class: "btn", type: "button" }, ["Cancel"]);
    cancelBtn.addEventListener("click", () => closeModal());

    const saveBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Save"]);
    saveBtn.addEventListener("click", () => {
      const name = (working.namn || "").toString().trim();
      if (!name) { alert("Ange namn för rutinen."); return; }

      const steps = (working.steg || [])
        .map(s => ({ name: (s.name || "").toString().trim(), notes: (s.notes || "").toString() }))
        .filter(s => s.name.length > 0);

      if (!steps.length) { alert("Rutinen måste ha minst ett steg."); return; }

      const updated = { id: working.id, namn: name, steg: steps };
      const idx = routines.findIndex(r => r.id === working.id);
      if (idx >= 0) routines[idx] = updated;
      else routines.push(updated);

      saveRoutines(routines);
      ensureRoutinesSelected(state, routines);

      closeModal();
      render(state);
    });

    renderSteps();

    const topRow = el("div", { style: "display:flex;gap:14px;align-items:flex-end;flex-wrap:wrap;" }, [
      el("div", { style: "flex:1;min-width:260px;" }, [
        el("div", { class: "label" }, ["Namn"]),
        nameIn,
      ]),
      mode === "new"
        ? el("div", { style: "min-width:220px;" }, [
            el("div", { class: "label" }, ["Antal steg"]),
            el("div", { style: "display:flex;gap:10px;align-items:center;" }, [countIn, genBtn]),
          ])
        : el("div", { style: "width:220px;" }, [""]),
    ]);

    const stepsHeader = el("div", { style: "display:flex;justify-content:space-between;align-items:center;" }, [
      el("div", { class: "label" }, ["Status"]),
      el("div", { style: "display:flex;gap:10px;align-items:center;" }, [addBtn]),
    ]);

    const footer = el("div", { style: "display:flex;justify-content:flex-end;gap:10px;padding-top:6px;" }, [
      cancelBtn,
      saveBtn,
    ]);

    const body = el("div", { style: "display:flex;flex-direction:column;gap:12px;" }, [
      topRow,
      stepsHeader,
      stepsViewport,
      footer,
    ]);

    openModal({
      title: mode === "new" ? "Ny rutin" : "Redigera rutin",
      sub: mode === "new" ? "Ange namn och skapa steg." : "Ändra namn och steg. Notes via 📝.",
      bodyNode: body,
      showFooterClose: false,
    });

    // Force medium sizing without requiring CSS
    const modal = document.querySelector(".modal");
    if (modal) {
      const content = modal.querySelector(".modal-content");
      if (content) {
        content.style.maxWidth = "860px";
        content.style.width = "calc(100% - 40px)";
        content.style.maxHeight = "80vh";
        content.style.overflow = "hidden";
      }
    }
  }
function openNewRoutineModal(state) {
    openRoutineEditorModal(state, { mode: "new" });
  }

  function openEditRoutineModal(state) {
    const routines = loadRoutines();
    const selectedId = ensureRoutinesSelected(state, routines);
    if (!selectedId) {
      alert("Det finns inga rutiner att redigera.");
      return;
    }
    openRoutineEditorModal(state, { mode: "edit", routineId: selectedId });
  }

  document.addEventListener("DOMContentLoaded", init);
})();


// -------------------------------------------------
// Settings Utility Button: Clear local cache
// -------------------------------------------------
function clearLocalCacheAndReload() {
  try {
    localStorage.removeItem(STORAGE_KEY_V16);
    console.log("Local cache cleared. Reloading...");
    location.reload();
  } catch (e) {
    console.warn("Could not clear local cache:", e);
  }
}

// Inject button when Settings view is visible
window.addEventListener("load", function () {
  const interval = setInterval(() => {
    // crude but safe detection of Settings view
    if (document.body && document.body.innerText.includes("Settings")) {
      if (!document.getElementById("btn-clear-local-cache")) {
        const btn = document.createElement("button");
        btn.id = "btn-clear-local-cache";
        btn.innerText = "Rensa lokal cache & ladda från Supabase";
        btn.style.position = "fixed";
        btn.style.bottom = "20px";
        btn.style.right = "20px";
        btn.style.zIndex = "9999";
        btn.className = "btn";
        btn.onclick = clearLocalCacheAndReload;
        document.body.appendChild(btn);
      }
    }
  }, 1000);
});
