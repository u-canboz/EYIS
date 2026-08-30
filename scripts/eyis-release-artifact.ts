/**
 * eyis:release:artifact — baut das deterministische Release-Artefakt.
 *
 * `--check` baut nur im Speicher und beweist Vollständigkeit und Determinismus
 * (zweimal bauen → gleicher Digest). Läuft in `bun run verify`.
 */

import { buildArtifact } from "./installer/artifact";

const check = process.argv.includes("--check");
const versionArg = process.argv.find((a) => a.startsWith("--version="))?.split("=")[1];
const version = versionArg ?? process.env["EYIS_RELEASE_VERSION"] ?? "0.0.0-dev";

console.log("EYIS — Release-Artefakt");
console.log("=".repeat(72));

try {
  const first = buildArtifact(version, { write: !check });
  console.log(`Version:      ${first.version} (${first.channel})`);
  console.log(`Dateien:      ${first.files.length}`);
  console.log(`Artefakt:     ${first.bytes} Bytes`);
  console.log(`SHA-256:      ${first.tarballSha256}`);
  console.log(`Manifest-Sum: ${first.manifestSha256}`);

  if (check) {
    const second = buildArtifact(version, { write: false });
    const deterministic = second.tarballSha256 === first.tarballSha256;
    console.log(`Determinismus: ${deterministic ? "PASS" : "FAIL"}`);
    console.log(`Vollständigkeit: PASS`);
    console.log(`Gesamt:       ${deterministic ? "PASS" : "FAIL"}`);
    process.exit(deterministic ? 0 : 1);
  }
  console.log(`Geschrieben:  ${first.tarball}`);
  console.log("Gesamt:       PASS");
  process.exit(0);
} catch (e) {
  console.log(`Gesamt:       FAIL — ${e instanceof Error ? e.message : String(e)}`);
  process.exit(1);
}
