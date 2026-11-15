// node tools/sync-atlaslab.mjs <path to an AtlasLab clone>
// Copies what the manager needs to know about AtlasLab into js/atlas-defaults.js: the app's built-in config
// (DEFAULT_CONFIG in src/config.js), its English wording (lib/strings.js), its language files and its configs.
// Run it whenever AtlasLab changes its defaults, wording or languages, and commit the result.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const src = process.argv[2];
if (!src || !fs.existsSync(path.join(src, "src/config.js"))) { console.error("Give the path of an AtlasLab clone."); process.exit(1); }
const code = fs.readFileSync(path.join(src, "src/config.js"), "utf8");
const version = (code.match(/APP_VERSION = "([^"]+)"/) || [])[1];
const start = code.indexOf("const DEFAULT_CONFIG = {");
let depth = 0, end = -1;
for (let i = code.indexOf("{", start); i < code.length; i++) { if (code[i] === "{") depth++; else if (code[i] === "}" && --depth === 0) { end = i + 1; break; } }
const DEFAULTS = Function('"use strict"; return (' + code.slice(code.indexOf("{", start), end) + ");")();
const { DEFAULT_STRINGS } = await import(pathToFileURL(path.join(src, "lib/strings.js")).href);
const locales = [["en", "English"]].concat(fs.readdirSync(path.join(src, "locales")).filter((f) => f.endsWith(".json")).map((f) => {
  const j = JSON.parse(fs.readFileSync(path.join(src, "locales", f), "utf8")); return [j.locale, j.name || j.locale];
}));
const configs = fs.readdirSync(path.join(src, "config")).filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5)).sort();
const out = `// Made by tools/sync-atlaslab.mjs from AtlasLab ${version}. Don't edit by hand: run the tool again.
export const ATLAS_SYNCED = ${JSON.stringify(version)};
export const ATLAS_DEFAULTS = ${JSON.stringify(DEFAULTS, null, 1)};
export const ATLAS_STRINGS = ${JSON.stringify(DEFAULT_STRINGS)};
export const ATLAS_LOCALES = ${JSON.stringify(locales)};
export const ATLAS_CONFIGS = ${JSON.stringify(configs)};
`;
fs.writeFileSync(new URL("../js/atlas-defaults.js", import.meta.url), out);
console.log(`js/atlas-defaults.js from AtlasLab ${version}: ${Object.keys(DEFAULTS).length} settings, ${Object.keys(DEFAULT_STRINGS).length} pieces of wording, ${locales.length} languages, ${configs.length} configs`);
