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

import { createHash, createPrivateKey, createPublicKey, generateKeyPairSync, sign } from "node:crypto";
import { writeFileSync } from "node:fs";

import { SIGNATURE_PATH, packDigest, trustedKey, verifyPack } from "./installer/signature";

const command = process.argv[2] ?? "verify";

if (command === "keygen") {
  // Der private Schlüssel wird NIE auf stdout ausgegeben (Logs, CI-Transcripts).
  // Er landet ausschließlich in einer Datei außerhalb des Repositories, 0600.
  const target = process.argv[3];
  if (!target) {
    console.log("Verwendung: bun run eyis:pack:keygen -- <pfad-ausserhalb-des-repos>.pem");
    process.exit(2);
  }
  const abs = resolve(target);
  if (abs.startsWith(`${process.cwd()}/`)) {
    console.log("Abgelehnt: Der private Schlüssel darf nicht innerhalb des Repositories liegen.");
    process.exit(2);
  }
  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const pub = publicKey.export({ type: "spki", format: "pem" }).toString();
  writeFileSync(abs, privateKey.export({ type: "pkcs8", format: "pem" }).toString(), { mode: 0o600 });
  chmodSync(abs, 0o600);
  const keyId = createHash("sha256").update(pub).digest("hex").slice(0, 32);
  console.log(`Privater Schlüssel geschrieben: ${abs} (0600) — Inhalt niemals ausgeben oder committen.`);
  console.log(`key_id: ${keyId}`);
  console.log("Öffentlicher Schlüssel (in den Trust Anchor aufnehmen):");
  console.log(pub);
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
