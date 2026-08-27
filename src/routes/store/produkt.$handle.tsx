import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { ArrowLeft } from "lucide-react";
import { useCart, useProduct } from "@/lib/store-sdk/react/hooks";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ProductMedia,
  StickyBuyBar,
  StoreContainer,
  StoreNotice,
  formatPrice,
} from "@/components/storefront/StoreChrome";

export const Route = createFileRoute("/store/produkt/$handle")({
  head: () => ({
    meta: [
      { title: "Produkt – Referenz-Storefront" },
      {
        name: "description",
        content: "Produktdetails und Varianten, geladen über das öffentliche Commerce SDK.",
      },
      { property: "og:title", content: "Produkt – Referenz-Storefront" },
      { property: "og:description", content: "Produktdetails der Referenz-Storefront." },
      { property: "og:type", content: "product" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: StoreProductPage,
});

function StoreProductPage() {
  const { handle } = Route.useParams();
  const navigate = useNavigate();
  const product = useProduct(handle);
  const cart = useCart();
  const [variantId, setVariantId] = useState<string | null>(null);
  const [activeImage, setActiveImage] = useState(0);

  if (product.isLoading)
    return (
      <StoreContainer wide className="py-8">
        <div className="grid gap-8 lg:grid-cols-2">
          <Skeleton className="aspect-square w-full rounded-2xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-6 w-1/3" />
            <Skeleton className="h-24 w-full" />
          </div>
        </div>
      </StoreContainer>
    );

  if (product.error)
    return (
      <StoreContainer className="py-8">
        <StoreNotice
          tone="error"
          title="Produkt konnte nicht geladen werden"
          description={(product.error as Error).message}
        />
      </StoreContainer>
    );

  const data = product.data;
  if (!data) return null;

  const selected = data.variants.find((v) => v.id === variantId) ?? data.variants[0] ?? null;
  const price = selected?.price ?? data.price;
  const soldOut = selected?.availability === "out_of_stock";
  const images = data.images.length ? data.images : [];
  const hero = images[Math.min(activeImage, Math.max(images.length - 1, 0))];

  const addToCart = () => {
    if (!selected) return;
    cart.addItem.mutate(
      { variantId: selected.id, quantity: 1 },
      {
        onSuccess: () => {
          toast.success("Zum Warenkorb hinzugefügt.");
          void navigate({ to: "/store/warenkorb" });
        },
        onError: (e: Error) => toast.error(e.message),
      },
    );
  };

  const buyButton = (
    <Button
      className="h-12 w-full text-base"
      disabled={!selected || soldOut || cart.addItem.isPending}
      onClick={addToCart}
    >
      {soldOut ? "Nicht verfügbar" : "In den Warenkorb"}
    </Button>
  );

  return (
    <StoreContainer wide className="py-6 sm:py-10">
      <Link
        to="/store"
        className="-ml-2 inline-flex min-h-11 items-center gap-2 rounded-lg px-2 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4 shrink-0" aria-hidden />
        Katalog
      </Link>

      <article className="mt-4 grid min-w-0 gap-8 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)] lg:gap-12">
        <div className="min-w-0">
          <ProductMedia src={hero?.url} alt={hero?.alt ?? data.title} priority />
          {images.length > 1 ? (
            <div className="scroll-x mt-3 -mx-1 px-1">
              <div className="flex min-w-max gap-2">
                {images.map((img, i) => (
                  <button
                    key={img.url}
                    type="button"
                    aria-label={`Bild ${i + 1} anzeigen`}
                    aria-current={i === activeImage}
                    onClick={() => setActiveImage(i)}
                    className={
                      i === activeImage
                        ? "size-16 shrink-0 overflow-hidden rounded-xl border-2 border-primary"
                        : "size-16 shrink-0 overflow-hidden rounded-xl border border-border"
                    }
                  >
                    <img
                      src={img.url}
                      alt=""
                      loading="lazy"
                      className="size-full object-cover"
                      aria-hidden
                    />
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>

        <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
          <h1 className="font-display text-2xl leading-tight font-semibold tracking-tight text-balance sm:text-3xl">
            {data.title}
          </h1>
          {data.subtitle ? (
            <p className="mt-2 text-sm text-pretty text-muted-foreground">{data.subtitle}</p>
          ) : null}

          <p className="mt-4 text-2xl font-semibold tabular-nums">
            {price ? formatPrice(price.unitAmountMinor, price.currencyCode) : "Preis auf Anfrage"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            inkl. MwSt., zzgl. Versand
          </p>

          <div className="mt-3">
            <Badge variant={soldOut ? "destructive" : "secondary"}>
              {soldOut ? "Nicht verfügbar" : "Sofort lieferbar"}
            </Badge>
          </div>

          {data.variants.length > 1 ? (
            <div className="mt-6 min-w-0">
              <p className="text-sm font-medium">Variante</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {data.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setVariantId(v.id)}
                    aria-pressed={selected?.id === v.id}
                    className={
                      selected?.id === v.id
                        ? "min-h-11 min-w-0 rounded-xl border-2 border-primary px-4 text-sm font-medium"
                        : "min-h-11 min-w-0 rounded-xl border border-border px-4 text-sm text-muted-foreground hover:border-foreground/40"
                    }
                  >
                    <span className="min-w-0 break-words">{v.title}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}

          <div className="mt-6 hidden lg:block">{buyButton}</div>

          {data.description ? (
            <p className="mt-6 text-sm whitespace-pre-line text-pretty text-muted-foreground">
              {data.description}
            </p>
          ) : null}
        </div>
      </article>

      <StickyBuyBar>{buyButton}</StickyBuyBar>
    </StoreContainer>
  );
}
