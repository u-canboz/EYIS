/**
 * USt-IdNr. (VAT ID) handling.
 *
 * Phase 6 performs a strict structural validation (country prefix + national
 * format) and persists an auditable validation record. Online confirmation via
 * VIES is modelled through `provider`/`response_snapshot` and can be plugged in
 * later without touching callers or stored data.
 */
import { getAdmin } from "../core.server";

export type VatValidationStatus = "pending" | "valid" | "invalid" | "unavailable" | "manual_review";

/** National VAT-ID patterns for EU member states. */
const PATTERNS: Record<string, RegExp> = {
  AT: /^U\d{8}$/,
  BE: /^0\d{9}$/,
  BG: /^\d{9,10}$/,
  HR: /^\d{11}$/,
  CY: /^\d{8}[A-Z]$/,
  CZ: /^\d{8,10}$/,
  DK: /^\d{8}$/,
  EE: /^\d{9}$/,
  FI: /^\d{8}$/,
  FR: /^[A-Z0-9]{2}\d{9}$/,
  DE: /^\d{9}$/,
  GR: /^\d{9}$/,
  HU: /^\d{8}$/,
  IE: /^(\d{7}[A-W][A-I]?|\d[A-Z*+]\d{5}[A-W])$/,
  IT: /^\d{11}$/,
  LV: /^\d{11}$/,
  LT: /^(\d{9}|\d{12})$/,
  LU: /^\d{8}$/,
  MT: /^\d{8}$/,
  NL: /^\d{9}B\d{2}$/,
  PL: /^\d{10}$/,
  PT: /^\d{9}$/,
  RO: /^\d{2,10}$/,
  SK: /^\d{10}$/,
  SI: /^\d{8}$/,
  ES: /^[A-Z0-9]\d{7}[A-Z0-9]$/,
  SE: /^\d{12}$/,
};

export function normalizeVatId(input: string): string {
  return input.replace(/[\s.\-/]/g, "").toUpperCase();
}

export function parseVatId(input: string): { normalized: string; countryCode: string; structurallyValid: boolean } {
  const normalized = normalizeVatId(input);
  const countryCode = normalized.slice(0, 2);
  const rest = normalized.slice(2);
  const pattern = PATTERNS[countryCode];
  return { normalized, countryCode, structurallyValid: !!pattern && pattern.test(rest) };
}

/** Validates and records a VAT id. Returns the stored validation row id. */
export async function validateAndRecordVatId(params: {
  organizationId: string;
  vatId: string;
  customerId?: string | null;
}): Promise<{ id: string; status: VatValidationStatus; countryCode: string; normalized: string }> {
  const admin = await getAdmin();
  const { normalized, countryCode, structurallyValid } = parseVatId(params.vatId);
  const status: VatValidationStatus = structurallyValid ? "valid" : "invalid";

  const { data, error } = await admin
    .from("vat_validations")
    .insert({
      organization_id: params.organizationId,
      customer_id: params.customerId ?? null,
      vat_id: params.vatId,
      normalized_vat_id: normalized,
      country_code: countryCode,
      status,
      provider: "format",
      checked_at: new Date().toISOString(),
      response_snapshot: { structurallyValid, method: "format" } as never,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id, status, countryCode, normalized };
}

export async function isVatValidationValid(validationId: string | null): Promise<boolean> {
  if (!validationId) return false;
  const admin = await getAdmin();
  const { data } = await admin.from("vat_validations").select("status, expires_at").eq("id", validationId).maybeSingle();
  const r = data as { status: string; expires_at: string | null } | null;
  if (!r || r.status !== "valid") return false;
  if (r.expires_at && Date.parse(r.expires_at) <= Date.now()) return false;
  return true;
}
