/**
 * eyis:release:selftest — Release-Regression gegen den RC.5-Signaturfehler.
 *
 * Realer Befund: der Release-Workflow baute das Tarball, BEVOR das Pack signiert
 * wurde. Dadurch enthielt das ausgelieferte Tarball eine veraltete
 * `installer/database/eyis-database-installer.signature.json`, während das
 * separat veröffentlichte Signatur-Asset korrekt war. Der Pack-Gate-Lauf aus dem
 * entpackten Tarball meldete deshalb FAIL.
 *
 * Dieser Selbsttest prüft ausschließlich aus dem entpackten Tarball:
 *   - Pack-Gate (Checksummen, Kompatibilität, Signatur, Gesamt) = PASS
 *   - eingebettete Signaturdatei vorhanden, aktuell und byte-identisch mit dem
 *     separat zu veröffentlichenden Asset
 *   - Dateienanzahl, Digest und key_id identisch
 *   - key_id ist der aktive Trust-Anchor-Schlüssel
 *   - Tarball-SHA-256 und Name entsprechen dem Release-Manifest
 *
 * Befehle:
 *   extracted [--version=x]  prüft das bereits gebaute Artefakt (CI-Modus)
 *   simulate                 vollständiger Durchlauf mit Wegwerf-Ed25519-Key in
 *                            einem temporären Verzeichnis (lokaler Modus)
 *
 * Der Wegwerf-Schlüssel liegt nur im Temp-Verzeichnis, wird nie ausgegeben, nie
 * committed und nach dem Lauf gelöscht. Der produktive Trust Anchor und das
 * Secret EYIS_PACK_SIGNING_KEY bleiben unangetastet.
 */

import { execFileSync } from "node:child_process";
import { createHash, generateKeyPairSync } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { buildArtifact } from "./installer/artifact";
import { SIGNATURE_PATH, packDigest, resolveAnchorKey } from "./installer/signature";

const ROOT = process.cwd();
const ARTIFACT_DIR = join(ROOT, "installer", "artifact");
const SIGNATURE_REL = "installer/database/eyis-database-installer.signature.json";

type Check = { id: string; status: "PASS" | "FAIL"; detail: string };

function sha256(data: Buffer | string) {
  return createHash("sha256").update(data).digest("hex");
}

export type SelftestResult = { checks: Check[]; ok: boolean };

/** Prüft ein bereits gebautes Artefakt ausschließlich aus dem entpackten Tarball. */
export function checkExtractedArtifact(version: string, env: NodeJS.ProcessEnv = {}): SelftestResult {
  const checks: Check[] = [];
  const add = (id: string, ok: boolean, detail: string) =>
    checks.push({ id, status: ok ? "PASS" : "FAIL", detail });

  const manifestPath = join(ARTIFACT_DIR, "eyis-release.json");
  const tarball = join(ARTIFACT_DIR, `eyis-dedicated-${version}.tar.gz`);
  if (!existsSync(manifestPath) || !existsSync(tarball)) {
    add("Artefakt vorhanden", false, `${tarball} oder eyis-release.json fehlt.`);
    return { checks, ok: false };
  }
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as {
    artifact: { name: string; sha256: string };
    file_count: number;
    key_id: string | null;
  };
  const tarBytes = readFileSync(tarball);
  add(
    "Tarball-SHA-256 = Release-Manifest",
    sha256(tarBytes) === manifest.artifact.sha256 &&
      manifest.artifact.name === `eyis-dedicated-${version}.tar.gz`,
    `${manifest.artifact.name} ${manifest.artifact.sha256.slice(0, 16)}…`,
  );

  const work = mkdtempSync(join(tmpdir(), "eyis-extract-"));
  try {
    execFileSync("tar", ["-xzf", tarball, "-C", work], { stdio: "pipe" });

    const embeddedPath = join(work, SIGNATURE_REL);
    add("Eingebettete Signaturdatei vorhanden", existsSync(embeddedPath), SIGNATURE_REL);
    if (!existsSync(embeddedPath)) return { checks, ok: false };

    const embeddedRaw = readFileSync(embeddedPath);
    const externalRaw = readFileSync(SIGNATURE_PATH);
    add(
      "Eingebettete = externe Signaturdatei (byte-identisch)",
      embeddedRaw.equals(externalRaw),
      `${sha256(embeddedRaw).slice(0, 16)}… vs ${sha256(externalRaw).slice(0, 16)}…`,
    );

    const embedded = JSON.parse(embeddedRaw.toString("utf8")) as {
      files: number;
      digest: string;
      key_id: string;
    };
    const external = JSON.parse(externalRaw.toString("utf8")) as {
      files: number;
      digest: string;
      key_id: string;
    };
    const current = packDigest();
    add(
      "Digest identisch (Pack = eingebettet = extern)",
      embedded.digest === current.digest && external.digest === current.digest,
      `${current.digest.slice(0, 16)}…`,
    );
    add(
      "Dateienanzahl identisch",
      embedded.files === current.entries.length && external.files === current.entries.length,
      `${current.entries.length} signaturrelevante Dateien`,
    );
    add("key_id identisch", embedded.key_id === external.key_id, embedded.key_id);

    const anchor = resolveAnchorKey(embedded.key_id);
    add(
      "key_id ist aktiver Trust-Anchor-Schlüssel",
      anchor.ok,
      anchor.ok ? embedded.key_id : anchor.reason,
    );

    // Pack-Gate ausschließlich aus dem entpackten Tarball.
    const out = execFileSync("bun", ["run", "installer/eyis.ts", "pack"], {
      cwd: work,
      encoding: "utf8",
      env: { ...process.env, ...env },
      stdio: ["ignore", "pipe", "pipe"],
    });
    const line = (label: string) =>
      out.split("\n").find((l) => l.startsWith(label))?.split(":").slice(1).join(":").trim() ?? "";
    for (const label of ["Checksummen", "Kompatibilität", "Signatur", "Gesamt"]) {
      add(`Entpacktes Tarball — ${label}`, line(label) === "PASS", line(label) || "keine Ausgabe");
    }
  } catch (e) {
    add("Pack-Gate aus entpacktem Tarball", false, e instanceof Error ? e.message : String(e));
  } finally {
    rmSync(work, { recursive: true, force: true });
  }

  return { checks, ok: checks.every((c) => c.status === "PASS") };
}

