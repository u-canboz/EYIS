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

/**
 * Schreibt Verbindung und Gesundheitsstand nach einer erfolgreichen Prüfung.
 * Ein Eintrag entsteht nur nach einem echten Anbieteraufruf, nie „auf Verdacht".
 */
async function upsertConnection(
  admin: Admin,
  input: {
    organizationId: string;
    shopId: string;
    category: IntegrationCategory;
    provider: string;
    environment: "test" | "live";
    reference: string;
    status: "connected" | "verification_required";
    metadata: Record<string, unknown>;
  },
): Promise<void> {
  const { data } = await admin
    .from("integration_connections")
    .upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        category: input.category,
        provider: input.provider,
        status: input.status,
        environment: input.environment,
        configuration_reference: input.reference,
        metadata: input.metadata as never,
      } as never,
      { onConflict: "shop_id,category,provider,environment" },
    )
    .select("id")
    .single();
  if (!data) return;
  const now = new Date().toISOString();
  await admin.from("integration_health").upsert(
    {
      connection_id: (data as Row)["id"] as string,
      organization_id: input.organizationId,
      shop_id: input.shopId,
      status: "healthy",
      last_checked_at: now,
      last_success_at: now,
      last_error_code: null,
    } as never,
    { onConflict: "connection_id" },
  );
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
    // PayPal und Mollie sind ausschließlich zugangsdatengebunden: der reine
    // Adapter-Ladetest würde hier zu Recht scheitern. Für sie zählt allein der
    // echte Anbieteraufruf in liveProbe().
    if (engineId === "paypal" || engineId === "mollie") return;
    const { getProvider } = await import("../payments/provider.server");
    await getProvider(engineId);
    return;
  }
  if (entry.category === "carrier") {
    const { getCarrier } = await import("../shipping/registry.server");
    await getCarrier(engineId);
    return;
  }
  const { getProvider } = await import("../communications/registry.server");
  getProvider(engineId);
}

/**
 * Echter Anbieter-Aufruf mit den hinterlegten Zugangsdaten des Shops.
 * Gibt eine kurze, secret-freie Zusammenfassung zurück.
 */
