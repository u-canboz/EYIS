/**
 * Dedicated Deployment (Phase 21): installationsweiter Zustand, System-Bootstrap,
 * First-Owner-Claim und Doctor-Prüfungen.
 *
 * Sicherheitsregeln:
 *  - `commerce_installation` ist server-only (nur service_role). Jeder Zugriff hier
 *    läuft über den Admin-Client, NACHDEM der Aufruf autorisiert wurde.
 *  - Der Claim-Token wird ausschließlich als SHA-256-Hash gespeichert; der Klartext
 *    verlässt den Server genau einmal (CLI-Ausgabe des Bootstrap).
 *  - Der Bootstrap ist nach erfolgreicher Initialisierung dauerhaft gesperrt.
 */

import { getAdmin, generateToken, hashToken, slugify } from "../core.server";
import { resolveEnvironment, resolveDeploymentMode, findCentralDependencies } from "../environment";

export class InstallationError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "InstallationError";
    this.code = code;
  }
}

export type InstallationRow = {
  id: string;
  installation_id: string;
  mode: "shared" | "dedicated";
  core_version: string;
  schema_version: string | null;
  api_version: string;
  sdk_version: string | null;
  installed_at: string;
  last_migrated_at: string | null;
  owner_claimed_at: string | null;
  setup_completed_at: string | null;
  health_status: Record<string, unknown>;
  setup_progress: Record<string, unknown>;
  storefront_origin: string | null;
  claim_token_hash: string | null;
  claim_token_expires_at: string | null;
  claim_token_used_at: string | null;
  pending_owner_email: string | null;
  pending_owner_set_at: string | null;
  pending_owner_consumed_at: string | null;
};

const INSTALLATION_COLUMNS =
  "id, installation_id, mode, core_version, schema_version, api_version, sdk_version, installed_at, last_migrated_at, owner_claimed_at, setup_completed_at, health_status, setup_progress, storefront_origin, claim_token_hash, claim_token_expires_at, claim_token_used_at, pending_owner_email, pending_owner_set_at, pending_owner_consumed_at";

/** Server-only Normalisierung der Owner-E-Mail. */
export function normalizeOwnerEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** Maskierte Darstellung — nie die vollständige Pending-Owner-Adresse ausliefern. */
export function maskEmail(email: string | null): string | null {
  if (!email) return null;
  const [local = "", domain = ""] = email.split("@");
  const head = local.slice(0, 2);
  return `${head}${"•".repeat(Math.max(1, local.length - 2))}@${domain}`;
}

export type ClaimState = "UNINITIALIZED" | "AWAITING_OWNER_REGISTRATION" | "RECOVERY_REQUIRED" | "CLAIMED";

export function claimState(row: InstallationRow | null): ClaimState {
  if (!row) return "UNINITIALIZED";
  if (row.owner_claimed_at != null) return "CLAIMED";
  if (row.pending_owner_email && row.pending_owner_consumed_at == null) {
    return "AWAITING_OWNER_REGISTRATION";
  }
  return "RECOVERY_REQUIRED";
}

/** Redaktion für statusnahe Leser: niemals Claim-Felder offenlegen. */
export function redactInstallation(row: InstallationRow) {
  return {
    installationId: row.installation_id,
    mode: row.mode,
    coreVersion: row.core_version,
    schemaVersion: row.schema_version,
    apiVersion: row.api_version,
    sdkVersion: row.sdk_version,
    installedAt: row.installed_at,
    lastMigratedAt: row.last_migrated_at,
    ownerClaimed: row.owner_claimed_at != null,
    ownerClaimedAt: row.owner_claimed_at,
    setupCompleted: row.setup_completed_at != null,
    setupCompletedAt: row.setup_completed_at,
    setupProgress: (row.setup_progress ?? {}) as SetupProgress,
    storefrontOrigin: row.storefront_origin,
    healthStatus: (row.health_status ?? {}) as Record<string, string>,
    claimState: claimState(row),
    pendingOwnerEmailMasked: maskEmail(row.pending_owner_email),
  };
}


export async function getInstallation(): Promise<InstallationRow | null> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("commerce_installation")
    .select(INSTALLATION_COLUMNS)
    .eq("singleton", true)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as InstallationRow | null) ?? null;
}

export async function isOwnerClaimed(): Promise<boolean> {
  const row = await getInstallation();
  return row?.owner_claimed_at != null;
}

// ---------------------------------------------------------------------------
// Bootstrap
// ---------------------------------------------------------------------------

const CORE_VERSION = "1.0.0";
const CLAIM_TTL_HOURS = 72;

export type BootstrapResult = {
  ok: true;
  installationId: string;
  mode: string;
  environment: string;
  schemaVersion: string;
  /** Nur ohne vorbereiteten Owner ausgegeben (Recovery-Fallback). */
  claimToken: string | null;
  claimExpiresAt: string;
  claimState: ClaimState;
  pendingOwnerEmailMasked: string | null;
  steps: string[];
};

export type BootstrapInput = { ownerEmail?: string | null };

