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

Eine neue Tabelle `commerce_installation` mit `installation_id`, `mode`, `core_version`,
`schema_version`, `api_version`, `sdk_version`, `installed_at`, `last_migrated_at`,
`owner_claimed_at`, `setup_completed_at`, `health_status`.

**Singleton-Invariante.** Datenbankseitig erzwungen (Unique-Index auf einer konstanten
Singleton-Spalte), sodass je Instanz genau eine Installationszeile existieren kann.

**Server-only.** RLS aktiv ohne Lesepolicy für normale Mitglieder; Grants nur an `service_role`.
Das Backoffice liest den Installationsstatus ausschließlich über eine geprüfte Server-Funktion,
die vorher die Rolle des Aufrufers verifiziert.

Begründung: Bestehende Settings-Tabellen sind shop-gebunden; ein Installationszustand ist
instanzweit und wird von Bootstrap, Owner-Claim, Doctor und Update-Pfad gebraucht.

## 3. Zweistufige Installation: System Bootstrap → First Owner Claim

Der CLI-Lauf hat keine Browser-Session. Deshalb strikt getrennt.

```text
Provisioning → Migrationen → SYSTEM BOOTSTRAP (CLI)
→ erster Browser-Aufruf /app → Owner registriert sich
→ FIRST OWNER CLAIM (serverseitig, atomar) → Setup Wizard
```

### 3a. System Bootstrap — `bun run commerce:bootstrap`

Dünnes CLI über eine Server-Route, keine Datenbanklogik im Skript. Erzeugt **keine** Organisation,
keinen Shop und keinen Owner.

**Bootstrap Security (verbindlich).** Der Bootstrap ist ausschließlich über ein serverseitiges,
einmaliges Credential `COMMERCE_BOOTSTRAP_SECRET` erreichbar (timing-sicherer Vergleich). Das
Credential wird **ausschließlich als HTTP-Header** (`x-commerce-bootstrap-secret`) übergeben —
niemals als URL-Parameter (History-, Log- und Referrer-Leck). Kein anonymer und kein normal
authentifizierter HTTP-Aufruf darf ihn starten. Nach erfolgreicher Initialisierung ist der
Endpunkt dauerhaft gesperrt; jeder weitere Versuch antwortet mit `403
INSTALLATION_ALREADY_INITIALIZED`. Das Secret erscheint nie im Client, in Git, im Audit, in
der Outbox oder in Logs und wird nach der Installation entfernt bzw. rotiert (Runbook-Schritt).

Vorbedingungen (harte Abbruchmatrix):

| Zustand | Ergebnis |
| --- | --- |
| Schema vorhanden, Commerce OS nicht initialisiert, gültiges Bootstrap-Credential | Installation möglich |
| Fehlendes oder falsches Bootstrap-Credential | 403, kein Hinweis auf den Installationszustand |
| Commerce OS bereits initialisiert | 403 `INSTALLATION_ALREADY_INITIALIZED` |
| Migrationen fehlen | STOP — fehlende Migrationen werden aufgelistet |
| `APP_ENV` unbekannt oder ungültig | STOP |
| Modus `dedicated`, aber Verbindung/Konfiguration zu einem Shared-Commerce-Host erkannt | STOP |

Ablauf, strikt idempotent:

```text
1  Bootstrap-Credential prüfen
2  Umgebung auflösen und Deployment Mode prüfen
3  Zentral-Abhängigkeiten prüfen (siehe Abbruchmatrix)
4  Datenbankverbindung + Schemaversion prüfen
5  Migrationsstand gegen Manifest prüfen
6  Installation registrieren (Singleton-Zeile)
7  System Seed: Rollen, Permissions, System-Blueprints, Referenzdaten
8  Storage-Buckets prüfen
9  Cron/Jobs prüfen
10 Health-Lauf, Ergebnis in commerce_installation schreiben
11 Einmaligen Installation-Claim-Token erzeugen, nur den Hash speichern,
   den Klartext genau einmal in der CLI-Ausgabe zeigen
```

Zweiter Lauf ändert nichts und meldet den gesperrten Zustand.

### 3b. First Owner Claim — nur mit gültigem Claim

Der erste beliebige registrierte Benutzer darf eine Instanz **niemals** automatisch übernehmen.

```text
Bootstrap erzeugt Claim-Token (nur Hash in der DB, kurze Gültigkeit)
→ Owner öffnet /app/setup (kein Token in der URL)
→ fügt den Claim-Code einmalig in ein Eingabefeld ein
→ Claim-Code wird sofort serverseitig gegen eine kurzlebige,
  httpOnly-Setup-Session getauscht; der Klartext verbleibt nicht
  in Browser-History, Logs oder Referrer
→ registriert sich bzw. meldet sich an
→ Claim serverseitig geprüft (Hash, Ablauf, unbenutzt)
→ Organization + Main Shop + Owner-Membership
→ Token irreversibel invalidiert
```

