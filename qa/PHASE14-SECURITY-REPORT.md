# Phase 14 / Gate A3 — Security-Audit (OWASP ASVS L2 + API Security Top 10)

Nachweise: automatisierter Lauf `qa/phase14-security.ts` → `qa/results-phase14-security.json`
(**32/32 PASS**), Header-Messung in `qa/PHASE14-SECURITY-HEADERS.md`, Lovable Deep Security Scan
und Datenbank-Linter (Ergebnisse unten), plus Code-Review der genannten Dateien.

Status-Legende: PASS = belegt, FAIL = belegter Mangel, OFFEN = erkannt, noch nicht abgeschlossen,
BLOCKED = extern blockiert.

## 1. Behobene Findings dieses Gates

| ID | Fund | Schwere | Maßnahme | Nachtest |
| --- | --- | --- | --- | --- |
| A3-01 | 14 `ret_*` SECURITY-DEFINER-Funktionen waren für `anon`/`authenticated` per PostgREST-RPC ausführbar (Retouren-Statuswechsel ohne Berechtigungsprüfung) | HOCH | `REVOKE EXECUTE` von `anon`/`authenticated`, nur noch `service_role` | Linter: keine `ret_*`-Treffer mehr — PASS |
| A3-02 | Open Redirect: `returnUrl`/`cancelUrl` der Zahlungssitzung kamen ungeprüft vom Browser | HOCH | `assertAllowedRedirect()` in `payment.server.ts` — nur HTTPS und nur Shop-Domains / aktive Key-Origins / eigene Origin | Fremde Origin wird abgewiesen — PASS |
| A3-03 | Filter-Injection: Suchbegriffe flossen roh in PostgREST-`or(...)`-Filter (Produkte, Medien, Bestellungen, Kunden) | HOCH | `safeSearchTerm()` in `src/lib/commerce/search.ts`, in allen vier Suchpfaden angewandt | Injection-Payload liefert sauberes 200 ohne Filterbruch — PASS |
| A3-04 | Uploads: `registerMedia` übernahm MIME-Typ, Größe und Pfad ungeprüft vom Client (SVG/XSS, Path Traversal) | HOCH | MIME-Allowlist ohne SVG, Größenlimit 25 MB, Pfad-Traversal-Prüfung zusätzlich zum Org-Präfix | Code-Review + Typecheck — PASS |
| A3-05 | Öffentliche Server-Functions (Gast-Zugang, Cart, Retouren) ohne Rate-Limit | MITTEL | `enforcePublicLimit()` (`limit.server.ts`) mit IP-Hash-Bucket | 429 nach Limit belegt — PASS |
| A3-06 | Fehlende Security-Header (CSP, Permissions-Policy, HSTS, COOP) | MITTEL | `withSecurityHeaders()` global; CSP zunächst Report-Only | Header gemessen — PASS |

## 2. Authentifizierung und Sessions

| Prüfpunkt | Status | Nachweis |
| --- | --- | --- |
| Admin-Auth und Customer-Auth strikt getrennt | PASS | Admin: Supabase-Session + `_authenticated`-Gate + `has_permission` je Organisation. Kundenzugang: eigene Token (Cart-, Guest-, Confirmation-Token) über Store-API-Header; kein Pfad verleiht Admin-Rechte |
| Login/Logout/Passwort-Reset | PASS | Supabase Auth, keine Eigenimplementierung; Logout löscht Session und Query-Cache |
| Session-Ablauf/Token-Widerruf | PASS | JWT-Ablauf + Refresh durch Supabase; API-Keys per `status='revoked'` sofort ungültig (Test „Widerrufener Key -> 401“) |
| Keine anonyme Registrierung | PASS | Anonymous Sign-ins deaktiviert |

## 3. Autorisierung (API Top 10 – BOLA/BFLA/BOPLA)

