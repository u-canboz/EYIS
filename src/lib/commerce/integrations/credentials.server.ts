/**
 * Zugangsdaten-Tresor für externe Anbieter (server-only).
 *
 * Regeln:
 * - Klartext-Zugangsdaten verlassen niemals den Server. Gespeichert wird
 *   ausschließlich AES-256-GCM-Chiffrat; entschlüsselt wird nur innerhalb von
 *   Server-Handlern direkt vor dem Anbieteraufruf.
 * - Der Tresor ist mandantengebunden (organization_id + shop_id) und nur über
 *   den Service-Role-Client erreichbar (keine RLS-Policy, keine Grants).
 * - Nach außen gehen nur maskierte Hinweise (letzte vier Zeichen).
 */
import { getAdmin } from "../core.server";
import type { IntegrationCategory } from "./registry";

export type CredentialScope = {
  organizationId: string;
  shopId: string;
  category: IntegrationCategory;
  provider: string;
  environment: "test" | "live";
};

export type CredentialHints = Record<string, string>;

const encoder = new TextEncoder();
const decoder = new TextDecoder();

async function aesKey(): Promise<CryptoKey> {
  const raw = process.env["PROVIDER_CREDENTIALS_KEY"];
  if (!raw || raw.length < 16)
    throw new Error(
      "Der Schlüssel für den Zugangsdaten-Tresor ist nicht konfiguriert. Zugangsdaten können nicht gespeichert werden.",
    );
  const digest = await crypto.subtle.digest("SHA-256", encoder.encode(raw));
  return crypto.subtle.importKey("raw", digest, { name: "AES-GCM" }, false, [
    "encrypt",
    "decrypt",
  ]);
}

function toBase64(bytes: Uint8Array) {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string) {
  const binary = atob(value);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) out[i] = binary.charCodeAt(i);
  return out;
}

/** Maskierter Hinweis: nur die letzten vier Zeichen bleiben sichtbar. */
export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= 4) return "••••";
  return `••••${trimmed.slice(-4)}`;
}

export function referenceFor(scope: CredentialScope): string {
  return `cred:${scope.shopId}:${scope.category}:${scope.provider}:${scope.environment}`;
}

/**
 * Legt Zugangsdaten verschlüsselt ab und gibt nur Referenz und maskierte
 * Hinweise zurück. Leere Felder werden verworfen.
 */
export async function storeCredentials(input: {
  scope: CredentialScope;
  values: Record<string, string | null | undefined>;
  maskedFields?: string[];
}): Promise<{ reference: string; hints: CredentialHints }> {
  const clean: Record<string, string> = {};
  for (const [key, value] of Object.entries(input.values)) {
    const trimmed = (value ?? "").trim();
    if (trimmed) clean[key] = trimmed;
  }
  if (Object.keys(clean).length === 0) throw new Error("Keine Zugangsdaten übergeben.");

  const key = await aesKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoder.encode(JSON.stringify(clean)),
  );

  const hints: CredentialHints = {};
  for (const field of input.maskedFields ?? Object.keys(clean)) {
    const value = clean[field];
    if (value) hints[field] = maskSecret(value);
  }

  const reference = referenceFor(input.scope);
  const admin = await getAdmin();
  const { error } = await admin.from("provider_credentials").upsert(
    {
      organization_id: input.scope.organizationId,
      shop_id: input.scope.shopId,
      category: input.scope.category,
      provider: input.scope.provider,
      environment: input.scope.environment,
      reference,
      ciphertext: toBase64(new Uint8Array(cipher)),
      iv: toBase64(iv),
      hints: hints as never,
      status: "active",
    } as never,
    { onConflict: "shop_id,category,provider,environment" },
  );
  if (error) throw new Error(error.message);
  return { reference, hints };
}

async function decryptRow(row: Record<string, unknown>): Promise<Record<string, string>> {
  const key = await aesKey();
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(String(row["iv"])) },
    key,
    fromBase64(String(row["ciphertext"])),
  );
  return JSON.parse(decoder.decode(plain)) as Record<string, string>;
}

/** Entschlüsselte Zugangsdaten eines Shops — nur innerhalb von Server-Handlern. */
export async function loadCredentials(
  scope: CredentialScope,
): Promise<Record<string, string> | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("provider_credentials")
    .select("ciphertext, iv")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .eq("category", scope.category)
    .eq("provider", scope.provider)
    .eq("environment", scope.environment)
    .eq("status", "active")
    .maybeSingle();
  if (!data) return null;
  return decryptRow(data as Record<string, unknown>);
}

/** Alle aktiven Zugangsdaten eines Anbieters — für Webhook-Auflösung. */
export async function loadCredentialsForProvider(
  category: IntegrationCategory,
  provider: string,
): Promise<
  { organizationId: string; shopId: string; environment: "test" | "live"; values: Record<string, string> }[]
> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("provider_credentials")
    .select("organization_id, shop_id, environment, ciphertext, iv")
    .eq("category", category)
    .eq("provider", provider)
    .eq("status", "active");
  const rows = (data ?? []) as Record<string, unknown>[];
  const out: Awaited<ReturnType<typeof loadCredentialsForProvider>> = [];
  for (const row of rows) {
    try {
      out.push({
        organizationId: String(row["organization_id"]),
        shopId: String(row["shop_id"]),
        environment: row["environment"] === "live" ? "live" : "test",
        values: await decryptRow(row),
      });
    } catch {
      /* Schlüsselwechsel o. Ä.: Eintrag überspringen, niemals Details loggen. */
    }
  }
  return out;
}

/** Nur maskierte Hinweise — sicher für die Oberfläche. */
export async function credentialHints(
  scope: Omit<CredentialScope, "environment"> & { environment?: "test" | "live" },
): Promise<{ environment: "test" | "live"; hints: CredentialHints; updatedAt: string } | null> {
  const admin = await getAdmin();
  let query = admin
    .from("provider_credentials")
    .select("environment, hints, updated_at")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .eq("category", scope.category)
    .eq("provider", scope.provider)
    .eq("status", "active");
  if (scope.environment) query = query.eq("environment", scope.environment);
  const { data } = await query.order("updated_at", { ascending: false }).limit(1);
  const row = (data ?? [])[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  return {
    environment: row["environment"] === "live" ? "live" : "test",
    hints: (row["hints"] as CredentialHints) ?? {},
    updatedAt: String(row["updated_at"]),
  };
}

/** Entfernt Zugangsdaten vollständig (Disconnect). */
export async function revokeCredentials(
  scope: Omit<CredentialScope, "environment">,
): Promise<void> {
  const admin = await getAdmin();
  await admin
    .from("provider_credentials")
    .delete()
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .eq("category", scope.category)
    .eq("provider", scope.provider);
}
