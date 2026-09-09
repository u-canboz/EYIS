import { createFileRoute, Link } from "@tanstack/react-router";
import { useStoreConfig } from "@/lib/store-sdk/react/hooks";

export const Route = createFileRoute("/kontakt")({
  head: () => ({
    meta: [
      { title: "Kontakt und Hilfe | Hauptshop" },
      {
        name: "description",
        content: "Fragen zu Bestellung, Versand oder Rücksendung — so erreichst du uns.",
      },
      { property: "og:title", content: "Kontakt und Hilfe | Hauptshop" },
      {
        property: "og:description",
        content: "Fragen zu Bestellung, Versand oder Rücksendung — so erreichst du uns.",
      },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const { data: config } = useStoreConfig();
  const name = config?.shop.name ?? "Hauptshop";

  return (
    <div className="mx-auto max-w-3xl px-5 py-16">
      <h1 className="text-3xl sm:text-4xl">Kontakt und Hilfe</h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Fragen zu Bestellung, Versand oder Rücksendung — schreib mir gern, ich helfe schnell weiter.
      </p>

      <div className="mt-12 grid gap-8 sm:grid-cols-2">
        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">E-Mail</h2>
          <p className="mt-2 text-sm">
            <a href="mailto:info@u-cangraphic.com" className="underline underline-offset-4">
              info@u-cangraphic.com
            </a>
          </p>
        </section>
        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Telefon</h2>
          <p className="mt-2 text-sm">+49 000 0000000</p>
        </section>
        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Versand</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Bestellungen verlassen das Lager in der Regel innerhalb von 1–2 Werktagen.
          </p>
        </section>
        <section>
          <h2 className="text-xs uppercase tracking-widest text-muted-foreground">Rücksendung</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Artikel können innerhalb der gesetzlichen Frist zurückgesendet werden.{" "}
            <Link to="/retouren" className="underline underline-offset-4">
              Retoure anmelden
            </Link>
            .
          </p>
        </section>
      </div>
    </div>
  );
}
