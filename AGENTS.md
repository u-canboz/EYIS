# AGENTS.md — EYIS

Verbindliche Regeln für jeden KI-Agenten und jeden Menschen, der an diesem Repository arbeitet.
Diese Datei gilt für das gesamte Repository. Bereichsspezifische Zusatzregeln stehen in
`src/lib/commerce/AGENTS.md`, `src/lib/store-sdk/AGENTS.md`, `src/routes/store/AGENTS.md` und
[docs/agent/MIGRATION_RULES.md](docs/agent/MIGRATION_RULES.md) und gehen für ihren Ordner vor.

---

## 0. Zuerst lesen (in dieser Reihenfolge)

1. Diese Datei
2. [docs/agent/START_HERE.md](docs/agent/START_HERE.md) — Orientierung in 10 Minuten
3. [docs/agent/OPERATING_MODES.md](docs/agent/OPERATING_MODES.md) — **welchen Auftrag habe ich überhaupt?**
4. [docs/agent/ARCHITECTURE_MAP.md](docs/agent/ARCHITECTURE_MAP.md)
5. [docs/agent/SECURITY_BOUNDARIES.md](docs/agent/SECURITY_BOUNDARIES.md)
6. [docs/agent/CHANGE_PLAYBOOK.md](docs/agent/CHANGE_PLAYBOOK.md)

Maschinenlesbar: `commerce-os.manifest.json`, `docs/agent/modules.json`, `docs/agent/routes.json`,
`docs/agent/store-api-v1.json`, `docs/agent/openapi-store-v1.json`.

---

## 1. Quellenhierarchie — was ist Wahrheit?

Bei Widersprüchen gilt **immer** die höhere Stufe. Eine veraltete Markdown-Datei ist niemals
Grundlage für eine Entscheidung, wenn der Code etwas anderes sagt.

| Rang | Quelle |
| --- | --- |
| 1 | **Tatsächlicher Code** unter `src/` |
| 2 | **Angewandte Migrationen** in `supabase/migrations/` und Datenbank-Introspektion |
| 3 | **Neueste QA-Berichte** in `qa/*.md` |
| 4 | **Maschinenlesbare Manifeste** (`commerce-os.manifest.json`, `docs/agent/*.json`) |
| 5 | **Beschreibende Dokumentation** (`docs/**/*.md`, `README.md`) |
| 6 | **Ältere Pläne** (`.lovable/plan/**`, ältere Phasenberichte) |

Wer eine Abweichung findet: erst die höhere Quelle prüfen, dann die niedrigere korrigieren und im
selben Change dokumentieren. Manifeste werden nie von Hand editiert, sondern mit
`bun run generate:manifests` neu erzeugt.

---

## 2. Harte Production-Sperre

Diese Punkte sind nicht verhandelbar und dürfen von keinem Agenten selbstständig umgangen werden:

- **Keine Demo-Seeds in Production.** `src/lib/commerce/demo/guard.server.ts` bricht bei
  `APP_ENV=production` hart ab. Guard nicht entfernen, nicht überschreiben, nicht „temporär" umgehen.
- **Keine QA-Harnesses gegen Production.** `qa/*.ts` läuft ausschließlich gegen Dev/Preview.
- **Keine echten Zahlungen.** Kein Live-Modus eines Payment-Providers, keine Testkäufe mit echten
  Karten, keine Umstellung eines Providers von Mock auf Live ohne ausdrückliche Freigabe.
- **Keine Live-Daten für Tests.** Kundendaten werden nie kopiert, exportiert oder in Fixtures
  verwendet. Testdaten kommen aus dem Demo-/QA-System.
- **Keine Provider- oder Secret-Änderungen ohne Freigabe.** Secrets werden nicht gelesen, geloggt,
  ausgegeben, in Code geschrieben oder rotiert. Siehe `docs/production/SECRET_REGISTER_TEMPLATE.md`.
- **Keine Migration auf Production ohne Runbook und Backup.** Ablauf:
  `docs/production/DISASTER_RECOVERY_RUNBOOK.md` plus `docs/agent/CHANGE_PLAYBOOK.md`.
- **Bei unbekannter Umgebung: STOPP.** Wenn nicht sicher belegbar ist, ob die aktuelle Umgebung Dev,
  Staging oder Production ist, wird keine schreibende Aktion ausgeführt. Erst `APP_ENV` und
  `docs/production/ENVIRONMENT_MATRIX.md` prüfen, dann fragen.

---

## 3. Architektonische Grenzen (nicht verhandelbar)

1. **Mandantentrennung.** Jede Abfrage auf Fachdaten filtert nach `organization_id` und, wo
   vorhanden, `shop_id`. Es gibt keinen Cross-Tenant-Zugriff — auch nicht „nur lesend".
2. **RLS ist Pflicht.** Jede neue Tabelle in `public`: `CREATE TABLE` → `GRANT` → `ENABLE ROW LEVEL
   SECURITY` → `CREATE POLICY`, in dieser Reihenfolge, in derselben Migration.
