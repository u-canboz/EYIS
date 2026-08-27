# Offene Punkte und Go-live-Blocker nach Gate B

Stand 2026-08-27. Status ausschließlich PASS, FAIL, OFFEN oder BLOCKED.
Kein Punkt dieser Liste ist ein FAIL — es gibt keine bekannte fehlerhafte Funktion.

## BLOCKED — externe Voraussetzung, nicht durch einen Agenten lösbar

| # | Punkt | Was fehlt | Wer |
| --- | --- | --- | --- |
| 1 | Getrennte Staging-Umgebung | zweites Cloud-Projekt, eigene Secrets, eigene Buckets | Betreiber; Ablauf in `STAGING_SETUP_RUNBOOK.md` |
| 2 | Getrennte Production-Umgebung | drittes Cloud-Projekt, leer und unveröffentlicht | Betreiber |
| 3 | Staging-E2E und Isolationsnachweise (B7) | Umgebung aus 1 | folgt automatisch |
| 4 | Stripe Live | Live-Key, Webhook-Signing-Secret, registrierte Webhook-URL | Betreiber |
| 5 | Echter E-Mail-Versand | verifizierte Absenderdomain (SPF/DKIM/DMARC), Provider-Zugangsdaten, Sender-Identity | Betreiber |
| 6 | Carrier-Labels | DHL-Vertragsnummer und API-Zugang | Betreiber |
| 7 | Vollständiger Schema-Replay auf frischem Projekt | Zielprojekt aus 1 | folgt automatisch |

## OFFEN — machbar, bewusst nicht in Gate B umgesetzt

| # | Punkt | Grund | Nächster Schritt |
| --- | --- | --- | --- |
| 8 | Screenreader-Stichprobe (NVDA/VoiceOver) | in dieser Umgebung kein Screenreader | manuelle Abnahme durch einen Menschen |
| 9 | Production-Performance-Budgets | nur gegen Produktionsbuild in getrennter Umgebung messbar | nach Punkt 1 |
| 10 | Lastprofil über 10 parallele Abrufe | Dev-Server ist nicht lastrepräsentativ | nach Punkt 1 |
| 11 | Automatische Löschjobs (Kommunikationen 3 Jahre, Store-API-Protokoll 90 Tage, Audit 2 Jahre) | wäre neue Funktion | eigener Betriebs-Job nach Go-live |
| 12 | Datenexport für Datenübertragbarkeit | wäre neue Funktion | nach Freigabe |
| 13 | Virenscan für Uploads | externer Dienst nötig | Anbieterauswahl |
| 14 | Pixelgenaue Designabnahme | Harness prüft Geometrie, nicht Gestaltung | menschliche Abnahme |
| 15 | CSP von Report-Only auf durchsetzend umstellen | erst nach Beobachtung echter Reports | nach Punkt 1 |
| 16 | Monitoring-/Alerting-Oberfläche | Gate C | Gate C |

## Was für Go-live erfüllt ist

Mandantentrennung und RLS (52/52), Storage-Sicherheit (35/35), API-Sicherheit (32/32),
Datenschutz und Datenlebenszyklus (26/26), Jobs und Cron-Auth (21/21), Migrations-Integrität
(10/10), Datenintegrität (15/15), Store API v1 (52/52), Demo-/QA-Daten (44/44),
UI-Regression (14/14), automatisierte Accessibility (8/8), Performance-Budgets (15/15).
