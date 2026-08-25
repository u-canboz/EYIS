/**
 * Communication Studio: templates, versions, rules, branding, providers,
 * sender identities and suppressions. Published versions stay immutable —
 * editing always creates a new draft version.
 */
import { getAdmin, writeAudit } from "../core.server";
import type {
  Block,
  BlockType,
  ProviderConfigRow,
  RuleRow,
  SenderIdentityRow,
  TemplateDetail,
  TemplateListItem,
  TemplateVersionRow,
} from "./communication.types";

type Row = Record<string, unknown>;

/* -------------------------------- templates ------------------------------- */

export async function listTemplates(input: {
  organizationId: string;
  shopId: string;
}): Promise<TemplateListItem[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_templates")
    .select("*")
    .or(`organization_id.eq.${input.organizationId},organization_id.is.null`)
    .order("category", { ascending: true })
    .order("name", { ascending: true });

  const templates = ((data ?? []) as Row[]).filter(
    (t) => !t["shop_id"] || t["shop_id"] === input.shopId,
  );
  const ids = templates.map((t) => t["id"] as string);

  const { data: versionRows } = ids.length
    ? await admin
        .from("communication_template_versions")
        .select("template_id, locale")
        .in("template_id", ids)
    : { data: [] };
  const localesByTemplate = new Map<string, Set<string>>();
  for (const v of (versionRows ?? []) as Row[]) {
    const key = v["template_id"] as string;
    if (!localesByTemplate.has(key)) localesByTemplate.set(key, new Set());
    localesByTemplate.get(key)!.add(v["locale"] as string);
  }

  const { data: ruleRows } = await admin
    .from("communication_rules")
    .select("template_key, event_type, enabled")
    .eq("organization_id", input.organizationId)
    .eq("shop_id", input.shopId);
  const eventsByKey = new Map<string, string[]>();
  for (const r of (ruleRows ?? []) as Row[]) {
    const key = r["template_key"] as string;
    eventsByKey.set(key, [...(eventsByKey.get(key) ?? []), r["event_type"] as string]);
  }

  // Shop override hides the system template with the same key.
  const overridden = new Set(templates.filter((t) => t["organization_id"]).map((t) => t["key"]));
  return templates
    .filter((t) => t["organization_id"] || !overridden.has(t["key"]))
    .map((t) => ({
      id: t["id"] as string,
      key: t["key"] as string,
      name: t["name"] as string,
      description: (t["description"] as string) ?? null,
      category: t["category"] as string,
      status: String(t["status"]),
      isSystem: Boolean(t["is_system"]),
      locales: [...(localesByTemplate.get(t["id"] as string) ?? new Set(["de-DE"]))],
      eventTypes: eventsByKey.get(t["key"] as string) ?? [],
      updatedAt: t["updated_at"] as string,
    }));
}

function mapVersion(v: Row): TemplateVersionRow {
  return {
    id: v["id"] as string,
    version: Number(v["version"] ?? 1),
    locale: v["locale"] as string,
    subject: (v["subject"] as string) ?? "",
    preheader: (v["preheader"] as string) ?? null,
    blocks: Array.isArray(v["body_schema"]) ? (v["body_schema"] as Block[]) : [],
    publishedAt: (v["published_at"] as string) ?? null,
    createdAt: v["created_at"] as string,
  };
}

export async function loadTemplate(
  organizationId: string,
  templateId: string,
): Promise<TemplateDetail> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_templates")
    .select("*")
    .eq("id", templateId)
    .maybeSingle();
  const t = data as Row | null;
  if (!t) throw new Error("Vorlage nicht gefunden.");
  if (t["organization_id"] && t["organization_id"] !== organizationId)
    throw new Error("Kein Zugriff auf diese Vorlage.");

  const { data: versions } = await admin
    .from("communication_template_versions")
    .select("*")
    .eq("template_id", templateId)
    .order("version", { ascending: false });

  const schema = (t["content_schema"] as Row) ?? {};
  return {
    id: t["id"] as string,
    key: t["key"] as string,
    name: t["name"] as string,
    description: (t["description"] as string) ?? null,
    category: t["category"] as string,
    status: String(t["status"]),
    isSystem: Boolean(t["is_system"]),
    organizationId: (t["organization_id"] as string) ?? null,
    requiredBlocks: Array.isArray(schema["required_blocks"])
      ? (schema["required_blocks"] as BlockType[])
      : [],
    versions: ((versions ?? []) as Row[]).map(mapVersion),
  };
}

