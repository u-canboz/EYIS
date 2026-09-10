# Update-Setup-Assistent

Ziel: Die fünf Nachweise auf `/app/system/updates` werden nicht mehr vom Kunden konfiguriert,
sondern vom Assistenten erkannt, gesetzt und nachgewiesen. Der Kunde klickt "Einrichtung starten"
und bekommt am Ende entweder "Bereit" oder genau einen benannten offenen Punkt.

## Verhalten

Neue Seite `/app/system/updates/einrichtung` (aus dem Update Center verlinkt), fünf Schritte,
jeder mit Status, Nachweis und – wenn nötig – einer Aktion, die der Assistent selbst ausführt.

1. **GitHub-Zugang** – Reihenfolge GitHub App → mitgelieferter Connector → PAT. Ohne Fund:
   Hinweis, dass der Zugang aus dem Installationspaket kommt, kein Kundeneintrag.
2. **Releases** – gepinnter Trust Anchor plus erreichbare Release-Registry. Wird geprüft, nicht
   eingegeben.
3. **Kunden-Repository** – Repository wird automatisch erkannt (Installationsdaten, Umgebung,
   sonst Auswahl aus den erreichbaren Repositories). Der Assistent schreibt danach eigenständig
   auf den Default-Branch: Workflow-Vorlage, Update-CLI und Release-Identität, falls sie fehlen
   oder veraltet sind. Bestehende, gleiche Inhalte werden nicht angefasst.
4. **Veröffentlichung** – Lovable veröffentlicht nicht automatisch. Der Schritt wird als bewusst
   bestätigter Handschritt geführt: Der Kunde bestätigt einmalig "Ich löse Publish nach jedem
   Update selbst aus", danach gilt der Nachweis als erfüllt und das Update Center erinnert nach
   jedem Lauf an Publish. Health-URL wird aus der Installation abgeleitet.
5. **Datenbank** – Der Datenbank-Zugang wird bereits bei der Installation erfasst. Der Assistent
   liest ihn von dort, hinterlegt ihn als Repository-Secret und prüft den Migrationsjob im
   Workflow. Fehlt er, zeigt der Schritt genau diesen einen Punkt.

Am Ende ein Sammelnachweis: erneuter Durchlauf der bestehenden Prüfung, Ergebnis wird gespeichert,
damit das Update Center beim nächsten Aufruf sofort "Bereit" zeigt.

## Technische Umsetzung

- **Persistenz statt Umgebungsvariablen**: neue Tabelle `public.eyis_update_settings`
  (Singleton, service_role-only, GRANT → RLS → Policy in derselben Migration) mit
  `customer_repo`, `hosting`, `health_url`, `publish_ack_at`, `publish_ack_by`,
  `db_secret_synced_at`, `last_setup_report`. `loadUpdateConfig()` in
  `src/lib/commerce/updates/providers.server.ts` liest künftig DB → Umgebung → Defaults aus
  `installer/distribution/eyis-update-defaults.json` (Reihenfolge in dieser Priorität), damit
  bestehende Installationen unverändert weiterlaufen.
- **Neues Servermodul** `src/lib/commerce/updates/setup.server.ts`:
  `detectSetupState`, `applyRepositoryProvisioning` (Workflow/CLI/Identity per GitHub Contents API
  committen), `syncDatabaseSecret` (Repo-Secret via libsodium-sealed Box), `acknowledgePublishStep`,
  `finalizeSetup`. Alle Schreibvorgänge laufen über `resolveGithubAuth` aus `github.server.ts`.
  Kein Secret wird geloggt oder zurückgegeben.
- **Server-Funktionen** in `updates.functions.ts` mit `requireSupabaseAuth` plus vorhandener
  Owner-/Rollenprüfung; Admin-Client erst nach Rechteprüfung per `await import(...)`.
- **UI**: `src/routes/_authenticated/app/system/updates.einrichtung.tsx` mit vorhandenen
  EYIS-Shell-Bausteinen (`PageHeader`, `Panel`, `States`), plus Verlinkung und Statusanzeige im
  bestehenden Update Center.
- **Ausliefern**: Migration in die Migrationskette und über `eyis:seeds:generate`/Generator in das
  Install Pack; `installer/distribution` und Ressourcenmanifest ergänzen, Manifeste mit
  `bun run generate:manifests` neu erzeugen, Pack neu signieren.
- **Tests**: Unit-Tests für Konfigurations-Priorität, Provisionierungs-Diff (idempotent) und
  Secret-Sync-Fehlerpfade; danach `bun run verify`.

## Nicht Teil dieser Arbeit

Kein automatisches Lovable-Publish, keine Änderung an Update-Ablauf oder Signaturprüfung, keine
neuen Edge Functions, keine Änderung der Store API v1.
