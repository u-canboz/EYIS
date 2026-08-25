/**
 * Reference storefront.
 *
 * Boundary rule: this subtree may ONLY import from `@/lib/store-sdk/**`,
 * `@/components/ui/**` and React/Router. No `@/lib/commerce/**`, no Supabase.
 * The ESLint boundary rule in eslint.config.js fails the build on violations.
 */
import { useMemo } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { CommerceProvider } from "@/lib/store-sdk/react/provider";
import type { CommerceClientConfig } from "@/lib/store-sdk";

export const Route = createFileRoute("/store")({
  component: StoreLayout,
});

function StoreLayout() {
  const config = useMemo<CommerceClientConfig>(
    () => ({
      baseUrl:
        (typeof window === "undefined" ? "" : window.location.origin) + "/api/public/store/v1",
      // Publishable key = shop identification, NOT a secret.
      publishableKey: import.meta.env["VITE_COMMERCE_PUBLISHABLE_KEY"] ?? "",
      locale: "de-DE",
    }),
    [],
  );

  return (
    <CommerceProvider config={config}>
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-4">
            <Link to="/store" className="font-display text-lg font-semibold">
              Referenz-Storefront
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <Link to="/store" className="hover:underline">
                Katalog
              </Link>
              <Link to="/store/warenkorb" className="hover:underline">
                Warenkorb
              </Link>
              <Link to="/store/konto" className="hover:underline">
                Konto
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-4xl px-4 py-6">
          <Outlet />
        </main>
      </div>
    </CommerceProvider>
  );
}
