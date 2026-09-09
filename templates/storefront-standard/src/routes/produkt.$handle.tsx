import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { toast } from "sonner";
import { useCart, useProduct, useProducts } from "@/lib/store-sdk/react/hooks";
import { ProductImage } from "@/components/store/ProductImage";
import { ProductCard } from "@/components/store/ProductCard";
import { ErrorState, Skeleton } from "@/components/store/StateBlocks";
import { Button } from "@/components/ui/button";
import { formatMoney } from "@/lib/storefront/money";
import { errorMessage } from "@/lib/storefront/errors";
import { cn } from "@/lib/utils";
import { ReviewSummary } from "@/components/store/ReviewSummary";
import { ReviewsSection } from "@/components/store/Reviews";
import { ProductFaq } from "@/components/store/ProductFaq";
import { RecentlyViewed } from "@/components/store/RecentlyViewed";
import { FreeShippingProgress } from "@/components/store/FreeShippingProgress";
import { reviews } from "@/content/conversion";
import { rememberProduct } from "@/lib/storefront/recently-viewed";
import { Check, ChevronRight, PackageCheck, RotateCcw, ShieldCheck } from "lucide-react";

const AVAILABILITY: Record<string, string> = {
  in_stock: "Auf Lager",
  low_stock: "Nur noch wenige verfügbar",
  out_of_stock: "Derzeit ausverkauft",
  backorder: "Nachbestellt — längere Lieferzeit",
};

export const Route = createFileRoute("/produkt/$handle")({
  head: ({ params }) => {
    const name = decodeURIComponent(params.handle).replace(/-/g, " ");
    const title = `${name.charAt(0).toUpperCase()}${name.slice(1)} | Hauptshop`;
    return {
      meta: [
        { title },
        { name: "description", content: `${name} im Hauptshop kaufen — Details, Varianten und Verfügbarkeit.` },
        { property: "og:title", content: title },
        { property: "og:type", content: "product" },
        { property: "og:description", content: `${name} im Hauptshop kaufen.` },
      ],
    };
  },
  component: ProductPage,
});

