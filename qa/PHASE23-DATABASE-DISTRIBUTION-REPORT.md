# Phase 23 — Database Distribution & Dedicated Fresh Installer V2

Datum: 2026-08-29
Umfang: Haupt-EYIS-Projekt. Kein Commerce-Feature geändert, keine Engine-Logik angefasst.
Status-Skala: PASS, FAIL, OFFEN, BLOCKED.

## 1. Ergebnis

| Bereich | Status | Nachweis |
| --- | --- | --- |
| Baseline-Generator | PASS | `bun run eyis:database:baseline` erzeugt 43 Units, 2 Seeds, Manifest, Fingerprint |
| Fresh Install gegen leere DB | PASS | `bun run qa:database-installer` — 13/13, echte Postgres-Instanz, ohne Migrationskette |
| Struktur-Fingerprint identisch | PASS | `8867849192ba1ac3596f79db45ff9b3d5faac825c84503e8f1450c5c1055f657` in Live-DB und Frisch-Installation |
| Unterbrechung und Wiederaufnahme | PASS | Abbruch nach 9 Units → `PARTIAL_INSTALL` → 34 Units fortgesetzt → Fingerprint identisch |
| Idempotente System-Seeds | PASS | Zwei Läufe, 482 Rechte-Zeilen unverändert |
| Migration History Reconciliation | PASS | 54 Versionen als `applied` registriert, `supabase db push` würde nichts nachspielen |
| Baseline über bestehende Installation | PASS | `runFreshInstall` bricht bei `INSTALLED` hart ab |
| RLS vollständig | PASS | 0 Tabellen ohne Row Level Security in der Frisch-Installation |
| Drift Gate | PASS | Generator bricht ab, wenn Live-Schema nicht zum Migration Head passt |
| Payload-Limits | PASS | größte Unit 29.850 Bytes, größtes atomares Statement 29.681 Bytes (< 48 KB) |
| Ressourcen-Manifest | PASS | `installer/resources/eyis-resources.manifest.json` (Buckets, Jobs, Runtime-Konfiguration, keine Secrets) |
| Verify-Suite | PASS | `bun run verify` grün |
| Buckets/Crons automatisch anlegen | OFFEN | Manifest beschreibt sie; die Bereitstellung erfolgt weiterhin über Plattform-Tools |
| Signierte Auslieferung des Packs | OFFEN | Manifest trägt Checksummen, aber noch keine Ed25519-Signatur wie beim Update Center |

## 2. Artefakt

```
installer/database/
  eyis-database-installer.manifest.json
  baseline/000_installer_journal.sql … 043_*.sql
  seeds/001_role_permissions.sql, 002_installation.sql
  reconcile/001_migration_history.sql
  verification/fingerprint.json, expected-objects.json, ownership.json
installer/resources/eyis-resources.manifest.json
```

Reihenfolge fest, Checksumme je Unit, Journal in `eyis_installation_state` /
`eyis_installation_units`, Wiederaufnahme an exakt der abgebrochenen Stelle.

## 3. Nachgewiesene Defekte, die dabei behoben wurden

1. **Funktions-Reihenfolge:** Wechselseitig referenzierende SQL-Funktionen ließen sich nicht in einer
   festen Reihenfolge anlegen. Units setzen jetzt `check_function_bodies = off`.
2. **Installations-Seed unvollständig:** `commerce_installation` verlangt `installation_id` und
   `core_version`; der Seed lieferte beide nicht. Ohne den Fresh-Install-Test wäre das erst beim
   Kunden aufgefallen.
3. **Zustandserkennung:** Eine über die Migrationskette gebaute Alt-Installation wurde als
   `PARTIAL_INSTALL` gemeldet. Sie gilt jetzt als `INSTALLED`, verifiziert über den Fingerprint.

## 4. Grenzen

- Der QA-Cluster ersetzt `pg_net` durch einen Stub und legt die Supabase-Rollen und das
  `auth`-Schema selbst an. Beides stellt auf einer echten Lovable-Cloud-Datenbank die Plattform
  bereit und ist nicht Teil des Packs.
- Storage-Buckets und Cron-Jobs sind beschrieben, aber nicht durch SQL installierbar (OFFEN).
- Live-Provider (Stripe Live, echter Mailversand, verifizierte Absenderdomain, echte Carrier)
  bleiben unverändert BLOCKED.

## 5. Befehle

| Befehl | Zweck |
| --- | --- |
| `bun run eyis:database:baseline` | Install Pack aus der Live-Struktur erzeugen (nur Hauptprojekt) |
| `bun run eyis:database:verify` | Struktur gegen den Fingerprint prüfen |
| `bun run eyis:install:status` | Installationszustand |
| `bun run eyis:install:next` | Nächste offene Unit inklusive SQL |
| `bun run eyis:install:inspect` | Partial-Install-Analyse und Recovery-Bewertung |
| `bun run qa:database-installer` | Fresh Install gegen eine echte leere Datenbank |
