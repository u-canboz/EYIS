import { createHash } from "node:crypto";
import { parseVersion } from "../../src/lib/commerce/updates/versions";

// Release envelopes necessarily change on promotion. Every application, SQL,
// seed and trust-anchor byte remains part of the comparison.
const ENVELOPES = new Set([
  "installer/database/eyis-database-installer.signature.json",
  "installer/distribution/eyis-release-promotion.json",
  "src/lib/eyis/installed-release.json",
]);
export function promotionPayloadDigest(
  files: Array<{ path: string; sha256: string; bytes: number }>,
): string {
  const entries = files
    .filter((f) => !ENVELOPES.has(f.path))
    .map((f) => [f.path, f.sha256, f.bytes] as const)
    .sort(([a], [b]) => a.localeCompare(b));
  if (!entries.length) throw new Error("Leerer Promotion-Payload.");
  return createHash("sha256").update(JSON.stringify(entries)).digest("hex");
}

export function isSameReleaseLine(candidate: string, stable: string): boolean {
  const from = parseVersion(candidate),
    to = parseVersion(stable);
  return Boolean(
    from &&
    to &&
    from.pre?.startsWith("rc.") &&
    !to.pre &&
    from.major === to.major &&
    from.minor === to.minor &&
    from.patch === to.patch,
  );
}
