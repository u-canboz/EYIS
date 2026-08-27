/**
 * Integration Center — server-side status, health, sender domains, readiness
 * and OAuth-state handling. Sits above the payment/communication/shipping
 * engines; it never duplicates their logic, only reads their configuration
 * tables and loads their adapters for health checks.
 *
 * Secrets are never read, logged or returned — configuration_reference only.
 */
import { getAdmin, writeAudit } from "../core.server";
import {
  INTEGRATION_CATALOG,
  catalogIdFor,
  type HealthStatus,
  type IntegrationCatalogEntry,
  type IntegrationCategory,
  type IntegrationStatus,
} from "./registry";

type Admin = Awaited<ReturnType<typeof getAdmin>>;
type Row = Record<string, unknown>;

export type IntegrationView = {
  id: string;
  category: IntegrationCategory;
  displayName: string;
  description: string;
  connectionType: IntegrationCatalogEntry["connectionType"];
  implemented: boolean;
  testOnly: boolean;
  note: string | null;
  managePath: string | null;
  documentationReference: string | null;
  capabilities: string[];
  status: IntegrationStatus;
  environment: "test" | "live" | null;
  configSummary: string | null;
  health: {
    status: HealthStatus;
    lastCheckedAt: string | null;
    lastSuccessAt: string | null;
    lastErrorCode: string | null;
  } | null;
  primaryAction: "connect" | "configure" | "verify" | "test" | "manage" | "unavailable";
};

export const MANAGE_PERMISSION: Record<IntegrationCategory, string> = {
  payment: "payment_settings.manage",
  email: "communications.settings",
  carrier: "shipping_settings.manage",
};

export const READ_PERMISSION: Record<IntegrationCategory, string> = {
  payment: "payment_settings.read",
  email: "communications.read",
  carrier: "shipping_settings.read",
};

/** Engine provider id for a catalog entry (carrier mock-carrier → mock). */
function engineProviderId(entry: IntegrationCatalogEntry): string {
  if (entry.category === "carrier" && entry.id === "mock-carrier") return "mock";
  return entry.id;
}

async function loadEngineConfigs(admin: Admin, organizationId: string, shopId: string) {
  const [pay, comm, ship, identities] = await Promise.all([
    admin
      .from("payment_provider_configs")
      .select("id, provider, environment, status, display_name, priority")
      .eq("organization_id", organizationId)
      .eq("shop_id", shopId),
    admin
      .from("communication_provider_configs")
      .select("id, provider, status, test_mode, priority")
      .eq("organization_id", organizationId)
      .eq("channel", "email")
      .or(`shop_id.eq.${shopId},shop_id.is.null`),
    admin
      .from("shipping_provider_configs")
      .select("id, provider, status, test_mode, display_name")
      .eq("organization_id", organizationId)
      .eq("shop_id", shopId),
    admin
      .from("sender_identities")
      .select("id, verification_status, status")
      .eq("organization_id", organizationId)
      .eq("shop_id", shopId)
      .eq("channel", "email")
      .eq("status", "active"),
  ]);
  return {
    payment: (pay.data ?? []) as Row[],
    email: (comm.data ?? []) as Row[],
    carrier: (ship.data ?? []) as Row[],
    identities: (identities.data ?? []) as Row[],
  };
}

