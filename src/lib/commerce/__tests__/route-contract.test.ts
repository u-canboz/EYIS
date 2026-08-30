/**
 * Phase 26 — Route Contract und Verteilungsgrenzen der Basisinstallation.
 *
 * Der Blackbox-Test musste Links im installierten Code von Hand korrigieren
 * (`/auth`, `/store`, `/portal`) und fand verwaiste Portal-Dateien im
 * Basis-Install. Beides wird hier maschinell verhindert.
 */
import { existsSync } from "node:fs";

import { describe, expect, it } from "vitest";

import { baseInstallFiles, findViolations, isGuaranteedTarget } from "../../../../scripts/installer/route-contract";
import { classifyPath } from "../updates/ownership";

describe("Route Contract", () => {
  it("verlinkt aus dem Basis-Install nur garantierte Ziele", () => {
    const violations = findViolations(baseInstallFiles());
    expect(violations).toEqual([]);
  });

  it("akzeptiert nur Basis-Präfixe und die Kunden-Startseite", () => {
    expect(isGuaranteedTarget("/")).toBe(true);
    expect(isGuaranteedTarget("/app/login")).toBe(true);
    expect(isGuaranteedTarget("/api/public/store/v1")).toBe(true);
    for (const target of ["/auth", "/store", "/portal", "/dokumentation", "/login"]) {
      expect(isGuaranteedTarget(target), target).toBe(false);
    }
  });
});

describe("Optionales Portal", () => {
  it("gehört nicht zur Basisinstallation", () => {
    for (const path of [
      "src/eyis/portal/PortalChrome.tsx",
      "src/eyis/portal/PortalOrderView.tsx",
      "src/routes/portal/index.tsx",
    ]) {
      expect(classifyPath(path), path).toBe("optional");
    }
  });

  it("wird von keiner Basis-Install-Datei importiert", () => {
    const offenders = baseInstallFiles().filter((file) => {
      const source = require("node:fs").readFileSync(file, "utf8") as string;
      return /from ["']@\/eyis\/portal\//.test(source);
    });
    expect(offenders).toEqual([]);
  });
});

describe("Generierte Plattformdateien", () => {
  it("werden nicht von EYIS ausgeliefert, sondern vorausgesetzt", () => {
    expect(classifyPath("src/integrations/lovable/index.ts")).toBe("generated");
    expect(classifyPath("src/integrations/supabase/types.ts")).toBe("generated");
    expect(existsSync("src/integrations/lovable/index.ts")).toBe(true);
  });
});
