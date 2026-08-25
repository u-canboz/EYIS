/**
 * Public Store API v1.
 *
 * Single splat entry point: every request goes through the gateway, which
 * resolves the publishable key, enforces origin allowlist, access proofs,
 * rate limits and validation before a handler ever runs.
 */
import { createFileRoute } from "@tanstack/react-router";

const BASE = "/api/public/store/v1";

async function dispatch(request: Request) {
  const { handleStoreRequest } = await import("@/lib/commerce/store/gateway.server");
  const { storeRoutes } = await import("@/lib/commerce/store/routes.server");
  return handleStoreRequest(request, storeRoutes, BASE);
}

export const Route = createFileRoute("/api/public/store/v1/$")({
  server: {
    handlers: {
      GET: ({ request }) => dispatch(request),
      POST: ({ request }) => dispatch(request),
      PATCH: ({ request }) => dispatch(request),
      DELETE: ({ request }) => dispatch(request),
      OPTIONS: ({ request }) => dispatch(request),
    },
  },
});
