# Phase 14 / Gate A5 — Commerce Health & Datenintegrität

Datum: 2026-08-26 · Ergebnis: **PASS (15/15 Harness-Checks)** · Nachweis: `qa/results-phase14-health.json`

## Lieferumfang

| Komponente | Nachweis |
|---|---|
| Zentrale Health Engine (read-only, keine Reparaturen) | DB-Funktion `public.health_run_checks(uuid)` — ausschließlich SELECTs, `SECURITY DEFINER` mit fixiertem `search_path` |
| Checks Payments/Orders | 8 Checks (payment_without_order, paid_order_without_transaction, multiple_orders_per_checkout, payment_amount_mismatch, payment_currency_mismatch, completed_cart_without_order, order_without_snapshot, order_without_number) |
| Checks Inventory | 8 Checks (negative_stock_values, negative_availability, active_reservation_without_checkout, committed_reservation_without_order, multiple_inventory_commits, movement_level_deviation, reserved_mismatch, transfer_sum_mismatch) |
| Checks Tax | 6 Checks (order_tax_mismatch, tax_snapshot_orphan, tax_snapshot_multi_order, tax_snapshot_mutable [Konfiguration], line_net_tax_gross_mismatch, order_net_tax_gross_mismatch) |
| Checks Dokumente | 7 Checks (issued_invoice_without_number, duplicate_invoice_number, invoice_order_amount_drift, invoice_internal_mismatch, document_file_without_checksum, issued_invoice_missing_pdf, credit_note_over_invoice) |
| Checks Shipping | 5 Checks (fulfillment_over_ordered, shipped_without_shipment, delivered_without_tracking, multiple_active_labels, shipment_without_reference) |
| Checks Returns | 4 Checks (return_over_ordered, multiple_restock, refund_over_order_total, completed_return_incomplete) |
| Checks Communications/Automations | 7 Checks (communication_stuck_queued, duplicate_communication, job_stuck_locked, job_over_max_retries, execution_without_final_state, loop_guard_violation, circuit_breaker_active) |
| Backoffice-Route | `/app/system/health` — Statusübersicht je Gruppe, betroffene Datensätze mit technischer Referenz (Entity-Typ, Entity-ID, Shop-ID), Schweregrad, Zeitpunkt des Laufs |
| Server Function | `runHealthChecksFn` (`health.functions.ts`, dünner Wrapper; Logik in `health.server.ts` / `health.types.ts`) |

## Zugriffsschutz (belegt)

- Service Role: Lauf erlaubt (interne Jobs, Monitoring).
- Owner Org B: eigene Org erlaubt, fremde Org A abgelehnt (`insufficient_privilege`).
- Anonym: `permission denied for function health_run_checks` (EXECUTE für `anon`/`PUBLIC` entzogen).
- Rollen: nur `owner`, `administrator`, `operations` (in der Funktion erzwungen, nicht nur im UI).

## Injektionstests (echte Verletzungen, vollständig zurückgerollt)

1. `inventory_levels.reserved` künstlich über `on_hand` gesetzt → Befunde `negative_availability` **und** `reserved_mismatch` mit korrekter Entity-ID; nach Rückrollen verschwunden.
2. Warenkorb mit Status `completed` ohne Bestellung eingefügt → Befund `completed_cart_without_order`; nach Löschung verschwunden.

## Gefundener und behobener Ist-Befund

- `invoice_order_amount_drift` (hoch) auf QA-Bestellung `ORD-000004`: Bestellung stammte aus Phase 5, **vor** der Tax-Engine; die Spalten `net_total_minor`/`tax_total_minor`/`gross_total_minor` waren mit Default `0` belegt, während `total_minor` und die Rechnung 5.480 Cent trugen.
- **Korrektur:** dokumentierte Backfill-Migration (nur Altdaten mit `tax_engine_version = 'none'` und leeren Summenfeldern): `gross = total`, `tax = tax_minor`, `net = total − tax_minor`. Retest: Baseline Org A **0 Befunde**, Org B **0 Befunde**.

## Semantik-Hinweis

`order_tax_mismatch` berücksichtigt, dass die Bestellsteuer Versandsteuer enthält, die nicht in `order_items` steht: Der Check schlägt an, wenn die Positionssteuer die Bestellsteuer übersteigt oder bei versandkostenfreien Bestellungen von ihr abweicht.

## Bekannte Grenzen

- Checks sind Momentaufnahmen ohne Historie (kein Run-Journal — bewusst keine neue Tabelle in Gate A; Monitoring-Läufe aus A8 erzeugen Aufgaben bei kritischen Befunden).
- Pro Check maximal 50 Beispiel-Datensätze (Begrenzung gegen Überlauf bei Massenbefunden).
