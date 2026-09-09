import { useEffect, useState } from "react";
import { useProducts } from "@/lib/store-sdk/react/hooks";
import { readRecentlyViewed } from "@/lib/storefront/recently-viewed";
import { ProductCard } from "./ProductCard";

/**
 * Zeigt zuletzt angesehene Produkte. Die Handles liegen nur lokal im Browser,
 * die Produktdaten kommen aus dem Shopsystem.
 */
export function RecentlyViewed({ excludeHandle }: { excludeHandle?: string }) {
  const [handles, setHandles] = useState<string[]>([]);

  useEffect(() => {
    setHandles(readRecentlyViewed().filter((h) => h !== excludeHandle));
  }, [excludeHandle]);

  const query = useProducts(
    { pageSize: 100 },
    { enabled: handles.length > 0, staleTime: 5 * 60_000 },
  );

  if (handles.length === 0) return null;
  const all = query.data?.data ?? [];
  const items = handles
    .map((handle) => all.find((product) => product.handle === handle))
    .filter((product): product is NonNullable<typeof product> => Boolean(product))
    .slice(0, 4);

  if (items.length === 0) return null;

  return (
    <section className="mx-auto max-w-(--content-max) px-4 py-16 sm:px-6 lg:py-20">
      <p className="text-xs uppercase tracking-[0.22em] text-brass">Weiter, wo du warst</p>
      <h2 className="mt-3 font-display text-2xl sm:text-3xl">Zuletzt angesehen</h2>
      <div className="scroll-x mt-8 grid auto-cols-[70%] snap-x snap-mandatory grid-flow-col gap-4 pb-3 sm:auto-cols-[40%] sm:gap-5 lg:grid-flow-row lg:grid-cols-4 lg:gap-8">
        {items.map((item) => (
          <ProductCard key={item.id} product={item} />
        ))}
      </div>
    </section>
  );
}
