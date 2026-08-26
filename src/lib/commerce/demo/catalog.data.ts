/* Statische Demo-Katalogdaten: 32 Produkte über alle Blueprints,
   Kategorien, Kollektionen, Kunden, Promotions und Bestellvorlagen.
   Rein deklarativ — keine Laufzeitlogik, damit der Seed reproduzierbar bleibt. */

export type DemoProductDef = {
  key: string; // stabiler demo_key
  name: string;
  subtitle: string;
  description: string;
  blueprintKey: string;
  blueprintData: Record<string, unknown>;
  vendor: string;
  productType: string;
  priceMinor: number;
  salePriceMinor?: number;
  sku: string;
  stock: number;
  image?: string; // Dateiname in public/demo-assets
  category: string;
  collections?: string[];
  featured?: boolean;
};

export const DEMO_CATEGORIES = [
  { key: "bekleidung", name: "Bekleidung" },
  { key: "lebensmittel", name: "Lebensmittel" },
  { key: "elektronik", name: "Elektronik" },
  { key: "kosmetik", name: "Kosmetik" },
  { key: "moebel", name: "Möbel" },
  { key: "schmuck", name: "Schmuck" },
] as const;

export const DEMO_COLLECTIONS = [
  { key: "neuheiten", name: "Neuheiten", description: "Frisch eingetroffen im Demo Shop." },
  { key: "bestseller", name: "Bestseller", description: "Die beliebtesten Produkte." },
  { key: "sale", name: "Sale", description: "Reduzierte Artikel." },
] as const;

const textil = (
  marke: string,
  material: string,
  passform: string,
  extra: Record<string, unknown> = {},
) => ({
  marke,
  material,
  materialzusammensetzung: [{ key: material, value: "100 %" }],
  passform,
  zielgruppe: "Unisex",
  saison: "Ganzjährig",
  pflegehinweise: ["30 Grad Wäsche", "Nicht bleichen", "Nicht im Trockner trocknen"],
  herkunft: "Portugal",
  groessentabelle: [
    { key: "S", value: "Brust 96 cm" },
    { key: "M", value: "Brust 102 cm" },
    { key: "L", value: "Brust 108 cm" },
  ],
  ...extra,
});

const lebensmittel = (
  inhalt: number,
  einheit: string,
  grundpreis: string,
  zutaten: string,
  extra: Record<string, unknown> = {},
) => ({
  inhalt,
  einheit,
  grundpreiseinheit: grundpreis,
  zutaten,
  allergene: [],
  naehrwerte: [
    { key: "Energie", value: "350 kcal" },
    { key: "Fett", value: "12 g" },
    { key: "Kohlenhydrate", value: "40 g" },
  ],
  herkunft: "Deutschland",
  hersteller: "Demo Manufaktur GmbH",
  aufbewahrung: "Kühl und trocken lagern.",
  mhd_relevant: true,
  pfand_relevant: false,
  hinweise: "",
  ...extra,
});

const elektronik = (hersteller: string, modell: string, extra: Record<string, unknown> = {}) => ({
  hersteller,
  modell,
  ean: "4260123456789",
  leistung: 20,
  gewicht: 540,
  abmessungen: [
    { key: "Breite", value: "10 cm" },
    { key: "Höhe", value: "10 cm" },
    { key: "Tiefe", value: "10 cm" },
  ],
  spezifikationen: [
    { key: "Bluetooth", value: "5.3" },
    { key: "Akkulaufzeit", value: "12 h" },
  ],
  lieferumfang: ["Gerät", "USB-C-Kabel", "Anleitung"],
  garantie: "24 Monate Herstellergarantie.",
  ...extra,
});

const kosmetik = (inhalt: number, einheit: string, extra: Record<string, unknown> = {}) => ({
  inhalt,
  einheit,
  grundpreiseinheit: einheit === "ml" ? "100 ml" : "100 g",
  inci: "Aqua, Glycerin, Butyrospermum Parkii Butter, Tocopherol",
  hauttyp: ["Normal", "Trocken"],
  anwendung: "Morgens und abends auf die gereinigte Haut auftragen.",
  warnhinweise: "Nur zur äußerlichen Anwendung.",
  duft: "Dezent",
  hersteller: "Demo Kosmetik GmbH",
  herkunft: "Deutschland",
  ...extra,
});

