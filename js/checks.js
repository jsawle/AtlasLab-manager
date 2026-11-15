// Checks on a partner config before a draft is saved or a config is published.
// checkConfig is pure (the unit tests run it); checkOnline asks ArcGIS Online, without signing in, about the groups and
// basemap the config names: what students will see has to be public.
import { isColour, contrast, bestInk, checkHtml, dataUrlBytes, getPath } from "./config-tools.js?v=1.0.0";

export const CHECKS_VERSION = "1.0";
const HEX32 = /^[0-9a-f]{32}$/i;
const IMAGE = /^data:image\/(png|jpeg|webp|svg\+xml);base64,[A-Za-z0-9+/]+=*$/;
const KNOWN_TOP = new Set(["configVersion", "extends", "appName", "locale", "dir", "logo", "showAppName", "headerLinks", "partnerLogos", "theme",
  "contentGroup", "basemapGroup", "defaultBasemap", "startView", "timeMode", "threeDTilt", "threeDQuality", "units", "unitsSwitch", "scalebar",
  "disclaimer", "signIn", "agolTags", "csvMaxRows", "features", "strings"]);

// `own`: the config as it will be published (only what differs). `full`: own laid over the app's defaults (and what it
// extends): what the app will actually use. ctx: { stringKeys, configs, locales, features, maxLogoBytes }.
export function checkConfig(own, full, ctx = {}) {
  const out = [];
  const bad = (path, message) => out.push({ level: "error", path, message });
  const warn = (path, message) => out.push({ level: "warning", path, message });
  own = own || {}; full = full || {};

  for (const k of Object.keys(own)) if (!KNOWN_TOP.has(k)) warn(k, "AtlasLab doesn't use a setting called “" + k + "”.");
  if ("portalUrl" in own) bad("portalUrl", "A partner config can't change the ArcGIS portal; AtlasLab ignores it.");

  const name = String(full.appName || "").trim();
  if (!name) bad("appName", "The app needs a name.");
  else if (name.length > 40) warn("appName", "The name is " + name.length + " characters; over 40 it may not fit the header on a phone.");

  if (own.extends && !(ctx.configs || []).includes(own.extends)) bad("extends", "There is no AtlasLab config called “" + own.extends + "” to start from.");
  const loc = String(full.locale || "en");
  if (!/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(loc)) bad("locale", "“" + loc + "” isn't a language code (like es or es-PA).");
  else if (ctx.locales && !ctx.locales.includes(loc) && !ctx.locales.includes(loc.split("-")[0])) bad("locale", "AtlasLab has no language file for “" + loc + "” yet, so its wording would be in English. Ask the education team for one.");

  // Logos: pictures inside the config, so no student's browser fetches them from another website
  for (const p of ["logo.url", "logo.compactUrl"]) {
    const v = getPath(own, p);
    if (!v) continue;
    if (!IMAGE.test(v)) bad(p, "A logo must be a PNG, SVG, JPEG or WebP picture uploaded in the form, not an address.");
    else if (dataUrlBytes(v) > (ctx.maxLogoBytes || 100 * 1024)) bad(p, "The logo is " + Math.round(dataUrlBytes(v) / 1024) + " KB; keep it under " + Math.round((ctx.maxLogoBytes || 102400) / 1024) + " KB, as every student downloads it.");
  }
  if (getPath(full, "logo.url") && !String(getPath(full, "logo.alt") || "").trim()) bad("logo.alt", "Describe the logo for people who can't see it (usually the organization's name).");
  const link = getPath(own, "logo.link");
  if (link && !/^https:\/\//i.test(link)) bad("logo.link", "The logo's link must start with https://.");
  (own.partnerLogos || []).forEach((p, i) => {
    if (!p || !IMAGE.test(p.url || "")) bad("partnerLogos." + i, "A partner logo must be a picture uploaded in the form.");
    if (p && p.link && !/^https:\/\//i.test(p.link)) bad("partnerLogos." + i, "A partner logo's link must start with https://.");
  });

  // Colours, and whether text on them can be read (WCAG 2.1 AA: 4.5 to 1)
  const th = full.theme || {};
  for (const [k, v] of Object.entries(own.theme || {})) if (v !== "" && k !== "font" && !isColour(v)) bad("theme." + k, "“" + v + "” isn't a colour like #0b5c8e.");
  const pair = (bgKey, inkKey, what) => {
    const bg = th[bgKey]; if (!isColour(bg)) return;
    const ink = isColour(th[inkKey]) ? th[inkKey] : bestInk(bg), c = contrast(bg, ink);
    if (c < 4.5) bad("theme." + (isColour(th[inkKey]) ? inkKey : bgKey), what + ": text on it is " + c.toFixed(1) + " to 1; it needs 4.5 to 1 to be readable (WCAG 2.1 AA).");
  };
  pair("brand", "brandInk", "Brand colour");
  pair("header", "headerInk", "Header");
  pair("pill", "pillInk", "Header buttons");
  if (isColour(th.toolActive)) pair("toolActive", "toolActiveInk", "Selected tool");

  // Links in the header
  const links = own.headerLinks || [];
  if (links.length > 3) warn("headerLinks", links.length + " header links may not fit on a phone; three is plenty.");
  links.forEach((l, i) => {
    if (!l || !String(l.label || "").trim()) bad("headerLinks." + i, "Header link " + (i + 1) + " needs a label.");
    if (!l || !/^https:\/\//i.test(l.url || "")) bad("headerLinks." + i, "Header link " + (i + 1) + " needs an address starting with https://.");
  });

  // The content students see
  for (const k of ["contentGroup", "basemapGroup", "defaultBasemap"]) if (k in own && !HEX32.test(own[k] || "")) bad(k, "This needs a 32-character ArcGIS Online ID.");

  const sv = full.startView || {};
  const [lon, lat] = Array.isArray(sv.center) ? sv.center : [];
  if (!(Number.isFinite(lon) && lon >= -180 && lon <= 180 && Number.isFinite(lat) && lat >= -85 && lat <= 85)) bad("startView", "Where the map opens needs a longitude (−180 to 180) and a latitude (−85 to 85).");
  if (!(Number.isFinite(sv.zoom) && sv.zoom >= 1 && sv.zoom <= 20)) bad("startView", "The opening zoom must be from 1 (the world) to 20.");

  if (!["auto", "metric", "imperial"].includes(full.units)) bad("units", "Units must be auto, metric or imperial.");
  if (!["dual", "metric", "imperial", "none"].includes(full.scalebar)) bad("scalebar", "The scale bar must be dual, metric, imperial or none.");

  if (String(full.disclaimer || "").length > 200) warn("disclaimer", "The notice is long for the map's bottom line (" + String(full.disclaimer).length + " characters).");
  const si = full.signIn || {};
  for (const p of checkHtml(si.onboardingHtml)) bad("signIn.onboardingHtml", "Sign-in message: " + p + ".");

  (full.agolTags || []).forEach((t, i) => { if (!String(t).trim() || String(t).length > 64) bad("agolTags." + i, "Tags must be 1 to 64 characters."); });

  const known = ctx.features ? new Set(ctx.features) : null;
  for (const [k, v] of Object.entries(own.features || {})) {
    if (typeof v !== "boolean") bad("features." + k, "A tool is on or off (true or false).");
    if (known && !known.has(k)) warn("features." + k, "AtlasLab has no tool switch called “" + k + "”.");
  }
  if (ctx.stringKeys) {
    for (const [k, v] of Object.entries(own.strings || {})) {
      if (!ctx.stringKeys.has(k)) bad("strings." + k, "AtlasLab has no wording called “" + k + "”.");
      else if (typeof v !== "string" || !v.trim()) bad("strings." + k, "Wording can't be empty.");
      else if (ctx.englishStrings) {
        const holes = (s) => String(s).match(/\{\w+\}/g) || [];
        const allowed = new Set(holes(ctx.englishStrings[k]));
        for (const h of holes(v)) if (!allowed.has(h)) bad("strings." + k, "“" + h + "” isn't a placeholder this wording has (it has " + ([...allowed].join(", ") || "none") + ").");
      }
    }
  }
  return out;
}

// Asks ArcGIS Online about the groups and basemap. fetchJson(url) → parsed JSON. Returns { results, info }.
export async function checkOnline(full, { portal, fetchJson }) {
  const results = [], info = {};
  const rest = String(portal).replace(/\/+$/, "") + "/sharing/rest";
  const bad = (path, message) => results.push({ level: "error", path, message });
  const warn = (path, message) => results.push({ level: "warning", path, message });
  const group = async (key, kinds) => {
    const id = full[key];
    if (!HEX32.test(id || "")) return;
    try {
      const g = await fetchJson(`${rest}/community/groups/${id}?f=json`);
      if (!g || g.error || !g.id) { bad(key, "No public group with this ID. It may be private, deleted or mistyped."); return; }
      if (g.access !== "public") { bad(key, "“" + g.title + "” isn't shared with everyone, so students without an account won't see it."); return; }
      const q = encodeURIComponent("group:" + id + " AND (" + kinds.map((k) => 'type:"' + k + '"').join(" OR ") + ")");
      const s = await fetchJson(`${rest}/search?f=json&num=1&q=${q}`);
      info[key] = { title: g.title, count: s && s.total || 0 };
      if (!info[key].count) bad(key, "“" + g.title + "” has no public " + kinds.join(" or ") + " items in it.");
    } catch (e) { warn(key, "Couldn't reach ArcGIS Online to check this (" + (e.message || e) + ")."); }
  };
  await Promise.all([group("contentGroup", ["Web Map", "Web Scene"]), group("basemapGroup", ["Web Map", "Web Scene"])]);
  if (HEX32.test(full.defaultBasemap || "")) {
    try {
      const it = await fetchJson(`${rest}/content/items/${full.defaultBasemap}?f=json`);
      if (!it || it.error || !it.id) bad("defaultBasemap", "No public item with this ID.");
      else if (it.type !== "Web Map") bad("defaultBasemap", "“" + it.title + "” is a " + it.type + "; the default basemap must be a web map.");
      else if (it.access !== "public") bad("defaultBasemap", "“" + it.title + "” isn't shared with everyone.");
      else info.defaultBasemap = { title: it.title };
    } catch (e) { warn("defaultBasemap", "Couldn't reach ArcGIS Online to check this (" + (e.message || e) + ")."); }
  }
  return { results, info };
}
