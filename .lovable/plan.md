# Commerce OS — Dedicated Instance Installer & Project Template

Ziel: Commerce OS so paketieren, dass derselbe Core auch als eigenständige Installation in einem
neuen Kundenprojekt läuft — eigene Datenbank, eigene Auth, eigener Storage, eigene Secrets, ohne
Verbindung zu einer zentralen Instanz. Es entsteht **keine** zweite Engine.

## 0. Was die Plattform kann und was nicht (ehrliche Grenze)

Geprüft im Repository: Migrationen liegen als 51 Dateien in `supabase/migrations/`, werden aber
über die Plattform-Migration angewandt, nicht über ein eigenes CLI. Ein Projekt kann sich selbst
keine zweite Cloud-/Postgres-Instanz erzeugen.

Daraus folgt die Aufteilung:

| Schritt | Wer |
| --- | --- |
| Neues Lovable-Projekt + eigene Cloud-Instanz (DB, Auth, Storage) | Plattformaktion durch Owner/Agent im neuen Projekt — dokumentiert, nicht simuliert |
| Schema anlegen (alle Migrationen in Reihenfolge) | Agent im neuen Projekt über die Migrations-Datei-Liste des Templates |
| Storage-Buckets, Auth-Einstellungen, Cron | Agent über die Plattform-Tools, mit exakter Checkliste |
| System Seed, Organization, Main Shop, Owner, Defaults, Publishable Key | automatisiert über `commerce:bootstrap` bzw. Setup-Wizard |
| Prüfung des Gesamtzustands | automatisiert über `commerce:doctor` + Readiness-Seite |

Es wird **keine** Installer-UI gebaut, die Provisionierung nur vortäuscht.

## 1. Deployment Mode

- Neue serverseitige Einstellung `COMMERCE_DEPLOYMENT_MODE` (`shared` | `dedicated`), gelesen
  ausschließlich serverseitig, analog zum bestehenden `APP_ENV`-Resolver in
  `src/lib/commerce/environment.ts`. Unbekannter Wert = harter Fehler, kein stilles Default.
- Der Modus steuert **keine** Sicherheitslogik. Er beeinflusst nur: UX-Vereinfachung
  (Org-/Shop-Switcher), Setup-Wizard-Sichtbarkeit und Doctor-Erwartungen.
- Datenmodell bleibt unverändert mehrmandantenfähig: eine Organization, ein Shop, ein Owner.

## 2. Installationszustand

Eine neue Tabelle `commerce_installation` (eine Zeile pro Instanz) mit `installation_id`, `mode`,
`core_version`, `schema_version`, `api_version`, `sdk_version`, `installed_at`,
`last_migrated_at`, `setup_completed_at`, `health_status`. Grants + RLS nach Projektregel:
lesbar für Organisationsmitglieder, schreibbar nur serverseitig.

Begründung: Bestehende Settings-Tabellen sind shop-gebunden; ein Installationszustand ist
instanzweit und wird von Bootstrap, Doctor und Update-Pfad gebraucht.

## 3. Bootstrap

`bun run commerce:bootstrap` — dünnes CLI über eine bestehende Server-Route/Server-Funktion,
keine eigene Datenbanklogik im Skript.

Ablauf, strikt idempotent und in dieser Reihenfolge:

```text
1  Umgebung auflösen (unknown -> Abbruch)
2  Datenbankverbindung + Schemaversion prüfen
3  Migrationsstand prüfen (fehlende Migration -> Abbruch mit Liste)
4  Storage-Buckets prüfen
5  System Seed (Rollen, Permissions, Blueprints, Referenzdaten)
6  Organization + Main Shop + Owner-Membership
7  Default-, Tax-, Invoice-, Return-, Shipping-Settings
8  Integration Center initialisieren (alle Provider: not_connected)
9  Publishable Key erzeugen (Origin-Restriction leer, muss gesetzt werden)
10 Cron/Jobs prüfen
11 Health-Lauf, Ergebnis in commerce_installation schreiben
```

Zweiter Lauf meldet „Installation bereits vorhanden“ und ändert nichts.
Production-Guard bleibt aktiv: kein Demo-Seed, keine QA-Fixtures, keine Test-Provider als Live.

## 4. System Seed vs. Demo Seed

Strikte Trennung. `src/lib/commerce/demo/**` bleibt Demo und bleibt in Production gesperrt.
Neuer, separater System-Seed enthält ausschließlich Rollen, Permissions, System-Blueprints und
notwendige Referenz-/Default-Daten — produktionstauglich.

## 5. Setup-Wizard im Backoffice

Neue Route unter `/app/system/einrichtung`, im Dedicated Mode nach Login erzwungen, solange
`setup_completed_at` leer ist. Zehn Schritte nach Vorgabe (Unternehmen, Shop, Administrator,
Steuern, Rechnungen, Zahlungen, E-Mail, Versand, Storefront, Systemcheck). Jeder Schritt
schreibt über **bestehende** Server-Funktionen; der Wizard ist reine Oberfläche plus
Fortschrittszustand. Provider werden nie automatisch als bereit markiert.

