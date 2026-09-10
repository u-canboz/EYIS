/** Farbfeld mit nativem Farbwähler und synchronem Hex-Eingabefeld. */
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isHexColor, normalizeHex } from "./storefront-presets";

type Props = {
  id: string;
  label: string;
  hint: string;
  value: string;
  onChange: (value: string) => void;
};

export function ColorField({ id, label, hint, value, onChange }: Props) {
  const valid = value.trim() === "" || isHexColor(value);
  const pickerValue = normalizeHex(value, normalizeHex(hint, "#FFFFFF"));

  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${label} auswählen`}
          value={pickerValue}
          onChange={(e) => onChange(e.target.value.toUpperCase())}
          className="h-9 w-9 shrink-0 cursor-pointer rounded-md border border-border bg-transparent p-1"
        />
        <Input
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={hint}
          aria-invalid={!valid}
        />
      </div>
      {!valid ? (
        <p className="text-xs text-destructive">Bitte einen Hex-Wert wie {hint} eintragen.</p>
      ) : null}
    </div>
  );
}
