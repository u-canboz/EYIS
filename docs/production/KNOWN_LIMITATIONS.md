# Bekannte Einschränkungen — V1 (RC1)

Stand: 2026-08-25. Jede Einschränkung ist belegt; Vermutungen sind als `UNGEPRÜFT` gekennzeichnet.

## Blockiert durch fehlende externe Konfiguration

| Thema | Status | Nachweis | Auswirkung |
| --- | --- | --- | --- |
| Stripe Live-Zahlungen | BLOCKED | Secret-Inventur: nur `LOVABLE_API_KEY` und `LOVABLE_CRON_SECRET` vorhanden; `STRIPE_SECRET_KEY` und `STRIPE_WEBHOOK_SECRET` werden im Code gelesen, sind aber nicht gesetzt | Zahlungen laufen nur über den Mock-Provider |
| Echter E-Mail-Versand | BLOCKED | kein Versand-Provider in `communication_provider_configs` produktiv aktiv; `COMMUNICATION_WEBHOOK_SECRET` nicht gesetzt | Kommunikation nur über den Test-Provider |
| Carrier-Labels (DHL, DPD, GLS, UPS, Sendcloud) | BLOCKED | keine Provider-Zugangsdaten hinterlegt | Labels nur über den Mock-Carrier |
| Kommunikations- und Automations-Warteschlange im Betrieb | BLOCKED | `COMMUNICATION_JOB_SECRET` nicht gesetzt; die Route lehnt ohne Secret jede Anfrage mit 401 ab (`src/routes/api/public/jobs/communications.ts`) | Warteschlange wird nicht automatisch abgearbeitet |

## Funktional nicht enthalten

| Thema | Status | Nachweis |
| --- | --- | --- |
| ZUGFeRD, XRechnung, UBL | OFFEN | Formate im Enum `document_format` vorbereitet, Erzeugung nur `pdf` in `pdf.server.ts` |
| Getrennte Staging-Umgebung | OFFEN | nur ein Datenbankprojekt vorhanden; Bewertung folgt in A2 |
| Health-, Job- und Status-Oberflächen | OFFEN | keine Routen unter `src/routes/_authenticated/app/system/` außer `storefront-test.tsx` |
| Externe Alarmierung (E-Mail, Messenger, Pager) | OFFEN | nicht implementiert; in Gate A ausdrücklich nur interne Operational Inbox geplant |
| Mehrwährungsfähigkeit, Mehrsprachigkeit der Storefront | OFFEN | nicht Teil von V1 |

## Technisch bedingte Grenzen

- Edge-Laufzeit: keine Subprozesse, kein `sharp`/`canvas`, kein dauerhaftes Dateisystem. PDF-Erzeugung deshalb über `pdf-lib`.
- SSRF-Schutz für ausgehende Webhooks kann die Ziel-IP nicht an den Socket binden; stattdessen wird vor jedem Versuch neu über DNS-over-HTTPS aufgelöst und geprüft, Weiterleitungen werden nicht gefolgt (`webhook.server.ts`). Ein Rest-Risiko durch Rebinding zwischen Prüfung und Verbindung bleibt bestehen.
- Rate-Limits arbeiten mit einem täglich rotierenden IP-Hash; Nutzer hinter demselben NAT teilen sich damit ein Kontingent.
- Der Datenbank-Linter und ein tiefer Security-Scan wurden für RC1 noch nicht ausgewertet — geplant in A3/A4. Bis dahin gilt der Sicherheitsstand als `UNGEPRÜFT` über den Umfang der Phase-12-QA hinaus.
- Backup- und Wiederherstellungsfähigkeit sind bisher nicht getestet — geplant in A6. Es gibt derzeit **keinen** Nachweis für RPO oder RTO.
