# Storefront-Integrationsprompt

Kopiere den folgenden Text in ein **neues** Lovable-Projekt, um eine Storefront gegen dieses Commerce OS zu bauen. Ersetze vorher die beiden Platzhalter.

---

Baue eine vollständige, produktionsreife Online-Storefront. Der komplette Commerce-Teil (Katalog, Preise, Bestand, Warenkorb, Checkout, Zahlungen, Bestellungen, Dokumente, Retouren) liegt in einem externen System und wird ausschließlich über dessen öffentliche Store API angesprochen.

**Verbindung**

- API-Basis-URL: `<<<COMMERCE_API_URL>>>` (Form: `https://<domain>/api/public/store/v1`)
- Publishable Key: `<<<COMMERCE_PUBLISHABLE_KEY>>>`
- Beides als `VITE_COMMERCE_API_URL` und `VITE_COMMERCE_PUBLISHABLE_KEY` konfigurieren. Der Publishable Key ist kein Geheimnis und darf im Client-Bundle stehen.

**Harte Regeln**

1. Kein Backend, keine Datenbank, kein Supabase, kein Auth-Provider-Client im Projekt. Der gesamte Zustand kommt aus der Store API.
2. Alle Aufrufe laufen über einen einzigen HTTP-Client-Wrapper (`src/lib/commerce/*`), der die Header `X-Commerce-Key`, `X-Cart-Token`, `Authorization`, `X-Guest-Token` und `Idempotency-Key` setzt und `X-Request-ID` aus der Antwort liest.
3. Keine Preisberechnung im Client. Alle Beträge sind Ganzzahlen in Cent (`amountMinor`) und werden nur formatiert.
4. Cart-ID und Cart-Token nach dem Anlegen lokal persistieren; bei `CART_EXPIRED` lokalen Warenkorb verwerfen und den Fehler anzeigen, nicht still neu anlegen.
5. Der Confirmation-Token aus der Zahlungsrückkehr wird genau einmal eingelöst, nie gespeichert, nie geteilt; danach den History-Eintrag ersetzen.
6. Kundenanmeldung läuft über `/customer/auth/login`; das zurückgegebene Store-Session-Token wird als Bearer gesendet. Bei `CUSTOMER_SESSION_EXPIRED` Session verwerfen und zur Anmeldung führen.
7. Fehler immer über das Fehlermodell `{ code, message, fieldErrors?, requestId }` behandeln und benutzerfreundlich anzeigen; Retry nur bei Netzwerkfehlern, 5xx und 429.

**Seiten**

- Startseite mit Highlights und Kollektionen
- Shop-Übersicht mit Filter, Sortierung und Paging
- Kategorie- und Kollektionsseiten
- Produktdetail mit Varianten-Auswahl, Medien-Galerie, Verfügbarkeit und „In den Warenkorb"
- Suche
- Warenkorb inkl. Mengenänderung, Entfernen, Gutscheincode
- Checkout: E-Mail, Lieferadresse, Rechnungsadresse, Versandart, Prüfung, Zahlung
- Bestellbestätigung (Statusabfrage + Token-Einlösung)
- Kundenkonto: Anmeldung, Registrierung, Passwort-Reset, Bestellhistorie, Bestelldetail mit Tracking und Dokument-Download
- Gastzugang zu einer Bestellung per E-Mail-Link
- Retourenassistent

**Endpunkte** (alle relativ zur Basis-URL)

```text
GET    /config
GET    /products            GET /products/:handle    GET /search
GET    /categories          GET /collections
POST   /cart                GET /cart/:cartId
POST   /cart/:cartId/items  PATCH|DELETE /cart/:cartId/items/:itemId
POST   /cart/:cartId/promotions   DELETE /cart/:cartId/promotions/:code
POST   /checkout            GET /checkout/:sessionId
POST   /checkout/:sessionId/email | address | shipping-option | validate | payment-session
GET    /checkout/:sessionId/shipping-options
GET    /payments/:paymentSessionId/status
GET    /orders/confirmation/:token
POST   /orders/guest-access GET /orders/guest   GET /orders/guest/documents/:documentId
GET    /returns/eligibility POST /returns
POST   /customer/auth/login | register | password-reset
GET    /customer/me | /customer/orders | /customer/orders/:orderId
GET    /customer/orders/:orderId/documents/:documentId
```

**Design**

Freie, eigenständige Gestaltung mit einem konsistenten Designsystem: semantische Farb-Tokens, ein klares Typografie-Paar, großzügige Produktflächen, mobil zuerst. Keine generischen Lila-Verläufe auf Weiß. Ladezustände als Skeletons, Fehler als ruhige Hinweise mit Wiederholen-Aktion.

**Abnahme**

Ein Gast kann Produkte finden, in den Warenkorb legen, einen Code anwenden, den Checkout mit Adresse und Versandart abschließen, bezahlen und die Bestätigung sehen. Ein Kunde kann sich anmelden, Bestellungen einsehen, eine Rechnung herunterladen und eine Retoure anlegen. Es existiert kein Codepfad, der ohne die Store API Daten liest oder schreibt.
