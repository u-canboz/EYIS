# Commerce OS — Storefront Integration Guide

Dieser Leitfaden beschreibt, wie eine externe Storefront gegen die öffentliche Store API dieses Commerce OS gebaut wird. Er richtet sich an Entwickler, die einen eigenen Shop (React, Next.js, Astro, Vue, plain JS) betreiben und das Backoffice, den Katalog, Warenkorb, Checkout, Zahlungen, Bestellungen und Retouren dieses Systems nutzen wollen.

## 1. Architektur und Grenzen

```text
Storefront (dein Code)
  → Commerce SDK  (@/lib/store-sdk)
  → Store API     /api/public/store/v1
  → Commerce OS   Katalog, Pricing, Bestand, Checkout, Zahlungen, Dokumente
```

Harte Regeln:

- Die Storefront spricht **ausschließlich** mit der Store API, immer über das SDK.
- Kein direkter Datenbankzugriff, kein Supabase-Client, kein Zugriff auf interne Module oder Admin-Endpunkte.
- Alle Preise, Steuern, Rabatte, Verfügbarkeiten und Summen kommen vom Server. Die Storefront rechnet nichts nach.
- Antworten enthalten nur freigegebene Felder. Interne Felder (Organisation, Einkaufspreise, interne Status) existieren im JSON nicht.

## 2. Setup

1. Im Backoffice unter **Entwickler → Keys** einen Publishable Key erzeugen (Umgebung `test` oder `live`).
2. Erlaubte Origins eintragen, z. B. `https://shop.example.com`. In `test` sind `localhost`, `127.0.0.1` und `*.lovable.app` automatisch erlaubt.
3. In der Storefront konfigurieren:

```bash
VITE_COMMERCE_API_URL=https://<deine-commerce-os-domain>/api/public/store/v1
VITE_COMMERCE_PUBLISHABLE_KEY=pk_test_...
```

**Der Publishable Key ist kein Secret.** Er identifiziert nur den Shop und darf im Client-Bundle stehen. Er gehört nicht in die Server-Secrets-Rolle und ersetzt keine Autorisierung.

## 3. Client anlegen

```ts
import { createCommerceClient } from "@/lib/store-sdk";

export const commerce = createCommerceClient({
  baseUrl: import.meta.env.VITE_COMMERCE_API_URL,
  publishableKey: import.meta.env.VITE_COMMERCE_PUBLISHABLE_KEY,
  locale: "de-DE",
});
```

Der Core-Client ist die Quelle der Wahrheit: reines `fetch`, kein React, SSR-sicher, kein `window`-Zugriff beim Import. Für Serverumgebungen kann eine eigene `storage`-Implementierung (In-Memory) übergeben werden.

Optional, für React:

```tsx
import { CommerceProvider, useProducts, useCart } from "@/lib/store-sdk/react";

<CommerceProvider client={commerce}>
  <App />
</CommerceProvider>;
```

Die Hooks sind dünne Wrapper um den Core (TanStack Query). Sie halten keinen zweiten Zustandsspeicher.

## 4. Flows

### Konfiguration und Katalog

```ts
const config = await commerce.config();            // Shop, Währung, Länder, Features
const page = await commerce.catalog.products({ page: 1, pageSize: 24 });
const product = await commerce.catalog.product("eiche-esstisch");
const hits = await commerce.catalog.search("tisch", 12);
const categories = await commerce.catalog.categories();
```

### Warenkorb

```ts
const cart = await commerce.cart.ensure();          // legt bei Bedarf einen an
await commerce.cart.addItem({ variantId, quantity: 1 });
await commerce.cart.updateItem(itemId, 3);
await commerce.cart.removeItem(itemId);
await commerce.cart.applyPromotion("WELCOME10");
await commerce.cart.removePromotion("WELCOME10");
```

Beim Anlegen liefert der Server einmalig einen **Cart-Token**. Das SDK persistiert Cart-ID und Token lokal und sendet sie als `X-Cart-Token`. Ohne Token ist der Warenkorb nicht lesbar — auch nicht mit gültigem Key. Läuft er ab, kommt `CART_EXPIRED`; das SDK löscht den lokalen Handle und meldet den Fehler, es legt **nicht** still einen neuen Warenkorb an.

Alle Beträge sind Ganzzahlen in der kleinsten Währungseinheit (`amountMinor`, Cent).

### Checkout und Zahlung

```ts
const session = await commerce.checkout.start(email);
await commerce.checkout.setEmail(session.id, email);
await commerce.checkout.setAddress(session.id, { type: "shipping", address, billingSameAsShipping: true });
const options = await commerce.checkout.shippingOptions(session.id);
await commerce.checkout.setShippingOption(session.id, options[0].id);
await commerce.checkout.validate(session.id);

const payment = await commerce.checkout.createPaymentSession(session.id, {
  returnUrl: `${location.origin}/checkout/bestaetigung`,
});
// payment.redirectUrl → weiterleiten, oder Provider-Widget mit payment.clientSecret
```

Nach der Rückkehr wird der Status gepollt:

```ts
const status = await commerce.payments.status(payment.id);
if (status.state === "paid" && status.confirmationToken) {
  const order = await commerce.orders.redeemConfirmation(status.confirmationToken);
}
```

