# Phase 30 — Release-Hotfix: Signaturpaketierung (RC.5)

Status: **PASS** — `RC5 SIGNATURE PACKAGING BUG FIXED — READY FOR RC.6`

## Befund

`v1.0.0-rc.5`: Workflow grün, Blackbox-Test des veröffentlichten Tarballs trotzdem FAIL.
Das Tarball enthielt die rc.4-Signatur (`files: 324`, `digest: 39b1faf9…`), das separat
veröffentlichte Asset dagegen die korrekte rc.5-Signatur (`files: 325`, `digest: 5a686d9d…`).

Ursache: `.github/workflows/eyis-release.yml` baute das Artefakt **vor** `eyis:pack:sign`.

## Korrektur

| Datei | Änderung |
| --- | --- |
| `.github/workflows/eyis-release.yml` | Reihenfolge: signieren → verifizieren → Tarball bauen → Pack-Gate aus dem entpackten Tarball → Release signieren/verifizieren → veröffentlichen |
| `scripts/eyis-release-selftest.ts` | neu: `extracted` (CI) und `simulate` (lokal, Wegwerf-Key) |
| `scripts/installer/signature.ts` | Anchor-Pfad pro Aufruf (`anchorPath()`), überschreibbar nur für den Selbsttest |
| `scripts/installer/artifact.ts` | aktiver Key kommt aus derselben Anchor-Quelle wie Signer/Verifier |
| `qa/phase29-install-pack.ts` | R1-Checks: entpacktes Tarball + Workflow-Reihenfolge |

Die Signaturdatei bleibt aus dem Payload ausgeschlossen (keine Selbstreferenz) und wird nach dem
Signieren in das Tarball aufgenommen. `signedFiles()` ist die einzige Dateilistenquelle.

## Nachweise

- `bun run verify`: PASS (186 Tests, docs:validate, Build)
- `bun run qa:install-pack`: PASS (26/26, inkl. R1)
- Extracted-Tarball-Pack-Gate: Checksummen PASS, Kompatibilität PASS, Signatur PASS, Gesamt PASS
- Eingebettete = externe Signaturdatei: byte-identisch
- Digest 325 Dateien `5a686d9d…` in Pack, eingebettet und extern identisch
- Release-Manifest signiert und gegen Trust Anchor verifiziert: PASS

## Unverändert

Trust Anchor (aktiv `4e7f55e68fa9a1b934ce2d04719c9177`, widerrufen `e796e719…`), Commerce Engines,
Store API v1, SDK, Datenmodell, Migrationen, RLS, Auth, Bootstrap, Doctor, Migration Plan,
Admin-Scope-Tokens, Route Guard. Kein Tag, kein Release, `v1.0.0-rc.5` unverändert.
