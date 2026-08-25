/**
 * Single entry point for every public Store API request.
 *
 * Security model (all steps run server-side, in this order):
 *  1. request id + correlation
 *  2. publishable key -> shop/environment context ONLY (never authorisation)
 *  3. origin allowlist as additional protection, never as auth
 *  4. resource authorisation: cart token / customer session / guest token,
 *     always re-checked against the shop of the key and the resource owner
 *  5. per-profile rate limits (with dedicated buckets for sensitive routes)
 *  6. zod validation + payload limits
 *  7. uniform errors, security headers, privacy-safe logging
 */
import type { ZodType } from "zod";
import { getAdmin } from "../core.server";
import { clientIp, hashIp, summarizeUserAgent } from "./privacy.server";
import { originAllowed, resolveKey, touchKey, type StoreKey } from "./keys.server";
import { rateHit, type RateProfile } from "./rate.server";
import type { StoreErrorCode } from "@/lib/store-sdk/types";

export const MAX_BODY_BYTES = 64 * 1024;

export class StoreApiError extends Error {
  code: StoreErrorCode;
  status: number;
  fieldErrors?: Record<string, string>;
  constructor(code: StoreErrorCode, message: string, status: number, fieldErrors?: Record<string, string>) {
    super(message);
    this.code = code;
    this.status = status;
    if (fieldErrors) this.fieldErrors = fieldErrors;
  }
}

export const notFound = (msg = "Nicht gefunden.") => new StoreApiError("NOT_FOUND", msg, 404);
export const badRequest = (msg: string, fields?: Record<string, string>) =>
  new StoreApiError("VALIDATION_ERROR", msg, 400, fields);
export const unauthorized = (msg = "Zugriff nicht nachgewiesen.") =>
  new StoreApiError("UNAUTHORIZED", msg, 401);
export const forbidden = (msg = "Kein Zugriff auf diese Ressource.") =>
  new StoreApiError("FORBIDDEN", msg, 403);

export type CartAuth = {
  cart: import("../cart.server").CartRow;
  token: string;
};

export type StoreCtx = {
  requestId: string;
  key: StoreKey;
  request: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  ipHash: string | null;
  /** Cart/checkout access proof. */
  requireCartToken: () => string;
  requireCart: (cartId: string) => Promise<CartAuth>;
  /** Customer session (Supabase bearer token) mapped to this shop's customer. */
  requireCustomer: () => Promise<{ userId: string; customerId: string | null; email: string | null }>;
  /** Scoped guest access token, bound to exactly one order of this shop. */
  requireGuestOrder: () => Promise<{ orderId: string }>;
  limit: (profile: RateProfile, bucket?: string) => Promise<void>;
};

export type RouteHandler = (ctx: StoreCtx) => Promise<unknown>;

export type RouteDef = {
  method: "GET" | "POST" | "PATCH" | "DELETE";
  /** e.g. "/cart/:cartId/items/:itemId" */
  path: string;
  profile: RateProfile;
  schema?: ZodType<unknown>;
  handler: RouteHandler;
};

function corsHeaders(origin: string | null) {
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET,POST,PATCH,DELETE,OPTIONS",
    "Access-Control-Allow-Headers":
      "content-type,x-commerce-key,x-cart-token,x-guest-token,authorization,idempotency-key",
    "Access-Control-Expose-Headers": "x-request-id",
    "Access-Control-Max-Age": "600",
    Vary: "Origin",
  };
  if (origin) headers["Access-Control-Allow-Origin"] = origin;
  return headers;
}

const SECURITY_HEADERS: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer",
  "Cache-Control": "no-store",
};

function matchRoute(routes: RouteDef[], method: string, path: string) {
  for (const route of routes) {
    if (route.method !== method) continue;
    const parts = route.path.split("/").filter(Boolean);
    const actual = path.split("/").filter(Boolean);
    if (parts.length !== actual.length) continue;
    const params: Record<string, string> = {};
    let ok = true;
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i]!;
      const a = actual[i]!;
      if (p.startsWith(":")) params[p.slice(1)] = decodeURIComponent(a);
      else if (p !== a) {
        ok = false;
        break;
      }
    }
    if (ok) return { route, params };
  }
  return null;
}