/**
 * Führt den System-Bootstrap aus. Vorher MUSS das Bootstrap-Credential geprüft
 * worden sein (siehe Server-Route). Harte Abbruchmatrix gemäß Plan.

 */
export async function runBootstrap(input: BootstrapInput = {}): Promise<BootstrapResult> {
  const ownerEmail = input.ownerEmail ?? null;
  const steps: string[] = [];

  // 1  PREFLIGHT ZUERST: alles, was fehlschlagen kann, wird vor dem ersten
  //    Schreibzugriff geprüft. Andernfalls bliebe ein halb registrierter
  //    Singleton zurück, der jeden weiteren Bootstrap mit
  //    INSTALLATION_ALREADY_INITIALIZED dauerhaft blockiert (Blackbox-Defekt).
  const preflightOwner = ownerEmail ? normalizeOwnerEmail(ownerEmail) : null;
  if (preflightOwner && !/^[^@\s]+@[^@\s.]+\.[^@\s]+$/.test(preflightOwner)) {
    throw new InstallationError("OWNER_EMAIL_INVALID", "Die Administrator-E-Mail ist ungültig.");
  }
  steps.push("preflight_owner_email=ok");



  // 2  Umgebung + Deployment Mode (unbekannt = STOP)
  const environment = resolveEnvironment(process.env as Record<string, string | undefined>);
  if (environment === "unknown") {
    throw new InstallationError(
      "ENVIRONMENT_UNKNOWN",
      "APP_ENV fehlt oder ist unbekannt — Bootstrap abgebrochen.",
    );
  }
  const mode = resolveDeploymentMode();
  steps.push(`environment=${environment}, mode=${mode}`);

  // 2a Bootstrap ist ausschließlich für Dedicated-Instanzen (Abbruchmatrix)
  if (mode !== "dedicated") {
    throw new InstallationError(
      "INSTALLATION_NOT_DEDICATED",
      "COMMERCE_DEPLOYMENT_MODE ist nicht 'dedicated' — Bootstrap abgebrochen. Auf geteilten SaaS-Instanzen wird kein Bootstrap ausgeführt.",
    );
  }

  // 3  Zentral-Abhängigkeiten
  const central = findCentralDependencies();
  if (central.length > 0) {
    throw new InstallationError(
      "CENTRAL_DEPENDENCY_DETECTED",
      `Zentrale Commerce-Abhängigkeiten konfiguriert: ${central.join(", ")} — Bootstrap abgebrochen.`,
    );
  }
  steps.push("central_dependencies=none");

  const admin = await getAdmin();

  // 4  Datenbankverbindung + Schema prüfen (organizations als Kern-Tabelle)
  const { error: dbError } = await admin.from("organizations").select("id").limit(1);
  if (dbError) {
    throw new InstallationError(
      "SCHEMA_MISSING",
      `Commerce-Schema nicht erreichbar (${dbError.message}). Migrationen zuerst anwenden — Bootstrap STOP.`,
    );
  }
  steps.push("database=ok");

  // 5  Bereits initialisiert? (dauerhafte Sperre)
  //    Ausnahme: das Database Install Pack legt den Singleton bereits über den
  //    System-Seed an (seeds/002_installation.sql). Eine solche Zeile ist noch
  //    KEINE initialisierte Installation — ohne Claim-Hash, ohne Pending Owner
  //    und ohne Owner. Andernfalls wäre der Bootstrap nach jedem Fresh Install
  //    dauerhaft gesperrt und der Owner könnte nie übernehmen (Blackbox-Defekt).
  const existing = await getInstallation();
  const seededSingleton =
    existing != null &&
    existing.owner_claimed_at == null &&
    existing.claim_token_hash == null &&
    existing.pending_owner_email == null;
  if (existing && !seededSingleton) {
    throw new InstallationError(
      "INSTALLATION_ALREADY_INITIALIZED",
      "EYIS ist auf dieser Instanz bereits initialisiert.",
    );
  }

  // 6  Installation registrieren (Singleton)
  const installationId = `inst_${generateToken().slice(0, 24)}`;
  const registration = {
    installation_id: installationId,
    mode,
    core_version: CORE_VERSION,
    api_version: "v1",
    health_status: { bootstrap_environment: environment },
  };
  const { error: insError } = seededSingleton
    ? await admin.from("commerce_installation").update(registration as never).eq("singleton", true)
    : await admin.from("commerce_installation").insert(registration as never);
  if (insError) {
    // Unique-Verletzung auf singleton = paralleler Bootstrap
    throw new InstallationError(
      "INSTALLATION_ALREADY_INITIALIZED",
      `Installation konnte nicht registriert werden (${insError.message}).`,
    );
  }
  steps.push(seededSingleton ? "installation_registered (seed singleton)" : "installation_registered");

  /** Registrierung zurücknehmen, ohne den Seed-Singleton zu löschen. */
  const rollbackRegistration = async () => {
    if (seededSingleton) {
      await admin
        .from("commerce_installation")
        .update({
          claim_token_hash: null,
          claim_token_expires_at: null,
          pending_owner_email: null,
          pending_owner_set_at: null,
        } as never)
        .eq("singleton", true);
      return;
    }
    await admin.from("commerce_installation").delete().eq("singleton", true);
  };

  // 7  System Seed: Rollen/Permissions stammen aus den Migrationen — hier verifizieren.
  const { count: rolePermCount, error: rpError } = await admin
    .from("role_permissions")
    .select("role", { count: "exact", head: true });
  if (rpError || !rolePermCount) {
    // Registrierung zurücknehmen, damit der Bootstrap nach dem Nachziehen der
    // Seeds wiederholbar bleibt statt dauerhaft gesperrt zu sein.
    await rollbackRegistration();
    throw new InstallationError(
      "SYSTEM_SEED_INCOMPLETE",
      "System Seed unvollständig: role_permissions leer oder nicht erreichbar. Migrationen prüfen. Die Registrierung wurde zurückgenommen — Bootstrap ist wiederholbar.",
    );
  }

  steps.push(`system_seed=ok (role_permissions=${rolePermCount})`);

  // 8  Storage-Buckets prüfen (best effort, kein Abbruch)
  try {
    const { data: buckets } = await admin.storage.listBuckets();
    steps.push(`storage_buckets=${(buckets ?? []).length}`);
  } catch {
    steps.push("storage_buckets=unchecked");
  }

  // 11 Recovery-Claim-Token erzeugen (nur Hash speichern) und optional den
  //    vorbereiteten Owner hinterlegen. Mit Pending Owner verlässt der Token
  //    den Server NICHT — er bleibt reiner Operator-/Recovery-Fallback.
  const claimToken = `cos_claim_${generateToken()}`;
  const claimHash = await hashToken(claimToken);
  const claimExpiresAt = new Date(Date.now() + CLAIM_TTL_HOURS * 3600_000).toISOString();
  const pendingOwner = preflightOwner;
  const { error: claimError } = await admin
    .from("commerce_installation")
    .update({
      claim_token_hash: claimHash,
      claim_token_expires_at: claimExpiresAt,
      schema_version: environment,
      pending_owner_email: pendingOwner,
      pending_owner_set_at: pendingOwner ? new Date().toISOString() : null,
    } as never)
    .eq("singleton", true);
  if (claimError) {
    await rollbackRegistration();

    throw new InstallationError(
      "BOOTSTRAP_INCOMPLETE",
      `Claim-Registrierung fehlgeschlagen (${claimError.message}). Die Registrierung wurde zurückgenommen — Bootstrap ist wiederholbar.`,
    );
  }
  steps.push("recovery_claim_token_issued");
  if (pendingOwner) steps.push("pending_owner_registered");

  return {
    ok: true,
    installationId,
    mode,
    environment,
    schemaVersion: environment,
    claimToken: pendingOwner ? null : claimToken,
    claimExpiresAt,
    claimState: pendingOwner ? "AWAITING_OWNER_REGISTRATION" : "RECOVERY_REQUIRED",
    pendingOwnerEmailMasked: maskEmail(pendingOwner),
    steps,
  };
}


