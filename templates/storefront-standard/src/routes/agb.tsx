import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/store/LegalPage";
import { shop } from "@/content/shop";

export const Route = createFileRoute("/agb")({
  head: () => ({
    meta: [
      { title: `AGB — ${shop.name}` },
      { name: "description", content: `Allgemeine Geschäftsbedingungen für Bestellungen im ${shop.name}.` },
      { property: "og:title", content: `AGB — ${shop.name}` },
      { property: "og:description", content: `Allgemeine Geschäftsbedingungen für Bestellungen im ${shop.name}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Agb,
});

function Agb() {
  return (
    <LegalPage
      title="Allgemeine Geschäftsbedingungen"
      sections={[
        { title: "Geltungsbereich", body: [], pending: true },
        { title: "Vertragsschluss", body: [], pending: true },
        { title: "Preise und Versandkosten", body: [], pending: true },
        { title: "Lieferung", body: [], pending: true },
        { title: "Zahlung", body: [], pending: true },
        { title: "Eigentumsvorbehalt und Gewährleistung", body: [], pending: true },
      ]}
    />
  );
}
