# Architektur — Ist-Zustand V1

Stand: 2026-08-25 · abgeleitet aus dem tatsächlichen Code, nicht aus den Phasenplänen.

## Laufzeit

- Frontend und Server laufen in einer TanStack-Start-Anwendung (React 19, Vite 8).
- Serverseitiger Code läuft in einer Edge-Worker-Laufzeit. Kein Node-Host, keine Subprozesse, kein dauerhaftes Dateisystem.
- Datenbank, Auth und Storage über Lovable Cloud (Postgres mit RLS, 112 Tabellen, 3 private Buckets).

## Schichten

```text
Browser (Backoffice)      Browser (Storefront)        Externe Systeme
        |                          |                         |
   Server Functions          Store SDK 1.0.0           Webhooks / Cron
   (*.functions.ts)                |                         |
        |                  /api/public/store/v1        /api/public/webhooks/*
        |                     Gateway                  /api/public/jobs/*
        \__________________________|_________________________/
                                   |
                       Domänenlogik (*.server.ts)
                                   |
                    Postgres (RLS, RPCs, Trigger) + Storage
```

### 1. Backoffice
Routen unter `src/routes/_authenticated/app/` (52 Dateien). Zugriff über den plattformverwalteten Auth-Gate `src/routes/_authenticated/route.tsx`. Datenzugriff ausschließlich über Server Functions (27 Module, 262 `createServerFn`-Deklarationen), niemals direkt gegen die Datenbank mit Admin-Rechten aus der Komponente.

### 2. Public Store API
Einziger Einstiegspunkt: `src/routes/api/public/store/v1/$.ts` → `handleStoreRequest`. Die Reihenfolge im Gateway ist verbindlich: Request-ID → Key-Auflösung (nur Kontext, nie Autorisierung) → Origin-Allowlist → Ressourcen-Nachweis (Cart-Token, Kunden-Session, Guest-Token) → Rate-Limit pro IP-Hash → Zod-Validierung und 64-KB-Limit → einheitliche Fehler, Security-Header, privacy-sichere Protokollierung.

35 Endpunkte in `src/lib/commerce/store/routes.server.ts`: Config, Katalog/Suche, Cart, Checkout, Payments, Bestellbestätigung, Gastzugang, Retouren, Kundenkonto und Kunden-Auth.

### 3. Storefront SDK
`src/lib/store-sdk` (Core, HTTP, Storage, Fehler, React-Provider und Hooks). Die Referenz-Storefront unter `src/routes/store/` und das Kundenportal unter `src/routes/portal/` nutzen ausschließlich das SDK. Verstöße gegen diese Grenze brechen ESLint und den Boundary-Test.

### 4. Domänenlogik
`src/lib/commerce/**/*.server.ts` — Katalog, Pricing, Inventory, Cart/Checkout, Payments, Orders, Tax, Shipping/Fulfillment/Tracking, Documents, Returns/Portal, Communications, Automations, Store-Gateway. Transaktionskritische Abläufe (Bestand, Bestellabschluss, Nummernkreise, Retouren, Rechnungen) liegen als `SECURITY DEFINER`-Funktionen in der Datenbank (99 Funktionen, 91 Trigger).

### 5. Hintergrundverarbeitung
- `/api/public/jobs/communications` und `/api/public/jobs/automation`, jeweils über ein geteiltes Secret geschützt.
- `automation_jobs` mit atomarem Claim über `SKIP LOCKED`, Backoff und Reclaim verwaister Jobs.
- `outbox_events` als Ereignisjournal.

## Vertrauensgrenzen

| Grenze | Wer darf | Durchsetzung |
| --- | --- | --- |
| Backoffice → Daten | angemeldeter Nutzer mit Rolle in der Organisation | Auth-Gate, `has_permission`, RLS |
| Storefront → Store API | jeder mit gültigem Publishable Key | Key-Auflösung, Origin-Allowlist, Rate-Limit |
| Store API → Ressource | Besitznachweis pro Ressource | Cart-Token, Kunden-Session, Guest-Token, zusätzlich Abgleich von `shop_id` und `organization_id` |
| Externe Provider → App | signierte Webhooks | Signaturprüfung in der jeweiligen Route bzw. im Adapter |
| Scheduler → Jobs | geteiltes Secret im Header | Vergleich in der Route, fail-closed ohne gesetztes Secret |
| App → externe URL | nur HTTPS, keine internen Netze | `assertSafeTarget` in `webhook.server.ts` (DNS-Auflösung je Versuch, keine Redirects) |

Der Admin-Client (`client.server.ts`) umgeht RLS und wird ausschließlich in `*.server.ts` und innerhalb von Handlern geladen.

## Datenhaltung mit besonderer Schutzwirkung

Unveränderlich oder nur anfügbar: `audit_log`, `inventory_movements`, `payment_events`, `tracking_events`, `tax_snapshots`, Cart- und Checkout-Snapshots, `communication_provider_events`.
Alle drei Storage-Buckets sind privat; Dokumente, Labels und Medien werden nur über serverseitig ausgestellte, kurzlebige Links ausgeliefert.

## Bekannte Architekturrisiken für den Produktivbetrieb

1. Die Job-Endpunkte benötigen extern gesetzte Secrets; ohne Secret sind sie geschlossen, damit läuft die Warteschlange aber gar nicht (siehe A8).
2. Es gibt derzeit keine getrennte Staging-Umgebung; Dev und Produktion teilen sich denselben Datenbestand (Bewertung in A2).
3. Monitoring- und Health-Oberflächen (`/app/system/health`, `/jobs`, `/status`, `/errors`) existieren noch nicht — geplant in A5 und A8.
