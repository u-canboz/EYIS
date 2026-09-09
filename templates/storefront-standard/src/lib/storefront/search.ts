import type { StoreProductSummary } from "@/lib/store-sdk";
import { searchSynonyms } from "@/content/search-synonyme";

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("de-DE")
    .trim();
}

const NORMALIZED_SYNONYMS: Record<string, string[]> = Object.fromEntries(
  Object.entries(searchSynonyms).map(([key, values]) => [normalize(key), values.map(normalize)]),
);

/** Ein Suchwort plus seine bekannten Entsprechungen (z. B. "black" → "schwarzkümmel"). */
function expandWord(word: string): string[] {
  const extra = NORMALIZED_SYNONYMS[word] ?? [];
  return [word, ...extra];
}

/** Wortliste einer Eingabe, inklusive Entsprechungen für Mehrwortbegriffe. */
export function searchWords(term: string): string[][] {
  const normalized = normalize(term);
  if (!normalized) return [];
  const phrase = NORMALIZED_SYNONYMS[normalized];
  if (phrase) return [[normalized, ...phrase]];
  return normalized.split(/\s+/).filter(Boolean).map(expandWord);
}

/** Lokaler Fallback auf bereits öffentlich geladene Katalogdaten. */
export function filterStoreProducts(products: StoreProductSummary[], term: string) {
  const groups = searchWords(term);
  if (groups.length === 0) return [];
  return products.filter((product) => {
    const haystack = normalize(`${product.title} ${product.subtitle ?? ""} ${product.handle}`);
    return groups.every((variants) => variants.some((word) => haystack.includes(word)));
  });
}
