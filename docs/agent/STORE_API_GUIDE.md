# Store API v1 — Leitfaden

Basis: `/api/public/store/v1`
Verbindlich und maschinenlesbar: [store-api-v1.json](store-api-v1.json),
[openapi-store-v1.json](openapi-store-v1.json). Beide werden aus
`src/lib/commerce/store/api-catalog.ts` erzeugt und beim Generieren gegen den Laufzeit-Router
`src/lib/commerce/store/routes.server.ts` geprüft — Abweichungen lassen `bun run docs:validate`
fehlschlagen.

## Header

| Header | Wann | Zweck |
| --- | --- | --- |
| `X-Commerce-Key` | immer | Publishable Key: identifiziert Shop und Umgebung |
| `X-Cart-Token` | Cart/Checkout | Zugriffsnachweis für genau einen Warenkorb |
| `X-Customer-Token` | Kundenkonto | Store-Kunden-Session |
| `X-Guest-Token` | Gastbestellung | zeitlich begrenzter Zugriff auf eine Bestellung |

## Autorisierungsstufen

- `key` — nur Publishable Key (Katalog, Konfiguration, Suche)
- `cart` — Key + Cart-Token (Warenkorb, Checkout)
- `customer` — Key + Kunden-Session (Konto, Historie, Dokumente, Retouren)
- `guest` — Key + Gast-Token (Bestellung ohne Konto)

## Gruppen (35 Endpunkte)

| Gruppe | Inhalt |
| --- | --- |
| Konfiguration | Shop-Stammdaten, Länder, Steueranzeige, Feature-Flags |
| Katalog | Produkte, Produktdetail, Kategorien, Kollektionen |
| Suche | Volltextsuche mit neutralisierten Eingaben |
| Warenkorb | Anlegen, Positionen, Mengen, Rabattcodes |
| Checkout | Session, Adressen, Versandoptionen, Validierung |
| Zahlung | Payment-Session, Status, Bestellbestätigung |
| Kundenkonto | Login, Profil, Adressen, Bestellhistorie, Dokumente |
| Gastzugang | Bestellsuche, Dokumente |
| Retouren | Berechtigung prüfen, Retoure anlegen |

Vollständige Liste mit Ein-/Ausgabe, Fehlern und SDK-Aufruf: `docs/agent/store-api-v1.json`.

## Rate-Limits (Profile)

| Profil | Limit |
| --- | --- |
| `catalog_read` | 300 / 60 s |
| `search` | 60 / 60 s |
| `cart_write` | 60 / 60 s |
| `checkout` | 30 / 60 s |
| `customer_auth` | 30 / 60 s |
| `guest_lookup` | 10 / 300 s |
| `payment_session` | 10 / 300 s |
| `return_create` | 5 / 600 s |
| `customer_login` | 5 / 300 s |

Überschreitung → HTTP 429 mit Code `RATE_LIMITED`.

## Fehlercodes

`UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `VALIDATION_ERROR` (400),
`CART_EXPIRED` (409), `OUT_OF_STOCK` (409), `CHECKOUT_INVALID` (409), `PAYMENT_FAILED` (402),
`CUSTOMER_SESSION_EXPIRED` (401), `RATE_LIMITED` (429), `INTERNAL_ERROR` (500).

Jede Fehlerantwort enthält eine Request-ID. Diese ID bei Rückfragen immer mitliefern; sie steht auch
im Request-Log des Entwicklerbereichs.

## Verträge

- Beträge sind Minor Units (Cent) plus Währungscode. Der Client rechnet nicht.
- Antworten enthalten nur Allowlist-Felder aus `mappers.server.ts`.
- v1 ist stabil: keine Feldentfernung, keine Bedeutungsänderung, keine Pflichtfeld-Erweiterung bei
  Eingaben. Neues ist additiv oder v2.
- Origin-Restriction: Anfragen von nicht freigegebenen Origins werden mit `FORBIDDEN` abgelehnt.
- IP-Adressen im Request-Log sind mit täglich rotierendem Salt gehasht.

## Nicht öffentlich

Einkaufspreise, Margen, Lieferanten, interne Notizen, andere Kunden, fremde Shops,
Zahlungs-Rohdaten, interne IDs. Ein neues Feld wird nur öffentlich, wenn es ausdrücklich in die
Allowlist aufgenommen wird.
