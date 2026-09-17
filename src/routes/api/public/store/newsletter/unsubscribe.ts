import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/public/store/newsletter/unsubscribe")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { newsletterPage } =
          await import("@/lib/commerce/communications/newsletter-public.server");
        return newsletterPage("unsubscribe", new URL(request.url).searchParams.get("token") ?? "");
      },
      POST: async ({ request }) => {
        const { newsletterPage } =
          await import("@/lib/commerce/communications/newsletter-public.server");
        const form = await request.formData().catch(() => new FormData());
        const token =
          new URL(request.url).searchParams.get("token") || String(form.get("token") ?? "");
        try {
          const { unsubscribeNewsletter } =
            await import("@/lib/commerce/communications/newsletter.server");
          await unsubscribeNewsletter(token);
          return newsletterPage("unsubscribe", "", "Du bist vom Newsletter abgemeldet.", true);
        } catch (e) {
          return newsletterPage(
            "unsubscribe",
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