/** Vollständige Release-Simulation mit Wegwerf-Schlüssel, ohne Datenbank und ohne Netz. */
function simulate(version: string): SelftestResult {
  const work = mkdtempSync(join(tmpdir(), "eyis-selftest-"));
  const backup = existsSync(SIGNATURE_PATH) ? readFileSync(SIGNATURE_PATH) : null;
  const artifacts: string[] = [];
  try {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
    const pub = publicKey.export({ type: "spki", format: "pem" }).toString();
    const keyId = sha256(pub).slice(0, 32);

    const anchorPath = join(work, "trust-anchor.json");
    const realAnchor = JSON.parse(
      readFileSync(join(ROOT, "installer", "distribution", "eyis-trust-anchor.json"), "utf8"),
    ) as { keys: unknown[] };
    writeFileSync(
      anchorPath,
      JSON.stringify(
        {
          ...realAnchor,
          keys: [
            ...(realAnchor.keys as { status?: string }[]).map((k) => ({ ...k, status: "revoked" })),
            { key_id: keyId, label: "selftest-throwaway", algorithm: "ed25519", status: "active", public_key: pub },
          ],
        },
        null,
        2,
      ),
      "utf8",
    );

    const env = { EYIS_PACK_SIGNING_KEY: pem, EYIS_TRUST_ANCHOR_PATH: anchorPath };
    const run = (args: string[]) =>
      execFileSync("bun", ["run", ...args], {
        cwd: ROOT,
        encoding: "utf8",
        env: { ...process.env, ...env },
        stdio: ["ignore", "pipe", "pipe"],
      });

    // 1. signieren  2. verifizieren  3. erst danach Tarball bauen
    run(["scripts/eyis-pack-signature.ts", "sign"]);
    run(["scripts/eyis-pack-signature.ts", "verify"]);
    const built = buildArtifact(version, { write: true });
    artifacts.push(built.tarball, built.manifestPath, `${built.manifestPath}.sig`);

    const result = checkExtractedArtifact(version, { EYIS_TRUST_ANCHOR_PATH: anchorPath });

    run(["scripts/eyis-pack-signature.ts", "sign-artifact", built.manifestPath]);
    const verifyOut = run(["scripts/eyis-pack-signature.ts", "verify-artifact", built.manifestPath]);
    result.checks.push({
      id: "Release-Manifest signiert und verifiziert",
      status: verifyOut.includes("Signatur PASS") ? "PASS" : "FAIL",
      detail: verifyOut.trim().split("\n").at(-1) ?? "",
    });

    return { checks: result.checks, ok: result.checks.every((c) => c.status === "PASS") };
  } finally {
    if (backup) writeFileSync(SIGNATURE_PATH, backup);
    for (const file of artifacts) rmSync(file, { force: true });
    rmSync(work, { recursive: true, force: true });
  }
}

export function runSelftest(mode: "extracted" | "simulate", version: string): SelftestResult {
  return mode === "simulate" ? simulate(version) : checkExtractedArtifact(version);
}

if (import.meta.main) {
  const mode = (process.argv[2] === "simulate" ? "simulate" : "extracted") as "extracted" | "simulate";
  const version =
    process.argv.find((a) => a.startsWith("--version="))?.split("=")[1] ??
    process.env["EYIS_RELEASE_VERSION"] ??
    (mode === "simulate" ? "0.0.0-selftest" : "0.0.0-dev");

  console.log(`EYIS — Release-Selbsttest (${mode}, Version ${version})`);
  console.log("=".repeat(78));
  const result = runSelftest(mode, version);
  for (const check of result.checks) {
    console.log(`  ${check.status.padEnd(5)} ${check.id.padEnd(48)} ${check.detail}`);
  }
  console.log("=".repeat(78));
  console.log(`Gesamt: ${result.ok ? "PASS" : "FAIL"}`);
  process.exit(result.ok ? 0 : 1);
}
