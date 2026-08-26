# Sicherheitsgrenzen

Belege: `qa/PHASE14-SECURITY-REPORT.md` (32/32 PASS), `qa/PHASE14-RLS-REPORT.md` (52/52 PASS),
`docs/production/DATABASE_SECURITY_MATRIX.md`.

## 1. Mandantentrennung

- Jede Fachtabelle trägt `organization_id`, transaktionale Daten zusätzlich `shop_id`.
- RLS ist auf allen Fachtabellen aktiv; Policies prüfen die Mitgliedschaft über
  `memberships`/`has_permission` (SECURITY DEFINER, `search_path = public`).
- Rollen stehen ausschließlich in `memberships`/`role_permissions` — **nie** in `profiles`.
- Store-API-Anfragen sind über den Publishable Key hart an genau einen Shop gebunden. Ein Key von
  Shop B kann eine Ressource von Shop A nicht lesen (Nachweis: `qa/phase12.ts`).

## 2. Authentifizierung je Eingang

| Eingang | Nachweis | Prüfort |
| --- | --- | --- |
| Backoffice `/app/**` | Supabase-Session | `src/routes/_authenticated/route.tsx` + `requireSupabaseAuth` |
| Store API | `X-Commerce-Key` + Origin | `src/lib/commerce/store/keys.server.ts` |
| Warenkorb/Checkout | `X-Cart-Token` | Gateway-Kontext `requireCart` |
| Kundenkonto | Store-Kunden-Session | `src/lib/commerce/portal` |
| Gastbestellung | Gast-Token mit kurzer Gültigkeit | `guest_order_access_tokens` |
| Job-Endpunkte | `LOVABLE_CRON_SECRET` | `src/integrations/supabase/cron-auth.ts` |
| Provider-Webhooks | Signaturprüfung vor jeder Verarbeitung | jeweilige Route unter `src/routes/api/public/webhooks/` |

## 3. Schlüssel und Secrets

- **Publishable Key** ist kein Geheimnis: shopgebunden, nur lesende bzw. eng definierte Aktionen,
  Origin-Restriction, Rate-Limits, jederzeit widerrufbar. Er darf im Frontend stehen.
- **Service-Role-Key** verlässt niemals den Server, steht in keinem Client-Bundle, in keinem Log und
  in keiner Dokumentation.
- Secrets werden nur im `.handler()` gelesen, nie auf Modulebene, nie mit `VITE_`-Präfix.
- Register und Rotationswege: `docs/production/SECRETS_REGISTER.md`,
  `docs/production/ENVIRONMENT_MATRIX.md`.

## 4. Datenabfluss verhindern

- Öffentliche Antworten entstehen ausschließlich über die Allowlist in
  `src/lib/commerce/store/mappers.server.ts`. Neue Felder sind standardmäßig **nicht** öffentlich.
- Niemals öffentlich: Einkaufspreise, Margen, interne Notizen, Lieferantendaten, andere Kunden,
  fremde Shops, Roh-IDs interner Systeme, Zahlungs-Provider-Rohdaten.
- Request-Logs speichern IP-Adressen nur gehasht mit täglich rotierendem Salt
  (`privacy.server.ts`, `store_privacy_salts`).

## 5. Transport und Header

- HTTPS erzwungen, HSTS gesetzt, Security-Header zentral in `src/lib/security/headers.ts`.
- CSP wurde zuerst im Report-Only-Modus geprüft; Details in `qa/PHASE14-SECURITY-HEADERS.md`.
- CORS der Store API: nur Origins aus der Key-Allowlist. Kein Wildcard bei Anfragen mit Token.
- Cookies: `Secure`, `HttpOnly` (soweit serverseitig gesetzt), `SameSite` restriktiv.

## 6. Eingaben und Angriffsflächen

- Jede Eingabe wird mit Zod validiert (`inputValidator` bzw. im Route-Handler).
- Suche: Eingaben werden neutralisiert; kein dynamisches SQL aus Nutzertext.
- Medien-/Dateipfade: kein Pfad-Traversal, Storage-Buckets sind privat, Zugriff über signierte URLs.
- Weiterleitungen (z. B. nach Zahlung) nur auf zuvor registrierte Shop-Domains — keine offenen
  Redirects.
- Ausgehende Webhooks mit SSRF-Prüfung; Weiterleitungen werden nicht gefolgt.
- Rate-Limits pro Profil (`catalog_read`, `search`, `cart_write`, `checkout`, `customer_login`, …)
  siehe `docs/agent/store-api-v1.json`.

## 7. Unveränderlichkeit und Nachvollziehbarkeit

- `tax_snapshots` sind per Trigger unveränderlich.
- Ausgestellte Rechnungen und Gutschriften werden nicht geändert; Korrektur nur über neue Belege.
- Zahlungsereignisse werden append-only geführt und idempotent verarbeitet.
- Sicherheitsrelevante Aktionen landen im `audit_log`.

## 8. Verbote für Agenten

1. Keine RLS deaktivieren, keine Policy „vorübergehend" lockern.
2. Kein `GRANT ALL` an `anon`/`authenticated`; nur die tatsächlich benötigten Rechte.
3. Keine `SECURITY DEFINER`-Funktion ohne festes `search_path` und ohne Zugriffsbeschränkung.
4. Keine Service-Role-Nutzung für gewöhnliche Lesevorgänge oder zur Rollenprüfung.
5. Keine neuen öffentlichen Endpunkte ohne Authentifizierung, Rate-Limit und DTO-Allowlist.
6. Keine Secrets in Code, Logs, Fehlermeldungen, Manifesten oder Dokumentation.
7. Keine Produktionsdaten in Tests, Fixtures oder Beispielen.

## 9. Nach jeder sicherheitsrelevanten Änderung

```bash
bun run verify
bun run qa:security     # nur gegen Dev/Preview
bun run qa:rls          # nur gegen Dev/Preview
```

Ergebnis mit Datum und Nachweis in `qa/` dokumentieren.
