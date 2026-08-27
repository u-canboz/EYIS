"""
Gate B / B2 — Accessibility (WCAG 2.1 AA, axe-core + manuelle Strukturpruefungen).

Laeuft gegen den Dev-Server (http://localhost:8080) mit der befuellten Demo-Organisation.
Niemals gegen Production.

Aufruf:
    bun run qa:a11y

Schreibt qa/results-phase14-accessibility.json.
"""

import asyncio
import json
import os
from pathlib import Path

from playwright.async_api import async_playwright

BASE = "http://localhost:8080"
OUT = Path("qa/results-phase14-accessibility.json")
AXE = Path("node_modules/axe-core/axe.min.js")
DEMO_ORG = "5eebb5ba-0a22-4a34-9c28-5dfab7d48924"

APP_ROUTES = [
    ("uebersicht", "/app"),
    ("bestellungen", "/app/bestellungen"),
    ("produkte", "/app/produkte"),
    ("kunden", "/app/kunden"),
    ("lager", "/app/lager"),
    ("dokumente", "/app/dokumente"),
    ("retouren", "/app/retouren"),
    ("kommunikation", "/app/kommunikation"),
    ("automationen", "/app/automationen"),
    ("entwickler", "/app/entwickler"),
    ("team", "/app/team"),
    ("system-health", "/app/system/health"),
]

PUBLIC_ROUTES = [
    ("portal", "/portal"),
    ("portal-gast", "/portal/gast"),
    ("store-katalog", "/store"),
    ("store-warenkorb", "/store/warenkorb"),
    ("auth", "/auth"),
]

results = []


def check(name, ok, evidence=""):
    results.append({"name": name, "ok": bool(ok), "evidence": evidence})
    print(("PASS  " if ok else "FAIL  ") + name + (f" — {evidence}" if evidence else ""))


def note(name, status, evidence=""):
    results.append({"name": name, "ok": None, "status": status, "evidence": evidence})
    print(f"{status}  {name}" + (f" — {evidence}" if evidence else ""))


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


async def load(page, path, width=1280):
    await page.set_viewport_size({"width": width, "height": 1400})
    await page.goto(BASE + path, wait_until="domcontentloaded")
    try:
        await page.wait_for_load_state("networkidle", timeout=8000)
    except Exception:
        pass
    await page.wait_for_timeout(400)


AXE_RUN = """
async () => {
  const res = await window.axe.run(document, {
    runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] },
    resultTypes: ['violations'],
  });
  return res.violations.map((v) => ({
    id: v.id, impact: v.impact, count: v.nodes.length,
    target: (v.nodes[0] && v.nodes[0].target && v.nodes[0].target[0]) || '',
  }));
}
"""

STRUCTURE = """
() => {
  const h1 = document.querySelectorAll('h1').length;
  const landmarks = {
    main: document.querySelectorAll('main, [role="main"]').length,
    nav: document.querySelectorAll('nav, [role="navigation"]').length,
  };
  const imgs = [...document.querySelectorAll('img')];
  const imgNoAlt = imgs.filter((i) => !i.hasAttribute('alt')).length;
  const inputs = [...document.querySelectorAll('input:not([type=hidden]), select, textarea')];
  const unlabeled = inputs.filter((el) => {
    if (el.getAttribute('aria-label') || el.getAttribute('aria-labelledby')) return false;
    if (el.id && document.querySelector(`label[for="${CSS.escape(el.id)}"]`)) return false;
    if (el.closest('label')) return false;
    if (el.getAttribute('placeholder')) return false;
    return true;
  }).length;
  const buttons = [...document.querySelectorAll('button, [role="button"]')];
  const namelessButtons = buttons.filter((b) => {
    const t = (b.textContent || '').trim();
    return !t && !b.getAttribute('aria-label') && !b.getAttribute('title');
  }).length;
  const lang = document.documentElement.getAttribute('lang') || '';
  const title = (document.title || '').trim();
  return { h1, landmarks, imgNoAlt, unlabeled, namelessButtons, lang, title };
}
"""

