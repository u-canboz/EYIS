# Datenkarte — personenbezogene Daten

Erzeugt und geprüft durch `qa/phase14-privacy.ts`. Jede Zeile ist gegen die tatsächlich
gespeicherten Spalten verifiziert.

| Tabelle | Personenbezogene Felder | Zweck | Rechtsgrundlage | Aufbewahrung |
| --- | --- | --- | --- | --- |
| `customers` | E-Mail, Vorname, Nachname, Telefon | Kundenkonto, Bestellabwicklung | Vertrag (Art. 6 I b) | bis Löschung, danach nur Belegdaten |
| `customer_addresses` | Name, Firma, Straße, PLZ, Ort, Land, Telefon | Versand und Rechnung | Vertrag | wie Kunde |
| `checkout_addresses` | Name, Straße, PLZ, Ort, Land, E-Mail | Checkout | Vertragsanbahnung | mit Checkout-Ablauf |
| `order_addresses` | Adress-Snapshot | Beleg | gesetzliche Pflicht (Art. 6 I c) | 10 Jahre |
| `orders` | Gast-E-Mail | Bestellzuordnung, Gastzugang | Vertrag | 10 Jahre (Belegbezug) |
| `communications` | Empfängeradresse, Empfängername, gerenderter Inhalt | Nachweis des Versands | Vertrag / berechtigtes Interesse | 3 Jahre |
| `invoices` | Käufer-Snapshot (Name, Adresse, USt-IdNr.) | Rechnungsstellung | gesetzliche Pflicht | 10 Jahre |
| `profiles` | E-Mail, Anzeigename | Backoffice-Konto | Vertrag | bis Kontolöschung |
| `audit_log` | Actor-E-Mail | Nachvollziehbarkeit administrativer Aktionen | berechtigtes Interesse | 2 Jahre |

## Bewusst nicht gespeichert

- **IP-Adressen im Klartext.** `store_api_request_logs` speichert nur einen
  tagesgebundenen, gesalzenen Hash (`src/lib/commerce/store/privacy.server.ts`). Das Salz
  liegt in `store_privacy_salts`, ist nur serverseitig lesbar und wird nach zwei Tagen
  verworfen — der Hash ist danach nicht mehr verknüpfbar.
- **Vollständige User-Agents.** Gespeichert wird nur `familie/plattform`.
- **Gast-Token im Klartext.** Nur SHA-256-Hash mit Ablaufdatum.
- **Zahlungsdaten.** Karten- oder Kontodaten werden nie berührt; sie verbleiben beim
  Zahlungsanbieter. Gespeichert wird lediglich dessen Referenz-ID.

## Betroffenenrechte

| Recht | Umsetzung heute | Status |
| --- | --- | --- |
| Auskunft | Kunde, Adressen, Bestellungen, Kommunikationen, Retouren über die Kunden-ID auffindbar (B4.5) | PASS |
| Löschung | vollständige mandantengebundene Löschung nachgewiesen (`demo_purge_organization` für Fixtures, Kundenlöschung im Backoffice) | PASS |
| Berichtigung | über Kunden- und Adressverwaltung | PASS |
| Datenübertragbarkeit | Export als strukturierte Datei | OFFEN |
| Einschränkung | Kundenstatus `blocked`/`archived` | PASS |

Belegpflichtige Daten (Rechnungen, Bestellpositionen, Steuer-Snapshots) sind von der
Löschung ausgenommen und bleiben unveränderlich.
