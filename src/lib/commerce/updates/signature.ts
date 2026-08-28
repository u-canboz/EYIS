/**
 * Signatur- und Prüfsummenverifikation für Release-Manifeste.
 *
 * Ed25519 über WebCrypto (im Worker-Runtime und in Node 20+ verfügbar).
 * Kein Fallback auf "ungeprüft": ohne öffentlichen Schlüssel gibt es kein
 * gültiges Manifest.
 */

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
 * Prüft eine Ed25519-Signatur über den Manifest-Rohtext.
 * `publicKeyBase64` ist der rohe 32-Byte-Schlüssel (base64).
 */
export async function verifyManifestSignature(
  manifestRaw: string,
  signatureBase64: string,
  publicKeyBase64: string,
): Promise<void> {
  if (!publicKeyBase64) {
    throw new SignatureError("SIGNATURE_KEY_MISSING", "Kein Release-Signaturschlüssel konfiguriert.");
  }
  if (!signatureBase64) {
    throw new SignatureError("SIGNATURE_MISSING", "Release-Manifest ist nicht signiert.");
  }
  let key: CryptoKey;
  try {
    key = await crypto.subtle.importKey(
      "raw",
      base64ToBytes(publicKeyBase64) as unknown as BufferSource,
      { name: "Ed25519" },
      false,
      ["verify"],
    );
  } catch {
    throw new SignatureError(
      "SIGNATURE_KEY_INVALID",
      "Release-Signaturschlüssel konnte nicht geladen werden (Ed25519, roh, base64 erwartet).",
    );
  }
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

/** Prüft die SHA-256-Prüfsumme eines Artefakts. */
export async function assertChecksum(bytes: Uint8Array, expectedHex: string): Promise<void> {
  const actual = await sha256Hex(bytes);
  if (actual.toLowerCase() !== expectedHex.trim().toLowerCase()) {
    throw new SignatureError("CHECKSUM_MISMATCH", "Prüfsumme des Release-Artefakts stimmt nicht.");
  }
}
