/**
 * Offline-Nachweis für die kanonischen System-Seeds.
 *
 * Diese Prüfungen brauchen keine Datenbank und laufen deshalb in
 * `bun run verify` mit. Sie schließen genau die Lücke, die im Audit des Fresh
 * Install V2 aufgefallen ist: eine strukturell korrekte Datenbank ohne
 * Systemdaten galt fälschlich als fertig installiert.
 */

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const SEEDS_DIR = join(process.cwd(), "installer", "database", "seeds");
const manifest = JSON.parse(
  readFileSync(join(SEEDS_DIR, "eyis-system-seeds.manifest.json"), "utf8"),
) as {
  version: string;
  system_seed_fingerprint: string;
  units: {
    id: string;
    file: string;
    tables: string[];
    checksum: string;
    idempotent: boolean;
    expect: { table: string; where: string; min: number }[];
    required_keys?: { table: string; column: string; keys: string[] };
  }[];
};

const audit = JSON.parse(readFileSync(join(SEEDS_DIR, "eyis-dml-audit.json"), "utf8")) as {
  totals: { all: number; system_seed: number; runtime: number; backfill: number };
  uncovered_system_dml: unknown[];
  findings: { table: string | null; category: string }[];
};

function sha256(v: string) {
  return createHash("sha256").update(v).digest("hex");
}

describe("EYIS System Seeds", () => {
  it("liefert einen stabilen Seed-Fingerprint", () => {
    expect(manifest.system_seed_fingerprint).toMatch(/^[0-9a-f]{64}$/);
    expect(manifest.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it("deckt die fachlich zwingenden Systemtabellen ab", () => {
    const tables = new Set(manifest.units.flatMap((u) => u.tables));
    for (const required of [
      "role_permissions",
      "product_blueprints",
      "communication_templates",
      "communication_template_versions",
      "tax_classes",
      "tax_rates",
    ]) {
      expect(tables.has(required), required).toBe(true);
    }
  });

  it("hält Dateien, Checksummen und Idempotenz ein", () => {
    for (const unit of manifest.units) {
      const path = join(SEEDS_DIR, unit.file);
      expect(existsSync(path), unit.file).toBe(true);
      const content = readFileSync(path, "utf8");
      expect(sha256(content), unit.file).toBe(unit.checksum);
      expect(unit.idempotent).toBe(true);
      expect(
        /DO \$eyis_seed\$|ON CONFLICT|WHERE NOT EXISTS/.test(content),
        `${unit.file} ist nicht nachweisbar idempotent`,
      ).toBe(true);
    }
  });

  it("enthält keine Kunden- oder Mandantendaten", () => {
    for (const unit of manifest.units) {
      const content = readFileSync(join(SEEDS_DIR, unit.file), "utf8");
      // Systemdaten sind mandantenneutral: organization_id bleibt NULL oder
      // die Tabelle ist global (role_permissions, commerce_installation).
      expect(/@[a-z0-9.-]+\.(de|com|net|org)/i.test(content), unit.file).toBe(false);
    }
  });

  it("erwartet die vollständigen Blueprint- und Vorlagenschlüssel", () => {
    const blueprints = manifest.units.find((u) => u.id === "003_product_blueprints");
    expect(blueprints?.required_keys?.keys).toContain("standard");
    expect(blueprints?.required_keys?.keys.length).toBeGreaterThanOrEqual(9);

    const templates = manifest.units.find((u) => u.id === "004_communication_templates");
    expect(templates?.required_keys?.keys).toContain("order.confirmed");
    expect(templates?.expect.find((e) => e.table === "communication_templates")?.min).toBeGreaterThanOrEqual(23);
  });
});

describe("DML-Audit der Migrationskette", () => {
  it("ordnet jede Systemdatenanweisung einer Seed-Unit zu", () => {
    expect(audit.uncovered_system_dml).toEqual([]);
  });

  it("trennt Laufzeitlogik sauber von Seeds", () => {
    expect(audit.totals.runtime).toBeGreaterThan(0);
    expect(audit.totals.system_seed).toBeGreaterThan(0);
    expect(audit.totals.all).toBe(
      audit.totals.runtime + audit.totals.system_seed + audit.totals.backfill,
    );
  });

  it("erfasst Blueprints, Vorlagen und Steuerklassen als Systemdaten", () => {
    const tables = new Set(
      audit.findings.filter((f) => f.category === "system_seed").map((f) => f.table),
    );
    for (const t of ["product_blueprints", "communication_template_versions", "tax_classes", "tax_rates"]) {
      expect(tables.has(t), t).toBe(true);
    }
  });
});