const moebel = (material: string, extra: Record<string, unknown> = {}) => ({
  breite: 45,
  hoehe: 82,
  tiefe: 50,
  gewicht: 6,
  material,
  stil: "Skandinavisch",
  montage: false,
  lieferumfang: ["Stuhl", "Aufbauanleitung"],
  pflegehinweise: "Mit einem feuchten Tuch abwischen.",
  ...extra,
});

const schmuck = (typ: string, material: string, extra: Record<string, unknown> = {}) => ({
  schmucktyp: typ,
  material,
  legierung: "925 Sterling Silber",
  stein: "Zirkonia",
  gewicht: 4,
  laenge: 45,
  pflegehinweise: "Vor dem Duschen und Sport ablegen.",
  ...extra,
});

export const DEMO_PRODUCTS: DemoProductDef[] = [
  // ---------------- Textil (8) ----------------
  {
    key: "hoodie-kaenguru", name: "Hoodie „Känguru“", subtitle: "Klassischer Kapuzenpullover",
    description: "Weicher Hoodie aus Bio-Baumwolle mit Kängurutasche und doppelt gefütterter Kapuze.",
    blueprintKey: "textil", blueprintData: textil("Demo Wear", "Baumwolle", "Regular"),
    vendor: "Demo Wear", productType: "Oberbekleidung", priceMinor: 5990, sku: "DEMO-TEX-001",
    stock: 48, image: "hoodie.jpg", category: "bekleidung", collections: ["bestseller"], featured: true,
  },
  {
    key: "tshirt-essential", name: "T-Shirt „Essential“", subtitle: "Das Basic für jeden Tag",
    description: "Schweres T-Shirt aus gekämmter Baumwolle, vorgeschrumpft und formstabil.",
    blueprintKey: "textil", blueprintData: textil("Demo Wear", "Baumwolle", "Regular"),
    vendor: "Demo Wear", productType: "Oberbekleidung", priceMinor: 2490, sku: "DEMO-TEX-002",
    stock: 120, image: "tshirt.jpg", category: "bekleidung", collections: ["bestseller"], featured: true,
  },
  {
    key: "jogginghose-comfort", name: "Jogginghose „Comfort“", subtitle: "Entspannt unterwegs",
    description: "Bequeme Sweatpants mit elastischem Bund und zwei Seitentaschen.",
    blueprintKey: "textil", blueprintData: textil("Demo Wear", "Baumwolle", "Loose"),
    vendor: "Demo Wear", productType: "Hosen", priceMinor: 4490, sku: "DEMO-TEX-003",
    stock: 36, image: "sweatpants.jpg", category: "bekleidung",
  },
  {
    key: "jacke-allwetter", name: "Jacke „Allwetter“", subtitle: "Schutz bei jedem Wetter",
    description: "Wasserabweisende Übergangsjacke mit versiegelten Nähten und verstaubarer Kapuze.",
    blueprintKey: "textil", blueprintData: textil("Demo Wear", "Polyester", "Regular", { saison: "Herbst/Winter" }),
    vendor: "Demo Wear", productType: "Jacken", priceMinor: 12990, salePriceMinor: 9990, sku: "DEMO-TEX-004",
    stock: 14, image: "jacket.jpg", category: "bekleidung", collections: ["sale", "neuheiten"], featured: true,
  },
  {
    key: "tshirt-heavyweight", name: "T-Shirt „Heavyweight“", subtitle: "240 g/m² schwere Qualität",
    description: "Extra schweres T-Shirt mit weitem Schnitt und verstärktem Kragen.",
    blueprintKey: "textil", blueprintData: textil("Demo Wear", "Baumwolle", "Oversized"),
    vendor: "Demo Wear", productType: "Oberbekleidung", priceMinor: 2990, sku: "DEMO-TEX-005",
    stock: 80, image: "tshirt.jpg", category: "bekleidung", collections: ["neuheiten"],
  },
  {
    key: "hoodie-zip", name: "Hoodie „Zip“", subtitle: "Mit durchgehendem Reißverschluss",
    description: "Kapuzenjacke mit Metallzipper, angerauter Innenseite und Kordelzug.",
    blueprintKey: "textil", blueprintData: textil("Demo Wear", "Baumwolle", "Regular"),
    vendor: "Demo Wear", productType: "Oberbekleidung", priceMinor: 6990, sku: "DEMO-TEX-006",
    stock: 22, image: "hoodie.jpg", category: "bekleidung",
  },
  {
    key: "sweatpants-slim", name: "Sweatpants „Slim“", subtitle: "Schmal geschnitten",
    description: "Schmale Jogginghose mit Bündchen am Beinabschluss und verdeckter Reißverschlusstasche.",
    blueprintKey: "textil", blueprintData: textil("Demo Wear", "Baumwolle", "Slim"),
    vendor: "Demo Wear", productType: "Hosen", priceMinor: 3990, salePriceMinor: 2990, sku: "DEMO-TEX-007",
    stock: 3, image: "sweatpants.jpg", category: "bekleidung", collections: ["sale"],
  },
  {
    key: "jacke-wind", name: "Übergangsjacke „Wind“", subtitle: "Leicht und winddicht",
    description: "Ultraleichte Windjacke, im eigenen Brustbeutel verstaubar.",
    blueprintKey: "textil", blueprintData: textil("Demo Wear", "Polyamid", "Regular", { saison: "Frühjahr/Sommer" }),
    vendor: "Demo Wear", productType: "Jacken", priceMinor: 9990, sku: "DEMO-TEX-008",
    stock: 0, image: "jacket.jpg", category: "bekleidung",
  },
  // ---------------- Lebensmittel (6) ----------------
  {
    key: "olivenoel-kreta", name: "Olivenöl „Kreta PDO“ 500 ml", subtitle: "Nativ extra, kalt extrahiert",
    description: "Fruchtiges Olivenöl aus Koroneiki-Oliven, geschützte Ursprungsbezeichnung.",
    blueprintKey: "lebensmittel",
    blueprintData: lebensmittel(500, "ml", "1 l", "100 % natives Olivenöl extra", { herkunft: "Griechenland (Kreta)" }),
    vendor: "Demo Manufaktur", productType: "Öle", priceMinor: 1490, sku: "DEMO-LEB-001",
    stock: 64, image: "oliveoil.jpg", category: "lebensmittel", collections: ["bestseller"], featured: true,
  },
  {
    key: "gewuerz-orient", name: "Gewürzmischung „Orient“ 80 g", subtitle: "Für Couscous & Tajine",
    description: "Handgemischte Gewürzmischung mit Kreuzkümmel, Koriander und Zimt.",
    blueprintKey: "lebensmittel",
    blueprintData: lebensmittel(80, "g", "100 g", "Kreuzkümmel, Koriander, Paprika, Zimt, Kurkuma"),
    vendor: "Demo Manufaktur", productType: "Gewürze", priceMinor: 690, sku: "DEMO-LEB-002",
    stock: 90, image: "spice.jpg", category: "lebensmittel",
  },
  {
    key: "olivenoel-bio", name: "Bio-Olivenöl 750 ml", subtitle: "Aus kontrolliert biologischem Anbau",
    description: "Mildes Bio-Olivenöl, ideal für Salate und zum Finishen.",
    blueprintKey: "lebensmittel",
    blueprintData: lebensmittel(750, "ml", "1 l", "100 % Bio-Olivenöl nativ extra", { herkunft: "Spanien (Andalusien)" }),
    vendor: "Demo Manufaktur", productType: "Öle", priceMinor: 1990, sku: "DEMO-LEB-003",
    stock: 41, image: "oliveoil.jpg", category: "lebensmittel", collections: ["neuheiten"],
  },
  {
    key: "gewuerz-paprika", name: "Geräuchertes Paprikapulver 60 g", subtitle: "Pimentón de la Vera Art",
    description: "Rauchiges Paprikapulver, über Eichenholz geräuchert.",
    blueprintKey: "lebensmittel",
    blueprintData: lebensmittel(60, "g", "100 g", "100 % geräucherte Paprika"),
    vendor: "Demo Manufaktur", productType: "Gewürze", priceMinor: 590, sku: "DEMO-LEB-004",
    stock: 75, image: "spice.jpg", category: "lebensmittel",
  },
  {
    key: "gewuerzsalz-kraeuter", name: "Kräuter-Gewürzsalz 120 g", subtitle: "Allrounder für die Küche",
    description: "Meersalz mit Thymian, Rosmarin und Bärlauch.",
    blueprintKey: "lebensmittel",
    blueprintData: lebensmittel(120, "g", "100 g", "Meersalz, Thymian, Rosmarin, Bärlauch"),
    vendor: "Demo Manufaktur", productType: "Gewürze", priceMinor: 490, salePriceMinor: 390, sku: "DEMO-LEB-005",
    stock: 110, image: "spice.jpg", category: "lebensmittel", collections: ["sale"],
  },
  {
    key: "olivenoel-kanister", name: "Natives Olivenöl Extra 1 l", subtitle: "Vorratsgröße",
    description: "Ausgewogenes Alltagsöl im praktischen Litergebinde.",
    blueprintKey: "lebensmittel",
    blueprintData: lebensmittel(1000, "ml", "1 l", "100 % natives Olivenöl extra", { herkunft: "Italien (Apulien)" }),
    vendor: "Demo Manufaktur", productType: "Öle", priceMinor: 2490, sku: "DEMO-LEB-006",
    stock: 28, image: "oliveoil.jpg", category: "lebensmittel",
  },
  // ---------------- Elektronik (6) ----------------
  {
    key: "speaker-orbit", name: "Bluetooth-Lautsprecher „Orbit“", subtitle: "360°-Sound, 12 h Akku",
    description: "Kompakter Lautsprecher mit sattem Bass, IPX5 und Freisprechfunktion.",
    blueprintKey: "elektronik", blueprintData: elektronik("Demo Audio", "Orbit OB-100"),
    vendor: "Demo Audio", productType: "Lautsprecher", priceMinor: 7990, sku: "DEMO-ELE-001",
    stock: 52, image: "speaker.jpg", category: "elektronik", collections: ["bestseller"], featured: true,
  },
  {
    key: "charger-65w", name: "USB-C Ladegerät 65 W", subtitle: "GaN-Technologie",
    description: "Kompaktes 65-W-Netzteil mit Power Delivery für Laptop, Tablet und Smartphone.",
    blueprintKey: "elektronik",
    blueprintData: elektronik("Demo Power", "PD-65", { leistung: 65, gewicht: 110 }),
    vendor: "Demo Power", productType: "Ladegeräte", priceMinor: 3490, sku: "DEMO-ELE-002",
    stock: 140, image: "charger.jpg", category: "elektronik",
  },
  {
    key: "speaker-orbit-mini", name: "Lautsprecher „Orbit Mini“", subtitle: "Für unterwegs",
    description: "Handlicher Mini-Lautsprecher mit 8 Stunden Akkulaufzeit und Trageschlaufe.",
    blueprintKey: "elektronik",
    blueprintData: elektronik("Demo Audio", "Orbit Mini OM-10", { leistung: 8, gewicht: 260 }),
    vendor: "Demo Audio", productType: "Lautsprecher", priceMinor: 4990, sku: "DEMO-ELE-003",
    stock: 66, image: "speaker.jpg", category: "elektronik", collections: ["neuheiten"],
  },
  {
    key: "charger-30w", name: "USB-C Ladegerät 30 W", subtitle: "Der kompakte Alltagsbegleiter",
    description: "30-W-Netzteil mit Power Delivery, ideal fürs Smartphone.",
    blueprintKey: "elektronik",
    blueprintData: elektronik("Demo Power", "PD-30", { leistung: 30, gewicht: 60 }),
    vendor: "Demo Power", productType: "Ladegeräte", priceMinor: 1990, salePriceMinor: 1590, sku: "DEMO-ELE-004",
    stock: 200, image: "charger.jpg", category: "elektronik", collections: ["sale"],
  },
  {
    key: "speaker-orbit-max", name: "Lautsprecher „Orbit Max“", subtitle: "Party-Sound mit 24 h Akku",
    description: "Großer Bluetooth-Lautsprecher mit zwei Passivradiatoren und Powerbank-Funktion.",
    blueprintKey: "elektronik",
    blueprintData: elektronik("Demo Audio", "Orbit Max OX-300", { leistung: 40, gewicht: 1200 }),
    vendor: "Demo Audio", productType: "Lautsprecher", priceMinor: 12990, sku: "DEMO-ELE-005",
    stock: 18, image: "speaker.jpg", category: "elektronik",
  },
  {
    key: "kabel-usbc-2m", name: "USB-C Kabel 2 m", subtitle: "Geflochten, 100 W",
    description: "Robustes Nylon-geflochtenes USB-C-Kabel, lädt mit bis zu 100 W.",
    blueprintKey: "elektronik",
    blueprintData: elektronik("Demo Power", "CC-200", { leistung: 100, gewicht: 45 }),
    vendor: "Demo Power", productType: "Kabel", priceMinor: 1290, sku: "DEMO-ELE-006",
    stock: 4, image: "charger.jpg", category: "elektronik",
  },
  // ---------------- Kosmetik (4) ----------------
  {
    key: "creme-hydra", name: "Gesichtscreme „Hydra“ 50 ml", subtitle: "Intensive Feuchtigkeit",
    description: "Leichte Tagescreme mit Hyaluron und Sheabutter für ein frisches Hautgefühl.",
    blueprintKey: "kosmetik", blueprintData: kosmetik(50, "ml"),
    vendor: "Demo Kosmetik", productType: "Gesichtspflege", priceMinor: 2490, sku: "DEMO-KOS-001",
    stock: 58, image: "cream.jpg", category: "kosmetik", collections: ["bestseller"], featured: true,
  },
  {
    key: "creme-nacht", name: "Nachtcreme „Regenerativ“ 50 ml", subtitle: "Regeneration über Nacht",
    description: "Reichhaltige Nachtpflege mit Squalan und Vitamin E.",
    blueprintKey: "kosmetik", blueprintData: kosmetik(50, "ml", { hauttyp: ["Trocken", "Reife Haut"] }),
    vendor: "Demo Kosmetik", productType: "Gesichtspflege", priceMinor: 2990, sku: "DEMO-KOS-002",
    stock: 44, image: "cream.jpg", category: "kosmetik",
  },
  {
    key: "handcreme-repair", name: "Handcreme „Repair“ 75 ml", subtitle: "Für strapazierte Hände",
    description: "Schnell einziehende Handcreme mit Panthenol und Mandelöl.",
    blueprintKey: "kosmetik", blueprintData: kosmetik(75, "ml"),
    vendor: "Demo Kosmetik", productType: "Handpflege", priceMinor: 990, salePriceMinor: 790, sku: "DEMO-KOS-003",
    stock: 130, image: "cream.jpg", category: "kosmetik", collections: ["sale"],
  },
  {
    key: "augencreme-lift", name: "Augencreme „Lift“ 15 ml", subtitle: "Gegen müde Augen",
    description: "Straffende Augenpflege mit Koffein und Peptiden.",
    blueprintKey: "kosmetik", blueprintData: kosmetik(15, "ml", { hauttyp: ["Normal", "Empfindlich"] }),
    vendor: "Demo Kosmetik", productType: "Gesichtspflege", priceMinor: 3490, sku: "DEMO-KOS-004",
    stock: 2, image: "cream.jpg", category: "kosmetik", collections: ["neuheiten"],
  },
  // ---------------- Möbel (4) ----------------
  {
    key: "stuhl-aarhus-eiche", name: "Esszimmerstuhl „Aarhus“ Eiche", subtitle: "Massivholz, geölt",
    description: "Zeitloser Stuhl aus massiver Eiche mit ergonomisch geformter Sitzfläche.",
    blueprintKey: "moebel", blueprintData: moebel("Eiche massiv, geölt"),
    vendor: "Demo Living", productType: "Stühle", priceMinor: 18900, sku: "DEMO-MOE-001",
    stock: 16, image: "chair.jpg", category: "moebel", collections: ["bestseller"], featured: true,
  },
  {
    key: "stuhl-aarhus-nuss", name: "Stuhl „Aarhus“ Nussbaum", subtitle: "Edle dunkle Variante",
    description: "Der Klassiker aus amerikanischem Nussbaum, seidenmatt lackiert.",
    blueprintKey: "moebel", blueprintData: moebel("Nussbaum massiv, lackiert"),
    vendor: "Demo Living", productType: "Stühle", priceMinor: 21900, sku: "DEMO-MOE-002",
    stock: 9, image: "chair.jpg", category: "moebel",
  },
  {
    key: "stuhl-bornholm", name: "Holzstuhl „Bornholm“", subtitle: "Der preiswerte Einstieg",
    description: "Stabiler Buchenholzstuhl im skandinavischen Design.",
    blueprintKey: "moebel", blueprintData: moebel("Buche massiv"),
    vendor: "Demo Living", productType: "Stühle", priceMinor: 14900, salePriceMinor: 11900, sku: "DEMO-MOE-003",
    stock: 25, image: "chair.jpg", category: "moebel", collections: ["sale"],
  },
  {
    key: "stuhl-kolding", name: "Designstuhl „Kolding“", subtitle: "Limitierte Sonderedition",
    description: "Skulpturaler Designstuhl aus Esche mit geschwungener Rückenlehne.",
    blueprintKey: "moebel", blueprintData: moebel("Esche massiv", { stil: "Modern" }),
    vendor: "Demo Living", productType: "Stühle", priceMinor: 25900, sku: "DEMO-MOE-004",
    stock: 5, image: "chair.jpg", category: "moebel", collections: ["neuheiten"],
  },
  // ---------------- Schmuck (4) ----------------
  {
    key: "kette-luna-silber", name: "Kette „Luna“ Silber", subtitle: "925er Sterlingsilber",
    description: "Feine Ankerkette mit kleinem Mondphasen-Anhänger, 45 cm.",
    blueprintKey: "schmuck", blueprintData: schmuck("Kette", "Sterlingsilber"),
    vendor: "Demo Atelier", productType: "Ketten", priceMinor: 5900, sku: "DEMO-SCH-001",
    stock: 34, image: "necklace.jpg", category: "schmuck", collections: ["bestseller"], featured: true,
  },
  {
    key: "anhaenger-stella", name: "Anhänger „Stella“", subtitle: "Kleiner Stern, große Wirkung",
    description: "Zarter Stern-Anhänger aus 925er Silber mit Zirkonia.",
    blueprintKey: "schmuck", blueprintData: schmuck("Anhänger", "Sterlingsilber"),
    vendor: "Demo Atelier", productType: "Anhänger", priceMinor: 3900, sku: "DEMO-SCH-002",
    stock: 48, image: "necklace.jpg", category: "schmuck",
  },
  {
    key: "kette-luna-gold", name: "Kette „Luna“ vergoldet", subtitle: "18-karätige Vergoldung",
    description: "Die Luna-Kette in warmer, 18-karätiger Vergoldung.",
    blueprintKey: "schmuck", blueprintData: schmuck("Kette", "Sterlingsilber, vergoldet"),
    vendor: "Demo Atelier", productType: "Ketten", priceMinor: 6900, salePriceMinor: 5900, sku: "DEMO-SCH-003",
    stock: 21, image: "necklace.jpg", category: "schmuck", collections: ["sale", "neuheiten"],
  },
  {
    key: "kette-mara", name: "Perlenkette „Mara“", subtitle: "Süßwasserzuchtperlen",
    description: "Klassische Perlenkette mit handgeknüpften Süßwasserzuchtperlen.",
    blueprintKey: "schmuck", blueprintData: schmuck("Kette", "Süßwasserzuchtperlen", { stein: "Perle" }),
    vendor: "Demo Atelier", productType: "Ketten", priceMinor: 8900, sku: "DEMO-SCH-004",
    stock: 12, image: "necklace.jpg", category: "schmuck",
  },
];

