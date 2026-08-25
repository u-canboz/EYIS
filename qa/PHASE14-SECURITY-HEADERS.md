# Phase 14 / Gate A3 — Security-Header (gemessen)

Messung: `curl -sD -` gegen die laufende Anwendung (`http://localhost:8080`), Stand siehe
`qa/results-phase14-security.json`. Implementierung: `src/lib/security/headers.ts`,
eingehängt in `src/server.ts` (alle Antwortpfade) sowie im Store-API-Gateway.

## HTML-Dokumentantworten (`GET /`)

| Header | Wert | Status |
| --- | --- | --- |
| `x-content-type-options` | `nosniff` | PASS |
| `referrer-policy` | `strict-origin-when-cross-origin` | PASS |
| `permissions-policy` | `accelerometer=(), autoplay=(), camera=(), display-capture=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()` | PASS |
| `cross-origin-opener-policy` | `same-origin-allow-popups` | PASS |
| `x-permitted-cross-domain-policies` | `none` | PASS |
| `content-security-policy-report-only` | siehe unten | PASS (Report-Only-Phase) |
| `content-security-policy` (enforcing) | nicht gesetzt | OFFEN (bewusst, nach Report-Phase) |
| `strict-transport-security` | lokal nicht gesetzt (HTTP) | OFFEN — greift nur über HTTPS |

## Store-API-Antworten (`/api/public/store/v1/*`)

| Header | Wert | Status |
| --- | --- | --- |
| `cache-control` | `no-store` | PASS |
| `referrer-policy` | `no-referrer` | PASS |
| `x-content-type-options` | `nosniff` | PASS |
| `access-control-allow-methods` | `GET,POST,PATCH,DELETE,OPTIONS` | PASS |
| `access-control-allow-headers` | `content-type,x-commerce-key,x-cart-token,x-guest-token,authorization,idempotency-key` | PASS |
| `access-control-allow-origin` | nur bei erlaubter Origin des Keys; sonst 403 | PASS |
| `vary` | `Origin` | PASS |
| `x-request-id` | vorhanden (Korrelation ohne PII) | PASS |

## CSP (Report-Only)

```
default-src 'self'; base-uri 'self'; object-src 'none'; form-action 'self';
img-src 'self' data: blob: https:; font-src 'self' data: https:;
style-src 'self' 'unsafe-inline';
script-src 'self' 'unsafe-inline' 'unsafe-eval' https://lovable.dev https://*.lovable.dev;
connect-src 'self' https: wss:;
frame-ancestors 'self' https://lovable.dev https://*.lovable.dev https://*.lovable.app
```

Begründung Report-Only: App und Editor-Vorschau nutzen Inline-Styles und einen Inline-Bootstrap;
eine sofort erzwungene Policy würde die Anwendung brechen. Ablauf bis „enforcing“:

1. Report-Only ausliefern (erledigt).
2. Verstöße über den Report-Endpunkt/Browserkonsole in Staging sammeln.
3. Inline-Skripte durch Nonces ersetzen, `'unsafe-eval'` entfernen.
4. `Content-Security-Policy` (enforcing) aktivieren, Report-Only als Kanarienvogel behalten.

## HTTPS / HSTS

- HTTPS: PASS in der Cloud (Preview/Published werden ausschließlich über TLS ausgeliefert).
- HSTS: wird gesetzt, sobald die Anfrage über `https:` kommt
  (`max-age=31536000; includeSubDomains`). Lokal über HTTP daher nicht messbar.
- `preload` ist bewusst nicht aktiviert, solange keine eigene Produktionsdomain feststeht.

## Cookies

Die Anwendung setzt keine eigenen Session-Cookies: Admin-Sessions liegen in `localStorage`
(Supabase-Client), Cart-/Guest-Token werden als Header übertragen. Damit existiert keine
CSRF-fähige Ambient-Authority. Sollten später Cookies eingeführt werden, gilt verbindlich:
`Secure; HttpOnly; SameSite=Lax` (bzw. `Strict` für Admin), `Path=/`, kein `Domain`-Wildcard.

## frame-ancestors

Bewusst auf `'self'` plus Lovable-Preview-Domains begrenzt. Für eine eigene Produktionsdomain
ohne Editor-Vorschau wird `frame-ancestors 'self'` gesetzt (A8).
