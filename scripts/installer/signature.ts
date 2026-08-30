/**
 * Pack-Signatur und Ausführungs-Gate (Phase 25).
 *
 * Signiert wird nicht das Verzeichnis, sondern ein deterministischer Digest über
 * alle signaturrelevanten Dateien: Installer-Manifest, Baseline-Units, System-Seed-
 * Manifest und Seed-Units, Reconciliation, Resource-Manifest und Distribution-Manifest.
 *
 * Der private Schlüssel steht niemals im Repository. Er wird ausschließlich als
 * Secret des Release-/CI-Systems in EYIS_PACK_SIGNING_KEY erwartet (Ed25519,
 * PKCS#8-PEM) und nur im Speicher verwendet. Der öffentliche Schlüssel wird mit
 * der Signaturdatei ausgeliefert.
 *
 * Ohne gültige Signatur wird keine einzige SQL-Unit ausgeführt.
 */

import { createHash, createPublicKey, verify as edVerify } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

export const REPO_ROOT = process.cwd();
export const PACK_ROOT = join(REPO_ROOT, "installer", "database");
export const SIGNATURE_PATH = join(PACK_ROOT, "eyis-database-installer.signature.json");
export const TRUST_ANCHOR_PATH = join(
  REPO_ROOT,
  "installer",
  "distribution",
  "eyis-trust-anchor.json",
);

export type TrustAnchor = {
  keys: { key_id: string; public_key: string; status?: string }[];
};

/** Gepinnter öffentlicher Schlüssel zur key_id — nie aus der Signaturdatei. */
export function trustedKey(keyId: string | undefined): string | null {
  if (!keyId || !existsSync(TRUST_ANCHOR_PATH)) return null;
  const anchor = JSON.parse(readFileSync(TRUST_ANCHOR_PATH, "utf8")) as TrustAnchor;
  const entry = (anchor.keys ?? []).find(
    (k) => k.key_id === keyId && (k.status ?? "active") === "active",
  );
  return entry?.public_key ?? null;
}

type InstallerManifest = {
  version: string;
  schema_version: string;
  fresh_install: { units: { file: string }[] };
  migration_history_reconciliation: { file: string };
};
type SeedManifest = { system_seed_fingerprint: string; units: { file: string }[] };

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

/**
 * Alle signaturrelevanten Dateien, repo-relativ.
 *
 * Phase 26: Es wird NICHT mehr nach `existsSync` gefiltert. Eine im Manifest
 * genannte, aber fehlende Datei würde sonst still aus dem Digest verschwinden —
 * ein unvollständiges Pack wäre weiterhin gültig signiert. Fehlt eine Datei,
 * ist das ein harter Fehler.
 */
export function signedFiles(): string[] {
  const manifest = readJson<InstallerManifest>(
    join(PACK_ROOT, "eyis-database-installer.manifest.json"),
  );
  const seeds = readJson<SeedManifest>(join(PACK_ROOT, "seeds", "eyis-system-seeds.manifest.json"));

  const required = [
    "installer/database/eyis-database-installer.manifest.json",
    `installer/database/${manifest.migration_history_reconciliation.file}`,
    ...manifest.fresh_install.units.map((u) => `installer/database/${u.file}`),
    "installer/database/seeds/eyis-system-seeds.manifest.json",
    ...seeds.units.map((u) => `installer/database/seeds/${u.file}`),
    "installer/resources/eyis-resources.manifest.json",
    "installer/distribution/eyis-code-distribution.manifest.json",
    "installer/distribution/eyis-trust-anchor.json",
  ];
  const missing = required.filter((f) => !existsSync(join(REPO_ROOT, f)));
  if (missing.length) {
    throw new Error(
      `Signaturrelevante Datei fehlt: ${missing.join(", ")} — Pack ist unvollständig.`,
    );
  }
  return required;
}

/** Deterministischer Digest über alle signaturrelevanten Pack-Inhalte. */
export function packDigest(): { digest: string; entries: [string, string][] } {
  const seeds = readJson<SeedManifest>(join(PACK_ROOT, "seeds", "eyis-system-seeds.manifest.json"));
  const entries: [string, string][] = signedFiles()
    .sort()
    .map((f) => [
      f,
      createHash("sha256").update(readFileSync(join(REPO_ROOT, f))).digest("hex"),
    ]);
  const digest = createHash("sha256")
    .update(JSON.stringify({ entries, seed_fingerprint: seeds.system_seed_fingerprint }))
    .digest("hex");
  return { digest, entries };
}