async function logRequest(input: {
  requestId: string;
  key: StoreKey | null;
  method: string;
  route: string;
  status: number;
  durationMs: number;
  ipHash: string | null;
  request: Request;
  errorCode: string | null;
}) {
  try {
    const admin = await getAdmin();
    await admin.from("store_api_request_logs").insert({
      request_id: input.requestId,
      organization_id: input.key?.organizationId ?? null,
      key_id: input.key?.id ?? null,
      shop_id: input.key?.shopId ?? null,
      method: input.method,
      route: input.route.slice(0, 200),
      status_code: input.status,
      duration_ms: Math.round(input.durationMs),
      ip_hash: input.ipHash,
      user_agent_summary: summarizeUserAgent(input.request.headers.get("user-agent")),
      error_code: input.errorCode,
    } as never);
  } catch (e) {
    console.error("store api log failed", e);
  }
}

export async function handleStoreRequest(
  request: Request,
  routes: RouteDef[],
  basePath: string,
): Promise<Response> {
  const started = Date.now();
  const requestId = crypto.randomUUID();
  const origin = request.headers.get("origin");
  const url = new URL(request.url);
  const path = url.pathname.startsWith(basePath) ? url.pathname.slice(basePath.length) || "/" : url.pathname;

  const respond = (status: number, payload: unknown, allowOrigin: string | null) =>
    new Response(JSON.stringify(payload), {
      status,
      headers: {
        "Content-Type": "application/json",
        "X-Request-ID": requestId,
        ...SECURITY_HEADERS,
        ...corsHeaders(allowOrigin),
      },
    });

  if (request.method === "OPTIONS") {
    return new Response(null, {
      status: 204,
      headers: { ...SECURITY_HEADERS, ...corsHeaders(origin) },
    });
  }

  let key: StoreKey | null = null;
  let ipHash: string | null = null;
  let status = 500;
  let errorCode: string | null = "INTERNAL_ERROR";

  try {
    ipHash = await hashIp(clientIp(request));

    key = await resolveKey(request.headers.get("x-commerce-key"));
    if (!key) throw new StoreApiError("UNAUTHORIZED", "Ungültiger oder widerrufener API-Key.", 401);
    if (!originAllowed(key, origin))
      throw new StoreApiError("FORBIDDEN", "Origin ist für diesen Key nicht freigegeben.", 403);

    const matched = matchRoute(routes, request.method, path);
    if (!matched) throw notFound("Endpunkt existiert nicht.");

    // Rate limit bucket is the privacy-safe ip hash, so one abuser cannot
    // exhaust the limit for every visitor of the shop.
    const bucket = ipHash ?? "anon";
    const applyLimit = async (profile: RateProfile, suffix?: string) => {
      const result = await rateHit(key!.id, profile, suffix ? `${bucket}:${suffix}` : bucket);
      if (!result.allowed)
        throw new StoreApiError(
          "RATE_LIMITED",
          `Zu viele Anfragen. Bitte später erneut versuchen (${result.resetAt}).`,
          429,
        );
    };
    await applyLimit(matched.route.profile);

    let body: unknown = null;
    if (request.method !== "GET") {
      const raw = await request.text();
      if (raw.length > MAX_BODY_BYTES) throw badRequest("Anfrage ist zu groß.");
      if (raw.trim()) {
        try {
          body = JSON.parse(raw);
        } catch {
          throw badRequest("Ungültiges JSON.");
        }
      }
      if (matched.route.schema) {
        const parsed = matched.route.schema.safeParse(body ?? {});
        if (!parsed.success) {
          const fields: Record<string, string> = {};
          for (const issue of parsed.error.issues) fields[issue.path.join(".") || "_"] = issue.message;
          throw badRequest("Eingabe ist ungültig.", fields);
        }
        body = parsed.data;
      }
    }

    const ctx = buildContext({
      requestId,
      key,
      request,
      params: matched.params,
      query: url.searchParams,
      body,
      ipHash,
      applyLimit,
    });

    const data = await matched.route.handler(ctx);
    void touchKey(key.id);
    status = 200;
    errorCode = null;
    return respond(200, { data, requestId }, origin);
  } catch (error) {
    if (error instanceof StoreApiError) {
      status = error.status;
      errorCode = error.code;
      return respond(
        error.status,
        {
          error: {
            code: error.code,
            message: error.message,
            ...(error.fieldErrors ? { fieldErrors: error.fieldErrors } : {}),
          },
          requestId,
        },
        origin,
      );
    }
    console.error("store api error", requestId, error);
    status = 500;
    errorCode = "INTERNAL_ERROR";
    return respond(
      500,
      { error: { code: "INTERNAL_ERROR", message: "Unerwarteter Fehler." }, requestId },
      origin,
    );
  } finally {
    void logRequest({
      requestId,
      key,
      method: request.method,
      route: path,
      status,
      durationMs: Date.now() - started,
      ipHash,
      request,
      errorCode,
    });
  }
}