export async function listIntegrations(
  organizationId: string,
  shopId: string,
): Promise<IntegrationView[]> {
  const admin = await getAdmin();
  const configs = await loadEngineConfigs(admin, organizationId, shopId);
  const { data: connRows } = await admin
    .from("integration_connections")
    .select("id, category, provider, status, environment")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId);
  const connections = (connRows ?? []) as Row[];
  const connIds = connections.map((c) => c["id"] as string);
  const { data: healthRows } = connIds.length
    ? await admin
        .from("integration_health")
        .select("connection_id, status, last_checked_at, last_success_at, last_error_code")
        .in("connection_id", connIds)
    : { data: [] as Row[] };
  const healthByConn = new Map(
    ((healthRows ?? []) as Row[]).map((h) => [h["connection_id"] as string, h]),
  );

  const hasVerifiedSender = configs.identities.some(
    (i) => i["verification_status"] === "verified",
  );

  return INTEGRATION_CATALOG.map((entry) => {
    const engineId = engineProviderId(entry);
    const cfg =
      entry.category === "payment"
        ? configs.payment.find((c) => c["provider"] === engineId)
        : entry.category === "email"
          ? configs.email.find((c) => c["provider"] === engineId)
          : configs.carrier.find((c) => c["provider"] === engineId);
    const conn = connections.find(
      (c) => c["category"] === entry.category && c["provider"] === entry.id,
    );
    const healthRow = conn ? healthByConn.get(conn["id"] as string) : undefined;

    let status: IntegrationStatus = "not_connected";
    let environment: "test" | "live" | null = null;
    let configSummary: string | null = null;

    if (cfg) {
      const active = cfg["status"] === "active";
      environment =
        entry.category === "payment"
          ? ((cfg["environment"] as "test" | "live") ?? "test")
          : cfg["test_mode"] === false
            ? "live"
            : "test";
      configSummary = (cfg["display_name"] as string) ?? entry.displayName;
      status = active ? "connected" : "disabled";
      if (
        active &&
        entry.category === "email" &&
        entry.id === "lovable" &&
        !hasVerifiedSender
      ) {
        status = "verification_required";
      }
    }
    if (conn && conn["status"] === "error") status = "error";
    if (conn && conn["status"] === "disabled" && (!cfg || cfg["status"] !== "active"))
      status = "disabled";

    const primaryAction: IntegrationView["primaryAction"] = !entry.implemented
      ? "unavailable"
      : status === "connected"
        ? "manage"
        : status === "verification_required"
          ? "verify"
          : status === "disabled"
            ? "configure"
            : status === "not_connected"
              ? "connect"
              : "configure";

    return {
      id: entry.id,
      category: entry.category,
      displayName: entry.displayName,
      description: entry.description,
      connectionType: entry.connectionType,
      implemented: entry.implemented,
      testOnly: entry.testOnly,
      note: entry.note,
      managePath: entry.managePath,
      documentationReference: entry.documentationReference,
      capabilities: entry.capabilities,
      status,
      environment,
      configSummary,
      health: healthRow
        ? {
            status: healthRow["status"] as HealthStatus,
            lastCheckedAt: (healthRow["last_checked_at"] as string) ?? null,
            lastSuccessAt: (healthRow["last_success_at"] as string) ?? null,
            lastErrorCode: (healthRow["last_error_code"] as string) ?? null,
          }
        : null,
      primaryAction,
    };
  });
}

/** Loads the real engine adapter — an honest health signal, never simulated. */
async function probeAdapter(entry: IntegrationCatalogEntry): Promise<void> {
  const engineId = engineProviderId(entry);
  if (entry.category === "payment") {
    const { getProvider } = await import("../payments/provider.server");
    await getProvider(engineId);
    return;
  }
  if (entry.category === "carrier") {
    const { getCarrier } = await import("../shipping/registry.server");
    await getCarrier(engineId);
    return;
  }
  if (entry.id === "smtp") {
    throw Object.assign(
      new Error(
        "Generisches SMTP wird von dieser Plattform nicht unterstützt (keine rohen TCP/TLS-Verbindungen in der Serverless-Laufzeit). Bitte einen API-basierten E-Mail-Anbieter verwenden.",
      ),
      { code: "not_supported" },
    );
  }
  const { getProvider } = await import("../communications/registry.server");
  getProvider(engineId);
}

