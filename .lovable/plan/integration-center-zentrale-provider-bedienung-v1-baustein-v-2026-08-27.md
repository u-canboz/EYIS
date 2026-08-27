# Integration Center — zentrale Provider-Bedienung (V1-Baustein vor Gate C)

Zentrales, mandantenfähiges Integration Center als Bedienebene über den vorhandenen
Provider-Abstraktionen (Payment-, Communication-, Carrier-Engine). Kein Duplikat
bestehender Engines, keine Live-Schaltung durch den Agenten, keine erfundenen Credentials.

## Fluss (zentrale Produktregel)

```text
Shop → Einstellungen → Integrationen → Anbieter auswählen → Verbinden
  → Konfiguration prüfen → Verbindung testen → Aktivieren → Verbunden (Health Check)
```

## 1. Integration Registry

`src/lib/commerce/integrations/registry.ts` (client-safe, keine Secrets): zentrale
Provider-Metadaten über den drei Engines — id, category (payment/email/carrier),
displayName, description, capabilities, connectionType (oauth/api_credentials/smtp/
managed/manual), configurationRequirements, testModeSupported, healthCheckSupported,
disconnectSupported, documentationReference, implemented-Flag. Nicht implementierte
Provider (PayPal, Mollie, DPD, GLS, UPS, Sendcloud, Resend, Postmark, SES) werden als
„Noch nicht verfügbar" geführt — keine Fake-Integration.

## 2. Datenmodell (eine Migration)

- `integration_connections` — org/shop-gebunden, provider, category, status
  (nicht_verbunden/einrichtung_erforderlich/verifizierung_erforderlich/verbunden/fehler/
  deaktiviert), environment (test/live), `configuration_reference` (Secret-Referenz,
  niemals Secret selbst), Metadaten.
- `integration_health` — healthy/warning/error/unknown, last_checked_at, last_success_at,
  last_error_code (keine Secrets in Fehlertexten).
- `sender_domains` — Domain, Status (nicht_eingerichtet/dns_erforderlich/wird_geprueft/
  verifiziert/fehler), DNS-Einträge (Typ/Name/Wert/Status) als JSON, shop-gebunden.
- `sender_identities` — Absenderadresse/Name je Shop, Verweis auf verifizierte Domain,
  expliziter Fallback.
- `oauth_states` — kurzlebige State-Tokens (Hash, Org/Shop/Provider-Bindung, Ablauf,
  Einmalverwendung).
- Grants + RLS (Tenant-Isolation) in derselben Migration. Trigger: keine nachträgliche
  Änderung verifizierter Domains ohne erneute Prüfung.

## 3. Oberfläche `/app/einstellungen/integrationen`

- Hochwertige Provider-Liste nach Kategorien (Zahlungen, E-Mail, Versand): Icon, Name,
  Zweck, Status-Chip, Test/Live, Verbindungsart, letzte Prüfung, Warnung, eine
  Primäraktion. Responsive: mobil vertikale Liste + Sheet, Desktop Liste + Detailpanel,
  Touch-Ziele ≥44px.
- Setup-Wizard E-Mail (7 Schritte: Versandart → Provider → Absenderdomain → DNS →
  Verifizierung → Test-E-Mail → Aktivieren), technische Details aufklappbar.
- DNS-Ansicht: Typ/Name/Wert/Status, kopierbar, „erneut prüfen", Provider-Doku-Link.
- Ehrliche Zustände: „Einrichtung erforderlich", „Testmodus", „Noch nicht verfügbar".

## 4. Stripe (bestehenden Adapter integrieren)

- Status-Karte: Konfiguration, Test/Live, Webhook-Status (Signaturpflicht aktiv), letzte
  Prüfung, Payment-Methods aus tatsächlicher Capability.
- Aktionen: Verbindung testen (Adapter-Health), Testmodus, Trennen, Neu verbinden.
- **Connect/OAuth wird NICHT blind implementiert**: `integrations.server.ts` prüft den
  vorhandenen Stripe-Adapter; ein Dokumentationsabschnitt im Detailpanel +
  `docs/production/INTEGRATION_CONNECT_GAPS.md` listet präzise, was für echten
  Connect-Onboarding fehlt (OAuth-App, Redirect-Allowlist, Token-Exchange, Refresh,
  Revoke). Bestehende Secret-Key-Verbindung bleibt der unterstützte Weg. Keine
  Fake-OAuth-Verbindung.

## 5. Payment Method Discovery

Store API v1 additiv (kein Breaking Change): `GET .../payment-methods` (oder Erweiterung
der Shop-Config) liefert `payment_methods` ausschließlich aus aktiven, implementierten
Provider-Konfigurationen des Shops. Test-Storefront rendert nur diese Methoden — keine
hartcodierten Zahlungsarten, keine Stripe-Logik in React.

