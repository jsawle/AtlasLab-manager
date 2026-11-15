// The config form, shared by the distributor's page and the team's. It works on the whole config the app will use
// (`full`: the partner's settings laid over AtlasLab's defaults and whatever it starts from) and hands back the smallest
// config that gives it (`own`), as AtlasLab's configs are written.
import { h, nextId, readFileDataUrl, say } from "./ui.js?v=1.0.0";
import { mergeConfig, minimalConfig, getPath, setPath, extractId, clone, isColour, bestInk, dataUrlBytes } from "./config-tools.js?v=1.0.0";
import { ATLAS_DEFAULTS, ATLAS_STRINGS, ATLAS_LOCALES, ATLAS_CONFIGS } from "./atlas-defaults.js?v=1.0.0";
import { SETTINGS } from "./settings.js?v=1.0.0";

// Which tools a partner can switch, in the order of AtlasLab's toolbar, with plain names. Others stay as the app sets them.
export const TOOL_LABELS = {
  openMap: "Open map", addLayer: "Add layer", csv: "Add a spreadsheet (CSV)", layers: "Map layers", legend: "Legend", basemaps: "Basemaps",
  measure: "Measure", sketch: "Sketch", bookmarks: "Bookmarks", threeD: "2D / 3D", filter: "Filter", elevationProfile: "Elevation profile",
  search: "Search", compass: "Compass", save: "Save", localSave: "Save on this device", screenshot: "Screenshot", print: "Print",
  outlinePrint: "Print an outline map", share: "Share a map's link", lessonQuestions: "A lesson's questions beside the map",
  hideToolbar: "Hide tools", toolTips: "Tool tips", columns3d: "Columns in 3D", pairs: "Paired 2D and 3D maps", sketchLayers: "More than one sketch layer",
  lockedCopy: "Save a locked copy (experimental)"
};
const DESCRIBE = (input, hint) => { if (!hint) return null; const id = nextId("hint"); input.setAttribute("aria-describedby", id); return h("p", { class: "hint", id, text: hint }); };

