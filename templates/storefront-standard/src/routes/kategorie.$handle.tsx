import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProductBrowser } from "@/components/store/ProductBrowser";
import { validateProductFilters } from "@/lib/storefront/product-filters";
import { useCategories } from "@/lib/store-sdk/react/hooks";

export const Route = createFileRoute("/kategorie/$handle")({
  validateSearch: (search: Record<string, unknown>) => validateProductFilters(search),
  head: ({ params }) => {
    const name = decodeURIComponent(params.handle).replace(/-/g, " ");
    const title = `${name.charAt(0).toUpperCase()}${name.slice(1)} | Hauptshop`;
    return {
      meta: [
        { title },
        { name: "description", content: `Produkte aus der Kategorie ${name}.` },
        { property: "og:title", content: title },
        { property: "og:description", content: `Produkte aus der Kategorie ${name}.` },
      ],
    };
  },
  component: CategoryPage,
});

function CategoryPage() {
  const { handle } = useParams({ from: "/kategorie/$handle" });
  const categories = useCategories();
  const category = categories.data?.find((c) => c.handle === handle);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Kategorie</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">{category?.name ?? handle}</h1>
      {category?.description ? (
        <p className="mt-3 max-w-md text-muted-foreground">{category.description}</p>
      ) : null}
      <div className="mt-12">
        <ProductBrowser category={handle} />
      </div>
    </div>
  );
}
