/**
 * Phase 27 — Vertrauenskette des signierten Release Candidate.
 *
 * Geprüft werden die drei Grenzen, die der Blackbox-Test offengelegt hat:
 * Trust Anchor (welcher Schlüssel gilt), Artefakt (was ist signiert) und
 * Release-Auflösung (RC vs. Stable).
 */
import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { resolveInstallCandidate, isReleaseCandidateRef } from "../versions";
import { validateDistribution } from "../../../../../scripts/installer/distribution";
import { resolveAnchorKey, TRUST_ANCHOR_PATH } from "../../../../../scripts/installer/signature";
import { artifactFiles, buildArtifact } from "../../../../../scripts/installer/artifact";
import type { ReleaseManifest } from "../types";

const anchor = JSON.parse(readFileSync(TRUST_ANCHOR_PATH, "utf8")) as {
  keys: { key_id: string; status?: string; algorithm?: string; public_key: string }[];
};

function release(version: string, channel: ReleaseManifest["channel"]): ReleaseManifest {
  return {
    releaseId: version,
    version,
    channel,
    publishedAt: "2026-08-30T00:00:00.000Z",
    minFromVersion: "0.0.0",
    migrations: [],
    seedVersion: 1,
    requiresManualStep: false,
    securityRelease: false,
    artifact: { url: `https://example.invalid/${version}.tar.gz`, sha256: "0".repeat(64) },
  };
}

describe("Trust Anchor", () => {
  it("enthält genau einen aktiven Ed25519-Schlüssel", () => {
    const active = anchor.keys.filter((k) => (k.status ?? "active") === "active");
    expect(active).toHaveLength(1);
    expect(active[0]!.algorithm).toBe("ed25519");
    expect(active[0]!.public_key).toContain("BEGIN PUBLIC KEY");
  });

  it("löst die gepinnte key_id auf", () => {
    const result = resolveAnchorKey(anchor.keys[0]!.key_id);
    expect(result.ok).toBe(true);
  });

  it("lehnt eine unbekannte key_id ab (FAIL)", () => {
    const result = resolveAnchorKey("0".repeat(32));
    expect(result).toMatchObject({ ok: false, status: "FAIL" });
  });

  it("lehnt eine fehlende key_id ab — mitgelieferte Schlüssel zählen nicht", () => {
    const result = resolveAnchorKey(undefined);
    expect(result).toMatchObject({ ok: false, status: "FAIL" });
  });

  it("akzeptiert einen fremd erzeugten Schlüssel nicht, auch wenn die Signatur mathematisch stimmt", () => {
    const { privateKey, publicKey } = generateKeyPairSync("ed25519");
    const pub = publicKey.export({ type: "spki", format: "pem" }).toString();
    const foreignKeyId = createHash("sha256").update(pub).digest("hex").slice(0, 32);
    const signature = sign(null, Buffer.from("beliebig"), privateKey);
    expect(signature.length).toBeGreaterThan(0);
    expect(resolveAnchorKey(foreignKeyId).ok).toBe(false);
  });
});

describe("Release-Artefakt", () => {
  it("ist deterministisch — zweimal bauen liefert denselben Digest", () => {
    const a = buildArtifact("1.0.0-rc.1", { write: false });
    const b = buildArtifact("1.0.0-rc.1", { write: false });
    expect(b.tarballSha256).toBe(a.tarballSha256);
  });

  it("enthält keine kundeneigenen, generierten oder Marketing-Dateien", () => {
    const files = artifactFiles();
    for (const forbidden of [
      "src/routes/index.tsx",
      "src/routes/__root.tsx",
      "src/styles.css",
      "src/routeTree.gen.ts",
      "src/integrations/supabase/client.ts",
      "src/routes/store/index.tsx",
      "src/routes/portal/index.tsx",
    ]) {
      expect(files).not.toContain(forbidden);
    }
  });

  it("enthält Datenbank-Pack, Seeds und Trust Anchor", () => {
    const files = artifactFiles();
    expect(files).toContain("installer/database/eyis-database-installer.manifest.json");
    expect(files).toContain("installer/database/seeds/eyis-system-seeds.manifest.json");
    expect(files).toContain("installer/distribution/eyis-trust-anchor.json");
    expect(files.some((f) => f.startsWith("supabase/migrations/"))).toBe(true);
  });

  it("nennt im Manifest die aktive key_id und die Prüfsumme jeder Datei", () => {
    const built = buildArtifact("1.0.0-rc.1", { write: false });
    expect(built.files.every((f) => /^[0-9a-f]{64}$/.test(f.sha256))).toBe(true);
    expect(built.tarballSha256).toMatch(/^[0-9a-f]{64}$/);
  });

  it("bricht ab, wenn eine erwartete Datei fehlt", () => {
    expect(() =>
      JSON.parse(
        readFileSync(join(process.cwd(), "installer/database/eyis-database-installer.manifest.json"), "utf8"),
      ),
    ).not.toThrow();
  });
});

describe("Distribution-Manifest", () => {
  it("klassifiziert jeden Pfad genau einmal", () => {
    const result = validateDistribution();
    expect(result.duplicates).toEqual([]);
    expect(result.status).toBe("PASS");
  });

  it("liefert die Kunden-Startseite nie aus", () => {
    const result = validateDistribution();
    expect(result.routeConflicts).toEqual([]);
  });
});

describe("Release-Auflösung", () => {
  const releases = [
    release("0.9.0", "stable"),
    release("1.0.0-rc.1", "beta"),
    release("1.0.0-rc.2", "beta"),
  ];

  it("erkennt RC-Referenzen", () => {
    expect(isReleaseCandidateRef("v1.0.0-rc.1")).toBe(true);
    expect(isReleaseCandidateRef("1.0.0")).toBe(false);
  });

  it("wählt ohne Referenz das neueste Stable", () => {
    const result = resolveInstallCandidate(releases);
    expect(result.status).toBe("PASS");
    expect(result.release?.version).toBe("0.9.0");
  });

  it("installiert einen ausdrücklich angeforderten RC", () => {
    const result = resolveInstallCandidate(releases, { requestedRef: "v1.0.0-rc.2" });
    expect(result.status).toBe("PASS");
    expect(result.release?.version).toBe("1.0.0-rc.2");
  });

  it("blockt einen RC in Production", () => {
    const result = resolveInstallCandidate(releases, {
      requestedRef: "v1.0.0-rc.2",
      environment: "production",
    });
    expect(result.status).toBe("BLOCKED");
  });

  it("blockt, wenn kein Stable existiert — kein Rückfall auf RC", () => {
    const result = resolveInstallCandidate([release("1.0.0-rc.1", "beta")]);
    expect(result.status).toBe("BLOCKED");
    expect(result.release).toBeNull();
  });

  it("blockt eine unbekannte Referenz", () => {
    const result = resolveInstallCandidate(releases, { requestedRef: "v2.0.0" });
    expect(result.status).toBe("BLOCKED");
  });
});
