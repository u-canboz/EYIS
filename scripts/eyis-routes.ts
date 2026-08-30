/**
 * eyis:routes:verify — Route Contract der Basisinstallation.
 *
 * FAIL, sobald installierter Code auf eine Route zeigt, die eine
 * Basisinstallation nicht garantiert mitbringt (reference_only, optional,
 * kundeneigen).
 */

import { baseInstallFiles, findViolations } from "./installer/route-contract";

const files = baseInstallFiles();
const violations = findViolations(files);

console.log("EYIS — Route Contract");
console.log("=".repeat(72));
console.log(`Geprüfte Install-Dateien: ${files.length}`);
for (const v of violations) console.log(`  ! ${v.file} → ${v.target}`);
console.log(`Verstöße: ${violations.length}`);
console.log(`Gesamt:   ${violations.length === 0 ? "PASS" : "FAIL"}`);

process.exit(violations.length === 0 ? 0 : 1);
