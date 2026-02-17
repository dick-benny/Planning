/* app_06_schema_70.js
   Central schema rules:
   - Field.name is the key (no separate 'key' property)
   - Admin defines: name + type (order handled internally)
   - Includes migration helpers from legacy {key} to {name}
*/
(function () {
  "use strict";

  window.USP = window.USP || {};
  window.USP.App = window.USP.App || {};
  const App = window.USP.App;

  App.Schema = App.Schema || {};

  function clone(x) {
    try { return JSON.parse(JSON.stringify(x)); } catch (e) { return x; }
  }

  function normStr(s) { return String(s || "").trim(); }

  App.Schema.fieldKey = function fieldKey(field) {
    return normStr(field && field.name);
  };

  App.Schema.normalizeSchema = function normalizeSchema(schema) {
    const next = clone(schema || { fields: [] });
    next.fields = Array.isArray(next.fields) ? next.fields : [];
    next.fields = next.fields
      .map((f, idx) => {
        const o = Object.assign({}, f || {});
        // Legacy: migrate key->name if name missing
        if (!o.name && o.key) o.name = o.key;
        delete o.key; // enforce: no key property
        o.name = normStr(o.name) || ("Fält " + (idx + 1));
        o.type = normStr(o.type) || "text";
        o.order = Number.isFinite(o.order) ? o.order : idx;
        if (!o.id) o.id = "f_" + Date.now() + "_" + idx;
        return o;
      })
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    // Reassign orders sequentially
    next.fields.forEach((f, i) => { f.order = i; });

    return next;
  };

  App.Schema.validateSchema = function validateSchema(schema) {
    const s = App.Schema.normalizeSchema(schema);
    const seen = Object.create(null);
    const errs = [];

    s.fields.forEach((f) => {
      const k = normStr(f.name);
      if (!k) errs.push("Tomt namn på fält.");
      const low = k.toLowerCase();
      if (seen[low]) errs.push("Dubbelt fältnamn: " + k);
      seen[low] = true;
    });

    return { ok: errs.length === 0, errors: errs, schema: s };
  };

  App.Schema.migrateRowFields = function migrateRowFields(fieldsObj, schema) {
    const out = Object.assign({}, fieldsObj || {});
    const s = App.Schema.normalizeSchema(schema);

    // If legacy keys exist (f.key), move values to f.name
    // We detect legacy by looking for any field that has a legacy key in schema snapshot.
    // Here we assume caller passes the legacy schema if needed.
    s.fields.forEach((f) => {
      const nameKey = normStr(f.name);
      // no legacy key kept after normalize; caller must have already mapped if needed.
      if (!Object.prototype.hasOwnProperty.call(out, nameKey)) {
        // nothing to do
      }
    });

    return out;
  };

  App.Schema.migrateState = function migrateState(state) {
    const st = clone(state || {});
    st.schemas = st.schemas || {};
    st.data = st.data || {};

    // For each tab schema: migrate legacy field.key -> field.name, and row.fields accordingly
    Object.keys(st.schemas).forEach((tabKey) => {
      const legacy = st.schemas[tabKey] || { fields: [] };

      // build mapping legacyKey -> name
      const mapping = {};
      (legacy.fields || []).forEach((f) => {
        const name = normStr(f && (f.name || f.key));
        const key = normStr(f && f.key);
        if (key && name && key !== name) mapping[key] = name;
      });

      // normalize schema (removes key)
      const normalized = App.Schema.normalizeSchema(legacy);
      st.schemas[tabKey] = normalized;

      // migrate rows
      const rows = Array.isArray(st.data[tabKey]) ? st.data[tabKey] : [];
      rows.forEach((row) => {
        if (!row || typeof row !== "object") return;
        row.fields = row.fields || {};
        // Move legacy key values to name keys
        Object.keys(mapping).forEach((oldKey) => {
          if (Object.prototype.hasOwnProperty.call(row.fields, oldKey) &&
              !Object.prototype.hasOwnProperty.call(row.fields, mapping[oldKey])) {
            row.fields[mapping[oldKey]] = row.fields[oldKey];
          }
          if (Object.prototype.hasOwnProperty.call(row.fields, oldKey)) delete row.fields[oldKey];
        });
      });
      st.data[tabKey] = rows;
    });

    return st;
  };
})();


// === VERSION 93 ===
// Fixed schema override for Rutiner (Admin-controlled, fixed columns)

(function(){
  const FIXED_RUTIN_SCHEMA = [
    { key: "Rutin", type: "text", notes: true },
    { key: "Steg1", type: "text", notes: true },
    { key: "Steg2", type: "text", notes: true },
    { key: "Steg3", type: "text", notes: true },
    { key: "Steg4", type: "text", notes: true },
    { key: "Steg5", type: "text", notes: true }
  ];

  if (window.APP_SCHEMA) {
    window.APP_SCHEMA["Rutiner"] = FIXED_RUTIN_SCHEMA;
  }
})();

