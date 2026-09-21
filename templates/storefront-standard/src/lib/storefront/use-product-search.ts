import { useEffect, useState } from "react";
import { keepPreviousData } from "@tanstack/react-query";
import { useSearch } from "@/lib/store-sdk/react/hooks";
import type { StoreProductSummary } from "@/lib/store-sdk";

export type ProductSearchStatus = "idle" | "searching" | "results" | "empty" | "error";

export type ProductSearchState = {
  /** Der Begriff, auf den sich die aktuell sichtbaren Treffer beziehen. */
  term: string;
  status: ProductSearchStatus;
  /** Treffer werden während einer neuen Eingabe ruhig weiter angezeigt. */
  results: StoreProductSummary[];
  isStale: boolean;
  retry: () => void;
};

/**
 * Gemeinsame Suchlogik für Kopfsuche und Suchergebnisseite.
 * Genau ein Zustand ist gültig; veraltete Antworten überschreiben nichts.
 */
export function useProductSearch(input: string, debounceMs = 250): ProductSearchState {
  const raw = input.trim();
  const [debounced, setDebounced] = useState(raw);

  useEffect(() => {
    if (raw === debounced) return;
    const id = window.setTimeout(() => setDebounced(raw), debounceMs);
    return () => window.clearTimeout(id);
  }, [raw, debounced, debounceMs]);

  const active = debounced.length >= 2;
  const query = useSearch(debounced, {
    staleTime: 30_000,
    placeholderData: keepPreviousData,
  });
  // Suche, Entsprechungen und Kategoriebezug liefert die Store API serverseitig.
  const results = active ? (query.data?.data ?? []) : [];

  const waiting = raw !== debounced || (active && (query.isPending || query.isPlaceholderData));
  const failed = query.isError;

  const status: ProductSearchStatus = !active && raw.length < 2
    ? "idle"
    : waiting && results.length === 0
      ? "searching"
      : failed && results.length === 0
        ? "error"
        : results.length === 0
          ? "empty"
          : "results";

  return {
    term: debounced,
    status,
    results,
    isStale: waiting && results.length > 0,
    retry: () => {
      void query.refetch();
    },
  };
}
