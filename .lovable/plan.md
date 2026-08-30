# Phase 26 — Blackbox-Defekte upstream beheben

Ziel: Eine Installation mit „Installiere EYIS Dedicated aus dem Repository in dieses Projekt. Bestehendes Design behalten." läuft in einem fremden Lovable-Projekt ohne eine einzige Handkorrektur durch. Kein Stable Release bis ein neuer Blackbox-Lauf ohne Handkorrekturen besteht.

## Bestätigter Ausgangsbefund

- `supabase/migrations/` enthält 57 Dateien, neueste `20260830200942`. Das Installer-Manifest steht auf `schema_version 20260828213156`, `migration_head 054`, 54 Migrationen, 43 Baseline-Units. Das Pack ist damit nachweislich stale.
- `scripts/installer/signature.ts` filtert signaturrelevante Dateien mit `existsSync(...)` (fehlende Datei verschwindet still aus dem Digest) und verifiziert gegen den `public_key`, der in derselben Signaturdatei steht.
- `src/lib/eyis/route-boundary.ts` führt `/portal` als Base-Prefix, obwohl Portal im Distribution-Manifest `optional` ist.
- `src/eyis/portal/PortalChrome.tsx` und `PortalOrderView.tsx` liegen unter `src/eyis/**` (Kategorie `install`), obwohl die Portal-Routen optional sind.
- `@/integrations/lovable/index` wird von Runtime-Code benutzt, ist aber plattformgeneriert und in keiner Distribution-Kategorie erfasst.
- `verify` = `docs:validate → typecheck → test → build`; kein Pack-Sync-, Route-Contract- oder Signature-Gate.

## Arbeitspakete

### A — Database Pack wieder synchron
1. Kanonische Datenbank auf den Stand aller vorhandenen Migrationen bringen, danach `eyis:database:baseline` komplett neu erzeugen: Units, Manifest, Migration Head, `migration_versions`, Schema Version, Fingerprint, Expected Objects, Ownership Inventory, Reconcile, Checksummen.
2. System Seeds neu erzeugen und Seed-Fingerprint, Resource- und Distribution-Manifest auf Kompatibilität prüfen. `eyis_cron_status()` und die Pending-Owner-Spalten/`claim_installation_owner_verified` müssen Teil der Baseline sein.

### B — Stale-Pack technisch unmöglich machen
3. Neuer Befehl `eyis:database:sync-check`: vergleicht Migrationsdateien, `migration_versions`, `schema_version`, `migration_head` und einen neu eingeführten `migration_set_fingerprint` (SHA-256 über alle Migrationsinhalte, im Manifest gespeichert). Abweichung → FAIL mit konkreter Ausgabe („newest migration X vs. pack Y“).
4. Regressionstest: simulierte Zusatzmigration ⇒ `verify` FAIL.

### C — Bootstrap V2 (atomar, resumable)
5. Reihenfolge in `runBootstrap()` umkehren: erst alle Read-Only-Preflights (Environment, Dedicated Mode, Schema-Fingerprint, Seeds, benötigte Funktionen, Claim-RPC, Resources, Runtime Config), dann Persistenz.
6. Neue SECURITY-DEFINER-RPC `bootstrap_eyis_installation(...)` (service-role only) schreibt Installation-ID, Modus, Versionen, Pending Owner, Recovery-Hash/Ablauf und Setup-State in einer Transaktion — COMMIT ALL oder ROLLBACK ALL.
7. Installations-State-Machine an der bestehenden Struktur erweitern (`NOT_INSTALLED … READY`, `FAILED_RECOVERABLE`). Ein unvollständiger Zustand meldet nie „already initialized“, sondern setzt fort. Sicherer Resume-/Recovery-Pfad ohne manuelles Löschen; Kundendaten bleiben unangetastet.
8. Zwei Regressionstests: Fehler vor Persistenz ⇒ keine Zeile, zweiter Lauf PASS. Fehler nach Commit ⇒ Status recoverable, zweiter Lauf setzt fort.

### D — Datenbank-Transport ohne SQL-Bridge
9. Offizieller Transport: Installer bestimmt die nächste verifizierte Unit, liefert Pfad/SHA-256/erwarteten Journalzustand (`eyis:install:next`), das SQL wird über das Plattform-Migrationswerkzeug angewendet, danach `eyis:install:verify-unit`. Fehlt das Werkzeug: BLOCKED.
10. Regressionstest: Anlegen einer generischen SQL-Ausführungsfunktion (`execute_sql`, `run_sql`, …) ⇒ FAIL.

### E — Code-Distribution härten
11. `@/integrations/lovable/**` als `generated` klassifizieren; Code-Preflight prüft Cloud aktiv, Auth konfiguriert, Datei und benötigte Exporte vorhanden. Keine Stubs, keine Auth-Simulation.
12. `src/integrations/supabase/**` datei-genau klassifizieren (eyis-owned / generated / platform / integration point) statt pauschalem Ordner-Install; EYIS-eigene Runtime-Abstraktionen wandern unter einen reservierten Namespace. `types.ts` bleibt generated.
13. Portal-only Code (`PortalChrome`, `PortalOrderView`, zugehörige Routen/Imports) in die Kategorie `optional` verschieben; Base-Install enthält keine Portal-Datei mehr.
14. `route-boundary.ts`: Base-Prefixe auf `/app`, `/api/public/store|jobs|install|webhooks` reduzieren. `/portal` nur wenn das optionale Modul installiert ist.
15. Alle Base-Runtime-Links auf `/auth`, `/store`, `/portal` durch `/app/login`, `/app` bzw. `/` ersetzen (Navigation, Redirects, Fehlerseiten, „Storefront öffnen“).
16. Route-Contract + Link-Validator: jeder statische Link aus dem `install`-Graph wird gegen die garantiert installierten Routen geprüft; Treffer auf reference/optional/fehlend ⇒ FAIL.
17. Verbesserter Customer-Collision-Check: konkrete Dateiliste gegen Zielprojekt, existierende nicht-EYIS-Datei ⇒ STOP; `src/integrations/**` besonders streng.