/**
 * Creates an editable organization copy of a system template.
 * System templates themselves are never modified.
 */
export async function forkTemplate(input: {
  organizationId: string;
  shopId: string | null;
  templateId: string;
  actorId: string | null;
}) {
  const admin = await getAdmin();
  const source = await loadTemplate(input.organizationId, input.templateId);
  if (source.organizationId) return { templateId: source.id, created: false as const };

  const { data: created, error } = await admin
    .from("communication_templates")
    .insert({
      organization_id: input.organizationId,
      shop_id: input.shopId,
      key: source.key,
      channel: "email",
      name: source.name,
      description: source.description,
      category: source.category,
      status: source.status as never,
      is_system: false,
      version: 1,
      default_locale: "de-DE",
      subject_template: source.versions[0]?.subject ?? "",
      content_schema: { required_blocks: source.requiredBlocks } as never,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  const templateId = (created as Row)["id"] as string;

  for (const version of source.versions.filter((v) => v.publishedAt)) {
    await admin.from("communication_template_versions").insert({
      template_id: templateId,
      version: 1,
      locale: version.locale,
      subject: version.subject,
      preheader: version.preheader,
      body_schema: version.blocks as never,
      text_body_template: "",
      published_at: new Date().toISOString(),
      created_by: input.actorId,
    } as never);
  }

  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "communication.template_forked",
    entityType: "communication_template",
    entityId: templateId,
    metadata: { key: source.key },
  });
  return { templateId, created: true as const };
}

/** Saves a new draft version. Published versions are never touched. */
export async function saveDraftVersion(input: {
  organizationId: string;
  templateId: string;
  locale: string;
  subject: string;
  preheader: string | null;
  blocks: Block[];
  actorId: string | null;
}) {
  const admin = await getAdmin();
  const template = await loadTemplate(input.organizationId, input.templateId);
  if (!template.organizationId)
    throw new Error("Systemvorlagen können nicht direkt bearbeitet werden.");

  const draft = template.versions.find((v) => v.locale === input.locale && !v.publishedAt);
  if (draft) {
    const { error } = await admin
      .from("communication_template_versions")
      .update({
        subject: input.subject,
        preheader: input.preheader,
        body_schema: input.blocks as never,
      } as never)
      .eq("id", draft.id);
    if (error) throw new Error(error.message);
    return { versionId: draft.id, version: draft.version };
  }

  const nextVersion = Math.max(0, ...template.versions.map((v) => v.version)) + 1;
  const { data, error } = await admin
    .from("communication_template_versions")
    .insert({
      template_id: input.templateId,
      version: nextVersion,
      locale: input.locale,
      subject: input.subject,
      preheader: input.preheader,
      body_schema: input.blocks as never,
      text_body_template: "",
      created_by: input.actorId,
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(error.message);
  return { versionId: (data as Row)["id"] as string, version: nextVersion };
}

export async function publishVersion(input: {
  organizationId: string;
  templateId: string;
  versionId: string;
  actorId: string | null;
}) {
  const admin = await getAdmin();
  await loadTemplate(input.organizationId, input.templateId);
  const { error } = await admin
    .from("communication_template_versions")
    .update({ published_at: new Date().toISOString() } as never)
    .eq("id", input.versionId)
    .is("published_at", null);
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "communication.template_published",
    entityType: "communication_template",
    entityId: input.templateId,
    metadata: { version_id: input.versionId },
  });
  return { ok: true };
}

export async function setTemplateStatus(input: {
  organizationId: string;
  templateId: string;
  status: "active" | "disabled";
  actorId: string | null;
}) {
  const admin = await getAdmin();
  const template = await loadTemplate(input.organizationId, input.templateId);
  if (!template.organizationId)
    throw new Error("Systemvorlagen werden über die Regeln aktiviert oder deaktiviert.");
  const { error } = await admin
    .from("communication_templates")
    .update({ status: input.status as never } as never)
    .eq("id", input.templateId);
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "communication.template_status_changed",
    entityType: "communication_template",
    entityId: input.templateId,
    metadata: { status: input.status },
  });
  return { ok: true };
}

/* ---------------------------------- rules --------------------------------- */

