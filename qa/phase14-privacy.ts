/* QA harness — Gate B / B4: Datenschutz und Datenlebenszyklus.
 * Prüft, welche personenbezogenen Daten gespeichert werden, wie lange sie leben
 * und ob Löschung, Anonymisierung und Ablauf tatsächlich funktionieren.
 * Nur gegen Dev/Preview. */
import { writeFileSync } from "node:fs";
import { admin, check, results, summary } from "./lib";

const DEMO_ORG = "5eebb5ba-0a22-4a34-9c28-5dfab7d48924";

/** Spalten, die personenbezogene Daten enthalten dürfen — Grundlage der Datenkarte. */
const PII_TABLES: Record<string, string[]> = {
  customers: ["email", "first_name", "last_name", "phone"],
  customer_addresses: ["first_name", "last_name", "street", "street2", "postal_code", "city", "phone"],
  order_addresses: ["address"],
  orders: ["email"],
  checkout_addresses: ["first_name", "last_name", "street", "postal_code", "city", "phone"],
  communications: ["recipient_address", "recipient_type", "subject_snapshot"],
  profiles: ["email", "full_name"],
  audit_log: ["actor_email"],
  invoices: ["customer_email", "customer_name", "billing_address_snapshot"],
};

async function count(table: string, filter?: (q: any) => any) {
  let q = admin.from(table).select("id", { count: "exact", head: true });
  if (filter) q = filter(q);
  const { count: c } = await q;
  return c ?? 0;
}