FOCUS = """
() => {
  const el = document.activeElement;
  if (!el || el === document.body) return null;
  const cs = getComputedStyle(el);
  const r = el.getBoundingClientRect();
  const visible =
    cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth || '0') > 0 ||
    (cs.boxShadow && cs.boxShadow !== 'none');
  return {
    tag: el.tagName.toLowerCase(),
    label: (el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 32),
    visible: Boolean(visible),
    inViewport: r.top >= -2 && r.left >= -2 && r.bottom <= innerHeight + 2,
  };
}
"""


async def main():
    axe_src = AXE.read_text()
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        context = await browser.new_context(viewport={"width": 1280, "height": 1400})
        page = await context.new_page()
        authed = await restore_session(context, page)
        check("B2 Auth-Session fuer Backoffice-Pruefung verfuegbar", authed)

        routes = (APP_ROUTES if authed else []) + PUBLIC_ROUTES
        all_violations = {}
        serious = {}
        struct_issues = []

        for name, path in routes:
            await load(page, path)
            await page.add_script_tag(content=axe_src)
            try:
                violations = await page.evaluate(AXE_RUN)
            except Exception as exc:  # pragma: no cover
                violations = [{"id": "axe-error", "impact": "serious", "count": 1, "target": str(exc)[:80]}]
            if violations:
                all_violations[name] = violations
            crit = [v for v in violations if v.get("impact") in ("serious", "critical")]
            if crit:
                serious[name] = crit

            s = await page.evaluate(STRUCTURE)
            problems = []
            if s["h1"] != 1:
                problems.append(f"h1={s['h1']}")
            if s["landmarks"]["main"] < 1:
                problems.append("kein main-Landmark")
            if s["imgNoAlt"]:
                problems.append(f"{s['imgNoAlt']} Bilder ohne alt")
            if s["unlabeled"]:
                problems.append(f"{s['unlabeled']} Felder ohne Label")
            if s["namelessButtons"]:
                problems.append(f"{s['namelessButtons']} Buttons ohne Namen")
            if not s["lang"]:
                problems.append("kein lang-Attribut")
            if not s["title"]:
                problems.append("kein Titel")
            if problems:
                struct_issues.append(f"{name}: {', '.join(problems)}")

        check(
            "B2.1 Keine schwerwiegenden axe-Verstoesse (serious/critical)",
            not serious,
            json.dumps(serious, ensure_ascii=False)[:600] or f"{len(routes)} Seiten geprueft",
        )
        check(
            "B2.2 Keine axe-Verstoesse beliebiger Schwere",
            not all_violations,
            json.dumps(all_violations, ensure_ascii=False)[:600] or f"{len(routes)} Seiten geprueft",
        )
        check(
            "B2.3 Struktur: genau eine h1, main-Landmark, lang, Titel, Labels, alt-Texte",
            not struct_issues,
            "; ".join(struct_issues)[:600] or f"{len(routes)} Seiten sauber",
        )

        # ----------------------------------------------- Tastaturbedienbarkeit
        kb_issues = []
        for name, path in [("uebersicht", "/app"), ("store-katalog", "/store"), ("portal-gast", "/portal/gast")]:
            if path.startswith("/app") and not authed:
                continue
            await load(page, path)
            seen, invisible = [], []
            for _ in range(25):
                await page.keyboard.press("Tab")
                info = await page.evaluate(FOCUS)
                if not info:
                    continue
                seen.append(info["label"] or info["tag"])
                if not info["visible"]:
                    invisible.append(info["label"] or info["tag"])
            if len(seen) < 8:
                kb_issues.append(f"{name}: nur {len(seen)} fokussierbare Elemente")
            if invisible:
                kb_issues.append(f"{name}: ohne sichtbaren Fokus {invisible[:3]}")
        check(
            "B2.4 Tastaturnavigation mit sichtbarem Fokus",
            not kb_issues,
            "; ".join(kb_issues)[:400] or "3 Seiten je 25 Tab-Schritte",
        )

        # ----------------------------------------------------- Skip-Link / Dialog
        await load(page, "/store")
        await page.keyboard.press("Tab")
        first = await page.evaluate(FOCUS)
        check(
            "B2.5 Erstes Tab-Ziel ist bedienbar und sichtbar",
            bool(first and first["visible"]),
            json.dumps(first, ensure_ascii=False),
        )

        if authed:
            await load(page, "/app", 390)
            trigger = page.locator('button[aria-label*="Men"]:visible, button:has-text("Menü"):visible').first
            dialog_ok = False
            evidence = "kein mobiler Menue-Trigger gefunden"
            try:
                await trigger.click(timeout=4000)
                await page.wait_for_timeout(500)
                info = await page.evaluate(
                    """() => {
                      const all = [...document.querySelectorAll('[role="dialog"]')];
                      const d = all.find((el) => el.contains(document.activeElement)) || all[all.length - 1];
                      if (!d) return null;
                      return {
                        modal: d.getAttribute('aria-modal'),
                        labelled: Boolean(d.getAttribute('aria-label') || d.getAttribute('aria-labelledby')),
                        focusInside: d.contains(document.activeElement),
                      };
                    }"""
                )
                dialog_ok = bool(info and info["labelled"] and info["focusInside"])
                evidence = json.dumps(info, ensure_ascii=False)
                await page.keyboard.press("Escape")
                await page.wait_for_timeout(300)
                closed = await page.evaluate("() => !document.querySelector('[role=\"dialog\"]')")
                dialog_ok = dialog_ok and closed
                evidence += f" escape_closed={closed}"
            except Exception as exc:
                evidence = str(exc)[:120]
            check("B2.6 Mobiles Navigationsdialog: benannt, fokussiert, per Escape schliessbar", dialog_ok, evidence)

        # -------------------------------------------------------- Kontrastwerte
        await load(page, "/store")
        contrast = await page.evaluate(AXE_RUN) if False else None
        await page.add_script_tag(content=axe_src)
        contrast = await page.evaluate(
            """async () => {
              const r = await window.axe.run(document, { runOnly: ['color-contrast'] });
              return r.violations.map((v) => ({ id: v.id, count: v.nodes.length }));
            }"""
        )
        check("B2.7 Kontrast (axe color-contrast) ohne Verstoesse", not contrast, json.dumps(contrast))

        # Dunkles Thema
        await page.evaluate("() => document.documentElement.classList.add('dark')")
        await page.wait_for_timeout(300)
        contrast_dark = await page.evaluate(
            """async () => {
              const r = await window.axe.run(document, { runOnly: ['color-contrast'] });
              return r.violations.map((v) => ({ id: v.id, count: v.nodes.length }));
            }"""
        )
        check("B2.8 Kontrast im dunklen Thema ohne Verstoesse", not contrast_dark, json.dumps(contrast_dark))

        note(
            "B2.9 Screenreader-Stichprobe (NVDA/VoiceOver)",
            "OFFEN",
            "Keine Screenreader-Umgebung in der Sandbox verfuegbar; manuell vor Go-live nachzuholen.",
        )

        await browser.close()

    passed = sum(1 for r in results if r.get("ok") is True)
    total = sum(1 for r in results if r.get("ok") is not None)
    OUT.write_text(
        json.dumps(
            {
                "ranAt": __import__("datetime").datetime.utcnow().isoformat() + "Z",
                "base": BASE,
                "total": total,
                "passed": passed,
                "results": results,
            },
            indent=2,
            ensure_ascii=False,
        )
    )
    print(f"\n== {passed}/{total} PASS ==")
    for r in results:
        if r.get("ok") is False:
            print("FAILED: " + r["name"] + " — " + r["evidence"])


asyncio.run(main())
