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
`repository_dispatch`-Typ passt, Actions auf vollständige Commit-SHAs gepinnt.

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

Bei `lovable_sync` wird der Code aktualisiert, das Update aber nicht als vollautomatisch
ausgewiesen: der Publish-Schritt bleibt manuell und wird in der Oberfläche als solcher benannt.

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

Fehlschläge: Der bisherige Stand bleibt aktiv, der Wartungsmodus wird beendet, der Lauf endet in
`failed` bzw. `manual_attention` mit sicherer Fehlermeldung (nie Secrets, nie Tokens).

## Ownership-Grenze

Verbindliche Liste: `src/lib/commerce/updates/ownership.ts`. EYIS ersetzt Engine, SDK, Store-API,
Migrationen und Manifeste. Niemals überschrieben werden Storefront-Routen, Theme, Inhalte,
Markenassets, `.env` und `src/custom/**`. Bei Überschneidung gewinnt immer der Kunde.
