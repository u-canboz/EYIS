# EYIS Dedicated V3 — Zero-Friction Owner Setup & Verteilungsgrenzen

Ziel: Eine neue Dedicated-Installation braucht im Normalfall nur noch eine Angabe —
die E-Mail-Adresse des ersten Administrators. Kein Claim-Code im normalen Ablauf,
ohne die bestehende Sicherheitsarchitektur aufzuweichen. Zusätzlich wird die
EYIS-Marketingseite verbindlich von der Auslieferung in Kundenprojekte ausgeschlossen.

## 1. Vorbereiteter Owner (Preauthorized Owner)

- `commerce_installation` bekommt server-only Felder: `pending_owner_email`
  (normalisiert, lowercase/trim), `pending_owner_set_at`, `pending_owner_consumed_at`
  sowie einen abgeleiteten Zustand `AWAITING_OWNER_REGISTRATION` / `CLAIMED`.
- Der Bootstrap (`/api/public/install/bootstrap`, `bun run commerce:bootstrap`) nimmt
  optional `ownerEmail` entgegen. Der Wert wird nie an Clients zurückgegeben und nie
  in eine URL geschrieben; im öffentlichen Status erscheint höchstens eine maskierte Form.
- Die Bootstrap-Ausgabe zeigt den Claim-Token nicht mehr an, wenn ein Pending Owner
  gesetzt wurde. Der Token wird nur noch als Recovery-Hinweis erwähnt.

## 2. Kein „first user wins"

Auto-Claim nur, wenn alle Bedingungen erfüllt sind:
Installation ungeclaimt, Pending Owner vorhanden, Nutzer authentifiziert,
E-Mail nachweislich bestätigt (`email_confirmed_at` aus der Auth-Identität),
normalisierte Auth-E-Mail exakt gleich Pending Owner, Claim atomar noch frei.

- Neue SQL-Funktion `claim_installation_owner_verified(...)` (SECURITY DEFINER,
  nur `service_role`), die per `SELECT ... FOR UPDATE` auf dem Singleton
  arbeitet, den Pending Owner prüft und in einer Transaktion Organisation,
  Shop und Owner-Membership anlegt sowie `owner_claimed_at` und
  `pending_owner_consumed_at` setzt. Parallele Claims können damit nur einen
  Owner erzeugen; der zweite Aufruf endet mit `OWNER_ALREADY_CLAIMED`.
- Danach wie bisher: Default-Settings, Installation ↔ Tenant verknüpfen,
  Publishable Key erzeugen, Runtime Config aktiv, Audit-Eintrag.
- Fremde E-Mail-Adressen erhalten `OWNER_NOT_PREAUTHORIZED` und werden nicht Owner.

## 3. Claim-Token bleibt als Recovery

Die vorhandene Token-Architektur (Zufallswert, nur Hash gespeichert, TTL,
einmalig, nie in einer URL) bleibt vollständig erhalten und wird zum
**Recovery Claim**: erreichbar über `/app/setup/recovery`, nur wenn kein
Pending Owner existiert, die Verifizierung nicht möglich ist oder der Owner
sich ausgesperrt hat.

## 4. Normaler Ablauf in der Oberfläche

- `/app` bei ungeclaimter Installation → geführte Seite „EYIS einrichten":
  Administrator-Konto erstellen (E-Mail, Passwort) bzw. „Einloggen", wenn ein
  Konto besteht. Kein Claim-Code-Feld.
- Nach bestätigter Anmeldung: kurzes Formular für Organisation und Hauptshop-Namen
  (so gewünscht), dann Auto-Claim und Weiterleitung nach `/app/system/einrichtung`.
- Zustände mit klarer Meldung: E-Mail noch nicht bestätigt, falsche E-Mail-Adresse,
  kein Pending Owner (Verweis auf Recovery).

## 5. E-Mail-Bestätigung

Die Bestätigung der Registrierung wird im Backend-Auth aktiviert, damit der
Besitz der Adresse belegt ist. Ist keine bestätigte Identität vorhanden, ist
Auto-Claim `BLOCKED` und es gilt ausschließlich der Recovery-Weg.

## 6. Installer-UX

