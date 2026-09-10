/** Node/Bun CLI helper. Never imported by the app runtime. */
import { createHash, verify, createPublicKey } from "node:crypto";
import { gunzipSync } from "node:zlib";
import { existsSync, lstatSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { classifyPath } from "../commerce/updates/ownership";
import { compareVersions, parseVersion } from "../commerce/updates/versions";

const digest = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const safePath = (path: string) =>
  path.length > 0 &&
  !path.startsWith("/") &&
  !path.includes("\\") &&
  path.split("/").every((p) => p !== ".." && p !== "." && p !== "");

type SignedArtifact = {
  version: string;
  key_id: string;
  minFromVersion?: string;
  requiresManualStep?: boolean;
  artifact: { sha256: string; bytes: number; name: string };
  files: Array<{ path: string; bytes: number; sha256: string }>;
};
export type Anchor = {
  keys: Array<{ key_id: string; public_key: string; status?: string; algorithm?: string }>;
};

/** Verify the exact signed bytes and every archive entry before writing anything. */
export function verifyUpdateArtifact(
  raw: string,
  signature: string,
  archive: Uint8Array,
  anchor: Anchor,
  expectedVersion: string,
) {
  const manifest = JSON.parse(raw) as SignedArtifact;
  const key = anchor.keys.find(
    (k) =>
      k.key_id === manifest.key_id &&
      (k.status ?? "active") === "active" &&
      (k.algorithm ?? "ed25519") === "ed25519",
  );
  if (
    !key ||
    !verify(
      null,
      Buffer.from(raw),
      createPublicKey(key.public_key),
      Buffer.from(signature.trim(), "base64"),
    )
  )
    throw new Error("Ungültige Release-Signatur.");
  if (!parseVersion(manifest.version) || manifest.version !== expectedVersion)
    throw new Error("Release-Version stimmt nicht überein.");
  if (manifest.artifact.bytes !== archive.length || digest(archive) !== manifest.artifact.sha256)
    throw new Error("Artefakt-Prüfsumme oder Größe stimmt nicht.");
  const wanted = new Map<string, { bytes: number; sha256: string }>();
  if (!Array.isArray(manifest.files) || manifest.files.length === 0)
    throw new Error("Leerer Dateikatalog.");
  for (const f of manifest.files) {
    if (
      !safePath(f.path) ||
      wanted.has(f.path) ||
      !Number.isSafeInteger(f.bytes) ||
      f.bytes < 0 ||
      !/^[a-f0-9]{64}$/.test(f.sha256)
    )
      throw new Error("Ungültiger Dateikatalog.");
    wanted.set(f.path, f);
  }
  const tar = gunzipSync(archive, { maxOutputLength: 256 * 1024 * 1024 });
  const files = new Map<string, Buffer>();
  for (let offset = 0; offset + 512 <= tar.length;) {
    const header = tar.subarray(offset, offset + 512);
    if (header.every((b) => b === 0)) break;
    const field = (start: number, end: number) =>
      header.subarray(start, end).toString("utf8").split("\0")[0]!;
    const name = field(0, 100);
    const prefix = field(345, 500);
    const path = prefix ? `${prefix}/${name}` : name;
    const sizeText = field(124, 136).trim();
    const size = /^[0-7]+$/.test(sizeText) ? parseInt(sizeText, 8) : NaN;
    const type = header[156];
    const checksum = [...header].reduce((sum, b, i) => sum + (i >= 148 && i < 156 ? 32 : b), 0);
    if (parseInt(field(148, 156).trim(), 8) !== checksum) throw new Error("Ungültiger TAR-Header.");
    if (
      !safePath(path) ||
      files.has(path) ||
      (type !== 48 && type !== 0) ||
      !Number.isSafeInteger(size) ||
      size < 0 ||
      offset + 512 + size > tar.length
    )
      throw new Error("Unsicherer oder beschädigter Archiv-Eintrag.");
    const content = tar.subarray(offset + 512, offset + 512 + size);
    const expected = wanted.get(path);
    if (!expected || expected.bytes !== size || expected.sha256 !== digest(content))
      throw new Error(`Dateiprüfung fehlgeschlagen: ${path}`);
    files.set(path, content);
    offset += 512 + Math.ceil(size / 512) * 512;
  }
  if (files.size !== wanted.size) throw new Error("Unvollständiges Artefakt.");
  return { manifest, files };
}

/** Customer files and symlink targets are never replaced. All checks precede writes. */
export function applyVerifiedUpdate(
  target: string,
  verified: ReturnType<typeof verifyUpdateArtifact>,
) {
  const root = resolve(target);
  const writes: Array<[string, Buffer]> = [];
  const assertNoSymlink = (path: string) => {
    let current = resolve(root, path);
    while (true) {
      // lstat also detects dangling symlinks; existsSync follows their target.
      if (lstatSync(current, { throwIfNoEntry: false })?.isSymbolicLink())
        throw new Error(`Symlink im Ziel: ${path}`);
      if (current === root) break;
      current = dirname(current);
    }
  };
  const identityPath = "src/lib/eyis/installed-release.json";
  assertNoSymlink(identityPath);
  for (const [path, content] of verified.files) {
    if (classifyPath(path) !== "eyis") continue;
    const destination = resolve(root, path);
    if (!destination.startsWith(root + sep)) throw new Error("Ungültiger Zielpfad.");
    assertNoSymlink(path);
    writes.push([destination, content]);
  }
  if (!writes.length) throw new Error("Keine aktualisierbaren EYIS-Dateien.");
  const identity = join(root, "src/lib/eyis/installed-release.json");
  if (!existsSync(identity))
    throw new Error("Installierte Release-Identität fehlt; betreutes Update erforderlich.");
  const previous = JSON.parse(readFileSync(identity, "utf8")) as { version: string };
  const minimum = verified.manifest.minFromVersion;
  if (
    !parseVersion(previous.version) ||
    !minimum ||
    !parseVersion(minimum) ||
    verified.manifest.requiresManualStep !== false
  )
    throw new Error("Kein automatischer Upgrade-Vertrag; betreutes Update erforderlich.");
  if (compareVersions(verified.manifest.version, previous.version) <= 0)
    throw new Error("Downgrade oder erneutes Einspielen derselben Version abgelehnt.");
  if (compareVersions(previous.version, minimum) < 0)
    throw new Error("Zwischenupdate erforderlich: installierte Version ist zu alt.");
  for (const [destination, content] of writes) {
    mkdirSync(dirname(destination), { recursive: true });
    writeFileSync(destination, content);
  }
  mkdirSync(dirname(identity), { recursive: true });
  writeFileSync(
    identity,
    JSON.stringify(
      { version: verified.manifest.version, artifactSha256: verified.manifest.artifact.sha256 },
      null,
      2,
    ) + "\n",
  );
  return { replaced: writes.length, version: verified.manifest.version };
}
