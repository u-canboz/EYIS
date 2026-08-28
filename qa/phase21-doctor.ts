/* Phase 21: Doctor — Isolationsprüfung der Instanz. */
import { check, summary } from "./lib";

const BASE = process.env["COMMERCE_OS_URL"] ?? "http://localhost:8080";

async function main() {
  /* 1. Doctor ohne Credential → 403 */
  const denied = await fetch(`${BASE}/api/public/install/doctor`);
  check("Doctor ohne Credential → 403", denied.status === 403, `status=${denied.status}`);

  /* 2. Doctor-Logik direkt (read-only): keine FAILs auf der Dev-Instanz */
  const { runDoctor } = await import("../src/lib/commerce/system/installation.server");
  const rows = await runDoctor();
  const failed = rows.filter((r) => r.status === "FAIL");
  for (const r of rows) {
    console.log(`  ${r.status.padEnd(15)} ${r.check}${r.detail ? ` — ${r.detail}` : ""}`);
  }
  check(
    "Doctor: keine FAIL-Prüfungen",
    failed.length === 0,
    failed.map((f) => f.check).join(", ") || `${rows.length} Prüfungen`,
  );

  /* 3. Pflichtprüfungen vorhanden */
  const names = rows.map((r) => r.check);
  const required = [
    "Environment",
    "Deployment Mode",
    "Central Commerce DB dependency",
    "Database",
    "Storage",
  ];
  check(
    "Doctor: Pflichtprüfungen vorhanden",
    required.every((r) => names.includes(r)),
    names.join(", "),
  );

  summary();
}

main().catch((e) => {
  console.error("HARNESS ERROR", e);
  process.exitCode = 1;
});
