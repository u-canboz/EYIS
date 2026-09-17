import { safeSearchTerm } from "../search";
import { getAdmin, generateToken, hashToken, writeAudit } from "../core.server";
import { assertCommunicationShop, resolveMailContent, snapshotMailAssets } from "./assets.server";
import { loadBranding, isSuppressed, dispatchCommunication } from "./communication.server";
import { buildContext } from "./context.server";
import { renderEmail } from "./renderer";
import { validateMailBlocks } from "./mail-design";
import { resolveSenderIdentity, resolveProvider } from "./registry.server";
import type { Block } from "./communication.types";
import type { NewsletterScope, CampaignDraft } from "./newsletter.types";

type Row = Record<string, unknown>;
const emailValid = (email: string) =>
  /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 254;
function baseUrl() {
  const value = process.env["APP_BASE_URL"] || process.env["COMMERCE_OS_URL"];
  if (!value || !/^https?:\/\//.test(value)) throw new Error("Die öffentliche App-Adresse fehlt.");
  return value.replace(/\/$/, "");
}

export async function newsletterOverview(
  scope: NewsletterScope & {
    search?: string | undefined;
    status?: string | undefined;
    page?: number | undefined;
  },
) {
  await assertCommunicationShop(scope);
  const admin = await getAdmin();
  const page = Math.max(1, Math.floor(scope.page ?? 1));
  let subscriberQuery = admin
    .from("newsletter_subscribers")
    .select("id,email,first_name,status,source,confirmed_at,unsubscribed_at,created_at", {
      count: "exact",
    })
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId);
  const search = safeSearchTerm(scope.search);
  if (search)
    subscriberQuery = subscriberQuery.or(`email.ilike.%${search}%,first_name.ilike.%${search}%`);
  if (scope.status && scope.status !== "all")
    subscriberQuery = subscriberQuery.eq("status", scope.status);
  const [subscribers, campaigns, campaignStats, subscribedCount] = await Promise.all([
    subscriberQuery.order("created_at", { ascending: false }).range((page - 1) * 50, page * 50 - 1),
    admin
      .from("newsletter_campaigns")
      .select("*")
      .eq("organization_id", scope.organizationId)
      .eq("shop_id", scope.shopId)
      .order("updated_at", { ascending: false }),
    admin.rpc("newsletter_campaign_stats", { p_org: scope.organizationId, p_shop: scope.shopId }),
    admin
      .from("newsletter_subscribers")
      .select("id", { count: "exact", head: true })
      .eq("organization_id", scope.organizationId)
      .eq("shop_id", scope.shopId)
      .eq("status", "subscribed"),
  ]);
  for (const result of [subscribers, campaigns, campaignStats, subscribedCount])
    if (result.error) throw new Error(result.error.message);
  return {
    subscriberCount: subscribers.count ?? 0,
    subscribedCount: subscribedCount.count ?? 0,
    subscriberPage: page,
    subscribers: subscribers.data ?? [],
    campaigns: campaigns.data ?? [],
    campaignStats: campaignStats.data ?? [],
  };
}
export async function saveCampaign(scope: NewsletterScope, draft: CampaignDraft, actorId: string) {
  await assertCommunicationShop(scope);
  validateMailBlocks(draft.blocks);
  if (!draft.name.trim() || draft.name.length > 160)
    throw new Error("Bitte einen Kampagnennamen angeben.");
  if (draft.subject.length > 240 || /[\r\n]/.test(draft.subject))
    throw new Error("Der Betreff ist ungültig.");
  if (
    !["broadcast", "welcome"].includes(draft.kind) ||
    !Number.isInteger(draft.delayMinutes) ||
    draft.delayMinutes < 0 ||
    draft.delayMinutes > 43200
  )
    throw new Error("Ungültige Automations-Einstellungen.");
  if (draft.scheduledAt && !Number.isFinite(Date.parse(draft.scheduledAt)))
    throw new Error("Ungültiger Versandzeitpunkt.");
  const admin = await getAdmin();
  const payload = {
    organization_id: scope.organizationId,
    shop_id: scope.shopId,
    name: draft.name.trim(),
    subject: draft.subject,
    preheader: draft.preheader,
    blocks: draft.blocks as never,
    kind: draft.kind,
    delay_minutes: draft.delayMinutes,
    scheduled_at: draft.scheduledAt,
  };
  const query = draft.id
    ? admin
        .from("newsletter_campaigns")
        .update(payload)
        .eq("id", draft.id)
        .eq("organization_id", scope.organizationId)
        .eq("shop_id", scope.shopId)
        .eq("status", "draft")
        .is("activated_at", null)
    : admin.from("newsletter_campaigns").insert({ ...payload, created_by: actorId });
  const { data, error } = await query.select("id").single();
  if (error || !data)
    throw new Error(
      "Speichern fehlgeschlagen. Bereits aktivierte Kampagnen bitte als neue Kampagne kopieren.",
    );
  await writeAudit({
    organizationId: scope.organizationId,
    actorId,
    action: "newsletter.campaign_saved",
    entityType: "newsletter_campaign",
    entityId: data.id,
  });
  return data;
}
export async function setCampaignState(
  scope: NewsletterScope,
  id: string,
  action: "activate" | "pause",
  actorId: string,
) {
  const admin = await getAdmin();
  const { data: c, error } = await admin
    .from("newsletter_campaigns")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .eq("id", id)
    .single();
  if (error || !c) throw new Error("Kampagne nicht gefunden.");
  if (c.status === "completed" && action === "activate")
    throw new Error("Eine abgeschlossene Kampagne kann nicht erneut versendet werden.");
  if (action === "activate") {
    if (!c.subject.trim() || !(c.blocks as unknown as Block[]).length)
      throw new Error("Betreff und E-Mail-Inhalt fehlen.");
    validateMailBlocks(c.blocks as unknown as Block[], true);
    const branding = await loadBranding(scope.organizationId, scope.shopId);
    if (!branding.footerText.trim())
      throw new Error(
        "Bitte zuerst die Absender- und Unternehmensangaben im Branding Studio ergänzen.",
      );
    const attachments = await snapshotMailAssets(scope, c.blocks as unknown as Block[]);
    const { provider } = await resolveProvider(scope.organizationId, scope.shopId);
    if (attachments.length && !provider.capabilities.supportsAttachments)
      throw new Error(
        "Dieser E-Mail-Anbieter unterstützt keine Anhänge. Bitte im Branding Studio und Editor entfernen oder einen geeigneten Anbieter konfigurieren.",
      );
    const sender = await resolveSenderIdentity(scope.organizationId, scope.shopId);
    if (!provider.isSandbox && !sender?.verified)
      throw new Error(
        "Für den Versand muss zuerst eine verifizierte Absenderadresse eingerichtet werden.",
      );
  }
  const now = new Date().toISOString();
  const { error: updateError } = await admin
    .from("newsletter_campaigns")
    .update({
      status: action === "pause" ? "paused" : c.kind === "welcome" ? "active" : "scheduled",
      activated_at: c.activated_at ?? now,
      scheduled_at: c.scheduled_at ?? now,
    })
    .eq("id", id)
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId);
  if (updateError) throw new Error(updateError.message);
  const pending = await admin
    .from("communications")
    .update({ next_attempt_at: action === "pause" ? null : now })
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .eq("status", "queued")
    .contains("metadata", { newsletter_campaign_id: id });
  if (pending.error) throw new Error(pending.error.message);
  await writeAudit({
    organizationId: scope.organizationId,
    actorId,
    action: `newsletter.campaign_${action}`,
    entityType: "newsletter_campaign",
    entityId: id,
  });
  return { ok: true };
}

