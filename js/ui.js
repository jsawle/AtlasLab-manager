// Small DOM helpers shared by both pages. No innerHTML with anything that came from outside.
export function h(tag, attrs, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === "class") el.className = v;
    else if (k === "text") el.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2), v);
    else if (k in el && typeof v !== "string") el[k] = v;
    else el.setAttribute(k, v === true ? "" : v);
  }
  for (const c of children.flat()) if (c != null && c !== false) el.append(c.nodeType ? c : document.createTextNode(String(c)));
  return el;
}
let uid = 0;
export const nextId = (p) => (p || "f") + "-" + (++uid);

// A message for everyone, read out by screen readers.
export function say(text, kind = "info") {
  const box = document.getElementById("status");
  if (!box) return;
  box.className = "status " + kind;
  box.textContent = text;
  box.hidden = !text;
}

// A modal dialog built on <dialog>: resolves with the button value pressed, or "" for Cancel / Escape.
export function ask({ title, body, ok = "OK", cancel = "Cancel", danger = false }) {
  return new Promise((resolve) => {
    const d = h("dialog", { class: "dlg", "aria-labelledby": "dlg-title" },
      h("h2", { id: "dlg-title", text: title }),
      h("div", { class: "dlg-body" }, body),
      h("form", { method: "dialog", class: "dlg-buttons" },
        cancel ? h("button", { value: "", class: "btn" }, cancel) : null,
        h("button", { value: "ok", class: "btn " + (danger ? "danger" : "primary") }, ok)));
    document.body.append(d);
    d.addEventListener("close", () => { const v = d.returnValue; d.remove(); resolve(v === "ok" ? "ok" : ""); });
    d.showModal();
  });
}

export function download(name, text, type = "application/json") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h("a", { href: url, download: name });
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function readFileText(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsText(file); });
}
export function readFileDataUrl(file) {
  return new Promise((resolve, reject) => { const r = new FileReader(); r.onload = () => resolve(String(r.result)); r.onerror = () => reject(r.error); r.readAsDataURL(file); });
}
export const fmtDate = (ms) => (ms ? new Date(ms).toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "");
export const fmtNum = (n) => (Number.isFinite(n) ? n.toLocaleString() : "–");

export async function fetchJson(url, init) {
  const r = await fetch(url, init);
  if (!r.ok) throw new Error("HTTP " + r.status);
  return r.json();
}
