/** Run only in a disposable GitHub Actions checkout, before commit/push. */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { applyVerifiedUpdate, verifyUpdateArtifact, type Anchor } from "./update-artifact";

const [manifestFile, signatureFile, archiveFile, version] = process.argv.slice(2);
if (!manifestFile || !signatureFile || !archiveFile || !version)
  throw new Error("Usage: bun src/lib/eyis/update-cli.ts manifest signature archive version");
const anchor = JSON.parse(
  readFileSync(resolve("installer/distribution/eyis-trust-anchor.json"), "utf8"),
) as Anchor;
const verified = verifyUpdateArtifact(
  readFileSync(manifestFile, "utf8"),
  readFileSync(signatureFile, "utf8"),
  readFileSync(archiveFile),
  anchor,
  version,
);
const result = applyVerifiedUpdate(process.cwd(), verified);
console.log(`EYIS ${result.version}: ${result.replaced} verifizierte Dateien übernommen.`);
