/** Provider registry. Selection is data driven via communication_provider_configs. */
import { getAdmin } from "../core.server";
import type { CommunicationProvider } from "./provider";
import { testProvider } from "./providers/test.server";
import { lovableProvider } from "./providers/lovable.server";

const PROVIDERS: Record<string, CommunicationProvider> = {
  test: testProvider,
  lovable: lovableProvider,
};

export const AVAILABLE_PROVIDERS = Object.values(PROVIDERS).map((p) => ({
  key: p.key,
  label: p.label,
  isSandbox: p.isSandbox,
  capabilities: p.capabilities,
}));

export function getProvider(key: string): CommunicationProvider {
  return PROVIDERS[key] ?? testProvider;
}

type Row = Record<string, unknown>;

/** Highest-priority active provider of the shop; falls back to the test provider. */
export async function resolveProvider(organizationId: string, shopId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("communication_provider_configs")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("channel", "email")
    .eq("status", "active")
    .or(`shop_id.eq.${shopId},shop_id.is.null`)
    .order("shop_id", { ascending: false, nullsFirst: false })
    .order("priority", { ascending: false })
    .limit(1);

  const row = (data?.[0] ?? null) as Row | null;
  const key = (row?.["provider"] as string) ?? "test";
  return {
    provider: getProvider(key),
    configId: (row?.["id"] as string) ?? null,
    testMode: row ? Boolean(row["test_mode"]) : true,
  };
}

export async function resolveSenderIdentity(organizationId: string, shopId: string) {
  const admin = await getAdmin();
  const { data } = await admin
    .from("sender_identities")
    .select("*")
    .eq("organization_id", organizationId)
    .eq("shop_id", shopId)
    .eq("channel", "email")
    .eq("status", "active")
    .order("is_default", { ascending: false })
    .limit(1);
  const row = (data?.[0] ?? null) as Row | null;
  if (!row) return null;
  return {
    id: row["id"] as string,
    senderName: row["sender_name"] as string,
    senderAddress: row["sender_address"] as string,
    replyTo: (row["reply_to"] as string) ?? null,
    verified: row["verification_status"] === "verified",
  };
}
