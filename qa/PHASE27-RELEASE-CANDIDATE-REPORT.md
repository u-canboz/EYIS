# Phase 27 — Signierter EYIS Dedicated Release Candidate v1.0.0-rc.1

Status ausschließlich PASS, FAIL, OFFEN oder BLOCKED. Kein PASS ohne Nachweis.

## 1. Ergebnis

| # | Punkt | Status | Nachweis |
| --- | --- | --- | --- |
| 1 | Trust Anchor gepinnt, genau ein aktiver Ed25519-Schlüssel | PASS | `installer/distribution/eyis-trust-anchor.json`, Test „Trust Anchor" |
| 2 | Mitgelieferter Schlüssel wird ignoriert, fremde `key_id` FAIL | PASS | `release-trust.test.ts` (4 Fälle) |
| 3 | Privater Schlüssel nie im Repository, nie im Log | PASS | `scripts/eyis-pack-signature.ts` schreibt nur an Pfade außerhalb des Repos; Workflow ohne Ausgabe |
| 4 | Vollständiges Artefakt signiert (Pack + Code) | PASS | `eyis:pack:sign`, `eyis:release:sign` im Workflow |
| 5 | Artefakt deterministisch | PASS | zwei Builds, identischer Digest |
| 6 | Kundeneigene, generierte und Marketing-Dateien nicht im Artefakt | PASS | Test „Release-Artefakt" |
| 7 | Distribution-Manifest ohne Doppelkategorie (`src/routes/index.tsx`) | PASS | `eyis:dist:verify`, Test „Distribution-Manifest" |
| 8 | RC unveränderlich, Pre-Release-Kennzeichnung | PASS | `.github/workflows/eyis-release.yml` (`prerelease` aus Tag abgeleitet) |
| 9 | Ohne Referenz nur Stable, kein Rückfall auf RC oder `main` | PASS | `resolveInstallCandidate`, 6 Tests |
| 10 | RC wird in Production nicht installiert | PASS | Test „blockt einen RC in Production" |
| 11 | Stable-Promotion nur bei identischem Digest | PASS | `eyis:release:promote check` als Workflow-Gate |
| 12 | Secret-Scan vor Veröffentlichung | PASS | Workflow-Schritt „Secret-Scan des Artefakts" |
| 13 | Datenbank-Pack synchron (57 Migrationen) | PASS | `eyis:database:sync-check` in `verify` |
| 14 | `bun run verify` grün | PASS | siehe Abschnitt 3 |
| 15 | Tag `v1.0.0-rc.1` veröffentlicht und signiert | BLOCKED | benötigt Repository-Secret `EYIS_PACK_SIGNING_KEY` und Tag-Push durch den Owner |

## 2. Änderungen

- `src/lib/commerce/updates/versions.ts` — `resolveInstallCandidate`, `isReleaseCandidateRef`.
- `src/lib/commerce/updates/registry.server.ts` — `resolveInstallRelease` verbindet signierte
  Registry und Auflösungsregeln.
- `.github/workflows/eyis-release.yml` — Versions-/Pre-Release-Ableitung, Promotion-Gate,
  Secret-Scan, Artefakt-Build, doppelte Signatur, Verifikation gegen den Trust Anchor.
- `docs/production/RELEASE_SIGNING.md` — verbindliche Signatur- und RC-Regeln.
- `docs/production/BLACKBOX_INSTALL_TEST.md` — Test läuft gegen `v1.0.0-rc.1`, keine
  fest verdrahtete Unit-Zahl mehr.
- `src/lib/commerce/updates/__tests__/release-trust.test.ts` — 18 Regressionstests.
- `.gitignore` — `installer/artifact/` (Build-Ausgabe).

## 3. Nachweise

```
bunx vitest run src/lib/commerce/updates/__tests__/release-trust.test.ts
  18 passed
bun run verify
  docs:validate → sync-check → dist:verify → artifact:check → typecheck → test → build : PASS
```

## 4. Offen / blockiert

| Punkt | Status | Grund |
| --- | --- | --- |
| `EYIS_PACK_SIGNING_KEY` als Repository-Secret | BLOCKED | nur der Owner kann das Secret setzen; der private Schlüssel liegt außerhalb des Repositories |
| Tag `v1.0.0-rc.1` pushen | BLOCKED | Veröffentlichung liegt beim Owner |
| Blackbox-Durchlauf gegen den RC | OFFEN | startet nach der Veröffentlichung des Pre-Releases |
| Stripe Live, echter E-Mail-Versand, echte Carrier-Labels | BLOCKED | extern, siehe `docs/production/KNOWN_LIMITATIONS.md` |

## Nachtrag — Fingerprint-Korrektur und Gate-Abschluss

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Schema-Fingerprint neu introspiziert | PASS | `eyis:database:reintrospect` → `401b9985a42722f233f9ebace860fdaece85640476b6a9eb0a50b158fe04f0e4` (vorher stale `8867…`, `schema_fingerprint_state` jetzt `CURRENT`) |
| Database Installer QA | PASS | 13/13 (Fresh Install, Recovery, RLS, Reconciliation) |
| Pack-Signatur | PASS | 324 Dateien, key_id `e796e7191e5da23eddc85ae9d17d9bc8` |
| Release-Artefakt | PASS | `eyis-dedicated-1.0.0-rc.1.tar.gz`, 402 Dateien, SHA-256 `3ee34848f3cba061477f32cf2e4ffab9ca5bb21b13b0adb06cb8c5c4f41bd9b6` |
| Artefakt-Signatur gegen Trust Anchor | PASS | `eyis:release:verify` |
| Product Smoke | PASS | 6/6 (`qa:product-smoke`, angemeldete Sitzung) |
| UI-/CSS-Isolation | PASS | 7/7 (`qa:ui-isolation`; Harness wartet jetzt auf `.eyis-admin` statt fester Zeitspanne) |
| `bun run verify` | PASS | docs:validate, typecheck, 171 Tests, Build |
| Cron-Provisionierung lokal | BLOCKED | Sandbox ohne `cron`-Schema-Rechte; Nachweis erfolgt auf der Zielplattform via `eyis_cron_status()` |
| Tag `v1.0.0-rc.1` veröffentlicht | OFFEN | Git-Operationen sind aus der Agentenumgebung gesperrt |
