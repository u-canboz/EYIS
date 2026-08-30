import { describe, expect, it } from "vitest";
import {
  compareVersions,
  channelsFor,
  isAutoUpdateAllowed,
  isNewer,
  parseVersion,
  selectCandidate,
  upgradeType,
} from "../updates/versions";
import { classifyPath, partitionPaths } from "../updates/ownership";
import { canTransition, UPDATE_STEPS, type ReleaseManifest } from "../updates/types";

function release(partial: Partial<ReleaseManifest>): ReleaseManifest {
  return {
    releaseId: partial.releaseId ?? `rel_${partial.version}`,
    version: partial.version ?? "1.1.0",
    channel: partial.channel ?? "stable",
    publishedAt: "2026-01-01T00:00:00.000Z",
    minFromVersion: partial.minFromVersion ?? "1.0.0",
    migrations: partial.migrations ?? [],
    seedVersion: partial.seedVersion ?? 1,
    requiresManualStep: partial.requiresManualStep,
    securityRelease: partial.securityRelease,
    artifact: { url: "https://example.invalid/a.tgz", sha256: "deadbeef" },
  };
}

describe("Update-Versionen", () => {
  it("parst und vergleicht semantische Versionen", () => {
    expect(parseVersion("v1.2.3")).toEqual({ major: 1, minor: 2, patch: 3, pre: null });
    expect(compareVersions("1.2.3", "1.10.0")).toBe(-1);
    expect(compareVersions("2.0.0", "2.0.0")).toBe(0);
    expect(compareVersions("1.0.0", "1.0.0-beta.1")).toBe(1);
    expect(isNewer("1.1.0", "1.0.9")).toBe(true);
  });

  it("beschränkt Kanäle korrekt", () => {
    expect(channelsFor("stable")).toEqual(["stable"]);
    expect(channelsFor("beta")).toContain("beta");
    expect(channelsFor("beta")).not.toContain("development");
  });

  it("wählt das nächste anwendbare Release und blockt Sprünge", () => {
    const releases = [
      release({ version: "1.1.0", minFromVersion: "1.0.0" }),
      release({ version: "2.0.0", minFromVersion: "1.1.0" }),
      release({ version: "1.2.0-beta.1", channel: "beta", minFromVersion: "1.1.0" }),
    ];
    const stable = selectCandidate(releases, "1.0.0", "stable");
    expect(stable.candidate?.version).toBe("1.1.0");

    const jump = selectCandidate([release({ version: "2.0.0", minFromVersion: "1.9.0" })], "1.0.0", "stable");
    expect(jump.candidate).toBeNull();
    expect(jump.blockedBy?.version).toBe("2.0.0");

    const beta = selectCandidate(releases, "1.1.0", "beta");
    expect(beta.candidate?.version).toBe("1.2.0-beta.1");
  });

  it("erlaubt automatische Updates nur ohne Migrationen", () => {
    expect(upgradeType("1.0.0", "1.0.1")).toBe("patch");
    expect(isAutoUpdateAllowed("manual", "1.0.0", release({ version: "1.0.1" }))).toBe(false);
    expect(isAutoUpdateAllowed("patch", "1.0.0", release({ version: "1.0.1" }))).toBe(true);
    expect(
      isAutoUpdateAllowed("patch", "1.0.0", release({ version: "1.0.1", migrations: ["m1.sql"] })),
    ).toBe(false);
    expect(isAutoUpdateAllowed("security_only", "1.0.0", release({ version: "1.0.1" }))).toBe(false);
    expect(
      isAutoUpdateAllowed("security_only", "1.0.0", release({ version: "1.0.1", securityRelease: true })),
    ).toBe(true);
  });
});

describe("Ownership-Grenze", () => {
  it("erkennt EYIS-Dateien", () => {
    expect(classifyPath("src/lib/commerce/orders/orders.server.ts")).toBe("eyis");
    expect(classifyPath("supabase/migrations/2026_x.sql")).toBe("eyis");
  });

  it("schützt Kundendateien auch innerhalb von EYIS-Pfaden", () => {
    expect(classifyPath("src/routes/store/index.tsx")).toBe("customer");
    expect(classifyPath(".env.production")).toBe("customer");
    expect(classifyPath("src/custom/etwas.ts")).toBe("customer");
  });

  it("lässt unbekannte Dateien unangetastet", () => {
    const result = partitionPaths([
      "src/lib/commerce/a.ts",
      "src/routes/store/b.tsx",
      "README.md",
    ]);
    expect(result.replace).toEqual(["src/lib/commerce/a.ts"]);
    expect(result.protected).toEqual(["src/routes/store/b.tsx"]);
    expect(result.unmanaged).toEqual(["README.md"]);
  });

  it("installiert Referenz-/Marketinginhalte niemals in ein Kundenprojekt", () => {
    expect(classifyPath("src/routes/index.tsx")).toBe("reference_only");
    expect(classifyPath("src/components/site/CodeBlock.tsx")).toBe("reference_only");
    expect(classifyPath("src/routes/entwickler.tsx")).toBe("reference_only");
    const result = partitionPaths(["src/routes/index.tsx", "src/lib/commerce/a.ts"]);
    expect(result.replace).toEqual(["src/lib/commerce/a.ts"]);
    expect(result.referenceOnly).toEqual(["src/routes/index.tsx"]);
  });
});


describe("Update-Zustandsmaschine", () => {
  it("kennt die sechs sichtbaren Schritte", () => {
    expect([...UPDATE_STEPS]).toEqual(["preflight", "backup", "code", "database", "deployment", "doctor"]);
  });

  it("erlaubt nur definierte Übergänge", () => {
    expect(canTransition("preflight", "ready")).toBe(true);
    expect(canTransition("preflight", "completed")).toBe(false);
    expect(canTransition("deploying", "migrating")).toBe(true);
    expect(canTransition("completed", "deploying")).toBe(false);
    expect(canTransition("verifying", "completed")).toBe(true);
  });
});
