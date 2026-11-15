// The education team's page: partners, setting one up, reviewing a distributor's draft and publishing it, and usage.
import { h, say, ask, download, readFileText, fmtDate, fmtNum, fetchJson } from "./ui.js?v=1.0.0";
import { signIn, finishSignIn, current, signOut } from "./auth.js?v=1.0.0";
import * as agol from "./arcgis.js?v=1.0.0";
import { SETTINGS } from "./settings.js?v=1.0.0";
import { createEditor } from "./editor.js?v=1.0.0";
import { createCheckPanel } from "./check-panel.js?v=1.0.0";
import { createPreview } from "./preview.js?v=1.0.0";
import { diffConfigs, describeValue, makeDraft, readDraft, draftFileName, mergeConfig } from "./config-tools.js?v=1.0.0";
import { ATLAS_DEFAULTS } from "./atlas-defaults.js?v=1.0.0";
import { FORM_VERSION, REGISTER_VERSION } from "./versions.js?v=1.0.0";
import { wireVersions } from "./versions-ui.js?v=1.0.0";
import { lineChart, tiles, sumLast } from "./usage.js?v=1.0.0";

const $ = (id) => document.getElementById(id);
const main = $("app");
const fetchConfig = (name) => fetchJson(new URL("config/" + encodeURIComponent(name) + ".json", SETTINGS.atlasUrl).href);
const appLink = (id) => SETTINGS.atlasUrl + "?appid=" + id;
let user = null, partners = [], register = null, registerItem = null, leaveGuard = null;
wireVersions($("versionsBtn"));

// ------------------------------------------------------------------ signing in, and who may use this page
async function startUp() {
  try { await finishSignIn(); } catch (e) { say(e.message, "error"); }
  if (!current()) return showSignIn();
  try { user = await agol.self(); } catch (e) { signOut(); return showSignIn("Your sign-in has run out. Please sign in again."); }
  $("who").textContent = user.fullName ? user.fullName + " (" + user.username + ")" : user.username;
  $("signOutBtn").hidden = false;
  const inTeam = SETTINGS.teamGroup ? (user.groups || []).some((g) => g.id === SETTINGS.teamGroup) : SETTINGS.partnerOrgs.includes(user.orgId);
  if (!inTeam) return showDenied();
  if (!SETTINGS.teamGroup) say("No team group is set in js/settings.js yet, so any member of the MapMaker or GIS 4 Schools organization can use this page.", "warn");
  showPartners();
}
$("signOutBtn").addEventListener("click", () => { signOut(); user = null; $("who").textContent = ""; $("signOutBtn").hidden = true; showSignIn("Signed out."); });

function showSignIn(note) {
  setView(h("section", { class: "panel narrow" },
    h("h2", { text: "Sign in" }),
    h("p", { text: "For the education team: set up partners' versions of AtlasLab, publish their changes and see how much each is used." }),
    h("button", { type: "button", class: "btn primary", onclick: () => signIn(), text: "Sign in with ArcGIS" }),
    h("p", { class: "hint" }, "Distributors and partners: change your settings in the ", h("a", { href: "form.html", text: "partner settings form" }), " instead.")));
  if (note) say(note);
}
function showDenied() {
  setView(h("section", { class: "panel narrow" }, h("h2", { text: "Not for this account" }),
    h("p", { text: "This page is for members of the education team's group in ArcGIS Online. Ask the team to add you, or use the partner settings form." }),
    h("p", {}, h("a", { href: "form.html", text: "Partner settings form" }))));
}
function setView(...kids) { leaveGuard = null; main.replaceChildren(...kids.filter((k) => k != null && k !== false)); window.scrollTo(0, 0); }
async function leaveOk() { return !leaveGuard || !leaveGuard() || (await ask({ title: "Leave without publishing?", body: "The changes on this page haven't been published.", ok: "Leave" })) === "ok"; }

