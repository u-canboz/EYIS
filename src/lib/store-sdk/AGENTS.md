# AGENTS.md — Store SDK

Gilt für `src/lib/store-sdk/**`. Ergänzt die Root-[AGENTS.md](../../../AGENTS.md).

## Zweck

Der einzige unterstützte Weg, wie eine Storefront mit dem EYIS spricht. Framework-neutraler
Core plus React-Layer. Der Code wird von externen Projekten übernommen und muss daher völlig
eigenständig sein.

## Harte Grenzen (per Test erzwungen)

`__tests__/boundaries.test.ts` und `eslint.config.js` verbieten in diesem Ordner:

- `@supabase/supabase-js` und `@/integrations/supabase/*`
- jeden Import aus `@/lib/commerce/*`
- jeden Import aus `src/routes/**`
- Node-only-Module (`node:fs`, `node:crypto`, …)
- Server-Secrets in jeder Form

Erlaubt sind: `fetch`, Standard-Web-APIs, React (nur im `react/`-Unterordner) und eigene Typen.

## Regeln

1. **Keine Fachlogik.** Keine Preis-, Steuer-, Rabatt- oder Bestandsberechnung. Das SDK überträgt
   und typisiert, es rechnet nicht.
2. **Nur dokumentierte Endpunkte** aus `src/lib/commerce/store/api-catalog.ts`. Neue Methode heißt:
   erst Endpunkt und Katalogeintrag, dann SDK.
3. **Rückwärtskompatibel bleiben.** Bestehende Methodennamen, Parameter und Rückgabeformen dürfen
   sich nicht ändern. Neues nur additiv mit optionalen Parametern.
4. **Kompatibilität dokumentieren.** `sdk_version` und `compatible_api_versions` in
   `commerce-os.manifest.json` bei jeder relevanten Änderung nachziehen.
5. **Token-Handhabung** (Cart, Kunde, Gast) bleibt im SDK gekapselt; Speicherort ist konfigurierbar
   und funktioniert auch ohne `localStorage` (SSR).
6. **Fehler** werden auf die stabilen API-Codes normalisiert und tragen die Request-ID.
7. **Keine Abhängigkeiten hinzufügen.** Das SDK bleibt dependency-frei, damit es in beliebige
   Projekte kopiert werden kann.

## Verteilung

Aktuell `repository-source`: Kundenprojekte übernehmen diesen Ordner aus einem definierten Commit.
Es gibt **kein** npm-Paket `@commerce-os/sdk`; ein solcher Installationsbefehl darf nirgends
dokumentiert werden. Ablauf: `docs/agent/NEW_STOREFRONT_RUNBOOK.md`.

## Vor dem Abschluss

```bash
bun run test      # enthält die Grenz-Tests
bun run verify
```