**Confirmation-Token**: kurzlebig (Minuten), auf genau eine Bestellung und einen Shop gescoped, einmal einlösbar, serverseitig widerrufbar. Das SDK persistiert ihn nicht. Die Bestätigungsseite liest ihn einmalig aus der URL und ersetzt danach den History-Eintrag — es entsteht keine teilbare Bestell-URL.

### Kundenkonto

```ts
await commerce.customer.register({ email, password });
await commerce.customer.login({ email, password });
const me = await commerce.customer.me();
const orders = await commerce.customer.orders();
const order = await commerce.customer.order(orderId);
const { url } = await commerce.customer.documentUrl(orderId, documentId);
commerce.customer.logout();
```

Die Anmeldung wird serverseitig gegen ein **Store-Session-Token** getauscht. Die Storefront sieht nie einen Auth-Provider, kein Provider-Token und keine Auth-URL. Das Token geht als `Authorization: Bearer …` an die Store API. Bei `CUSTOMER_SESSION_EXPIRED` löscht das SDK die Session; die UI führt zurück zur Anmeldung.

### Gastzugang

```ts
await commerce.orders.requestGuestAccess({ orderNumber, email }); // neutrale Antwort
commerce.orders.useGuestToken(tokenAusEmailLink);
const order = await commerce.orders.guestOrder();
const { url } = await commerce.orders.guestDocumentUrl(documentId);
```

Der Guest-Token ist auf genau eine Bestellung gescoped. Die Anforderung antwortet immer gleich, unabhängig davon, ob die Bestellung existiert.

### Retouren

```ts
const eligibility = await commerce.returns.guestEligibility();
const rma = await commerce.returns.create({
  items: [{ orderItemId, quantity: 1 }],
  reason: "damaged",
  note: "Kratzer an der Tischplatte",
});
```

Retouren sind idempotent: dieselbe Anfrage mit demselben `idempotencyKey` liefert dieselbe RMA statt einer zweiten.

## 5. Fehler, Retries, Idempotenz

Jeder Fehler ist ein `CommerceError`:

```ts
import { isCommerceError } from "@/lib/store-sdk";

try {
  await commerce.cart.addItem({ variantId, quantity: 1 });
} catch (error) {
  if (isCommerceError(error)) {
    console.error(error.code, error.message, error.fieldErrors, error.requestId);
  }
}
```

| Code | Bedeutung |
| --- | --- |
| `UNAUTHORIZED` | Key ungültig oder Zugriffsnachweis fehlt |
| `FORBIDDEN` | Origin gesperrt oder Ressource gehört zu einem anderen Shop |
| `NOT_FOUND` | Endpunkt oder Ressource existiert nicht |
| `VALIDATION_ERROR` | Eingabe ungültig, Details in `fieldErrors` |
| `CART_EXPIRED` | Warenkorb abgelaufen oder bereits konvertiert |
| `OUT_OF_STOCK` | Bestand reicht nicht |
| `CHECKOUT_INVALID` | Checkout unvollständig |
| `PAYMENT_FAILED` | Zahlung abgelehnt |
| `CUSTOMER_SESSION_EXPIRED` | Store-Session abgelaufen |
| `RATE_LIMITED` | Zu viele Anfragen |
| `INTERNAL_ERROR` | Unerwarteter Fehler, `requestId` melden |

Retry passiert nur bei `retryable` (Netzwerk, 5xx, 429) mit Backoff und maximal zwei Versuchen — nie bei nicht-idempotenten Writes ohne `Idempotency-Key`. Jede Antwort trägt `X-Request-ID`; dieselbe ID steht im Backoffice unter **Entwickler → Protokoll**.

Rate-Limits (pro Key und anonymisiertem Besucher-Hash): Katalog 300/min, Suche 60/min, Cart 60/min, Checkout 30/min, Payment-Session 10/5 min, Login 5/5 min, Retoure 5/10 min.

## 6. Sicherheit

- Publishable Key = Shop-Identifikation. Kein Secret, aber auch kein Zugriffsrecht.
- Zugriff auf fremde Ressourcen ist unmöglich: Cart, Checkout, Bestellung, Dokument und Retoure werden immer gegen Shop **und** Token geprüft. Ein Key aus Shop A erhält für IDs aus Shop B `NOT_FOUND`/`FORBIDDEN`, ohne Existenz preiszugeben.
- Origin-Allowlist ist zusätzlicher Schutz, kein Ersatz für Authentifizierung.
- Confirmation-Token niemals speichern, loggen oder teilen.
- Cart-Token wie ein Sitzungsgeheimnis behandeln: nicht in URLs, nicht an Dritte weitergeben.
- Nichts sicherheitsrelevantes im Client entscheiden — Preise, Verfügbarkeiten und Berechtigungen kommen ausschließlich vom Server.

## 7. Häufige Fehler

| Fehler | Ursache | Lösung |
| --- | --- | --- |
| 403 auf jeder Anfrage | Origin nicht freigegeben | Origin im Key hinterlegen |
| 401 auf `/cart/:id` | Cart-Token fehlt | über das SDK arbeiten, Handle nicht manuell löschen |
| Preise „falsch" | Beträge als Euro interpretiert | Werte sind Minor Units (Cent) |
| Bestätigungsseite leer | Confirmation-Token bereits eingelöst | Bestellung über Konto oder Gastzugang öffnen |
| `CART_EXPIRED` nach Bezahlung | Warenkorb wurde zur Bestellung | lokalen Handle verwerfen, neuen Warenkorb anlegen |
