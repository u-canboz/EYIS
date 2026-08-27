# Go-live Runbook — Production Cutover

Status: **vorbereitet, nicht ausgeführt.** Production wird niemals automatisch aktiviert.
Voraussetzung ist die ausdrückliche Freigabe des Owners (Abschnitt 3).

## 1. Vorbedingungen

| # | Bedingung | Nachweis | Stand |
| --- | --- | --- | --- |
| 1 | Feature Freeze bestätigt | `docs/production/V1_SCOPE.md` | PASS |
| 2 | Release Candidate bestätigt | `qa/PHASE19-GATE-C-FINAL-REPORT.md` | PASS (1.0.0-rc.2) |
| 3 | Getrenntes Staging existiert | `qa/PHASE19-STAGING-SETUP-REPORT.md` | BLOCKED |
| 4 | Staging-E2E grün | `qa/PHASE19-STAGING-E2E-REPORT.md` | BLOCKED |
| 5 | Rollback-Test durchgeführt | `qa/PHASE19-ROLLBACK-REPORT.md` | BLOCKED |
| 6 | Provider live-fähig | `docs/production/PROVIDER_READINESS_MATRIX.md` | BLOCKED |
| 7 | Rechtliche Punkte bestätigt | `docs/production/LEGAL_GO_LIVE_CHECKLIST.md` | OFFEN |
| 8 | Backup und Restore geprüft | `docs/production/BACKUP_POLICY.md` | OFFEN |

Solange eine zwingende Zeile nicht PASS ist, findet kein Cutover statt.

## 2. Cutover-Schritte

1. Feature Freeze bestätigen, keine offenen Änderungen im Repository.
2. Backup der Production-Datenbank erstellen und Restore-Pfad bestätigen.
3. Release Candidate festhalten: Version, Git-Commit, letzte Migration.
4. Production-Migrationen anwenden — dieselben Dateien, dieselbe Reihenfolge, byte-identisch.
5. Secrets prüfen: `APP_ENV=production`, `APP_BASE_URL`, Cron-Secret, Provider-Secrets.
   Kein Secret aus Staging übernehmen.
6. Cron-Zeitpläne einrichten und einmal manuell verifizieren (`docs/production/JOB_RUNBOOK.md`).
7. Provider prüfen: Live-Keys aktiv, Webhook-Endpunkte registriert, Signaturprüfung greift.
8. Store-API-Key für die Live-Storefront erzeugen, Origin-Restriction setzen, Testkeys widerrufen.
9. Erlaubte Origins, Auth-Redirect-URLs und Webhook-URLs auf die Produktionsdomain setzen.
10. Domain und SSL prüfen (`docs/production/DOMAIN_AND_DNS_RUNBOOK.md`).
11. CSP-Status prüfen; Umstellung auf durchsetzend nur nach ausgewerteten Verstößen.
12. Smoke Test: Login, Produktseite, Warenkorb, Checkout bis Zahlungsstart, Portal, Health.
13. Testbestellung nach ausdrücklich freigegebener Methode. Keine echte Zahlung ohne Freigabe.
14. Monitoring und Alarmierung prüfen.
15. Shop öffnen (Maintenance Mode beenden).
16. Erste echte Bestellung vollständig begleiten: Zahlung, Bestellung, Rechnung, E-Mail, Versand.
17. Incident-Kontakte bereithalten (`docs/production/INCIDENT_RESPONSE.md`).
18. Rollback-Fenster von mindestens 24 h aktiv halten (`docs/production/ROLLBACK_PLAN.md`).

## 3. Owner-Freigabe

Vor Schritt 15 dokumentiert der Owner schriftlich:

```text
Release-Version:      1.0.0-rc.2 (oder Nachfolger)
Git-Commit:           <commit>
Schema-Stand:         <letzte Migration>
Freigebender Nutzer:  <E-Mail des Owners>
Zeitpunkt:            <UTC>
Bestätigte Checkliste: Release Readiness, Blocker, Recht, Provider, Staging-E2E, Rollback
```

Der zugehörige Audit-Eintrag trägt die Aktion `release.go_live_approved`. Er ersetzt keine
externe rechtliche Freigabe.

## 4. Wartung (Maintenance Mode)

Zielverhalten beim Cutover und bei Störungen:

| Bereich | Verhalten in Wartung |
| --- | --- |
| Store API Katalog | lesend verfügbar |
| Warenkorbänderungen | gesperrt |
| Checkout und Payment-Session | gesperrt |
| Bereits gestartete Zahlungen | laufen zu Ende, Webhooks werden weiter verarbeitet |
| Backoffice | für Owner und Betreiber erreichbar |
| Storefront | kundenfreundliche Wartungsmeldung |

Umsetzungsstand: **OFFEN** — ein zentral schaltbarer Wartungszustand ist in V1 nicht
implementiert. Ersatzweise gilt: Storefront-Key widerrufen (Checkout und Warenkorb sind sofort
gesperrt, Backoffice bleibt erreichbar), bereits gestartete Zahlungen werden über die Webhooks
regulär finalisiert. Eine echte Wartungsschaltung ist ein V1.1-Punkt und wird hier nicht
improvisiert.
