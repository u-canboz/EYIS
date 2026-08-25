/**
 * Publishable key handling.
 *
 * A publishable key is NOT a security credential. It only identifies shop,
 * environment and capabilities so the server knows which tenant a request
 * belongs to. Every access to cart, customer, order, document or return data
 * additionally requires a real access proof (cart token, customer session or
 * scoped guest token) — see gateway.server.ts.
 *
 * The origin allowlist is defence in depth, never an authentication substitute.
 */
import { generateToken, getAdmin, hashToken } from "../core.server";

export type StoreKey = {
  id: string;
  organizationId: string;
  shopId: string;
  environment: "test" | "live";
  allowedOrigins: string[];
  rateLimitProfile: string;
};

export async function resolveKey(rawKey: string | null): Promise<StoreKey | null> {
  if (!rawKey || rawKey.length < 20 || rawKey.length > 200) return null;
  const admin = await getAdmin();
  const hash = await hashToken(rawKey);
  const { data } = await admin
    .from("store_api_keys")
    .select("id, organization_id, shop_id, environment, allowed_origins, rate_limit_profile, status")
    .eq("key_hash", hash)
    .maybeSingle();
  const row = data as
    | {
        id: string;
        organization_id: string;
        shop_id: string;
        environment: "test" | "live";
        allowed_origins: string[] | null;
        rate_limit_profile: string;
        status: string;
      }
    | null;
  if (!row || row.status !== "active") return null;
  return {
    id: row.id,
    organizationId: row.organization_id,
    shopId: row.shop_id,
    environment: row.environment,
    allowedOrigins: row.allowed_origins ?? [],
    rateLimitProfile: row.rate_limit_profile,
  };
}

export function originAllowed(key: StoreKey, origin: string | null): boolean {
  // No browser origin (server-to-server) is allowed; browsers must match the list.
  if (!origin) return true;
  if (key.allowedOrigins.includes("*")) return true;
  if (key.allowedOrigins.some((o) => o.toLowerCase() === origin.toLowerCase())) return true;
  if (key.environment === "test") {
    try {
      const host = new URL(origin).hostname;
      if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".lovable.app")) return true;
    } catch {
      return false;
    }
  }
  return false;
}

export async function touchKey(keyId: string) {
  const admin = await getAdmin();
  await admin
    .from("store_api_keys")
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq("id", keyId);
}

/** Creates a key and returns the raw value exactly once. */
export async function createKey(input: {
  organizationId: string;
  shopId: string;
  name: string;
  environment: "test" | "live";
  allowedOrigins: string[];
  actorId: string | null;
}) {
  const admin = await getAdmin();
  const secret = generateToken();
  const raw = `pk_${input.environment}_${secret}`;
  const hash = await hashToken(raw);
  const prefix = raw.slice(0, 14);
  const { data, error } = await admin
    .from("store_api_keys")
    .insert({
      organization_id: input.organizationId,
      shop_id: input.shopId,
      name: input.name,
      key_prefix: prefix,
      key_hash: hash,
      environment: input.environment,
      allowed_origins: input.allowedOrigins,
      created_by: input.actorId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { id: (data as { id: string }).id, key: raw, prefix };
}
