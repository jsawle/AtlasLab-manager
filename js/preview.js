// The real AtlasLab in a frame, shown the config being edited. AtlasLab (5.0.0-beta.58 or later), opened with
// ?preview=1, says when it is ready and takes the config by message from this page only (see its PREVIEW_ORIGINS).
import { h } from "./ui.js?v=1.0.0";
import { SETTINGS } from "./settings.js?v=1.0.0";

export function createPreview(root) {
  const target = new URL(SETTINGS.atlasUrl);
  target.searchParams.set("preview", "1");
  const state = h("p", { class: "hint", role: "status" });
  const size = h("select", { id: "preview-size" }, h("option", { value: "wide", text: "Laptop" }), h("option", { value: "phone", text: "Phone (390 px)" }));
  const again = h("button", { type: "button", class: "btn small", text: "Reload preview" });
  const frame = h("iframe", { title: "Preview of the partner's AtlasLab" });
  const holder = h("div", { class: "frame-holder" }, frame);
  root.replaceChildren(h("div", { class: "preview-bar" }, h("label", { for: "preview-size", text: "Screen" }), size, again, state), holder);
  let config = null, timer = null, shown = "";

  window.addEventListener("message", (e) => {
    if (e.source !== frame.contentWindow || e.origin !== target.origin || !e.data || e.data.type !== "atlaslab-preview-ready") return;
    frame.contentWindow.postMessage({ type: "atlaslab-preview-config", config }, target.origin);
    state.textContent = "Showing the settings above.";
  });
  const load = () => {
    if (!config) return;
    shown = JSON.stringify(config);
    state.textContent = "Loading the preview…";
    frame.src = target.href + "&t=" + Date.now();   // a fresh page each time: the app reads its config once, at start
  };
  size.addEventListener("change", () => { holder.classList.toggle("phone", size.value === "phone"); });
  again.addEventListener("click", load);
  return {
    // Shows a config, reloading the app only when it really changed (and not on every key press).
    show(cfg) {
      config = cfg;
      if (JSON.stringify(cfg) === shown) return;
      clearTimeout(timer); timer = setTimeout(load, 1200);
    }
  };
}
