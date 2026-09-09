import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/store/LegalPage";
import { shop } from "@/content/shop";

export const Route = createFileRoute("/datenschutz")({
  head: () => ({
    meta: [
      { title: `Datenschutz — ${shop.name}` },
      { name: "description", content: `Wie ${shop.name} personenbezogene Daten bei Bestellung, Konto und Kontakt verarbeitet.` },
      { property: "og:title", content: `Datenschutz — ${shop.name}` },
      { property: "og:description", content: `Informationen zur Verarbeitung deiner Daten im ${shop.name}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Datenschutz,
});

function Datenschutz() {
  return (
    <LegalPage
      title="Datenschutzerklärung"
      intro="Diese Seite beschreibt, welche Daten bei einer Bestellung, im Kundenkonto und bei einer Kontaktanfrage verarbeitet werden."
      sections={[
        { title: "Verantwortliche Stelle", body: [], pending: true },
        { title: "Bestellabwicklung und Zahlung", body: [], pending: true },
        { title: "Kundenkonto", body: [], pending: true },
        { title: "Versanddienstleister", body: [], pending: true },
        { title: "Cookies und Reichweitenmessung", body: [], pending: true },
        { title: "Deine Rechte", body: [], pending: true },
      ]}
    />
  );
}
