# EYIS — Phase 27: Signierter Release Candidate v1.0.0-rc.1

Ziel: eine vollständige, überprüfbare Vertrauenskette für einen immutable, signierten
Dedicated Release Candidate. Kein Stable `v1.0.0`. Der aktuelle Blackbox-Test bleibt FAIL.

## Ausgangslage (geprüft)

- `eyis:database:sync-check` meldet bereits PASS: 57 Migrationen im Repo und im Pack,
  Fingerprints identisch, `schema_version` 20260830200942.
- Der Fresh-Install-Pack hat **46** Baseline-Units; `docs/production/BLACKBOX_INSTALL_TEST.md`
  nennt fest „43 Units" — reiner Doku-Drift.
- `installer/distribution/eyis-trust-anchor.json` hat `keys: []` — Hauptblocker.
- `signature.ts` prüft bereits gegen den Trust Anchor und bricht bei fehlenden Dateien hart ab;
  es fehlen `algorithm`/`revoked`-Semantik, Tests und ein Artefakt-Digest.
- `eyis:pack:keygen` gibt den privaten Schlüssel auf stdout aus — muss gehärtet werden.
- Distribution-Manifest v5: `src/routes/index.tsx` steht in `reference_only` **und**
  `customer_owned`.

## Umsetzung

### 1. Trust Anchor und Schlüssel
- Ed25519-Paar in der Sandbox erzeugen. Öffentlicher Schlüssel wird als
  `key_id: eyis-release-2026-01`, `algorithm: ed25519`, `status: active`, `created_at`
  in den Trust Anchor gepinnt (Struktur mit `version: 1`).
- Der private Schlüssel wird **ausschließlich** als Datei unter `/mnt/documents` abgelegt,
  nie ins Repo, nie in Chat, Log, Report oder Release-Asset geschrieben. Du hinterlegst ihn
  als GitHub-Secret `EYIS_PACK_SIGNING_KEY` und löschst die Datei.
- `eyis:pack:keygen` schreibt den privaten Teil künftig nur noch in eine Datei außerhalb des
  Repos (Pfad als Argument, `0600`) und gibt auf stdout nur `key_id` und Public Key aus.

### 2. Signatur an key_id binden
- Signaturdatei enthält nur `algorithm`, `key_id`, `digest`, `signature`, `signed_at`, `files`.
  Ein mitgelieferter `public_key` wird beim Verifizieren ignoriert.
- Verifier: unbekannte key_id → FAIL, `status != active` (revoked/retired) → FAIL,
  manipuliertes Artefakt → FAIL, fehlende Signatur → BLOCKED, fehlender Trust Anchor → BLOCKED.

### 3. Deterministisches Release-Artefakt
- Neues Skript `scripts/installer/artifact.ts` plus `eyis:release:artifact`:
  baut aus dem Distribution-Manifest (`install`, `generated`, `integration_patch`),
  dem Database Pack, Seeds, Reconcile, Resource-/Distribution-/Route-Contract, Trust Anchor
  und den nötigen Installer-Skripten ein reproduzierbares `eyis-dedicated-<version>.tar.gz`
  (feste Sortierung, fixe mtime/uid/gid).
- Ausgeschlossen: Marketing-Routen, Reference-Storefront, Demo-Daten, `.env`, Secrets,
  QA-Fixtures, customer-owned Dateien.
- Fehlt eine erwartete Datei: `PACK COMPLETENESS: FAIL`, Abbruch — kein `existsSync`-Filter.
- Begleitendes `eyis-release.json` (Artifact-Manifest) mit Version, Commit-SHA, Channel,
  `generated_at`, `schema_version`, `migration_head`, Migrationsanzahl, Schema- und
  Seed-Fingerprint, Dateianzahl, Artefakt-SHA-256, `key_id` sowie der Dateiliste
  (Pfad, Größe, SHA-256).
- Signiert wird der Artefakt-Digest (SHA-256 über das Manifest inkl. Dateiliste).

