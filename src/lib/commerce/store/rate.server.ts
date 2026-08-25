/**
 * Rate limiting for the public Store API.
 * Counting happens server-side in Postgres (store_rate_hit) so parallel
 * workers cannot race. Sensitive operations get their own, much stricter
 * buckets instead of sharing the coarse profiles.
 */
import { getAdmin } from "../core.server";

export type RateProfile =
  | "catalog_read"
  | "search"
  | "cart_write"
  | "checkout"
  | "customer_auth"
  | "guest_lookup"
  | "payment_session"
  | "return_create"
  | "customer_login";

export const RATE_LIMITS: Record<RateProfile, { limit: number; windowSeconds: number }> = {
  catalog_read: { limit: 300, windowSeconds: 60 },
  search: { limit: 60, windowSeconds: 60 },
  cart_write: { limit: 60, windowSeconds: 60 },
  checkout: { limit: 30, windowSeconds: 60 },
  customer_auth: { limit: 30, windowSeconds: 60 },
  guest_lookup: { limit: 10, windowSeconds: 300 },
  payment_session: { limit: 10, windowSeconds: 300 },
  return_create: { limit: 5, windowSeconds: 600 },
  customer_login: { limit: 5, windowSeconds: 300 },
};

export type RateResult = { allowed: boolean; hits: number; limit: number; resetAt: string };

export async function rateHit(keyId: string, profile: RateProfile, bucket: string): Promise<RateResult> {
  const conf = RATE_LIMITS[profile];
  const admin = await getAdmin();
  const { data, error } = await admin.rpc("store_rate_hit" as never, {
    p_key_id: keyId,
    p_profile: profile,
    p_bucket: bucket.slice(0, 64),
    p_limit: conf.limit,
    p_window_seconds: conf.windowSeconds,
  } as never);
  if (error) {
    // Fail closed only for the strict buckets; catalog reads stay available.
    const strict: RateProfile[] = ["payment_session", "return_create", "customer_login", "guest_lookup"];
    return {
      allowed: !strict.includes(profile),
      hits: 0,
      limit: conf.limit,
      resetAt: new Date(Date.now() + conf.windowSeconds * 1000).toISOString(),
    };
  }
  const row = data as { allowed: boolean; hits: number; limit: number; reset_at: string };
  return { allowed: row.allowed, hits: row.hits, limit: row.limit, resetAt: row.reset_at };
}
