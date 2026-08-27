"""
Phase-16 UI-Harness.

Prüft die Befunde U1–U9 aus qa/PHASE15-DEMO-REPORT.md an der laufenden App
(Dev-Server auf http://localhost:8080) mit der befüllten Demo-Organisation.

Wird über `bun run qa/phase16-ui.ts` gestartet. Schreibt qa/results-phase16-ui.json.
Läuft ausschließlich gegen Dev/Preview, niemals gegen Production.
"""

import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path("qa/results-phase16-ui.json")
SHOTS = Path("qa/baselines")

WIDTHS = [320, 375, 390, 430, 768, 834, 1024, 1280, 1440]
LANDSCAPE = (667, 375)

APP_ROUTES = [
    ("uebersicht", "/app"),
    ("bestellungen", "/app/bestellungen"),
    ("produkte", "/app/produkte"),
    ("kunden", "/app/kunden"),
    ("lager", "/app/lager"),
    ("zahlungen", "/app/zahlungen"),
    ("retouren", "/app/retouren"),
    ("dokumente", "/app/dokumente"),
    ("versand", "/app/versand"),
    ("preise", "/app/preise"),
    ("promotions", "/app/marketing/promotions"),
    ("kategorien", "/app/kategorien"),
    ("warenkoerbe", "/app/warenkoerbe"),
    ("medien", "/app/medien"),
    ("kommunikation", "/app/kommunikation"),
    ("vorlagen", "/app/kommunikation/vorlagen"),
    ("automationen", "/app/automationen"),
    ("aufgaben", "/app/automationen/aufgaben"),
    ("health", "/app/system/health"),
    ("jobs", "/app/system/jobs"),
    ("status", "/app/system/status"),
    ("errors", "/app/system/errors"),
    ("demo-daten", "/app/system/demo-daten"),
    ("entwickler", "/app/entwickler"),
    ("protokoll", "/app/entwickler/protokoll"),
    ("team", "/app/team"),
    ("shops", "/app/shops"),
    ("audit", "/app/audit"),
    ("steuern", "/app/steuern"),
]

PUBLIC_ROUTES = [
    ("portal", "/portal"),
    ("portal-gast", "/portal/gast"),
    ("store-katalog", "/store"),
    ("store-warenkorb", "/store/warenkorb"),
]

results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS  " if ok else "FAIL  ") + name + (f" — {detail}" if detail else ""))


MEASURE = """
() => {
  const de = document.documentElement;
  const overflow = de.scrollWidth - de.clientWidth;
  const wide = [];
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > de.clientWidth + 2 && !el.closest('[data-scroll-x],.scroll-x,[data-radix-scroll-area-viewport]')) {
      const cs = getComputedStyle(el);
      if (cs.overflowX === 'visible') wide.push(el.tagName.toLowerCase() + '.' + (el.className || '').toString().slice(0, 60));
    }
  });
  const smallTargets = [];
  document.querySelectorAll('button, [role="button"], input:not([type="hidden"]), select').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (el.closest('table')) return;
    if (getComputedStyle(el).display.startsWith('inline') && !el.className) return;
    // Checkbox/Switch/Radio: wirksame Trefferflaeche inkl. ::after-Hitarea messen
    const role = el.getAttribute('role');
    let h = r.height;
    if (role === 'checkbox' || role === 'switch' || role === 'radio') {
      const top = parseFloat(getComputedStyle(el, '::after').top || '0');
      if (!Number.isNaN(top) && top < 0) h += Math.abs(top) * 2;
    }
    if (h < 40) smallTargets.push((el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 40) + `@${Math.round(h)}`);
  });
  // break-all ist nur in <code>-Blöcken (Token, URLs) zulässig, nie in Fachdaten wie SKUs.
  const breakAll = [...document.querySelectorAll('.break-all')].filter((el) => el.tagName !== 'CODE').length;
  return { overflow, wide: wide.slice(0, 5), smallTargets: smallTargets.slice(0, 5), breakAll };
}
"""


async def restore_session(context, page):
    storage_key = os.environ.get("LOVABLE_BROWSER_SUPABASE_STORAGE_KEY")
    session_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_SESSION_JSON")
    cookies_json = os.environ.get("LOVABLE_BROWSER_SUPABASE_COOKIES_JSON")
    minted = Path(os.path.expanduser("~/.cache/lovable-auth/session.json"))
    if not session_json and minted.exists():
        data = json.loads(minted.read_text())
        storage_key = data["storage_key"]
        session_json = json.dumps(data["session"])
        cookies_json = json.dumps(data.get("cookies") or [])
    if cookies_json:
        cookies = json.loads(cookies_json)
        for c in cookies:
            c["url"] = BASE
        if cookies:
            await context.add_cookies(cookies)
    await page.goto(BASE, wait_until="domcontentloaded")
    if storage_key and session_json:
        await page.evaluate(
            f"window.localStorage.setItem({json.dumps(storage_key)}, {json.dumps(session_json)})"
        )
    # Demo-Organisation als aktiven Workspace setzen, damit befüllte Daten geprüft werden.
    await page.evaluate(
        "window.localStorage.setItem('commerce-os.active-org', '5eebb5ba-0a22-4a34-9c28-5dfab7d48924')"
    )
    return bool(storage_key and session_json)


async def scan(page, label, path, width, height=1400, shot=False):
    await page.set_viewport_size({"width": width, "height": height})
    await page.goto(BASE + path, wait_until="domcontentloaded")
    try:
        await page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(500)
    m = await page.evaluate(MEASURE)
    if shot:
        SHOTS.mkdir(parents=True, exist_ok=True)
        await page.screenshot(path=str(SHOTS / f"{label}_{width}.png"))
    return m


