/**
 * libsodium "sealed box" (crypto_box_seal) für GitHub-Actions-Secrets.
 *
 * GitHub verlangt genau dieses Format. Umgesetzt mit reinem JavaScript
 * (tweetnacl + blakejs), damit es im Edge-Runtime läuft. Der Klartext bleibt
 * lokal in dieser Funktion und wird nirgends geloggt oder zurückgegeben.
 */
import nacl from "tweetnacl";
import { blake2b } from "blakejs";

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) out[i] = binary.charCodeAt(i);
  return out;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

/** Verschlüsselt `value` für den Base64-Public-Key des Repositories. */
export function sealSecret(value: string, publicKeyBase64: string): string {
  const recipient = fromBase64(publicKeyBase64);
  if (recipient.length !== 32) throw new Error("INVALID_REPO_PUBLIC_KEY");
  const ephemeral = nacl.box.keyPair();
  const nonce = blake2b(
    Uint8Array.from([...ephemeral.publicKey, ...recipient]),
    undefined,
    24,
  ) as Uint8Array;
  const message = new TextEncoder().encode(value);
  const cipher = nacl.box(message, nonce, recipient, ephemeral.secretKey);
  return toBase64(Uint8Array.from([...ephemeral.publicKey, ...cipher]));
}
