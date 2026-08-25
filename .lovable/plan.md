# Phase 12 — Teil 2: SDK-Client, Reference Storefront, Developer-Dashboard, E2E

Gateway, DTO-Vertrag und `/api/public/store/v1/*` stehen bereits. Jetzt folgt die Konsumentenseite: ein framework-neutraler SDK-Client, ein Referenz-Shop, der ausschließlich das SDK benutzt, das Developer-Backoffice für Keys und Logs — und ein E2E-Test, der den kompletten Kaufweg nur über die öffentliche API fährt.

```text
Store API (/api/public/store/v1)
  → SDK Core (fetch, Token-Storage, Fehlermodell)
  → React-Hooks (TanStack Query)
  → Reference Storefront (/store/*)
```

## 1. SDK Core — `src/lib/store-sdk/`

- `config.ts`: `CommerceClientConfig { baseUrl, publishableKey, storage?, fetch?, locale? }`.
- `client.ts`: `createCommerceClient(config)`. Reines `fetch`, kein React, kein Zugriff auf `window` beim Import (SSR-sicher). Setzt `X-Commerce-Key`, `X-Cart-Token`, `Authorization` (Kunden-Session), `X-Guest-Token`, `Idempotency-Key` bei Mutationen, liest `X-Request-ID` aus der Antwort.
- `errors.ts`: `CommerceError { code, message, status, fieldErrors?, requestId?, retryable }` über das definierte Code-Set; Retry nur für `retryable` (Netzwerk/5xx/429 mit Backoff, max. 2 Versuche, nie bei nicht-idempotenten Writes ohne Idempotency-Key).
- `storage.ts`: Interfaces `TokenStorage` / `CartStorage` plus Browser-Default (localStorage) und In-Memory-Fallback für SSR/Tests.
- Namensräume: `config`, `catalog` (products, product, categories, collections, search), `pricing`, `cart`, `checkout`, `payments`, `orders` (confirmation, guest-access, guest), `customer` (me, orders, addresses, documents, tracking), `returns`.
- Automatik: Cart-ID + Cart-Token werden persistiert; `CART_EXPIRED` löscht den lokalen Cart und wird als Fehler durchgereicht (kein stiller Neu-Cart). `CUSTOMER_SESSION_EXPIRED` löscht das Session-Token.
- **Customer-Auth**: eigener Store-Auth-Wrapper im SDK (`customer.login`, `customer.register`, `customer.requestPasswordReset`, `customer.logout`) gegen `/api/public/store/v1/customer/auth/*`. Der Server tauscht die Anmeldung serverseitig gegen ein Store-Session-Token; die Storefront sieht nie einen Supabase-Client, kein Supabase-Token, keine Auth-URL. Das Token liegt im `TokenStorage` und geht als `Authorization` an die Store API. Kein `@supabase/*`-Import in Storefront oder SDK.
- **Order-Confirmation-Token**: bleibt kurzlebig (Minuten), auf genau eine Order + einen Shop gescoped, einmal einlösbar und serverseitig widerrufbar (`revoked_at`); nach Einlösung wird er gegen eine kurzlebige Session bzw. einen scoped Guest-Token getauscht. Das SDK persistiert ihn nicht und baut daraus keine teilbare Bestell-URL; die Bestätigungsseite liest ihn einmalig aus der Redirect-URL und ersetzt die History-Entry.
- `src/lib/store-sdk/react/`: `CommerceProvider`, `useCommerce`, `useProducts`, `useProduct`, `useSearch`, `useCart`, `useCheckout`, `useCustomer`, `useOrders`, `useReturns` — auf TanStack Query. Der Provider hält ausschließlich die Client-Instanz und den QueryClient-Kontext; jede Fachlogik (Token-Handling, Retry, Fehler-Mapping, Cart-Persistenz) bleibt im Core. Hooks sind dünne Wrapper um Core-Aufrufe, kein paralleler Zustandsspeicher.

## 2. Reference Storefront — `/store/*`

Neue öffentliche Routen (SSR an, keine Auth-Gates): `store/index`, `store/shop`, `store/kategorie/$handle`, `store/kollektion/$handle`, `store/produkt/$handle`, `store/suche`, `store/warenkorb`, `store/checkout`, `store/checkout/bestaetigung`, `store/konto`, `store/konto/bestellungen`, `store/konto/bestellung/$id`, `store/gast`, `store/retoure/$orderId`.

