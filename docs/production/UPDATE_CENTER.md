# EYIS Update Center — Transportwege und Nachweise

Der Button **„Jetzt aktualisieren"** ist nur dann ein vollautomatisches Update, wenn drei
Transportwege real nachgewiesen sind. Ohne Nachweis lautet der Status **SETUP REQUIRED** und es
wird nichts gestartet. Es gibt keinen Schritt, der ohne echtes Ergebnis auf „passed" springt.

Oberfläche: `/app/system/updates` (Berechtigungen `system_updates.*`).

## Rollenverteilung der Repositories

```
u-canboz/EYIS                     Kunden-Repository (Dedicated)
  signierte Releases                .github/workflows/eyis-update.yml (Default-Branch!)
  eyis-release.json                 → holt Release + prüft Signatur/Prüfsumme
  eyis-release.json.sig             → ersetzt nur EYIS-owned Dateien
  Artefakt (tar.gz + SHA-256)       → bun run verify
                                    → supabase db push (nur wenn freigegeben)
                                    → Deployment-Nachweis über Health-URL
```

`repository_dispatch` startet einen Workflow ausschliesslich im Ziel-Repository und nur, wenn die
Workflow-Datei auf dessen Default-Branch liegt. Deshalb läuft das Update im Kunden-Repository; das
zentrale Repository ist reine Release-Registry.

Vorlage: `templates/customer-repo/.github/workflows/eyis-update.yml`.

## Nachweis 1 — Code-Update im Kunden-Repository

Geprüft zur Laufzeit: Repository erreichbar, Default-Branch ermittelt, Workflow-Datei vorhanden,
`repository_dispatch`-Typ passt, Actions auf vollständige Commit-SHAs gepinnt, `run-name` enthält die eindeutige Lauf-ID. Ein fremder Dispatch wird nie als Ersatz verwendet.

| Variable | Zweck |
| --- | --- |
| `EYIS_UPDATE_REPO` | Kunden-Repository (`owner/repo`) |
| `EYIS_UPDATE_EVENT_TYPE` | Dispatch-Typ, Standard `eyis-update` |
| `EYIS_GITHUB_APP_ID` / `EYIS_GITHUB_APP_INSTALLATION_ID` / `EYIS_GITHUB_APP_PRIVATE_KEY` | bevorzugt: GitHub App, kurzlebiger Installation Token, nur dieses Repo |
| `EYIS_GITHUB_TOKEN` | Übergang für wenige Installationen: fine-grained PAT |

Ab mehreren Dedicated-Installationen ist die GitHub App verbindlich: Installation Tokens sind
kurzlebig und auf einzelne Repositories und minimale Rechte begrenzt.

## Nachweis 2 — Production Deployment

GitHub-Sync ist **kein** Deployment.

| Hostingvariante | `EYIS_UPDATE_HOSTING` | Status |
| --- | --- | --- |
| Git-basiertes Hosting (Vercel, Netlify, Cloudflare Pages) | `git_auto_deploy` | **SUPPORTED**, sobald der Workflow einen `deploy`-Job hat und `EYIS_UPDATE_DEPLOY_HEALTH_URL` die neue Version meldet |
| Lovable-Hosting | `lovable_sync` | **SETUP REQUIRED** — neue Stände werden erst mit „Publish → Update" live; ein programmatischer Publish-Endpunkt ist nicht nachgewiesen |
| nicht deklariert | leer | **SETUP REQUIRED** |

Bei `lovable_sync` bleibt der automatische Start gesperrt. Der Betreiber muss Code-Übernahme,
Migration und „Publish → Update“ als betreuten Ablauf durchführen.

## Nachweis 3 — Datenbank-Migrationen

Die laufende App wendet keine Migrationen an. Nachgewiesen ist nur der Weg über den
Kunden-Workflow (`supabase db push` mit repo-eigenen Secrets `SUPABASE_DB_URL` /
`SUPABASE_ACCESS_TOKEN`) plus Freigabe über `EYIS_UPDATE_MIGRATIONS=enabled`.

Fehlt dieser Nachweis, sind **schemaändernde Releases gesperrt** (SETUP REQUIRED). Releases ohne
Migrationen laufen weiter; der Schritt „Datenbank" wird dann als `skipped` mit Begründung geführt.

## Weitere Voraussetzungen

| Variable | Zweck |
| --- | --- |
| `EYIS_RELEASE_REPO` | Registry, Standard `u-canboz/EYIS` |
| `EYIS_RELEASE_PUBLIC_KEY` | optionaler Override (roh, base64). Vertrauenswurzel bleibt der gepinnte Trust Anchor `installer/distribution/eyis-trust-anchor.json`; ein Override, der keinem aktiven Anchor-Schlüssel entspricht, wird abgelehnt. Auch der Kunden-Update-Workflow prüft ausschliesslich gegen den Anchor |
| `EYIS_UPDATE_BACKUP_PROOF` | Kennung der nachgewiesenen Sicherung; ohne Nachweis kein Update |
| `EYIS_UPDATE_DEPLOY_HEALTH_URL` | öffentlicher Endpunkt, der die aktive Version meldet |

## Ablauf und Zustände

```
preflight → backup → code → database → deployment → doctor
```

`update_runs` hält Status, Auslöser, Workflow-Referenz, Backup-Kennung, Fehlercode und
Rollback-Zustand; `update_run_steps` je Schritt Ergebnis und Kurzbegründung. Beide Tabellen sind
Systemtabellen ohne direkten Anwendungszugriff. Ein Datenbankindex erzwingt, dass immer nur ein
Lauf aktiv ist. Während eines Laufs steht die Installation auf `maintenance_state = updating`.

