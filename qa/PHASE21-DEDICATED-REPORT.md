# Phase 21 — Dedicated Instance Installer: Abschlussbericht

Datum: 2026-08-28 · Status: **PASS** (Dedicated-Grundlage vollständig, Live-Aktivierung bleibt Owner-/Gate-C-Sache)

## Scope

Dedicated Deployment Mode: Provisioning → Migration → Bootstrap → First Owner Claim → Setup-Wizard.
Keine Commerce-Logik geändert; Store API v1 unverändert (keine Breaking Changes).

## Nachweise

| Prüfung | Nachweis | Status |
| --- | --- | --- |
| Migration `commerce_installation` + `claim_installation_owner` | `supabase/migrations/20260828131048_11f3caa1-a233-4ef9-a524-94fffedb1e4c.sql` angewendet | PASS |
| Server-only-Tabelle (RLS, keine Policies, anon blockiert) | `qa:dedicated-security` 1/2 | PASS |
| Bootstrap-Endpunkt: Header-Credential, timing-safe, nach Init gesperrt | `qa:dedicated-bootstrap` 1–3 | PASS |
| Abbruchmatrix: unknown env / shared mode / zentrale Deps / fehlendes Schema | `runBootstrap` + Harness 3–4 | PASS |
| Claim-Token: Hash-only, 72 h TTL, atomarer Claim, Replay-Schutz | `claim_installation_owner` (DB) + Harness 5–6 | PASS |
| Claim nie in URL; Secret nur als Header; keine Token-Logs | `qa:dedicated-security` 3–6 | PASS |
| /app-Gate: Dedicated ohne Owner zeigt nur Claim/Setup | `workspace.functions.ts` + `_authenticated/route.tsx` | PASS |
| Setup-Wizard mit 6 Schritten, Fortschritt persistent | `/app/system/einrichtung` | PASS |
| Doctor: Isolationsprüfung (eigene Infrastruktur vs. Fremdhosts) | `qa:dedicated-doctor` 13 Prüfungen, 0 FAIL | PASS |
| CLI: `commerce:bootstrap`, `commerce:doctor` | `scripts/` | PASS |
| Regression | `bun run verify` (docs, typecheck, tests, build) | PASS |

## QA-Ergebnisse

- `qa:dedicated-bootstrap`: 6/6 PASS
- `qa:dedicated-security`: 6/6 PASS
- `qa:dedicated-doctor`: 3/3 PASS (13 Doctor-Prüfungen, 0 FAIL)

## Status der Betriebsfähigkeit

- Dedicated Mode Software: **READY**
- Eigenes Template-/Fork-Projekt mit getesteter frischer Installation: **OFFEN** (erfordert reales Provisioning einer zweiten Instanz — externer Schritt)
- Öffentliche DNS-/Domain-Anbindung einer Dedicated-Storefront: **OFFEN** (operator-seitig)
- Stripe Live / echter E-Mail-Versand / echte Carrier: **BLOCKED** (unverändert, Owner-Freigabe + Zugangsdaten)

## Bekannte Einschränkungen

- Der positive Bootstrap-Pfad (Dedicated-Modus mit Secret) ist auf der Shared-Dev-Instanz
  bewusst nicht ausführbar (`INSTALLATION_NOT_DEDICATED`); vollständiger E2E-Nachweis erfolgt
  bei der ersten realen Dedicated-Provisionierung über `commerce:bootstrap` + `commerce:doctor`.
- `commerce_installation` trägt bewusst keine Member-Policies; Status für die UI läuft über
  redaktierende Server Functions.
