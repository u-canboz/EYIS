# Commerce OS — Phase 0: Fundament

Ziel dieser Phase: das Mandanten- und Rechte-Fundament aus dem Konzeptpaket, lauffähig auf diesem Stack. Noch kein Katalog, keine Preise, kein Checkout.

## Was gebaut wird

**Backend (Lovable Cloud)**
- `organizations` — Mandant (Name, Slug, Status)
- `shops` — pro Organisation mehrere Shops (Name, Slug, Währung, Locale, Status)
- `shop_domains` — Domains je Shop
- `memberships` — Nutzer ↔ Organisation, mit Rolle
- `app_role` Enum mit den Standardrollen: owner, administrator, operations, catalog_manager, fulfillment, customer_support, finance, marketing, developer, read_only
- `role_permissions` — feingranulare Rechte (products.read, orders.fulfill, invoices.issue, settings.manage, …) je Rolle
- `invitations` — Einladungen ausschließlich über Token: `organization_id`, `email`, `role`, `token_hash` (nur Hash in der DB), `status` (pending/accepted/revoked/expired), `expires_at`, `invited_by`, `accepted_at`, `accepted_by`. Ein Membership entsteht erst beim Annehmen des gültigen Tokens durch den eingeloggten Nutzer — nie durch bloßes Eintragen einer E-Mail
- `audit_log` — append-only, wer hat wann was in welcher Organisation geändert
- `outbox_events` — vorbereitet: `id`, `organization_id`, `event_type`, `payload`, `status`, `available_at`, `attempts`, `last_error`, `created_at`, `processed_at`. Wird in Phase 0 geschrieben, aber noch nicht verarbeitet
- `idempotency_keys` — vorbereitet: `key`, `organization_id`, `endpoint`, `request_hash`, `response`, `status`, `created_at`, `expires_at`, Unique auf (organization_id, endpoint, key)
- Security-Definer-Funktionen: `has_org_role()`, `has_permission()`, `current_org_ids()` — verhindern RLS-Rekursion
- RLS auf allen Tabellen: Zugriff nur über Membership der jeweiligen Organisation; keine Cross-Tenant-Lesbarkeit. `idempotency_keys` und `outbox_events` sind server-only (kein Zugriff für `authenticated`)
- GRANTs für `authenticated` / `service_role` je Tabelle

**Auth**
- E-Mail + Passwort Login/Registrierung unter `/auth`
- Erste Registrierung legt automatisch Organisation + ersten Shop an, Nutzer wird `owner`
- Geschützter Bereich `_authenticated` mit Redirect auf `/auth`

**Server-Schicht (statt Edge Functions)**
- Alle Mutationen laufen über TanStack Server Functions mit Auth-Middleware
- Kein direkter Tabellen-Write aus dem Client für Organisation, Shop, Membership, Rollen
- Jede Mutation schreibt einen Audit-Eintrag
- Ein interner, typisierter "Commerce SDK"-Layer (`src/lib/commerce/*`) bündelt die Aufrufe — ersetzt das im Konzept beschriebene SDK-Paket

**UI (Deutsch)**
- `/` — Landing/Weiterleitung: eingeloggt → Dashboard, sonst → Login
- Admin-Shell mit Sidebar, Organisations- und Shop-Umschalter
- Dashboard mit Status der Einrichtung ("Nächste Schritte" statt Kachelwüste)
- `/einstellungen/shop` — Shopdaten, Domains
- `/einstellungen/team` — Mitglieder einladen, Rollen zuweisen, entfernen
- `/einstellungen/audit` — Audit-Log-Ansicht

## Abnahmekriterien (aus dem Konzept)

- Zwei Testorganisationen können sich gegenseitig keine Daten lesen
- Rollen greifen: Read-Only kann keine Shopdaten ändern
- Jede Änderung erscheint im Audit-Log
- Kein Service-Role-Key im Client-Bundle

## Technische Hinweise

- Abweichung vom Konzept, bewusst: statt Supabase Edge Functions + Monorepo-SDK werden TanStack Server Functions und ein interner SDK-Modulpfad genutzt. Die verbindlichen Regeln (keine Commerce-Logik im Client, RLS überall, Idempotency bei kritischen Mutationen, Audit) bleiben erhalten.
- Rollen liegen ausschließlich in `memberships`/`role_permissions`, niemals auf einem Profil.
- Outbox/Queue-Mechanik wird in Phase 0 nur als Tabellenstruktur vorbereitet, nicht verarbeitet.
- Die Konzeptdateien werden als Referenz unter `docs/concept/` im Projekt abgelegt.

## Nicht in dieser Phase

Produkte, Blueprints, Preise, Lager, Cart, Checkout, Zahlungen, Versand, Rechnungen, Storefront. Diese folgen ab Phase 1.
