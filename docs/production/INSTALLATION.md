# Dedicated Installation — Betreiber-Runbook

EYIS kann neben dem zentralen SaaS-Betrieb als **Dedicated Instance** in einem eigenen
Lovable-Projekt laufen. „Installieren" heißt: das neue Projekt bekommt eigene Cloud (Postgres,
Auth, Storage, RLS), eigene Admin-Oberfläche, eigene API und die komplette Commerce Engine.

## Ablauf: Provisioning → Migration → Bootstrap

| Phase | Wer | Was |
| --- | --- | --- |
| 1. Provisioning | Plattform/Operator | Neues Lovable-Projekt aus dem EYIS-Template, eigene Cloud-Instanz, Secrets setzen |
| 2. Migration | Plattform | Alle Migrationen unter `supabase/migrations/` anwenden (nativer Prozess) |
| 3. Bootstrap | Operator | `bun run commerce:bootstrap` — registriert die Instanz, gibt einmalig den Claim-Token aus |
| 4. Owner-Claim | Erster Owner | `/app/setup`: Claim-Code einfügen → Organisation + Shop atomar anlegen |
| 5. Setup | Owner | `/app/system/einrichtung`: Domain, Payments, E-Mail, API-Keys |

## Erforderliche Umgebungsvariablen

| Variable | Pflicht | Zweck |
| --- | --- | --- |
| `COMMERCE_DEPLOYMENT_MODE=dedicated` | ja | aktiviert den Dedicated Mode (fehlend/leer = `shared`) |
| `COMMERCE_BOOTSTRAP_SECRET` | ja (Bootstrap) | serverseitiges Credential für Bootstrap/Doctor-Endpunkte |
| `APP_ENV` | ja | `development` \| `staging` \| `production` (fehlend/unknown = STOP) |

## Bootstrap ausführen

```bash
COMMERCE_OS_URL=https://<projekt>.lovable.app \
COMMERCE_BOOTSTRAP_SECRET=<secret> \
bun run commerce:bootstrap
```

Das Secret wird **ausschließlich als HTTP-Header** (`x-commerce-bootstrap-secret`) gesendet —
niemals in der URL. Der ausgegebene **Claim-Token erscheint genau einmal** in der CLI-Ausgabe
und ist 72 Stunden gültig. Danach ist der Bootstrap-Endpunkt dauerhaft gesperrt
(`403 INSTALLATION_ALREADY_INITIALIZED`).

## Abbruchmatrix

Der Bootstrap bricht ohne Nebenwirkungen ab, wenn:

- `APP_ENV` fehlt/unbekannt ist (`ENVIRONMENT_UNKNOWN`)
- `COMMERCE_DEPLOYMENT_MODE` nicht `dedicated` ist (`INSTALLATION_NOT_DEDICATED`)
- zentrale Commerce-Abhängigkeiten konfiguriert sind (`CENTRAL_DEPENDENCY_DETECTED`)
- das Commerce-Schema nicht erreichbar ist (`SCHEMA_MISSING` → Migrationen zuerst)
- die Instanz bereits initialisiert ist (`INSTALLATION_ALREADY_INITIALIZED`)
- System-Seeds unvollständig sind (`SYSTEM_SEED_INCOMPLETE`)

## Sicherheitsinvarianten

- `commerce_installation` ist eine **Server-only-Tabelle**: RLS aktiv, keine Policies,
  kein Zugriff für `anon`/`authenticated`.
- Der Claim-Token wird nur als **Hash** gespeichert, läuft nach 72 h ab und wird nach
  erfolgreichem Claim sofort invalidiert (kein Replay).
- „Erster registrierter Nutzer wird Owner" ist **abgeschaltet**: ohne gültigen Claim-Token
  legt `/app` keine Organisation an. Die Übernahme läuft atomar in der Datenbankfunktion
  `claim_installation_owner` (Service-Role only).
- Der Claim-Code wird per Formular-POST übergeben, niemals in der URL; der Tausch setzt eine
  kurzlebige httpOnly-Setup-Session.

## Doctor

```bash
COMMERCE_OS_URL=https://<projekt>.lovable.app \
COMMERCE_BOOTSTRAP_SECRET=<secret> \
bun run commerce:doctor
```

Read-only. Prüft u. a. Environment, Deployment Mode, zentrale Abhängigkeiten (eigene
Infrastruktur und konfigurierte Provider sind erlaubt; zentrale EYIS-Hosts nicht),
Datenbank, Storage, RLS-Sperren und Claim-/Setup-Status. Exit-Code 1 bei FAIL.

## Dedicated Runtime Config (keine manuelle SDK-Konfiguration)

Im Dedicated Mode konfiguriert sich die Storefront selbst:

- `GET /api/public/store/v1/runtime-config` liefert Same-Origin API-Basis, Shop-Kontext und den
  Publishable Key der Installation. Enthält niemals Secrets.
- Der Publishable Key wird beim Owner-Claim bzw. bei der Übernahme automatisch erzeugt
  (idempotent, genau ein Storefront-Key) und in `commerce_installation` hinterlegt.
- `VITE_COMMERCE_API_URL` und `VITE_COMMERCE_PUBLISHABLE_KEY` sind damit **nicht** erforderlich;
  sie wirken nur noch als Override für Remote-Storefronts (Betriebsart B).
- Bestehende Instanzen mit Organisation und Shop werden über
  `/app/system/einrichtung` → „Installation übernehmen" registriert (nur Owner).
- `commerce:doctor` weist die Unabhängigkeit nach: Store API (same-origin), Runtime Config,
  Publishable Key (auto), Store SDK Binding, Dedicated Independence.

## Storefront-URL

Die öffentliche Basis-URL der Storefront wird im Setup-Wizard oder als
`storefront_origin` in der Installation gesetzt und für Webhook-URLs und E-Mail-Links verwendet.
