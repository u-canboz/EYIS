import { describe, expect, it, afterEach } from "vitest";
import nacl from "tweetnacl";
import { loadUpdateConfig } from "../providers.server";
import { sealSecret } from "../secret-box.server";

const KEYS = [
  "EYIS_UPDATE_REPO",
  "EYIS_UPDATE_HOSTING",
  "EYIS_UPDATE_DEPLOY_HEALTH_URL",
  "APP_BASE_URL",
];

afterEach(() => {
  for (const key of KEYS) delete process.env[key];
});

describe("Update-Konfiguration: DB → Umgebung → Defaults", () => {
  it("nimmt gespeicherte Werte, wenn keine Umgebungsvariable gesetzt ist", () => {
    for (const key of KEYS) delete process.env[key];
    const config = loadUpdateConfig({
      customerRepo: "kunde/shop",
      hosting: "git_auto_deploy",
      healthUrl: "https://shop.example/api/public/install/version",
      publishAckAt: "2026-09-10T10:00:00.000Z",
    });
    expect(config.customerRepo).toBe("kunde/shop");
    expect(config.hosting).toBe("git_auto_deploy");
    expect(config.deploymentHealthUrl).toBe("https://shop.example/api/public/install/version");
    expect(config.publishAcknowledgedAt).toBe("2026-09-10T10:00:00.000Z");
  });

  it("lässt der Umgebung den Vorrang vor gespeicherten Werten", () => {
    process.env["EYIS_UPDATE_REPO"] = "env/repo";
    process.env["EYIS_UPDATE_HOSTING"] = "lovable_sync";
    const config = loadUpdateConfig({ customerRepo: "db/repo", hosting: "git_auto_deploy" });
    expect(config.customerRepo).toBe("env/repo");
    expect(config.hosting).toBe("lovable_sync");
  });

  it("fällt ohne beides auf die Auslieferungs-Defaults zurück", () => {
    for (const key of KEYS) delete process.env[key];
    const config = loadUpdateConfig(null);
    expect(config.releaseRepo).toBe("u-canboz/EYIS");
    expect(config.eventType).toBe("eyis-update");
    expect(config.publishAcknowledgedAt).toBeNull();
  });

  it("leitet die Health-URL aus der Basis-URL ab", () => {
    process.env["APP_BASE_URL"] = "https://shop.example/";
    expect(loadUpdateConfig(null).deploymentHealthUrl).toBe(
      "https://shop.example/api/public/install/version",
    );
  });
});

describe("Repository-Secret (sealed box)", () => {
  it("erzeugt einen Wert, den nur der Repository-Schlüssel entschlüsseln kann", () => {
    const pair = nacl.box.keyPair();
    let binary = "";
    for (const b of pair.publicKey) binary += String.fromCharCode(b);
    const sealed = sealSecret("postgres://geheim", btoa(binary));
    const raw = Uint8Array.from(atob(sealed), (c) => c.charCodeAt(0));
    expect(raw.length).toBeGreaterThan(48);
    expect(sealed).not.toContain("postgres");
  });

  it("weist einen ungültigen Schlüssel ab", () => {
    expect(() => sealSecret("x", btoa("kurz"))).toThrow("INVALID_REPO_PUBLIC_KEY");
  });
});
