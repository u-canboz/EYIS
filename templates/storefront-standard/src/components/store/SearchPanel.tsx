import { Link } from "@tanstack/react-router";
import { useCategories } from "@/lib/store-sdk/react/hooks";
import { formatMoney } from "@/lib/storefront/money";
import { useProductSearch } from "@/lib/storefront/use-product-search";
import { ProductImage } from "./ProductImage";

export function SearchPanel({ term, onClose }: { term: string; onClose: () => void }) {
  const search = useProductSearch(term);
  const categories = useCategories({ staleTime: 10 * 60_000 });
  const suggestions = (categories.data ?? []).slice(0, 4);

  return (
    <div className="absolute left-0 right-0 top-[calc(100%+0.5rem)] z-50 border border-border bg-card p-3 shadow-[var(--elevation-2)] sm:p-4">
      <div className="flex items-center justify-between gap-3 border-b border-border pb-3">
        <p className="text-xs font-semibold uppercase text-muted-foreground">Suchergebnisse</p>
        {search.status === "results" ? (
          <span className="text-xs tabular-nums text-muted-foreground">
            {search.isStale ? "wird aktualisiert" : `${search.results.length} Treffer`}
          </span>
        ) : null}
      </div>

      {search.status === "idle" ? (
        <p className="py-5 text-sm text-muted-foreground">Gib mindestens zwei Zeichen ein.</p>
      ) : search.status === "searching" ? (
        <p className="py-5 text-sm text-muted-foreground">Produkte werden gesucht.</p>
      ) : search.status === "error" ? (
        <p className="py-5 text-sm text-destructive">
          Die Suche ist gerade nicht verfügbar. Bitte versuche es erneut.
        </p>
      ) : search.status === "empty" ? (
        <div className="py-5">
          <p className="text-sm text-muted-foreground">
            Zu deiner Suche wurden keine Produkte gefunden.
          </p>
          {suggestions.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-2">
              {suggestions.map((category) => (
                <Link
                  key={category.id}
                  to="/kategorie/$handle"
                  params={{ handle: category.handle }}
                  onClick={onClose}
                  className="border border-border px-3 py-1.5 text-sm transition-colors hover:bg-secondary"
                >
                  {category.name}
                </Link>
              ))}
            </div>
          ) : null}
        </div>
      ) : (
        <>
          <ul
            className={`mt-2 grid max-h-[min(27rem,55svh)] gap-1 overflow-y-auto transition-opacity ${search.isStale ? "opacity-60" : "opacity-100"}`}
          >
            {search.results.slice(0, 6).map((product) => (
              <li key={product.id}>
                <Link
                  to="/produkt/$handle"
                  params={{ handle: product.handle }}
                  onClick={onClose}
                  className="grid min-h-16 grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 px-2 py-2 transition-colors hover:bg-secondary"
                >
                  <span className="size-13 shrink-0 overflow-hidden border border-border bg-card">
                    <ProductImage
                      src={product.image?.url}
                      alt={product.image?.alt}
                      title={product.title}
                    />
                  </span>
                  <span className="min-w-0 flex-1 truncate text-sm">{product.title}</span>
                  {product.price ? (
                    <span className="shrink-0 text-sm tabular-nums text-muted-foreground">
                      {formatMoney(product.price.unitAmountMinor, product.price.currencyCode)}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
          <Link
            to="/suche"
            search={{ q: search.term }}
            onClick={onClose}
            className="mt-3 flex min-h-11 items-center justify-center border-t border-border pt-3 text-sm font-semibold text-foreground transition-colors hover:text-brass"
          >
            Alle Suchergebnisse anzeigen
          </Link>
        </>
      )}
    </div>
  );
}
