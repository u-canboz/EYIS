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

export type StoreKeySummary = {
  id: string;
  name: string;
  prefix: string;
  environment: "test" | "live";
  allowedOrigins: string[];
  status: string;
  createdAt: string;
  lastUsedAt: string | null;
};

export async function listKeys(organizationId: string, shopId: string): Promise<StoreKeySummary[]> {
  const admin = await getAdmin();
  const { data, error } = await admin
    .from("store_api_keys")
    .select("id, name, key_prefix, environment, allowed_origins, status, created_at, last_used_at")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r["id"] as string,
    name: r["name"] as string,
    prefix: r["key_prefix"] as string,
    environment: r["environment"] as "test" | "live",
    allowedOrigins: (r["allowed_origins"] as string[] | null) ?? [],
    status: r["status"] as string,
    createdAt: r["created_at"] as string,
    lastUsedAt: (r["last_used_at"] as string | null) ?? null,
  }));
}

export async function updateKey(input: {
  organizationId: string;
  keyId: string;
  name?: string;
  allowedOrigins?: string[];
  status?: "active" | "revoked";
}) {
  const admin = await getAdmin();
  const patch: Record<string, unknown> = {};
  if (input.name !== undefined) patch["name"] = input.name;
  if (input.allowedOrigins !== undefined) patch["allowed_origins"] = input.allowedOrigins;
  if (input.status !== undefined) {
    patch["status"] = input.status;
    patch["revoked_at"] = input.status === "revoked" ? new Date().toISOString() : null;
  }
  const { error } = await admin
    .from("store_api_keys")
    .update(patch as never)
    .eq("organization_id", input.organizationId)
    .eq("id", input.keyId);
  if (error) throw new Error(error.message);
  return { ok: true };
}

export type StoreRequestLog = {
  id: string;
  requestId: string;
  method: string;
  route: string;
  statusCode: number;
  durationMs: number;
  errorCode: string | null;
  userAgentSummary: string | null;
  createdAt: string;
  keyId: string | null;
};

/** Privacy-safe log view: ip_hash is never returned to the UI. */
export async function listRequestLogs(input: {
  organizationId: string;
  shopId: string;
  keyId?: string | null;
  onlyErrors?: boolean;
  limit?: number;
}): Promise<StoreRequestLog[]> {
  const admin = await getAdmin();
  let query = admin
    .from("store_api_request_logs")
    .select("id, request_id, key_id, method, route, status_code, duration_ms, error_code, user_agent_summary, created_at")
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId)
    .order("created_at", { ascending: false })
    .limit(Math.min(input.limit ?? 100, 200));
  if (input.keyId) query = query.eq("key_id", input.keyId);
  if (input.onlyErrors) query = query.gte("status_code", 400);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return ((data ?? []) as Record<string, unknown>[]).map((r) => ({
    id: r["id"] as string,
    requestId: r["request_id"] as string,
    keyId: (r["key_id"] as string | null) ?? null,
    method: r["method"] as string,
    route: r["route"] as string,
    statusCode: Number(r["status_code"] ?? 0),
    durationMs: Number(r["duration_ms"] ?? 0),
    errorCode: (r["error_code"] as string | null) ?? null,
    userAgentSummary: (r["user_agent_summary"] as string | null) ?? null,
    createdAt: r["created_at"] as string,
  }));
}
