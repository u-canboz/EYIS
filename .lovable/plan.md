# Phase 12 — Storefront SDK & Public Store API

Ziel: eine versionierte, öffentliche Integrationsschicht (`/api/store/v1/*`) plus ein framework-neutrales SDK, sodass ein neues Lovable-Projekt nur `VITE_COMMERCE_API_URL` und `VITE_COMMERCE_PUBLISHABLE_KEY` braucht. Interne Tabellen, RLS-Details und Server Functions bleiben unsichtbar.

```text
Internal Engine (Phase 0–11)
  → Public Store Service (store/*.service.ts)
  → Public DTO (Allowlist)
  → Store API (/api/store/v1)
  → Commerce SDK
  → Lovable / React
```

## 1. Datenmodell (Migration)

- `store_api_keys`: organization_id, shop_id, name, key_prefix, key_hash (SHA-256), status, environment (test/live), allowed_origins[], rate_limit_profile, created_by, created_at, revoked_at, last_used_at. Voller Key `pk_test_…`/`pk_live_…` wird nur einmal beim Erstellen zurückgegeben.
- `store_api_request_logs`: request_id, key_id, shop_id, method, route, status_code, duration_ms, ip_hash, user_agent_summary, error_code, created_at. Keine Payloads. `ip_hash` wird nur mit einem **rotierenden Salt** (täglich, im Secret-Store) gebildet, ist also nicht dauerhaft reversibel oder über Zeiträume hinweg verkettbar; nach Ablauf der Aufbewahrung wird das Feld geleert.
- `store_api_rate_counters`: atomarer Zähler (key_id, profile, window_start) + SQL-Funktion `store_rate_hit(...)`, die serverseitig zählt und entscheidet — analog zu `automation_check_limits`.
- Jede Tabelle mit GRANTs, RLS und org-scoped Policies (nur Admin-UI liest; die API läuft über den Service-Client).

## 2. API-Boundary

Grundsatz: **Der Publishable Key ist kein Sicherheitsmerkmal.** Er identifiziert nur Shop, Environment und Capabilities. Jeder Zugriff auf Cart-, Customer-, Order-, Dokument- oder Return-Daten erfordert zusätzlich ein echtes Zugriffsmerkmal: Cart-Token, Customer-Session oder scoped Guest-Access-Token. Ebenso ist der **Origin-Check nur Zusatzschutz, kein Auth-Ersatz** — auch bei korrektem Origin prüft der Server immer Shop-Kontext, Token-Gültigkeit und Ownership der angefragten Ressource.

- Alle Routen unter `src/routes/api/store/v1/...`. Diese liegen bewusst **nicht** unter `/api/public/*` für Admin-Zwecke, sondern bekommen eine eigene Gate-Middleware.
- Ein einziger Request-Handler-Wrapper (`store/gateway.server.ts`) macht für jeden Request:
  1. `request_id` erzeugen → `X-Request-ID`, als correlation_id an Domain-Events weitergereicht.
  2. Publishable Key aus `X-Commerce-Key` lesen, hashen, Key laden, Status/Environment prüfen (nur Shop-Identifikation).
  3. Origin serverseitig gegen `allowed_origins` prüfen (Dev-Origins nur bei environment=test), CORS-Header + OPTIONS.
  4. Ressourcen-Autorisierung: Cart-Token / Customer-Session / Guest-Token prüfen und gegen den Shop des Keys sowie den Owner der Ressource abgleichen.
  5. Rate Limit nach Profil: catalog_read, search, cart_write, checkout, customer_auth, guest_lookup — plus eigene, strengere Buckets für `payment_session`, `return_create` und `customer_login`.
  6. Body-/Payload-Limits, Zod-Validierung, `Idempotency-Key` an bestehende `idempotency_keys`-Infrastruktur.
  7. Einheitliche Fehler + Logging in `store_api_request_logs`, Security-Header, keine Stack Traces.

## 3. Public DTOs

Neues Verzeichnis `src/lib/commerce/store/`:
`dto/` (product, variant, price, availability, category, collection, cart, checkout, order, document, tracking, return, config), `mappers/` mit **Allowlist**-Mappern (Felder werden aufgezählt, nicht gelöscht), `services/` als dünne Adapter auf die bestehenden Engines (kein zweiter Fachlogik-Pfad).

Inventar wird nur als `in_stock | low_stock | out_of_stock | backorder` plus optional `available_quantity` (pro Shop konfigurierbar) exponiert. Preise, Steuern und Promotions kommen ausschließlich aus Pricing-/Tax-Engine; Steueranzeige als net/tax/gross/breakdown/prices_include_tax.

## 4. Endpunkte

