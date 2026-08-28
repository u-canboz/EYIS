/**
 * Reference storefront.
 *
 * Boundary rule: this subtree may ONLY import from `@/lib/store-sdk/**`,
 * `@/components/ui/**`, `@/components/storefront/**` and React/Router.
 * No `@/lib/commerce/**`, no Supabase. The ESLint boundary rule in
 * eslint.config.js fails the build on violations.
 */
import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { ShoppingBag, User } from "lucide-react";
import { CommerceProvider } from "@/lib/store-sdk/react/provider";
import type { CommerceClientConfig } from "@/lib/store-sdk";
import { useCart } from "@/lib/store-sdk/react/hooks";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { StoreContainer } from "@/components/storefront/StoreChrome";

export const Route = createFileRoute("/store")({
  component: StoreLayout,
});

/**
 * Resolves the publishable key. It is a shop identifier, NOT a secret, so it
 * may live in a client bundle, a URL parameter or localStorage.
 */
function resolvePublishableKey(): string {
  const envKey = import.meta.env["VITE_COMMERCE_PUBLISHABLE_KEY"] as string | undefined;
  if (typeof window === "undefined") return envKey ?? "";
  const fromUrl = new URLSearchParams(window.location.search).get("key");
  if (fromUrl) window.localStorage.setItem("commerce.publishableKey", fromUrl);
  return fromUrl ?? envKey ?? window.localStorage.getItem("commerce.publishableKey") ?? "";
}

function StoreLayout() {
  const [publishableKey, setPublishableKey] = useState<string>(
    () => (import.meta.env["VITE_COMMERCE_PUBLISHABLE_KEY"] as string | undefined) ?? "",
  );

  // URL/localStorage are only readable after hydration.
  useEffect(() => {
    setPublishableKey(resolvePublishableKey());
  }, []);
  const config = useMemo<CommerceClientConfig>(
    () => ({
      baseUrl:
        (typeof window === "undefined" ? "" : window.location.origin) + "/api/public/store/v1",
      publishableKey,
      locale: "de-DE",
    }),
    [publishableKey],
  );

  if (!publishableKey) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10">
        <h1 className="font-display text-xl font-semibold">Shop wird noch verbunden</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          Diese Storefront braucht den Publishable Key des Shops. Er identifiziert den Shop und ist
          kein Geheimnis. Setze <code className="mx-0.5">VITE_COMMERCE_PUBLISHABLE_KEY</code> oder
          trage ihn hier einmalig ein.
        </p>
        <form
          className="flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("key");
            if (typeof value === "string" && value.trim()) {
              window.localStorage.setItem("commerce.publishableKey", value.trim());
              setPublishableKey(value.trim());
            }
          }}
        >
          <Input name="key" className="h-11" placeholder="pk_…" aria-label="Publishable Key" />
          <Button type="submit" className="h-11">
            Shop laden
          </Button>
        </form>
      </div>
    );
  }

  return (
    <CommerceProvider config={config}>
      <div className="flex min-h-dvh flex-col bg-background">
        <StoreHeader />
        <main className="flex-1 pb-16">
          <Outlet />
        </main>
        <footer className="border-t border-border py-8">
          <StoreContainer wide>
            <p className="text-xs text-muted-foreground">
              Referenz-Storefront · Preise inkl. gesetzlicher Umsatzsteuer, zzgl. Versand.
            </p>
            <p className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
              Powered by
              <img
                src="/brand/eyis/eyis-full-logo.svg"
                alt=""
                aria-hidden
                width={90}
                className="block h-auto w-[90px]"
                draggable={false}
              />
            </p>
          </StoreContainer>
        </footer>
      </div>
    </CommerceProvider>
  );
}

function StoreHeader() {
  const cart = useCart();
  const count = cart.data?.items.reduce((sum, i) => sum + i.quantity, 0) ?? 0;

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <StoreContainer wide className="flex min-h-16 items-center gap-4">
        <Link
          to="/store"
          className="flex min-h-11 min-w-0 shrink-0 items-center rounded-md font-display text-base font-semibold tracking-tight focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none sm:text-lg"
        >
          Atelier
        </Link>
        <nav className="ml-auto flex items-center gap-1">
          <Link
            to="/store"
            className="hidden min-h-11 items-center rounded-lg px-3 text-sm font-medium text-muted-foreground hover:text-foreground sm:inline-flex"
          >
            Katalog
          </Link>
          <Link
            to="/store/konto"
            aria-label="Konto"
            className="inline-flex size-11 items-center justify-center rounded-lg text-muted-foreground hover:text-foreground"
          >
            <User className="size-5" aria-hidden />
          </Link>
          <Link
            to="/store/warenkorb"
            aria-label={`Warenkorb, ${count} Artikel`}
            className="relative inline-flex size-11 items-center justify-center rounded-lg text-foreground"
          >
            <ShoppingBag className="size-5" aria-hidden />
            {count > 0 ? (
              <span className="absolute top-1.5 right-1 grid min-w-4 place-items-center rounded-full bg-primary px-1 text-[10px] leading-4 font-semibold text-primary-foreground tabular-nums">
                {count}
              </span>
            ) : null}
          </Link>
        </nav>
      </StoreContainer>
    </header>
  );
}
