/**
 * rc.6-Hotfix — Update-Verifikation gegen den gepinnten Trust Anchor.
 *
 * Befund: das Update Center verlangte EYIS_RELEASE_PUBLIC_KEY, obwohl jede
 * Installation den gepinnten Trust Anchor mitliefert. Diese Tests belegen:
 * SPKI-PEM-Support, key_id-Auflösung (aktiv/unbekannt/revoked), Ablehnung
 * manipulierter Manifeste, Override-Regeln und das reale Signaturformat des
 * Release-Workflows (eyis-release.json trägt key_id, .sig ist base64-Rohsignatur).
 */
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  SignatureError,
  verifyManifestSignature,
  verifyReleaseManifest,
} from "../updates/signature";
import {
  activeTrustKeys,
  matchesActiveAnchorKey,
  resolveTrustKey,
  spkiPemToRawBase64,
} from "../updates/trust-anchor";

const anchor = JSON.parse(
  readFileSync("installer/distribution/eyis-trust-anchor.json", "utf8"),
) as { keys: { key_id: string; public_key: string; status?: string }[] };

function fixtureKey() {
  const pair = generateKeyPairSync("ed25519");
  return {
    pem: pair.publicKey.export({ type: "spki", format: "pem" }).toString(),
    rawBase64: pair.publicKey
      .export({ type: "spki", format: "der" })
      .subarray(12)
      .toString("base64"),
    sign: (payload: string) => edSign(null, Buffer.from(payload, "utf8"), pair.privateKey).toString("base64"),
  };
}

describe("Trust Anchor", () => {
  it("enthält mindestens einen aktiven Ed25519-Schlüssel", () => {
    expect(activeTrustKeys().length).toBeGreaterThan(0);
    expect(anchor.keys.length).toBeGreaterThan(0);
  });

  it("löst die aktive key_id auf", () => {
    const active = anchor.keys.find((k) => (k.status ?? "active") === "active")!;
    const resolved = resolveTrustKey(active.key_id);
    expect(resolved.ok).toBe(true);
    if (resolved.ok) {
      expect(resolved.publicKeyPem).toContain("BEGIN PUBLIC KEY");
    }
  });

  it("lehnt unbekannte key_id ab", () => {
    const resolved = resolveTrustKey("0".repeat(32));
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.code).toBe("KEY_UNKNOWN");
  });

  it("lehnt widerrufene key_id ab", () => {
    const revoked = anchor.keys.find((k) => k.status === "revoked");
    if (!revoked) return; // kein revoked-Eintrag im Anchor → nichts zu prüfen
    const resolved = resolveTrustKey(revoked.key_id);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.code).toBe("KEY_NOT_ACTIVE");
  });

  it("lehnt fehlende key_id ab — ein mitgelieferter Schlüssel zählt nicht", () => {
    const resolved = resolveTrustKey(null);
    expect(resolved.ok).toBe(false);
    if (!resolved.ok) expect(resolved.code).toBe("KEY_ID_MISSING");
  });

  it("SPKI-PEM und roher base64-Schlüssel beschreiben denselben Schlüssel", () => {
    const key = fixtureKey();
    expect(spkiPemToRawBase64(key.pem)).toBe(key.rawBase64);
  });
});

describe("Signaturverifikation", () => {
  it("akzeptiert gültige Signatur mit SPKI-PEM (Anchor-Format)", async () => {
    const key = fixtureKey();
    const manifest = JSON.stringify({ version: "1.0.0-rc.7", key_id: "x".repeat(32) });
    await expect(
      verifyManifestSignature(manifest, key.sign(manifest), key.pem),
    ).resolves.toBeUndefined();
  });

  it("akzeptiert gültige Signatur mit rohem base64-Schlüssel", async () => {
    const key = fixtureKey();
    const manifest = JSON.stringify({ version: "1.0.0-rc.7" });
    await expect(
      verifyManifestSignature(manifest, key.sign(manifest), key.rawBase64),
    ).resolves.toBeUndefined();
  });

  it("lehnt manipuliertes Manifest ab (exakte Bytefolge, kein Neu-Serialisieren)", async () => {
    const key = fixtureKey();
    const manifest = JSON.stringify({ version: "1.0.0-rc.7" });
    const signature = key.sign(manifest);
    const tampered = manifest.replace("rc.7", "rc.8");
    await expect(verifyManifestSignature(tampered, signature, key.pem)).rejects.toMatchObject({
      code: "SIGNATURE_INVALID",
    });
    // Auch whitespace-manipuliertes (neu serialisiertes) JSON muss scheitern.
    const reserialized = JSON.stringify(JSON.parse(manifest), null, 2);
    await expect(verifyManifestSignature(reserialized, signature, key.pem)).rejects.toMatchObject({
      code: "SIGNATURE_INVALID",
    });
  });

  it("lehnt ungültige Signatur ab", async () => {
    const key = fixtureKey();
    const other = fixtureKey();
    const manifest = JSON.stringify({ version: "1.0.0-rc.7" });
    await expect(
      verifyManifestSignature(manifest, other.sign(manifest), key.pem),
    ).rejects.toMatchObject({ code: "SIGNATURE_INVALID" });
  });
});

