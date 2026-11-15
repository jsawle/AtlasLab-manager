"""Browser tests for the manager: the distributor's form with the real AtlasLab in its preview, and the team's page with
ArcGIS Online's answers for a signed-in team member played back by the test.

Run:  python3 tests/live.py --atlaslab ../AtlasLab [--proxy URL] [--axe path/to/axe.min.js]

Both sites are served from the folders on disk at their real addresses (https://jsawle.github.io/AtlasLab-manager/ and
https://jsawle.github.io/AtlasLab/), so the preview's origin check is the real one. AtlasLab needs 5.0.0-beta.58 or later.
The map library comes from js.arcgis.com and the groups are checked on www.arcgis.com, so this needs the network.
"""
import argparse, glob, json, mimetypes, os, pathlib, re, sys, tempfile, time, urllib.parse
from playwright.sync_api import sync_playwright

HERE = pathlib.Path(__file__).resolve().parent
MANAGER = HERE.parent
SITE = "https://jsawle.github.io"
PNG = bytes.fromhex("89504e470d0a1a0a0000000d4948445200000001000000010806000000" "1f15c4890000000d49444154789c636460f8cf500f00038601805a347d6b0000000049454e44ae426082")

def serve(ctx, atlaslab):
    roots = {"/AtlasLab-manager/": MANAGER, "/AtlasLab/": pathlib.Path(atlaslab).resolve()}
    def handle(route):
        url = route.request.url.split("?")[0].split("#")[0]
        path = url[len(SITE):]
        for prefix, folder in roots.items():
            if path.startswith(prefix):
                rel = path[len(prefix):] or "index.html"
                if rel.endswith("/"): rel += "index.html"
                f = folder / rel
                if f.is_file():
                    ctype = mimetypes.guess_type(str(f))[0] or "application/octet-stream"
                    if f.suffix in (".js", ".mjs"): ctype = "text/javascript"
                    return route.fulfill(status=200, body=f.read_bytes(), headers={"Content-Type": ctype, "Cache-Control": "no-store"})
        return route.fulfill(status=404, body="not found")
    ctx.route(SITE + "/**", handle)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--atlaslab", required=True); ap.add_argument("--proxy", default=os.environ.get("HTTPS_PROXY", "")); ap.add_argument("--axe", default=os.environ.get("MANAGER_AXE", ""))
    ap.add_argument("--only", default="")
    a = ap.parse_args()
    found = sorted(glob.glob("/opt/pw-browsers/chromium-*/chrome-linux*/chrome"))
    failures, checks = [], [0]
    def check(cond, msg):
        checks[0] += 1; print(("  ok   " if cond else "  FAIL ") + msg, flush=True)
        if not cond: failures.append(msg)
    def axe(page, what):
        if not a.axe: return
        page.evaluate(pathlib.Path(a.axe).read_text())
        res = page.evaluate("async () => (await axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'], exclude: [['iframe']] })).violations.map(v => v.id + ' (' + v.nodes.length + '): ' + v.nodes.slice(0, 2).map(n => n.target.join(' ')).join('; '))")
        check(not res, "axe: no WCAG 2.1 A/AA problems on " + what + ("" if not res else ": " + " | ".join(res)))
    with sync_playwright() as p:
        launch = {}
        if found: launch["executable_path"] = found[-1]
        if a.proxy: launch["proxy"] = {"server": a.proxy}
        browser = p.chromium.launch(**launch)
        if a.only in ("", "form"): form_tests(browser, a, check, axe)
        if a.only in ("", "team"): team_tests(browser, a, check, axe)
        browser.close()
    print("%d/%d checks passed" % (checks[0] - len(failures), checks[0]), flush=True)
    sys.exit(1 if failures else 0)

