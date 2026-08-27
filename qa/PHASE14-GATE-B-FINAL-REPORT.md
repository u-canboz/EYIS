# Gate B — Production Hardening: Abschlussbericht

Durchlauf B1–B9 in einem Zug, 2026-08-27. Keine neuen Commerce-Funktionen.
Datenbasis: befüllte Demo-Organisation und isolierte QA-Fixtures.
Rohergebnisse: `qa/results-phase14-gate-b.json` sowie die Einzeldateien
`qa/results-phase14-{visual,accessibility,performance,privacy,storage,providers}.json`.

## Gesamtmatrix

| Bereich | Ergebnis | Status | Bericht |
| --- | --- | --- | --- |
| B1 Visuelle Regression und UI-Qualität | 14/14 | **PASS** | `qa/PHASE14-VISUAL-REGRESSION-REPORT.md` |
| B2 Accessibility (automatisiert) | 8/8 | **PASS** | `qa/PHASE14-ACCESSIBILITY-REPORT.md` |
| B2.9 Screenreader-Stichprobe | — | **OFFEN** | keine NVDA/VoiceOver-Umgebung verfügbar |
| B3 Performance und Lastverhalten | 15/15 | **PASS** | `qa/PHASE14-PERFORMANCE-REPORT.md` |
| B3 Lastprofil > 10 parallel, Production-Budgets | — | **OFFEN** | nur gegen getrennte Umgebung messbar |
| B4 Datenschutz und Datenlebenszyklus | 26/26 | **PASS** | `qa/PHASE14-PRIVACY-REPORT.md` |
| B4 Automatische Löschjobs für Kommunikation/Protokolle | — | **OFFEN** | Richtlinie dokumentiert, Job nicht implementiert |
| B5 Upload- und Storage-Sicherheit | 35/35 | **PASS** | `qa/PHASE14-STORAGE-SECURITY.md` |
| B5 Virenscan der Uploads | — | **OFFEN** | externer Scandienst erforderlich |
| B6 Staging-Trennung | 0/5 | **BLOCKED** | `qa/PHASE14-STAGING-E2E-REPORT.md` |
| B7 Staging-E2E | 0/5 | **BLOCKED** | dito |
| B8 Provider-Readiness | 12/14 | **PASS** (2 BLOCKED) | `qa/PHASE14-PROVIDER-REPORT.md` |
| B9 Vollständige Regression | siehe unten | **PASS** | dieser Bericht |

Kein FAIL offen.

## B9 — Regressionslauf (2026-08-27)

| Lauf | Ergebnis | Status |
| --- | --- | --- |
| `bun run docs:validate` | Pflichtdateien, Links, Manifeste aktuell | PASS |
| `bun run typecheck` | `tsgo --noEmit`, 0 Fehler | PASS |
| `bun run test` | Engine- und Grenztests | PASS |
| `bun run build` | Produktionsbuild | PASS |
| `bun run qa:store-api` | 52/52 | PASS |
| `bun run qa:security` | 32/32 | PASS |
| `bun run qa:rls` | 52/52 | PASS |
| `bun run qa:health` | 15/15 | PASS |
| `bun run qa:jobs` | 21/21 | PASS |
| `bun run qa:migrations` | 10/10 (Schema-Replay BLOCKED) | PASS |
| `bun run qa:demo` | 44/44, Reseed identisch | PASS |
| `bun run qa:visual` | 14/14 | PASS |
| `bun run qa:a11y` | 8 PASS + B2.9 OFFEN | PASS |
| `bun run qa:performance` | 15/15 | PASS |
| `bun run qa:privacy` | 26/26 | PASS |
| `bun run qa:storage` | 35/35 | PASS |
| `bun run qa:providers` | 12 PASS + 2 BLOCKED | PASS |

Im Erstlauf meldete `qa:security` 31/32 (Rate-Limit-Prüfung) — der Wiederholungslauf ohne
konkurrierende Browser-Harnesses ergab 32/32. Der Erstlauf von `qa:rls` meldete 51/52; die
Ursache war ein echter Fehler und wurde behoben (siehe unten).

## Behobene Defekte in Gate B

1. **Zu weite Tabellenrechte** (`qa:rls`, HOCH). `demo_environments` und `qa_fixtures`
   gewährten der Rolle `authenticated` INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER,
   obwohl beide Tabellen ausschließlich eine Lese-Policy besitzen. Migration
   `20260827125825` entzieht die Rechte und belässt SELECT für `authenticated`,
   ALL für `service_role`. Nachweis: `qa:rls` jetzt 52/52.
2. **N+1-Anreicherung im öffentlichen Katalog.** Katalogliste p95 3900 ms → unter 2000 ms.
3. **Race bei nebenläufigen Warenkorb-Snapshots** (Unique-Verletzung auf
   `cart_price_snapshots_cart_id_version_key`) — behoben durch Neulesen und Wiederholen.
4. **32 Accessibility-Befunde** (Button-Namen, Kontrast, Fokus, Schalterbeschriftung).
5. **Touch-Ziele unter 44 px** in globalen UI-Primitiven und Filterreihen.
6. **Fehlende Umbrüche** langer SKUs, E-Mails und Beträge in der Storefront.

Alle Änderungen betreffen UI, Rechte und nachgewiesene Defekte — keine neue Fachlogik.

## Verbleibende Go-live-Blocker

Vollständig in `docs/production/GATE_B_OPEN_BLOCKERS.md`. Kurzfassung:

1. Keine getrennte Staging-/Production-Umgebung (BLOCKED, Betreiberentscheidung).
2. Stripe Live, echter E-Mail-Versand mit verifizierter Absenderdomain, Carrier-Labels
   (BLOCKED, Zugangsdaten des Betreibers).
3. Screenreader-Abnahme, Production-Performance-Budgets, Retention-Jobs, Virenscan (OFFEN).

Gate C wurde nicht begonnen.