- Config: `GET /config` (Locale, Währung, Länder, Features/Capabilities, tax_display_mode).
- Catalog: `/products`, `/products/:handle`, `/categories`, `/categories/:handle`, `/collections`, `/collections/:handle`, `/search?q=` (Postgres FTS hinter einem `SearchProvider`-Interface). Allowlist für Sort/Filter, einheitliche Pagination (`data` + `pagination`), Cache-Control + ETag nur für Catalog-GETs.
- Pricing: `GET /products/:id/price`, `POST /pricing/resolve`.
- Cart: create/get/items CRUD/promotions. Auth via Key + Cart-ID + `X-Cart-Token` (nie Query). Missbrauchslimits: max. Zeilen, Menge/Zeile, Promo-Codes, Mutationen pro Minute.
- Checkout: `start`, `contact`, `shipping-address`, `billing-address`, `shipping-options`, `shipping-option`, `validate`; Status open/validated/awaiting_payment/completed/expired/cancelled.
- Payment: `POST /checkout/:id/payment-session`, `GET /checkout/:id/payment-status`; generischer Contract (`type: "redirect" | "embedded"`), keine Secrets.
- Orders: `GET /orders/confirmation/:accessToken` — der Token ist **kurzlebig (Minuten), einmal einlösbar und auf genau eine Order + einen Shop gescoped**, wird beim Checkout-Abschluss ausgestellt und tauscht sich gegen eine kurzlebige Session bzw. einen scoped Guest-Token; kein langlebiger, teilbarer Order-Link. `POST /orders/guest-access` (order_number + email, uniform response, strenges Rate Limit, scoped Token auf einen Shop/eine Order mit Ablauf — nutzt Phase-9-`guest_order_access_tokens`).
- Customer: Session über bestehende Auth; `GET/PATCH /customer`, `/customer/orders`, `/customer/addresses` CRUD, `/customer/orders/:id/documents` + Download als kurzlebige signierte URL, `/customer/orders/:id/tracking`, Returns (`return-eligibility`, `returns` create/list/detail) über die Phase-9-Engine.

## 5. SDK

`src/lib/store-sdk/` (Struktur wie ein späteres npm-Paket: `client.ts`, `config.ts`, `errors.ts`, `types/`, plus Module pro Namespace).

- `createCommerceClient({ baseUrl, publishableKey, storage })`, nur `fetch`, kein React, kein Zugriff auf `window` beim Import (SSR-sicher, Browser-APIs lazy über Adapter).
- `TokenStorage` und `CartStorage` Interfaces mit Browser-Default-Adapter.
- `CommerceError { code, message, status, fieldErrors?, requestId?, retryable }` mit dem definierten Code-Set (NOT_FOUND … INTERNAL_ERROR); Handling für `CUSTOMER_SESSION_EXPIRED`, `CART_EXPIRED` (neuer Cart nur explizit), `PRICE_CHANGED`/`OUT_OF_STOCK` als Warnungen.
- Optionale React-Hooks in `src/lib/store-sdk/react/` (`useProducts`, `useProduct`, `useCart`, `useCheckout`, `useCustomer`, `useOrders`) auf TanStack Query — separat vom Core.

## 6. Reference Storefront

Neutraler Referenz-Shop unter `/store/*` (Home, Shop, Category, Collection, Product, Search, Cart, Checkout, Account, Orders, Returns) mit Komponenten (ProductCard, ProductGrid, ProductGallery, VariantSelector, Price, AddToCart, CartDrawer, CheckoutForm, AccountLayout, OrderCard, TrackingTimeline, ReturnWizard). Diese Routen importieren ausschließlich das SDK — ein ESLint-Boundary-Regel-Eintrag verbietet `@/lib/commerce/*` und Supabase-Clients dort. Der bestehende Test-Storefront bleibt als internes Werkzeug bestehen. `commerce.config.ts` im Projektroot als neutrale Beispielkonfiguration.

## 7. Developer-Bereich (Backoffice)

Neue Navigation „Entwickler“: `/app/developer/api-keys` (erstellen, Test/Live, Origins, Key einmalig anzeigen, revoke, last used), `/app/developer/api` (strukturierte Docs: Endpoint, Methode, Auth, Input, Output, Fehler, Beispiel), `/app/developer/logs` (Filter nach Request-ID, Endpoint, Status, Datum, Fehlercode), plus Verlinkung der Phase-11-Webhooks.

## 8. Dokumentation

`docs/store-api/`, `docs/sdk/`, `docs/LOVABLE_STOREFRONT_GUIDE.md` (10 Schritte + Anti-Patterns) und `docs/LOVABLE_STOREFRONT_PROMPT.md` (fertiger Prompt für neue Lovable-Projekte).

## 9. Tests / Definition of Done

- API-Tests: Key gültig/revoked/falscher Shop/falscher Origin; Catalog nur Public Fields; Cart CRUD + ungültiger Token + Idempotenz; Checkout-Flow; Customer (eigene vs. fremde Order); Guest-Lookup (uniform, rate limited, scoped); Returns (eligible/ineligible/duplicate).
- SDK-Tests: Config, Products, Cart-Persistenz, Auth-Storage, SSR-Import, Error-Mapping, Retry, Request-IDs, Idempotency-Header.
- Contract-Tests SDK ↔ echte API (keine reinen Mocks) und ein voller E2E: Produkt → Cart → Checkout → Testzahlung → Order → Account → Tracking → Rechnung → Return, ausschließlich über SDK.
- Cross-Tenant: Key A erreicht nichts von Shop B. Key-Leakage: kein Zugriff auf Admin-APIs, Provider-Configs, Automation-Regeln.
- Performance-Messung (Catalog List/Detail, Cart Read/Write, Checkout Validate), N+1 vermeiden.
- Build, Typecheck, bestehende Phase-0–11-Tests grün.

## 10. Nicht Teil dieser Phase

Analytics-Dashboard, Shop-Importer, AI, Recommendations, Loyalty, Newsletter-Kampagnen, Marketplace, Subscriptions, POS.

## Umsetzungsreihenfolge

1. Migration + Gateway (Keys, Origins, Rate Limits, Request-IDs, Logs, Fehlermodell)
2. DTO-Layer + Catalog/Pricing/Config-Endpunkte
3. Cart + Checkout + Payment-Session
4. Customer, Guest Access, Orders, Documents, Tracking, Returns
5. SDK Core + React-Hooks
6. Reference Storefront
7. Developer-UI + Docs
8. Tests (API, SDK, Contract, E2E, Cross-Tenant, Security)