async function liveProbe(
  entry: IntegrationCatalogEntry,
  organizationId: string,
  shopId: string,
): Promise<{ message: string; reference: string | null } | null> {
  const { loadCredentials, referenceFor } = await import("./credentials.server");

  if (entry.category === "payment" && entry.id === "stripe") {
    for (const environment of ["test", "live"] as const) {
      const creds = await loadCredentials({
        organizationId,
        shopId,
        category: "payment",
        provider: "stripe",
        environment,
      });
      if (!creds?.["secretKey"]) continue;
      const { verifyStripeKey } = await import("../payments/stripe.server");
      const account = await verifyStripeKey(creds["secretKey"]);
      if (!account.chargesEnabled)
        throw Object.assign(
          new Error(
            "Stripe-Konto erreichbar, aber für dieses Konto sind noch keine Zahlungen freigeschaltet.",
          ),
          { code: "charges_disabled" },
        );
      return {
        message: `Stripe-Konto ${account.accountId} erreichbar (${environment === "live" ? "Live" : "Test"}, ${account.country ?? "?"}).`,
        reference: referenceFor({
          organizationId,
          shopId,
          category: "payment",
          provider: "stripe",
          environment,
        }),
      };
    }
    throw Object.assign(new Error("Für Stripe ist noch kein API-Schlüssel hinterlegt."), {
      code: "not_connected",
    });
  }

  if (entry.category === "payment" && entry.id === "paypal") {
    for (const environment of ["test", "live"] as const) {
      const creds = await loadCredentials({
        organizationId,
        shopId,
        category: "payment",
        provider: "paypal",
        environment,
      });
      if (!creds?.["clientId"] || !creds["clientSecret"]) continue;
      const { verifyPayPalCredentials } = await import("../payments/paypal.server");
      const info = await verifyPayPalCredentials({
        clientId: creds["clientId"],
        clientSecret: creds["clientSecret"],
        webhookId: creds["webhookId"] ?? null,
        environment,
      });
      return {
        message: `PayPal erreichbar (${environment === "live" ? "Live" : "Sandbox"})${
          info.webhookConfigured ? ", Webhook-ID hinterlegt" : ", Webhook-ID fehlt noch"
        }.`,
        reference: referenceFor({
          organizationId,
          shopId,
          category: "payment",
          provider: "paypal",
          environment,
        }),
      };
    }
    throw Object.assign(new Error("Für PayPal sind noch keine Zugangsdaten hinterlegt."), {
      code: "not_connected",
    });
  }

  if (entry.category === "payment" && entry.id === "mollie") {
    for (const environment of ["test", "live"] as const) {
      const creds = await loadCredentials({
        organizationId,
        shopId,
        category: "payment",
        provider: "mollie",
        environment,
      });
      if (!creds?.["apiKey"]) continue;
      const { verifyMollieCredentials } = await import("../payments/mollie.server");
      const info = await verifyMollieCredentials(creds["apiKey"]);
      return {
        message: `Mollie erreichbar (${info.environment === "live" ? "Live" : "Test"}). Freigeschaltete Zahlungsarten: ${
          info.methods.length > 0 ? info.methods.map((m) => m.description).join(", ") : "keine"
        }.`,
        reference: referenceFor({
          organizationId,
          shopId,
          category: "payment",
          provider: "mollie",
          environment,
        }),
      };
    }
    throw Object.assign(new Error("Für Mollie ist noch kein API-Schlüssel hinterlegt."), {
      code: "not_connected",
    });
  }

  if (entry.category === "email" && entry.id === "smtp") {
    const creds = await loadCredentials({
      organizationId,
      shopId,
      category: "email",
      provider: "smtp",
      environment: "live",
    });
    if (!creds?.["host"] || !creds["username"] || !creds["password"])
      throw Object.assign(new Error("Für SMTP sind noch keine Zugangsdaten hinterlegt."), {
        code: "not_connected",
      });
    const { verifySmtpConnection } = await import("../communications/providers/smtp.server");
    const info = await verifySmtpConnection({
      host: creds["host"],
      port: Number(creds["port"] ?? 587),
      encryption: creds["encryption"] === "tls" ? "tls" : "starttls",
      username: creds["username"],
      password: creds["password"],
      senderAddress: creds["senderAddress"] ?? null,
    });
    return {
      message: `SMTP-Server ${info.host}:${info.port} erreichbar, Anmeldung erfolgreich (${
        info.encryption === "tls" ? "TLS" : "STARTTLS"
      }).`,
      reference: referenceFor({
        organizationId,
        shopId,
        category: "email",
        provider: "smtp",
        environment: "live",
      }),
    };
  }

  if (entry.category === "email" && entry.id === "resend") {
    const creds = await loadCredentials({
      organizationId,
      shopId,
      category: "email",
      provider: "resend",
      environment: "live",
    });
    if (!creds?.["apiKey"])
      throw Object.assign(new Error("Für Resend ist noch kein API-Schlüssel hinterlegt."), {
        code: "not_connected",
      });
    const { resendVerifyKey } = await import("../communications/providers/resend.server");
    const info = await resendVerifyKey(creds["apiKey"]);
    return {
      message: `Resend erreichbar. Domains: ${info.domainCount}, davon verifiziert: ${info.verifiedDomains.length}.`,
      reference: referenceFor({
        organizationId,
        shopId,
        category: "email",
        provider: "resend",
        environment: "live",
      }),
    };
  }

  return null;
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
  let reference: string | null = null;
  try {
    await probeAdapter(entry);
    const live = await liveProbe(entry, input.organizationId, input.shopId);
    if (live) {
      message = live.message;
      reference = live.reference;
    } else {
      message = "Adapter verfügbar. Dieser Anbieter kennt keine externe Kontoprüfung.";
    }
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
        configuration_reference: reference,
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

  const { revokeCredentials } = await import("./credentials.server");
  await revokeCredentials({
    organizationId: input.organizationId,
    shopId: input.shopId,
    category: input.category,
    provider: engineId,
  });

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

async function resendKey(organizationId: string, shopId: string): Promise<string | null> {
  const { loadCredentials } = await import("./credentials.server");
  const creds = await loadCredentials({
    organizationId,
    shopId,
    category: "email",
    provider: "resend",
    environment: "live",
  });
  return creds?.["apiKey"] ?? null;
}

function mapResendStatus(status: string): SenderDomainView["status"] {
  if (status === "verified") return "verified";
  if (status === "failed") return "error";
  if (status === "pending" || status === "temporary_failure") return "verifying";
  return "dns_required";
}

export async function addSenderDomain(input: {
  organizationId: string;
  shopId: string;
  domain: string;
  actorId: string;
}): Promise<SenderDomainView> {
  const domain = input.domain.trim().toLowerCase();
  if (!DOMAIN_RE.test(domain)) throw new Error("Ungültiger Domainname.");
  const admin = await getAdmin();

  // DNS-Werte werden niemals erfunden: sie kommen ausschließlich vom
  // verbundenen Anbieter. Ohne verbundenen Anbieter bleibt die Domain
  // ohne Einträge und kann nicht verifiziert werden.
  let dnsRecords: SenderDomainView["dnsRecords"] = [];
  let status: SenderDomainView["status"] = "dns_required";
  let provider: string | null = null;
  let providerReference: string | null = null;

  const apiKey = await resendKey(input.organizationId, input.shopId);
  if (apiKey) {
    const { resendCreateDomain, resendFindDomain } = await import(
      "../communications/providers/resend.server"
    );
    const existing = await resendFindDomain(apiKey, domain);
    const created = existing ?? (await resendCreateDomain(apiKey, domain));
    dnsRecords = created.records;
    status = mapResendStatus(created.status);
    provider = "resend";
    providerReference = created.id;
  }

  const { data, error } = await admin
    .from("sender_domains")
    .upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        domain,
        status,
        dns_records: dnsRecords as never,
        provider,
        provider_reference: providerReference,
        verified_at: status === "verified" ? new Date().toISOString() : null,
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
    metadata: { provider: provider ?? "none" },
  });
  const r = data as Row;
  return {
    id: r["id"] as string,
    domain: r["domain"] as string,
    status: r["status"] as SenderDomainView["status"],
    dnsRecords,
    verifiedAt: (r["verified_at"] as string) ?? null,
  };
}

