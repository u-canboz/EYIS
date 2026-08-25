# Phase 12 — QA-Report: Storefront SDK & Public Store API

Datum: 2026-08-25 · Harness: `qa/phase12.ts` (`bun run qa/phase12.ts`) · Ergebnis: **52/52 PASS**

## Umfang

Alle Prüfungen laufen ausschließlich über die öffentliche API `/api/public/store/v1/*` —
kein direkter Datenbankzugriff, kein Supabase-Client, keine internen Server Functions.
Es werden zwei Mandanten (Shop A, Shop B) mit je eigenem Publishable Key aufgesetzt.

## Ergebnisse

| Bereich | Prüfungen | Status |
| --- | --- | --- |
| Key-Lebenszyklus (Erstellung, Revoke, unbekannter Key, fremder Origin) | 5 | PASS |
| Config & Request-ID-Korrelation | 2 | PASS |
| Katalog (Liste, Detail, Suche, Kategorien) + Leak-Prüfung interner Felder | 6 | PASS |
| Cart (Erstellen, Token-Zwang, Position hinzufügen/ändern/entfernen, Totals, Promo) | 8 | PASS |
| Checkout (Start, Adresse, Versandarten, Auswahl, Validate, Payment-Session, Status) | 8 | PASS |
| Bestellbestätigung (kurzlebiger Token, Einlösung, Zweitverwendung abgelehnt) | 3 | PASS |
| Konto & Gast (Login-Fehlversuch, Session-Zwang, neutrale Gast-Antwort, Token-Fälschung) | 5 | PASS |
| Retouren (ohne gültigen Token abgelehnt) | 2 | PASS |
| **Cross-Tenant-Isolation** (Cart, Checkout, Order, Dokumente, Tracking, Returns mit fremden IDs/Tokens) | 9 | PASS |
| Fehlerform, Rate-Limit, Idempotenz, unbekannter Endpunkt | 4 | PASS |

## Sicherheits-Nachweise

- **Kein Existenz-Leak:** Zugriffe mit echten IDs aus Shop B über den Key von Shop A liefern
  durchgehend `403 FORBIDDEN` bzw. `404 NOT_FOUND` mit identischer Fehlerform
  (`{ error: { code, message }, requestId }`) — auch mit gültigem Cart-/Guest-Token aus Shop B.
- **Publishable Key ist keine Autorisierung:** Cart-, Konto-, Bestell- und Retouren-Endpunkte
  verlangen zusätzlich Cart-Token, Kunden-Session oder scoped Guest-Token.
- **Confirmation-Token:** kurzlebig, auf Order + Shop gescoped, exakt einmal einlösbar
  (zweiter Aufruf → `403`).
- **Rate-Limit:** `customer_login` greift nachweisbar mit `429`.
- **Keine internen Felder** (`organization_id`, Kosten, interne Status, Key-Hashes) in
  Katalog- oder Cart-DTOs.
- **Protokoll:** IP nur als täglich neu gesalzener Hash, nie in der UI.

## Weitere Gates

- Typecheck: grün
- Unit-/Boundary-Tests: 72/72 grün (`src/lib/store-sdk/__tests__/boundaries.test.ts` prüft,
  dass Storefront und SDK keine internen oder Supabase-Module importieren)
- ESLint-Boundary-Regeln für `src/routes/store/**` und `src/components/storefront/**` aktiv

## Während der QA gefundener und behobener Fehler

`order_finalize_from_payment` verknüpft den Steuer-Snapshot mit der neuen Bestellung
(`UPDATE tax_snapshots SET order_id = …`). Der Immutability-Trigger auf `tax_snapshots`
blockierte jedes Update und ließ damit jeden Checkout mit Steuer-Snapshot mit
„Snapshots sind unveränderbar." scheitern. Behoben durch einen Trigger, der genau eine
Mutation zulässt: das einmalige Setzen von `order_id` (von `NULL`), während alle übrigen
Felder und Löschungen weiterhin blockiert sind.
