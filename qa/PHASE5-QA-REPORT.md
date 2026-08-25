# Commerce OS — Phase 5 Abschlussprüfung (QA-Report)

Ausgeführt gegen die bestehende Engine (Phase 0–5), ohne neue Architektur.
Testdaten: QA Organisation A/B, QA Testprodukt (49,90 €), Versand 4,90 €, Summe 54,80 €.

Gesamtergebnis: **93 von 93 Prüfungen bestanden** (46 + 35 + 12).
Nicht ausführbar: echter Stripe-Testkauf (kein Stripe-Testschlüssel hinterlegt).

## 1–3 Testdaten & erfolgreicher Kauf
- Isolierte Org/Shop/Produkt/Preis/Bestand/Versand angelegt.
- Kauf über Test-Anbieter erzeugt Order `ORD-00000x`, Snapshot-Summe 54,80 €,
  `payment_status = paid`, Bestand 10 → 9, Reservierung committed, Cart und
  Checkout-Session completed, Audit- und Outbox-Einträge vorhanden.

## 4 Doppelte & parallele Finalisierung
- 5 parallele Finalisierungen: genau **eine** Order, identische Antwort aus dem
  Idempotenz-Speicher, genau ein `sale_commit`, eine Reservierung.

## 5–6 Fehlgeschlagene und schwebende Zahlung
- `failed`: keine Order, Checkout bleibt `awaiting_payment`, Cart bleibt
  `checkout`, Reservierung bleibt aktiv, Retry erzeugt neue Payment-Session.
- `pending`: keine voreilige Order, kein Inventory-Commit, spätere
  Finalisierung erfolgreich.

## 7–8 Betrags- und Währungsmanipulation
- Abweichender Betrag (54,79 €) und abweichende Währung (USD) werden in
  `order_finalize_from_payment` abgelehnt; keine Order, Vorgang nachvollziehbar.

## 9 Inventory-Concurrency
- Bei `available = 1` zwei parallele Checkouts: 1 Reservierung, 1 Order,
  1 Ablehnung („Nicht genügend Bestand verfügbar"), kein Overselling.

## 10–11 Erstattungen
- Teilerstattung 10,00 € → `partially_refunded`, `refunded_minor = 1000`,
  Rest 44,80 €, Payment-Transaction geschrieben.
- Gleicher Idempotency-Key 3× → genau eine Erstattung.
- Resterstattung → `refunded`; weitere Erstattung wird abgelehnt.
- Erstattung bucht keinen Bestand automatisch zurück (bewusst manuell).

## 12 Stornierung
- Order → `cancelled`, Zahlstatus unverändert, Audit- und Outbox-Event,
  keine automatische Bestandsrückbuchung, Doppelstorno ohne Wirkung.

## 13 Tenant-Isolation (Org B gegen Org A)
- Orders, Payment-Sessions, Refunds, Provider-Konfigurationen und
  Checkout-Snapshots sind nicht lesbar; `refund_create`, `order_cancel` und
  `order_finalize_from_payment` werden abgelehnt; Update auf fremde
  Payment-Session trifft 0 Zeilen; keine `payments.refund`-Berechtigung.

## 14 Test-Anbieter-Sicherheit
- Test-Anbieter im Live-Modus wird abgelehnt, keine Live-Konfiguration
  vorhanden, alle Test-Orders tragen `environment = test`, nicht aktivierte
  Anbieter werden abgewiesen.

## 16 Webhook-Härtung (offline, mit lokalem Signing Secret)
- Gültige Signatur akzeptiert; falsche Signatur, manipulierter Body, fremdes
  Secret, abgelaufener Zeitstempel und fehlender Header werden abgelehnt.
- Doppelte Event-ID wird auf Datenbankebene abgewiesen (23505); Event-Journal
  ist unveränderlich und nicht löschbar; unbekannte Payment-Session erzeugt
  einen Fehler statt einer Order.

## 15 Offen
Ein echter Stripe-Testkauf inkl. Live-Webhook-Zustellung wurde **nicht**
ausgeführt, da kein Stripe-Testschlüssel und kein Webhook-Secret hinterlegt
sind. Sobald `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` (Testmodus)
vorliegen, kann dieser Punkt nachgeholt werden.