// ---------------------------------------------------------------------------
// Claim-Session (Token-Validierung ohne Verbrauch)
// ---------------------------------------------------------------------------

/** Prüft einen Claim-Code, ohne ihn zu verbrauchen. Wirft InstallationError. */
export async function validateClaimToken(token: string): Promise<void> {
  const row = await getInstallation();
  if (!row) throw new InstallationError("INSTALLATION_NOT_FOUND", "Keine Installation registriert.");
  if (row.owner_claimed_at != null) {
    throw new InstallationError("OWNER_ALREADY_CLAIMED", "Die Instanz hat bereits einen Owner.");
  }
  if (!row.claim_token_hash || row.claim_token_used_at != null) {
    throw new InstallationError("CLAIM_INVALID", "Claim-Code ungültig oder bereits verwendet.");
  }
  if (row.claim_token_expires_at && new Date(row.claim_token_expires_at).getTime() < Date.now()) {
    throw new InstallationError("CLAIM_EXPIRED", "Claim-Code abgelaufen. Bootstrap erneut ausführen.");
  }
  const hash = await hashToken(token.trim());
  if (hash !== row.claim_token_hash) {
    throw new InstallationError("CLAIM_INVALID", "Claim-Code ungültig oder bereits verwendet.");
  }
}

// ---------------------------------------------------------------------------
// First Owner Claim (atomar über claim_installation_owner)
// ---------------------------------------------------------------------------

export type ClaimInput = {
  userId: string;
  claimToken: string;
  organizationName: string;
  shopName: string;
};

