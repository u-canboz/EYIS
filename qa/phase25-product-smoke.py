import asyncio, json, os, re
from playwright.async_api import async_playwright

BASE="http://localhost:8080"
NAME="QA Smoke Produkt Phase 25"
out={"steps":[]}
def rec(n,ok,d=""):
    out["steps"].append({"name":n,"ok":bool(ok),"detail":str(d)[:200]})
    print(("PASS " if ok else "FAIL ")+n+(" — "+str(d)[:160] if d else ""))

async def main():
    sess=json.load(open("/root/.cache/lovable-auth/session.json"))
    key=sess.get("storage_key") or "sb-hosciphydioqqpmzqtpy-auth-token"
    payload=json.dumps(sess.get("session") or sess)
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True)
        c=await b.new_context(viewport={"width":1280,"height":1800})
        pg=await c.new_page()
        errors=[]
        pg.on("console", lambda m: errors.append(m.text) if m.type=="error" else None)
        await pg.goto(BASE, wait_until="domcontentloaded")
        await pg.evaluate("([k,v])=>localStorage.setItem(k,v)",[key,payload])
        await pg.goto(BASE+"/app/produkte/neu", wait_until="domcontentloaded")
        await pg.wait_for_timeout(4000)
        rec("Wizard erreichbar (angemeldet)", "/app/produkte/neu" in pg.url, pg.url)
        # Schritt 1: Produktart
        try:
            await pg.get_by_role("button", name=re.compile("Standard")).first.click(timeout=15000)
            rec("Produktart wählbar", True, "Standard")
        except Exception as e:
            rec("Produktart wählbar", False, e)
            await pg.screenshot(path="qa/artifacts/phase25/step0.png"); await b.close(); return
        await pg.get_by_role("button", name="Weiter").click()
        # Schritt 2: Basisdaten
        await pg.locator("input").first.fill(NAME)
        await pg.get_by_role("button", name="Weiter").click()
        # Schritt 3: Details
        await pg.wait_for_timeout(500)
        await pg.get_by_role("button", name="Weiter").click()
        # Schritt 4: Varianten
        await pg.wait_for_timeout(500)
        await pg.get_by_role("button", name="Weiter").click()
        await pg.wait_for_timeout(500)
        body=await pg.inner_text("body")
        rec("Zusammenfassung zeigt Eingaben", NAME in body, NAME)
        await pg.get_by_role("button", name="Produkt anlegen").click()
        try:
            await pg.wait_for_url(re.compile(r"/app/produkte/[0-9a-f-]{36}"), timeout=30000)
            rec("Produkt angelegt und Detailseite geöffnet", True, pg.url)
            out["product_url"]=pg.url
        except Exception as e:
            rec("Produkt angelegt und Detailseite geöffnet", False, str(e)+" | "+pg.url)
        await pg.wait_for_timeout(2500)
        body=await pg.inner_text("body")
        rec("Detailseite zeigt Produktnamen", NAME in body, "")
        await pg.screenshot(path="qa/artifacts/phase25/detail.png")
        rec("Keine Konsolenfehler", len(errors)==0, " | ".join(errors[:3]))
        await b.close()
    json.dump(out, open("qa/artifacts/phase25/product.json","w"), indent=2)
asyncio.run(main())
