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

- `installer/resources/eyis-install-dependencies.json` — Abhängigkeitsplan (8 Pakete über Template-Baseline hinaus, u. a. `pdf-lib`), erzeugt via `bun run installer:dependencies`.
- `qa/phase30-blackbox-preflight.ts` — wiederholbarer Preflight (`bun run qa:blackbox-preflight`).
