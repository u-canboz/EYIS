# EYIS Database Install Pack (Fresh Installer V2)

Eine frische EYIS-Dedicated-Installation baut ihre Datenbank **nicht** aus der historischen
Migrationskette auf, sondern aus einem versionierten Installationsartefakt.

## Was ausgeliefert wird

```
installer/
  database/
    eyis-database-installer.manifest.json   Manifest: Units, Reihenfolge, Checksummen, Fingerprint
    baseline/000_installer_journal.sql      Journal und Zustandstabellen (immer zuerst)
    baseline/001..NNN_*.sql                 Installation Units in fester Reihenfolge
    seeds/001_role_permissions.sql          Systemseeds (idempotent, keine Kundendaten)
    seeds/002_installation.sql
    reconcile/001_migration_history.sql     Registriert enthaltene Migrationsversionen als applied
    verification/fingerprint.json           Erwarteter Struktur-Fingerprint
    verification/expected-objects.json      Erwartete Objekte (Tabellen, RLS, Policies, Grants …)
    verification/ownership.json             Aktuelle und historische EYIS-Objekt-Ownership
  resources/eyis-resources.manifest.json    Buckets, Jobs, Runtime-Konfiguration (ohne Secrets)
```

## Reihenfolge im Kundenprojekt

1. `bun run eyis:install:status` — Zustand feststellen (`NOT_INSTALLED`, `PARTIAL_INSTALL`, `INSTALLED`).
2. Bei `PARTIAL_INSTALL`: `bun run eyis:install:inspect` und den Recovery-Pfad im Report befolgen.
3. Units strikt in Manifest-Reihenfolge anwenden. Ein Agent holt die jeweils nächste Unit mit
   `bun run eyis:install:next` und wendet sie über das Migration Tool an. Nach jeder Unit wird der
   Journaleintrag geschrieben; danach ist die Installation jederzeit wieder aufnehmbar.
4. Systemseeds anwenden (idempotent, mehrfach ausführbar).
5. `reconcile/001_migration_history.sql` anwenden — **vor** dem ersten `supabase db push`.
6. `bun run eyis:database:verify` — Strukturvergleich gegen den Fingerprint. Nur `PASS` gilt.
7. Ressourcen aus `eyis-resources.manifest.json` bereitstellen und prüfen.

## Harte Regeln

- Der Baseline wird **niemals** über eine bestehende Installation gelegt. `runFreshInstall` bricht
  bei `INSTALLED` ab.
- Units werden nie umsortiert, nie zusammengefasst, nie mitten in einem Statement geteilt.
- Kein Statement wird ohne Journaleintrag ausgeführt.
- Kundendaten und Kundentabellen werden nie gelöscht. Recovery entfernt ausschließlich Objekte, die
  in `verification/ownership.json` als EYIS-eigen geführt sind — und nur, solange keine
  Commerce-Daten vorhanden sind.
- Secrets stehen niemals im Pack. `PROVIDER_CREDENTIALS_KEY` und `CRON_SECRET` werden projektlokal
  erzeugt.

## Nach der Installation

Der Baseline ist der neue Ausgangspunkt. Jede weitere Schemaänderung läuft ausschließlich über
Migrationen und `supabase db push`. Weicht die Live-Struktur später vom Fingerprint ab, ist das
Drift und wird über `bun run eyis:database:verify` sichtbar.

## Neuen Baseline erzeugen (nur im Haupt-EYIS-Projekt)

```
bun run eyis:database:baseline     # Introspektion → Units, Seeds, Manifest, Fingerprint
bun run qa:database-installer      # Fresh Install gegen eine echte leere Datenbank
```

Der Generator bricht ab, wenn die Live-Struktur nicht zum Migration Head passt (Drift Gate) oder ein
unteilbares Statement das Payload-Limit überschreitet.