def form_tests(browser, a, check, axe):
    ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    serve(ctx, a.atlaslab)
    errors = []
    page = ctx.new_page()
    page.on("console", lambda m: errors.append(m.text) if m.type == "error" and (m.location or {}).get("url", "").startswith(SITE + "/AtlasLab-manager/") else None)   # the preview's own messages are AtlasLab's
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.goto(SITE + "/AtlasLab-manager/form.html")
    page.wait_for_selector("#editor details.section")
    page.wait_for_function("() => /No problems found/.test(document.querySelector('.check-summary').textContent) && document.querySelector('[data-info=contentGroup]').textContent.includes('maps')", timeout=60000)
    check(True, "the form opens with AtlasLab's own settings and no problems; the content group is found online: " + page.inner_text("[data-info=contentGroup]"))
    frame = lambda: page.frame_locator("#preview iframe")
    def preview_title(t):
        page.wait_for_function("(t) => { const d = document.querySelector('#preview iframe').contentDocument; return !!(d && d.title === t && d.querySelector('arcgis-map')); }", arg=t, timeout=90000)
        return True
    check(preview_title("AtlasLab"), "the preview runs the real AtlasLab")
    axe(page, "the distributor's form")

    page.get_by_label("App name", exact=True).fill("Mapas Escolares")
    page.get_by_label("Language").select_option("es")
    check(preview_title("Mapas Escolares"), "a change shows in the preview: the name")
    lang = page.evaluate("() => document.querySelector('#preview iframe').contentDocument.documentElement.lang")
    check(lang == "es", "and the language (%s)" % lang)

    # a contrast problem, found and taken to
    page.get_by_label("Brand colour", exact=True).fill("#ffeb3b")
    page.wait_for_function("() => /problem/.test(document.querySelector('.check-summary').textContent)")
    page.get_by_label("Brand colour", exact=True).fill("#7a1f5c")
    page.wait_for_function("() => /No problems/.test(document.querySelector('.check-summary').textContent)")
    page.locator("#editor details").nth(2).locator("input.hex").nth(1).fill("#ffff00")   # header background yellow…
    page.get_by_label("Header text", exact=True).fill("#ffffff")                         # …with white text
    page.wait_for_function("() => /problem/.test(document.querySelector('.check-summary').textContent)")
    page.locator("ul.checks li.error button").first.click()
    focused = page.evaluate("() => document.activeElement && document.activeElement.closest('.field') && document.activeElement.closest('.field').querySelector('label').textContent")
    check(focused == "Header text", "a problem in Checks takes you to its setting (%s)" % focused)
    page.get_by_label("Header text", exact=True).fill("")
    page.locator("#editor details").nth(2).locator("input.hex").nth(1).fill("#ffffff")

    # a logo: uploaded, needs a description
    with tempfile.NamedTemporaryFile(suffix=".png", delete=False) as t: t.write(PNG); logo = t.name
    page.locator("#editor details").nth(1).locator("input[type=file]").first.set_input_files(logo)
    page.wait_for_function("() => [...document.querySelectorAll('ul.checks li')].some(li => li.textContent.includes('Describe the logo'))")
    check(True, "a logo with no description is a problem")
    page.get_by_label("Logo description").fill("Esri Panamá")
    page.wait_for_function("() => /No problems/.test(document.querySelector('.check-summary').textContent)")
    page.wait_for_function("() => { const d = document.querySelector('#preview iframe').contentDocument; const i = d && d.getElementById('logoImg'); return !!i && !i.hidden && i.src.startsWith('data:image/png') && d.title === 'Mapas Escolares'; }", timeout=90000)
    check(True, "the preview reloads and shows the logo in the header")

    # save the draft
    page.click("#saveBtn")
    check("name first" in page.inner_text("#status"), "saving asks for the partner's name first")
    page.fill("#partner", "Esri Panamá — Mapas Escolares")
    page.fill("#notes", "Por favor publicar antes de enero.")
    with page.expect_download() as dl: page.click("#saveBtn")
    d = dl.value
    data = json.loads(open(d.path(), encoding="utf-8").read())
    check(d.suggested_filename.startswith("atlaslab-draft-esri-panama-mapas-escolares-"), "the draft file is named for the partner: " + d.suggested_filename)
    cfg = data["config"]
    check(data["type"] == "AtlasLabPartnerDraft" and cfg["appName"] == "Mapas Escolares" and cfg["locale"] == "es" and cfg["logo"]["url"].startswith("data:image/png") and cfg["theme"] == {"brand": "#7a1f5c"}, "the draft holds only what was changed: " + ", ".join(sorted(cfg)))
    check("contentGroup" not in cfg and "features" not in cfg, "settings left as AtlasLab has them aren't in it")
    path = os.path.join(tempfile.mkdtemp(), d.suggested_filename); d.save_as(path)

    # open it again in a fresh form
    page2 = ctx.new_page(); page2.goto(SITE + "/AtlasLab-manager/form.html"); page2.wait_for_selector("#editor details.section")
    page2.set_input_files("#draftFile", path)
    page2.wait_for_function("() => document.getElementById('partner').value.length > 0")
    check(page2.get_by_label("App name", exact=True).input_value() == "Mapas Escolares" and page2.input_value("#partner") == "Esri Panamá — Mapas Escolares", "a saved draft opens again in the form")
    check(page2.get_by_label("Logo description").input_value() == "Esri Panamá", "with its logo and description")
    check(not [e for e in errors if "favicon" not in e], "no errors in the page: " + "; ".join(errors[:3]))
    ctx.close()

