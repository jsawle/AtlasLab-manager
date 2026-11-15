// The ArcGIS Online REST calls the team's page makes. The token goes in the request body or an Authorization header,
// never in an address.
import { SETTINGS } from "./settings.js?v=1.0.0";
import { token } from "./auth.js?v=1.0.0";

const REST = SETTINGS.portal + "/sharing/rest";

async function call(path, params = {}, { post = false } = {}) {
  const t = await token();
  const body = new URLSearchParams({ f: "json", ...params });
  const init = { method: post ? "POST" : "GET", headers: {} };
  if (t) init.headers["X-Esri-Authorization"] = "Bearer " + t;
  let url = REST + path;
  if (post) { init.body = body; init.headers["Content-Type"] = "application/x-www-form-urlencoded"; } else url += "?" + body.toString();
  const r = await fetch(url, init);
  const j = await r.json();
  if (j && j.error) { const e = new Error(j.error.message || "ArcGIS Online refused the request"); e.code = j.error.code; throw e; }
  return j;
}

export const self = () => call("/community/self");
export const getItem = (id) => call(`/content/items/${id}`);
export async function getItemData(id) {
  const t = await token();
  const r = await fetch(`${REST}/content/items/${id}/data?f=json`, { headers: t ? { "X-Esri-Authorization": "Bearer " + t } : {} });
  const text = await r.text();
  if (!text.trim()) return {};
  const j = JSON.parse(text);
  if (j && j.error) throw new Error(j.error.message || "Couldn't read the item's data");
  return j;
}
export const search = (q, extra = {}) => call("/search", { q, num: 100, ...extra });

// The partners' config items the signed-in member can see, in the allowed organizations.
export function partnerItems() {
  const orgs = SETTINGS.partnerOrgs.map((o) => "orgid:" + o).join(" OR ");
  return search(`typekeywords:"${SETTINGS.partnerKeyword}" AND (${orgs})`, { sortField: "title", sortOrder: "asc" }).then((r) => r.results || []);
}

export async function addItem(username, { title, snippet, description, tags, typeKeywords, type, text }) {
  return call(`/content/users/${encodeURIComponent(username)}/addItem`, {
    title, type, snippet: snippet || "", description: description || "", tags: (tags || []).join(","), typeKeywords: (typeKeywords || []).join(","), text: JSON.stringify(text)
  }, { post: true });
}
// Updates an item's details or data. `owner` is the item's owner: members of a shared-update group use the owner's path.
export const updateItem = (owner, id, params) => call(`/content/users/${encodeURIComponent(owner)}/items/${id}/update`, params, { post: true });
export const setData = (owner, id, data) => updateItem(owner, id, { text: JSON.stringify(data) });
// Who an item is shared with. Making a partner live is sharing with everyone; taking it offline stops that
// (everyone=false: "the item will not be shared with the public"). Sharing with the team's shared-update group needs
// confirmItemControl. Only the item's owner or an administrator can change sharing.
export const share = (owner, id, { everyone, org = false, groups = [] }) =>
  call(`/content/users/${encodeURIComponent(owner)}/items/${id}/share`, { everyone: String(!!everyone), org: String(!!org), groups: groups.join(","), ...(groups.length ? { confirmItemControl: "true" } : {}) }, { post: true });
export const itemGroups = (id) => call(`/content/items/${id}/groups`);

// Daily views of an item, from ArcGIS Online's usage records (the item's owner or an administrator of its organization).
// Asked in windows of up to 60 days, as Esri's own Python API does. Returns [[day (ms), views], …].
export async function dailyViews(orgId, itemId, days = 90) {
  const end = Date.now(), out = [];
  for (let to = end; to > end - days * 864e5; to -= 60 * 864e5) {
    const from = Math.max(end - days * 864e5, to - 60 * 864e5);
    const r = await call(`/portals/${orgId}/usage`, { startTime: Math.round(from), endTime: Math.round(to), period: "1d", vars: "num", groupby: "name", etype: "svcusg", name: itemId }, { post: true });
    const rows = (r.data && r.data[0] && r.data[0].num) || [];
    for (const [t, v] of rows) out.push([Number(t), Number(v)]);
  }
  const byDay = new Map();
  for (const [t, v] of out) byDay.set(t, v);   // windows can share a day: keep one
  return [...byDay.entries()].sort((a, b) => a[0] - b[0]);
}

// The most viewed maps in a group, as anyone can see them (public items only).
export const topMaps = (groupId, num = 15) =>
  call("/search", { q: `group:${groupId} AND (type:"Web Map" OR type:"Web Scene")`, num, sortField: "numviews", sortOrder: "desc" }).then((r) => ({ total: r.total, items: r.results || [] }));
