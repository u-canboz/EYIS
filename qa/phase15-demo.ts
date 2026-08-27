/* QA harness — Phase 15: Demo- und QA-Datensystem.
   Belegt: Production Guard, vollständiger Seed, Zähler/Beziehungen,
   Idempotenz, QA-Fixtures (erzeugen + zerstören), Reset und Restfreiheit,
   Wiederherstellung des stabilen Ausgangszustands. */
import { writeFileSync } from "node:fs";
import { admin, check, results, summary } from "./lib";
import { SEED_STEPS, type SeedStep } from "../src/lib/commerce/demo/demo.types";
import { runSeedStep, getDemoStatus, resetDemo, findDemoEnv } from "../src/lib/commerce/demo/seed.server";
import { createQaFixture, destroyQaFixture } from "../src/lib/commerce/demo/fixtures.server";

const EMAIL = "qa-demo-owner@commerce-qa.test";
const PASSWORD = "QaPhase15!Demo-Owner";

type Ctx = { admin: never; userId: string; email: string | null; origin: string };

async function ensureUser() {
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 500 });
  const found = list.users.find((u) => u.email === EMAIL);
  if (found) return found.id;
  const { data, error } = await admin.auth.admin.createUser({
    email: EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(error.message);
  return data.user!.id;
}

async function count(table: string, orgId: string, demoOnly = false) {
  if (table === "product_media") {
    const { data } = await admin
      .from("product_media")
      .select("id, products!inner(organization_id)")
      .eq("products.organization_id", orgId);
    return (data ?? []).length;
  }
  let q = admin.from(table as never).select("id", { count: "exact", head: true }).eq("organization_id" as never, orgId);
  if (demoOnly) q = q.not("metadata->>demo_key", "is", null) as never;
  const { count: n, error } = (await q) as unknown as { count: number | null; error: unknown };
  if (error) return -1;
  return Number(n ?? 0);
}

async function fullCounts(orgId: string) {
  const tables = [
    "products",
    "product_variants",
    "categories",
    "collections",
    "media_assets",
    "product_media",
    "prices",
    "promotions",
    "inventory_items",
    "inventory_levels",
    "inventory_movements",
    "customers",
    "customer_addresses",
    "customer_groups",
    "carts",
    "checkout_sessions",
    "orders",
    "order_items",
    "payment_sessions",
    "payment_transactions",
    "invoices",
    "fulfillments",
    "shipments",
    "tracking_events",
    "communications",
    "returns",
    "refunds",
    "tax_snapshots",
  ];
  const out: Record<string, number> = {};
  for (const t of tables) out[t] = await count(t, orgId);
  return out;
}

async function runFullSeed(ctx: Ctx, label: string) {
  const detail: Record<string, string> = {};
  for (const step of SEED_STEPS as readonly SeedStep[]) {
    if (step === "orders") {
      let guard = 0;
      let last = "";
      for (;;) {
        const r = await runSeedStep(ctx as never, step);
        last = `${r.detail}${r.progress ? ` (${r.progress.created}/${r.progress.total})` : ""}`;
        console.log(`  [${label}] ${step}: ${last}`);
        if (r.done) break;
        if (++guard > 40) throw new Error("Orders-Seed terminiert nicht");
      }
      detail[step] = last;
    } else {
      const r = await runSeedStep(ctx as never, step);
      detail[step] = r.detail;
    }
    console.log(`  [${label}] ${step}: ${detail[step]}`);
  }
  return detail;
}

async function main() {
  const userId = await ensureUser();
  const ctx = { admin, userId, email: EMAIL, origin: "http://localhost:8080" } as unknown as Ctx;
  const report: Record<string, unknown> = {};

  /* ---------- 1. Production Guard ---------- */
  const { data: orgsBefore } = await admin.from("organizations").select("id");
  // Ursprungswert merken: eine fehlende Umgebung ist seit Gate C ein sicherer Abbruch.
  const previousAppEnv = process.env["APP_ENV"] ?? "development";
  process.env["APP_ENV"] = "production";
  let guardSeed = "";
  try {
    await runSeedStep(ctx as never, "foundation");
    guardSeed = "kein Fehler";
  } catch (e) {
    guardSeed = e instanceof Error ? e.message : String(e);
  }
  let guardReset = "";
  try {
    await resetDemo(ctx as never);
    guardReset = "kein Fehler";
  } catch (e) {
    guardReset = e instanceof Error ? e.message : String(e);
  }
  process.env["APP_ENV"] = previousAppEnv;
  const { data: orgsAfter } = await admin.from("organizations").select("id");
  check("Guard: Seed bricht in Production hart ab", /nicht zulässig/.test(guardSeed), guardSeed.slice(0, 120));
  check("Guard: Reset bricht in Production hart ab", /nicht zulässig/.test(guardReset), guardReset.slice(0, 120));
  check(
    "Guard: keine Datenänderung durch blockierten Lauf",
    (orgsBefore ?? []).length === (orgsAfter ?? []).length,
    `${(orgsBefore ?? []).length} → ${(orgsAfter ?? []).length} Organisationen`,
  );
  const { count: auditBlocked } = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "security.demo_seed_blocked");
  check("Guard: Audit-Eintrag security.demo_seed_blocked", Number(auditBlocked ?? 0) > 0, `${auditBlocked} Einträge`);
  report["guard"] = { guardSeed, guardReset, auditBlocked };

  /* ---------- 2. Vollstaendiger Seed (frischer Ausgangszustand) ---------- */
  try {
    await resetDemo(ctx as never);
    console.log("  Vorlauf: bestehende Demo-Organisation entfernt.");
  } catch (e) {
    console.log("  Vorlauf-Reset uebersprungen:", e instanceof Error ? e.message : String(e));
  }
  const t0 = Date.now();
  const seedDetail = await runFullSeed(ctx, "run1");
  const env = await findDemoEnv(admin as never, userId);
  if (!env) throw new Error("Demo-Umgebung nach Seed nicht gefunden");
  const orgId = env.organizationId;
  const counts1 = await fullCounts(orgId);
  const status1 = await getDemoStatus(ctx as never);
  report["seed_run1"] = { detail: seedDetail, counts: counts1, seconds: Math.round((Date.now() - t0) / 1000) };
  console.log(JSON.stringify(counts1, null, 2));

  check("Seed: alle Schritte als vollständig gemeldet", Object.values(status1.steps).every(Boolean), JSON.stringify(status1.steps));
  check("Zähler: 32 Produkte", counts1["products"] === 32, `${counts1["products"]}`);
  check("Zähler: Varianten je Produkt vorhanden", (counts1["product_variants"] ?? 0) >= 32, `${counts1["product_variants"]}`);
  check("Zähler: Kategorien vorhanden (Seed-Definition: 6)", (counts1["categories"] ?? 0) >= 6, `${counts1["categories"]}`);
  check("Zähler: Kollektionen vorhanden (Seed-Definition: 3)", (counts1["collections"] ?? 0) >= 3, `${counts1["collections"]}`);
  check("Zähler: 12 Produktbilder", counts1["media_assets"] === 12, `${counts1["media_assets"]}`);
  check("Zähler: Produktbild-Zuordnungen vorhanden", (counts1["product_media"] ?? 0) >= 12, `${counts1["product_media"]}`);
  check("Zähler: Preise >= Varianten", (counts1["prices"] ?? 0) >= (counts1["product_variants"] ?? 0), `${counts1["prices"]}`);
  check("Zähler: Promotions >= 3", (counts1["promotions"] ?? 0) >= 3, `${counts1["promotions"]}`);
  check("Zähler: Bestände über Inventory Movements", (counts1["inventory_movements"] ?? 0) >= 32, `${counts1["inventory_movements"]}`);
  check("Zähler: 12 Kunden", counts1["customers"] === 12, `${counts1["customers"]}`);
  check("Zähler: Kundengruppen >= 2", (counts1["customer_groups"] ?? 0) >= 2, `${counts1["customer_groups"]}`);
  check(
    "Zähler: 40 Bestellvorgänge (36 Bestellungen + 4 offene Zahlungen)",
    (counts1["orders"] ?? 0) === 36 && (counts1["checkout_sessions"] ?? 0) === 40,
    `${counts1["orders"]} Bestellungen / ${counts1["checkout_sessions"]} Checkouts`,
  );
  check("Zähler: Bestellpositionen vorhanden", (counts1["order_items"] ?? 0) >= 40, `${counts1["order_items"]}`);
  check("Flow: Zahlungssitzungen je Bestellung", (counts1["payment_sessions"] ?? 0) >= 40, `${counts1["payment_sessions"]}`);
  check("Flow: Checkout-Sessions vorhanden", (counts1["checkout_sessions"] ?? 0) >= 40, `${counts1["checkout_sessions"]}`);
  check("Folgedaten: Rechnungen", (counts1["invoices"] ?? 0) > 0, `${counts1["invoices"]}`);
  check("Folgedaten: Versand/Fulfillment", (counts1["shipments"] ?? 0) > 0, `${counts1["shipments"]} Sendungen / ${counts1["fulfillments"]} Fulfillments`);
  check("Folgedaten: Kommunikation", (counts1["communications"] ?? 0) > 0, `${counts1["communications"]}`);
  check("Folgedaten: Steuer-Snapshots", (counts1["tax_snapshots"] ?? 0) > 0, `${counts1["tax_snapshots"]}`);

  // Blueprints
  const { data: bpRows } = await admin.from("products").select("blueprint_key").eq("organization_id", orgId);
  const blueprints = new Set((bpRows ?? []).map((r: { blueprint_key: string }) => r.blueprint_key));
  const { data: bpDefs } = await admin.from("product_blueprints").select("key").eq("status", "active");
  report["blueprints"] = { used: [...blueprints], available: (bpDefs ?? []).map((b: { key: string }) => b.key) };
  check("Blueprints: mindestens 5 unterschiedliche belegt", blueprints.size >= 5, [...blueprints].join(", "));

  // Beziehungen / Datenfehler
  const { data: healthData } = await admin.rpc("health_run_checks", { _org_id: orgId } as never);
  const findings = (healthData ?? []) as { code: string; severity: string; message: string }[];
  const blocking = findings.filter((f) => f.severity === "critical" || f.severity === "high");
  report["health"] = findings;
  check(
    "Integrität: Health-Engine ohne kritische Befunde",
    blocking.length === 0,
    blocking.length
      ? blocking.map((f) => `${f.code}: ${f.message}`).join(" | ").slice(0, 400)
      : `${findings.length} nachrangige Hinweise`,
  );

  const { data: orderStates } = await admin.from("orders").select("order_status, payment_status, fulfillment_status").eq("organization_id", orgId);
  const states = new Set((orderStates ?? []).map((o: { order_status: string }) => o.order_status));
  const payStates = new Set((orderStates ?? []).map((o: { payment_status: string }) => o.payment_status));
  report["order_states"] = { states: [...states], payment: [...payStates] };
  check("Bestellungen: mehrere Zustände abgedeckt", states.size >= 2 && payStates.size >= 3, `${[...states].join("/")} | ${[...payStates].join("/")}`);

  /* ---------- 3. Idempotenz ---------- */
  await runFullSeed(ctx, "run2");
  const counts2 = await fullCounts(orgId);
  const diffs = Object.keys(counts1).filter((k) => counts1[k] !== counts2[k]);
  report["idempotency"] = { counts: counts2, diffs: diffs.map((k) => `${k}: ${counts1[k]} → ${counts2[k]}`) };
  check("Idempotenz: keine Dubletten beim zweiten Lauf", diffs.length === 0, diffs.map((k) => `${k}: ${counts1[k]}→${counts2[k]}`).join(", ") || "alle Zähler identisch");

  /* ---------- 4. QA-Fixtures ---------- */
  const fixtureResults: Record<string, unknown>[] = [];
  for (const scenario of ["mixed_tax_order", "partial_fulfillment", "shipping_exception", "return_full"] as const) {
    let info: Awaited<ReturnType<typeof createQaFixture>> | null = null;
    try {
      info = await createQaFixture({ admin, userId, email: EMAIL } as never, scenario);
      check(`Fixture ${scenario}: erzeugt`, true, JSON.stringify(info.manifest).slice(0, 200));
    } catch (e) {
      check(`Fixture ${scenario}: erzeugt`, false, e instanceof Error ? e.message : String(e));
    }
    if (!info) continue;
    const fOrg = info.organizationId;
    const before = await fullCounts(fOrg);
    const destroy = await destroyQaFixture({ admin, userId, email: EMAIL } as never, info.id);
    const after = await fullCounts(fOrg);
    const leftovers = Object.entries(after).filter(([, v]) => v > 0);
    const { data: orgStill } = await admin.from("organizations").select("id").eq("id", fOrg).maybeSingle();
    const { data: files } = await admin.storage.from("media").list(fOrg, { limit: 100 });
    check(`Fixture ${scenario}: zerstört ohne DB-Reste`, leftovers.length === 0 && !orgStill, leftovers.map(([k, v]) => `${k}=${v}`).join(", ") || destroy.detail);
    check(`Fixture ${scenario}: keine Storage-Dateien`, (files ?? []).length === 0, `${(files ?? []).length} Dateien`);
    fixtureResults.push({ scenario, manifest: info.manifest, before, after, residual: destroy.residual, files: (files ?? []).length });
  }
  report["fixtures"] = fixtureResults;

  /* ---------- 5. Reset ---------- */
  const oldOrg = orgId;
  await resetDemo(ctx as never);
  const resetLeft = await fullCounts(oldOrg);
  const leftovers = Object.entries(resetLeft).filter(([, v]) => v > 0);
  const { data: oldOrgRow } = await admin.from("organizations").select("id").eq("id", oldOrg).maybeSingle();
  const { data: oldFiles } = await admin.storage.from("media").list(`${oldOrg}/demo`, { limit: 200 });
  check("Reset: Demo-Organisation entfernt", !oldOrgRow, oldOrgRow ? "Organisation existiert noch" : "gelöscht");
  check("Reset: keine Datenreste", leftovers.length === 0, leftovers.map(([k, v]) => `${k}=${v}`).join(", ") || "0 Zeilen");
  check("Reset: Storage bereinigt", (oldFiles ?? []).length === 0, `${(oldFiles ?? []).length} Dateien`);
  report["reset"] = { leftovers, files: (oldFiles ?? []).length };

  /* ---------- 6. Erneuter Seed ---------- */
  await runFullSeed(ctx, "run3");
  const env3 = await findDemoEnv(admin as never, userId);
  const counts3 = await fullCounts(env3!.organizationId);
  const diffs3 = Object.keys(counts1).filter((k) => counts1[k] !== counts3[k]);
  report["reseed"] = { counts: counts3, diffs: diffs3.map((k) => `${k}: ${counts1[k]} → ${counts3[k]}`) };
  check("Reseed: identischer Ausgangszustand", diffs3.length === 0, diffs3.map((k) => `${k}: ${counts1[k]}→${counts3[k]}`).join(", ") || "alle Zähler identisch");
  report["demo_org_id"] = env3!.organizationId;
  report["demo_user"] = { email: EMAIL, password: PASSWORD };

  writeFileSync("qa/results-phase15-demo.json", JSON.stringify({ results, report }, null, 2));
  summary();
}

main().catch((e) => {
  console.error(e);
  writeFileSync("qa/results-phase15-demo.json", JSON.stringify({ results, error: String(e) }, null, 2));
  process.exit(1);
});
