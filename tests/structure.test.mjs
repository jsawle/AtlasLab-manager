// node tests/structure.test.mjs — every file the pages load carries the app version (?v=), the same everywhere, so a
// new release never runs beside a cached older file; and no page runs inline script (the pages' policy forbids it).
import fs from "node:fs";
import { APP_VERSION } from "../js/versions.js";
let n = 0, bad = 0;
const ok = (c, m) => { n++; if (!c) { bad++; console.error("FAIL " + m); } };
const root = new URL("..", import.meta.url).pathname;
const files = ["index.html", "form.html", ...fs.readdirSync(root + "js").map((f) => "js/" + f)];
for (const f of files) {
  const s = fs.readFileSync(root + f, "utf8");
  const refs = [...s.matchAll(/(?:from\s+|import\s+|src=|href=)["'](\.{0,2}\/?(?:js|css)?\/?[\w-]+\.(?:js|css))(\?v=[^"']*)?["']/g)];
  for (const [, path, v] of refs) ok(v === "?v=" + APP_VERSION, `${f}: ${path} is loaded as ${path}${v || ""}, not ?v=${APP_VERSION}`);
  if (f.endsWith(".html")) {
    ok(!/<script(?![^>]*\bsrc=)[^>]*>/.test(s), `${f} has no inline script`);
    ok(/Content-Security-Policy/.test(s), `${f} has a Content Security Policy`);
    ok(/Created by Jason Sawle/.test(s), `${f} carries the credit`);
  }
}
console.log(`${n - bad}/${n} structure checks passed`);
process.exit(bad ? 1 : 0);
