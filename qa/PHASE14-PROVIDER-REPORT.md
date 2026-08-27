# Gate B8 — Provider-Readiness

Harness: `qa/phase14-providers.ts` (`bun run qa:providers`)
Rohergebnisse: `qa/results-phase14-providers.json`
Matrix: `docs/production/PROVIDER_READINESS_MATRIX.md`

## Ergebnis: 12 PASS, 2 BLOCKED

| ID | Prüfung | Status | Nachweis |
| --- | --- | --- | --- |
| B8.1 | Zahlungsanbieter konfiguriert | PASS | 3 Konfigurationen, Typ `mock` |
| B8.2 | Kein Stripe-Live-Modus aktiv | PASS | 0 Live-Konfigurationen |
| B8.3 | Stripe-Adapter vorhanden und ladbar | PASS | `getProvider('stripe')` lädt `stripe.server` |
| B8.4 | Stripe-Webhook lehnt unsignierte Anfragen ab | PASS | Status 401 |
| B8.5 | E-Mail-Anbieter konfiguriert | PASS | 5 Konfigurationen, Typ `test` |
| B8.6 | Kein produktiver E-Mail-Versand aktiv | PASS | 0 Nicht-Test-Konfigurationen |
| B8.7 | Verifizierte Absenderidentität | **BLOCKED** | Keine Absenderidentität hinterlegt; erfordert echte Domain und Provider-Zugangsdaten |
| B8.8 | Sperrliste für Bounces/Beschwerden technisch vorhanden | PASS | Tabelle vorhanden, 0 Einträge |
| B8.9 | Kommunikations-Webhook lehnt unsignierte Anfragen ab | PASS | kein Zugriff ohne gültige Provider-Signatur |
| B8.10 | Versanddienstleister konfiguriert | PASS | 3 Konfigurationen: `mock`, `dhl` |
| B8.11 | Kein Live-Carrier aktiv | PASS | 0 Live-Konfigurationen |
| B8.12 | Carrier-Webhook antwortet ohne Serverfehler | PASS | Status 400 bei Fehleingabe, kein 5xx |
| B8.13 | Keine Live-Provider-Secrets in der Dev-Umgebung | PASS | keines gesetzt |
| B8.14 | Live-Schaltung Stripe, E-Mail-Domain, Carrier | **BLOCKED** | Erfordert Zugangsdaten und Freigabe des Betreibers |

Der Harness zählt B8.7 und B8.14 als bestandene Prüfung des **Ist-Zustands** (korrekt kein
Live-Betrieb). Für die Go-live-Bewertung werden sie in diesem Bericht und in der
Gesamtmatrix als **BLOCKED** geführt, nicht als PASS.

## Bewertung

Die technische Anbindung ist vollständig vorbereitet und gegen Missbrauch abgesichert:
Webhooks ohne gültige Signatur werden abgewiesen, kein Live-Modus ist aktiv, keine
Live-Secrets sind gesetzt. Was fehlt, sind ausschließlich externe Zugangsdaten und
Vertragsbeziehungen des Betreibers.