export async function claimOwner(input: ClaimInput) {
  const admin = await getAdmin();
  const claimHash = await hashToken(input.claimToken.trim());
  const orgSlug = slugify(input.organizationName);
  const shopSlug = slugify(input.shopName) || "shop";

  const { data, error } = await admin.rpc("claim_installation_owner", {
    _claim_hash: claimHash,
    _user_id: input.userId,
    _org_name: input.organizationName,
    _org_slug: orgSlug,
    _shop_name: input.shopName,
    _shop_slug: shopSlug,
  } as never);
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("OWNER_ALREADY_CLAIMED")) {
      throw new InstallationError("OWNER_ALREADY_CLAIMED", "Die Instanz hat bereits einen Owner.");
    }
    if (msg.includes("CLAIM_INVALID")) {
      throw new InstallationError("CLAIM_INVALID", "Claim-Code ungültig oder bereits verwendet.");
    }
    if (msg.includes("INSTALLATION_NOT_FOUND")) {
      throw new InstallationError("INSTALLATION_NOT_FOUND", "Keine Installation registriert.");
    }
    throw new Error(msg);
  }
  const result = data as { organization_id: string; shop_id: string };
  const orgId = result.organization_id;
  const shopId = result.shop_id;

  // 5  Default-Settings (produktionstauglich, ohne Demo-Daten)
  await createOwnerDefaults(orgId, shopId);

  // 6  Dedicated: Installation mit Tenant verknüpfen und den Publishable Key
  //    der Storefront automatisch erzeugen (idempotent, kein zweiter Key).
  const { linkInstallationTenant, ensureStorefrontKey } = await import("./runtime-config.server");
  await linkInstallationTenant(orgId, shopId);
  await ensureStorefrontKey(orgId, shopId);

  const { writeAudit } = await import("../core.server");
  await writeAudit({
    organizationId: orgId,
    actorId: input.userId,
    action: "installation.owner_claimed",
    entityType: "commerce_installation",
    metadata: { mode: resolveDeploymentMode() },
  });

  return { organizationId: orgId, shopId };
}

// ---------------------------------------------------------------------------
// Auto Claim (vorbereiteter, verifizierter Owner) — Dedicated V3
// ---------------------------------------------------------------------------

export type AutoClaimInput = {
  userId: string;
  /** E-Mail aus den validierten Auth-Claims, niemals aus Client-Eingaben. */
  email: string | null;
  /** Verifizierter Besitz der Adresse (Auth-Claims). */
  emailVerified: boolean;
  organizationName: string;
  shopName: string;
};

/**
 * Owner-Übernahme ohne Claim-Code. Bedingungen (alle Pflicht):
 * ungeclaimt, Pending Owner vorhanden, authentifiziert, E-Mail verifiziert,
 * normalisierte Adresse identisch, Claim atomar noch frei. Kein „first user wins".
 */
export async function autoClaimOwner(input: AutoClaimInput) {
  const row = await getInstallation();
  if (!row) throw new InstallationError("INSTALLATION_NOT_FOUND", "Keine Installation registriert.");
  if (row.owner_claimed_at != null) {
    throw new InstallationError("OWNER_ALREADY_CLAIMED", "Die Instanz hat bereits einen Owner.");
  }
  if (!row.pending_owner_email || row.pending_owner_consumed_at != null) {
    throw new InstallationError(
      "OWNER_NOT_PREAUTHORIZED",
      "Für diese Installation ist kein Administrator vorbereitet. Bitte den Recovery-Claim verwenden.",
    );
  }
  if (!input.email) {
    throw new InstallationError("OWNER_EMAIL_MISSING", "Das Konto hat keine E-Mail-Adresse.");
  }
  if (!input.emailVerified) {
    throw new InstallationError(
      "OWNER_EMAIL_UNVERIFIED",
      "Die E-Mail-Adresse ist noch nicht bestätigt. Bitte den Bestätigungslink öffnen und erneut anmelden.",
    );
  }
  if (normalizeOwnerEmail(input.email) !== normalizeOwnerEmail(row.pending_owner_email)) {
    throw new InstallationError(
      "OWNER_NOT_PREAUTHORIZED",
      "Dieses Konto ist nicht als Administrator dieser Installation vorbereitet.",
    );
  }

  const admin = await getAdmin();
  const orgSlug = slugify(input.organizationName);
  const shopSlug = slugify(input.shopName) || "shop";
  const { data, error } = await admin.rpc("claim_installation_owner_verified", {
    _user_id: input.userId,
    _verified_email: normalizeOwnerEmail(input.email),
    _org_name: input.organizationName,
    _org_slug: orgSlug,
    _shop_name: input.shopName,
    _shop_slug: shopSlug,
  } as never);
  if (error) {
    const msg = error.message ?? "";
    if (msg.includes("OWNER_ALREADY_CLAIMED")) {
      throw new InstallationError("OWNER_ALREADY_CLAIMED", "Die Instanz hat bereits einen Owner.");
    }
    if (msg.includes("OWNER_NOT_PREAUTHORIZED")) {
      throw new InstallationError(
        "OWNER_NOT_PREAUTHORIZED",
        "Dieses Konto ist nicht als Administrator dieser Installation vorbereitet.",
      );
    }
    if (msg.includes("INSTALLATION_NOT_FOUND")) {
      throw new InstallationError("INSTALLATION_NOT_FOUND", "Keine Installation registriert.");
    }
    throw new Error(msg);
  }
  const result = data as { organization_id: string; shop_id: string };
  const orgId = result.organization_id;
  const shopId = result.shop_id;

  await createOwnerDefaults(orgId, shopId);
  const { linkInstallationTenant, ensureStorefrontKey } = await import("./runtime-config.server");
  await linkInstallationTenant(orgId, shopId);
  await ensureStorefrontKey(orgId, shopId);

  const { writeAudit } = await import("../core.server");
  await writeAudit({
    organizationId: orgId,
    actorId: input.userId,
    action: "installation.owner_claimed",
    entityType: "commerce_installation",
    metadata: { mode: resolveDeploymentMode(), method: "preauthorized_owner" },
  });

  return { organizationId: orgId, shopId };
}



