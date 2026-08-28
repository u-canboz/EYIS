/* Phase 21: Dedicated Security — RLS-Sperren, Secret-Handling, Header-Only. */
import { check, summary } from "./lib";
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const BASE = process.env["COMMERCE_OS_URL"] ?? "http://localhost:8080";

async function main() {
  /* 1. anon darf commerce_installation nicht lesen */
  const anon = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const { data, error } = await anon.from("commerce_installation" as never).select("*");
  const rows = (data as unknown[] | null) ?? [];
  check(
    "RLS: anon kann commerce_installation nicht lesen",
    rows.length === 0,
    error ? `blocked: ${error.message.slice(0, 80)}` : `rows=${rows.length}`,
  );

  /* 2. claim_installation_owner ist nicht über die Data API aufrufbar (kein GRANT an anon) */
  const rpc = await anon.rpc("claim_installation_owner" as never, {
    p_user_id: "00000000-0000-0000-0000-000000000000",
    p_claim_token: "x",
    p_org_name: "x",
    p_shop_name: "x",
  } as never);
  check(
    "RPC: claim_installation_owner für anon nicht ausführbar",
    rpc.error != null,
    rpc.error ? rpc.error.message.slice(0, 80) : "KEIN FEHLER — kritisch",
  );

  /* 3. Claim-Session-Endpunkt: ungültiger Code → 403, kein Cookie */
  const res = await fetch(`${BASE}/api/public/install/claim-session`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ claimCode: "cos_claim_wrong" }),
  });
  check(
    "Claim-Session mit falschem Code → 403 ohne Cookie",
    res.status === 403 && !res.headers.get("set-cookie"),
    `status=${res.status}, cookie=${res.headers.get("set-cookie") ?? "kein"}`,
  );

  /* 4. Claim-Code erscheint in keinem Endpunkt als URL-Parameter (Source-Scan) */
  const sources = [
    "src/routes/api/public/install/claim-session.ts",
    "src/routes/api/public/install/bootstrap.ts",
    "src/routes/_authenticated/app/setup/index.tsx",
  ];
  let urlLeak = false;
  for (const f of sources) {
    const src = readFileSync(f, "utf8");
    if (/\?claim=|searchParams.*claim|claim.*searchParams/i.test(src)) urlLeak = true;
  }
  check("Claim-Token niemals in URL/Query (Source-Scan)", !urlLeak);

  /* 5. Bootstrap-Secret ausschließlich als Header gelesen */
  const bootstrapSrc = readFileSync("src/routes/api/public/install/bootstrap.ts", "utf8");
  check(
    "Bootstrap-Secret nur via x-commerce-bootstrap-secret Header",
    bootstrapSrc.includes('request.headers.get("x-commerce-bootstrap-secret")') &&
      !/URLSearchParams|searchParams/.test(bootstrapSrc),
  );

  /* 6. Keine Klartext-Token-/Secret-Ausgaben in Logs */
  let logLeak = false;
  for (const f of sources.concat(["src/lib/commerce/system/installation.server.ts"])) {
    const src = readFileSync(f, "utf8");
    if (/console\.(log|info|error)\([^)]*(claimToken|claim_token|BOOTSTRAP_SECRET)/.test(src)) {
      logLeak = true;
    }
  }
  check("Kein Claim-Token/Secret in Log-Ausgaben (Source-Scan)", !logLeak);

  summary();
}

main().catch((e) => {
  console.error("HARNESS ERROR", e);
  process.exitCode = 1;
});
