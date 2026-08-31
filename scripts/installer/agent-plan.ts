/**
 * Agent Migration Plan (Phase 29).
 *
 * Blackbox-Befund: eine frische Lovable-Cloud-Datenbank gibt dem verfügbaren
 * DB-Benutzer kein `CREATE` auf `public`. `psql`-DDL scheitert deshalb bereits
 * an Unit 000. Der einzige real verfügbare, privilegierte Weg ist das
 * Plattform-Migration-Tool — und das steht ausschließlich dem installierenden
 * Agenten zur Verfügung.
 *
 * Diese Datei erzeugt daraus einen deterministischen, agentenlesbaren
 * Ausführungsplan: jede Stufe ist genau eine Migration, die der Agent
 * unverändert an das Plattformwerkzeug übergibt. Jede Stufe schreibt ihren
 * eigenen Journaleintrag mit — dadurch braucht der Installer für Zustand,
 * Wiederaufnahme und Nachweis keinerlei direkten Datenbankzugang.
 *
 * Der Plan ist kein Ersatz für die Units, sondern deren Transportform: Inhalt
 * und Reihenfolge stammen unverändert aus dem signierten Pack.
 */

import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

import { PACK_DIR, loadManifest, type Manifest, type ManifestUnit } from "./runner";

export type PlanStepKind = "unit" | "seed" | "reconcile" | "finalize";

export type PlanStep = {
  step: number;
  id: string;
  kind: PlanStepKind;
  title: string;
  source: string | null;
  source_checksum: string | null;
  bytes: number;
  sql: string;
  sql_checksum: string;
};

export type AgentPlan = {
  plan: "eyis-agent-migration-plan";
  plan_version: "1.0.0";
  pack_version: string;
  schema_version: string;
  migration_head: string;
  schema_fingerprint: string;
  execution: {
    tool: "platform_migration_tool";
    order: "strict_sequential";
    resumable: true;
    requires_direct_db_access: false;
  };
  steps: PlanStep[];
  step_count: number;
  total_bytes: number;
  plan_checksum: string;
};

const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

const sqlLiteral = (value: string) => `'${value.replace(/'/g, "''")}'`;

/** Journalsatz einer Unit — Teil derselben Migration wie die Unit selbst. */
function unitJournal(unit: ManifestUnit): string {
  return `
-- EYIS Journal (Teil derselben Migration — kein separater DB-Zugriff nötig)
INSERT INTO public.eyis_installation_units
  (unit_id, position, checksum, status, started_at, completed_at)
VALUES (${sqlLiteral(unit.id)}, ${unit.position}, ${sqlLiteral(unit.checksum)}, 'PASS', now(), now())
ON CONFLICT (unit_id) DO UPDATE
  SET status = 'PASS', checksum = excluded.checksum, completed_at = now(), updated_at = now();
`;
}

function finalizeSql(manifest: Manifest, seedVersion: string): string {
  return `-- EYIS Installation abschließen: Zustand, Seed-Version, Reconciliation.
INSERT INTO public.eyis_installation_state
  (id, baseline_version, schema_version, migration_head, schema_fingerprint, state,
   system_seed_version, migration_history_reconciled, completed_at)
VALUES (true, ${sqlLiteral(manifest.version)}, ${sqlLiteral(manifest.schema_version)},
        ${sqlLiteral(manifest.migration_head)}, ${sqlLiteral(manifest.schema_fingerprint)}, 'INSTALLED',
        ${sqlLiteral(seedVersion)}, true, now())
ON CONFLICT (id) DO UPDATE
  SET state = 'INSTALLED',
      baseline_version = excluded.baseline_version,
      schema_version = excluded.schema_version,
      migration_head = excluded.migration_head,
      schema_fingerprint = excluded.schema_fingerprint,
      system_seed_version = excluded.system_seed_version,
      migration_history_reconciled = true,
      completed_at = now(),
      updated_at = now();
`;
}

/**
 * Deterministischer Plan. Gleiche Pack-Dateien ⇒ gleicher `plan_checksum`.
 * Checksummen der Quellen werden gegen das Manifest geprüft; eine Abweichung
 * ist ein harter Fehler, kein Hinweis.
 */
