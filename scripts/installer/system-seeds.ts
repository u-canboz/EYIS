/**
 * Canonical System Seeds — Definition, Extraktion und Verifikation.
 *
 * Hintergrund: Systemdaten (Rollenrechte, Produkt-Blueprints, System-Mail-
 * Vorlagen, System-Steuerklassen) lagen bisher verstreut als DML in der
 * Migrationskette. Eine Fresh-Install-Datenbank aus dem Baseline-Pack enthält
 * ausschließlich Struktur — die Systemdaten fehlten und `/app` war ohne
 * Blueprints und Vorlagen nicht arbeitsfähig.
 *
 * Diese Datei ist die einzige Wahrheit darüber, welche Systemdaten eine
 * vollständige EYIS-Installation besitzen muss. Sie wird sowohl vom Generator
 * (`eyis:seeds:generate`) als auch von der Verifikation (`eyis:seeds:verify`)
 * und vom Doctor gelesen.
 *
 * Kundendaten sind hier ausdrücklich nie enthalten.
 */

import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

export const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");
export const SEEDS_DIR = join(process.cwd(), "installer", "database", "seeds");
export const SEED_MANIFEST_PATH = join(SEEDS_DIR, "eyis-system-seeds.manifest.json");

/** Quelle einer Seed-Unit: eine Anweisung aus der historischen Migrationskette. */
export type SeedSource = {
  /** Präfix der Migrationsdatei (Version). */
  migration: string;
  /** Zeilenanfang, an dem die Anweisung beginnt (exakter Textvergleich). */
  anchor: string;
};

export type SeedUnit = {
  id: string;
  file: string;
  title: string;
  /** Tabellen, die diese Unit befüllt. */
  tables: string[];
  /** Bedingung, die vor dem Einfügen geprüft wird (Idempotenz). */
  guard: string;
  sources: SeedSource[];
  /** Mindestanzahl Zeilen, die nach dem Seeding vorhanden sein muss. */
  expect: { table: string; where: string; min: number }[];
  /** Fachliche Schlüssel, die zwingend existieren müssen. */
  requiredKeys?: { table: string; column: string; keys: string[]; where?: string };
};

/**
 * Vollständiger Katalog der Systemdaten. `001_role_permissions.sql` wird vom
 * Baseline-Generator erzeugt und ist hier als bestehende Unit registriert.
 */
export const SEED_UNITS: SeedUnit[] = [
  {
    id: "001_role_permissions",
    file: "001_role_permissions.sql",
    title: "Rollen und Berechtigungen",
    tables: ["role_permissions"],
    guard: "generated",
    sources: [],
    expect: [{ table: "role_permissions", where: "true", min: 100 }],
  },
  {
    id: "002_installation",
    file: "002_installation.sql",
    title: "Installations-Singleton",
    tables: ["commerce_installation"],
    guard: "generated",
    sources: [],
    expect: [{ table: "commerce_installation", where: "true", min: 1 }],
  },
  {
    id: "003_product_blueprints",
    file: "003_product_blueprints.sql",
    title: "System-Produkt-Blueprints",
    tables: ["product_blueprints"],
    guard: "NOT EXISTS (SELECT 1 FROM public.product_blueprints WHERE is_system)",
    sources: [
      {
        migration: "20260825080717",
        anchor: "INSERT INTO public.product_blueprints (key, name, description, icon, version, is_system, schema, variant_schema) VALUES",
      },
    ],
    expect: [{ table: "product_blueprints", where: "is_system", min: 9 }],
    requiredKeys: {
      table: "product_blueprints",
      column: "key",
      where: "is_system",
      keys: [
        "standard",
        "textil",
        "lebensmittel",
        "kosmetik",
        "elektronik",
        "moebel",
        "schmuck",
        "digital",
        "dienstleistung",
      ],
    },
  },
  {
    id: "004_communication_templates",
    file: "004_communication_templates.sql",
    title: "System-E-Mail-Vorlagen",
    tables: ["communication_templates", "communication_template_versions"],
    guard:
      "NOT EXISTS (SELECT 1 FROM public.communication_templates WHERE is_system AND organization_id IS NULL)",
    sources: [
      {
        migration: "20260825182452",
        anchor: "WITH seed(key, category, name, description, subject, heading, intro, block, cta, cta_url, active) AS (VALUES",
      },
    ],
    expect: [
      { table: "communication_templates", where: "is_system AND organization_id IS NULL", min: 23 },
      { table: "communication_template_versions", where: "true", min: 23 },
    ],
    requiredKeys: {
      table: "communication_templates",
      column: "key",
      where: "is_system AND organization_id IS NULL",
      keys: [
        "order.confirmed",
        "payment.confirmed",
        "payment.failed",
        "refund.completed",
        "shipment.shipped",
        "shipment.delivered",
        "invoice.issued",
        "credit_note.issued",
        "return.requested",
        "return.refunded",
        "customer.welcome",
        "guest_order_access",
      ],
    },
  },
  {
    id: "005_tax_system",
    file: "005_tax_system.sql",
    title: "System-Steuerklassen und DE-Preset",
    tables: ["tax_classes", "tax_rates"],
    guard:
      "NOT EXISTS (SELECT 1 FROM public.tax_classes WHERE is_system AND organization_id IS NULL)",
    sources: [
      {
        migration: "20260825143734",
        anchor: "INSERT INTO public.tax_classes (organization_id, name, code, description, is_system) VALUES",
      },
      {
        migration: "20260825143734",
        anchor: "INSERT INTO public.tax_rates (organization_id, tax_class_id, country_code, rate_basis_points, customer_type, source, metadata)",
      },
    ],
    expect: [
      { table: "tax_classes", where: "is_system AND organization_id IS NULL", min: 7 },
      { table: "tax_rates", where: "organization_id IS NULL", min: 7 },
    ],
    requiredKeys: {
      table: "tax_classes",
      column: "code",
      where: "is_system AND organization_id IS NULL",
      keys: ["standard", "reduced", "zero", "digital", "food", "books", "shipping"],
    },
  },
];

