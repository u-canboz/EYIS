/**
 * eyis:dist:verify — Gate über das Code-Distribution-Manifest (Phase 27).
 *
 * Prüft:
 * - keine Mehrfachklassifikation eines Pfads (der Blackbox-Test fand
 *   `src/routes/index.tsx` gleichzeitig als reference_only und customer_owned);
 * - jeder gelistete Pfad existiert im Repository;
 * - Quelle und Ziel werden nicht verwechselt: Routen aus `customer_routes`
 *   dürfen nicht als `install` ausgeliefert werden;
 * - das Manifest deckt sich mit der Laufzeit-Klassifikation in
 *   `src/lib/commerce/updates/ownership.ts`.
 */

import { existsSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

import { validateDistribution } from "./installer/distribution";

const result = validateDistribution();

console.log("EYIS — Distribution-Manifest");
console.log("=".repeat(72));
console.log(`Manifest-Version:      ${result.version}`);
console.log(`Klassifizierte Pfade:  ${result.paths}`);
console.log(`Doppelklassifikation:  ${result.duplicates.length === 0 ? "PASS" : "FAIL"}`);
console.log(`Pfade vorhanden:       ${result.missing.length === 0 ? "PASS" : "FAIL"}`);
console.log(`Quelle/Ziel getrennt:  ${result.routeConflicts.length === 0 ? "PASS" : "FAIL"}`);
console.log(`Ownership-Abgleich:    ${result.ownershipMismatches.length === 0 ? "PASS" : "FAIL"}`);
for (const problem of result.problems) console.log(`  ! ${problem}`);
console.log(`Gesamt:                ${result.status}`);

// Ungenutzte Importe vermeiden, falls das Modul später erweitert wird.
void existsSync;
void readdirSync;
void statSync;
void join;

process.exit(result.status === "PASS" ? 0 : 1);
