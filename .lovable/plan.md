# Phase 9 — Customer Portal & Returns Engine

Käufer erledigen ihre Anliegen selbst: Bestellungen, Tracking, Dokumente, Adressen, Retouren.
Retouren sind ein eigener Prozess, kein Flag:
Order-Snapshot → Return Request → Approval → Wareneingang → Prüfung → Restock (Phase 3) → Refund (Phase 5) → Gutschrift (Phase 8).

## Verbindliche Abgrenzungen

- Refunds ausschließlich `refund_create` / `refund_settle` (Phase 5). Gutschriften ausschließlich `credit_note_create` / `credit_note_issue` (Phase 8) mit `_refund`-Verknüpfung.
- Restock ausschließlich über `inv_movement`/Inventory-RPCs mit dem bereits existierenden Bewegungstyp `return`; nie direkt auf `inventory_levels`.
- Rücksendungen nutzen das Phase-7-Shipment-Modell, erweitert um `shipment_direction` (`outbound` | `return`) — keine zweite Versandengine. Return-Labels nur bei echter Provider-Capability `supportsReturnLabels`, sonst textuelle Rücksendeanweisung. Keine Fake-Labels.
- Tracking-Anzeige liest ausschließlich Phase-7-Daten.
- Refund-Beträge kommen aus `order_items` (`line_total_minor`, `line_discount_minor`, `net/tax/gross_minor`) und dem `tax_snapshot` der Bestellung — nie aus aktuellen Preisen oder der Tax Engine.

## Datenmodell (neu)

`customers` (org, shop, `auth_user_id` nullable, E-Mail, Name, Telefon, `status` active/blocked/guest/archived, `customer_type`, Default-Adressen, metadata) — Unique `(shop_id, lower(email))`, Unique `(shop_id, auth_user_id)`.
`customer_addresses` (shipping/billing/both, `is_default`) — reine Stammdaten, historische Order-Adressen bleiben unberührt.
`customer_group_members` (customer_id, customer_group_id) — verbindet Phase-2-Gruppen real.
`customer_notes` (intern, nie im Portal sichtbar).
`guest_order_access_tokens` (order_id, `token_hash`, expires_at, used_at, revoked_at) — Rohtoken aus 32 zufälligen Bytes (256 Bit, CSPRNG, base64url), niemals UUID; gespeichert wird nur der SHA-256-Hash, der Rohtoken wird genau einmal zurückgegeben.
`returns` (return_number, status, reason_category, customer_note/internal_note, Zeitstempel je Statuswechsel, `refund_id`, `credit_note_id`, `return_shipment_id`).
`return_items` (order_item_id, quantity_requested/received/approved, reason_code, condition, resolution, restock_decision, refund_amount_minor, metadata).
`return_settings` (returns_enabled, default_return_window_days, approval_strategy, customer_pays_return_shipping, auto_refund_on_approval, auto_restock, instructions).
`return_media` (optional, Fotos über bestehendes `media_assets`/geschützten Pfad, Typ- und Größenlimit).
Ergänzungen: `orders.customer_id` → FK auf `customers`; `products.return_policy_type` (standard/non_returnable/custom); Enums für Return-Status, Grund, Zustand, Restock-Entscheidung, Shipment-Richtung.
Alle Tabellen: GRANTs, RLS, `updated_at`-Trigger, Indizes auf org/shop/customer/order/status.

## Auth- und Zugriffstrennung

Ein Auth-User kann Kunde und/oder Backoffice-Mitglied sein — die Rollen bleiben strikt getrennt: Kundenrechte kommen ausschließlich aus `customers.auth_user_id`, Adminrechte ausschließlich aus `memberships`. Registrierung im Portal legt nie eine Membership an.

Drei Zugriffswege:
1. **Admin** — `requireSupabaseAuth` + `has_permission`, wie bisher.
2. **Customer** — Serverfunktionen unter `portal.*`, die den Auth-User auf genau einen `customers`-Datensatz auflösen und jede Abfrage auf `customer_id` einschränken; E-Mail-Gleichheit ist nie Autorisierung.
3. **Gast** — nur Server-Funktion mit `orderId` + Rohtoken; Hash-Vergleich, Ablauf/Widerruf/Shop geprüft, genau eine Order lesbar.

