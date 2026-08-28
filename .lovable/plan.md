# Phase 22 — Update Center & One-Click Updater (EYIS Dedicated)

## 0. Zuerst geklärt: Gibt es einen echten Deployment-Weg?

Ja — aber nicht in der laufenden App selbst. Eine laufende Lovable-Instanz kann ihren eigenen
kompilierten Quellcode nicht überschreiben. Deshalb:

- **Transport: GitHub.** Die Installation löst per `repository_dispatch` einen Deploy-Workflow im
  Repo `u-canboz/EYIS` aus (Fine-grained Token, serverseitig als Secret, nie im Client).
- **Registry: GitHub Releases** desselben Repos. Manifest, Checksum und Signatur liegen als
  Release-Assets. Keine erfundene Domain; eine eigene HTTPS-Registry bleibt konfigurierbar.
- **Ohne Token/Workflow/Registry-Konfiguration** zeigt das Update Center `SETUP REQUIRED` —
  niemals „Update erfolgreich“. Kein Fake-Updater, keine simulierten Schritte.

Was der Händler sieht, bleibt trotzdem: *Update verfügbar → Jetzt aktualisieren → Fertig*.

## 1. Ownership-Grenzen

EYIS-owned (updatefähig): Commerce Engines, Backoffice Core, Store API, Store SDK, Systemmodule,
Integration Center, Security Layer, Migrationen, System-Seeds, Doctor, Update Center.

Customer-owned (nie still überschrieben): Storefront-Design, Branding, Content, kundenspezifische
Seiten, dokumentierte Custom Components und Extensions.

Die Zuordnung wird als Manifest (`eyis-ownership.json`) im Repo gepflegt und vom Preflight gegen
Datei-Hashes geprüft. Kollision = Preflight FAIL mit Konfliktliste, Update startet nicht.

## 2. Datenmodell (eine Migration)

- `commerce_installation` erweitern: `installed_release_id`, `update_channel` (stable|beta|
  development, Default stable), `last_update_check_at`, `last_successful_update_at`,
  `system_seed_version`, `auto_update_policy` (manual|security_only|patch, Default manual),
  `maintenance_state`.
- `update_runs`: from/to-Version, `release_id`, Status, `initiated_by`, Zeiten,
  `deployment_reference`, `migration_from/to`, `backup_reference`, `current_step`, `error_code`,
  `safe_error_message`, `rollback_status`, `metadata`. Append-only, keine Löschung.
- `update_run_steps`: Position, Step, Status, Zeiten, `output_summary`, `error_code`.
- **Concurrency:** Partieller Unique-Index — höchstens ein Run in aktivem Status. Zwei Klicks
  erzeugen genau einen Run.
- Server-only wie `commerce_installation` (RLS an, keine Member-Policies, Zugriff nur über
  redaktierende Server Functions), plus GRANTs für `service_role`.
- Permissions: `system_updates.read|manage|install|channel`; Installation nur Owner/Administrator,
  Operations liest.

## 3. Release-Verifikation (Sicherheitskern)

`src/lib/commerce/updates/registry.server.ts`

1. Manifest über HTTPS von der Registry laden (nur Metadaten).
2. SHA-256-Checksum des Artifacts prüfen.
3. Signatur gegen den in der Installation hinterlegten **öffentlichen** Verifikationsschlüssel
   prüfen (Ed25519 via WebCrypto). Private Keys existieren nie in Kundeninstallationen.
4. Kompatibilität prüfen: `minimum_version`, Upgrade-Pfad, `api_version`, `sdk_version`,
   `schema_version`, `breaking`, `rollback_supported`.

Fehlschlag → `UPDATE_SIGNATURE_INVALID` / `UPDATE_CHECKSUM_INVALID`, sofortiger Abbruch.
Registry nicht erreichbar → Shop läuft normal weiter, UI meldet „Update-Prüfung derzeit nicht
möglich“.

## 4. Deployment-Adapter

```ts
interface UpdateDeploymentProvider {
  capabilities(); prepareRelease(); deployRelease();
  getDeploymentStatus(); cancelDeployment(); rollbackDeployment?();
}
```

- `github-actions.server.ts` — real: `repository_dispatch`, Workflow-Run-Polling, Status-Mapping.
- `manual.server.ts` — real, aber ohne Automatik: erzeugt Anweisungen, Owner bestätigt Deployment.
- Nicht implementierte Adapter erscheinen nicht als verfügbar.

Konfiguration und Status (Repo, Branch, letzter erfolgreicher Release) laufen über das bestehende
Integration Center, Muster wie bei Stripe/Resend; Token nur serverseitig als Secret.

## 5. Update-Ablauf (State Machine)

`available → preflight → ready → backup_check → maintenance → deploying → migrating → seeding →
verifying → completed`, dazu `failed`, `rolling_back`, `rolled_back`, `manual_attention`.
Übergänge nur über die Engine, keine freie Statusmutation.

**Preflight** prüft Installation (Dedicated, Versionen), System (Doctor, Health, RLS, Jobs,
Storage), Kompatibilität, Custom Overrides, Backup-Readiness, Betriebszustand (keine laufende
Payment-Finalisierung, keine laufende Migration, Queue akzeptabel), Deployment-Adapter.
Erst bei durchgehend PASS wird „Jetzt aktualisieren“ aktiv.

**Backup Gate:** Schemaändernde Updates ohne bekannte Restore-Möglichkeit = BLOCKED. Für Patches
gilt die Policy, aber der Schutz wird nie still umgangen.

