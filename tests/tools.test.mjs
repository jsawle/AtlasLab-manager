// node tests/tools.test.mjs — the pure parts: configs, differences, contrast, IDs, HTML, drafts and the checks.
import { mergeConfig, minimalConfig, flatten, diffConfigs, contrast, bestInk, extractId, checkHtml, makeDraft, readDraft, draftFileName, describeValue, dataUrlBytes } from "../js/config-tools.js";
import { checkConfig, checkOnline } from "../js/checks.js";
import { ATLAS_DEFAULTS, ATLAS_STRINGS, ATLAS_LOCALES, ATLAS_CONFIGS } from "../js/atlas-defaults.js";

let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.error("FAIL " + m); } else console.log("  ok   " + m); };
const D = ATLAS_DEFAULTS;
const CTX = { stringKeys: new Set(Object.keys(ATLAS_STRINGS)), englishStrings: ATLAS_STRINGS, configs: ATLAS_CONFIGS, locales: ATLAS_LOCALES.map(([c]) => c), features: Object.keys(D.features) };
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

// The smallest config
const full = mergeConfig(D, { appName: "Mapas", theme: { brand: "#7a1f5c" }, features: { print: false }, headerLinks: [{ label: "Ayuda", url: "https://x.org", style: "dark" }] });
const own = minimalConfig(full, D, []);
ok(JSON.stringify(Object.keys(own).sort()) === JSON.stringify(["appName", "features", "headerLinks", "theme"]), "the minimal config holds only what differs: " + Object.keys(own).join(", "));
ok(JSON.stringify(own.theme) === '{"brand":"#7a1f5c"}' && JSON.stringify(own.features) === '{"print":false}', "and only the changed parts of theme and features");
ok(JSON.stringify(mergeConfig(D, own)) === JSON.stringify(full), "laid back over the defaults it gives the whole config again");
ok(Object.keys(minimalConfig(D, D, [])).length === 0, "the defaults themselves need no config");

// Differences
const d = diffConfigs({ configVersion: 3, appName: "A", theme: { brand: "#000000" }, features: { print: false } }, { configVersion: 4, appName: "B", theme: { brand: "#000000", header: "#ffffff" } });
ok(d.length === 3 && d.find((x) => x.path === "appName").kind === "changed" && d.find((x) => x.path === "theme.header").kind === "added" && d.find((x) => x.path === "features.print").kind === "removed", "differences: changed, added and removed settings, configVersion left out");
ok(diffConfigs({ headerLinks: [{ a: 1 }] }, { headerLinks: [{ a: 1 }] }).length === 0, "lists compare whole");
ok(describeValue(PNG).startsWith("a picture ("), "a picture is summarised, not printed");
ok(flatten({ a: { b: 1, c: {} } })["a.c"] !== undefined, "an empty object is a leaf");

// Contrast (WCAG): known pairs
ok(Math.abs(contrast("#000000", "#ffffff") - 21) < 0.01 && Math.abs(contrast("#767676", "#ffffff") - 4.54) < 0.02, "contrast: black on white 21, #767676 on white 4.54");
ok(bestInk("#0b5c8e") === "#ffffff" && bestInk("#ffd400") === "#000000", "best text colour: white on dark blue, black on yellow");

// IDs from what people paste
const G = "c3ac404ac811494ea6fa116abc0cf39b";
for (const s of [G, G.toUpperCase(), "https://www.arcgis.com/home/group.html?id=" + G + "#overview", "https://gis-4-schools.maps.arcgis.com/home/group.html?id=" + G, "https://www.arcgis.com/sharing/rest/community/groups/" + G, " " + G + " "])
  ok(extractId(s) === G, "an ID from “" + s.slice(0, 60) + "”");
ok(extractId("hello") === "", "no ID: empty");

// The sign-in message
ok(checkHtml('<p>Use your <strong>ArcGIS</strong> account. <a href="https://x.org" target="_blank">Help</a></p>').length === 0, "allowed HTML passes");
ok(checkHtml('<p onclick="x()">Hi</p>').length === 1, "an event attribute is caught");
ok(checkHtml('<script>alert(1)</script>').some((p) => p.includes("<script>")), "a script tag is caught");
ok(checkHtml('<a href="javascript:alert(1)">x</a>').some((p) => p.includes("https://")), "a javascript: link is caught");
ok(checkHtml('<img src=x onerror=alert(1)>').length >= 1 && checkHtml("<p>open <b").length === 1, "an image and an unclosed tag are caught");

// Drafts
const dr = makeDraft({ partner: " Esri Panamá ", liveItem: "0123456789ABCDEF0123456789ABCDEF", config: own, formVersion: "1.0" });
const back = readDraft(JSON.stringify(dr));
ok(back.ok && back.draft.partner === "Esri Panamá" && back.draft.liveItem === "0123456789abcdef0123456789abcdef" && JSON.stringify(back.draft.config) === JSON.stringify(own), "a draft file reads back as it was saved");
ok(!readDraft("{").ok && !readDraft('{"type":"x"}').ok && !readDraft(JSON.stringify({ ...dr, draftVersion: "2.0" })).ok && !readDraft(JSON.stringify({ ...dr, config: [] })).ok, "not JSON, not a draft, a newer format and no config are all refused");
ok(draftFileName("Esri Panamá — Mapas Escolares", new Date("2026-11-15T12:00:00Z")) === "atlaslab-draft-esri-panama-mapas-escolares-2026-11-15.json", "the draft's file name");
ok(dataUrlBytes(PNG) === 70, "a picture's size from its data address (70 bytes)");

