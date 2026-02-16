"use strict";

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
    
      .notes-in-field-wrap{ position:relative; display:inline-block; width:100%; }
      .notes-in-field-wrap input.input{ padding-right: 38px !important; }
      .notes-in-field-wrap .comment-icon{
        position:absolute; right:8px; top:50%; transform:translateY(-50%);
        border:none; background: transparent; padding:0; width:26px; height:26px;
        display:flex; align-items:center; justify-content:center; cursor:pointer;
      }
`;
    const style = document.createElement("style");
    style.textContent = css;
    document.head.appendChild(style);
  }

window.USP = window.USP || {};
window.USP.Dom = window.USP.Dom || {};
window.USP.Dom.el = el;
window.USP.Dom.injectExtraCss = injectExtraCss;
