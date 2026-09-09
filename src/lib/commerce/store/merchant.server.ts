/**
 * Direkte Anbindung an das Google Merchant Center (Content API for Shopping v2.1).
 *
 * - OAuth-Zugangsdaten liegen ausschließlich verschlüsselt im Zugangsdaten-Tresor.
 * - Produkte werden aus derselben Quelle wie der Datei-Feed erzeugt.
 * - Jeder Lauf wird protokolliert, fehlerhafte Artikel landen einzeln in der Fehlerliste.
 */
import { getAdmin } from "../core.server";
import type { CredentialScope } from "../integrations/credentials.server";
import { collectFeedItems, type FeedItem, type FeedSummary } from "./feed.server";

type Row = Record<string, unknown>;

const OAUTH_SCOPE = "https://www.googleapis.com/auth/content";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CONTENT_API = "https://shoppingcontent.googleapis.com/content/v2.1";
const BATCH_SIZE = 50;

export type MerchantConnection = {
  id: string;
  organizationId: string;
  shopId: string;
  provider: string;
  merchantId: string | null;
  accountLabel: string | null;
  status: "not_connected" | "connected" | "error";
  autoSync: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
};

export type MerchantSyncRun = {
  id: string;
  status: string;
  triggerSource: string;
  itemsTotal: number;
  itemsOk: number;
  itemsFailed: number;
  message: string | null;
  startedAt: string;
  finishedAt: string | null;
};

export type MerchantSyncError = {
  id: string;
  offerId: string | null;
  productTitle: string | null;
  code: string | null;
  message: string;
  createdAt: string;
};

function scopeFor(connection: {
  organizationId: string;
  shopId: string;
}): CredentialScope {
  return {
    organizationId: connection.organizationId,
    shopId: connection.shopId,
    category: "marketing" as CredentialScope["category"],
    provider: "google_merchant",
    environment: "live",
  };
}

function rowToConnection(row: Row): MerchantConnection {
  return {
    id: row["id"] as string,
    organizationId: row["organization_id"] as string,
    shopId: row["shop_id"] as string,
    provider: row["provider"] as string,
    merchantId: (row["merchant_id"] as string | null) ?? null,
    accountLabel: (row["account_label"] as string | null) ?? null,
    status: (row["status"] as MerchantConnection["status"]) ?? "not_connected",
    autoSync: Boolean(row["auto_sync"]),
    lastSyncAt: (row["last_sync_at"] as string | null) ?? null,
    lastError: (row["last_error"] as string | null) ?? null,
  };
}

function oauthClient(): { clientId: string; clientSecret: string } {
  const clientId = process.env["GOOGLE_MERCHANT_CLIENT_ID"];
  const clientSecret = process.env["GOOGLE_MERCHANT_CLIENT_SECRET"];
  if (!clientId || !clientSecret)
    throw new Error(
      "Die Google-Zugangsdaten für das Merchant Center sind nicht hinterlegt. Bitte Client-ID und Client-Secret eintragen.",
    );
  return { clientId, clientSecret };
}

/* ------------------------------------------------------------ Verbindungen */

export async function getConnection(
  organizationId: string,
  shopId: string,
): Promise<MerchantConnection | null> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("merchant_connections")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .eq("provider", "google_merchant")
    .maybeSingle();
  return data ? rowToConnection(data as Row) : null;
}

export async function upsertConnection(input: {
  organizationId: string;
  shopId: string;
  merchantId?: string | null;
  accountLabel?: string | null;
  autoSync?: boolean;
  status?: MerchantConnection["status"];
  lastError?: string | null;
}): Promise<MerchantConnection> {
  const admin = await getAdmin();
  const existing = await getConnection(input.organizationId, input.shopId);
  const payload: Row = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    provider: "google_merchant",
    merchant_id: input.merchantId ?? existing?.merchantId ?? null,
    account_label: input.accountLabel ?? existing?.accountLabel ?? null,
    auto_sync: input.autoSync ?? existing?.autoSync ?? false,
    status: input.status ?? existing?.status ?? "not_connected",
    last_error: input.lastError === undefined ? (existing?.lastError ?? null) : input.lastError,
    updated_at: new Date().toISOString(),
  };
  if (existing) {
    const { error } = await admin
      .from("merchant_connections")
      .update(payload as never)
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return { ...existing, ...rowToConnection({ ...payload, id: existing.id }) };
  }
  const { data, error } = await admin
    .from("merchant_connections")
    .insert(payload as never)
    .select("*")
    .single();
  if (error) throw new Error(error.message);
  return rowToConnection(data as Row);
}

export async function disconnect(input: {
  organizationId: string;
  shopId: string;
}): Promise<{ ok: true }> {
  const { revokeCredentials } = await import("../integrations/credentials.server");
  await revokeCredentials(scopeFor(input)).catch(() => undefined);
  await upsertConnection({
    ...input,
    status: "not_connected",
    autoSync: false,
    lastError: null,
  });
  return { ok: true };
}

