/* Phase 21: Dedicated Bootstrap — Abbruchmatrix und Sicherheitsinvarianten.
 * Prüft gegen die laufende Dev-Instanz (shared mode): Bootstrap muss
 * sauber abbrechen, ohne etwas zu ändern. Dev/QA only. */
import { admin, check, summary } from "./lib";

const BASE = process.env["COMMERCE_OS_URL"] ?? "http://localhost:8080";

async function main() {
  /* 1. Endpunkt ohne Header → 403 */
  const noHeader = await fetch(`${BASE}/api/public/install/bootstrap`, { method: "POST" });
  check("Bootstrap ohne Secret-Header → 403", noHeader.status === 403, `status=${noHeader.status}`);

  /* 2. Endpunkt mit falschem Header → 403 */
  const wrong = await fetch(`${BASE}/api/public/install/bootstrap`, {
    method: "POST",
    headers: { "x-commerce-bootstrap-secret": "definitely-wrong" },
  });
  check("Bootstrap mit falschem Secret → 403", wrong.status === 403, `status=${wrong.status}`);

  /* 3. Shared Mode: runBootstrap muss mit INSTALLATION_NOT_DEDICATED abbrechen */
  const { runBootstrap, InstallationError, getInstallation } = await import(
    "../src/lib/commerce/system/installation.server"
  );
  let code = "";
  try {
    await runBootstrap();
  } catch (e) {
    code = e instanceof InstallationError ? e.code : "UNEXPECTED";
  }
  check(
    "Shared Mode: Bootstrap bricht mit INSTALLATION_NOT_DEDICATED ab",
    code === "INSTALLATION_NOT_DEDICATED",
    `code=${code}`,
  );

  /* 4. Abbruch ohne Nebenwirkungen: keine Installation registriert */
  const inst = await getInstallation();
  check(
    "Abbruchmatrix: keine Installations-Row nach STOP",
    inst === null || inst.mode !== "dedicated",
    inst ? `mode=${inst.mode}` : "keine Row",
  );

  /* 5. Claim-Funktion: ungültiger Token → CLAIM_INVALID (kein User wird Owner) */
  const { claimOwner } = await import("../src/lib/commerce/system/installation.server");
  let claimCode = "";
  try {
    await claimOwner({
      userId: "00000000-0000-0000-0000-000000000000",
      claimToken: "cos_claim_invalid",
      organizationName: "QA Org",
      shopName: "QA Shop",
    });
  } catch (e) {
    claimCode = e instanceof InstallationError ? e.code : "UNEXPECTED";
  }
  check(
    "Claim mit ungültigem Token → CLAIM_INVALID",
    claimCode === "CLAIM_INVALID",
    `code=${claimCode}`,
  );

  /* 6. Keine Org wurde durch den fehlgeschlagenen Claim angelegt */
  const { count } = await admin
    .from("organizations")
    .select("id", { count: "exact", head: true })
    .eq("name", "QA Org");
  check("Fehlgeschlagener Claim legt keine Organisation an", (count ?? 0) === 0, `count=${count ?? 0}`);

  summary();
}

main().catch((e) => {
  console.error("HARNESS ERROR", e);
  process.exitCode = 1;
});
