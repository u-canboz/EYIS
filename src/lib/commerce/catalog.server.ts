/** Server-only helpers for the catalog (phase 1). */
import type { BlueprintData, BlueprintField, BlueprintSchema } from "./blueprint-types";
import { isFieldVisible } from "./blueprint-types";
import { slugify } from "./core.server";

type Client = {
  from: (table: string) => any;
};

/** Deterministic signature of an option combination, used for uniqueness. */
export function optionSignature(pairs: { optionKey: string; value: string }[]) {
  return pairs
    .map((p) => `${p.optionKey}:${p.value}`)
    .sort((a, b) => a.localeCompare(b))
    .join("|");
}

export function cartesian<T>(lists: T[][]): T[][] {
  return lists.reduce<T[][]>(
    (acc, list) => acc.flatMap((row) => list.map((v) => [...row, v])),
    [[]],
  );
}

/** Finds a free handle within a shop. */
export async function uniqueHandle(
  supabase: Client,
  table: "products" | "categories" | "collections",
  shopId: string,
  desired: string,
  excludeId?: string,
) {
  const base = slugify(desired) || "eintrag";
  for (let i = 0; i < 50; i += 1) {
    const candidate = i === 0 ? base : `${base}-${i + 1}`;
    let query = supabase
      .from(table)
      .select("id")
      .eq("shop_id", shopId)
      .eq("handle", candidate)
      .limit(1);
    if (excludeId) query = query.neq("id", excludeId);
    const { data } = await query;
    if (!data || data.length === 0) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

/** Server-side validation of blueprint_data against the stored schema. */
export function validateBlueprintData(schema: BlueprintSchema, data: BlueprintData) {
  const clean: BlueprintData = {};
  const errors: string[] = [];

  const visit = (field: BlueprintField) => {
    if (!isFieldVisible(field, data)) return;
    const value = data[field.key];
    const empty =
      value === undefined ||
      value === null ||
      value === "" ||
      (Array.isArray(value) && value.length === 0);

    if (empty) {
      if (field.required) errors.push(`${field.label} ist erforderlich.`);
      return;
    }

    switch (field.type) {
      case "number":
      case "measurement": {
        const num = typeof value === "number" ? value : Number(String(value).replace(",", "."));
        if (Number.isNaN(num)) {
          errors.push(`${field.label} muss eine Zahl sein.`);
          return;
        }
        if (field.min !== undefined && num < field.min) errors.push(`${field.label} ist zu klein.`);
        if (field.max !== undefined && num > field.max) errors.push(`${field.label} ist zu groß.`);
        clean[field.key] = num;
        return;
      }
      case "boolean":
        clean[field.key] = Boolean(value);
        return;
      case "select":
        if (field.options && !field.options.includes(String(value))) {
          errors.push(`${field.label} enthält einen unbekannten Wert.`);
          return;
        }
        clean[field.key] = String(value);
        return;
      case "multiselect":
      case "tags":
        clean[field.key] = (Array.isArray(value) ? value : [value]).map((v) => String(v));
        return;
      case "key_value":
        clean[field.key] = (Array.isArray(value) ? value : []).map((row) => ({
          key: String((row as { key?: unknown }).key ?? ""),
          value: String((row as { value?: unknown }).value ?? ""),
        }));
        return;
      case "repeater":
        clean[field.key] = Array.isArray(value) ? value : [];
        return;
      default:
        clean[field.key] = typeof value === "string" ? value : String(value);
    }
  };

  for (const group of schema.groups ?? []) for (const field of group.fields ?? []) visit(field);

  if (errors.length) throw new Error(errors.join(" "));
  return clean;
}
