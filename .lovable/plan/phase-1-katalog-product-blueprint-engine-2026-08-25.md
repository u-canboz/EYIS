# Phase 1 — Katalog & Product-Blueprint-Engine

Aufbauend auf Phase 0 (Organisationen, Shops, Rollen, `has_permission`, RLS, Audit-Log, Outbox, Server-Function-SDK). Phase 0 bleibt unverändert bestehen und wird nur erweitert. Keine Preise, Bestände, Bestellungen, Checkout oder Storefront.

## Grundidee

Der Händler startet mit „Was möchten Sie verkaufen?“. Die Auswahl (Standardprodukt, Textilien, Lebensmittel, Kosmetik, Elektronik, Möbel, Schmuck, Digitales Produkt, Dienstleistung) lädt einen datengetriebenen Blueprint, aus dem Felder, Gruppen, Variantenachsen und Editor-Oberfläche automatisch entstehen. Es gibt genau einen generischen Renderer, keine branchenspezifischen React-Formulare.

## 1. Datenmodell (Migrationen)

Neue Tabellen, jeweils mit `organization_id`, Zeitstempeln, GRANTs, RLS und Indizes:

- `product_blueprints` — System- und Eigen-Blueprints, versioniert, mit `schema`, `ui_schema`, `variant_schema` (JSONB)
- `products` — Blueprint-Referenz + `blueprint_version` + `blueprint_data`, Status draft/active/archived, eindeutiger Handle je Shop
- `product_options`, `product_option_values` — Optionsachsen und Werte
- `product_variants` — ohne Preis/Bestand; SKU eindeutig je Organisation (partieller Unique-Index, nur wenn gesetzt)
- `variant_option_values` — Kombination je Produkt genau einmal (Unique über Variante + Option, plus Kombinations-Hash je Produkt)
- `categories` — hierarchisch über `parent_id`, Handle eindeutig je Shop
- `product_categories`, `collections`, `product_collections`
- `media_assets` — Verweise auf Cloud-Storage-Pfade, nie Base64
- `product_media` — Zuordnung zu Produkt und optional Variante, mit Position und Rolle

Zusätzlich: Storage-Bucket für Medien (privat, Zugriff über organisationsgebundene Pfade), Trigger `set_updated_at` auf allen neuen Tabellen, Archivierung statt Löschen bei veröffentlichten Produkten.

Indizes auf `organization_id`, `shop_id`, `product_id`, `status`, `handle`, `sku`, Kategorie-/Collection-Zuordnungen und `updated_at`.

## 2. Berechtigungen und RLS (Phase-0-Mechanik weiterverwenden)

Neue Permissions in `role_permissions`: `products.read/create/update/archive`, `categories.read/manage`, `collections.read/manage`, `media.read/upload/manage`, `blueprints.read/manage_custom`. Zuordnung u. a.: owner/administrator alles; `catalog_manager` volle Katalogrechte, aber weiterhin kein `settings.manage`; `read_only` nur Leserechte.

RLS-Policies nutzen unverändert die vorhandenen SECURITY-DEFINER-Funktionen:

- Lesen: `is_org_member(auth.uid(), organization_id)`
- Schreiben: `has_permission(auth.uid(), organization_id, '<permission>')`
- Kindtabellen ohne eigene `organization_id` (Optionswerte, Variant-Option-Zuordnung, Produkt-Kategorie/-Collection/-Media) prüfen über EXISTS auf die Elterntabelle
- `product_blueprints`: Lesen erlaubt für System-Blueprints (`is_system = true`) plus eigene Organisation; Schreiben nur für eigene, nicht-System-Blueprints
- Shop-Zugehörigkeit wird per Constraint/Trigger gegen die Organisation geprüft

## 3. Blueprint-Engine und Versionierung

Jedes Produkt speichert `blueprint_id`, `blueprint_version` und `blueprint_data`. Eine neue Blueprint-Version legt einen neuen Datensatz mit erhöhter Version an; bestehende Produkte bleiben auf ihrer Version und werden erst durch eine spätere bewusste Migration übernommen. Der Editor rendert immer die Version, mit der das Produkt gespeichert wurde, und weist auf verfügbare neuere Versionen hin.