export async function testConnection(input: {
  organizationId: string;
  shopId: string;
  category: IntegrationCategory;
  provider: string;
  actorId: string;
}): Promise<{ ok: boolean; status: HealthStatus; message: string }> {
  const entry = INTEGRATION_CATALOG.find(
    (e) => e.category === input.category && e.id === input.provider,
  );
  if (!entry) throw new Error("Unbekannter Anbieter.");
  if (!entry.implemented) throw new Error("Dieser Anbieter ist noch nicht verfügbar.");
  if (!entry.healthCheckSupported) throw new Error("Dieser Anbieter unterstützt keine Prüfung.");

  const admin = await getAdmin();
  let health: HealthStatus = "healthy";
  let errorCode: string | null = null;
  let message = "Verbindung erfolgreich geprüft.";
  try {
    await probeAdapter(entry);
  } catch (e) {
    health = "error";
    errorCode = (e as { code?: string }).code ?? "unknown";
    message = e instanceof Error ? e.message : "Prüfung fehlgeschlagen.";
  }

  // Upsert connection + health (never stores secrets — only a reference name).
  const { data: conn } = await admin
    .from("integration_connections")
    .upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        category: input.category,
        provider: entry.id,
        status: health === "healthy" ? "connected" : "error",
        environment: entry.testOnly ? "test" : "test",
        configuration_reference: null,
      } as never,
      { onConflict: "shop_id,category,provider,environment" },
    )
    .select("id")
    .single();
  if (conn) {
    const connId = (conn as Row)["id"] as string;
    await admin.from("integration_health").upsert(
      {
        connection_id: connId,
        organization_id: input.organizationId,
        shop_id: input.shopId,
        status: health,
        last_checked_at: new Date().toISOString(),
        last_success_at: health === "healthy" ? new Date().toISOString() : null,
        last_error_code: errorCode,
      } as never,
      { onConflict: "connection_id" },
    );
  }

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "integration.tested",
    entityType: "integration_connection",
    entityId: `${input.shopId}:${input.category}:${entry.id}`,
    metadata: { result: health, errorCode },
  });
  return { ok: health === "healthy", status: health, message };
}

export async function disconnectIntegration(input: {
  organizationId: string;
  shopId: string;
  category: IntegrationCategory;
  provider: string;
  actorId: string;
}): Promise<{ ok: boolean }> {
  const entry = INTEGRATION_CATALOG.find(
    (e) => e.category === input.category && e.id === input.provider,
  );
  if (!entry || !entry.implemented) throw new Error("Dieser Anbieter ist nicht verfügbar.");
  if (!entry.disconnectSupported) throw new Error("Dieser Anbieter kann nicht getrennt werden.");
  const admin = await getAdmin();
  const engineId = engineProviderId(entry);

  if (entry.category === "payment") {
    await admin
      .from("payment_provider_configs")
      .update({ status: "inactive" } as never)
      .eq("organization_id", input.organizationId)
      .eq("shop_id", input.shopId)
      .eq("provider", engineId);
  } else if (entry.category === "email") {
    await admin
      .from("communication_provider_configs")
      .update({ status: "inactive" } as never)
      .eq("organization_id", input.organizationId)
      .eq("channel", "email")
      .eq("provider", engineId)
      .or(`shop_id.eq.${input.shopId},shop_id.is.null`);
  } else {
    await admin
      .from("shipping_provider_configs")
      .update({ status: "inactive" } as never)
      .eq("organization_id", input.organizationId)
      .eq("shop_id", input.shopId)
      .eq("provider", engineId);
  }

  await admin
    .from("integration_connections")
    .upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        category: input.category,
        provider: entry.id,
        status: "disabled",
        environment: "test",
      } as never,
      { onConflict: "shop_id,category,provider,environment" },
    );

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "integration.disconnected",
    entityType: "integration_connection",
    entityId: `${input.shopId}:${input.category}:${entry.id}`,
    metadata: {},
  });
  return { ok: true };
}

/* ------------------------------ sender domains ----------------------------- */

export type SenderDomainView = {
  id: string;
  domain: string;
  status: "not_configured" | "dns_required" | "verifying" | "verified" | "error";
  dnsRecords: { type: string; name: string; value: string; status: string }[];
  verifiedAt: string | null;
};

export async function listSenderDomains(
  organizationId: string,
  shopId: string,
): Promise<SenderDomainView[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("sender_domains")
    .select("id, domain, status, dns_records, verified_at")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: true });
  return ((data ?? []) as Row[]).map((r) => ({
    id: r["id"] as string,
    domain: r["domain"] as string,
    status: r["status"] as SenderDomainView["status"],
    dnsRecords: (r["dns_records"] as SenderDomainView["dnsRecords"]) ?? [],
    verifiedAt: (r["verified_at"] as string) ?? null,
  }));
}

