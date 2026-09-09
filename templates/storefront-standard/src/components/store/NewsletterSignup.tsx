import { useState, type FormEvent } from "react";
import { useNewsletterSubscribe } from "@/lib/store-sdk/react/hooks";
import { newsletter } from "@/content/shop";
import { Button } from "@/components/ui/button";
import { Reveal } from "./Reveal";

/**
 * Anmeldung mit doppelter Bestätigung. Die Storefront speichert nichts selbst —
 * Adresse, Bestätigungslink und Gutschein verwaltet das Shopsystem.
 */
export function NewsletterSignup({ source = "storefront" }: { source?: string }) {
  const [email, setEmail] = useState("");
  const subscribe = useNewsletterSubscribe();
  const done = subscribe.isSuccess;

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value.includes("@")) return;
    subscribe.mutate({ email: value, source });
  }

  return (
    <section className="bg-olive text-olive-foreground">
      <div className="mx-auto max-w-(--content-max) px-4 py-16 sm:px-6 lg:py-24">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs uppercase tracking-[0.28em] text-olive-foreground/70">
            {newsletter.eyebrow}
          </p>
          <h2 className="mt-4 font-display text-3xl leading-tight sm:text-4xl">
            {newsletter.title}
          </h2>
          <p className="mt-4 text-sm text-olive-foreground/80 sm:text-base">{newsletter.text}</p>

          {done ? (
            <p className="mt-8 border border-olive-foreground/30 px-5 py-4 text-sm">
              {newsletter.success}
            </p>
          ) : (
            <form
              onSubmit={onSubmit}
              className="mt-8 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto]"
            >
              <label className="sr-only" htmlFor="newsletter-email">
                E-Mail-Adresse
              </label>
              <input
                id="newsletter-email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder={newsletter.placeholder}
                className="min-h-11 w-full min-w-0 border border-olive-foreground/35 bg-transparent px-4 text-sm text-olive-foreground placeholder:text-olive-foreground/50 focus:border-olive-foreground focus:outline-none"
              />
              <Button
                type="submit"
                variant="outline"
                disabled={subscribe.isPending}
                className="min-h-11 rounded-none border-olive-foreground/40 bg-transparent px-7 text-olive-foreground hover:bg-olive-foreground hover:text-olive"
              >
                {subscribe.isPending ? "Wird gesendet …" : newsletter.cta}
              </Button>
            </form>
          )}

          {subscribe.isError ? (
            <p className="mt-4 text-sm text-olive-foreground/80">{newsletter.error}</p>
          ) : null}
          <p className="mt-4 text-xs text-olive-foreground/60">{newsletter.hint}</p>
        </Reveal>
      </div>
    </section>
  );
}
