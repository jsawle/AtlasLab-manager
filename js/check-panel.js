// The list of checks beside the form: problems first, each a button that takes you to the setting it is about.
import { h } from "./ui.js?v=1.0.0";
import { checkConfig, checkOnline } from "./checks.js?v=1.0.0";
import { ATLAS_DEFAULTS, ATLAS_STRINGS, ATLAS_LOCALES, ATLAS_CONFIGS } from "./atlas-defaults.js?v=1.0.0";
import { SETTINGS } from "./settings.js?v=1.0.0";
import { fetchJson } from "./ui.js?v=1.0.0";

const CTX = {
  stringKeys: new Set(Object.keys(ATLAS_STRINGS)), englishStrings: ATLAS_STRINGS,
  configs: ATLAS_CONFIGS, locales: ATLAS_LOCALES.map(([c]) => c),
  features: [...Object.keys(ATLAS_DEFAULTS.features), "share"], maxLogoBytes: SETTINGS.maxLogoBytes
};

export function createCheckPanel(root, editor) {
  const summary = h("p", { class: "check-summary", role: "status" });
  const list = h("ul", { class: "checks" });
  root.replaceChildren(h("h2", { text: "Checks" }), summary, list);
  let last = [], onlineFor = "", online = { results: [], info: {} }, latest = null;

  function draw() {
    list.replaceChildren();
    const errors = last.filter((r) => r.level === "error"), warnings = last.filter((r) => r.level === "warning");
    summary.textContent = errors.length ? errors.length + " problem" + (errors.length > 1 ? "s" : "") + " to fix" + (warnings.length ? ", " + warnings.length + " to look at" : "") + "."
      : warnings.length ? "No problems; " + warnings.length + " thing" + (warnings.length > 1 ? "s" : "") + " to look at." : "No problems found.";
    summary.className = "check-summary " + (errors.length ? "bad" : warnings.length ? "warn" : "good");
    for (const r of [...errors, ...warnings]) {
      const b = h("button", { type: "button", class: "linkish", text: r.message });
      b.addEventListener("click", () => editor.focus(r.path));
      list.append(h("li", { class: r.level }, h("span", { class: "tag", text: r.level === "error" ? "Problem" : "Look at" }), " ", b));
    }
  }
  return {
    // Runs the checks; the online ones only when the groups or basemap changed.
    async run(own, full) {
      latest = { own, full };
      last = checkConfig(own, full, CTX).concat(online.results);
      draw();
      const key = [full.contentGroup, full.basemapGroup, full.defaultBasemap].join();
      if (key !== onlineFor) {
        onlineFor = key;
        const got = await checkOnline(full, { portal: SETTINGS.portal, fetchJson });
        if (onlineFor !== key) return this.result();      // the groups changed again meanwhile: that check will draw
        online = got;
        last = checkConfig(latest.own, latest.full, CTX).concat(online.results);
        editor.showInfo(online.info); draw();
      }
      return this.result();
    },
    result: () => ({ errors: last.filter((r) => r.level === "error"), warnings: last.filter((r) => r.level === "warning") })
  };
}