const tabs = (current) => h("nav", { class: "tabs", "aria-label": "Sections" },
  [["Partners", showPartners], ["Usage", () => showUsage()]].map(([t, go]) => h("button", { type: "button", "aria-current": t === current ? "page" : null, onclick: async () => { if (await leaveOk()) go(); }, text: t })));

// ------------------------------------------------------------------ the register: private notes and who did what
async function loadRegister() {
  if (register) return register;
  const found = await agol.search(`typekeywords:"${SETTINGS.registerKeyword}" AND orgid:${user.orgId}`, { num: 1 });
  registerItem = (found.results || [])[0] || null;
  register = registerItem ? await agol.getItemData(registerItem.id) : {};
  register.registerVersion = register.registerVersion || REGISTER_VERSION;
  register.partners = register.partners || {};
  register.history = register.history || [];
  return register;
}
async function saveRegister() {
  register.history = register.history.slice(-500);
  if (!registerItem) {
    const r = await agol.addItem(user.username, { title: "AtlasLab partner register (private)", type: "Web Mapping Application", typeKeywords: [SETTINGS.registerKeyword],
      tags: ["AtlasLab"], snippet: "The AtlasLab manager's private notes on partners and record of changes. Keep it private.", text: register });
    registerItem = { id: r.id, owner: user.username };
    if (SETTINGS.teamGroup) await agol.share(user.username, r.id, { everyone: false, groups: [SETTINGS.teamGroup] });
  } else await agol.setData(registerItem.owner, registerItem.id, register);
}
async function record(itemId, action, extra = {}) {
  try {
    await loadRegister();
    register.history.push({ when: new Date().toISOString(), who: user.username, item: itemId, action, ...extra });
    await saveRegister();
  } catch (e) { say("Done, but the change couldn't be written in the register: " + e.message, "warn"); }
}

// ------------------------------------------------------------------ partners
async function showPartners() {
  const table = h("div", { text: "Loading partners…" });
  const draftIn = h("input", { type: "file", accept: ".json,application/json", class: "visually-hidden", id: "teamDraft" });
  draftIn.addEventListener("change", () => { const f = draftIn.files[0]; draftIn.value = ""; if (f) openDraftFile(f); });
  setView(tabs("Partners"),
    h("div", { class: "actions" },
      h("button", { type: "button", class: "btn primary", onclick: setUpPartner, text: "Set up a new partner" }),
      h("label", { class: "btn" }, "Review a draft file…", draftIn),
      h("a", { class: "btn", href: "form.html", target: "_blank", rel: "noopener", text: "Partner settings form" })),
    h("h2", { text: "Partners" }), table);
  try { partners = await agol.partnerItems(); }
  catch (e) { table.textContent = "Couldn't list the partners: " + e.message; return; }
  if (!partners.length) { table.replaceChildren(h("p", { text: "No partners yet. Set one up to start." })); return; }
  table.replaceChildren(h("table", { class: "grid" },
    h("caption", { class: "visually-hidden", text: "Partners and their versions of AtlasLab" }),
    h("thead", {}, h("tr", {}, ["Partner", "Status", "App opens (all time)", "Last changed", "Organization", ""].map((t, i) => h("th", { scope: "col", class: i === 2 ? "num" : null, text: t })))),
    h("tbody", {}, partners.map((p) => h("tr", {},
      h("th", { scope: "row" }, p.title),
      h("td", {}, h("span", { class: "pill-state " + (p.access === "public" ? "live" : "off"), text: p.access === "public" ? "Live" : "Not live" })),
      h("td", { class: "num", text: fmtNum(p.numViews) }),
      h("td", { text: fmtDate(p.modified) }),
      h("td", { text: SETTINGS.orgNames[p.orgId] || p.orgId }),
      h("td", { class: "row-actions" },
        h("button", { type: "button", class: "btn small", onclick: () => showEdit(p), text: "Change", "aria-label": "Change " + p.title }), " ",
        h("button", { type: "button", class: "btn small", onclick: () => showUsage(p.id), text: "Usage", "aria-label": "Usage of " + p.title }), " ",
        p.access === "public" ? h("a", { class: "btn small", href: appLink(p.id), target: "_blank", rel: "noopener", text: "Open app", "aria-label": "Open " + p.title + "'s app" }) : null))))));
}

