import { useState } from "react";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { ProductCard } from "@/components/store/ProductCard";
import { EmptyState, ErrorState, ProductGridSkeleton } from "@/components/store/StateBlocks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCategories } from "@/lib/store-sdk/react/hooks";
import { useProductSearch } from "@/lib/storefront/use-product-search";

export const Route = createFileRoute("/suche")({
  validateSearch: (search: Record<string, unknown>) => ({ q: String(search["q"] ?? "") }),
  head: () => ({
    meta: [
      { title: "Suche | Hauptshop" },
      { name: "description", content: "Produkte im Shop suchen." },
      { property: "og:title", content: "Suche | Hauptshop" },
      { property: "og:description", content: "Produkte im Shop suchen." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SearchPage,
});

function SearchPage() {
  const { q } = useSearch({ from: "/suche" });
  const navigate = useNavigate();
  const [term, setTerm] = useState(q);
  const search = useProductSearch(q, 0);
  const categories = useCategories({ staleTime: 10 * 60_000 });

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <h1 className="text-3xl sm:text-4xl">Suche</h1>
      <form
        className="mt-6 flex max-w-md gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          navigate({ to: "/suche", search: { q: term.trim() } });
        }}
      >
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Wonach suchst du?"
          aria-label="Suchbegriff"
        />
        <Button type="submit">Suchen</Button>
      </form>

      <div className="mt-12">
        {search.status === "idle" ? (
          <EmptyState title="Suchbegriff eingeben" hint="Mindestens zwei Zeichen." />
        ) : search.status === "searching" ? (
          <ProductGridSkeleton count={3} />
        ) : search.status === "error" ? (
          <ErrorState error={new Error("Suche nicht verfügbar")} onRetry={search.retry} />
        ) : search.status === "empty" ? (
          <div>
            <EmptyState title={`Nichts gefunden für „${q}“`} hint="Versuche einen anderen Begriff." />
            {(categories.data ?? []).length > 0 ? (
              <div className="mt-6 flex flex-wrap justify-center gap-2">
                {(categories.data ?? []).slice(0, 6).map((category) => (
                  <Link
                    key={category.id}
                    to="/kategorie/$handle"
                    params={{ handle: category.handle }}
                    className="border border-border px-4 py-2 text-sm transition-colors hover:bg-secondary"
                  >
                    {category.name}
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        ) : (
          <>
            <p className="mb-6 text-sm text-muted-foreground">
              {search.results.length} Treffer für „{search.term}“
            </p>
            <div
              className={`grid grid-cols-2 gap-x-3 gap-y-10 transition-opacity sm:gap-x-6 lg:grid-cols-3 ${search.isStale ? "opacity-60" : "opacity-100"}`}
            >
              {search.results.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
