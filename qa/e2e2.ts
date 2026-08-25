/* Phase 5 acceptance: sections 9-14 (concurrency, refunds, cancellation,
   tenant isolation, test-provider safety). */
import { createClient } from "@supabase/supabase-js";
import { admin, check, expectThrow, readState, summary, results } from "./lib";
import { toValidatedCheckout, startPayment, confirmMockPayment, checkout, payments } from "./flow";
import { adjustStock, receiveStock } from "@/lib/commerce/inventory.server";
import { writeFileSync } from "fs";

const s = readState();
const ctxA = { supabase: admin as never, userId: s['userA']! };

async function levels() {
  const { data } = await admin
    .from("inventory_levels")
    .select("on_hand, reserved, damaged")
    .eq("inventory_item_id", s['itemId']!)
    .eq("location_id", s['locationId']!)
    .maybeSingle();
  return { onHand: Number(data?.on_hand ?? 0), reserved: Number(data?.reserved ?? 0), damaged: Number(data?.damaged ?? 0) };
}

async function purchase() {
  const flow = await toValidatedCheckout({ orgId: s['orgA']!, shopId: s['shopA']!, variantId: s['variantId']!, shippingId: s['shippingId']! });
  const pay = await startPayment(flow.sessionId, flow.token);
  const fin = await confirmMockPayment(pay.paymentSessionId);
  return { flow, pay, fin };
}

async function refund(orderId: string, amountMinor: number, idem: string | null) {
  const { data, error } = await admin.rpc("refund_create" as never, {
    _org: s['orgA']!,
    _order: orderId,
    _actor: s['userA']!,
    _amount_minor: amountMinor,
    _reason: "QA-Test",
    _idem: idem,
  } as never);
  if (error) throw new Error(error.message);
  const created = data as { refund_id: string; amount_minor: number };
  const { error: settleErr } = await admin.rpc("refund_settle" as never, {
    _org: s['orgA']!,
    _refund: created.refund_id,
    _status: "completed",
    _provider: "mock",
    _provider_refund_id: `mock_re_${created.refund_id}`,
    _error: null,
  } as never);
  if (settleErr) throw new Error(settleErr.message);
  return created;
}