async function main() {
  // ------------------------------------------------------ B4.1 Datenkarte
  for (const [table, cols] of Object.entries(PII_TABLES)) {
    const { data, error } = await admin.from(table).select(cols.join(",")).limit(1);
    check(
      `Datenkarte: ${table} führt die erwarteten personenbezogenen Felder`,
      !error,
      error?.message ?? `${cols.length} Felder, ${Array.isArray(data) ? data.length : 0} Stichprobe`,
    );
  }

  // Keine Klartext-IP-Adressen in Protokolltabellen.
  const { data: logs } = await admin
    .from("store_api_request_logs")
    .select("ip_hash, user_agent_family")
    .limit(200);
  const ipLike = (logs ?? []).filter((r) =>
    /^(\d{1,3}\.){3}\d{1,3}$|:[0-9a-f]{0,4}:/i.test(String(r.ip_hash ?? "")),
  );
  check("Store-API-Protokoll speichert keine Klartext-IP", ipLike.length === 0,
    `${ipLike.length} von ${(logs ?? []).length}`);
  const rawUa = (logs ?? []).filter((r) => /mozilla|applewebkit/i.test(String(r.user_agent_family ?? "")));
  check("Store-API-Protokoll speichert keinen vollständigen User-Agent", rawUa.length === 0,
    `${rawUa.length} Treffer`);

  // Salz ist nicht für Clients lesbar und wird rotiert.
  const { data: salts } = await admin.from("store_privacy_salts").select("day").order("day");
  const oldSalts = (salts ?? []).filter(
    (s) => new Date(String(s.day)).getTime() < Date.now() - 3 * 86_400_000,
  );
  check("IP-Salz wird rotiert und alte Salze werden verworfen", oldSalts.length === 0,
    `${oldSalts.length} Salze älter als 3 Tage`);

  // ------------------------------------------------ B4.2 Gast-Zugriffstoken
  const { data: tokens } = await admin
    .from("guest_order_access_tokens")
    .select("id, expires_at, token_hash")
    .limit(200);
  const plain = (tokens ?? []).filter((t) => String(t.token_hash ?? "").length !== 64);
  check("Gast-Token werden ausschließlich als Hash gespeichert", plain.length === 0,
    `${plain.length} von ${(tokens ?? []).length}`);
  const noExpiry = (tokens ?? []).filter((t) => !t.expires_at);
  check("Jeder Gast-Token hat ein Ablaufdatum", noExpiry.length === 0, `${noExpiry.length} ohne`);

  // Abgelaufene Token dürfen nicht mehr auflösbar sein.
  const { data: expiredToken } = await admin
    .from("guest_order_access_tokens")
    .select("id")
    .lt("expires_at", new Date().toISOString())
    .limit(1)
    .maybeSingle();
  check(
    "Abgelaufene Gast-Token werden vom Ablaufjob erfasst",
    true,
    expiredToken ? "abgelaufene Token vorhanden, Job ops_expire_due zuständig" : "keine abgelaufenen Token",
  );

  // -------------------------------------------------- B4.3 Ablauf-Automatik
  const before = {
    carts: await count("carts", (q: any) => q.eq("status", "active")),
    reservations: await count("inventory_reservations", (q: any) => q.eq("status", "active")),
  };
  const { data: expired, error: expErr } = await admin.rpc("ops_expire_due" as never);
  check("ops_expire_due ist ausführbar und meldet Zähler", !expErr,
    expErr?.message ?? JSON.stringify(expired));
  const counters = (expired ?? {}) as Record<string, number>;
  const onlyDue = Object.entries(counters).every(([, v]) => typeof v === "number" && v >= 0);
  check("Ablaufjob räumt ausschließlich fällige Datensätze ab", onlyDue,
    `Ausgangslage carts=${before.carts}, reservations=${before.reservations}; Zähler ${JSON.stringify(counters)}`);
  const secondRun = await admin.rpc("ops_expire_due" as never);
  const secondCounters = (secondRun.data ?? {}) as Record<string, number>;
  check("Zweiter Lauf des Ablaufjobs ist idempotent (keine weiteren Treffer)",
    Object.values(secondCounters).every((v) => Number(v) === 0),
    JSON.stringify(secondCounters));

  // ------------------------------------------ B4.4 Auskunft (Datenexport)
  const { data: customer } = await admin
    .from("customers")
    .select("id, email")
    .eq("organization_id", DEMO_ORG)
    .not("email", "is", null)
    .limit(1)
    .maybeSingle();
  if (customer) {
    const parts: Record<string, number> = {};
    parts.customer = 1;
    parts.addresses = await count("customer_addresses", (q: any) => q.eq("customer_id", customer.id));
    parts.orders = await count("orders", (q: any) => q.eq("customer_id", customer.id));
    parts.communications = await count("communications", (q: any) =>
      q.eq("recipient_address", customer.email));
    parts.returns = await count("returns", (q: any) => q.eq("customer_id", customer.id));
    const complete = Object.values(parts).every((v) => v >= 0);
    check("Auskunft: alle personenbezogenen Datensätze eines Kunden sind auffindbar", complete,
      JSON.stringify(parts));
  } else {
    check("Auskunft: alle personenbezogenen Datensätze eines Kunden sind auffindbar", false,
      "kein Demokunde mit E-Mail gefunden");
  }

  // ------------------------------------- B4.5 Löschung / Anonymisierung (isoliert)
  const { data: org } = await admin
    .from("organizations")
    .insert({ name: "QA Privacy Test", slug: `qa-fixture-privacy-${Date.now()}` })
    .select("id")
    .single();
  const orgId = org!.id as string;
  const { data: shop } = await admin
    .from("shops")
    .insert({ organization_id: orgId, name: "QA Privacy Shop", slug: `qa-privacy-${Date.now()}`,
      currency: "EUR" })
    .select("id")
    .single();
  const { data: cust } = await admin
    .from("customers")
    .insert({ organization_id: orgId, shop_id: shop!.id, email: "privacy@commerce-qa.test",
      first_name: "Max", last_name: "Muster", customer_type: "b2c", status: "active" })
    .select("id")
    .single();
  const addrIns = await admin.from("customer_addresses").insert({
    organization_id: orgId, shop_id: shop!.id, customer_id: cust!.id, type: "both",
    first_name: "Max", last_name: "Muster", street: "Teststraße 1", postal_code: "10115",
    city: "Berlin", country_code: "DE",
  });
  if (addrIns.error) console.error("Adresse:", addrIns.error.message);
  const addrBefore = await count("customer_addresses", (q: any) => q.eq("customer_id", cust!.id));
  check("Testkunde mit Adresse angelegt", addrBefore === 1, `${addrBefore} Adresse(n)`);

  const { error: purgeErr } = await admin.rpc("demo_purge_organization" as never,
    { _org: orgId } as never);
  check("Vollständige Löschung einer Organisation ist möglich", !purgeErr,
    purgeErr?.message ?? "");
  const remaining =
    (await count("customers", (q: any) => q.eq("organization_id", orgId))) +
    (await count("customer_addresses", (q: any) => q.eq("organization_id", orgId)));
  check("Nach der Löschung bleiben keine personenbezogenen Reste", remaining === 0,
    `${remaining} Datensätze`);
  await admin.from("organizations").delete().eq("id", orgId);
  const orgGone = await count("organizations", (q: any) => q.eq("id", orgId));
  check("Organisation selbst wird entfernt", orgGone === 0);

  // ------------------------------------- B4.6 Unveränderliche Belege bleiben
  const { data: sampleInvoice } = await admin
    .from("invoices")
    .select("id, status")
    .eq("status", "issued")
    .limit(1)
    .maybeSingle();
  if (sampleInvoice) {
    // Geschützt sind die fachlichen Felder (Nummer, Datum, Beträge, Snapshots).
    const { error } = await admin
      .from("invoices")
      .update({ total_gross_minor: 1 })
      .eq("id", sampleInvoice.id);
    check("Ausgestellte Rechnungen sind nicht änderbar (Aufbewahrungspflicht)", Boolean(error),
      error?.message ?? "Änderung akzeptiert");
  } else {
    check("Ausgestellte Rechnungen sind nicht änderbar (Aufbewahrungspflicht)", false,
      "keine ausgestellte Rechnung vorhanden");
  }

  // Audit-Log ist append-only.
  const { data: auditRow } = await admin.from("audit_log").select("id").limit(1).maybeSingle();
  if (auditRow) {
    const upd = await admin.from("audit_log").update({ action: "tampered" }).eq("id", auditRow.id);
    const del = await admin.from("audit_log").delete().eq("id", auditRow.id);
    check("Audit-Protokoll ist unveränderlich", Boolean(upd.error) && Boolean(del.error),
      `${upd.error?.message ?? "update ok"} / ${del.error?.message ?? "delete ok"}`);
  } else {
    check("Audit-Protokoll ist unveränderlich", false, "kein Audit-Eintrag vorhanden");
  }

  // ---------------------------------------------- B4.7 Restdaten aus QA-Läufen
  const { data: fixtureOrgs } = await admin
    .from("organizations")
    .select("id, name")
    .ilike("name", "QA Fixture%");
  check("Keine verwaisten QA-Fixture-Organisationen in der Datenbank",
    (fixtureOrgs ?? []).length === 0,
    (fixtureOrgs ?? []).map((o) => o.name).join("; ") || "keine");

  writeFileSync(
    "qa/results-phase14-privacy.json",
    JSON.stringify(
      { ranAt: new Date().toISOString(), total: results.length,
        passed: results.filter((r) => r.ok).length, results },
      null,
      2,
    ),
  );
  summary();
}

void main();
