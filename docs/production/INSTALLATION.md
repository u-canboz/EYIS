# Dedicated Installation — Betreiber-Runbook

EYIS kann neben dem zentralen SaaS-Betrieb als **Dedicated Instance** in einem eigenen
Lovable-Projekt laufen. „Installieren" heißt: das neue Projekt bekommt eigene Cloud (Postgres,
Auth, Storage, RLS), eigene Admin-Oberfläche, eigene API und die komplette Commerce Engine.

## Ablauf: Provisioning → Migration → Bootstrap

| Phase | Wer | Was |
| --- | --- | --- |
| 1. Provisioning | Plattform/Operator | Neues Lovable-Projekt aus dem EYIS-Template, eigene Cloud-Instanz, Secrets setzen |
| 2. Datenbank | Agent/Operator | **EYIS Database Install Pack** aus `installer/database/` anwenden (Units → Seeds → Reconciliation → Verify). Die historische Migrationskette wird nicht nachgespielt. Siehe [DATABASE_INSTALL_PACK.md](DATABASE_INSTALL_PACK.md) |
| 3. Bootstrap | Operator | `EYIS_OWNER_EMAIL=<admin@kunde.de> bun run commerce:bootstrap` — registriert die Instanz und hinterlegt den vorbereiteten Administrator (Pending Owner) |
| 4. Owner-Claim | Vorbereiteter Owner | `/app`: mit genau dieser E-Mail registrieren, Adresse bestätigen, anmelden → `/app/setup` legt Organisation + Shop atomar an. Kein Claim-Code im Normalfall |
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

Mit `EYIS_OWNER_EMAIL` (oder als erstem CLI-Argument) wird der zukünftige Administrator
serverseitig vorgemerkt. Die Installation steht danach auf `AWAITING_OWNER_REGISTRATION`, und
die CLI zeigt **keinen** Claim-Token an.

Ohne vorbereitete Administrator-E-Mail fällt der Bootstrap auf den **Recovery Claim** zurück:
Der Token erscheint dann genau einmal in der CLI-Ausgabe, ist 72 Stunden gültig, wird nur
gehasht gespeichert, ist einmalig verwendbar und steht niemals in einer URL. Eingabe unter
`/app/setup/recovery`.

Das Secret wird **ausschließlich als HTTP-Header** (`x-commerce-bootstrap-secret`) gesendet —
niemals in der URL. Danach ist der Bootstrap-Endpunkt dauerhaft gesperrt
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

## Zero-Friction Owner Setup (V3)

- **Kein „first user wins".** Owner wird ausschließlich, wer authentifiziert ist, dessen
  E-Mail-Besitz bestätigt wurde und dessen normalisierte Adresse exakt dem Pending Owner
  entspricht. Der Claim läuft atomar über `public.claim_installation_owner_verified`;
  parallele Versuche erzeugen genau einen Owner.
- **Unbestätigte E-Mail = kein Auto-Claim.** Dann bleibt nur der Recovery-Weg.
- **Der Agent braucht genau eine fachliche Angabe:** die E-Mail-Adresse des ersten
  Administrators. Keine Store-API-URL, kein Publishable Key, keine Shop-/Organisations-IDs,
  keine Datenbank-URL.

## Verteilungsgrenzen

`installer/distribution/eyis-code-distribution.manifest.json` ist verbindlich. Ein
Dedicated-Agent übernimmt ausschließlich Pfade der Kategorie `install`. Die öffentliche
EYIS-Marketing-/Landingpage, Entwicklerseiten, Demo-Inhalte und die Referenz-Storefront sind
`reference_only` und werden niemals in ein Kundenprojekt installiert. Bestehende `/`,
Header, Footer, Navigation, Branding, CSS und Inhalte des Kundenprojekts sind
`customer_owned` und bleiben unverändert.
