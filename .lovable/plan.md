# Phase 10 — Communication Studio & E-Mail Engine

Ziel: Eine zentrale Kommunikations-Engine. Keine Commerce-Engine versendet selbst Mails — sie schreibt nur Domain Events. Die Engine entscheidet über Regel, Template, Locale, Branding, Empfänger und Provider.

```text
Domain Event -> Rule -> Template Version -> Context -> Render (HTML+Text)
   -> Communication (Snapshot) -> Queue -> Provider -> Attempt -> Delivery Status
```

## Datenmodell (neue Tabellen)

- `communication_provider_configs` — Kanal, Provider, Status, Test-Modus, Priorität, Capabilities, `configuration_reference` (Secrets nie als Klartext, nur Referenz auf Server-Secrets).
- `sender_identities` — Absendername, Adresse, Reply-To, `verification_status` (nie automatisch „verifiziert").
- `communication_templates` — `key`, Kanal, Kategorie, Status, `is_system`, `default_locale`, `subject_template`, `content_schema`.
- `communication_template_versions` — Version + Locale, Subject, Preheader, `body_schema` (Blockstruktur als JSONB), Text-Template, `published_at`. Veröffentlichte Versionen sind unveränderbar (Trigger); Änderung erzeugt Version n+1.
- `communication_branding` — je Shop: Logo, Farben, Schrift, Buttonstil, Radius, Footer, Support, Social Links. Vorbelegung aus Shop-/Document-Branding als expliziter Kopiervorgang.
- `communications` — vollständiger Snapshot je Sendung (Template-Version, Locale, Subject, HTML, Text, Empfänger, Sender, Quell-Event, Status, Zeitstempel).
- `communication_attempts` — Versuchsnummer, Provider, `provider_message_id`, Fehlercode, Zeiten.
- `communication_provider_events` — unveränderbares Journal, Unique `(provider, provider_event_id)`, `signature_verified`, `processing_status`. Ein Trigger sperrt jedes UPDATE außer auf `processing_status` und `processed_at`; Payload, Signaturflag, Event-ID und Empfangszeit sind nach dem Insert unveränderbar, DELETE ist ausgeschlossen.
- `communication_suppressions` — Adresse + Grund (`hard_bounce | complaint | manual`), Quelle, optionales Ablaufdatum. Marketing-Abmeldung unterdrückt niemals notwendige transaktionale Mails; das wird über den Grund fachlich getrennt.
- `communication_rules` — Event-Typ → Template, Kanal, `enabled`, `delay_seconds`, `conditions` (JSONB, kontrollierte Felder), Priorität.

Enums: `communication_channel` (email produktiv, sms/push/whatsapp nur vorbereitet), `communication_status` (draft, queued, sending, sent, delivered, failed, cancelled, suppressed), `communication_delivery_status` (accepted, sent, delivered, soft_bounce, hard_bounce, complained, rejected, unknown), `communication_recipient_type`.

Alle Tabellen: GRANTs, RLS über Organisationszugehörigkeit plus Permission-Check, `updated_at`-Trigger, Indizes auf org/shop/status/event. Neue Permissions `communications.read`, `communications.manage`, `communications.send_test`, `communications.settings` in `role_permissions`.

Idempotenz: Unique auf `(shop_id, source_event_id, communication_rule_id, recipient_address)` — dasselbe Domain Event fünfmal verarbeitet erzeugt genau eine Communication. Der Queue-Worker läuft über Row-Lock (`FOR UPDATE SKIP LOCKED`), sodass parallele Läufe keine Doppelsendung erzeugen.

## Provider

`CommunicationProvider`-Interface analog zum bestehenden `CarrierProvider` (`send`, optional `parseWebhook`, `capabilities`) mit Registry per dynamischem Import.

- `test` — vollständig funktionsfähiger interner Provider: rendert, protokolliert, simuliert Zustellung/Bounce, versendet nichts nach außen. Der Provider besitzt keinerlei Netzwerkpfad — er ruft keine externe API und keinen Mailversand auf, unabhängig davon, welche Empfängeradresse eingetragen ist; eine echte Adresse kann technisch nicht erreicht werden. Jede so erzeugte Communication wird als Testsendung markiert. Damit ist die gesamte Engine ohne externe Credentials nutzbar und testbar.
- `lovable` — der produktive E-Mail-Versand über die verwaltete E-Mail-Infrastruktur des Projekts. Aktiv erst, wenn eine eigene Absenderdomain eingerichtet und verifiziert ist; bis dahin bleibt der Test-Provider aktiv und die Oberfläche sagt das klar.

Es werden keine Fake-SMS-/WhatsApp-Funktionen gebaut; die Kanäle existieren nur im Datenmodell.

## Rendering

- Blockbasiert, kein HTML-Eingabefeld: `logo`, `heading`, `text`, `button`, `divider`, `order_summary`, `shipment_summary`, `tracking`, `document`, `return_summary`, `refund_summary`, `address`, `payment_summary`, `footer`.
- Jede Mail erhält Subject, Preheader, HTML **und** Plain Text. Tabellenbasiertes, mobile-first Layout, max. 600 px Content, große Buttons, keine JavaScript-Inhalte, keine Wiederverwendung von Web-App-Komponenten.
- Variablen sind typisiert und je Template freigegeben (z. B. `order.number`, `order.total`, `customer.first_name`, `shop.support_email`). Unbekannte Variablen sind ein Validierungsfehler, kein leerer String.
- Context Builder je Domäne: `buildOrderCommunicationContext`, `buildShipmentCommunicationContext`, `buildInvoiceCommunicationContext`, `buildReturnCommunicationContext`, `buildRefundCommunicationContext`, `buildCustomerCommunicationContext`. Templates greifen nie direkt auf Tabellen zu; Beträge stammen aus den vorhandenen Snapshots der Phasen 5–9, nie aus aktuellen Preisen.

## Systemvorlagen (deutsch, seeded)

Bestellungen: `order.confirmed`, `payment.confirmed`, `payment.failed`, `refund.completed`.
Versand: `shipment.created`, `shipment.shipped`, `shipment.out_for_delivery`, `shipment.delivered`, `shipment.exception`.
Dokumente: `invoice.issued`, `credit_note.issued`.
Retouren: `return.requested|authorized|rejected|received|approved|partially_approved|refunded|completed`.
Kundenkonto: `customer.welcome`, `guest_order_access`.

`customer.email_verification` und `customer.password_reset` bleiben bewusst bei der bestehenden Auth-Infrastruktur — es wird keine parallele Passwort-Reset-Engine gebaut. Die Templates werden als vorbereitete, deaktivierte Vorlagen angelegt.

Standardmäßig aktiv sind nur Bestellbestätigung, Versandbestätigung, Rechnung und die Retouren-Statusmails; Zahlungs- und Zustellbestätigung sind konfigurierbar und standardmäßig aus.

Dokumentlinks in Mails sind nie dauerhaft öffentlich: entweder kurzlebige signierte URL oder Weg über das Kundenportal bzw. den bestehenden Gast-Token-Mechanismus aus Phase 9. Insbesondere `guest_order_access` rendert niemals eine dauerhafte Dokument-URL, sondern ausschließlich einen kurzlebigen, widerrufbaren Zugangslink auf die Portal-Gastansicht; das Dokument selbst wird erst nach Prüfung des Tokens signiert ausgeliefert.

## Event-Verarbeitung

Die bestehende `outbox_events`-Tabelle (mit `status`, `attempts`, `available_at`) ist die Quelle. Ein Event-Consumer mappt Domain Event → Regel → Communication; die Commerce-Transaktionen bleiben unberührt, ein Providerausfall rollt niemals eine Bestellung zurück. Fehlende Events (z. B. `order.created`, `shipment.shipped`, `invoice.issued`, `return.*`) werden an den bestehenden Stellen ausschließlich als `emitEvent`-Aufrufe ergänzt — keine Mail-Logik in `orders.server.ts` & Co.

Hintergrundverarbeitung als kleine, wiederholbare Jobs über geschützte Cron-Endpunkte unter `/api/public/jobs/*` mit der vorhandenen Cron-Authentifizierung: `processCommunicationQueue`, `retryFailedCommunications`, `processProviderEvents`. Kein dauerhafter Worker-Prozess.

Retry mit Backoff 1 min → 5 min → 30 min → 2 h; danach `failed` plus Attention-Item im Backoffice. Permanente Fehler (`invalid_recipient`, `hard_bounce`, `suppressed`) werden nie erneut versucht.

Provider-Webhooks laufen über eine Route unter `/api/public/webhooks/communication/$provider` mit Signaturprüfung, schreiben ins unveränderbare Event-Journal und aktualisieren daraus die Zustellstatus.

## Communication Studio (UI)

Neuer Hauptnavigationspunkt „Kommunikation":

- `/app/kommunikation` — Übersicht: Zustellstatus der letzten Tage, fehlgeschlagene Sendungen, aktive Regeln, Providerstatus.
- `/app/kommunikation/vorlagen` — gruppiert nach Bestellungen, Zahlungen, Versand, Dokumente, Retouren, Kundenkonto; mit Event, Status, Locale, letzter Änderung.
- `/app/kommunikation/vorlagen/$templateId` — dreiteilig Inhalt / Design / Vorschau. Blockeditor mit Reihenfolgeänderung, Variablen-Picker (kein freies Raten von Platzhaltern), Locale-Umschaltung, Validierung vor Veröffentlichung (unbekannte Variablen, fehlende Pflichtblöcke, leeres Subject, fehlende Locale). Vorschau als Desktop, Mobile und Plain Text mit Demo- oder eigenen Organisationsdaten — nie Fremdmandantendaten.
- Testversand mit manueller Empfängeradresse, sichtbarer TEST-Kennzeichnung, ohne Order-/Customer-Events, mit Audit-Eintrag `communication.test_sent`.
- `/app/kommunikation/verlauf` — Log mit Filter nach Status, Template, Event, Zeitraum, Empfänger, Bestellnummer; Detailseite mit Snapshot-Vorschau, Attempts, Provider-Events, Fehlern und „Erneut senden" (erzeugt eine neue Communication aus dem ursprünglichen Snapshot, überschreibt nie den alten Datensatz).
- `/app/kommunikation/branding` — Branding Studio mit Live-Vorschau Desktop und Mobile, ohne CSS-Eingabe.
- `/app/kommunikation/regeln` und `/app/kommunikation/provider` — Regelmatrix (Event, Template, an/aus, Delay, Conditions) sowie Provider- und Absenderverwaltung inkl. Verifikationsstatus.

Integration: Bestelldetail, Rechnungsdetail, Retourendetail und Kundenprofil (Phase 9) erhalten je einen Abschnitt „Kommunikation" mit den zugehörigen Sendungen und der Möglichkeit, eine Mail erneut zu senden — auf Basis des ursprünglichen Business-Snapshots.

## Lokalisierung

Templates sind pro Locale versioniert; Deutsch wird vollständig implementiert, `en-US` ist strukturell vorbereitet. Fallback: angeforderte Locale → Shop-Default → Template-Default. Keine automatische KI-Übersetzung als produktive Wahrheit.

## Technische Struktur

`src/lib/commerce/communications/` mit `communication.types.ts`, `communication.server.ts`, `communication.functions.ts`, `renderer.ts`, `rules.ts`, `context.server.ts`, `provider.ts`, `registry.server.ts` und `providers/test`, `providers/email`.

## Qualitätssicherung

`qa/phase10.ts`: dasselbe Event fünfmal → genau eine Communication; parallele Queue-Läufe → keine Doppelsendung; Snapshot bleibt nach Template-Änderung unverändert; Retry-Backoff und permanenter Fehler ohne Retry; Suppression greift bei hard_bounce, nicht bei Marketing-Abmeldung; Teilversand-Mail enthält nur versendete Artikel; Refund-Mail zeigt den historischen Betrag; Mandantentrennung im Log und in der Vorschau; jede Mail hat HTML und Text; Provider-Webhook mit ungültiger Signatur wird abgewiesen. Build, Typecheck und die Tests der Phasen 0–9 bleiben grün.

## Voraussetzung für echten Versand

Produktiver E-Mail-Versand braucht eine eigene Absenderdomain. Bis diese eingerichtet und verifiziert ist, läuft alles vollständig über den Test-Provider — die Engine, das Studio und der Verlauf sind davon unabhängig nutzbar.
