import { createFileRoute, useParams } from "@tanstack/react-router";
import { ProductBrowser } from "@/components/store/ProductBrowser";
import { validateProductFilters } from "@/lib/storefront/product-filters";
import { useCollections } from "@/lib/store-sdk/react/hooks";

export const Route = createFileRoute("/kollektion/$handle")({
  validateSearch: (search: Record<string, unknown>) => validateProductFilters(search),
  head: ({ params }) => {
    const name = decodeURIComponent(params.handle).replace(/-/g, " ");
    const title = `${name.charAt(0).toUpperCase()}${name.slice(1)} | Hauptshop`;
    return {
      meta: [
        { title },
        { name: "description", content: `Produkte der Kollektion ${name}.` },
        { property: "og:title", content: title },
        { property: "og:description", content: `Produkte der Kollektion ${name}.` },
      ],
    };
  },
  component: CollectionPage,
});

function CollectionPage() {
  const { handle } = useParams({ from: "/kollektion/$handle" });
  const collections = useCollections();
  const collection = collections.data?.find((c) => c.handle === handle);

  return (
    <div className="mx-auto max-w-6xl px-5 py-16">
      <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">Kollektion</p>
      <h1 className="mt-3 text-3xl sm:text-4xl">{collection?.name ?? handle}</h1>
      {collection?.description ? (
        <p className="mt-3 max-w-md text-muted-foreground">{collection.description}</p>
      ) : null}
      <div className="mt-12">
        <ProductBrowser collection={handle} />
      </div>
    </div>
  );
}
