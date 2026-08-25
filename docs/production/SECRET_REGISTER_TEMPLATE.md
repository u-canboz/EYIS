# Secret-Register — Inventur (ohne Werte)

Stand: 2026-08-25 (Gate A2). Werte werden hier niemals eingetragen.
Quelle: statische Auswertung aller `process.env[...]`- und `import.meta.env`-Zugriffe im Code.

Legende Status: `GESETZT` = in der Umgebung hinterlegt, `NICHT GESETZT` = fehlt, `N/A` = plattformseitig.

| Name | Zweck | Gelesen in | Sichtbarkeit | Status (Dev) | Rotation |
| --- | --- | --- | --- | --- | --- |
| `SUPABASE_URL` | Server-Zugriff auf die Datenbank | `client.server.ts`, `auth-middleware.ts`, `routes.server.ts` | server | GESETZT | mit Projektwechsel |
| `SUPABASE_PUBLISHABLE_KEY` | öffentlicher Datenzugriff (RLS) | `auth-middleware.ts`, `routes.server.ts` | server + Client-Pendant | GESETZT | plattformseitig |
| `SUPABASE_SERVICE_ROLE_KEY` | privilegierte Serveroperationen | `client.server.ts` | **nur server** | N/A (plattformverwaltet) | plattformseitig |
| `VITE_SUPABASE_URL` | Browser-Client | `client.ts` | öffentlich | GESETZT | mit Projektwechsel |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Browser-Client | `client.ts` | öffentlich | GESETZT | plattformseitig |
| `LOVABLE_CRON_SECRET` | Authentifizierung **aller** Job-Endpunkte | `cron-auth.ts` | nur server | GESETZT | plattformverwaltet, s. Runbook |
| `LOVABLE_CRON_SECRET_PREVIOUS` | Übergangsfenster während der Rotation | `cron-auth.ts` | nur server | NICHT GESETZT (normal) | temporär |
| `LOVABLE_API_KEY` | AI Gateway | `providers/lovable.server.ts` | nur server | GESETZT | über Plattform rotierbar |
| `APP_BASE_URL` | Links in E-Mails und Portal | `communications/context.server.ts` | nur server, kein Secret | NICHT GESETZT (Fallback aktiv) | entfällt |
| `VITE_COMMERCE_PUBLISHABLE_KEY` | Store-API-Key der Referenz-Storefront | Storefront-Client | öffentlich (Origin-gebunden) | optional | über Developer-Dashboard |
| `STRIPE_SECRET_KEY` | Zahlungen | `payments/stripe.server.ts` | nur server | NICHT GESETZT — BLOCKED | Stripe-Dashboard |
| `STRIPE_WEBHOOK_SECRET` | Signaturprüfung Stripe-Webhook | `payments/stripe.server.ts` | nur server | NICHT GESETZT — BLOCKED | Stripe-Dashboard |
| `COMMUNICATION_WEBHOOK_SECRET` | Signaturprüfung Provider-Webhooks | `webhooks/communications/$provider.ts` | nur server | NICHT GESETZT — BLOCKED | Provider |
| `AUTOMATION_WEBHOOK_SECRET_<NAME>` | ausgehende Automations-Webhooks | `automation/webhook.server.ts` (Name aus DB-Feld `secret_ref`) | nur server | keine Einträge | pro Ziel |
| `CARRIER_WEBHOOK_SECRET_<PROVIDER>` | Carrier-Webhooks | `webhooks/carrier/$provider.ts` (Name aus DB) | nur server | keine Einträge — BLOCKED | Carrier |

## Entfallen

| Name | Grund |
| --- | --- |
| `COMMUNICATION_JOB_SECRET` | in A2 durch `LOVABLE_CRON_SECRET` ersetzt; kein paralleles Job-Secret mehr |
| `SUPABASE_PUBLISHABLE_KEY` als Job-Auth | der Automations-Job prüfte zuvor den Publishable Key — ein öffentlicher Wert; ersetzt durch Cron-Auth |

## Nicht-Secrets in `.env`

`.env` ist versioniert und enthält ausschließlich Projekt-ID, Projekt-URL und Publishable Keys.
Diese Werte sind per Definition öffentlich (sie stehen ohnehin im Client-Bundle).
Private Secrets liegen ausschließlich im Secret-Store der Plattform und **nicht** in `.env`.
