import { afterEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { compareVersions, parseVersion, isAutoUpdateAllowed } from "../versions";
import { parseSignedManifest } from "../release-manifest";
import { generateKeyPairSync, verify as verifyRsa } from "node:crypto";
import { findWorkflowRun, resolveGithubAuth } from "../github.server";
import { classifyPath } from "../ownership";
import type { ReleaseManifest } from "../types";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("Update regression cases", () => {
  it("sorts numeric prerelease identifiers according to SemVer", () => {
    expect(compareVersions("1.0.0-rc.10", "1.0.0-rc.9")).toBe(1);
    expect(compareVersions("1.0.0-beta.2", "1.0.0-beta.11")).toBe(-1);
    expect(compareVersions("1.0.0-alpha", "1.0.0-alpha.1")).toBe(-1);
    expect(compareVersions("1.0.0+build.1", "1.0.0+build.2")).toBe(0);
    for (const value of ["01.2.3", "1.2.3-rc.01", "1.2.3-."])
      expect(parseVersion(value)).toBeNull();
  });

  it("never treats an unrelated dispatch as this installation's update", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          workflow_runs: [
            {
              id: 22,
              display_title: "Unrelated nightly import",
              created_at: "2026-09-10T10:00:00Z",
            },
          ],
        }),
      ),
    );
    expect(await findWorkflowRun("owner/repo", "my-run", null, "2026-09-10T09:00:00Z")).toBeNull();
  });

  it("matches the explicit update correlation ID", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        Response.json({
          workflow_runs: [
            { id: 22, display_title: "Other dispatch" },
            {
              id: 23,
              display_title: "EYIS update my-run",
              status: "in_progress",
              conclusion: null,
              html_url: "https://github.com/owner/repo/actions/runs/23",
              created_at: "2026-09-10T10:00:00Z",
            },
          ],
        }),
      ),
    );
    expect((await findWorkflowRun("owner/repo", "my-run", null, "2026-09-10T09:00:00Z"))?.id).toBe(
      23,
    );
  });

  it("protects customer package files and lockfiles", () => {
    for (const path of [
      "package.json",
      "bun.lock",
      "bun.lockb",
      "src/routes/__root.tsx",
      "src/styles.css",
    ])
      expect(classifyPath(path)).not.toBe("eyis");
  });

  it("does not automatically downgrade or skip the minimum version", () => {
    const release = {
      version: "1.2.1",
      minFromVersion: "1.2.0",
      migrations: [],
    } as unknown as ReleaseManifest;
    expect(isAutoUpdateAllowed("patch", "1.2.2", release)).toBe(false);
    expect(isAutoUpdateAllowed("patch", "1.1.9", release)).toBe(false);
  });
});

describe("Actual published artifact format", () => {
  const source = {
    tag: "v1.0.0-rc.8",
    publishedAt: "2026-09-03T00:00:00Z",
    assets: [
      {
        name: "eyis-dedicated-1.0.0-rc.8.tar.gz",
        browserUrl:
          "https://github.com/u-canboz/EYIS/releases/download/v1.0.0-rc.8/eyis-dedicated-1.0.0-rc.8.tar.gz",
        size: 123,
      },
    ],
  };
  const legacy = {
    manifest: "eyis-release",
    version: "1.0.0-rc.8",
    channel: "prerelease",
    artifact: { name: source.assets[0]!.name, sha256: "a".repeat(64), bytes: 123 },
    files: [{ path: "supabase/migrations/001.sql" }],
  };

  it("discovers legacy signed packs and explains missing upgrade metadata", () => {
    const parsed = parseSignedManifest(JSON.stringify(legacy), source);
    expect(parsed).toMatchObject({
      version: "1.0.0-rc.8",
      channel: "beta",
      requiresManualStep: true,
      migrations: ["supabase/migrations/001.sql"],
    });
    expect(parsed.artifact.url).toBe(source.assets[0]!.browserUrl);
  });
  it("rejects a mismatched tag or artifact", () => {
    expect(() => parseSignedManifest(JSON.stringify(legacy), { ...source, tag: "v1.0.0" })).toThrow(
      "Release-Tag",
    );
    expect(() => parseSignedManifest(JSON.stringify(legacy), { ...source, assets: [] })).toThrow(
      "Artefakt",
    );
  });
  it("accepts an explicit signed upgrade contract", () => {
    const parsed = parseSignedManifest(
      JSON.stringify({
        ...legacy,
        minFromVersion: "1.0.0-rc.7",
        migrations: [],
        seedVersion: 1,
        requiresManualStep: false,
      }),
      source,
    );
    expect(parsed.requiresManualStep).toBe(false);
  });
  it("uses an explicit correlation title in the customer workflow", () => {
    expect(
      readFileSync("templates/customer-repo/.github/workflows/eyis-update.yml", "utf8"),
    ).toContain("run-name: EYIS update ${{ github.event.client_payload.correlation_id }}");
  });
});

