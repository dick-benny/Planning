/* ======================================================
   App v31 – Refactored & Structured
   - No functional changes intended
   - Logical modules grouped for maintainability
   ====================================================== */

(function () {
  'use strict';

/* =========================================================
   UP-planning – app-v15.js
   Version 15
   STOR FÖRÄNDRING: Utveckling (dynamisk struktur definierad av admin)

   - Admin (Utveckling):
     * Knapp: "Definiera utvecklingstabell" -> modal med lista av aktiviteter
     * Knapp: "Ny aktivitet" -> form: Namn + Typ (steg/kalender/text)
     * Varje aktivitet-rad: "Def Tasks" -> modal med tasks för aktiviteten
       - Knapp: "New Task" -> form: Namn + Save/Cancel (stänger)
       - Task-tabell: inledande checkbox (Enabled). När ikryssad går det att
         ändra ordning med upp-/nedåtpil.
   - User (Utveckling):
     * Tabellen byggs av aktiviteterna admin definierat
     * Typ = steg -> visar progress-stapel med antal steg = antal Enabled tasks
       (klick öppnar checklist för tasks)
     * Typ = kalender -> date input
     * Typ = text -> text input

   Behåller i stort:
   - Login + Settings (Mina sidor / Logout, admin ser Manage user)
   - Manage user (klick namn -> edit/new)
   - Tasks (privat logik, notes, overdue, ny todo via formulär)
   - Produkt-tabellen (oförändrad från tidigare v14)

   OBS: Front-end demo utan backend. All data sparas i localStorage.
   ========================================================= */

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
  const STORAGE_KEY_V15 = "up_planning_v15";
  const STORAGE_KEYS_OLD = [
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

  const Tabs = { DEV: "dev", PRODUCT: "product", TODO: "todo" };

  // Utveckling (dynamisk)
  const DEV_ACTIVITY_TYPES = ["steg", "kalender", "veckokalender", "text"];

  // Produkt (behåll)
  const STEPS_DEFAULT = 5;
  const COLS_PRODUCT = [
    { key: "name", label: "Namn", type: "passive" },
    { key: "titleSku", label: "Titel/SKU", type: "active" },
    { key: "launchQ", label: "Lansering Q", type: "passive" },
    { key: "po", label: "PO", type: "active" },
    { key: "price", label: "Pris", type: "active" },
    { key: "msMaterial", label: "MS-mtrl", type: "active" },
    { key: "sellStartB2C", label: "Säljstart B2C", type: "passive" },
    { key: "sellStartB2B", label: "Säljstart B2B", type: "passive" },
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
    state.devTypes = Array.isArray(state.devTypes) ? state.devTypes : [];
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
    { key: "__comment__", label: "", type: "comment" },
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
  // Comment mail helper (mailto)
  // -------------------------------
  function emailForInitials(initials) {
    const u = getUsers().find((x) => (x.initials || "").toUpperCase() === (initials || "").toUpperCase());
    return (u && u.email) ? u.email : "";
  }

  function sendCommentMail(toInitialsList, subject, body) {
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
    localStorage.setItem(STORAGE_KEY_V15, JSON.stringify(state));
  }

  function defaultState() {
    return {
      activeTab: Tabs.DEV,

      // Utveckling: schema + entries
      devSchema: {
        activities: [
          // {id, name, type: 'steg'|'kalender'|'text', createdAt, tasks:[{id,name,enabled,order}]}
        ],
      },
      devEntries: [
        // {id, name, fields: { [activityId]: {text/date} or { tasksData: {[taskId]: bool} } }, createdAt }
      ],

      // Produkt: schema + rows + archive
      productSchema: { activities: [] },
      productRows: [],
      archive: { dev: [], product: [] },

      // Tasks
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
    const cur = loadJson(STORAGE_KEY_V15);
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
      comments: [],
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
      fields: e.fields && typeof e.fields === "object" ? e.fields : {},
      createdAt: e.createdAt || Date.now(),
    }));

    return state;
  }

  // -------------------------------
  // Modal
  // -------------------------------
  function openModal({ title, sub, bodyNode }) {
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

    // reflow
    void backdrop.offsetHeight;

    backdrop.classList.add("is-open");
  }

  function closeModal() {
    document.getElementById("modalBackdrop").classList.remove("is-open");
  }

  function wireModalClose() {
    const backdrop = document.getElementById("modalBackdrop");
    document.getElementById("modalCloseBtn").addEventListener("click", closeModal);
    document.getElementById("modalCloseBtn2").addEventListener("click", closeModal);
    backdrop.addEventListener("click", (e) => {
      if (e.target === backdrop) closeModal();
    });
    window.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeModal();
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
        el("div", { class: "logo" }, ["UP"]),
        el("div", {}, [
          el("div", { class: "brand-title" }, ["UP-planning"]),
          el("div", { class: "brand-sub" }, ["Utvecklings- och Produktionsprocess"]),
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
        el("h1", { id: "heroTitle" }, ["Utveckling"]),
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
          el("button", { class: "btn", id: "modalCloseBtn2", type: "button" }, ["Stäng"]),
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

    menu.innerHTML = "";
    menu.appendChild(item("Mina sidor", openMyPages));
    if (user?.role === "admin") menu.appendChild(item("Manage user", openManageUsers));
    if (user?.role === "admin") menu.appendChild(item("Register", openManageRegisters));
    
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
    const wrap = el("div", {}, []);
    const header = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;" });

    const title = el("div", { style: "font-weight:1000;" }, ["Users"]);
    const newBtn = el("button", { class: "btn btn-primary", type: "button", onclick: (e) => { e?.preventDefault?.(); e?.stopPropagation?.(); openFormForUser(null); } }, ["New User"]);
    header.appendChild(title);
    header.appendChild(newBtn);

    const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;" });

    function openFormForUser(userObjOrNull) {
      const existing = userObjOrNull || null;
      const body = renderForm(existing);
      openModal({ title: existing ? "Edit user" : "New user", sub: existing ? (existing.username || "") : "", bodyNode: body });
    }

    function renderList() {
      list.innerHTML = "";
      const users = getUsers();

      users.forEach((u) => {
        const row = el("div", { style: "display:flex;align-items:center;",
          style: "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border:1px solid #e5e7eb;border-radius:12px;",
        });

        const nameBtn = el("button", {
          type: "button",
          class: "link-btn", style: "cursor:pointer;",
          title: "Öppna",
          onclick: () => openFormForUser(u),
        }, [u.username || "(saknar namn)"]);

        const del = el("button", {
          class: "icon-btn up-trash",
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
      const cancelBtn = el("button", { class: "btn btn-secondary", type: "button" }, ["Cancel"]);

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
        closeModal();
        renderList();
      });

      cancelBtn.addEventListener("click", () => closeModal());

      actions.appendChild(cancelBtn);
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

    const wrap = el("div", {}, []);
    const top = el("div", { style: "display:flex;align-items:center;gap:10px;margin-bottom:12px;flex-wrap:wrap;" });

    const regSel = el("select", { class: "input up-select", style: "max-width:220px;" }, [
      el("option", { value: "kategori" }, ["Kategori"]),
      el("option", { value: "dev_type" }, ["Dev_type"]),
    ]);

    const hint = el("div", { style: "font-size:12px;color:#6b7280;" }, [
      "Kategori används i Tasks-filter. Dev_type används som dropdown för fältet Typ i Produkt.",
    ]);

    top.appendChild(el("div", { class: "label", style: "margin:0;" }, ["Register"]));
    top.appendChild(regSel);
    top.appendChild(hint);

    const body = el("div", {});

    function renderDevType() {
      const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;" });
      const items = getDevTypes(state);

      items.forEach((name) => {
        const row = el("div", { style: "display:flex;align-items:center;gap:10px;" });
        const input = el("input", { class: "input", value: name });
        const saveBtn = el("button", { class: "btn", type: "button" }, ["Spara"]);
        const delBtn = el("button", { class: "btn", type: "button" }, ["Ta bort"]);

        saveBtn.addEventListener("click", () => {
          const v = (input.value || "").trim();
          if (!v) return alert("Namn saknas.");
          state.devTypes = (state.devTypes || []).map((x) => (x === name ? v : x));
          state.devTypes = uniqStrings(state.devTypes);
          saveState(state);
          renderActive();
        });

        delBtn.addEventListener("click", () => {
          const ok = confirm(`Ta bort "${name}"?`);
          if (!ok) return;
          state.devTypes = (state.devTypes || []).filter((x) => x !== name);
          saveState(state);
          renderActive();
        });

        row.appendChild(input);
        row.appendChild(saveBtn);
        row.appendChild(delBtn);
        list.appendChild(row);
      });

      const addRow = el("div", { style: "display:flex;align-items:center;gap:10px;margin-top:12px;" });
      const addIn = el("input", { class: "input", placeholder: "Ny dev_type..." });
      const addBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Lägg till"]);

      addBtn.addEventListener("click", () => {
        const v = (addIn.value || "").trim();
        if (!v) return;
        state.devTypes = uniqStrings([...(state.devTypes || []), v]);
        addIn.value = "";
        saveState(state);
        renderActive();
      });

      addRow.appendChild(addIn);
      addRow.appendChild(addBtn);

      body.appendChild(el("div", { class: "label" }, ["Dev_type"]));
      body.appendChild(list);
      body.appendChild(addRow);
    }

    function renderActive() {
      body.innerHTML = "";
      const which = regSel.value;
      if (which === "kategori") body.appendChild(renderManageCategories(state));
      else renderDevType();
    }

    regSel.addEventListener("change", renderActive);

    wrap.appendChild(top);
    wrap.appendChild(body);
    renderActive();
    return wrap;
  }

function renderManageCategories(state) {
    const wrap = el("div", {}, []);
    const header = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;" });

    const title = el("div", { style: "font-weight:1000;" }, ["Kategorier"]);
    const newBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Ny kategori"]);
    header.appendChild(title);
    header.appendChild(newBtn);

    const hint = el("div", { style: "font-size:12px;color:#6b7280;margin-bottom:10px;" }, [
      'Dessa används i Tasks-kategori och i dropdown-filtret. "Alla" finns alltid med. "Privat" är en specialkategori och kan inte tas bort här.',
    ]);

    const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;" });
    const formWrap = el("div", { style: "margin-top:12px;display:none;" });

    let editingName = null;

    function refreshFromTasks() {
      ensureTodoCategories(state);
      saveState(state);
    }

    function renderList() {
      refreshFromTasks();
      list.innerHTML = "";

      const cats = getManagedTodoCategories(state);

      cats.forEach((c) => {
        const row = el("div", { style: "display:flex;align-items:center;",
          style: "display:flex;align-items:center;justify-content:space-between;gap:12px;padding:10px;border:1px solid #e5e7eb;border-radius:12px;",
        });

        const nameBtn = el("button", {
          type: "button",
          class: "link-btn", style: "cursor:pointer;",
          title: "Ändra",
          onclick: () => openForm(c),
        }, [c]);

        const del = el("button", {
          class: "icon-btn up-trash",
          type: "button",
          title: "Ta bort kategori",
          onclick: () => {
            const ok = confirm(`Ta bort kategorin "${c}"? Alla tasks med denna kategori sätts till "Allmänt".`);
            if (!ok) return;

            // Remove from managed list
            state.todo.categories = getManagedTodoCategories(state).filter((x) => x.toLowerCase() !== c.toLowerCase());

            // Replace on tasks
            const fix = (t) => {
              if (!t) return;
              if ((t.category || "").toLowerCase() === c.toLowerCase()) t.category = "Allmänt";
            };
            (state.todo.items || []).forEach(fix);
            (state.todo.archive || []).forEach(fix);

            if ((state.todo.filter || "").toLowerCase() === c.toLowerCase()) state.todo.filter = "Alla";

            ensureTodoCategories(state);
            saveState(state);
            render(state);
            if (editingName && editingName.toLowerCase() === c.toLowerCase()) closeForm();
            renderList();
          },
        }, ["🗑️"]);

        row.appendChild(nameBtn);
        row.appendChild(del);
        list.appendChild(row);
      });
    }

    function openForm(existingNameOrNull) {
      editingName = existingNameOrNull ? existingNameOrNull : null;
      formWrap.style.display = "block";
      renderForm(existingNameOrNull);
    }
    function closeForm() { editingName = null; formWrap.style.display = "none"; }

    function renderForm(existingNameOrNull) {
      formWrap.innerHTML = "";

      const isEdit = !!existingNameOrNull;
      const input = el("input", { class: "input", placeholder: "Kategori (t.ex. Frakt)", value: existingNameOrNull || "" });

      const actions = el("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:10px;" }, []);
      const cancel = el("button", { class: "btn", type: "button", onclick: () => closeForm() }, ["Avbryt"]);
      const save = el("button", { class: "btn btn-primary", type: "button" }, ["Spara"]);

      save.addEventListener("click", () => {
        const v = (input.value || "").toString().trim();
        if (!v) { alert("Ange ett namn."); return; }
        const low = v.toLowerCase();
        if (low === "alla") { alert('"Alla" är reserverat.'); return; }
        if (low === "privat") { alert('"Privat" är en specialkategori.'); return; }

        const cats = getManagedTodoCategories(state);
        if (!isEdit) {
          if (cats.map((x) => x.toLowerCase()).includes(low)) { alert("Den kategorin finns redan."); return; }
          state.todo.categories = uniqStrings([...cats, v]);
        } else {
          const oldLow = existingNameOrNull.toLowerCase();
          // rename in list
          state.todo.categories = cats.map((x) => (x.toLowerCase() === oldLow ? v : x));
          // rename in tasks
          const ren = (t) => {
            if (!t) return;
            if ((t.category || "").toLowerCase() === oldLow) t.category = v;
          };
          (state.todo.items || []).forEach(ren);
          (state.todo.archive || []).forEach(ren);
          if ((state.todo.filter || "").toLowerCase() === oldLow) state.todo.filter = v;
        }

        ensureTodoCategories(state);
        saveState(state);
        render(state);
        closeForm();
        renderList();
      });

      actions.appendChild(cancel);
      actions.appendChild(save);

      formWrap.appendChild(el("div", { class: "label" }, [isEdit ? "Ändra kategori" : "Ny kategori"]));
      formWrap.appendChild(input);
      formWrap.appendChild(actions);
    }

    wrap.appendChild(header);
    wrap.appendChild(hint);
    wrap.appendChild(list);
    wrap.appendChild(formWrap);

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
  // Utveckling (admin schema)
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

    const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;" });

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

  // Admin view for Utveckling (inline, not using Ny utveckling)
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

    const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;" });

    function renderList() {

      function moveActivity(idx, dir) {
        const acts = state.devSchema.activities;
        const j = idx + dir;
        if (j < 0 || j >= acts.length) return;
        const tmp = acts[idx];
        acts[idx] = acts[j];
        acts[j] = tmp;
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

  // Admin view for Produkt (samma admin-UI som Utveckling)
  function renderProductAdminView(state) {
    const view = document.getElementById("view");
    view.innerHTML = "";

    const user = currentUser();
    if (user?.role !== "admin") return;

    const wrap = el("div", {}, []);

    const header = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;margin-bottom:12px;flex-wrap:wrap;" }, [
      el("div", { style: "font-weight:1000;font-size:16px;" }, ["Definiera produkttabell"]),
    ]);

    const newBtn = el("button", { class: "btn btn-primary", type: "button" }, ["Ny aktivitet"]);
    header.appendChild(newBtn);

    const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;" });

    function renderList() {

      function moveActivity(idx, dir) {
        const acts = state.productSchema.activities;
        const j = idx + dir;
        if (j < 0 || j >= acts.length) return;
        const tmp = acts[idx];
        acts[idx] = acts[j];
        acts[j] = tmp;
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

// Admin view for Produkt (samma admin-UI som Utveckling)
  

  function openNewActivityForm(state, onAfterSave) {
    const nameIn = el("input", { class: "input", placeholder: "Namn" });
    const typeSel = el("select", { class: "input" }, DEV_ACTIVITY_TYPES.map((t) => el("option", { value: t }, [t])));

    const form = el("div", {}, [
      el("div", { class: "label" }, ["Ny aktivitet"]),
      el("div", { style: "display:grid;grid-template-columns:1fr 160px;gap:10px;align-items:end;" }, [
        el("div", {}, [el("div", { class: "label" }, ["Namn"]), nameIn]),
        el("div", {}, [el("div", { class: "label" }, ["Typ"]), typeSel]),
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
      el("div", { class: "label" }, ["Ny produkt-aktivitet"]),
      el("div", { style: "display:grid;grid-template-columns:1fr 160px;gap:10px;align-items:end;" }, [
        el("div", {}, [el("div", { class: "label" }, ["Namn"]), nameIn]),
        el("div", {}, [el("div", { class: "label" }, ["Typ"]), typeSel]),
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

    openModal({ title: "Ny produkt-aktivitet", sub: "Admin", bodyNode: el("div", {}, [form, actions]) });
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

    const table = el("table", { class: "table" });
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
  // Utveckling (user table)
  // -------------------------------
  function ensureDevEntryCell(entry, activity) {
    entry.fields = entry.fields || {};
    if (!entry.fields[activity.id]) {
      if (activity.type === "steg") entry.fields[activity.id] = { tasksData: {} };
      else entry.fields[activity.id] = { value: "" };
    } else {
      // normalize
      const cell = entry.fields[activity.id];
      if (activity.type === "steg") {
        if (!cell.tasksData || typeof cell.tasksData !== "object") {
        // migrate old shape if present
        const old = (cell.tasksData && typeof cell.tasksData === "object") ? cell.tasksData : {};
        cell.tasksData = {};
        Object.keys(old).forEach((tid) => {
          cell.tasksData[tid] = { done: !!old[tid], date: "", notes: [] };
        });
        delete cell.tasksData;
      }
      } else {
        if (!("value" in cell)) cell.value = "";
      }
    }
    return entry.fields[activity.id];
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
    const acts = state.devSchema.activities.slice();

    // Sort activities by createdAt (stable)
    acts.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

    const cols = [
      { key: "name", label: "Namn", type: "passive" },
      { key: "__type__", label: "Typ", type: "type" },
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

      // typ
      tr.appendChild(el("td", {}, [
        el("div", { style: "font-weight:800;" }, [
          (entry.type || "").toString().toLowerCase() === "produkt" ? "Produkt" : ((entry.type || "").toString().toLowerCase() === "paketering" ? "Paketering" : (entry.type || ""))
        ])
      ]));

      // dynamic activity cols
      acts.forEach((a) => {
        const td = el("td");
        const cell = ensureDevEntryCell(entry, a);

        if (a.type === "text") {
          td.appendChild(el("input", {
            class: "input",
            value: cell.value ?? "",
            placeholder: "",
            oninput: (e) => { cell.value = e.target.value; saveState(state); },
          }));
        } else if (a.type === "veckokalender") {
          // Visa kalender (date picker) men presentera vecka i fältet
          const wrap = el("div", { style: "position:relative;width:100%;min-width:120px;" });
          const shown = el("input", {
            class: "input",
            type: "text",
            value: cell.value ?? "",
            placeholder: "Välj vecka",
            readonly: true,
            style: "padding-right:12px;",
          });
          const picker = el("input", {
            type: "date",
            value: cell.date || "",
            style: "position:absolute;inset:0;opacity:0;cursor:pointer;",
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
          td.appendChild(wrap);
        } else if (a.type === "kalender") {
          td.appendChild(el("input", {
            class: "input",
            type: "date",
            value: cell.value ?? "",
            onchange: (e) => { cell.value = e.target.value; saveState(state); render(state); },
          }));
        } else if (a.type === "steg") {
          const tasks = allTasks(a);
          const steps = tasks.length;
          const doneCount = countDoneSteps(entry, a);

          td.appendChild(el("button", {
            type: "button",
            class: "pill up-active-cell",
            title: "Öppna tasks",
            onclick: () => openUserTasksModal(state, entry, a),
            style: "display:flex;align-items:center;gap:10px;width:100%;justify-content:flex-start;",
          }, [
            progressNode(doneCount, steps),
            el("span", { style: "font-weight:900;" }, ["Tasks"]),
          ]));
        }

        tr.appendChild(td);
      });

      // row delete (trash)
      tr.appendChild(el("td", {}, [
        el("button", {
          class: "icon-btn up-trash",
          type: "button",
          title: "Ta bort",
          onclick: () => {
            const ok = confirm("Ta bort raden? Detta går inte att ångra.");
            if (!ok) return;
            state.devEntries = state.devEntries.filter((x) => x.id !== entry.id);
            saveState(state);
            render(state);
          },
        }, ["🗑️"]),
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

    const typeSel = el("select", { class: "input" }, [
      el("option", { value: "produkt" }, ["Produkt"]),
      el("option", { value: "paketering" }, ["Paketering"]),
    ]);

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
      el("div", {}, [el("div", { class: "label" }, ["Typ"]), typeSel]),
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
    openModal({ title: "Produkt", sub: "Aktiv aktivitet (klickbar)", bodyNode: renderPlaceholderModal() });
  }

  

function renderProductTable(state) {
    const view = document.getElementById("view");
    view.innerHTML = "";

    const user = currentUser();
    ensureDevTypes(state);
    const devTypes = getDevTypes(state);
    const acts = (state.productSchema?.activities || []).slice();
    acts.sort((a, b) => (a.createdAt ?? 0) - (b.createdAt ?? 0));

    // Produkt: kolumner byggs ENDAST av admin-definierade aktiviteter
    const baseCols = acts.map((a) => ({ key: a.id, label: a.name, type: a.type, activity: a }));

    // Visa Typ-kolumnen direkt efter kolumnen "Namn" (om den finns)
    const cols = [];
    let insertedType = false;
    baseCols.forEach((c) => {
      cols.push(c);
      if (!insertedType && String(c.label || "").trim().toLowerCase() === "namn") {
        cols.push({ key: "__type__", label: "Typ", type: "dev_type" });
        insertedType = true;
      }
    });
    if (!insertedType) cols.unshift({ key: "__type__", label: "Typ", type: "dev_type" });

    const rows = state.productRows || [];

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

      cols.forEach((c) => {
        if (c.key === "__type__") {
          row.type = row.type || "";
          const typeSel = el("select", { class: "input up-select" }, [
            el("option", { value: "" }, ["-"]),
            ...devTypes.map((t) => el("option", { value: t }, [t])),
          ]);
          typeSel.value = row.type || "";
          typeSel.addEventListener("change", (e) => { row.type = e.target.value; saveState(state); });
          tr.appendChild(el("td", { style: "min-width:140px;" }, [typeSel]));
          return;
        }

        const td = el("td");
        const a = c.activity;
        const cell = ensureDevEntryCell(row, a);

        if (a.type === "text") {
          td.appendChild(el("input", {
            class: "input",
            value: cell.value ?? "",
            oninput: (e) => { cell.value = e.target.value; saveState(state); },
          }));
        } else if (a.type === "veckokalender") {
          // Visa kalender (date picker) men presentera vecka i fältet
          const wrap = el("div", { style: "position:relative;width:100%;min-width:120px;" });
          const shown = el("input", {
            class: "input",
            type: "text",
            value: cell.value ?? "",
            placeholder: "Välj vecka",
            readonly: true,
            style: "padding-right:12px;",
          });
          const picker = el("input", {
            type: "date",
            value: cell.date || "",
            style: "position:absolute;inset:0;opacity:0;cursor:pointer;",
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
          td.appendChild(wrap);
        } else if (a.type === "kalender") {
          td.appendChild(el("input", {
            class: "input",
            type: "date",
            value: cell.value ?? "",
            onchange: (e) => { cell.value = e.target.value; saveState(state); render(state); },
          }));
        } else if (a.type === "steg") {
          const tasks = allTasks(a);
          const steps = tasks.length;
          const doneCount = countDoneSteps(row, a);

          td.appendChild(el("button", {
            type: "button",
            class: "pill up-active-cell",
            title: "Öppna tasks",
            onclick: () => openUserTasksModal(state, row, a),
            style: "display:flex;align-items:center;gap:10px;width:100%;justify-content:flex-start;",
          }, [
            progressNode(doneCount, steps),
            el("span", { style: "font-weight:900;" }, ["Tasks"]),
          ]));
        }

        tr.appendChild(td);
      });

      // Keep delete on row
      tr.appendChild(el("td", {}, [
        el("button", {
          class: "icon-btn up-trash",
          type: "button",
          title: "Ta bort",
          onclick: () => {
            const ok = confirm("Ta bort raden? Detta går inte att ångra.");
            if (!ok) return;
            state.productRows = state.productRows.filter((x) => x !== row);
            saveState(state);
            render(state);
          },
        }, ["🗑️"]),
      ]));

      tbody.appendChild(tr);
    });

    table.appendChild(thead);
    table.appendChild(tbody);

    view.appendChild(table);

    if (!acts.length) {
      view.appendChild(el("div", { style: "margin-top:12px;color:#6b7280;font-size:12px;" }, [
        user?.role === "admin"
          ? "Inga aktiviteter definierade. Som admin: lägg till aktiviteter under Produkt (admin-läget)."
          : "Inga aktiviteter definierade ännu. Be admin definiera produkttabellen.",
      ]));
    }
  }




  function defaultRowForProduct(fromName = "") {
    return {
      id: uid("product"),
      name: fromName || "",
      launchQ: "",
      sellStartB2C: "",
      sellStartB2B: "",
      tasks: { titleSku: [], po: [], price: [], msMaterial: [] },
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
  
  function openTodoCommentModal(state, todo, user) {
    // View history + add new comment notification
    todo.comments = Array.isArray(todo.comments) ? todo.comments : [];

    const wrap = el("div", {}, []);

    const header = el("div", { style: "display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;margin-bottom:10px;" }, [
      el("div", { style: "font-weight:1000;" }, ["Comment"]),
      el("button", { class: "btn btn-primary", type: "button" }, ["Ny comment"]),
    ]);

    const list = el("div", { style: "display:flex;flex-direction:column;gap:10px;" });
    const form = el("div", { style: "display:none;margin-top:10px;padding-top:10px;border-top:1px solid #e5e7eb;" });

    function fmt(ts) {
      try { return new Date(ts).toLocaleString("sv-SE"); } catch { return ""; }
    }

    function renderList() {
      list.innerHTML = "";
      const items = (todo.comments || []).slice().sort((a, b) => (b.at || 0) - (a.at || 0));

      if (!items.length) {
        list.appendChild(el("div", { style: "padding:12px;border:1px dashed #d1d5db;border-radius:12px;color:#6b7280;" }, [
          "Inga comments ännu.",
        ]));
        return;
      }

      items.forEach((c) => {
        const toTxt = (c.to || []).join(", ");
        list.appendChild(el("div", { style: "padding:10px;border:1px solid #e5e7eb;border-radius:12px;background:#fff;" }, [
          el("div", { style: "display:flex;justify-content:space-between;gap:10px;align-items:flex-start;flex-wrap:wrap;" }, [
            el("div", { style: "font-weight:900;" }, [toTxt ? `Till: ${toTxt}` : "Till: -"]),
            el("div", { style: "font-size:12px;color:#6b7280;" }, [fmt(c.at)]),
          ]),
          el("div", { style: "margin-top:6px;white-space:pre-wrap;" }, [c.message || ""]),
        ]));
      });
    }

    function openForm() {
      form.style.display = "block";
      form.innerHTML = "";

      const users = getUsers()
        .map((u) => ({ initials: (u.initials || "").toUpperCase(), email: u.email || "" }))
        .filter((u) => u.initials.length > 0);

      const uniq = uniqStrings(users.map((u) => u.initials)).sort((a, b) => a.localeCompare(b, "sv", { sensitivity: "base" }));

      const pickWrap = el("div", { style: "display:flex;flex-wrap:wrap;gap:8px;" });
      const selected = new Set();

      uniq.forEach((ini) => {
        const chip = el("button", { type: "button", class: "pill", style: "font-weight:900;" }, [ini]);
        chip.addEventListener("click", () => {
          if (selected.has(ini)) {
            selected.delete(ini);
            chip.classList.remove("pill-done");
          } else {
            selected.add(ini);
            chip.classList.add("pill-done");
          }
        });
        pickWrap.appendChild(chip);
      });

      const msg = el("textarea", { class: "input", placeholder: "Skriv meddelande…", style: "min-height:110px;" });

      const actions = el("div", { style: "display:flex;gap:10px;justify-content:flex-end;margin-top:10px;flex-wrap:wrap;" });
      const cancel = el("button", { class: "btn", type: "button" }, ["Avbryt"]);
      const save = el("button", { class: "btn btn-primary", type: "button" }, ["Skicka"]);

      cancel.addEventListener("click", () => { form.style.display = "none"; });
      save.addEventListener("click", () => {
        const to = Array.from(selected);
        const message = (msg.value || "").toString().trim();
        if (!to.length) { alert("Välj minst en mottagare (initialer)."); return; }
        if (!message) { alert("Skriv ett meddelande."); return; }

        const entry = { to, message, at: Date.now() };
        todo.comments = Array.isArray(todo.comments) ? todo.comments : [];
        todo.comments.push(entry);

        saveState(state);
        render(state);

        // Send mail (mailto) to emails on users (if provided)
        const subject = `Tasks – Comment: ${todo.title || ""}`.trim();
        const body = `Task: ${todo.title || ""}\nKategori: ${todo.category || ""}\nAnsvarig: ${todo.assignee || ""}\n\nMeddelande:\n${message}\n\nTid: ${new Date(entry.at).toLocaleString("sv-SE")}\n`;
        sendCommentMail(to, subject, body);

        form.style.display = "none";
        renderList();
      });

      actions.appendChild(cancel);
      actions.appendChild(save);

      form.appendChild(el("div", { class: "label" }, ["Mottagare (initialer)"]));
      form.appendChild(pickWrap);
      form.appendChild(el("div", { class: "label", style: "margin-top:10px;" }, ["Meddelande"]));
      form.appendChild(msg);
      form.appendChild(actions);
    }

    header.querySelector("button.btn.btn-primary").addEventListener("click", () => openForm());

    wrap.appendChild(header);
    wrap.appendChild(list);
    wrap.appendChild(form);

    renderList();

    openModal({ title: "Comment", sub: todo.title ? todo.title : "", bodyNode: wrap });
  }

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

      // assignee
      const sel = el("select", {
        class: "input",
        onchange: (e) => { t.assignee = e.target.value; saveState(state); render(state); },
      }, assignees.map((a) => {
        const opt = el("option", { value: a }, [a]);
        if ((t.assignee || "Alla") === a) opt.selected = true;
        return opt;
      }));
      if (t.category === "Privat") {
        sel.value = myInit || "Alla";
        sel.disabled = true;
      }
      tr.appendChild(el("td", {}, [sel]));

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

      // notes button (green if has content)
      const hasNotes = !!(t.notes && t.notes.trim().length);
      const notesBtn = el("button", {
        type: "button",
        class: `pill pill-notes ${hasNotes ? "is-notes" : ""}`,
        title: "Notes",
        onclick: () => openTodoNotesModal(state, t, user),
      }, ["Notes"]);
      tr.appendChild(el("td", {}, [notesBtn]));


      // comment (icon) – före soptunnan
      const commentCount = Array.isArray(t.comments) ? t.comments.length : 0;
      const commentBtn = el("button", {
        type: "button",
        class: "icon-btn",
        title: commentCount ? `Comment (${commentCount})` : "Comment",
        onclick: () => openTodoCommentModal(state, t, user),
        style: "width:40px;height:40px;border-radius:999px;display:flex;align-items:center;justify-content:center;",
      }, ["💬"]);
      tr.appendChild(el("td", {}, [commentBtn]));

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
  // Tabs + Hero
  // -------------------------------
  function renderTabs(state) {
    const tabs = document.getElementById("tabs");
    tabs.innerHTML = "";

    const mkTab = (key, label) =>
      el("button", {
        class: `tab ${state.activeTab === key ? "is-active" : ""}`,
        type: "button",
        onclick: () => { state.activeTab = key; saveState(state); render(state); },
      }, [label]);

    tabs.appendChild(mkTab(Tabs.DEV, "Utveckling"));
    tabs.appendChild(mkTab(Tabs.PRODUCT, "Produkt"));
    tabs.appendChild(mkTab(Tabs.TODO, "ToDo"));
  }

  function renderHero(state, user) {
    const heroTitle = document.getElementById("heroTitle");
    const heroInline = document.getElementById("heroInline");
    const heroActions = document.getElementById("heroActions");
    heroInline.innerHTML = "";
    heroActions.innerHTML = "";

    if (state.activeTab === Tabs.DEV) {
      heroTitle.textContent = "Utveckling";

      // Admin: inga knappar här (admin hanterar struktur i admin-vyn)
      if (user?.role === "admin") return;

      // User: skapa rader i utvecklingstabellen
      heroActions.appendChild(el("button", {
        class: "btn btn-primary",
        type: "button",
        onclick: () => openNewDevEntryForm(state),
      }, ["Ny utveckling"]));

      return;
    }

    if (state.activeTab === Tabs.PRODUCT) {
      heroTitle.textContent = "Produkt";

      // User: skapa rader i produkttabellen
      if (user?.role !== "admin") {
        heroActions.appendChild(el("button", {
          class: "btn btn-primary",
          type: "button",
          onclick: () => {
            state.productRows = state.productRows || [];
            state.productRows.push(defaultRowForProduct("")); 
            saveState(state);
            render(state);
          },
        }, ["Ny produkt"]));
      }

      return;
    }

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

    // Veckoväljare (ISO)
    const weekIn = el("input", { class: "input up-select", type: "week", style: "max-width:150px;" });
    weekIn.value = state.todo.selectedWeek || isoWeekKey(new Date());
    state.todo.selectedWeek = weekIn.value;

    const range = weekRangeFromKey(weekIn.value);
    const weekHint = el("div", { style: "font-size:12px;color:#6b7280;min-width:190px;align-self:center;" }, [
      range ? `${fmtDateSv(range.start)} – ${fmtDateSv(range.end)}` : ""
    ]);

    weekIn.addEventListener("change", () => {
      state.todo.selectedWeek = weekIn.value;
      saveState(state);
      render(state);
    });

    heroInline.appendChild(weekIn);
    heroInline.appendChild(weekHint);


    heroActions.appendChild(el("button", {
      class: "btn btn-primary",
      type: "button",
      onclick: () => openNewTodoForm(state, user),
    }, ["Ny task"]));
  }

  // -------------------------------
  // Render
  // -------------------------------
  function render(state) {
    const user = currentUser();
    renderTabs(state);
    renderHero(state, user);

    if (state.activeTab === Tabs.DEV) {
      if (user?.role === "admin") renderDevAdminView(state);
      else renderDevTable(state);
    } else if (state.activeTab === Tabs.PRODUCT) {
      if (user?.role === "admin") renderProductAdminView(state);
      else renderProductTable(state);
    } else {
      renderTodoTable(state, user);
    }
  }

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

  document.addEventListener("DOMContentLoaded", init);
})();
})();
