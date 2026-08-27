# Integration Connect Gaps — ehrlicher Stand

Dieses Dokument listet, was für echte Self-Service-Anbindung pro Anbieter
**noch fehlt**. Nichts davon wird im UI simuliert: Was hier als Lücke steht,
wird im Integration Center als „Noch nicht verfügbar" oder als Hinweis
dargestellt.

Stand: Phase 18 (Integration Center).

## Stripe — Secret-Key-Verbindung ist implementiert, Connect (OAuth) fehlt

Heute funktioniert der Stripe-Adapter über plattformseitige Secrets
(`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, als Referenz in
`payment_provider_configs.secret_ref`). Für ein echtes Händler-Self-Service
per **Stripe Connect Express OAuth** fehlen:

1. **Plattform-Onboarding bei Stripe**: Ein Connect-Plattformkonto muss
   registriert und für Express-Accounts freigeschaltet werden. Externer
   Schritt, kein Code.
2. **OAuth-Start-Route**: `GET`-Route, die einen `oauth_states`-Eintrag
   anlegt (Infrastruktur vorhanden: Tabelle `oauth_states`, Hash-basiert,
   einmalig, 10 Minuten TTL) und zu
   `https://connect.stripe.com/oauth/authorize` redirectet.
3. **OAuth-Callback-Route**: `/api/public/integrations/stripe/callback` —
   State konsumieren (Replay-Schutz vorhanden), `code` gegen
   `https://connect.stripe.com/oauth/token` tauschen, `stripe_user_id`
   (Account-ID) als neue Secret-Referenz speichern. **Niemals** das
   Access-Token selbst in einer Tabelle ablegen — nur eine Referenz.
4. **Account-fähige Adapter-Konfiguration**: `stripe.server.ts` muss pro
   Shop die verbundene Account-ID als `Stripe-Account`-Header bzw.
   `stripeAccount`-Option nutzen statt des Plattform-Secrets.
5. **Webhook-Endpunkte pro verbundenem Account**: Connect-Webhooks
   (`account.application.deauthorized` etc.) für Trennung von Händlerseite.
6. **Disconnect**: `POST https://connect.stripe.com/oauth/deauthorize`.
7. **KYC-/Onboarding-Status**: `account.updated`-Webhook auswerten, um
   „charges_enabled / payouts_enabled" in den Integrationsstatus zu spiegeln.

Bis 1–7 stehen, bleibt Stripe im Integration Center als
Secret-Key-Verbindung geführt, mit diesem Dokument als Referenz.

## E-Mail — API-Anbieter mit Domain-Verifikation sind der Zielweg

- **Verwalteter Versand (`lovable`)**: implementiert. Absenderdomain-
  Verifizierung läuft plattformseitig; `sender_domains` dokumentiert den
  Status. Der Anbieter exponiert aktuell **kein** `verifySenderDomain()` —
  die „Prüfung anfordern"-Aktion im Integration Center meldet daher ehrlich
  „keine automatische Prüfung verfügbar" statt einen Erfolg zu simulieren.
- **SMTP (generisch)**: **BLOCKED** — die Serverless-Laufzeit bietet keine
  zuverlässigen rohen TCP/TLS-Verbindungen. Wird nicht implementiert;
  API-basierte Anbieter (Resend, Postmark, SES) sind die Roadmap. Für jeden
  davon fehlt: Adapter-Implementierung hinter dem Communication-Contract,
  Secret-Referenz-Handling, Domain-DNS-Nachweise (aus der Provider-API,
  niemals erfunden) und Webhook-Verarbeitung für Bounces/Complaints.

## Carrier

Nur der Test-Carrier ist implementiert. DHL besitzt einen Adapter-Stub;
Zugangsdaten, Authentifizierung, Label- und Tracking-Implementierung fehlen.
DPD, GLS, UPS, Sendcloud haben keinen Adapter und werden als „Noch nicht
verfügbar" geführt.

## Grundsätze

- **Keine Tokens in Tabellen** — immer Secret-Referenzen.
- **OAuth-States**: gehasht, einmalig, kurzlebig, an Org/Shop/Provider
  gebunden (`oauth_states`, service-role-only).
- **Kein erfundener Erfolg**: Ein Verbindungstest lädt den echten
  Engine-Adapter; ein Fehler wird als Fehler angezeigt.
