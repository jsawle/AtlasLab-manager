// The Versions window: every part of the manager and its version.
import { h, ask } from "./ui.js?v=1.0.0";
import { VERSION_ROWS } from "./versions.js?v=1.0.0";

export function wireVersions(button) {
  button.textContent = "Versions";
  button.addEventListener("click", () => ask({
    title: "Versions", ok: "Close", cancel: "",
    body: h("table", { class: "grid" }, h("caption", { class: "visually-hidden", text: "Each part of the manager and its version" }),
      h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Part" }), h("th", { scope: "col", text: "Version" }), h("th", { scope: "col", text: "What it is" }))),
      h("tbody", {}, VERSION_ROWS.map(([a, b, c]) => h("tr", {}, h("td", { text: a }), h("td", { text: b }), h("td", { text: c })))))
  }));
}
