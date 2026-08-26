# Änderung

<!-- Was ändert sich fachlich und warum? -->

**Betroffenes Modul (`docs/agent/modules.json`):**
**Betriebsart (A/B/C, siehe `docs/agent/OPERATING_MODES.md`):**

## Nachweise

<!-- Kein Punkt gilt ohne Beleg. Befehl + Ergebnis einfügen. -->

- [ ] `bun run verify` grün
- [ ] `bun run generate:manifests` ausgeführt, falls Routen, API oder Module berührt wurden
- [ ] Passender `qa:*`-Lauf gegen Dev (welcher, welches Ergebnis?):

## Grenzen eingehalten

- [ ] Mandantenfilter (`organization_id`/`shop_id`) in jeder neuen Abfrage
- [ ] Neue Tabellen: `CREATE TABLE` → `GRANT` → `ENABLE RLS` → `POLICY` in derselben Migration
- [ ] Keine Berechnung von Preisen, Steuern oder Beständen im Client
- [ ] Keine Änderung an unveränderlichen Daten (Belege, `tax_snapshots`, `order_items`)
- [ ] Store API v1 nur additiv erweitert, keine Breaking Changes
- [ ] Neue öffentliche Felder bewusst in die DTO-Allowlist aufgenommen
- [ ] Storefront/SDK ohne Supabase- oder Commerce-Kern-Import
- [ ] Keine Secrets in Code, Logs oder Dokumentation

## Production

- [ ] Keine Seeds, QA-Läufe oder echten Zahlungen gegen Production
- [ ] Migration auf Production (falls zutreffend): Runbook, Backup-Nachweis und Freigabe vorhanden

## Risiko und Rollback

<!-- Was passiert im Fehlerfall, wie wird zurückgerollt? -->
