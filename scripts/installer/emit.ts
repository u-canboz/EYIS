/** Erzeugt deterministisches DDL aus der Introspektion. Ausschließlich Struktur. */

import type { GrantDef, PolicyDef, Schema, TableDef } from "./introspect";

export type Statement = { sql: string; object: string; kind: string; table?: string };

const qi = (name: string) => `"${name}"`;

export function emitExtensions(schema: Schema): Statement[] {
  return schema.extensions.map((e) => ({
    kind: "extension",
    object: e.name,
    sql: `CREATE EXTENSION IF NOT EXISTS ${qi(e.name)} WITH SCHEMA ${qi(e.schema)};`,
  }));
}

export function emitEnums(schema: Schema): Statement[] {
  return schema.enums.map((e) => ({
    kind: "enum",
    object: e.name,
    sql: `CREATE TYPE public.${qi(e.name)} AS ENUM (\n  ${e.values
      .map((v) => `'${v.replace(/'/g, "''")}'`)
      .join(",\n  ")}\n);`,
  }));
}

function columnLine(c: TableDef["columns"][number]) {
  const parts = [`  ${qi(c.name)} ${c.type}`];
  if (c.identity) parts.push(`GENERATED ${c.identity} AS IDENTITY`);
  else if (c.default) parts.push(`DEFAULT ${c.default}`);
  if (c.not_null) parts.push("NOT NULL");
  return parts.join(" ");
}

export function emitTable(t: TableDef): Statement {
  const lines = t.columns.map(columnLine);
  for (const c of [...t.constraints].sort((a, b) => a.name.localeCompare(b.name))) {
    lines.push(`  CONSTRAINT ${qi(c.name)} ${c.def}`);
  }
  return {
    kind: "table",
    object: t.name,
    table: t.name,
    sql: `CREATE TABLE public.${qi(t.name)} (\n${lines.join(",\n")}\n);`,
  };
}

export function emitForeignKeys(schema: Schema): Statement[] {
  return schema.foreignKeys.map((f) => ({
    kind: "foreign_key",
    object: f.name,
    table: f.table,
    sql: `ALTER TABLE public.${qi(f.table)} ADD CONSTRAINT ${qi(f.name)} ${f.def};`,
  }));
}

export function emitIndexes(schema: Schema): Statement[] {
  return schema.indexes.map((i) => ({
    kind: "index",
    object: i.name,
    table: i.table,
    sql: `${i.def};`,
  }));
}

export function emitFunctions(schema: Schema): Statement[] {
  return schema.functions.map((f) => ({
    kind: "function",
    object: f.identity,
    sql: `${f.def.trimEnd().replace(/;$/, "")};`,
  }));
}

export function emitTriggers(schema: Schema): Statement[] {
  return schema.triggers.map((t) => ({
    kind: "trigger",
    object: `${t.table}.${t.name}`,
    table: t.table,
    sql: `${t.def};`,
  }));
}

export function emitRls(schema: Schema): Statement[] {
  return schema.tables
    .filter((t) => t.rls)
    .map((t) => ({
      kind: "rls",
      object: t.name,
      table: t.name,
      sql: `ALTER TABLE public.${qi(t.name)} ENABLE ROW LEVEL SECURITY;`,
    }));
}

export function emitPolicy(p: PolicyDef): Statement {
  const parts = [`CREATE POLICY ${qi(p.name)} ON public.${qi(p.table)}`];
  parts.push(`  AS ${p.permissive === "PERMISSIVE" ? "PERMISSIVE" : "RESTRICTIVE"}`);
  parts.push(`  FOR ${p.cmd}`);
  parts.push(`  TO ${p.roles.join(", ")}`);
  if (p.qual) parts.push(`  USING (${p.qual})`);
  if (p.with_check) parts.push(`  WITH CHECK (${p.with_check})`);
  return { kind: "policy", object: `${p.table}.${p.name}`, table: p.table, sql: `${parts.join("\n")};` };
}

export function emitGrants(grants: GrantDef[]): Statement[] {
  const byKey = new Map<string, Set<string>>();
  for (const g of grants) {
    const key = `${g.table}|${g.grantee}`;
    if (!byKey.has(key)) byKey.set(key, new Set());
    byKey.get(key)!.add(g.privilege);
  }
  return [...byKey.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, privs]) => {
      const [table, grantee] = key.split("|");
      const list = [...privs].sort().join(", ");
      return {
        kind: "grant",
        object: `${table}:${grantee}`,
        table,
        sql: `GRANT ${list} ON public.${qi(table)} TO ${grantee};`,
      };
    });
}

/**
 * Ausführungsrechte der Funktionen. Postgres vergibt EXECUTE per Default an
 * PUBLIC — ohne diesen Block wäre jede Funktion (auch SECURITY DEFINER) für
 * anon und authenticated aufrufbar. Der Pack entzieht das Recht explizit und
 * vergibt danach genau die in der Quelle vorhandenen Rechte.
 */
export function emitFunctionGrants(schema: Schema): Statement[] {
  const byIdentity = new Map<string, string[]>();
  for (const g of schema.functionGrants) {
    if (!byIdentity.has(g.identity)) byIdentity.set(g.identity, []);
    byIdentity.get(g.identity)!.push(g.grantee);
  }
  const statements: Statement[] = schema.functions
    .map((f) => f.identity)
    .sort((a, b) => a.localeCompare(b))
    .map((identity) => {
      const grantees = (byIdentity.get(identity) ?? []).sort();
      const lines = [
        `REVOKE ALL ON FUNCTION public.${identity} FROM PUBLIC;`,
        `REVOKE ALL ON FUNCTION public.${identity} FROM anon;`,
        `REVOKE ALL ON FUNCTION public.${identity} FROM authenticated;`,
      ];
      if (grantees.length) {
        lines.push(`GRANT EXECUTE ON FUNCTION public.${identity} TO ${grantees.join(", ")};`);
      }
      return { kind: "function_grant", object: identity, sql: lines.join("\n") };
    });
  statements.push({
    kind: "function_grant_default",
    object: "default_privileges",
    sql: "ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;",
  });
  return statements;
}
