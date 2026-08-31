/**
 * Signatur- und Prüfsummenverifikation für Release-Manifeste.
 *
 * Ed25519 über WebCrypto (im Worker-Runtime und in Node 20+ verfügbar).
 * Kein Fallback auf "ungeprüft": ohne vertrauenswürdigen öffentlichen
 * Schlüssel gibt es kein gültiges Manifest.
 *
 * rc.6: Vertrauenswurzel ist ausschließlich der gepinnte EYIS Trust Anchor
 * (`installer/distribution/eyis-trust-anchor.json`, mitgeliefert mit jeder
 * Installation). `verifyReleaseManifest` löst die key_id des Release-
 * Manifests gegen den Anchor auf — genau das reale Signaturformat des
 * Release-Workflows (eyis-release.json trägt key_id, eyis-release.json.sig
 * trägt die reine base64-Signatur über den Manifest-Rohtext).
 */

import { resolveTrustKey } from "./trust-anchor";

export class SignatureError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "SignatureError";
    this.code = code;
  }
}

export function base64ToBytes(input: string): Uint8Array {
  const normalized = input.trim().replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(normalized);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function sha256Hex(data: ArrayBuffer | Uint8Array | string): Promise<string> {
  const buffer =
    typeof data === "string"
      ? new TextEncoder().encode(data)
      : data instanceof Uint8Array
        ? data
        : new Uint8Array(data);
  const digest = await crypto.subtle.digest("SHA-256", buffer as unknown as BufferSource);
  return bytesToHex(new Uint8Array(digest));
}

/**
 * Ed25519-Schlüssel importieren — roh (32 Byte, base64) oder SPKI-PEM,
 * das Format des Trust Anchors.
 */
async function importEd25519Key(publicKey: string): Promise<CryptoKey> {
  const pem = publicKey.match(/-----BEGIN PUBLIC KEY-----([\s\S]*?)-----END PUBLIC KEY-----/);
  try {
    if (pem) {
      return await crypto.subtle.importKey(
        "spki",
        base64ToBytes(pem[1]) as unknown as BufferSource,
        { name: "Ed25519" },
        false,
        ["verify"],
      );
    }
    return await crypto.subtle.importKey(
      "raw",
      base64ToBytes(publicKey) as unknown as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  } catch {
    throw new SignatureError(
      "SIGNATURE_KEY_INVALID",
      "Release-Signaturschlüssel konnte nicht geladen werden (Ed25519, roh base64 oder SPKI-PEM).",
    );
  }
}

/**
 * Prüft eine Ed25519-Signatur über den Manifest-Rohtext.
 * `publicKey` ist der rohe 32-Byte-Schlüssel (base64) oder SPKI-PEM.
 *
 * Low-level: Der Aufrufer ist für die Vertrauensentscheidung zuständig
 * (Trust Anchor bzw. geprüfter Override). Für Release-Manifeste immer
 * `verifyReleaseManifest` verwenden.
 */
export async function verifyManifestSignature(
  manifestRaw: string,
  signatureBase64: string,
  publicKey: string,
): Promise<void> {
  if (!publicKey) {
    throw new SignatureError("SIGNATURE_KEY_MISSING", "Kein Release-Signaturschlüssel konfiguriert.");
  }
  if (!signatureBase64) {
    throw new SignatureError("SIGNATURE_MISSING", "Release-Manifest ist nicht signiert.");
  }
  const key = await importEd25519Key(publicKey);
  const ok = await crypto.subtle.verify(
    { name: "Ed25519" },
    key,
    base64ToBytes(signatureBase64) as unknown as BufferSource,
    new TextEncoder().encode(manifestRaw) as unknown as BufferSource,
  );
  if (!ok) {
    throw new SignatureError("SIGNATURE_INVALID", "Release-Signatur ist ungültig.");
  }
}

/**
 * Verifiziert ein Release-Manifest gegen den gepinnten Trust Anchor.
 *
 * - `manifestRaw` wird als exakte Bytefolge geprüft — JSON wird niemals vor
 *   der Signaturprüfung neu serialisiert.
 * - `key_id` stammt aus dem Manifest und wählt nur den Prüfschlüssel;
 *   Vertrauen entsteht ausschließlich über den Anchor (aktiv, ed25519).
 * - `signatureBase64` ist der Inhalt von eyis-release.json.sig (getrimmt).
 */
export async function verifyReleaseManifest(
  manifestRaw: string,
  signatureBase64: string,
  keyId: string | null | undefined,
): Promise<void> {
  const resolved = resolveTrustKey(keyId);
  if (!resolved.ok) {
    const code =
      resolved.code === "ANCHOR_EMPTY"
        ? "REGISTRY_SETUP_REQUIRED"
        : resolved.code === "KEY_ID_MISSING"
          ? "SIGNATURE_KEY_ID_MISSING"
          : resolved.code === "ALGORITHM_UNSUPPORTED"
            ? "SIGNATURE_ALGORITHM_UNSUPPORTED"
            : "SIGNATURE_KEY_UNTRUSTED";
    throw new SignatureError(code, resolved.reason);
  }
  await verifyManifestSignature(manifestRaw, signatureBase64, resolved.publicKeyPem);
}

/** Prüft die SHA-256-Prüfsumme eines Artefakts. */
export async function assertChecksum(bytes: Uint8Array, expectedHex: string): Promise<void> {
  const actual = await sha256Hex(bytes);
  if (actual.toLowerCase() !== expectedHex.trim().toLowerCase()) {
    throw new SignatureError("CHECKSUM_MISMATCH", "Prüfsumme des Release-Artefakts stimmt nicht.");
  }
}