## 6. Doctor & Readiness

`bun run commerce:doctor` prüft: Datenbank, Migrationsstand, RLS, Grants, Storage, Auth,
System Seeds, Store API, SDK-Kompatibilität, Jobs/Cron, Provider Vault, Health. Ausgabe als
Tabelle mit `PASS | FAIL | SETUP REQUIRED | BLOCKED`, Exit-Code ungleich 0 bei FAIL.

Dieselben Prüfungen speisen die bestehende Seite `/app/system/release-readiness`, ergänzt um den
Block „Installation“.

`bun run verify` bleibt unverändert; Doctor ist zusätzlich und braucht eine erreichbare Datenbank.

## 7. Installer-Manifest

`commerce-os-installer.manifest.json`, generiert von `bun run generate:manifests` (kein Handbetrieb,
keine Secrets): Core-/Schema-/API-/SDK-Version, benötigte Abhängigkeiten, benötigte
Environment-Variablen (nur Namen), Pflichtrouten, Buckets, Migrationsbereich, System Seeds,
Health Checks. `docs:validate` prüft die Aktualität mit.

## 8. Dokumentation

Neu:
- `docs/agent/DEDICATED_DEPLOYMENT.md` — Architektur, Same-Origin, Grenzen, Secrets pro Instanz
- `docs/agent/INSTALL_COMMERCE_OS_IN_EXISTING_PROJECT.md` — 15-Schritte-Runbook inkl.
  Konfliktprüfung (Router, Auth, Cloud-Anbindung, Env, Tailwind/UI, Storage, `/app`, `/portal`,
  `/store`, API-Routen, Paketversionen) — Konflikte werden vor jeder Änderung aufgelistet
- `docs/agent/DEDICATED_INSTALL_AGENT_PROMPT.md` — kopierbarer Prompt
- `docs/agent/NEW_DEDICATED_PROJECT_PROMPT.md` — kopierbarer Prompt für Neuprojekte
- `docs/agent/DEDICATED_UPDATE_STRATEGY.md` — 1.0.0 → 1.1.0: Backup, Code-Update, Migrationen,
  Doctor, Regression; keine Production-Migration ohne Backup
- `docs/production/DEDICATED_BACKUP.md` — Backup-/Restore-Status pro Instanz

Aktualisiert: `AGENTS.md` (Betriebsart C konkretisiert), `docs/agent/OPERATING_MODES.md`,
`START_HERE.md`, `ARCHITECTURE_MAP.md`, `MODULE_REGISTRY.md`, `qa/PHASE17-AGENT-READINESS.md`
(die acht geforderten Fragen müssen aus dem Repository beantwortbar sein).

Empfohlener Weg wird klar benannt: **Template zuerst**, Nachrüstung in ein bestehendes Projekt als
zweiter, dokumentierter Weg.

## 9. Dedicated-UX

Bei genau einer Organisation entfällt der permanente Org-Switcher, bei genau einem Shop wird der
Shop-Switcher kompakt. Sobald ein zweiter Datensatz existiert, erscheinen beide wieder.
Es wird nichts aus dem Datenmodell entfernt.

## 10. QA

- `qa:dedicated-bootstrap` — leere Ausgangslage → Bootstrap → System Seed → Owner → Shop →
  Publishable Key → Demo-Seed (nur Dev) → Referenz-Storefront → Cart → Checkout → Testzahlung →
  Order → Rechnung → Admin → vollständiger Cleanup
- `qa:dedicated-doctor` — Doctor gegen Dev, Prüfung aller Statuszeilen
- Isolationstest: keine Anfrage an eine zentrale Commerce-Instanz (nur Provider-Hosts erlaubt)
- Bericht `qa/PHASE21-DEDICATED-REPORT.md` + `qa/results-phase21-dedicated.json`,
  Status ausschließlich PASS, FAIL, OFFEN, BLOCKED
- Die QA „Installation in ein bestehendes fremdes Projekt“ ist aus diesem Repository heraus nicht
  ausführbar und wird ehrlich als BLOCKED mit Begründung geführt, statt sie zu simulieren.

## 11. Was unverändert bleibt

Pricing, Tax, Cart, Checkout, Payments, Orders, Inventory, Documents, Fulfillment, Returns,
Communications, Automation, Store API v1, SDK-Grenzen, RLS, Provider Vault, Cron-Auth, Audit,
unveränderliche Journale. Dedicated ist nur eine andere Bereitstellungsform. Store API v1 bleibt
rückwärtskompatibel; Storefront spricht auch dedicated ausschließlich über SDK → Public Store API.

## 12. Abschluss

`bun run generate:manifests`, `bun run verify` und die neuen QA-Läufe gegen Dev müssen grün sein;
offene Punkte und Blocker werden im Bericht geführt.
