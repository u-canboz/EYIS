# AGENTS-Regeln — Migrationen (`supabase/migrations/`)

Bereichsregeln für alle Datenbankänderungen. Sie liegen hier statt im Migrationsordner, weil dieser
Ordner vom Migrationswerkzeug verwaltet wird und keine zusätzlichen Dateien aufnimmt.

Der Ordner `supabase/migrations/` ist die **einzige** Quelle für Schemaänderungen. Kein
Schema-Eingriff über Konsolen, Skripte oder Server-Funktionen. Migrationen werden ausschließlich
über das Migrationswerkzeug angewandt, das die Datei selbst schreibt.

## Pflichtreihenfolge für jede neue Tabelle in `public`

```sql
-- 1. Tabelle
CREATE TABLE public.<name> (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  shop_id uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  -- Fachfelder
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. GRANTs (ohne sie liefert die Data API einen Berechtigungsfehler — RLS allein genügt nicht)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.<name> TO authenticated;
GRANT ALL ON public.<name> TO service_role;
-- GRANT SELECT ... TO anon;  nur wenn es wirklich eine öffentliche Lese-Policy gibt

-- 3. RLS aktivieren
ALTER TABLE public.<name> ENABLE ROW LEVEL SECURITY;

-- 4. Policies (mandantengebunden)
CREATE POLICY "<name>_member_access" ON public.<name>
  FOR ALL TO authenticated
  USING (public.has_permission(auth.uid(), organization_id, '<permission>'))
  WITH CHECK (public.has_permission(auth.uid(), organization_id, '<permission>'));

-- 5. Indizes und Trigger
CREATE INDEX ON public.<name> (organization_id);
CREATE INDEX ON public.<name> (shop_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.<name>
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
```

## Checkliste vor dem Anwenden

- [ ] `organization_id` vorhanden, `shop_id` wo fachlich nötig
- [ ] GRANTs in derselben Migration, `anon` nur bei echter öffentlicher Lese-Policy
- [ ] RLS aktiviert und Policies mandantengebunden
- [ ] Fremdschlüssel mit passender `ON DELETE`-Regel
- [ ] Indizes auf `organization_id`, `shop_id` und allen Fremdschlüsseln
- [ ] Defaults und `NOT NULL` so gewählt, dass bestehende Inserts nicht brechen
- [ ] Zeitabhängige Regeln als Trigger, **nicht** als `CHECK` (`CHECK` muss immutable sein)
- [ ] `SECURITY DEFINER`-Funktionen mit `SET search_path = public` und eingeschränkten Rechten
- [ ] Rollback-Weg schriftlich festgehalten
- [ ] Kein `ALTER DATABASE`, keine Eingriffe in `auth`, `storage`, `realtime`, `vault`
- [ ] Buckets nicht per SQL anlegen/ändern (nur Storage-Policies gehören in Migrationen)

## Verbote

- Bereits angewandte Migrationsdateien werden **nie** nachträglich verändert. Korrektur = neue
  Migration.
- Keine Migration auf Production ohne Runbook (`docs/production/RESTORE_RUNBOOK.md`),
  Backup-Nachweis und Freigabe.
- Kein `GRANT ALL` an `anon` oder `authenticated`.
- Kein Deaktivieren von RLS, auch nicht temporär.
- Kein Löschen oder Zurücksetzen von Nummernkreisen.
- Keine Änderung an unveränderlichen Daten (`tax_snapshots`, ausgestellte Belege).

## Nach dem Anwenden

```bash
bun run qa:migrations   # Integrität und Drift, nur gegen Dev
bun run qa:rls          # RLS, Grants, Cross-Tenant
bun run generate:manifests
bun run verify
```

Neue Tabellen zusätzlich im Modulregister eintragen (`scripts/manifest/modules.def.ts`).