export function createEditor(root, { fetchConfig, onChange }) {
  let base = clone(ATLAS_DEFAULTS), full = clone(ATLAS_DEFAULTS), configVersion = 1, extendsName = "";
  const bases = new Map([["", clone(ATLAS_DEFAULTS)]]);
  const fields = [];         // { path, read(), write(full) }
  const byPath = new Map();  // path → the element to focus for a check about it
  let timer = null;

  async function baseFor(name) {
    if (!bases.has(name)) {
      try { bases.set(name, mergeConfig(ATLAS_DEFAULTS, await fetchConfig(name))); }
      catch (e) { say("Couldn't load AtlasLab's “" + name + "” settings to start from (" + e.message + "), so its own settings are shown underneath.", "error"); return clone(ATLAS_DEFAULTS); }
    }
    return bases.get(name);
  }
  const own = () => {
    const { configVersion: _c, extends: _e, ...o } = minimalConfig(full, base, []);
    return { configVersion, ...(extendsName ? { extends: extendsName } : {}), ...o };
  };
  const changed = () => { clearTimeout(timer); timer = setTimeout(() => onChange && onChange(own(), clone(full)), 250); };
  const set = (path, v) => { setPath(full, path, v); changed(); };

  // ------------------------------------------------------------ field builders
  function row(label, input, hint, path) {
    const id = input.id || (input.id = nextId("in"));
    if (path) byPath.set(path, input);
    return h("div", { class: "field" }, h("label", { for: id, text: label }), DESCRIBE(input, hint), input);
  }
  function text(path, label, hint, { area = false, max } = {}) {
    const input = area ? h("textarea", { rows: 3 }) : h("input", { type: "text", maxlength: max || null, autocomplete: "off" });
    input.addEventListener("input", () => set(path, input.value));
    fields.push({ path, read: () => { input.value = getPath(full, path) ?? ""; } });
    return row(label, input, hint, path);
  }
  function url(path, label, hint) {
    const input = h("input", { type: "url", placeholder: "https://", autocomplete: "off" });
    input.addEventListener("input", () => set(path, input.value.trim()));
    fields.push({ path, read: () => { input.value = getPath(full, path) ?? ""; } });
    return row(label, input, hint, path);
  }
  function bool(path, label, hint, { get, put } = {}) {
    const input = h("input", { type: "checkbox" });
    const id = nextId("cb"); input.id = id; byPath.set(path, input);
    input.addEventListener("change", () => (put ? (put(input.checked), changed()) : set(path, input.checked)));
    fields.push({ path, read: () => { input.checked = get ? get() : !!getPath(full, path); } });
    return h("div", { class: "field check" }, input, h("label", { for: id, text: label }), DESCRIBE(input, hint));
  }
  function select(path, label, options, hint, { onPick } = {}) {
    const input = h("select", {}, options.map(([v, t]) => h("option", { value: v, text: t })));
    input.addEventListener("change", () => (onPick ? onPick(input.value) : set(path, input.value)));
    fields.push({ path, read: () => { const v = path === "extends" ? extendsName : getPath(full, path) ?? ""; if (![...input.options].some((o) => o.value === v)) input.append(h("option", { value: v, text: v })); input.value = v; } });
    return row(label, input, hint, path);
  }
  function colour(path, label, hint, { auto } = {}) {
    const picker = h("input", { type: "color", "aria-label": label + " (picker)" });
    const input = h("input", { type: "text", class: "hex", placeholder: auto ? "automatic" : "#000000", autocomplete: "off", spellcheck: "false" });
    const swatch = h("span", { class: "sample", "aria-hidden": "true", text: "Aa" });
    const paint = () => {
      const v = getPath(full, path);
      const bg = isColour(v) ? v : auto ? auto() : "#ffffff";
      swatch.style.background = bg; swatch.style.color = bestInk(bg);
    };
    picker.addEventListener("input", () => { input.value = picker.value; set(path, picker.value); paint(); });
    input.addEventListener("input", () => { const v = input.value.trim(); if (v === "" || isColour(v)) { set(path, v); if (isColour(v)) picker.value = v.length === 4 ? "#" + v.slice(1).split("").map((c) => c + c).join("") : v; paint(); } });
    fields.push({ path, read: () => { const v = getPath(full, path) || ""; input.value = v; if (isColour(v) && v.length === 7) picker.value = v; paint(); } });
    const id = nextId("in"); input.id = id; byPath.set(path, input);
    return h("div", { class: "field" }, h("label", { for: id, text: label }), DESCRIBE(input, hint), h("div", { class: "colour-row" }, picker, input, swatch));
  }
  function idField(path, label, hint, infoKey) {
    const input = h("input", { type: "text", class: "id", placeholder: "32-character ID, or its ArcGIS Online address", autocomplete: "off", spellcheck: "false" });
    const info = h("p", { class: "info", "data-info": infoKey || path });
    input.addEventListener("change", () => { const id = extractId(input.value); if (id) input.value = id; set(path, id || input.value.trim()); });
    fields.push({ path, read: () => { input.value = getPath(full, path) || ""; } });
    const r = row(label, input, hint, path); r.append(info); return r;
  }
  function image(path, label, hint) {
    const fileIn = h("input", { type: "file", accept: "image/png,image/svg+xml,image/jpeg,image/webp" });
    const thumb = h("img", { class: "thumb", alt: "" });
    const size = h("span", { class: "hint" });
    const remove = h("button", { type: "button", class: "btn small", text: "Remove" });
    const show = () => { const v = getPath(full, path); thumb.hidden = !v; remove.hidden = !v; if (v) { thumb.src = v; size.textContent = Math.round(dataUrlBytes(v) / 1024) + " KB"; } else size.textContent = "None"; };
    fileIn.addEventListener("change", async () => { const f = fileIn.files[0]; if (!f) return; set(path, await readFileDataUrl(f)); fileIn.value = ""; show(); });
    remove.addEventListener("click", () => { set(path, ""); show(); });
    fields.push({ path, read: show });
    const id = nextId("in"); fileIn.id = id; byPath.set(path, fileIn);
    return h("div", { class: "field" }, h("label", { for: id, text: label }), DESCRIBE(fileIn, hint), fileIn, h("div", { class: "image-row" }, thumb, size, remove));
  }
  function numbers() {
    const mk = (lab, min, max, step) => { const i = h("input", { type: "number", min, max, step }); return [i, h("label", { for: i.id = nextId("in"), text: lab })]; };
    const [lon, lonL] = mk("Longitude", -180, 180, "any"), [lat, latL] = mk("Latitude", -85, 85, "any"), [zoom, zoomL] = mk("Zoom (1 = the world)", 1, 20, 1);
    const put = () => set("startView", { center: [Number(lon.value), Number(lat.value)], zoom: Number(zoom.value) });
    for (const i of [lon, lat, zoom]) i.addEventListener("change", put);
    fields.push({ path: "startView", read: () => { const sv = full.startView || {}; lon.value = sv.center ? sv.center[0] : ""; lat.value = sv.center ? sv.center[1] : ""; zoom.value = sv.zoom ?? ""; } });
    byPath.set("startView", lon);
    const fromPreview = h("button", { type: "button", class: "btn small", text: "Use the preview's map view" });
    fromPreview.addEventListener("click", () => {
      try {
        const v = document.querySelector("#preview iframe").contentDocument.querySelector("arcgis-map").view;
        lon.value = v.center.longitude.toFixed(3); lat.value = v.center.latitude.toFixed(3); zoom.value = Math.max(1, Math.round(v.zoom)); put();
      } catch (e) { fromPreview.after(h("span", { class: "hint", text: " The preview can't be read from here: type the numbers." })); }
    });
    return h("div", { class: "field" }, h("div", { class: "trio" }, h("div", {}, lonL, lon), h("div", {}, latL, lat), h("div", {}, zoomL, zoom)), fromPreview);
  }
  function links() {
    const list = h("div", { class: "links" });
    const add = h("button", { type: "button", class: "btn small", text: "Add a link" });
    const draw = () => {
      list.replaceChildren();
      (full.headerLinks || []).forEach((l, i) => {
        const lab = h("input", { type: "text", value: l.label || "", autocomplete: "off" }), adr = h("input", { type: "url", value: l.url || "", placeholder: "https://" });
        const sty = h("select", {}, h("option", { value: "dark", text: "Filled" }), h("option", { value: "outline", text: "Outline" })); sty.value = l.style === "outline" ? "outline" : "dark";
        const upd = () => { const arr = clone(full.headerLinks || []); arr[i] = { label: lab.value, url: adr.value.trim(), style: sty.value }; set("headerLinks", arr); };
        for (const e of [lab, adr, sty]) e.addEventListener("change", upd);
        const del = h("button", { type: "button", class: "btn small", text: "Remove", "aria-label": "Remove header link " + (i + 1) });
        del.addEventListener("click", () => { const arr = clone(full.headerLinks || []); arr.splice(i, 1); set("headerLinks", arr); draw(); });
        const g = h("fieldset", { class: "link" }, h("legend", { text: "Link " + (i + 1) }),
          h("label", { for: lab.id = nextId("in"), text: "Label" }), lab, h("label", { for: adr.id = nextId("in"), text: "Address" }), adr,
          h("label", { for: sty.id = nextId("in"), text: "Style" }), sty, del);
        list.append(g);
        if (i === 0) byPath.set("headerLinks", lab);
        byPath.set("headerLinks." + i, lab);
      });
      add.disabled = (full.headerLinks || []).length >= 3;
    };
    add.addEventListener("click", () => { set("headerLinks", [...clone(full.headerLinks || []), { label: "", url: "", style: "dark" }]); draw(); list.querySelector("fieldset:last-child input").focus(); });
    fields.push({ path: "headerLinks", read: draw });
    return h("div", { class: "field" }, list, add);
  }
  function tools() {
    const box = h("div", { class: "tools" });
    for (const [k, lab] of Object.entries(TOOL_LABELS)) {
      const i = h("input", { type: "checkbox", id: nextId("tool") });
      i.addEventListener("change", () => set("features." + k, i.checked));
      fields.push({ path: "features." + k, read: () => { const v = getPath(full, "features." + k); i.checked = v !== false; } });
      byPath.set("features." + k, i);
      box.append(h("div", { class: "check" }, i, h("label", { for: i.id, text: lab })));
    }
    return box;
  }
  function tags() {
    const input = h("input", { type: "text", autocomplete: "off" });
    input.addEventListener("change", () => set("agolTags", input.value.split(",").map((s) => s.trim()).filter(Boolean)));
    fields.push({ path: "agolTags", read: () => { input.value = (full.agolTags || []).join(", "); } });
    return row("Tags on maps students save to ArcGIS Online", input, "Separate tags with commas.", "agolTags");
  }
  function wording() {
    const list = h("div", { class: "wording" }), dl = h("datalist", { id: nextId("keys") }, Object.keys(ATLAS_STRINGS).map((k) => h("option", { value: k })));
    const add = h("button", { type: "button", class: "btn small", text: "Change a piece of wording" });
    const draw = () => {
      list.replaceChildren();
      for (const [k, v] of Object.entries(full.strings || {})) {
        const key = h("input", { type: "text", value: k, list: dl.id, autocomplete: "off", spellcheck: "false" }), val = h("input", { type: "text", value: v });
        const eng = h("p", { class: "hint", text: ATLAS_STRINGS[k] ? "English: " + ATLAS_STRINGS[k] : "" });
        const upd = () => { const s = {}; for (const fs of list.querySelectorAll("fieldset")) { const [a, b] = fs.querySelectorAll("input"); if (a.value.trim()) s[a.value.trim()] = b.value; } set("strings", s); };
        key.addEventListener("change", () => { eng.textContent = ATLAS_STRINGS[key.value] ? "English: " + ATLAS_STRINGS[key.value] : "Not wording AtlasLab has."; upd(); });
        val.addEventListener("change", upd);
        const del = h("button", { type: "button", class: "btn small", text: "Remove", "aria-label": "Remove the change to " + k });
        del.addEventListener("click", () => { const s = clone(full.strings || {}); delete s[k]; set("strings", s); draw(); });
        const fs = h("fieldset", { class: "word" }, h("legend", { text: k || "New" }), h("label", { for: key.id = nextId("in"), text: "Which wording" }), key, eng,
          h("label", { for: val.id = nextId("in"), text: "Your wording" }), val, del);
        list.append(fs); byPath.set("strings." + k, key);
      }
    };
    add.addEventListener("click", () => { const s = clone(full.strings || {}); s[""] = ""; full.strings = s; draw(); list.querySelector("fieldset:last-child input").focus(); });
    fields.push({ path: "strings", read: draw });
    return h("div", { class: "field" }, h("p", { class: "hint", text: "For a partner's own terms (\"MapMaker maps\"). The language file already translates everything; change only what your programme calls something else." }), list, dl, add);
  }
  const section = (title, ...kids) => h("details", { class: "section", open: true }, h("summary", {}, h("h2", { text: title })), h("div", { class: "section-body" }, kids));

  // ------------------------------------------------------------ the form
  const signInGet = () => !!getPath(full, "signIn.clientId");
  const signInPut = (on) => setPath(full, "signIn.clientId", on ? SETTINGS.atlasClientId : "");
  root.replaceChildren(
    section("Starting point and name",
      select("extends", "Start from", [["", "AtlasLab's own settings"], ...ATLAS_CONFIGS.filter((c) => c === "mapmaker").map((c) => [c, "National Geographic MapMaker's settings"])],
        "MapMaker's settings bring its header links, wording and sign-in text; anything below changes them.", { onPick: (v) => switchBase(v) }),
      text("appName", "App name", "In the header and the browser tab.", { max: 60 }),
      bool("showAppName", "Show the name in the header"),
      select("locale", "Language", ATLAS_LOCALES.map(([c, n]) => [c, n + " (" + c + ")"]), "Another language needs a language file in AtlasLab first: ask the education team.")),
    section("Logo",
      image("logo.url", "Logo", "PNG, SVG, JPEG or WebP, up to 100 KB. It is kept inside the config, so students' browsers never fetch it from another site."),
      text("logo.alt", "Logo description", "Read out by screen readers in place of the logo; usually the organization's name."),
      image("logo.compactUrl", "Small logo for phones (optional)"),
      url("logo.link", "The logo links to (optional)", "An https:// address. Empty: the logo reopens the app."),
      bool("logo.showName", "Show the app name beside the logo")),
    section("Colours",
      colour("theme.brand", "Brand colour", "Buttons and highlights. Text on it must reach 4.5 to 1."),
      colour("theme.header", "Header background"),
      colour("theme.headerInk", "Header text", "Empty: black or white, whichever reads better.", { auto: () => bestInk(getPath(full, "theme.header") || "#ffffff") }),
      colour("theme.headerLine", "Line under the header"),
      colour("theme.pill", "Header link buttons"),
      colour("theme.pillInk", "Header link button text", "Empty: automatic.", { auto: () => bestInk(getPath(full, "theme.pill") || "#000000") }),
      colour("theme.toolActive", "Selected tool", "Empty: a light tint of the brand colour.")),
    section("Header links", links()),
    section("Maps and layers",
      idField("contentGroup", "Content group", "The ArcGIS Online group whose maps and layers students browse. It must be shared with everyone."),
      idField("basemapGroup", "Basemap group"),
      idField("defaultBasemap", "Default basemap", "A web map from the basemap group.")),
    section("Where the map opens", numbers()),
    section("Units",
      select("units", "Units", [["auto", "Automatic: miles in the United States, kilometres elsewhere"], ["metric", "Kilometres and metres"], ["imperial", "Miles and feet"]]),
      bool("unitsSwitch", "Offer a km / mi switch in Measure and Elevation"),
      select("scalebar", "Scale bar", [["dual", "Both"], ["metric", "Metric"], ["imperial", "Imperial"], ["none", "None"]])),
    section("Notices and sign-in",
      text("disclaimer", "Notice on the map's bottom line", "For example: “Basemaps and map layers may not reflect the official map policy of this programme.”", { area: true }),
      bool("signIn.clientId", "Allow signing in with ArcGIS, to save maps to ArcGIS Online", "Saving on the device works without signing in.", { get: signInGet, put: signInPut }),
      bool("signIn.headerButton", "Put a Sign in button in the header", "Otherwise sign-in is offered in the Save panel only."),
      text("signIn.onboardingTitle", "Sign-in window title"),
      text("signIn.onboardingHtml", "Sign-in window message", "Simple HTML: <p>, <a href=\"https://…\">, <strong>, <em>, <br>, lists.", { area: true })),
    section("Tools", h("p", { class: "hint", text: "Untick a tool to leave it out of this partner's app." }), tools()),
    section("Saving", tags()),
    section("Wording", wording()));

  async function switchBase(name) {
    const keep = own();
    extendsName = name || "";
    base = await baseFor(extendsName);
    const { configVersion: _v, extends: _e, ...rest } = keep;
    full = clone(mergeConfig(base, rest));   // a copy: editing must never change the base it is compared with
    readAll(); changed();
  }
  function readAll() { for (const f of fields) f.read(); }

  return {
    // Fills the form from a partner's config (the smallest form of it, as kept in an item or a draft).
    async set(cfg) {
      cfg = clone(cfg || {});
      configVersion = Number.isInteger(cfg.configVersion) ? cfg.configVersion : 1;
      extendsName = typeof cfg.extends === "string" ? cfg.extends : "";
      base = await baseFor(extendsName);
      const { configVersion: _v, extends: _e, ...rest } = cfg;
      full = clone(mergeConfig(base, rest));   // a copy: editing must never change the base it is compared with
      readAll(); changed();
    },
    get: () => ({ own: own(), full: clone(full) }),
    bumpVersion() { configVersion += 1; return configVersion; },
    focus(path) {
      const keys = [...byPath.keys()].filter((k) => path === k || path.startsWith(k + ".")).sort((a, b) => b.length - a.length);
      const el = byPath.get(keys[0]) || byPath.get(path.split(".")[0]);
      if (!el) return false;
      const det = el.closest("details"); if (det) det.open = true;
      el.focus(); el.scrollIntoView({ block: "center" });
      return true;
    },
    showInfo(info) {
      for (const p of root.querySelectorAll("[data-info]")) {
        const i = info[p.dataset.info];
        p.textContent = i ? "✓ " + i.title + (i.count != null ? " — " + i.count + " maps" : "") : "";
      }
    }
  };
}
