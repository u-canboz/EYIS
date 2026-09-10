/**
 * commerce:doctor — read-only Installations- und Isolationsprüfung (Phase 21).
 *
 * Aufruf:
 *   COMMERCE_OS_URL=http://localhost:8080 COMMERCE_BOOTSTRAP_SECRET=... bun run commerce:doctor
 *
 * Exit-Code 1 bei mindestens einem FAIL.
 */

const baseUrl = (process.env["COMMERCE_OS_URL"] ?? "http://localhost:8080").replace(/\/$/, "");
const secret = process.env["COMMERCE_BOOTSTRAP_SECRET"] ?? "";

if (!secret) {
  console.error("ABBRUCH: COMMERCE_BOOTSTRAP_SECRET ist nicht gesetzt.");
  process.exit(2);
}

const res = await fetch(`${baseUrl}/api/public/install/doctor`, {
  headers: { "x-commerce-bootstrap-secret": secret },
});
const body = (await res.json().catch(() => ({}))) as {
  ok?: boolean;
  checks?: { check: string; status: string; detail?: string }[];
};

if (!res.ok || !body.checks) {
  console.error(`DOCTOR STOP [${res.status}]`);
  process.exit(1);
}

console.log("EYIS — Doctor");
console.log("=".repeat(72));
let failed = 0;
for (const c of body.checks) {
  if (c.status !== "PASS") failed += 1;
  const status = c.status.padEnd(15);
  console.log(`  ${status} ${c.check}${c.detail ? ` — ${c.detail}` : ""}`);
}
console.log("=".repeat(72));
console.log(
  failed === 0 ? "Ergebnis: PASS" : `Ergebnis: OFFEN (${failed} Prüfung(en) nicht bestanden)`,
);
process.exit(failed === 0 ? 0 : 1);