/* -------------------------------------------------------------------- OAuth */

export function authorizationUrl(input: { redirectUri: string; state: string }): string {
  const { clientId } = oauthClient();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", input.redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", OAUTH_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("include_granted_scopes", "true");
  url.searchParams.set("state", input.state);
  return url.toString();
}

export async function completeAuthorization(input: {
  organizationId: string;
  shopId: string;
  code: string;
  redirectUri: string;
}): Promise<MerchantConnection> {
  const { clientId, clientSecret } = oauthClient();
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code: input.code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: input.redirectUri,
      grant_type: "authorization_code",
    }),
  });
  const payload = (await response.json()) as {
    access_token?: string;
    refresh_token?: string;
    expires_in?: number;
    error_description?: string;
  };
  if (!response.ok || !payload.refresh_token) {
    throw new Error(
      payload.error_description ??
        "Google hat keinen dauerhaften Zugang zurückgegeben. Bitte die Freigabe erneut erteilen.",
    );
  }
  const { storeCredentials } = await import("../integrations/credentials.server");
  await storeCredentials({
    scope: scopeFor(input),
    values: { refresh_token: payload.refresh_token },
    maskedFields: ["refresh_token"],
  });
  return upsertConnection({
    organizationId: input.organizationId,
    shopId: input.shopId,
    status: "connected",
    lastError: null,
  });
}

async function accessToken(connection: MerchantConnection): Promise<string> {
  const { clientId, clientSecret } = oauthClient();
  const { loadCredentials } = await import("../integrations/credentials.server");
  const stored = await loadCredentials(scopeFor(connection));
  const refresh = stored?.["refresh_token"];
  if (!refresh) throw new Error("Das Google-Konto ist nicht verbunden.");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: refresh,
      grant_type: "refresh_token",
    }),
  });
  const payload = (await response.json()) as { access_token?: string; error_description?: string };
  if (!response.ok || !payload.access_token)
    throw new Error(payload.error_description ?? "Der Google-Zugang konnte nicht erneuert werden.");
  return payload.access_token;
}

/* ------------------------------------------------------------ Übertragung */

function toGoogleProduct(item: FeedItem, contentLanguage: string, targetCountry: string) {
  const [price, currency] = (item.price ?? "").split(" ");
  const sale = (item.salePrice ?? "").split(" ");
  return {
    offerId: item.id,
    title: item.title.slice(0, 150),
    description: (item.description || item.title).slice(0, 5000),
    link: item.link,
    imageLink: item.imageLink ?? undefined,
    additionalImageLinks: item.additionalImageLinks.slice(0, 10),
    contentLanguage,
    targetCountry,
    channel: "online",
    availability: item.availability,
    condition: item.condition,
    brand: item.brand ?? undefined,
    gtin: item.gtin ?? undefined,
    mpn: item.mpn ?? undefined,
    itemGroupId: item.itemGroupId,
    productTypes: item.productType ? [item.productType] : undefined,
    googleProductCategory: item.googleProductCategory ?? undefined,
    price: price && currency ? { value: price, currency } : undefined,
    salePrice: sale[0] && sale[1] ? { value: sale[0], currency: sale[1] } : undefined,
  };
}

function syntheticFeed(connection: MerchantConnection): FeedSummary {
  return {
    id: connection.id,
    organizationId: connection.organizationId,
    shopId: connection.shopId,
    format: "google_shopping_xml",
    name: "Google Merchant Center",
    status: "active",
    baseUrl: null,
    defaultBrand: null,
    includeOutOfStock: true,
    tokenPrefix: "",
    lastDownloadedAt: null,
    lastItemCount: null,
    createdAt: new Date().toISOString(),
  };
}