export function buildAgentPlan(manifest: Manifest = loadManifest()): AgentPlan {
  const steps: PlanStep[] = [];
  let step = 0;

  for (const unit of manifest.fresh_install.units) {
    const raw = readFileSync(join(PACK_DIR, unit.file), "utf8");
    if (sha256(raw) !== unit.checksum) {
      throw new Error(`Checksumme der Unit ${unit.id} weicht vom Manifest ab.`);
    }
    const sql = `${raw.trimEnd()}\n${unitJournal(unit)}`;
    steps.push({
      step: ++step,
      id: unit.id,
      kind: "unit",
      title: unit.title,
      source: unit.file,
      source_checksum: unit.checksum,
      bytes: Buffer.byteLength(sql),
      sql,
      sql_checksum: sha256(sql),
    });
  }

  for (const seed of manifest.system_seeds) {
    const raw = readFileSync(join(PACK_DIR, seed.file), "utf8");
    if (sha256(raw) !== seed.checksum) {
      throw new Error(`Checksumme des Seeds ${seed.id} weicht vom Manifest ab.`);
    }
    steps.push({
      step: ++step,
      id: seed.id,
      kind: "seed",
      title: `Systemdaten ${seed.id}`,
      source: seed.file,
      source_checksum: seed.checksum,
      bytes: Buffer.byteLength(raw),
      sql: raw,
      sql_checksum: sha256(raw),
    });
  }

  const reconcile = manifest.migration_history_reconciliation;
  const reconcileSql = readFileSync(join(PACK_DIR, reconcile.file), "utf8");
  if (sha256(reconcileSql) !== reconcile.checksum) {
    throw new Error("Checksumme der Migration-History-Reconciliation weicht vom Manifest ab.");
  }
  steps.push({
    step: ++step,
    id: "reconcile-migration-history",
    kind: "reconcile",
    title: "Migrationshistorie registrieren (vor dem ersten db push)",
    source: reconcile.file,
    source_checksum: reconcile.checksum,
    bytes: Buffer.byteLength(reconcileSql),
    sql: reconcileSql,
    sql_checksum: sha256(reconcileSql),
  });

  const seedVersion = manifest.system_seeds[0]?.version ?? manifest.schema_version;
  const finalize = finalizeSql(manifest, seedVersion);
  steps.push({
    step: ++step,
    id: "finalize-installation",
    kind: "finalize",
    title: "Installation als INSTALLED markieren",
    source: null,
    source_checksum: null,
    bytes: Buffer.byteLength(finalize),
    sql: finalize,
    sql_checksum: sha256(finalize),
  });

  const base = {
    plan: "eyis-agent-migration-plan" as const,
    plan_version: "1.0.0" as const,
    pack_version: manifest.version,
    schema_version: manifest.schema_version,
    migration_head: manifest.migration_head,
    schema_fingerprint: manifest.schema_fingerprint,
    execution: {
      tool: "platform_migration_tool" as const,
      order: "strict_sequential" as const,
      resumable: true as const,
      requires_direct_db_access: false as const,
    },
    steps,
    step_count: steps.length,
    total_bytes: steps.reduce((sum, s) => sum + s.bytes, 0),
  };

  return { ...base, plan_checksum: sha256(steps.map((s) => s.sql_checksum).join("\n")) };
}

/** Kurzfassung ohne SQL — für Übersicht, Reports und Tests. */
export function planIndex(plan: AgentPlan) {
  return plan.steps.map(({ step, id, kind, title, bytes, sql_checksum }) => ({
    step,
    id,
    kind,
    title,
    bytes,
    sql_checksum,
  }));
}

/** Anleitung für den installierenden Agenten — bewusst werkzeugneutral. */
export function planInstructions(plan: AgentPlan): string {
  return [
    "EYIS — Agent Migration Plan",
    "=".repeat(72),
    `Pack ${plan.pack_version} · Schema ${plan.schema_version} · Head ${plan.migration_head}`,
    `Schritte: ${plan.step_count} · Gesamt: ${(plan.total_bytes / 1024).toFixed(1)} KB`,
    `Plan-Checksumme: ${plan.plan_checksum}`,
    "",
    "Ablauf (kein direkter Datenbankzugang nötig):",
    "  1. Für n = 1 … " + plan.step_count + ":",
    "       bun run installer/eyis.ts step <n>",
    "     Die Ausgabe ist vollständiges SQL genau einer Migration.",
    "  2. Dieses SQL unverändert über das Plattform-Migration-Tool anwenden.",
    "  3. Erst danach den nächsten Schritt holen. Reihenfolge ist verbindlich.",
    "  4. Jede Stufe schreibt ihren Journaleintrag selbst — nach einem Abbruch",
    "     wird mit dem zuletzt nicht bestätigten Schritt fortgesetzt.",
    "",
    "Nach dem letzten Schritt:",
    "  1. Plattform-Typen nach den Migrationen neu erzeugen",
    "     (supabase gen types / Plattform-Generierung) — erst danach typecheck/build.",
    "  2. bun run installer/eyis.ts doctor",
    "",
  ].join("\n");
}