Die Store API antwortet während `updating` und `manual` für alle Shops der Dedicated-Organisation
mit HTTP 503, Code `MAINTENANCE` und `Retry-After: 30`. Das ist eine Sperre der Store API;
Backoffice, Provider-Webhooks und Jobs sind keine globale Datenbank-Schreibsperre.

Fehlschläge nach Start oder ein unbestätigter Dispatch lassen Wartung auf `manual`. Code und
Datenbank können bereits teilweise aktualisiert sein. Es gibt keinen behaupteten automatischen
Rollback. Vor Freigabe müssen Workflow, Deployment-Version, Migrationen und Doctor geprüft und
gegebenenfalls anhand des Disaster-Recovery-Runbooks wiederhergestellt werden. Ein Abbruch sendet
einen echten GitHub-Cancel; die Sperre bleibt bis zur Bestätigung erhalten.

## Ownership-Grenze

Verbindliche Liste: `src/lib/commerce/updates/ownership.ts`. EYIS ersetzt Engine, SDK, Store-API,
Migrationen und Manifeste. Niemals überschrieben werden Storefront-Routen, Theme, Inhalte,
Markenassets, `.env` und `src/custom/**`. Bei Überschneidung gewinnt immer der Kunde.


## Upgrade-Vertrag und Release-Identität

Das Update Center liest das tatsächliche signierte Builder-Format einschließlich `artifact.name`,
Größe, Hash und `channel: prerelease`. RCs erscheinen im Beta-Kanal. Numerische SemVer-Teile werden
numerisch sortiert (`rc.10 > rc.9`). Ältere Pakete ohne expliziten Vertrag werden als betreut markiert.
Abgelehnte Releases bleiben mit Begründung sichtbar. Ein Kanalwechsel verwirft die alte Prüfung.

Ein automatisches Release benötigt signierte `minFromVersion`, `migrations`, `seedVersion` und
`requiresManualStep: false`. Im Release-Workflow wird die getestete Mindestversion über die
Repository-Variable `EYIS_UPDATE_MIN_FROM_VERSION` angegeben; ohne sie bleibt das Paket betreut.
Der aktuelle Builder liefert alle historischen Migrationen mit. Deshalb ist der Migrationsadapter
auch bei einem reinen Code-Update konservativ erforderlich; `supabase db push` führt nur fehlende
Versionen aus. Seed-Änderungen müssen in Forward-Migrationen enthalten sein, kein erneutes Demo-Seeding.

`src/lib/eyis/installed-release.json` ist die Build-Identität. Der Builder setzt sie bei frischer
Installation auf die Paketversion; der Update-Verifier ergänzt nach geprüfter Übernahme den
Artefakt-Hash. `/api/public/install/version` liefert diese eingebundene Identität ohne Cache,
unabhängig vom Datenbankjournal. Die Versionsanzeige im Update Center ist das Installationsjournal.

## Voraussetzungen im Kundenprojekt

1. Die neue CLI `src/lib/eyis/update-cli.ts` und die Build-Identität müssen bereits aus einem
   geprüften Paket installiert sein. Alte Installationen benötigen diese einmalige betreute Umstellung.
2. Aktuelle Workflow-Vorlage auf den Default-Branch kopieren; Event-Typ muss zur App-Konfiguration passen.
3. App-Installation oder PAT mit Contents/Actions-Schreibrechten nur für das Kunden-Repository.
4. Git-basiertes Hosting muss auf den Default-Branch reagieren. Das ist beim Anbieter zu testen:
   ein Push mit GitHubs eingebautem Token startet keine weiteren GitHub-Actions-Workflows.
5. Workflow-Secret `EYIS_DEPLOY_HEALTH_URL` auf die HTTPS-URL `/api/public/install/version` setzen.
   App-Konfiguration `EYIS_UPDATE_DEPLOY_HEALTH_URL` verwendet dieselbe URL.
6. `EYIS_UPDATE_BACKUP_PROOF` ist eine vom Betreiber bestätigte Snapshot-Kennung. EYIS prüft dessen
   Vorhandensein, führt aber keinen Restore-Test beim Backup-Anbieter durch. Vor jedem Update erneuern.

## Verifizierte Übernahme

Der Workflow lädt Manifest, Signatur und Tarball. Die **bereits installierte** CLI verifiziert
Ed25519, Archiv- und Einzeldatei-Hashes sowie sichere Pfade vor dem ersten Schreibzugriff.
Symlinks einschließlich defekter Links, fehlende Identität, Downgrades und zu alte Ausgangsversionen
werden abgelehnt. Nur EYIS-Dateien werden ersetzt. `package.json`, Lockfile, Root und Styles bleiben
kundeneigen; fehlende Runtime-Abhängigkeiten werden additiv ergänzt. Bestehende inkompatible
Versionen brechen spätestens Typprüfung/Build ab und benötigen eine betreute Anpassung.

Code wird auf einem separaten Update-Branch geprüft. Danach laufen Migrationen; erst dann wird
per Fast-Forward auf den Default-Branch veröffentlicht. Der Health-Check vergleicht **Version und
Artefakt-Hash** exakt. Erfolg benötigt abgeschlossene Code-/Deploy-Jobs und, falls erforderlich,
den Database-Job sowie den anschließenden Doctor. Fehlende oder übersprungene Jobs gelten nicht als Erfolg.

## Lokale Nachweise

`bun run test` enthält echte Builder-Tarballs mit temporären Testschlüsseln, Manipulations- und
Ownership-Prüfungen, Versionsketten und Workflow-Korrelation. `bun run eyis:release:selftest:simulate`
prüft Signatur und Installer aus einem frisch entpackten Paket. Die realen Signierschlüssel bleiben
unangetastet. Ein externer GitHub-/Hosting-Update-Lauf ist damit noch nicht abgenommen.
