/**
 * commerce:bootstrap — System-Bootstrap einer Dedicated-Instanz (Phase 21).
 *
 * Voraussetzungen:
 *  - Provisioning abgeschlossen (eigene Cloud: DB, Auth, Storage)
 *  - Alle Migrationen angewendet
 *  - COMMERCE_BOOTSTRAP_SECRET auf der Instanz gesetzt
 *
 * Aufruf:
 *   COMMERCE_OS_URL=http://localhost:8080 COMMERCE_BOOTSTRAP_SECRET=... bun run commerce:bootstrap
 *
 * Das Secret wird ausschließlich als HTTP-Header gesendet. Der Claim-Token
 * erscheint genau einmal in dieser Ausgabe — sicher aufbewahren.
 */

const baseUrl = (process.env["COMMERCE_OS_URL"] ?? "http://localhost:8080").replace(/\/$/, "");
const secret = process.env["COMMERCE_BOOTSTRAP_SECRET"] ?? "";
const ownerEmail = (process.env["EYIS_OWNER_EMAIL"] ?? process.argv[2] ?? "").trim();

if (!secret) {
  console.error("ABBRUCH: COMMERCE_BOOTSTRAP_SECRET ist nicht gesetzt.");
  process.exit(2);
}

const res = await fetch(`${baseUrl}/api/public/install/bootstrap`, {
  method: "POST",
  headers: { "x-commerce-bootstrap-secret": secret, "content-type": "application/json" },
  body: JSON.stringify(ownerEmail ? { ownerEmail } : {}),
});
const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

if (!res.ok || body["ok"] !== true) {
  console.error(`BOOTSTRAP STOP [${res.status}] ${body["code"] ?? "ERROR"}: ${body["error"] ?? "unbekannt"}`);
  process.exit(1);
}

console.log("EYIS — System Bootstrap abgeschlossen");
console.log("=".repeat(56));
for (const step of (body["steps"] as string[]) ?? []) console.log(`  ✓ ${step}`);
console.log("=".repeat(56));
console.log(`Installation:  ${body["installationId"]}`);
console.log(`Modus:         ${body["mode"]}`);
console.log(`Umgebung:      ${body["environment"]}`);
console.log(`Zustand:       ${body["claimState"]}`);
console.log("");

if (body["claimState"] === "AWAITING_OWNER_REGISTRATION") {
  console.log(`Vorbereiteter Administrator: ${body["pendingOwnerEmailMasked"]}`);
  console.log("");
  console.log("Nächster Schritt: /app öffnen, mit genau dieser E-Mail registrieren,");
  console.log("Bestätigungslink öffnen, anmelden — die Übernahme läuft automatisch.");
  console.log("Ein Claim-Code wird im Normalfall nicht benötigt (Recovery bleibt intern).");
} else {
  console.log("RECOVERY CLAIM TOKEN (wird nur einmal angezeigt):");
  console.log("");
  console.log(`  ${body["claimToken"]}`);
  console.log("");
  console.log(`Gültig bis: ${body["claimExpiresAt"]}`);
  console.log("Nächster Schritt: /app/setup/recovery öffnen und den Code eingeben.");
}

