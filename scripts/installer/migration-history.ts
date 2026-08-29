/**
 * Auswertung der historischen Migrationskette.
 *
 * Liefert Migration Head, die Liste aller Versionen (für die
 * Migration-History-Reconciliation) und das historische Ownership-Inventar —
 * inklusive Objekte, die eine spätere Migration wieder entfernt hat.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const MIGRATIONS_DIR = join(process.cwd(), "supabase", "migrations");

export function migrationFiles() {
  return readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort();
}

export function migrationVersions() {
  return migrationFiles().map((f) => f.split("_")[0]);
}

export function migrationHead() {
  const files = migrationFiles();
  const last = files[files.length - 1];
  const version = last.split("_")[0];
  return { id: String(files.length).padStart(3, "0"), version, file: last, count: files.length };
}

function allSql() {
  return migrationFiles().map((f) => readFileSync(join(MIGRATIONS_DIR, f), "utf8"));
}

function matchAll(sql: string, re: RegExp) {
  return [...sql.matchAll(re)].map((m) => m[1].toLowerCase());
}

/** Tabellen, die die Migrationskette anlegt, abzüglich später gedroppter. */
export function tablesFromMigrations() {
  const created = new Set<string>();
  for (const sql of allSql()) {
    for (const name of matchAll(sql, /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.("?[\w]+"?)/gi)) {
      created.add(name.replace(/"/g, ""));
    }
    for (const name of matchAll(sql, /drop\s+table\s+(?:if\s+exists\s+)?public\.("?[\w]+"?)/gi)) {
      created.delete(name.replace(/"/g, ""));
    }
  }
  return created;
}

/**
 * Alles, was EYIS jemals angelegt hat — auch wenn es im aktuellen Schema
 * nicht mehr existiert. Grundlage für sicheres Partial-Install-Recovery.
 */
export function historicalOwnership() {
  const tables = new Set<string>();
  const types = new Set<string>();
  const functions = new Set<string>();
  const triggers = new Set<string>();
  for (const sql of allSql()) {
    for (const n of matchAll(sql, /create\s+table\s+(?:if\s+not\s+exists\s+)?public\.("?[\w]+"?)/gi))
      tables.add(n.replace(/"/g, ""));
    for (const n of matchAll(sql, /create\s+type\s+public\.("?[\w]+"?)/gi)) types.add(n.replace(/"/g, ""));
    for (const n of matchAll(sql, /create\s+(?:or\s+replace\s+)?function\s+public\.("?[\w]+"?)/gi))
      functions.add(n.replace(/"/g, ""));
    for (const n of matchAll(sql, /create\s+trigger\s+("?[\w]+"?)/gi)) triggers.add(n.replace(/"/g, ""));
  }
  return {
    tables: [...tables].sort(),
    types: [...types].sort(),
    functions: [...functions].sort(),
    triggers: [...triggers].sort(),
  };
}
