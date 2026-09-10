/**
 * Vorlagen (Farb- und Schriftkombinationen) sowie Schriftpaare für das
 * Storefront-Branding. Reine Präsentationsdaten: sie setzen ausschließlich die
 * vorhandenen Felder der Tabelle `storefront_branding`.
 */

export type BrandingColors = {
  colorBackground: string;
  colorForeground: string;
  colorSurface: string;
  colorBorder: string;
  colorAccent: string;
  colorAccentForeground: string;
  colorDeep: string;
};

export type FontPair = {
  id: string;
  label: string;
  /** Wert für `font_display` (Überschriften). */
  display: string;
  /** Wert für `font_body` (Fließtext). */
  body: string;
  /** Google-Fonts-Familien, die die Storefront per <link> laden sollte. */
  googleFamilies: string[];
};

export const fontPairs: FontPair[] = [
  {
    id: "system",
    label: "System-Standard",
    display: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
    body: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif',
    googleFamilies: [],
  },
  {
    id: "grotesk-dmsans",
    label: "Space Grotesk / DM Sans",
    display: '"Space Grotesk", system-ui, sans-serif',
    body: '"DM Sans", system-ui, sans-serif',
    googleFamilies: ["Space Grotesk:wght@500;700", "DM Sans:wght@400;500"],
  },
  {
    id: "fraunces-inter",
    label: "Fraunces / Inter",
    display: '"Fraunces", Georgia, serif',
    body: '"Inter", system-ui, sans-serif',
    googleFamilies: ["Fraunces:opsz,wght@9..144,500;9..144,700", "Inter:wght@400;500"],
  },
  {
    id: "playfair-source",
    label: "Playfair Display / Source Sans 3",
    display: '"Playfair Display", Georgia, serif',
    body: '"Source Sans 3", system-ui, sans-serif',
    googleFamilies: ["Playfair Display:wght@500;700", "Source Sans 3:wght@400;600"],
  },
  {
    id: "instrument-work",
    label: "Instrument Serif / Work Sans",
    display: '"Instrument Serif", Georgia, serif',
    body: '"Work Sans", system-ui, sans-serif',
    googleFamilies: ["Instrument Serif", "Work Sans:wght@400;600"],
  },
  {
    id: "bricolage-inter",
    label: "Bricolage Grotesque / Inter",
    display: '"Bricolage Grotesque", system-ui, sans-serif',
    body: '"Inter", system-ui, sans-serif',
    googleFamilies: ["Bricolage Grotesque:wght@600;800", "Inter:wght@400;500"],
  },
];

export type BrandingPreset = {
  id: string;
  label: string;
  description: string;
  fontPairId: string;
  colors: BrandingColors;
};

export const brandingPresets: BrandingPreset[] = [
  {
    id: "sand-kupfer",
    label: "Sand & Kupfer",
    description: "Warm und hell",
    fontPairId: "fraunces-inter",
    colors: {
      colorBackground: "#FBF8F3",
      colorForeground: "#1F1B16",
      colorSurface: "#F3EDE3",
      colorBorder: "#E3D9C9",
      colorAccent: "#B07A3C",
      colorAccentForeground: "#FFFFFF",
      colorDeep: "#3A2E22",
    },
  },
  {
    id: "leinen-salbei",
    label: "Leinen & Salbei",
    description: "Natürlich und ruhig",
    fontPairId: "instrument-work",
    colors: {
      colorBackground: "#FAFAF7",
      colorForeground: "#1E241F",
      colorSurface: "#EFF2EC",
      colorBorder: "#DCE2D6",
      colorAccent: "#4F6B52",
      colorAccentForeground: "#FFFFFF",
      colorDeep: "#243027",
    },
  },
  {
    id: "papier-tinte",
    label: "Papier & Tinte",
    description: "Streng schwarz-weiß",
    fontPairId: "grotesk-dmsans",
    colors: {
      colorBackground: "#FFFFFF",
      colorForeground: "#111111",
      colorSurface: "#F4F4F4",
      colorBorder: "#E0E0E0",
      colorAccent: "#111111",
      colorAccentForeground: "#FFFFFF",
      colorDeep: "#000000",
    },
  },
  {
    id: "nacht-messing",
    label: "Nacht & Messing",
    description: "Dunkel und edel",
    fontPairId: "playfair-source",
    colors: {
      colorBackground: "#12130F",
      colorForeground: "#F2EFE6",
      colorSurface: "#1C1E19",
      colorBorder: "#2E312A",
      colorAccent: "#C9A227",
      colorAccentForeground: "#161610",
      colorDeep: "#0A0B08",
    },
  },
  {
    id: "frost-marine",
    label: "Frost & Marine",
    description: "Kühl und klar",
    fontPairId: "bricolage-inter",
    colors: {
      colorBackground: "#FBFDFE",
      colorForeground: "#111C26",
      colorSurface: "#EEF4F8",
      colorBorder: "#D8E3EC",
      colorAccent: "#1E4E79",
      colorAccentForeground: "#FFFFFF",
      colorDeep: "#0E2438",
    },
  },
  {
    id: "creme-terracotta",
    label: "Creme & Terracotta",
    description: "Weich und mediterran",
    fontPairId: "fraunces-inter",
    colors: {
      colorBackground: "#FEFAF4",
      colorForeground: "#2A1D17",
      colorSurface: "#F7EDE2",
      colorBorder: "#EBD9C7",
      colorAccent: "#C25B3A",
      colorAccentForeground: "#FFFFFF",
      colorDeep: "#3E241A",
    },
  },
];

export const hexPattern = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

export const isHexColor = (value: string) => hexPattern.test(value.trim());

function toRgb(hex: string): [number, number, number] | null {
  const value = hex.trim();
  if (!isHexColor(value)) return null;
  const raw = value.slice(1);
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

/** Normalisiert Kurzformen zu #RRGGBB, damit das native Farbfeld sie annimmt. */
export function normalizeHex(value: string, fallback: string): string {
  const rgb = toRgb(value);
  if (!rgb) return fallback;
  return `#${rgb.map((c) => c.toString(16).padStart(2, "0")).join("")}`.toUpperCase();
}

function luminance(hex: string): number | null {
  const rgb = toRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG-Kontrastverhältnis (1–21) oder null, wenn ein Wert unbrauchbar ist. */
export function contrastRatio(a: string, b: string): number | null {
  const la = luminance(a);
  const lb = luminance(b);
  if (la === null || lb === null) return null;
  const light = Math.max(la, lb);
  const dark = Math.min(la, lb);
  return (light + 0.05) / (dark + 0.05);
}
