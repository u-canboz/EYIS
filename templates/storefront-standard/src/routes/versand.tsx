import { createFileRoute, Link } from "@tanstack/react-router";
import { shop } from "@/content/shop";

export const Route = createFileRoute("/versand")({
  head: () => ({
    meta: [
      { title: `Versand & Lieferung — ${shop.name}` },
      { name: "description", content: `Versand, Bearbeitungszeit, Sendungsverfolgung und Rücksendung bei ${shop.name}.` },
      { property: "og:title", content: `Versand & Lieferung — ${shop.name}` },
      { property: "og:description", content: "Versand, Bearbeitung, Lieferung und Rücksendung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Versand,
});

function Versand() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl">Versand & Lieferung</h1>
      <p className="mt-4 text-muted-foreground">
        Wir versenden von {shop.city.replace(/^\d+\s/, "")} aus. Deine Bestellung wird nach
        Zahlungseingang bearbeitet.
      </p>

      <div className="mt-10 grid gap-8">
        <section>
          <h2 className="font-display text-xl">Versandkosten</h2>
          <p className="mt-2 text-sm">
            Die Versandkosten werden im Warenkorb und an der Kasse anhand deiner Lieferadresse
            berechnet und dort vor dem Kauf angezeigt.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">Lieferzeit</h2>
          <p className="mt-2 text-sm">
            Die voraussichtliche Lieferzeit siehst du bei der Wahl der Versandart im Bestellvorgang.
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">Sendungsverfolgung</h2>
          <p className="mt-2 text-sm">
            Sobald deine Bestellung unterwegs ist, findest du den Status in deinem{" "}
            <Link to="/konto" className="underline underline-offset-4">
              Kundenkonto
            </Link>{" "}
            oder über die{" "}
            <Link to="/bestellung/gast" className="underline underline-offset-4">
              Gastbestellung
            </Link>
            .
          </p>
        </section>
        <section>
          <h2 className="font-display text-xl">Rücksendung</h2>
          <p className="mt-2 text-sm">
            Eine Rücksendung meldest du über die{" "}
            <Link to="/retouren" className="underline underline-offset-4">
              Retourenanmeldung
            </Link>{" "}
            an.
          </p>
        </section>
      </div>
    </div>
  );
}
