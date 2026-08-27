# Gate B4 — Datenschutz und Datenlebenszyklus

Harness: `qa/phase14-privacy.ts` (`bun run qa:privacy`)
Rohergebnisse: `qa/results-phase14-privacy.json` · Datenbasis: Demo-Organisation + isolierte QA-Fixtures

## Ergebnis: 26 von 26 PASS

### B4.1 Datenkarte personenbezogener Daten (9 PASS)

Für `customers`, `customer_addresses`, `order_addresses`, `orders`, `checkout_addresses`,
`communications`, `profiles`, `audit_log` und `invoices` wurde je Tabelle geprüft, dass die
tatsächlich gespeicherten personenbezogenen Felder mit der Datenkarte übereinstimmen.
Vollständige Karte: `docs/production/PRIVACY_DATA_MAP.md`.

### B4.2 Datensparsamkeit im Store-API-Protokoll (3 PASS)

- Keine Klartext-IP gespeichert (0 Treffer).
- Kein vollständiger User-Agent gespeichert (0 Treffer) — nur Familie/Plattform.
- Tagesgebundenes IP-Salz wird rotiert, keine Salze älter als drei Tage.

### B4.3 Gast-Token (2 PASS)

Ausschließlich als Hash gespeichert, jeder Token mit Ablaufdatum.

### B4.4 Ablauf- und Aufräumjob (4 PASS)

`ops_expire_due` ist ausführbar, meldet Zähler, räumt ausschließlich fällige Datensätze ab
und ist beim zweiten Lauf idempotent. Abgelaufene Gast-Token werden erfasst.

### B4.5 Auskunft und Löschung (5 PASS)

- Auskunft: alle personenbezogenen Datensätze eines Kunden sind über einen Pfad auffindbar
  (Kunde 1, Adressen 1, Bestellungen 2, Kommunikationen 3, Retouren 0).
- Löschung: eine vollständige Organisation wurde in einer isolierten Fixture gelöscht;
  danach 0 personenbezogene Reste, die Organisation selbst entfernt.
- Die Löschung ist mandantengebunden; die Demo-Organisation blieb unberührt.

### B4.6 Aufbewahrung und Unveränderlichkeit (3 PASS)

Ausgestellte Rechnungen sind nicht änderbar, `audit_log` ist append-only, keine verwaisten
QA-Fixture-Organisationen verbleiben.

## Offene Punkte

- Ein automatischer Löschlauf nach Aufbewahrungsfrist (Handelsrecht 10 Jahre) ist als
  Richtlinie dokumentiert (`docs/production/DATA_RETENTION_POLICY.md`), aber nicht als Job
  implementiert: **OFFEN** — Umsetzung erst nach Go-live sinnvoll und außerhalb Gate B.
- Auftragsverarbeitungsverträge und Datenschutzerklärung sind organisatorisch: **OFFEN**.
