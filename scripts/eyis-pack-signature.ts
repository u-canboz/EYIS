/**
 * eyis:pack:sign / eyis:pack:verify — Ed25519-Signatur des Install Packs.
 *
 * Die Digest- und Prüflogik liegt in scripts/installer/signature.ts und wird
 * vom Installer-Runner als hartes Gate mitbenutzt: ohne bestandene Prüfung
 * läuft keine SQL-Unit.
 *
 * Der private Schlüssel steht niemals im Repository. Er wird als PKCS#8-PEM in
 * EYIS_PACK_SIGNING_KEY erwartet und nur im Speicher verwendet. Ohne Schlüssel
 * meldet `sign` BLOCKED statt eine Signatur zu erfinden.
 */

import { createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { writeFileSync } from "node:fs";

import { SIGNATURE_PATH, packDigest, verifyPack } from "./installer/signature";

const command = process.argv[2] ?? "verify";

if (command === "keygen") {
  // Erzeugt ein Schlüsselpaar zur lokalen Ablage AUSSERHALB des Repositories.
  // Der private Teil wird nur auf stdout ausgegeben und nie geschrieben.
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  console.log("Öffentlicher Schlüssel (darf ausgeliefert werden):");
  console.log(publicKey.export({ type: "spki", format: "pem" }).toString());
  console.log(
    "Privater Schlüssel: als Secret EYIS_PACK_SIGNING_KEY hinterlegen, niemals ins Repository.",
  );
  console.log(privateKey.export({ type: "pkcs8", format: "pem" }).toString());
  process.exit(0);
}

if (command === "sign") {
  const pem = process.env["EYIS_PACK_SIGNING_KEY"];
  if (!pem) {
    console.log("Pack-Signatur: BLOCKED — EYIS_PACK_SIGNING_KEY ist nicht gesetzt.");
    console.log("Es wird bewusst keine Signatur erzeugt. Schlüssel bereitstellen (eyis:pack:keygen) und erneut ausführen.");
    process.exit(3);
  }
  const key = createPrivateKey(pem);
  const { digest, entries } = packDigest();
  const signature = sign(null, Buffer.from(digest, "hex"), key).toString("base64");
  const publicKey = createPublicKey(key).export({ type: "spki", format: "pem" }).toString();
  // key_id ist der Fingerprint des öffentlichen Schlüssels. Der Schlüssel selbst
  // wird NICHT mit ausgeliefert — der Verifier nimmt ihn aus dem Trust Anchor.
  const keyId = createHash("sha256").update(publicKey).digest("hex").slice(0, 32);
  if (!trustedKey(keyId)) {
    console.log(`Pack-Signatur: BLOCKED — key_id ${keyId} steht nicht im Trust Anchor.`);
    console.log("Öffentlichen Schlüssel zuerst in installer/distribution/eyis-trust-anchor.json aufnehmen:");
    console.log(JSON.stringify({ key_id: keyId, public_key: publicKey, status: "active" }, null, 2));
    process.exit(3);
  }
  writeFileSync(
    SIGNATURE_PATH,
    `${JSON.stringify(
      {
        manifest: "eyis-database-installer-signature",
        algorithm: "ed25519",
        version: "2.0.0",
        signed_at: new Date().toISOString(),
        files: entries.length,
        key_id: keyId,
        digest,
        signature,
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.log(`Pack signiert: ${entries.length} Dateien, Digest ${digest.slice(0, 16)}…, key_id ${keyId}`);
  process.exit(0);
}

if (command === "verify") {
  const result = verifyPack();
  console.log("EYIS — Pack-Gate");
  console.log("=".repeat(72));
  console.log(`Signaturrelevante Dateien: ${result.files}`);
  console.log(`Digest:          ${result.digest}`);
  console.log(`Checksummen:     ${result.checksums}`);
  console.log(`Kompatibilität:  ${result.compatibility}`);
  console.log(`Signatur:        ${result.signature}`);
  if (result.detail) console.log(`Hinweis:         ${result.detail}`);
  console.log(`Gesamt:          ${result.status}`);
  process.exit(result.status === "PASS" ? 0 : result.status === "BLOCKED" ? 3 : 1);
}

console.error(`Unbekannter Befehl: ${command}`);
process.exit(1);
