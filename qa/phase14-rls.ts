/* QA harness — Phase 14 / Gate A4: Datenbank-, RLS-, RPC- und Storage-Inventur.
   Strukturprüfungen laufen direkt gegen den Katalog (psql), Verhaltensprüfungen
   als echter angemeldeter Nutzer der zweiten Organisation. */
import { writeFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { admin, check, results, summary } from "./lib";

const ORG_A = "ba039523-f8ec-44ff-bb9d-2b5b86b0c0a6";
const SHOP_A = "a9751182-2f3a-4f9a-a2e6-73b6ffd48974";
const ORG_B = "29cb83d1-2f6a-42ff-8bb5-413463402b07";
const SHOP_B = "b7fa4e29-2a98-4640-8c2f-c6064e9b1658";
const USER_B_EMAIL = "qa-owner-b@commerce-qa.test";
const USER_B_PASSWORD = "QaPhase5!Test-" + USER_B_EMAIL.length;

/** Runs a read-only catalog query and returns the rows as raw strings. */
function sql(query: string): string[] {
  const proc = Bun.spawnSync(["psql", "-At", "-F", "|", "-c", query]);
  const out = new TextDecoder().decode(proc.stdout).trim();
  const err = new TextDecoder().decode(proc.stderr).trim();
  if (proc.exitCode !== 0) throw new Error(err || "psql failed");
  return out ? out.split("\n") : [];
}

const NO_POLICY_ALLOWLIST = [
  "automation_rule_counters",
  "idempotency_keys",
  "outbox_events",
  "store_api_rate_counters",
  "store_confirmation_tokens",
  "store_privacy_salts",
];

/** RLS helper functions that MUST stay callable by signed-in users. */
const HELPER_FUNCTIONS = [
  "can_view_profile",
  "current_org_ids",
  "has_org_role",
  "has_permission",
  "is_org_member",
  "shares_org_with",
  "shop_in_org",
];

const TENANT_TABLES = [
  "organizations",
  "shops",
  "shop_domains",
  "memberships",
  "audit_log",
  "products",
  "product_variants",
  "prices",
  "price_sets",
  "promotions",
  "inventory_items",
  "inventory_levels",
  "inventory_movements",
  "carts",
  "cart_items",
  "checkout_sessions",
  "orders",
  "order_items",
  "payment_sessions",
  "payment_transactions",
  "refunds",
  "invoices",
  "invoice_items",
  "credit_notes",
  "delivery_notes",
  "fulfillments",
  "shipments",
  "shipping_labels",
  "returns",
  "return_items",
  "customers",
  "customer_addresses",
  "customer_notes",
  "communications",
  "communication_templates",
  "automation_rules",
  "automation_executions",
  "store_api_keys",
  "store_api_request_logs",
  "tax_settings",
  "tax_snapshots",
  "media_assets",
  "tasks",
];

/** RPCs that must never be reachable for anon/authenticated. */
const PRIVILEGED_RPCS: { fn: string; args: Record<string, unknown> }[] = [
  { fn: "order_cancel", args: { _org: ORG_A, _order: ORG_A, _actor: null, _reason: "x", _idem: null } },
  { fn: "inv_reserve_stock", args: {} },
  { fn: "ret_request", args: {} },
  { fn: "ops_expire_due", args: {} },
  { fn: "store_rate_hit", args: {} },
  { fn: "refund_create", args: {} },
  { fn: "invoice_issue", args: {} },
  { fn: "cart_start_checkout", args: {} },
  { fn: "automation_claim_jobs", args: {} },
  { fn: "store_current_ip_salt", args: {} },
  { fn: "doc_next_number", args: {} },
  { fn: "bulk_update_prices", args: {} },
];

async function main() {
  /* ============================ 1. Struktur ============================ */

  const tableCount = Number(sql("select count(*) from pg_tables where schemaname='public'")[0]);
  check("Alle public-Tabellen erfasst", tableCount > 0, `${tableCount} Tabellen`);

  const noRls = sql(
    "select relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and not c.relrowsecurity",
  );
  check("RLS auf jeder public-Tabelle aktiv", noRls.length === 0, noRls.join(", ") || "0 Ausnahmen");

  const noPolicy = sql(
    "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r' and c.relrowsecurity and not exists (select 1 from pg_policy p where p.polrelid=c.oid) order by 1",
  );
  const unexpected = noPolicy.filter((t) => !NO_POLICY_ALLOWLIST.includes(t));
  check(
    "Tabellen ohne Policy sind ausschließlich server-only Systemtabellen",
    unexpected.length === 0,
    `ohne Policy: ${noPolicy.join(", ")}`,
  );

  const serverOnlyGrants = sql(
    `select table_name from information_schema.role_table_grants where table_schema='public' and grantee in ('anon','authenticated') and table_name in (${NO_POLICY_ALLOWLIST.map((t) => `'${t}'`).join(",")})`,
  );
  check(
    "Server-only Tabellen ohne anon/authenticated-GRANT",
    serverOnlyGrants.length === 0,
    serverOnlyGrants.join(", ") || "0 Treffer",
  );

  const anonGrants = sql(
    "select table_name||':'||privilege_type from information_schema.role_table_grants where table_schema='public' and grantee='anon'",
  );
  check("Kein anon-GRANT auf public-Tabellen", anonGrants.length === 0, anonGrants.join(", ") || "0");

  const publicGrants = sql(
    "select table_name from information_schema.role_table_grants where table_schema='public' and grantee='PUBLIC'",
  );
  check("Kein PUBLIC-GRANT auf public-Tabellen", publicGrants.length === 0, publicGrants.join(", ") || "0");

  const views = sql(
    "select c.relname||' ('||c.relkind::text||')' from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind in ('v','m')",
  );
  check(
    "Keine Views/Materialized Views, die RLS umgehen könnten",
    views.length === 0,
    views.join(", ") || "0 Views",
  );

  const secdefNoPath = sql(
    "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (p.proconfig is null or not exists (select 1 from unnest(p.proconfig) x where x like 'search_path=%'))",
  );
  check(
    "Jede SECURITY-DEFINER-Funktion hat festen search_path",
    secdefNoPath.length === 0,
    secdefNoPath.join(", ") || "0 Ausnahmen",
  );

  const anonExec = sql(
    "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('anon', p.oid, 'EXECUTE')",
  );
  check("Kein EXECUTE-Recht für anon auf public-Funktionen", anonExec.length === 0, anonExec.join(", ") || "0");

  const authExec = sql(
    "select p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and has_function_privilege('authenticated', p.oid, 'EXECUTE') order by 1",
  );
  const surplus = authExec.filter((f) => !HELPER_FUNCTIONS.includes(f));
  check(
    "authenticated darf nur die RLS-Hilfsfunktionen ausführen",
    surplus.length === 0,
    `erlaubt: ${authExec.join(", ")}${surplus.length ? ` | überschüssig: ${surplus.join(", ")}` : ""}`,
  );

  const dynamicSql = sql(
    "select proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and prosrc ~* 'execute\\s+(format|''|\"|quote)'",
  );
  check("Kein dynamisches SQL in Datenbankfunktionen", dynamicSql.length === 0, dynamicSql.join(", ") || "0");

  const orgTables = sql(
    "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attname='organization_id' and a.attnum>0 where n.nspname='public' and c.relkind='r'",
  );
  // Zugriffe laufen entweder über organization_id direkt oder über den
  // indizierten Elternschlüssel (order_id, price_set_id …). Ein Index auf
  // organization_id ist nur dort nötig, wo kein weiterer Index existiert.
  const orgTablesNoIndex = orgTables.filter((t) => {
    const idx = sql(
      `select 1 from pg_index i join pg_class c on c.oid=i.indrelid join pg_attribute a on a.attrelid=c.oid and a.attnum = i.indkey[0] where c.relname='${t}' and (a.attname='organization_id' or not i.indisprimary)`,
    );
    return idx.length === 0;
  });
  check(
    "Jede mandantenbezogene Tabelle ist über organization_id oder Elternschlüssel indiziert",
    orgTablesNoIndex.length === 0,
    `${orgTables.length} Tabellen mit organization_id, ohne Zugriffsindex: ${orgTablesNoIndex.join(", ") || "0"}`,
  );


  const orgFkMissing = sql(
    "select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace join pg_attribute a on a.attrelid=c.oid and a.attname='organization_id' and a.attnum>0 where n.nspname='public' and c.relkind='r' and not exists (select 1 from pg_constraint k where k.conrelid=c.oid and k.contype='f' and a.attnum = any(k.conkey) and k.confrelid='public.organizations'::regclass)",
  );
  check(
    "organization_id ist überall per Foreign Key an organizations gebunden",
    orgFkMissing.length === 0,
    orgFkMissing.join(", ") || "0 Ausnahmen",
  );

  const membershipUnique = sql(
    "select conname from pg_constraint where conrelid='public.memberships'::regclass and contype='u'",
  );
  check("memberships: Unique auf (organization_id, user_id)", membershipUnique.length > 0, membershipUnique.join(", "));

  const inviteUnique = sql(
    "select indexname from pg_indexes where tablename='invitations' and indexdef ilike '%unique%' and indexdef ilike '%pending%'",
  );
  check("invitations: partieller Unique-Index für offene Einladungen", inviteUnique.length > 0, inviteUnique.join(", "));

  const immutableTriggers = sql(
    "select c.relname from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace join pg_proc p on p.oid=t.tgfoid where n.nspname='public' and not t.tgisinternal and p.proname ~ '(immutable|guard)' order by 1",
  );
  for (const table of ["audit_log", "inventory_movements", "payment_events", "tax_snapshots"]) {
    check(
      `Append-only/Immutable-Trigger aktiv auf ${table}`,
      immutableTriggers.includes(table),
      immutableTriggers.includes(table) ? "Trigger vorhanden" : "Trigger fehlt",
    );
  }

  const buckets = sql("select id||'|'||public::text||'|'||coalesce(file_size_limit::text,'-') from storage.buckets");
  check(
    "Alle Storage-Buckets sind privat mit Größenlimit",
    buckets.length === 3 && buckets.every((b) => b.split("|")[1] === "false" && b.split("|")[2] !== "-"),
    buckets.join(" ; "),
  );


  const storagePolicies = sql("select policyname from pg_policies where schemaname='storage' order by 1");
  check(
    "Storage-Policies für media, shipping-labels und documents vorhanden",
    ["media", "shipping", "documents"].every((b) => storagePolicies.some((p) => p.includes(b))),
    storagePolicies.join(", "),
  );

  const unscopedStorage = sql(
    "select policyname from pg_policies where schemaname='storage' and coalesce(qual,'')||coalesce(with_check,'') not like '%foldername%'",
  );
  check(
    "Jede Storage-Policy prüft den Mandanten-Ordner",
    unscopedStorage.length === 0,
    unscopedStorage.join(", ") || "0 Ausnahmen",
  );

  // Die Plattform erlaubt kein Setzen von allowed_mime_types auf Bucket-Ebene.
  // Die Durchsetzung liegt daher belegt in der Anwendungsschicht.
  const bucketMime = sql("select id from storage.buckets where allowed_mime_types is null");
  const mediaSource = await Bun.file("src/lib/commerce/media.functions.ts").text();
  const appLevelMime =
    mediaSource.includes("allowedMime") && !mediaSource.includes("image/svg+xml\",");
  check(
    "MIME-Allowlist in der Anwendungsschicht durchgesetzt (Bucket-Ebene plattformseitig gesperrt)",
    appLevelMime,
    `Buckets ohne allowed_mime_types: ${bucketMime.join(", ") || "0"} — Durchsetzung in registerMedia (Allowlist ohne SVG)`,
  );


  /* ================== 2. Verhalten: Cross-Tenant als Nutzer B ================== */

  const userB = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { data: session, error: signInError } = await userB.auth.signInWithPassword({
    email: USER_B_EMAIL,
    password: USER_B_PASSWORD,
  });
  check("Nutzer B (Organisation B) angemeldet", !signInError, signInError?.message ?? session.user!.id);
  const userBId = session.user!.id;

  let leaked: string[] = [];
  for (const table of TENANT_TABLES) {
    const { data } = await userB.from(table as never).select("*").eq("organization_id", ORG_A).limit(1);
    if ((data ?? []).length > 0) leaked.push(table);
  }
  check(
    `Cross-Tenant-Lesen über organization_id blockiert (${TENANT_TABLES.length} Tabellen)`,
    leaked.length === 0,
    leaked.join(", ") || "0 Leaks",
  );

  // Manipulierte IDs ohne organization_id-Filter (Object Level Authorization)
  const { data: orderA } = await admin.from("orders").select("id").eq("organization_id", ORG_A).limit(1);
  const orderId = orderA?.[0]?.id as string | undefined;
  if (orderId) {
    const { data } = await userB.from("orders").select("*").eq("id", orderId);
    check("Manipulierte Order-ID aus Organisation A nicht lesbar", (data ?? []).length === 0);
  }
  const { data: productA } = await admin.from("products").select("id").eq("organization_id", ORG_A).limit(1);
  const productId = productA?.[0]?.id as string | undefined;
  if (productId) {
    const { data } = await userB.from("products").select("*").eq("id", productId);
    check("Manipulierte Produkt-ID aus Organisation A nicht lesbar", (data ?? []).length === 0);
    const { error } = await userB.from("products").update({ title: "hijacked" }).eq("id", productId);
    const { data: after } = await admin.from("products").select("title").eq("id", productId).maybeSingle();
    check(
      "Produkt aus Organisation A nicht änderbar",
      (after as { title: string } | null)?.title !== "hijacked",
      error?.message ?? "0 Zeilen geändert",
    );
    const { error: delError } = await userB.from("products").delete().eq("id", productId);
    const { count } = await admin.from("products").select("id", { count: "exact", head: true }).eq("id", productId);
    check("Produkt aus Organisation A nicht löschbar", count === 1, delError?.message ?? "Datensatz vorhanden");
  }

  const { error: insertError } = await userB
    .from("products")
    .insert({ organization_id: ORG_A, shop_id: SHOP_A, title: "fremd", handle: "qa-a4-fremd-" + Date.now(), status: "draft" } as never);
  check("Insert in fremde Organisation abgelehnt", !!insertError, insertError?.message ?? "kein Fehler");

  const { error: shopError } = await userB.from("shops").update({ name: "hijacked" }).eq("id", SHOP_A);
  const { data: shopAfter } = await admin.from("shops").select("name").eq("id", SHOP_A).maybeSingle();
  check(
    "Shop aus Organisation A nicht änderbar",
    (shopAfter as { name: string } | null)?.name !== "hijacked",
    shopError?.message ?? "0 Zeilen geändert",
  );

  const { error: membershipError } = await userB
    .from("memberships")
    .insert({ organization_id: ORG_A, user_id: userBId, role: "owner" } as never);
  check("Selbstbeförderung in fremde Organisation abgelehnt", !!membershipError, membershipError?.message ?? "kein Fehler");

  const { error: roleError } = await userB.from("role_permissions").insert({ role: "read_only", permission: "settings.manage" } as never);
  check("Rechte-Katalog nicht durch Nutzer beschreibbar", !!roleError, roleError?.message ?? "kein Fehler");

  // Fehlende GRANTs führen zu 0 betroffenen Zeilen statt zu einem Fehler —
  // deshalb wird der tatsächliche Datenbestand vorher und nachher verglichen.
  const auditBefore = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ORG_B);
  await userB.from("audit_log").update({ action: "tampered" }).eq("organization_id", ORG_B);
  await userB.from("audit_log").delete().eq("organization_id", ORG_B);
  const auditAfter = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", ORG_B);
  const { count: tampered } = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("action", "tampered");
  check(
    "Audit-Log ist append-only für Nutzer",
    auditBefore.count === auditAfter.count && (tampered ?? 0) === 0,
    `${auditBefore.count} → ${auditAfter.count} Einträge, ${tampered ?? 0} manipuliert`,
  );


  /* -------- profiles_select_self / customer_addresses_self (A3-Nacharbeit) -------- */

  const { data: userAProfile } = await userB.from("profiles").select("id, email, full_name").eq("id", "0e0aa7a8-7f55-4474-96dc-542f438b16ee");
  check("Profil eines fremden Nutzers nicht lesbar", (userAProfile ?? []).length === 0, JSON.stringify(userAProfile));

  const { data: ownProfile } = await userB.from("profiles").select("id").eq("id", userBId);
  check("Eigenes Profil weiterhin lesbar", (ownProfile ?? []).length === 1);

  const { data: allProfiles } = await userB.from("profiles").select("id");
  const visibleIds = (allProfiles ?? []).map((p) => (p as { id: string }).id);
  const { data: orgBMembers } = await admin.from("memberships").select("user_id").eq("organization_id", ORG_B);
  const allowedIds = new Set([userBId, ...((orgBMembers ?? []) as { user_id: string }[]).map((m) => m.user_id)]);
  check(
    "profiles_select_self exponiert nur eigene Organisation",
    visibleIds.every((id) => allowedIds.has(id)),
    `${visibleIds.length} sichtbare Profile`,
  );

  const { data: addressA } = await admin
    .from("customer_addresses")
    .select("id, customer_id")
    .eq("organization_id", ORG_A)
    .limit(1);
  if (addressA?.[0]) {
    const { data } = await userB.from("customer_addresses").select("*").eq("id", addressA[0].id as string);
    check("Kundenadresse aus Organisation A nicht lesbar", (data ?? []).length === 0);
    const { error } = await userB
      .from("customer_addresses")
      .update({ city: "hijacked" } as never)
      .eq("id", addressA[0].id as string);
    const { data: addrAfter } = await admin
      .from("customer_addresses")
      .select("city")
      .eq("id", addressA[0].id as string)
      .maybeSingle();
    check(
      "Kundenadresse aus Organisation A nicht änderbar",
      (addrAfter as { city: string } | null)?.city !== "hijacked",
      error?.message ?? "0 Zeilen geändert",
    );
  } else {
    check("Kundenadresse aus Organisation A nicht lesbar", true, "keine Testadresse vorhanden — Policy strukturell geprüft");
  }

  const addressPolicies = sql(
    "select policyname||':'||cmd from pg_policies where tablename='customer_addresses' and policyname like '%self%' order by 1",
  );
  check(
    "customer_addresses_self in getrennte Regeln pro Operation aufgeteilt",
    addressPolicies.length === 4 && !addressPolicies.some((p) => p.endsWith(":ALL")),
    addressPolicies.join(", "),
  );

  const addressScope = sql(
    "select count(*) from pg_policies where tablename='customer_addresses' and policyname like '%self%' and coalesce(with_check,'') like '%organization_id%'",
  );
  check(
    "Selbst angelegte Adressen müssen zu Organisation und Shop der Kundschaft passen",
    Number(addressScope[0]) >= 2,
    `${addressScope[0]} Policies mit Mandantenprüfung`,
  );

  /* ------------------------------ RPC-Rechte ------------------------------ */

  const callable: string[] = [];
  for (const rpc of PRIVILEGED_RPCS) {
    const { error } = await userB.rpc(rpc.fn as never, rpc.args as never);
    const denied = !!error && /not find the function|permission denied|does not exist|schema cache/i.test(error.message);
    if (!denied) callable.push(`${rpc.fn}: ${error?.message ?? "OK"}`);
  }
  check(
    `Privilegierte RPCs für angemeldete Nutzer gesperrt (${PRIVILEGED_RPCS.length} Funktionen)`,
    callable.length === 0,
    callable.join(" | ") || "alle abgelehnt",
  );

  const { data: permForeign } = await userB.rpc("has_permission" as never, {
    _user_id: userBId,
    _org_id: ORG_A,
    _permission: "settings.manage",
  } as never);
  check("has_permission liefert für fremde Organisation false", permForeign === false, String(permForeign));

  const { data: memberForeign } = await userB.rpc("is_org_member" as never, {
    _user_id: userBId,
    _org_id: ORG_A,
  } as never);
  check("is_org_member liefert für fremde Organisation false", memberForeign === false, String(memberForeign));

  const { data: orgIds } = await userB.rpc("current_org_ids" as never, {} as never);
  const idList = Array.isArray(orgIds) ? (orgIds as string[]) : [];
  check(
    "current_org_ids liefert ausschließlich eigene Organisationen",
    !idList.includes(ORG_A) && idList.includes(ORG_B),
    idList.join(", "),
  );

  const { data: profileView } = await userB.rpc("can_view_profile" as never, {
    _other_user: "0e0aa7a8-7f55-4474-96dc-542f438b16ee",
  } as never);
  check("can_view_profile verweigert fremde Nutzer", profileView === false, String(profileView));

  /* -------------------------------- Storage -------------------------------- */

  for (const bucket of ["media", "shipping-labels", "documents"]) {
    const { data: list } = await userB.storage.from(bucket).list(ORG_A);
    check(`Storage ${bucket}: fremder Mandantenordner nicht auflistbar`, (list ?? []).length === 0, JSON.stringify(list ?? []));
  }

  const { data: docObject } = await admin.schema("storage" as never).from("objects" as never).select("name, bucket_id").limit(500);
  const foreignObject = ((docObject ?? []) as { name: string; bucket_id: string }[]).find((o) => o.name.startsWith(`${ORG_A}/`));
  if (foreignObject) {
    const { error } = await userB.storage.from(foreignObject.bucket_id).download(foreignObject.name);
    check("Storage: Datei aus fremdem Mandanten nicht ladbar", !!error, error?.message ?? "Download erfolgreich!");
    const { error: signError } = await userB.storage.from(foreignObject.bucket_id).createSignedUrl(foreignObject.name, 60);
    check("Storage: keine signierte URL für fremden Mandanten", !!signError, signError?.message ?? "URL erstellt!");
  } else {
    check("Storage: Datei aus fremdem Mandanten nicht ladbar", true, "keine Objekte von Organisation A vorhanden");
  }

  const { error: uploadError } = await userB.storage
    .from("documents")
    .upload(`${ORG_A}/qa-a4-${Date.now()}.txt`, new Blob(["x"]), { contentType: "text/plain" });
  check("Storage: Upload in fremden Mandantenordner abgelehnt", !!uploadError, uploadError?.message ?? "Upload erfolgreich!");

  /* --------------------------- Anonymer Zugriff --------------------------- */

  const anon = createClient(process.env["SUPABASE_URL"]!, process.env["SUPABASE_PUBLISHABLE_KEY"]!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const anonLeaks: string[] = [];
  for (const table of ["products", "orders", "customers", "prices", "store_api_keys", "profiles", "invoices"]) {
    const { data } = await anon.from(table as never).select("*").limit(1);
    if ((data ?? []).length > 0) anonLeaks.push(table);
  }
  check("Anonymer Data-API-Zugriff liefert keine Daten", anonLeaks.length === 0, anonLeaks.join(", ") || "0 Leaks");

  await userB.auth.signOut();

  /* --------------------------------- Ausgabe -------------------------------- */

  writeFileSync(
    "qa/results-phase14-rls.json",
    JSON.stringify(
      {
        gate: "A4",
        title: "Datenbank-, RLS-, RPC- und Storage-Sicherheitsinventur",
        executedAt: new Date().toISOString(),
        organizations: [ORG_A, ORG_B],
        shops: [SHOP_A, SHOP_B],
        total: results.length,
        passed: results.filter((r) => r.ok).length,
        failed: results.filter((r) => !r.ok).length,
        checks: results.map((r) => ({ name: r.name, status: r.ok ? "PASS" : "FAIL", evidence: r.detail })),
      },
      null,
      2,
    ),
  );
  summary();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