async function main() {
  /* ---------------- 9. Inventory Concurrency ---------------- */
  await adjustStock(ctxA, {
    organizationId: s['orgA']!,
    shopId: s['shopA']!,
    inventoryItemId: s['itemId']!,
    locationId: s['locationId']!,
    countedQuantity: 1,
    reason: "QA Concurrency Setup",
    idempotencyKey: `qa-conc-${Date.now()}`,
  });
  const startLevels = await levels();
  check("Concurrency: available = 1", startLevels.onHand - startLevels.reserved - startLevels.damaged === 1, JSON.stringify(startLevels));

  const attempts = await Promise.allSettled([
    toValidatedCheckout({ orgId: s['orgA']!, shopId: s['shopA']!, variantId: s['variantId']!, shippingId: s['shippingId']! }),
    toValidatedCheckout({ orgId: s['orgA']!, shopId: s['shopA']!, variantId: s['variantId']!, shippingId: s['shippingId']! }),
  ]);
  const ok = attempts.filter((a) => a.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof toValidatedCheckout>>>[];
  const rejected = attempts.filter((a) => a.status === "rejected") as PromiseRejectedResult[];
  check("Concurrency: genau 1 Checkout mit Reservierung", ok.length === 1, `ok=${ok.length} rejected=${rejected.map((r) => String(r.reason?.message ?? r.reason).slice(0, 70)).join(" | ")}`);

  let winnerOrderId = "";
  if (ok.length === 1) {
    const flow = ok[0]!.value;
    const pay = await startPayment(flow.sessionId, flow.token);
    const fin = await confirmMockPayment(pay.paymentSessionId);
    winnerOrderId = fin.order_id;
    check("Concurrency: genau 1 Order", fin.created === true, fin.order_number);
    const after = await levels();
    check("Concurrency: kein Overselling (on_hand 0, reserved 0)", after.onHand === 0 && after.reserved === 0, JSON.stringify(after));
  } else {
    check("Concurrency: genau 1 Order", false, "kein eindeutiger Gewinner");
  }

  // Bestand für die weiteren Tests wieder auffüllen
  await receiveStock(ctxA, {
    organizationId: s['orgA']!,
    shopId: s['shopA']!,
    inventoryItemId: s['itemId']!,
    locationId: s['locationId']!,
    quantity: 10,
    reference: "QA-REFILL",
    idempotencyKey: `qa-refill-${Date.now()}`,
  });

  /* ---------------- 10./11. Refunds ---------------- */
  const refundTarget = winnerOrderId || (await purchase()).fin.order_id;
  const levelsBeforeRefund = await levels();

  const idem = `qa-refund-${Date.now()}`;
  const r1 = await refund(refundTarget, 1000, idem);
  const r1b = await refund(refundTarget, 1000, idem);
  const r1c = await refund(refundTarget, 1000, idem);
  check("Refund Idempotency: identische Refund-ID", r1.refund_id === r1b.refund_id && r1.refund_id === r1c.refund_id, r1.refund_id);
  const { count: refundCount } = await admin.from("refunds").select("id", { count: "exact", head: true }).eq("order_id", refundTarget);
  check("Refund Idempotency: genau eine Rückerstattung", refundCount === 1, `refunds=${refundCount}`);

  let { data: order } = await admin.from("orders").select("payment_status, refunded_minor, total_minor").eq("id", refundTarget).single();
  check("Teilerstattung: payment_status = partially_refunded", order!['payment_status'] === "partially_refunded", String(order!['payment_status']));
  check("Teilerstattung: refunded_minor = 1000", Number(order!['refunded_minor']) === 1000, String(order!['refunded_minor']));
  const remaining = Number(order!['total_minor']) - Number(order!['refunded_minor']);
  check("Erstattbarer Restbetrag korrekt", remaining === 4480, String(remaining));
  const { count: txCount } = await admin
    .from("payment_transactions")
    .select("id", { count: "exact", head: true })
    .eq("order_id", refundTarget)
    .in("type", ["refund", "partial_refund"]);
  check("Refund Payment Transaction vorhanden", (txCount ?? 0) >= 1, `tx=${txCount}`);

  await refund(refundTarget, remaining, `qa-refund-rest-${Date.now()}`);
  ({ data: order } = await admin.from("orders").select("payment_status, refunded_minor").eq("id", refundTarget).single());
  check("Vollerstattung: payment_status = refunded", order!['payment_status'] === "refunded", String(order!['payment_status']));

  await expectThrow("Weitere Erstattung abgelehnt", () => refund(refundTarget, 100, `qa-refund-over-${Date.now()}`));

  const levelsAfterRefund = await levels();
  check(
    "Refund erhöht Lagerbestand nicht",
    levelsAfterRefund.onHand === levelsBeforeRefund.onHand + 10 && levelsAfterRefund.reserved === levelsBeforeRefund.reserved,
    JSON.stringify({ before: levelsBeforeRefund, after: levelsAfterRefund }),
  );

  /* ---------------- 12. Cancellation ---------------- */
  const cancelPurchase = await purchase();
  const cancelOrderId = cancelPurchase.fin.order_id;
  const levelsBeforeCancel = await levels();
  const { data: cancelRes, error: cancelErr } = await admin.rpc("order_cancel" as never, {
    _org: s['orgA']!,
    _order: cancelOrderId,
    _actor: s['userA']!,
    _reason: "QA Stornotest",
    _idem: null,
  } as never);
  check("Cancellation ausgeführt", !cancelErr, cancelErr?.message ?? JSON.stringify(cancelRes));
  const { data: cancelled } = await admin.from("orders").select("order_status, cancelled_at, payment_status").eq("id", cancelOrderId).single();
  check("Cancellation: Status = cancelled", cancelled!['order_status'] === "cancelled", String(cancelled!['order_status']));
  check("Cancellation: Payment-Zustand unverändert (paid)", cancelled!['payment_status'] === "paid", String(cancelled!['payment_status']));
  const { count: cancelAudit } = await admin
    .from("audit_log")
    .select("id", { count: "exact", head: true })
    .eq("entity_id", cancelOrderId)
    .like("action", "order.cancel%");
  check("Cancellation: Audit-Eintrag", (cancelAudit ?? 0) > 0, `audit=${cancelAudit}`);
  const { count: cancelOutbox } = await admin
    .from("outbox_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", s['orgA']!)
    .eq("event_type", "order.cancelled");
  check("Cancellation: Outbox Event", (cancelOutbox ?? 0) > 0, `outbox=${cancelOutbox}`);
  const levelsAfterCancel = await levels();
  check("Cancellation: keine automatische Bestandsrückbuchung", levelsAfterCancel.onHand === levelsBeforeCancel.onHand, JSON.stringify(levelsAfterCancel));
  const { data: secondCancel } = await admin.rpc("order_cancel" as never, {
    _org: s['orgA']!,
    _order: cancelOrderId,
    _actor: s['userA']!,
    _reason: "QA Doppelstorno",
    _idem: null,
  } as never);
  check("Doppelstornierung ohne Wirkung", (secondCancel as { changed: boolean } | null)?.changed === false, JSON.stringify(secondCancel));

  /* ---------------- 13. Tenant Isolation ---------------- */
  const anonB = createClient(process.env['SUPABASE_URL']!, process.env['SUPABASE_PUBLISHABLE_KEY']!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error: signInErr } = await anonB.auth.signInWithPassword({
    email: "qa-owner-b@commerce-qa.test",
    password: "QaPhase5!Test-" + "qa-owner-b@commerce-qa.test".length,
  });
  check("Tenant B angemeldet", !signInErr, signInErr?.message ?? "ok");

  const { data: orderRead } = await anonB.from("orders").select("id").eq("id", refundTarget);
  check("Tenant Isolation: Order A nicht lesbar", (orderRead ?? []).length === 0, JSON.stringify(orderRead));
  const { data: psRead } = await anonB.from("payment_sessions").select("id").eq("organization_id", s['orgA']!);
  check("Tenant Isolation: Payment A nicht lesbar", (psRead ?? []).length === 0);
  const { data: refundRead } = await anonB.from("refunds").select("id").eq("organization_id", s['orgA']!);
  check("Tenant Isolation: Refunds A nicht lesbar", (refundRead ?? []).length === 0);
  const { data: cfgRead } = await anonB.from("payment_provider_configs").select("id").eq("organization_id", s['orgA']!);
  check("Tenant Isolation: Provider-Konfiguration A nicht lesbar", (cfgRead ?? []).length === 0);
  const { data: snapRead } = await anonB.from("checkout_snapshots").select("id").eq("organization_id", s['orgA']!);
  check("Tenant Isolation: Checkout-Snapshots A nicht lesbar", (snapRead ?? []).length === 0);

  const { data: permRefund } = await anonB.rpc("has_permission" as never, {
    _user_id: s['userB']!,
    _org_id: s['orgA']!,
    _permission: "payments.refund",
  } as never);
  check("Tenant Isolation: keine Refund-Berechtigung in Org A", permRefund === false, String(permRefund));
  const { error: rpcRefundErr } = await anonB.rpc("refund_create" as never, {
    _org: s['orgA']!,
    _order: refundTarget,
    _actor: s['userB']!,
    _amount_minor: 100,
    _reason: "QA Tenant Angriff",
    _idem: null,
  } as never);
  check("Tenant Isolation: refund_create A blockiert", !!rpcRefundErr, rpcRefundErr?.message?.slice(0, 90) ?? "kein Fehler");
  const { error: rpcCancelErr } = await anonB.rpc("order_cancel" as never, {
    _org: s['orgA']!,
    _order: refundTarget,
    _actor: s['userB']!,
    _reason: "QA Tenant Angriff",
    _idem: null,
  } as never);
  check("Tenant Isolation: order_cancel A blockiert", !!rpcCancelErr, rpcCancelErr?.message?.slice(0, 90) ?? "kein Fehler");
  const { error: rpcFinalizeErr } = await anonB.rpc("order_finalize_from_payment" as never, {
    _org: s['orgA']!,
    _payment_session: cancelPurchase.pay.paymentSessionId,
    _provider_payment_id: "hack",
    _amount_minor: 5480,
    _currency: "EUR",
    _actor: s['userB']!,
    _idem: null,
  } as never);
  check("Tenant Isolation: Finalisierung A blockiert", !!rpcFinalizeErr, rpcFinalizeErr?.message?.slice(0, 90) ?? "kein Fehler");
  const { data: updated, error: updErr } = await anonB
    .from("payment_sessions")
    .update({ status: "paid" })
    .eq("id", cancelPurchase.pay.paymentSessionId)
    .select("id");
  check("Tenant Isolation: Payment Session A nicht änderbar", (updated ?? []).length === 0, updErr?.message ?? "0 Zeilen");

  /* ---------------- 14. Test-Provider-Sicherheit ---------------- */
  const { mockProvider } = await import("@/lib/commerce/payments/mock.server");
  await expectThrow(
    "Test-Provider im Live-Modus abgelehnt",
    () =>
      mockProvider.createSession({
        paymentSessionId: "x",
        amountMinor: 100,
        currencyCode: "EUR",
        email: null,
        description: "x",
        successUrl: "http://localhost:8080/",
        cancelUrl: "http://localhost:8080/",
        environment: "live",
        idempotencyKey: "x",
      }),
    /Live/,
  );
  const { data: liveCfg } = await admin
    .from("payment_provider_configs")
    .select("provider, environment, status")
    .eq("provider", "mock")
    .neq("environment", "test");
  check("Kein Mock-Provider in Live-Umgebung konfiguriert", (liveCfg ?? []).length === 0, JSON.stringify(liveCfg));
  const { data: mockOrders } = await admin.from("orders").select("environment").eq("organization_id", s['orgA']!);
  check("Test-Orders als environment=test erkennbar", (mockOrders ?? []).every((o) => o['environment'] === "test"), JSON.stringify([...new Set((mockOrders ?? []).map((o) => o['environment']))]));
  await expectThrow(
    "Provider muss explizit aktiviert sein",
    () =>
      payments.resolveProviderId(s['orgB']!, s['shopB']!, "mock"),
    /nicht aktiv|kein Zahlungsanbieter/i,
  );

  writeFileSync("qa/e2e2-state.json", JSON.stringify({ refundTarget, cancelOrderId }, null, 2));
  summary();
  writeFileSync("qa/results-e2e2.json", JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
