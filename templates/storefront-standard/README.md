# EYIS Standard-Storefront (Vorlage)

Markenneutrale Standardvorlage für den Kundenbereich einer EYIS-Installation.
Sie liefert Startseite, Kategorie- und Produktseiten, Warenkorb, Bestellabschluss,
Konto- und Rechtstextseiten sowie die E-Mail-Vorlagen.

## Grenzen

- Die Vorlage ist **kundeneigen**. Sie wird bei einer Erstinstallation einmalig
  kopiert und bei Updates **nicht** überschrieben. Änderungen des Kunden bleiben
  erhalten.
- Sie spricht ausschließlich über das Store SDK und die Store API v1. Kein
  Zugriff auf `@supabase/supabase-js`, `@/integrations/supabase/*` oder
  `@/lib/commerce/*`.
- Preise, Steuern, Versandkosten und Bestände kommen ausschließlich vom Server.
- Die Vorlage beansprucht keine EYIS-Route. `/app`, `/api/public/store/v1` und
  die übrigen EYIS-Präfixe bleiben unberührt.

## Installation im Kundenprojekt

1. `src/**` dieser Vorlage nach `src/` des Kundenprojekts kopieren
   (Routen unter `src/routes/`, Komponenten unter `src/components/`).
2. `public/storefront/**` nach `public/storefront/` kopieren.
3. Den Inhalt von `src/styles.storefront.css` an `src/styles.css` **anhängen**.
   Niemals `:root` oder den Block `.eyis-admin` verändern.
4. Das Layout der Storefront rendert innerhalb `<div className="storefront">`;
   das EYIS-Backoffice bleibt davon getrennt.

## Anpassen

| Was | Wo |
| --- | --- |
| Shopname, Kontakt, Navigation, alle Texte | `src/content/shop.ts` |
| Vertrauenspunkte, FAQ, Bewertungen, Hinweisleiste | `src/content/conversion.ts` |
| Suchbegriff-Entsprechungen | `src/content/search-synonyme.ts` |
| Bilder | Dateien in `public/storefront/` ersetzen oder Pfade in `src/assets/assets.ts` ändern |
| Farben, Radien, Schriften | Tokens im Block `.storefront` in `src/styles.storefront.css` |
| Schriftarten laden | `<link>` im Root-Layout des Kundenprojekts, nie per `@import` |

## Bewusste Standardwerte

- **Keine Bewertungen.** `reviews` ist leer und `reviewSummary` ist `null`;
  die Vorlage zeigt niemals erfundene Kundenstimmen oder Durchschnittsnoten.
- **Keine Lieferzeit- oder Rabattversprechen.** Die Hinweisleiste ist leer,
  der Hinweis beim Verlassen der Seite ist abgeschaltet (`exitIntent.enabled`).
- **Rechtstexte sind Platzhalter.** Impressum, Datenschutz, AGB und
  Widerrufsbelehrung müssen vor dem Livegang durch eigene, geprüfte Texte
  ersetzt werden.
- **Kategorie-Handles sind Beispiele.** Sie müssen zu den Kategorien des
  eigenen Katalogs passen; Einträge ohne Treffer bleiben leer.
