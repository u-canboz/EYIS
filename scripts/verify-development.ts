/** Full verification in a disposable copy, without using the release private key. */
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { createHash, generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join, relative, resolve } from "node:path";

const root = process.cwd();
if (!existsSync(join(root, "node_modules")))
  throw new Error("Zuerst bun install --frozen-lockfile ausführen.");
const temporary = mkdtempSync(join(tmpdir(), "eyis-development-check-"));
const snapshot = join(temporary, "source");
let exitCode = 1;
try {
  cpSync(root, snapshot, {
    recursive: true,
    filter: (source) => {
      const path = relative(root, source).split("/");
      return (
        !path.some(
          (part) =>
            [
              ".git",
              "node_modules",
              ".output",
              ".tanstack",
              ".wrangler",
              "work",
              "outputs",
            ].includes(part) || part.startsWith(".env"),
        ) && !relative(root, source).startsWith("installer/artifact")
      );
    },
  });
  symlinkSync(resolve(root, "node_modules"), join(snapshot, "node_modules"), "dir");
  const pair = generateKeyPairSync("ed25519");
  const publicKey = pair.publicKey.export({ type: "spki", format: "pem" }).toString();
  const keyId = createHash("sha256").update(publicKey).digest("hex").slice(0, 32);
  const anchor = join(temporary, "test-anchor.json");
  const original = JSON.parse(
    readFileSync(join(root, "installer/distribution/eyis-trust-anchor.json"), "utf8"),
  );
  writeFileSync(
    anchor,
    JSON.stringify({
      ...original,
      keys: [
        ...original.keys,
        { key_id: keyId, public_key: publicKey, status: "active", algorithm: "ed25519" },
      ],
    }),
  );
  const env = {
    ...process.env,
    EYIS_PACK_SIGNING_KEY: pair.privateKey.export({ type: "pkcs8", format: "pem" }).toString(),
    EYIS_TRUST_ANCHOR_PATH: anchor,
  };
  console.log(
    "Development verification: isolated source copy, disposable signing key; no release artifact is produced.",
  );
  const sign = spawnSync(process.execPath, ["run", "eyis:pack:sign"], {
    cwd: snapshot,
    env,
    stdio: "inherit",
  });
  if (sign.status !== 0) throw new Error("Test-Pack konnte nicht signiert werden.");
  const verification = spawnSync(process.execPath, ["run", "verify"], {
    cwd: snapshot,
    env,
    stdio: "inherit",
  });
  exitCode = verification.status ?? 1;
} finally {
  rmSync(temporary, { recursive: true, force: true });
}
process.exit(exitCode);
