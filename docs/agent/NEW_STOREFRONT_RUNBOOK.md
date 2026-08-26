# Runbook: Neue Storefront (Betriebsart B)

Ziel: ein eigenständiges React-/Lovable-Frontend, das einen bestehenden Shop bedient.

**Keine eigene Datenbank. Kein eigenes Commerce-Backend. Kein Supabase im Storefront-Projekt.**
Das Storefront-Projekt kennt genau zwei Dinge: die **API-Basis-URL** und den **Publishable Key**.

---

## 1. Was das Storefront-Projekt bekommt

| Wert | Beispiel | Geheim? |
| --- | --- | --- |
| API-Basis-URL | `https://<commerce-os-host>/api/public/store/v1` | nein |
| Publishable Key | `pk_live_…` bzw. `pk_test_…` | nein, aber origin-gebunden |

Der Key ist an genau einen Shop gebunden, hat eine Origin-Allowlist, unterliegt Rate-Limits und
kann jederzeit widerrufen werden. Er darf im Frontend-Bundle stehen. Ein Service-Role-Key,
Datenbank-Zugangsdaten oder ein Supabase-Projekt gehören **niemals** in ein Storefront-Projekt.

---

## 2. SDK-Verteilung — aktueller Stand (ehrlich)

Das SDK liegt in diesem Repository unter `src/lib/store-sdk/` und ist **noch kein veröffentlichtes
npm-Paket**.

**Aktuell (`sdk_distribution: "repository-source"`):**

1. Den im Manifest genannten Repository-Commit verwenden (`commerce-os.manifest.json` →
   `source_commit`, `sdk_version`, `compatible_api_versions`).
2. Den Ordner `src/lib/store-sdk/` unverändert in das Storefront-Projekt übernehmen, z. B. nach
   `src/lib/store-sdk/`.
3. Herkunft im Storefront-Projekt festhalten: Quelle, Commit, `sdk_version`, Datum — sonst ist
   später nicht nachvollziehbar, welcher Stand eingebunden wurde.
4. Den kopierten SDK-Code im Storefront-Projekt nicht forken oder umschreiben. Fehlt etwas, wird es
   im Commerce OS ergänzt und erneut übernommen.

**Später (geplant):** versioniertes npm-/GitHub-Package mit Semver.

> Es gibt **kein** `npm install @commerce-os/sdk`. Ein solcher Befehl darf nirgends dokumentiert
> oder ausgeführt werden, solange das Paket nicht existiert. `bun run docs:validate` bricht ab,
> wenn er in der Dokumentation auftaucht.

Kompatibilität: `sdk_version` 1.0.0 ⇄ `public_api_version` v1.

---

## 3. Einrichtung im Storefront-Projekt

```ts
// src/lib/commerce-client.ts
import { createCommerceClient } from "@/lib/store-sdk";

export const commerce = createCommerceClient({
  baseUrl: import.meta.env.VITE_COMMERCE_API_URL,
  publishableKey: import.meta.env.VITE_COMMERCE_PUBLISHABLE_KEY,
});
```

```bash
# .env des Storefront-Projekts
VITE_COMMERCE_API_URL=https://<host>/api/public/store/v1
VITE_COMMERCE_PUBLISHABLE_KEY=pk_test_...
```

React-Anbindung über den mitgelieferten Provider und die Hooks des SDK (`src/lib/store-sdk/react`).
Der Warenkorb wird über das vom Server ausgegebene Cart-Token identifiziert; das SDK verwaltet es.

Genaue Signaturen: `src/lib/store-sdk/index.ts`, Endpunkte:
[STORE_API_GUIDE.md](STORE_API_GUIDE.md), [store-api-v1.json](store-api-v1.json),
[openapi-store-v1.json](openapi-store-v1.json).

---

## 4. Regeln für das Storefront-Projekt

1. Nur SDK-Aufrufe. Kein `fetch` direkt gegen die API, kein Supabase-Client, keine Datenbank.
2. Keine Preis-, Steuer-, Rabatt- oder Bestandsberechnung im Frontend. Angezeigt wird, was der
   Server liefert.
3. Beträge kommen als Minor Units mit Währungscode und werden nur formatiert, nie umgerechnet.
4. Fehlercodes der API behandeln: `CART_EXPIRED`, `OUT_OF_STOCK`, `CHECKOUT_INVALID`,
   `PAYMENT_FAILED`, `RATE_LIMITED`, `CUSTOMER_SESSION_EXPIRED`.
5. Keine Bestellzustände oder Bestände lokal spiegeln — nach Mutationen neu laden.
6. Keine personenbezogenen Daten im Local Storage über das Nötige hinaus.

---

## 5. Referenzablauf

```text
config()                    → Shop, Währung, Länder, Steueranzeige, Features
products() / product(handle)→ Katalog und Detailseite
createCart() → addItem()    → Warenkorb, Totals kommen vom Server
startCheckout()             → Adressen, shippingOptions(), Auswahl
createPaymentSession()      → Weiterleitung/Bestätigung, Status pollen
orderConfirmation(token)    → Bestätigungsseite
customer.*/ guest.*         → Konto, Bestellhistorie, Dokumente, Retouren
```

---

## 6. Abnahme vor Go-live

- [ ] Katalog, Detailseite, Suche funktionieren
- [ ] Warenkorb überlebt Reload (Cart-Token)
- [ ] Checkout mit Adresse, Versandwahl, korrekten Steuern
- [ ] Zahlung (Mock oder freigegebener Provider) → Bestellung → Bestätigungsseite
- [ ] Gastbestellung nachschlagbar, Rechnung abrufbar
- [ ] Kundenkonto: Login, Bestellhistorie, Retoure
- [ ] Fehlerfälle sichtbar behandelt (leerer Bestand, abgelaufener Warenkorb, Rate-Limit)
- [ ] Mobil ab 320 px ohne horizontalen Überlauf
- [ ] Publishable Key: Live-Key erzeugt, Origin-Restriction auf die Live-Domain, Testkey entfernt
- [ ] Kein Supabase-Import und kein Secret im Bundle

## 7. Go-live

1. Live-Key mit Origin-Restriction auf die Produktivdomain erzeugen.
2. Storefront deployen, Domain verbinden.
3. Erste Bestellungen und die Request-Logs im Entwicklerbereich beobachten.
4. Rate-Limit-Profile prüfen und bei Bedarf mit dem Betreiber abstimmen.