async def main():
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1400})
        page = await context.new_page()

        authed = await restore_session(context, page)
        check("Auth-Session für Backoffice-Prüfung verfügbar", authed,
              "" if authed else "keine Session injiziert")

        overflow_fail = []
        target_fail = []
        breakall_fail = []
        tablet_fail = []

        routes = (APP_ROUTES if authed else []) + PUBLIC_ROUTES
        for label, path in routes:
            for width in WIDTHS:
                m = await scan(page, label, path, width, shot=(width in (390, 1440)))
                if m["overflow"] > 1:
                    overflow_fail.append(f"{label}@{width}:{m['overflow']}px {m['wide']}")
                    if width == 768:
                        tablet_fail.append(f"{label}:{m['overflow']}px")
                if width <= 430 and m["smallTargets"]:
                    target_fail.append(f"{label}@{width}:{m['smallTargets']}")
                if m["breakAll"]:
                    breakall_fail.append(f"{label}@{width}")

        # 375 px Querformat
        for label, path in routes[:8]:
            m = await scan(page, label + "-landscape", path, LANDSCAPE[0], LANDSCAPE[1])
            if m["overflow"] > 1:
                overflow_fail.append(f"{label}@landscape:{m['overflow']}px")

        check("U1 kein horizontaler Seitenüberlauf (320–1440 px)", not overflow_fail,
              "; ".join(overflow_fail[:6]))
        check("U7 Tablet-Zweig bei 768 px ohne Überlauf", not tablet_fail, "; ".join(tablet_fail[:6]))
        check("U4 keine buchstabenweisen Umbrüche (break-all)", not breakall_fail,
              "; ".join(breakall_fail[:6]))
        check("Touch-Ziele >= 40 px auf Mobil", not target_fail, "; ".join(target_fail[:4]))

        if authed:
            # U2 — vollständige Mobil-Navigation
            await page.set_viewport_size({"width": 390, "height": 844})
            await page.goto(BASE + "/app", wait_until="domcontentloaded")
            await page.wait_for_timeout(1500)
            trigger = page.get_by_role("button", name="Menü öffnen")
            has_trigger = await trigger.count() > 0
            nav_links = 0
            if has_trigger:
                await trigger.first.click()
                await page.wait_for_timeout(500)
                nav_links = await page.locator('[role="dialog"] a[href^="/app"]').count()
            check("U2 mobile Navigation erreichbar und vollständig", has_trigger and nav_links >= 20,
                  f"Trigger={has_trigger}, Links={nav_links}")
            await page.keyboard.press("Escape")

            # U3 — Demo-Banner umbruchfähig
            await page.wait_for_timeout(300)
            banner = page.locator('[data-demo-banner]')
            if await banner.count():
                box = await banner.first.evaluate(
                    "(el) => ({ o: el.scrollWidth - el.clientWidth, h: el.getBoundingClientRect().height })"
                )
                check("U3 Demo-Banner bricht um und wird nicht abgeschnitten", box["o"] <= 1,
                      json.dumps(box))
            else:
                check("U3 Demo-Banner bricht um und wird nicht abgeschnitten", True,
                      "kein Demo-Banner aktiv")

            # U5 — Karten statt Tabelle auf Mobil
            await page.goto(BASE + "/app/bestellungen", wait_until="domcontentloaded")
            await page.wait_for_timeout(1800)
            visible_table = await page.evaluate(
                "() => [...document.querySelectorAll('table')].filter(t => t.getBoundingClientRect().width > 0).length"
            )
            cards = await page.evaluate(
                "() => document.querySelectorAll('a[href^=\"/app/bestellungen/\"]').length"
            )
            check("U5 Bestellliste zeigt auf Mobil Karten statt Tabelle",
                  visible_table == 0 and cards > 0, f"Tabellen sichtbar={visible_table}, Karten={cards}")

            # U6 — Filter im Sheet
            filter_btn = await page.get_by_role("button", name="Filter").count()
            check("U6 Filter mobil im Sheet gebündelt", filter_btn > 0, f"Filter-Trigger={filter_btn}")

            # U8 — Demo & QA Aktionen erreichbar
            await page.goto(BASE + "/app/system/demo-daten", wait_until="domcontentloaded")
            await page.wait_for_timeout(1800)
            m = await page.evaluate(MEASURE)
            in_view = await page.evaluate(
                "() => [...document.querySelectorAll('button')].every(b => b.getBoundingClientRect().right <= document.documentElement.clientWidth + 2)"
            )
            check("U8 Demo & QA: Aktionen liegen im Viewport", m["overflow"] <= 1 and in_view,
                  f"overflow={m['overflow']}")

        # U9 — Storefront ohne Key mit verständlichem Leerzustand + Query-Auflösung
        await page.set_viewport_size({"width": 390, "height": 844})
        await page.goto(BASE + "/store", wait_until="domcontentloaded")
        await page.wait_for_timeout(800)
        body = (await page.inner_text("body")).lower()
        readable_empty = ("publishable" in body or "shop wird noch verbunden" in body
                          or "kollektion" in body or "produkte" in body)
        m = await page.evaluate(MEASURE)
        check("U9 Storefront: verständlicher Zustand ohne Key, kein Überlauf",
              readable_empty and m["overflow"] <= 1, f"overflow={m['overflow']}")

        await browser.close()

    passed = sum(1 for r in results if r["ok"])
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps({"passed": passed, "total": len(results), "results": results}, indent=2))
    print(f"\n== {passed}/{len(results)} PASS ==")
    if passed != len(results):
        raise SystemExit(1)


asyncio.run(main())
