import { createFileRoute } from "@tanstack/react-router";
import { LegalPage } from "@/components/store/LegalPage";
import { shop } from "@/content/shop";

export const Route = createFileRoute("/widerruf")({
  head: () => ({
    meta: [
      { title: `Widerrufsbelehrung — ${shop.name}` },
      { name: "description", content: `Widerrufsrecht, Fristen und Rücksendung bei Bestellungen im ${shop.name}.` },
      { property: "og:title", content: `Widerrufsbelehrung — ${shop.name}` },
      { property: "og:description", content: `Widerrufsrecht, Fristen und Rücksendung bei Bestellungen im ${shop.name}.` },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: Widerruf,
});

function Widerruf() {
  return (
    <LegalPage
      title="Widerrufsbelehrung"
      intro="Hier findest du die Bedingungen, unter denen du deine Bestellung widerrufen kannst."
      sections={[
        { title: "Widerrufsrecht", body: [], pending: true },
        { title: "Folgen des Widerrufs", body: [], pending: true },
        { title: "Ausnahmen vom Widerrufsrecht", body: [], pending: true },
        { title: "Muster-Widerrufsformular", body: [], pending: true },
      ]}
    />
  );
}
