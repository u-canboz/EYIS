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
 * Dedicated: die Storefront fragt die eigene Installation nach ihrem
 * öffentlichen Shop-Kontext (Same-Origin). Keine ENV-Variable, keine
 * manuelle Key-Eingabe. Remote-Overrides greifen nur, wenn die Installation
 * nicht im Dedicated-Modus läuft.
 */
function StoreLayout() {
  const [runtime, setRuntime] = useState<ResolvedRuntime | null>(null);

  useEffect(() => {
    let active = true;
    void resolveRuntime({
      publishableKey: import.meta.env["VITE_COMMERCE_PUBLISHABLE_KEY"] as string | undefined,
      baseUrl: import.meta.env["VITE_COMMERCE_API_URL"] as string | undefined,
    }).then((resolved) => {
      if (active) setRuntime(resolved);
    });
    return () => {
      active = false;
    };
  }, []);

  const config = useMemo<CommerceClientConfig | null>(
    () =>
      runtime?.status === "ready"
        ? {
            baseUrl: runtime.baseUrl,
            publishableKey: runtime.publishableKey,
            locale: runtime.locale,
          }
        : null,
    [runtime],
  );

  if (!runtime) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-3 px-5 py-10">
        <p className="text-sm text-muted-foreground">Shop wird geladen …</p>
      </div>
    );
  }

  if (!config) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-4 px-5 py-10">
        <h1 className="font-display text-xl font-semibold">Shop ist noch nicht eingerichtet</h1>
        <p className="text-sm text-pretty text-muted-foreground">
          {runtime.status === "setup_required"
            ? "Diese EYIS-Installation hat noch keinen Owner und keinen Hauptshop. Die Einrichtung erfolgt im Backoffice."
            : "Für diese Storefront ist kein Shop erreichbar. Prüfe die Installation im Backoffice."}
        </p>
        <a
          href="/app/setup"
          className="inline-flex h-11 items-center justify-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground"
        >
          Einrichtung öffnen
        </a>
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
