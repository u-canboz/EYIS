/**
 * eyis:database:sync-check — hartes Gate gegen einen veralteten Fresh-Install-Pack.
 *
 * Läuft in `bun run verify` und im Release-Workflow. Ein Release mit stale
 * Database Pack darf technisch nicht signierbar sein.
 */

import { checkPackSync } from "./installer/pack-sync";

const result = checkPackSync();

console.log("EYIS — Database Pack Sync");
console.log("=".repeat(72));
console.log(`Migrationen im Repository: ${result.migrationCount}`);
console.log(`Migrationen im Pack:       ${result.packMigrationCount}`);
console.log(`Neueste Migration:         ${result.newestMigration ?? "—"}`);
console.log(`Pack schema_version:       ${result.packSchemaVersion}`);
console.log(`Migration-Set-Fingerprint: ${result.expectedFingerprint.slice(0, 32)}…`);
console.log(`Pack-Fingerprint:          ${result.packFingerprint?.slice(0, 32) ?? "—"}…`);
for (const problem of result.problems) console.log(`  ! ${problem}`);
console.log(`Gesamt:                    ${result.status}`);

process.exit(result.status === "PASS" ? 0 : 1);
