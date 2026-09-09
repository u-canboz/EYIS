import { createFileRoute, Link } from "@tanstack/react-router";
import { shop } from "@/content/shop";

export const Route = createFileRoute("/faq")({
  head: () => ({
    meta: [
      { title: `Häufige Fragen — ${shop.name}` },
      { name: "description", content: `Antworten zu Bestellung, Versand, Zahlung, Rücksendung und Kundenkonto im ${shop.name}.` },
      { property: "og:title", content: `Häufige Fragen — ${shop.name}` },
      { property: "og:description", content: "Antworten zu Bestellung, Versand, Zahlung und Rücksendung." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Faq,
});

const ITEMS = [
  {
    q: "Wie finde ich das passende Produkt?",
    a: "Nutze die Suche im Kopf der Seite oder stöbere in den Kategorien. Auf jeder Produktseite findest du Beschreibung, verfügbare Größen und den Preis.",
  },
  {
    q: "Was kostet der Versand?",
    a: "Die Versandkosten hängen von Lieferadresse und gewählter Versandart ab und werden dir vor dem Kauf an der Kasse angezeigt.",
  },
  {
    q: "Welche Zahlungsarten gibt es?",
    a: "Die verfügbaren Zahlungsarten siehst du im Bestellvorgang. Es werden nur Zahlungsarten angeboten, die für deine Bestellung freigegeben sind.",
  },
  {
    q: "Kann ich ohne Konto bestellen?",
    a: "Ja. Du kannst als Gast bestellen und den Status später über die Gastbestellung abrufen.",
  },
  {
    q: "Wie sende ich etwas zurück?",
    a: "Melde die Rücksendung über die Retourenanmeldung an. Du bekommst dort die nächsten Schritte angezeigt.",
  },
];

function Faq() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl">Häufige Fragen</h1>
      <div className="mt-10 divide-y divide-border border-y border-border">
        {ITEMS.map((item) => (
          <details key={item.q} className="group py-4">
            <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm font-medium">
              {item.q}
              <span className="shrink-0 text-brass transition-transform group-open:rotate-45">+</span>
            </summary>
            <p className="mt-2 text-sm text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
      <p className="mt-10 text-sm text-muted-foreground">
        Keine Antwort gefunden?{" "}
        <Link to="/kontakt" className="underline underline-offset-4">
          Schreib uns
        </Link>{" "}
        oder per E-Mail an{" "}
        <a href={`mailto:${shop.email}`} className="underline underline-offset-4">
          {shop.email}
        </a>
        .
      </p>
    </div>
  );
}
