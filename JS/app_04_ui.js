/* app_04_ui_76.js
   USP UI (design-restored via style.css classes)
   - Keeps v60+ deterministic router: tab + role -> view
   - Uses existing CSS classes (.topbar, .tabs, .hero, .table-wrap, etc.)
   - Adds menu: Change user (always available) + Settings + Manage users (admin)
*/
(function () {
  "use strict";

  window.USP = window.USP || {};
  const USP = window.USP;
  const UI = (USP.UI = USP.UI || {});

  // ---------------------------
  // Settings popover (compact)
  // ---------------------------
  let _settingsOpen = false;

  function closeSettingsPopover() {
    _settingsOpen = false;
    const elp = document.getElementById("usp-settings-popover");
    if (elp && elp.parentNode) elp.parentNode.removeChild(elp);
    document.removeEventListener("mousedown", onDocMouseDown, true);
    document.removeEventListener("keydown", onDocKeyDown, true);
  }

  function onDocKeyDown(e) {
    if (e && e.key === "Escape") closeSettingsPopover();
  }

  function onDocMouseDown(e) {
    const pop = document.getElementById("usp-settings-popover");
    const btn = document.getElementById("usp-settings-btn");
    if (!pop) return;
    const t = e && e.target ? e.target : null;
    if (t && (pop.contains(t) || (btn && btn.contains(t)))) return;
    closeSettingsPopover();
  }

  function toggleSettingsPopover(state) {
    if (_settingsOpen) { closeSettingsPopover(); return; }
    _settingsOpen = true;
    renderSettingsPopover(state || App.getState());
    document.addEventListener("mousedown", onDocMouseDown, true);
    document.addEventListener("keydown", onDocKeyDown, true);
  }

  function renderSettingsPopover(state) {
    const old = document.getElementById("usp-settings-popover");
    if (old && old.parentNode) old.parentNode.removeChild(old);

    const role = App.role(state);
    const acting = (App.getActingUser ? App.getActingUser(state) : state.user) || null;
    const who = (acting && (acting.name || acting.email)) ? (acting.name || acting.email) : "User";

    const pop = el("div", {
      id:"usp-settings-popover",
      class:"menu",
      style:"position:fixed;top:72px;right:24px;min-width:300px;max-width:420px;padding:14px;border-radius:14px;box-shadow:0 12px 40px rgba(0,0,0,.12);z-index:9999;background:#fff;"
    }, []);

    pop.appendChild(el("div", { class:"label", style:"margin-bottom:6px;" }, ["Settings"]));
    pop.appendChild(el("div", { class:"hint", style:"margin-bottom:12px;" }, [who + " • " + role]));

    const row = el("div", { style:"display:flex;gap:10px;flex-wrap:wrap;justify-content:flex-end;" }, []);
    if (role === "admin") {
      row.appendChild(el("button", { class:"btn btn-secondary", type:"button", onclick: () => { closeSettingsPopover(); openManageUsers(App.getState()); } }, ["Manage users"]));
    }
    row.appendChild(el("button", { class:"btn btn-secondary", type:"button", onclick: () => { closeSettingsPopover(); if (App.toggleUser) App.toggleUser(); } }, ["Change user (Dick ↔ Benny)"]));
    pop.appendChild(row);

    document.body.appendChild(pop);
  }
  const App = USP.App;

  // ---------------------------
  // DOM helpers
  // ---------------------------
  function el(tag, attrs, children) {
    const n = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach((k) => {
        const v = attrs[k];
        if (k === "class") n.className = v;
        else if (k === "html") n.innerHTML = v;
        else if (k === "style") n.setAttribute("style", v);
        else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2), v);
        else if (v !== undefined && v !== null) n.setAttribute(k, v);
      });
    }
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      if (typeof c === "string") n.appendChild(document.createTextNode(c));
      else n.appendChild(c);
    });
    return n;
  }

  function byId(id) { return document.getElementById(id); }
  function setHtml(node, html) { node.innerHTML = html || ""; }

  function ensureRoot() {
    let root = byId("app");
    if (!root) {
      root = el("div", { id: "app" }, []);
      document.body.appendChild(root);
    }
    return root;
  }

  // ---------------------------
  // Base layout (design)
  // ---------------------------
  UI.mountBase = function mountBase() {
    const root = ensureRoot();
    if (byId("usp-topbar") && byId("usp-view")) return;

    setHtml(root, "");

    const topbar = el("div", { id: "usp-topbar", class: "topbar" }, []);
    const viewWrap = el("div", { class: "table-wrap" }, [
      el("div", { id: "usp-view" }, []),
    ]);

    root.appendChild(topbar);
    root.appendChild(viewWrap);
  };

  // ---------------------------
  // Topbar with tabs + user menu
  // ---------------------------
  function tabLabel(key) {
    if (key === App.Tabs.DEV) return "UTVECKLING";
    if (key === App.Tabs.PRODUCT) return "SÄLJ";
    if (key === App.Tabs.TODO) return "TODO";
    if (key === App.Tabs.ROUTINES) return "RUTINER";
    return String(key || "").toUpperCase();
  }

  function renderTopbar(state) {
    const bar = byId("usp-topbar");
    if (!bar) return;
    setHtml(bar, "");

    const left = el("div", { class: "brand" }, [
      el("div", { class: "logo" }, ["U"]),
      el("div", {}, [
        el("div", { class: "brand-title" }, ["USP"]),
        el("div", { class: "brand-sub" }, ["backend redo"]),
      ]),
    ]);

    const tabs = el("div", { class: "tabs", id: "tabs" }, []);
    const current = App.getTab(state);
    [App.Tabs.DEV, App.Tabs.PRODUCT, App.Tabs.TODO, App.Tabs.ROUTINES].forEach((k) => {
      tabs.appendChild(el("button", {
        class: "tab " + (current === k ? "is-active" : ""),
        type: "button",
        onclick: () => App.setTab(k),
      }, [tabLabel(k)]));
    });

    const actions = el("div", { class: "top-actions" }, []);
    const acting = (App.getActingUser ? App.getActingUser(state) : state.user) || null;
    const role = App.role(state);

    // Single stable Settings button
    actions.appendChild(el("button", {
      id:"usp-settings-btn",
      class: "btn btn-secondary",
      type:"button",
      onclick: () => toggleSettingsPopover(state)
    }, ["Settings"]));

    // Small status label (not a menu)
    actions.appendChild(el("div", { class:"hint", style:"margin-left:10px;white-space:nowrap;" }, [
      (acting && (acting.name || acting.email) ? (acting.name || acting.email) : "User"),
      "  ",
      role
    ]));

    bar.appendChild(left);
    bar.appendChild(tabs);
    bar.appendChild(actions);
  }

  function hideMenu() { /* removed */ }
 {
    const m = byId("usp-menu");
    if (m) m.classList.add("hidden");
  }

  // ---------------------------
  // View helpers
  // ---------------------------
  function hero(title, subtitle, actionsNodes) {
    return el("div", { class: "hero" }, [
      el("div", {}, [
        el("div", { style: "font-weight:1000;font-size:20px;letter-spacing:.2px;" }, [title]),
        subtitle ? el("div", { class: "hint", style:"margin-top:4px;" }, [subtitle]) : null,
      ]),
      el("div", { class: "hero-actions" }, actionsNodes || []),
    ]);
  }

  function sortFields(fields) {
    const arr = Array.isArray(fields) ? fields.slice() : [];
    arr.sort((a,b)=> (a?.order ?? 0) - (b?.order ?? 0));
    return arr;
  }

  function inputClass() { return "input"; }
  function btnClass(kind) {
    if (kind === "primary") return "btn btn-primary";
    if (kind === "secondary") return "btn btn-secondary";
    return "btn";
  }

  // ---------------------------
  // Admin view: schema definitions
  // ---------------------------
  function adminSchemaView(state, tabKey, title) {
    const view = byId("usp-view");
    if (!view) return;
    setHtml(view, "");

    const schema = App.getSchema(tabKey, state);
    schema.fields = Array.isArray(schema.fields) ? schema.fields : [];

    view.appendChild(hero(
      "ADMIN: " + title,
      "Definiera kolumner/fält (admin ändrar inte data).",
      [
        el("button", { class: btnClass("primary"), type:"button", onclick: () => {
          const next = sortFields(schema.fields);
          next.push({ id: "f_" + Date.now(), name: "Nytt fält", key: "field_" + (next.length+1), type: "text", order: next.length });
          schema.fields = next;
          App.setSchema(tabKey, schema);
        }}, ["+ Lägg till fält"]),
      ]
    ));

    const table = el("table", { class:"table" }, []);
    table.appendChild(el("thead", {}, [
      el("tr", {}, [
        el("th", {}, ["Ordning"]),
        el("th", {}, ["Namn"]),
        el("th", {}, ["Typ"]),
        el("th", {}, ["Action"]),
      ])
    ]));
    const tbody = el("tbody", {}, []);
    table.appendChild(tbody);

    view.appendChild(table);

    function rerender() {
      setHtml(tbody, "");
      const fields = sortFields(schema.fields);

      fields.forEach((f, idx) => {
        const tr = el("tr", {}, []);

        tr.appendChild(el("td", {}, [
          el("input", { class: inputClass(), value: String(f.order ?? idx), style:"width:72px;", onchange: (e) => {
            f.order = parseInt(e.target.value, 10) || idx;
            App.setSchema(tabKey, schema);
          }}, [])
        ]));

        tr.appendChild(el("td", {}, [
          el("input", { class: inputClass(), value: String(f.name || ""), onchange: (e)=>{ f.name=e.target.value; App.setSchema(tabKey, schema);} }, [])
        ]));

        tr.appendChild(el("td", {}, [
          el("input", { class: inputClass(), value: String(f.name || ""), onchange: (e)=>{ f.name=e.target.value; App.setSchema(tabKey, schema);} }, [])
        ]));

        tr.appendChild(el("td", {}, [
          el("input", { class: inputClass(), value: String(f.type || "text"), style:"width:120px;", onchange:(e)=>{ f.type=e.target.value; App.setSchema(tabKey, schema);} }, [])
        ]));

        tr.appendChild(el("td", { style:"white-space:nowrap;" }, [
          el("button", { class:"icon-btn", type:"button", onclick: () => {
            const arr = sortFields(schema.fields);
            if (idx <= 0) return;
            const tmp = arr[idx-1]; arr[idx-1]=arr[idx]; arr[idx]=tmp;
            arr.forEach((x,i)=>x.order=i);
            schema.fields = arr;
            App.setSchema(tabKey, schema);
          }}, ["↑"]),
          el("button", { class:"icon-btn", type:"button", onclick: () => {
            const arr = sortFields(schema.fields);
            if (idx >= arr.length-1) return;
            const tmp = arr[idx+1]; arr[idx+1]=arr[idx]; arr[idx]=tmp;
            arr.forEach((x,i)=>x.order=i);
            schema.fields = arr;
            App.setSchema(tabKey, schema);
          }}, ["↓"]),
          el("button", { class:"btn btn-small", type:"button", onclick: () => {
            const ok = window.confirm("Ta bort fältet?");
            if (!ok) return;
            schema.fields = sortFields(schema.fields).filter(x => x !== f);
            schema.fields.forEach((x,i)=>x.order=i);
            App.setSchema(tabKey, schema);
          }}, ["Ta bort"]),
        ]));

        tbody.appendChild(tr);
      });
    }

    rerender();
  }

  // ---------------------------
  // User view: data manipulation
  // ---------------------------
  
  // ---------------------------
  // Archive modal (read-only list + restore)
  // ---------------------------
  function openArchiveModal(state, tabKey, title) {
    const rows = (App.listRows(tabKey, state) || []).filter(r => !!r.archived);
    const schema = App.getSchema(tabKey, state);
    const fields = sortFields(schema.fields || []);
    const fieldNames = fields.map(f => String(f.name || "").trim()).filter(Boolean);

    const modal = el("div", { class:"modal-backdrop" }, [
      el("div", { class:"modal", style:"max-width:920px;" }, [
        el("div", { class:"modal-head" }, [
          el("div", { class:"title" }, [title + " – Arkiv"]),
          el("button", { class:"btn btn-secondary", type:"button", onclick: () => modal.remove() }, ["Stäng"]),
        ]),
        el("div", { class:"modal-body" }, [
          rows.length ? (
            el("div", { class:"table-wrap" }, [
              (function(){
                const table = el("table", { class:"table" }, []);
                table.appendChild(el("thead", {}, [el("tr", {}, [
                  ...fieldNames.map(n => el("th", {}, [n])),
                  el("th", {}, ["Action"]),
                ])]));
                const tb = el("tbody", {}, []);
                rows.forEach((r) => {
                  const tr = el("tr", {}, []);
                  fieldNames.forEach((n) => tr.appendChild(el("td", {}, [String((r.fields && r.fields[n]) ?? "")])));
                  tr.appendChild(el("td", { style:"white-space:nowrap;" }, [
                    el("button", { class:"btn btn-small", type:"button", onclick: () => {
                      const ok = window.confirm("Återställa raden från arkiv?");
                      if (!ok) return;
                      App.unarchiveRow(tabKey, r.id);
                      modal.remove();
                      App.callRender();
                    }}, ["Återställ"])
                  ]));
                  tb.appendChild(tr);
                });
                table.appendChild(tb);
                return table;
              })()
            ])
          ) : el("div", { class:"hint" }, ["Arkivet är tomt."])
        ])
      ])
    ]);
    document.body.appendChild(modal);
  }

  function doneLabel() { return "DONE"; }

  function handleDone(state, tabKey, row) {
    if (!row) return;
    const ok = window.confirm("Markera som DONE?");
    if (!ok) return;

    if (tabKey === App.Tabs.DEV) {
      // DEV DONE: archive in DEV, create a new row in PRODUCT (Sälj)
      App.archiveRow(tabKey, row.id);

      const prodSchema = App.getSchema(App.Tabs.PRODUCT, App.getState());
      const prodFields = sortFields((prodSchema && prodSchema.fields) ? prodSchema.fields : []);
      const devSchema = App.getSchema(App.Tabs.DEV, App.getState());
      const devFields = sortFields((devSchema && devSchema.fields) ? devSchema.fields : []);

      const newRow = { id: "row_" + Date.now(), createdAt: new Date().toISOString(), fields: {} };

      // Copy by matching field names
      const devMap = {};
      devFields.forEach((f) => {
        const n = String(f.name || "").trim();
        if (n) devMap[n.toLowerCase()] = n;
      });

      prodFields.forEach((pf) => {
        const pn = String(pf.name || "").trim();
        if (!pn) return;
        const matchKey = devMap[pn.toLowerCase()];
        if (matchKey && row.fields && Object.prototype.hasOwnProperty.call(row.fields, matchKey)) {
          newRow.fields[pn] = row.fields[matchKey];
        } else {
          newRow.fields[pn] = "";
        }
      });

      // Fallback: put first DEV field into first PRODUCT field if empty
      const devFirst = devFields[0] ? String(devFields[0].name || "").trim() : "";
      const prodFirst = prodFields[0] ? String(prodFields[0].name || "").trim() : "";
      if (devFirst && prodFirst) {
        const v = (row.fields && row.fields[devFirst]) ? String(row.fields[devFirst]) : "";
        if (v && !newRow.fields[prodFirst]) newRow.fields[prodFirst] = v;
      }

      App.upsertRow(App.Tabs.PRODUCT, newRow);
      return;
    }

    if (tabKey === App.Tabs.PRODUCT) {
      // PRODUCT DONE: archive in PRODUCT
      App.archiveRow(tabKey, row.id);
      return;
    }

    if (tabKey === App.Tabs.TODO) {
      // TODO DONE: archive in TODO
      App.archiveRow(tabKey, row.id);
      return;
    }
  }
