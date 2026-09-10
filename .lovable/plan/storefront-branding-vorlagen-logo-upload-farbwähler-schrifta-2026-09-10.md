# Storefront-Branding: Vorlagen, Logo-Upload, Farbwähler, Schriftauswahl

Die Seite unter Marketing → Storefront-Branding wird von einer reinen Formularseite zu einem
Gestaltungsbereich, in dem man in wenigen Klicks ein fertiges Aussehen wählt und danach
Feinheiten anpasst. Es bleibt bei einem Datensatz je Shop; die Storefront liest weiterhin
dieselben Werte.

## Neuer Aufbau der Seite

1. **Vorlagen wählen** (neu, ganz oben)
   Sechs fertige Kombinationen aus Farben und Schriften, je als kleine Vorschaukachel
   (Farbstreifen, Überschrift- und Textbeispiel, Beispiel-Schaltfläche). Ein Klick setzt alle
   Farben und beide Schriften; Name, Claim und Logo bleiben unberührt. Danach ist alles
   weiterhin einzeln änderbar. Die Vorlagen:
   - Sand & Kupfer (warm, hell)
   - Leinen & Salbei (natürlich, ruhig)
   - Papier & Tinte (streng schwarz-weiß)
   - Nacht & Messing (dunkel, edel)
   - Frost & Marine (kühl, klar)
   - Creme & Terracotta (weich, mediterran)

2. **Name und Logo**
   Zusätzlich zum Adressfeld ein echter Upload für Logo und Tab-Symbol: Datei auswählen oder
   in die Fläche ziehen, sie landet in der bestehenden Medienablage des Shops und die Adresse
   wird automatisch eingetragen. Vorschau auf hellem und dunklem Grund, dazu „Entfernen".
   Erlaubt: SVG, PNG, JPG, WEBP bis 2 MB (Symbol zusätzlich ICO).

3. **Farben**
   Jedes Feld bekommt ein anklickbares Farbfeld (nativer Farbwähler) neben dem Hex-Eingabefeld;
   beide Richtungen sind synchron. Ergänzend eine Live-Vorschaukarte (Kopfzeile, Fließtext,
   Schaltfläche, Fläche, Linie), die sofort zeigt, wie die Kombination wirkt, plus ein Hinweis,
   wenn Text auf Hintergrund oder auf Akzent zu wenig Kontrast hat.

4. **Schriften**
   Statt freier Texteingabe eine Auswahlliste hinterlegter Schriftpaare mit Beispielzeile
   (u. a. Space Grotesk / DM Sans, Fraunces / Inter, Playfair Display / Source Sans 3,
   Instrument Serif / Work Sans, Bricolage Grotesque / Inter, System-Standard). Ein Punkt
   „Eigene Schrift" behält die bisherige Freitexteingabe für Sonderfälle.

5. **Speichern**
   Unveränderte Logik: nur mit dem Recht „Einstellungen verwalten", Hinweis bei ungültigen
   Farbwerten, Erfolgsmeldung.

## Technische Umsetzung

- Keine Datenbankänderung. Vorlagen und Schriftpaare sind Konstanten im Frontend und setzen
  nur die vorhandenen 13 Felder von `storefront_branding`.
- Neue Datei `src/eyis/brand/storefront-presets.ts`: Typen und Daten für Vorlagen
  (7 Farbwerte + Schriftpaar) und Schriftpaare (Anzeigename, `font_display`, `font_body`,
  optionale Google-Fonts-Familie für den `<link>` der Storefront).
- Upload nutzt den bestehenden Weg der Medienbibliothek: Browser-Upload in den Bucket `media`,
  danach `registerMedia` (Server Function, geprüfte Organisation), Adresse über
  `getPublicUrl` — identisch zu den Produktbildern im Feed, also dauerhaft erreichbar.
- Neue kleine Komponenten in `src/eyis/brand/`: `PresetPicker`, `LogoUploadField`,
  `ColorField`, `BrandingPreview`. Die Route `src/routes/_authenticated/app/marketing/branding.tsx`
  setzt sie zusammen; Farbtokens bleiben semantisch, nur die Vorschauflächen nutzen die
  eingegebenen Werte per Inline-Style.
- Kontrastprüfung als reine Hilfsfunktion (WCAG-Verhältnis), blockiert das Speichern nicht.
- Die Standardvorlage unter `templates/storefront-standard/` liest Branding weiterhin über
  `/content/branding`; die Vorlagen wirken damit ohne Codeänderung im Kundenprojekt.
- Abschluss: `bun run generate:manifests` und `bun run verify`. Da nur Präsentationscode
  hinzukommt, ist keine Neusignatur des Install Packs nötig, außer die Manifestprüfung
  verlangt es — dann Pack regenerieren und signieren.
