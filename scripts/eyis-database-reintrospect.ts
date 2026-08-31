/**
 * eyis:database:reintrospect — erzeugt den Schema-Fingerprint neu.
 *
 * Der Fingerprint wird NICHT geraten, sondern aus einer echten Fresh-Install
 * in einem temporären Cluster gewonnen: Baseline-Units → System-Seeds →
 * Introspektion → Hash. Ergebnis landet im Installer-Manifest und in
 * installer/database/verification/fingerprint.json.
 */

import { readFileSync, writeFileSync } from "node:fs";

import { startCluster } from "../qa/database-installer";
import { computeFingerprint } from "./installer/fingerprint";
import { introspect } from "./installer/introspect";
import { loadManifest, markInstalled, runFreshInstall, runSeeds } from "./installer/runner";

const MANIFEST_PATH = "installer/database/eyis-database-installer.manifest.json";
const FINGERPRINT_PATH = "installer/database/verification/fingerprint.json";

const manifest = loadManifest();
const cluster = startCluster();
let hash: string;
try {
  runFreshInstall(manifest, { env: cluster.env });
  runSeeds(manifest, cluster.env);
  markInstalled(manifest, cluster.env);
  hash = computeFingerprint(introspect(cluster.env)).hash;
} finally {
  cluster.stop();
}

const raw = JSON.parse(readFileSync(MANIFEST_PATH, "utf8")) as Record<string, unknown>;
raw["schema_fingerprint"] = hash;
raw["schema_fingerprint_state"] = "CURRENT";
raw["schema_fingerprint_migration_head"] = raw["schema_version"];
writeFileSync(MANIFEST_PATH, `${JSON.stringify(raw, null, 2)}\n`, "utf8");

const fp = JSON.parse(readFileSync(FINGERPRINT_PATH, "utf8")) as Record<string, unknown>;
fp["schema_fingerprint"] = hash;
writeFileSync(FINGERPRINT_PATH, `${JSON.stringify(fp, null, 2)}\n`, "utf8");

console.log(`Schema-Fingerprint neu erzeugt: ${hash}`);
