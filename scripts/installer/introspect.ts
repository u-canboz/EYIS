/**
 * Schema-Introspektion für den EYIS Database Install Pack.
 *
 * Liest ausschließlich Strukturinformationen aus den Systemkatalogen der
 * aktuell verbundenen Datenbank. Es werden niemals Zeilen aus Fachtabellen,
 * Secrets oder Kundendaten gelesen.
 */

import { execFileSync } from "node:child_process";

export type Column = {
  name: string;
  type: string;
  not_null: boolean;
  default: string | null;
  identity: string | null;
  generated: string | null;
};

export type TableDef = {
  name: string;
  columns: Column[];
  constraints: { name: string; def: string; type: string }[];
  rls: boolean;
};

export type PolicyDef = {
  table: string;
  name: string;
  cmd: string;
  permissive: string;
  roles: string[];
  qual: string | null;
  with_check: string | null;
};

export type GrantDef = { table: string; grantee: string; privilege: string };

export type Schema = {
  extensions: { name: string; schema: string }[];
  enums: { name: string; values: string[] }[];
  tables: TableDef[];
  foreignKeys: { table: string; name: string; def: string }[];
  indexes: { table: string; name: string; def: string }[];
  functions: { name: string; identity: string; def: string }[];
  triggers: { table: string; name: string; def: string }[];
  policies: PolicyDef[];
  grants: GrantDef[];
  sequencesOwned: string[];
};

const PROTECTED_EXTENSION_SCHEMAS = new Set(["pg_catalog", "vault", "information_schema"]);

function q<T>(sql: string): T {
  const out = execFileSync("psql", ["-At", "-c", `select coalesce(json_agg(t), '[]'::json) from (${sql}) t`], {
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
  });
  return JSON.parse(out) as T;
}

/** Objekte, die einer Extension gehören, dürfen nicht in die Baseline. */
const EXTENSION_OWNED_FILTER = `
  not exists (
    select 1 from pg_depend d
    where d.objid = %OID% and d.deptype = 'e'
  )`;

export function introspect(): Schema {
  const extensions = q<{ name: string; schema: string }[]>(`
    select e.extname as name, n.nspname as schema
    from pg_extension e join pg_namespace n on n.oid = e.extnamespace
    where e.extname <> 'plpgsql'
    order by 1`);

  const enums = q<{ name: string; values: string[] }[]>(`
    select t.typname as name,
           (select json_agg(e.enumlabel order by e.enumsortorder)
              from pg_enum e where e.enumtypid = t.oid) as values
    from pg_type t
    join pg_namespace n on n.oid = t.typnamespace
    where n.nspname = 'public' and t.typtype = 'e'
      and ${EXTENSION_OWNED_FILTER.replace("%OID%", "t.oid")}
    order by 1`);

  const rawTables = q<{ name: string; rls: boolean }[]>(`
    select c.relname as name, c.relrowsecurity as rls
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
      and ${EXTENSION_OWNED_FILTER.replace("%OID%", "c.oid")}
    order by 1`);

  const columns = q<(Column & { table: string })[]>(`
    select c.relname as table, a.attname as name,
           format_type(a.atttypid, a.atttypmod) as type,
           a.attnotnull as not_null,
           pg_get_expr(d.adbin, d.adrelid) as default,
           case a.attidentity when 'a' then 'ALWAYS' when 'd' then 'BY DEFAULT' else null end as identity,
           case when a.attgenerated = 's' then pg_get_expr(d.adbin, d.adrelid) else null end as generated,
           a.attnum
    from pg_attribute a
    join pg_class c on c.oid = a.attrelid
    join pg_namespace n on n.oid = c.relnamespace
    left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
    where n.nspname = 'public' and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
    order by c.relname, a.attnum`);

  const constraints = q<{ table: string; name: string; def: string; type: string }[]>(`
    select c.relname as table, con.conname as name,
           pg_get_constraintdef(con.oid) as def, con.contype::text as type
    from pg_constraint con
    join pg_class c on c.oid = con.conrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
    order by c.relname, con.conname`);

  const tables: TableDef[] = rawTables.map((t) => ({
    name: t.name,
    rls: t.rls,
    columns: columns.filter((c) => c.table === t.name),
    constraints: constraints.filter((c) => c.table === t.name && c.type !== "f"),
  }));

  const foreignKeys = constraints
    .filter((c) => c.type === "f")
    .map((c) => ({ table: c.table, name: c.name, def: c.def }));

  const indexes = q<{ table: string; name: string; def: string }[]>(`
    select c.relname as table, i.relname as name, pg_get_indexdef(i.oid) as def
    from pg_index x
    join pg_class i on i.oid = x.indexrelid
    join pg_class c on c.oid = x.indrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and not exists (select 1 from pg_constraint con where con.conindid = i.oid)
    order by c.relname, i.relname`);

  const functions = q<{ name: string; identity: string; def: string }[]>(`
    select p.proname as name,
           p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as identity,
           pg_get_functiondef(p.oid) as def
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prokind in ('f','p')
      and ${EXTENSION_OWNED_FILTER.replace("%OID%", "p.oid")}
    order by 1, 2`);

  const triggers = q<{ table: string; name: string; def: string }[]>(`
    select c.relname as table, t.tgname as name, pg_get_triggerdef(t.oid) as def
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and not t.tgisinternal
    order by c.relname, t.tgname`);

  const policies = q<PolicyDef[]>(`
    select tablename as table, policyname as name, cmd, permissive,
           roles::text[] as roles, qual, with_check
    from pg_policies where schemaname = 'public'
    order by tablename, policyname`);

  const grants = q<GrantDef[]>(`
    select table_name as table, grantee, privilege_type as privilege
    from information_schema.role_table_grants
    where table_schema = 'public'
      and grantee in ('anon','authenticated','service_role')
    order by table_name, grantee, privilege_type`);

  return {
    extensions: extensions.filter((e) => !PROTECTED_EXTENSION_SCHEMAS.has(e.schema)),
    enums,
    tables,
    foreignKeys,
    indexes,
    functions,
    triggers,
    policies,
    grants,
    sequencesOwned: [],
  };
}
