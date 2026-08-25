# Phase 11 — Automation Engine, Aufgaben & Operational Inbox

Ziel: Händler automatisieren wiederkehrende Abläufe ohne Entwickler. Die Commerce-Kernprozesse bleiben unangetastet.

```text
Domain Event -> Rule (Version) -> Conditions -> Actions -> Job Queue
   -> Execution -> Action Execution -> Result / Retry / Task / Audit
```

Kerninvariante: Payment → Order, Order → Inventory Commit, Tax, Checkout-Validierung bleiben Core und laufen niemals über Automationen. Automationen dürfen nur offizielle Domain-Aktionen aufrufen — nie Order-Total, Payment-Status, Inventory-Level, Invoice-/Tax-/Tracking-Snapshots direkt schreiben.

## Ausgangslage (geprüft)

- `outbox_events` existiert mit `status`, `attempts`, `available_at`, `last_error`, `processed_at` — aber ohne `shop_id`, `correlation_id`, `causation_id`. Diese drei Spalten werden ergänzt (nullable, ohne Änderung bestehender Aufrufe).
- `emitEvent(organizationId, eventType, payload)` in `core.server.ts` ist die einzige Event-Quelle; Events werden heute nur geschrieben, nicht konsumiert. Phase 10 konsumiert über `handleDomainEvent` direkt beim Aufruf.
- Berechtigungen laufen über `role_permissions` + `has_permission(user, org, permission)`; RLS-Muster ist etabliert.
- Ein Cron-Endpunkt-Muster existiert bereits (`/api/public/jobs/communications`); Phase 11 nutzt die generierte Cron-Authentifizierung (`authenticateCronRequest`).

## Datenmodell (neue Tabellen)

- `automation_rules` — Name, Beschreibung, Status (`draft|active|paused|archived`), `trigger_type` (`domain_event|schedule|manual`), `trigger_config`, `execution_mode`, Priorität, `stop_on_error`, `max_executions_per_event`, Rate-Limits (`max_per_hour`, `max_per_entity`), Circuit-Breaker-Felder (`auto_paused_at`, `auto_pause_reason`), `active_version`, `draft_version`.
- `automation_rule_versions` — Version, `trigger_snapshot`, `conditions_snapshot`, `actions_snapshot`, `published_at`. Veröffentlichte Versionen sind per Trigger unveränderbar.
- `automation_actions` — `position`, `action_type`, `config`, `continue_on_failure`, `delay_seconds`. Deterministische Reihenfolge über `position`.
- `automation_executions` — Rule + Rule-Version, `trigger_type`, `source_event_id`, Status (`queued|running|completed|partially_completed|failed|cancelled`), `error_code`, `current_action_position`, `context_snapshot`, `correlation_id`, `causation_id`, `chain_depth`, `error`, `idempotency_key`, `retry_of_execution_id`. Ein Loop-Abbruch ist kein eigener Status, sondern `failed` mit `error_code = 'blocked_loop'` — die Statusmenge bleibt damit klein und auswertbar.
- `automation_action_executions` — Attempt, Status, `input_snapshot`, `output_snapshot`, `error_code`, `error_message`, Zeiten.
- `automation_jobs` — `job_type`, `payload`, Status, `available_at`, `attempts`, `max_attempts`, `last_error`, `locked_at`, `locked_by`.
- `tasks` — Titel, Beschreibung, Status (`open|in_progress|completed|cancelled`), Priorität (`low|normal|high|urgent`), `entity_type`, `entity_id`, `assigned_to`, `due_at`, `source` (`manual|automation|system`), `source_automation_execution_id`, `dedupe_key`.
- `outgoing_webhook_endpoints` — Name, HTTPS-URL, `secret_reference`, Status.

Alles mit GRANTs, `updated_at`-Trigger, Indizes (org/shop/status/available_at) und RLS über Organisationszugehörigkeit + `has_permission`. Cross-Tenant-Tests verpflichtend.

Idempotenz: Unique auf `(automation_rule_id, source_event_id)` für Event-Trigger und Unique auf `automation_jobs (execution_id, action_execution_id, attempt-slot)`. Tasks bekommen ein Unique auf `(shop_id, dedupe_key)` bei gesetztem Key, damit fünf gleiche Low-Stock-Events genau eine Aufgabe erzeugen.

Neue Permissions: `automations.read|manage|activate|run|debug`, `tasks.read|manage|assign`, `webhooks.read|manage` — verteilt auf Owner/Administrator (alles), Operations (Automationen lesen, Aufgaben verwalten), Marketing (Communication-/Customer-Automationen), Developer (`debug`, Webhooks), Read-Only (nur lesen).

## Event Registry

Deklarative Registry im Code (`event-registry.ts`), keine frei erfundenen Eventnamen in der UI: pro Event Kategorie, Beschreibung, verfügbare Felder, erlaubte Operatoren, empfohlene Aktionen. Abgedeckt u. a. `order.created`, `payment.succeeded|failed`, `shipment.shipped|delivered|exception`, `invoice.issued`, `return.requested|received`, `refund.completed`, `inventory.low_stock|out_of_stock`, `customer.created`, `cart.abandoned`.