System-Blueprints werden per Migration eingespielt mit den in der Anforderung genannten Feldern je Branche (Textil mit Größen-Presets XXS–3XL und Farbachse, Lebensmittel mit Zutaten/Allergenen/Nährwerten, Kosmetik mit INCI, Elektronik mit dynamischer Spezifikationsgruppe, Möbel, Schmuck mit typabhängiger Sichtbarkeit, Digital, Dienstleistung).

## 4. Blueprint-Renderer

Ein Renderer für die Feldtypen text, textarea, richtext, number, boolean, select, multiselect, tags, color, measurement, key_value, repeater, media, option_axis. Blueprint-Feld definiert Label, Beschreibung, Pflicht, Default, Validierung, Einheit, Gruppe, Sichtbarkeitsbedingung und Reihenfolge. Validierung serverseitig gespiegelt, damit `blueprint_data` nie ungeprüft gespeichert wird.

## 5. SDK-Erweiterung

`src/lib/commerce/` wächst um `blueprints`, `products`, `variants`, `categories`, `collections`, `media` — jeweils `*.functions.ts` (Server Functions mit `requireSupabaseAuth`) plus `*.server.ts` für Logik. Alle Mutationen laufen über `assertPermission`, schreiben Audit (`product.created`, `product.updated`, `product.archived`, `product.duplicated`, `variant.*`, `category.*`, `collection.*`, `media.*`, `blueprint.custom_*`) und Outbox-Events (`catalog.product.*`, `catalog.variant.*`, `catalog.media.attached`). Keine direkten Commerce-Datenbankzugriffe aus der UI.

## 6. Oberfläche

- `/produkte` — Listenansicht (Bild, Produkt, Status, Blueprint, Varianten, Kategorien, geändert am) mit Suche, Filtern, Sortierung, Pagination, Mehrfachauswahl, Archivieren, Duplizieren; eine aggregierte Abfrage statt N+1
- `/produkte/neu` — Wizard in 7 Schritten: Was verkaufen Sie? → Grunddaten → produktspezifisch → Varianten → Bilder → Organisation → SEO/Vorschau, am Ende Entwurf speichern
- `/produkte/$id` — Editor mit Tabs Übersicht, Varianten, Medien, Organisation, Produktdaten, SEO; fixierter Kopf mit Name, Status, Vorschau/Speichern, sichtbarem „nicht gespeichert“-Zustand und Warnung beim Verlassen
- `/katalog/kategorien` — Baum mit Unterkategorien und Positionssteuerung
- `/katalog/collections` — kuratierte Gruppen, klar getrennt von Kategorien
- `/medien` — Bibliothek mit Mehrfachupload, Alt-Text, Titel, Dateiinfos, Verwendungsnachweis, Löschen nur wenn ungenutzt

Der Variantengenerator zeigt vor dem Erzeugen die Anzahl („12 Varianten werden erstellt“), erzeugt keine Duplikate bestehender Kombinationen und warnt vor dem Entfernen eines Optionswerts mit Liste der betroffenen Varianten.

UX: progressive Offenlegung, Presets, kurze Erklärungen, keine JSON-Eingaben, keine Datenbankbegriffe, mobiltauglich.

## 7. Abnahme

Vor Abschluss werden im Browser durchgespielt: Hoodie mit 2 Farben × 4 Größen = 8 Varianten (speichern, neu öffnen, vollständig rekonstruiert); Lebensmittelprodukt mit Inhalt, Einheit, Zutaten, Allergenen, Nährwerten, Herkunft, Aufbewahrung; Standardprodukt ohne Varianten; Mandantentest A/B über UI und direkte Datenabfrage; Rollenprüfung `catalog_manager` und `read_only`; doppelte Variantenkombination verhindert; Warnung beim Entfernen einer genutzten Größe; Audit-Einträge für Erstellen und Ändern. Zusätzlich Typprüfung und Kontrolle, dass Phase-0-Funktionen unverändert laufen.

## Hinweise

- Konzeptdateien liegen nicht im Repository (`docs/concept/` existiert hier nicht); Grundlage ist daher diese Spezifikation plus der vorhandene Phase-0-Code.
- Umsetzung in Etappen: (1) Migrationen inkl. RLS, Permissions und System-Blueprints, (2) SDK, (3) Renderer und Wizard, (4) Editor, Liste, Kategorien, Collections, Medien, (5) Abnahmetests.
