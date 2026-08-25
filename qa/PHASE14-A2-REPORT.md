# Phase 14 — Gate A2: Umgebungen und Secrets

Datum: 2026-08-25. Bewertung ausschließlich mit Nachweis: PASS / OFFEN / BLOCKED / FAIL.

## Priorität 1 — Job-Authentifizierung vereinheitlicht

| ID | Prüfung | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| A2-1 | Ursache der fehlgeschlagenen Job-Auth | PASS | `communications.ts` prüfte `COMMUNICATION_JOB_SECRET` (nie gesetzt → jede Anfrage 401); `automation.ts` prüfte `SUPABASE_PUBLISHABLE_KEY` — ein öffentlicher Wert, faktisch keine Authentifizierung |
| A2-2 | Vereinheitlichung auf zentrale Cron-Auth | PASS | alle drei Endpunkte rufen `authenticateCronRequest` aus `src/integrations/supabase/cron-auth.ts` (Bearer, SHA-256-Vergleich in konstanter Zeit, Doppelakzeptanz während Rotation) |
| A2-3 | Kein paralleles Secret-System mehr | PASS | `rg COMMUNICATION_JOB_SECRET src` → keine Treffer; Publishable-Key-Prüfung entfernt |
| A2-4 | Expiration-Job vorhanden | PASS | neu: `src/routes/api/public/jobs/expiration.ts` + Migration `ops_expire_due()` (SECURITY DEFINER, EXECUTE nur `service_role`) |
| A2-5 | Ablehnung ohne Secret | PASS | `POST /api/public/jobs/communications` ohne Header → 401; mit `Bearer wrong` → 401 |
| A2-6 | Kommunikations-Job | PASS | `{"ok":true,"processed":0,"sent":0,"failed":0}` — 200 |
| A2-7 | Automations-Job | PASS | `{"ok":true,"reclaimed":0,"queued":0,"claimed":0,"results":[]}` — 200 |
| A2-8 | Expiration-Job | PASS | `{"ok":true,"expired_carts":0,"expired_sessions":5,"expired_reservations":0}` — 200, 5 überfällige Checkout-Sitzungen tatsächlich beendet |
| A2-9 | Testumgebung | PASS | Läufe gegen die lokale Entwicklungsinstanz (`localhost:8080`), Daten der QA-Organisation; keine Produktionsdaten, keine externen Provider angesprochen |
| A2-10 | Zeitplan (pg_cron) | OFFEN | Der einzige vorhandene Zeitplan `automation-worker` (jede Minute) meldete sich mit dem **öffentlichen** Publishable Key an und wurde entfernt, da er nach der Umstellung nur noch 401 erhalten hätte. Ein neuer Zeitplan mit Bearer-Cron-Secret wird in A8 pro Umgebung eingerichtet; `cron.job` ist derzeit leer |

Reservierungsablauf: `inv_expire_reservations` verlangt einen Akteur mit Berechtigung.
`ops_expire_due()` setzt dafür das bereits etablierte `commerce.system_op`-Flag transaktionslokal —
kein neuer Umgehungsweg, dieselbe Mechanik wie in den bestehenden System-RPCs.

## Priorität 2 — Trennung Development / Staging / Production

| ID | Prüfung | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| A2-11 | Getrennte Datenbestände | FAIL | nur ein Cloud-Projekt vorhanden; Development und eine künftige Production würden Daten, Auth-Nutzer und Buckets teilen |
| A2-12 | Getrennte Storage-Buckets | FAIL | `media`, `shipping-labels`, `documents` existieren genau einmal |
| A2-13 | Getrennte Store-API-Keys | FAIL | alle Keys liegen im selben Projekt |
| A2-14 | Getrennte Cron-Secrets | OFFEN | `LOVABLE_CRON_SECRET` wird plattformseitig je Umgebung verwaltet; ohne zweite Umgebung nicht belegbar |
| A2-15 | Zielbild dokumentiert | PASS | `docs/production/ENVIRONMENT_MATRIX.md` mit Ist-Zustand, Zielbild, Invarianten und sechs Umsetzungsschritten |
| A2-16 | Umgebungskennzeichnung der Datensätze | OFFEN (Finding A2-F3) | Orders ohne jede Kennzeichnung; Payments/Communications/Shipping nur indirekt über Provider-Typ. Bewusst keine Migration, da echte Projekttrennung der richtige Weg ist |
| A2-17 | Keine Produktionsumgebung veröffentlicht, keine Daten verschoben | PASS | keine Veröffentlichung, keine Datenmigration ausgeführt |