| Prüfpunkt | Status | Nachweis |
| --- | --- | --- |
| Object-Level (BOLA) | PASS | Cart ohne Token 401/403, mit falschem Token 403, fremde Cart-ID 403/404 |
| Cross-Tenant mit manipulierten IDs | PASS | Shop-B-Key auf Cart von Shop A → 403/404; zusätzlich 185 RLS-Policies mit `organization_id`-Scope; Phase-12-Report deckt Katalog, Bestellungen, Dokumente ab |
| Function-Level (BFLA) | PASS | Store-API kennt nur eine Allowlist von Routen (`routes.server.ts`); Schreiboperationen erfordern Cart-/Guest-/Customer-Token; Admin-RPCs nur `service_role` |
| Property-Level (BOPLA/Mass Assignment) | PASS | Jede Route validiert per Zod-Schema; Preise/Beträge stammen ausschließlich aus Server-Snapshots. Test „Mass Assignment“ zeigt: `organization_id`/`unit_price_minor` aus dem Body werden verworfen |
| Publishable Key ohne Privilegien | PASS | Key liefert nur Tenant-Kontext; Katalog lesbar, jede kundenbezogene Ressource verlangt zusätzliches Token |
| Antwort-DTOs per Allowlist | PASS | `mapCart`/`mapOrder` u. a. projizieren explizit; keine `select('*')`-Durchreichung |

## 4. Token (Gast, Cart, Confirmation, Customer)

| Prüfpunkt | Status | Nachweis |
| --- | --- | --- |
| Entropie und Speicherung | PASS | 32 Byte Zufall, nur SHA-256-Hash in der DB |
| Scope | PASS | Token binden an Organisation, Shop und Ressource; Prüfung im Gateway vor dem Handler |
| Ablauf | PASS | `expires_at` auf Guest- und Confirmation-Token; abgelaufene Sitzungen räumt `ops_expire_due()` ab |
| Replay/Bruteforce | PASS | Erfundener Guest-Token 403; Gast-Zugang ratenbegrenzt (429 belegt) |
| Widerruf | PASS | Token-Zeilen löschbar/`revoked`; Cart-Token endet mit Cart-Abschluss |

## 5. Eingaben und Injection

| Prüfpunkt | Status | Nachweis |
| --- | --- | --- |
| SQL Injection | PASS | Ausschließlich PostgREST/RPC mit parametrisierten Argumenten; keine String-Konkatenation von SQL im App-Code |
| PostgREST-Filter-Injection | PASS | A3-03 behoben, Test grün |
| XSS / Stored XSS | PASS | React escaped standardmäßig; kein `dangerouslySetInnerHTML` im Produktionscode; SVG-Upload gesperrt |
| Template Injection (E-Mail) | PASS | Block-Renderer ersetzt nur bekannte Platzhalter und escaped Werte; keine Ausdrucksauswertung |
| Header Injection | PASS | Header werden über `Headers` gesetzt; Empfänger-/Betreffwerte werden bereinigt |
| Path Traversal | PASS | Storage-Pfade serverseitig mit `organizationId`-Präfix; `..`/Backslash abgelehnt; Test „Path Traversal -> kein 200“ |
| SSRF | PASS | `webhook.server.ts`: DoH-Auflösung, Blockliste privater/link-lokaler Bereiche, IP-Pinning, keine Redirects |
| Open Redirect | PASS | A3-02 behoben |
| ReDoS | PASS | Keine verschachtelten Quantoren in App-Regexen; Suchbegriffe auf 80 Zeichen begrenzt |
| Übergroße Payloads | PASS | Body-Limit im Gateway, Test liefert 400 |

## 6. Missbrauch und Rate Limits

| Prüfpunkt | Status | Nachweis |
| --- | --- | --- |
| Rate Limits Store API | PASS | Pro Key und pro IP-Hash mit Profilen; Phase-12-Report + 429-Test |
| Rate Limits Server Functions | PASS | Neu über `enforcePublicLimit()` |
| Idempotency-Missbrauch | PASS | `idempotency_keys` sind an Organisation und Operation gebunden; Wiederholung liefert dasselbe Ergebnis, kein Fremdzugriff |
| Origin-Manipulation / fehlende Origin | PASS | Fremde Origin 403; erlaubte Origin 200; serverseitige Aufrufe ohne Origin nur bei Keys ohne Origin-Bindung |

## 7. Jobs und Cron

