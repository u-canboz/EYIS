import type { StoreProductSummary } from "@/lib/store-sdk";

export type ProductFilterState = {
  sort: string;
  verfuegbar: boolean;
  preis_min: number;
  preis_max: number;
  seite: number;
};

export const PRODUCT_SORTS = [
  { value: "", label: "Empfohlen" },
  { value: "newest", label: "Neuheiten" },
  { value: "price_asc", label: "Preis aufsteigend" },
  { value: "price_desc", label: "Preis absteigend" },
  { value: "title_asc", label: "Name A–Z" },
] as const;

const SORT_VALUES = PRODUCT_SORTS.map((s) => s.value as string);

/**
 * Alle Sortierwerte beherrscht die Store API v1 serverseitig, inklusive Preis.
 * Das Theme sortiert und rechnet nichts nach.
 */
export function engineSort(sort: string): string | null {
  return sort ? sort : null;
}

function num(value: unknown, fallback: number) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

/** Adresszeile → geprüfter Filterzustand. Ungültige Werte fallen auf die Voreinstellung zurück. */
export function parseProductFilters(search: Record<string, unknown>): ProductFilterState {
  const sortRaw = String(search["sort"] ?? "");
  return {
    sort: SORT_VALUES.includes(sortRaw) ? sortRaw : "",
    verfuegbar: String(search["verfuegbar"] ?? "") === "1",
    preis_min: num(search["preis_min"], 0),
    preis_max: num(search["preis_max"], 0),
    seite: Math.max(1, Math.round(num(search["seite"], 1))),
  };
}

/** Optionale Form für die Adresszeile — alle Felder dürfen fehlen. */
export type ProductFilterSearch = {
  sort?: string;
  verfuegbar?: string;
  preis_min?: number;
  preis_max?: number;
  seite?: number;
};

/** Routen-Prüfung: unbekannte oder ungültige Werte werden verworfen. */
export function validateProductFilters(search: Record<string, unknown>): ProductFilterSearch {
  return serializeProductFilters(parseProductFilters(search));
}

/** Nur gesetzte Werte landen in der Adresszeile. */
export function serializeProductFilters(filters: ProductFilterState): ProductFilterSearch {
  const out: ProductFilterSearch = {};
  if (filters.sort) out.sort = filters.sort;
  if (filters.verfuegbar) out.verfuegbar = "1";
  if (filters.preis_min > 0) out.preis_min = filters.preis_min;
  if (filters.preis_max > 0) out.preis_max = filters.preis_max;
  if (filters.seite > 1) out.seite = filters.seite;
  return out;
}

export const emptyProductFilters: ProductFilterState = {
  sort: "",
  verfuegbar: false,
  preis_min: 0,
  preis_max: 0,
  seite: 1,
};

export function activeFilterCount(filters: ProductFilterState) {
  let count = 0;
  if (filters.sort) count += 1;
  if (filters.verfuegbar) count += 1;
  if (filters.preis_min > 0) count += 1;
  if (filters.preis_max > 0) count += 1;
  return count;
}
