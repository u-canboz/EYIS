# Commerce OS — Dedicated Instance Installer & Project Template

Ziel: Commerce OS so paketieren, dass derselbe Core auch als eigenständige Installation in einem
neuen Kundenprojekt läuft — eigene Datenbank, eigene Auth, eigener Storage, eigene Secrets, ohne
Verbindung zu einer zentralen Instanz. Es entsteht **keine** zweite Engine.

## 0. Drei getrennte Phasen: Provisioning → Migration → Bootstrap

Verbindlich getrennt. Eine leere Instanz kann noch keine Commerce-Serverfunktion aufrufen.

**Phase 1 — Provisioning (einzige externe Plattformaktion).** Owner/Agent legt das neue
Lovable-Projekt mit eigener Cloud-Instanz an: Datenbank, Auth, Storage. Wird dokumentiert, nicht
simuliert.

**Phase 2 — Migration.** Alle Commerce-OS-Migrationen (aktuell 51 Dateien in
`supabase/migrations/`) werden in Reihenfolge angewendet und gegen Manifest- und Schemaversion
geprüft. Storage-Buckets, Auth-Einstellungen und Cron werden nach Checkliste eingerichtet.

**Phase 3 — Bootstrap.** Erst danach: System Seed, Organization, Main Shop, Owner-Verknüpfung,
Default-Settings, Integration Center, Health Check — automatisiert über `commerce:bootstrap`
bzw. den Setup-Wizard.

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
`last_migrated_at`, `setup_completed_at`, `health_status`.

**Server-only.** RLS aktiv ohne Lesepolicy für normale Mitglieder; Grants nur an `service_role`.
Das Backoffice liest den Installationsstatus ausschließlich über eine geprüfte Server-Funktion,
die vorher die Rolle des Aufrufers verifiziert.

Begründung: Bestehende Settings-Tabellen sind shop-gebunden; ein Installationszustand ist
instanzweit und wird von Bootstrap, Doctor und Update-Pfad gebraucht.

## 3. Bootstrap

`bun run commerce:bootstrap` — dünnes CLI über eine bestehende Server-Route/Server-Funktion,
keine eigene Datenbanklogik im Skript.

### Vorbedingungen (harte Abbruchmatrix)

| Zustand | Ergebnis |
| --- | --- |
| Schema vorhanden, Commerce OS nicht initialisiert | Installation möglich |
| Commerce OS bereits initialisiert | STOP — keine zweite Installation |
| Migrationen fehlen | STOP — fehlende Migrationen werden aufgelistet |
| `APP_ENV` unbekannt oder ungültig | STOP |
| Modus `dedicated`, aber Verbindung/Konfiguration zu einem Shared-Commerce-Host erkannt | STOP |
| Kein authentifizierter Benutzer für die Owner-Verknüpfung | STOP |

### Ablauf, strikt idempotent

```text
1  Umgebung auflösen und Deployment Mode prüfen
2  Zentral-Abhängigkeiten prüfen (siehe Abbruchmatrix)
3  Datenbankverbindung + Schemaversion prüfen
4  Migrationsstand gegen Manifest prüfen
5  Storage-Buckets prüfen
6  System Seed (Rollen, Permissions, Blueprints, Referenzdaten)
7  Organization + Main Shop
8  Owner-Verknüpfung: den echten, authentifizierten ersten Auth-User als Owner eintragen
9  Default-, Tax-, Invoice-, Return-, Shipping-Settings
10 Integration Center initialisieren (alle Provider: not_connected)
11 Publishable Key als disabled/setup_required anlegen
12 Cron/Jobs prüfen
13 Health-Lauf, Ergebnis in commerce_installation schreiben
```

Es wird **kein** künstlicher Owner in der Datenbank erzeugt. Existiert noch kein echter Auth-User,
bricht Bootstrap mit einer klaren Anweisung ab (erst registrieren, dann Bootstrap).

Der Publishable Key wird nie aktiv mit leerer Origin-Allowlist ausgeliefert. Er wird erst
aktiviert, wenn im Setup-Wizard eine Storefront-Origin hinterlegt ist.

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

Zusätzlich weist der Doctor die Unabhängigkeit ausdrücklich nach:

```text
Central Commerce API dependency:      NONE
Central Commerce DB dependency:       NONE
Central Commerce Auth dependency:     NONE
Central Commerce Storage dependency:  NONE
```

Erlaubte ausgehende Ziele sind ausschließlich echte Provider (Stripe, PayPal, Mollie, Resend,
SMTP, Carrier) sowie explizit konfigurierte Integrationen. Jeder andere Fremdhost ist ein FAIL.

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
