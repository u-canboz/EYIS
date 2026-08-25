# Phase 12 — Abschluss: Doku, Guide, QA

Keys-Verwaltung (`/app/entwickler`) und Anfrage-Protokoll (`/app/entwickler/protokoll`) stehen bereits und bleiben unverändert bis auf kleine Ergänzungen. Offen sind die Dokumentationsseite, die externen Guides und der vollständige QA-Nachweis.

## 1. API-Dokumentation im Backoffice

Neue Route `/app/entwickler/api`:

- Endpoint-Referenz, generiert aus der bestehenden Routentabelle (`src/lib/commerce/store/routes.server.ts`) als statisch gepflegte, clientseitige Datei `src/lib/commerce/store/api-catalog.ts` — kein Server-Import in der Route, damit keine `.server`-Kette in den Client läuft.
- Pro Endpoint: Methode, Pfad, Auth-Stufe (Key / Cart-Token / Kunden-Session / Guest-Token), Eingabe, Ausgabe, mögliche Fehlercodes, SDK-Snippet.
- Kopfbereich: Basis-URL, Header-Übersicht (`X-Commerce-Key`, `X-Cart-Token`, `Authorization`, `X-Guest-Token`, `Idempotency-Key`, `X-Request-ID`), Fehlermodell, Rate-Limits.
- Hinweisblock: Publishable Key = Shop-Identifikation, kein Secret.
- Querverweise auf Keys, Protokoll und die Phase-11-Webhooks.
- Navigation im Entwickler-Bereich um „API-Referenz" ergänzen.

## 2. `LOVABLE_STOREFRONT_GUIDE.md` (Repo-Wurzel)

Für Entwickler, die eine eigene Storefront gegen diese API bauen:

- Überblick über Architektur und Grenzen (nur SDK, kein direkter Datenbankzugriff).
- Setup: Key erzeugen, Origins setzen, `VITE_COMMERCE_API_URL` / `VITE_COMMERCE_PUBLISHABLE_KEY`.
- SDK-Installation/Einbindung, Core-Client vs. React-Hooks.
- Vollständige Flows mit Codebeispielen: Katalog, Produkt, Warenkorb, Promo, Checkout, Zahlung, Bestätigungs-Token, Konto/Gast, Retoure.
- Fehlermodell, Retry-Regeln, Idempotenz, Token-Lebensdauer.
- Sicherheitsregeln und häufige Fehler (Key als Secret behandeln, Confirmation-Token teilen, Cart-Token verlieren).

## 3. Storefront-Integrationsprompt

`LOVABLE_STOREFRONT_PROMPT.md`: fertiger, kopierbarer Prompt, mit dem in einem neuen Lovable-Projekt eine Storefront gegen diese API gebaut wird — inklusive Platzhaltern für API-URL und Key, Seitenliste, SDK-Nutzung, Designfreiheit und den harten Regeln (kein Supabase, kein Direktzugriff, keine internen Felder).

## 4. QA — `qa/phase12.ts`

Harness im Stil der bestehenden Skripte, ausschließlich über die öffentliche API:

1. Zwei Shops mit je eigenem Test-Key, `/config`.
2. Katalog: Liste, Detail, Suche, Kategorie — Prüfung auf fehlende interne Felder (`organization_id`, Kosten, interne Status).
3. Cart: erstellen, Position hinzufügen/ändern/löschen, Promo, Totals-Konsistenz.
4. Checkout: E-Mail, Adresse, Versandart, Validate, Payment-Session (Mock), Zahlung, Confirmation-Token einlösen; zweite Einlösung muss scheitern.
5. Konto/Gast: Login über den Store-Auth-Wrapper, Guest-Access, Bestellung, Dokument-URL, Tracking.
6. Retoure: Eligibility, Anlage, Duplikat abgelehnt.
7. Cross-Tenant: Shop-A-Key gegen echte Shop-B-IDs auf Cart, Checkout, Confirmation, Kundenbestellung, Dokument, Tracking, Retoure — jeweils `NOT_FOUND`/`FORBIDDEN` ohne Existenz-Leak, auch mit gültigem Shop-B-Token.
8. Negativfälle: widerrufener Key, fremder Origin, fehlender/fremder Cart-Token, Rate-Limit, Idempotenz-Wiederholung.

Ergebnisse nach `qa/results-phase12.json`, Kurzreport nach `qa/PHASE12-QA-REPORT.md`.

## 5. Abschlussprüfungen

- Build und Typecheck grün.
- Bestehende Vitest-Suite grün.
- Importgrenze: ESLint-`no-restricted-imports` für `src/routes/store/**`, `src/components/storefront/**` und `src/lib/store-sdk/**` läuft ohne Fehler; ergänzend ein Vitest-Test, der die Importgraphen dieser Ordner statisch prüft.
- Cross-Tenant-Ergebnisse aus dem QA-Lauf im Report dokumentiert.

Phase 13 wird nicht begonnen.
