/**
 * Reference storefront.
 *
 * Boundary rule: this subtree may ONLY import from `@/lib/store-sdk/**`,
 * `@/components/ui/**` and React/Router. No `@/lib/commerce/**`, no Supabase.
 * The ESLint boundary rule in eslint.config.js fails the build on violations.
 */
import { useMemo, useState } from "react";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { CommerceProvider } from "@/lib/store-sdk/react/provider";
import type { CommerceClientConfig } from "@/lib/store-sdk";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

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
  const [publishableKey, setPublishableKey] = useState<string>(() => resolvePublishableKey());
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
      <div className="mx-auto max-w-md space-y-4 p-8">
        <h1 className="font-display text-xl font-semibold">Publishable Key erforderlich</h1>
        <p className="text-sm text-muted-foreground">
          Der Publishable Key identifiziert den Shop und ist kein Geheimnis. Setze
          <code className="mx-1">VITE_COMMERCE_PUBLISHABLE_KEY</code>oder trage ihn hier ein.
        </p>
        <form
          className="flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const value = new FormData(event.currentTarget).get("key");
            if (typeof value === "string" && value.trim()) {
              window.localStorage.setItem("commerce.publishableKey", value.trim());
              setPublishableKey(value.trim());
            }
          }}
        >
          <Input name="key" placeholder="pk_..." aria-label="Publishable Key" />
          <Button type="submit">Laden</Button>
        </form>
      </div>
    );
  }

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
