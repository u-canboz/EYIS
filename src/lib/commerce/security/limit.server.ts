/**
 * Rate limiting for PUBLIC server functions (portal guest access, cart and
 * checkout endpoints of the built-in storefront).
 *
 * The public Store API has its own limiter bound to the API key
 * (store/rate.server.ts). Server functions have no API key, so they share a
 * fixed internal bucket id and are counted per day-scoped IP hash.
 */
import { getRequest } from "@tanstack/react-start/server";
import { getAdmin } from "../core.server";
import { clientIp, hashIp } from "../store/privacy.server";

/** Sentinel "key" for server-function traffic; store_api_rate_counters has no FK. */
const INTERNAL_KEY_ID = "00000000-0000-0000-0000-000000000001";

export type PublicLimit = { limit: number; windowSeconds: number };

export const PUBLIC_LIMITS = {
  guest_access_request: { limit: 5, windowSeconds: 300 },
  cart_write: { limit: 120, windowSeconds: 60 },
  checkout_write: { limit: 60, windowSeconds: 60 },
  payment_session: { limit: 10, windowSeconds: 300 },
  return_create: { limit: 5, windowSeconds: 600 },
} satisfies Record<string, PublicLimit>;

export type PublicLimitProfile = keyof typeof PUBLIC_LIMITS;

async function currentBucket(extra?: string): Promise<string> {
  let ip: string | null = null;
  try {
    const request = getRequest();
    ip = request ? clientIp(request) : null;
  } catch {
    ip = null;
  }
  const hashed = await hashIp(ip);
  return `${hashed ?? "unknown"}${extra ? `:${extra}` : ""}`.slice(0, 64);
}

/**
 * Throws a user-safe error when the caller exceeded the profile.
 * Fails CLOSED: if the counter cannot be written, the request is refused,
 * because every profile here protects a sensitive operation.
 */
export async function enforcePublicLimit(profile: PublicLimitProfile, extra?: string) {
  const conf = PUBLIC_LIMITS[profile];
  const bucket = await currentBucket(extra);
  const admin = await getAdmin();
  const { data, error } = await admin.rpc(
    "store_rate_hit" as never,
    {
      p_key_id: INTERNAL_KEY_ID,
      p_profile: `fn:${profile}`,
      p_bucket: bucket,
      p_limit: conf.limit,
      p_window_seconds: conf.windowSeconds,
    } as never,
  );
  if (error) throw new Error("Zu viele Anfragen. Bitte später erneut versuchen.");
  const row = data as { allowed: boolean } | null;
  if (!row?.allowed) throw new Error("Zu viele Anfragen. Bitte später erneut versuchen.");
}