async function queueNewsletter(
  scope: NewsletterScope,
  input: {
    email: string;
    firstName: string;
    subject: string;
    preheader?: string;
    blocks: Block[];
    metadata: Row;
    unsubscribeUrl?: string;
    confirmationUrl?: string;
    test?: boolean;
  },
) {
  const admin = await getAdmin();
  const built = await buildContext({ ...scope, recipientEmail: input.email });
  built.context.customer = {
    first_name: input.firstName,
    last_name: "",
    full_name: input.firstName,
    email: input.email,
  };
  if (input.unsubscribeUrl) built.context.links.unsubscribe = input.unsubscribeUrl;
  if (input.confirmationUrl) built.context.links.confirmation = input.confirmationUrl;
  const branding = await loadBranding(scope.organizationId, scope.shopId);
  built.context.shop.website_url = branding.websiteUrl || built.context.shop.website_url;
  built.context.shop.support_email = branding.supportEmail || built.context.shop.support_email;
  await resolveMailContent(scope, input.blocks, built.context);
  const attachments = await snapshotMailAssets(scope, input.blocks);
  if (attachments.some((a) => a.contentId)) branding.logoUrl = "cid:eyis-shop-logo";
  const rendered = renderEmail({
    subject: input.subject,
    preheader: input.preheader ?? "",
    blocks: input.blocks,
    context: built.context,
    branding,
  });
  const suppression = await isSuppressed(scope.organizationId, scope.shopId, input.email);
  const sender = await resolveSenderIdentity(scope.organizationId, scope.shopId);
  const now = new Date().toISOString();
  const { data, error } = await admin
    .from("communications")
    .insert({
      organization_id: scope.organizationId,
      shop_id: scope.shopId,
      channel: "email",
      status: suppression ? "suppressed" : "queued",
      template_key: input.confirmationUrl ? "newsletter.confirmation" : "newsletter.campaign",
      locale: "de-DE",
      subject_snapshot: rendered.subject,
      html_snapshot: rendered.html,
      text_snapshot: rendered.text,
      recipient_address: input.email,
      recipient_type: input.test ? "test" : "guest",
      sender_identity_id: sender?.id ?? null,
      sender_name: sender?.senderName ?? built.context.shop.name,
      sender_address: sender?.senderAddress ?? null,
      is_test_send: input.test ?? false,
      queued_at: now,
      scheduled_at: now,
      next_attempt_at: suppression ? null : now,
      metadata: {
        ...input.metadata,
        attachments,
        unsubscribe_url: input.unsubscribeUrl ?? null,
      } as never,
    } as never)
    .select("id")
    .single();
  if (error?.code === "23505" && input.metadata["newsletter_campaign_id"]) {
    const existing = await admin
      .from("communications")
      .select("id")
      .eq("organization_id", scope.organizationId)
      .eq("shop_id", scope.shopId)
      .contains("metadata", {
        newsletter_campaign_id: input.metadata["newsletter_campaign_id"],
        newsletter_subscriber_id: input.metadata["newsletter_subscriber_id"],
      } as never)
      .single();
    if (existing.data) return existing.data.id;
  }
  if (error || !data) throw new Error(error?.message ?? "E-Mail konnte nicht erstellt werden.");
  return data.id;
}

