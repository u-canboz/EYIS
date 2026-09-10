import { generateKeyPairSync, sign } from "node:crypto";
import { mkdtempSync, readFileSync, writeFileSync, mkdirSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { buildArtifact } from "../../../../../scripts/installer/artifact";
import { applyVerifiedUpdate, verifyUpdateArtifact } from "../../../eyis/update-artifact";

const built = buildArtifact("1.0.0-rc.10", { write: true });
const pair = generateKeyPairSync("ed25519");
const manifest = JSON.parse(readFileSync(built.manifestPath, "utf8"));
manifest.key_id = "test-only";
manifest.minFromVersion = "0.0.0-dev";
manifest.requiresManualStep = false;
const raw = JSON.stringify(manifest);
const signature = sign(null, Buffer.from(raw), pair.privateKey).toString("base64");
const anchor = {
  keys: [
    {
      key_id: "test-only",
      public_key: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    },
  ],
};
const bytes = readFileSync(built.tarball);
const dirs: string[] = [];
const fresh = () => {
  const d = mkdtempSync(join(tmpdir(), "eyis-update-test-"));
  dirs.push(d);
  return d;
};
afterAll(() => dirs.forEach((dir) => rmSync(dir, { recursive: true, force: true })));

describe("Real release tarball → verified customer update", () => {
  it("verifies the builder's actual archive and preserves customer files", () => {
    const verified = verifyUpdateArtifact(raw, signature, bytes, anchor, "1.0.0-rc.10");
    expect(verified.files.size).toBe(built.files.length);
    expect(
      JSON.parse(verified.files.get("src/lib/eyis/installed-release.json")!.toString()).version,
    ).toBe("1.0.0-rc.10");
    const target = fresh();
    mkdirSync(join(target, "src/routes"), { recursive: true });
    mkdirSync(join(target, "src/lib/eyis"), { recursive: true });
    writeFileSync(join(target, "src/lib/eyis/installed-release.json"), '{"version":"0.0.0-dev"}');
    writeFileSync(join(target, "package.json"), '{"name":"customer-shop"}');
    writeFileSync(join(target, "src/routes/__root.tsx"), "customer root");
    applyVerifiedUpdate(target, verified);
    expect(readFileSync(join(target, "package.json"), "utf8")).toBe('{"name":"customer-shop"}');
    expect(readFileSync(join(target, "src/routes/__root.tsx"), "utf8")).toBe("customer root");
    expect(
      JSON.parse(readFileSync(join(target, "src/lib/eyis/installed-release.json"), "utf8")).version,
    ).toBe("1.0.0-rc.10");
    expect(() => applyVerifiedUpdate(target, verified)).toThrow("Downgrade");
  });
  it("rejects tampering, foreign keys and version substitution", () => {
    const changed = Buffer.from(bytes);
    changed[100] = changed[100]! ^ 1;
    expect(() => verifyUpdateArtifact(raw, signature, changed, anchor, "1.0.0-rc.10")).toThrow(
      "Prüfsumme",
    );
    expect(() => verifyUpdateArtifact(raw, signature, bytes, { keys: [] }, "1.0.0-rc.10")).toThrow(
      "Signatur",
    );
    expect(() => verifyUpdateArtifact(raw, signature, bytes, anchor, "1.0.0")).toThrow("Version");
  });
  it("rejects missing identity and missing upgrade contracts", () => {
    const verified = verifyUpdateArtifact(raw, signature, bytes, anchor, "1.0.0-rc.10");
    const target = fresh();
    expect(() => applyVerifiedUpdate(target, verified)).toThrow("Identität");
    mkdirSync(join(target, "src/lib/eyis"), { recursive: true });
    writeFileSync(join(target, "src/lib/eyis/installed-release.json"), '{"version":"0.0.0-dev"}');
    expect(() =>
      applyVerifiedUpdate(target, {
        ...verified,
        manifest: { ...verified.manifest, requiresManualStep: true },
      }),
    ).toThrow("Upgrade-Vertrag");
    expect(() =>
      applyVerifiedUpdate(target, {
        ...verified,
        manifest: { ...verified.manifest, minFromVersion: "1.0.0-rc.9" },
      }),
    ).toThrow("Zwischenupdate");
  });
  it("rejects dangling symlinks", () => {
    const target = fresh();
    symlinkSync(join(target, "does-not-exist"), join(target, "src"));
    const verified = verifyUpdateArtifact(raw, signature, bytes, anchor, "1.0.0-rc.10");
    expect(() => applyVerifiedUpdate(target, verified)).toThrow("Symlink");
  });
  it("rejects symlink destinations before writing any files", () => {
    const target = fresh();
    const outside = fresh();
    symlinkSync(outside, join(target, "src"));
    const verified = verifyUpdateArtifact(raw, signature, bytes, anchor, "1.0.0-rc.10");
    expect(() => applyVerifiedUpdate(target, verified)).toThrow("Symlink");
  });
});
