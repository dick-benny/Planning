/* =========================================================
   USP APP - UI Helpers (v28)
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
})();
