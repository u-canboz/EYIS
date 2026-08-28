# Phase 22 — EYIS Rebranding (Bericht)

Umfang: reine Präsentations- und Dokumentationsebene. Keine Änderung an Commerce-Logik,
Server Functions, Store API, SDK, RLS, Migrationen oder Secrets.

| # | Prüfpunkt | Status | Nachweis |
| --- | --- | --- | --- |
| 1 | Brand-Assets unter `public/brand/eyis/` (SVG + PNG, Default/White) | PASS | Dateien vorhanden, aus Brand-Pack übernommen |
| 2 | Favicon, Apple-Touch-Icon, `site.webmanifest` | PASS | `src/routes/__root.tsx`, `public/site.webmanifest` |
| 3 | Markenfarbe `#ED4800` als `--primary`/`--ring`/`--signal`/`--chart-1` | PASS | `src/styles.css`; keine Alt-Hex-Werte mehr im Repo |
| 4 | Zentrale Logo-Komponente mit Varianten (full, wordmark, wordmark-claim, mark, icon) | PASS | `src/components/brand/EyisLogo.tsx` |
| 5 | Backoffice-Shell: Wordmark in Sidebar, Mark in Icon-Rail | PASS | `src/components/shell/AppShell.tsx` |
| 6 | Login, Einladung, Setup-Claim, Einrichtungs-Wizard mit Logo | PASS | `auth.tsx`, `invite.tsx`, `app/setup`, `app/system/einrichtung` |
| 7 | Landingpage Header/Footer mit Mark, Wordmark und Claim-Wortmarke | PASS | Screenshot 390 px und 1280 px |
| 8 | Portal und Storefront bleiben händler-neutral (kein EYIS-Logo) | PASS | bewusst, White-Label-Grenze |
| 9 | Globale Umbenennung „Commerce OS" → „EYIS" in `src/`, `docs/`, `README.md`, `AGENTS.md` | PASS | 92 Dateien; historische QA-Berichte unverändert |
| 10 | Repo-Link auf `https://github.com/u-canboz/EYIS.git` | PASS | `src/lib/site-meta.ts` |
| 11 | Manifeste neu erzeugt | PASS | `bun run generate:manifests` |
| 12 | Kein horizontaler Overflow, Logos laden (390 px / 1280 px) | PASS | Playwright-Lauf über `/`, `/auth`, `/entwickler` |
| 13 | `bun run verify` (docs:validate → typecheck → test → build) | PASS | 102/102 Tests, Build erfolgreich |

## Offen / Blocker

Unverändert gegenüber Gate B/C: Stripe Live, echter E-Mail-Versand mit verifizierter
Absenderdomain und echte Carrier-Labels bleiben BLOCKED (fehlende Zugangsdaten).