**Maintenance Mode** (`maintenance_state = updating`): Katalog bleibt optional lesbar; Checkout-
Start, Payment-Session, neue Orders und kritische Mutationen werden mit klarem Fehlercode
blockiert. Laufende Zahlungen werden nicht abgebrochen — das Update wartet.

**Migrationen** kommen ausschließlich aus dem signierten Release, laufen als Chain von der
aktuellen `schema_version` aus, jede genau einmal. Empfohlene Strategie ist Expand → Deploy →
Migrate/Backfill → Contract; Breaking Changes werden nie in einem Schritt gefahren.

**System-Seeds** sind versioniert und idempotent, keine Demo-Daten, keine Kundendaten überschreiben.

**Verifikation** nach Deployment/Migration: `commerce:doctor`, Health Checks (DB, Schema, RLS,
Storage, Auth, Store API, SDK, Jobs, Provider Vault) und Smoke-Tests (Storefront-Config, Katalog,
Produktdetail, Cart, Checkout-Initialisierung, Admin-Login, Product Read, Order Read) — ohne echte
Zahlung.

**Aktivierung** erst wenn Deployment, Migration, Seed, Doctor, Health und Smoke PASS sind: dann
`core_version = newVersion`, Maintenance aus.

**Fehler:** Vor DB-Mutation → alter Stand bleibt aktiv. Nach Migration → kein blindes Zurück-
Deployment; Forward-Fix oder Restore, Zustand `manual_attention`. Rollback-Button nur wenn das
Manifest `rollback_supported: true` trägt.

**Recovery:** Der Run läuft serverseitig; Fortschritt kommt aus `update_runs`, nichts hängt am
Browser.

## 6. UI — `/app/system/updates`

Navigation „System → Updates“ mit Badge (`•1`), stärkere Kennzeichnung bei Security-Releases,
keine Bannerflut.

Installierte Version, verfügbare Version, Security-Kennzeichnung, verständliche Release Notes
(Neu / Verbessert / Behoben / Sicherheit, technische Details aufklappbar), Preflight-Ergebnis als
Statusliste, ein Button. Danach vertikale Step-Liste mit Live-Status; Mobil 390 px als primäre
Referenz, keine technischen Tabellen. Bestehende Bausteine (`SectionPanel`, `RecordRow`,
`StatusBadge`, `ActionMenu`) werden wiederverwendet.

Zusätzlich: Update-Historie aus `update_runs`, Kanal-Umschaltung nur für Owner/Developer.

## 7. Job, CLI, Audit

- Täglicher Job `checkForEyisUpdates()` unter `src/routes/api/public/jobs/` mit
  `authenticateCronRequest` — holt nur Manifeste, installiert nie.
- `bun run commerce:update-check` und `bun run commerce:update --to=<version>` nutzen exakt
  dieselbe Orchestrierung; kein zweiter, unsicherer Pfad.
- Audit: `update.check|started|completed|failed|rollback_started|rollback_completed|channel_changed`
  — ohne Secrets oder Artifact-Tokens.

## 8. QA und Nachweise

- `qa:update-e2e` — echter isolierter 1.0 → 1.1 Upgrade-Test auf Fixture (Organisation, Shop,
  Produkte, Preise, Bestand, Kunden, Orders, Rechnung, Provider-Config): Kundendaten, Storefront,
  Provider-Credentials, Orders und Rechnungen unverändert, neues Schema vorhanden, Doctor PASS.
- `qa:update-failures` — Failure Injection: falsche Signatur, falsche Checksum, inkompatible
  Ausgangsversion, Backup nicht bereit, Deployment-/Migration-/Seed-/Doctor-/Health-Fehler,
  Browser geschlossen, Doppelklick, Registry offline.
- Storefront-DOM-/Screenshot-Regression vor und nach dem Update.
- Provider-Regression: Stripe, PayPal, Mollie, Resend, SMTP weiterhin konfiguriert; Secrets werden
  nicht neu geschrieben.
- `bun run verify` grün, `qa/PHASE22-UPDATE-CENTER-REPORT.md` + `results-phase22-updates.json`.

## 9. Dokumentation

`AGENTS.md`, `docs/agent/DEDICATED_UPDATE_STRATEGY.md` (neu),
`docs/agent/DEDICATED_DEPLOYMENT.md`, `docs/agent/MODULE_REGISTRY.md`,
`docs/production/OPERATIONS_RUNBOOK.md`, `docs/production/INCIDENT_RESPONSE.md`.
Agentenregel: Bei einer Dedicated-Instanz mit funktionsfähigem Update Center werden Core-Updates
nicht mehr durch manuelles Kopieren von Core-Dateien durchgeführt.

## 10. Status-Ehrlichkeit

Alles ohne realen Nachweis bleibt `SETUP REQUIRED`, `OFFEN` oder `BLOCKED`: der GitHub-Token und
der Deploy-Workflow im Repo, der veröffentlichte Signing-Key samt erstem signierten Release und
die Backup-/Restore-Strategie sind betreiberseitige Schritte. Der Code dafür wird vollständig
gebaut und getestet, der Schalter bleibt beim Owner.

## 11. Grenzen

Commerce-Logik, Store API v1, RLS-Modell und bestehende Sicherheitsschichten bleiben unverändert;
neu sind ausschließlich das Update-Modul, sein Datenmodell und seine Oberfläche.