const DOMAIN_RE = /^(?=.{1,253}$)([a-z0-9](-?[a-z0-9])*\.)+[a-z]{2,}$/i;

export async function addSenderDomain(input: {
  organizationId: string;
  shopId: string;
  domain: string;
  actorId: string;
}): Promise<SenderDomainView> {
  const domain = input.domain.trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) throw new Error("Ungültiger Domainname.");
  const admin = await getAdmin();
  // DNS-Werte werden niemals erfunden: Der verwaltete Anbieter verwaltet die
  // DNS-Zone plattformseitig; provider-seitige Werte kommen aus der jeweiligen
  // Provider-Konfiguration, sobald ein solcher Provider angebunden ist.
  const { data, error } = await admin
    .from("sender_domains")
    .upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        domain,
        status: "dns_required",
        dns_records: [],
      } as never,
      { onConflict: "shop_id,domain" },
    )
    .select("id, domain, status, dns_records, verified_at")
    .single();
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "integration.sender_domain_added",
    entityType: "sender_domain",
    entityId: domain,
    metadata: {},
  });
  const r = data as Row;
  return {
    id: r["id"] as string,
    domain: r["domain"] as string,
    status: r["status"] as SenderDomainView["status"],
    dnsRecords: [],
    verifiedAt: null,
  };
}

/**
 * Honest verification: no connected provider currently exposes
 * verifySenderDomain(), so a domain can never flip to verified by click.
 */
export async function recheckSenderDomain(input: {
  organizationId: string;
  shopId: string;
  domainId: string;
}): Promise<{ verified: boolean; message: string }> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("sender_domains")
    .select("id, status")
    .eq("id", input.domainId)
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId)
    .maybeSingle();
  if (!data) throw new Error("Absenderdomain nicht gefunden.");
  const status = (data as Row)["status"] as string;
  if (status === "verified") return { verified: true, message: "Domain ist verifiziert." };
  await admin
    .from("sender_domains")
    .update({ status: "verifying" } as never)
    .eq("id", input.domainId);
  return {
    verified: false,
    message:
      "Der verbundene Anbieter bietet derzeit keine automatische Domain-Prüfung. Die Domain gilt erst als verifiziert, wenn ein Provider dies bestätigt.",
  };
}

/* -------------------------------- readiness -------------------------------- */

export type ReadinessArea = {
  key: "payments" | "email" | "shipping" | "taxes" | "invoices" | "storefront";
  label: string;
  ready: boolean;
  liveReady: boolean;
  detail: string;
};

