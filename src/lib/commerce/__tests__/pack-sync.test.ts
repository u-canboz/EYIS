/**
 * Phase 26 — Regressionstest gegen einen veralteten Fresh-Install-Pack.
 *
 * Genau dieser Defekt hat den Blackbox-Test scheitern lassen: Migrationen im
 * Repository, die der Fresh Installer nicht kannte.
 */
import { describe, expect, it } from "vitest";

import {
  checkPackSync,
  migrationSetFingerprint,
  readMigrations,
  readPackManifest,
} from "../../../../scripts/installer/pack-sync";

describe("Database Pack Sync", () => {
  it("ist im Repository synchron", () => {
    const result = checkPackSync();
    expect(result.problems).toEqual([]);
    expect(result.status).toBe("PASS");
  });

  it("erkennt eine zusätzliche Migration als STALE", () => {
    const migrations = [
      ...readMigrations(),
      { version: "29990101000000", file: "29990101000000_x.sql", sha256: "deadbeef" },
    ];
    const result = checkPackSync(migrations, readPackManifest());
    expect(result.status).toBe("FAIL");
    expect(result.problems.join(" ")).toContain("DATABASE PACK STALE");
  });

  it("erkennt eine inhaltlich geänderte Migration über den Fingerprint", () => {
    const migrations = readMigrations();
    const tampered = migrations.map((m, i) => (i === 0 ? { ...m, sha256: "0".repeat(64) } : m));
    expect(migrationSetFingerprint(tampered)).not.toBe(migrationSetFingerprint(migrations));
    const result = checkPackSync(tampered, readPackManifest());
    expect(result.status).toBe("FAIL");
  });

  it("verlangt einen migration_set_fingerprint im Manifest", () => {
    const manifest = { ...readPackManifest(), migration_set_fingerprint: undefined };
    const result = checkPackSync(readMigrations(), manifest);
    expect(result.status).toBe("FAIL");
  });
});
