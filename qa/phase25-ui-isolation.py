import asyncio, json
from playwright.async_api import async_playwright
BASE="http://localhost:8080"
out=[]
def rec(n,ok,d=""):
    out.append({"name":n,"ok":bool(ok),"detail":str(d)[:200]}); print(("PASS " if ok else "FAIL ")+n+(" — "+str(d)[:160] if d else ""))
async def main():
    sess=json.load(open("/root/.cache/lovable-auth/session.json"))
    key=sess.get("storage_key") or "sb-hosciphydioqqpmzqtpy-auth-token"
    payload=json.dumps(sess.get("session") or sess)
    async with async_playwright() as p:
        b=await p.chromium.launch(headless=True)
        c=await b.new_context(viewport={"width":1280,"height":1800})
        pg=await c.new_page()
        await pg.goto(BASE, wait_until="domcontentloaded")
        # 1. Kundenseite behält ihr Chrome, kein EYIS-Scope
        await pg.wait_for_timeout(1500)
        rec("Kundenseite ohne .eyis-admin-Scope", await pg.locator(".eyis-admin").count()==0)
        rec("Kundenseite ohne Backoffice-Marker", await pg.locator("[data-eyis-runtime='backoffice']").count()==0)
        # 2. Backoffice-Login liegt im EYIS-Namespace und ist öffentlich
        r=await pg.goto(BASE+"/app/login", wait_until="domcontentloaded")
        await pg.wait_for_timeout(1500)
        rec("/app/login öffentlich erreichbar", r.status==200, f"HTTP {r.status}")
        rec("Login trägt den EYIS-Scope", await pg.locator(".eyis-admin").count()>0)
        # 3. Kunden-Chrome darf im Backoffice nicht erscheinen
        await pg.evaluate("([k,v])=>localStorage.setItem(k,v)",[key,payload])
        await pg.goto(BASE+"/app", wait_until="domcontentloaded")
        try:
            await pg.wait_for_selector(".eyis-admin", timeout=30000)
        except Exception:
            pass
        await pg.wait_for_timeout(1000)
        rec("Backoffice rendert im .eyis-admin-Scope", await pg.locator(".eyis-admin").count()>0)
        rec("Backoffice trägt data-eyis-runtime", await pg.locator("[data-eyis-runtime='backoffice']").count()>0)
        # 4. Fixture: Kunde überschreibt :root-Tokens — Backoffice bleibt unbeeinflusst
        shell=pg.locator(".eyis-admin").first
        before=await shell.evaluate("e=>getComputedStyle(e).backgroundColor")
        await pg.add_style_tag(content=":root{--background:0 0% 0%;--foreground:0 100% 50%;--primary:120 100% 25%;}body{background:#000!important}")
        await pg.wait_for_timeout(400)
        after=await shell.evaluate("e=>getComputedStyle(e).backgroundColor")
        rec("Kunden-Override auf :root verfärbt das Backoffice nicht", before==after, f"{before} -> {after}")
        await pg.screenshot(path="qa/artifacts/phase25/isolation.png")
        await b.close()
    json.dump(out, open("qa/artifacts/phase25/isolation.json","w"), indent=2)
    print(f"== {sum(1 for o in out if o['ok'])}/{len(out)} PASS ==")
asyncio.run(main())
