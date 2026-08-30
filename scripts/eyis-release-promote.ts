/**
 * eyis:release:promote — Stable-Promotion nur bei identischem Digest.
 *
 * Ein Stable-Release ist keine Neuentwicklung, sondern die Freigabe eines
 * bereits geprüften Release Candidate. Deshalb wird ein Stable-Tag nur dann
 * signiert, wenn das frisch gebaute Artefakt byte-identisch zu dem im
 * Promotion-Record festgehaltenen RC ist.
 *
 * Aufrufe:
 *   promote record <version>   — RC-Digest festhalten (nach bestandenem Blackbox-Test)
 *   promote check  <version>   — Stable-Tag gegen den Record prüfen
 */

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { buildArtifact } from "./installer/artifact";

const RECORD_PATH = join(
  process.cwd(),
  "installer",
  "distribution",
  "eyis-release-promotion.json",
);

type Record_ = {
  manifest: "eyis-release-promotion";
  candidate: string | null;
  digest: string | null;
  blackbox: "PASS" | "OFFEN" | "FAIL";
  recorded_at: string | null;
  note: string;
};

function readRecord(): Record_ {
  if (!existsSync(RECORD_PATH)) {
    return {
      manifest: "eyis-release-promotion",
      candidate: null,
      digest: null,
      blackbox: "OFFEN",
      recorded_at: null,
      note: "Noch kein Release Candidate freigegeben.",
    };
  }
  return JSON.parse(readFileSync(RECORD_PATH, "utf8")) as Record_;
}

const mode = process.argv[2] ?? "check";
const version = process.argv[3] ?? process.env["EYIS_RELEASE_VERSION"] ?? "";

console.log("EYIS — Stable-Promotion");
console.log("=".repeat(72));

if (!version) {
  console.log("Gesamt: FAIL — Version fehlt.");
  process.exit(1);
}

if (mode === "record") {
  const built = buildArtifact(version, { write: false });
  const record: Record_ = {
    manifest: "eyis-release-promotion",
    candidate: version,
    digest: built.tarballSha256,
    blackbox: (process.env["EYIS_BLACKBOX_RESULT"] as Record_["blackbox"]) ?? "OFFEN",
    recorded_at: new Date().toISOString(),
    note: "Ein Stable-Release wird nur signiert, wenn sein Artefakt-Digest exakt diesem RC entspricht.",
  };
  writeFileSync(RECORD_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`Kandidat festgehalten: ${version} (${built.tarballSha256.slice(0, 16)}…)`);
  console.log(`Blackbox: ${record.blackbox}`);
  process.exit(0);
}

const record = readRecord();
if (version.includes("-rc.")) {
  console.log(`Release Candidate ${version} — keine Promotion nötig.`);
  console.log("Gesamt: PASS");
  process.exit(0);
}
if (!record.digest) {
  console.log("Gesamt: FAIL — kein geprüfter Release Candidate hinterlegt.");
  process.exit(1);
}
if (record.blackbox !== "PASS") {
  console.log(`Gesamt: FAIL — Blackbox-Test des Kandidaten ${record.candidate} steht auf ${record.blackbox}.`);
  process.exit(1);
}
const built = buildArtifact(version, { write: false });
const identical = built.tarballSha256 === record.digest;
console.log(`Kandidat: ${record.candidate}`);
console.log(`Erwarteter Digest: ${record.digest}`);
console.log(`Gebauter Digest:   ${built.tarballSha256}`);
console.log(`Gesamt: ${identical ? "PASS" : "FAIL — Stable weicht vom geprüften RC ab."}`);
process.exit(identical ? 0 : 1);
