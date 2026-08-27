# Testen und Nachweise

Grundsatz: **Kein Punkt gilt als PASS ohne konkreten Nachweis.** Statuswerte sind ausschließlich
`PASS`, `FAIL`, `OFFEN` oder `BLOCKED`.

## Ebenen

| Ebene | Befehl | Datenbank nötig | Prüft |
| --- | --- | --- | --- |
| Doku & Manifeste | `bun run docs:validate` | nein | Pflichtdateien, tote Links, Secret-Muster, Manifest-Aktualität |
| Typen | `bun run typecheck` | nein | TypeScript ohne Emit |
| Unit | `bun run test` | nein | Pricing-, Cart-, Tax-Engine, SDK-Importgrenzen (Vitest) |
| Build | `bun run build` | nein | Produktionsbuild |
| **Gesamt** | **`bun run verify`** | **nein** | die vier obigen in Folge |
| QA-Harness | `bun run qa:*` | **ja (Dev)** | End-to-End gegen eine echte Dev-Datenbank |

## QA-Harnesses

| Befehl | Inhalt | Bericht |
| --- | --- | --- |
| `bun run qa:e2e` | Katalog → Warenkorb → Checkout → Zahlung → Bestellung | `qa/PHASE5-QA-REPORT.md` |
| `bun run qa:store-api` | Store API v1, Keys, Origin, Rate-Limits, Cross-Tenant | `qa/PHASE12-QA-REPORT.md` |
| `bun run qa:security` | Header, CSP, Injection, Redirects, Rate-Limits | `qa/PHASE14-SECURITY-REPORT.md` |
| `bun run qa:rls` | RLS, Grants, Policies, Cross-Tenant je Tabelle | `qa/PHASE14-RLS-REPORT.md` |
| `bun run qa:health` | Integritätsprüfungen (`health_run_checks`) | `qa/PHASE14-DATA-INTEGRITY-REPORT.md` |
| `bun run qa:jobs` | Job-Queue, Cron-Auth, Wiederaufnahme | `qa/PHASE14-JOBS-REPORT.md` |
| `bun run qa:migrations` | Migrations-Integrität, Drift | `qa/PHASE14-MIGRATION-REPORT.md` |
| `bun run qa:demo` | Demo-Seed, Idempotenz, Fixtures, Purge | `qa/PHASE15-DEMO-REPORT.md` |
| `bun run qa:visual` | Überlauf, Touch-Ziele, Zoom, Dark Mode, Screenshot-Diff | `qa/PHASE14-VISUAL-REGRESSION-REPORT.md` |
| `bun run qa:a11y` | axe-core, Struktur, Tastatur, Kontrast | `qa/PHASE14-ACCESSIBILITY-REPORT.md` |
| `bun run qa:performance` | Latenz-Budgets, Parallelität, Überverkauf | `qa/PHASE14-PERFORMANCE-REPORT.md` |
| `bun run qa:privacy` | Datenkarte, Ablaufjobs, Auskunft, Löschung | `qa/PHASE14-PRIVACY-REPORT.md` |
| `bun run qa:storage` | Buckets, signierte URLs, Mandantentrennung, Uploads | `qa/PHASE14-STORAGE-SECURITY.md` |
| `bun run qa:providers` | Zahlung, E-Mail, Carrier: Readiness und Live-Sperren | `qa/PHASE14-PROVIDER-REPORT.md` |

**Niemals gegen Production.** Die Demo-/QA-Funktionen brechen bei `APP_ENV=production` hart ab
(`src/lib/commerce/demo/guard.server.ts`).

## Reihenfolge bei einer Änderung

1. `bun run verify`
2. Passende `qa:*`-Harnesses zum betroffenen Modul
3. Ergebnis mit Datum, Befehl und Zählern dokumentieren

## Testdaten

Ausschließlich aus dem Demo-/QA-System:

```bash
bun run qa:demo    # Demo-Organisation seeden (idempotent) und Fixtures prüfen
```

Umfang des Demo-Seeds: 32 Produkte, 12 Kunden, 40 Checkouts (36 Bestellungen + 4 offen), Rechnungen,
Versand, Kommunikation. Zweiter Lauf erzeugt keine Dubletten. Fixtures decken u. a. Mixed Tax
(7 %/19 %), Teillieferung mit Versandausnahme und Retoure mit Refund/Restock/Gutschrift ab.

Produktionsdaten werden nie kopiert, exportiert oder als Testgrundlage verwendet.

`qa:visual` und `qa:a11y` brauchen einen laufenden Dev-Server und einen temporären
Store-API-Key; beide werden nach dem Lauf entfernt. Neue Baselines nur bewusst mit
`--approve` schreiben.

## Bekannte offene Punkte

Vollständig und aktuell in [docs/production/GATE_B_OPEN_BLOCKERS.md](../production/GATE_B_OPEN_BLOCKERS.md).
Kurz: Screenreader-Stichprobe, Production-Performance-Budgets, Retention-Löschjobs und
Virenscan sind OFFEN. BLOCKED ohne Zugangsdaten bzw. zweite Umgebung: Stripe Live, echter
E-Mail-Versand, Carrier-Labels, Staging-Trennung und Staging-E2E.