/**
 * Echte Prüfung beim Anbieter. Ohne verbundenen Anbieter bleibt die Domain
 * unverifiziert — ein Klick allein verifiziert niemals.
 */
export async function recheckSenderDomain(input: {
  organizationId: string;
  shopId: string;
  domainId: string;
}): Promise<{ verified: boolean; message: string; dnsRecords?: SenderDomainView["dnsRecords"] }> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("sender_domains")
    .select("id, domain, status, provider, provider_reference")
    .eq("id", input.domainId)
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId)
    .maybeSingle();
  if (!data) throw new Error("Absenderdomain nicht gefunden.");
  const row = data as Row;
  if (row["status"] === "verified") return { verified: true, message: "Domain ist verifiziert." };

  const apiKey = await resendKey(input.organizationId, input.shopId);
  if (!apiKey || row["provider"] !== "resend" || !row["provider_reference"]) {
    await admin
      .from("sender_domains")
      .update({ status: "dns_required" } as never)
      .eq("id", input.domainId);
    return {
      verified: false,
      message:
        "Für diesen Shop ist kein E-Mail-Anbieter mit Domain-Prüfung verbunden. Bitte zuerst Resend verbinden.",
    };
  }

  const { resendVerifyDomain, resendGetDomain } = await import(
    "../communications/providers/resend.server"
  );
  await resendVerifyDomain(apiKey, String(row["provider_reference"])).catch(() => undefined);
  const domain = await resendGetDomain(apiKey, String(row["provider_reference"]));
  const status = mapResendStatus(domain.status);
  const verified = status === "verified";

  await admin
    .from("sender_domains")
    .update({
      status,
      dns_records: domain.records as never,
      verified_at: verified ? new Date().toISOString() : null,
    } as never)
    .eq("id", input.domainId);

  if (verified) {
    // Absender dieser Domain gelten damit als verifiziert.
    const suffix = `@${String(row["domain"])}`;
    const { data: identities } = await admin
      .from("sender_identities")
      .select("id, sender_address")
      .eq("organization_id", input.organizationId)
      .eq("shop_id", input.shopId);
    for (const identity of (identities ?? []) as Row[]) {
      if (String(identity["sender_address"]).toLowerCase().endsWith(suffix)) {
        await admin
          .from("sender_identities")
          .update({ verification_status: "verified", sender_domain_id: input.domainId } as never)
          .eq("id", identity["id"] as string);
      }
    }
  }

  return {
    verified,
    message: verified
      ? "Domain wurde vom Anbieter verifiziert."
      : "Der Anbieter hat die Domain noch nicht bestätigt. Bitte DNS-Einträge prüfen.",
    dnsRecords: domain.records,
  };
}

