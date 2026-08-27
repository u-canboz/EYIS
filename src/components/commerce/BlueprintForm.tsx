import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import type {
  BlueprintData,
  BlueprintField,
  BlueprintSchema,
} from "@/lib/commerce/blueprint-types";
import { isFieldVisible } from "@/lib/commerce/blueprint-types";

type Props = {
  schema: BlueprintSchema;
  value: BlueprintData;
  onChange: (next: BlueprintData) => void;
  /** Only render these group keys; renders all when omitted. */
  groupKeys?: string[];
};

/** Renders a blueprint schema as a form — fully data driven, no hardcoded fields. */
export function BlueprintForm({ schema, value, onChange, groupKeys }: Props) {
  const groups = (schema.groups ?? []).filter((g) => !groupKeys || groupKeys.includes(g.key));
  if (groups.length === 0) return null;

  const set = (key: string, next: unknown) => onChange({ ...value, [key]: next });

  return (
    <Accordion type="multiple" defaultValue={groups.map((g) => g.key)} className="w-full">
      {groups.map((group) => (
        <AccordionItem key={group.key} value={group.key}>
          <AccordionTrigger className="text-left">
            <span>
              <span className="font-medium">{group.label}</span>
              {group.description && (
                <span className="block text-xs font-normal text-muted-foreground">
                  {group.description}
                </span>
              )}
            </span>
          </AccordionTrigger>
          <AccordionContent>
            <div className="grid gap-5 pt-1 sm:grid-cols-2">
              {(group.fields ?? [])
                .filter((field) => field.type !== "option_axis" && isFieldVisible(field, value))
                .map((field) => (
                  <FieldControl
                    key={field.key}
                    field={field}
                    value={value[field.key]}
                    onChange={(next) => set(field.key, next)}
                  />
                ))}
            </div>
          </AccordionContent>
        </AccordionItem>
      ))}
    </Accordion>
  );
}

function FieldControl({
  field,
  value,
  onChange,
}: {
  field: BlueprintField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  const wide = ["textarea", "richtext", "key_value", "repeater", "multiselect", "tags"].includes(
    field.type,
  );

  return (
    <div className={wide ? "sm:col-span-2" : ""}>
      <Label className="text-sm">
        {field.label}
        {field.required && <span className="ml-1 text-destructive">*</span>}
      </Label>
      {field.description && (
        <p className="mt-0.5 text-xs text-muted-foreground">{field.description}</p>
      )}
      <div className="mt-2">
        <Control field={field} value={value} onChange={onChange} />
      </div>
    </div>
  );
}

function Control({
  field,
  value,
  onChange,
}: {
  field: BlueprintField;
  value: unknown;
  onChange: (next: unknown) => void;
}) {
  switch (field.type) {
    case "textarea":
    case "richtext":
      return (
        <Textarea
          rows={field.type === "richtext" ? 6 : 3}
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
        />
      );

    case "boolean":
      return (
        <div className="flex h-9 items-center">
          <Switch checked={Boolean(value)} onCheckedChange={onChange} />
        </div>
      );

    case "number":
    case "measurement":
      return (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="decimal"
            value={value === undefined || value === null ? "" : String(value)}
            min={field.min}
            max={field.max}
            onChange={(e) => onChange(e.target.value === "" ? null : Number(e.target.value))}
          />
          {field.unit && <span className="text-sm text-muted-foreground">{field.unit}</span>}
        </div>
      );

    case "select":
      return (
        <Select value={String(value ?? "")} onValueChange={onChange}>
          <SelectTrigger aria-label="Bitte wählen">
            <SelectValue placeholder="Bitte wählen" />
          </SelectTrigger>
          <SelectContent>
            {(field.options ?? []).map((option) => (
              <SelectItem key={option} value={option}>
                {option}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );

    case "multiselect": {
      const selected = Array.isArray(value) ? (value as string[]) : [];
      return (
        <div className="flex flex-wrap gap-3">
          {(field.options ?? []).map((option) => (
            <label key={option} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(option)}
                onCheckedChange={(checked) =>
                  onChange(checked ? [...selected, option] : selected.filter((v) => v !== option))
                }
              />
              {option}
            </label>
          ))}
        </div>
      );
    }

    case "tags": {
      const tags = Array.isArray(value) ? (value as string[]) : [];
      return (
        <Input
          value={tags.join(", ")}
          placeholder="Mit Komma trennen"
          onChange={(e) =>
            onChange(
              e.target.value
                .split(",")
                .map((v) => v.trim())
                .filter(Boolean),
            )
          }
        />
      );
    }

    case "color":
      return (
        <div className="flex items-center gap-2">
          <Input
            type="color"
            className="h-9 w-14 p-1"
            value={String(value ?? "#000000")}
            onChange={(e) => onChange(e.target.value)}
          />
          <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />
        </div>
      );

    case "key_value": {
      const rows = Array.isArray(value) ? (value as { key: string; value: string }[]) : [];
      return (
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex gap-2">
              <Input
                placeholder="Bezeichnung"
                value={row.key}
                onChange={(e) =>
                  onChange(rows.map((r, i) => (i === index ? { ...r, key: e.target.value } : r)))
                }
              />
              <Input
                placeholder="Wert"
                value={row.value}
                onChange={(e) =>
                  onChange(rows.map((r, i) => (i === index ? { ...r, value: e.target.value } : r)))
                }
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                Entfernen
              </Button>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onChange([...rows, { key: "", value: "" }])}
          >
            Zeile hinzufügen
          </Button>
        </div>
      );
    }

    case "repeater": {
      const rows = Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
      const subFields = field.fields ?? [];
      return (
        <div className="space-y-3">
          {rows.map((row, index) => (
            <div key={index} className="rounded-md border p-3">
              <div className="grid gap-3 sm:grid-cols-2">
                {subFields.map((sub) => (
                  <FieldControl
                    key={sub.key}
                    field={sub}
                    value={row[sub.key]}
                    onChange={(next) =>
                      onChange(rows.map((r, i) => (i === index ? { ...r, [sub.key]: next } : r)))
                    }
                  />
                ))}
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-2"
                onClick={() => onChange(rows.filter((_, i) => i !== index))}
              >
                Eintrag entfernen
              </Button>
            </div>
          ))}
          <Button type="button" variant="outline" size="sm" onClick={() => onChange([...rows, {}])}>
            Eintrag hinzufügen
          </Button>
        </div>
      );
    }

    default:
      return <Input value={String(value ?? "")} onChange={(e) => onChange(e.target.value)} />;
  }
}