export type DemoCustomerDef = {
  key: string;
  email: string;
  firstName: string;
  lastName: string;
  phone?: string;
  type: "b2c" | "b2b";
  company?: string;
  street: string;
  postalCode: string;
  city: string;
  countryCode: string;
};

export const DEMO_CUSTOMERS: DemoCustomerDef[] = [
  { key: "anna-becker", email: "anna.becker@example.de", firstName: "Anna", lastName: "Becker", phone: "+49 30 1234567", type: "b2c", street: "Torstraße 12", postalCode: "10119", city: "Berlin", countryCode: "DE" },
  { key: "jonas-schmidt", email: "jonas.schmidt@example.de", firstName: "Jonas", lastName: "Schmidt", type: "b2c", street: "Reeperbahn 45", postalCode: "20359", city: "Hamburg", countryCode: "DE" },
  { key: "marie-wagner", email: "marie.wagner@example.de", firstName: "Marie", lastName: "Wagner", type: "b2c", street: "Marienplatz 3", postalCode: "80331", city: "München", countryCode: "DE" },
  { key: "lukas-fischer", email: "lukas.fischer@example.de", firstName: "Lukas", lastName: "Fischer", type: "b2c", street: "Königstraße 21", postalCode: "70173", city: "Stuttgart", countryCode: "DE" },
  { key: "sophie-meyer", email: "sophie.meyer@example.de", firstName: "Sophie", lastName: "Meyer", type: "b2c", street: "Schildergasse 8", postalCode: "50667", city: "Köln", countryCode: "DE" },
  { key: "paul-hoffmann", email: "paul.hoffmann@example.de", firstName: "Paul", lastName: "Hoffmann", type: "b2c", street: "Zeil 110", postalCode: "60313", city: "Frankfurt am Main", countryCode: "DE" },
  { key: "laura-koch", email: "laura.koch@example.at", firstName: "Laura", lastName: "Koch", type: "b2c", street: "Mariahilfer Straße 50", postalCode: "1070", city: "Wien", countryCode: "AT" },
  { key: "tim-richter", email: "tim.richter@example.ch", firstName: "Tim", lastName: "Richter", type: "b2c", street: "Bahnhofstrasse 21", postalCode: "8001", city: "Zürich", countryCode: "CH" },
  { key: "emma-braun", email: "emma.braun@example.de", firstName: "Emma", lastName: "Braun", type: "b2c", street: "Prinzipalmarkt 14", postalCode: "48143", city: "Münster", countryCode: "DE" },
  { key: "noah-krause", email: "noah.krause@example.de", firstName: "Noah", lastName: "Krause", type: "b2c", street: "Flinger Straße 6", postalCode: "40213", city: "Düsseldorf", countryCode: "DE" },
  { key: "cafe-sonnenschein", email: "einkauf@cafe-sonnenschein.example.de", firstName: "Café", lastName: "Sonnenschein", phone: "+49 40 987654", type: "b2b", company: "Café Sonnenschein GmbH", street: "Hafenstraße 7", postalCode: "20457", city: "Hamburg", countryCode: "DE" },
  { key: "buerobedarf-weber", email: "bestellung@buerobedarf-weber.example.de", firstName: "Bürobedarf", lastName: "Weber", type: "b2b", company: "Bürobedarf Weber KG", street: "Industriestraße 33", postalCode: "70565", city: "Stuttgart", countryCode: "DE" },
];