function userDataView(state, tabKey, title) {
    const view = byId("usp-view");
    if (!view) return;
    setHtml(view, "");

    const schema = App.getSchema(tabKey, state);
    const fields = sortFields(schema.fields || []);
    const isRoutines = (tabKey === App.Tabs.ROUTINES);

    // User works with data; routines are read-only.
    const rowsAll = (App.listRows(tabKey, state) || []);
    const rows = rowsAll.filter(r => !r.archived);

    // Buttons: +Ny rad + Arkiv (DEV/PRODUCT/TODO), no archive/done/actions for routines
    const heroButtons = [];
    if (!isRoutines) {
      heroButtons.push(el("button", { class: btnClass("primary"), type:"button", onclick: () => {
        const base = { id: "row_" + Date.now(), createdAt: new Date().toISOString(), fields: {} };
        fields.forEach(f => { const k = String(f.name || "").trim(); if (k) base.fields[k] = ""; });
        App.upsertRow(tabKey, base);
      }}, ["+ Ny rad"]));

      heroButtons.push(el("button", { class: btnClass("secondary"), type:"button", onclick: () => {
        openArchiveModal(App.getState(), tabKey, title);
      }}, ["Arkiv"]));
    }

    view.appendChild(hero(
      title,
      isRoutines ? "Rutiner är en passiv beskrivning som kan läsas av alla." : "Här jobbar user med data. Admin definierar fälten i samma tab.",
      heroButtons
    ));

    const fieldNames = fields.map(f => String(f.name || "").trim()).filter(Boolean);

    const table = el("table", { class:"table" }, []);
    table.appendChild(el("thead", {}, [
      el("tr", {}, [
        ...fieldNames.map(n => el("th", {}, [n])),
        ...(isRoutines ? [] : [el("th", {}, ["Action"])])
      ])
    ]));

    const tbody = el("tbody", {}, []);
    table.appendChild(tbody);
    view.appendChild(table);

    function rerender() {
      setHtml(tbody, "");
      const freshRows = (App.listRows(tabKey, App.getState()) || []).filter(r => !r.archived);

      freshRows.forEach((r) => {
        const tr = el("tr", {}, []);
        fieldNames.forEach((n) => {
          if (isRoutines) {
            tr.appendChild(el("td", {}, [String((r.fields && r.fields[n]) ?? "")]));
            return;
          }
          tr.appendChild(el("td", {}, [
            el("input", {
              class: inputClass(),
              value: String((r.fields && r.fields[n]) ?? ""),
              oninput: (e) => {
                const st = App.getState();
                const cur = (App.getRow(tabKey, r.id, st) || r);
                const next = { id: cur.id, createdAt: cur.createdAt, updatedAt: new Date().toISOString(), archived: !!cur.archived, fields: Object.assign({}, cur.fields || {}) };
                next.fields[n] = e.target.value;
                App.upsertRow(tabKey, next);
              }
            }, [])
          ]));
        });

        if (!isRoutines) {
          tr.appendChild(el("td", { style:"white-space:nowrap;" }, [
            el("button", { class:"btn btn-small", type:"button", onclick: () => handleDone(App.getState(), tabKey, r) }, [doneLabel()])
          ]));
        }

        tbody.appendChild(tr);
      });
    }

    // re-render after commits
    const prev = window.USP && window.USP.Actions && window.USP.Actions.onAfterCommit;
    if (window.USP && window.USP.Actions) {
      window.USP.Actions.onAfterCommit = function () {
        try { if (typeof prev === "function") prev(); } catch (e) {}
        rerender();
      };
    }

    rerender();
  }


  // ---------------------------
  // Change user (always available)
  // ---------------------------
  function openChangeUser(state) {
    const view = byId("usp-view");
    if (!view) return;
    setHtml(view, "");

    const users = App.listUsers(state);

    const wrap = el("div", { class:"manage-users-wrap" }, []);
    wrap.appendChild(el("div", { class:"manage-users-header" }, [
      el("div", { class:"manage-users-title" }, ["Change user"]),
      el("button", { class:"btn btn-small", type:"button", onclick: () => App.setTab(App.getTab(state)) }, ["Tillbaka"]),
    ]));

    const list = el("div", { class:"manage-users-list" }, []);
    users.forEach((u) => {
      const row = el("div", { class:"manage-user-row" }, [
        el("button", { class:"link-btn manage-user-name", type:"button", onclick: () => {
          App.setCurrentUser(u.id);
        }}, [ (u.name || "User") + (u.email ? " • " + u.email : "") ]),
      ]);
      list.appendChild(row);
    });
    wrap.appendChild(list);

    view.appendChild(wrap);
  }

  // ---------------------------
  // Manage users (admin)
  // ---------------------------
  function openManageUsers(state) {
    const view = byId("usp-view");
    if (!view) return;
    setHtml(view, "");

    const role = App.role(state);
    if (role !== "admin") {
      view.appendChild(hero("Manage users", "Endast admin.", []));
      return;
    }

    const wrap = el("div", { class:"manage-users-wrap" }, []);
    view.appendChild(wrap);

    const header = el("div", { class:"manage-users-header" }, [
      el("div", { class:"manage-users-title" }, ["Manage users"]),
      el("div", { style:"display:flex;gap:10px;align-items:center;" }, [
        el("button", { class:"btn btn-small btn-secondary", type:"button", onclick: () => openChangeUser(App.getState()) }, ["Change user"]),
        el("button", { class:"btn btn-small btn-primary", type:"button", onclick: () => {
          const id = "u_" + Date.now();
          App.addUser({ id, name:"New user", initials:"", email:"", role:"user" });
          openUserEditor(id);
        }}, ["+ Add user"]),
      ])
    ]);
    wrap.appendChild(header);

    const list = el("div", { class:"manage-users-list" }, []);
    wrap.appendChild(list);

    function renderList() {
      setHtml(list, "");
      const users = App.listUsers(App.getState());

      if (!users.length) {
        list.appendChild(el("div", { class:"hint", style:"padding:12px;" }, ["Inga användare ännu. Klicka + Add user."]));
        return;
      }

      users.forEach((u) => {
        const row = el("div", { class:"manage-user-row" }, []);
        const left = el("div", { style:"display:flex;flex-direction:column;gap:2px;" }, [
          el("button", { class:"link-btn manage-user-name", type:"button", onclick: () => openUserEditor(u.id) }, [
            (u.name || "User")
          ]),
          el("div", { class:"hint" }, [
            (u.email ? u.email : "(no email)") + (u.role ? " • " + u.role : "")
          ]),
        ]);
        const right = el("div", { style:"display:flex;gap:8px;align-items:center;" }, [
          el("button", { class:"btn btn-small btn-secondary", type:"button", onclick: () => {
            App.setCurrentUser(u.id);
          }}, ["Act as"]),
          el("button", { class:"icon-btn manage-user-delete", type:"button", onclick: () => {
            const ok = window.confirm("Delete user?");
            if (!ok) return;
            App.deleteUser(u.id);
            renderList();
          }}, ["🗑"]),
        ]);

        row.appendChild(left);
        row.appendChild(right);
        list.appendChild(row);
      });
    }

    function openUserEditor(userId) {
      const st = App.getState();
      const users = App.listUsers(st);
      const user = users.find(x => x && String(x.id) === String(userId));
      if (!user) { window.alert("User not found"); renderList(); return; }

      setHtml(view, "");
      const card = el("div", { class:"manage-users-wrap" }, []);
      view.appendChild(card);

      card.appendChild(el("div", { class:"manage-users-header" }, [
        el("div", { class:"manage-users-title" }, ["Edit user"]),
        el("div", { style:"display:flex;gap:10px;align-items:center;" }, [
          el("button", { class:"btn btn-small btn-secondary", type:"button", onclick: () => openManageUsers(App.getState()) }, ["Tillbaka"]),
          el("button", { class:"btn btn-small btn-secondary", type:"button", onclick: () => { App.setCurrentUser(user.id); } }, ["Act as"]),
        ])
      ]));

      const form = el("div", { class:"form-grid" }, []);

      const idInp = el("input", { class:"input full", value: String(user.id || ""), disabled:"true" }, []);
      const nameInp = el("input", { class:"input full", value: String(user.name || ""), placeholder:"Name" }, []);
      const initialsInp = el("input", { class:"input full", value: String(user.initials || ""), placeholder:"Initials (e.g. DE)" }, []);
      const emailInp = el("input", { class:"input full", value: String(user.email || ""), placeholder:"Email" }, []);
      const passInp = el("input", { class:"input full", value: String(user.password || ""), placeholder:"Password" }, []);

      const roleSel = el("select", { class:"input full" }, [
        el("option", { value:"user" }, ["user"]),
        el("option", { value:"admin" }, ["admin"]),
      ]);
      roleSel.value = user.role === "admin" ? "admin" : "user";

      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["ID (read-only)"]), idInp]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Name"]), nameInp]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Initials"]), initialsInp, el("div", { class:"hint" }, ["Används i TODO/Rutiner (t.ex. ägare/assignee)."])]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Email"]), emailInp]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Password"]), passInp, el("div", { class:"hint" }, ["Lokal demo: sparas i state (ingen hashing ännu)."])]));
      form.appendChild(el("div", { class:"form-field full" }, [el("div", { class:"label" }, ["Role (metadata)"]), roleSel, el("div", { class:"hint" }, ["Roll här är metadata för framtida auth. Adminläge styrs av 'Switch role' i denna lokal-demo."])]));
      card.appendChild(form);

      const actions = el("div", { style:"display:flex;gap:10px;flex-wrap:wrap;margin-top:10px;" }, []);
      const save = el("button", { class:"btn btn-primary", type:"button", onclick: () => {
        App.updateUser(user.id, { name: nameInp.value, initials: initialsInp.value, email: emailInp.value, role: roleSel.value });
        openManageUsers(App.getState());
      }}, ["Save"]);

      const del = el("button", { class:"btn btn-secondary", type:"button", onclick: () => {
        const ok = window.confirm("Delete user?");
        if (!ok) return;
        App.deleteUser(user.id);
        openManageUsers(App.getState());
      }}, ["Delete"]);

      actions.appendChild(save);
      actions.appendChild(del);
      card.appendChild(actions);
    }

    renderList();
  }

  // ---------------------------
  // Settings (layout restored)
  // ---------------------------
  function settingsView(state) {
    const view = byId("usp-view");
    if (!view) return;
    setHtml(view, "");
    view.appendChild(hero("Settings", "Öppna via Settings-knappen uppe till höger.", []));
  }





  UI.render = function render(state) {
    UI.mountBase();
    renderTopbar(state);

    const tab = App.getTab(state);
    const role = App.role(state);
    const roleMode = (App.getRoleMode ? App.getRoleMode(state) : role);

    if (tab === App.Tabs.SETTINGS) return settingsView(state);

    if (role === "admin") {
      if (tab === App.Tabs.DEV) return adminSchemaView(state, App.Tabs.DEV, "Utveckling");
      if (tab === App.Tabs.PRODUCT) return adminSchemaView(state, App.Tabs.PRODUCT, "Sälj");
      if (tab === App.Tabs.TODO) return adminSchemaView(state, App.Tabs.TODO, "ToDo");
      if (tab === App.Tabs.ROUTINES) return adminSchemaView(state, App.Tabs.ROUTINES, "Rutiner");
    }

    if (tab === App.Tabs.DEV) return userDataView(state, App.Tabs.DEV, "Utveckling");
    if (tab === App.Tabs.PRODUCT) return userDataView(state, App.Tabs.PRODUCT, "Sälj");
    if (tab === App.Tabs.TODO) return userDataView(state, App.Tabs.TODO, "ToDo");
    if (tab === App.Tabs.ROUTINES) return userDataView(state, App.Tabs.ROUTINES, "Rutiner");

    return userDataView(state, App.Tabs.TODO, "ToDo");
  };

})();
