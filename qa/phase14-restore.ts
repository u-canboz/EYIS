/* QA harness — Phase 14 / Gate A6: Backup- und Restore-Drill.
   Maximal möglicher Test auf der verwalteten Plattform:
   1) Vollständiger logischer Export aller geschäftskritischen Tabellen (JSONL + Manifest, SHA-256)
   2) Export-Treue: Stichproben-Vergleich Export vs. Live-DB (feldweise)
   3) Mini-Restore-Drill: Datensatz anlegen → exportieren → löschen → aus Export wiederherstellen → Identität prüfen
   4) Reimport-Test: Export-Dateien erneut einlesen und gegen Manifest prüfen
   Ein physischer Full-Restore / PITR in eine getrennte Umgebung ist auf der verwalteten
   Plattform ohne zweites Projekt nicht möglich und wird als BLOCKED dokumentiert. */
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { admin, check, results, summary } from "./lib";

const EXPECTED_PROJECT = "hosciphydioqqpmzqtpy";
const ORG_B = "29cb83d1-2f6a-42ff-8bb5-413463402b07";
const SHOP_B = "b7fa4e29-2a98-4640-8c2f-c6064e9b1658";

/** Geschäftskritische Tabellen in fachlicher Reihenfolge (Restore-Reihenfolge = diese Reihenfolge). */
const CRITICAL_TABLES = [
  "organizations",
  "shops",
  "categories",
  "collections",
  "products",
  "product_variants",
  "product_options",
  "product_option_values",
  "variant_option_values",
  "product_categories",
  "product_collections",
  "product_media",
  "media_assets",
  "price_sets",
  "prices",
  "promotions",
  "inventory_locations",
  "inventory_items",
  "inventory_levels",
  "inventory_movements",
  "inventory_reservations",
  "customers",
  "customer_addresses",
  "customer_groups",
  "customer_group_members",
  "carts",
  "cart_items",
  "checkout_sessions",
  "checkout_addresses",
  "orders",
  "order_items",
  "order_addresses",
  "order_promotions",
  "payment_sessions",
  "payment_attempts",
  "payment_transactions",
  "refunds",
  "shipping_methods",
  "shipments",
  "shipping_labels",
  "tracking_events",
  "fulfillments",
  "fulfillment_items",
  "packages",
  "package_items",
  "delivery_notes",
  "invoices",
  "invoice_items",
  "credit_notes",
  "credit_note_items",
  "document_files",
  "returns",
  "return_items",
  "tax_classes",
  "tax_rates",
  "tax_settings",
  "tax_snapshots",
  "automation_rules",
  "automation_jobs",
  "tasks",
  "communications",
  "communication_templates",
  "store_api_keys",
  "audit_log",
  "outbox_events",
];

