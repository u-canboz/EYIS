/** Integration checks against the isolated local development installation only. */
import { randomUUID } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { assertOperationAllowed } from "../src/lib/commerce/environment";
assertOperationAllowed("qa_harness");
for (const key of ["SUPABASE_URL", "APP_BASE_URL"])
  if (!["127.0.0.1", "localhost"].includes(new URL(process.env[key] ?? "").hostname))
    throw new Error("Local endpoints required.");
const { getAdmin } = await import("../src/lib/commerce/core.server");
const admin = await getAdmin();
const { data: install } = await admin
  .from("commerce_installation")
  .select("organization_id,shop_id,storefront_publishable_key")
  .eq("singleton", true)
  .single();
if (!install?.organization_id || !install.shop_id) throw new Error("Local installation missing.");
const scope = { organizationId: install.organization_id, shopId: install.shop_id };
const { data: owner } = await admin
  .from("memberships")
  .select("user_id")
  .eq("organization_id", scope.organizationId)
  .eq("role", "owner")
  .single();
if (!owner) throw new Error("Owner missing.");
const { resolveProvider } = await import("../src/lib/commerce/communications/registry.server");
if (!(await resolveProvider(scope.organizationId, scope.shopId)).provider.isSandbox)
  throw new Error("Sandbox mail provider required.");
const ns = await import("../src/lib/commerce/communications/newsletter.server");
const comm = await import("../src/lib/commerce/communications/communication.server");
const studio = await import("../src/lib/commerce/communications/studio.server");
const { snapshotMailAssets } = await import("../src/lib/commerce/communications/assets.server");
const { buildMimeMessage } =
  await import("../src/lib/commerce/communications/providers/smtp.server");
const { renderDocumentPdf } = await import("../src/lib/commerce/documents/pdf.server");
const { invoiceFixture } = await import("./document-layout-fixtures");
const checks: { name: string; pass: boolean }[] = [];
function check(name: string, pass: boolean) {
  checks.push({ name, pass });
  console.log(`${pass ? "PASS" : "FAIL"} ${name}`);
  if (!pass) throw new Error(name);
}
async function rejects(name: string, fn: () => Promise<unknown>) {
  let rejected = false;
  try {
    await fn();
  } catch {
    rejected = true;
  }
  check(name, rejected);
}
const suffix = randomUUID().slice(0, 8),
  email = `newsletter-${suffix}@example.test`;