RLS: keine Tabelle wird für `anon` lesbar. Kundenportal-Reads laufen serverseitig über geprüfte Funktionen; zusätzlich Customer-Policies (`auth_user_id = auth.uid()`) für eigene Stammdaten. Dokument-PDFs nur über eine kontrollierte Serverfunktion, die Besitz prüft und dann eine kurzlebige signierte URL erzeugt.

## Return State Machine

`requested → authorized | rejected → in_transit → received → inspection → approved | partially_approved → refunded → completed`, `cancelled` bis `received`.
Alle Übergänge über `SECURITY DEFINER`-RPCs mit Row-Lock und Idempotenzschlüssel (Muster wie Phase 3/5/7): `ret_request`, `ret_authorize`, `ret_reject`, `ret_mark_in_transit`, `ret_receive`, `ret_inspect`, `ret_approve`, `ret_restock`, `ret_refund`, `ret_complete`, `ret_cancel`.

**Mengenregel (atomar):** je `order_item` gilt `Σ wirksame Retourenmengen ≤ bestellte Menge`. Prüfung unter `FOR UPDATE`-Lock auf Order-Item-Ebene innerhalb der Transaktion → zwei parallele Anträge auf dieselbe Restmenge: genau einer gewinnt. Teilretouren (3× Hoodie → 1, später 2, dritte Rückgabe abgelehnt) folgen daraus.
**Nummernkreis:** `RMA-YYYY-000001` über die vorhandene Sequenzmechanik, concurrency-sicher, nie DB-ID.
**Doppelte Anträge technisch ausgeschlossen:** `returns.idempotency_key NOT NULL` mit Unique `(organization_id, idempotency_key)` — ein wiederholter Submit liefert dieselbe RMA zurück statt einer zweiten. Zusätzlich ein partieller Unique-Index, der pro Order nur eine offene Retoure je Client-Request-Key zulässt; die Datenbank, nicht die Anwendungslogik, ist die Absicherung.

## Eligibility

`checkReturnEligibility(orderId, items)` serverseitig, ein Ergebnis pro Position mit klartextlichem Grund (keine Error-Codes im UI): Besitz, Zahlungsstatus, Versand/Zustellung, Return-Window (Start: `delivery_date` aus Tracking, Fallback `shipping_date`, dann `order_date`), Restmenge, `return_policy_type`, Shop-Setting `returns_enabled`.

## Refund, Steuer, Gutschrift

Pro genehmigter Menge wird der historische anteilige Betrag berechnet: `line_total_minor` (nach Rabatt) anteilig zur Menge, Steuer aus `tax_minor`/`tax_rate_basis_points` derselben Position, abzüglich bereits erstatteter Beträge; Rundungsdifferenzen landen auf der letzten Position. Versandkosten-Erstattung ist explizit: `none | full | partial | manual`, Default `none`.
Dann `refund_create` (Phase 5), bei Erfolg optional `credit_note_create` + `credit_note_issue` (Phase 8) mit `refund_id`-Verknüpfung. Return speichert `refund_id` und `credit_note_id`.

## Restock

Pro Position `restock | do_not_restock | manual_review`. Bei `restock` muss ein Lagerort gewählt werden (kein automatisches Zurückbuchen). Buchung als Bewegung `return` mit Idempotenzschlüssel `return_item:<id>` → doppelte Verarbeitung erhöht den Bestand genau einmal. Defekte Ware: `do_not_restock` oder bestehende `damage`-Logik.

## Kundenportal (mobile-first)