describe("Release-Verifikation gegen den Trust Anchor", () => {
  const active = anchor.keys.find((k) => (k.status ?? "active") === "active")!;

  it("falsche Signatur unter aktiver key_id → SIGNATURE_INVALID", async () => {
    const key = fixtureKey();
    const manifest = JSON.stringify({ version: "1.0.0-rc.7", key_id: active.key_id });
    await expect(
      verifyReleaseManifest(manifest, key.sign(manifest), active.key_id),
    ).rejects.toMatchObject({ code: "SIGNATURE_INVALID" });
  });

  it("manipulierte key_id → SIGNATURE_KEY_UNTRUSTED", async () => {
    const manifest = JSON.stringify({ version: "1.0.0-rc.7", key_id: "f".repeat(32) });
    await expect(verifyReleaseManifest(manifest, "c2ln", "f".repeat(32))).rejects.toMatchObject({
      code: "SIGNATURE_KEY_UNTRUSTED",
    });
  });

  it("fehlende key_id → SIGNATURE_KEY_ID_MISSING", async () => {
    await expect(verifyReleaseManifest("{}", "c2ln", null)).rejects.toMatchObject({
      code: "SIGNATURE_KEY_ID_MISSING",
    });
  });

  it("widerrufene key_id → SIGNATURE_KEY_UNTRUSTED", async () => {
    const revoked = anchor.keys.find((k) => k.status === "revoked");
    if (!revoked) return;
    await expect(verifyReleaseManifest("{}", "c2ln", revoked.key_id)).rejects.toMatchObject({
      code: "SIGNATURE_KEY_UNTRUSTED",
    });
  });
});

describe("Override-Regeln (EYIS_RELEASE_PUBLIC_KEY)", () => {
  it("roher Schlüssel eines aktiven Anchoreintrags wird als Override akzeptiert", () => {
    const active = activeTrustKeys()[0]!;
    const raw = spkiPemToRawBase64(active.public_key)!;
    expect(matchesActiveAnchorKey(raw)).toBe(true);
  });

  it("fremder Schlüssel ist kein gültiger Override", () => {
    const key = fixtureKey();
    expect(matchesActiveAnchorKey(key.rawBase64)).toBe(false);
    expect(matchesActiveAnchorKey("")).toBe(false);
  });
});

describe("Reales Release-Format (9.9)", () => {
  it("Pack-/Release-Signatur des Workflows trägt key_id im Manifest, .sig ist Rohsignatur", () => {
    // Quelle der Wahrheit: der Release-Workflow signiert so (scripts/eyis-pack-signature.ts).
    const signer = readFileSync("scripts/eyis-pack-signature.ts", "utf8");
    // .sig = reine base64-Signatur über den Manifest-Rohtext (kein JSON, kein PEM).
    expect(signer).toContain('writeFileSync(sigPath, `${sign(null, Buffer.from(raw, "utf8"), key).toString("base64")}\\n`');
    // key_id steht im Artefakt-Manifest selbst (artifact.ts).
    const artifact = readFileSync("scripts/installer/artifact.ts", "utf8");
    expect(artifact).toContain("key_id: activeKey?.key_id ?? null");
    // Der Registry-Verifier erwartet exakt dieses Format: base64-Trim + key_id aus dem Manifest.
    const registry = readFileSync("src/lib/commerce/updates/registry.server.ts", "utf8");
    expect(registry).toContain("manifestKeyId(manifestRaw)");
    expect(registry).toContain('SIGNATURE_ASSET = "eyis-release.json.sig"');
  });

  it("kein privater Schlüssel in Laufzeit-Pfaden", () => {
    const trustAnchorModule = readFileSync("src/lib/commerce/updates/trust-anchor.ts", "utf8");
    expect(trustAnchorModule).not.toContain("PRIVATE KEY");
    const anchorDoc = readFileSync("installer/distribution/eyis-trust-anchor.json", "utf8");
    expect(anchorDoc).not.toContain("PRIVATE KEY");
    expect(anchorDoc).not.toContain("private_key");
    expect(SignatureError).toBeDefined();
  });
});
