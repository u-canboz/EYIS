# Phase 7 — Shipping, Fulfillment & Tracking Engine

Aus einer bezahlten Bestellung wird ein operativ abarbeitbarer Versandprozess:
Order → Fulfillment → Package → Shipment → Carrier → Label → Tracking → Delivered.
Keine zweite Bestandslogik, keine Rechnungen, kein Retourenprozess.

## Abgrenzungen (verbindlich)

- **Inventory-Grenze:** Bestand wurde bei `order_finalize_from_payment` bereits committed. Fulfillment, Packing, Shipment und Fulfillment-Storno buchen **keinen** Bestand. Restocking entscheidet Phase 9.
- **Shipping Method vs. Carrier:** Die Phase-4-Versandart (Kundenauswahl, Preis) bleibt unverändert bestehen. Carrier/Service ist eine separate operative Entscheidung; optionales Mapping Versandart → bevorzugter Provider/Service, jederzeit überschreibbar.
- **Order-Grenze:** Fulfillment ändert nur `fulfillment_status` der Order (abgeleitet, nie manuell), niemals Beträge, Zahlungs- oder Steuerdaten.
- **Adresse:** Carrier bekommt ausschließlich den unveränderlichen `order_addresses`-Shipping-Snapshot.

## Datenmodell (neue Tabellen)

`fulfillments`, `fulfillment_items`, `packages`, `package_items`, `shipping_provider_configs`,
`shipments`, `shipping_labels`, `tracking_events`, `package_presets` — Felder wie in der Vorgabe.

Zusätzlich:
- Enums: `fulfillment_state` (draft, ready, picking, packed, shipped, delivered, cancelled), `package_status`, `shipment_status` (created, label_created, in_transit, out_for_delivery, delivered, exception, cancelled), `tracking_status` (pre_transit, in_transit, out_for_delivery, delivered, exception, returned, cancelled, unknown).
- `shipments`: `carrier_cost_minor`, `currency_code`, `last_error`, `idempotency_key`.
- `tracking_events`: append-only Trigger (UPDATE/DELETE verboten, analog `inventory_movements`), Unique auf `(shipment_id, provider_event_id)` sowie Fallback-Hash für Provider ohne Event-ID.
- Unique-Constraints gegen Doppel-Labels: ein aktives Label pro Shipment (`voided_at IS NULL`), ein aktives Shipment pro Package.
- Indizes auf allen in Punkt 67 genannten Spalten.
- Storage-Bucket `shipping-labels` (privat) mit org-scoped Policies; Labels nie als Base64 in Tabellen.

## Zustandslogik

**Fulfillment:** draft → ready → picking → packed → shipped → delivered; cancel nur vor `shipped`.
Übergänge ausschließlich über SQL-Funktionen mit Row-Lock und Idempotenzschlüssel.

**Mengen-Invarianten:** `picked ≤ quantity`, `packed ≤ picked`, `shipped ≤ packed`, und je `order_item` gilt: Summe über alle nicht stornierten Fulfillments ≤ bestellte Menge (per Trigger geprüft).

**Order-Status abgeleitet:** 0 versendet → `unfulfilled`, teilweise → `partially_fulfilled`, alles → `fulfilled`. Neuberechnung nach jedem Shipment/Delivery.

**Shipment/Tracking (out-of-order-sicher):** Jeder normalisierte Status hat einen Rang. Ein eintreffendes Tracking-Event wird **immer** historisch gespeichert, aktualisiert den Shipment-Status aber nur, wenn sein Rang höher ist. `delivered`, `cancelled`, `returned` sind terminal; ein verspätetes `in_transit` setzt nichts zurück. `exception` ist ein Seitenzustand und blockiert spätere Fortschritte nicht.

## Allocation

`suggestFulfillmentAllocation(orderId)`: pro Order-Item Standorte mit vollständiger Verfügbarkeit bevorzugen, dann Location-Priority (Phase 3), Splits minimieren. Ergebnis ist ein Vorschlag — die finale Standortwahl ist manuell.

## Carrier-Abstraktion

`src/lib/commerce/shipping/provider.ts` definiert `CarrierProvider` (`getRates`, `createShipment`, `createLabel`, `cancelShipment`, `getTracking`, optional `parseTrackingWebhook`) plus `capabilities` (`supportsRates`, `supportsLabels`, `supportsCancellation`, `supportsTracking`, `supportsTrackingWebhook`, `supportsMultiPackage`). `registry.ts` löst Provider anhand `shipping_provider_configs.provider` auf.

V1: **Mock/Test-Provider vollständig** mit Szenarien label_success, provider_failure, in_transit, out_for_delivery, delivered, exception, returned — nur bei `test_mode = true` nutzbar. Echte Carrier (DHL/DPD/GLS/UPS/Sendcloud) bekommen Verzeichnisse und Stubs, werden aber erst mit echten Zugangsdaten angebunden. Keine erfundenen Raten: Rate-Shopping-UI zeigt nur echte Providerdaten, sonst einen Hinweis.

