/**
 * Zentrale Inhaltsdatei der Standard-Storefront.
 *
 * Hier — und nur hier — stehen Name, Kontaktdaten, Navigation und alle
 * redaktionellen Texte der Vorlage. Sie ist bewusst markenneutral: eine neue
 * Installation passt diese eine Datei an (und ersetzt bei Bedarf die Bilder in
 * `public/storefront/`), ohne Komponenten anfassen zu müssen.
 *
 * Preise, Steuern, Bestände, Versandkosten und Produktdaten kommen
 * ausschließlich aus dem Shopsystem und stehen niemals hier.
 *
 * Die Kategorie-Handles unten sind Beispiele. Trage die Handles ein, die im
 * eigenen Katalog wirklich existieren — Einträge ohne Treffer bleiben leer.
 */
import { assets } from "@/assets/assets";

export const shop = {
  name: "Mein Shop",
  claim: "Sorgfältig ausgewählt.",
  since: "",
  email: "kontakt@beispiel.de",
  street: "Musterstraße 1",
  city: "12345 Musterstadt",
  addressLine: "Musterstraße 1, 12345 Musterstadt",
} as const;

export const serviceBar = {
  left: "Versand innerhalb Deutschlands",
  right: "Fragen? Wir helfen dir",
} as const;

/** Hauptmenü. Handles müssen zu Kategorien im Katalog passen. */
export const mainNav = [
  { label: "Neuheiten", handle: "neuheiten" },
  { label: "Bestseller", handle: "bestseller" },
  { label: "Sortiment", handle: "sortiment" },
] as const;

export const moreNav = [{ label: "Alle Produkte", handle: "sortiment" }] as const;

/** Redaktionische Gruppierung für das Mega-Menü. */
export const megaMenuGroups = [
  {
    title: "Sortiment",
    description: "Das gesamte Angebot auf einen Blick.",
    items: [
      { label: "Neuheiten", handle: "neuheiten" },
      { label: "Bestseller", handle: "bestseller" },
      { label: "Alle Produkte", handle: "sortiment" },
    ],
  },
] as const;

export const heroSlides = [
  {
    tab: "Auswahl",
    eyebrow: "AUSGEWÄHLT FÜR DEINEN ALLTAG",
    title: "Besonderes beginnt im Kleinen.",
    text: "Eine ruhige Auswahl an Produkten, die im Alltag Bestand haben.",
    cta: { label: "Sortiment entdecken", handle: "sortiment" },
    secondary: { label: "Über uns", to: "/ueber-uns" },
    image: assets.heroRitualDesktop,
    mobileImage: assets.heroRitualMobile,
    imageAlt: "Schlichte Keramikgefäße und Leinen auf warmem Putz",
    marker: "01 / Auswahl",
  },
  {
    tab: "Handschrift",
    eyebrow: "MIT SORGFALT ZUSAMMENGESTELLT",
    title: "Qualität, die man in Ruhe erkennt.",
    text: "Jedes Produkt wird geprüft, bevor es in das Sortiment aufgenommen wird.",
    cta: { label: "Neuheiten ansehen", handle: "neuheiten" },
    secondary: { label: "Zum ganzen Sortiment", to: "/shop" },
    image: assets.heroOriginDesktop,
    mobileImage: assets.heroOriginMobile,
    imageAlt: "Werkstatttisch mit Vase, Holz und Papier im Tageslicht",
    marker: "02 / Sorgfalt",
  },
  {
    tab: "Atmosphäre",
    eyebrow: "FÜR MOMENTE MIT CHARAKTER",
    title: "Was bleibt, ist die Atmosphäre.",
    text: "Produkte, die sich nicht erklären müssen — sondern wirken.",
    cta: { label: "Bestseller entdecken", handle: "bestseller" },
    secondary: { label: "Ganzes Sortiment ansehen", to: "/shop" },
    image: assets.heroScentDesktop,
    mobileImage: assets.heroScentMobile,
    imageAlt: "Bernsteinfarbene Flasche und Korbgeflecht auf dunklem Stein",
    marker: "03 / Atmosphäre",
  },
] as const;

export const categoryEntries = [
  { label: "Neuheiten", handle: "neuheiten", image: assets.categoryOne },
  { label: "Bestseller", handle: "bestseller", image: assets.categoryTwo },
  { label: "Pflege", handle: "pflege", image: assets.categoryThree },
  { label: "Geschenke", handle: "geschenke", image: assets.categoryFour },
] as const;