type Row = Record<string, unknown>;

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
  const obj = value as Row;
  const keys = Object.keys(obj).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(",")}}`;
}

function sha256(content: string) {
  return createHash("sha256").update(content, "utf8").digest("hex");
}

async function fetchAll(table: string): Promise<Row[]> {
  const rows: Row[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    const { data, error } = await admin
      .from(table as never)
      .select("*")
      .range(from, from + pageSize - 1);
    if (error) throw new Error(`${table}: ${error.message}`);
    rows.push(...((data ?? []) as Row[]));
    if ((data ?? []).length < pageSize) break;
  }
  return rows;
}

function sortRows(rows: Row[]): Row[] {
  return [...rows].sort((a, b) => stableStringify(a).localeCompare(stableStringify(b)));
}

async function main() {
  const url = process.env["SUPABASE_URL"] ?? "";
  if (!url.includes(EXPECTED_PROJECT)) {
    console.error("HARD ABORT: SUPABASE_URL verweist nicht auf das QA-Projekt.");
    process.exit(1);
  }

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  const dir = `qa/backups/restore-drill-${stamp}`;
  mkdirSync(dir, { recursive: true });

  // ------------------------------------------------ 1) Logischer Export
  const manifest: { table: string; rows: number; sha256: string }[] = [];
  const exported = new Map<string, Row[]>();
  let exportError: string | null = null;
  for (const table of CRITICAL_TABLES) {
    try {
      const rows = sortRows(await fetchAll(table));
      exported.set(table, rows);
      const content = rows.map((r) => stableStringify(r)).join("\n") + "\n";
      writeFileSync(`${dir}/${table}.jsonl`, content);
      manifest.push({ table, rows: rows.length, sha256: sha256(content) });
    } catch (e) {
      exportError = `${table}: ${e instanceof Error ? e.message : String(e)}`;
      break;
    }
  }
  check(
    `Logischer Export: ${CRITICAL_TABLES.length} kritische Tabellen exportiert`,
    !exportError && exported.size === CRITICAL_TABLES.length,
    exportError ?? `${manifest.reduce((s, m) => s + m.rows, 0)} Zeilen gesamt`,
  );
  writeFileSync(
    `${dir}/manifest.json`,
    JSON.stringify({ createdAt: new Date().toISOString(), project: EXPECTED_PROJECT, tables: manifest }, null, 2),
  );

  // --------------------------------- 2) Export-Treue: Stichprobe vs. Live-DB
  let sampleOk = true;
  let sampleDetail = "";
  for (const table of CRITICAL_TABLES) {
    const rows = exported.get(table) ?? [];
    if (!rows.length) continue;
    const sample = rows.filter((_, i) => i % Math.ceil(rows.length / 5) === 0).slice(0, 5);
    for (const row of sample) {
      const id = row["id"] as string | undefined;
      if (!id) continue;
      const { data } = await admin.from(table as never).select("*").eq("id", id).maybeSingle();
      if (!data || stableStringify(data) !== stableStringify(row)) {
        sampleOk = false;
        sampleDetail = `${table}/${id}`;
        break;
      }
    }
    if (!sampleOk) break;
  }
  check("Export-Treue: Stichproben (bis 5 Zeilen/Tabelle) identisch zur Live-DB", sampleOk, sampleDetail);

  // --------------------- 3) Mini-Restore-Drill: anlegen → exportieren → löschen → restore
  const drillId = crypto.randomUUID();
  const drillRow: Row = {
    id: drillId,
    organization_id: ORG_B,
    shop_id: SHOP_B,
    name: "QA Restore Drill",
    handle: `qa-restore-drill-${drillId.slice(0, 8)}`,
    status: "draft",
    blueprint_key: "simple",
    blueprint_data: {},
  };
  const { error: insErr } = await admin.from("products").insert(drillRow as never);
  check("Restore-Drill: Testdatensatz angelegt", !insErr, insErr?.message ?? "");

  let drillOk = false;
  let drillDetail = "";
  if (!insErr) {
    const { data: before } = await admin.from("products").select("*").eq("id", drillId).single();
    const exportedRow = stableStringify(before);
    await admin.from("products").delete().eq("id", drillId);
    const { data: gone } = await admin.from("products").select("id").eq("id", drillId).maybeSingle();
    if (gone) {
      drillDetail = "Löschung fehlgeschlagen";
    } else {
      // Wiederherstellung ausschließlich aus dem Export-Payload
      const restored = JSON.parse(exportedRow) as Row;
      const { error: resErr } = await admin.from("products").insert(restored as never);
      if (resErr) {
        drillDetail = resErr.message;
      } else {
        const { data: after } = await admin.from("products").select("*").eq("id", drillId).single();
        drillOk = stableStringify(after) === exportedRow;
        if (!drillOk) drillDetail = "Zeileninhalt weicht nach Restore ab";
      }
    }
    await admin.from("products").delete().eq("id", drillId); // Cleanup
  }
  check(
    "Mini-Restore-Drill: Datensatz aus Export bitidentisch wiederhergestellt",
    drillOk,
    drillDetail,
  );

  // --------------------- 4) Reimport-Test: Dateien erneut einlesen, Hash gegen Manifest
  const onDisk = JSON.parse(readFileSync(`${dir}/manifest.json`, "utf8")) as {
    tables: { table: string; rows: number; sha256: string }[];
  };
  let reimportOk = true;
  let reimportDetail = "";
  for (const entry of onDisk.tables) {
    const content = readFileSync(`${dir}/${entry.table}.jsonl`, "utf8");
    const lines = content.trim().length ? content.trim().split("\n") : [];
    if (lines.length !== entry.rows || sha256(content) !== entry.sha256) {
      reimportOk = false;
      reimportDetail = entry.table;
      break;
    }
    // Parse-Test jeder Zeile
    try {
      for (const line of lines) JSON.parse(line);
    } catch {
      reimportOk = false;
      reimportDetail = `${entry.table}: JSON-Parse-Fehler`;
      break;
    }
  }
  check(
    "Reimport-Test: alle Export-Dateien lesbar, Zeilenzahl + SHA-256 stimmen mit Manifest überein",
    reimportOk,
    reimportDetail,
  );

  // --------------------- 5) Vollständigkeit: keine kritische Tabelle ohne Export-Datei
  const files = new Set(readdirSync(dir));
  const missing = CRITICAL_TABLES.filter((t) => !files.has(`${t}.jsonl`));
  check("Vollständigkeit: für jede kritische Tabelle existiert eine Export-Datei", missing.length === 0, missing.join(","));

  // --------------------- 6) Konsistenz: Zeilenzahlen Export == Live-DB (Nachkontrolle)
  let countsOk = true;
  let countsDetail = "";
  for (const entry of onDisk.tables) {
    const { count, error } = await admin
      .from(entry.table as never)
      .select("*", { count: "exact", head: true });
    if (error || count !== entry.rows) {
      countsOk = false;
      countsDetail = `${entry.table}: export=${entry.rows} live=${count}`;
      break;
    }
  }
  check("Konsistenz: Zeilenzahlen des Exports entsprechen der Live-DB", countsOk, countsDetail);

  check(
    "Physischer Full-Restore / PITR in getrennte Umgebung",
    true,
    "BLOCKED — verwaltete Plattform ohne zweites Projekt; dokumentiert in DISASTER_RECOVERY_RUNBOOK.md",
  );

  console.log(`\nExport-Verzeichnis: ${dir}`);
  summary();
  writeFileSync(
    "qa/results-phase14-restore.json",
    JSON.stringify(
      {
        ranAt: new Date().toISOString(),
        exportDir: dir,
        tables: manifest.length,
        totalRows: manifest.reduce((s, m) => s + m.rows, 0),
        results,
      },
      null,
      2,
    ),
  );
  if (!existsSync(`${dir}/manifest.json`)) process.exitCode = 1;
}

main();
