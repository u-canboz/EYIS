import { useEffect, useState, type FormEvent } from "react";
import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNewsletterSubscribe } from "@/lib/store-sdk/react/hooks";
import { exitIntent } from "@/content/conversion";
import { newsletter } from "@/content/shop";

const KEY = "storefront.exit-intent.seen";

/**
 * Einmaliger Hinweis beim Verlassen der Seite. Erscheint frühestens nach
 * 20 Sekunden, merkt sich die Ablehnung und bleibt danach still.
 */
export function ExitIntentNewsletter() {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const subscribe = useNewsletterSubscribe();

  useEffect(() => {
    if (!exitIntent.enabled) return;
    if (typeof window === "undefined") return;

    let seen = false;
    try {
      seen = window.localStorage.getItem(KEY) === "1";
    } catch {
      seen = true;
    }
    if (seen) return;

    let armed = false;
    const arm = window.setTimeout(() => {
      armed = true;
    }, 20_000);

    const show = () => {
      if (!armed) return;
      setOpen(true);
      try {
        window.localStorage.setItem(KEY, "1");
      } catch {
        /* egal */
      }
      cleanup();
    };

    const onLeave = (event: MouseEvent) => {
      if (event.clientY <= 0) show();
    };
    let lastY = window.scrollY;
    const onScroll = () => {
      const y = window.scrollY;
      if (y < lastY - 220 && y > 400) show();
      lastY = y;
    };

    function cleanup() {
      window.clearTimeout(arm);
      document.removeEventListener("mouseout", onLeave);
      window.removeEventListener("scroll", onScroll);
    }

    document.addEventListener("mouseout", onLeave);
    window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, []);

  if (!open) return null;

  const onSubmit = (event: FormEvent) => {
    event.preventDefault();
    const value = email.trim();
    if (!value.includes("@")) return;
    subscribe.mutate({ email: value, source: "exit-intent" });
  };

  return (
    <div className="fixed inset-0 z-70 flex items-end justify-center p-4 sm:items-center">
      <button
        type="button"
        aria-label="Hinweis schließen"
        onClick={() => setOpen(false)}
        className="absolute inset-0 bg-foreground/40"
      />
      <div className="relative w-full max-w-md border border-border bg-background p-7 shadow-[var(--elevation-2)] pb-safe">
        <Button
          variant="ghost"
          size="icon"
          aria-label="Hinweis schließen"
          onClick={() => setOpen(false)}
          className="absolute right-2 top-2"
        >
          <X />
        </Button>
        <p className="text-xs uppercase tracking-[0.28em] text-brass">{exitIntent.eyebrow}</p>
        <h2 className="mt-3 font-display text-3xl leading-tight">{exitIntent.title}</h2>
        <p className="mt-3 text-sm text-muted-foreground">{exitIntent.text}</p>

        {subscribe.isSuccess ? (
          <p className="mt-6 border border-border bg-surface px-4 py-3 text-sm">
            {newsletter.success}
          </p>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 grid gap-3">
            <label className="sr-only" htmlFor="exit-newsletter-email">
              E-Mail-Adresse
            </label>
            <input
              id="exit-newsletter-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={newsletter.placeholder}
              className="min-h-11 w-full min-w-0 border border-border bg-background px-4 text-sm focus:border-foreground focus:outline-none"
            />
            <Button type="submit" size="lg" disabled={subscribe.isPending} className="rounded-none">
              {subscribe.isPending ? "Wird gesendet …" : "Gutschein sichern"}
            </Button>
          </form>
        )}
        {subscribe.isError ? (
          <p className="mt-3 text-sm text-muted-foreground">{newsletter.error}</p>
        ) : null}
        <button
          type="button"
          onClick={() => setOpen(false)}
          className="mt-4 min-h-9 text-xs text-muted-foreground underline underline-offset-4"
        >
          {exitIntent.dismiss}
        </button>
      </div>
    </div>
  );
}
