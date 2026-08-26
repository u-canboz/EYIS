# AGENTS.md — Commerce-Kern

Gilt für `src/lib/commerce/**`. Ergänzt die Root-[AGENTS.md](../../../AGENTS.md).

## Was hier lebt

Die gesamte Fachlogik: Pricing, Tax, Cart, Checkout, Payments, Orders, Inventory, Documents,
Fulfillment, Returns, Communications, Automation, Store API, Health, Demo.

## Regeln

1. **Keine UI-Logik.** Keine React-Komponenten, keine JSX, kein Zugriff auf `window`,
   `document` oder `localStorage`. Formatierung für die Anzeige gehört in die UI.
2. **Keine Importe aus `src/routes/**`, `src/components/**` oder `src/lib/store-sdk/**`.**
   Der Kern ist die unterste Schicht.
3. **Mandantenfilter ist Pflicht.** Jede Abfrage filtert nach `organization_id` und, wo vorhanden,
   `shop_id`. Auch bei Admin-Client-Nutzung — der umgeht RLS und schützt dich nicht.
4. **Dateikonventionen**
   - `*.server.ts` — server-only, nie aus Komponenten importiert.
   - `*.functions.ts` — dünne Hülle: nur Imports, Typen und `createServerFn`-Deklarationen.
     Keine Helfer, Konstanten oder Mock-Generatoren auf Modulebene (Code-Splitting entfernt sie).
   - `*-engine.ts` — reine, testbare Berechnung ohne I/O.
5. **Secrets nur im `.handler()`** lesen, nie auf Modulebene. Admin-Client in client-erreichbaren
   Dateien per `await import("@/integrations/supabase/client.server")` im Handler.
6. **Geld** immer als Minor Units (Integer) mit Währungscode; Helfer in `money.ts`. Kein
   Fließkomma-Rechnen mit Beträgen.
7. **Unveränderlichkeit** respektieren: `tax_snapshots`, ausgestellte Belege, `order_items`,
   `payment_events`. Korrekturen nur über neue Datensätze.
8. **Idempotenz** bei allem, was doppelt eintreffen kann: Zahlungen, Webhooks, Jobs, Seeds.
9. **Kernprozesse bleiben im Code.** Payment → Order, Order → Inventory-Commit, Belegerzeugung
   werden niemals in Automationsregeln verlagert.
10. **Bestände** ändern sich ausschließlich über Inventory-Bewegungen, nie durch direktes `UPDATE`
    auf Bestandsstände.
11. **Neue Felder sind nicht automatisch öffentlich.** Öffentlich wird nur, was in
    `store/mappers.server.ts` in die Allowlist aufgenommen wird.

## Vor dem Abschluss

```bash
bun run test        # Engine-Tests
bun run verify
```

Bei Datenbankberührung zusätzlich der passende `qa:*`-Lauf gegen Dev — nie gegen Production.