Fehlende Events werden an den bestehenden Stellen ausschließlich als zusätzliche `emitEvent`-Aufrufe ergänzt — keine Automationslogik in Orders, Shipping, Returns oder Inventory.

## Trigger, Conditions, Actions

- Trigger: Domain Event, Zeitplan (täglich/wöchentlich/monatlich/einmalig, UI ohne Cron-Syntax, intern normalisiert), manueller Lauf.
- Conditions: typisiert und deklarativ, Operatoren `equals`, `not_equals`, `greater_than`, `greater_or_equal`, `less_than`, `less_or_equal`, `contains`, `not_contains`, `in`, `not_in`, `exists`, `not_exists`. Gruppen `ALL`/`ANY`, maximal eine Verschachtelungsebene. Kein `eval`, keine Skripte, kein SQL, keine Shell.
- Action Registry (nur real implementierte Aktionen): `communication.send` (Phase 10), `invoice.create`, `invoice.issue` (Phase 8), `fulfillment.create` (Phase 7), `customer.add_to_group`, `customer.remove_from_group` (Phase 9), `inventory.create_alert`, `return.notify_internal`, `order.add_note`, `task.create`, `webhook.send`.
- Invoice-Aktionen respektieren die Rechnungsstrategie aus Phase 8 (`invoice_settings.invoice_creation_strategy`): Bei `on_order_paid`/`on_order_created` erzeugt die Engine keine zweite Rechnung, sondern die Aktion endet als `skipped` mit Begründung. `invoice.issue` läuft nur, wenn die Einstellungen automatisches Festschreiben zulassen; andernfalls ebenfalls `skipped`. Die Systemvorlage „Bestellung bezahlt" enthält die Invoice-Aktionen nur, wenn die Strategie des Shops `manual` ist — die UI blendet sie sonst aus und erklärt warum. Eine Automation kann die Invoice-Settings damit nicht umgehen.
- Jede Aktion ist ein dünner Adapter auf die bestehende Engine. Keine duplizierte Invoice-, Mail- oder Versandlogik. Idempotency-Keys werden an die Domain-Aktion durchgereicht, sodass fünf Retries genau eine Rechnung bzw. eine Communication erzeugen.
- Verzögerte Aktionen werden als Job mit `available_at` gespeichert; kein Client-Timer.

## Ausführung, Queue und Schutzmechanismen

- Worker `processAutomationJobs()` claimt über `FOR UPDATE SKIP LOCKED` in einer SQL-Funktion; parallele Läufe führen einen Job genau einmal aus.
- Cron-Endpunkt `/api/public/jobs/automation` mit der bestehenden Cron-Authentifizierung; kein dauerhafter Worker.
- Retry-Backoff 1 min → 5 min → 30 min → 2 h → 6 h. Permanente Fehler (`permission_denied`, `invalid_configuration`, `entity_not_found`, `unsupported_action`) ohne Retry; temporäre (`provider_timeout`, `rate_limited`, `temporary_unavailable`) mit Retry. Danach Dead Letter → `failed` + Attention Item.
- Loop Protection: `correlation_id`/`causation_id` durchgereicht, `MAX_AUTOMATION_CHAIN_DEPTH = 10`, danach `failed` mit `error_code = 'blocked_loop'` plus Attention Item.
- Circuit Breaker und Rate Limits zählen atomar in der Datenbank, nicht in der Anwendung: eine Zählertabelle `automation_rule_counters` (Rule + Zeitfenster-Bucket + Entität) wird per `INSERT ... ON CONFLICT DO UPDATE ... RETURNING` in einer `SECURITY DEFINER`-Funktion hoch- bzw. mitgezählt. Die Funktion liefert im selben Aufruf die Entscheidung `allow | rate_limited | circuit_open` zurück und setzt bei Überschreitung der Fehlerdichte (z. B. 50 Fehler in 5 Minuten) `auto_paused_at`/`auto_pause_reason` in derselben Transaktion. Kein Lesen-dann-entscheiden, keine Race Condition bei parallelen Workern.
- Rate Limits je Rule (pro Stunde, pro Entität) laufen über dieselbe atomare Funktion und wirken auch bei gleichzeitigen Läufen.
- Bulk-Events (z. B. Massenimport) laufen ausschließlich über die Queue, nie synchron.
- Runtime-Actor: `system_automation` ist **keine** Rolle in `memberships` und kein `app_role`-Wert. Es ist ein rein interner Ausführungskontext (`actor_type = 'system_automation'` im Execution- und Audit-Datensatz) mit einer im Code fest definierten Capability-Allowlist, die exakt den Aktionen der Action Registry entspricht. Jede Domain-Aktion prüft diese Allowlist; alles außerhalb wird abgelehnt. Kein Superadmin-Kontext, keine RLS-Umgehung über eine Pseudomitgliedschaft.

## Outgoing Webhooks

