# EYIS Core — Database Distribution & Dedicated Fresh Installer V2

## Befund im Hauptprojekt

- 54 Migrationen, 563 KB SQL, größte Einzeldatei 46 KB — für das Migration Tool eines neuen Projekts unbrauchbar als Fresh-Install-Weg.
- Live-Schema: 122 Tabellen, 106 Funktionen in `public`. Lesender DB-Zugriff (`psql`, Introspektion) ist vorhanden — reicht zur Baseline-Erzeugung.
- Bereits vorhanden und wiederverwendbar: `commerce_installation` (mit `schema_version`, `system_seed_version`, `installed_release_id`), `src/lib/commerce/system/installation.server.ts` (Bootstrap/Claim/Doctor), `src/lib/commerce/updates/**` (Update Center, Ownership-Registry, Versionen).
- Es fehlt komplett: ein versioniertes Datenbank-Installationsartefakt im Repository.

## Was gebaut wird

### 1. Baseline-Generator (Schema-Introspektion, kein Migration-Concat)

Neuer Generator `bun run eyis:database:baseline` unter `scripts/installer/`:

- Liest den **Endzustand** aus der Live-DB über Systemkataloge (Extensions, Enums, Tabellen/Spalten/Defaults, PK/FK/Unique/Check, Indexe, Funktionen via `pg_get_functiondef`, Trigger, RLS-Flags, Policies, Grants).
- Erzeugt daraus deterministisch sortiertes DDL. Keine Daten, keine Secrets, keine Kunden-/Demo-Zeilen.
- Kein `cat migrations/*.sql`, keine historischen Zwischenzustände.

Ausgabe unter `installer/database/`:

```text
installer/database/
  eyis-database-installer.manifest.json
  baseline/001_extensions_enums.sql ... NNN_*.sql
  seeds/001_system_seeds.sql
  verification/fingerprint.json
  verification/expected-objects.json
```

### 2. Installation Units mit Payload-Budget

- Aufteilung nach realem Schema in Domänen (foundation, identity/tenants, catalog, pricing, inventory, cart/checkout, payments/orders, tax/shipping, customers/returns, documents, communications, automation, store-api, system/updates), pro Domäne getrennt in `_tables` / `_functions` / `_policies_grants`.
- Harte Obergrenze **18 KB pro Unit**; wird sie überschritten, splittet der Generator automatisch weiter (`007a`, `007b`, …).
- Reihenfolge ist topologisch (Typen → Tabellen → FKs → Funktionen → Trigger → RLS/Policies → Grants → Indexe).

### 3. Installer-Manifest

`eyis-database-installer.manifest.json` mit `version`, `schema_version`, `migration_head` (aktuell die 54. Migration), `schema_fingerprint`, Unit-Liste (`id`, `file`, `position`, `checksum`, `bytes`, `required`), `system_seeds`, `verification`. Der Dedicated-Agent liest nur dieses Manifest — kein Durchsuchen der Migrationshistorie.

### 4. Installations-Journal & Zustandserkennung

Erste Unit (`000_installer_journal.sql`, wenige KB) legt `eyis_installation_state` und `eyis_installation_units` an (RLS + Grants nach Hausregel). Danach wird pro Unit `unit_id`, `checksum`, `status`, `started_at`, `completed_at`, `error_code` fortgeschrieben.

Zustände: `NOT_INSTALLED` → Pack anwenden, `PARTIAL_INSTALL` → Recovery, `INSTALLED` → Pack **niemals** anwenden, nur Migrationen. Die Sperre gegen Baseline-über-Bestand wird im Code erzwungen, nicht nur dokumentiert.

### 5. Resumability & Recovery

- Wiederaufnahme über Journal + Checksums + Objekt-Inspektion, **nicht** über blindes `IF NOT EXISTS`.
- `bun run eyis:install:inspect` klassifiziert eine angefangene Installation (vorhandene EYIS-Tabellen/Enums/Funktionen, bekannte Migrationshistorie, ob echte Commerce-Daten existieren) und meldet `Safe clean reinstall possible: YES/NO`.
- Safe Reset entfernt ausschließlich Objekte, die die Ownership-Registry als EYIS-owned ausweist. Kein `DROP SCHEMA public CASCADE`.

### 6. Ownership-Registry für DB-Objekte

`src/lib/commerce/updates/ownership.ts` wird um DB-Objekte erweitert (Tabellen, Views, Funktionen, Typen, Trigger, Policies, Storage-Ressourcen), gespeist aus dem Baseline-Generator — damit Recovery EYIS-owned von Customer-owned trennen kann.

