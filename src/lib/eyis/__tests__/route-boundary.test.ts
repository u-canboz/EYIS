import { describe, expect, it } from "vitest";

import {
  EYIS_AUTH_PATH,
  isCustomerOwnedRoute,
  isEyisInternalRoute,
} from "../route-boundary";

describe("EYIS route boundary", () => {
  it("erkennt Backoffice- und Runtime-Pfade", () => {
    for (const path of [
      "/app",
      "/app/",
      "/app/uebersicht",
      "/app/login",
      "/portal",
      "/portal/bestellungen/123",
      "/api/public/store/v1/products",
      "/api/public/jobs/automation",
      "/api/public/install/doctor",
      "/api/public/webhooks/stripe",
    ]) {
      expect(isEyisInternalRoute(path), path).toBe(true);
    }
  });

  it("lässt Kundenrouten unberührt", () => {
    for (const path of [
      "/",
      "/apps",
      "/application",
      "/appointments",
      "/shop",
      "/kontakt",
      "/login",
      "/auth",
      "/portalseite",
      "/api/public/newsletter",
    ]) {
      expect(isEyisInternalRoute(path), path).toBe(false);
      expect(isCustomerOwnedRoute(path), path).toBe(true);
    }
  });

  it("ignoriert Query und Hash", () => {
    expect(isEyisInternalRoute("/app/bestellungen?status=open")).toBe(true);
    expect(isEyisInternalRoute("/#app")).toBe(false);
  });

  it("reserviert einen eigenen Anmeldepfad unterhalb von /app", () => {
    expect(EYIS_AUTH_PATH.startsWith("/app/")).toBe(true);
    expect(isEyisInternalRoute(EYIS_AUTH_PATH)).toBe(true);
  });
});