`webhook.send` nur über HTTPS, mit SSRF-Schutz (Blockliste für localhost, 127.0.0.0/8, private Bereiche, link-local und Metadaten-Endpunkte, Auflösung vor Verbindung, keine Redirects in gesperrte Ziele), HMAC-Signatur `X-Commerce-Signature`, Timeout, begrenzte Responsegröße, Retry und Logs ohne Secrets. Payload strukturiert: `event`, `id`, `created_at`, `shop_id`, `data` — ohne unnötige personenbezogene Daten.

## Consent-Grenze

Transaktionale und Marketing-Kommunikation bleiben getrennt. `cart.abandoned` wird technisch möglich, aber die Marketing-Aktivierung erfordert eine passende Consent-Prüfung; Automationen dürfen Marketing nicht als transaktional tarnen.

## UI

Neuer Hauptnavigationspunkt „Automationen" und „Aufgaben".

- `/app/automationen` — Liste mit Name, Trigger, Status, letzter Ausführung, Erfolgsrate, Fehlern.
- `/app/automationen/neu` — Assistent in fünf Schritten: Wenn… / Nur wenn… / Dann… / Testen / Aktivieren. Trigger-Auswahl nach Kategorie (Bestellung, Zahlung, Versand, Retoure, Kunde, Lager, Dokument, Zeitplan), Bedingungen als Felder-Dropdowns, Aktionen aus der Registry.
- Natürlichsprachige Zusammenfassung immer sichtbar: „Wenn eine Bestellung bezahlt wurde und der Bestellwert mindestens 100 € beträgt, dann erstelle eine Rechnung und sende die Bestellbestätigung."
- Testmodus: Dry Run über `evaluateAutomation(rule, context, dryRun=true)` mit Trigger-Match, Bedingungsergebnissen und geplanten Aktionen — garantiert ohne Seiteneffekte. Echte Testausführung nur explizit und mit Warnung.
- `/app/automationen/ausfuehrungen/$executionId` — Timeline mit Trigger, Bedingungen, jeder Aktion, Fehlern und manuellem Re-run (neue Execution mit Verweis auf die ursprüngliche, Historie bleibt erhalten).
- Systemvorlagen (Bestellung bezahlt, Niedriger Bestand, Versandproblem, Retoure eingegangen, VIP-Kunde) sind read-only und werden per „Als Vorlage verwenden" in eine Shop-eigene Kopie überführt.
- Draft/Active-Versionierung: Bearbeiten erzeugt eine Draft-Version, Veröffentlichen ersetzt die aktive Version; Executions speichern ihre Rule-Version.
- `/app/aufgaben` — Aufgaben-Inbox mit Heute, Überfällig, Offen, Mir zugewiesen, Automatisch erstellt. Kein Kanban.
- Dashboard wird zur Operational Inbox „Was benötigt Ihre Aufmerksamkeit?" über eine Read-Schicht `getAttentionItems()`, die Aufgaben, Automationsfehler, Zahlungs- und Versandausnahmen, fehlgeschlagene Kommunikation, offene Retouren und Bestandswarnungen aggregiert (Struktur: type, severity, title, description, entity_type, entity_id, primary_action, created_at). Klick führt direkt zur Aufgabe.
- Kennzahlen je Automation minimal: Executions, Erfolge, Fehler, Durchschnittsdauer, letzter Lauf.

## Audit

`automation.created|updated|activated|paused|archived|manual_run`, `task.created_manually|assigned|completed`. Automatische Aktionsausführungen landen im Execution-Log, nicht als Audit-Spam. Event Replay nur mit `automations.debug`; keine historische Commerce-Transaktion wird erneut ausgeführt.

## Technische Struktur

`src/lib/commerce/automation/` mit `automation.types.ts`, `event-registry.ts`, `conditions.ts`, `action-registry.ts`, `actions/*.server.ts`, `engine.server.ts`, `queue.server.ts`, `webhook.server.ts`, `automation.functions.ts`, sowie `src/lib/commerce/tasks/` und `src/lib/commerce/attention/`. Neuer Cron-Route unter `src/routes/api/public/jobs/automation.ts`.

## Qualitätssicherung (`qa/phase11.ts`)

Dasselbe Event 20-mal → eine Execution; 20 parallele Worker → ein Job genau einmal; Retry-Backoff korrekt; permanenter Fehler ohne Retry; `invoice.create` mit 5 Retries → eine Rechnung; `shipment.shipped` fünfmal → eine Communication; Low Stock → genau eine Aufgabe; Conditions bei 99 € vs. 100 €; ALL/ANY korrekt; Delay von 1 h wird eingehalten; Loop Protection stoppt A↔B; Circuit Breaker pausiert fehlerhafte Rule; Mandantentrennung für Rules, Executions, Tasks und Webhook-Endpunkte; SSRF-Blockliste greift; Dry Run ohne Seiteneffekte; historische Execution behält ihre Rule-Version. Phasen 0–10, Build, Typecheck und Tests bleiben grün.

## Nicht Teil von Phase 11

Marketing-Campaign-Engine, Newsletter-Builder, CRM, Loyalty, Recommendations, KI-Builder, öffentliche SDK/API, große Analytics-Engine, Woo-/Shopify-Import.