/** Store API: no address or membership status is disclosed to callers. */
export async function subscribeNewsletter(
  scope: NewsletterScope,
  input: { email: string; firstName?: string; consentText: string },
) {
  await assertCommunicationShop(scope);
  const email = input.email.trim().toLowerCase();
  if (!emailValid(email)) throw new Error("Bitte eine gültige E-Mail-Adresse angeben.");
  if (input.consentText.trim().length < 10 || input.consentText.length > 2000)
    throw new Error("Der Einwilligungstext fehlt.");
  const admin = await getAdmin();
  const token = generateToken();
  const firstName = (input.firstName ?? "").trim().slice(0, 100);
  const tokenHash = await hashToken(token);
  const { data: subscriberId, error } = await admin.rpc(
    "newsletter_request_subscription" as never,
    {
      p_org: scope.organizationId,
      p_shop: scope.shopId,
      p_email: email,
      p_first_name: firstName,
      p_consent: input.consentText,
      p_token_hash: tokenHash,
    } as never,
  );
  if (error) throw new Error("Anmeldung konnte nicht gespeichert werden.");
  if (!subscriberId) return { accepted: true };
  try {
    await queueNewsletter(scope, {
      email,
      firstName,
      subject: "Bitte bestätige deine Newsletter-Anmeldung",
      blocks: [
        { type: "heading", text: "Nur noch ein Schritt." },
        {
          type: "text",
          text: "Bitte bestätige, dass du unseren Newsletter erhalten möchtest. Falls du dich nicht angemeldet hast, kannst du diese Nachricht ignorieren.",
        },
        { type: "button", label: "Anmeldung bestätigen", url: "{{links.confirmation}}" },
        { type: "text", text: "Der Bestätigungslink ist 48 Stunden gültig." },
      ],
      confirmationUrl: `${baseUrl()}/api/public/store/newsletter/confirm?token=${token}`,
      metadata: { newsletter_confirmation: true },
    });
  } catch (error) {
    // Permit a safe retry if rendering or provider configuration prevented queueing.
    // A concurrent successful request with a different token must stay untouched.
    await admin
      .from("newsletter_subscribers")
      .update({
        confirmation_requested_at: null,
        confirmation_token_hash: null,
        confirmation_expires_at: null,
      })
      .eq("organization_id", scope.organizationId)
      .eq("shop_id", scope.shopId)
      .eq("id", String(subscriberId))
      .eq("status", "pending")
      .eq("confirmation_token_hash", tokenHash);
    throw error;
  }
  return { accepted: true };
}
export async function confirmNewsletter(token: string, scope?: NewsletterScope) {
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error("Ungültiger Bestätigungslink.");
  const admin = await getAdmin();
  const hash = await hashToken(token);
  const now = new Date().toISOString();
  let query = admin
    .from("newsletter_subscribers")
    .update({
      status: "subscribed",
      confirmed_at: now,
      unsubscribed_at: null,
      confirmation_token_hash: null,
      confirmation_expires_at: null,
    })
    .eq("confirmation_token_hash", hash)
    .eq("status", "pending")
    .gt("confirmation_expires_at", now)
    .select("id");
  if (scope) query = query.eq("organization_id", scope.organizationId).eq("shop_id", scope.shopId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error("Dieser Link ist abgelaufen oder wurde bereits verwendet.");
  return { ok: true };
}
export async function unsubscribeNewsletter(token: string, scope?: NewsletterScope) {
  if (!/^[a-f0-9-]{36}$/.test(token)) throw new Error("Ungültiger Abmeldelink.");
  const admin = await getAdmin();
  let query = admin
    .from("newsletter_subscribers")
    .update({
      status: "unsubscribed",
      unsubscribed_at: new Date().toISOString(),
      confirmation_token_hash: null,
    })
    .eq("unsubscribe_token", token)
    .select("id,organization_id,shop_id");
  if (scope) query = query.eq("organization_id", scope.organizationId).eq("shop_id", scope.shopId);
  const { data, error } = await query.maybeSingle();
  if (error || !data) throw new Error("Abmeldelink nicht gefunden.");
  await admin
    .from("communications")
    .update({
      status: "suppressed",
      next_attempt_at: null,
      last_error: "Newsletter abgemeldet",
    } as never)
    .eq("organization_id", data.organization_id)
    .eq("shop_id", data.shop_id)
    .eq("status", "queued")
    .contains("metadata", { newsletter_subscriber_id: data.id });
  return { ok: true };
}
export async function unsubscribeByAdmin(scope: NewsletterScope, id: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("newsletter_subscribers")
    .select("unsubscribe_token")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .eq("id", id)
    .single();
  if (!data) throw new Error("Abonnent nicht gefunden.");
  return unsubscribeNewsletter(data.unsubscribe_token);
}

export async function testCampaign(scope: NewsletterScope, draft: CampaignDraft, email: string) {
  if (!emailValid(email)) throw new Error("Bitte gültige Testadresse angeben.");
  validateMailBlocks(draft.blocks, true);
  const id = await queueNewsletter(scope, {
    email,
    firstName: "Vorschau",
    subject: `[Test] ${draft.subject}`,
    preheader: draft.preheader,
    blocks: draft.blocks,
    metadata: { newsletter_test: true },
    unsubscribeUrl: `${baseUrl()}/api/public/store/newsletter/unsubscribe`,
    test: true,
  });
  const result = await dispatchCommunication(id);
  if ("sent" in result && !result.sent) throw new Error(result.message);
  return { id, ...result };
}

/** Bounded batches, atomic DB deduplication; invoked by the existing mail scheduler. */
export async function processNewsletters(scope?: NewsletterScope, limit = 25) {
  const admin = await getAdmin();
  let query = admin
    .from("newsletter_campaigns")
    .select("*")
    .in("status", ["scheduled", "active"])
    .lte("scheduled_at", new Date().toISOString())
    .order("last_processed_at", { ascending: true, nullsFirst: true });
  if (scope) query = query.eq("organization_id", scope.organizationId).eq("shop_id", scope.shopId);
  const { data: campaigns, error } = await query.limit(50);
  if (error) throw new Error(error.message);
  let queued = 0;
  const errors: string[] = [];
  for (const c of campaigns ?? []) {
    await admin
      .from("newsletter_campaigns")
      .update({ last_processed_at: new Date().toISOString() } as never)
      .eq("organization_id", c.organization_id)
      .eq("shop_id", c.shop_id)
      .eq("id", c.id);
    const currentScope = { organizationId: c.organization_id, shopId: c.shop_id };
    const cutoff = new Date(Date.now() - c.delay_minutes * 60_000).toISOString();
    let subscribers = admin
      .from("newsletter_subscribers")
      .select("*")
      .eq("organization_id", c.organization_id)
      .eq("shop_id", c.shop_id)
      .eq("status", "subscribed")
      .lte("confirmed_at", c.kind === "welcome" ? cutoff : c.scheduled_at!);
    if (c.kind === "welcome") subscribers = subscribers.gte("confirmed_at", c.activated_at!);
    // Keyset pagination prevents already-sent subscribers from starving later pages.
    let cursor = "";
    let exhausted = false;
    while (queued < limit && !exhausted) {
      let pageQuery = subscribers.order("id").limit(100);
      if (cursor) pageQuery = pageQuery.gt("id", cursor);
      const { data: page, error: pageError } = await pageQuery;
      if (pageError) throw new Error(pageError.message);
      if (!page?.length) {
        exhausted = true;
        break;
      }
      for (const subscriber of page) {
        cursor = subscriber.id;
        const { data: exists } = await admin
          .from("communications")
          .select("id")
          .eq("organization_id", c.organization_id)
          .eq("shop_id", c.shop_id)
          .contains("metadata", {
            newsletter_campaign_id: c.id,
            newsletter_subscriber_id: subscriber.id,
          })
          .maybeSingle();
        if (exists) continue;
        try {
          const id = await queueNewsletter(currentScope, {
            email: subscriber.email,
            firstName: subscriber.first_name,
            subject: c.subject,
            preheader: c.preheader,
            blocks: c.blocks as unknown as Block[],
            unsubscribeUrl: `${baseUrl()}/api/public/store/newsletter/unsubscribe?token=${subscriber.unsubscribe_token}`,
            metadata: { newsletter_campaign_id: c.id, newsletter_subscriber_id: subscriber.id },
          });
          const { error: deliveryError } = await admin.from("newsletter_deliveries").upsert(
            {
              organization_id: c.organization_id,
              shop_id: c.shop_id,
              campaign_id: c.id,
              subscriber_id: subscriber.id,
              communication_id: id,
            },
            { onConflict: "campaign_id,subscriber_id" },
          );
          if (deliveryError) throw new Error(deliveryError.message);
          queued++;
        } catch (e) {
          errors.push(`${c.name}: ${e instanceof Error ? e.message : "Fehler"}`);
          break;
        }
        if (queued >= limit) break;
      }
      if (errors.length || page.length < 100) exhausted = true;
    }
    if (c.kind === "broadcast" && exhausted && !errors.length && queued < limit)
      await admin
        .from("newsletter_campaigns")
        .update({ status: "completed" })
        .eq("id", c.id)
        .eq("organization_id", c.organization_id)
        .eq("shop_id", c.shop_id)
        .eq("status", "scheduled");
    if (queued >= limit || errors.length) break;
  }
  return { queued, errors };
}
