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
