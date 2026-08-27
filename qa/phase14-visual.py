"""
Gate B / B1 — Visuelle Regression, Touch-Ziele 44 px und Zustandsmatrix.

Läuft gegen den Dev-Server (http://localhost:8080) mit der befüllten Demo-Organisation.
Niemals gegen Production.

Aufruf:
    bun run qa:visual              # prüfen (Diff-Gate aktiv)
    bun run qa:visual -- --approve # Baselines bewusst neu setzen

Schreibt qa/results-phase14-visual.json und Screenshots nach qa/baselines/gate-b/.
"""

import asyncio
import json
import os
import sys
from pathlib import Path

from PIL import Image, ImageChops
from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path("qa/results-phase14-visual.json")
SHOTS = Path("qa/baselines/gate-b")
DIFFS = Path("qa/baselines/gate-b-diff")
APPROVE = "--approve" in sys.argv
DEMO_ORG = "5eebb5ba-0a22-4a34-9c28-5dfab7d48924"

# Toleranz des Diff-Gates: Anteil abweichender Pixel.
DIFF_TOLERANCE = 0.005

WIDTHS = [320, 375, 390, 430, 768, 834, 1024, 1280, 1440]
LANDSCAPE = (667, 375)
KEYBOARD = (390, 420)  # geöffnete mobile Tastatur

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

# Untermenge für teure Achsen (Dark, Zoom, Landscape, Tastatur, Diff).
KEY_ROUTES = [
    ("uebersicht", "/app"),
    ("bestellungen", "/app/bestellungen"),
    ("produkte", "/app/produkte"),
    ("kunden", "/app/kunden"),
    ("lager", "/app/lager"),
    ("dokumente", "/app/dokumente"),
    ("retouren", "/app/retouren"),
    ("demo-daten", "/app/system/demo-daten"),
    ("portal", "/portal"),
    ("store-katalog", "/store"),
]

results = []


def check(name, ok, detail=""):
    results.append({"name": name, "ok": bool(ok), "detail": detail})
    print(("PASS  " if ok else "FAIL  ") + name + (f" — {detail}" if detail else ""), flush=True)


# 44x44 px ist die verbindliche Mindestgröße interaktiver Ziele (Gate B).
MEASURE = """
(minTarget) => {
  const de = document.documentElement;
  const vw = de.clientWidth;
  const overflow = de.scrollWidth - vw;
  const wide = [];
  const scrollers = '[data-scroll-x],.scroll-x,[data-radix-scroll-area-viewport]';
  document.querySelectorAll('body *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width > vw + 2 && !el.closest(scrollers)) {
      if (getComputedStyle(el).overflowX === 'visible') {
        wide.push(el.tagName.toLowerCase() + '.' + (el.className || '').toString().slice(0, 50));
      }
    }
  });

  const sel = 'button, a[href], [role="button"], [role="menuitem"], [role="tab"], ' +
    '[role="checkbox"], [role="switch"], [role="radio"], input:not([type="hidden"]), select, summary';
  const small = [];
  const clipped = [];
  const offscreen = [];
  document.querySelectorAll(sel).forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    const cs = getComputedStyle(el);
    if (cs.visibility === 'hidden') return;
    const label = (el.textContent || el.getAttribute('aria-label') || el.tagName).trim().slice(0, 32);
    // Inline-Textlinks im Fließtext sind keine eigenständigen Touch-Ziele.
    const inlineLink = el.tagName === 'A' && cs.display === 'inline';
    let h = r.height, w = r.width;
    const role = el.getAttribute('role');
    const type = el.getAttribute('type');
    if (role === 'checkbox' || role === 'switch' || role === 'radio' || type === 'checkbox' || type === 'radio') {
      const after = getComputedStyle(el, '::after');
      const top = parseFloat(after.top || '0');
      const left = parseFloat(after.left || '0');
      if (!Number.isNaN(top) && top < 0) h += Math.abs(top) * 2;
      if (!Number.isNaN(left) && left < 0) w += Math.abs(left) * 2;
    }
    if (!inlineLink && (h < minTarget - 0.5 || w < minTarget - 0.5)) {
      small.push(`${label}@${Math.round(w)}x${Math.round(h)}`);
    }
    // Aktionen dürfen nicht ausserhalb des Viewports oder verdeckt liegen.
    if (r.right > vw + 2 && !el.closest(scrollers)) offscreen.push(label);
  });

  // Abgeschnittene Inhalte: Textknoten, deren Inhalt vertikal ueberlaeuft.
  document.querySelectorAll('h1, h2, h3, p, td, dd, .truncate').forEach((el) => {
    if (el.scrollHeight > el.clientHeight + 4 && getComputedStyle(el).overflow === 'hidden'
        && !el.classList.contains('truncate') && !el.classList.contains('line-clamp-1')
        && !el.classList.contains('line-clamp-2') && !el.classList.contains('line-clamp-3')) {
      clipped.push(el.tagName.toLowerCase() + ':' + (el.textContent || '').trim().slice(0, 24));
    }
  });

  const breakAll = [...document.querySelectorAll('.break-all')].filter((el) => el.tagName !== 'CODE').length;
  const h1 = document.querySelectorAll('h1').length;
  const nav = document.querySelectorAll('nav, [data-nav], [aria-label="Menü öffnen"], button[aria-label*="Menü"]').length;
  return {
    overflow, wide: wide.slice(0, 4), small: small.slice(0, 6), clipped: clipped.slice(0, 4),
    offscreen: offscreen.slice(0, 4), breakAll, h1, nav,
  };
}
"""