const original = await studio.loadBrandingSettings(scope.organizationId, scope.shopId);
try {
  const pdf = await renderDocumentPdf(invoiceFixture());
  const path = `${scope.organizationId}/qa-${suffix}.pdf`;
  const upload = await admin.storage
    .from("media")
    .upload(path, pdf, { contentType: "application/pdf" });
  if (upload.error) throw upload.error;
  const asset = await admin
    .from("media_assets")
    .insert({
      organization_id: scope.organizationId,
      shop_id: scope.shopId,
      filename: `QA-Rechtstext-${suffix}.pdf`,
      storage_path: path,
      mime_type: "application/pdf",
      size_bytes: pdf.length,
      uploaded_by: owner.user_id,
    })
    .select("id")
    .single();
  if (!asset.data) throw asset.error;
  await studio.saveBrandingSettings({
    ...scope,
    actorId: owner.user_id,
    settings: {
      ...original,
      footerText:
        "EYIS Lokaler Testshop\nTeststraße 1 · 10115 Berlin\nAusschließlich synthetische Testdaten",
      legalText: "Synthetischer Rechtstext zur Funktionsprüfung.",
      attachmentMediaIds: [asset.data.id],
    },
  });
  const logoBytes = new Uint8Array(readFileSync("public/demo-assets/logo.png"));
  const logoPath = `${scope.organizationId}/qa-logo-${suffix}.png`;
  const logoUpload = await admin.storage
    .from("media")
    .upload(logoPath, logoBytes, { contentType: "image/png" });
  if (logoUpload.error) throw logoUpload.error;
  const logoAsset = await admin
    .from("media_assets")
    .insert({
      organization_id: scope.organizationId,
      shop_id: scope.shopId,
      filename: "QA Shop-Logo.png",
      storage_path: logoPath,
      mime_type: "image/png",
      size_bytes: logoBytes.length,
      uploaded_by: owner.user_id,
    })
    .select("id")
    .single();
  if (!logoAsset.data) throw logoAsset.error;
  const testBranding = await studio.loadBrandingSettings(scope.organizationId, scope.shopId);
  await studio.saveBrandingSettings({
    ...scope,
    actorId: owner.user_id,
    settings: { ...testBranding, logoMediaId: logoAsset.data.id },
  });
  const preview = await comm.previewTemplate({
    ...scope,
    subject: "Vorschau",
    blocks: [{ type: "button", label: "Shop besuchen", url: "{{shop.website_url}}" }],
    newsletter: true,
  });
  check(
    "Preview inherits branding links and newsletter footer",
    preview.html.includes(`href="${original.websiteUrl}"`) &&
      preview.html.includes("Newsletter abmelden"),
  );
  const attachments = await snapshotMailAssets(scope, []);
  check(
    "PDF attachment snapshot preserves exact PDF bytes",
    attachments.length === 2 && atob(attachments[0]!.content).length === pdf.length,
  );
  check(
    "Logo is embedded as persistent CID attachment",
    attachments.some((a) => a.contentId === "eyis-shop-logo" && a.contentType === "image/png"),
  );
  const mime = buildMimeMessage(
    {
      to: email,
      senderName: "Testshop",
      senderAddress: "test@example.test",
      replyTo: null,
      subject: "Anhang-Test",
      html: "<p>Test</p>",
      text: "Test",
      tags: {},
      idempotencyKey: randomUUID(),
      attachments,
    },
    "test@example.test",
  );
  check(
    "SMTP transports PDF as multipart attachment",
    mime.body.includes("multipart/mixed") &&
      mime.body.includes("application/pdf") &&
      mime.body.includes("Content-Disposition: attachment"),
  );
  const draft = {
    name: `QA Willkommen ${suffix}`,
    subject: "Willkommen {{customer.first_name}}",
    preheader: "Deine Anmeldung",
    blocks: [
      { type: "heading" as const, text: "Willkommen" },
      { type: "text" as const, text: "Hallo {{customer.first_name}}" },
      { type: "legal" as const },
    ],
    kind: "welcome" as const,
    delayMinutes: 0,
    scheduledAt: null,
  };
  const campaign = await ns.saveCampaign(scope, draft, owner.user_id);
  await ns.setCampaignState(scope, campaign.id, "activate", owner.user_id);
  const base = process.env["APP_BASE_URL"]!;
  const response = await fetch(`${base}/api/public/store/v1/newsletter/subscribe`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-commerce-key": install.storefront_publishable_key!,
      origin: base,
    },
    body: JSON.stringify({
      email,
      firstName: "Lokaler Test",
      consent: true,
      consentText: "Ich möchte den Newsletter erhalten und kann mich jederzeit abmelden.",
    }),
  });
  const responseBody = await response.text();
  check("Public Store API accepts opt-in", response.ok && responseBody.includes("accepted"));
  const sub = await admin
    .from("newsletter_subscribers")
    .select("*")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .eq("email", email)
    .single();
  if (!sub.data) throw sub.error;
  check("New subscriber is pending", sub.data.status === "pending");
  const before = await ns.processNewsletters(scope);
  check("Unconfirmed subscriber receives no campaign", before.queued === 0);
  const confirmation = await admin
    .from("communications")
    .select("id,html_snapshot,metadata")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .eq("recipient_address", email)
    .eq("template_key", "newsletter.confirmation")
    .single();
  if (!confirmation.data) throw confirmation.error;
  const url = confirmation.data.html_snapshot?.match(
    /href="([^"]+newsletter\/confirm\?token=[a-f0-9]+)"/,
  )?.[1];
  if (!url) throw new Error("Confirmation link missing");
  const get = await fetch(url);
  check(
    "Confirmation GET shows form without opting in",
    get.ok && (await get.text()).includes("<form"),
  );
  const unchanged = await admin
    .from("newsletter_subscribers")
    .select("status")
    .eq("id", sub.data.id)
    .single();
  check("Mail scanners cannot confirm through GET", unchanged.data?.status === "pending");
  const post = await fetch(url, { method: "POST" });
  check("Confirmation POST succeeds", post.ok);
  const replay = await fetch(url, { method: "POST" });
  check("Confirmation token is single use", replay.status === 400);
  const queued = await ns.processNewsletters(scope);
  check("Welcome automation queues one message", queued.queued === 1 && !queued.errors.length);
  const again = await ns.processNewsletters(scope);
  check("Scheduler repeat does not duplicate send", again.queued === 0);
  const welcome = await admin
    .from("communications")
    .select("id,html_snapshot,metadata")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .contains("metadata", {
      newsletter_campaign_id: campaign.id,
      newsletter_subscriber_id: sub.data.id,
    })
    .single();
  if (!welcome.data) throw welcome.error;
  check(
    "Newsletter contains professional branding, legal text and unsubscribe",
    !!welcome.data.html_snapshot?.includes("Synthetischer Rechtstext") &&
      welcome.data.html_snapshot.includes("Newsletter abmelden"),
  );
  await ns.setCampaignState(scope, campaign.id, "pause", owner.user_id);
  const paused = await comm.dispatchCommunication(welcome.data.id);
  check("Paused campaign cannot dispatch", "skipped" in paused && paused.status === "paused");
  const pauseRow = await admin
    .from("communications")
    .select("status,next_attempt_at")
    .eq("id", welcome.data.id)
    .eq("organization_id", scope.organizationId)
    .single();
  check(
    "Paused messages leave the due queue",
    pauseRow.data?.status === "queued" && pauseRow.data.next_attempt_at === null,
  );
  await ns.setCampaignState(scope, campaign.id, "activate", owner.user_id);
  const resumed = await admin
    .from("communications")
    .select("next_attempt_at")
    .eq("id", welcome.data.id)
    .eq("organization_id", scope.organizationId)
    .single();
  check("Resuming restores queued delivery", !!resumed.data?.next_attempt_at);
  const concurrent = await Promise.all([
    comm.dispatchCommunication(welcome.data.id),
    comm.dispatchCommunication(welcome.data.id),
  ]);
  check(
    "Parallel workers claim message exactly once",
    concurrent.filter((r) => "sent" in r && r.sent).length === 1,
  );
  const attempts = await admin
    .from("communication_attempts")
    .select("id", { count: "exact" })
    .eq("communication_id", welcome.data.id)
    .eq("organization_id", scope.organizationId);
  check("One provider attempt recorded", attempts.count === 1);
  const stats = await ns.newsletterOverview(scope);
  check(
    "Campaign statistics count actual sent messages",
    stats.campaignStats.find((c) => c.campaign_id === campaign.id)?.sent === 1,
  );
  const foreignStats = await admin.rpc("newsletter_campaign_stats", {
    p_org: randomUUID(),
    p_shop: scope.shopId,
  });
  check(
    "Campaign statistics isolate organizations",
    !foreignStats.error && foreignStats.data?.length === 0,
  );
  const future = await ns.saveCampaign(
    scope,
    {
      ...draft,
      name: `QA Zukunft ${suffix}`,
      kind: "broadcast",
      scheduledAt: new Date(Date.now() + 86400000).toISOString(),
    },
    owner.user_id,
  );
  await ns.setCampaignState(scope, future.id, "activate", owner.user_id);
  check(
    "Future broadcasts wait for their scheduled time",
    (await ns.processNewsletters(scope)).queued === 0,
  );
  await ns.setCampaignState(scope, future.id, "pause", owner.user_id);

  const broadcast = await ns.saveCampaign(
    scope,
    { ...draft, name: `QA Abmeldung ${suffix}`, kind: "broadcast" },
    owner.user_id,
  );
  await ns.setCampaignState(scope, broadcast.id, "activate", owner.user_id);
  const bq = await ns.processNewsletters(scope);
  check("Broadcast prepares confirmed audience", bq.queued >= 1);
  const broadcastMessage = await admin
    .from("communications")
    .select("id")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .contains("metadata", {
      newsletter_campaign_id: broadcast.id,
      newsletter_subscriber_id: sub.data.id,
    })
    .single();
  if (!broadcastMessage.data) throw broadcastMessage.error;
  await ns.unsubscribeNewsletter(sub.data.unsubscribe_token);
  const consentEvents = await admin
    .from("newsletter_consent_events")
    .select("event_type,consent_text")
    .eq("organization_id", scope.organizationId)
    .eq("shop_id", scope.shopId)
    .eq("subscriber_id", sub.data.id)
    .order("occurred_at");
  check(
    "Consent evidence records request, confirmation and withdrawal",
    consentEvents.data?.map((e) => e.event_type).join(",") === "requested,confirmed,unsubscribed",
  );
  const consentMutation = await admin
    .from("newsletter_consent_events")
    .update({ consent_text: "changed" })
    .eq("subscriber_id", sub.data.id)
    .eq("organization_id", scope.organizationId);
  check("Existing consent evidence cannot be edited", !!consentMutation.error);
  const result = await comm.dispatchCommunication(broadcastMessage.data.id);
  check(
    "Unsubscribe suppresses already queued campaign",
    "skipped" in result && result.status === "suppressed",
  );
  await rejects("Foreign shop scope is rejected", () =>
    ns.newsletterOverview({ ...scope, organizationId: randomUUID() }),
  );
  await rejects("Activated campaign cannot be changed", () =>
    ns.saveCampaign(scope, { ...draft, id: campaign.id, subject: "Changed" }, owner.user_id),
  );
  await ns.setCampaignState(scope, campaign.id, "pause", owner.user_id);
  const overview = await ns.newsletterOverview(scope);
  check(
    "Studio exposes subscriber and campaign history",
    overview.subscribers.some((s) => s.email === email && s.status === "unsubscribed") &&
      overview.campaigns.some((c) => c.id === campaign.id && c.status === "paused"),
  );
  const { createClient } = await import("@supabase/supabase-js");
  const credentials = JSON.parse(readFileSync(".local-state/local-owner.json", "utf8")) as {
    email: string;
    password: string;
  };
  const client = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const login = await client.auth.signInWithPassword({
    email: credentials.email,
    password: credentials.password,
  });
  if (login.error) throw new Error("Local QA owner login failed.");
  const ownRead = await client
    .from("newsletter_subscribers")
    .select("id")
    .eq("organization_id", scope.organizationId)
    .eq("id", sub.data.id);
  check("Authorized owner can read subscriber through RLS", ownRead.data?.length === 1);
  const directWrite = await client.from("newsletter_campaigns").insert({
    organization_id: scope.organizationId,
    shop_id: scope.shopId,
    name: "forbidden direct write",
  });
  check("Direct authenticated writes are denied", !!directWrite.error);
  const directStats = await client.rpc("newsletter_campaign_stats", {
    p_org: scope.organizationId,
    p_shop: scope.shopId,
  });
  check("Campaign aggregates require the permission-checked server", !!directStats.error);

  const anon = createClient(
    process.env["SUPABASE_URL"]!,
    process.env["SUPABASE_PUBLISHABLE_KEY"]!,
    { auth: { persistSession: false } },
  );
  const browserPath = `${scope.organizationId}/qa-browser-${suffix}.png`;
  const browserUpload = await client.storage
    .from("media")
    .upload(browserPath, logoBytes, { contentType: "image/png" });
  check("Authenticated owner can upload a logo through Storage RLS", !browserUpload.error);
  const browserPdf = await client.storage
    .from("media")
    .upload(`${scope.organizationId}/qa-browser-${suffix}.pdf`, pdf, {
      contentType: "application/pdf",
    });
  check("Authenticated owner can upload a PDF through Storage RLS", !browserPdf.error);
  const signed = await client.storage.from("media").createSignedUrl(browserPath, 60);
  check(
    "Owner can sign and view their uploaded image",
    !!signed.data?.signedUrl && (await fetch(signed.data.signedUrl)).ok,
  );
  const foreignUpload = await client.storage
    .from("media")
    .upload(`${randomUUID()}/qa-${suffix}.png`, logoBytes, { contentType: "image/png" });
  check("Storage denies uploads into another organization", !!foreignUpload.error);
  const anonymousUpload = await anon.storage
    .from("media")
    .upload(`${scope.organizationId}/qa-anon-${suffix}.png`, logoBytes, {
      contentType: "image/png",
    });
  check("Storage denies anonymous uploads", !!anonymousUpload.error);
  const publicUrl = anon.storage.from("media").getPublicUrl(browserPath).data.publicUrl;
  check("Media and PDF bucket does not expose public URLs", !(await fetch(publicUrl)).ok);
  const forbiddenMime = await client.storage
    .from("media")
    .upload(`${scope.organizationId}/qa-${suffix}.svg`, new Blob(["<svg/>"]), {
      contentType: "image/svg+xml",
    });
  check("Storage rejects active SVG content", !!forbiddenMime.error);
  const anonRead = await anon.from("newsletter_subscribers").select("email");
  check(
    "Anonymous users cannot read subscriber addresses",
    !!anonRead.error || anonRead.data?.length === 0,
  );
  await client.auth.signOut({ scope: "local" });
  writeFileSync(
    ".local-state/expansion/newsletter-qa.json",
    JSON.stringify({ checks, campaignId: campaign.id, subscriberId: sub.data.id }, null, 2),
  );
} finally {
  await studio.saveBrandingSettings({ ...scope, actorId: owner.user_id, settings: original });
}
console.log(`${checks.length} local integration checks passed; no external emails sent.`);