async function setUpPartner() {
  const name = h("input", { type: "text", id: "newName", autocomplete: "off" });
  const from = h("select", { id: "newFrom" }, h("option", { value: "", text: "AtlasLab's own settings" }), h("option", { value: "mapmaker", text: "National Geographic MapMaker's settings" }),
    partners.map((p) => h("option", { value: "item:" + p.id, text: "A copy of " + p.title })));
  const go = await ask({ title: "Set up a new partner", ok: "Set up", body: h("div", {},
    h("div", { class: "field" }, h("label", { for: "newName", text: "Partner and programme" }), h("p", { class: "hint", text: "For example “Esri Panamá — Mapas Escolares”. This is the item's title." }), name),
    h("div", { class: "field" }, h("label", { for: "newFrom", text: "Start from" }), from),
    h("p", { class: "hint", text: "The partner's config is kept in a new, private ArcGIS Online item in your organization. Nobody outside the team sees it until you make it live." })) });
  if (go !== "ok") return;
  const title = name.value.trim();
  if (!title) { say("The partner needs a name.", "error"); return; }
  try {
    say("Setting up " + title + "…");
    let config = { configVersion: 1 };
    if (from.value === "mapmaker") config.extends = "mapmaker";
    else if (from.value.startsWith("item:")) config = { ...(await agol.getItemData(from.value.slice(5))), configVersion: 1 };
    config.appName = config.appName || title;
    const r = await agol.addItem(user.username, {
      title, type: "Web Mapping Application", typeKeywords: [SETTINGS.partnerKeyword, "Web Map", "Map", "Online Map", "Mapping Site"], tags: ["AtlasLab", "partner config"],
      snippet: "The settings of " + title + "'s version of AtlasLab.",
      description: "<p>This item holds the configuration of " + title.replace(/[<>&"]/g, "") + "'s version of AtlasLab. Change it with the AtlasLab manager rather than here, so it is checked first.</p>",
      text: config });
    await agol.updateItem(user.username, r.id, { url: appLink(r.id) });
    if (SETTINGS.teamGroup) await agol.share(user.username, r.id, { everyone: false, groups: [SETTINGS.teamGroup] });
    await record(r.id, "set up", { title });
    say(title + " is set up, not yet live. Change its settings, publish them, then make it live.", "good");
    showEdit(await agol.getItem(r.id));
  } catch (e) { say("Couldn't set up the partner: " + e.message, "error"); }
}

async function openDraftFile(file) {
  const r = readDraft(await readFileText(file));
  if (!r.ok) { say(r.error, "error"); return; }
  let p = r.draft.liveItem && partners.find((x) => x.id === r.draft.liveItem);
  if (!p) {
    if (!partners.length) { say("Set up the partner first, then review the draft from its page.", "error"); return; }
    const pick = h("select", { id: "draftFor" }, partners.map((x) => h("option", { value: x.id, text: x.title })));
    const ok = await ask({ title: "Which partner is this draft for?", ok: "Review it", body: h("div", {},
      h("p", { text: "The draft from " + (r.draft.partner || "an unnamed partner") + " doesn't say which partner's app it changes." }),
      h("div", { class: "field" }, h("label", { for: "draftFor", text: "Partner" }), pick)) });
    if (ok !== "ok") return;
    p = partners.find((x) => x.id === pick.value);
  }
  showEdit(p, r.draft, file.name);
}

// ------------------------------------------------------------------ one partner: change, review, publish
async function showEdit(item, draft = null, draftName = "") {
  if (!(await leaveOk())) return;
  let live = {}, liveError = "";
  try { live = await agol.getItemData(item.id); } catch (e) { liveError = e.message; }
  try { await loadRegister(); } catch (e) { /* notes unavailable; publishing still works */ }
  const notes = h("textarea", { id: "partnerNotes", rows: 2 });
  notes.value = (register && register.partners[item.id] && register.partners[item.id].notes) || "";
  const saveNotes = h("button", { type: "button", class: "btn small", text: "Save notes" });
  const changes = h("div", { class: "changes" });
  const editorRoot = h("form", { id: "editor", "aria-label": "Settings", novalidate: true });
  const checksRoot = h("section", { class: "panel", id: "checks" });
  const previewRoot = h("div", { id: "preview" });
  const publishBtn = h("button", { type: "button", class: "btn primary", text: "Publish" });
  const liveBtn = h("button", { type: "button", class: "btn", text: item.access === "public" ? "Take offline" : "Make live" });
  const draftIn = h("input", { type: "file", accept: ".json,application/json", class: "visually-hidden" });
  const source = h("p", { class: "hint", text: draft ? "Showing the draft " + draftName + " from " + (draft.partner || "the partner") + (draft.savedAt ? ", saved " + new Date(draft.savedAt).toLocaleString() : "") + "." : "Showing what is live." });
  setView(tabs(""),
    h("h2", { text: item.title }),
    h("p", {}, h("span", { class: "pill-state " + (item.access === "public" ? "live" : "off"), text: item.access === "public" ? "Live" : "Not live" }), " ",
      item.access === "public" ? h("a", { href: appLink(item.id), target: "_blank", rel: "noopener", text: appLink(item.id) }) : h("span", { class: "hint", text: "Its link works once it is live: " + appLink(item.id) })),
    liveError ? h("p", { class: "status error", text: "Couldn't read the live config: " + liveError }) : null,
    draft && draft.notes ? h("p", { class: "status" }, h("strong", { text: "The partner's notes: " }), draft.notes) : null,
    h("div", { class: "actions" },
      h("label", { class: "btn" }, "Open a draft file…", draftIn),
      h("button", { type: "button", class: "btn", text: "Download as a draft file for the partner", onclick: () => {
        download(draftFileName(item.title), JSON.stringify(makeDraft({ partner: item.title, liveItem: item.id, config: live, formVersion: FORM_VERSION }), null, 2));
        say("Downloaded. Put it in the partner's Teams channel: they open it in the partner settings form, change it and send it back.", "good");
      } }),
      liveBtn),
    source,
    h("div", { class: "layout" }, editorRoot,
      h("aside", { class: "side", "aria-label": "Changes, checks, preview and publishing" },
        h("section", { class: "panel" }, h("h2", { text: "Changes from what is live" }), changes,
          h("div", { class: "actions" }, publishBtn), h("p", { class: "hint", text: "Partners see a published change the next time they open the app." })),
        checksRoot,
        h("section", { class: "panel" }, h("h2", { text: "Preview" }), previewRoot),
        h("section", { class: "panel" }, h("h2", { text: "Team notes (private)" }),
          h("label", { for: "partnerNotes", class: "visually-hidden", text: "Team notes" }), notes, h("div", { class: "actions" }, saveNotes)))));
  draftIn.addEventListener("change", async () => {
    const f = draftIn.files[0]; draftIn.value = ""; if (!f) return;
    const r = readDraft(await readFileText(f));
    if (!r.ok) { say(r.error, "error"); return; }
    if (r.draft.liveItem && r.draft.liveItem !== item.id && (await ask({ title: "A draft for another partner?", body: "This draft says it changes another partner's app. Review it as a change to " + item.title + " anyway?", ok: "Review it here" })) !== "ok") return;
    showEdit(item, r.draft, f.name);
  });

  const preview = createPreview(previewRoot);
  let latest = { own: live, full: {} };
  const editor = createEditor(editorRoot, { fetchConfig, onChange(own, full) { latest = { own, full }; drawChanges(); checks.run(own, full); preview.show(own); } });
  const checks = createCheckPanel(checksRoot, editor);
  const pending = () => diffConfigs(live, latest.own);
  leaveGuard = () => pending().length > 0;
  function drawChanges() {
    const d = pending();
    publishBtn.disabled = !d.length;
    if (!d.length) { changes.replaceChildren(h("p", { class: "hint", text: "Nothing different from what is live." })); return; }
    changes.replaceChildren(changeTable(d));
  }
  await editor.set(draft ? draft.config : live);

  publishBtn.addEventListener("click", async () => {
    const d = pending();
    const { errors } = await checks.run(latest.own, latest.full);
    if (errors.length) { say("Fix the " + errors.length + " problem(s) under Checks before publishing.", "error"); checksRoot.scrollIntoView(); return; }
    if ((await ask({ title: "Publish these changes?", ok: "Publish", body: h("div", {}, h("p", { text: item.title + (item.access === "public" ? " is live: students see this the next time they open the app." : " isn't live yet.") }), changeTable(d)) })) !== "ok") return;
    const next = { ...latest.own, configVersion: (Number(live.configVersion) || 0) + 1 };
    try {
      await agol.setData(item.owner, item.id, next);
      const back = await agol.getItemData(item.id);
      if (JSON.stringify(back) !== JSON.stringify(next)) throw new Error("what ArcGIS Online kept isn't what was sent");
      live = back;
      await record(item.id, "published", { configVersion: next.configVersion, changed: d.map((c) => c.path), from: draft ? (draft.partner || "a draft") + (draftName ? " (" + draftName + ")" : "") : "the team" });
      await editor.set(live);
      source.textContent = "Showing what is live (config version " + live.configVersion + ").";
      say("Published config version " + next.configVersion + " of " + item.title + ".", "good");
    } catch (e) { say("Couldn't publish: " + e.message, "error"); }
  });
  liveBtn.addEventListener("click", async () => {
    const goingLive = item.access !== "public";
    if (goingLive) {
      const { errors } = await checks.run(latest.own, latest.full);
      if (errors.length || pending().length) { say("Publish the settings, with no problems, before making the partner live.", "error"); return; }
    }
    const ok = await ask({ title: goingLive ? "Make " + item.title + " live?" : "Take " + item.title + " offline?", danger: !goingLive, ok: goingLive ? "Make live" : "Take offline",
      body: h("p", { text: goingLive ? "The item is shared with everyone, so anyone with the link can open the app: " + appLink(item.id) : "The item stops being shared with everyone. Anyone opening the link gets the default AtlasLab with a message instead of this partner's version." }) });
    if (ok !== "ok") return;
    try {
      const g = await agol.itemGroups(item.id);
      const groups = [...(g.admin || []), ...(g.member || []), ...(g.other || [])].map((x) => x.id);
      await agol.share(item.owner, item.id, { everyone: goingLive, groups });
      item = await agol.getItem(item.id);
      await record(item.id, goingLive ? "made live" : "taken offline");
      say(item.title + (item.access === "public" ? " is live." : " is offline."), "good");
      showEdit(item);
    } catch (e) { say("Couldn't change who can see it: " + e.message, "error"); }
  });
  saveNotes.addEventListener("click", async () => {
    try { await loadRegister(); register.partners[item.id] = { ...(register.partners[item.id] || {}), notes: notes.value }; await saveRegister(); say("Notes saved.", "good"); }
    catch (e) { say("Couldn't save the notes: " + e.message, "error"); }
  });
}
function changeTable(d) {
  const word = { added: "Added", removed: "Back to the app's own", changed: "Changed" };
  return h("table", { class: "grid diff" }, h("caption", { class: "visually-hidden", text: "Changes" }),
    h("thead", {}, h("tr", {}, ["Setting", "What is live", "New"].map((t) => h("th", { scope: "col", text: t })))),
    h("tbody", {}, d.map((c) => h("tr", {}, h("th", { scope: "row" }, c.path, h("br"), h("span", { class: "hint", text: word[c.kind] })),
      h("td", { class: "from", text: describeValue(c.from) }), h("td", { class: "to", text: describeValue(c.to) })))));
}

// ------------------------------------------------------------------ usage
async function showUsage(selected) {
  if (!partners.length) { try { partners = await agol.partnerItems(); } catch (e) { /* shown below */ } }
  const pick = h("select", { id: "usageFor" }, partners.map((p) => h("option", { value: p.id, text: p.title })));
  const body = h("div", {});
  setView(tabs("Usage"),
    h("p", { class: "hint", text: "From ArcGIS Online's own counts. Opening a partner's app reads its config item, which ArcGIS Online counts as a view of that item; AtlasLab itself counts nothing and keeps nothing about who opened it." }),
    partners.length ? h("div", { class: "field narrow-field" }, h("label", { for: "usageFor", text: "Partner" }), pick) : h("p", { text: "No partners yet." }), body);
  if (!partners.length) return;
  if (selected) pick.value = selected;
  const draw = async () => {
    const p = partners.find((x) => x.id === pick.value);
    body.replaceChildren(h("p", { text: "Loading…" }));
    const item = await agol.getItem(p.id).catch(() => p);
    let rows = null, rowsNote = "";
    try { rows = await agol.dailyViews(user.orgId, p.id, 90); }
    catch (e) { rowsNote = "Daily figures need the item's owner or an administrator of its organization (" + e.message + ")."; }
    const cfg = mergeConfig(ATLAS_DEFAULTS, await agol.getItemData(p.id).catch(() => ({})));
    let maps = null;
    try { maps = await agol.topMaps(cfg.contentGroup, 15); } catch (e) { /* shown below */ }
    body.replaceChildren(
      h("h2", { text: p.title }),
      tiles([["App opens, all time", fmtNum(item.numViews), item.access === "public" ? "Includes the team's own reads in this manager, a few a visit." : "Not live: these are the team's own reads in this manager."],
        ["Last 30 days", rows ? fmtNum(sumLast(rows, 30)) : "–", null], ["Last 7 days", rows ? fmtNum(sumLast(rows, 7)) : "–", null]]),
      rows ? lineChart("App opens per day, last 90 days", rows, { yLabel: "Opens" }) : h("p", { class: "hint", text: rowsNote }),
      h("h3", { text: "Most viewed maps in its content group" }),
      h("p", { class: "hint", text: "All views of each map, in any app that shows it — MapMaker, other partners' apps, Map Viewer — not only this partner's. ArcGIS Online doesn't split a map's views by app." }),
      maps ? h("table", { class: "grid" }, h("caption", { class: "visually-hidden", text: "Most viewed maps" }),
        h("thead", {}, h("tr", {}, h("th", { scope: "col", text: "Map" }), h("th", { scope: "col", text: "Type" }), h("th", { scope: "col", class: "num", text: "Views (all time)" }))),
        h("tbody", {}, maps.items.map((m) => h("tr", {}, h("td", {}, h("a", { href: SETTINGS.portal + "/home/item.html?id=" + m.id, target: "_blank", rel: "noopener", text: m.title })), h("td", { text: m.type === "Web Scene" ? "3D map" : "Map" }), h("td", { class: "num", text: fmtNum(m.numViews) })))))
        : h("p", { class: "hint", text: "Couldn't list the content group's maps." }),
      maps ? h("p", { class: "footnote", text: "The top " + maps.items.length + " of " + fmtNum(maps.total) + " maps in the group." }) : null);
  };
  pick.addEventListener("change", draw);
  draw();
}

startUp();
