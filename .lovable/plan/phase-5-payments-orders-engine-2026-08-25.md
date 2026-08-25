# Phase 5 — Payments & Orders Engine

Aus einer validierten Checkout-Session wird erstmals eine echte Bestellung. Grundregel: Der Browser entscheidet nie über den Zahlungsstatus. Eine Order entsteht ausschließlich aus einer serverseitig verifizierten Zahlung.

Entschieden: eigener Stripe-Account (Secret Key im Backend), sofortiger Einzug (Order bei `paid`), Stripe Checkout als gehostete Redirect-Oberfläche.

## Verbindlicher Ablauf

```text
validierter Checkout
  -> Payment Session (Betrag/Währung aus dem Checkout-Snapshot)
  -> Stripe Checkout (Redirect)
  -> Webhook, signaturgeprüft
  -> finalizeOrderFromPayment (atomar)
       Ordernummer, Order, Positionen, Adressen, Promotions,
       Payment Transaction, Inventory-Commit, Cart completed,
       Checkout completed, Audit, Outbox
  -> Return-Seite fragt nur den Serverstatus ab
```

Bestehende Pricing-, Inventory-, Cart- und Checkout-Engines werden verwendet, nicht dupliziert. Bestandsbuchungen laufen weiterhin nur über die Phase-3-Funktionen (`inv_commit_reservation`).

## Datenmodell (neue Tabellen)

- `payment_provider_configs` — Provider je Shop, Status, Anzeigename, `environment` (test/live), Priorität. Keine Secrets im Klartext; nur eine Referenz auf den Secret-Namen.
- `payment_sessions` — an Checkout-Session **und** Checkout-Snapshot gebunden, Betrag, Währung, Provider-Session-ID, Idempotenzschlüssel, Ablauf.
- `payment_attempts` — jeder Zahlungsversuch einzeln mit Nummer, Status, Fehlercode/-text, reduzierter Provider-Antwort.
- `payment_events` — unveränderbares Webhook-Journal, eindeutig über (Provider, Provider-Event-ID). Payload per Trigger unveränderbar, nur Verarbeitungsstatus darf sich ändern.
- `orders` — Ordernummer je Shop eindeutig, getrennte Felder `order_status`, `payment_status`, `fulfillment_status`, Summen als Ganzzahlen, `environment`, Verweis auf Checkout-Session und Snapshot. Unique auf `checkout_session_id` sichert genau eine Order je Checkout.
- `order_items`, `order_addresses`, `order_promotions` — unveränderbare Snapshots aus dem Checkout-Snapshot; spätere Produkt- oder Adressänderungen berühren historische Orders nicht.
- `payment_transactions` — authorization, capture, charge, refund, partial_refund, void, mit Provider-IDs für spätere Abstimmung.
- `refunds` — Betrag, Grund, Status (requested/processing/completed/failed/cancelled), Provider-Refund-ID, Antragsteller.
- `shop_order_sequences` — Nummernkreis je Shop mit Präfix und Auffüllung.

Alle Tabellen mit Grants, RLS und Tenant-Isolation über die bestehenden Helfer. Order-Positionen, Adressen, Promotions und Payment-Events sind per Trigger gegen Änderung geschützt.

## Serverseitige Transaktionsfunktionen (SQL)

- `order_next_number(shop)` — concurrency-sichere Nummernvergabe mit Zeilensperre; 100 parallele Finalisierungen erzeugen 100 eindeutige Nummern.
- `order_finalize_from_payment(...)` — prüft in einer Transaktion: Session gültig, Snapshot vorhanden, Payment eindeutig bezahlt, Betrag und Währung identisch mit dem Snapshot, Payment-Session gehört zum Checkout, noch keine Order vorhanden, Reservierungen aktiv. Danach Order + Positionen + Adressen + Promotions + Transaktion anlegen, Reservierungen committen, Cart auf `completed`, Checkout auf `completed`, Payment-Session final. Jeder Fehler rollt alles zurück.
- `order_cancel(...)` — nur erlaubte Zustandsübergänge.
- `refund_create(...)` — sperrt die Order, prüft „bereits erstattet + neu ≤ bezahlt“, setzt `partially_refunded` bzw. `refunded`, idempotent über Schlüssel.

Ausführungsrechte nur für die Serverrolle, wie in Phase 4.

## Provider-Abstraktion

