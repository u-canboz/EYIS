# Phase 3: Inventory & Stock Engine

Eine einzige, serverseitige Bestands-Engine. Bestand entsteht ausschließlich aus Bewegungen, nie aus einem frei editierbaren Feld. Keine Bestandslogik in React, keine direkten Writes auf Bestandstabellen.

## Fachliche Definition (zentral, überall gleich)

```text
physical_on_hand = on_hand              (inkl. beschädigter Ware)
sellable_on_hand = on_hand - damaged
available        = sellable_on_hand - reserved
incoming         = erwartet, nie verfügbar
```

`available` wird nie gespeichert, immer berechnet — in der DB-Funktion und in der UI aus denselben Feldern.

## 1. Datenmodell (Migration)

Neue Tabellen, alle mit `organization_id`, RLS, GRANTs, `updated_at`-Trigger nach bestehendem Muster:

- `inventory_locations` — name, code, type (`warehouse|store|fulfillment_center|virtual`), status, address (jsonb), priority, metadata
- `inventory_items` — variant_id (unique), sku, barcode, track_inventory, allow_backorder, metadata
- `inventory_levels` — inventory_item_id + location_id (unique), on_hand, reserved, incoming, damaged; CHECK auf `>= 0` für reserved/damaged/incoming
- `inventory_movements` — append-only Journal (Trigger blockiert UPDATE/DELETE wie beim `audit_log`), movement_type-Enum, quantity_delta, reference_type/-id, reason, note, actor_user_id, idempotency_key, metadata
- `inventory_reservations` — quantity, status (`active|released|committed|expired`), reference_type/-id, expires_at, idempotency_key, released_at, committed_at
- `inventory_transfers` + `inventory_transfer_items` — status `draft|in_transit|completed|cancelled`
- `stock_alert_rules` — optional item-/location-bezogen, threshold, enabled

Indizes auf organization_id, shop_id, inventory_item_id, location_id, variant_id, status, expires_at, created_at, sku, barcode.

Movement-Typen: initial_stock, receipt, adjustment, reservation, reservation_release, sale_commit, return, transfer_out, transfer_in, damage, correction.

Produkte ohne Varianten: die Engine legt beim ersten Bestands-Setup serverseitig eine Standard-Variante an (Phase 1 erzeugt heute keine), damit jedes verkaufbare Objekt genau ein Inventory Item besitzt.

## 2. Atomarität — Postgres-Funktionen sind die Wahrheit

Der JS-Client kennt keine Transaktionen, deshalb wird jede bestandsverändernde Operation als eine `SECURITY DEFINER` Postgres-Funktion umgesetzt. Innerhalb einer Funktion passiert alles in einer Transaktion mit `SELECT ... FOR UPDATE` auf der Level-Zeile:

Level-Mutation + Movement + ggf. Reservation + Audit + Outbox + Idempotency-Eintrag — oder vollständiger Rollback.

DB-Funktionen:
`inv_receive_stock`, `inv_adjust_stock`, `inv_mark_damaged`, `inv_reserve_stock`, `inv_release_reservation`, `inv_commit_reservation`, `inv_expire_reservations`, `inv_transfer_start`, `inv_transfer_complete`, `inv_transfer_cancel`, `inv_health_check`.

Jede prüft zuerst `has_permission(auth.uid(), org, ...)`, Org-/Shop-Zugehörigkeit aller referenzierten IDs (Cross-Tenant-Schutz auch bei Service-Role-Aufruf) und den Idempotency-Key in `idempotency_keys`; bei Treffer wird das gespeicherte Ergebnis unverändert zurückgegeben.

Reservierung (der kritische Pfad): Zeile sperren, `available` neu aus der gesperrten Zeile berechnen, erst dann entscheiden. Kein Read-Check-Write im Anwendungscode. Bei 100 parallelen Anfragen auf `available = 1` gewinnt genau eine.

Backorder: bei `allow_backorder = true` liefert die Funktion `{ available_now, backordered_quantity }` und reserviert die volle Menge; bei `false` wird abgelehnt. `track_inventory = false` → unbegrenzt verfügbar, keine Level-Mutation, Reservierung als „untracked“ protokolliert.

Transfer: Start bucht `transfer_out` an der Quelle (Menge verlässt sofort die Verfügbarkeit), Abschluss bucht `transfer_in` am Ziel. In `in_transit` ist die Menge nirgends verkaufbar.

## 3. SDK-Schicht

