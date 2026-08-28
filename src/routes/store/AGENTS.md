# AGENTS.md — Referenz-Storefront

Gilt für `src/routes/store/**`. Ergänzt die Root-[AGENTS.md](../../../AGENTS.md).

## Zweck

Beispiel-Storefront, die zeigt, wie ein Kundenprojekt das EYIS anbindet. Sie ist zugleich der
lebende Nachweis, dass die Store API v1 und das SDK für eine vollständige Storefront ausreichen.

## Harte Grenzen (per ESLint und Test erzwungen)

Verboten in diesem Ordner:

- `@supabase/supabase-js`, `@/integrations/supabase/*`
- jeder Import aus `@/lib/commerce/*`
- direkte `fetch`-Aufrufe gegen `/api/public/store/v1`
- Zugriff auf Server-Secrets oder den Admin-Client

Erlaubt: ausschließlich `@/lib/store-sdk` plus UI-Bausteine aus `@/components/ui`.

## Regeln

1. **Nur SDK-Aufrufe.** Fehlt eine Funktion, wird sie im SDK und in der API ergänzt — nicht hier
   umgangen.
2. **Keine Berechnungen.** Preise, Steuern, Rabatte, Versandkosten und Bestände werden angezeigt,
   nicht ermittelt. Beträge sind Minor Units und werden nur formatiert.
3. **Keine Geheimnisse.** Nur der Publishable Key, konfiguriert über `VITE_`-Variablen. Kein
   fest verdrahteter Key im Code.
4. **Serverzustand nicht spiegeln.** Nach jeder Mutation neu laden statt lokal fortschreiben.
5. **Fehlerfälle sichtbar behandeln:** `CART_EXPIRED`, `OUT_OF_STOCK`, `CHECKOUT_INVALID`,
   `PAYMENT_FAILED`, `RATE_LIMITED`, `CUSTOMER_SESSION_EXPIRED`.
6. **Responsiv ab 320 px**, kein horizontaler Überlauf, Touch-Ziele ≥ 44 px.
7. **Schlank bleiben.** Diese Storefront ist Referenz, kein Produkt. Keine kundenspezifischen
   Sonderwünsche hier einbauen — dafür entsteht ein eigenes Projekt (Betriebsart B).

## Vor dem Abschluss

```bash
bun run test      # Grenz-Tests des SDK
bun run verify
```
