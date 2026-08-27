/* Production Guard: Demo-/QA-Seeds dürfen niemals in einer echten
   Produktivumgebung oder in einer Organisation mit Live-Konfiguration laufen. */

import { EnvironmentGuardError, resolveEnvironment } from "../environment";

export class DemoSeedForbidden extends Error {
  code = "DEMO_SEED_FORBIDDEN";
  signals: string[];
  constructor(message: string, signals: string[] = []) {
    super(message);
    this.name = "DemoSeedForbidden";
    this.signals = signals;
  }
}

type AdminLike = {
  from: (table: string) => any;
};

/**
 * Wirft DemoSeedForbidden, wenn irgendein Produktions-Signal aktiv ist.
 * Signale: explizites Environment-Flag, Live-Zahlungsanbieter oder
 * Live-API-Keys in der Ziel-Organisation.
 */
export async function assertNotProduction(
  admin: AdminLike,
  opts: { organizationId?: string | null } = {},
) {
  const signals: string[] = [];

  // Umgebung auflösen. Ungültiger Wert = harter Fehler, fehlender Wert = unknown.
  let environment: string;
  try {
    environment = resolveEnvironment(process.env as Record<string, string | undefined>);
  } catch (error) {
    if (error instanceof EnvironmentGuardError) {
      throw new DemoSeedForbidden(error.message, ["invalid_environment"]);
    }
    throw error;
  }
  if (environment === "production") signals.push("environment_flag");
  // Unbekannte Umgebung wird nicht still als Development behandelt.
  if (environment === "unknown") signals.push("unknown_environment");

  if (opts.organizationId) {
    const { data: livePayments } = await admin
      .from("payment_provider_configs")
      .select("id")
      .eq("organization_id", opts.organizationId)
      .eq("environment", "live")
      .eq("status", "active")
      .limit(1);
    if (livePayments?.length) signals.push("live_payment_provider");

    const { data: liveKeys } = await admin
      .from("store_api_keys")
      .select("id")
      .eq("organization_id", opts.organizationId)
      .eq("environment", "live")
      .eq("status", "active")
      .limit(1);
    if (liveKeys?.length) signals.push("live_store_api_key");
  }

  if (signals.length) {
    // Security-Audit: blockierte Seed-Versuche sind sicherheitsrelevant.
    try {
      const { writeAudit } = await import("../core.server");
      await writeAudit({
        organizationId: opts.organizationId ?? null,
        actorId: null,
        action: "security.demo_seed_blocked",
        entityType: "demo_environment",
        metadata: { signals },
      });
    } catch {
      // Audit darf den Guard selbst nie brechen.
    }
    throw new DemoSeedForbidden(
      "Demo-/QA-Seed in dieser Umgebung nicht zulässig (Produktions-Signale aktiv).",
      signals,
    );
  }
}