export const DEMO_CUSTOMER_GROUPS = [
  { key: "stammkunden", name: "Stammkunden", members: ["anna-becker", "jonas-schmidt", "marie-wagner"] },
  { key: "b2b", name: "B2B-Kunden", members: ["cafe-sonnenschein", "buerobedarf-weber"] },
] as const;

export const DEMO_PROMOTIONS = [
  { key: "willkommen10", name: "Willkommensrabatt", code: "WILLKOMMEN10", type: "percentage", value: 1000, description: "10 % auf die erste Bestellung." },
  { key: "versandfrei", name: "Versandkostenfrei", code: "VERSANDFREI", type: "free_shipping", value: 0, description: "Kostenloser Versand innerhalb Deutschlands." },
  { key: "sommer5", name: "Sommer-Rabatt", code: "SOMMER5", type: "fixed_amount", value: 500, description: "5 € Rabatt ab 30 € Warenwert." },
] as const;

/** Bestellvorlagen: Zustand, Kunde (key oder null = Gast), Positionen (productKey, qty). */
export type DemoOrderTemplate = {
  key: string;
  state:
    | "shipped"
    | "paid_unfulfilled"
    | "partially_fulfilled"
    | "refunded_partial"
    | "refunded_full"
    | "cancelled"
    | "pending_payment"
    | "return_requested";
  customerKey: string | null;
  items: { productKey: string; qty: number }[];
  /** Tage in der Vergangenheit (Bestelldatum). */
  ageDays: number;
};