class FakeArcGIS:
    """ArcGIS Online's answers for a signed-in team member, kept in memory: items, their data, sharing, usage."""
    ORG = "HNLEA4GfnbCFQZGa"   # GIS 4 Schools
    def __init__(self, org=None):
        self.org = org or self.ORG
        self.items, self.data, self.calls, self.n = {}, {}, [], 0
        self.add("Esri Panamá — Mapas Escolares", {"configVersion": 3, "appName": "Mapas Escolares", "locale": "es", "theme": {"brand": "#005293"}}, access="private")
    def add(self, title, data, access="private", keywords=("AtlasLabPartnerConfig", "Web Map")):
        self.n += 1; iid = ("%032x" % (0xabc000 + self.n))
        self.items[iid] = {"id": iid, "title": title, "owner": "tester", "orgId": self.ORG, "access": access, "numViews": 1234 * self.n, "modified": 1794700000000, "typeKeywords": list(keywords), "type": "Web Mapping Application"}
        self.data[iid] = data; return iid
    def handle(self, route):
        req = route.request
        cors = {"Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS"}
        if req.method == "OPTIONS": return route.fulfill(status=204, headers=cors)
        url = urllib.parse.urlparse(req.url); path = url.path.replace("/sharing/rest", "")
        q = dict(urllib.parse.parse_qsl(url.query)); 
        if req.post_data: q.update(dict(urllib.parse.parse_qsl(req.post_data)))
        self.calls.append((req.method, path, q, req.headers.get("x-esri-authorization", "")))
        def ok(body): return route.fulfill(status=200, headers={**cors, "Content-Type": "application/json"}, body=json.dumps(body))
        m = re.match(r"^/content/items/([0-9a-f]{32})(/data|/groups)?$", path)
        if path == "/community/self": return ok({"username": "tester", "fullName": "Test Person", "orgId": self.org, "groups": []})
        if path == "/search" and "AtlasLabPartnerConfig" in q.get("q", ""): return ok({"total": 0, "results": sorted([i for i in self.items.values() if "AtlasLabPartnerConfig" in i["typeKeywords"]], key=lambda i: i["title"])})
        if path == "/search" and "AtlasLabPartnerRegister" in q.get("q", ""): return ok({"total": 0, "results": [i for i in self.items.values() if "AtlasLabPartnerRegister" in i["typeKeywords"]]})
        if path == "/search" and "group:" in q.get("q", "") and req.headers.get("x-esri-authorization"):
            return ok({"total": 121, "results": [{"id": "%032x" % k, "title": t, "type": ty, "numViews": v} for k, (t, ty, v) in enumerate([("Biomes", "Web Map", 265641), ("Plate Tectonics", "Web Map", 202555), ("La Palma 3D", "Web Scene", 485)])]})
        if m and m.group(1) not in self.items: return route.continue_()      # a real item (a basemap, a map): ArcGIS Online itself
        if m and not m.group(2): return ok(self.items[m.group(1)])
        if m and m.group(2) == "/data": return ok(self.data.get(m.group(1), {}))
        if m and m.group(2) == "/groups": return ok({"admin": [], "member": [], "other": []})
        mm = re.match(r"^/content/users/([^/]+)/addItem$", path)
        if mm:
            kws = q.get("typeKeywords", "").split(",")
            iid = self.add(q["title"], json.loads(q["text"]), keywords=kws); self.items[iid]["numViews"] = 0
            return ok({"success": True, "id": iid})
        mm = re.match(r"^/content/users/([^/]+)/items/([0-9a-f]{32})/(update|share)$", path)
        if mm:
            iid = mm.group(2)
            if mm.group(3) == "update":
                if "text" in q: self.data[iid] = json.loads(q["text"])
                if "url" in q: self.items[iid]["url"] = q["url"]
            else: self.items[iid]["access"] = "public" if q.get("everyone") == "true" else "private"
            return ok({"success": True, "id": iid})
        if re.match(r"^/portals/[^/]+/usage$", path):
            start = int(q["startTime"]); return ok({"data": [{"num": [[str(start + d * 86400000), str(20 + (d * 7) % 13)] for d in range(0, 60)]}]})
        return route.continue_()      # anything else (the form's checks of public groups) goes to ArcGIS Online itself

