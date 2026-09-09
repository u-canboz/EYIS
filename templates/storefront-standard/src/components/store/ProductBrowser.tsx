import { useNavigate, useSearch } from "@tanstack/react-router";
import { X } from "lucide-react";
import { useCategories, useCollections, useProducts } from "@/lib/store-sdk/react/hooks";
import { ProductCard } from "./ProductCard";
import { ProductFilters } from "./ProductFilters";
import { EmptyState, ErrorState, ProductGridSkeleton } from "./StateBlocks";
import { Button } from "@/components/ui/button";
import {
  applyLocalFilters,
  emptyProductFilters,
  engineSort,
  parseProductFilters,
  PRODUCT_SORTS,
  serializeProductFilters,
  sortProducts,
  type ProductFilterState,
} from "@/lib/storefront/product-filters";

const PAGE_SIZE = 24;

/** Produktliste mit Filterbereich — Daten kommen ausschließlich aus der Store API. */
export function ProductBrowser({
  category,
  collection,
}: {
  category?: string | null;
  collection?: string | null;
}) {
  const navigate = useNavigate();
  const rawSearch = useSearch({ strict: false }) as Record<string, unknown>;
  const filters = parseProductFilters(rawSearch);

  const setFilters = (next: ProductFilterState) => {
    void navigate({ search: serializeProductFilters(next) as never, replace: true });
  };

  const categories = useCategories({ staleTime: 10 * 60_000 });
  const collections = useCollections({ staleTime: 10 * 60_000 });
  // Preis-Sortierung kennt die Engine nicht: dafür holt das Theme eine große
  // Seite und sortiert/blättert lokal auf den gelieferten Werten.
  const localSort = filters.sort === "price_asc" || filters.sort === "price_desc";
  const query = useProducts({
    page: localSort ? 1 : filters.seite,
    pageSize: localSort ? 200 : PAGE_SIZE,
    category: category ?? null,
    collection: collection ?? null,
    sort: engineSort(filters.sort),
  });

  const filtered = applyLocalFilters(query.data?.data ?? [], filters);
  const sorted = sortProducts(filtered, filters.sort);
  const products = localSort
    ? sorted.slice((filters.seite - 1) * PAGE_SIZE, filters.seite * PAGE_SIZE)
    : sorted;
  const hasMore = localSort
    ? sorted.length > filters.seite * PAGE_SIZE
    : (query.data?.pagination.hasMore ?? false);
  const sortLabel = PRODUCT_SORTS.find((s) => s.value === filters.sort)?.label;

  const chips: { key: string; label: string; clear: () => void }[] = [];
  if (filters.verfuegbar) {
    chips.push({
      key: "verfuegbar",
      label: "Nur lieferbar",
      clear: () => setFilters({ ...filters, verfuegbar: false, seite: 1 }),
    });
  }
  if (filters.preis_min > 0) {
    chips.push({
      key: "preis_min",
      label: `ab ${filters.preis_min} €`,
      clear: () => setFilters({ ...filters, preis_min: 0, seite: 1 }),
    });
  }
  if (filters.preis_max > 0) {
    chips.push({
      key: "preis_max",
      label: `bis ${filters.preis_max} €`,
      clear: () => setFilters({ ...filters, preis_max: 0, seite: 1 }),
    });
  }
  if (filters.sort && sortLabel) {
    chips.push({
      key: "sort",
      label: sortLabel,
      clear: () => setFilters({ ...filters, sort: "", seite: 1 }),
    });
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[15rem_minmax(0,1fr)] lg:gap-12">
      <ProductFilters
        categories={categories.data ?? []}
        collections={collections.data ?? []}
        activeCategory={category ?? null}
        activeCollection={collection ?? null}
        filters={filters}
        onChange={setFilters}
      />

      <div className="min-w-0">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3 border-b border-border pb-4">
          <p className="text-sm text-muted-foreground">
            {query.data
              ? `${products.length} von ${localSort ? sorted.length : query.data.pagination.total} Produkten`
              : "Produkte"}
          </p>
          {chips.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.clear}
                  className="flex min-h-9 items-center gap-1.5 border border-border px-3 text-sm transition-colors hover:bg-secondary"
                >
                  {chip.label}
                  <X className="size-3.5" aria-hidden />
                  <span className="sr-only">Filter entfernen</span>
                </button>
              ))}
              <Button variant="ghost" size="sm" onClick={() => setFilters({ ...emptyProductFilters })}>
                Zurücksetzen
              </Button>
            </div>
          ) : null}
        </div>

        {query.isPending ? (
          <ProductGridSkeleton count={6} />
        ) : query.isError ? (
          <ErrorState error={query.error} onRetry={() => query.refetch()} />
        ) : products.length === 0 ? (
          <EmptyState title="Keine Produkte gefunden" hint="Bitte Filter anpassen oder zurücksetzen." />
        ) : (
          <div className="grid grid-cols-2 gap-x-6 gap-y-12 md:grid-cols-3 lg:grid-cols-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {query.data && (hasMore || filters.seite > 1) ? (
          <div className="mt-12 flex items-center justify-center gap-3">
            <Button
              variant="outline"
              disabled={filters.seite === 1}
              onClick={() => setFilters({ ...filters, seite: filters.seite - 1 })}
            >
              Zurück
            </Button>
            <span className="text-sm text-muted-foreground">Seite {filters.seite}</span>
            <Button
              variant="outline"
              disabled={!hasMore}
              onClick={() => setFilters({ ...filters, seite: filters.seite + 1 })}
            >
              Weiter
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