`/konto/registrieren`, `/konto/anmelden`, `/konto` (Dashboard mit letzter Bestellung, offenen Retouren, Rechnungen, Adressen — eine klare nächste Aktion), `/konto/bestellungen`, `/konto/bestellungen/$orderId` (Status, Positionen, Zahlung, Versand + Tracking-Stufen, Rechnungen, Gutschriften, Retouren, Adressen), `/konto/bestellungen/$orderId/retoure` (6-Schritt-Wizard), `/konto/adressen`, `/konto/profil`, `/konto/bestellung/$token` (Gastzugriff).
Order-Cards statt Tabellen, Touch-Ziele ≥ 44 px, Labels und Fehlertexte an Feldern, Fokusführung pro Wizard-Schritt, Status immer mit Text (nicht nur Farbe).
Account Linking: nach verifizierter E-Mail kann der Kunde Bestellungen desselben Shops übernehmen, sofern sie noch keinem Customer gehören — nie automatisch durch bloße E-Mail-Eingabe.

## Backoffice

`/app/retouren` mit Arbeitslisten (Neu, Genehmigt, Unterwegs, Eingegangen, Prüfung, Erstattung, Abgeschlossen, Probleme); `/app/retouren/$returnId` als Workspace mit „Nächste Aktion" (genau ein primärer Button je Zustand), Wareneingang pro Position (nie automatisch alles), Inspektion (Menge, Zustand, genehmigte Menge, Restock, Kommentar), Refund-/Gutschrift-Block, Timeline in Klartext.
`/app/kunden` (Name, E-Mail, Bestellungen, Umsatz serverseitig aggregiert, letzte Bestellung, Status) und `/app/kunden/$customerId` (Profil, Bestellungen, Adressen, Retouren, Dokumente, interne Notizen, Timeline, Blockieren, Gruppenzuordnung).
Dashboard-Attention: Anträge zu prüfen, eingegangene Retouren, offene Erstattungen. Einstellungen: Retouren-Policy je Shop.

## Cart & Pricing Integration

Beim Kundenlogin: Gast-Cart und Kunden-Cart mergen (gleiche Variante = Mengen addieren, gegen Bestand geprüft), danach Repricing über die bestehende Engine. Pricing-Context erhält `customerId` + `customerGroupIds`, wodurch Phase-2-Kundengruppenpreise produktiv werden.

## SDK & Events

`src/lib/commerce/customers/`, `returns/`, `customer-portal/` je mit `*.types.ts`, `*.server.ts`, `*.functions.ts` — analog zur bestehenden Struktur.
Outbox: `return.requested|authorized|rejected|in_transit|received|inspection_started|approved|partially_approved|refund_requested|refunded|completed|cancelled`, `customer.created|updated|blocked|address.created|address.updated|order_claimed`.
Audit (nur Admin-Aktionen): `return.authorized|rejected|received|inspected|restocked`, `customer.updated_by_admin|blocked|group_changed`.
Neue Permissions: `customers.read/manage/block`, `returns.read/manage/approve/inspect/restock`, `customer_groups.assign` — Rollenzuordnung wie in der Vorgabe.
Datenschutz: keine personenbezogenen Daten in Logs, Outbox-Payloads oder URLs; Magic Links enthalten nur Zufallstoken. Anonymisierbarkeit später möglich, ohne Order-/Invoice-Snapshots zu zerstören.

## Tests / Definition of Done

QA-Harness `qa/phase9.ts` analog Phase 7/8: Customer-Isolation A↔B (Order, Dokument, Return, Adresse, Tracking, auch direkte Requests); Gasttoken gültig/falsch/abgelaufen/widerrufen/fremder Shop; Teilretoure 1 + 2, dritte abgelehnt; Restock genau einmal; do_not_restock ohne Bestandsänderung; Refund auf historischen 49,90 € statt 69,90 €; rabattierte Bestellung → 80-€-Basis; Tax aus Original-Snapshot; doppelter Submit mit Idempotency → eine Retoure; zwei parallele Anträge → keine Überretoure; Kundengruppenpreis nach Zuordnung/Entfernung; Cart Merge nach Login; Mobile-Check des Portals. Build, Typecheck und die bestehenden Tests der Phasen 0–8 bleiben grün.
