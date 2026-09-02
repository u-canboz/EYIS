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

import {
  createHash,
  createPrivateKey,
  createPublicKey,
  generateKeyPairSync,
  sign,
  verify as edVerify,
} from "node:crypto";
import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";


import { SIGNATURE_PATH, packDigest, resolveAnchorKey, trustedKey, verifyPack } from "./installer/signature";

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


/**
 * Lädt den privaten Signierschlüssel aus der Umgebung. Secret-Speicher liefern
 * mehrzeilige PEM-Werte häufig mit escaped `\n`-Sequenzen aus — sie werden hier
 * normalisiert. Der Schlüssel wird ausschließlich im Speicher verwendet und nie
 * geloggt oder ausgegeben.
 */
function signingKeyFromEnv(what: string): ReturnType<typeof createPrivateKey> {
  const raw = process.env["EYIS_PACK_SIGNING_KEY"];
  if (!raw) {
    console.log(`${what}: BLOCKED — EYIS_PACK_SIGNING_KEY ist nicht gesetzt.`);
    console.log("Es wird bewusst keine Signatur erzeugt. Schlüssel bereitstellen (eyis:pack:keygen) und erneut ausführen.");
    process.exit(3);
  }
  const pem = raw.replace(/\\n/g, "\n").trim();
  return createPrivateKey(pem);
}


if (command === "sign") {
  const key = signingKeyFromEnv("Pack-Signatur");
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

if (command === "sign-artifact" || command === "verify-artifact") {
  // Signiert bzw. prüft das Release-Artefakt-Manifest (eyis-release.json).
  // Signiert wird der Rohtext des Manifests — es enthält die SHA-256 aller
  // Dateien und des Tarballs, deckt also das gesamte Artefakt ab.
  const manifestPath = process.argv[3] ?? "installer/artifact/eyis-release.json";
  const raw = readFileSync(resolve(manifestPath), "utf8");
  const sigPath = `${resolve(manifestPath)}.sig`;

  if (command === "sign-artifact") {
    const pem = process.env["EYIS_PACK_SIGNING_KEY"];
    if (!pem) {
      console.log("Artefakt-Signatur: BLOCKED — EYIS_PACK_SIGNING_KEY ist nicht gesetzt.");
      process.exit(3);
    }
    const key = createPrivateKey(pem);
    const publicKey = createPublicKey(key).export({ type: "spki", format: "pem" }).toString();
    const keyId = createHash("sha256").update(publicKey).digest("hex").slice(0, 32);
    const anchor = resolveAnchorKey(keyId);
    if (!anchor.ok) {
      console.log(`Artefakt-Signatur: ${anchor.status} — ${anchor.reason} (key_id ${keyId})`);
      process.exit(3);
    }
    writeFileSync(sigPath, `${sign(null, Buffer.from(raw, "utf8"), key).toString("base64")}\n`, "utf8");
    console.log(`Artefakt signiert: key_id ${keyId}, Manifest ${manifestPath}`);
    process.exit(0);
  }

  if (!existsSync(sigPath)) {
    console.log("Artefakt-Signatur: BLOCKED — keine Signaturdatei vorhanden.");
    process.exit(3);
  }
  const manifest = JSON.parse(raw) as { key_id?: string; version?: string };
  const anchor = resolveAnchorKey(manifest.key_id);
  if (!anchor.ok) {
    console.log(`Artefakt-Signatur: ${anchor.status} — ${anchor.reason}`);
    process.exit(anchor.status === "BLOCKED" ? 3 : 1);
  }
  const ok = edVerify(
    null,
    Buffer.from(raw, "utf8"),
    createPublicKey(anchor.publicKey),
    Buffer.from(readFileSync(sigPath, "utf8").trim(), "base64"),
  );
  console.log(`Artefakt ${manifest.version}: Signatur ${ok ? "PASS" : "FAIL"} (key_id ${manifest.key_id})`);
  process.exit(ok ? 0 : 1);
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
