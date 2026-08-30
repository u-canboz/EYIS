/**
 * Installations-Serverfunktionen (Phase 21). Dünne Hülle — Logik in
 * `installation.server.ts`.
 *
 * Zugriffsmodell:
 *  - `getInstallationStatus`: jeder angemeldete Nutzer (redaktierter Status,
 *    keine Claim-Felder). Wird vom /app-Gate und vom Setup-Prozess gebraucht.
 *  - `claimInstallationOwner`: angemeldeter Nutzer + gültige Setup-Session
 *    (httpOnly-Cookie aus dem Claim-Session-Tausch).
 *  - `saveSetupStep` / `setStorefrontOriginFn`: nur Owner (has_org_role).
 */
import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { getCookie } from "@tanstack/react-start/server";

const SETUP_CLAIM_COOKIE = "commerce_setup_claim";

export const getInstallationStatus = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { getInstallation, redactInstallation } = await import("./installation.server");
    const row = await getInstallation();
    if (!row) return { installed: false as const };
    return { installed: true as const, ...redactInstallation(row) };
  });

export const claimInstallationOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organizationName: z.string().trim().min(2).max(80),
        shopName: z.string().trim().min(2).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const claimToken = getCookie(SETUP_CLAIM_COOKIE);
    if (!claimToken) {
      const { InstallationError } = await import("./installation.server");
      throw new InstallationError(
        "SETUP_SESSION_MISSING",
        "Keine gültige Setup-Session. Bitte den Claim-Code erneut eingeben.",
      );
    }
    const { claimOwner } = await import("./installation.server");
    return claimOwner({
      userId: context.userId,
      claimToken,
      organizationName: data.organizationName,
      shopName: data.shopName,
    });
  });

/**
 * Zustand des Owner-Setups für den angemeldeten Nutzer (Dedicated V3).
 * Liefert nie die vollständige Pending-Owner-Adresse und nie Claim-Felder.
 */
export const getOwnerSetupState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { getInstallation, claimState, maskEmail, normalizeOwnerEmail } = await import(
      "./installation.server"
    );
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const row = await getInstallation();
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    const email = userData?.user?.email ?? null;
    const emailVerified = userData?.user?.email_confirmed_at != null;
    const state = claimState(row);
    const matchesPendingOwner =
      !!row?.pending_owner_email &&
      !!email &&
      normalizeOwnerEmail(email) === normalizeOwnerEmail(row.pending_owner_email);
    return {
      claimState: state,
      email,
      emailVerified,
      matchesPendingOwner,
      pendingOwnerEmailMasked: maskEmail(row?.pending_owner_email ?? null),
      canAutoClaim: state === "AWAITING_OWNER_REGISTRATION" && matchesPendingOwner && emailVerified,
    };
  });

/**
 * Auto-Claim des vorbereiteten Owners. Identität und E-Mail-Bestätigung werden
 * ausschließlich serverseitig aus der Auth-Datenbank gelesen.
 */
export const autoClaimInstallationOwner = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organizationName: z.string().trim().min(2).max(80),
        shopName: z.string().trim().min(2).max(80),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { autoClaimOwner } = await import("./installation.server");
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: userData } = await supabaseAdmin.auth.admin.getUserById(context.userId);
    return autoClaimOwner({
      userId: context.userId,
      email: userData?.user?.email ?? null,
      emailVerified: userData?.user?.email_confirmed_at != null,
      organizationName: data.organizationName,
      shopName: data.shopName,
    });
  });



export const saveSetupStep = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organizationId: z.string().uuid(),
        step: z.string().min(1).max(40),
        done: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "settings.manage");
    const { saveSetupProgress } = await import("./installation.server");
    return saveSetupProgress(data.step, data.done);
  });

export const setStorefrontOriginFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        organizationId: z.string().uuid(),
        origin: z.string().trim().url().max(200),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "settings.manage");
    const { setStorefrontOrigin } = await import("./installation.server");
    await setStorefrontOrigin(data.origin);
    return { ok: true as const };
  });

/**
 * Dedicated-Adoption: bestehende Organisation + Hauptshop als Installation
 * registrieren und den Storefront-Key automatisch erzeugen. Nur Owner der
 * angegebenen Organisation.
 */
export const adoptInstallationFn = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) => z.object({ organizationId: z.string().uuid() }).parse(data))
  .handler(async ({ data, context }) => {
    const { assertPermission } = await import("../core.server");
    await assertPermission(context.supabase, context.userId, data.organizationId, "settings.manage");
    const { adoptInstallation } = await import("./installation.server");
    return adoptInstallation(context.userId, data.organizationId);
  });