def team_page(browser, a, fake):
    ctx = browser.new_context(viewport={"width": 1440, "height": 1000}, accept_downloads=True)
    serve(ctx, a.atlaslab)
    ctx.route("https://www.arcgis.com/sharing/rest/**", fake.handle)
    session = json.dumps({"token": "made-up-token", "refresh": "", "username": "tester", "expires": int(time.time() * 1000) + 3600000})
    ctx.add_init_script("sessionStorage.setItem('atlaslabManager.session', %s);" % json.dumps(session))
    page = ctx.new_page()
    page.goto(SITE + "/AtlasLab-manager/")
    return ctx, page

def team_tests(browser, a, check, axe):
    # not in the team: refused
    ctx, page = team_page(browser, a, FakeArcGIS(org="iFGeGXTAJXnjq0YN"))
    page.wait_for_selector("text=Not for this account")
    check(True, "a member of another organization (here MapMaker's) is turned away")
    ctx.close()

    fake = FakeArcGIS()
    ctx, page = team_page(browser, a, fake)
    errors = []
    page.on("pageerror", lambda e: errors.append(str(e)))
    page.wait_for_selector("table.grid tbody tr")
    check("Test Person" in page.inner_text("#who") and "Esri Panamá" in page.inner_text("table.grid"), "a team member sees the partners")
    check(all(c[3] == "Bearer made-up-token" for c in fake.calls if c[1] in ("/community/self", "/search")) and not any("made-up-token" in json.dumps(c[2]) for c in fake.calls), "the token goes in a header, never in an address or a form")
    axe(page, "the partners list")

    # set up a new partner
    page.get_by_role("button", name="Set up a new partner").click()
    page.fill("#newName", "Esri Nederland — Schoolatlas")
    page.select_option("#newFrom", "mapmaker")
    page.click("dialog button[value=ok]")
    page.wait_for_selector("h2:has-text('Esri Nederland — Schoolatlas')")
    new_id = [i for i, it in fake.items.items() if it["title"].startswith("Esri Nederland")][0]
    it = fake.items[new_id]
    check("AtlasLabPartnerConfig" in it["typeKeywords"] and it["access"] == "private" and it.get("url") == "https://jsawle.github.io/AtlasLab/?appid=" + new_id, "a new partner is a private item marked for AtlasLab, its link set")
    check(fake.data[new_id] == {"configVersion": 1, "extends": "mapmaker", "appName": "Esri Nederland — Schoolatlas"}, "starting from MapMaker's settings: " + json.dumps(fake.data[new_id]))
    reg = [i for i in fake.items.values() if "AtlasLabPartnerRegister" in i["typeKeywords"]]
    check(len(reg) == 1 and reg[0]["access"] == "private" and fake.data[reg[0]["id"]]["history"][-1]["action"] == "set up", "the private register records who set it up")
    page.wait_for_function("() => { const d = document.querySelector('#preview iframe') && document.querySelector('#preview iframe').contentDocument; return !!(d && d.title === 'Esri Nederland — Schoolatlas'); }", timeout=90000)
    check(True, "its preview shows MapMaker's settings with the new name")
    axe(page, "a partner's page")

    # change it and publish
    page.get_by_label("App name", exact=True).fill("Schoolatlas")
    page.get_by_label("Language").select_option("es")
    page.wait_for_function("() => document.querySelectorAll('.changes tbody tr').length === 2")
    check("appName" in page.inner_text(".changes") and "locale" in page.inner_text(".changes"), "the changes from what is live are listed")
    page.get_by_role("button", name="Publish", exact=True).click()
    page.click("dialog button[value=ok]")
    page.wait_for_selector("text=Published config version 2")
    check(fake.data[new_id]["appName"] == "Schoolatlas" and fake.data[new_id]["configVersion"] == 2 and fake.data[new_id]["extends"] == "mapmaker", "publishing writes the config into the item, version 2")
    hist = fake.data[reg[0]["id"]]["history"][-1]
    check(hist["action"] == "published" and hist["who"] == "tester" and sorted(hist["changed"]) == ["appName", "locale"], "the register records who published what")
    page.wait_for_function("() => document.querySelector('.changes').textContent.includes('Nothing different')")
    check(True, "afterwards nothing is waiting to publish")

    # make it live
    page.get_by_role("button", name="Make live", exact=True).click(); page.click("dialog button[value=ok]")
    page.wait_for_function("() => /is live\\.|Couldn't|before making/.test(document.getElementById('status').textContent)")
    check(fake.items[new_id]["access"] == "public" and "is live." in page.inner_text("#status"), "Make live shares the item with everyone: " + page.inner_text("#status"))

    # a distributor's draft with a problem in it: shown, not publishable
    draft = {"type": "AtlasLabPartnerDraft", "draftVersion": "1.0", "partner": "Esri Panamá", "liveItem": new_id, "notes": "Nuevo color.", "savedAt": "2026-11-15T10:00:00Z",
             "config": {"configVersion": 2, "extends": "mapmaker", "appName": "Schoolatlas", "locale": "es", "theme": {"brand": "#ffeb3b", "brandInk": "#ffffff"}}}
    path = os.path.join(tempfile.mkdtemp(), "atlaslab-draft-esri-panama-2026-11-15.json"); open(path, "w").write(json.dumps(draft))
    page.click("nav.tabs >> text=Partners")
    page.wait_for_selector("table.grid tbody tr")
    page.set_input_files("#teamDraft", path)
    page.wait_for_selector("text=The partner's notes")
    page.wait_for_function("() => document.querySelectorAll('.changes tbody tr').length === 2")
    check("theme.brand" in page.inner_text(".changes") and "Nuevo color." in page.inner_text("main"), "a draft opens on its partner's page with its notes and changes")
    page.get_by_role("button", name="Publish", exact=True).click()
    page.wait_for_selector("#status:has-text('Fix the')")
    check(fake.data[new_id]["configVersion"] == 2, "a draft with a problem can't be published")

    # usage
    page.click("nav.tabs >> text=Usage")
    page.wait_for_selector("dialog:has-text('Leave without publishing?')")
    check(True, "leaving a page with unpublished changes asks first")
    page.click("dialog button[value=ok]")
    page.wait_for_selector("figure.chart-wrap svg path", state="attached")
    check("App opens, all time" in page.inner_text(".tiles") and "Biomes" in page.inner_text("main"), "usage shows the app's opens, a chart by day and the content group's maps")
    usage = [c for c in fake.calls if c[1].endswith("/usage")]
    check(usage and usage[0][2]["etype"] == "svcusg" and usage[0][2]["period"] == "1d" and usage[0][2]["name"] in fake.items, "daily figures are asked of ArcGIS Online's usage records for the item")
    page.focus(".plot"); page.keyboard.press("End")
    check(not page.locator(".tip").is_hidden() and "opens" in page.inner_text(".tip"), "the chart can be read by keyboard: " + page.inner_text(".tip"))
    axe(page, "the usage page")
    check(not errors, "no errors in the page: " + "; ".join(errors[:3]))
    ctx.close()

if __name__ == "__main__":
    main()