Komponenten unter `src/components/storefront/`: ProductCard, ProductGrid, ProductGallery, VariantSelector, Price, AddToCart, CartDrawer, CheckoutStepper, AddressForm, ShippingOptions, OrderSummary, AccountLayout, OrderCard, TrackingTimeline, ReturnWizard. Design über die bestehenden Tokens, kein Hardcoding von Farben.

Diese Verzeichnisse importieren ausschließlich `@/lib/store-sdk/*` und UI-Primitives. Durchgesetzt per ESLint-`no-restricted-imports` (error) für `src/routes/store/**` und `src/components/storefront/**`: verboten sind `@/lib/commerce/*`, `@/integrations/supabase/*`, `@supabase/*` und alle `*.server` / `*.functions` Module. Zusätzlich ein Vitest-Test, der die Importgraphen dieser Ordner statisch prüft, damit der Bruch auch ohne Lint-Gate auffällt.

Konfiguration: `VITE_COMMERCE_API_URL` und `VITE_COMMERCE_PUBLISHABLE_KEY`; ohne gesetzten Key zeigt der Shop einen erklärenden Setup-Hinweis statt eines Fehlers. Die Doku (Developer-UI und `docs/`) sagt ausdrücklich: **Publishable Key = Shop-Identifikation, kein Secret.** Er darf im Client-Bundle stehen; jeder sensible Zugriff braucht zusätzlich Cart-Token, Kunden-Session oder scoped Guest-Token. Der Key gehört nie in Server-Secrets-Rollen und ersetzt keine Autorisierung.

## 3. Developer-Dashboard (Backoffice)

Neuer Navigationsbereich „Entwickler":

- `/app/developer/api-keys`: Keys erstellen (Name, Test/Live, Origins), Key genau einmal im Anschluss anzeigen, Prefix/Status/letzte Nutzung in der Liste, Revoke mit Bestätigung.
- `/app/developer/logs`: Requests aus `store_api_request_logs` mit Filter nach Request-ID, Endpoint, Status, Fehlercode, Zeitraum; keine Payloads, keine Klartext-IPs.
- `/app/developer/api`: strukturierte Endpoint-Doku (Methode, Auth-Stufe, Input, Output, Fehlercodes, Beispiel-Snippet mit dem SDK), plus Link zu den Phase-11-Webhooks.

Server Functions in `src/lib/commerce/store/store-admin.functions.ts` mit `requireSupabaseAuth` und Rollenprüfung (Owner/Admin), org-scoped.

## 4. E2E-Test

`qa/phase12.ts` im Stil der bestehenden Harnesses, ausschließlich über SDK gegen die laufende API:

1. Test-Key anlegen → Client bauen → `/config`.
2. Katalog: Liste, Detail, Suche, Kategorie — Prüfung, dass keine internen Felder (organization_id, Kosten, interne Status) im JSON auftauchen.
3. Cart: erstellen, Position hinzufügen/ändern/löschen, Promo anwenden/entfernen, Totals-Konsistenz.
4. Checkout: E-Mail, Adressen, Versandart, Validate, Payment-Session (Mock), Zahlung, Confirmation-Token einlösen.
5. Account/Gast: Guest-Access anfordern und einlösen, Bestellung lesen, Dokument-Download-URL, Tracking.
6. Retoure: Eligibility, Anlage, Duplikat abgelehnt.
7. Negativfälle: revoked Key, fremder Origin, Cross-Tenant-Zugriff (Key A auf Shop B), fehlender Cart-Token, fremder Cart-Token, Rate-Limit für `customer_login`, `payment_session`, `return_create`, Idempotenz-Wiederholung.

Ergebnis nach `qa/results-phase12.json` plus Kurzreport.

## Definition of Done

Build und Typecheck grün, Lint-Boundary aktiv und wirksam, alle bestehenden Tests weiter grün, E2E vollständig über das SDK durchlaufen, Developer-UI erzeugt und widerruft Keys korrekt.

## Reihenfolge

1. SDK Core + Fehlermodell + Storage
2. React-Hooks
3. Developer-Dashboard (Keys zuerst, damit der Shop einen echten Key hat)
4. Reference Storefront + ESLint-Boundary
5. E2E + Report
