/** Struktureller Schema-Fingerprint. Nur Struktur, niemals Daten oder Secrets. */

import { createHash } from "node:crypto";

import type { Schema } from "./introspect";

export const JOURNAL_TABLES = new Set(["eyis_installation_state", "eyis_installation_units"]);

export function normalize(schema: Schema) {
  const tables = schema.tables.filter((t) => !JOURNAL_TABLES.has(t.name));
  return {
    enums: schema.enums.map((e) => `${e.name}(${e.values.join(",")})`).sort(),
    tables: tables
      .map((t) => ({
        name: t.name,
        rls: t.rls,
        columns: t.columns.map((c) => `${c.name}:${c.type}:${c.not_null ? "NN" : "N"}`).sort(),
        constraints: t.constraints.map((c) => `${c.name}:${c.def}`).sort(),
      }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    foreignKeys: schema.foreignKeys
      .filter((f) => !JOURNAL_TABLES.has(f.table))
      .map((f) => `${f.table}:${f.name}:${f.def}`)
      .sort(),
    indexes: schema.indexes
      .filter((i) => !JOURNAL_TABLES.has(i.table))
      .map((i) => `${i.table}:${i.name}`)
      .sort(),
    functions: schema.functions.map((f) => f.identity).sort(),
    triggers: schema.triggers
      .filter((t) => !JOURNAL_TABLES.has(t.table))
      .map((t) => `${t.table}.${t.name}`)
      .sort(),
    policies: schema.policies
      .filter((p) => !JOURNAL_TABLES.has(p.table))
      .map((p) => `${p.table}.${p.name}:${p.cmd}:${p.roles.join("+")}`)
      .sort(),
    grants: schema.grants
      .filter((g) => !JOURNAL_TABLES.has(g.table))
      .map((g) => `${g.table}:${g.grantee}:${g.privilege}`)
      .sort(),
    // Ausführungsrechte gehören zur Sicherheitsstruktur: ohne sie wäre ein
    // Installationsstand mit offenen Funktionsrechten fingerprint-gleich.
    functionGrants: (schema.functionGrants ?? []).map((g) => `${g.identity}:${g.grantee}`).sort(),
  };
}

export function computeFingerprint(schema: Schema) {
  const normalized = normalize(schema);
  return { hash: createHash("sha256").update(JSON.stringify(normalized)).digest("hex"), normalized };
}

/** Strukturvergleich zweier normalisierter Schemata (für Verification-Reports). */
export function diffNormalized(expected: ReturnType<typeof normalize>, actual: ReturnType<typeof normalize>) {
  const problems: string[] = [];
  const compareList = (label: string, a: string[], b: string[]) => {
    const missing = a.filter((x) => !b.includes(x));
    const extra = b.filter((x) => !a.includes(x));
    if (missing.length) problems.push(`${label}: fehlt ${missing.slice(0, 5).join(", ")}${missing.length > 5 ? ` (+${missing.length - 5})` : ""}`);
    if (extra.length) problems.push(`${label}: unerwartet ${extra.slice(0, 5).join(", ")}${extra.length > 5 ? ` (+${extra.length - 5})` : ""}`);
  };
  compareList("enums", expected.enums, actual.enums);
  compareList("tables", expected.tables.map((t) => t.name), actual.tables.map((t) => t.name));
  compareList("functions", expected.functions, actual.functions);
  compareList("triggers", expected.triggers, actual.triggers);
  compareList("policies", expected.policies, actual.policies);
  compareList("grants", expected.grants, actual.grants);
  compareList("functionGrants", expected.functionGrants ?? [], actual.functionGrants ?? []);
  compareList("foreignKeys", expected.foreignKeys, actual.foreignKeys);
  compareList("indexes", expected.indexes, actual.indexes);
  for (const table of expected.tables) {
    const actualTable = actual.tables.find((t) => t.name === table.name);
    if (!actualTable) continue;
    if (actualTable.rls !== table.rls) problems.push(`rls: ${table.name} erwartet ${table.rls}`);
    compareList(`columns:${table.name}`, table.columns, actualTable.columns);
  }
  return problems;
}
