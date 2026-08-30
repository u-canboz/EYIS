import { createFileRoute } from "@tanstack/react-router";

import { AuthPanel } from "@/components/eyis/AuthPanel";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Anmelden – EYIS" },
      {
        name: "description",
        content: "Melde dich bei EYIS an oder registriere deine Organisation.",
      },
      { property: "og:title", content: "Anmelden – EYIS" },
      {
        property: "og:description",
        content: "Melde dich bei EYIS an oder registriere deine Organisation.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  return <AuthPanel authPath="/auth" />;
}
