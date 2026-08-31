/**
 * EYIS Installer-Einstiegspunkt für installierte Kundenprojekte (Phase 29).
 *
 * Blackbox-Befund: `package.json` gehört dem Kundenprojekt und wird von EYIS
 * niemals ersetzt. Die Skriptnamen `eyis:install:*`, `commerce:bootstrap` und
 * `commerce:doctor` standen im installierten Projekt deshalb nicht zur
 * Verfügung. Diese Datei ist der ausgelieferte, package.json-unabhängige
 * Einstiegspunkt:
 *
 *   bun run installer/eyis.ts <befehl>
 *
 * Befehle:
 *   status      Installationszustand und nächste Schritte
 *   plan        Agent Migration Plan (Übersicht, kein SQL)
 *   plan --json Vollständiger Plan als JSON (inkl. SQL)
 *   step <n>    SQL genau einer Migrationsstufe — für das Plattform-Migration-Tool
 *   seeds       Systemdaten-SQL
 *   verify      Strukturvergleich gegen den Fingerprint (braucht DB-Zugriff)
 *   pack        Signaturprüfung des Packs
 *   bootstrap   System-Bootstrap über die laufende Instanz (HTTP)
 *   doctor      Installations- und Isolationsprüfung (HTTP)
 *   resources   Buckets, Jobs und Runtime-Konfiguration prüfen
 */

import { buildAgentPlan, planIndex, planInstructions } from "../scripts/installer/agent-plan";
import { loadManifest } from "../scripts/installer/runner";

const [command = "status", ...rest] = process.argv.slice(2);

async function delegate(module: string, argv: string[]) {
  process.argv = [process.argv[0]!, module, ...argv];
  await import(module);
}

switch (command) {
  case "status": {
    const manifest = loadManifest();
    const plan = buildAgentPlan(manifest);
    console.log("EYIS — Installationsstatus");
    console.log("=".repeat(72));
    console.log(`Pack-Version:        ${manifest.version}`);
    console.log(`Schema-Version:      ${manifest.schema_version}`);
    console.log(`Baseline Units:      ${manifest.fresh_install.units.length}`);
    console.log(`Systemseeds:         ${manifest.system_seeds.length}`);
    console.log(`Migrationsschritte:  ${plan.step_count} (Agent Migration Plan)`);
    console.log(`Schema-Fingerprint:  ${manifest.schema_fingerprint}`);
    console.log("");
    console.log("Installation ohne direkten Datenbankzugang:");
    console.log("  bun run installer/eyis.ts plan");
    console.log("  bun run installer/eyis.ts step 1   # … bis " + plan.step_count);
    break;
  }
  case "plan": {
    const plan = buildAgentPlan();
    if (rest.includes("--json")) {
      console.log(JSON.stringify(plan, null, 2));
      break;
    }
    console.log(planInstructions(plan));
    for (const entry of planIndex(plan)) {
      console.log(
        `  ${String(entry.step).padStart(2, "0")}/${plan.step_count}  ${entry.kind.padEnd(9)} ${entry.id.padEnd(34)} ${(entry.bytes / 1024).toFixed(1)} KB`,
      );
    }
    break;
  }
  case "step": {
    const plan = buildAgentPlan();
    const index = Number(rest[0]);
    const step = plan.steps.find((s) => s.step === index);
    if (!step) {
      console.error(`Unbekannter Schritt ${rest[0] ?? ""} — gültig ist 1…${plan.step_count}.`);
      process.exit(2);
    }
    if (rest.includes("--json")) {
      console.log(JSON.stringify(step, null, 2));
      break;
    }
    console.log(`-- EYIS ${step.kind} ${step.id} (Schritt ${step.step}/${plan.step_count})`);
    console.log(`-- Quelle: ${step.source ?? "generiert"} · sha256 ${step.sql_checksum}`);
    console.log(step.sql);
    break;
  }
  case "seeds":
    await delegate("../scripts/eyis-seeds.ts", ["sql"]);
    break;
  case "verify":
    await delegate("../scripts/eyis-install.ts", ["verify"]);
    break;
  case "pack":
    await delegate("../scripts/eyis-pack-signature.ts", ["verify"]);
    break;
  case "bootstrap":
    await delegate("../scripts/commerce-bootstrap.ts", rest);
    break;
  case "doctor":
    await delegate("../scripts/commerce-doctor.ts", rest);
    break;
  case "resources":
    await delegate("../scripts/eyis-resources.ts", rest.length ? rest : ["verify"]);
    break;
  default:
    console.error(`Unbekannter Befehl: ${command}`);
    process.exit(1);
}
