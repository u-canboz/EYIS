# rc.6/rc.7 Blackbox-Preflight-Report

Stand: 2026-09-01 · Grundlage: `qa:blackbox-preflight` (5/5 PASS), `qa:install-pack` (30/30 PASS), `integration-patch`/`update-signature` Tests (39/39 PASS)

| # | Prüfung | Ergebnis |
| --- | --- | --- |
| P1 | Dependency-Graph des Installations-Codes vollständig (inkl. `pdf-lib`) | PASS |
| P2 | Build-Gate (`bun run verify`) vor DB- und Artefakt-Schritten im Release-Workflow | PASS |
| P3 | Plattform-Typgenerierung nach Migrationen, vor typecheck/build, im Agent Plan angeordnet | PASS |
| P4 | Agent Migration Plan deterministisch, Journal-Resume via `ON CONFLICT` (53 Units) | PASS |
| P5 | Kanonischer Cron-Secret-Name `LOVABLE_CRON_SECRET` in Manifest + Runtime | PASS |

## Hotfix-Nachweise rc.6

| Befund | Fix | Nachweis |
| --- | --- | --- |
| Route-Guard-Marker als sichtbarer Text im DOM | JSX-Kommentar-Marker `{/* EYIS:ROUTE_GUARD:START/END */}`, Legacy-rc.5-Marker werden erkannt und in die JSX-Form überführt, `removeRootGuard` für byte-exaktes Rollback, Ablehnung bei frühem `return <Outlet />` (`ROOT_EARLY_RETURN`) | `integration-patch.test.ts` inkl. SSR-Render-Test (kein Marker-Text im HTML), `qa:install-pack` B4 |
| Update-Verifikation ohne gepinnten Schlüssel | Verifikation gegen gepinnten Trust Anchor (`installer/distribution/eyis-trust-anchor.json`, aktiv `4e7f55e6…`), SPKI/PEM-Unterstützung; `EYIS_RELEASE_PUBLIC_KEY` nur noch als Non-Production-Override bzw. wenn er einem aktiven Anchor-Schlüssel entspricht; keine Private Keys zur Laufzeit | `update-signature.test.ts` (Anchor-Kette, revoked/unknown keys abgelehnt) |
| rc.5 Signatur/Reihenfolge | Release-Workflow signiert das Pack vor dem Tarball-Bau (Phase 30 Reihenfolge) | `qa:install-pack` R1 |

## Artefakte

- `installer/resources/eyis-install-dependencies.json` — Abhängigkeitsplan, erzeugt via `bun run installer:dependencies`. Pre-rc.7-Hotfix: der Generator scannt ausschließlich Runtime-Code (kein Testcode, keine Fixtures, kein `qa/`, `docs/`, `scripts/`), verwirft Aliase/Relativpfade/Builtins, validiert npm-Namen hart und bricht bei unbekannten Paketen mit `UNKNOWN_RUNTIME_DEPENDENCY` ab (kein `0.0.0`-Fallback). Ergebnis: 4 `runtime_dependencies` (`@supabase/supabase-js`, `lucide-react`, `pdf-lib`, `zod`), 5 `provided_by_template`, 0 Tooling-Pakete. Geprüft durch `qa:blackbox-preflight` (13/13 PASS, inkl. Determinismus und Installationssimulation).
- `qa/phase30-blackbox-preflight.ts` — wiederholbarer Preflight (`bun run qa:blackbox-preflight`).
