import { Link } from "@tanstack/react-router";
import type { StoreProductSummary } from "@/lib/store-sdk";
import { useProducts } from "@/lib/store-sdk/react/hooks";
import { formatMoney } from "@/lib/storefront/money";
import { ProductImage } from "@/components/store/ProductImage";
import { ErrorState, ProductGridSkeleton } from "@/components/store/StateBlocks";
import { bestsellerHandles } from "@/content/shop";

/** Bestseller kommen aus EYIS; Reihenfolge nach redaktioneller Liste, Rest füllt auf. */
function order(products: StoreProductSummary[]) {
  const picked = bestsellerHandles
    .map((handle) => products.find((product) => product.handle === handle))
    .filter((product): product is StoreProductSummary => Boolean(product));
  const rest = products.filter((product) => !picked.includes(product));
  return [...picked, ...rest].slice(0, 4);
}

export function BestsellerRow() {
  const query = useProducts({ pageSize: 24 });
  const products = order(query.data?.data ?? []);

  return (
    <section className="border-y border-border bg-olive text-olive-foreground">
      <div className="mx-auto max-w-(--content-max) px-5 py-16 sm:px-8 sm:py-28">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-brass">Besonders beliebt</p>
          <h2 className="mt-3 font-display text-4xl sm:text-5xl">Ausgewählte Bestseller</h2>
          <p className="mt-4 max-w-md text-sm text-olive-foreground/70">
            Bewährte Favoriten aus unserem Sortiment.
          </p>
        </div>

        <div className="mt-10">
          {query.isPending ? (
            <ProductGridSkeleton count={4} />
          ) : query.isError ? (
            <ErrorState error={query.error} onRetry={() => query.refetch()} />
          ) : products.length === 0 ? (
            <p className="text-sm text-olive-foreground/70">
              Aktuell sind keine Produkte verfügbar.
            </p>
          ) : (
            <div className="scroll-x -mr-5 grid snap-x snap-mandatory auto-cols-[82%] grid-flow-col gap-4 pb-3 pr-5 sm:mr-0 sm:auto-cols-[42%] sm:gap-5 sm:pr-0 md:auto-cols-[31%] lg:grid-flow-row lg:grid-cols-4 lg:gap-8">
              {products.map((product) => (
                <article key={product.id} className="flex min-w-0 snap-start flex-col text-left">
                  <Link
                    to="/produkt/$handle"
                    params={{ handle: product.handle }}
                    className="group block"
                  >
                    <div className="aspect-3/4 w-full overflow-hidden bg-card">
                      <ProductImage
                        src={product.image?.url}
                        alt={product.image?.alt}
                        title={product.title}
                        className="transition-transform duration-500 group-hover:scale-[1.025]"
                      />
                    </div>
                    <h3 className="mt-5 font-display text-lg leading-snug group-hover:underline">
                      {product.title}
                    </h3>
                  </Link>
                  <p className="mt-2 text-sm font-semibold tabular-nums">
                    {product.price
                      ? formatMoney(product.price.unitAmountMinor, product.price.currencyCode)
                      : "Preis auf der Produktseite ansehen"}
                  </p>
                  <p className="mt-1 text-xs text-olive-foreground/60">
                    {product.availability === "out_of_stock"
                      ? "Aktuell nicht verfügbar"
                      : "inkl. MwSt., zzgl. Versand"}
                  </p>
                  <Link
                    to="/produkt/$handle"
                    params={{ handle: product.handle }}
                    className="mt-4 inline-flex min-h-11 items-center justify-center border border-olive-foreground/40 px-4 text-sm transition-colors hover:bg-olive-foreground hover:text-olive"
                  >
                    Produkt ansehen
                  </Link>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