export function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function migrationPath(version: string) {
  const file = readdirSync(MIGRATIONS_DIR).find((f) => f.startsWith(version));
  if (!file) throw new Error(`Migration ${version} nicht gefunden.`);
  return join(MIGRATIONS_DIR, file);
}

/**
 * Extrahiert eine einzelne SQL-Anweisung ab dem Anker bis zum abschließenden
 * Semikolon auf Klammertiefe 0. Die betroffenen Anweisungen enthalten keine
 * Dollar-Quotes; Zeichenketten werden korrekt übersprungen.
 */
export function extractStatement(source: SeedSource): string {
  const lines = readFileSync(migrationPath(source.migration), "utf8").split("\n");
  const start = lines.findIndex((l) => l.trimEnd() === source.anchor);
  if (start === -1) {
    throw new Error(`Anker nicht gefunden in ${source.migration}: ${source.anchor.slice(0, 60)}…`);
  }
  let depth = 0;
  let inString = false;
  const out: string[] = [];
  for (let i = start; i < lines.length; i += 1) {
    const line = lines[i]!;
    out.push(line);
    for (let c = 0; c < line.length; c += 1) {
      const ch = line[c];
      if (inString) {
        if (ch === "'") {
          if (line[c + 1] === "'") c += 1;
          else inString = false;
        }
        continue;
      }
      if (ch === "'") inString = true;
      else if (ch === "(") depth += 1;
      else if (ch === ")") depth -= 1;
      else if (ch === ";" && depth === 0) return out.join("\n").trimEnd();
    }
  }
  throw new Error(`Anweisung in ${source.migration} nicht abgeschlossen.`);
}

/** Baut den idempotenten Inhalt einer Seed-Datei aus ihren Quellen. */
export function renderSeedFile(unit: SeedUnit): string {
  const body = unit.sources
    .map((s) => extractStatement(s))
    .join("\n\n")
    .split("\n")
    .map((l) => (l.length ? `  ${l}` : l))
    .join("\n");

  return `-- EYIS System Seed — ${unit.id}: ${unit.title}
--
-- ERZEUGT von scripts/installer/generate-system-seeds.ts. Nicht von Hand ändern.
-- Quelle: ${unit.sources.map((s) => s.migration).join(", ")}
-- Idempotent: mehrfaches Ausführen verändert nichts.

DO $eyis_seed$
BEGIN
  IF ${unit.guard} THEN
${body}
  END IF;
END
$eyis_seed$;
`;
}

export type SeedManifest = {
  manifest: "eyis-system-seeds";
  version: string;
  generated_at: string;
  system_seed_fingerprint: string;
  units: {
    id: string;
    file: string;
    title: string;
    tables: string[];
    checksum: string;
    idempotent: true;
    expect: SeedUnit["expect"];
    required_keys?: SeedUnit["requiredKeys"];
  }[];
};

export function buildSeedManifest(version: string, generatedAt: string): SeedManifest {
  const units = SEED_UNITS.map((unit) => ({
    id: unit.id,
    file: unit.file,
    title: unit.title,
    tables: unit.tables,
    checksum: sha256(readFileSync(join(SEEDS_DIR, unit.file), "utf8")),
    idempotent: true as const,
    expect: unit.expect,
    ...(unit.requiredKeys ? { required_keys: unit.requiredKeys } : {}),
  }));
  const fingerprint = sha256(
    JSON.stringify(units.map((u) => [u.id, u.checksum, u.tables, u.expect])),
  );
  return {
    manifest: "eyis-system-seeds",
    version,
    generated_at: generatedAt,
    system_seed_fingerprint: fingerprint,
    units,
  };
}

export function loadSeedManifest(): SeedManifest {
  return JSON.parse(readFileSync(SEED_MANIFEST_PATH, "utf8"));
}
