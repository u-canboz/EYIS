/**
 * Phase 25 — "Hardest Fixture": ein frisches Kundenprojekt.
 *
 * Simuliert eine Installation in ein bestehendes Kundenprojekt mit eigener
 * Startseite, eigenem Root-Layout und eigenem CSS. Geprüft wird offline und
 * ohne Datenbank, dass
 *   1. kein kundeneigener Pfad ersetzt wird,
 *   2. die Marketing-/Referenzseiten nicht installiert werden,
 *   3. die beiden Integrationspunkte additiv bleiben,
 *   4. EYIS keine Route ausserhalb der reservierten Präfixe einbringt.
 */
import { readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

import { isEyisInternalRoute } from "@/lib/eyis/route-boundary";
import { classifyPath, partitionPaths } from "../updates/ownership";

/** Dateien, die ein typisches Kundenprojekt bereits besitzt. */
const CUSTOMER_PROJECT = [
  "src/routes/index.tsx",
  "src/routes/__root.tsx",
  "src/routes/ueber-uns.tsx",
  "src/routes/kontakt.tsx",
  "src/styles.css",
  "src/theme/tokens.css",
  "src/content/home.md",
  "public/brand/logo.svg",
  ".env",
];

/** Dateien, die ein EYIS-Update mitbringt. */
const EYIS_DELIVERY = [
  "src/lib/commerce/cart.server.ts",
  "src/lib/store-sdk/client.ts",
  "src/lib/eyis/route-boundary.ts",
  "src/eyis/shell/AppShell.tsx",
  "src/routes/_authenticated/app/index.tsx",
  "src/routes/app.login.tsx",
  "src/routes/api/public/store/v1/$.ts",
  "supabase/migrations/20260101000000_x.sql",
  "installer/database/eyis-database-installer.manifest.json",
];

describe("Frisches Kundenprojekt", () => {
  it("ersetzt keine kundeneigene Datei", () => {
    const { replace } = partitionPaths([...CUSTOMER_PROJECT, ...EYIS_DELIVERY]);
    for (const path of CUSTOMER_PROJECT) {
      expect(replace).not.toContain(path);
    }
  });

  it("installiert die EYIS-Landingpage nicht", () => {
    expect(classifyPath("src/routes/index.tsx")).not.toBe("eyis");
    expect(classifyPath("src/components/site/CodeBlock.tsx")).not.toBe("eyis");
  });

  it("behandelt Root-Layout und CSS als additiven Integrationspunkt", () => {
    expect(classifyPath("src/routes/__root.tsx")).toBe("integration_patch");
    expect(classifyPath("src/styles.css")).toBe("integration_patch");
    const { integrationPatch, replace } = partitionPaths(CUSTOMER_PROJECT);
    expect(integrationPatch).toEqual(["src/routes/__root.tsx", "src/styles.css"]);
    expect(replace).toHaveLength(0);
  });

  it("ersetzt die EYIS-Lieferung vollständig", () => {
    const { replace } = partitionPaths(EYIS_DELIVERY);
    expect(replace).toEqual(EYIS_DELIVERY);
  });

  it("bringt keine Route ausserhalb der reservierten Präfixe ein", () => {
    const routes = readdirSync(join(process.cwd(), "src/routes"), { withFileTypes: true });
    const eyisOwned = routes
      .map((e) => e.name)
      .filter((name) => name.startsWith("app.") || name === "_authenticated" || name === "api");
    for (const name of eyisOwned) {
      const path = `/${name.replace(/\.tsx?$/, "").replace(/\./g, "/").replace("_authenticated/", "")}`;
      if (path === "/api" || path === "/_authenticated") continue;
      expect(isEyisInternalRoute(path)).toBe(true);
    }
  });

  it("hält kundennahe Pfade ausserhalb der EYIS-Grenze", () => {
    for (const path of ["/", "/ueber-uns", "/kontakt", "/apps", "/application", "/appointments"]) {
      expect(isEyisInternalRoute(path)).toBe(false);
    }
  });
});
