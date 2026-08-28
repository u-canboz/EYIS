# Phase 22 — EYIS Rebranding (Marke, Assets, Farbe)

Grundlage: `EYIS_LOVABLE_BRAND_PACK` (Logo-Assets, Brand Asset Map, Logo-Prompt). Reiner Branding-/Presentation-Auftrag: Commerce Engines, Datenmodelle, Store API, Pricing, Tax, Inventory, Payments, Orders, RLS, Auth und Provider Vault bleiben unverändert.

## Ziel

Das Produkt heißt ab sofort **EYIS — Alles, was dein Shop braucht.** (Domain `eyis.de`). Alle bisherigen „Commerce OS"-Nennungen, das bisherige Orange und das alte Favicon werden ersetzt.

## 1. Assets ins Projekt

- Alle SVGs aus dem Pack nach `public/brand/eyis/` (`eyis-full-logo`, `-white`, `-monochrome`, `wordmark`, `wordmark-white`, `wordmark-with-claim`, `mark`, `mark-white`, `app-icon`, `favicon`).
- PNG-Ableitungen nach `public/brand/eyis/png/` (Favicon 16/32/48, App-Icon 180/192/512/1024).
- `public/favicon.ico` durch das EYIS-Favicon ersetzen; SVG-Favicon als primäre Referenz.
- Neue `public/site.webmanifest` mit `theme_color: #ED4800`, `background_color: #F8F7F5`, Icons 192/512.
- `src/routes/__root.tsx`: Icon-Links (SVG + PNG-Fallback), Apple-Touch-Icon, Manifest-Link, `theme-color`.

## 2. Markenfarbe

In `src/styles.css` wird der Primärton exakt auf `#ED4800` gesetzt (Token-Namen bleiben: `--primary`, Sidebar-Akzente, Ring, Chart-Primär). Abgeleitete Zustände (Hover, Pressed, Soft, Border) über `color-mix()` statt neuer Hardcodes. Semantische Farben (Erfolg/Fehler/Info) bleiben unverändert. Hintergrund `#F8F7F5`, Surface `#FFFFFF`, Text `#171717`, Muted `#6E6B68`, Border `#E8E4E0` bleiben wie in Phase 20.

## 3. Logo-Komponente

Neue `src/components/brand/EyisLogo.tsx` mit Varianten `full | wordmark | wordmark-claim | mark | app-icon` und `tone: default | white`, proportionale Skalierung, `alt="EYIS"` bzw. `aria-hidden` bei dekorativer Nutzung. Keine Filter, Schatten oder Recoloring.

Einsatz nach Asset Map:
- Desktop-Sidebar expanded: Wordmark 96–112 px.
- Sidebar collapsed / Tablet-Rail: Mark 28–32 px.
- Mobile Topbar: weiterhin Seitentitel, kein Logo.
- Mobile Drawer: Mark 34–38 px + Wordmark 80–96 px.
- Auth (`/auth`), Invite, `/app/setup` (Owner-Claim), Setup-Wizard: Full Logo 220–280 px, auf schmalen Screens App-Icon + Wordmark.
- Landingpage/Entwicklerseite: Header Wordmark, Footer Full Logo bzw. Wordmark-with-Claim.
- Portal: Wordmark, wo EYIS als Plattform sichtbar ist. Kundenshops/White-Label behalten ihr eigenes Branding — EYIS wird dort nicht erzwungen.

## 4. Namensumstellung (vollständig)

- `src/lib/site-meta.ts`: `name: "EYIS"`, Claim, `repoUrl: "https://github.com/u-canboz/EYIS"`, Domain `eyis.de`.
- Alle Route-`head()`-Titel und -Beschreibungen: „… – Commerce OS" → „… – EYIS" (Backoffice, Portal, Store, Landing, Entwickler, Auth, Invite, Systemseiten).
- Sichtbare UI-Texte, Leerzustände, Fehler-/Loading-Screens, Demo-/QA-Seiten.
- Presentation-nahe Defaults mit Markennamen: E-Mail-Templates, PDF-/Dokument-Branding-Default, Webhook-User-Agent-artige Anzeigenamen — nur Anzeigetexte, keine Contract-Felder oder API-Keys.
- Doku: `README.md`, `AGENTS.md`, `docs/**`, Bereichs-`AGENTS.md`, `docs/agent/*.json`-Beschreibungen über `bun run generate:manifests`. Historische QA-Berichte unter `qa/` und archivierte Pläne bleiben unverändert (Historie).
- Projektweite Suche nach `Commerce OS`, `CommerceOS`, `#DE773B`/`#de773b` und altem Favicon; ersetzt wird nur echtes Branding.

Technische Bezeichner (Env-Namen wie `COMMERCE_BOOTSTRAP_SECRET`, Tabellen wie `commerce_installation`, Pfade `src/lib/commerce/**`, Skriptnamen `commerce:bootstrap`) bleiben unverändert — Umbenennen wäre eine Struktur-/Vertragsänderung, keine Brandingsache.

## 5. Abnahme

- Visueller Durchlauf per Playwright bei 320, 375, 390, 430, 768, 834, 1024, 1280, 1440 px über: Sidebar expanded/collapsed, Tablet-Rail, Mobile Drawer, Login, Owner-Claim, Setup-Wizard, Dashboard, Systemseiten, Portal, Storefront, Entwicklerseite. Geprüft: keine Verzerrung, kein Abschneiden, kein unleserlicher Claim, ausreichend Freiraum.
- Favicon, Apple-Touch-Icon und Manifest im Browser prüfen.
- Bericht als `qa/PHASE22-EYIS-BRANDING-REPORT.md` mit Status PASS · FAIL · OFFEN · BLOCKED: gefundene Alt-Branding-Stellen, ersetzte Stellen, Asset-Zuordnung, umgestellte Tokens, Favicon-/PWA-Status, White-Label-Verhalten.
- Abschluss erst nach `bun run generate:manifests` und grünem `bun run verify` (docs:validate → typecheck → test → build).

## Technische Hinweise

- Betroffen: `public/**`, `src/styles.css`, `src/routes/__root.tsx`, `src/lib/site-meta.ts`, `src/components/shell/**`, neue `src/components/brand/**`, Route-`head()`-Blöcke, Doku.
- Nicht angefasst: `src/lib/commerce/**` Serverlogik, `*.server.ts`/`*.functions.ts` außer reinen Anzeigetexten, `src/routes/api/**`, Migrationen, `src/integrations/supabase/**`.
- Die Phase-20-Dichte und das kompakte App-Layout bleiben erhalten; das Rebranding vergrößert keine Flächen.