// Checks
const errs = (o, ctx = CTX) => checkConfig(o, mergeConfig(D, o), ctx).filter((r) => r.level === "error");
ok(errs({}).length === 0, "AtlasLab's defaults pass every check");
ok(errs({ appName: "" }).some((r) => r.path === "appName"), "no name: a problem");
ok(errs({ theme: { brand: "#ffeb3b", brandInk: "#ffffff" } }).some((r) => r.path === "theme.brandInk"), "white text on yellow: a contrast problem");
ok(errs({ theme: { brand: "#7a1f5c" } }).length === 0, "a dark brand colour with automatic text passes");
ok(errs({ theme: { header: "red" } }).some((r) => r.path === "theme.header"), "a colour name instead of #hex: a problem");
ok(errs({ logo: { url: "https://partner.example.com/logo.png", alt: "x" } }).some((r) => r.path === "logo.url"), "a logo address on another website: a problem");
ok(errs({ logo: { url: PNG } }).some((r) => r.path === "logo.alt"), "a logo with no description: a problem");
ok(errs({ logo: { url: PNG, alt: "Esri" } }).length === 0, "a logo uploaded with a description passes");
ok(errs({ logo: { url: "data:image/png;base64," + "A".repeat(140000), alt: "x" } }).some((r) => r.message.includes("KB")), "a logo over 100 KB: a problem");
ok(errs({ headerLinks: [{ label: "", url: "http://x.org" }] }).length === 2, "a header link with no label and no https: two problems");
ok(errs({ contentGroup: "abc" }).some((r) => r.path === "contentGroup"), "a group that isn't an ID: a problem");
ok(errs({ startView: { center: [200, 0], zoom: 3 } }).some((r) => r.path === "startView") && errs({ startView: { center: [0, 0], zoom: 0 } }).length === 1, "a longitude past 180 and a zoom of 0: problems");
ok(errs({ locale: "fr" }).some((r) => r.path === "locale") && errs({ locale: "es-PA" }).length === 0, "a language AtlasLab has no file for: a problem; es-PA uses es");
ok(errs({ extends: "nope" }).some((r) => r.path === "extends") && errs({ extends: "mapmaker" }).length === 0, "starting from a config AtlasLab hasn't got: a problem");
ok(errs({ signIn: { onboardingHtml: "<p onmouseover=x>" } }).some((r) => r.path === "signIn.onboardingHtml"), "sign-in message HTML is checked");
ok(errs({ strings: { nope: "x" } }).length === 1 && errs({ strings: { signIn: "Entrar" } }).length === 0, "wording: an unknown key is a problem; a real one passes");
ok(errs({ strings: { linkCopied: "Copiado {nope}" } }).length === 1, "wording: a placeholder the English doesn't have is a problem");
ok(errs({ portalUrl: "https://evil.example.com" }).length === 1, "a partner can't change the portal");
ok(errs({ features: { print: "no" } }).length === 1, "a tool switch must be true or false");
ok(checkConfig({ colour: "x" }, D, CTX).some((r) => r.level === "warning" && r.path === "colour"), "a setting AtlasLab doesn't have: a warning");

// Online checks, answered here as ArcGIS Online answers
const PORTAL = "https://www.arcgis.com";
const answers = {
  [`${PORTAL}/sharing/rest/community/groups/${G}?f=json`]: { id: G, title: "Schools Living Atlas – 5.0 test", access: "public" },
  [`${PORTAL}/sharing/rest/community/groups/406646c98d0f4c608a9438d40ce2df9e?f=json`]: { id: "406646c98d0f4c608a9438d40ce2df9e", title: "Basemaps", access: "public" },
  [`${PORTAL}/sharing/rest/content/items/a82ff7ce1c3a493f9d82aa89f5a1ddcf?f=json`]: { id: "a82ff7ce1c3a493f9d82aa89f5a1ddcf", title: "Topographic", type: "Web Map", access: "public" }
};
const fake = async (u) => (u.includes("/search?") ? { total: u.includes(G) ? 121 : 20 } : answers[u] || { error: { code: 400 } });
const on = await checkOnline({ ...D, contentGroup: G }, { portal: PORTAL, fetchJson: fake });
ok(on.results.length === 0 && on.info.contentGroup.count === 121 && on.info.defaultBasemap.title === "Topographic", "online: public groups with maps and a public basemap pass");
const priv = await checkOnline({ ...D, contentGroup: "ffffffffffffffffffffffffffffffff" }, { portal: PORTAL, fetchJson: fake });
ok(priv.results.some((r) => r.path === "contentGroup" && r.level === "error"), "online: a group that isn't public is a problem");
const down = await checkOnline(D, { portal: PORTAL, fetchJson: async () => { throw new Error("offline"); } });
ok(down.results.every((r) => r.level === "warning") && down.results.length === 3, "online: no connection gives warnings, not problems");

console.log(`${n - bad}/${n} checks passed`);
process.exit(bad ? 1 : 0);
