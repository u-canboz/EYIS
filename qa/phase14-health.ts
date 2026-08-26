/* QA harness — Phase 14 / Gate A5: Commerce Health & Datenintegrität.
   Läuft ausschließlich gegen die QA-Organisationen aus qa/state.json.
   Injektionen werden nach jedem Test vollständig zurückgerollt. */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { admin, check, results, summary } from "./lib";

const EXPECTED_PROJECT = "hosciphydioqqpmzqtpy";
const ORG_A = "ba039523-f8ec-44ff-bb9d-2b5b86b0c0a6";
const ORG_B = "29cb83d1-2f6a-42ff-8bb5-413463402b07";
const SHOP_A = "a9751182-2f3a-4f9a-a2e6-73b6ffd48974";
const ITEM_ID = "9a922ffc-ed9a-494d-b423-1a144e97a499";
const LOCATION_ID = "ad5bd83e-16cc-4f41-86d5-5554bd40f868";
const USER_B_EMAIL = "qa-owner-b@commerce-qa.test";
const USER_B_PASSWORD = "QaPhase5!Test-" + USER_B_EMAIL.length;

type Finding = {
  code: string;
  area: string;
  severity: string;
  entityType: string;
  entityId: string | null;
  shopId: string | null;
  message: string;
};

function guardQaEnvironment() {
  const url = process.env["SUPABASE_URL"] ?? "";
  if (!url.includes(EXPECTED_PROJECT)) {
    console.error(`HARD ABORT: SUPABASE_URL verweist nicht auf das QA-Projekt (${url}).`);
    process.exit(1);
  }
}

async function runAs(client: typeof admin, orgId: string): Promise<Finding[]> {
  const { data, error } = await client.rpc("health_run_checks", { _org_id: orgId });
  if (error) throw new Error(error.message);
  return (data ?? []) as Finding[];
}

async function main() {
  guardQaEnvironment();

  // 1) Service-Role-Lauf für Org A
  let baseline: Finding[] = [];
  try {
    baseline = await runAs(admin, ORG_A);
    check("service_role: Lauf für Org A erfolgreich", true, `${baseline.length} Befund(e)`);
  } catch (e) {
    check("service_role: Lauf für Org A erfolgreich", false, String(e));
    summary();
    writeFileSync("qa/results-phase14-health.json", JSON.stringify(results, null, 2));
    return;
  }

  // 2) Ergebnisform
  const shapeOk = baseline.every(
    (f) => f.code && f.area && f.severity && f.entityType && typeof f.message === "string",
  );
  check("Ergebnisform: code/area/severity/entityType/message vorhanden", shapeOk);

  // 3) Mandanten-Scope: alle Befunde betreffen nur Org-A-Shops/Entities
  const shopIds = new Set(baseline.map((f) => f.shopId).filter(Boolean));
  check(
    "Mandanten-Scope: keine fremden Shop-IDs im Org-A-Lauf",
    [...shopIds].every((s) => s === SHOP_A || s === null),
    [...shopIds].join(","),
  );

  // 4) Immutability-Konfigurationscheck: Trigger aktiv → kein Befund
  check(
    "Konfiguration: tax_snapshot_immutable aktiv (kein tax_snapshot_mutable-Befund)",
    !baseline.some((f) => f.code === "tax_snapshot_mutable"),
  );

  // 5) Zugriff: Owner von Org B darf eigene Org prüfen
  const userB = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_ANON_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const signIn = await userB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  check("User B (Owner Org B) angemeldet", !signIn.error, signIn.error?.message ?? "");

  try {
    const own = await runAs(userB as unknown as typeof admin, ORG_B);
    check("User B: Lauf für eigene Org B erlaubt", true, `${own.length} Befund(e)`);
  } catch (e) {
    check("User B: Lauf für eigene Org B erlaubt", false, String(e));
  }

  // 6) Zugriff: User B darf Org A NICHT prüfen (Cross-Tenant)
  try {
    await runAs(userB as unknown as typeof admin, ORG_A);
    check("Cross-Tenant: User B → Org A abgelehnt", false, "kein Fehler geworfen");
  } catch (e) {
    check(
      "Cross-Tenant: User B → Org A abgelehnt",
      String(e).includes("Keine Berechtigung") || String(e).includes("insufficient_privilege"),
      String(e).slice(0, 120),
    );
  }

  // 7) Zugriff: anonymer Aufruf abgelehnt
  const anon = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_ANON_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  try {
    await anon.rpc("health_run_checks", { _org_id: ORG_A });
    check("Anonym: Aufruf abgelehnt", false, "kein Fehler geworfen");
  } catch (e) {
    check("Anonym: Aufruf abgelehnt", true, String(e).slice(0, 120));
  }

  // 8) Injektion Inventory: negative Verfügbarkeit + Reserved-Mismatch
  const { data: level } = await admin
    .from("inventory_levels")
    .select("id, on_hand, reserved, damaged, incoming")
    .eq("inventory_item_id", ITEM_ID)
    .eq("location_id", LOCATION_ID)
    .single();
  check("Injektion vorbereitet: Inventory-Level gefunden", !!level);

  if (level) {
    await admin
      .from("inventory_levels")
      .update({ reserved: level.on_hand + 50 })
      .eq("id", level.id);
    const during = await runAs(admin, ORG_A);
    check(
      "Injektion erkannt: negative_availability",
      during.some((f) => f.code === "negative_availability" && f.entityId === level.id),
    );
    check(
      "Injektion erkannt: reserved_mismatch",
      during.some((f) => f.code === "reserved_mismatch" && f.entityId === level.id),
    );
    await admin.from("inventory_levels").update({ reserved: level.reserved }).eq("id", level.id);
    const after = await runAs(admin, ORG_A);
    check(
      "Rollback: Inventory-Befunde nach Wiederherstellung weg",
      !after.some(
        (f) =>
          (f.code === "negative_availability" || f.code === "reserved_mismatch") &&
          f.entityId === level.id,
      ),
    );
  }

  // 9) Injektion Orders: abgeschlossener Warenkorb ohne Bestellung
  const { data: cart, error: cartError } = await admin
    .from("carts")
    .insert({
      organization_id: ORG_A,
      shop_id: SHOP_A,
      status: "completed",
      currency_code: "EUR",
      completed_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  check("Injektion vorbereitet: completed Cart ohne Order", !cartError, cartError?.message ?? "");

  if (cart) {
    const during = await runAs(admin, ORG_A);
    check(
      "Injektion erkannt: completed_cart_without_order",
      during.some((f) => f.code === "completed_cart_without_order" && f.entityId === cart.id),
    );
    await admin.from("carts").delete().eq("id", cart.id);
    const after = await runAs(admin, ORG_A);
    check(
      "Rollback: Cart-Befund nach Löschung weg",
      !after.some((f) => f.code === "completed_cart_without_order" && f.entityId === cart.id),
    );
  }

  summary();
  writeFileSync(
    "qa/results-phase14-health.json",
    JSON.stringify({ runAt: new Date().toISOString(), baseline, results }, null, 2),
  );
}

main();