Passend zur bestehenden Struktur in `src/lib/commerce/`:

- `inventory.types.ts` — geteilte Typen (Level, Availability, Movement, Reservation, Transfer)
- `inventory.validation.ts` — Eingabeprüfung, Mengen, Gründe
- `inventory.server.ts` — einziger Zugriffspunkt: `getInventory`, `getInventoryForVariant`, `getAvailability`, `getMovementHistory`, `receiveStock`, `adjustStock`, `markDamaged`, `reserveStock`, `releaseReservation`, `commitReservation`, `expireReservations`, `transferStock`, `inventoryHealth` — jede Mutation ruft nur die zugehörige DB-Funktion auf
- `inventory.functions.ts` — dünne `createServerFn`-Wrapper mit `requireSupabaseAuth`
- `__tests__/inventory.test.ts` — Engine-/Regel-Tests
- Ergänzung von `ACTION_LABELS` in `roles.ts` um die neuen Audit-Aktionen

Bestandsübersichten laden serverseitig aggregiert (ein Join-Query pro Seite, kein N+1).

## 4. Permissions & RLS

Neue Permissions: `inventory.read`, `inventory.adjust`, `inventory.receive`, `inventory.transfer`, `inventory.manage_locations`, `inventory.manage_settings` — verteilt wie beschrieben (owner/administrator alles; operations read/adjust/receive/transfer; catalog_manager read + manage_settings; fulfillment read/receive/transfer; support/finance/read_only nur read; marketing read).

RLS auf allen neuen Tabellen über die bestehenden Helfer `is_org_member`, `has_permission`, `shop_in_org`. Movements und committed Reservations sind per Policy und Trigger schreibgeschützt.

## 5. UI

- `/app/lager` — Bestandsübersicht: Produkt, Variante, SKU, physisch, reserviert, verfügbar, beschädigt, erwartet, Status. Filter nach Lagerort, Kategorie, Produkt, SKU, niedrig, ausverkauft, Backorder, Tracking aus. Bulk: Wareneingang, Korrektur, Transfer, Tracking/Backorder umschalten
- `/app/lager/wareneingang` — Wizard: Lager → Artikel suchen → Mengen → Referenz/Notiz → Bestätigung mit Vorschau der Buchung
- `/app/lager/bewegungen` — unveränderbares Journal mit Filtern
- `/app/lager/transfers` — Quelle, Ziel, Artikel, Mengen, Start/Abschluss
- `/app/lager/lagerorte` — Lagerorte inkl. Priorität
- Produkteditor: neuer Tab „Bestand“ pro Variante (SKU, Tracking, Backorder, Bestände je Lagerort, Aktionen)
- Dashboard: Aufmerksamkeitspunkt „X Varianten mit niedrigem Bestand“
- Navigation um „Lager“ erweitert

Sprache in der UI: „Physischer Bestand“, „Reserviert“, „Verfügbar“, „Beschädigt“, „Erwartet“. Jede Aktion zeigt vorher die Konsequenz (Aktuell 47 → gezählt 44 → Buchung −3, Grund erforderlich).

## 6. Events

Outbox: `inventory.stock.received|adjusted|damaged`, `inventory.reservation.created|released|committed|expired`, `inventory.transfer.started|completed`, `inventory.low_stock`, `inventory.out_of_stock`, `inventory.back_in_stock` — Statuswechsel-Events nur beim tatsächlichen Übergang, ermittelt in der DB-Funktion aus Vorher/Nachher.

Audit: `inventory.received|adjusted|damaged|settings.updated`, `inventory.reservation.*`, `inventory.location.created|updated`, `inventory.transfer.created|completed|cancelled`.

## 7. Tests

- Engine-Regeln: Wareneingang, Korrektur, Damage, Reserve, Release, Commit, Backorder, Tracking aus, Idempotency-Wiederholung
- Concurrency: 100 parallele Reservierungen auf `available = 1` gegen die echte DB-Funktion → genau 1 Erfolg
- Cross-Tenant: Lesen und Schreiben über Org-Grenzen blockiert
- Regression: Phase 0–2 unverändert, Build und Typecheck sauber

## Nicht Teil von Phase 3

Cart, Checkout, Orders, Payments, Customer Portal, Fulfillment-Orders, Versandlabels, Rechnungen, Einkauf/Lieferanten, Forecasting, Storefront — auch nicht als Attrappe. Cron für Ablauf kommt später; `expireReservations()` ist in Phase 3 manuell auslösbar.
