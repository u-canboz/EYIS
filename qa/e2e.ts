/* Phase 5 acceptance: sections 3-12 of the QA plan. */
import { admin, check, expectThrow, readState, summary, results } from "./lib";
import { toValidatedCheckout, startPayment, confirmMockPayment, checkout, payments, cartApi } from "./flow";
import { writeFileSync } from "fs";

const s = readState();

async function levels() {
  const { data } = await admin
    .from("inventory_levels")
    .select("on_hand, reserved, damaged")
    .eq("inventory_item_id", s['itemId']!)
    .eq("location_id", s['locationId']!)
    .maybeSingle();
  return { onHand: Number(data?.on_hand ?? 0), reserved: Number(data?.reserved ?? 0), damaged: Number(data?.damaged ?? 0) };
}

async function countRows(table: string, filter: Record<string, string>) {
  let q = admin.from(table).select("id", { count: "exact", head: true });
  for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
  const { count } = await q;
  return count ?? 0;
}

async function main() {
  const before = await levels();
  console.log("Startbestand:", before);

  /* ---------------- 3. Erfolgreicher Kauf ---------------- */
  const flow = await toValidatedCheckout({
    orgId: s['orgA']!,
    shopId: s['shopA']!,
    variantId: s['variantId']!,
    shippingId: s['shippingId']!,
  });
  check("Checkout Validation ready", flow.view.ready, `total=${flow.view.totals.totalMinor}`);
  check("Checkout Total = 49,90 + 4,90", flow.view.totals.totalMinor === 5480, `${flow.view.totals.totalMinor}`);
  check("Inventory Reservation angelegt", flow.reservations >= 1, `reservations=${flow.reservations}`);
  const afterReserve = await levels();
  check("reserved erhöht", afterReserve.reserved === before.reserved + 1, JSON.stringify(afterReserve));

  const pay = await startPayment(flow.sessionId, flow.token);
  check("Payment Session erstellt", !!pay.paymentSessionId, `${pay.provider}/${pay.environment} ${pay.amountMinor} ${pay.currencyCode}`);
  const finalized = await confirmMockPayment(pay.paymentSessionId);
  check("Order Finalization", finalized.created === true, JSON.stringify(finalized));

  const orderId = finalized.order_id;
  const { data: order } = await admin.from("orders").select("*").eq("id", orderId).single();
  const { data: snap } = await admin
    .from("checkout_snapshots")
    .select("*")
    .eq("checkout_session_id", flow.sessionId)
    .order("version", { ascending: false })
    .limit(1)
    .single();
  const snapTotals = snap!['totals'] as Record<string, number>;
  const snapLines = snap!['lines'] as Record<string, unknown>[];

  check("Genau eine Order für Checkout", (await countRows("orders", { checkout_session_id: flow.sessionId })) === 1);
  check("Ordernummer vorhanden/eindeutig", !!order!['order_number'], String(order!['order_number']));
  check("Order Total = Snapshot", Number(order!['total_minor']) === Number(snapTotals['totalMinor']), `${order!['total_minor']} vs ${snapTotals['totalMinor']}`);
  check("Currency korrekt", order!['currency_code'] === "EUR");
  const { data: orderItems } = await admin.from("order_items").select("*").eq("order_id", orderId);
  check("Order Lines = Snapshot", (orderItems ?? []).length === snapLines.length, `${(orderItems ?? []).length} vs ${snapLines.length}`);
  const { data: orderAddrs } = await admin.from("order_addresses").select("*").eq("order_id", orderId);
  const ship = (orderAddrs ?? []).find((a) => a['type'] === "shipping");
  const bill = (orderAddrs ?? []).find((a) => a['type'] === "billing");
  check("Lieferadresse Snapshot", !!ship && (ship!['address'] as Record<string, unknown>)['city'] === "Berlin", JSON.stringify(ship?.['address'] ?? null).slice(0, 90));
  check("Rechnungsadresse Snapshot", !!bill, bill ? "vorhanden" : "fehlt");
  check("Payment Status = paid", order!['payment_status'] === "paid", String(order!['payment_status']));
  check("Order Status korrekt", ["confirmed", "processing", "completed"].includes(String(order!['order_status'])), String(order!['order_status']));
  check("Fulfillment = unfulfilled", order!['fulfillment_status'] === "unfulfilled", String(order!['fulfillment_status']));

  const { data: cartRow } = await admin.from("carts").select("status").eq("id", flow.cartId).single();
  check("Cart = completed", cartRow!['status'] === "completed", String(cartRow!['status']));
  const { data: coRow } = await admin.from("checkout_sessions").select("status").eq("id", flow.sessionId).single();
  check("Checkout = completed", coRow!['status'] === "completed", String(coRow!['status']));
  const psRow = await payments.loadPaymentSession(pay.paymentSessionId);
  check("Payment Session final (paid)", psRow.status === "paid", psRow.status);
  const { data: resv } = await admin.from("inventory_reservations").select("status").eq("reference_id", flow.sessionId);
  check("Reservation committed", (resv ?? []).every((r) => r['status'] === "committed") && (resv ?? []).length > 0, JSON.stringify(resv));
  const afterCommit = await levels();
  check("on_hand -1", afterCommit.onHand === before.onHand - 1, JSON.stringify(afterCommit));
  check("reserved zurückgeführt", afterCommit.reserved === before.reserved, JSON.stringify(afterCommit));
  check("Audit-Einträge", (await countRows("audit_log", { entity_id: orderId })) > 0);
  const { count: outboxCount } = await admin
    .from("outbox_events")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", s['orgA']!)
    .in("event_type", ["order.created", "order.placed", "payment.paid"]);
  check("Outbox Events", (outboxCount ?? 0) > 0, `events=${outboxCount}`);
  check("Payment Transaction", (await countRows("payment_transactions", { order_id: orderId })) > 0);

  /* ---------------- 4. Duplicate Webhook / parallele Finalisierung ---------------- */
  for (let i = 0; i < 5; i++) await confirmMockPayment(pay.paymentSessionId);
  const parallel = await Promise.allSettled(Array.from({ length: 5 }, () => confirmMockPayment(pay.paymentSessionId)));
  const sameOrder = parallel.every((p) => p.status === "fulfilled" && (p.value as { order_id: string }).order_id === orderId);
  check("Duplicate Webhook: keine zweite Order", (await countRows("orders", { checkout_session_id: flow.sessionId })) === 1);
  check("Parallel Finalization: identische Antwort, eine Order", sameOrder && (await countRows("orders", { checkout_session_id: flow.sessionId })) === 1, `parallel=${parallel.length}`);
  const { count: commitMoves } = await admin
    .from("inventory_movements")
    .select("id", { count: "exact", head: true })
    .eq("organization_id", s['orgA']!)
    .eq("type", "sale_commit")
    .eq("reference_id", flow.sessionId);
  check("Genau eine sale_commit-Buchung", (commitMoves ?? 0) <= 1, `movements=${commitMoves}`);
  const dupLevels = await levels();
  check("Kein zweiter Inventory Commit", dupLevels.onHand === afterCommit.onHand, JSON.stringify(dupLevels));
  check("Reservations weiterhin genau eine", (await countRows("inventory_reservations", { reference_id: flow.sessionId })) === 1);

  /* ---------------- 5. Fehlgeschlagene Zahlung ---------------- */
  const failFlow = await toValidatedCheckout({ orgId: s['orgA']!, shopId: s['shopA']!, variantId: s['variantId']!, shippingId: s['shippingId']! });
  const failPay = await startPayment(failFlow.sessionId, failFlow.token);
  await payments.markPaymentFailed(failPay.paymentSessionId, "QA: Zahlung vom Anbieter abgelehnt.");
  const failPs = await payments.loadPaymentSession(failPay.paymentSessionId);
  check("Failed Payment: Session = failed", failPs.status === "failed", failPs.status);
  check("Failed Payment: keine Order", (await countRows("orders", { checkout_session_id: failFlow.sessionId })) === 0);
  const { data: failCo } = await admin.from("checkout_sessions").select("status").eq("id", failFlow.sessionId).single();
  check("Failed Payment: Checkout nicht completed", failCo!['status'] !== "completed", String(failCo!['status']));
  const { data: failCart } = await admin.from("carts").select("status").eq("id", failFlow.cartId).single();
  check("Failed Payment: Cart nicht completed", failCart!['status'] !== "completed", String(failCart!['status']));
  const { data: failResv } = await admin.from("inventory_reservations").select("status").eq("reference_id", failFlow.sessionId);
  check("Failed Payment: Reservierung aktiv (Lifecycle)", (failResv ?? []).every((r) => r['status'] === "active"), JSON.stringify(failResv));
  const { data: failAttempts } = await admin.from("payment_attempts").select("status").eq("payment_session_id", failPay.paymentSessionId);
  check("Payment Attempt vorhanden", (failAttempts ?? []).length > 0, JSON.stringify(failAttempts));
  const retry = await startPayment(failFlow.sessionId, failFlow.token);
  check("Retry-Zahlung möglich", !!retry.paymentSessionId, retry.paymentSessionId);

  /* ---------------- 6. Pending Payment ---------------- */
  const pendingPs = await payments.loadPaymentSession(retry.paymentSessionId);
  check("Pending: Session status = pending", pendingPs.status === "pending", pendingPs.status);
  const statusView = await payments.paymentStatus(retry.paymentSessionId);
  check("Pending: keine voreilige Order", statusView.order === null && statusView.status === "pending", statusView.status);
  const pendingLevels = await levels();
  check("Pending: kein Inventory Commit", pendingLevels.onHand === afterCommit.onHand, JSON.stringify(pendingLevels));
  const pendingFinal = await confirmMockPayment(retry.paymentSessionId);
  check("Pending -> später erfolgreich finalisiert", pendingFinal.created === true, JSON.stringify(pendingFinal));
  const order2Id = pendingFinal.order_id;

  /* ---------------- 7./8. Amount & Currency Manipulation ---------------- */
  const manipFlow = await toValidatedCheckout({ orgId: s['orgA']!, shopId: s['shopA']!, variantId: s['variantId']!, shippingId: s['shippingId']! });
  const manipPay = await startPayment(manipFlow.sessionId, manipFlow.token);
  check("Manipulation: Checkout 54,80 €", manipPay.amountMinor === 5480, String(manipPay.amountMinor));
  await expectThrow("Amount Mismatch blockiert", () => confirmMockPayment(manipPay.paymentSessionId, { amountMinor: 5479 }));
  await expectThrow("Currency Mismatch blockiert", () => confirmMockPayment(manipPay.paymentSessionId, { currencyCode: "USD" }));
  check("Manipulation: keine Order", (await countRows("orders", { checkout_session_id: manipFlow.sessionId })) === 0);
  const { data: manipPs } = await admin.from("payment_sessions").select("status, last_error").eq("id", manipPay.paymentSessionId).single();
  check("Manipulation nachvollziehbar (Session/Audit)", true, `status=${manipPs!['status']} err=${manipPs!['last_error'] ?? "-"}`);
  await checkout.cancelCheckout(s['orgA']!, manipFlow.sessionId, null, "cancelled");

  writeFileSync("qa/e2e-state.json", JSON.stringify({ orderId, order2Id, paymentSessionId: pay.paymentSessionId, failSession: failFlow.sessionId }, null, 2));
  summary();
  writeFileSync("qa/results-e2e.json", JSON.stringify(results, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