**Fehlerfall:** Provider-Timeout erzeugt kein Fake-Label; Shipment bleibt `created`, Fehler wird als `shipping_exception` (provider_unavailable, invalid_address, invalid_dimensions, label_generation_failed, tracking_unknown) gespeichert und ist retry-fähig — der Idempotenzschlüssel verhindert Doppelsendungen.

## Server-Layer

```
src/lib/commerce/fulfillment/{fulfillment.types,fulfillment.server,fulfillment.functions}.ts
src/lib/commerce/shipping/{shipping.types,shipping.server,shipping.functions,provider,registry}.ts + providers/
src/lib/commerce/tracking/{tracking.types,tracking.server,tracking.functions}.ts
```

Idempotent (Key-basiert, wie Phase 3/5): `createFulfillment`, `startPicking`, `completePicking`, `packFulfillment`, `createShipment`, `createLabel`, `cancelShipment`, `processTrackingWebhook`, `completeDelivery`.
Zusätzlich: `suggestFulfillmentAllocation`, `refreshTracking`, `getFulfillmentQueue`, `getOrderTracking(orderId)` (sichere Projektion für ein späteres Kundenportal, noch nicht öffentlich).
Carrier-Webhook als öffentliche Route `src/routes/api/public/webhooks/carrier/$provider.ts` mit Signaturprüfung, Deduplizierung und Outbox-Event. Secrets nur serverseitig.

## Berechtigungen

Neu: `fulfillment.read/manage/pick/pack`, `shipping.read/manage/create_label/cancel`, `tracking.read`, `shipping_settings.read/manage`.
Rollenzuordnung: fulfillment = alle operativen Rechte; operations = read/manage; customer_support = read + tracking; finance = read; catalog_manager = keine operativen Aktionen; read_only = read. Alle neuen Tabellen mit GRANTs, RLS und `is_org_member`-Policies.

## UI

- `/app/versand` wird zum **Fulfillment-Workspace**: Arbeitsliste „Heute zu bearbeiten" + Queue-Tabs (Neu, Picking, Packing, Versandbereit, Versendet, Probleme) mit Filtern (Lager, Versandart, Carrier, Datum, Ordernummer). Aggregiert geladen, kein N+1.
- Die heutige Versandarten-Verwaltung zieht nach `/app/einstellungen/versand` (Tabs: Versandarten, Carrier, Lagerzuordnung, Paketvorlagen) — integriert, nicht dupliziert.
- `/app/fulfillment/picking/$fulfillmentId`: Pickliste mit Start/Abhaken/Abschluss.
- Packing-Ansicht: Pakete anlegen, Positionen zuordnen, Gewicht/Maße/Verpackungstyp (Vorlagen), interne Notiz.
- Bestelldetail bekommt Tab **Versand**: Fulfillments, Pakete, Carrier, Tracking, Label-Download, Timeline in Klartext, plus **Nächste Aktion** mit genau einem Button.
- Dashboard: Attention-Items (zu verpacken, Labels offen, Versandprobleme).
- UI kennt keine Carrier-Namen in der Logik — Aktionen werden über `capabilities` ein-/ausgeblendet.

## Events

Outbox: `fulfillment.created|picking_started|packed|cancelled`, `shipment.created|label_created|shipped|in_transit|out_for_delivery|delivered|exception|cancelled`, `tracking.updated`.
Audit: `fulfillment.created|updated|cancelled`, `package.created|updated`, `shipment.created|cancelled`, `shipping.label.created`, `shipping.provider.configured`. Provider-Tracking-Updates werden nicht als Nutzer-Audit geführt.

## Tests / Definition of Done

QA-Harness (`qa/`) analog Phase 5, zusätzlich Unit-Tests für State-Machine und Statusnormalisierung:
Happy Path Paid → delivered; Teilversand 2+1 → partially_fulfilled → fulfilled; Multi-Package mit zwei Trackingnummern; Multi-Location mit zwei Fulfillments; 10 parallele `createLabel` → genau ein aktives Label; fünffaches identisches Tracking-Event → ein fachliches Event; out-of-order delivered→in_transit ohne Rückschritt; Provider-Failure + Retry ohne Doppelsendung; Shipment-Storno mit Label-Void; RLS/Storage-Isolation Org A ↔ Org B; Überversand-Versuch abgelehnt. Build, Typecheck und bestehende 55 Tests bleiben grün.

## Bewusst verschoben

Pick Lists / Batch Picking werden als Datenmodell **nicht halb** gebaut: das Fulfillment-Item-Modell lässt sie zu, die Tabellen `pick_lists`/`pick_list_items` und die Batch-UI kommen als Phase 7.1. Ebenso: Rechnungen, Retouren, Kundenportal, echte Carrier ohne Credentials.
