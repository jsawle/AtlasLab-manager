// Pure helpers for AtlasLab partner configs: merging, the minimal form of a config, differences between two configs,
// colour contrast, IDs pasted as addresses, the limited HTML a sign-in message may use, and the draft file format.
// No DOM and no network, so the unit tests run them under Node.

export const DRAFT_TYPE = "AtlasLabPartnerDraft";
export const DRAFT_VERSION = "1.0";      // the draft file format
export const DIFF_VERSION = "1.0";       // how two configs are compared

const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);
export const clone = (v) => JSON.parse(JSON.stringify(v === undefined ? null : v));

// Same rule as AtlasLab's lib/config.js: objects merge key by key, anything else (arrays included) replaces.
export function mergeConfig(base, over) {
  const out = Array.isArray(base) ? base.slice() : { ...base };
  for (const k of Object.keys(over || {})) {
    const b = base ? base[k] : undefined, o = over[k];
    out[k] = isObj(b) && isObj(o) ? mergeConfig(b, o) : o;
  }
  return out;
}

export function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? undefined : o[k]), obj);
}
export function setPath(obj, path, value) {
  const keys = path.split("."), last = keys.pop();
  let o = obj;
  for (const k of keys) { if (!isObj(o[k])) o[k] = {}; o = o[k]; }
  o[last] = value;
  return obj;
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// The smallest config that, laid over `base`, gives `full`: only what differs, as AtlasLab's configs are written.
// `keep` lists top-level keys always written (configVersion, extends).
export function minimalConfig(full, base, keep = ["configVersion", "extends"]) {
  const walk = (f, b) => {
    const out = {};
    for (const k of Object.keys(f || {})) {
      const fv = f[k], bv = b ? b[k] : undefined;
      if (isObj(fv) && isObj(bv)) { const sub = walk(fv, bv); if (Object.keys(sub).length) out[k] = sub; }
      else if (!same(fv, bv)) out[k] = clone(fv);
    }
    return out;
  };
  const out = walk(full, base);
  for (const k of keep) if (full && full[k] !== undefined && full[k] !== "") out[k] = full[k]; else delete out[k];
  return out;
}

// Every leaf of a config as "a.b.c" → value. Arrays are leaves (header links, tags), compared whole.
export function flatten(obj, prefix = "", out = {}) {
  for (const k of Object.keys(obj || {})) {
    const v = obj[k], p = prefix ? prefix + "." + k : k;
    if (isObj(v) && Object.keys(v).length) flatten(v, p, out); else out[p] = v;
  }
  return out;
}

// What changed between the config that is live and a new one: [{ path, kind: "added"|"removed"|"changed", from, to }].
// configVersion is left out: it changes on every publish.
export function diffConfigs(live, next) {
  const a = flatten(live || {}), b = flatten(next || {});
  const paths = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((p) => p !== "configVersion").sort();
  const out = [];
  for (const p of paths) {
    if (!(p in a)) out.push({ path: p, kind: "added", to: b[p] });
    else if (!(p in b)) out.push({ path: p, kind: "removed", from: a[p] });
    else if (!same(a[p], b[p])) out.push({ path: p, kind: "changed", from: a[p], to: b[p] });
  }
  return out;
}
// A value as a short line for the list of changes (pictures inside the config are summarised, not printed).
export function describeValue(v) {
  if (v === undefined || v === null || v === "") return "(none)";
  if (typeof v === "string" && v.startsWith("data:image/")) return "a picture (" + Math.round(dataUrlBytes(v) / 1024) + " KB)";
  if (typeof v === "string") return v.length > 120 ? v.slice(0, 117) + "…" : v;
  const s = JSON.stringify(v);
  return s.length > 120 ? s.slice(0, 117) + "…" : s;
}
export function dataUrlBytes(u) {
  const b64 = String(u).split(",")[1] || "";
  return Math.floor(b64.length * 3 / 4) - (b64.endsWith("==") ? 2 : b64.endsWith("=") ? 1 : 0);
}

// ---------------------------------------------------------------- Colour contrast (WCAG 2.1), as AtlasLab works it out
export function hexToRgb(hex) {
  let h = String(hex || "").replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h.slice(0, 6), 16);
  return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [0, 0, 0];
}
function luminance(hex) {
  return hexToRgb(hex).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); })
    .reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
}
export function contrast(a, b) { const la = luminance(a), lb = luminance(b); return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05); }
export const bestInk = (bg) => (contrast(bg, "#ffffff") >= contrast(bg, "#000000") ? "#ffffff" : "#000000");
export const isColour = (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(String(v || ""));

// ---------------------------------------------------------------- IDs
// A group or item ID from what someone pastes: the ID itself, or an ArcGIS Online address that has one in it.
export function extractId(text) {
  const s = String(text || "").trim();
  if (/^[0-9a-f]{32}$/i.test(s)) return s.toLowerCase();
  const m = s.match(/(?:[?&#](?:id|appid|webmap|webscene|groupid)=|\/(?:groups|items)\/)([0-9a-f]{32})/i) || s.match(/\b([0-9a-f]{32})\b/i);
  return m ? m[1].toLowerCase() : "";
}

// ---------------------------------------------------------------- The sign-in message's HTML
// Only these tags, and only https links. AtlasLab cleans the HTML again before showing it; this check is so that what is
// published is exactly what will be shown.
const HTML_TAGS = new Set(["p", "a", "strong", "em", "b", "i", "br", "ul", "ol", "li"]);
export function checkHtml(html) {
  const problems = [], s = String(html || "");
  if (/<!--/.test(s)) problems.push("comments (<!-- -->) aren't allowed");
  const tag = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*)>/g;
  let m;
  while ((m = tag.exec(s))) {
    const name = m[1].toLowerCase();
    if (!HTML_TAGS.has(name)) { problems.push("<" + name + "> isn't allowed (only p, a, strong, em, b, i, br, ul, ol, li)"); continue; }
    const attrs = [...m[2].matchAll(/([a-zA-Z_:][\w:.-]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s"'>]+))?/g)];
    for (const [, an, av] of attrs) {
      const a = an.toLowerCase(), v = (av || "").replace(/^["']|["']$/g, "");
      if (name === "a" && a === "href") { if (!/^https:\/\//i.test(v)) problems.push("a link must start with https:// (" + v + ")"); }
      else if (name === "a" && (a === "target" || a === "rel")) { /* allowed */ }
      else problems.push("the " + a + " attribute isn't allowed on <" + name + ">");
    }
  }
  if (/<[^>]*$/.test(s)) problems.push("a tag isn't closed with >");
  return [...new Set(problems)];
}

// ---------------------------------------------------------------- Draft files
// What a distributor sends the education team (through their Teams channel): the config they want, made in the form.
export function makeDraft({ partner, liveItem, notes, config, formVersion }) {
  return {
    type: DRAFT_TYPE, draftVersion: DRAFT_VERSION, formVersion: formVersion || "",
    partner: String(partner || "").trim(), liveItem: liveItem || "", notes: String(notes || ""),
    savedAt: new Date().toISOString(), config: clone(config || {})
  };
}
export function readDraft(text) {
  let d;
  try { d = typeof text === "string" ? JSON.parse(text) : text; } catch (e) { return { ok: false, error: "This file isn't a draft: it doesn't read as JSON." }; }
  if (!isObj(d) || d.type !== DRAFT_TYPE) return { ok: false, error: "This file isn't an AtlasLab draft." };
  if (String(d.draftVersion || "").split(".")[0] !== DRAFT_VERSION.split(".")[0]) return { ok: false, error: "This draft was made by a newer form (draft format " + d.draftVersion + ")." };
  if (!isObj(d.config)) return { ok: false, error: "This draft has no config in it." };
  const liveItem = /^[0-9a-f]{32}$/i.test(d.liveItem || "") ? d.liveItem.toLowerCase() : "";
  return { ok: true, draft: { ...d, liveItem, partner: String(d.partner || ""), notes: String(d.notes || "") } };
}
export const slug = (s) => String(s || "partner").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "partner";
export const draftFileName = (partner, when = new Date()) => "atlaslab-draft-" + slug(partner) + "-" + when.toISOString().slice(0, 10) + ".json";