function ProductPage() {
  const { handle } = useParams({ from: "/produkt/$handle" });
  const query = useProduct(handle);
  const cart = useCart();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  const product = query.data;

  useEffect(() => {
    if (product?.handle) rememberProduct(product.handle);
  }, [product?.handle]);
  const categoryHandle = product?.categories[0]?.handle ?? null;
  const relatedQuery = useProducts(
    { category: categoryHandle, pageSize: 8 },
    { enabled: Boolean(categoryHandle), staleTime: 5 * 60 * 1000 },
  );
  const variant = useMemo(
    () => product?.variants.find((v) => v.id === variantId) ?? product?.variants[0] ?? null,
    [product, variantId],
  );

  if (query.isPending) {
    return (
      <div className="mx-auto grid max-w-6xl gap-12 px-5 py-16 lg:grid-cols-2">
        <Skeleton className="aspect-4/5 w-full" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-24 w-full" />
        </div>
      </div>
    );
  }

  if (query.isError || !product) {
    return (
      <div className="mx-auto max-w-2xl px-5 py-24">
        <ErrorState error={query.error} onRetry={() => query.refetch()} />
      </div>
    );
  }

  const price = variant?.price ?? product.price;
  const soldOut = (variant?.availability ?? product.availability) === "out_of_stock";
  const images = product.images.length > 0 ? product.images : [];
  const related = (relatedQuery.data?.data ?? [])
    .filter((item) => item.handle !== product.handle)
    .slice(0, 4);

  const add = () => {
    if (!variant) return;
    cart.addItem.mutate(
      { variantId: variant.id, quantity: 1 },
      {
        onSuccess: () => toast.success("In den Warenkorb gelegt"),
        onError: (error) => toast.error(errorMessage(error)),
      },
    );
  };

  return (
    <div className="mx-auto max-w-(--content-max) px-5 pb-8 pt-5 sm:px-8 sm:py-12">
      <nav className="mb-5 flex min-w-0 items-center gap-2 text-sm text-muted-foreground sm:mb-8">
        <Link to="/shop" className="hover:text-foreground">
          Shop
        </Link>
        <ChevronRight className="size-3 shrink-0" aria-hidden />
        <span className="truncate">{product.title}</span>
      </nav>

      <div className="grid gap-10 md:grid-cols-2 md:gap-8 lg:grid-cols-[minmax(0,1.08fr)_minmax(24rem,0.92fr)] lg:gap-20">
        <div className="min-w-0">
          <div className="aspect-square w-full overflow-hidden border border-border bg-card sm:aspect-4/5">
            <ProductImage
              src={images[activeImage]?.url}
              alt={images[activeImage]?.alt}
              title={product.title}
            />
          </div>
          {images.length > 1 ? (
            <div className="scroll-x mt-3 flex gap-3 pb-1">
              {images.map((image, index) => (
                <Button
                  key={image.url}
                  variant="outline"
                  size="icon"
                  onClick={() => setActiveImage(index)}
                  className={cn(
                    "size-16 shrink-0 overflow-hidden rounded-none p-0",
                    index === activeImage ? "border-foreground" : "border-border",
                  )}
                >
                  <ProductImage src={image.url} alt={image.alt} title={product.title} />
                </Button>
              ))}
            </div>
          ) : null}
        </div>

        <div className="min-w-0 md:sticky md:top-28 md:self-start lg:top-32">
          {product.vendor ? <p className="text-xs uppercase tracking-[0.18em] text-brass">{product.vendor}</p> : null}
          <h1 className="mt-2 text-balance font-display text-3xl leading-tight sm:text-5xl">{product.title}</h1>
          {product.subtitle ? (
            <p className="mt-2 text-muted-foreground">{product.subtitle}</p>
          ) : null}

          <ReviewSummary className="mt-4" />

          {price ? (
            <div className="mt-7 flex flex-wrap items-baseline gap-3">
              <span className="font-display text-3xl tabular-nums">
                {formatMoney(price.unitAmountMinor, price.currencyCode)}
              </span>
              {price.compareAtAmountMinor ? (
                <span className="text-sm text-muted-foreground line-through">
                  {formatMoney(price.compareAtAmountMinor, price.currencyCode)}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {price.taxIncluded ? "inkl. MwSt." : "zzgl. MwSt."}
              </span>
            </div>
          ) : null}

          {product.variants.length > 1 ? (
            <div className="mt-8">
              <p className="text-xs uppercase tracking-widest text-muted-foreground">Auswahl</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {product.variants.map((option) => (
                  <Button
                    key={option.id}
                    variant={option.id === variant?.id ? "default" : "outline"}
                    onClick={() => setVariantId(option.id)}
                    disabled={option.availability === "out_of_stock"}
                    className="rounded-none"
                  >
                    {option.title}
                  </Button>
                ))}
              </div>
            </div>
          ) : null}

          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
            <span className={`size-2 rounded-full ${soldOut ? "bg-destructive" : "bg-success"}`} />
            {AVAILABILITY[variant?.availability ?? product.availability]}
          </p>

          <Button
            className="mt-6 w-full rounded-none"
            size="lg"
            disabled={soldOut || cart.addItem.isPending}
            onClick={add}
          >
            {cart.addItem.isPending ? "Wird hinzugefügt…" : "In den Warenkorb"}
          </Button>

          {price ? (
            <FreeShippingProgress
              className="mt-5"
              subtotalMinor={price.unitAmountMinor}
              currencyCode={price.currencyCode}
            />
          ) : null}

          <div className="mt-7 grid gap-3 border-y border-border py-5 text-sm">
            <p className="flex items-center gap-3"><PackageCheck className="size-5 shrink-0 text-brass" aria-hidden /><span>Wir verpacken und versenden selbst</span></p>
            <p className="flex items-center gap-3"><ShieldCheck className="size-5 shrink-0 text-brass" aria-hidden /><span>Sicherer Bestellvorgang</span></p>
            <p className="flex items-center gap-3"><RotateCcw className="size-5 shrink-0 text-brass" aria-hidden /><span>Retoure bequem online anmelden</span></p>
          </div>

          {product.description ? (
            <div
              className="prose-storefront mt-8 text-sm leading-relaxed text-muted-foreground [&_h2]:mt-6 [&_h2]:font-display [&_h2]:text-xl [&_h2]:text-foreground [&_h3]:mt-4 [&_h3]:font-medium [&_h3]:text-foreground [&_li]:ml-4 [&_li]:list-disc [&_p]:mt-3 [&_strong]:text-foreground [&_ul]:mt-3"
              dangerouslySetInnerHTML={{
                __html: product.description
                  .replace(/<script[\s\S]*?<\/script>/gi, "")
                  .replace(/ on[a-z]+="[^"]*"/gi, ""),
              }}
            />
          ) : null}


          <ProductFaq />

          {product.vendor || product.productType ? (
            <dl className="mt-8 grid grid-cols-2 gap-4 border-t border-border pt-5 text-sm">
              {product.vendor ? (
                <div>
                  <dt className="text-muted-foreground">Marke</dt>
                  <dd>{product.vendor}</dd>
                </div>
              ) : null}
              {product.productType ? (
                <div>
                  <dt className="text-muted-foreground">Art</dt>
                  <dd>{product.productType}</dd>
                </div>
              ) : null}
            </dl>
          ) : null}
        </div>
      </div>

      {related.length > 0 ? (
        <section className="mt-24 border-t border-border pt-16 sm:mt-32 sm:pt-20">
          <p className="text-xs uppercase tracking-[0.22em] text-brass">Passt zu deiner Auswahl</p>
          <div className="mt-3 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <h2 className="min-w-0 font-display text-3xl sm:text-4xl">Das könnte dir auch gefallen</h2>
            {categoryHandle ? <Link to="/kategorie/$handle" params={{ handle: categoryHandle }} className="hidden min-h-11 items-center gap-1 text-sm underline underline-offset-4 sm:inline-flex">Mehr entdecken <ChevronRight className="size-4" /></Link> : null}
          </div>
          <div className="scroll-x mt-10 grid auto-cols-[82%] snap-x snap-mandatory grid-flow-col gap-4 pb-3 sm:auto-cols-[42%] sm:gap-5 md:auto-cols-[31%] lg:grid-flow-row lg:grid-cols-4 lg:gap-8">
            {related.map((item) => <ProductCard key={item.id} product={item} />)}
          </div>
        </section>
      ) : null}

      <div className="-mx-5 mt-20 sm:-mx-8">
        <ReviewsSection reviews={reviews} title="Bewertungen unserer Kundschaft" />
      </div>

      <RecentlyViewed excludeHandle={product.handle} />

      <div className="sticky bottom-0 z-30 -mx-5 mt-10 border-t border-border bg-background/95 px-5 py-3 pb-safe backdrop-blur lg:hidden">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4">
          <div className="min-w-0"><p className="truncate text-sm font-medium">{product.title}</p>{price ? <p className="text-sm tabular-nums text-muted-foreground">{formatMoney(price.unitAmountMinor, price.currencyCode)}</p> : null}</div>
          <Button disabled={soldOut || cart.addItem.isPending} onClick={add} className="rounded-none"><Check className="size-4" />{cart.addItem.isPending ? "Wird hinzugefügt…" : "In den Warenkorb"}</Button>
        </div>
      </div>
    </div>
  );
}