## 6. E-Mail

- Communication Engine bleibt einzige Versandengine; Integration Center liefert nur
  Einrichtung/Status.
- **SMTP: ehrlich als BLOCKED dokumentiert**, falls Laufzeit es nicht sicher zulässt —
  die Serverless-Laufzeit hat keine zuverlässigen rohen TCP/TLS-Sockets für generisches
  SMTP. UI und Datenmodell werden vorbereitet (Felder, Secret-Referenz, Test-Aktion),
  der eigentliche Verbindungstest meldet ehrlich „von der Plattform nicht unterstützt"
  statt zu simulieren. API-basierte Provider bleiben der empfohlene Weg.
- Sender Domains + DNS: geführte Einrichtung, DNS-Einträge kommen ausschließlich aus
  Provider-Konfiguration (keine erfundenen Werte). `verifySenderDomain()` nur, wenn der
  Provider es anbietet; sonst Status „wird_geprueft" mit ehrlicher Anleitung. Keine
  Domain wird durch Klick auf „Fertig" verifiziert.
- Absender je Shop: nur aktive, verifizierte Identitäten; Fallback explizit.

## 7. Carrier

Bestehende CarrierProvider-Architektur: Katalog-Sicht, Credentials je Shop über die
bestehenden Konfigurationsseiten, Aktionen Verbinden/Testen/Aktivieren/Trennen analog.
Nur `mock` (Test) ist implementiert — DHL & Co. „Noch nicht verfügbar".

## 8. Shop Readiness

Zentrale Readiness-Ansicht (im Integration Center): Zahlungen, E-Mail (Domain verifiziert),
Versand, Steuern, Rechnungen, Storefront-Key — je READY/OFFEN, serverseitig aus realen
Konfigurationen abgeleitet. „Bereit für Livebetrieb" nur, wenn alle Pflichtbereiche READY
und nicht im Testmodus.

## 9. Sicherheit (verbindlich)

- Secrets nur als `configuration_reference`; nie in API-Responses, Client-Bundle, Audit,
  Outbox oder Logs. Passwörter nach Speicherung nie erneut anzeigen.
- OAuth-Grundgerüst (state, Einmalverwendung, Org/Shop-Bindung, Ablauf, manipulierte/
  Cross-Tenant-Callbacks abgelehnt) als Infrastruktur — ohne echten Provider-Flow.
- Mandantentrennung: jede Verbindung exakt org/shop-gebunden; Cross-Tenant-Tests Pflicht.
- Keine Live-Schaltung, keine echten Credentials, keine Provider-Umstellung durch den Agenten.

## 10. Tests und Nachweise

- Cross-Tenant: Configs/Domains/Health von Shop A für Shop B unsichtbar (RLS-Harness).
- Secret-Leakage: kein Secret in API-Response und Client-Bundle (Grep + API-Test).
- Disconnect deaktiviert zuverlässig; Test-Provider nie als Live-READY; nicht verifizierte
  Domain nie READY; Discovery liefert nur aktive Methoden; OAuth-State Einmalverwendung
  und Cross-Tenant-Ablehnung; Health-Status aktualisiert sich.
- Re-Checks nach Umsetzung: `bun run verify`, `qa:providers`, `qa:security`, `qa:rls`,
  Store-API- und Demo-Regression, Shop-Readiness-Sicht geprüft.
- Bericht `qa/PHASE18-INTEGRATION-CENTER.md` mit PASS/FAIL/OFFEN/BLOCKED je Punkt.

## 11. Dokumentation

- Phase-17-Agent-Regel ergänzen: Agenten schreiben keine SMTP-Passwörter/Stripe-Secrets/
  Carrier-Credentials in Code oder Frontend-Env; Provider werden im Integration Center
  verbunden. Setup-Schritte dürfen erklärt werden.
- `docs/agent/CUSTOMER_ONBOARDING.md`: Onboarding-Reihenfolge um Payments/E-Mail/Carrier
  verbinden erweitern.
- Manifeste neu erzeugen (`bun run generate:manifests`).

## Umsetzungsreihenfolge

1. Registry + Migration (Tabellen, RLS, Grants).
2. Server-Funktionen: Status lesen, Health, Readiness, Domain-Verwaltung, OAuth-State.
3. Store-API-Erweiterung payment_methods + Storefront-Umstellung.
4. UI: Liste, Detailpanel, Wizard, DNS-Ansicht, Readiness.
5. Stripe-Gap-Doku, SMTP-Blocker-Doku, Agent-/Onboarding-Doku.
6. Tests, Re-Checks, Bericht.