/**
 * Handles der Startseiten-Bestseller. Leer lassen, bis eigene Produkte
 * angelegt sind — fehlende Handles werden übersprungen.
 */
export const bestsellerHandles: readonly string[] = [];

/** Redaktioneller Sortimentsblock der Startseite. */
export const dateWorld = {
  eyebrow: "SORTIMENT",
  title: "Nicht jedes Produkt passt zu jedem.",
  text: "Sieh dir die Unterschiede in Ruhe an und finde, was zu dir passt.",
  cta: "Sortiment entdecken",
  handle: "sortiment",
  image: assets.editorialPrimary,
} as const;

export const careAndScents = {
  title: "Zwei Wege ins Sortiment",
  care: {
    title: "Für den täglichen Gebrauch.",
    text: "Produkte, die sich im Alltag bewähren.",
    cta: "Pflege entdecken",
    handle: "pflege",
    image: assets.categoryThree,
  },
  scents: {
    title: "Für besondere Anlässe.",
    text: "Ausgewählte Stücke zum Verschenken und Behalten.",
    cta: "Geschenke entdecken",
    handle: "geschenke",
    image: assets.categoryFour,
  },
} as const;

export const story = {
  eyebrow: "ÜBER UNS",
  title: "Ein Shop mit klarer Handschrift.",
  text: "Wir wählen unser Sortiment sorgfältig aus und versenden jede Bestellung selbst.",
  cta: "Unsere Geschichte",
  image: assets.editorialSecondary,
} as const;

export const about = {
  intro: {
    title: `Über ${shop.name}`,
    text: `${shop.name} steht für eine überschaubare, sorgfältig gewählte Auswahl. Diesen Text ersetzt du durch deine eigene Geschichte.`,
  },
  origin: {
    title: "Wie alles begann",
    text: "Beschreibe hier kurz, wie der Shop entstanden ist und was ihn antreibt.",
  },
  selection: {
    title: "Produkte mit eigenem Charakter",
    text: "Erkläre, nach welchen Kriterien du dein Sortiment auswählst und erweiterst.",
  },
  openness: {
    title: "Für wen wir da sind",
    text: "Beschreibe, an wen sich dein Angebot richtet und was Kundinnen und Kunden erwarten dürfen.",
  },
  closing: {
    title: "Entdecke unser Sortiment",
    text: "Schau dich in Ruhe um und finde die Produkte, die zu deinem Alltag passen.",
    cta: "Zum Sortiment",
  },
  founderImage: assets.editorialPrimary,
} as const;

export const footerColumns = {
  assortment: [
    { label: "Neuheiten", handle: "neuheiten" },
    { label: "Bestseller", handle: "bestseller" },
    { label: "Alle Produkte", handle: "sortiment" },
  ],
} as const;

/** Vertrauensangaben. Nur belegbare Aussagen — keine Lieferzeit-Versprechen. */
export const trustPoints = [
  {
    icon: "package",
    title: "Selbst verpackt",
    text: "Wir verpacken und versenden jede Bestellung selbst.",
  },
  {
    icon: "shield",
    title: "Sichere Bezahlung",
    text: "Bezahlung über geprüfte Anbieter, verschlüsselt übertragen.",
  },
  {
    icon: "rotate",
    title: "14 Tage Widerrufsrecht",
    text: "Rückgabe innerhalb der gesetzlichen Frist, ohne Begründung.",
  },
  {
    icon: "mail",
    title: "Persönlicher Kontakt",
    text: "Fragen beantworten wir direkt per E-Mail.",
  },
] as const;

export const newsletter = {
  eyebrow: "NEWSLETTER",
  title: "Neues aus dem Sortiment",
  text: "Erfahre, wenn neue Produkte eintreffen. Zur Bestätigung schicken wir dir eine E-Mail.",
  placeholder: "deine@e-mail.de",
  cta: "Anmelden",
  hint: "Abmeldung jederzeit über den Link in jeder E-Mail möglich.",
  success: "Fast geschafft: Bitte bestätige die Anmeldung über den Link in deiner E-Mail.",
  error: "Das hat gerade nicht geklappt. Bitte versuche es in einem Moment erneut.",
} as const;
