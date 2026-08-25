/**
 * Single entry point for domain events.
 *
 * Every commercial state change publishes here. The event is persisted in the
 * outbox (with correlation/causation for tracing), handed to the communication
 * engine and to the automation engine. Neither consumer may break the
 * originating transaction, so failures are logged, never thrown.
 */
import { getAdmin } from "./core.server";

export type PublishedEvent = {
  organizationId: string;
  shopId: string;
  eventType: string;
  payload: Record<string, unknown>;
  correlationId?: string | null;
  causationId?: string | null;
  chainDepth?: number;
};

export async function publishDomainEvent(event: PublishedEvent) {
  const correlationId = event.correlationId ?? crypto.randomUUID();
  const chainDepth = event.chainDepth ?? 0;
  let eventId: string | null = null;

  try {
    const admin = await getAdmin();
    const { data } = await admin
      .from("outbox_events")
      .insert({
        organization_id: event.organizationId,
        shop_id: event.shopId,
        event_type: event.eventType,
        payload: event.payload as never,
        correlation_id: correlationId,
        causation_id: event.causationId ?? null,
        chain_depth: chainDepth,
        status: "processed",
        processed_at: new Date().toISOString(),
      } as never)
      .select("id")
      .maybeSingle();
    eventId = (data as { id: string } | null)?.id ?? null;
  } catch (error) {
    console.error("[events] outbox insert failed", event.eventType, error);
  }

  try {
    const { notify } = await import("./communications/communication.server");
    await notify({
      organizationId: event.organizationId,
      shopId: event.shopId,
      eventType: event.eventType,
      eventId,
      payload: event.payload,
    });
  } catch (error) {
    console.error("[events] communications failed", event.eventType, error);
  }

  try {
    const { triggerAutomations } = await import("./automation/engine.server");
    await triggerAutomations({
      organizationId: event.organizationId,
      shopId: event.shopId,
      eventType: event.eventType,
      eventId,
      payload: event.payload,
      correlationId,
      causationId: event.causationId ?? null,
      chainDepth,
    });
  } catch (error) {
    console.error("[events] automations failed", event.eventType, error);
  }

  return { eventId, correlationId };
}
