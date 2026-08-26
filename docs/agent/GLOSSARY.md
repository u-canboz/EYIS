# Glossar

| Begriff | Bedeutung im Commerce OS |
| --- | --- |
| **Organisation** | Mandantenwurzel. Ein Kunde/Händler. Trägt `organization_id` auf allen Fachdaten. |
| **Shop** | Verkaufskanal einer Organisation. Trägt `shop_id`. Währung, Steuern, Versand und Keys hängen am Shop. |
| **Membership** | Verbindung Nutzer ↔ Organisation samt Rolle. Einzige Quelle für Rollen. |
| **Publishable Key** | Öffentlicher, shopgebundener Schlüssel für die Store API. Kein Geheimnis, aber origin-beschränkt, ratenbegrenzt und widerrufbar. |
| **Service-Role-Key** | Serverseitiger Schlüssel, der RLS umgeht. Nie im Client, nie in Logs, nie in Doku. |
| **Store API v1** | Einzige öffentliche Schnittstelle für Storefronts unter `/api/public/store/v1`. |
| **Store SDK** | Client-Bibliothek für die Store API (`src/lib/store-sdk`). Aktuell repository-source, kein npm-Paket. |
| **Storefront** | Externes Frontend eines Shops. Spricht ausschließlich über das SDK. |
| **Backoffice** | Händleroberfläche unter `/app`, geschützt durch Supabase-Session. |
| **Kundenportal** | Kundenbereich unter `/portal` (Konto, Bestellungen, Retouren). |
| **DTO-Allowlist** | Positivliste öffentlich sichtbarer Felder in `mappers.server.ts`. Ohne Eintrag bleibt ein Feld intern. |
| **Cart-Token** | Zugriffsnachweis für genau einen Warenkorb. |
| **Gast-Token** | Zeitlich begrenzter Zugriff auf eine Bestellung ohne Kundenkonto. |
| **Snapshot** | Kopie von Preis, Steuer oder Adresse zum Zeitpunkt des Vorgangs. Macht Belege reproduzierbar. |
| **Tax Snapshot** | Unveränderliche Steuerberechnung einer Bestellung (`tax_snapshots`, Trigger-geschützt). |
| **Minor Units** | Beträge in kleinster Währungseinheit (Cent) plus Währungscode. |
| **Outbox** | Ereignistabelle. Quelle für Automationen, Kommunikation und ausgehende Webhooks. |
| **Automation** | Händlerkonfigurierte Regel auf Outbox-Ereignissen. Ersetzt niemals einen Kernprozess. |
| **Kernprozess** | Fest im Code verdrahteter Ablauf (Payment → Order, Order → Inventory-Commit, Belegerzeugung). |
| **Fulfillment** | Kommissionierung und Versandabwicklung einer Bestellung. |
| **Restock** | Rückbuchung retournierter Ware in den Bestand über eine Inventory-Bewegung. |
| **Idempotenz** | Wiederholte Ausführung führt zu keinem zusätzlichen Effekt (Zahlungen, Jobs, Webhooks, Seeds). |
| **Production Guard** | Harte Sperre in `src/lib/commerce/demo/guard.server.ts`: keine Seeds/Fixtures bei `APP_ENV=production`. |
| **QA-Harness** | Skript unter `qa/*.ts`, das einen Bereich end-to-end gegen eine Dev-Datenbank prüft. |
| **Manifest** | Generierte JSON-Datei mit `generated_at`, `source_commit`, `latest_migration`, `generator_version`. |
| **Betriebsart A/B/C** | Neuer Kunde / neue Storefront / Dedicated Deployment. Siehe `docs/agent/OPERATING_MODES.md`. |
| **BLOCKED** | Nicht umsetzbar, weil eine externe Voraussetzung fehlt (z. B. Provider-Zugangsdaten). |
