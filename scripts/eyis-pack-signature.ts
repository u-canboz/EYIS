/**
 * eyis:pack:sign / eyis:pack:verify — Ed25519-Signatur des Install Packs.
 *
 * Signiert wird nicht das gesamte Verzeichnis, sondern ein deterministischer
 * Digest über die Manifeste, alle Installation Units, alle System-Seeds und
 * die Reconciliation. Damit erkennt eine Kundeninstallation jede nachträgliche
 * Veränderung am Pack, bevor sie eine einzige Anweisung ausführt.
 *
 * Der private Schlüssel steht niemals im Repository. Er wird als PKCS#8-PEM in
 * EYIS_PACK_SIGNING_KEY erwartet und nur im Speicher verwendet. Ohne Schlüssel
 * meldet `sign` BLOCKED statt eine Signatur zu erfinden.
 */

import { createHash, createPrivateKey, createPublicKey, sign, verify } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { PACK_DIR, loadManifest } from "./installer/runner";
import { SEEDS_DIR, loadSeedManifest } from "./installer/system-seeds";

const SIGNATURE_PATH = join(PACK_DIR, "eyis-database-installer.signature.json");

/** Deterministischer Digest über alle signaturrelevanten Pack-Inhalte. */
export function packDigest(): { digest: string; entries: [string, string][] } {
  const manifest = loadManifest();
  const seeds = loadSeedManifest();

  const files: string[] = [
    "eyis-database-installer.manifest.json",
    manifest.migration_history_reconciliation.file,
    ...manifest.fresh_install.units.map((u) => u.file),
    ...seeds.units.map((u) => `seeds/${u.file}`),
    "seeds/eyis-system-seeds.manifest.json",
  ];

  const entries: [string, string][] = files
    .filter((f) => existsSync(join(PACK_DIR, f)))
    .sort()
    .map((f) => [f, createHash("sha256").update(readFileSync(join(PACK_DIR, f))).digest("hex")]);

  const digest = createHash("sha256")
    .update(JSON.stringify({ entries, seed_fingerprint: seeds.system_seed_fingerprint }))
    .digest("hex");

  return { digest, entries };
}

const command = process.argv[2] ?? "verify";

if (command === "sign") {
  const pem = process.env["EYIS_PACK_SIGNING_KEY"];
  if (!pem) {
    console.log("Pack-Signatur: BLOCKED — EYIS_PACK_SIGNING_KEY ist nicht gesetzt.");
    console.log("Es wird bewusst keine Signatur erzeugt. Schlüssel bereitstellen und erneut ausführen.");
    process.exit(3);
  }
  const key = createPrivateKey(pem);
  const { digest, entries } = packDigest();
  const signature = sign(null, Buffer.from(digest, "hex"), key).toString("base64");
  const publicKey = createPublicKey(key).export({ type: "spki", format: "pem" }).toString();
  writeFileSync(
    SIGNATURE_PATH,
    `${JSON.stringify(
      {
        manifest: "eyis-database-installer-signature",
        algorithm: "ed25519",
        signed_at: new Date().toISOString(),
        files: entries.length,
        digest,
        signature,
        public_key: publicKey,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Pack signiert: ${entries.length} Dateien, Digest ${digest.slice(0, 16)}…`);
  process.exit(0);
}

if (command === "verify") {
  const { digest, entries } = packDigest();
  console.log("EYIS — Pack-Signatur");
  console.log("=".repeat(72));
  console.log(`Signaturrelevante Dateien: ${entries.length}`);
  console.log(`Digest: ${digest}`);
  if (!existsSync(SIGNATURE_PATH)) {
    console.log("Signatur: BLOCKED — keine Signaturdatei vorhanden (Pack unsigniert ausgeliefert).");
    process.exit(3);
  }
  const sig = JSON.parse(readFileSync(SIGNATURE_PATH, "utf8")) as {
    digest: string;
    signature: string;
    public_key: string;
  };
  if (sig.digest !== digest) {
    console.log("Signatur: FAIL — Pack-Inhalt weicht vom signierten Digest ab.");
    process.exit(1);
  }
  const ok = verify(
    null,
    Buffer.from(digest, "hex"),
    createPublicKey(sig.public_key),
    Buffer.from(sig.signature, "base64"),
  );
  console.log(ok ? "Signatur: PASS" : "Signatur: FAIL — ungültige Signatur.");
  process.exit(ok ? 0 : 1);
}

console.error(`Unbekannter Befehl: ${command}`);
process.exit(1);
