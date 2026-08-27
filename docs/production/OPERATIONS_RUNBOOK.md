# Operations Runbook — Regelbetrieb

Störungen: `docs/production/INCIDENT_RESPONSE.md`.

## Täglich

| Aufgabe | Ort | Erwartung |
| --- | --- | --- |
| Health prüfen | `/app/system/health` | alle Prüfungen grün |
| Systemfehler sichten | `/app/system/errors` | keine neuen unbearbeiteten Fehler |
| Jobs und Queues | `/app/system/jobs` | kein Rückstau, letzte Läufe aktuell |
| Zahlungen ohne Bestellung | `/app/zahlungen` | keine offenen bezahlten Sessions |
| Integrationen | `/app/einstellungen/integrationen` | kein Provider im Fehlerzustand |

## Wöchentlich

- Store-API-Nutzung und Rate-Limit-Treffer prüfen (`/app/entwickler/protokoll`).
- Offene Retouren und Rückerstattungen prüfen.
- Backup-Status prüfen (`docs/production/BACKUP_POLICY.md`).
- Audit-Log auf Rollen- und Schlüsseländerungen sichten.

## Monatlich

- Restore-Drill nach `docs/production/DISASTER_RECOVERY_RUNBOOK.md`.
- Secret-Inventar gegen `docs/production/SECRET_REGISTER_TEMPLATE.md` abgleichen.
- Performance gegen `docs/production/PERFORMANCE_BUDGETS.md` messen.

## Maintenance Mode

Ablauf und Wirkung: `docs/production/GO_LIVE_RUNBOOK.md`, Abschnitt Wartung.
Grundsatz: begonnene Zahlungen und Checkout-Sessions werden nicht still verworfen.

## Monitoring

Vorhanden: Health-Endpunkte, Systemstatus, Fehlerliste, Job-Übersicht, Audit-Log,
`store_api_request_logs`. **Nicht vorhanden:** externe Alarmierung (Pager, E-Mail-Alarm).
Status: OFFEN — Alarmierungsziel ist eine Betreiberentscheidung.
