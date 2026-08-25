/** Server-only helpers for the Commerce OS foundation. */

export type AuditInput = {
  organizationId: string | null;
  actorId: string | null;
  actorEmail?: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  metadata?: Record<string, unknown>;
};

export async function getAdmin() {
  const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
  return supabaseAdmin;
}

/** Append-only audit entry. Never updated or deleted. */
export async function writeAudit(input: AuditInput) {
  const admin = await getAdmin();
  await admin.from("audit_log").insert({
    organization_id: input.organizationId,
    actor_id: input.actorId,
    actor_email: input.actorEmail ?? null,
    action: input.action,
    entity_type: input.entityType,
    entity_id: input.entityId ?? null,
    metadata: (input.metadata ?? {}) as never,
  });
}

/** Outbox entry. Prepared in phase 0, processed by a worker later. */
export async function emitEvent(
  organizationId: string | null,
  eventType: string,
  payload: Record<string, unknown>,
) {
  const admin = await getAdmin();
  await admin.from("outbox_events").insert({
    organization_id: organizationId,
    event_type: eventType,
    payload: payload as never,
  });
}

/** Throws when the current user lacks the permission in that organization. */
export async function assertPermission(
  supabase: unknown,
  userId: string,
  organizationId: string,
  permission: string,
) {
  const client = supabase as {
    rpc: (
      fn: string,
      args: Record<string, unknown>,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>;
  };
  const { data, error } = await client.rpc("has_permission", {
    _user_id: userId,
    _org_id: organizationId,
    _permission: permission,
  });
  if (error) throw new Error(error.message);
  if (!data) throw new Error("Keine Berechtigung für diese Aktion.");
}

export function slugify(value: string) {
  return (
    value
      .toLowerCase()
      .replace(/ä/g, "ae")
      .replace(/ö/g, "oe")
      .replace(/ü/g, "ue")
      .replace(/ß/g, "ss")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 40) || "shop"
  );
}

export function generateToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashToken(token: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}