3. **Storefronts sprechen ausschließlich über das SDK und die Store API v1.** Keine Storefront und
   kein Kundenprojekt importiert `@supabase/supabase-js`, `@/integrations/supabase/*` oder
   `@/lib/commerce/*`. Erzwungen in `eslint.config.js` und
   `src/lib/store-sdk/__tests__/boundaries.test.ts`.
4. **Preise, Steuern, Bestände und Totals kommen ausschließlich vom Server.** Kein Client rechnet
   Beträge nach und kein Client sendet berechnete Beträge.
5. **Unveränderlichkeit.** Ausgestellte Rechnungen und Gutschriften, `tax_snapshots`,
   Bestellpositionen und Zahlungsereignisse werden nicht nachträglich geändert. Korrekturen laufen
   über neue Datensätze (Gutschrift, Storno, Gegenbuchung).
6. **Kernprozesse sind keine Automationen.** Payment → Order, Order → Inventory-Commit, Dokument-
   Erzeugung liegen fest im Code, nicht in Händlerregeln.
7. **Service-Role bleibt serverseitig.** `@/integrations/supabase/client.server` nur in
   `createServerFn`-Handlern oder Server-Routen, dort per `await import(...)`.
8. **API-Version v1 ist stabil.** Breaking Changes an `/api/public/store/v1` sind verboten. Neues
   Verhalten kommt additiv oder als `v2`.
9. **Keine neuen Supabase Edge Functions.** App-Logik: `createServerFn`. HTTP-Endpunkte:
   TanStack-Server-Routen unter `src/routes/api/`.
10. **Frische Datenbanken kommen aus dem Install Pack.** Eine Dedicated-Erstinstallation baut die
    Datenbank aus `installer/database/` auf, nicht durch Nachspielen der historischen
    Migrationskette. Units in Manifest-Reihenfolge, Journal pflegen, danach
    `reconcile/001_migration_history.sql` vor dem ersten `supabase db push`.
    Details: [docs/production/DATABASE_INSTALL_PACK.md](docs/production/DATABASE_INSTALL_PACK.md).
11. **Der Baseline wird nie über eine bestehende Installation gelegt.** Bei `PARTIAL_INSTALL` erst
    `bun run eyis:install:inspect`; niemals Kundendaten oder kundeneigene Tabellen löschen.
12. **Öffentliche Job-Endpunkte** unter `src/routes/api/public/jobs/` authentifizieren immer über
    `authenticateCronRequest` (`src/integrations/supabase/cron-auth.ts`).

---

## 4. Arbeitsablauf für jede Änderung

1. **Auftrag einordnen** — Betriebsart A, B oder C nach
   [docs/agent/OPERATING_MODES.md](docs/agent/OPERATING_MODES.md). Bei B wird an diesem Repository
   in der Regel gar nichts geändert.
2. **Umgebung feststellen** — Dev, Staging oder Production. Bei Unklarheit stoppen.
3. **Betroffenes Modul finden** — `docs/agent/modules.json` bzw.
   [docs/agent/MODULE_REGISTRY.md](docs/agent/MODULE_REGISTRY.md).
4. **Bereichsregeln lesen** — lokale `AGENTS.md` im betroffenen Ordner.
5. **Code lesen, bevor geschrieben wird** — Engine-Verhalten steht im Code, nicht in der Doku.
6. **Änderung umsetzen** — kleinstmöglicher Umfang, bestehende Muster übernehmen.
7. **Nachweise erzeugen** — Test, QA-Lauf oder DB-Abfrage. Kein Punkt gilt als PASS ohne Nachweis.
8. **`bun run verify`** ausführen und grün bekommen. Bei Doku- oder Routenänderung vorher
   `bun run generate:manifests`.

---

## 5. Befehle

| Befehl | Zweck |
| --- | --- |
| `bun install` | Abhängigkeiten |
| `bun run dev` | Entwicklungsserver (Port 8080) |
| `bun run typecheck` | TypeScript ohne Emit |
| `bun run test` | Vitest (Engine- und Grenz-Tests) |
| `bun run generate:manifests` | Manifeste aus dem Code neu erzeugen |
| `bun run docs:validate` | Dokumentation und Manifest-Aktualität prüfen |
| `bun run build` | Produktionsbuild |
| **`bun run verify`** | **docs:validate → typecheck → test → build. Vor jedem Abschluss.** |
| `bun run qa:*` | QA-Harnesses, nur gegen Dev/Preview (`qa:e2e`, `qa:store-api`, `qa:security`, `qa:rls`, `qa:health`, `qa:jobs`, `qa:migrations`, `qa:demo`) |

Die `qa:*`-Läufe brauchen eine erreichbare Dev-Datenbank und laufen nicht in `verify` mit.

---

## 6. Status V1

V1 ist eingefroren (Release Candidate 1). Aktuell laufen nur Härtung, echte Integrationen und
Go-live-Vorbereitung. Neue Features nur nach ausdrücklicher Freigabe.

BLOCKED ohne Zugangsdaten: Stripe Live, echter E-Mail-Versand, Carrier-Labels. Details in
[docs/production/KNOWN_LIMITATIONS.md](docs/production/KNOWN_LIMITATIONS.md).
