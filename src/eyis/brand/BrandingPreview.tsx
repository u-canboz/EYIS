/** Live-Vorschau der gewählten Farben und Schriften. */
import { contrastRatio } from "./storefront-presets";

type Props = {
  shopName: string;
  claim: string;
  logoUrl: string;
  colors: {
    colorBackground: string;
    colorForeground: string;
    colorSurface: string;
    colorBorder: string;
    colorAccent: string;
    colorAccentForeground: string;
    colorDeep: string;
  };
  fontDisplay: string;
  fontBody: string;
};

const fallback = {
  colorBackground: "#FFFFFF",
  colorForeground: "#1A1A1A",
  colorSurface: "#F5F3EF",
  colorBorder: "#E2DED7",
  colorAccent: "#B07A3C",
  colorAccentForeground: "#FFFFFF",
  colorDeep: "#243027",
};

export function BrandingPreview({
  shopName,
  claim,
  logoUrl,
  colors,
  fontDisplay,
  fontBody,
}: Props) {
  const c = { ...fallback };
  for (const key of Object.keys(fallback) as (keyof typeof fallback)[]) {
    const value = colors[key]?.trim();
    if (value) c[key] = value;
  }

  const textContrast = contrastRatio(c.colorForeground, c.colorBackground);
  const accentContrast = contrastRatio(c.colorAccentForeground, c.colorAccent);
  const warnings: string[] = [];
  if (textContrast !== null && textContrast < 4.5)
    warnings.push("Textfarbe und Hintergrund haben wenig Kontrast.");
  if (accentContrast !== null && accentContrast < 4.5)
    warnings.push("Schrift auf Akzent ist schwer lesbar.");

  return (
    <div className="space-y-2">
      <div
        className="overflow-hidden rounded-lg border"
        style={{
          backgroundColor: c.colorBackground,
          borderColor: c.colorBorder,
          color: c.colorForeground,
          fontFamily: fontBody || undefined,
        }}
      >
        <div
          className="flex items-center justify-between border-b px-4 py-3"
          style={{ borderColor: c.colorBorder, backgroundColor: c.colorSurface }}
        >
          <div className="flex min-w-0 items-center gap-2">
            {logoUrl.trim() !== "" ? (
              <img
                src={logoUrl}
                alt="Logo in der Vorschau"
                className="h-6 w-auto max-w-[140px] object-contain"
                loading="lazy"
              />
            ) : (
              <span style={{ fontFamily: fontDisplay || undefined }} className="text-sm font-semibold">
                {shopName.trim() || "Mein Shop"}
              </span>
            )}
          </div>
          <span className="text-xs opacity-70">Warenkorb (2)</span>
        </div>

        <div className="px-4 py-6">
          <p className="text-xl" style={{ fontFamily: fontDisplay || undefined }}>
            {claim.trim() || "Sorgfältig ausgewählt."}
          </p>
          <p className="mt-2 text-sm opacity-80">
            So sehen Überschrift, Fließtext, Flächen und Schaltflächen im Shop aus.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span
              className="rounded-md px-3 py-2 text-sm"
              style={{ backgroundColor: c.colorAccent, color: c.colorAccentForeground }}
            >
              In den Warenkorb
            </span>
            <span
              className="rounded-md border px-3 py-2 text-sm"
              style={{ borderColor: c.colorBorder, backgroundColor: c.colorSurface }}
            >
              Mehr erfahren
            </span>
          </div>
        </div>

        <div className="px-4 py-3 text-xs" style={{ backgroundColor: c.colorDeep, color: c.colorBackground }}>
          Fußzeile · Versand · Impressum
        </div>
      </div>

      {warnings.map((warning) => (
        <p key={warning} className="text-xs text-muted-foreground">
          Hinweis: {warning}
        </p>
      ))}
    </div>
  );
}
