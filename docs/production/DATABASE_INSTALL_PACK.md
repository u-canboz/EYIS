# EYIS Database Install Pack (Fresh Installer V2)

Eine frische EYIS-Dedicated-Installation baut ihre Datenbank **nicht** aus der historischen
Migrationskette auf, sondern aus einem versionierten Installationsartefakt.

## Was ausgeliefert wird

```
installer/
  database/
    eyis-database-installer.manifest.json   Manifest: Units, Reihenfolge, Checksummen, Fingerprint
    eyis-database-installer.signature.json  Ed25519-Signatur über Manifeste, Units und Seeds
    baseline/000_installer_journal.sql      Journal und Zustandstabellen (immer zuerst)
    baseline/001..NNN_*.sql                 Installation Units in fester Reihenfolge
    seeds/eyis-system-seeds.manifest.json   Seed-Units, Checksummen, Pflichtschlüssel, Fingerprint
    seeds/eyis-dml-audit.json               DML-Audit der gesamten Migrationskette
    seeds/001_role_permissions.sql          Systemseeds (idempotent, keine Kundendaten)
    seeds/002_installation.sql
    seeds/003_product_blueprints.sql
    seeds/004_communication_templates.sql
    seeds/005_tax_system.sql
    reconcile/001_migration_history.sql     Registriert enthaltene Migrationsversionen als applied
    verification/fingerprint.json           Erwarteter Struktur-Fingerprint
    verification/expected-objects.json      Erwartete Objekte (Tabellen, RLS, Policies, Grants …)
    verification/ownership.json             Aktuelle und historische EYIS-Objekt-Ownership
  distribution/eyis-code-distribution.manifest.json  Verteilungsgrenzen des Anwendungscodes
  resources/eyis-resources.manifest.json    Buckets, Jobs, Runtime-Konfiguration (ohne Secrets)
```

## System Seeds sind Teil der Installation, nicht Beiwerk

Eine strukturell vollständige Datenbank ist **nicht** fertig installiert. Ohne Systemdaten fehlen
Produkt-Blueprints, System-E-Mail-Vorlagen und Steuerklassen — das Backoffice kann dann weder ein
Produkt anlegen noch eine Bestätigungsmail rendern.

Die Systemdaten stammen wortgleich aus den Migrationen, in denen sie ursprünglich standen, und
werden lediglich idempotent gekapselt. Erzeugung, Prüfung und Nachweis:

```
bun run eyis:seeds:audit      # DML-Audit: jede Systemdatenanweisung ist einer Unit zugeordnet
bun run eyis:seeds:generate   # Seed-Dateien und Seed-Manifest aus der Migrationskette erzeugen
bun run eyis:seeds:verify     # Manifest-Integrität + (falls erreichbar) Datenbankzustand
```

Der `system_seed_fingerprint` im Seed-Manifest gehört zusammen mit dem `schema_fingerprint` zum
Ready-Kriterium: **beide** müssen PASS melden.


## Weg ohne privilegierten Datenbankzugang (Regelfall)

Eine frische Lovable-Cloud-Datenbank erlaubt dem verfügbaren Benutzer kein DDL im Schema `public`.
Privilegierte Migrationen laufen dort ausschließlich über das Plattform-Migration-Tool, das dem
installierenden Agenten zur Verfügung steht. Der Installer erzeugt dafür einen deterministischen
Agent Migration Plan:

```
bun run installer/eyis.ts plan        # 53 Schritte: Units → Seeds → Reconciliation → Abschluss
bun run installer/eyis.ts step <n>    # genau eine Migration, unverändert an das Plattformwerkzeug
```

Jede Stufe schreibt ihren Journaleintrag in derselben Migration. Zustand, Wiederaufnahme und
Nachweis brauchen deshalb keinen direkten Datenbankzugang. `runFreshInstall` (psql-Pfad) bleibt für
Umgebungen mit echtem Superuser-Zugang, prüft die Rechte vorab und verweist sonst auf den Plan.

Alle Installationsbefehle sind über den ausgelieferten Einstiegspunkt `installer/eyis.ts`
erreichbar — unabhängig von der kundeneigenen `package.json`.

## Reihenfolge im Kundenprojekt

1. `bun run eyis:install:status` — Zustand feststellen (`NOT_INSTALLED`, `PARTIAL_INSTALL`, `INSTALLED`).
2. Bei `PARTIAL_INSTALL`: `bun run eyis:install:inspect` und den Recovery-Pfad im Report befolgen.
3. Units strikt in Manifest-Reihenfolge anwenden. Ein Agent holt die jeweils nächste Unit mit
   `bun run eyis:install:next` und wendet sie über das Migration Tool an. Nach jeder Unit wird der
   Journaleintrag geschrieben; danach ist die Installation jederzeit wieder aufnehmbar.
4. Systemseeds anwenden (idempotent, mehrfach ausführbar) — `bun run eyis:seeds:sql` liefert das
   gesamte Seed-SQL, `bun run eyis:seeds:verify` den Nachweis.
5. `reconcile/001_migration_history.sql` anwenden — **vor** dem ersten `supabase db push`.
6. `bun run eyis:database:verify` — Strukturvergleich gegen den Fingerprint. Nur `PASS` gilt.
7. `bun run eyis:resources:provision` — Buckets anlegen, Job-Endpunkte und Runtime-Konfiguration
   prüfen. Cron-Zeitpläne bleiben Sache der Plattform des Kundenprojekts.
8. `bun run eyis:pack:verify` — Signatur des Packs. Ohne Signaturdatei: BLOCKED, nicht PASS.


## Harte Regeln

- Der Baseline wird **niemals** über eine bestehende Installation gelegt. `runFreshInstall` bricht
  bei `INSTALLED` ab.
- Units werden nie umsortiert, nie zusammengefasst, nie mitten in einem Statement geteilt.
- Kein Statement wird ohne Journaleintrag ausgeführt.
- Kundendaten und Kundentabellen werden nie gelöscht. Recovery entfernt ausschließlich Objekte, die
  in `verification/ownership.json` als EYIS-eigen geführt sind — und nur, solange keine
  Commerce-Daten vorhanden sind.
- Secrets stehen niemals im Pack. `PROVIDER_CREDENTIALS_KEY` und `LOVABLE_CRON_SECRET` werden projektlokal
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
