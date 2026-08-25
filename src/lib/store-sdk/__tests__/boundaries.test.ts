/**
 * Statischer Grenztest: Reference Storefront und SDK dürfen ausschließlich
 * die öffentliche Store API nutzen — keine internen Commerce-Module, keinen
 * Supabase-Client und keine *.server / *.functions Module.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["src/routes/store", "src/lib/store-sdk", "src/components/storefront"];

const FORBIDDEN: { pattern: RegExp; reason: string }[] = [
  { pattern: /@\/lib\/commerce\//, reason: "internes Commerce-Modul" },
  { pattern: /@\/integrations\/supabase/, reason: "Supabase-Client" },
  { pattern: /@supabase\//, reason: "Supabase-Paket" },
  { pattern: /\.server(\.[tj]sx?)?["']/, reason: "Server-Modul" },
  { pattern: /\.functions(\.[tj]sx?)?["']/, reason: "Server-Function-Modul" },
];

function walk(dir: string): string[] {
  let out: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out = out.concat(walk(full));
    else if (/\.tsx?$/.test(entry) && !full.includes("__tests__")) out.push(full);
  }
  return out;
}

const importLines = (source: string) =>
  source
    .split("\n")
    .filter(
      (line) => /^\s*(import|export)\s.*from\s+['"]/.test(line) || /\bimport\(['"]/.test(line),
    );

describe("storefront import boundaries", () => {
  const files = ROOTS.flatMap(walk);

  it("findet die zu prüfenden Dateien", () => {
    expect(files.length).toBeGreaterThan(0);
  });

  it.each(files)("%s importiert nichts Internes", (file) => {
    const violations: string[] = [];
    for (const line of importLines(readFileSync(file, "utf8"))) {
      for (const rule of FORBIDDEN) {
        if (rule.pattern.test(line)) violations.push(`${rule.reason}: ${line.trim()}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