STRESS = """
() => {
  const long = {
    name: 'Handgefertigte Premium-Manufaktur-Bio-Baumwoll-Kapuzenjacke Limited Edition Wintersaison 2026 Sondermodell',
    sku: 'DEMO-JACKE-WINTER-2026-SONDERMODELL-XXL-ANTHRAZIT-0000000001',
    email: 'sehr.langer.gastbesteller.adresse.mit.subdomain@auslandsversand-testkunden.beispiel-domain.example',
    money: '1.234.567.890,99 EUR',
  };
  const targets = [...document.querySelectorAll('h1,h2,h3,td,dd,span,p')].slice(0, 400);
  let i = 0;
  for (const el of targets) {
    if (el.children.length) continue;
    const t = (el.textContent || '').trim();
    if (t.length < 3) continue;
    const v = [long.name, long.sku, long.email, long.money][i % 4];
    el.textContent = v;
    i++;
    if (i >= 24) break;
  }
  return i;
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
    await page.evaluate(
        f"window.localStorage.setItem('commerce-os.active-org', {json.dumps(DEMO_ORG)})"
    )
    key_file = Path("/tmp/gb/store-key.txt")
    if key_file.exists():
        pk = key_file.read_text().splitlines()[0].strip()
        await page.evaluate(
            f"window.localStorage.setItem('commerce.publishableKey', {json.dumps(pk)})"
        )
    return bool(storage_key and session_json)


async def load(page, path, width, height=1400):
    await page.set_viewport_size({"width": width, "height": height})
    await page.goto(BASE + path, wait_until="domcontentloaded")
    try:
        await page.wait_for_load_state("networkidle", timeout=6000)
    except Exception:
        pass
    await page.wait_for_timeout(350)


def min_target(width):
    """44 px auf Touch-Viewports; ab 1024 px gilt der Zeiger-Mindestwert 24 px (WCAG 2.2 AA)."""
    return 44 if width < 1024 else 24


async def measure(page, width=390):
    return await page.evaluate(MEASURE, min_target(width))


def diff_ratio(a: Path, b: Path):
    ia, ib = Image.open(a).convert("RGB"), Image.open(b).convert("RGB")
    if ia.size != ib.size:
        return 1.0, None
    d = ImageChops.difference(ia, ib).convert("L").point(lambda p: 255 if p > 24 else 0)
    changed = sum(d.histogram()[1:])
    return changed / float(ia.size[0] * ia.size[1]), d


async def main():
    SHOTS.mkdir(parents=True, exist_ok=True)
    DIFFS.mkdir(parents=True, exist_ok=True)
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1400})
        page = await context.new_page()
        authed = await restore_session(context, page)
        check("B1 Auth-Session für Backoffice-Prüfung verfügbar", authed)

        routes = (APP_ROUTES if authed else []) + PUBLIC_ROUTES

        overflow_fail, target_fail, clipped_fail, offscreen_fail = [], [], [], []
        breakall_fail, nav_fail = [], []

        # ---------------------------------------------- Grundmatrix (Light)
        for label, path in routes:
            for width in WIDTHS:
                await load(page, path, width)
                m = await measure(page, width)
                if m["overflow"] > 1:
                    overflow_fail.append(f"{label}@{width}:{m['overflow']}px {m['wide']}")
                if m["small"]:
                    target_fail.append(f"{label}@{width}:{m['small']}")
                if m["clipped"]:
                    clipped_fail.append(f"{label}@{width}:{m['clipped']}")
                if m["offscreen"]:
                    offscreen_fail.append(f"{label}@{width}:{m['offscreen']}")
                if m["breakAll"]:
                    breakall_fail.append(f"{label}@{width}")
                if m["nav"] == 0:
                    nav_fail.append(f"{label}@{width}")

        check("B1.1 Kein horizontaler Überlauf (320–1440 px, alle Routen)",
              not overflow_fail, "; ".join(overflow_fail[:6]))
        check("B1.2 Touch-Ziele >= 44 px (Touch) bzw. >= 24 px (Desktop)",
              not target_fail, "; ".join(target_fail[:6]))
        check("B1.3 Keine abgeschnittenen Inhalte", not clipped_fail, "; ".join(clipped_fail[:6]))
        check("B1.4 Keine Aktion ausserhalb des Viewports", not offscreen_fail,
              "; ".join(offscreen_fail[:6]))
        check("B1.5 Keine buchstabenweisen Umbrüche in Fachdaten",
              not breakall_fail, "; ".join(breakall_fail[:6]))
        check("B1.6 Navigation auf jeder Route erreichbar", not nav_fail, "; ".join(nav_fail[:6]))

        # ---------------------------------------------------- Dark Mode
        dark_fail = []
        await page.emulate_media(color_scheme="dark")
        await page.add_init_script("document.documentElement.classList.add('dark')")
        for label, path in KEY_ROUTES:
            for width in (390, 1280):
                await load(page, path, width)
                await page.evaluate("document.documentElement.classList.add('dark')")
                await page.wait_for_timeout(150)
                m = await measure(page)
                contrast = await page.evaluate(
                    "() => { const cs = getComputedStyle(document.body);"
                    " return cs.backgroundColor + '|' + cs.color; }"
                )
                bg, fg = contrast.split("|")
                if m["overflow"] > 1 or bg == fg:
                    dark_fail.append(f"{label}@{width}:{m['overflow']}px {contrast}")
                await page.screenshot(path=str(SHOTS / f"{label}_{width}_dark.png"))
        check("B1.7 Dark Mode ohne Überlauf und mit lesbarem Kontrast",
              not dark_fail, "; ".join(dark_fail[:5]))
        await page.emulate_media(color_scheme="light")
        await page.evaluate("document.documentElement.classList.remove('dark')")

        # ---------------------------------------------------- 200 % Zoom
        zoom_fail = []
        for label, path in KEY_ROUTES:
            await page.set_viewport_size({"width": 1280, "height": 900})
            await page.goto(BASE + path, wait_until="domcontentloaded")
            await page.wait_for_timeout(600)
            await page.evaluate("document.documentElement.style.zoom = '2'")
            await page.wait_for_timeout(400)
            m = await measure(page)
            if m["overflow"] > 2:
                zoom_fail.append(f"{label}:{m['overflow']}px")
            await page.evaluate("document.documentElement.style.zoom = ''")
        check("B1.8 200 % Zoom ohne horizontalen Überlauf", not zoom_fail, "; ".join(zoom_fail[:5]))

        # -------------------------------------------- Lange Daten (Stress)
        stress_fail = []
        for label, path in KEY_ROUTES:
            for width in (320, 390, 768):
                await load(page, path, width)
                replaced = await page.evaluate(STRESS)
                await page.wait_for_timeout(200)
                m = await measure(page, width)
                if m["overflow"] > 1:
                    stress_fail.append(f"{label}@{width}:{m['overflow']}px ({replaced} Felder)")
        check("B1.9 Lange Namen, SKUs, Gast-E-Mails und grosse Beträge brechen um",
              not stress_fail, "; ".join(stress_fail[:5]))

        # ----------------------------------------------------- Querformat
        land_fail = []
        for label, path in KEY_ROUTES:
            await load(page, path, LANDSCAPE[0], LANDSCAPE[1])
            m = await measure(page)
            if m["overflow"] > 1:
                land_fail.append(f"{label}:{m['overflow']}px")
        check("B1.10 375 px Querformat ohne Überlauf", not land_fail, "; ".join(land_fail[:5]))

        # -------------------------------------------- Mobile Tastatur offen
        kb_fail = []
        for label, path in KEY_ROUTES:
            await load(page, path, KEYBOARD[0], KEYBOARD[1])
            m = await measure(page)
            primary = await page.evaluate(
                "() => { const b = document.querySelector('[data-primary-action], main button');"
                " if (!b) return true; const r = b.getBoundingClientRect();"
                " return r.top < window.innerHeight; }"
            )
            if m["overflow"] > 1 or not primary:
                kb_fail.append(f"{label}:{m['overflow']}px primary={primary}")
        check("B1.11 Geöffnete mobile Tastatur verdeckt keine Primäraktion",
              not kb_fail, "; ".join(kb_fail[:5]))

        # ------------------------------------------- Zustände Empty/Error
        state_fail = []
        for label, path, q in [
            ("bestellungen-empty", "/app/bestellungen", "?q=zzzz-nichts-gefunden-zzzz"),
            ("produkte-empty", "/app/produkte", "?q=zzzz-nichts-gefunden-zzzz"),
            ("kunden-empty", "/app/kunden", "?q=zzzz-nichts-gefunden-zzzz"),
        ]:
            await load(page, path + q, 390)
            # Die Listen filtern über das Suchfeld, nicht über die URL.
            box = page.locator('input[placeholder*="suchen" i], input[type="search"]').first
            try:
                await box.fill("zzzz-nichts-gefunden-zzzz", timeout=4000)
                await page.wait_for_timeout(1200)
            except Exception:
                pass
            m = await measure(page)
            body = (await page.inner_text("body")).lower()
            readable = any(w in body for w in ("keine", "nichts", "leer", "gefunden"))
            if m["overflow"] > 1 or not readable:
                state_fail.append(f"{label}:{m['overflow']}px readable={readable}")
        # 404 / Fehlerzustand
        await load(page, "/app/bestellungen/00000000-0000-0000-0000-000000000000", 390)
        m = await measure(page)
        if m["overflow"] > 1:
            state_fail.append(f"order-404:{m['overflow']}px")
        check("B1.12 Empty- und Fehlerzustände verständlich und ohne Überlauf",
              not state_fail, "; ".join(state_fail[:5]))

        # ------------------------------------------------ Screenshot-Diff-Gate
        diff_fail, new_baselines = [], []
        for label, path in KEY_ROUTES:
            for width in (390, 1440):
                await load(page, path, width)
                cur = SHOTS / f"{label}_{width}.png"
                base = SHOTS / f"{label}_{width}.base.png"
                await page.screenshot(path=str(cur))
                if APPROVE or not base.exists():
                    Image.open(cur).save(base)
                    new_baselines.append(f"{label}@{width}")
                    continue
                ratio, dimg = diff_ratio(base, cur)
                if ratio > DIFF_TOLERANCE:
                    if dimg is not None:
                        dimg.save(DIFFS / f"{label}_{width}.diff.png")
                    diff_fail.append(f"{label}@{width}:{ratio * 100:.2f}%")
        if new_baselines and not diff_fail:
            check("B1.13 Screenshot-Diff-Gate aktiv (Baselines gesetzt)", True,
                  f"{len(new_baselines)} Baselines geschrieben, Gate ab jetzt scharf")
        else:
            check("B1.13 Keine unerwarteten visuellen Abweichungen gegen Baseline",
                  not diff_fail, "; ".join(diff_fail[:6]))

        await browser.close()

    passed = sum(1 for r in results if r["ok"])
    OUT.write_text(json.dumps({
        "ranAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
        "minTouchTarget": 44,
        "diffTolerance": DIFF_TOLERANCE,
        "viewports": WIDTHS + [f"{LANDSCAPE[0]}x{LANDSCAPE[1]}", f"{KEYBOARD[0]}x{KEYBOARD[1]}"],
        "passed": passed, "total": len(results), "results": results,
    }, indent=2))
    print(f"\n== {passed}/{len(results)} PASS ==")
    if passed != len(results):
        raise SystemExit(1)


asyncio.run(main())