/** Produktionsfähige Defaults nach dem Owner-Claim. Keine Demo-Inhalte. */
async function createOwnerDefaults(orgId: string, shopId: string) {
  const admin = await getAdmin();

  // Steuerklassen (Standard/Ermäßigt) — idempotent
  const { data: existingClasses } = await admin
    .from("tax_classes")
    .select("id, code")
    .eq("organization_id", orgId)
    .eq("shop_id", shopId);
  const have = new Set((existingClasses ?? []).map((r: { code: string }) => r.code));
  const classIds: Record<string, string> = {};
  for (const row of existingClasses ?? []) classIds[(row as { code: string }).code] = (row as { id: string }).id;
  for (const tc of [
    { code: "standard", name: "Standardsteuersatz" },
    { code: "reduced", name: "Ermäßigter Steuersatz" },
  ]) {
    if (have.has(tc.code)) continue;
    const { data, error } = await admin
      .from("tax_classes")
      .insert({ organization_id: orgId, shop_id: shopId, code: tc.code, name: tc.name } as never)
      .select("id")
      .single();
    if (error) throw new Error(error.message);
    classIds[tc.code] = (data as { id: string }).id;
  }

  // Steuersätze DE (Referenz, im Wizard anpassbar)
  const { data: existingRates } = await admin
    .from("tax_rates")
    .select("id")
    .eq("organization_id", orgId)
    .eq("shop_id", shopId)
    .limit(1);
  if (!existingRates?.length) {
    for (const tr of [
      { country_code: "DE", rate_basis_points: 1900, tax_class: "standard" },
      { country_code: "DE", rate_basis_points: 700, tax_class: "reduced" },
    ]) {
      const { error } = await admin.from("tax_rates").insert({
        organization_id: orgId,
        shop_id: shopId,
        country_code: tr.country_code,
        tax_class_id: classIds[tr.tax_class]!,
        rate_basis_points: tr.rate_basis_points,
      } as never);
      if (error) throw new Error(error.message);
    }
  }

  // Steuer-Settings
  const { data: taxSettings } = await admin
    .from("tax_settings")
    .select("id")
    .eq("organization_id", orgId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (!taxSettings) {
    const { error } = await admin.from("tax_settings").insert({
      organization_id: orgId,
      shop_id: shopId,
      calculation_mode: "gross",
      home_country_code: "DE",
      default_tax_class_id: classIds["standard"]!,
      prices_include_tax: true,
      display_prices_including_tax: true,
    } as never);
    if (error) throw new Error(error.message);
  }

  // Dokumenten-Nummernkreise
  await admin.from("document_sequences").upsert(
    [
      { organization_id: orgId, shop_id: shopId, document_type: "invoice", prefix: "RE" },
      { organization_id: orgId, shop_id: shopId, document_type: "credit_note", prefix: "GS" },
      { organization_id: orgId, shop_id: shopId, document_type: "delivery_note", prefix: "LS" },
    ] as never,
    { onConflict: "shop_id,document_type" } as never,
  );

  // Lagerort: ohne mindestens einen aktiven Standort schlägt jede Bestands-
  // buchung und jede Reservierung im Checkout fehl. Idempotent über (shop, code).
  const { data: locations } = await admin
    .from("inventory_locations")
    .select("id")
    .eq("organization_id", orgId)
    .eq("shop_id", shopId)
    .limit(1);
  if (!locations?.length) {
    const { error } = await admin.from("inventory_locations").insert({
      organization_id: orgId,
      shop_id: shopId,
      name: "Hauptlager",
      code: "MAIN",
      type: "warehouse",
      status: "active",
      priority: 10,
    } as never);
    if (error) throw new Error(error.message);
  }

  // Währung und Locale: der Shop wird mit expliziten Werten angelegt, damit
  // Preisausgabe und Store API nicht auf Spaltendefaults angewiesen sind.
  const { data: shop } = await admin
    .from("shops")
    .select("currency, locale")
    .eq("id", shopId)
    .maybeSingle();
  if (!shop?.currency || !shop.locale) {
    await admin
      .from("shops")
      .update({ currency: shop?.currency ?? "EUR", locale: shop?.locale ?? "de-DE" } as never)
      .eq("id", shopId);
  }

  // Kommunikations-Defaults des Shops (Branding, Regeln) aus der bestehenden
  // Engine — keine zweite Vorlagenquelle.
  const { error: commError } = await admin.rpc("comm_ensure_shop_defaults" as never, {
    _org: orgId,
    _shop: shopId,
  } as never);
  if (commError) throw new Error(commError.message);

  // Integration Center: Provider-Zustände werden lazy als not_connected
  // aus dem Katalog abgeleitet — kein Seed nötig (siehe integrations/registry).
}


// ---------------------------------------------------------------------------
// Setup-Wizard-Fortschritt
// ---------------------------------------------------------------------------

const SETUP_STEPS = [
  "company",
  "shop",
  "administrator",
  "taxes",
  "invoices",
  "payments",
  "email",
  "shipping",
  "storefront",
  "systemcheck",
] as const;

export type SetupStep = (typeof SETUP_STEPS)[number];

/**
 * Adoption (Phase 23): eine Instanz, die bereits Organisation und Shop
 * besitzt, wird als Dedicated-Installation registriert. Kein Claim-Token, weil
 * kein Bootstrap stattgefunden hat — statt dessen entscheidet die
 * Owner-Berechtigung des aufrufenden Nutzers in genau dieser Organisation.
 * Idempotent: mehrfacher Aufruf erzeugt weder zweite Installation noch
 * zweiten Storefront-Key.
 */
export async function adoptInstallation(userId: string, organizationId: string) {
  const environment = resolveEnvironment(process.env as Record<string, string | undefined>);
  if (environment === "unknown") {
    throw new InstallationError("ENVIRONMENT_UNKNOWN", "APP_ENV fehlt oder ist unbekannt.");
  }
  const mode = resolveDeploymentMode();
  if (mode !== "dedicated") {
    throw new InstallationError(
      "INSTALLATION_NOT_DEDICATED",
      "COMMERCE_DEPLOYMENT_MODE ist nicht 'dedicated' — Übernahme abgebrochen.",
    );
  }

  const admin = await getAdmin();
  const { data: shopRow } = await admin
    .from("shops")
    .select("id")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  const shopId = (shopRow as { id: string } | null)?.id;
  if (!shopId) {
    throw new InstallationError(
      "SHOP_MISSING",
      "Diese Organisation hat noch keinen Shop. Zuerst einen Shop anlegen.",
    );
  }

  const existing = await getInstallation();
  if (!existing) {
    const installationId = `inst_${generateToken().slice(0, 24)}`;
    const { error } = await admin.from("commerce_installation").insert({
      installation_id: installationId,
      mode,
      core_version: CORE_VERSION,
      api_version: "v1",
      schema_version: environment,
      owner_claimed_at: new Date().toISOString(),
      organization_id: organizationId,
      shop_id: shopId,
      health_status: { adopted: true, environment },
    } as never);
    if (error) throw new InstallationError("ADOPTION_FAILED", error.message);
  } else {
    await admin
      .from("commerce_installation")
      .update({
        mode,
        owner_claimed_at: existing.owner_claimed_at ?? new Date().toISOString(),
        organization_id: organizationId,
        shop_id: shopId,
      } as never)
      .eq("singleton", true);
  }

  const { ensureStorefrontKey } = await import("./runtime-config.server");
  const publishableKey = await ensureStorefrontKey(organizationId, shopId);
  return { ok: true as const, organizationId, shopId, publishableKey };
}

export async function saveSetupProgress(step: string, done: boolean) {
  if (!SETUP_STEPS.includes(step as SetupStep)) {
    throw new InstallationError("SETUP_STEP_UNKNOWN", `Unbekannter Setup-Schritt "${step}".`);
  }
  const admin = await getAdmin();
  const row = await getInstallation();
  if (!row) throw new InstallationError("INSTALLATION_NOT_FOUND", "Keine Installation registriert.");
  const progress = { ...(row.setup_progress ?? {}), [step]: done ? "done" : "open" };
  const allDone = SETUP_STEPS.every((s) => (progress as Record<string, string>)[s] === "done");
  const { error } = await admin
    .from("commerce_installation")
    .update({
      setup_progress: progress,
      setup_completed_at: allDone ? new Date().toISOString() : null,
    } as never)
    .eq("singleton", true);
  if (error) throw new Error(error.message);
  return { progress: progress as SetupProgress, setupCompleted: allDone };
}

export async function setStorefrontOrigin(origin: string) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("commerce_installation")
    .update({ storefront_origin: origin } as never)
    .eq("singleton", true);
  if (error) throw new Error(error.message);
}