## Priorität 3 — Secret-Inventur und Leak-Prüfung

| ID | Prüfung | Ergebnis | Nachweis |
| --- | --- | --- | --- |
| A2-18 | Vollständige Inventur | PASS | `docs/production/SECRET_REGISTER_TEMPLATE.md`, 15 Namen aus statischer Codeauswertung, ohne Werte |
| A2-19 | `.env.example` | PASS | erzeugt, ausschließlich Variablennamen |
| A2-20 | Rotations- und Widerrufsablauf | PASS | `docs/production/SECRET_ROTATION_RUNBOOK.md` inkl. ausfallfreier Cron-Rotation über `LOVABLE_CRON_SECRET_PREVIOUS` |
| A2-21 | Git-Leak-Prüfung | PASS | `git ls-files` zeigt nur `.env`; Inhalt sind Projekt-ID, Projekt-URL und Publishable Keys — keine privaten Secrets |
| A2-22 | Client-Bundle | PASS | Produktionsbuild erzeugt; Suche nach den tatsächlichen Werten von `LOVABLE_CRON_SECRET` und `LOVABLE_API_KEY` in `dist` → 0 Treffer. Treffer auf `sb_secret_` sind reine Präfix-Prüfungen der Supabase-Bibliothek, keine Werte |
| A2-23 | Server-Bundle | PASS | ebenfalls 0 Treffer; Secrets werden ausschließlich zur Laufzeit aus `process.env` gelesen |
| A2-24 | Audit-Protokoll | PASS | 261 Einträge, 0 Treffer auf `sb_secret\|service_role\|sk_live\|sk_test\|whsec_\|bearer\|authorization\|api_key\|password\|secret` in `metadata` |
| A2-25 | Outbox | PASS | 212 Einträge, 0 Treffer mit demselben Muster in `payload` |
| A2-26 | API-Request-Logs | PASS | `store_api_request_logs` speichert bauartbedingt keine Header und keine Bodies (Spalten: Route, Methode, Status, Dauer, IP-Hash, User-Agent-Kurzform, Fehlercode) |

## Weiterhin blockiert (unverändert, keine Credentials erfunden)

| Thema | Status |
| --- | --- |
| Stripe (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`) | BLOCKED |
| Echter E-Mail-Versand (`COMMUNICATION_WEBHOOK_SECRET`, Provider) | BLOCKED |
| Carrier-Labels (DHL, DPD, GLS, UPS, Sendcloud) | BLOCKED |

## Offene Findings aus A2

| ID | Finding | Schwere | Nächster Schritt |
| --- | --- | --- | --- |
| A2-F1 | Keine Umgebungstrennung (eine Datenbank für alles) | Go-live-Blocker | Staging-Projekt anlegen (Schritte 1–5 der Umgebungsmatrix) |
| A2-F2 | Kein Zeitplan für die Job-Endpunkte | hoch | A8 |
| A2-F3 | Keine explizite Umgebungskennzeichnung in Orders/Payments | mittel | entfällt mit A2-F1, sonst Migration |
| A2-F4 | `APP_BASE_URL` nicht gesetzt (Fallback in Links) | mittel | je Umgebung setzen, sobald URLs feststehen |
| A2-F5 | Datenbank-Linter meldet 41 Bestandshinweise (u. a. SECURITY-DEFINER-Ausführbarkeit) | offen | Auswertung in A3/A4 |
