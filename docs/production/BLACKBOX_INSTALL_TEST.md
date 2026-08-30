# EYIS Dedicated — Blackbox-Installationstest

Ziel: beweisen, dass ein frisches Kundenprojekt EYIS **ohne eine einzige manuelle
Code-Reparatur** installieren und betreiben kann. Erst wenn dieser Durchlauf sauber ist, wird
EYIS Dedicated V1 eingefroren und ein Stable Release getaggt.

Umgebung: neues, leeres Projekt mit eigener Datenbank. Kein Zugriff auf das EYIS-Hauptprojekt,
keine echten Zahlungen, keine echten Versandlabels.

---

## 0. Voraussetzungen im Hauptprojekt

| Punkt | Nachweis |
| --- | --- |
| Signierter Release vorhanden | `.github/workflows/eyis-release.yml` lief grün, `eyis-database-installer.signature.json` hängt am Release |
| `EYIS_PACK_SIGNING_KEY` als Repository-Secret hinterlegt | Workflow-Schritt „Signaturschlüssel vorhanden?" ist grün |
| `bun run verify` grün | letzter Lauf im Release-Workflow |

Ohne gültige Signatur führt `runFreshInstall` keine einzige SQL-Anweisung aus — das ist Absicht.

## 1. Kundenprojekt vorbereiten

1. Neues Lovable-Projekt anlegen, Datenbank aktivieren.
2. Eine einfache eigene Storefront bauen (Startseite, Header, Footer, eigenes CSS).
   Diese Dateien sind `customer_owned` und dürfen nach der Installation **unverändert** sein.

## 2. Installationsauftrag (wörtlich)

> Installiere EYIS Dedicated aus https://github.com/u-canboz/EYIS in dieses Projekt.
> Bestehendes Design behalten. Meine Administrator-E-Mail ist `<E-Mail>`.
> Halte dich an `installer/distribution/eyis-code-distribution.manifest.json`:
> Nur `install`-Pfade übernehmen, `customer_owned` niemals ersetzen, an
> `src/routes/__root.tsx` und `src/styles.css` ausschließlich den beschriebenen additiven
> Eingriff vornehmen. Danach `installer/database/` als Fresh Install einspielen und
> `bun run eyis:resources:provision` ausführen.

## 3. Prüfpunkte des Durchlaufs

Jeder Punkt ist PASS, FAIL, OFFEN oder BLOCKED. Kein PASS ohne Nachweis.

| # | Schritt | Erwartung |
| --- | --- | --- |
| 1 | Installation Pack | Signaturprüfung PASS, 43 Units + Seeds eingespielt, Journal vollständig |
| 2 | Fingerprints | `schema_fingerprint` **und** `system_seed_fingerprint` PASS |
| 3 | Kundenoberfläche | Startseite, Header, Footer, Farben, Schriften unverändert |
| 4 | Registrierung | Konto mit der Administrator-E-Mail anlegen |
| 5 | Owner Claim | Nach der Anmeldung automatisch Owner (`pending_owner_email`), ohne Claim-Code |
| 6 | Backoffice | `/app` lädt im `.eyis-admin`-Scope, ohne Kunden-Chrome |
| 7 | Produkt | Produktart **Textil**, Variante, Preis, Bestand |
| 8 | Veröffentlichen | Produkt `active` |
| 9 | Store API | `GET /api/public/store/v1/...` liefert Produkt inkl. serverseitigem Preis |
| 10 | Storefront | Produkt erscheint in der **bestehenden** Kundenoberfläche über das SDK |
| 11 | Warenkorb | Summen kommen vom Server, kein Client rechnet nach |
| 12 | Checkout | Bestellung mit Testzahlung, Bestand wird gebucht |
| 13 | Jobs | `bun run eyis:resources:provision` → drei Zeitpläne aktiv |
| 14 | Doctor | `/app/system` — alle Prüfungen PASS, insbesondere „Katalog (Preisauflösung)", „Kommunikation (Kernvorlagen)" und „Job-Zeitpläne (Cron)" |
| 15 | Verify | `bun run verify` grün |

**Abbruchregel:** Sobald ein Schritt nur durch Handanpassung am gelieferten Code funktioniert,
gilt der Test als FAIL. Der Defekt wird im Hauptprojekt behoben, ein neuer Release signiert und
der Durchlauf von vorn begonnen.

## 4. Nach bestandenem Durchlauf

1. Ergebnisse als `qa/PHASE26-BLACKBOX-INSTALL-REPORT.md` festhalten.
2. Stable Release taggen (`v1.0.0`) — der Workflow signiert das Pack.
3. Installationsbasis einfrieren. Weitere Änderungen laufen ausschließlich über Versionen und
   das Update Center (`docs/production/UPDATE_CENTER.md`), nicht mehr über Umbauten an der Basis.

## 5. Dauerhaft extern blockiert

Stripe Live, echter E-Mail-Versand mit verifizierter Absenderdomain und echte Carrier-Labels
bleiben BLOCKED und sind **nicht** Teil dieses Tests
(siehe `docs/production/KNOWN_LIMITATIONS.md`).
