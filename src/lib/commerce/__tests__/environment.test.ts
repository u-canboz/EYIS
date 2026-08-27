import { describe, expect, it } from "vitest";
import {
  EnvironmentGuardError,
  GUARDED_OPERATIONS,
  assertOperationAllowed,
  isOperationAllowed,
  resolveEnvironment,
} from "../environment";

describe("Umgebungsauflösung", () => {
  it("liest gültige Werte", () => {
    expect(resolveEnvironment({ APP_ENV: "development" })).toBe("development");
    expect(resolveEnvironment({ APP_ENV: "Staging" })).toBe("staging");
    expect(resolveEnvironment({ APP_ENV: "production" })).toBe("production");
    expect(resolveEnvironment({ LOVABLE_ENV: "production" })).toBe("production");
  });

  it("meldet fehlendes APP_ENV als unknown", () => {
    expect(resolveEnvironment({})).toBe("unknown");
  });

  it("wirft bei ungültigem APP_ENV statt still Development anzunehmen", () => {
    expect(() => resolveEnvironment({ APP_ENV: "prod" })).toThrow(EnvironmentGuardError);
    expect(() => resolveEnvironment({ APP_ENV: "live" })).toThrow(EnvironmentGuardError);
  });
});

describe("Production Guard — Negativtests", () => {
  it("sperrt alle geschützten Operationen in Production", () => {
    for (const op of GUARDED_OPERATIONS) {
      expect(() => assertOperationAllowed(op, { APP_ENV: "production" })).toThrow(
        EnvironmentGuardError,
      );
    }
  });

  it("sperrt alle geschützten Operationen bei unbekannter Umgebung", () => {
    for (const op of GUARDED_OPERATIONS) {
      expect(() => assertOperationAllowed(op, {})).toThrow(/Umgebung unbekannt/);
    }
  });

  it("sperrt bei ungültigem APP_ENV", () => {
    expect(() => assertOperationAllowed("demo_seed", { APP_ENV: "prd" })).toThrow(
      EnvironmentGuardError,
    );
  });

  it("erlaubt Operationen in Development und Staging", () => {
    for (const env of ["development", "staging"]) {
      for (const op of GUARDED_OPERATIONS) {
        expect(assertOperationAllowed(op, { APP_ENV: env })).toBe(env);
      }
    }
    expect(isOperationAllowed("production")).toBe(false);
    expect(isOperationAllowed("unknown")).toBe(false);
  });
});