### 7. Schema-Fingerprint & Verification

`bun run eyis:database:verify` prüft nach der Installation den strukturellen Fingerprint (Tabellen, Kernspalten, Enums, Constraints, Funktionen, RLS aktiv, Policies, Grants, Schlüsselindexe) gegen `verification/fingerprint.json`. Nur Struktur wird gehasht, keine Daten.

### 8. Canonical Types statt Regenerierung mitten in der Installation

`src/integrations/supabase/types.ts` gilt als release-gebundene canonical Datei. Regel und Dokumentation: während einer laufenden/partiellen DB-Installation wird sie **nicht** regeneriert. Erst nach `PASS` von Pack + Verification optional neu generieren und gegen die canonical Version diffen; unerwartete Abweichung = Installation FAIL.

### 9. System Seeds getrennt

Schema (Pack) / System-Daten (Seeds, versioniert + idempotent, `system_seed_version`) / Demo-Daten (bestehender Demo-Seeder, nie Teil des Installers).

### 10. Update-Center-Kompatibilität

Nach Fresh Install steht `migration_head` auf dem Baseline-Head. Das Update Center liefert danach nur Delta-Migrationen (055, 056, …); Migration 001 wird nie erneut angeboten.

### 11. CLI & Agent-Ablauf

`bun run eyis:install:status | inspect | verify | doctor`. Die CLI führt kein DDL aus, wenn die Plattform das nicht erlaubt — sie liefert dem Agenten exakt die nächste offene Unit inklusive SQL, sodass er ohne Analyse Unit für Unit über das Migration Tool durchläuft.

### 12. Dokumentation & Agentenregeln

Aktualisiert: `docs/production/INSTALLATION.md`, `docs/production/UPDATE_CENTER.md`, `docs/agent/MIGRATION_RULES.md`, `AGENTS.md`, plus neu `docs/agent/DEDICATED_INSTALL_AGENT_PROMPT.md`. Verbindlich: Fresh Install = Database Install Pack; historische Migrationskette ist kein Fresh-Install-Weg; kein Zugriff auf die EYIS-Master-DB nötig oder erlaubt; Pack immer nur auf die eigene Cloud-DB des Kundenprojekts.

### 13. Verify & QA

`bun run verify` prüft zusätzlich: Manifest gültig, alle Units vorhanden, Checksums stimmen, Payload-Budget eingehalten, Schema-Version und Migration Head konsistent, canonical Types vorhanden, Agent-Docs aktuell.