### F — Integration-Patches idempotent
18. CSS-Patch über eindeutige Marker `/* EYIS:ADMIN_SCOPE:START|END */`: fehlt → einfügen, identisch → NOOP, abweichend → innerhalb der Marker aktualisieren, nie zweiter Block. Danach CSS-Syntaxprüfung.
19. Root-Patch analog: genau ein Import, ein Pathname-State, ein Guard; bestehende Integration ⇒ NOOP.
20. Patch-Transaktion: Datei sichern, patchen, Parse + Typecheck + Build-Preflight; bei Fehler Rollback.
21. Regressionstest: Patch zweimal ausführen ⇒ genau ein Block, Typecheck und Build PASS, Kunden-CSS außerhalb des Blocks unverändert.

### G — Signatur und Release
22. Feste Installationsreihenfolge: Release wählen → Signatur → Distribution → Cloud-Voraussetzungen → generated Files → Dependencies → Collision → Integration Patches → Route Contract → Import Graph → Typecheck → Build-Preflight → erst dann Datenbank.
23. Standardinstall ohne Tag löst den neuesten stabilen signierten Release auf, nicht `main`. Kein automatisches `EYIS_ALLOW_UNSIGNED_PACK=1`; kein signierter Release verfügbar ⇒ BLOCKED. `main` nur im ausdrücklichen Development-Modus.
24. Release erzeugt ein deterministisches Dedicated-Artifact (Install-Dateien, Installer, Baseline, Seeds, Reconcile, Resources, Manifeste, Contracts, Config-Templates) — ohne Marketing, Reference-Storefront, Demo, QA, Secrets, `.env`.
25. Signatur schützt das gesamte Artifact inkl. Runtime-Code über ein Release-Manifest mit SHA-256 je Datei. Distribution-Globs werden dafür zu einer konkreten Dateiliste (path, sha256, size, category) aufgelöst.
26. Trust-Anchor: gepinnter Public Key / `key_id` im Installer-Trust-Store; Signaturdatei enthält nur `key_id`, `digest`, `signature`, `version`. Kein Vertrauen auf einen mitgelieferten Key. Rotation nur vom alten Key signiert.
27. `existsSync`-Filter entfernen: fehlende erforderliche Signaturdatei ⇒ HARD FAIL. Checksummen für Baseline, Reconcile, Seeds, Manifeste, Contracts und Runtime-Artifact vollständig prüfen.
28. Release-Workflow führt vor dem Signieren aus: Sync-Check, Seed-Audit/Verify, Distribution-Verify, Route-Verify, Import-Graph, Typecheck, Tests, Build, Database-Installer-QA, Product-/Commerce-Smoke, UI-Isolation, Pack-Completeness, Secret-Scan. Ohne `EYIS_PACK_SIGNING_KEY`: BLOCKED.

### H — Verify, Doctor, Smokes
29. `bun run verify` erweitern um: Pack-Sync, Migration-Set-Fingerprint, Seed-Fingerprint, Signature-Completeness/Trust, Distribution-/Route-Contract, Import-Graph, Portal-Leak, Patch-Idempotenz, Bootstrap-Partial-State und die bestehenden Prüfungen.
30. Cron-Schedules ausschließlich aus dem Resource-Manifest ableiten; Doctor und Provisioner nutzen dieselbe Quelle. Doctor meldet vorhanden = PASS, fehlend = SETUP REQUIRED, falscher Schedule = FAIL.
31. Phasengenaue Installer-Statusausgabe (Code Preflight, Pack Signature, DB Sync, DB Install, Fingerprint, Seeds, Resources, Bootstrap, Owner, Shop). Nie global PASS, solange ein Pflichtschritt FAIL ist.
32. Bestehende Phase-25-Smokes (Product Wizard bis Checkout, Commerce-Kette, Owner-Flow inkl. falscher/unverifizierter E-Mail und Concurrent Claim, UI-Isolation) unverändert grün halten; Fresh-Install-Fixture auf leerer DB und Route-Isolations-Fixture (`/`, `/login`, `/store`, `/portal` bleiben Kunde) ergänzen.

### I — Report
33. `qa/PHASE26-BLACKBOX-UPSTREAM-FIXES-REPORT.md` mit je Defekt (Database, Bootstrap, Distribution, Portal, Route, CSS-Patch, Signature, Signature-Trust, DB-Transport): Root Cause, Architektur-Fix, Regressionstest, Ergebnis — plus neuer Migration Head, Schema Version, Migration Count, Schema-/Seed-Fingerprint, Baseline-Unit-Count, Contracts, Signed-Artifact-Status, Testzahl, Build/Verify.

## Status-Regeln

Nur PASS, FAIL, OFFEN, BLOCKED. Kein PASS ohne Nachweis. Reparierte Läufe des alten Blackbox-Tests gelten nicht als PASS; erst ein komplett neuer Lauf im frischen Projekt kann BLACKBOX PASS erhalten. Bis dahin kein Stable Release.
