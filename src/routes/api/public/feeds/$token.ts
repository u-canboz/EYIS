/**
 * Öffentlicher Produktdatenfeed für Google Merchant Center.
 *
 * GET /api/public/feeds/<feed-token>
 *
 * Der Zugang hängt ausschließlich am widerrufbaren Feed-Schlüssel; es gibt
 * keine Session und keine Kundendaten in der Antwort. Der Schlüssel wird nur
 * als Hash gespeichert und kann jederzeit im Backoffice rotiert oder
 * widerrufen werden.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/public/feeds/$token")({
  server: {
    handlers: {
      GET: async ({ request, params }) => {
        const { resolveFeedToken, renderFeedResponse } = await import(
          "@/lib/commerce/store/feed.server"
        );
        const feed = await resolveFeedToken(params.token ?? null);
        if (!feed) return new Response("Not found", { status: 404 });
        const origin = new URL(request.url).origin;
        try {
          return await renderFeedResponse(feed, origin);
        } catch (error) {
          console.error("product feed failed", error);
          return new Response("Feed temporarily unavailable", { status: 503 });
        }
      },
    },
  },
});
