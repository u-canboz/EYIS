# Provider-Readiness-Matrix

Geprüft durch `qa/phase14-providers.ts` (`bun run qa:providers`) sowie das Integration Center
(`bun run qa:integrations`, `bun run qa:integrations-e2e`). Rohergebnisse
`qa/results-phase14-providers.json`, `qa/results-phase18-integration-center.json`.
Stand: Gate B abgenommen, Integration Center abgeschlossen (Phase 18).

Bedienung aller Anbieter zentral unter `/app/einstellungen/integrationen`.

| Bereich | Adapter im Code | Aktive Konfiguration (Dev) | Live-Modus | Webhook-Schutz | Status Go-live |
| --- | --- | --- | --- | --- | --- |
| Zahlung Stripe | echter Adapter, shop-gebundene Zugangsdaten | `mock` (Test) | keiner aktiv | Signaturprüfung, sonst 401 | **BLOCKED** — Keys des Händlers fehlen |
| Zahlung PayPal | echter Adapter (Orders v2, OAuth2, Capture, Refund) | keine | keiner aktiv | Verifikation über PayPal-API mit Webhook-ID, sonst 401 | **BLOCKED** — Client-ID/Secret fehlen |
| Zahlung Mollie | echter Adapter (Payments v2, Refund) | keine | keiner aktiv | Re-Fetch-Verifikation je Shop-Schlüssel, sonst 401 | **BLOCKED** — API-Schlüssel fehlt |
| Zahlung Test-Provider (`mock`) | vorhanden | aktiv, nur Testmodus | nicht zulässig | n/a | **PASS** — E2E-Kette bis Order-Finalisierung geprüft |
| E-Mail Resend | echter Adapter (Versand, Domain, Webhooks) | keine | keiner aktiv | Svix-Signatur, sonst abgewiesen | **BLOCKED** — API-Schlüssel und verifizierte Domain fehlen |
| E-Mail SMTP | echter Adapter über die bestehende Communication Engine (STARTTLS/TLS, AUTH, MIME) | keine | keiner aktiv | kein Rückkanal (Webhooks entfallen) | **BLOCKED** — Serverdaten fehlen; zusätzlich **OFFEN**: Rohsockets sind laufzeitabhängig, ohne sie meldet der Adapter ehrlich „Anbieter nicht erreichbar" |
| E-Mail Test-Provider | Test-Provider | `test` | nicht zulässig | n/a | **PASS** — nur Sandbox, zählt nicht als live-fähig |
| Versand/Carrier | `mock`, `dhl` | `mock` | keiner aktiv | Fehleingabe → 400, kein 5xx | **BLOCKED** — Carrier-Zugangsdaten fehlen |
| Nicht verfügbare Anbieter (Postmark, SES, DPD, GLS, UPS, Sendcloud) | nicht implementiert | — | — | — | ehrlich als „Noch nicht verfügbar" geführt |

Zugangsdaten aller Anbieter liegen ausschließlich AES-256-GCM-verschlüsselt und mandantengebunden
im Tresor (`provider_credentials`, nur Service-Role). Nach außen gehen nur maskierte Hinweise.
Zahlungsarten liefert `/payment-methods` datengetrieben je Anbieter, Land und Währung — die
Storefront kennt keine hartcodierte Zahlungsart.

Keine Live-Provider-Secrets sind in der Dev-Umgebung gesetzt (geprüft). Secrets erscheinen weder
in API-Antworten noch im Client-Bundle (Phase-18-Nachweis).

## Shop Readiness

Serverseitig aus realen Konfigurationen abgeleitet, sichtbar im Integration Center. Sechs Bereiche:
Zahlungen, E-Mail, Versand, Steuern, Rechnungen, Storefront-Key. „Bereit für Livebetrieb" nur, wenn
alle Pflichtbereiche live-fähig sind — im Testmodus bleibt `liveReady=false` (geprüft).

| Bereich | Dev-Status | Live-Status |
| --- | --- | --- |
| Zahlungen | READY (Testanbieter) | BLOCKED — Live-Keys fehlen |
| E-Mail | OFFEN — keine verifizierte Absenderdomain | BLOCKED |
| Versand | READY (Mock-Carrier) | BLOCKED — Carrier-Vertrag fehlt |
| Steuern | OFFEN je Shop bis Steuersätze gepflegt sind | konfigurierbar durch Betreiber |
| Rechnungen | READY | konfigurierbar durch Betreiber |
| Storefront-Key | READY | konfigurierbar durch Betreiber |


## Was für die Live-Schaltung fehlt

| Schritt | Verantwortlich | Voraussetzung |
| --- | --- | --- |
| Stripe-Live-Key hinterlegen, Webhook-Signing-Secret setzen, Webhook-URL registrieren | Betreiber | verifiziertes Stripe-Konto |
| Absenderdomain verifizieren (SPF, DKIM, DMARC), Sender-Identity anlegen | Betreiber | eigene Domain |
| E-Mail-Provider-Zugangsdaten hinterlegen, Sperrliste anbinden | Betreiber | Provider-Vertrag |
| Carrier-Konto (DHL) mit Vertragsnummer und API-Zugang | Betreiber | Carrier-Vertrag |
| Nach jeder Live-Schaltung: `bun run qa:providers` gegen Staging | Agent/Betreiber | getrennte Umgebung |

## Nicht verhandelbar

- Keine Umstellung eines Providers von Mock auf Live durch einen Agenten.
- Keine echten Zahlungen und kein echter Massenversand im Test.
- Live-Secrets werden nie gelesen, geloggt oder in Code geschrieben
  (`docs/production/SECRET_REGISTER_TEMPLATE.md`).