/* ------------------------- Verbindung mit Zugangsdaten ---------------------- */

export type CredentialStatusView = {
  connected: boolean;
  environment: "test" | "live" | null;
  hints: Record<string, string>;
  updatedAt: string | null;
  webhookUrl: string | null;
};

function appOrigin(): string {
  return (
    process.env["APP_ORIGIN"] ??
    process.env["VITE_PUBLIC_APP_ORIGIN"] ??
    "https://<Ihre-Shop-Domain>"
  );
}

export function webhookUrlFor(provider: string): string | null {
  if (provider === "stripe") return `${appOrigin()}/api/public/webhooks/stripe`;
  if (provider === "paypal") return `${appOrigin()}/api/public/webhooks/paypal`;
  if (provider === "mollie") return `${appOrigin()}/api/public/webhooks/mollie`;
  if (provider === "resend") return `${appOrigin()}/api/public/webhooks/communications/resend`;
  // SMTP kennt keinen Rückkanal — Zustellberichte gibt es hier nicht.
  return null;
}

export async function getCredentialStatus(input: {
  organizationId: string;
  shopId: string;
  category: IntegrationCategory;
  provider: string;
}): Promise<CredentialStatusView> {
  const { credentialHints } = await import("./credentials.server");
  const found = await credentialHints(input);
  return {
    connected: !!found,
    environment: found?.environment ?? null,
    hints: found?.hints ?? {},
    updatedAt: found?.updatedAt ?? null,
    webhookUrl: webhookUrlFor(input.provider),
  };
}

/**
 * Verbindet einen Anbieter mit echten Zugangsdaten. Der Schlüssel wird sofort
 * gegen die Anbieter-API geprüft; erst danach wird verschlüsselt gespeichert
 * und die Engine-Konfiguration aktiviert.
 */