**Claim-Transport (verbindlich).** Der Claim-Token erscheint zu keinem Zeitpunkt als
`?claim=...`-Query-Parameter. Übergabe ausschließlich per Formular-Eingabe (POST-Body) an
`/app/setup`, danach sofortiger Tausch gegen eine kurzlebige, sichere Setup-Session
(httpOnly, SameSite=Strict). Kein Token in URLs, Browser-History, Referrer-Headern oder Logs.

Alternativ darf eine vorab konfigurierte Owner-E-Mail als zusätzlicher Claim-Faktor dienen; ohne
gültigen Claim entsteht kein Owner.

Der Claim läuft serverseitig, **atomar und genau einmal** (Transaktion plus Bedingung auf
`owner_claimed_at IS NULL` und unbenutztem Token). Zwei parallele Claims ergeben exakt einen
Gewinner; der zweite erhält einen klaren Konfliktfehler und verändert nichts.

```text
1  Claim prüfen und sperren
2  Organization anlegen
3  Main Shop anlegen
4  Membership des authentifizierten Auth-Users = owner
5  Default-, Tax-, Invoice-, Return-, Shipping-Settings
6  Integration Center initialisieren (alle Provider: not_connected)
7  Publishable Key als disabled/setup_required anlegen
8  Token vernichten, owner_claimed_at setzen, Setup-Wizard starten
```

Es wird **kein** künstlicher Owner in der Datenbank erzeugt — der Owner ist immer ein echter
Auth-User. Solange `owner_claimed_at` leer ist, zeigt `/app` ausschließlich den Claim-/Setup-Prozess
und keine Backoffice-Module.

Der Publishable Key wird nie aktiv mit leerer Origin-Allowlist ausgeliefert. Er wird erst
aktiviert, wenn im Setup-Wizard eine Storefront-Origin hinterlegt ist.

Production-Guard bleibt in beiden Stufen aktiv: kein Demo-Seed, keine QA-Fixtures, keine
Test-Provider als Live.

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

„NONE" bedeutet präzise: **keine Abhängigkeit von einer anderen zentralen Commerce-OS-Instanz**
(Shared-Commerce-Host). Als erlaubt zählen ausdrücklich:

- die **eigene Dedicated-Infrastruktur** dieser Installation (eigene Lovable-Cloud-/Postgres-
  Instanz, eigene Auth, eigener Storage — konfiguriert über die eigenen Environment-Variablen)
- **explizit konfigurierte externe Provider** (Stripe, PayPal, Mollie, Resend, SMTP, Carrier)
  sowie sonstige bewusst eingerichtete Integrationen

Verboten und damit FAIL ist ausschließlich jeder Zugriff auf fremde Commerce-OS-Hosts
(API, Datenbank, Auth oder Storage einer anderen Instanz). Der Doctor prüft die aufgelösten
Verbindungsziele gegen eine interne Blockliste zentraler Commerce-Hosts, nicht gegen die eigene
Instanz oder legitime Provider-Endpunkte.

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

Empfohlener Weg (Weg A, Standard für Neukunden):

```text
Commerce OS Dedicated Template
        ↓
neues Kundenprojekt
        ↓
eigene Lovable Cloud (DB, Auth, Storage)
        ↓
Migrationen → Bootstrap
        ↓
Website/Design darauf aufbauen
```

Weg B nur für bereits bestehende Websites:

```text
Bestehende Lovable Website + Commerce OS Repository
        ↓
Agent analysiert Konflikte
        ↓
Dedicated Core installieren
        ↓
bestehendes Design bleibt erhalten
```

Ausdrücklich nicht empfohlen: fertige Website bauen und danach den kompletten Commerce-Core
hineinkopieren.

## 9. Dedicated-UX

Bei genau einer Organisation entfällt der permanente Org-Switcher, bei genau einem Shop wird der
Shop-Switcher kompakt. Sobald ein zweiter Datensatz existiert, erscheinen beide wieder.
Es wird nichts aus dem Datenmodell entfernt.

## 10. QA

- `qa:dedicated-bootstrap` — leere Ausgangslage → Bootstrap → System Seed → Owner → Shop →
  Publishable Key → Demo-Seed (nur Dev) → Referenz-Storefront → Cart → Checkout → Testzahlung →
  Order → Rechnung → Admin → vollständiger Cleanup
- `qa:dedicated-doctor` — Doctor gegen Dev, Prüfung aller Statuszeilen
- `qa:dedicated-security` — Negativtests: ungültiger Claim, abgelaufener Claim, Replay eines
  bereits verwendeten Claims, zwei parallele Owner-Claims (genau ein Gewinner), Bootstrap-Replay
  nach Installation, anonymer Bootstrap-Zugriff, Bootstrap mit falschem Credential
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
