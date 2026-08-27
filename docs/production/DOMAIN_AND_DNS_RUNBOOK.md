# Runbook — Domains, DNS und URLs

Status: **OFFEN** — vorbereitet, keine Domain verbunden, nichts automatisch veröffentlicht.
Platzhalter sind in spitzen Klammern und müssen vom Betreiber ersetzt werden.

## 1. Domainplan

| Zweck | Vorschlag | Status |
| --- | --- | --- |
| Backoffice | `app.<domain>` | OFFEN |
| Commerce API (Store API v1) | `api.<domain>` bzw. gleiche Origin wie Backoffice | OFFEN |
| Referenz-Storefront | `shop.<domain>` oder `<domain>` | OFFEN |
| Kundenportal | Pfad `/portal` der Storefront-Domain | OFFEN |

Solange keine eigene Domain verbunden ist, gelten die von der Plattform vergebenen
Projekt-URLs. Diese sind für Cron- und Webhook-Ziele stabil nutzbar.

## 2. URLs, die je Umgebung gesetzt werden

| Wert | Development | Staging | Production |
| --- | --- | --- | --- |
| `APP_ENV` | `development` | `staging` | `production` |
| `APP_BASE_URL` | Preview-URL | `<staging-url>` | `<prod-url>` |
| Auth-Redirect-URLs | Preview-Origin | `<staging-url>` | `<prod-url>` |
| Erlaubte Origins (Store-API-Key) | Preview-Origin | `<staging-storefront>` | `<prod-storefront>` |
| Stripe-Webhook | `<base>/api/public/webhooks/stripe` | dito | dito |
| E-Mail-Webhook | `<base>/api/public/webhooks/communications/<provider>` | dito | dito |
| Carrier-Webhook | `<base>/api/public/webhooks/carrier/<provider>` | dito | dito |
| Cron-Routen | `<base>/api/public/jobs/expiration`, `.../communications`, `.../automation` | dito | dito |

Jede Umgebung hat eigene Secrets, eigene Store-API-Keys und eigene Webhook-Signing-Secrets.

## 3. DNS-Einträge

Es werden **keine** DNS-Werte erfunden. Zu setzen sind:

1. Der von der Hosting-Oberfläche angezeigte Eintrag für die jeweilige Domain (A/CNAME).
2. `www` → Weiterleitung auf die kanonische Variante (oder umgekehrt), genau eine Richtung.
3. E-Mail-Absenderdomain: SPF, DKIM und Domain-Verifikationswert **genau so**, wie der
   gewählte E-Mail-Provider sie ausgibt. DMARC-Empfehlung: `v=DMARC1; p=none; rua=mailto:<postmaster>`
   und erst nach stabiler Zustellung verschärfen.

## 4. HTTPS und Header

- HTTPS wird von der Plattform terminiert; Zertifikate werden automatisch ausgestellt.
- HSTS und die übrigen Sicherheits-Header werden zentral gesetzt (`src/lib/security/headers.ts`).
- Canonical URLs: genau eine Hostvariante ist kanonisch, alle anderen leiten mit 301 weiter.
- CSP: siehe `qa/PHASE14-SECURITY-HEADERS.md`. Umstellung von Report-Only auf durchsetzend
  erst nach Auswertung echter Verstöße in Staging.

## 5. Abnahme

| Prüfung | Nachweis | Status |
| --- | --- | --- |
| Domain aufgelöst und Zertifikat gültig | manuell | OFFEN |
| Auth-Redirect funktioniert | Login auf der Zieldomain | OFFEN |
| Store-API-Key mit Origin-Restriction greift | Fremdorigin → 403 | OFFEN |
| Webhook-URLs erreichbar und signaturgeschützt | Provider-Testevent | BLOCKED (Provider fehlen) |
| Cron-Routen nur mit Cron-Secret erreichbar | 401 ohne Secret | PASS (Dev, `qa:jobs`) |
