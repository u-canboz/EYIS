import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

export type Role =
  | "owner"
  | "administrator"
  | "operations"
  | "catalog_manager"
  | "fulfillment"
  | "customer_support"
  | "finance"
  | "marketing"
  | "developer"
  | "read_only";

export type WorkspaceOrg = {
  id: string;
  name: string;
  slug: string;
  role: Role;
  permissions: string[];
};

export type WorkspaceShop = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  currency: string;
  locale: string;
  status: string;
};

/**
 * Loads the signed-in user's organizations, role, permissions and shops.
 * Creates a first organization + shop when the user has no membership yet.
 */
export const getWorkspace = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { slugify, writeAudit, emitEvent, getAdmin } = await import("./core.server");

    const email = (context.claims as { email?: string } | undefined)?.email ?? null;

    const { data: rawMemberships, error } = await supabase
      .from("memberships")
      .select("organization_id, role, organizations(id, name, slug)")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);

    type MembershipRow = {
      organization_id: string;
      role: string;
      organizations: { id: string; name: string; slug: string } | null;
    };
    let memberships = (rawMemberships ?? []) as unknown as MembershipRow[];

    if (memberships.length === 0) {
      // Dedicated Mode: ohne abgeschlossenen Owner-Claim wird keine
      // Organisation automatisch angelegt — /app zeigt ausschließlich den
      // Claim-/Setup-Prozess (Phase 21, Sicherheitsinvariante).
      const { resolveDeploymentMode } = await import("./environment");
      if (resolveDeploymentMode() === "dedicated") {
        const { getInstallation } = await import("./system/installation.server");
        const installation = await getInstallation();
        if (!installation || installation.owner_claimed_at == null) {
          return {
            userId,
            email,
            organizations: [],
            shops: [],
            requiresOwnerClaim: true,
          };
        }
      }
      const admin = await getAdmin();
      const baseName = email ? `${email.split("@")[0]} Handel` : "Meine Organisation";
      const slug = `${slugify(baseName)}-${Math.random().toString(36).slice(2, 7)}`;

      const { data: org, error: orgError } = await admin
        .from("organizations")
        .insert({ name: baseName, slug })
        .select("id, name, slug")
        .single();
      if (orgError || !org)
        throw new Error(orgError?.message ?? "Organisation konnte nicht angelegt werden.");

      const { error: memberError } = await admin
        .from("memberships")
        .insert({ organization_id: org.id, user_id: userId, role: "owner" });
      if (memberError) throw new Error(memberError.message);

      const { error: shopError } = await admin.from("shops").insert({
        organization_id: org.id,
        name: "Hauptshop",
        slug: "hauptshop",
      });
      if (shopError) throw new Error(shopError.message);

      await writeAudit({
        organizationId: org.id,
        actorId: userId,
        actorEmail: email,
        action: "organization.created",
        entityType: "organization",
        entityId: org.id,
        metadata: { name: org.name },
      });
      await emitEvent(org.id, "organization.created", { organization_id: org.id });

      memberships = [{ organization_id: org.id, role: "owner", organizations: org }];
    }

    const orgIds = memberships.map((m) => m.organization_id);

    const [{ data: perms }, { data: shops }] = await Promise.all([
      supabase.from("role_permissions").select("role, permission"),
      supabase
        .from("shops")
        .select("id, organization_id, name, slug, currency, locale, status")
        .in("organization_id", orgIds)
        .order("created_at", { ascending: true }),
    ]);

    const organizations: WorkspaceOrg[] = memberships.map((m) => {
      const org = m.organizations;
      return {
        id: m.organization_id,
        name: org?.name ?? "Organisation",
        slug: org?.slug ?? "",
        role: m.role as Role,
        permissions: (perms ?? []).filter((p) => p.role === m.role).map((p) => p.permission),
      };
    });

    return {
      userId,
      email,
      organizations,
      shops: (shops ?? []) as WorkspaceShop[],
    };
  });

export const updateShop = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: {
      shopId: string;
      organizationId: string;
      name: string;
      slug: string;
      currency: string;
      locale: string;
      status: "active" | "inactive" | "archived";
    }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit, emitEvent } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "settings.manage");

    const { error } = await supabase
      .from("shops")
      .update({
        name: data.name.trim(),
        slug: data.slug.trim(),
        currency: data.currency.trim().toUpperCase(),
        locale: data.locale.trim(),
        status: data.status,
      })
      .eq("id", data.shopId)
      .eq("organization_id", data.organizationId);
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      actorEmail: (context.claims as { email?: string } | undefined)?.email ?? null,
      action: "shop.updated",
      entityType: "shop",
      entityId: data.shopId,
      metadata: { name: data.name },
    });
    await emitEvent(data.organizationId, "shop.updated", { shop_id: data.shopId });
    return { ok: true };
  });

export const listDomains = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { shopId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("shop_domains")
      .select("id, domain, is_primary, created_at")
      .eq("shop_id", data.shopId)
      .order("created_at", { ascending: true });
    if (error) throw new Error(error.message);
    return rows ?? [];
  });

export const addDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator(
    (data: { shopId: string; organizationId: string; domain: string; isPrimary: boolean }) => data,
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "settings.manage");

    const domain = data.domain.trim().toLowerCase();
    if (!/^[a-z0-9.-]+\.[a-z]{2,}$/.test(domain)) throw new Error("Ungültige Domain.");

    const { error } = await supabase.from("shop_domains").insert({
      shop_id: data.shopId,
      organization_id: data.organizationId,
      domain,
      is_primary: data.isPrimary,
    });
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "shop_domain.added",
      entityType: "shop_domain",
      entityId: domain,
    });
    return { ok: true };
  });

export const removeDomain = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { domainId: string; organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { assertPermission, writeAudit } = await import("./core.server");
    await assertPermission(supabase, userId, data.organizationId, "settings.manage");

    const { error } = await supabase.from("shop_domains").delete().eq("id", data.domainId);
    if (error) throw new Error(error.message);

    await writeAudit({
      organizationId: data.organizationId,
      actorId: userId,
      action: "shop_domain.removed",
      entityType: "shop_domain",
      entityId: data.domainId,
    });
    return { ok: true };
  });

export const listAuditLog = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { organizationId: string }) => data)
  .handler(async ({ data, context }) => {
    const { data: rows, error } = await context.supabase
      .from("audit_log")
      .select("id, action, entity_type, entity_id, actor_email, actor_id, metadata, created_at")
      .eq("organization_id", data.organizationId)
      .order("created_at", { ascending: false })
      .limit(200);
    if (error) throw new Error(error.message);
    return rows ?? [];
  });