export async function listRules(organizationId: string, shopId: string): Promise<RuleRow[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_rules")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("event_type", { ascending: true });

  const rows = (data ?? []) as Row[];
  const keys = [...new Set(rows.map((r) => r["template_key"] as string))];
  const { data: templates } = keys.length
    ? await admin.from("communication_templates").select("key, name").in("key", keys)
    : { data: [] };
  const names = new Map(
    ((templates ?? []) as Row[]).map((t) => [t["key"] as string, t["name"] as string]),
  );

  return rows.map((r) => ({
    id: r["id"] as string,
    eventType: r["event_type"] as string,
    templateKey: r["template_key"] as string,
    templateName: names.get(r["template_key"] as string) ?? (r["template_key"] as string),
    enabled: Boolean(r["enabled"]),
    delaySeconds: Number(r["delay_seconds"] ?? 0),
    conditions: (r["conditions"] as Record<string, string | number | boolean | null>) ?? {},
  }));
}

export async function updateRule(input: {
  organizationId: string;
  ruleId: string;
  enabled?: boolean;
  delaySeconds?: number;
  actorId: string | null;
}) {
  const admin = await getAdmin();
  const patch: Row = {};
  if (input.enabled !== undefined) patch["enabled"] = input.enabled;
  if (input.delaySeconds !== undefined) patch["delay_seconds"] = input.delaySeconds;
  const { error } = await admin
    .from("communication_rules")
    .update(patch as never)
    .eq("id", input.ruleId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "communication.rule_updated",
    entityType: "communication_rule",
    entityId: input.ruleId,
    metadata: patch,
  });
  return { ok: true };
}

/** Creates the default branding, provider and rule set for a shop. */
export async function ensureShopDefaults(organizationId: string, shopId: string) {
  const admin = await getAdmin();
  const { error } = await admin.rpc("comm_ensure_shop_defaults" as never, {
    _org: organizationId,
    _shop: shopId,
  } as never);
  if (error) throw new Error(error.message);
  return { ok: true };
}

/* -------------------------------- branding -------------------------------- */

export type BrandingSettings = {
  logoMediaId: string | null;
  primaryColor: string;
  backgroundColor: string;
  contentBackgroundColor: string;
  textColor: string;
  mutedTextColor: string;
  buttonStyle: string;
  borderRadius: number;
  fontFamily: string;
  footerText: string;
  supportEmail: string | null;
  websiteUrl: string | null;
  socialLinks: { label: string; url: string }[];
};

export async function loadBrandingSettings(
  organizationId: string,
  shopId: string,
): Promise<BrandingSettings> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_branding")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .maybeSingle();
  const r = (data ?? {}) as Row;
  return {
    logoMediaId: (r["logo_media_id"] as string) ?? null,
    primaryColor: (r["primary_color"] as string) ?? "#1f2937",
    backgroundColor: (r["background_color"] as string) ?? "#f4f4f5",
    contentBackgroundColor: (r["content_background_color"] as string) ?? "#ffffff",
    textColor: (r["text_color"] as string) ?? "#18181b",
    mutedTextColor: (r["muted_text_color"] as string) ?? "#71717a",
    buttonStyle: (r["button_style"] as string) ?? "solid",
    borderRadius: Number(r["border_radius"] ?? 8),
    fontFamily: (r["font_family"] as string) ?? "Helvetica, Arial, sans-serif",
    footerText: (r["footer_text"] as string) ?? "",
    supportEmail: (r["support_email"] as string) ?? null,
    websiteUrl: (r["website_url"] as string) ?? null,
    socialLinks: Array.isArray(r["social_links"])
      ? (r["social_links"] as { label: string; url: string }[])
      : [],
  };
}

export async function saveBrandingSettings(input: {
  organizationId: string;
  shopId: string;
  settings: BrandingSettings;
  actorId: string | null;
}) {
  const admin = await getAdmin();
  const s = input.settings;
  const { error } = await admin.from("communication_branding").upsert(
    {
      organization_id: input.organizationId,
      shop_id: input.shopId,
      logo_media_id: s.logoMediaId,
      primary_color: s.primaryColor,
      background_color: s.backgroundColor,
      content_background_color: s.contentBackgroundColor,
      text_color: s.textColor,
      muted_text_color: s.mutedTextColor,
      button_style: s.buttonStyle,
      border_radius: s.borderRadius,
      font_family: s.fontFamily,
      footer_text: s.footerText,
      support_email: s.supportEmail,
      website_url: s.websiteUrl,
      social_links: s.socialLinks as never,
    } as never,
    { onConflict: "shop_id" },
  );
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "communication.branding_updated",
    entityType: "communication_branding",
    entityId: input.shopId,
  });
  return { ok: true };
}

/* -------------------------------- providers ------------------------------- */

