# Incident Response — Commerce OS

Gilt für Staging und Production. Grundregeln:

1. Bei unbekannter Umgebung wird nichts geschrieben (`APP_ENV` prüfen).
2. Keine Änderung an ausgestellten Rechnungen, Steuer-Snapshots oder Zahlungsereignissen.
   Korrekturen laufen über neue Datensätze.
3. Jede Eingriffsmaßnahme wird im Audit-Log nachvollziehbar (`/app/audit`).
4. Secrets werden nie gelesen, geloggt oder weitergegeben; nur Rotation nach
   `docs/production/SECRET_ROTATION_RUNBOOK.md`.

Betriebsabläufe (Routine, nicht Störung): `docs/production/OPERATIONS_RUNBOOK.md`.

| # | Szenario | Sofortmaßnahme | Diagnose | Behebung |
| --- | --- | --- | --- | --- |
| 1 | Zahlung erfolgreich, keine Bestellung | Kunden informieren, keine zweite Zahlung anstoßen | `payment_sessions` und `payment_events` zur Session-ID prüfen, `/app/system/jobs` | Webhook erneut zustellen lassen; Finalisierung ist idempotent |
| 2 | Doppelte Bestellung | betroffene Bestellung nicht löschen | beide Bestellungen auf dieselbe `payment_session_id` prüfen | Duplikat stornieren (`order_cancel`), Bestand wird freigegeben |
| 3 | Payment-Webhook ausgefallen | Checkout beobachten | Provider-Dashboard Zustellversuche, `payment_events` | Events nachziehen; Session-Status per Provider-Abgleich |
| 4 | Falscher Bestand | Verkauf des Artikels pausieren | `inventory_movements` und offene Reservierungen prüfen | Korrekturbuchung über `inv_adjust_stock`, nie direkt UPDATE |
| 5 | Checkout nicht verfügbar | Maintenance Mode aktivieren | `/app/system/health`, Fehlerliste `/app/system/errors` | Ursache beheben, danach Wartung beenden |
| 6 | Rechnung fehlt | Bestellung nicht ändern | `invoices` zur Bestellung, Job-Log | Rechnung über die Rechnungsfunktion nacherzeugen |
| 7 | PDF fehlt | Kundenlink nicht erneut versenden | `document_files` und Storage-Bucket `documents` | Dokument neu erzeugen; Nummernkreis bleibt unverändert |
| 8 | E-Mail-Provider ausgefallen | Versand pausieren | `communications` Status, Provider-Events | Nachversand nach Wiederherstellung; keine Duplikate erzwingen |
| 9 | Absenderdomain fehlerhaft | Versand über diese Domain stoppen | Domain-Status im Integration Center, DNS prüfen | DNS korrigieren, Verifikation erneut anstoßen |
| 10 | Carrier nicht erreichbar | Labelerzeugung pausieren | Integration Health, Provider-Status | Später erneut versuchen; Duplicate-Label-Schutz beachten |
| 11 | Tracking hängt | Kunden mit Zwischenstand informieren | `tracking_events` letzter Eintrag | Manuelles Update erfassen, Carrier kontaktieren |
| 12 | Kompromittierter Store-API-Key | Key sofort widerrufen (`/app/entwickler/api`) | `store_api_request_logs` auswerten | Neuen Key mit Origin-Restriction ausgeben, Storefront umstellen |
| 13 | Kompromittierter Provider-Key | Key beim Provider sperren | Provider-Log auf Fremdnutzung | Rotation nach Secret-Rotation-Runbook, Webhook-Secret mitrotieren |
| 14 | Kompromittierter Admin-Account | Mitgliedschaft entziehen, Sitzung beenden | Audit-Log der letzten 24 h | Passwort-Reset, Rollen prüfen, Owner-Schutz greift |
| 15 | Datenleckverdacht | Zugriffe einschränken, nichts löschen | betroffene Tabellen und Logs sichern | Meldepflicht fachlich prüfen — [FACHLICH/RECHTLICH PRÜFEN] |
| 16 | Cron ausgefallen | Job manuell auslösen | `/app/system/jobs`, letzte Laufzeit | Zeitplan neu setzen; Jobs sind idempotent |
| 17 | Queue-Backlog | keine parallelen Läufe starten | `automation_jobs` und `outbox_events` Rückstau | Ursache beheben, Backlog kontrolliert abarbeiten |
| 18 | Fehlerhafte Migration | keine Rückmigration erzwingen | Fehlermeldung und angewandte Migrationen | Forward Fix nach `docs/production/MIGRATION_RUNBOOK.md`; Restore nur nach `DISASTER_RECOVERY_RUNBOOK.md` |
| 19 | Datenbankausfall | Maintenance Mode, Kommunikation an Kunden | Plattformstatus, Health-Check | Wiederherstellung nach `DISASTER_RECOVERY_RUNBOOK.md` |
| 20 | Storage-Datei fehlt | Downloadlink deaktivieren | `document_files` vs. Bucketinhalt | Dokument neu erzeugen; bei Medien Originaldatei erneut hochladen |

## Eskalation

| Stufe | Auslöser | Rolle |
| --- | --- | --- |
| 1 | Einzelner Kunde betroffen | Support |
| 2 | Checkout, Zahlung oder Bestellungen betroffen | Betreiber |
| 3 | Datenleck, Datenverlust, Ausfall > 30 min | Owner |

Kontakte und Rufbereitschaft: [FACHLICH/RECHTLICH PRÜFEN] — vom Betreiber einzutragen.
