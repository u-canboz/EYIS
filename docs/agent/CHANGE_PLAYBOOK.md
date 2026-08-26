# Change Playbook

Für jede wiederkehrende Änderung: fester Ablauf, feste Nachweise. Kein Punkt gilt als erledigt ohne
Beleg.

## Allgemeiner Rahmen (gilt immer)

1. Betriebsart klären ([OPERATING_MODES.md](OPERATING_MODES.md)).
2. Umgebung feststellen. Production → nur nach Runbook und Freigabe.
3. Modul finden ([MODULE_REGISTRY.md](MODULE_REGISTRY.md)), lokale `AGENTS.md` lesen.
4. Bestehenden Code lesen und Muster übernehmen.
5. Umsetzen — kleinster sinnvoller Umfang.
6. `bun run verify`.
7. Nachweis dokumentieren (Testausgabe, QA-Lauf, DB-Abfrage).

---

## A. Neues Feld an einem bestehenden Produkt/Objekt

1. Migration: Spalte hinzufügen, `NOT NULL` nur mit Default, RLS bleibt unverändert.
2. Typen regenerieren lassen, Server-Funktion und Backoffice-Formular erweitern.
3. **Öffentliche Sichtbarkeit ist eine bewusste Entscheidung.** Ohne Eintrag in
   `src/lib/commerce/store/mappers.server.ts` bleibt das Feld intern — das ist der Standard.
4. Wird es öffentlich: `api-catalog.ts` ergänzen, `bun run generate:manifests`, Store-API-QA laufen
   lassen.

## B. Neue Tabelle

Reihenfolge in **einer** Migration, ohne Ausnahme:

```sql
CREATE TABLE public.x (... organization_id uuid not null, shop_id uuid, created_at, updated_at);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.x TO authenticated;
GRANT ALL ON public.x TO service_role;
ALTER TABLE public.x ENABLE ROW LEVEL SECURITY;
CREATE POLICY ... USING (<Mitgliedschaft der Organisation>);
CREATE INDEX ON public.x (organization_id);
```

Danach: `updated_at`-Trigger, Fremdschlüssel, Constraints, Modul-Eintrag in `modules.def.ts`,
`bun run generate:manifests`, `bun run qa:rls`.
Details: [MIGRATION_RULES.md](MIGRATION_RULES.md).

## C. Neuer Store-API-Endpunkt

1. Handler in `src/lib/commerce/store/routes.server.ts` ergänzen: Methode, Pfad, Rate-Profil,
   Autorisierungsstufe.
2. Ausgabe über `mappers.server.ts` mappen — nie ein internes Objekt direkt zurückgeben.
3. Shop-Bindung im Handler erzwingen (`ctx.key.shopId`), Cart-/Kunden-/Gast-Token prüfen, wo nötig.
4. `api-catalog.ts` ergänzen (Beschreibung, Fehler, SDK-Aufruf) — der Generator vergleicht beide
   Listen und schlägt bei Abweichung fehl.
5. SDK-Methode in `src/lib/store-sdk` ergänzen; bestehende Signaturen nicht brechen.
6. `bun run generate:manifests && bun run verify && bun run qa:store-api`.
7. **Keine Breaking Changes an v1.** Nur additiv.

## D. Neue Backoffice-Seite

1. Route unter `src/routes/_authenticated/app/...` anlegen (TanStack-Routing; einen Pages-Ordner gibt es hier nicht).
2. Daten über `*.functions.ts` mit `requireSupabaseAuth` laden, Berechtigung prüfen.
3. Shell-Bausteine verwenden: `PageHeader`, `FilterBar`, `TableScroll`/`RecordCardList`.
4. Mobil ab 320 px prüfen, kein horizontaler Überlauf, Touch-Ziele ≥ 44 px.
5. Navigationseintrag in `src/components/shell/nav-registry.ts` ergänzen.
6. `bun run generate:manifests` (Routen-Manifest) und `bun run verify`.

## E. Neue Automationsregel / neues Ereignis

1. Ereignis in der Outbox erzeugen, nicht direkt handeln.
2. Kernprozesse bleiben im Code — Automationen nur für Händlerlogik.
3. Idempotenz sicherstellen; Wiederholungen dürfen keine Doppelwirkung haben.
4. `bun run qa:jobs`.

## F. Zahlungs- oder Versandprovider anbinden

**Freigabepflichtig.** Ohne ausdrückliche Freigabe bleibt der Mock-Provider aktiv.

1. Secrets über die Secret-Verwaltung setzen, niemals im Code.
2. Webhook-Route unter `src/routes/api/public/webhooks/` mit Signaturprüfung vor jeder Verarbeitung.
3. Idempotenz über `payment_events`/`idempotency_keys`.
4. Erst Sandbox, Nachweis dokumentieren, dann Live — nie ungeprüft echte Zahlungen.

## G. Datenbankänderung auf Production

1. Runbooks lesen: `docs/production/MIGRATION_RUNBOOK.md` und `docs/production/ROLLBACK_PLAN.md`.
2. Backup nachweisen (Zeitstempel, Umfang).
3. Migration auf Dev anwenden und prüfen, dann Staging, dann Production.
4. Rollback-Weg vorher schriftlich festhalten.
5. Nach der Anwendung: `health_run_checks` ausführen und Ergebnis dokumentieren.

## H. Neuer Kunde / neue Storefront

Kein Code-Change. Siehe [CUSTOMER_ONBOARDING.md](CUSTOMER_ONBOARDING.md) bzw.
[NEW_STOREFRONT_RUNBOOK.md](NEW_STOREFRONT_RUNBOOK.md).

---

## Was ohne Rückfrage verboten bleibt

- RLS abschalten oder Policies lockern
- v1 der Store API brechen
- Preise, Steuern oder Bestände im Client berechnen
- Ausgestellte Belege ändern
- Seeds, QA-Läufe oder Migrationen ohne Runbook gegen Production
- Secrets ändern, ausgeben oder rotieren
- Neue Supabase Edge Functions anlegen