import { missingWorkflowEvidence } from "../workflow-evidence";
describe("Workflow completion proof", () => {
  const success = (name: string) => ({ name, status: "completed", conclusion: "success" });
  it("requires the actual code, database and deployment jobs", () => {
    expect(missingWorkflowEvidence([success("code"), success("deploy")], true)).toEqual([
      "database",
    ]);
    expect(missingWorkflowEvidence([success("code"), success("deploy")], false)).toEqual([]);
    expect(
      missingWorkflowEvidence([success("code"), success("database"), success("deploy")], true),
    ).toEqual([]);
  });
  it("does not confuse steps or skipped jobs with completed jobs", () => {
    expect(
      missingWorkflowEvidence(
        [success("code / deploy"), { name: "deploy", status: "completed", conclusion: "skipped" }],
        false,
      ),
    ).toEqual(["code", "deploy"]);
  });
});

import {
  promotionPayloadDigest,
  isSameReleaseLine,
} from "../../../../../scripts/installer/promotion";
describe("Stable promotion without self-referential digests", () => {
  const files = [
    { path: "src/lib/commerce/core.server.ts", sha256: "a".repeat(64), bytes: 10 },
    {
      path: "installer/distribution/eyis-release-promotion.json",
      sha256: "b".repeat(64),
      bytes: 20,
    },
  ];
  it("allows only release envelopes to change", () => {
    expect(promotionPayloadDigest(files)).toBe(
      promotionPayloadDigest([files[0]!, { ...files[1]!, sha256: "c".repeat(64) }]),
    );
    expect(promotionPayloadDigest(files)).not.toBe(
      promotionPayloadDigest([{ ...files[0]!, sha256: "c".repeat(64) }, files[1]!]),
    );
    expect(promotionPayloadDigest(files)).not.toBe(
      promotionPayloadDigest([
        ...files,
        { path: "supabase/migrations/new.sql", sha256: "d".repeat(64), bytes: 10 },
      ]),
    );
  });
  it("requires the same stable release line", () => {
    expect(isSameReleaseLine("1.0.0-rc.10", "1.0.0")).toBe(true);
    expect(isSameReleaseLine("1.0.0-rc.10", "1.1.0")).toBe(false);
    expect(isSameReleaseLine("1.0.0-beta.1", "1.0.0")).toBe(false);
  });
});

describe("GitHub App installation credentials", () => {
  it("accepts GitHub PKCS1 keys and scopes the token to one repository", async () => {
    const pair = generateKeyPairSync("rsa", { modulusLength: 2048 });
    vi.stubEnv("EYIS_GITHUB_APP_ID", "123");
    vi.stubEnv("EYIS_GITHUB_APP_INSTALLATION_ID", "456");
    vi.stubEnv(
      "EYIS_GITHUB_APP_PRIVATE_KEY",
      pair.privateKey.export({ type: "pkcs1", format: "pem" }).toString(),
    );
    vi.stubEnv("EYIS_UPDATE_REPO", "owner/customer");
    const fetch = vi.fn(async (_url: string, init: RequestInit) => {
      expect(JSON.parse(String(init.body))).toEqual({
        repositories: ["customer"],
        permissions: { contents: "write", actions: "write" },
      });
      const jwt = new Headers(init.headers).get("Authorization")!.replace("Bearer ", "");
      const parts = jwt.split(".");
      expect(
        verifyRsa(
          "RSA-SHA256",
          Buffer.from(parts.slice(0, 2).join(".")),
          pair.publicKey,
          Buffer.from(parts[2]!, "base64url"),
        ),
      ).toBe(true);
      return Response.json({ token: "test-only-token", expires_at: "2026-09-10T12:00:00Z" });
    });
    vi.stubGlobal("fetch", fetch);
    expect((await resolveGithubAuth()).mode).toBe("github_app");
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("does not request an unrestricted installation token", async () => {
    vi.stubEnv("EYIS_GITHUB_APP_ID", "123");
    vi.stubEnv("EYIS_GITHUB_APP_INSTALLATION_ID", "456");
    vi.stubEnv("EYIS_GITHUB_APP_PRIVATE_KEY", "test-only-invalid-key");
    vi.stubEnv("EYIS_UPDATE_REPO", "");
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    expect((await resolveGithubAuth()).token).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });
});

import { normalizeStorefrontOrigin, setupBlockers } from "../../system/setup-contract";
describe("Installation completion", () => {
  it("does not allow pending system checks to be marked complete", () => {
    expect(
      setupBlockers([
        { check: "Setup", status: "SETUP REQUIRED" },
        { check: "Database", status: "PASS" },
        { check: "Cron", status: "SETUP REQUIRED" },
      ]),
    ).toEqual([{ check: "Cron", status: "SETUP REQUIRED" }]);
  });
  it("normalizes storefront origins and rejects unsafe or unknown-environment URLs", () => {
    expect(normalizeStorefrontOrigin("https://shop.example.test/store", "production")).toBe(
      "https://shop.example.test",
    );
    expect(normalizeStorefrontOrigin("http://127.0.0.1:8080/store", "development")).toBe(
      "http://127.0.0.1:8080",
    );
    for (const [url, env] of [
      ["javascript:alert(1)", "development"],
      ["https://user:password@shop.example.test", "development"],
      ["http://shop.example.test", "production"],
      ["https://shop.example.test", "unknown"],
    ])
      expect(() => normalizeStorefrontOrigin(url!, env!)).toThrow();
  });
});