export type GateStatus = "PASS" | "FAIL" | "BLOCKED";
export type GateResult = {
  status: GateStatus;
  signature: GateStatus;
  checksums: GateStatus;
  compatibility: GateStatus;
  digest: string;
  files: number;
  detail: string;
};

/** Prüft Checksummen aller Units, Version-Kompatibilität und die Ed25519-Signatur. */
export function verifyPack(): GateResult {
  const { digest, entries } = packDigest();
  const manifest = readJson<InstallerManifest>(
    join(PACK_ROOT, "eyis-database-installer.manifest.json"),
  );

  // Checksummen der Units gegen das Manifest
  let checksums: GateStatus = "PASS";
  let detail = "";
  const units = readJson<{
    fresh_install: { units: { id: string; file: string; checksum: string }[] };
  }>(join(PACK_ROOT, "eyis-database-installer.manifest.json")).fresh_install.units;
  for (const unit of units) {
    const path = join(PACK_ROOT, unit.file);
    if (!existsSync(path)) {
      checksums = "FAIL";
      detail = `Unit ${unit.id} fehlt`;
      break;
    }
    const sum = createHash("sha256").update(readFileSync(path, "utf8")).digest("hex");
    if (sum !== unit.checksum) {
      checksums = "FAIL";
      detail = `Checksumme der Unit ${unit.id} weicht ab`;
      break;
    }
  }

  // Version-Kompatibilität: Baseline-Version und Schema-Version müssen gesetzt und semver-artig sein
  const semver = /^\d+\.\d+\.\d+$/;
  const compatibility: GateStatus =
    semver.test(manifest.version) && Boolean(manifest.schema_version) ? "PASS" : "FAIL";

  // Signatur — Vertrauenswurzel ist AUSSCHLIESSLICH der gepinnte Trust Anchor.
  let signature: GateStatus;
  if (!existsSync(SIGNATURE_PATH)) {
    signature = "BLOCKED";
    detail ||= "Keine Signaturdatei vorhanden — Pack unsigniert (EYIS_PACK_SIGNING_KEY fehlt).";
  } else {
    const sig = readJson<{ digest: string; signature: string; key_id?: string }>(SIGNATURE_PATH);
    const trusted = trustedKey(sig.key_id);
    if (sig.digest !== digest) {
      signature = "FAIL";
      detail = "Pack-Inhalt weicht vom signierten Digest ab.";
    } else if (!sig.key_id) {
      signature = "FAIL";
      detail = "Signaturdatei nennt keine key_id — ein mitgelieferter Schlüssel wird nicht akzeptiert.";
    } else if (!trusted) {
      signature = "FAIL";
      detail = `Signaturschlüssel ${sig.key_id} steht nicht im EYIS Trust Anchor.`;
    } else {
      const ok = edVerify(
        null,
        Buffer.from(digest, "hex"),
        createPublicKey(trusted),
        Buffer.from(sig.signature, "base64"),
      );
      signature = ok ? "PASS" : "FAIL";
      if (!ok) detail = "Ungültige Ed25519-Signatur.";
    }
  }

  const status: GateStatus =
    checksums === "FAIL" || compatibility === "FAIL" || signature === "FAIL"
      ? "FAIL"
      : signature === "BLOCKED"
        ? "BLOCKED"
        : "PASS";

  return { status, signature, checksums, compatibility, digest, files: entries.length, detail };
}

/**
 * Hartes Gate vor jeder SQL-Ausführung. Ungültige Signatur oder abweichende
 * Checksummen brechen immer ab. Ein unsigniertes Pack (BLOCKED) darf nur mit
 * ausdrücklichem EYIS_ALLOW_UNSIGNED_PACK=1 laufen — Dev- und QA-Läufe.
 */
export function assertPackGate(env: NodeJS.ProcessEnv = process.env): GateResult {
  const result = verifyPack();
  if (result.status === "FAIL") {
    throw new Error(`Install Pack abgelehnt: ${result.detail || "Signatur-/Checksummenprüfung fehlgeschlagen."}`);
  }
  if (result.status === "BLOCKED" && env["EYIS_ALLOW_UNSIGNED_PACK"] !== "1") {
    throw new Error(
      "Install Pack ist nicht signiert. Signatur bereitstellen oder den Lauf ausdrücklich mit EYIS_ALLOW_UNSIGNED_PACK=1 als unsigniert kennzeichnen.",
    );
  }
  return result;
}
