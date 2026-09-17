import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/store/newsletter/confirm")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { newsletterPage } =
          await import("@/lib/commerce/communications/newsletter-public.server");
        return newsletterPage("confirm", new URL(request.url).searchParams.get("token") ?? "");
      },
      POST: async ({ request }) => {
        const { newsletterPage } =
          await import("@/lib/commerce/communications/newsletter-public.server");
        const form = await request.formData().catch(() => new FormData());
        const token =
          new URL(request.url).searchParams.get("token") || String(form.get("token") ?? "");
        try {
          const { confirmNewsletter } =
            await import("@/lib/commerce/communications/newsletter.server");
          await confirmNewsletter(token);
          return newsletterPage("confirm", "", "Deine Newsletter-Anmeldung ist bestätigt.", true);
        } catch (e) {
          return newsletterPage(
            "confirm",
            "",
            e instanceof Error ? e.message : "Aktion fehlgeschlagen.",
            false,
            400,
          );
        }
      },
    },
  },
});
