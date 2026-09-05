/**
 * Regression zum Blackbox-Befund „öffentlich aufrufbare Funktionen mit
 * erweiterten Rechten": Der Fresh-Install-Pack muss jeder Funktion das
 * Postgres-Default-Recht (EXECUTE für PUBLIC) entziehen. Fehlt der Entzug für
 * auch nur eine Funktion, ist die Installation angreifbar.
 */
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

const BASELINE = join(process.cwd(), "installer", "database", "baseline");

function baselineSql() {
  return readdirSync(BASELINE)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(BASELINE, f), "utf8"))
    .join("\n");
}

/** Nur diese Funktionen dürfen von angemeldeten Nutzern aufgerufen werden. */
const ALLOWED_AUTHENTICATED = new Set([
  "can_view_profile",
  "current_org_ids",
  "has_org_role",
  "has_permission",
  "has_role",
  "health_run_checks",
  "is_org_member",
  "shares_org_with",
  "shop_in_org",
]);

describe("Ausführungsrechte der Datenbankfunktionen im Install Pack", () => {
  const sql = baselineSql();

  it("entzieht jeder erzeugten Funktion das Default-Recht für PUBLIC", () => {
    const created = [...sql.matchAll(/CREATE OR REPLACE FUNCTION public\.([a-z0-9_]+)\s*\(/gi)].map(
      (m) => String(m[1]).toLowerCase(),
    );
    const revoked = new Set(
      [...sql.matchAll(/REVOKE ALL ON FUNCTION public\.([a-z0-9_]+)\s*\(/gi)].map((m) =>
        String(m[1]).toLowerCase(),
      ),
    );
    const missing = [...new Set(created)].filter((fn) => !revoked.has(fn));
    expect(missing).toEqual([]);
  });

  it("gewährt angemeldeten Nutzern nur die freigegebenen Prüffunktionen", () => {
    const granted = [
      ...sql.matchAll(/GRANT EXECUTE ON FUNCTION public\.([a-z0-9_]+)\s*\([^)]*\)\s*TO ([^;]+);/gi),
    ]
      .filter((m) => /\b(anon|authenticated)\b/.test(String(m[2])))
      .map((m) => String(m[1]).toLowerCase());
    const unexpected = [...new Set(granted)].filter((fn) => !ALLOWED_AUTHENTICATED.has(fn));
    expect(unexpected).toEqual([]);
  });

  it("sperrt das Default-Recht auch für künftige Funktionen", () => {
    expect(sql).toContain(
      "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;",
    );
  });

  it("legt keine Erweiterung im öffentlichen Schema an", () => {
    expect(sql).not.toMatch(/CREATE EXTENSION[^;]*WITH SCHEMA "public"/i);
  });
});
