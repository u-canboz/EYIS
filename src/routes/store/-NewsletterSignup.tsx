import { useState } from "react";
import { useNewsletterSubscribe } from "@/lib/store-sdk/react/hooks";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
const CONSENT =
  "Ich möchte Neuigkeiten und Angebote per E-Mail erhalten. Abmeldung jederzeit möglich.";
export function NewsletterSignup() {
  const [email, setEmail] = useState("");
  const subscribe = useNewsletterSubscribe();
  return (
    <section className="mb-8 max-w-lg space-y-3">
      <h2 className="font-display text-lg font-semibold">Neuigkeiten aus unserem Shop</h2>
      {subscribe.isSuccess ? (
        <p role="status" className="text-sm">
          Bitte bestätige deine Anmeldung über den Link in deiner E-Mail.
        </p>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            subscribe.mutate({ email, consent: true, consentText: CONSENT });
          }}
        >
          <div className="flex flex-wrap gap-2">
            <Input
              required
              type="email"
              autoComplete="email"
              aria-label="E-Mail für den Newsletter"
              placeholder="Deine E-Mail-Adresse"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="min-w-0 flex-1"
            />
            <Button type="submit" disabled={subscribe.isPending}>
              {subscribe.isPending ? "Wird angemeldet…" : "Anmelden"}
            </Button>
          </div>
          <label className="flex items-start gap-3 text-sm text-muted-foreground">
            <input type="checkbox" required className="mt-1" />
            {CONSENT}
          </label>
          {subscribe.isError && (
            <p role="alert" className="text-sm text-destructive">
              {subscribe.error.message}
            </p>
          )}
        </form>
      )}
    </section>
  );
}
