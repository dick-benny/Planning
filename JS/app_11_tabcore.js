(function(){
  // TabCore: one place to control hero/actions + mounting of FixedTables TableUI.
  // Keep ES5-safe (no const/let/arrow).
  if (!window.USP) window.USP = {};
  if (!window.USP.UI) window.USP.UI = {};

  function el(tag, attrs, children){
    if (typeof window.el === "function") return window.el(tag, attrs, children);
    if (window.USP && window.USP.App && window.USP.App.DOM && typeof window.USP.App.DOM.el === "function") return window.USP.App.DOM.el(tag, attrs, children);
    if (window.App && window.App.DOM && typeof window.App.DOM.el === "function") return window.App.DOM.el(tag, attrs, children);
    // ultra-min fallback
    var node = document.createElement(tag);
    attrs = attrs || {};
    for (var k in attrs){
      if (!attrs.hasOwnProperty(k)) continue;
      if (k === "class") node.className = attrs[k];
      else if (k === "style") node.setAttribute("style", attrs[k]);
      else if (k.indexOf("on") === 0 && typeof attrs[k] === "function") node[k.toLowerCase()] = attrs[k];
      else node.setAttribute(k, attrs[k]);
    }
    children = children || [];
    for (var i=0;i<children.length;i++){
      var c = children[i];
      if (c == null) continue;
      if (typeof c === "string" || typeof c === "number") node.appendChild(document.createTextNode(String(c)));
      else node.appendChild(c);
    }
    return node;
  }

  function byId(id){
    if (typeof window.byId === "function") return window.byId(id);
    return document.getElementById(id);
  }
  function setHtml(node, html){
    if (!node) return;
    if (typeof window.setHtml === "function") return window.setHtml(node, html);
    node.innerHTML = html;
  }

  function btnClass(kind){
    if (kind === "primary") return "btn btn-primary";
    if (kind === "secondary") return "btn btn-secondary";
    return "btn";
  }

  function hero(title, subtitle, actionsNodes){
    return el("div", { "class":"hero" }, [
      el("div", {}, [
        el("div", { "style":"font-weight:1000;font-size:20px;letter-spacing:.2px;" }, [title]),
        subtitle ? el("div", { "class":"hint" }, [subtitle]) : el("div", { "class":"hint" }, [""])
      ]),
      el("div", { "class":"hero-actions" }, actionsNodes || [])
    ]);
  }

  function dispatchNewRow(tabKey){
    try{
      var st = (window.USP && window.USP.App && typeof window.USP.App.getState === "function") ? window.USP.App.getState() : null;
      if (window.USP && window.USP.UI && typeof window.USP.UI.dispatchTabAction === "function") {
        var handled = window.USP.UI.dispatchTabAction(tabKey, "new_row", st);
        if (handled) return true;
      }
    }catch(e){}
    try{
      if (typeof window.openRowModal === "function") {
        window.openRowModal(tabKey);
        return true;
      }
    }catch(e2){}
    return false;
  }

  function dispatchArchive(tabKey, title){
    try{
      var st = (window.USP && window.USP.App && typeof window.USP.App.getState === "function") ? window.USP.App.getState() : null;
      if (typeof window.openArchiveModal === "function") {
        window.openArchiveModal(st, tabKey, title);
        return true;
      }
    }catch(e){}
    return false;
  }

  function renderTab(state, tabKey, title, opts){
    var view = byId("usp-view");
    if (!view) return;

    if (!(opts && opts.append)) setHtml(view, "");

    // actions
    var actions = [];

    // R12: Routines - only admin can create new rows
    var App = (window.USP && window.USP.App) ? window.USP.App : (window.App || null);
    var role = "";
    try{ role = (App && typeof App.role === "function") ? String(App.role(state) || "") : ""; }catch(eR){ role = ""; }
    var isRoutines = false;
    try{
      var rk = (App && App.Tabs && App.Tabs.ROUTINES) ? App.Tabs.ROUTINES : "routines";
      isRoutines = (String(tabKey||"") === String(rk)) || (String(tabKey||"").toLowerCase() === "routines");
    }catch(eRT){ isRoutines = (String(tabKey||"").toLowerCase() === "routines"); }

    if (!(isRoutines && String(role||"").toLowerCase() !== "admin")) {
      actions.push(el("button", { "class": btnClass("primary"), type:"button", onclick: function(){ dispatchNewRow(tabKey); } }, ["+ Ny rad"]));
    }
    actions.push(el("button", { "class": btnClass("secondary"), type:"button", onclick: function(){ dispatchArchive(tabKey, title); } }, ["Arkiv"]));

    view.appendChild(hero(title, "", actions));

    // DEV: two AND-filters (Kategori + Syfte) under title
    try{
      var tkey = String(tabKey||"").toLowerCase();
      if (tkey === "dev" || (App && App.Tabs && tabKey === App.Tabs.DEV)) {
        var st0 = (App && typeof App.getState === "function") ? App.getState() : state;
        var sess0 = (st0 && st0.session) ? st0.session : {};
        var fk0 = String(sess0.devFilterKategori || "Alla");
        var fs0 = String(sess0.devFilterSyfte || "Alla");

        function uniqAdd(arr, v){
          v = String(v||"");
          if (!v) return;
          for (var i=0;i<arr.length;i++){ if (String(arr[i])===v) return; }
          arr.push(v);
        }

        // Kategori options: prefer registry, else derive from existing rows
        var katOpts = ["Alla"];
        try{
          var reg = null;
          if (App && App.Config && typeof App.Config.getRegistry === "function") {
            reg = App.Config.getRegistry("dropdown_dev_kategori");
            if (!reg || !reg.length) reg = App.Config.getRegistry("devkategori");
          }
          if (reg && reg.length) {
            for (var i1=0;i1<reg.length;i1++) uniqAdd(katOpts, reg[i1]);
          } else if (App && typeof App.listRows === "function") {
            var rs = App.listRows(tabKey, st0) || [];
            for (var r=0;r<rs.length;r++){
              if (rs[r] && rs[r].archived) continue;
              var v = (rs[r].fields||{})["Kategori"];
              uniqAdd(katOpts, v);
            }
          }
        }catch(eKO){}

        var syfteOpts = ["Alla","kund","samarbete","design"];

        var selKat = el("select", { onchange: function(ev){
          try{
            var next = (App && typeof App.getState === "function") ? App.getState() : (state||{});
            next.session = next.session || {};
            next.session.devFilterKategori = String((ev && ev.target && ev.target.value) || "Alla");
            if (App && typeof App.commitState === "function") App.commitState(next);
          }catch(eC){}
        }}, (katOpts||[]).map(function(v){
          return el("option", { value: v }, [v]);
        }));
        try{ selKat.value = String(fk0||"Alla"); }catch(eV1){} 

        var selSyfte = el("select", { onchange: function(ev){
          try{
            var next = (App && typeof App.getState === "function") ? App.getState() : (state||{});
            next.session = next.session || {};
            next.session.devFilterSyfte = String((ev && ev.target && ev.target.value) || "Alla");
            if (App && typeof App.commitState === "function") App.commitState(next);
          }catch(eC2){}
        }}, (syfteOpts||[]).map(function(v){
          return el("option", { value: v }, [v]);
        }));
        try{ selSyfte.value = String(fs0||"Alla"); }catch(eV2){} 

        var filterRow = el("div", { style:"display:flex;align-items:center;gap:14px;margin:8px 0 14px 0;flex-wrap:wrap;" }, [
          el("div", { style:"display:flex;align-items:center;gap:8px;" }, [
            el("div", { "class":"muted", style:"font-weight:600;" }, ["Kategori:"]),
            selKat
          ]),
          el("div", { style:"display:flex;align-items:center;gap:8px;" }, [
            el("div", { "class":"muted", style:"font-weight:600;" }, ["Syfte:"]),
            selSyfte
          ])
        ]);
        view.appendChild(filterRow);
      }
    }catch(eDevUI){}

    // render table
    var TableUI = (window.USP && window.USP.UI && window.USP.UI.TableUI) ? window.USP.UI.TableUI : null;
    if (!TableUI || typeof TableUI.renderFixedTable !== "function") {
      view.appendChild(el("div", { "class":"hint" }, ["TableUI saknas (USP.UI.TableUI.renderFixedTable). Kontrollera att app_10_table_ui.js är inkluderad före app_11_tabcore och app_04_ui."]));
      try{ console.warn("[TabCore] TableUI missing. USP.UI keys=", window.USP && window.USP.UI ? Object.keys(window.USP.UI) : null); }catch(eK){}
      return;
    }

    var node = null;
    try { 
      node = TableUI.renderFixedTable(state, tabKey, title);
    } catch(eT) { 
      node = null;
      try{ console.error("[TabCore] renderFixedTable threw", eT); }catch(eE){}
    }
    if (node) view.appendChild(node);
    else {
      view.appendChild(el("div", { "class":"hint" }, ["Tabellen kunde inte renderas (renderFixedTable gav null/throw). Se console för detaljer."]));
    }

    // debug
    try{
      if (window.__uspTableDebug) {
        var App = window.USP && window.USP.App ? window.USP.App : (window.App || null);
        var spec = (App && typeof App.getFixedTableSpec === "function") ? App.getFixedTableSpec(tabKey) : null;
        var schema = (App && typeof App.getSchema === "function") ? App.getSchema(tabKey, state) : null;
        window.__uspLastTableSpec = spec;
        window.__uspLastTableSchema = schema;
        console.log("[TabCore debug] tab=", tabKey, "spec.version=", spec && spec.version);
        if (spec && spec.columns) {
          try { console.table(spec.columns.map(function(c){ return {name:c.name,type:c.type,mods:JSON.stringify(c.mods||{})}; })); } catch(e1){}
        }
        if (schema && schema.fields) {
          try { console.table(schema.fields.map(function(f){ return {name:f.name,type:f.type,mods:JSON.stringify(f.mods||{})}; })); } catch(e2){}
        }
      }
    }catch(eDbg){}
  }

  try{ console.log("[TabCore] boot ok. UI keys now=", window.USP && window.USP.UI ? Object.keys(window.USP.UI) : null); }catch(eB){}

  window.USP.UI.TabCore = {
    renderTab: renderTab
  };
})();
