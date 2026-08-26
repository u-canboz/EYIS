# Architektur-Karte

## Vertrauenszonen

```text
┌───────────────────────────────────────────────────────────────────────────┐
│ UNVERTRAUT — Browser                                                      │
│  Referenz-Storefront /store · Kunden-Storefronts · Kundenportal /portal   │
│  Backoffice-UI /app                                                       │
│  Kennt: Publishable Key (kein Geheimnis), Supabase-Session (nur /app)     │
└──────────────┬──────────────────────────────┬─────────────────────────────┘
               │ Store SDK (HTTPS)            │ createServerFn (RPC)
               ▼                              ▼
┌───────────────────────────────┐ ┌───────────────────────────────────────┐
│ GATEWAY — Store API v1        │ │ SERVER FUNCTIONS (Backoffice)         │
│ src/routes/api/public/store/  │ │ *.functions.ts                        │
│   v1/$.ts → gateway.server.ts │ │ requireSupabaseAuth → RLS als Nutzer  │
│  · Key prüfen + Origin        │ │ Rollen/Permissions über memberships   │
│  · Rate-Limit je Profil       │ └──────────────┬────────────────────────┘
│  · Cart-/Customer-/Guest-Token│                │
│  · DTO-Allowlist (mappers)    │                │
│  · Request-Log (IP gehasht)   │                │
└──────────────┬────────────────┘                │
               ▼                                 ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ VERTRAUT — Commerce-Kern  src/lib/commerce/**                             │
│ Pricing · Tax · Cart · Checkout · Payments · Orders · Inventory ·         │
│ Documents · Fulfillment · Returns · Communications · Automation           │
└──────────────┬────────────────────────────────────────────────────────────┘
               ▼
┌───────────────────────────────────────────────────────────────────────────┐
│ DATEN — Postgres (RLS auf allen Fachtabellen) · Storage (3 private Buckets)│
└───────────────────────────────────────────────────────────────────────────┘
```

## Zwei Eingänge, keine Abkürzung

| | Backoffice | Storefront |
| --- | --- | --- |
| Transport | `createServerFn` | HTTPS auf `/api/public/store/v1` |
| Identität | Supabase-Session (Bearer) | Publishable Key + Origin |
| Autorisierung | RLS als angemeldeter Nutzer + Rollenprüfung | Shop-Bindung des Keys + Token je Ressource |
| Datenumfang | vollständige interne Felder | Allowlist-DTOs aus `mappers.server.ts` |
| Grenzverstoß | — | Storefront darf niemals Supabase oder `src/lib/commerce` importieren |

## Store-API-Anfrage, Schritt für Schritt

1. `src/routes/api/public/store/v1/$.ts` nimmt jede Methode/Pfad-Kombination entgegen.
2. `gateway.server.ts` orchestriert: Key auflösen (`keys.server.ts`), Origin gegen Allowlist prüfen,
   Rate-Limit nach Profil (`rate.server.ts`), Route in `routes.server.ts` finden, Handler ausführen.
3. Der Handler ruft ausschließlich Commerce-Kernfunktionen auf — keine Datenbankabfrage im Router
   ohne Shop-Filter.
4. Die Antwort geht durch `mappers.server.ts` (Allowlist) — interne Felder wie Einkaufspreise,
   Marge, Lieferantendaten, IDs fremder Mandanten verlassen das System nicht.
5. `privacy.server.ts` hasht IP-Adressen mit täglich rotierendem Salt für das Request-Log.
6. Fehler werden auf stabile Codes normalisiert (`UNAUTHORIZED`, `RATE_LIMITED`, …) mit Request-ID.

## Kernabläufe (fest im Code, nicht in Automationen)

```text
Cart          → Preis-Snapshot je Position, Server-Totals, Reservierung bei Checkout-Start
Checkout      → Adressen, Versandwahl, Steuerermittlung, Validierung, Session
Payment       → Session → Provider-Event → Transaktion → Order (idempotent)
Order         → Inventory-Commit, tax_snapshot, Rechnung, Kommunikation, Outbox-Event
Fulfillment   → Pakete → Label (Mock) → Sendung → Tracking-Ereignisse
Return        → Retoure → Wareneingang → Restock → Refund → Gutschrift
```

Automationen reagieren **nach** diesen Schritten auf Outbox-Ereignisse. Sie ersetzen keinen
Kernschritt.

## Serverseitige Grenzen (TanStack Start)

- `*.functions.ts` sind dünne Hüllen: nur Imports, Typen und `createServerFn`-Deklarationen.
- `*.server.ts` ist server-only und wird niemals aus Komponenten importiert.
- Secrets werden erst im `.handler()` gelesen, nie auf Modulebene.
- Der Admin-Client (`client.server`) wird in client-erreichbaren Dateien per `await import(...)`
  innerhalb des Handlers geladen.
- Alles unter `src/routes/api/public/*` ist ohne Anmeldung erreichbar und muss im Handler selbst
  authentifizieren: Publishable Key, Cron-Secret oder Provider-Signatur.

## Aktuelle Kennzahlen

Verbindlich in `commerce-os.manifest.json` (`counts`) und `docs/agent/routes.json`. Stand des
letzten Generierungslaufs: 19 Module, 77 Routen, 35 Store-API-Endpunkte, 45 Migrationen,
112 öffentliche Tabellen.
