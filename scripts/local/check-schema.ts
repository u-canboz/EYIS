/** Compare this local installation to the independent Install Pack reference plus forward migrations. */
import { readFileSync } from "node:fs";
import { introspect } from "../installer/introspect";
import { computeFingerprint, diffNormalized } from "../installer/fingerprint";
if (process.env.APP_ENV !== "development")
  throw Error("Only the local development installation is supported");
const expected = JSON.parse(readFileSync(".local-state/logs/reference-schema.json", "utf8"));
const actual = computeFingerprint(introspect());
const differences = diffNormalized(expected.normalized, actual.normalized);
console.log("Reference:", expected.hash);
console.log("Database: ", actual.hash);
if (actual.hash !== expected.hash || differences.length) {
  console.error(differences.join("\n"));
  process.exit(1);
}
console.log(
  "Current development schema: PASS (independent Install Pack reference plus forward migrations).",
);
