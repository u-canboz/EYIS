# Phase 24 — EYIS Dedicated V3: Zero-Friction Owner Setup & Verteilungsgrenzen

Status-Skala: PASS · FAIL · OFFEN · BLOCKED

## Umsetzung

| Nr. | Anforderung | Status | Nachweis |
| --- | --- | --- | --- |
| 1 | Preauthorized Owner (`pending_owner_email`, server-only) | PASS | Migration auf `public.commerce_installation`; `runBootstrap({ ownerEmail })`; Zustand `AWAITING_OWNER_REGISTRATION` |
| 2 | Kein „first user wins" | PASS | `autoClaimOwner` prüft Auth-Identität, `email_confirmed_at`, normalisierte Adressgleichheit; Claim atomar via `claim_installation_owner_verified` (SECURITY DEFINER, nur `service_role`) |
| 3 | Claim-Token bleibt als Recovery | PASS | `/app/setup/recovery`; Token weiterhin zufällig, nur gehasht gespeichert, TTL 72 h, one-time, niemals in einer URL |
| 4 | Normale UX ohne Claim-Code | PASS | `/auth` zeigt bei ungeclaimter Instanz „EYIS einrichten" und öffnet den Registrieren-Tab; `/app/setup` schließt nach bestätigter Anmeldung mit Organisation + Hauptshop ab |
| 5 | Sicherheit vor Bequemlichkeit | PASS | Ohne verifizierte Pending-Owner-Identität kein Auto-Claim (`OWNER_EMAIL_UNVERIFIED` / `OWNER_NOT_PREAUTHORIZED`), Rückfall auf Recovery |
| 6 | Installer fragt nur die Admin-E-Mail | PASS | `EYIS_OWNER_EMAIL` bzw. CLI-Argument in `scripts/commerce-bootstrap.ts`; keine Abfrage von API-URL, Key, Shop-/Org-ID, DB-URL |
| 7 | Landingpage `reference_only` | PASS | `REFERENCE_ONLY_PATHS` in `src/lib/commerce/updates/ownership.ts`, Kategorie im Distribution-Manifest |
| 8 | Customer-owned Routes geschützt | PASS | `classifyPath` priorisiert `customer` vor allem anderen; `/`, `__root.tsx`, `styles.css`, Branding als `customer_owned` gelistet |
| 9 | Code Distribution Manifest | PASS | `installer/distribution/eyis-code-distribution.manifest.json` mit `install` / `reference_only` / `customer_owned` / `generated` / `optional` |
| 10 | Ergebnisbild Dedicated | PASS | Kundenseite unberührt, `/app`, `/api/public/store/v1`, SDK und eigene Cloud bleiben installiert |

## Prüfungen

| Prüfung | Status | Nachweis |
| --- | --- | --- |
| Ownership/Verteilung (Unit) | PASS | `bun run test` — 113/113, inkl. neuer Fälle für `reference_only` und Kundenpriorität |
| Typecheck | PASS | `bun run typecheck` ohne Fehler |
| Manifeste synchron | PASS | `bun run generate:manifests` + `docs:validate` |
| Vollständiger Lauf | PASS | `bun run verify` grün (docs:validate → typecheck → test → build) |
| Claim-Token niemals in URL | PASS | Recovery-Eingabe per POST/Cookie, keine Query-Parameter |
| Paralleler Claim → genau ein Owner | PASS (DB-seitig) | `claim_installation_owner_verified` sperrt die Singleton-Zeile und konsumiert `pending_owner_email` atomar |

## Offene Punkte

| Punkt | Status | Grund |
| --- | --- | --- |
| E2E gegen ein echtes fremdes Kundenprojekt („bestehende `/` unverändert") | OFFEN | Dieses Repository ist das EYIS-Hauptprojekt; die Prüfung braucht ein separates Kundenprojekt. Die Grenze ist statisch über Manifest und Unit-Tests abgesichert |
| Verifizierter E-Mail-Versand für Bestätigungslinks | BLOCKED | Absenderdomain/Provider siehe `docs/production/KNOWN_LIMITATIONS.md` |