Der Dedicated-Agent fragt genau eine fachliche Angabe:
„Welche E-Mail-Adresse soll der erste Administrator verwenden?"
Keine Fragen nach Store-API-URL, Publishable Key, Claim Token, Database URL,
externem EYIS-Projekt, Shop-ID oder Organisation-ID. Runbooks
(`docs/production/INSTALLATION.md`, `docs/agent/CUSTOMER_ONBOARDING.md`,
`docs/agent/NEW_STOREFRONT_RUNBOOK.md`) werden entsprechend gekürzt.

## 7. Marketingseiten als REFERENCE_ONLY

`src/routes/index.tsx` (Landingpage), `src/routes/entwickler.tsx`,
`src/routes/dokumentation*`, Demo-/Referenz-Storefront unter `src/routes/store/**`
und interne Präsentationsseiten werden als `reference_only` klassifiziert.
Sie verbleiben im EYIS-Hauptrepository, gehören aber nicht zum Runtime-Pack einer
Kundeninstallation. Die Dateien selbst erhalten einen kurzen `REFERENCE_ONLY`-Header.

## 8. Kunden-Routen schützen

`classifyPath` in `src/lib/commerce/updates/ownership.ts` wird um die
Kategorie `reference_only` erweitert; `/`, Header, Footer, Navigation, Branding,
CSS, Storefront und Content eines bestehenden Projekts bleiben `customer_owned`
und dürfen weder bei Installation noch beim Update ersetzt werden.

## 9. Code Distribution Manifest

Neu: `installer/distribution/eyis-code-distribution.manifest.json` mit den
Kategorien `install`, `reference_only`, `customer_owned`, `generated`, `optional`
und einem Generator (`bun run generate:manifests`-Anschluss). Der Dedicated-Agent
übernimmt ausschließlich `install`. Ein Test stellt sicher, dass jede Route genau
eine Kategorie hat und die Landingpage niemals in `install` landet.

## 10. QA

Neuer Harness `qa/phase24-dedicated-v3.ts` (`bun run qa:dedicated-v3`) mit einem
Kundenprojekt-Fixture, das eine eigene `/`-Startseite mitbringt:

- bestehende `/`, Header und Footer unverändert, keine EYIS-Marketingseite
- `/app`, Store API und Owner-Registrierung vorhanden
- nur die vorbereitete, bestätigte E-Mail kann claimen; fremde Registrierung scheitert
- paralleler Claim erzeugt genau einen Owner (gleichzeitige Aufrufe)
- Recovery Claim weiterhin funktionsfähig
- Claim Token erscheint in keiner URL (Netzwerk-Mitschnitt)

Ergebnis in `qa/PHASE24-DEDICATED-V3-REPORT.md` und
`qa/results-phase24-dedicated-v3.json`, Status ausschließlich PASS/FAIL/OFFEN/BLOCKED.
Abschluss mit `bun run verify`.

## Technische Details

- Migration: neue Spalten auf `commerce_installation` (bleibt server-only,
  nur `service_role`), neue SECURITY-DEFINER-Funktion mit `REVOKE`/`GRANT`
  wie bei der bestehenden Claim-Funktion; keine Änderung an bestehenden
  Datensätzen, kein Verlust der bisherigen Claim-Funktion.
- Baseline-Pack: `bun run` Installer-Baseline und Fingerprint werden nach der
  Migration neu erzeugt, damit Fresh Install und Live-Schema identisch bleiben.
- Server: Erweiterung von `installation.server.ts` (Bootstrap mit `ownerEmail`,
  `getSetupState`, `autoClaimOwner`) und `installation.functions.ts`
  (`autoClaimInstallationOwner` hinter `requireSupabaseAuth`; E-Mail-Bestätigung
  wird serverseitig aus den Auth-Claims geprüft, nie aus Client-Eingaben).
- UI: `/app/setup` wird zum Registrierungs-/Anmeldeschritt plus Workspace-Formular;
  `/app/setup/recovery` übernimmt den bisherigen Code-Flow unverändert.
- Keine Änderung an Commerce-Fachlogik, Store API v1, SDK oder RLS-Modell.
