/** Verwaltung des Storefront-Brandings: Shopname, Logo und Farben je Shop. */
import { getAdmin } from "../core.server";

type Row = Record<string, unknown>;
const str = (v: unknown) => (v === null || v === undefined ? null : String(v));

export type StorefrontBranding = {
  shopName: string | null;
  claim: string | null;
  logoUrl: string | null;
  faviconUrl: string | null;
  colorBackground: string | null;
  colorForeground: string | null;
  colorSurface: string | null;
  colorBorder: string | null;
  colorAccent: string | null;
  colorAccentForeground: string | null;
  colorDeep: string | null;
  fontDisplay: string | null;
  fontBody: string | null;
};

export const emptyBranding: StorefrontBranding = {
  shopName: null,
  claim: null,
  logoUrl: null,
  faviconUrl: null,
  colorBackground: null,
  colorForeground: null,
  colorSurface: null,
  colorBorder: null,
  colorAccent: null,
  colorAccentForeground: null,
  colorDeep: null,
  fontDisplay: null,
  fontBody: null,
};

const clean = (value: string | null | undefined, max = 200) =>
  value === null || value === undefined || value.trim() === "" ? null : value.trim().slice(0, max);

function mapRow(row: Row): StorefrontBranding {
  return {
    shopName: str(row["shop_name"]),
    claim: str(row["claim"]),
    logoUrl: str(row["logo_url"]),
    faviconUrl: str(row["favicon_url"]),
    colorBackground: str(row["color_background"]),
    colorForeground: str(row["color_foreground"]),
    colorSurface: str(row["color_surface"]),
    colorBorder: str(row["color_border"]),
    colorAccent: str(row["color_accent"]),
    colorAccentForeground: str(row["color_accent_foreground"]),
    colorDeep: str(row["color_deep"]),
    fontDisplay: str(row["font_display"]),
    fontBody: str(row["font_body"]),
  };
}

export async function getBranding(
  organizationId: string,
  shopId: string,
): Promise<StorefrontBranding> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("storefront_branding")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data ? mapRow(data as Row) : { ...emptyBranding };
}

export async function saveBranding(
  input: { organizationId: string; shopId: string } & StorefrontBranding,
): Promise<{ ok: true }> {
  const admin = await getAdmin();
  const payload = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    shop_name: clean(input.shopName, 120),
    claim: clean(input.claim, 200),
    logo_url: clean(input.logoUrl, 600),
    favicon_url: clean(input.faviconUrl, 600),
    color_background: clean(input.colorBackground, 60),
    color_foreground: clean(input.colorForeground, 60),
    color_surface: clean(input.colorSurface, 60),
    color_border: clean(input.colorBorder, 60),
    color_accent: clean(input.colorAccent, 60),
    color_accent_foreground: clean(input.colorAccentForeground, 60),
    color_deep: clean(input.colorDeep, 60),
    font_display: clean(input.fontDisplay, 120),
    font_body: clean(input.fontBody, 120),
  };
  const { error } = await admin
    .from("storefront_branding")
    .upsert(payload as never, { onConflict: "shop_id" });
  if (error) throw new Error(error.message);
  return { ok: true };
}