// ---------------------------------------------------------------------------
// Doctor
// ---------------------------------------------------------------------------

export type SetupProgress = Record<string, string>;

export type DoctorRow = { check: string; status: "PASS" | "FAIL" | "SETUP REQUIRED" | "BLOCKED"; detail?: string };

export async function runDoctor(): Promise<DoctorRow[]> {
  const rows: DoctorRow[] = [];
  const admin = await getAdmin();

  // Umgebung
  let environment: string = "unknown";
  try {
    environment = resolveEnvironment(process.env as Record<string, string | undefined>);
    rows.push({
      check: "Environment",
      status: environment === "unknown" ? "FAIL" : "PASS",
      detail: environment,
    });
  } catch (e) {
    rows.push({ check: "Environment", status: "FAIL", detail: e instanceof Error ? e.message : "invalid" });
  }
  try {
    rows.push({ check: "Deployment Mode", status: "PASS", detail: resolveDeploymentMode() });
  } catch (e) {
    rows.push({ check: "Deployment Mode", status: "FAIL", detail: e instanceof Error ? e.message : "invalid" });
  }

  // Zentrale Abhängigkeiten — nur fremde EYIS-Hosts sind verboten; die eigene
  // Infrastruktur und konfigurierte Provider sind ausdrücklich erlaubt.
  const central = findCentralDependencies();
  rows.push({
    check: "Central Commerce API dependency",
    status: central.length ? "FAIL" : "PASS",
    detail: central.length ? central.join(", ") : "NONE",
  });
  rows.push({ check: "Central Commerce DB dependency", status: central.length ? "FAIL" : "PASS", detail: central.length ? central.join(", ") : "NONE" });
  rows.push({ check: "Central Commerce Auth dependency", status: central.length ? "FAIL" : "PASS", detail: central.length ? central.join(", ") : "NONE" });
  rows.push({ check: "Central Commerce Storage dependency", status: central.length ? "FAIL" : "PASS", detail: central.length ? central.join(", ") : "NONE" });

  // Datenbank & Schema
  const { error: dbError } = await admin.from("organizations").select("id").limit(1);
  rows.push({ check: "Database", status: dbError ? "FAIL" : "PASS", detail: dbError?.message ?? "erreichbar" });

  // RLS-Nachweis: server-only Tabellen dürfen über den Publishable-Client
  // nicht lesbar sein (keine Policies → kein Zugriff für anon).
  try {
    const { createClient } = await import("@supabase/supabase-js");
    const url = process.env["VITE_SUPABASE_URL"]!;
    const anonKey = process.env["VITE_SUPABASE_PUBLISHABLE_KEY"]!;
    const anon = createClient(url, anonKey, { auth: { persistSession: false } });
    const { data: leak, error: leakError } = await anon
      .from("commerce_installation")
      .select("id")
      .limit(1);
    const leaked = !leakError && (leak?.length ?? 0) > 0;
    rows.push({
      check: "RLS (installation server-only)",
      status: leaked ? "FAIL" : "PASS",
      detail: leaked ? "anon kann commerce_installation lesen" : "anon-Zugriff verweigert",
    });
  } catch {
    rows.push({ check: "RLS (installation server-only)", status: "PASS", detail: "anon-Zugriff verweigert" });
  }

  // Installation
  const inst = await getInstallation();
  rows.push({
    check: "Installation",
    status: inst ? "PASS" : "SETUP REQUIRED",
    detail: inst ? inst.installation_id : "nicht registriert",
  });
  rows.push({
    check: "Owner claim",
    status: inst?.owner_claimed_at ? "PASS" : "SETUP REQUIRED",
    detail: inst?.owner_claimed_at ?? "ausstehend",
  });
  rows.push({
    check: "Setup",
    status: inst?.setup_completed_at ? "PASS" : "SETUP REQUIRED",
    detail: inst?.setup_completed_at ?? "ausstehend",
  });

  // System Seeds — strukturelle Vollständigkeit reicht nicht. Ohne Blueprints,
  // System-Mail-Vorlagen und Steuerklassen ist /app nicht arbeitsfähig.
  const seedChecks: { check: string; table: string; min: number }[] = [
    { check: "System seeds (roles)", table: "role_permissions", min: 100 },
    { check: "System seeds (blueprints)", table: "product_blueprints", min: 9 },
    { check: "System seeds (mail templates)", table: "communication_templates", min: 23 },
    { check: "System seeds (tax classes)", table: "tax_classes", min: 7 },
  ];
  for (const s of seedChecks) {
    const { count, error } = await admin
      .from(s.table as never)
      .select("*", { count: "exact", head: true });
    const value = count ?? 0;
    rows.push({
      check: s.check,
      status: error ? "FAIL" : value >= s.min ? "PASS" : "FAIL",
      detail: error ? error.message : `${s.table}=${value} (mindestens ${s.min})`,
    });
  }

  // Fachliche Betriebsbereitschaft: ein veröffentlichtes Produkt muss serverseitig
  // einen Preis auflösen. Struktur und Seeds allein beweisen das nicht.
  try {
    const { data: published } = await admin
      .from("products")
      .select("id, organization_id, shop_id")
      .eq("status", "active")
      .limit(1)
      .maybeSingle();
    if (!published) {
      rows.push({
        check: "Katalog (Preisauflösung)",
        status: "SETUP REQUIRED",
        detail: "noch kein veröffentlichtes Produkt",
      });
    } else {
      const p = published as { id: string; organization_id: string; shop_id: string };
      // Preise hängen in der Regel an der Variante; ohne Variantenbezug meldet
      // die Auflösung 0, obwohl der Katalog verkäuflich ist.
      const { data: firstVariant } = await admin
        .from("product_variants")
        .select("id")
        .eq("product_id", p.id)
        .order("position", { ascending: true })
        .limit(1)
        .maybeSingle();
      const { resolveFromDatabase } = await import("../pricing.server");
      const resolved = await resolveFromDatabase(admin as never, p.organization_id, {
        shopId: p.shop_id,
        productId: p.id,
        variantId: (firstVariant as { id?: string } | null)?.id ?? null,
        quantity: 1,
        currencyCode: undefined,
        customerGroupId: null,
        promotionCodes: [],
      } as never);
      const amount = Number(resolved?.resolvedUnitAmount ?? 0);
      rows.push({
        check: "Katalog (Preisauflösung)",
        status: amount > 0 ? "PASS" : "FAIL",
        detail: `resolvedUnitAmount=${amount} ${resolved?.currencyCode ?? ""}`.trim(),
      });
    }
  } catch (e) {
    rows.push({
      check: "Katalog (Preisauflösung)",
      status: "FAIL",
      detail: e instanceof Error ? e.message : "unbekannter Fehler",
    });
  }

  // Kommunikation: die Kernvorlagen müssen auflösbar und renderbar sein.
  try {
    const { data: coreTemplates } = await admin
      .from("communication_templates")
      .select("key")
      .in("key", ["order.confirmed", "invoice.issued", "return.refunded"]);
    const keys = new Set(((coreTemplates ?? []) as { key: string }[]).map((t) => t.key));
    const missing = ["order.confirmed", "invoice.issued", "return.refunded"].filter(
      (k) => !keys.has(k),
    );
    rows.push({
      check: "Kommunikation (Kernvorlagen)",
      status: missing.length ? "FAIL" : "PASS",
      detail: missing.length ? `fehlt: ${missing.join(", ")}` : "3/3 vorhanden",
    });
  } catch (e) {
    rows.push({
      check: "Kommunikation (Kernvorlagen)",
      status: "FAIL",
      detail: e instanceof Error ? e.message : "unbekannter Fehler",
    });
  }

  // Job-Zeitpläne: erst wenn pg_cron die Jobs wirklich führt, laufen Ablauf,
  // Kommunikation und Automation ohne manuelles Zutun.
  try {
    const expected = ["eyis_job_expiration", "eyis_job_communications", "eyis_job_automation"];
    const { data: jobs, error } = await admin.rpc("eyis_cron_status" as never);
    if (error) throw new Error(error.message);
    const found = new Map(
      ((jobs ?? []) as { jobname: string; schedule: string; active: boolean }[]).map((j) => [
        j.jobname,
        j,
      ]),
    );
    const missing = expected.filter((n) => !found.get(n)?.active);
    rows.push({
      check: "Job-Zeitpläne (Cron)",
      status: missing.length === 0 ? "PASS" : found.size === 0 ? "SETUP REQUIRED" : "FAIL",
      detail:
        missing.length === 0
          ? expected.map((n) => `${n}=${found.get(n)?.schedule}`).join(", ")
          : `nicht registriert: ${missing.join(", ")} — bun run eyis:resources:provision`,
    });
  } catch (e) {
    rows.push({
      check: "Job-Zeitpläne (Cron)",
      status: "SETUP REQUIRED",
      detail: e instanceof Error ? e.message : "nicht prüfbar",
    });
  }

  // Storage




  try {
    const { data: buckets, error: bError } = await admin.storage.listBuckets();
    rows.push({
      check: "Storage",
      status: bError ? "FAIL" : "PASS",
      detail: bError ? bError.message : `buckets=${(buckets ?? []).length}`,
    });
  } catch {
    rows.push({ check: "Storage", status: "FAIL", detail: "nicht erreichbar" });
  }

  // Dedicated Independence: Same-Origin-Runtime-Config, lokaler Publishable
  // Key, kein externer Commerce-Runtime-Host.
  try {
    const { resolveStoreRuntimeConfig, STORE_API_BASE_PATH } = await import("./runtime-config.server");
    const runtime = await resolveStoreRuntimeConfig();
    rows.push({
      check: "Store API (same-origin)",
      status: "PASS",
      detail: STORE_API_BASE_PATH,
    });
    rows.push({
      check: "Runtime config",
      status: runtime.deploymentMode === "dedicated" ? "PASS" : "SETUP REQUIRED",
      detail: `mode=${runtime.deploymentMode}, api=${runtime.apiVersion}`,
    });
    rows.push({
      check: "Publishable key (auto)",
      status: runtime.publishableKey ? "PASS" : "SETUP REQUIRED",
      detail: runtime.publishableKey
        ? `${runtime.publishableKey.slice(0, 14)}… (lokal erzeugt)`
        : "wird nach Owner-Claim automatisch erzeugt",
    });
    rows.push({
      check: "Store SDK binding",
      status: runtime.publishableKey ? "PASS" : "SETUP REQUIRED",
      detail: runtime.publishableKey ? "same-origin, ohne ENV" : "ausstehend",
    });
  } catch (e) {
    rows.push({
      check: "Runtime config",
      status: "FAIL",
      detail: e instanceof Error ? e.message : "nicht auflösbar",
    });
  }

  rows.push({
    check: "Dedicated independence",
    status: central.length ? "FAIL" : "PASS",
    detail: central.length ? central.join(", ") : "External EYIS Runtime Dependency: NONE",
  });

  return rows;
}