const O = (
  key: string,
  state: DemoOrderTemplate["state"],
  customerKey: string | null,
  items: [string, number][],
  ageDays: number,
): DemoOrderTemplate => ({
  key,
  state,
  customerKey,
  items: items.map(([productKey, qty]) => ({ productKey, qty })),
  ageDays,
});

export const DEMO_ORDERS: DemoOrderTemplate[] = [
  // 12 verschickt (2 davon mit Retoure)
  O("ord-001", "shipped", "anna-becker", [["hoodie-kaenguru", 1], ["tshirt-essential", 2]], 58),
  O("ord-002", "shipped", "jonas-schmidt", [["speaker-orbit", 1]], 55),
  O("ord-003", "shipped", "marie-wagner", [["olivenoel-kreta", 2], ["gewuerz-orient", 1]], 51),
  O("ord-004", "shipped", "lukas-fischer", [["stuhl-aarhus-eiche", 2]], 47),
  O("ord-005", "shipped", "sophie-meyer", [["creme-hydra", 1], ["handcreme-repair", 2]], 43),
  O("ord-006", "shipped", "paul-hoffmann", [["charger-65w", 1], ["kabel-usbc-2m", 2]], 38),
  O("ord-007", "shipped", "laura-koch", [["kette-luna-silber", 1]], 34),
  O("ord-008", "shipped", null, [["tshirt-heavyweight", 3]], 29),
  O("ord-009", "shipped", "cafe-sonnenschein", [["olivenoel-kanister", 4], ["gewuerzsalz-kraeuter", 3]], 24),
  O("ord-010", "shipped", "emma-braun", [["jacke-allwetter", 1]], 19),
  O("ord-011", "return_requested", "tim-richter", [["speaker-orbit-mini", 1]], 15),
  O("ord-012", "return_requested", "noah-krause", [["hoodie-zip", 1], ["sweatpants-slim", 1]], 11),
  // 6 bezahlt, unfulfilled
  O("ord-013", "paid_unfulfilled", "anna-becker", [["creme-nacht", 1]], 6),
  O("ord-014", "paid_unfulfilled", "jonas-schmidt", [["charger-30w", 2]], 5),
  O("ord-015", "paid_unfulfilled", null, [["gewuerz-paprika", 2], ["gewuerz-orient", 1]], 4),
  O("ord-016", "paid_unfulfilled", "buerobedarf-weber", [["kabel-usbc-2m", 10]], 3),
  O("ord-017", "paid_unfulfilled", "sophie-meyer", [["kette-mara", 1]], 2),
  O("ord-018", "paid_unfulfilled", "marie-wagner", [["olivenoel-bio", 1]], 1),
  // 4 teilweise fulfilled
  O("ord-019", "partially_fulfilled", "lukas-fischer", [["tshirt-essential", 2], ["hoodie-kaenguru", 1]], 9),
  O("ord-020", "partially_fulfilled", "paul-hoffmann", [["speaker-orbit-max", 1], ["charger-65w", 1]], 8),
  O("ord-021", "partially_fulfilled", "emma-braun", [["stuhl-bornholm", 2], ["stuhl-kolding", 1]], 7),
  O("ord-022", "partially_fulfilled", null, [["creme-hydra", 1], ["augencreme-lift", 1], ["handcreme-repair", 1]], 6),
  // 4 teilweise erstattet
  O("ord-023", "refunded_partial", "jonas-schmidt", [["hoodie-kaenguru", 2]], 26),
  O("ord-024", "refunded_partial", "laura-koch", [["kette-luna-gold", 1], ["anhaenger-stella", 1]], 22),
  O("ord-025", "refunded_partial", "noah-krause", [["jogginghose-comfort", 1], ["tshirt-heavyweight", 1]], 17),
  O("ord-026", "refunded_partial", "cafe-sonnenschein", [["gewuerz-orient", 5]], 13),
  // 2 vollständig erstattet
  O("ord-027", "refunded_full", "tim-richter", [["charger-65w", 1]], 31),
  O("ord-028", "refunded_full", "sophie-meyer", [["creme-hydra", 2]], 27),
  // 3 storniert
  O("ord-029", "cancelled", "paul-hoffmann", [["speaker-orbit", 1]], 21),
  O("ord-030", "cancelled", null, [["stuhl-aarhus-nuss", 1]], 16),
  O("ord-031", "cancelled", "emma-braun", [["gewuerzsalz-kraeuter", 2]], 10),
  // 4 Zahlung ausstehend
  O("ord-032", "pending_payment", "anna-becker", [["jacke-wind", 1]], 3),
  O("ord-033", "pending_payment", "lukas-fischer", [["speaker-orbit-mini", 2]], 2),
  O("ord-034", "pending_payment", null, [["handcreme-repair", 3]], 1),
  O("ord-035", "pending_payment", "marie-wagner", [["kette-luna-silber", 1], ["anhaenger-stella", 2]], 0),
  // 5 weitere verschickt für Volumen
  O("ord-036", "shipped", "buerobedarf-weber", [["charger-30w", 5], ["kabel-usbc-2m", 5]], 33),
  O("ord-037", "shipped", "laura-koch", [["creme-nacht", 1], ["augencreme-lift", 1]], 25),
  O("ord-038", "shipped", "noah-krause", [["tshirt-essential", 1], ["jogginghose-comfort", 1]], 14),
  O("ord-039", "shipped", "tim-richter", [["olivenoel-kreta", 1], ["gewuerz-paprika", 2]], 8),
  O("ord-040", "shipped", "emma-braun", [["stuhl-aarhus-eiche", 1]], 4),
];

/** Dateien in public/demo-assets, die der Media-Schritt hochlädt. */
export const DEMO_ASSETS = [
  "hoodie.jpg",
  "tshirt.jpg",
  "sweatpants.jpg",
  "jacket.jpg",
  "oliveoil.jpg",
  "spice.jpg",
  "cream.jpg",
  "speaker.jpg",
  "charger.jpg",
  "chair.jpg",
  "necklace.jpg",
  "logo.png",
] as const;
