/**
 * Umgebungsauflösung (Gate C, Punkt 3).
 *
 * Regeln:
 *  - Gültige Werte für `APP_ENV`: development | staging | production
 *  - Ein ungültiger Wert ist ein harter Fehler (kein stilles Development).
 *  - Ein fehlender Wert ergibt `unknown`. `unknown` erlaubt keine der
 *    geschützten Operationen — sicherer Abbruch statt Annahme.
 *
 * Diese Datei ist bewusst rein (keine Server-Importe), damit sie testbar ist.
 */

export type AppEnvironment = "development" | "staging" | "production" | "unknown";

/** Operationen, die niemals in Production laufen dürfen. */
export type GuardedOperation =
  | "demo_seed"
  | "qa_fixtures"
  | "fixture_reset"
  | "qa_harness"
  | "test_payment_provider"
  | "test_email_provider"
  | "test_carrier"
  | "synthetic_orders"
  | "debug_endpoint"
  | "test_publishable_key_checkout";

export const GUARDED_OPERATIONS: GuardedOperation[] = [
  "demo_seed",
  "qa_fixtures",
  "fixture_reset",
  "qa_harness",
  "test_payment_provider",
  "test_email_provider",
  "test_carrier",
  "synthetic_orders",
  "debug_endpoint",
  "test_publishable_key_checkout",
];

export class EnvironmentGuardError extends Error {
  code = "ENVIRONMENT_GUARD";
  environment: AppEnvironment;
  operation: GuardedOperation | null;
  constructor(message: string, environment: AppEnvironment, operation: GuardedOperation | null) {
    super(message);
    this.name = "EnvironmentGuardError";
    this.environment = environment;
    this.operation = operation;
  }
}

const VALID = new Set(["development", "staging", "production"]);

/** Liest die Umgebung aus einem Env-Objekt. Wirft bei ungültigem Wert. */
export function resolveEnvironment(env: Record<string, string | undefined>): AppEnvironment {
  const raw = (env["APP_ENV"] ?? env["LOVABLE_ENV"] ?? "").trim().toLowerCase();
  if (raw === "") return "unknown";
  if (!VALID.has(raw)) {
    throw new EnvironmentGuardError(
      `Ungültiger APP_ENV-Wert "${raw}". Erlaubt: development, staging, production.`,
      "unknown",
      null,
    );
  }
  return raw as AppEnvironment;
}

/** Ist die Operation in dieser Umgebung erlaubt? Nur development und staging. */
export function isOperationAllowed(environment: AppEnvironment): boolean {
  return environment === "development" || environment === "staging";
}

/**
 * Sicherer Abbruch: wirft in Production **und** bei unbekannter Umgebung.
 * Wird von `assertNotProduction` und den QA-/Demo-Pfaden verwendet.
 */
export function assertOperationAllowed(
  operation: GuardedOperation,
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): AppEnvironment {
  const environment = resolveEnvironment(env);
  if (!isOperationAllowed(environment)) {
    throw new EnvironmentGuardError(
      environment === "unknown"
        ? `Umgebung unbekannt (APP_ENV fehlt). Operation "${operation}" wird abgebrochen.`
        : `Operation "${operation}" ist in der Umgebung "${environment}" gesperrt.`,
      environment,
      operation,
    );
  }
  return environment;
}

// ---------------------------------------------------------------------------
// Deployment Mode (Phase 21: Dedicated Deployment)
// ---------------------------------------------------------------------------

export type DeploymentMode = "shared" | "dedicated";

export class DeploymentModeError extends Error {
  code = "DEPLOYMENT_MODE_INVALID";
  constructor(message: string) {
    super(message);
    this.name = "DeploymentModeError";
  }
}

/**
 * Liest `COMMERCE_DEPLOYMENT_MODE`. Fehlend/leer ergibt "shared"
 * (Bestandsinstallationen haben die Variable nicht). Ein unbekannter Wert
 * ist ein harter Fehler — kein stilles Default.
 */
export function resolveDeploymentMode(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): DeploymentMode {
  const raw = (env["COMMERCE_DEPLOYMENT_MODE"] ?? "").trim().toLowerCase();
  if (raw === "") return "shared";
  if (raw === "shared" || raw === "dedicated") return raw;
  throw new DeploymentModeError(
    `Ungültiger COMMERCE_DEPLOYMENT_MODE-Wert "${raw}". Erlaubt: shared, dedicated.`,
  );
}

/**
 * Dedicated-Isolation: schlägt fehl, wenn die Instanz auf einen zentralen
 * EYIS-Host konfiguriert ist. Erlaubt ist ausschließlich die eigene
 * Infrastruktur plus explizit konfigurierte Provider.
 */
export function findCentralDependencies(
  env: Record<string, string | undefined> = process.env as Record<string, string | undefined>,
): string[] {
  const hits: string[] = [];
  for (const [key, value] of Object.entries(env)) {
    if (!value) continue;
    if (/^(COMMERCE_CENTRAL_|SHARED_COMMERCE_|COMMERCE_OS_HUB_)/.test(key)) {
      hits.push(key);
    }
  }
  return hits;
}
