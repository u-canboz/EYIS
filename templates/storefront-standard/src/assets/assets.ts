/**
 * Bildquellen der Standard-Storefront.
 *
 * Alle Dateien liegen als statische Dateien unter `public/storefront/` und sind
 * bewusst neutral (keine Marke, keine Beschriftung). Zum Anpassen genügt es,
 * die Dateien im Ordner `public/storefront/` durch eigene Bilder mit demselben
 * Dateinamen zu ersetzen — oder hier andere Pfade bzw. absolute URLs zu setzen.
 * Es werden keine projektgebundenen Asset-Pointer verwendet, damit die Vorlage
 * in jeder Installation unverändert funktioniert.
 */

const base = "/storefront";

export const assets = {
  /** Wortmarke im Kopfbereich. SVG, damit sie ohne Qualitätsverlust skaliert. */
  logo: `${base}/logo.svg`,

  /** Startseiten-Bühne: drei Motive, jeweils quer und hoch. */
  heroRitualDesktop: `${base}/hero-1-desktop.jpg`,
  heroRitualMobile: `${base}/hero-1-mobile.jpg`,
  heroOriginDesktop: `${base}/hero-2-desktop.jpg`,
  heroOriginMobile: `${base}/hero-2-mobile.jpg`,
  heroScentDesktop: `${base}/hero-3-desktop.jpg`,
  heroScentMobile: `${base}/hero-3-mobile.jpg`,

  /** Kategoriekacheln der Startseite. */
  categoryOne: `${base}/category-1.jpg`,
  categoryTwo: `${base}/category-2.jpg`,
  categoryThree: `${base}/category-3.jpg`,
  categoryFour: `${base}/category-4.jpg`,

  /** Redaktionelle Flächen (Sortiments- und Geschichtsabschnitt). */
  editorialPrimary: `${base}/editorial-1.jpg`,
  editorialSecondary: `${base}/editorial-2.jpg`,
} as const;

