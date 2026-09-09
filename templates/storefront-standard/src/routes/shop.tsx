import { createFileRoute } from "@tanstack/react-router";
import { ProductBrowser } from "@/components/store/ProductBrowser";
import { validateProductFilters } from "@/lib/storefront/product-filters";

export const Route = createFileRoute("/shop")({
  validateSearch: (search: Record<string, unknown>) => validateProductFilters(search),
  head: () => ({
    meta: [
      { title: "Shop — alle Produkte | Hauptshop" },
      {
        name: "description",
        content: "Alle Produkte im Überblick: filtern nach Kategorie, Preis und Verfügbarkeit.",
      },
      { property: "og:title", content: "Shop — alle Produkte | Hauptshop" },
      { property: "og:description", content: "Alle Produkte im Überblick, sortierbar und filterbar." },
    ],
  }),
  component: ShopPage,
});

function ShopPage() {
  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <h1 className="text-3xl sm:text-4xl">Shop</h1>
      <p className="mt-3 max-w-md text-muted-foreground">
        Alles, was aktuell verfügbar ist — geordnet nach Sortiment, Preis und Verfügbarkeit.
      </p>

      <div className="mt-12">
        <ProductBrowser />
      </div>
    </div>
  );
}