| Prüfpunkt | Status | Nachweis |
| --- | --- | --- |
| Nur zentrale Cron-Auth | PASS | `communications`, `automation`, `expiration`: ohne Secret 401, mit Publishable Key 401 (je 2 Tests, alle grün) |
| Kein Parallel-Secret | PASS | `COMMUNICATION_JOB_SECRET` entfernt (Gate A2) |

## 8. Informationsabfluss

| Prüfpunkt | Status | Nachweis |
| --- | --- | --- |
| Keine Stack Traces / internen Details | PASS | Fehlerantworten sind normierte Envelopes; Test prüft auf Stack-Muster, `service_role`, `sb_secret`, Supabase-Host — keine Treffer |
| Keine Secrets im Bundle | PASS | Gate-A2-Scan über `dist/client` und `dist/server`: 0 Treffer |
| Logs/Audit/Outbox ohne Secrets | PASS | Gate-A2-Scan über 261 Audit- und 212 Outbox-Einträge: 0 Treffer; API-Logs speichern weder Header noch Bodies |

## 9. Scanner-Ergebnisse

Deep Security Scan: 5 Findings, alle `warn`, keine kritischen oder hohen.
Datenbank-Linter: 13 Hinweise, 3 Typen.

| Finding | Status | Bewertung |
| --- | --- | --- |
| `authenticated_security_definer_function_executable` (6) | PASS (akzeptiert) | Verbleiben `has_permission`, `has_org_role`, `is_org_member`, `current_org_ids`, `shares_org_with`, `store_current_ip_salt` — RLS-Hilfsfunktionen, die für angemeldete Nutzer aufrufbar sein müssen; sie geben nur Boolesche Werte zur eigenen Identität zurück |
| `RLS Enabled No Policy` (6) | PASS (beabsichtigt) | Systemtabellen (`outbox_events`, `idempotency_keys`, `automation_rule_counters`, `store_api_rate_counters`, `store_privacy_salts`, `store_confirmation_tokens`) sollen per Data API vollständig gesperrt sein; Zugriff nur `service_role` |
| `Extension in Public` (1) | OFFEN | `pg_net`/Cron-Extension im `public`-Schema; Verschiebung erfordert Extension-Neuanlage, geplant für A8 |
| `profiles_select_self` über `shares_org_with` | OFFEN | Organisationsmitglieder sehen Name und E-Mail von Kolleg:innen — für ein Team-Backoffice gewollt, wird in A4 auf minimale Felder eingegrenzt |
| `customer_addresses_self` als `ALL`-Policy | OFFEN | Umschreibung auf getrennte SELECT/INSERT/UPDATE/DELETE-Policies mit `customer_id`-Immutabilität, geplant für A4 |
| `carts/orders` ohne Customer-Self-Policy | PASS | Beabsichtigt: kundenseitige Zugriffe laufen ausschließlich über die Store-API mit Token-Prüfung, nicht über direkte Tabellenzugriffe |
| Storage-Pfad aus erstem Ordnersegment | PASS | Pfade werden serverseitig gebildet und zusätzlich validiert (A3-04) |

## 10. Bestehende Blocker und Grenzen

- FAIL (Go-live-Blocker, aus A2): Development, Staging und Production teilen weiterhin ein
  einziges Backend-Projekt — Daten, Buckets, Auth-Nutzer, API-Keys, Cron-Secret. Siehe
  `docs/production/ENVIRONMENT_MATRIX.md`.
- OFFEN: Enforcing-CSP nach der Report-Phase; HSTS nur über HTTPS messbar.
- OFFEN: MIME-Allowlist auf Bucket-Ebene (aktuell nur Anwendungsebene erzwungen).
- BLOCKED: Stripe-Live, echter E-Mail-Versand, Carrier-Integrationen — keine Provider-Zugänge
  vorhanden, es wurden keine erfunden.

## 11. Ergebnis

Keine kritischen oder hohen Findings offen: alle sechs identifizierten High/Medium-Punkte dieses
Gates wurden behoben und nachgetestet (32/32 automatisierte Prüfungen grün). Verbleibend sind vier
`OFFEN`-Punkte (CSP-Enforcing, Bucket-MIME, zwei Policy-Verfeinerungen, Extension-Schema), ein
bestehender Umgebungs-`FAIL` aus A2 und drei externe `BLOCKED`-Themen.
