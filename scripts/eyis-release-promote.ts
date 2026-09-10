/** Stable promotion compares all installed payload bytes, excluding only release envelopes. */
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { promotionPayloadDigest, isSameReleaseLine } from "./installer/promotion";
import { parseVersion } from "../src/lib/commerce/updates/versions";
import { buildArtifact } from "./installer/artifact";

const RECORD_PATH = join(process.cwd(), "installer", "distribution", "eyis-release-promotion.json");

type Record_ = {
  manifest: "eyis-release-promotion";
  candidate: string | null;
  digest: string | null;
  payload_digest?: string;
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
  if (!parseVersion(version)?.pre?.startsWith("rc."))
    throw new Error("Nur ein Release Candidate kann als Promotion-Kandidat erfasst werden.");
  const built = buildArtifact(version, { write: false });
  const record: Record_ = {
    manifest: "eyis-release-promotion",
    candidate: version,
    digest: built.tarballSha256,
    payload_digest: promotionPayloadDigest(built.files),
    blackbox: (process.env["EYIS_BLACKBOX_RESULT"] as Record_["blackbox"]) ?? "OFFEN",
    recorded_at: new Date().toISOString(),
    note: "Code, Datenbank, Seeds und Trust Anchor müssen byte-identisch sein. Nur Versionsidentität, Signaturumschlag und dieser Record dürfen abweichen.",
  };
  writeFileSync(RECORD_PATH, `${JSON.stringify(record, null, 2)}\n`, "utf8");
  console.log(`Kandidat festgehalten: ${version} (${built.tarballSha256.slice(0, 16)}…)`);
  console.log(`Blackbox: ${record.blackbox}`);
  process.exit(0);
}

const record = readRecord();
if (parseVersion(version)?.pre) {
  console.log(`Release Candidate ${version} — keine Promotion nötig.`);
  console.log("Gesamt: PASS");
  process.exit(0);
}
if (!record.digest || !record.payload_digest) {
  console.log("Gesamt: FAIL — kein geprüfter Release Candidate hinterlegt.");
  process.exit(1);
}
if (record.blackbox !== "PASS") {
  console.log(
    `Gesamt: FAIL — Blackbox-Test des Kandidaten ${record.candidate} steht auf ${record.blackbox}.`,
  );
  process.exit(1);
}
const built = buildArtifact(version, { write: false });
const identical =
  isSameReleaseLine(record.candidate ?? "", version) &&
  promotionPayloadDigest(built.files) === record.payload_digest;
console.log(`Kandidat: ${record.candidate}`);
console.log(`Erwarteter Payload-Digest: ${record.payload_digest}`);
console.log(`Gebauter Payload-Digest:   ${promotionPayloadDigest(built.files)}`);
console.log(`Gesamt: ${identical ? "PASS" : "FAIL — Stable weicht vom geprüften RC ab."}`);
process.exit(identical ? 0 : 1);
