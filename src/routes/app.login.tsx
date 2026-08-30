/**
 * Reservierter Anmeldepfad des EYIS-Backoffice (`EYIS_AUTH_PATH`).
 *
 * Er liegt innerhalb des EYIS-Präfixes `/app` und kollidiert deshalb in einer
 * Dedicated-Installation nie mit einem kundeneigenen `/login` oder `/auth`.
 * Die Route ist bewusst öffentlich: hier meldet man sich erst an.
 */

import { createFileRoute } from "@tanstack/react-router";

import { AuthPanel } from "@/eyis/auth/AuthPanel";
import { EYIS_AUTH_PATH } from "@/lib/eyis/route-boundary";

export const Route = createFileRoute("/app/login")({
  head: () => ({
    meta: [
      { title: "Backoffice-Anmeldung – EYIS" },
      {
        name: "description",
        content: "Anmeldung zum EYIS Backoffice: Bestellungen, Katalog, Lager und Dokumente.",
      },
      { property: "og:title", content: "Backoffice-Anmeldung – EYIS" },
      {
        property: "og:description",
        content: "Anmeldung zum EYIS Backoffice: Bestellungen, Katalog, Lager und Dokumente.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: BackofficeLogin,
});

function BackofficeLogin() {
  return <AuthPanel authPath={EYIS_AUTH_PATH} />;
}
