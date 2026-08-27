# V1 — Go-live-Blocker

Stand: 2026-08-27, Release 1.0.0-rc.2. Ein Blocker ist ein Punkt, der einen produktiven Betrieb
verhindert. Alle übrigen offenen Punkte stehen in `qa/PHASE19-GATE-C-FINAL-REPORT.md`.

| # | Blocker | Ursache | Wer löst es | Erforderlicher Schritt |
| --- | --- | --- | --- | --- |
| 1 | Keine getrennte Staging-Umgebung | nur ein Cloud-Projekt vorhanden; Agent kann kein zweites Projekt anlegen | Betreiber | `docs/production/STAGING_SETUP_RUNBOOK.md` abarbeiten |
| 2 | Keine getrennte Production-Umgebung | dito | Betreiber | eigenes Projekt anlegen, leer, unveröffentlicht |
| 3 | Staging-E2E nicht durchführbar | Folge von 1 | Betreiber/Agent | nach Einrichtung `qa/PHASE19-STAGING-E2E-REPORT.md` füllen |
| 4 | Rollback-Test nicht durchführbar | Folge von 1 | Betreiber/Agent | Forward-Fix-Test in Staging |
| 5 | Stripe-Testbetrieb nicht aktiv | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET` fehlen | Betreiber | Testwerte im Secret Store hinterlegen, Webhook-URL registrieren |
| 6 | Stripe Live nicht aktiv | Folge von 5, zusätzlich Live-Keys und eigener Live-Webhook | Owner | erst nach Test-E2E, Refund- und Trennungsnachweis |
| 7 | Kein echter E-Mail-Versand | kein API-Adapter mit Domain-Verifikation angebunden | Betreiber | Provider-Vertrag; Adapter ist V1.1-Arbeit |
| 8 | Keine verifizierte Absenderdomain | Folge von 7, DNS-Werte kommen vom Provider | Betreiber | Domain und DNS bereitstellen |
| 9 | SMTP nicht verfügbar | Laufzeit ohne verlässliche TCP/TLS-Sockets | — | dauerhaft BLOCKED, API-Provider verwenden |
| 10 | Kein echter Carrier | keine Carrier-Zugangsdaten, nur Mock-Adapter | Betreiber | Carrier-Vertrag oder manuellen Versandprozess abnehmen |
| 11 | Rechtliche Pflichttexte nicht bestätigt | Impressum, Datenschutz, AGB, Widerruf fehlen | Fachlich/Rechtlich | `docs/production/LEGAL_GO_LIVE_CHECKLIST.md` |
| 12 | Keine Produktionsdomain | nichts verbunden | Betreiber | `docs/production/DOMAIN_AND_DNS_RUNBOOK.md` |

Nicht blockierend, aber vor dem Go-live einzuplanen: CSP durchsetzen, Screenreader-Stichprobe,
Production-Performance-Budgets, Retention-Löschjobs, Upload-Virenscan, externe Alarmierung,
echte Wartungsschaltung.
