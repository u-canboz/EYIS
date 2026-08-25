/**
 * Schedule triggers. A scheduled rule runs against a query result set instead
 * of a single domain event (e.g. "carts abandoned for 24 h").
 */
import { getAdmin } from "../core.server";
import { dispatchScheduledExecution } from "./scheduled-run.server";

type Row = Record<string, unknown>;

export type ScheduleKind = "abandoned_carts" | "unpaid_orders" | "unfulfilled_orders" | "low_stock";

export const SCHEDULE_KINDS: { value: ScheduleKind; label: string; description: string }[] = [
  {
    value: "abandoned_carts",
    label: "Liegengebliebene Warenkörbe",
    description: "Warenkörbe mit Artikeln, die seit X Stunden nicht mehr angefasst wurden.",
  },
  {
    value: "unpaid_orders",
    label: "Unbezahlte Bestellungen",
    description: "Bestellungen, die seit X Stunden auf Zahlung warten.",
  },
  {
    value: "unfulfilled_orders",
    label: "Nicht versandte Bestellungen",
    description: "Bezahlte Bestellungen ohne Versand seit X Stunden.",
  },
  {
    value: "low_stock",
    label: "Niedriger Bestand",
    description: "Artikel unter ihrer Meldebestandsgrenze.",
  },
];

async function collectTargets(rule: Row): Promise<Record<string, unknown>[]> {
  const admin = await getAdmin();
  const cfg = (rule["trigger_config"] as Row) ?? {};
  const kind = (cfg["scheduleKind"] as ScheduleKind) ?? "abandoned_carts";
  const hours = Number(cfg["olderThanHours"] ?? 24);
  const cutoff = new Date(Date.now() - hours * 3_600_000).toISOString();
  const orgId = rule["organization_id"] as string;
  const shopId = rule["shop_id"] as string;

  if (kind === "abandoned_carts") {
    const { data } = await admin
      .from("carts")
      .select("id, customer_id, email, total_minor, currency_code, updated_at")
      .eq("organization_id", orgId)
      .eq("shop_id", shopId)
      .eq("status", "active")
      .lt("updated_at", cutoff)
      .limit(200);
    return ((data ?? []) as Row[])
      .filter((c) => c["email"])
      .map((c) => ({
        cart_id: c["id"],
        customer_id: c["customer_id"],
        email: c["email"],
        total_minor: c["total_minor"],
        currency_code: c["currency_code"],
      }));
  }

  if (kind === "unpaid_orders" || kind === "unfulfilled_orders") {
    let q = admin
      .from("orders")
      .select("id, order_number, customer_id, email, total_minor, currency_code, payment_status, fulfillment_status")
      .eq("organization_id", orgId)
      .eq("shop_id", shopId)
      .neq("order_status", "cancelled")
      .lt("placed_at", cutoff)
      .limit(200);
    q = kind === "unpaid_orders" ? q.eq("payment_status", "unpaid") : q.eq("payment_status", "paid").eq("fulfillment_status", "unfulfilled");
    const { data } = await q;
    return ((data ?? []) as Row[]).map((o) => ({
      order_id: o["id"],
      order_number: o["order_number"],
      customer_id: o["customer_id"],
      email: o["email"],
      total_minor: o["total_minor"],
      currency_code: o["currency_code"],
      payment_status: o["payment_status"],
      fulfillment_status: o["fulfillment_status"],
    }));
  }

  const { data } = await admin
    .from("inventory_levels")
    .select("inventory_item_id, location_id, on_hand, reserved, reorder_point")
    .eq("organization_id", orgId)
    .limit(200);
  return ((data ?? []) as Row[])
    .filter((l) => l["reorder_point"] != null && Number(l["on_hand"]) - Number(l["reserved"] ?? 0) <= Number(l["reorder_point"]))
    .map((l) => ({
      inventory_item_id: l["inventory_item_id"],
      location_id: l["location_id"],
      available: Number(l["on_hand"]) - Number(l["reserved"] ?? 0),
      threshold: l["reorder_point"],
    }));
}

/** Executes one scheduled rule against its current target set. */
export async function runScheduledRule(ruleId: string) {
  const admin = await getAdmin();
  const { data } = await admin.from("automation_rules").select("*").eq("id", ruleId).maybeSingle();
  const rule = data as Row | null;
  if (!rule || rule["status"] !== "active") return { ran: 0, skipped: "inactive" };

  const targets = await collectTargets(rule);
  let ran = 0;
  for (const payload of targets) {
    const result = await dispatchScheduledExecution(rule, payload);
    if (result) ran += 1;
  }
  await admin
    .from("automation_rules")
    .update({ last_executed_at: new Date().toISOString() } as never)
    .eq("id", ruleId);
  return { ran, targets: targets.length };
}

/** Called by the cron worker: queues every rule whose interval has elapsed. */
export async function enqueueDueSchedules() {
  const admin = await getAdmin();
  const { data } = await admin
    .from("automation_rules")
    .select("*")
    .eq("status", "active")
    .eq("trigger_type", "schedule");

  const now = Date.now();
  let queued = 0;
  for (const rule of (data ?? []) as Row[]) {
    const cfg = (rule["trigger_config"] as Row) ?? {};
    const everyMinutes = Math.max(15, Number(cfg["everyMinutes"] ?? 60));
    const last = rule["last_executed_at"] ? new Date(rule["last_executed_at"] as string).getTime() : 0;
    if (now - last < everyMinutes * 60_000) continue;
    const bucket = Math.floor(now / (everyMinutes * 60_000));
    const { error } = await admin.from("automation_jobs").insert({
      organization_id: rule["organization_id"],
      shop_id: rule["shop_id"],
      rule_id: rule["id"],
      job_type: "scheduled_rule",
      payload: {} as never,
      status: "pending",
      available_at: new Date().toISOString(),
      dedupe_key: `schedule:${rule["id"]}:${bucket}`,
    } as never);
    if (!error) queued += 1;
  }
  return { queued };
}