export async function connectIntegration(input: {
  organizationId: string;
  shopId: string;
  category: IntegrationCategory;
  provider: string;
  values: Record<string, string>;
  actorId: string;
}): Promise<{ ok: true; environment: "test" | "live"; message: string }> {
  const entry = INTEGRATION_CATALOG.find(
    (e) => e.category === input.category && e.id === input.provider,
  );
  if (!entry || !entry.implemented) throw new Error("Dieser Anbieter ist nicht verfügbar.");
  const admin = await getAdmin();
  const { storeCredentials } = await import("./credentials.server");

  if (input.category === "payment" && input.provider === "stripe") {
    const secretKey = (input.values["secretKey"] ?? "").trim();
    if (!/^(sk|rk)_(test|live)_/.test(secretKey))
      throw new Error(
        "Bitte einen geheimen Stripe-Schlüssel eintragen (beginnt mit sk_test_ oder sk_live_).",
      );
    const environment: "test" | "live" = secretKey.includes("_test_") ? "test" : "live";
    const { verifyStripeKey } = await import("../payments/stripe.server");
    const account = await verifyStripeKey(secretKey);

    const { reference } = await storeCredentials({
      scope: {
        organizationId: input.organizationId,
        shopId: input.shopId,
        category: "payment",
        provider: "stripe",
        environment,
      },
      values: {
        secretKey,
        webhookSecret: input.values["webhookSecret"] ?? null,
      },
    });

    await admin.from("payment_provider_configs").upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        provider: "stripe",
        display_name: "Stripe",
        environment,
        status: "active",
        priority: 10,
        secret_ref: reference,
        settings: { account_id: account.accountId, country: account.country } as never,
      } as never,
      { onConflict: "shop_id,provider,environment" },
    );

    const { data: conn } = await admin
      .from("integration_connections")
      .upsert(
        {
          organization_id: input.organizationId,
          shop_id: input.shopId,
          category: "payment",
          provider: "stripe",
          status: input.values["webhookSecret"] ? "connected" : "verification_required",
          environment,
          configuration_reference: reference,
          metadata: { account_id: account.accountId } as never,
        } as never,
        { onConflict: "shop_id,category,provider,environment" },
      )
      .select("id")
      .single();
    if (conn) {
      await admin.from("integration_health").upsert(
        {
          connection_id: (conn as Row)["id"] as string,
          organization_id: input.organizationId,
          shop_id: input.shopId,
          status: "healthy",
          last_checked_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_error_code: null,
        } as never,
        { onConflict: "connection_id" },
      );
    }

    await writeAudit({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "integration.connected",
      entityType: "integration_connection",
      entityId: `${input.shopId}:payment:stripe`,
      metadata: { environment, account_id: account.accountId },
    });

    return {
      ok: true,
      environment,
      message: input.values["webhookSecret"]
        ? `Stripe verbunden (${environment === "live" ? "Live" : "Test"}), Konto ${account.accountId}.`
        : `Stripe verbunden (${environment === "live" ? "Live" : "Test"}). Bitte noch das Webhook-Secret hinterlegen.`,
    };
  }

  if (input.category === "email" && input.provider === "resend") {
    const apiKey = (input.values["apiKey"] ?? "").trim();
    if (!apiKey.startsWith("re_"))
      throw new Error("Bitte einen Resend-API-Schlüssel eintragen (beginnt mit re_).");
    const { resendVerifyKey } = await import("../communications/providers/resend.server");
    const info = await resendVerifyKey(apiKey);

    const { reference } = await storeCredentials({
      scope: {
        organizationId: input.organizationId,
        shopId: input.shopId,
        category: "email",
        provider: "resend",
        environment: "live",
      },
      values: { apiKey, webhookSecret: input.values["webhookSecret"] ?? null },
    });

    await admin.from("communication_provider_configs").upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        channel: "email",
        provider: "resend",
        display_name: "Resend",
        status: "active",
        test_mode: false,
        priority: 200,
        configuration_reference: reference,
        capabilities: {
          supportsDeliveryWebhooks: true,
          supportsBounceWebhooks: true,
        } as never,
      } as never,
      { onConflict: "organization_id,shop_id,channel,provider" },
    );

    const { data: conn } = await admin
      .from("integration_connections")
      .upsert(
        {
          organization_id: input.organizationId,
          shop_id: input.shopId,
          category: "email",
          provider: "resend",
          status: info.verifiedDomains.length > 0 ? "connected" : "verification_required",
          environment: "live",
          configuration_reference: reference,
          metadata: { verified_domains: info.verifiedDomains } as never,
        } as never,
        { onConflict: "shop_id,category,provider,environment" },
      )
      .select("id")
      .single();
    if (conn) {
      await admin.from("integration_health").upsert(
        {
          connection_id: (conn as Row)["id"] as string,
          organization_id: input.organizationId,
          shop_id: input.shopId,
          status: "healthy",
          last_checked_at: new Date().toISOString(),
          last_success_at: new Date().toISOString(),
          last_error_code: null,
        } as never,
        { onConflict: "connection_id" },
      );
    }

    await writeAudit({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "integration.connected",
      entityType: "integration_connection",
      entityId: `${input.shopId}:email:resend`,
      metadata: { verified_domains: info.verifiedDomains.length },
    });

    return {
      ok: true,
      environment: "live",
      message:
        info.verifiedDomains.length > 0
          ? `Resend verbunden. Verifizierte Domains: ${info.verifiedDomains.join(", ")}.`
          : "Resend verbunden. Es ist noch keine Absenderdomain verifiziert.",
    };
  }

  if (input.category === "payment" && input.provider === "paypal") {
    const clientId = (input.values["clientId"] ?? "").trim();
    const clientSecret = (input.values["clientSecret"] ?? "").trim();
    const webhookId = (input.values["webhookId"] ?? "").trim() || null;
    const environment: "test" | "live" =
      (input.values["environment"] ?? "test").trim() === "live" ? "live" : "test";
    if (!clientId || !clientSecret)
      throw new Error("Bitte Client-ID und Secret aus dem PayPal-Entwicklerportal eintragen.");

    const { verifyPayPalCredentials } = await import("../payments/paypal.server");
    await verifyPayPalCredentials({ clientId, clientSecret, webhookId, environment });

    const { reference } = await storeCredentials({
      scope: {
        organizationId: input.organizationId,
        shopId: input.shopId,
        category: "payment",
        provider: "paypal",
        environment,
      },
      values: { clientId, clientSecret, webhookId },
      maskedFields: ["clientId", "clientSecret", "webhookId"],
    });

    await admin.from("payment_provider_configs").upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        provider: "paypal",
        display_name: "PayPal",
        environment,
        status: "active",
        priority: 20,
        secret_ref: reference,
        settings: {} as never,
      } as never,
      { onConflict: "shop_id,provider,environment" },
    );

    await upsertConnection(admin, {
      organizationId: input.organizationId,
      shopId: input.shopId,
      category: "payment",
      provider: "paypal",
      environment,
      reference,
      status: webhookId ? "connected" : "verification_required",
      metadata: { webhook_configured: !!webhookId },
    });

    await writeAudit({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "integration.connected",
      entityType: "integration_connection",
      entityId: `${input.shopId}:payment:paypal`,
      metadata: { environment, webhook_configured: !!webhookId },
    });

    return {
      ok: true,
      environment,
      message: webhookId
        ? `PayPal verbunden (${environment === "live" ? "Live" : "Sandbox"}).`
        : `PayPal verbunden (${environment === "live" ? "Live" : "Sandbox"}). Ohne Webhook-ID werden Zahlungen nicht automatisch bestätigt.`,
    };
  }

  if (input.category === "payment" && input.provider === "mollie") {
    const apiKey = (input.values["apiKey"] ?? "").trim();
    if (!/^(test|live)_[A-Za-z0-9]{10,}$/.test(apiKey))
      throw new Error("Bitte einen Mollie-API-Schlüssel eintragen (beginnt mit test_ oder live_).");
    const { verifyMollieCredentials, mollieEnvironment } = await import("../payments/mollie.server");
    const info = await verifyMollieCredentials(apiKey);
    const environment = mollieEnvironment(apiKey);
    const webhookUrl = webhookUrlFor("mollie");

    const { reference } = await storeCredentials({
      scope: {
        organizationId: input.organizationId,
        shopId: input.shopId,
        category: "payment",
        provider: "mollie",
        environment,
      },
      values: { apiKey, webhookUrl },
      maskedFields: ["apiKey"],
    });

    await admin.from("payment_provider_configs").upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        provider: "mollie",
        display_name: "Mollie",
        environment,
        status: "active",
        priority: 30,
        secret_ref: reference,
        settings: { methods: info.methods.map((m) => m.id) } as never,
      } as never,
      { onConflict: "shop_id,provider,environment" },
    );

    await upsertConnection(admin, {
      organizationId: input.organizationId,
      shopId: input.shopId,
      category: "payment",
      provider: "mollie",
      environment,
      reference,
      status: "connected",
      metadata: { methods: info.methods.map((m) => m.id) },
    });

    await writeAudit({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "integration.connected",
      entityType: "integration_connection",
      entityId: `${input.shopId}:payment:mollie`,
      metadata: { environment, methods: info.methods.length },
    });

    return {
      ok: true,
      environment,
      message: `Mollie verbunden (${environment === "live" ? "Live" : "Test"}). Zahlungsarten: ${
        info.methods.length > 0 ? info.methods.map((m) => m.description).join(", ") : "noch keine freigeschaltet"
      }.`,
    };
  }

  if (input.category === "email" && input.provider === "smtp") {
    const host = (input.values["host"] ?? "").trim();
    const port = Number((input.values["port"] ?? "587").trim());
    const encryption = (input.values["encryption"] ?? "starttls").trim() === "tls" ? "tls" : "starttls";
    const username = (input.values["username"] ?? "").trim();
    const password = input.values["password"] ?? "";
    const senderAddress = (input.values["senderAddress"] ?? "").trim();
    const senderName = (input.values["senderName"] ?? "").trim() || "Shop";
    const replyTo = (input.values["replyTo"] ?? "").trim() || null;

    if (!host || !username || !password) throw new Error("Host, Benutzername und Passwort sind Pflicht.");
    if (!Number.isInteger(port) || port < 1 || port > 65535)
      throw new Error("Bitte einen gültigen Port angeben (üblich: 587 für STARTTLS, 465 für TLS).");
    if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(senderAddress))
      throw new Error("Bitte eine gültige Absenderadresse angeben.");

    const { verifySmtpConnection } = await import("../communications/providers/smtp.server");
    const info = await verifySmtpConnection({
      host,
      port,
      encryption,
      username,
      password,
      senderAddress,
    });

    const { reference } = await storeCredentials({
      scope: {
        organizationId: input.organizationId,
        shopId: input.shopId,
        category: "email",
        provider: "smtp",
        environment: "live",
      },
      values: {
        host,
        port: String(port),
        encryption,
        username,
        password,
        senderAddress,
      },
      maskedFields: ["username", "password"],
    });

    await admin.from("communication_provider_configs").upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        channel: "email",
        provider: "smtp",
        display_name: "Eigener SMTP-Server",
        status: "active",
        test_mode: false,
        priority: 150,
        configuration_reference: reference,
        capabilities: {
          supportsDeliveryWebhooks: false,
          supportsBounceWebhooks: false,
        } as never,
      } as never,
      { onConflict: "organization_id,shop_id,channel,provider" },
    );

    const { data: existingDefault } = await admin
      .from("sender_identities")
      .select("id")
      .eq("shop_id", input.shopId)
      .eq("channel", "email")
      .eq("is_default", true)
      .maybeSingle();

    await admin.from("sender_identities").upsert(
      {
        organization_id: input.organizationId,
        shop_id: input.shopId,
        channel: "email",
        display_name: senderName,
        sender_name: senderName,
        sender_address: senderAddress,
        reply_to: replyTo,
        status: "active",
        // Beim eigenen SMTP-Server prüft die Plattform kein DNS. Der Absender
        // gilt daher als bestätigt durch den erfolgreichen SMTP-Login, nicht
        // durch eine Domain-Verifizierung dieser Plattform.
        verification_status: "unverified",
        is_default: !existingDefault,
      } as never,
      { onConflict: "shop_id,channel,sender_address" },
    );

    await upsertConnection(admin, {
      organizationId: input.organizationId,
      shopId: input.shopId,
      category: "email",
      provider: "smtp",
      environment: "live",
      reference,
      status: "connected",
      metadata: {
        host: info.host,
        port: info.port,
        encryption: info.encryption,
        connection_verified_at: new Date().toISOString(),
      },
    });

    await writeAudit({
      organizationId: input.organizationId,
      actorId: input.actorId,
      action: "integration.connected",
      entityType: "integration_connection",
      entityId: `${input.shopId}:email:smtp`,
      metadata: { host: info.host, port: info.port, encryption: info.encryption },
    });

    return {
      ok: true,
      environment: "live",
      message: `SMTP verbunden: ${info.host}:${info.port} (${info.encryption === "tls" ? "TLS" : "STARTTLS"}). Bitte jetzt eine Test-E-Mail senden.`,
    };
  }

  throw new Error("Für diesen Anbieter ist keine Verbindung mit Zugangsdaten vorgesehen.");
}

