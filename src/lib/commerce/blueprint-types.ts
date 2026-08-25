/** Client-safe types for the data-driven blueprint engine. */

export type BlueprintFieldType =
  | "text"
  | "textarea"
  | "richtext"
  | "number"
  | "boolean"
  | "select"
  | "multiselect"
  | "tags"
  | "color"
  | "measurement"
  | "key_value"
  | "repeater"
  | "media"
  | "option_axis";

export type VisibilityCondition = {
  field: string;
  equals?: string | number | boolean;
  in?: (string | number)[];
};

export type BlueprintField = {
  key: string;
  type: BlueprintFieldType;
  label: string;
  description?: string;
  required?: boolean;
  default?: unknown;
  unit?: string;
  options?: string[];
  min?: number;
  max?: number;
  fields?: BlueprintField[];
  visible_if?: VisibilityCondition;
};

export type BlueprintGroup = {
  key: string;
  label: string;
  description?: string;
  fields: BlueprintField[];
};

export type BlueprintSchema = { groups: BlueprintGroup[] };

export type VariantAxis = {
  key: string;
  name: string;
  display_type?: string;
  presets?: string[];
  allow_custom?: boolean;
};

export type VariantSchema = { axes: VariantAxis[] };

export type Blueprint = {
  id: string;
  key: string;
  name: string;
  description: string | null;
  icon: string | null;
  version: number;
  is_system: boolean;
  organization_id: string | null;
  schema: BlueprintSchema;
  variant_schema: VariantSchema;
};

export type BlueprintData = Record<string, unknown>;

export function isFieldVisible(field: BlueprintField, data: BlueprintData) {
  const cond = field.visible_if;
  if (!cond) return true;
  const value = data[cond.field];
  if (cond.in) return cond.in.includes(value as string);
  if (cond.equals !== undefined) return value === cond.equals;
  return true;
}

/** Groups blueprints for the "Was möchten Sie verkaufen?" step. */
export const BLUEPRINT_GROUPS: { label: string; keys: string[] }[] = [
  { label: "Allgemein", keys: ["standard"] },
  { label: "Physische Waren", keys: ["textil", "lebensmittel", "kosmetik", "elektronik", "moebel", "schmuck"] },
  { label: "Ohne Versand", keys: ["digital", "dienstleistung"] },
];
