// Usage, from ArcGIS Online's own counts only: opens of a partner's app are views of its config item; map views are the
// views of each map in its content group (in any app, not only this partner's). Nothing in AtlasLab counts anything.
import { h, fmtNum, fmtDate } from "./ui.js?v=1.0.0";

const SVGNS = "http://www.w3.org/2000/svg";
const s = (tag, attrs) => { const e = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs || {})) e.setAttribute(k, v); return e; };

// Stat tiles: the numbers that answer "how much is it used?"
export function tiles(list) {
  return h("div", { class: "tiles" }, list.map(([label, value, note]) => h("div", { class: "tile" }, h("p", { class: "tile-label", text: label }), h("p", { class: "tile-value", text: value }), note ? h("p", { class: "hint", text: note }) : null)));
}

// One series over time: a 2 px line, hairline grid, a crosshair and tooltip on hover or arrow keys, and a table view.
export function lineChart(title, rows, { yLabel = "Views" } = {}) {
  const wrap = h("figure", { class: "chart-wrap" });
  const cap = h("figcaption", { text: title });
  if (!rows.length) { wrap.append(cap, h("p", { class: "hint", text: "No views recorded in this period." })); return wrap; }
  const W = 720, H = 240, L = 48, R = 12, T = 12, B = 28;
  const max = Math.max(1, ...rows.map((r) => r[1]));
  const step = niceStep(max / 4), top = Math.ceil(max / step) * step;
  const x = (i) => L + (rows.length === 1 ? (W - L - R) / 2 : (i * (W - L - R)) / (rows.length - 1));
  const y = (v) => T + (H - T - B) * (1 - v / top);
  const svg = s("svg", { viewBox: `0 0 ${W} ${H}`, class: "chart", role: "img", "aria-label": title + ". " + summary(rows) });
  for (let v = 0; v <= top; v += step) {
    svg.append(s("line", { x1: L, x2: W - R, y1: y(v), y2: y(v), stroke: v === 0 ? "#8a8a8a" : "#e3e3e3", "stroke-width": 1 }));
    const t = s("text", { x: L - 6, y: y(v) + 4, "text-anchor": "end" }); t.textContent = fmtNum(v); svg.append(t);
  }
  const ticks = Math.min(6, rows.length);
  for (let k = 0; k < ticks; k++) {
    const i = Math.round((k * (rows.length - 1)) / Math.max(1, ticks - 1));
    const t = s("text", { x: x(i), y: H - 8, "text-anchor": k === 0 ? "start" : k === ticks - 1 ? "end" : "middle" });
    t.textContent = new Date(rows[i][0]).toLocaleDateString(undefined, { day: "numeric", month: "short" }); svg.append(t);
  }
  svg.append(s("path", { d: rows.map((r, i) => (i ? "L" : "M") + x(i).toFixed(1) + " " + y(r[1]).toFixed(1)).join(" "), fill: "none", stroke: "#007ac2", "stroke-width": 2, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  const cross = s("line", { y1: T, y2: H - B, stroke: "#4a4a4a", "stroke-width": 1, visibility: "hidden" });
  const dot = s("circle", { r: 4.5, fill: "#007ac2", stroke: "#fff", "stroke-width": 2, visibility: "hidden" });
  svg.append(cross, dot);
  const tip = h("div", { class: "tip", hidden: true });
  const plot = h("div", { class: "plot", tabindex: "0", "aria-label": title + ": use the left and right arrow keys to read each day" }, svg, tip);
  let at = -1;
  const show = (i) => {
    at = Math.max(0, Math.min(rows.length - 1, i));
    const [t, v] = rows[at], px = x(at), py = y(v);
    cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("visibility", "visible");
    dot.setAttribute("cx", px); dot.setAttribute("cy", py); dot.setAttribute("visibility", "visible");
    tip.textContent = fmtDate(t) + ": " + fmtNum(v) + " " + yLabel.toLowerCase();
    tip.hidden = false;
    const box = svg.getBoundingClientRect(), sx = box.width / W;
    tip.style.left = Math.min(box.width - 170, Math.max(0, px * sx - 80)) + "px"; tip.style.top = Math.max(0, py * sx - 44) + "px";
  };
  const hide = () => { cross.setAttribute("visibility", "hidden"); dot.setAttribute("visibility", "hidden"); tip.hidden = true; };
  plot.addEventListener("pointermove", (e) => { const box = svg.getBoundingClientRect(), px = ((e.clientX - box.left) / box.width) * W; show(Math.round(((px - L) / (W - L - R)) * (rows.length - 1))); });
  plot.addEventListener("pointerleave", hide);
  plot.addEventListener("blur", hide);
  plot.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") { e.preventDefault(); show(at < 0 ? rows.length - 1 : at + (e.key === "ArrowRight" ? 1 : -1)); }
    else if (e.key === "Home") { e.preventDefault(); show(0); } else if (e.key === "End") { e.preventDefault(); show(rows.length - 1); }
  });
  const table = h("table", { class: "grid" }, h("caption", { class: "visually-hidden", text: title }),
    h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Day" }), h("th", { scope: "col", class: "num", text: yLabel }))),
    h("tbody", {}, rows.slice().reverse().map(([t, v]) => h("tr", {}, h("td", { text: fmtDate(t) }), h("td", { class: "num", text: fmtNum(v) })))));
  const details = h("details", { class: "table-view" }, h("summary", { text: "Show as a table" }), table);
  wrap.append(cap, plot, details);
  return wrap;
}
function niceStep(raw) {
  const p = Math.pow(10, Math.floor(Math.log10(Math.max(raw, 1)))), m = raw / p;
  return (m <= 1 ? 1 : m <= 2 ? 2 : m <= 5 ? 5 : 10) * p;
}
function summary(rows) {
  const total = rows.reduce((a, r) => a + r[1], 0), peak = rows.reduce((a, r) => (r[1] > a[1] ? r : a), rows[0]);
  return fmtNum(total) + " in all, from " + fmtDate(rows[0][0]) + " to " + fmtDate(rows[rows.length - 1][0]) + "; the busiest day was " + fmtDate(peak[0]) + " with " + fmtNum(peak[1]) + ".";
}
export const sumLast = (rows, days) => { const from = Date.now() - days * 864e5; return rows.filter((r) => r[0] >= from).reduce((a, r) => a + r[1], 0); };