function buildContext(input: {
  requestId: string;
  key: StoreKey;
  request: Request;
  params: Record<string, string>;
  query: URLSearchParams;
  body: unknown;
  ipHash: string | null;
  applyLimit: (profile: RateProfile, suffix?: string) => Promise<void>;
}): StoreCtx {
  const { key, request } = input;

  const requireCartToken = () => {
    const token = request.headers.get("x-cart-token");
    if (!token) throw unauthorized("Cart-Token fehlt.");
    return token;
  };

  return {
    requestId: input.requestId,
    key,
    request,
    params: input.params,
    query: input.query,
    body: input.body,
    ipHash: input.ipHash,
    requireCartToken,
    limit: (profile, bucket) => input.applyLimit(profile, bucket),

    async requireCart(cartId: string) {
      const token = requireCartToken();
      const cartApi = await import("../cart.server");
      let cart;
      try {
        cart = await cartApi.loadCartAuthorized(cartId, token);
      } catch {
        throw forbidden("Warenkorb nicht zugänglich.");
      }
      // Ownership must hold even when key + origin are correct.
      if (cart.shop_id !== key.shopId || cart.organization_id !== key.organizationId)
        throw forbidden("Warenkorb gehört nicht zu diesem Shop.");
      return { cart, token } as CartAuth;
    },

    async requireCustomer() {
      const header = request.headers.get("authorization");
      const bearer = header?.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : null;
      if (!bearer) throw unauthorized("Kunden-Session fehlt.");
      const admin = await getAdmin();
      const { data, error } = await admin.auth.getUser(bearer);
      if (error || !data?.user)
        throw new StoreApiError("CUSTOMER_SESSION_EXPIRED", "Kunden-Session ist ungültig.", 401);
      const userId = data.user.id;
      const { data: customer } = await admin
        .from("customers")
        .select("id, email, status")
        .eq("shop_id", key.shopId)
        .eq("auth_user_id", userId)
        .maybeSingle();
      const row = customer as { id: string; email: string | null; status: string } | null;
      return {
        userId,
        customerId: row?.id ?? null,
        email: row?.email ?? data.user.email ?? null,
      };
    },

    async requireGuestOrder() {
      const token = request.headers.get("x-guest-token");
      if (!token) throw unauthorized("Guest-Token fehlt.");
      const { resolveGuestToken } = await import("../customers/customer.server");
      const access = await resolveGuestToken(token);
      if (!access) throw forbidden("Guest-Token ist ungültig oder abgelaufen.");
      if (access.shopId !== key.shopId || access.organizationId !== key.organizationId)
        throw forbidden("Guest-Token gehört nicht zu diesem Shop.");
      return { orderId: access.orderId };
    },
  };
}
