# AtlasLab manager (1.0.0)

The education team's tool for partners' versions of [AtlasLab](https://github.com/jsawle/AtlasLab) (Atlas/MapMaker 5.0): Esri distributors, National Geographic and others. One AtlasLab app, one config per partner; this sets them up, takes partners' changes, checks and publishes them, and shows how much each version is used.

| Page | Who it's for | Sign-in |
|---|---|---|
| `https://jsawle.github.io/AtlasLab-manager/` | The education team | ArcGIS, members of the team's group |
| `https://jsawle.github.io/AtlasLab-manager/form.html` | Distributors and partners | None |

## How a partner's version works

- **The config lives in an ArcGIS Online item**, one per partner, owned by the education team. The partner's app is `https://jsawle.github.io/AtlasLab/?appid=<item ID>`. The items are kept in GIS 4 Schools (`gis-4-schools.maps.arcgis.com`), not the MapMaker organization. AtlasLab (5.0.0-beta.61 or later) only accepts public items of GIS 4 Schools marked `AtlasLabPartnerConfig`, so nobody else can dress the app in their own name, links and content.
- **What's in it** is what students see anyway: the name, logo, colours, language, content group, start view, units, links, notices, which tools are on and any wording of their own. Nothing secret, no contacts, no notes. Anyone who opens a live partner's app can read it, just as MapMaker's own config is public today.
- **What stays private**: a partner before it goes live, the team's notes on each partner, and the record of who published what (one private "register" item), and drafts, which go back and forth through the partner's Teams channel.

## The flow

1. **Set up a new partner** (team page): a private item, starting from AtlasLab's own settings, MapMaker's, or a copy of another partner's.
2. **The partner changes their settings** in the form, with the real AtlasLab previewed beside it and the checks listed, and saves a **draft file**. They put it in their Teams channel. To change something already live, the team downloads the live config as a draft file from the partner's page and puts it in the channel first.
3. **The team reviews the draft** (Review a draft file): every setting it changes from what is live, the checks, the preview, and the partner's notes. **Publish** writes it into the item; a draft with problems can't be published.
4. **Make live** shares the item with everyone; **Take offline** stops it, and the link then opens the default AtlasLab with a message.

## Checks

Before a draft is saved or published: IDs are IDs; text on the brand, header and button colours reaches 4.5 to 1 (WCAG 2.1 AA); links are `https://`; a logo is an uploaded PNG, SVG, JPEG or WebP under 100 KB with a description; the sign-in message uses only simple HTML; wording changes are wording AtlasLab has, with the right `{placeholders}`; the language has a file in AtlasLab. Online, without signing in: the content and basemap groups exist, are public and have maps, and the default basemap is a public web map.

Logos are kept inside the config (`data:image/…`), so no student's browser ever fetches a picture from a partner's own website.

## Usage, and student privacy

**AtlasLab counts nothing.** It has no analytics, cookies or identifiers of its own. The figures here are ArcGIS Online's own:

- **App opens per partner**: AtlasLab reads the partner's config item each time it opens, and ArcGIS Online counts that as a view of the item. All-time totals for everyone on the team; daily figures for the past 90 days for the item's owner or an administrator of its organization (`/portals/<org>/usage`, the call Esri's Python API `item.usage()` makes).
- **Map views**: the most viewed maps in the partner's content group. These are all views of each map in any app (MapMaker, other partners, Map Viewer), not only this partner's: ArcGIS Online doesn't split a map's views by app.

Splitting map views by partner would need AtlasLab to report each opening to a server of ours. That is new data collection from children, and since the FTC's 2025 COPPA changes even identifiers used only to run the service need a published notice. It is left out until Esri's privacy team has looked at it.

## Setting it up (once)

1. **Sign-in**: add `https://jsawle.github.io/AtlasLab-manager/` as a redirect URI of the app registration in `js/settings.js` (`clientId`, now AtlasLab's own `MUSDSIajsXZwJeZQ`).
2. **Team group**: make a **shared-update** group in GIS 4 Schools, add the team, and put its ID in `teamGroup`. Until then any member of GIS 4 Schools gets in, with a notice. New partners are shared with the group, so any member can publish; only the item's owner or an administrator can make a partner live or take it offline.
3. **GitHub Pages**: Settings > Pages > Deploy from a branch: `main`, `/ (root)`.
4. **Organizations**: `partnerOrgs` here and `PARTNER_ORGS` in AtlasLab's `src/config.js` must list the same organizations.

## Keeping in step with AtlasLab

`js/atlas-defaults.js` is AtlasLab's built-in settings, English wording, languages and configs, copied from a clone of AtlasLab:

```
node tools/sync-atlaslab.mjs ../AtlasLab
```

Run it when AtlasLab changes its defaults, wording or languages. The Versions window shows which AtlasLab version it came from (now 5.0.0-beta.61).

When AtlasLab moves host, its new address goes in `atlasUrl` here and in the pages' `frame-src` and `connect-src`; the manager's address goes in AtlasLab's `PREVIEW_ORIGINS`, and a `frame-ancestors` header there must allow it.

## Versions

App 1.0.0. Config form 1.0, Checks 1.0, Preview 1.0, Draft files 1.0, Comparing configs 1.0, Publishing 1.0, Usage 1.0, Partner register 1.0. All listed in the Versions window.

## Tests

- `npm test`: the pure parts (49 checks: the smallest config, differences, contrast, IDs pasted as addresses, HTML, drafts, every check, the online checks) and the structure (52: every file loaded with the app version, no inline script, a Content Security Policy and the credit on each page).
- `python3 tests/live.py --atlaslab ../AtlasLab [--axe axe.min.js]`: in Chromium, both sites served at their real addresses. The form (15 checks): the real AtlasLab previewed, a contrast problem found and taken to, a logo, a draft saved and opened again. The team's page (22 checks), with ArcGIS Online's answers played back: turned away from another organization, the token only ever in a header, setting up a partner, the register, publishing, making live, a draft with a problem refused, leaving with unpublished changes, usage read by keyboard. axe-core (WCAG 2.1 A and AA) on each page.

## Not yet tried for real

- **Signing in with a real account.** The team's page ran against ArcGIS Online's answers played back by the test. Checked against ArcGIS Online itself: it accepts the token in the `X-Esri-Authorization` header from this site (CORS allows it), and the usage call's parameters are Esri's own. The first real sign-in is the test of the rest.
- **That an opening of a partner's app is counted as a view of its item, for an app item.** Checked on a web map (15 Nov 2026): five reads of its data from a script, off arcgis.com, added exactly five views, counted within the hour; six reads of the item's details added none. A test map used only by AtlasLab's tests also has 1,488 views in four days. A partner's item is a Web Mapping Application, not a web map, so to confirm: note a new partner's views, open its app a few times, look again an hour later.
- **The manager's own reads count too** (a few views a visit), and so do the team's checks of a partner before it is live.
- **Renaming and rearranging toolbar tools**, which some distributors asked for: renaming works through Wording; AtlasLab has no setting for the order of its tools.

Created by Jason Sawle.