export async function listProviderConfigs(
  organizationId: string,
  shopId: string,
): Promise<ProviderConfigRow[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_provider_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .or(`shop_id.eq.${shopId},shop_id.is.null`)
    .order("priority", { ascending: false });
  return ((data ?? []) as Row[]).map((r) => ({
    id: r["id"] as string,
    provider: r["provider"] as string,
    displayName: r["display_name"] as string,
    status: String(r["status"]),
    testMode: Boolean(r["test_mode"]),
    priority: Number(r["priority"] ?? 0),
    capabilities: (r["capabilities"] as Record<string, boolean>) ?? {},
  }));
}

export async function upsertProviderConfig(input: {
  organizationId: string;
  shopId: string;
  provider: string;
  displayName: string;
  status: "active" | "inactive";
  testMode: boolean;
  priority: number;
  actorId: string | null;
}) {
  const admin = await getAdmin();
  const { getProvider } = await import("./registry.server");
  const impl = getProvider(input.provider);
  const { error } = await admin.from("communication_provider_configs").upsert(
    {
      organization_id: input.organizationId,
      shop_id: input.shopId,
      channel: "email",
      provider: input.provider,
      display_name: input.displayName,
      status: input.status as never,
      test_mode: impl.isSandbox ? true : input.testMode,
      priority: input.priority,
      capabilities: impl.capabilities as never,
    } as never,
    { onConflict: "organization_id,shop_id,channel,provider" },
  );
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "communication.provider_updated",
    entityType: "communication_provider_config",
    entityId: input.provider,
    metadata: { status: input.status, shop_id: input.shopId },
  });
  return { ok: true };
}

/* ---------------------------- sender identities --------------------------- */

export async function listSenderIdentities(
  organizationId: string,
  shopId: string,
): Promise<SenderIdentityRow[]> {
  const admin = await getAdmin();
  const { data } = await admin
    .from("sender_identities")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .order("is_default", { ascending: false });
  return ((data ?? []) as Row[]).map((r) => ({
    id: r["id"] as string,
    displayName: r["display_name"] as string,
    senderName: r["sender_name"] as string,
    senderAddress: r["sender_address"] as string,
    replyTo: (r["reply_to"] as string) ?? null,
    verificationStatus: String(r["verification_status"]),
    isDefault: Boolean(r["is_default"]),
  }));
}

export async function saveSenderIdentity(input: {
  organizationId: string;
  shopId: string;
  id?: string | null;
  displayName: string;
  senderName: string;
  senderAddress: string;
  replyTo: string | null;
  isDefault: boolean;
  actorId: string | null;
}) {
  const admin = await getAdmin();
  if (input.isDefault) {
    await admin
      .from("sender_identities")
      .update({ is_default: false } as never)
      .eq("organization_id", input.organizationId)
      .eq("shop_id", input.shopId);
  }
  const payload = {
    organization_id: input.organizationId,
    shop_id: input.shopId,
    channel: "email",
    display_name: input.displayName,
    sender_name: input.senderName,
    sender_address: input.senderAddress.trim().toLowerCase(),
    reply_to: input.replyTo,
    is_default: input.isDefault,
  };
  const query = input.id
    ? admin.from("sender_identities").update(payload as never).eq("id", input.id)
    : admin.from("sender_identities").insert(payload as never);
  const { error } = await query;
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "communication.sender_identity_saved",
    entityType: "sender_identity",
    entityId: input.id ?? input.senderAddress,
  });
  return { ok: true };
}

/* ------------------------------ suppressions ------------------------------ */

export async function listSuppressions(organizationId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_suppressions")
    .select("*")
    .eq("organization_id", organizationId)
    .order("created_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as Row[]).map((r) => ({
    id: r["id"] as string,
    address: r["address"] as string,
    reason: String(r["reason"]),
    source: (r["source"] as string) ?? "",
    note: (r["note"] as string) ?? null,
    createdAt: r["created_at"] as string,
    expiresAt: (r["expires_at"] as string) ?? null,
  }));
}

export async function removeSuppression(input: {
  organizationId: string;
  suppressionId: string;
  actorId: string | null;
}) {
  const admin = await getAdmin();
  const { error } = await admin
    .from("communication_suppressions")
    .delete()
    .eq("id", input.suppressionId)
    .eq("organization_id", input.organizationId);
  if (error) throw new Error(error.message);
  await writeAudit({
    organizationId: input.organizationId,
    actorId: input.actorId,
    action: "communication.suppression_removed",
    entityType: "communication_suppression",
    entityId: input.suppressionId,
  });
  return { ok: true };
}
