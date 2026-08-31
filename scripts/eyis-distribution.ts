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

import { validateDistribution } from "./installer/distribution";
import { validateTarballConsistency } from "./installer/tarball-consistency";

const result = validateDistribution();
const consistency = validateTarballConsistency();

console.log("EYIS — Distribution-Manifest");
console.log("=".repeat(72));
console.log(`Manifest-Version:      ${result.version}`);
console.log(`Klassifizierte Pfade:  ${result.paths}`);
console.log(`Doppelklassifikation:  ${result.duplicates.length === 0 ? "PASS" : "FAIL"}`);
console.log(`Pfade vorhanden:       ${result.missing.length === 0 ? "PASS" : "FAIL"}`);
console.log(`Quelle/Ziel getrennt:  ${result.routeConflicts.length === 0 ? "PASS" : "FAIL"}`);
console.log(`Ownership-Abgleich:    ${result.ownershipMismatches.length === 0 ? "PASS" : "FAIL"}`);
for (const problem of result.problems) console.log(`  ! ${problem}`);
console.log(`Tarball-Dateien:       ${consistency.files}`);
console.log(`Tarball → Manifest:    ${consistency.uncategorized.length === 0 ? "PASS" : "FAIL"}`);
console.log(`Manifest → Tarball:    ${consistency.unexplainedDrops.length === 0 ? "PASS" : "FAIL"}`);
console.log(`Befehlsverweise:       ${consistency.deadCommandRefs.length === 0 ? "PASS" : "FAIL"}`);
console.log(`Skript-Autonomie:      ${consistency.unresolvedImports.length === 0 ? "PASS" : "FAIL"}`);
for (const problem of consistency.problems.slice(0, 40)) console.log(`  ! ${problem}`);
const status = result.status === "PASS" && consistency.status === "PASS" ? "PASS" : "FAIL";
console.log(`Gesamt:                ${status}`);

process.exit(status === "PASS" ? 0 : 1);