Neue Harnesses: `qa:database-installer` (leere DB → Pack → Seeds → Bootstrap → Owner Claim → Shop → Key → Runtime Config → SDK), `qa:database-installer-recovery` (Abbruch bei Unit 9; Wiederaufnahme ohne `type already exists`; zusätzlich der reale Fall „7 historische Migrationen vorhanden"), `qa:database-installer-upgrade` (Baseline A → Testmigration B, nur Delta läuft).

Bericht: `qa/EYIS-DATABASE-INSTALLER-REPORT.md` mit Migrationszahl, historischer SQL-Größe, Baseline-Version, Unit-Anzahl, größter Unit, Migration Head, Fingerprint und der Statusmatrix (PASS/FAIL/OFFEN/BLOCKED).

## Kritische Ergänzungen (verbindlich, vor allem anderen)

### A. Migration History Reconciliation — nur EINE Migration Authority

Bestätigt: `templates/customer-repo/.github/workflows/eyis-update.yml` führt `supabase db push --db-url ...` aus, und `src/lib/commerce/updates/providers.server.ts` wertet genau diesen Schritt als Migrationsnachweis. Eine Baseline-Installation, bei der 001–054 nie einzeln liefen, kann die Supabase-Migrationshistorie leer lassen — das erste Update würde die Altmigrationen erneut anbieten.

Deshalb wird dieser Punkt als **erster Arbeitsschritt** geklärt, vor dem Generator:

1. Baseline vollständig installieren.
2. Schema-Fingerprint PASS — ohne PASS keine Reconciliation.
3. Das Baseline-Manifest führt **alle historischen Migration-Versions**, die strukturell in der Baseline enthalten sind.
4. Diese Versions werden ausschließlich über den offiziell unterstützten Supabase-Reconciliation-Weg (`supabase migration repair --status applied`) als Ausgangszustand registriert. Kein manuelles INSERT in interne Supabase-Tabellen, kein "als angewendet markieren" ohne identischen Fingerprint.
5. Test: `supabase db push` darf 001–054 nicht erneut anbieten.
6. Test: eine Testmigration 055 muss als einzige ausstehende Migration erkannt werden.

Wenn dieser Weg mit der eingesetzten Infrastruktur nicht zuverlässig funktioniert, wird Phase 22 geändert: Dedicated-Updates verwenden dann nicht mehr `supabase db push` als Autorität, sondern signierte EYIS-Delta-Migration-Packs gegen den eigenen `migration_head`. Beide Wege parallel sind ausgeschlossen — es gibt genau eine Migration Authority, und die Entscheidung wird im Report dokumentiert.

### B. Baseline Provenance / Drift Gate

Die Live-DB wird nur dann zur Baseline-Quelle, wenn vorher nachgewiesen ist:

```text
Migration Registry Head  =  erwarteter EYIS Schema Head  =  Live Schema
```

Vor der Generierung prüft der Generator: Migration Head, bekannte Drift, unerwartete Tabellen/Funktionen/Policies, filtert extension-owned Objekte und Development-/Test-only-Objekte aus. Bei ungeklärtem Drift: **BASELINE GENERATION FAIL** mit Auflistung der abweichenden Objekte. Drift wird nie in eine Baseline eingebacken.

### C. Atomic SQL Units

18 KB ist ein **Ziel**, keine Schnittkante. Getrennt wird ausschließlich an vollständigen Statement-Grenzen; niemals innerhalb von `CREATE FUNCTION`, `DO`-Blöcken, `CREATE POLICY`, `CREATE TRIGGER`, `CREATE TYPE`, `ALTER TABLE` oder anderem atomarem DDL (Dollar-Quoting-bewusster Splitter). Der Generator berechnet `largest_atomic_statement_bytes`; überschreitet ein unteilbares Statement das nachgewiesene Tool-Limit, bricht er mit **FAIL** ab und nennt das betroffene Objekt. Kein still zerschnittenes SQL. Report führt: größte Unit, größtes atomares Statement, Payload-Limit.

### D. Historical EYIS Ownership Inventory

Die Registry aus dem finalen Schema kennt Objekte nicht, die eine frühere Migration anlegte und eine spätere entfernte (z. B. Tabellen aus Migration 004, gedroppt in 037) — genau der Fall im aktuellen „7 von 54"-Testprojekt. Zusätzlich zur aktuellen Registry wird deshalb ein Legacy-Inventory aus der historischen Migrationskette erzeugt (alle jemals von EYIS angelegten Tabellen, Typen, Funktionen, Trigger, Policies).

```text
Recovery Ownership = current EYIS ownership + historical EYIS ownership
```

Customer-owned Objekte werden auch dann niemals entfernt.

### E. Dedicated Resource Manifest (nicht-Schema-Ressourcen)

Das Database Install Pack deckt ausschließlich Schema und System Seeds ab. Alles andere kommt in `installer/resources/eyis-resources.manifest.json`: benötigte Storage Buckets samt Security-Erwartungen, Cron-/Job-Definitionen, Runtime-Configuration-Requirements, sonstige projektlokale Ressourcen. Keine Secrets darin. Nach `Database PASS` läuft ein eigener Resource-Provisioning- und Verification-Schritt (Buckets über die Storage-Tools, nicht über SQL).

### Gesamtablauf nach den Ergänzungen

```text
Unit 000 Journal → Baseline Units 1..N → Schema Verification
→ Migration History Reconcile → System Seeds → Resource Setup
→ Bootstrap → Owner Claim → Organization/Shop → Publishable Key
→ runtime-config → Store SDK → PASS
```

## Ausdrücklich nicht Teil dieser Arbeit

- Historische Migrationen werden nicht gelöscht, nicht verändert, nicht zusammengefasst.
- Keine neuen Commerce-Features, keine Änderung an Pricing/Tax/Inventory/Order-Logik.
- Kein Abschalten von RLS, keine `any`-Reparaturen, keine gefälschte Migrationshistorie, keine Laufzeitabhängigkeit zur EYIS-Master-DB.
- Keine Änderung am aktuellen Kundentestprojekt in diesem Durchgang.

## Grenzen

Ein echter Fresh Install gegen eine zweite, leere Cloud-Datenbank ist aus diesem Projekt heraus nicht ausführbar. Der Fresh-Install-Test wird deshalb gegen ein isoliertes leeres Schema in der Dev-Datenbank gefahren (Pack vollständig anwendbar, Fingerprint identisch); der Nachweis in einem echten neuen Lovable-Projekt bleibt der Abschlusstest und wird als solcher im Report geführt.
