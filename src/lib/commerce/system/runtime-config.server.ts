/**
 * Dedicated Runtime Config (Phase 23).
 *
 * Zweck: eine Dedicated-Installation liefert ihrer eigenen Storefront den
 * öffentlichen Shop-Kontext selbst aus. Damit entfällt jede manuelle
 * Konfiguration (`VITE_COMMERCE_API_URL`, `VITE_COMMERCE_PUBLISHABLE_KEY`)
 * und der Zirkelschluss „SDK braucht Key, Key existiert noch nicht".
 *
 * Sicherheitsregeln:
 *  - Es werden ausschließlich öffentliche Daten ausgeliefert. Der Publishable
 *    Key ist ein Shop-Identifikator, kein Geheimnis; jeder sensible Zugriff
 *    verlangt weiterhin einen echten Zugriffsnachweis (Cart-Token,
 *    Customer-Session, Guest-Token).
 *  - Keine Provider-Credentials, keine Secret-Referenzen, keine internen IDs.
 *  - Im Shared-Modus wird kein Key ausgeliefert.
 */
import { resolveDeploymentMode, resolveEnvironment } from "../environment";
import { getAdmin } from "../core.server";
import { STORE_API_VERSION } from "@/lib/store-sdk/types";

export const STORE_API_BASE_PATH = "/api/public/store/v1";

export type StoreRuntimeConfig = {
  deploymentMode: "dedicated" | "shared";
  apiVersion: string;
  apiBaseUrl: string;
  /** Nur im Dedicated-Modus mit geclaimter Installation gesetzt. */
  publishableKey: string | null;
  shop: {
    handle: string;
    name: string;
    locale: string;
    currencyCode: string;
  } | null;
  /** true = Installation ist noch nicht eingerichtet (kein Owner/Shop). */
  setupRequired: boolean;
};

type InstallationRuntimeRow = {
  organization_id: string | null;
  shop_id: string | null;
  storefront_key_id: string | null;
  storefront_publishable_key: string | null;
  owner_claimed_at: string | null;
};

async function loadInstallationRuntimeRow(): Promise<InstallationRuntimeRow | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("commerce_installation")
    .select("organization_id, shop_id, storefront_key_id, storefront_publishable_key, owner_claimed_at")
    .eq("singleton", true)
    .maybeSingle();
  return (data as InstallationRuntimeRow | null) ?? null;
}

/** Verknüpft Organisation und Hauptshop mit der Installation (idempotent). */
export async function linkInstallationTenant(organizationId: string, shopId: string) {
  const admin = await getAdmin();
  await admin
    .from("commerce_installation")
    .update({ organization_id: organizationId, shop_id: shopId } as never)
    .eq("singleton", true);
}

function keyEnvironment(): "test" | "live" {
  return resolveEnvironment(process.env as Record<string, string | undefined>) === "production"
    ? "live"
    : "test";
}

/**
 * Stellt sicher, dass der Hauptshop einen aktiven Publishable Key besitzt.
 * Idempotent: ein bereits hinterlegter, aktiver Key wird wiederverwendet —
 * es entsteht niemals ein zweiter Storefront-Key.
 */
export async function ensureStorefrontKey(
  organizationId: string,
  shopId: string,
): Promise<string> {
  const admin = await getAdmin();
  const row = await loadInstallationRuntimeRow();

  if (row?.storefront_key_id && row.storefront_publishable_key) {
    const { data } = await admin
      .from("store_api_keys")
      .select("id, status")
      .eq("id", row.storefront_key_id)
      .maybeSingle();
    const existing = data as { id: string; status: string } | null;
    if (existing && existing.status === "active") return row.storefront_publishable_key;
  }

  const { createKey } = await import("../store/keys.server");
  const created = await createKey({
    organizationId,
    shopId,
    name: "Storefront (Dedicated)",
    environment: keyEnvironment(),
    // Same-Origin-Storefront: die Origin ist die eigene Projekt-Origin und
    // darf sich (Preview, Staging, Custom Domain) ändern, ohne den Key zu
    // brechen. Der Key autorisiert nichts — er identifiziert nur den Shop.
    allowedOrigins: ["*"],
    actorId: null,
  });

  await admin
    .from("commerce_installation")
    .update({
      organization_id: organizationId,
      shop_id: shopId,
      storefront_key_id: created.id,
      storefront_publishable_key: created.key,
    } as never)
    .eq("singleton", true);

  return created.key;
}

/** Öffentliche Runtime-Konfiguration. Enthält niemals Secrets. */
export async function resolveStoreRuntimeConfig(): Promise<StoreRuntimeConfig> {
  const mode = resolveDeploymentMode();
  const base: StoreRuntimeConfig = {
    deploymentMode: mode,
    apiVersion: STORE_API_VERSION,
    apiBaseUrl: STORE_API_BASE_PATH,
    publishableKey: null,
    shop: null,
    setupRequired: true,
  };

  if (mode !== "dedicated") return base;

  const row = await loadInstallationRuntimeRow();
  if (!row?.owner_claimed_at || !row.organization_id || !row.shop_id) return base;

  const admin = await getAdmin();
  const { data } = await admin
    .from("shops")
    .select("name, slug, locale, currency")
    .eq("id", row.shop_id)
    .maybeSingle();
  const shop = (data ?? null) as
    | { name: string; slug: string; locale: string | null; currency: string | null }
    | null;
  if (!shop) return base;

  const publishableKey = await ensureStorefrontKey(row.organization_id, row.shop_id);

  return {
    ...base,
    publishableKey,
    shop: {
      handle: shop.slug,
      name: shop.name,
      locale: shop.locale ?? "de-DE",
      currencyCode: shop.currency ?? "EUR",
    },
    setupRequired: false,
  };
}
