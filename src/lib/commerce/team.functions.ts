import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import type { Role } from "./workspace.functions";

const INVITE_TTL_DAYS = 7;

export type TeamMember = {
  id: string;
  user_id: string;
  role: Role;
  email: string | null;
  full_name: string | null;
  created_at: string;
};

export type InvitationRow = {
  id: string;
  email: string;
  role: Role;
  status: "pending" | "accepted" | "revoked" | "expired";
  expires_at: string;
  created_at: string;
};

export const listTeam = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: members, error } = await supabase
      .from("memberships")
      .select("id, user_id, role, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);

    const ids = (members ?? []).map((m) => m.user_id);
    const { data: profiles } = ids.length
      ? await supabase.from("profiles").select("id, email, full_name").in("id", ids)
      : { data: [] as { id: string; email: string | null; full_name: string | null }[] };

    const { data: invitations } = await supabase
      .from("invitations")
      .select("id, email, role, status, expires_at, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false });

    const team: TeamMember[] = (members ?? []).map((m) => {
      const profile = (profiles ?? []).find((p) => p.id === m.user_id);
      return {
        id: m.id,
        user_id: m.user_id,
        role: m.role as Role,
        email: profile?.email ?? null,
        full_name: profile?.full_name ?? null,
        created_at: m.created_at,
      };
    });

    const now = Date.now();
    const invites: InvitationRow[] = (invitations ?? []).map((i) => ({
      id: i.id,
      email: i.email,
      role: i.role as Role,
      status:
        i.status === "pending" && new Date(i.expires_at).getTime() < now
          ? "expired"
          : (i.status as InvitationRow["status"]),
      expires_at: i.expires_at,
      created_at: i.created_at,
    }));

    return { members: team, invitations: invites };
  });

/** Creates a token invitation. Returns the raw token exactly once. */
export const createInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; email: string; role: Role }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent, generateToken, hashToken, getAdmin } =
      await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "settings.manage");

    const email = data.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Ungültige E-Mail-Adresse.");
    if (data.role === "owner") throw new Error("Die Inhaber-Rolle kann nicht per Einladung vergeben werden.");

    const admin = await getAdmin();

    // Re-inviting revokes the previous open invitation.
    await admin
      .from("invitations")
      .update({ status: "revoked" })
      .eq("organization_id", data.organizationId)
      .eq("status", "pending")
      .ilike("email", email);

    const token = generateToken();
    const token_hash = await hashToken(token);
    const expires_at = new Date(Date.now() + INVITE_TTL_DAYS * 86400000).toISOString();

    const { data: invite, error } = await admin
      .from("invitations")
      .insert({
        organization_id: data.organizationId,
        email,
        role: data.role,
        token_hash,
        expires_at,
        invited_by: userId,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "invitation.created",
      entityType: "invitation",
      entityId: invite?.id ?? null,
      metadata: { email, role: data.role },
    });
    await emitEvent(data.organizationId, "invitation.created", { email, role: data.role });

    return { token, expiresAt: expires_at };
  });

export const revokeInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; invitationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, getAdmin } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "settings.manage");

    const admin = await getAdmin();
    const { error } = await admin
      .from("invitations")
      .update({ status: "revoked" })
      .eq("id", data.invitationId)
      .eq("organization_id", data.organizationId)
      .eq("status", "pending");
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "invitation.revoked",
      entityType: "invitation",
      entityId: data.invitationId,
    });
    return { ok: true };
  });

export const updateMemberRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; membershipId: string; role: Role }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "settings.manage");

    const { error } = await supabase
      .from("memberships")
      .update({ role: data.role })
      .eq("id", data.membershipId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "membership.role_changed",
      entityType: "membership",
      entityId: data.membershipId,
      metadata: { role: data.role },
    });
    await emitEvent(data.organizationId, "membership.role_changed", {
      membership_id: data.membershipId,
      role: data.role,
    });
    return { ok: true };
  });

export const removeMember = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string; membershipId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "settings.manage");

    const { error } = await supabase
      .from("memberships")
      .delete()
      .eq("id", data.membershipId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "membership.removed",
      entityType: "membership",
      entityId: data.membershipId,
    });
    return { ok: true };
  });

/** Reads an invitation by token for the signed-in user. */
export const getInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data, context }) => {
    const { hashToken, getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const token_hash = await hashToken(data.token);

    const { data: invite } = await admin
      .from("invitations")
      .select("id, email, role, status, expires_at, organization_id, organizations(name)")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (!invite) return { valid: false as const, reason: "Einladung nicht gefunden." };

    const expired = new Date(invite.expires_at).getTime() < Date.now();
    if (invite.status !== "pending")
      return { valid: false as const, reason: "Diese Einladung ist nicht mehr gültig." };
    if (expired) return { valid: false as const, reason: "Diese Einladung ist abgelaufen." };

    const org = invite.organizations as unknown as { name: string } | null;
    const userEmail = (context.claims as { email?: string } | undefined)?.email ?? null;

    return {
      valid: true as const,
      email: invite.email,
      role: invite.role as Role,
      organizationName: org?.name ?? "Organisation",
      matchesUser: !!userEmail && userEmail.toLowerCase() === invite.email.toLowerCase(),
      userEmail,
    };
  });

/** Accepts an invitation: creates the membership and closes the token. */
export const acceptInvitation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { token: string }) => data)
  .handler(async ({ data, context }) => {
    const { userId } = context;
    const { hashToken, writeAudit, emitEvent, getAdmin } = await import("./core.server");
    const admin = await getAdmin();
    const token_hash = await hashToken(data.token);
    const userEmail = (context.claims as { email?: string } | undefined)?.email ?? null;

    const { data: invite } = await admin
      .from("invitations")
      .select("id, email, role, status, expires_at, organization_id")
      .eq("token_hash", token_hash)
      .maybeSingle();

    if (!invite) throw new Error("Einladung nicht gefunden.");
    if (invite.status !== "pending") throw new Error("Diese Einladung ist nicht mehr gültig.");
    if (new Date(invite.expires_at).getTime() < Date.now()) {
      await admin.from("invitations").update({ status: "expired" }).eq("id", invite.id);
      throw new Error("Diese Einladung ist abgelaufen.");
    }
    if (!userEmail || userEmail.toLowerCase() !== invite.email.toLowerCase()) {
      throw new Error("Diese Einladung gilt für eine andere E-Mail-Adresse.");
    }

    // Single-use: only the update that still sees status = 'pending' wins.
    const { data: claimed } = await admin
      .from("invitations")
      .update({ status: "accepted", accepted_at: new Date().toISOString(), accepted_by: userId })
      .eq("id", invite.id)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (!claimed) throw new Error("Diese Einladung wurde bereits verwendet.");

    const { error: memberError } = await admin.from("memberships").insert({
      organization_id: invite.organization_id,
      user_id: userId,
      role: invite.role,
    });
    if (memberError && !memberError.message.includes("duplicate")) {
      throw new Error(memberError.message);
    }

    await writeAudit({
      organizationId: invite.organization_id,
      actorId: userId,
      actorEmail: userEmail,
      action: "invitation.accepted",
      entityType: "invitation",
      entityId: invite.id,
      metadata: { role: invite.role },
    });
    await emitEvent(invite.organization_id, "membership.created", {
      user_id: userId,
      role: invite.role,
    });

    return { ok: true, organizationId: invite.organization_id };
  });