/**
 * Echte Test-E-Mail über den verbundenen Anbieter. Sie geht durch dieselbe
 * Engine wie Bestellmails, damit der Test aussagekräftig ist.
 */
export async function sendProviderTestEmail(input: {
  organizationId: string;
  shopId: string;
  recipient: string;
  actorId: string;
}): Promise<{ sent: boolean; provider: string; message: string }> {
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(input.recipient.trim()))
    throw new Error("Bitte eine gültige E-Mail-Adresse eingeben.");

  const admin = await getAdmin();
  const { resolveProvider, resolveSenderIdentity } = await import(
    "../communications/registry.server"
  );
  const { provider } = await resolveProvider(input.organizationId, input.shopId);
  const sender = await resolveSenderIdentity(input.organizationId, input.shopId);
  if (!sender) throw new Error("Für diesen Shop ist keine Absenderadresse hinterlegt.");

  // Der Test läuft durch dieselbe Engine wie Bestellmails: Vorlage rendern,
  // Kommunikation anlegen, Zustellversuch protokollieren, Anbieter aufrufen.
  const { data: templates } = await admin
    .from("communication_templates")
    .select("key, shop_id, organization_id, status")
    .eq("channel", "email")
    .or(`organization_id.eq.${input.organizationId},organization_id.is.null`);
  const usable = ((templates ?? []) as Row[]).filter(
    (t) => (!t["shop_id"] || t["shop_id"] === input.shopId) && t["status"] === "active",
  );
  const preferred = ["order_confirmation", "order_paid", "welcome"];
  const templateKey =
    (preferred.map((k) => usable.find((t) => t["key"] === k)).find(Boolean)?.["key"] as
      | string
      | undefined) ?? (usable[0]?.["key"] as string | undefined);
  if (!templateKey)
    throw new Error(
      "Es ist keine aktive E-Mail-Vorlage vorhanden. Bitte zuerst im Communication Studio eine Vorlage veröffentlichen.",
    );

  const { sendTestCommunication } = await import("../communications/communication.server");
  const queued = await sendTestCommunication({
    organizationId: input.organizationId,
    shopId: input.shopId,
    templateKey,
    recipient: input.recipient.trim(),
    actorId: input.actorId,
  });

  let sent = false;
  let failure: string | null = null;
  if (queued.queued) {
    const { data } = await admin
      .from("communications")
      .select("status, last_error")
      .eq("id", queued.communicationId)
      .maybeSingle();
    const row = (data ?? {}) as Row;
    sent = row["status"] === "sent";
    failure = (row["last_error"] as string | null) ?? null;
  } else {
    failure = queued.reason;
  }

  if (sent) {
    // Erfolgreicher Versand ist der Nachweis für die Live-Reife des Kanals.
    const { data: conn } = await admin
      .from("integration_connections")
      .select("id, metadata")
      .eq("shop_id", input.shopId)
      .eq("category", "email")
      .eq("provider", provider.key)
      .maybeSingle();
    if (conn) {
      const row = conn as Row;
      await admin
        .from("integration_connections")
        .update({
          metadata: {
            ...((row["metadata"] as Record<string, unknown>) ?? {}),
            test_email_sent_at: new Date().toISOString(),
          } as never,
        } as never)
        .eq("id", row["id"] as string);
    }
  }

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "integration.test_email_sent",
    entityType: "integration_connection",
    entityId: `${input.shopId}:email:${provider.key}`,
    metadata: { provider: provider.key, sandbox: provider.isSandbox, sent, template: templateKey },
  });

  return {
    sent,
    provider: provider.key,
    message: provider.isSandbox
      ? "Der aktive Anbieter ist ein Sandbox-Anbieter — es wurde keine echte E-Mail zugestellt."
      : sent
        ? `Test-E-Mail an ${input.recipient.trim()} zugestellt (Anbieter: ${provider.key}, Vorlage: ${templateKey}).`
        : `Versand fehlgeschlagen: ${failure ?? "unbekannter Fehler"}.`,
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
  const emailLiveProvider =
    !!activeEmail && activeEmail["provider"] !== "test" && activeEmail["test_mode"] !== true;
  let verifiedSender = configs.identities.some((i) => i["verification_status"] === "verified");
  let emailDetailOverride: string | null = null;

  // Beim eigenen SMTP-Server verifiziert die Plattform keine Domain. Nachweis
  // sind hier die geprüfte Verbindung und eine tatsächlich zugestellte
  // Test-E-Mail — beides wird bei der Verbindung bzw. beim Test protokolliert.
  if (activeEmail?.["provider"] === "smtp") {
    const { data } = await admin
      .from("integration_connections")
      .select("metadata")
      .eq("shop_id", shopId)
      .eq("category", "email")
      .eq("provider", "smtp")
      .maybeSingle();
    const metadata = ((data as Row | null)?.["metadata"] as Record<string, unknown>) ?? {};
    const connectionChecked = !!metadata["connection_verified_at"];
    const testSent = !!metadata["test_email_sent_at"];
    const hasSender = configs.identities.some((i) => i["status"] === "active");
    verifiedSender = connectionChecked && testSent && hasSender;
    emailDetailOverride = verifiedSender
      ? "SMTP-Verbindung geprüft, Test-E-Mail zugestellt (DNS-Reputation liegt beim Betreiber)"
      : !connectionChecked
        ? "SMTP-Verbindung noch nicht geprüft"
        : !testSent
          ? "Test-E-Mail steht noch aus"
          : "Keine Absenderadresse hinterlegt";
  }
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
      liveReady: emailLiveProvider && verifiedSender,
      detail: !activeEmail
        ? "Kein E-Mail-Anbieter aktiv"
        : !emailLiveProvider
          ? "Nur Sandbox-Anbieter aktiv"
          : (emailDetailOverride ??
            (verifiedSender ? "Absender verifiziert" : "Absenderdomain nicht verifiziert")),
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
