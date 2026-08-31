# Phase 29 — Blackbox-Installierbarkeit (v1.0.0-rc.4 Befunde)

Auftrag: ausschließlich die im realen Blackbox-Test gefundenen Installationsdefekte beheben.
Keine neuen Features, keine Änderung an Commerce-, API-, SDK-, RLS- oder Datenbanklogik.
Kein Stable Release, kein neuer RC-Tag.

Nachweis lokal reproduzierbar: `bun run qa:install-pack` (13/13 PASS) und `bun run verify`.

---

## B1 — Direktes psql für DDL

Status: **PASS**

Eine frische Lovable-Cloud-Datenbank gibt dem verfügbaren Benutzer kein `CREATE` auf `public`.
`runFreshInstall` bricht deshalb nicht mehr mitten in Unit 000 ab, sondern prüft die DDL-Rechte
vorab (`preflightDirectDdl`) und wirft `DirectDdlUnavailableError` mit dem korrekten Ausweg.
Der psql-Pfad bleibt für Umgebungen mit echtem Superuser-Zugang erhalten — er ist nur nicht mehr
die Voraussetzung einer Installation.

## B2 — 46 Units ohne manuelles Kopieren

Status: **PASS**

Untersucht wurde, welcher programmatische Weg innerhalb einer Lovable-Cloud-Installation real
existiert. Ergebnis: privilegiertes DDL läuft ausschließlich über das Plattform-Migration-Tool,
und dieses ist agentseitig verfügbar. Es gibt keinen legitimen Umweg an den Plattformrechten vorbei.

Der Installer erzeugt daraus einen deterministischen **Agent Migration Plan**
(`scripts/installer/agent-plan.ts`):

- 53 Schritte: 46 Baseline Units, 5 Systemseeds, 1 Migration-History-Reconciliation, 1 Abschluss.
- Reihenfolge strikt aus dem signierten Manifest; Checksummenprüfung je Quelle.
- Jede Unit-Stufe schreibt ihren Journaleintrag in **derselben** Migration
  (`eyis_installation_units`), die letzte Stufe setzt `eyis_installation_state = INSTALLED`.
  Dadurch braucht der Installer für Zustand, Wiederaufnahme und Nachweis keinen DB-Zugang.
- `plan_checksum` ist reproduzierbar (`d0c8e0b1…`).

Ablauf im Kundenprojekt:

```
bun run installer/eyis.ts plan
bun run installer/eyis.ts step 1        # … bis 53, jeweils über das Plattform-Migration-Tool
bun run installer/eyis.ts doctor
```

Der Mensch überträgt keine SQL-Datei mehr einzeln; der Agent holt je Schritt genau eine Migration.

## B3 — Befehle im installierten Projekt

Status: **PASS**

`package.json` gehört dem Kundenprojekt und wird nie ersetzt — deshalb dürfen die Befehle nicht an
npm-Skriptnamen hängen. Ausgeliefert wird jetzt der eigenständige Einstiegspunkt `installer/eyis.ts`
mit `status`, `plan`, `step`, `seeds`, `verify`, `pack`, `bootstrap`, `doctor`, `resources`.
Das Release-Artefakt enthält zusätzlich `scripts/commerce-bootstrap.ts`, `scripts/commerce-doctor.ts`,
`scripts/installer/agent-plan.ts` und den Admin-Scope (408 Dateien statt zuvor 402).

## B4 — Route-Guard-Integration

Status: **PASS**

Der frühere Patch setzte ein `return <Outlet />` an den Anfang der Root-Komponente: das umging
jeden Provider des Kundenprojekts und setzte einen `useRouterState`-Import voraus, der nicht
zuverlässig gesetzt wurde.

Neu: EYIS liefert `src/eyis/shell/EyisRouteBoundary.tsx` mit. `applyRootGuard` kapselt damit den
Inhalt **innerhalb des innersten Providers** (`QueryClientProvider`, Theme, Auth bleiben aktiv) und
fügt genau einen Import ein. Kein früher Return, markerbasiert, idempotent.

## B5 — Echte `.eyis-admin` Token-Isolation

Status: **PASS**

Das Manifest beschrieb den CSS-Eingriff nur als leeren Rumpf. Ausgeliefert wird jetzt
`installer/distribution/eyis-admin-scope.css` — der vollständige Tokenblock, generiert aus
`src/styles.css` (`bun run eyis:dist:admin-scope`), inklusive lokal deklarierter Typografie
(`--font-sans`, `--font-display`). `eyis:dist:admin-scope:check` läuft in `bun run verify` und
schlägt bei Drift oder fehlenden Pflicht-Tokens fehl. Der Scope enthält kein `:root`.

---

## Nicht Teil dieser Phase

- Kein neuer RC-Tag, kein Stable Release.
- Keine Änderung an Commerce-Engines, Store API v1, RLS oder Migrationskette.
- Live-Provider (Stripe Live, echter E-Mail-Versand, Carrier) bleiben unverändert BLOCKED.