### 4. Release-Auflösung (RC vs. Stable)
- `src/lib/commerce/updates/registry.server.ts` erhält eine explizite Auflösung:
  - nur Repository genannt → neuester signierter **Stable**-Release;
  - explizit `v*-rc.*` genannt → genau dieser signierte Pre-Release;
  - kein Stable vorhanden → Production-Install BLOCKED (kein Fallback auf RC oder main);
  - main/unsigned nie automatisch; `EYIS_ALLOW_UNSIGNED_PACK=1` bleibt Dev/QA-only und wird
    bei `APP_ENV=production` ignoriert.

### 5. Distribution-Manifest eindeutig machen
- Trennung von Quelle und Zielschutz: `src/routes/index.tsx` bleibt ausschließlich
  `reference_only`; der Schutz der Zielprojekt-Startseite wandert in ein eigenes Feld
  `customer_routes: ["/"]`.
- Neues Gate `eyis:dist:verify`: findet Mehrfachklassifikation, fehlende Dateien,
  Quelle/Ziel-Verwechslung und Konflikte zwischen `customer_owned` und `reference_only`.

### 6. Gates und Workflow
- `bun run verify` bekommt zusätzlich `eyis:dist:verify` und `eyis:release:artifact --check`.
- `.github/workflows/eyis-release.yml`: Tag-Muster `v*` mit Pre-Release-Erkennung
  (`-rc.` → `prerelease: true`, sonst Stable). Reihenfolge vor der Signatur:
  docs validate, typecheck, tests, build, database sync check, installer-QA, Seed-Audit und
  -Verify, Route-Verify, Distribution-Verify, Pack Completeness, Secret-Scan.
  Danach Artefakt bauen → SHA-256 → signieren → gegen Trust Anchor verifizieren → Release.
  Fehlt `EYIS_PACK_SIGNING_KEY`: Abbruch, kein Ersatzschlüssel.
- Stable-Promotion: der geprüfte RC-Digest wird in
  `installer/distribution/eyis-release-promotion.json` festgehalten; ein Stable-Tag wird nur
  signiert, wenn das neu gebaute Artefakt byte-identisch (gleicher Digest) ist.

### 7. Tests
- Trust-Anchor-Tests: gültig/aktiv → PASS; unbekannte key_id, revoked key, manipuliertes
  Artefakt, falsche Signatur → FAIL; fehlende Signatur/fehlender Anchor → BLOCKED;
  eingebetteter Fremdschlüssel wird ignoriert.
- Release-Resolution-Tests für die fünf beschriebenen Fälle.
- Manifest-Validator-Tests für Doppelkategorien.
- Determinismus-Test: zweimal gebautes Artefakt hat denselben Digest.

### 8. Dokumentation und Report
- `docs/production/BLACKBOX_INSTALL_TEST.md`: neuer Ablauf (Gates → signierter RC →
  Blackbox gegen genau diesen RC → bei Handkorrektur FAIL → Upstream-Fix → nächster RC →
  erst nach PASS Stable). Statische Unit-Zahlen raus, Formulierung „alle required Baseline
  Units aus dem aktuellen signierten Installer-Manifest"; angezeigte Zahlen kommen aus dem
  Manifest. Wörtlicher Testauftrag:
  `Installiere EYIS Dedicated v1.0.0-rc.1 aus https://github.com/u-canboz/EYIS in dieses Projekt. Bestehendes Design behalten.`
- Neuer Report `qa/PHASE27-SIGNED-RELEASE-CANDIDATE-REPORT.md` mit Trust-Anchor-Status,
  aktiver key_id, Private-Key-Handling, DB-Sync, Migrations- und Unit-Anzahl, Fingerprints,
  Manifest-Validierung, RC-Version, Commit, Artefakt-Dateianzahl und SHA-256, Signatur- und
  Trust-Anchor-Verifikation, Workflow, Testanzahl, Build, Verify. Kein privater Schlüssel.

## Abschluss

Nach Abschluss melde ich den Stand ehrlich: ist das Secret noch nicht hinterlegt, lautet die
Meldung `SETUP REQUIRED: EYIS_PACK_SIGNING_KEY als GitHub Repository Secret hinterlegen`.
Danach taggst du `v1.0.0-rc.1`; der Workflow erzeugt den signierten Pre-Release.
Kein Stable-Release, keine `EYIS V1 PRODUCTION READY`-Meldung vor dem nächsten Blackbox-PASS.
