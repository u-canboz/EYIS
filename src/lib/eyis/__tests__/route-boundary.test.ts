import { describe, expect, it } from "vitest";

import {
  EYIS_AUTH_PATH,
  EYIS_BASE_PREFIXES,
  isCustomerOwnedRoute,
  isEyisInternalRoute,
} from "../route-boundary";

describe("EYIS route boundary", () => {
  it("erkennt Backoffice- und Runtime-Pfade der Basisinstallation", () => {
    for (const path of [
      "/app",
      "/app/",
      "/app/uebersicht",
      "/app/login",
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
      "/store",
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

  it("beansprucht /portal nur, wenn das optionale Portal installiert ist", () => {
    expect(EYIS_BASE_PREFIXES).not.toContain("/portal");
    expect(isEyisInternalRoute("/portal")).toBe(false);
    expect(isEyisInternalRoute("/portal/bestellungen/123")).toBe(false);
    expect(isEyisInternalRoute("/portal", ["portal"])).toBe(true);
    expect(isEyisInternalRoute("/portal/bestellungen/123", ["portal"])).toBe(true);
    // Kundenrouten bleiben auch mit installiertem Modul unberührt.
    expect(isEyisInternalRoute("/portalseite", ["portal"])).toBe(false);
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
