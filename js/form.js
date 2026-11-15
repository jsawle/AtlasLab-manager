// The distributor's page: the config form, its checks and a preview; the result is saved as a draft file.
import { say, ask, h, download, readFileText } from "./ui.js?v=1.0.0";
import { createEditor } from "./editor.js?v=1.0.0";
import { createCheckPanel } from "./check-panel.js?v=1.0.0";
import { createPreview } from "./preview.js?v=1.0.0";
import { makeDraft, readDraft, draftFileName } from "./config-tools.js?v=1.0.0";
import { FORM_VERSION } from "./versions.js?v=1.0.0";
import { wireVersions } from "./versions-ui.js?v=1.0.0";
import { SETTINGS } from "./settings.js?v=1.0.0";
import { fetchJson } from "./ui.js?v=1.0.0";

const $ = (id) => document.getElementById(id);
const fetchConfig = (name) => fetchJson(new URL("config/" + encodeURIComponent(name) + ".json", SETTINGS.atlasUrl).href);
let liveItem = "", dirty = false, loading = false;
const preview = createPreview($("preview"));
const editor = createEditor($("editor"), {
  fetchConfig,
  onChange(own, full) { if (!loading) dirty = true; checks.run(own, full); preview.show(own); }
});
const checks = createCheckPanel($("checks"), editor);
wireVersions($("versionsBtn"));

async function start(cfg, from) {
  loading = true;
  await editor.set(cfg);
  loading = false; dirty = false;
  $("startedFrom").textContent = from;
}
$("newBtn").addEventListener("click", async () => {
  if (dirty && !(await ask({ title: "Start again?", body: "The changes you've made here aren't saved in a draft file yet.", ok: "Start again" }))) return;
  liveItem = ""; $("partner").value = ""; $("notes").value = "";
  await start({}, "A new set of settings, from AtlasLab's own.");
});
$("draftFile").addEventListener("change", async (e) => {
  const f = e.target.files[0]; e.target.value = "";
  if (!f) return;
  const r = readDraft(await readFileText(f));
  if (!r.ok) { say(r.error, "error"); return; }
  liveItem = r.draft.liveItem; $("partner").value = r.draft.partner; $("notes").value = r.draft.notes;
  await start(r.draft.config, "From " + f.name + (r.draft.savedAt ? " (saved " + new Date(r.draft.savedAt).toLocaleString() + ")" : "") + ".");
  say("Opened " + f.name + ".", "good");
});
$("saveBtn").addEventListener("click", async () => {
  const partner = $("partner").value.trim();
  if (!partner) { say("Give the programme or partner's name first, so the education team knows whose draft it is.", "error"); $("partner").focus(); return; }
  const { own, full } = editor.get();
  const { errors } = await checks.run(own, full);
  if (errors.length && !(await ask({ title: "Save with problems?", body: h("p", { text: errors.length + " problem(s) are listed under Checks. The education team can't publish the draft until they're fixed. Save it anyway?" }), ok: "Save anyway" }))) return;
  const draft = makeDraft({ partner, liveItem, notes: $("notes").value, config: own, formVersion: FORM_VERSION });
  download(draftFileName(partner), JSON.stringify(draft, null, 2));
  dirty = false;
  say("Draft saved as " + draftFileName(partner) + ". Put it in your Teams channel and let the education team know.", "good");
});
window.addEventListener("beforeunload", (e) => { if (dirty) { e.preventDefault(); e.returnValue = ""; } });
await start({}, "A new set of settings, from AtlasLab's own.");