/** Überträgt den vollständigen Katalog ins Merchant Center. */
export async function syncNow(input: {
  organizationId: string;
  shopId: string;
  requestOrigin: string;
  triggerSource: "manual" | "schedule";
  contentLanguage?: string;
  targetCountry?: string;
}): Promise<{ runId: string; itemsOk: number; itemsFailed: number }> {
  const admin = await getAdmin();
  const connection = await getConnection(input.organizationId, input.shopId);
  if (!connection || connection.status === "not_connected")
    throw new Error("Es ist kein Google-Merchant-Konto verbunden.");
  if (!connection.merchantId)
    throw new Error("Die Händler-ID des Merchant Centers fehlt.");

  const { data: runRow, error: runError } = await admin
    .from("merchant_sync_runs")
    .insert({
      organization_id: input.organizationId,
      shop_id: input.shopId,
      connection_id: connection.id,
      status: "running",
      trigger_source: input.triggerSource,
      items_total: 0,
      items_ok: 0,
      items_failed: 0,
    } as never)
    .select("id")
    .single();
  if (runError) throw new Error(runError.message);
  const runId = (runRow as Row)["id"] as string;

  const finish = async (
    status: string,
    counts: { total: number; ok: number; failed: number },
    message: string | null,
  ) => {
    await admin
      .from("merchant_sync_runs")
      .update({
        status,
        items_total: counts.total,
        items_ok: counts.ok,
        items_failed: counts.failed,
        message,
        finished_at: new Date().toISOString(),
      } as never)
      .eq("id", runId);
    await upsertConnection({
      organizationId: input.organizationId,
      shopId: input.shopId,
      status: status === "failed" ? "error" : "connected",
      lastError: status === "failed" ? message : null,
    });
    await admin
      .from("merchant_connections")
      .update({ last_sync_at: new Date().toISOString() } as never)
      .eq("id", connection.id);
  };

  try {
    const token = await accessToken(connection);
    const { items } = await collectFeedItems(syntheticFeed(connection), input.requestOrigin);
    const language = (input.contentLanguage ?? "de").slice(0, 2);
    const country = (input.targetCountry ?? "DE").slice(0, 2).toUpperCase();

    let ok = 0;
    let failed = 0;
    for (let offset = 0; offset < items.length; offset += BATCH_SIZE) {
      const chunk = items.slice(offset, offset + BATCH_SIZE);
      const entries = chunk.map((item, index) => ({
        batchId: offset + index + 1,
        merchantId: Number(connection.merchantId),
        method: "insert",
        product: toGoogleProduct(item, language, country),
      }));
      const response = await fetch(`${CONTENT_API}/products/batch`, {
        method: "POST",
        headers: {
          authorization: `Bearer ${token}`,
          "content-type": "application/json",
        },
        body: JSON.stringify({ entries }),
      });
      const payload = (await response.json()) as {
        entries?: { batchId: number; errors?: { message?: string; errors?: { reason?: string; message?: string }[] } }[];
        error?: { message?: string };
      };
      if (!response.ok) throw new Error(payload.error?.message ?? "Google hat die Übertragung abgelehnt.");
      for (const entry of payload.entries ?? []) {
        const item = chunk[entry.batchId - offset - 1];
        if (!entry.errors) {
          ok += 1;
          continue;
        }
        failed += 1;
        const detail = entry.errors.errors?.[0];
        await admin.from("merchant_sync_errors").insert({
          organization_id: input.organizationId,
          run_id: runId,
          offer_id: item?.id ?? null,
          product_title: item?.title ?? null,
          code: detail?.reason ?? null,
          message: detail?.message ?? entry.errors.message ?? "Unbekannter Fehler von Google.",
        } as never);
      }
    }

    await finish(failed === 0 ? "completed" : "partially_completed", {
      total: items.length,
      ok,
      failed,
    }, failed === 0 ? null : `${failed} Artikel wurden abgelehnt.`);
    return { runId, itemsOk: ok, itemsFailed: failed };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unbekannter Fehler.";
    await finish("failed", { total: 0, ok: 0, failed: 0 }, message);
    throw new Error(message);
  }
}

/* --------------------------------------------------------------- Protokoll */

export async function listSyncRuns(
  organizationId: string,
  shopId: string,
  limit = 20,
): Promise<MerchantSyncRun[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("merchant_sync_runs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("started_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map((row) => ({
    id: row["id"] as string,
    status: row["status"] as string,
    triggerSource: row["trigger_source"] as string,
    itemsTotal: Number(row["items_total"] ?? 0),
    itemsOk: Number(row["items_ok"] ?? 0),
    itemsFailed: Number(row["items_failed"] ?? 0),
    message: (row["message"] as string | null) ?? null,
    startedAt: row["started_at"] as string,
    finishedAt: (row["finished_at"] as string | null) ?? null,
  }));
}

export async function listSyncErrors(
  organizationId: string,
  runId: string,
  limit = 100,
): Promise<MerchantSyncError[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("merchant_sync_errors")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("run_id", runId)
    .order("created_at", { ascending: false })
    .limit(limit);
  return ((data ?? []) as Row[]).map((row) => ({
    id: row["id"] as string,
    offerId: (row["offer_id"] as string | null) ?? null,
    productTitle: (row["product_title"] as string | null) ?? null,
    code: (row["code"] as string | null) ?? null,
    message: row["message"] as string,
    createdAt: row["created_at"] as string,
  }));
}

/** Alle Shops mit aktivem Auto-Sync — für den täglichen Job. */
export async function connectionsForAutoSync(): Promise<MerchantConnection[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("merchant_connections")
    .select("*")
    .eq("provider", "google_merchant")
    .eq("status", "connected")
    .eq("auto_sync", true);
  return ((data ?? []) as Row[]).map(rowToConnection);
}
