# Gate B3 — Performance und Lastverhalten

Harness: `qa/phase14-performance.ts` (`bun run qa:performance`)
Rohergebnisse: `qa/results-phase14-performance.json` · Lauf 2026-08-27T12:37Z
Datenbasis: Demo-Organisation (32 Produkte, 36 Bestellungen), Entwicklungsserver

## Ergebnis: 15 von 15 PASS

| Messpunkt | Budget | Gemessen (p95) | Status |
| --- | --- | --- | --- |
| `GET /products` (Katalogliste, 32 Produkte) | < 3000 ms | 1994 ms | PASS |
| `GET /products/:handle` (Detail) | < 1500 ms | 882 ms | PASS |
| `GET /products?search=` | < 2500 ms | 1746 ms | PASS |
| `POST /cart/:id/items` | < 2500 ms | 1690 ms | PASS |
| `GET /cart/:id` | < 1500 ms | 1010 ms | PASS |
| 10 parallele Katalogabrufe | 0 Fehler, 0 × 429 | 10 OK | PASS |
| Nebenläufige Warenkorb-Schreibzugriffe konsistent | keine Abweichung | konsistent | PASS |
| Kein Überverkauf (32 Bestände) | 0 Verletzungen | 0 | PASS |
| HTML `/`, `/store`, `/store/warenkorb`, `/portal/gast` | < 2500 ms | 29–278 ms | PASS |
| DB: Bestellliste 50 Zeilen mit Joins | < 800 ms | 113 ms | PASS |
| Lasttest-Schlüssel entfernt | 0 verbleibend | 0 | PASS |

Die genannten p95-Werte stammen aus dem abschließenden Lauf; frühere Läufe lagen
für einzelne Messpunkte bis zu 2× höher, wenn parallel Browser-Harnesses liefen.

## Behobene Defekte

1. **N+1-Anreicherung im öffentlichen Katalog**
   (`src/lib/commerce/store/catalog-public.server.ts`). Bilder, Verfügbarkeiten und
   Preis-Snapshots wurden je Produkt einzeln geladen. Jetzt gebündelt über
   `primaryImages`, `productAvailabilities`, `summarizeProducts` und
   `loadSnapshotsForProducts` (`src/lib/commerce/pricing.server.ts`), ergänzt um
   `lowestVariantPrices` als Rückfall für variantengebundene Preise.
   Katalogliste p95 vorher 3900 ms → jetzt unter 2000 ms.
2. **Race bei nebenläufigen Warenkorb-Snapshots** (`src/lib/commerce/cart.server.ts`).
   Postgres meldete
   `duplicate key value violates unique constraint "cart_price_snapshots_cart_id_version_key"`.
   Behoben durch eng begrenztes Neulesen und Wiederholen der Versionsvergabe.

Beides sind Fehlerbehebungen an nachgewiesenen Defekten, keine neuen Funktionen.

## Einschränkungen

- Gemessen wurde gegen den **Entwicklungsserver** (Vite, ungebündelt) und eine
  geteilte Dev-Datenbank. Absolutwerte sind nicht produktionsrepräsentativ; die
  Budgets in `docs/production/PERFORMANCE_BUDGETS.md` sind entsprechend gesetzt.
- Lastprofil: 10 parallele Abrufe. Höhere Parallelität ist im Sandbox-Dev-Server
  nicht sinnvoll messbar und bleibt für Staging vorgesehen: OFFEN.
