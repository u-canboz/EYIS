import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useNewsletterConfirm } from "@/lib/store-sdk/react/hooks";
import { shop } from "@/content/shop";

const TITLE = `Newsletter bestätigen — ${shop.name}`;
const DESCRIPTION =
  `Bestätige deine Anmeldung zum ${shop.name} Newsletter und erhalte deinen Gutscheincode.`;

export const Route = createFileRoute("/newsletter/bestaetigen")({
  validateSearch: (search: Record<string, unknown>) => ({
    token: typeof search["token"] === "string" ? (search["token"] as string) : "",
  }),
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: ConfirmPage,
});

function ConfirmPage() {
  const { token } = Route.useSearch();
  const confirm = useNewsletterConfirm();
  const started = useRef(false);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    if (!token || started.current) return;
    started.current = true;
    confirm.mutate(token, { onSuccess: (result) => setCode(result.discountCode) });
  }, [token, confirm]);

  return (
    <div className="mx-auto max-w-2xl px-4 py-20 sm:px-6 lg:py-28">
      <h1 className="font-display text-3xl leading-tight sm:text-4xl">Newsletter bestätigen</h1>

      {!token ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Dieser Link ist unvollständig. Bitte öffne den Bestätigungslink direkt aus deiner E-Mail.
        </p>
      ) : confirm.isPending ? (
        <p className="mt-5 text-sm text-muted-foreground">Einen Moment, wir prüfen den Link …</p>
      ) : confirm.isError ? (
        <p className="mt-5 text-sm text-muted-foreground">
          Der Link ist abgelaufen oder wurde bereits verwendet. Melde dich einfach erneut an.
        </p>
      ) : confirm.isSuccess ? (
        <div className="mt-5 grid gap-4 text-sm">
          <p>Danke — deine Anmeldung ist bestätigt.</p>
          {code ? (
            <p className="border border-border bg-surface px-5 py-4">
              Dein Gutscheincode: <span className="font-display text-lg tracking-wide">{code}</span>
            </p>
          ) : null}
          <p>
            <Link to="/shop" className="underline underline-offset-4">
              Weiter zum Sortiment
            </Link>
          </p>
        </div>
      ) : null}
    </div>
  );
}