`src/lib/commerce/payments/` mit `provider.ts` (Contract: createSession, getSession, cancelSession, capturePayment, refundPayment, parseWebhook), `types.ts`, `registry.ts`, `stripe/` (server, webhook, mapper) und `mock/`. Der Order-Kern kennt keinen Provider-Namen; weitere Provider (PayPal, Mollie, Klarna, Adyen) lassen sich später ohne Änderung am Kern ergänzen. Der Mock-Provider ist ausschließlich für Tests und in echten Shops nicht aktivierbar.

Stripe: Secret Key und Webhook-Signaturschlüssel als Backend-Secrets, nie im Client. Der Client erhält nur die Redirect-URL.

## Server-SDK und Routen

- `payments/payment.functions.ts` — `createPaymentSession`, `getPaymentStatus`, `cancelPayment` (Storefront, Cart-Token-autorisiert); Provider-Verwaltung für Admins.
- `orders/order.functions.ts` — Liste mit serverseitiger Suche und Filtern, Detailansicht, Stornierung, interne Notizen.
- `refunds/refund.functions.ts` — Refund anfordern, erstattbaren Restbetrag serverseitig berechnen.
- `src/routes/api/public/webhooks/stripe.ts` — Signaturprüfung, Event-Dedupe, Payload speichern, fachlich mappen, ggf. Order finalisieren. Ein Event gilt erst nach erfolgreicher fachlicher Verarbeitung als verarbeitet, damit Retrys funktionieren.

Idempotenz für Session-Erstellung, Attempt, Webhook, Finalisierung, Stornierung und Refund über die bestehende `idempotency_keys`-Infrastruktur.

## Rechte und Rollen

Neu: `orders.read/manage/cancel`, `payments.read/manage/refund`, `payment_settings.read/manage`. Verteilung: Owner/Administrator alles; Operations Bestellungen lesen/bearbeiten; Fulfillment nur lesen; Kundenservice bearbeiten ohne Refund; Finanzen Bestellungen und Zahlungen lesen plus Refund; Nur-Lesen lesend.

## Oberfläche

- `/app/bestellungen` — Tabelle mit Nummer, Datum, Kunde, Summe, Zahlung, Fulfillment, Status; Filter nach Zeitraum, Status und Betrag; Suche nach E-Mail, Nummer, SKU.
- `/app/bestellungen/$orderId` — Arbeitsbereich mit nächster sinnvoller Aktion, Positionen, Zahlung, Kunde, Adressen, Promotions, Timeline, Notizen, Refunds. Refund über einen geführten Dialog (ganz oder Teilbetrag mit Grund), erstattbarer Rest kommt vom Server.
- `/app/einstellungen/zahlungen` — Provider, Status, Test/Live, Priorität; Secrets nie erneut sichtbar; deutlicher Hinweisbanner im Testmodus.
- Test-Storefront erweitert: nach validiertem Checkout Zahlung starten, Rückkehr auf `/payment/return`, Status vom Server, Bestellbestätigung nur bei tatsächlich vorhandener Order. Für „pending“ kontrolliertes Polling mit Abbruch, für Fehlschläge ein neuer Zahlungsversuch ohne neuen Warenkorb.
- Navigation: „Bestellungen“ in der Hauptnavigation, Zahlungen unter Einstellungen.

## Tests und Abnahme

Unit- und Datenbanktests: genau eine Order bei 30 parallelen Finalisierungen, 100 parallele Ordernummern eindeutig, Betrags- und Währungsabweichung blockiert die Order, fünffaches identisches Webhook-Event erzeugt eine Order, fehlgeschlagene Zahlung committet keinen Bestand, erfolgreiche genau einmal, Rollback hinterlässt keine halbe Order, Refund 30/70 ergibt teilweise erstattet dann erstattet, 101 % Refund abgelehnt, doppelter Refund mit gleichem Schlüssel nur einmal, fremde Order/Session/Refund und ungültige Signatur blockiert.

Nicht in Phase 5: Steuer-Engine, Fulfillment, Labels, Tracking, Rechnungen, Returns, Kundenportal, öffentliche Storefront.

## Umsetzungsreihenfolge

1. Migration: Tabellen, Enums, RLS, Rechte, Trigger, SQL-Funktionen.
2. Provider-Contract, Stripe-Adapter, Mock-Adapter, Secrets anfordern.
3. Payment-Sessions, Webhook-Route, Order-Finalisierung.
4. Refunds und Stornierung.
5. Admin-Oberfläche und Test-Storefront-Erweiterung.
6. Tests, Concurrency-Prüfungen, Build und Typecheck.
