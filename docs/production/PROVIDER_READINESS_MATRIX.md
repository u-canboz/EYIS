# Provider-Readiness-Matrix

Geprüft durch `qa/phase14-providers.ts` (`bun run qa:providers`), Rohergebnisse
`qa/results-phase14-providers.json`. Stand Gate B.

| Bereich | Adapter im Code | Aktive Konfiguration (Dev) | Live-Modus | Webhook-Schutz | Status Go-live |
| --- | --- | --- | --- | --- | --- |
| Zahlung Stripe | vorhanden, ladbar (`getProvider('stripe')`) | `mock` (3 Konfigurationen) | keiner aktiv | unsignierte Anfrage → 401 | **BLOCKED** — Live-Keys fehlen |
| E-Mail | Test-Provider (5 Konfigurationen) | `test` | keiner aktiv | unsignierte Anfrage abgewiesen (404) | **BLOCKED** — Absenderdomain und Provider-Zugangsdaten fehlen |
| Versand/Carrier | `mock`, `dhl` (3 Konfigurationen) | `mock` | keiner aktiv | Fehleingabe → 400, kein 5xx | **BLOCKED** — Carrier-Zugangsdaten fehlen |

Keine Live-Provider-Secrets sind in der Dev-Umgebung gesetzt (geprüft).

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
