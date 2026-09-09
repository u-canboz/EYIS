import { createFileRoute, Link } from "@tanstack/react-router";
import { shop } from "@/content/shop";

export const Route = createFileRoute("/vertrag-widerrufen")({
  head: () => ({
    meta: [
      { title: `Vertrag widerrufen — ${shop.name}` },
      { name: "description", content: `So widerrufst du deine Bestellung beim ${shop.name}: Angaben, Fristen und Kontaktweg.` },
      { property: "og:title", content: `Vertrag widerrufen — ${shop.name}` },
      { property: "og:description", content: `So widerrufst du deine Bestellung beim ${shop.name}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: VertragWiderrufen,
});

function VertragWiderrufen() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14 sm:px-6 sm:py-20">
      <h1 className="font-display text-3xl sm:text-4xl">Vertrag widerrufen</h1>
      <p className="mt-4 text-muted-foreground">
        Du möchtest deine Bestellung widerrufen? Schreib uns eine E-Mail mit den folgenden Angaben.
        Wir bestätigen dir den Eingang.
      </p>
      <ul className="mt-6 grid gap-2 text-sm">
        <li>Bestellnummer und Bestelldatum</li>
        <li>Dein Name und deine Anschrift</li>
        <li>Die Artikel, die du widerrufen möchtest</li>
        <li>Datum</li>
      </ul>
      <a
        href={`mailto:${shop.email}?subject=Widerruf%20meiner%20Bestellung`}
        className="mt-8 inline-flex min-h-11 items-center bg-brass px-6 text-sm text-primary-foreground transition-opacity hover:opacity-90"
      >
        Widerruf per E-Mail senden
      </a>
      <p className="mt-8 text-sm text-muted-foreground">
        Die rechtlichen Bedingungen findest du in der{" "}
        <Link to="/widerruf" className="underline underline-offset-4">
          Widerrufsbelehrung
        </Link>
        . Für eine Rücksendung nutze bitte die{" "}
        <Link to="/retouren" className="underline underline-offset-4">
          Retourenanmeldung
        </Link>
        .
      </p>
    </div>
  );
}
