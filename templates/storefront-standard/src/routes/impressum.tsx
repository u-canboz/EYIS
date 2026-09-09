import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/store/LegalPage";
import { shop } from "@/content/shop";

export const Route = createFileRoute("/impressum")({
  head: () => ({
    meta: [
      { title: `Impressum — ${shop.name}` },
      { name: "description", content: `Anbieterkennzeichnung und Kontaktangaben von ${shop.name}.` },
      { property: "og:title", content: `Impressum — ${shop.name}` },
      { property: "og:description", content: `Anbieterkennzeichnung und Kontaktangaben des ${shop.name}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Impressum,
});

function Impressum() {
  return (
    <LegalPage
      title="Impressum"
      sections={[
        {
          title: "Anbieter",
          body: [shop.name, shop.street, shop.city, `E-Mail: ${shop.email}`],
        },
        { title: "Vertretungsberechtigt", body: ["Vor- und Nachname eintragen"] },
        { title: "Umsatzsteuer-Identifikationsnummer", body: [], pending: true },
        { title: "Handelsregister und Registernummer", body: [], pending: true },
        { title: "Verbraucherstreitbeilegung", body: [], pending: true },
      ]}
    />
  );
}
