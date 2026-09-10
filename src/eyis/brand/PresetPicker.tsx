/** Auswahl fertiger Farb-/Schriftkombinationen für die Storefront. */
import { brandingPresets, fontPairs, type BrandingPreset } from "./storefront-presets";

type Props = {
  activeId: string | null;
  onSelect: (preset: BrandingPreset) => void;
};

export function PresetPicker({ activeId, onSelect }: Props) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {brandingPresets.map((preset) => {
        const pair = fontPairs.find((f) => f.id === preset.fontPairId);
        const active = activeId === preset.id;
        const c = preset.colors;
        return (
          <button
            type="button"
            key={preset.id}
            onClick={() => onSelect(preset)}
            aria-pressed={active}
            className={`rounded-lg border p-3 text-left transition-colors ${
              active ? "border-primary ring-2 ring-primary/40" : "border-border hover:border-primary/60"
            }`}
          >
            <div
              className="rounded-md border p-3"
              style={{
                backgroundColor: c.colorBackground,
                borderColor: c.colorBorder,
                color: c.colorForeground,
              }}
            >
              <span
                className="block text-sm leading-tight"
                style={{ fontFamily: pair?.display, color: c.colorForeground }}
              >
                Überschrift
              </span>
              <span
                className="mt-1 block text-xs opacity-80"
                style={{ fontFamily: pair?.body }}
              >
                Beispieltext im Shop
              </span>
              <span
                className="mt-2 inline-block rounded px-2 py-1 text-[11px]"
                style={{ backgroundColor: c.colorAccent, color: c.colorAccentForeground }}
              >
                In den Warenkorb
              </span>
            </div>
            <div className="mt-2 flex items-center gap-1">
              {[c.colorBackground, c.colorSurface, c.colorAccent, c.colorDeep].map((color) => (
                <span
                  key={color}
                  aria-hidden
                  className="h-4 w-4 rounded-full border border-border"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
            <p className="mt-2 text-sm font-medium">{preset.label}</p>
            <p className="text-xs text-muted-foreground">
              {preset.description} · {pair?.label}
            </p>
          </button>
        );
      })}
    </div>
  );
}
