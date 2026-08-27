# Performance-Budgets

Gültig ab Gate B. Durchgesetzt durch `qa/phase14-performance.ts` (`bun run qa:performance`).
Alle Werte sind p95 über die dort definierte Wiederholungszahl.

| Bereich | Messpunkt | Budget (Dev) | Zielwert Production |
| --- | --- | --- | --- |
| Store API | `GET /products` (Liste) | 3000 ms | 600 ms |
| Store API | `GET /products/:handle` | 1500 ms | 400 ms |
| Store API | `GET /products?search=` | 2500 ms | 600 ms |
| Store API | `POST /cart/:id/items` | 2500 ms | 500 ms |
| Store API | `GET /cart/:id` | 1500 ms | 400 ms |
| HTML | `/`, `/store`, `/store/warenkorb`, `/portal/gast` | 2500 ms | 800 ms |
| Datenbank | Bestellliste 50 Zeilen mit Joins | 800 ms | 300 ms |
| Last | 10 parallele Katalogabrufe | 0 Fehler, 0 × 429 | 25 parallel |

## Warum zwei Spalten

Die Dev-Budgets gelten für den Vite-Entwicklungsserver in der Sandbox: ungebündelter
Code, kalte Module, geteilte Datenbank, parallel laufende QA-Harnesses. Sie sichern
Regressionen ab (z. B. ein wiederkehrendes N+1), nicht die Nutzererfahrung.

Die Zielwerte für Production sind erst gegen einen Produktionsbuild in einer
getrennten Umgebung messbar. Solange keine getrennte Staging-/Production-Umgebung
existiert (siehe `docs/production/ENVIRONMENT_MATRIX.md`), bleiben sie **OFFEN**.

## Regeln

1. Budgetüberschreitung ist ein FAIL, kein Hinweis. Entweder wird die Ursache behoben
   oder das Budget mit Begründung und Messreihe geändert — nie stillschweigend.
2. Vor jeder Budgetänderung mindestens zwei Läufe ohne konkurrierende Harnesses.
3. Neue Store-API-Endpunkte, die Listen liefern, brauchen einen Messpunkt im Harness.
4. Anreicherung von Listen erfolgt gebündelt (ein Query je Aspekt), nie je Element.
