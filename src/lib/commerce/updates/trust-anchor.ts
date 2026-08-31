/**
 * EYIS Trust Anchor — einzige Vertrauenswurzel für Release-Signaturen.
 *
 * Der Anchor liegt kanonisch in `installer/distribution/eyis-trust-anchor.json`
 * und gehört damit zum signierten Release-Artefakt jeder Installation. Dieses
 * Modul importiert genau diese Datei (bundler-seitig eingebettet) — es gibt
 * keine zweite gepflegte Kopie und keinen manuellen Schlüsselaustausch pro
 * Installation.
 *
 * Enthält ausschließlich öffentliche Schlüssel. Private Schlüssel gehören
 * niemals in dieses Repository oder eine Laufzeitumgebung.
 */
import anchorJson from "../../../../installer/distribution/eyis-trust-anchor.json";

export type TrustAnchorKeyEntry = {
  key_id: string;
  /** Ed25519-Schlüssel als SPKI-PEM (-----BEGIN PUBLIC KEY-----). */
  public_key: string;
  algorithm?: string;
  label?: string;
  status?: string;
};

type TrustAnchorDocument = {
  anchor?: string;
  version?: string;
  keys?: TrustAnchorKeyEntry[];
};

const anchor = anchorJson as TrustAnchorDocument;

export function trustAnchorKeys(): TrustAnchorKeyEntry[] {
  return anchor.keys ?? [];
}

export function activeTrustKeys(): TrustAnchorKeyEntry[] {
  return trustAnchorKeys().filter(
    (k) => (k.status ?? "active") === "active" && (k.algorithm ?? "ed25519") === "ed25519",
  );
}

export type TrustKeyResolution =
  | { ok: true; keyId: string; publicKeyPem: string }
  | {
      ok: false;
      code: "ANCHOR_EMPTY" | "KEY_ID_MISSING" | "KEY_UNKNOWN" | "KEY_NOT_ACTIVE" | "ALGORITHM_UNSUPPORTED";
      reason: string;
    };

/**
 * Löst eine key_id gegen den gepinnten Trust Anchor auf.
 * Ein mitgelieferter Schlüssel wird nie betrachtet — nur der Anchor zählt.
 */
export function resolveTrustKey(keyId: string | null | undefined): TrustKeyResolution {
  const keys = trustAnchorKeys();
  if (keys.length === 0) {
    return {
      ok: false,
      code: "ANCHOR_EMPTY",
      reason: "Trust Anchor enthält keinen Schlüssel — Installation unvollständig.",
    };
  }
  if (!keyId) {
    return {
      ok: false,
      code: "KEY_ID_MISSING",
      reason: "Release-Manifest nennt keine key_id — ein mitgelieferter Schlüssel wird nicht akzeptiert.",
    };
  }
  const entry = keys.find((k) => k.key_id === keyId);
  if (!entry) {
    return {
      ok: false,
      code: "KEY_UNKNOWN",
      reason: `Signaturschlüssel ${keyId} steht nicht im EYIS Trust Anchor.`,
    };
  }
  if ((entry.status ?? "active") !== "active") {
    return {
      ok: false,
      code: "KEY_NOT_ACTIVE",
      reason: `Signaturschlüssel ${keyId} ist ${entry.status}.`,
    };
  }
  if ((entry.algorithm ?? "ed25519") !== "ed25519") {
    return {
      ok: false,
      code: "ALGORITHM_UNSUPPORTED",
      reason: `Nicht unterstützter Algorithmus ${entry.algorithm}.`,
    };
  }
  return { ok: true, keyId: entry.key_id, publicKeyPem: entry.public_key };
}

/**
 * Roher 32-Byte-Ed25519-Schlüssel (base64) eines SPKI-PEM — für Vergleiche
 * mit konfigurierten Override-Schlüsseln (die roh base64 vorliegen).
 */
export function spkiPemToRawBase64(pem: string): string | null {
  const match = pem.match(/-----BEGIN PUBLIC KEY-----([\s\S]*?)-----END PUBLIC KEY-----/);
  if (!match) return null;
  const der = match[1].replace(/\s+/g, "");
  try {
    const binary = atob(der);
    // Ed25519 SPKI: 12-Byte-Header (302a300506032b6570032100) + 32-Byte-Schlüssel.
    if (binary.length !== 44) return null;
    return btoa(binary.slice(12));
  } catch {
    return null;
  }
}

/**
 * true, wenn `rawBase64Key` einem aktiven Anchorschlüssel entspricht.
 * Grundlage der Override-Regel: eine Env-Konfiguration darf niemals einen
 * Schlüssel einführen, den der Anchor nicht kennt.
 */
export function matchesActiveAnchorKey(rawBase64Key: string): boolean {
  const normalized = rawBase64Key.trim();
  if (!normalized) return false;
  return activeTrustKeys().some((k) => spkiPemToRawBase64(k.public_key) === normalized);
}
