/* =========================================================
   USP APP - UI Helpers (v29)
   - Pure presentation helpers that should NOT live in bootstrap
   ========================================================= */
(function () {
  "use strict";

  window.USP = window.USP || {};
  window.USP.UI = window.USP.UI || {};
  window.USP.UI.Helpers = window.USP.UI.Helpers || {};

  // Swedish-ish date formatting fallback (expects Date or ISO string)
  window.USP.UI.Helpers.fmtDateSv = function (d) {
    try {
      if (!d) return "";
      const dt = (d instanceof Date) ? d : new Date(d);
      if (Number.isNaN(dt.getTime())) return String(d);
      const y = dt.getFullYear();
      const m = String(dt.getMonth() + 1).padStart(2, "0");
      const day = String(dt.getDate()).padStart(2, "0");
      return `${y}-${m}-${day}`;
    } catch (e) {
      return String(d ?? "");
    }
  };

  // showPicker helper (for date inputs)
  window.USP.UI.Helpers.showPicker = function (inputEl) {
    if (!inputEl) return;
    if (typeof inputEl.showPicker === "function") inputEl.showPicker();
    else { try { inputEl.focus(); inputEl.click(); } catch (e) {} }
  };


  // Bind interactions for initials ring/button.
  // ctx expects:
  //   onInitialsClick()  -> open picker
  //   onNotesClick()     -> open notes (optional)
  //   mods: { initials, notes, notesOnInitialsRightClick }
  window.USP.UI.Helpers.bindInitials = function (el, ctx) {
    if (!el || !ctx) return;
    try {
      el.dataset.uspInitials = "1";
    } catch (e) {}

    const mods = (ctx && ctx.mods) ? ctx.mods : {};
    const allowRightNotes = !!(
      mods.notesOnInitialsRightClick ||
      (mods.initials && mods.notes && mods.notesOnInitialsRightClick !== false) ||
      (typeof ctx.onNotesClick === "function")
    );

    // Expose for any global guards
    try {
      el.__uspNotesClick = (typeof ctx.onNotesClick === "function") ? function(ev){ return ctx.onNotesClick(ev); } : null;
      el.__uspNotesAllow = allowRightNotes;
    } catch (e) {}

    // Left click -> initials picker
    el.addEventListener("click", function (e) {
      try { e.preventDefault(); e.stopPropagation(); } catch (e2) {}
      if (typeof ctx.onInitialsClick === "function") ctx.onInitialsClick(e);
    });

    function openNotesFromRightClick(e) {
      try { if (e) { e.preventDefault(); e.stopPropagation(); } } catch (e2) {}
      if (!allowRightNotes) return;
      if (typeof ctx.onNotesClick === "function") ctx.onNotesClick(e);
    }

    // Prefer oncontextmenu to reliably suppress browser menu
    el.oncontextmenu = function (e) {
      openNotesFromRightClick(e);
      return false;
    };

    // Avoid opening Notes on right-button down:
    // opening on pointerdown/mousedown can leave the browser in a native right-click state,
    // so Cancel/Save in the Notes modal requires two clicks.
    // Use contextmenu as the primary path. Keep a conservative fallback on mouseup only.
    el.addEventListener("mouseup", function (e) {
      try {
        if (!e || e.button !== 2) return;
        // If contextmenu already handled it, do nothing.
        if (e.defaultPrevented) return;
        openNotesFromRightClick(e);
      } catch (e2) {}
    });
  };

  // Bind interactions for notes icon/button.
  // ctx expects onNotesClick()
  window.USP.UI.Helpers.bindNotes = function (el, ctx) {
    if (!el || !ctx) return;

    // Expose for guards (optional)
    try { el.__uspNotesClick = (typeof ctx.onNotesClick === "function") ? function(ev){ return ctx.onNotesClick(ev); } : null; } catch (e) {}

    function open(e) {
      try { if (e) { e.preventDefault(); e.stopPropagation(); } } catch (e2) {}
      if (typeof ctx.onNotesClick === "function") ctx.onNotesClick(e);
    }

    el.addEventListener("click", open);
    el.oncontextmenu = function (e) { open(e); return false; };
    el.addEventListener("mouseup", function (e) {
      try { if (!e || e.button !== 2 || e.defaultPrevented) return; open(e); } catch (e2) {}
    });
  };
})();
