# Job-Runbook — Cron, Queues, Monitoring

Stand: 2026-08-26 (Gate A8). Beschreibt alle Hintergrundprozesse, ihre Zeitpläne,
Fehlerbehandlung und die operativen Eingriffe im Störungsfall.

## Cron-Endpunkte

Alle Endpunkte verlangen `Authorization: Bearer <LOVABLE_CRON_SECRET>`
(plattformverwaltet, siehe SECRET_ROTATION_RUNBOOK.md). Ohne oder mit falschem
Token: HTTP 401. Die Authentifizierung ist zentral in
`src/integrations/supabase/cron-auth.ts` implementiert (timing-safe, mit
Vorgänger-Secret für Rotationen).

| Endpunkt | Zeitplan | Zweck |
| --- | --- | --- |
| `POST /api/public/jobs/automation` | */1 min | Automation-Worker: hängende Jobs freigeben (Reclaim > 15 min), fällige Schedule-Regeln einreihen, bis zu 25 Jobs claimen und ausführen |
| `POST /api/public/jobs/communications` | */1 min | Kommunikations-Queue: bis zu 50 fällige/wiederholbare Nachrichten senden |
| `POST /api/public/jobs/expiration` | */5 min | Ablauf via `ops_expire_due()`: Checkout-Sessions, Inventory-Reservierungen, Warenkörbe expiren lassen |

Die Zeitpläne sind in der Plattform als Cron-Jobs auf die jeweilige
Umgebungs-URL konfiguriert (Development: Preview-URL; Staging/Production: OFFEN,
siehe ENVIRONMENT_MATRIX.md).

## Queue-Semantik

### automation_jobs

- **Claiming** erfolgt atomar über die DB-Funktion `automation_claim_jobs`
  (`FOR UPDATE SKIP LOCKED`) — parallele Worker-Invokationen sind sicher.
- **Job-Typen**: `resume_execution` (Engine fortsetzen), `scheduled_rule`
  (Intervall-Regel ausführen). Unbekannte Typen → `failed` mit
  `invalid_configuration`.
- **Retry-Backoff** bei Ausnahmen: 60s → 300s → 1.800s → 7.200s → 21.600s
  (nach `attempts`), danach `failed` mit `max_attempts`.
- **Engine-interne Retries** (z. B. `webhook.send` mit Timeout/5xx/429):
  die Execution bleibt `queued`, ein neuer `resume_execution`-Job mit Backoff
  wird eingeplant (`scheduleResume`).
- **Reclaim**: Jobs mit `status='running'` und `locked_at` älter als 15 Minuten
  gelten als verwaist (Worker abgestürzt) und werden auf `pending`
  zurückgesetzt.

### outbox_events

Domain-Events werden transaktional in die Outbox geschrieben und vom
Automation-Worker konsumiert. `pending`-Events mit altem `created_at` sind ein
Warnsignal — sichtbar in `/app/system/jobs` („Ältestes offenes Event").

### communications

Nachrichten durchlaufen `queued → sending → sent/delivered` bzw. `failed`.
Zustellstatus läuft über Provider-Webhooks (`/api/public/webhooks/communications/{provider}`).

## Monitoring-Oberflächen

| Route | Inhalt | Rolle |
| --- | --- | --- |
| `/app/system/jobs` | Job-Stati, fällige/hängende Jobs, Outbox-Aggregate, Kommunikations-Queue, letzte Jobs und Executions | owner, administrator, operations |
| `/app/system/status` | DB-Latenz, Mengengerüst, Provider-Modi (test/live), Cron-Endpunkte | owner, administrator, operations |
| `/app/system/errors` | Zusammengeführter Fehler-Feed: Jobs, Executions, Kommunikation, Zahlungen, Store API, Outbox | owner, administrator, operations |
| `/app/system/health` | 45 Datenintegritäts-Checks (Gate A5) | owner, administrator, operations |

Alle vier Oberflächen sind read-only. Die Rollenprüfung erfolgt serverseitig
(`has_org_role`), Cross-Tenant-Zugriff ist ausgeschlossen (belegt in
`qa/results-phase14-jobs.json`).

## Störungsfälle

### Jobs bleiben auf `pending` stehen

1. `/app/system/jobs` prüfen: „fällig" > 0 ohne Fortschritt → Worker läuft nicht.
2. Cron-Konfiguration der Plattform prüfen (Zeitplan, URL, Secret).
3. Endpunkt manuell anstoßen:
   `curl -X POST -H "Authorization: Bearer $LOVABLE_CRON_SECRET" <base>/api/public/jobs/automation`
4. Antwort `401` → Secret rotiert/abweichend → SECRET_ROTATION_RUNBOOK.md.

### Viele Jobs `failed` mit `max_attempts`

1. `/app/system/errors` öffnen, Fehlercode und Meldung lesen.
2. Ursache beheben (z. B. Provider down, Fehlkonfiguration).
3. Jobs NICHT massenhaft zurücksetzen, ohne die Ursache zu kennen — die
   Fehlermeldung geht dabei verloren. Einzelne Jobs nach Fix manuell auf
   `pending` setzen (SQL, siehe unten).

### Outbox-Rückstand wächst

1. `/app/system/jobs`: „Ältestes offenes Event" prüfen.
2. Automation-Worker manuell anstoßen (siehe oben).
3. Bleibt der Rückstand: `outbox_events` mit `status='failed'` in
   `/app/system/errors` prüfen.

### Häufige manuelle Eingriffe (SQL, mit Bedacht)

```sql
-- Einzelnen fehlgeschlagenen Job erneut anstellen (nach Ursachenfix)
update automation_jobs
set status = 'pending', attempts = 0, available_at = now(),
    locked_at = null, locked_by = null
where id = '<job-id>';

-- Verwaiste laufende Jobs sofort freigeben (statt 15 min warten)
update automation_jobs
set status = 'pending', locked_at = null, locked_by = null
where status = 'running' and locked_at < now() - interval '15 minutes';
```

## Alarmierung (V1)

Eine aktive Alarmierung (E-Mail/Webhook bei Schwellenwerten) ist in V1 nicht
ausgebaut — die vier Systemoberflächen sind die vorgesehene Kontrollinstanz.
Empfohlene manuelle Prüfintervalle bis Gate B: täglich `/app/system/errors`,
wöchentlich `/app/system/health`. Aufnahme in den Post-V1-Backlog.