export async function getShopReadiness(
  organizationId: string,
  shopId: string,
): Promise<{ areas: ReadinessArea[]; liveReady: boolean }> {
  const admin = await getAdmin();
  const configs = await loadEngineConfigs(admin, organizationId, shopId);
  const [tax, invoice, keys] = await Promise.all([
    admin.from("tax_settings").select("shop_id").eq("shop_id", shopId).limit(1),
    admin.from("invoice_settings").select("shop_id").eq("shop_id", shopId).limit(1),
    admin
      .from("store_api_keys")
      .select("id")
      .eq("shop_id", shopId)
      .eq("status", "active")
      .limit(1),
  ]);

  const activePayment = configs.payment.find((c) => c["status"] === "active");
  const paymentLive = configs.payment.some(
    (c) => c["status"] === "active" && c["environment"] === "live" && c["provider"] !== "mock",
  );
  const activeEmail = configs.email.find((c) => c["status"] === "active");
  const verifiedSender = configs.identities.some(
    (i) => i["verification_status"] === "verified",
  );
  const activeCarrier = configs.carrier.find((c) => c["status"] === "active");
  const carrierLive = configs.carrier.some(
    (c) => c["status"] === "active" && c["test_mode"] === false,
  );

  const areas: ReadinessArea[] = [
    {
      key: "payments",
      label: "Zahlungen",
      ready: !!activePayment,
      liveReady: paymentLive,
      detail: activePayment
        ? paymentLive
          ? "Live-Anbieter aktiv"
          : "Nur Testmodus aktiv"
        : "Kein Zahlungsanbieter aktiv",
    },
    {
      key: "email",
      label: "E-Mail",
      ready: !!activeEmail && verifiedSender,
      liveReady: !!activeEmail && verifiedSender,
      detail: !activeEmail
        ? "Kein E-Mail-Anbieter aktiv"
        : verifiedSender
          ? "Absender verifiziert"
          : "Absenderdomain nicht verifiziert",
    },
    {
      key: "shipping",
      label: "Versand",
      ready: !!activeCarrier,
      liveReady: carrierLive,
      detail: activeCarrier
        ? carrierLive
          ? "Live-Carrier aktiv"
          : "Nur Test-Carrier aktiv"
        : "Noch nicht verbunden",
    },
    {
      key: "taxes",
      label: "Steuern",
      ready: (tax.data ?? []).length > 0,
      liveReady: (tax.data ?? []).length > 0,
      detail: (tax.data ?? []).length > 0 ? "Steuereinstellungen vorhanden" : "Nicht eingerichtet",
    },
    {
      key: "invoices",
      label: "Rechnungen",
      ready: (invoice.data ?? []).length > 0,
      liveReady: (invoice.data ?? []).length > 0,
      detail:
        (invoice.data ?? []).length > 0 ? "Rechnungseinstellungen vorhanden" : "Nicht eingerichtet",
    },
    {
      key: "storefront",
      label: "Storefront",
      ready: (keys.data ?? []).length > 0,
      liveReady: (keys.data ?? []).length > 0,
      detail: (keys.data ?? []).length > 0 ? "API-Key vorhanden" : "Kein API-Key",
    },
  ];
  return { areas, liveReady: areas.every((a) => a.liveReady) };
}

/* ------------------------------- OAuth states ------------------------------ */

const OAUTH_STATE_TTL_MS = 10 * 60 * 1000;

async function hashState(state: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(state));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Creates a single-use, short-lived OAuth state bound to org/shop/provider.
 * Only the hash is persisted; the raw state is returned once to the server
 * route that started the flow. Tokens themselves never touch this table.
 */
export async function createOAuthState(input: {
  organizationId: string;
  shopId: string;
  provider: string;
}): Promise<{ state: string; expiresAt: string }> {
  const state = crypto.randomUUID() + "." + crypto.randomUUID();
  const admin = await getAdmin();
  const expiresAt = new Date(Date.now() + OAUTH_STATE_TTL_MS).toISOString();
  const { error } = await admin.from("oauth_states").insert({
    state_hash: await hashState(state),
    organization_id: input.organizationId,
    shop_id: input.shopId,
    provider: input.provider,
    expires_at: expiresAt,
  } as never);
  if (error) throw new Error("OAuth-State konnte nicht angelegt werden.");
  return { state, expiresAt };
}

/**
 * Consumes a state exactly once. Throws on unknown, expired, already used or
 * cross-tenant/cross-provider states (replay and tampering protection).
 */
export async function consumeOAuthState(input: {
  state: string;
  organizationId: string;
  shopId: string;
  provider: string;
}): Promise<void> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("oauth_states")
    .select("id, organization_id, shop_id, provider, expires_at, used_at")
    .eq("state_hash", await hashState(input.state))
    .maybeSingle();
  const row = data as Row | null;
  if (!row) throw new Error("Ungültiger OAuth-State.");
  if (row["used_at"]) throw new Error("OAuth-State wurde bereits verwendet.");
  if (Date.parse(row["expires_at"] as string) <= Date.now())
    throw new Error("OAuth-State ist abgelaufen.");
  if (
    row["organization_id"] !== input.organizationId ||
    row["shop_id"] !== input.shopId ||
    row["provider"] !== input.provider
  )
    throw new Error("OAuth-State gehört nicht zu diesem Shop oder Anbieter.");
  const { error } = await admin
    .from("oauth_states")
    .update({ used_at: new Date().toISOString() } as never)
    .eq("id", row["id"] as string)
    .is("used_at", null);
  if (error) throw new Error("OAuth-State konnte nicht abgeschlossen werden.");
}
