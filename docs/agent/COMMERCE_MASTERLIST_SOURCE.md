# Nutzerauftrag – Commerce-Masterliste

Übernommen am 17.09.2026. Anforderungskatalog, kein Nachweis implementierter Funktionen. Der ausdrückliche Auftrag entfernt Storefront-Inhalte und Storefront-Branding als Verwaltungsfunktionen; diese Vorgabe geht den betreffenden Punkten dieser Liste vor.

Ja. Wenn du daraus später ein **eigenes Commerce-System auf Shopify-/WooCommerce-Niveau** bauen möchtest, würde ich die Funktionen nicht nach „Shopify vs. WooCommerce“ trennen, sondern als eine einzige **Commerce-Masterliste** betrachten. Shopify selbst gliedert seine Plattform inzwischen u. a. in Storefront, Checkout, B2B, Analytics, Automation, Inventory, Marketing, POS, Fulfillment, Returns, Shipping und Developer Tools; WooCommerce deckt über Core + Extensions einen ähnlich breiten Bereich ab. ([Shopify][1])

## 1. Shop-/Mandantenverwaltung

* Shops erstellen
* mehrere Shops verwalten
* Multi-Store
* Multi-Tenant
* Shop duplizieren
* Shop archivieren
* Shop deaktivieren
* Shop löschen
* Shop-Status
* Testshop
* Staging-Shop
* Entwicklungsumgebung
* Produktionsumgebung
* Shop-Vorlagen
* Shop klonen
* Einstellungen importieren
* Einstellungen exportieren
* zentrale Shop-Verwaltung
* Organisationen
* mehrere Unternehmen innerhalb eines Accounts
* mehrere Marken
* mehrere Domains
* mehrere Länder-Shops
* mehrere Storefronts mit gleichem Backend
* Headless Storefronts
* Benutzer pro Shop
* unterschiedliche Rechte je Shop
* unterschiedliche Abrechnung je Shop
* Shop-Zeitzone
* Standardwährung
* Standardland
* Standardsprache
* Maßeinheiten
* Gewichtseinheiten
* Bestellnummern-Präfix
* Bestellnummern-Suffix
* Geschäftsdaten
* Firmenanschrift
* Steuerinformationen
* Impressumsinformationen
* Supportdaten

---

# 2. Benutzerverwaltung / Admin

* Admin-Benutzer
* Mitarbeiterkonten
* Rollen
* Berechtigungen
* individuelle Rechte
* Rollen-Vorlagen
* Owner
* Administrator
* Shop Manager
* Produktmanager
* Lagerverwalter
* Marketing-Mitarbeiter
* Support-Mitarbeiter
* Buchhaltung
* Entwickler
* externer Dienstleister
* Agenturzugang
* B2B-Vertriebsmitarbeiter
* POS-Mitarbeiter
* nur Lesen
* Benutzer sperren
* Benutzer deaktivieren
* Einladungen
* Einladung erneut senden
* letzter Login
* Login-Historie
* Sitzungsverwaltung
* aktive Sitzungen
* Geräteverwaltung
* 2FA
* MFA
* Passkeys
* Passwortregeln
* SSO
* SAML
* OAuth
* Login über Google
* Login über Apple
* Login über Microsoft
* Audit-Log
* Änderungsverlauf
* Benutzeraktivitäten
* IP-Logs
* API-Zugriffsrechte

---

# 3. Produktverwaltung

WooCommerce unterstützt bereits im Kern Produktkategorien, Lagerbestand, Steuern, Maße/Gewichte, Varianten, Attribute und Bewertungen; viele weitere Produkttypen kommen über Erweiterungen hinzu. ([WooCommerce][2])

* Produkte erstellen
* Produkte bearbeiten
* Produkte löschen
* Produkte duplizieren
* Produkte archivieren
* Entwürfe
* geplant veröffentlichen
* aktiv/inaktiv
* Produktstatus
* Produkttitel
* Kurzbeschreibung
* Langbeschreibung
* HTML-Beschreibung
* Rich-Text-Editor
* Medien
* Hauptbild
* Bildergalerie
* Videos
* 360° Bilder
* 3D-Modelle
* AR-Inhalte
* Dateien
* Produkt-SKU
* Barcode
* GTIN
* EAN
* UPC
* ISBN
* MPN
* Hersteller
* Marke
* Lieferant
* Vendor
* Kostenpreis
* Verkaufspreis
* UVP
* Vergleichspreis
* Einkaufspreis
* Marge
* Steuerklasse
* Gewicht
* Länge
* Breite
* Höhe
* Volumen
* Zolltarifnummer
* Herkunftsland
* HS-Code
* Produkt-Tags
* Produktkategorien
* Unterkategorien
* Collections
* automatische Collections
* manuelle Collections
* Produkttyp
* Herstellerfilter
* Produktstatus
* Veröffentlichungszeitraum
* Sichtbarkeit
* nur eingeloggte Kunden
* passwortgeschützte Produkte
* versteckte Produkte
* SEO-Titel
* Meta Description
* URL-Slug
* Canonical URL
* OpenGraph-Daten
* strukturierte Daten

### Produkttypen

* physische Produkte
* digitale Produkte
* Download-Produkte
* Dienstleistungen
* einfache Produkte
* variable Produkte
* Gruppenprodukte
* Bundles
* Sets
* Kits
* Composite Products
* konfigurierbare Produkte
* personalisierbare Produkte
* Abonnements
* Memberships
* Geschenkprodukte
* Gutscheine
* Gift Cards
* Prepaid-Produkte
* Tickets
* Veranstaltungen
* Kurse
* Buchungen
* Termine
* Mietprodukte
* Reservierungen
* Lizenzprodukte
* Software-Lizenzen
* Dropshipping-Produkte
* Print-on-Demand-Produkte
* Vorbestellungen
* Backorder-Produkte
* Spenden
* „Pay what you want“

---

# 4. Produktvarianten

* Varianten
* unbegrenzte Attribute
* Farbe
* Größe
* Material
* Stil
* Länge
* Gewicht
* individuelle Attribute
* variantenspezifische SKU
* variantenspezifischer Barcode
* variantenspezifischer Preis
* variantenspezifischer Bestand
* variantenspezifisches Gewicht
* variantenspezifisches Bild
* variantenspezifische Galerie
* variantenspezifischer Einkaufspreis
* variantenspezifischer Steuersatz
* variantenspezifische Versanddaten
* unterschiedliche Lieferzeiten
* Varianten deaktivieren
* Varianten-Reihenfolge
* automatische Variantenerstellung
* Varianten-Matrix
* Swatches
* Farb-Swatches
* Bild-Swatches
* Dropdowns
* Radio Buttons
* Größenberater
* Varianten-Kombinationsregeln

---

# 5. Custom Fields / Metafelder

* Metafields
* Custom Fields
* Produktfelder
* Variantenfelder
* Kundenfelder
* Bestellfelder
* Kategorienfelder
* Shop-Metadaten
* strukturierte Datentypen
* Text
* Zahl
* Datum
* Boolean
* URL
* Datei
* Bild
* JSON
* Referenzen
* Listen
* Relations
* Validierungsregeln
* eigene Datenmodelle
* Metaobjects
* Custom Content Types

---

# 6. Produktimport / Export

* CSV Import
* CSV Export
* XLSX
* XML
* JSON
* API Import
* API Export
* Bulk Import
* Bulk Export
* Mapping
* Feldzuordnung
* Import-Vorschau
* Fehlerbericht
* Update bestehender Produkte
* Überschreiben
* Merge
* zeitgesteuerter Import
* Feed Import
* Lieferanten-Feeds
* FTP Import
* SFTP Import
* URL Import
* Google Sheets Import
* ERP Import
* PIM Import
* Marketplace Import
* Shopify Import
* WooCommerce Import
* Magento Import
* eBay Import
* Amazon Import

---

# 7. Bulk Editing

* Massenbearbeitung
* Preise erhöhen/senken
* Preise prozentual ändern
* Kategorien ändern
* Tags ändern
* Bestand ändern
* Lieferant ändern
* Status ändern
* Sichtbarkeit ändern
* SEO-Daten ändern
* Metafelder ändern
* Varianten ändern
* Produkte löschen
* Produkte archivieren

---

# 8. Lagerverwaltung

* Bestand verfolgen
* Bestand pro SKU
* Bestand pro Variante
* mehrere Lager
* Lagerorte
* Filialen
* Fulfillment-Center
* virtuelles Lager
* Dropshipping-Lager
* Bestand reservieren
* verfügbarer Bestand
* gebundener Bestand
* physischer Bestand
* eingehender Bestand
* beschädigter Bestand
* Sicherheitsbestand
* Mindestbestand
* Maximalbestand
* Low-Stock-Warnung
* Out-of-Stock-Warnung
* Nachbestellpunkt
* Nachbestellmenge
* Bestandstransfers
* Umlagerungen
* Inventur
* Cycle Counts
* Bestandskorrekturen
* Korrekturgründe
* Bestandshistorie
* Seriennummern
* Chargen
* Lot Tracking
* Ablaufdatum
* FIFO
* FEFO
* Backorders
* Preorders
* Overselling erlauben
* Multi-Location Inventory
* Lager-Prioritäten
* automatische Standortzuweisung
* Bestandssynchronisierung
* POS-Bestand
* Marketplace-Bestand
* ERP-Bestand

---

# 9. Lieferanten / Einkauf

* Lieferantenverwaltung
* Lieferantenkontakte
* Lieferantenprodukte
* Lieferanten-SKU
* Einkaufspreis
* Mindestbestellmenge
* Lieferzeit
* Lieferantenbestand
* Purchase Orders
* Einkaufsbestellungen
* Wareneingang
* Teilwareneingang
* Einkaufshistorie
* offene Bestellungen
* automatische Nachbestellung
* Lieferantenrechnung
* Kostenverteilung
* Frachtkosten
* Landed Cost
* mehrere Lieferanten pro Produkt
* bevorzugter Lieferant
* Dropshipping-Lieferant

---

# 10. Warenkorb

Shopify erlaubt inzwischen sogar eigene serverseitige Warenkorb-/Checkout-Logik über Functions, darunter Cart Transform und Cart-/Checkout-Validierung. ([Shopify][3])

* Warenkorb hinzufügen
* Warenkorb entfernen
* Menge ändern
* Mini Cart
* Drawer Cart
* Warenkorbseite
* persistenter Warenkorb
* geräteübergreifender Warenkorb
* Gast-Warenkorb
* eingeloggter Warenkorb
* Warenkorb zusammenführen
* Warenkorb speichern
* Warenkorb teilen
* Warenkorb-Link
* Wunschliste → Warenkorb
* Warenkorbnotizen
* Geschenkoption
* Geschenkverpackung
* Grußnachricht
* Rabattcode
* automatische Rabatte
* Cross-Sells
* Upsells
* Free-Shipping-Progressbar
* Mindestbestellwert
* Maximalbestellwert
* Min/Max-Menge
* Mengenstaffeln
* Bundle-Rabatte
* Warenkorbregeln
* Produktabhängigkeiten
* inkompatible Produkte
* Warenkorbvalidierung
* individuelle Zusatzfelder
* Cart Attributes
* Cart Transformations

---

# 11. Checkout

Shopify bietet zusätzlich Erweiterungspunkte für Checkout, Post-Purchase, Thank-you- und Order-Status-Seiten sowie programmierbare Payment-/Delivery-Logik. ([Shopify][4])

* One Page Checkout
* Multi-Step Checkout
* Gastcheckout
* Konto-Checkout
* Express Checkout
* Adresse
* Rechnungsadresse
* Lieferadresse
* abweichende Adresse
* automatische Adressvervollständigung
* Adressvalidierung
* Telefonnummer
* E-Mail
* Unternehmensname
* USt-ID
* zusätzliche Felder
* Liefermethode
* Zahlungsmethode
* Rabatt
* Gutschein
* Trinkgeld
* Geschenkkarte
* Store Credit
* Steuerberechnung
* Versandberechnung
* Bestellübersicht
* Checkbox AGB
* Datenschutz
* Widerruf
* Newsletter Opt-in
* Checkout Branding
* Checkout Logo
* Checkout Farben
* Checkout Fonts
* Trust Badges
* Checkout Upsell
* Order Bump
* Post-Purchase Upsell
* Checkout Extensions
* Checkout Validation
* Zahlungsarten dynamisch verstecken
* Zahlungsarten sortieren
* Versandarten dynamisch verstecken
* Versandarten sortieren
* Checkout-Regeln
* Mindestalter
* Geoblocking
* Mindestbestellwert
* Maximalbestellwert
* B2B Checkout
* Checkout als Angebotsanfrage

---

# 12. Zahlungsarten

* Kreditkarte
* Debitkarte
* PayPal
* Apple Pay
* Google Pay
* Shop Pay
* Klarna
* Sofort
* SEPA
* Lastschrift
* Giropay bzw. verfügbare Nachfolger
* EPS
* iDEAL
* Bancontact
* Rechnung
* Vorkasse
* Nachnahme
* Banküberweisung
* Finanzierung
* Ratenzahlung
* Buy Now Pay Later
* Wallets
* lokale Zahlungsarten
* Kryptowährung über Provider
* POS-Zahlung
* Barzahlung
* manuelle Zahlung
* Zahlungslink
* gespeicherte Zahlungsmethoden
* Tokenisierung
* Autorisierung
* Capture
* Teil-Capture
* verzögerter Capture
* Void
* vollständige Erstattung
* Teilerstattung
* mehrere Zahlungen pro Bestellung
* Zahlungsstatus
* Zahlungsgebühren
* Payment Routing
* mehrere Payment Provider
* Fallback Provider
* 3D Secure
* SCA
* Betrugsschutz

---

# 13. Bestellverwaltung

* Bestellung erstellen
* Bestellung bearbeiten
* Bestellung duplizieren
* Bestellung löschen
* Bestellung archivieren
* Draft Orders
* manuelle Bestellung
* POS-Bestellung
* Import-Bestellung
* Bestellstatus
* eigener Bestellstatus
* Zahlungsstatus
* Fulfillmentstatus
* Rechnungsstatus
* Retourenstatus
* Bestellnotizen
* interne Notizen
* Kundennotizen
* Tags
* Custom Fields
* Bestellung sperren
* Bestellung aufteilen
* Bestellungen zusammenführen
* Produkte hinzufügen
* Produkte entfernen
* Mengen ändern
* Preis ändern
* Rabatt hinzufügen
* Versandkosten ändern
* Adresse ändern
* Kunde ändern
* Steuern neu berechnen
* Zahlung erfassen
* Zahlung erstatten
* Bestellung stornieren
* Bestellung zurücksetzen
* Bestellhistorie
* Timeline
* Audit Trail
* PDFs
* Rechnung
* Lieferschein
* Packliste
* Proforma
* Gutschrift
* Auftragsbestätigung
* Barcode
* QR-Code

---

# 14. Fulfillment

* Fulfillment erstellen
* Teil-Fulfillment
* Multi-Fulfillment
* Bestellung splitten
* Standortzuweisung
* Pick
* Pack
* Ship
* Picklisten
* Packlisten
* Wave Picking
* Batch Picking
* Scan Picking
* Barcode Picking
* Versandetiketten
* Fulfillmentstatus
* Trackingnummer
* mehrere Trackingnummern
* Carrier Tracking
* Versandbestätigung
* automatische Benachrichtigungen
* Third-Party Fulfillment
* 3PL
* Dropshipping
* Fulfillment API
* Fulfillment Routing
* automatische Routing-Regeln
* Click & Collect
* Abholung
* Local Delivery

---

# 15. Versand

* Versandzonen
* Versandprofile
* Versandklassen
* Versandarten
* kostenloser Versand
* Flat Rate
* Gewichtsversand
* Preisstaffel
* Stückzahlversand
* Distanzversand
* Echtzeit-Carrier-Tarife
* DHL
* DPD
* GLS
* UPS
* FedEx
* Hermes
* Deutsche Post
* Spedition
* Same-Day Delivery
* Next-Day Delivery
* Express
* Standard
* Abholstation
* Packstation
* Pickup Points
* Local Pickup
* Local Delivery
* Wunschlieferdatum
* Wunschzeit
* Lieferzeitfenster
* Sperrgut
* Gefahrgutregeln
* Kühlversand
* internationaler Versand
* Versandetiketten
* Retourenlabel
* Zollformulare
* CN22/CN23
* Versandversicherung
* Versandtracking
* automatische Trackingseite

---

# 16. Retouren / RMA

Shopify führt Returns inzwischen als eigenen Plattformbereich; WooCommerce stellt entsprechende Funktionen über Core-Workflows und Erweiterungen bereit. ([Shopify][1])

* Retoure beantragen
* Self-Service-Retouren
* RMA-Nummer
* Retourengrund
* Retourenfrist
* Produkte auswählen
* Teilretoure
* vollständige Retoure
* Umtausch
* Ersatz
* Store Credit
* Erstattung
* Teilerstattung
* Retourenlabel
* QR-Retoure
* Drop-off
* Rücksendestatus
* Wareneingang
* Qualitätskontrolle
* Wiedereinlagerung
* beschädigt markieren
* Retourengebühr
* Restocking Fee
* automatisierte Retourenregeln
* Retourenportal
* Retourenstatistik

---

# 17. Kundenverwaltung / CRM

* Kundenprofile
* Gastkunden
* registrierte Kunden
* Kundenkonten
* Firmenkunden
* Kundennummer
* Name
* E-Mail
* Telefon
* Adressen
* mehrere Lieferadressen
* Standardadresse
* Tags
* Notizen
* Custom Fields
* Geburtstag
* Sprache
* Währung
* Land
* Steuerstatus
* USt-ID
* Bestellhistorie
* Umsatz
* durchschnittlicher Bestellwert
* Anzahl Bestellungen
* letzter Kauf
* Customer Lifetime Value
* Retourenquote
* Rabattnutzung
* Kundengruppe
* Segmente
* automatische Segmente
* VIP
* Neukunde
* Stammkunde
* Risikokunde
* B2B
* Newsletterstatus
* Marketing Consent
* SMS Consent
* DSGVO Consent
* Datenexport
* Kundendaten löschen
* Kunden zusammenführen
* Kunden importieren
* Kunden exportieren

---

# 18. Kundenkonto

* Registrierung
* Login
* Passwordless Login
* Passwort-Login
* Social Login
* Profil
* Adressen verwalten
* Bestellungen
* Rechnung herunterladen
* Bestellstatus
* Tracking
* Bestellung erneut bestellen
* Retoure starten
* Wunschliste
* gespeicherter Warenkorb
* Zahlungsmethoden
* Abonnements
* Membership
* Rewards
* Store Credit
* Gutscheine
* Downloads
* Angebote
* B2B-Katalog
* Firmeninformationen
* Benutzer innerhalb Firmenkonto
* Freigabeworkflows

---

# 19. B2B / Wholesale

Shopify unterstützt aktuell native B2B-Unternehmen, Unternehmensstandorte, individuelle Kataloge, Produkte, Preise, Währungen, Zahlungsbedingungen, Anzahlungen, Versand-/Zahlungslogik und Self-Service-Konten. ([Shopify Help Center][5])

* Unternehmen
* Company Locations
* Ansprechpartner
* mehrere Käufer pro Unternehmen
* Firmenhierarchien
* Kundengruppen
* B2B-Kataloge
* kundenspezifische Produkte
* kundenspezifische Preise
* Preislisten
* Staffelpreise
* Mengenrabatte
* Mindestmengen
* Packgrößen
* Mindestbestellwert
* Netto-Preise
* steuerfreie Kunden
* Reverse Charge
* USt-ID Prüfung
* Zahlungsziele
* 7 Tage
* 14 Tage
* 30 Tage
* 60 Tage
* Rechnungskauf
* Kreditlimit
* offene Posten
* Anzahlungen
* Deposit
* Angebote
* Quote Requests
* Angebot annehmen
* Angebot ablehnen
* Bestellung aus Angebot
* PO-Nummer
* Bestellreferenz
* Draft Approval
* Bestellfreigaben
* Käuferrollen
* Budgetlimits
* Vertriebsmitarbeiter
* Kundenbetreuer
* B2B Login
* B2B Registrierung
* Firmenkonto-Antrag
* exklusive Inhalte
* B2B-only Produkte
* B2B-only Shop
* gemischter B2C/B2B-Shop

---

# 20. Preismanagement

* Standardpreis
* UVP
* Angebotspreis
* Zeitrabatt
* Kostenpreis
* Marge
* Margenberechnung
* Preislisten
* Länderpreise
* Währungspreise
* Kundengruppenpreise
* B2B Preise
* Mengenstaffel
* Staffelrabatt
* Quantity Breaks
* Bundle Pricing
* Dynamic Pricing
* Personalized Pricing
* Contract Pricing
* MAP Pricing
* Mindestpreis
* Produktpreisregeln
* Kategoriepreisregeln
* automatische Preisänderungen
* geplante Preisänderungen
* Preisimport
* Rundungsregeln

---

# 21. Rabatte / Promotion Engine

* Rabattcodes
* automatische Rabatte
* Prozent-Rabatt
* Festbetrag
* kostenloser Versand
* Buy X Get Y
* BOGO
* Buy One Get One
* Buy 2 Get 1
* Mengenrabatte
* Bundle Rabatt
* Kategorie-Rabatt
* Produkt-Rabatt
* Kundengruppenrabatt
* Neukundenrabatt
* Stammkundenrabatt
* Geburtstagsrabatt
* Referral Rabatt
* Mitarbeiter-Rabatt
* VIP Rabatt
* zeitlich begrenzter Rabatt
* Flash Sale
* Mindestbestellwert
* Mindestmenge
* Maximalrabatt
* Nutzungslimit
* Nutzungslimit pro Kunde
* Startdatum
* Enddatum
* kombinierbare Gutscheine
* Ausschlüsse
* Rabatt-Prioritäten
* Coupon Generator
* Bulk Coupons
* personalisierte Codes
* Influencer Codes
* Affiliate Codes

---

# 22. Gift Cards / Store Credit

* Geschenkkarten
* digitale Gutscheine
* physische Gutscheine
* Gutscheinwert
* eigener Wert
* Ablaufdatum
* Guthaben
* Teilnutzung
* wiederaufladen
* Store Credit
* Rückerstattung als Guthaben
* Gutschein übertragen
* Geschenkempfänger
* Grußnachricht
* Versandzeitpunkt
* QR-Code
* POS Nutzung

---

# 23. Abonnements

* Subscription Produkte
* wiederkehrende Zahlung
* monatlich
* jährlich
* benutzerdefinierte Intervalle
* kostenlose Testphase
* Setup Fee
* Kündigung
* Pause
* Reaktivierung
* Upgrade
* Downgrade
* Produktwechsel
* Mengenänderung
* Zahlungsdaten aktualisieren
* Retry Payments
* Dunning
* fehlgeschlagene Zahlungen
* Renewal Orders
* Subscription Analytics
* Subscription Discounts
* Prepaid Subscription
* Build-a-Box
* Subscription Bundles

WooCommerce unterstützt solche Produkttypen u. a. über offizielle Extensions; auch Bundles und Subscription-Produkte werden von der mobilen App berücksichtigt. ([WooCommerce][6])

---

# 24. Membership / Loyalty

* Membership
* Mitgliedsstufen
* exklusive Produkte
* exklusive Preise
* Member-only Content
* Punkte
* Rewards
* Punkte sammeln
* Punkte einlösen
* VIP Levels
* Bronze/Silber/Gold
* Cashback
* Store Credit
* Geburtstagsbonus
* Referral Rewards
* Rewards History
* Treuepunkte-Verfall

---

# 25. Wunschlisten

* Wunschliste
* mehrere Wunschlisten
* öffentlich
* privat
* teilen
* Gift Registry
* Hochzeitstisch
* Wunschliste → Warenkorb
* Back-in-Stock aus Wunschliste
* Preisalarm

---

# 26. Bewertungen / UGC

* Produktbewertungen
* Sterne
* Textreviews
* Bilder
* Videos
* verifizierter Kauf
* Review Requests
* Review Reminder
* Moderation
* Antworten
* Helpful Votes
* Fragen & Antworten
* Q&A
* Kundenfotos
* Social Proof
* Review Schema
* Import von Bewertungen
* Export
* Google Reviews
* externe Review-Systeme

---

# 27. Suche

* Produktsuche
* Autocomplete
* Search Suggestions
* Suchhistorie
* Synonyme
* Tippfehlerkorrektur
* Fuzzy Search
* Suchranking
* Boosting
* Produkt-Pinning
* Suchregeln
* Search Merchandising
* Filter
* Facetten
* Kategorie
* Preis
* Marke
* Farbe
* Größe
* Verfügbarkeit
* Bewertung
* Custom Attributes
* Sortierung
* Relevanz
* Preis
* Bestseller
* Neuheiten
* Bewertung
* AI Search
* semantische Suche
* Natural Language Search
* Zero-Result Analytics

---

# 28. Storefront / CMS

* Homepage
* Produktseiten
* Kategorie-Seiten
* Collection Pages
* Landingpages
* Inhaltsseiten
* Blog
* Artikel
* FAQ
* Kontakt
* Über uns
* Impressum
* Datenschutz
* AGB
* Widerruf
* Navigation
* Mega Menu
* Footer
* Header
* Announcement Bar
* Sticky Header
* Sections
* Blocks
* Page Builder
* Drag & Drop
* Theme Editor
* Theme Presets
* Custom CSS
* Custom JavaScript
* Templates
* globale Komponenten
* Reusable Sections
* Dynamic Content
* Metafield Content
* Video Sections
* Slideshows
* Hero Slider
* Image Banner
* Product Slider
* Recommendation Slider
* Blog Slider
* Countdown
* Newsletter
* Popups
* Modals
* Tabs
* Accordions
* Testimonials
* Logos
* Trust Badges
* Before/After
* Lookbook
* Shoppable Images

---

# 29. Theme-System

* Themes installieren
* Theme Marketplace
* Theme Vorschau
* Theme duplizieren
* Theme versionieren
* Theme veröffentlichen
* Theme rollback
* Child Theme
* Sections
* Blocks
* Templates
* Layouts
* Design Tokens
* Farbschema
* Fonts
* Spacing
* Border Radius
* Button Styles
* CSS Variablen
* responsive Einstellungen
* mobile Einstellungen
* Breakpoints
* Theme Code Editor
* Git Integration
* Theme API

---

# 30. Headless Commerce

* Storefront API
* Headless Frontend
* React
* Next.js
* Remix
* Hydrogen
* Vue
* Nuxt
* mobile App
* native App
* getrenntes Backend
* mehrere Frontends
* GraphQL Storefront API
* Cart API
* Customer API
* Checkout Integration
* CMS Integration
* SSR
* SSG
* ISR
* Edge Rendering
* CDN

Shopify nennt Hydrogen & Oxygen ausdrücklich als Bestandteil seiner Storefront-/Developer-Plattform. ([Shopify][1])

---

# 31. SEO

* SEO Titel
* Meta Description
* Slugs
* Canonical
* Robots
* robots.txt
* Sitemap
* XML Sitemap
* Bild Alt-Tags
* strukturierte Daten
* Schema.org
* Product Schema
* Review Schema
* Breadcrumb Schema
* Organization Schema
* hreflang
* Redirects
* 301 Redirect
* Redirect Manager
* Broken Links
* OpenGraph
* Twitter Cards
* SEO Vorschau
* Blog SEO
* Kategorie SEO
* Produkt SEO
* internationale SEO
* Duplicate Content Schutz

---

# 32. Mehrsprachigkeit

* mehrere Sprachen
* automatische Übersetzung
* manuelle Übersetzung
* Produktübersetzungen
* Kategorienübersetzungen
* Theme Übersetzungen
* Checkout Übersetzungen
* E-Mail Übersetzungen
* URL Übersetzungen
* unterschiedliche Domains
* Subdomains
* Sprachverzeichnis
* Browser Language Detection
* Sprachumschalter
* RTL
* locale-spezifische Inhalte

---

# 33. International Commerce / Markets

* Markets
* Ländergruppen
* Länderpreise
* lokale Währungen
* Multi-Currency
* automatische FX-Konvertierung
* feste Wechselkurse
* Rundung
* lokale Preise
* lokale Domains
* Subdomains
* Geo-IP
* regionale Inhalte
* regionale Produkte
* regionale Verfügbarkeit
* regionale Zahlungsmethoden
* regionale Versandmethoden
* Duties
* Import Taxes
* Zoll
* HS Codes
* Incoterms
* DDP
* DDU
* lokale Steuern
* Sprachlokalisierung

---

# 34. Steuer

* Mehrwertsteuer
* Umsatzsteuer
* unterschiedliche Steuersätze
* reduzierte Steuer
* steuerfreie Produkte
* Steuerklassen
* Steuerregeln nach Land
* Steuerregeln nach Region
* Steuerregeln nach PLZ
* Produktsteuer
* Versandsteuer
* Preise inkl. Steuer
* Preise exkl. Steuer
* B2B netto
* B2C brutto
* Reverse Charge
* USt-ID
* VAT Validation
* OSS
* IOSS
* US Sales Tax
* automatische Steuerdienste
* Tax Overrides
* steuerbefreite Kunden
* Tax Reports

---

# 35. Recht / DSGVO

* Cookie Consent
* Consent Management
* Datenschutzerklärung
* AGB
* Widerrufsbelehrung
* Impressum
* Checkboxen
* Double Opt-in
* Marketing Consent
* Tracking Consent
* Datenexport
* Recht auf Auskunft
* Recht auf Löschung
* Kunden anonymisieren
* Datenaufbewahrung
* Cookie Kategorien
* Consent Logs
* Altersprüfung
* Jugendschutz
* Geoblocking
* Barrierefreiheit
* Accessibility Tools

---

# 36. Marketing

WooCommerce dokumentiert Coupons, Google-Integration und E-Mail-Marketing; Shopify führt Marketing als eigenen Plattformbereich. ([WooCommerce][7])

* Newsletter
* E-Mail Marketing
* SMS Marketing
* Push Notifications
* Kampagnen
* Zielgruppen
* Segmente
* Automationen
* Welcome Series
* Abandoned Cart
* Browse Abandonment
* Winback
* Post Purchase
* Cross Sell
* Upsell
* Birthday
* Back in Stock
* Price Drop
* Newsletter Popup
* Exit Intent
* Discount Popup
* Landingpages
* Form Builder
* Lead Forms
* Referral
* Loyalty
* Affiliate
* Influencer Codes
* UTM Tracking
* Campaign Attribution

---

# 37. Warenkorbabbruch

* Abandoned Checkout erkennen
* Abandoned Cart erkennen
* E-Mail Recovery
* SMS Recovery
* Push Recovery
* Recovery Link
* automatischer Coupon
* mehrstufige Sequence
* Recovery Analytics
* wiederhergestellter Umsatz
* Exit Intent

Auch WooCommerce führt hierfür dedizierte Erweiterungen wie Abandoned Cart/Recovery. ([WooCommerce][8])

---

# 38. Automationen

* Workflow Builder
* Trigger
* Conditions
* Actions
* If/Else
* Delays
* Schedules
* Webhooks
* Produkt erstellt
* Produkt geändert
* Bestellung erstellt
* Bestellung bezahlt
* Bestellung storniert
* Bestellung erfüllt
* Kunde erstellt
* Kunde markiert
* Bestand niedrig
* Refund erstellt
* Retoure erstellt
* B2B Account erstellt
* Tag hinzufügen
* E-Mail senden
* Slack Nachricht
* Daten an API senden
* Bestellung prüfen
* Fraud Workflow
* Fulfillment Workflow
* CRM Workflow
* ERP Workflow
* Marketing Workflow
* Custom Functions

Shopify nennt Flow explizit für Automatisierungen wie Firmenkonten, Rechnungen und Kundeneinladungen. ([Shopify Help Center][9])

---

# 39. E-Mail-System

* Bestellbestätigung
* Versandbestätigung
* Zahlung bestätigt
* Zahlung fehlgeschlagen
* Storno
* Rückerstattung
* Retourenbestätigung
* Passwort
* Kundenkonto
* Einladung
* Angebot
* Rechnung
* Back-in-Stock
* Review Request
* Newsletter
* Template Editor
* HTML Templates
* Text Templates
* Variablen
* Liquid/Template Syntax
* unterschiedliche Sprachen
* eigener SMTP
* Provider Integration
* Mail Logs
* Retry

---

# 40. Analytics

* Dashboard
* Umsatz
* Nettoumsatz
* Bruttoumsatz
* Bestellungen
* AOV
* Conversion Rate
* Besucher
* Sessions
* Pageviews
* Add-to-Cart Rate
* Checkout Rate
* Checkout Conversion
* Refunds
* Discounts
* Taxes
* Shipping
* Kosten
* Marge
* Profit
* COGS
* Produkte
* Bestseller
* Ladenhüter
* Kategorien
* Varianten
* Kunden
* Neukunden
* Stammkunden
* CLV
* Kohorten
* Retention
* Churn
* Länder
* Geräte
* Traffic Sources
* Attribution
* Marketing-Kanäle
* UTM
* Kampagnen
* Rabattcodes
* Suchbegriffe
* Zero Searches
* Lagerbestand
* Sell-through Rate
* Days of Inventory
* Fulfillment Performance
* Retourenquote
* Fraud Rate
* B2B Analytics

WooCommerce hat einen eigenen Bereich für Analytics/Sales Reports; Shopify unterstützt ebenfalls anpassbare Dashboards und B2B-Reports. ([WooCommerce][7])

---

# 41. Reporting

* Standardreports
* Custom Reports
* Report Builder
* Filter
* Dimensionen
* Kennzahlen
* Zeitvergleiche
* Export CSV
* Export Excel
* PDF Reports
* geplante Reports
* E-Mail Reports
* gespeicherte Reports
* Dashboard Widgets
* Custom Dashboards
* Rollenabhängige Reports

---

# 42. Finanzmanagement

* Umsatzauswertung
* Auszahlungen
* Payouts
* Zahlungsgebühren
* Transaktionsgebühren
* Refunds
* Disputes
* Chargebacks
* Cashflow
* Kosten
* COGS
* Gewinn
* Marge
* Steuern
* offene Zahlungen
* B2B Forderungen
* Zahlungsabgleich
* Bankabgleich
* Export Buchhaltung
* DATEV Export
* Lexware
* sevdesk
* Xero
* QuickBooks
* ERP

WooCommerce listet beispielsweise auch Xero-Integrationen in seinem offiziellen Extension-Ökosystem. ([WooCommerce][8])

---

# 43. Rechnungen

* Rechnung automatisch erstellen
* Rechnungsnummer
* Nummernkreis
* PDF
* Rechnungsadresse
* Firmendaten
* USt-ID
* Steuerpositionen
* Zahlungsstatus
* Rechnungsdatum
* Leistungsdatum
* Fälligkeit
* Zahlungsziel
* B2B Rechnung
* Proforma
* Gutschrift
* Storno
* Korrekturrechnung
* Lieferschein
* Mahnung
* E-Rechnung
* ZUGFeRD
* XRechnung
* Rechnungsversand
* Rechnung herunterladen

---

# 44. POS / Kasse

* Point of Sale
* POS App
* Tablet
* Smartphone
* Kassensystem
* Barcode Scanner
* Kartenterminal
* Bondrucker
* Kassenlade
* Kundendisplay
* Produkte suchen
* Barcode Scan
* Kunde auswählen
* Rabatte
* Gutscheine
* Store Credit
* Gift Cards
* Barzahlung
* Kartenzahlung
* Split Payment
* Refund
* Exchange
* Kassenabschluss
* Schichten
* Mitarbeiter-PIN
* POS-Rollen
* Filialen
* Bestandssynchronisierung
* Online bestellen, Store abholen
* Store bestellen, nach Hause liefern

Shopify führt POS als eigenständigen Commerce-Bereich. ([Shopify][1])

---

# 45. Omnichannel

* Online Shop
* POS
* Mobile App
* Social Commerce
* Instagram
* Facebook
* TikTok
* Google Shopping
* YouTube
* Pinterest
* Amazon
* eBay
* Etsy
* Kaufland
* Otto
* Zalando
* Marketplace Feeds
* zentraler Bestand
* zentrale Bestellungen
* zentrale Kunden
* zentrale Preise
* zentrale Produktdaten

---

# 46. Product Feeds

* Google Merchant Center
* Meta Catalog
* TikTok Catalog
* Pinterest
* Bing
* Idealo
* Google Shopping
* Custom XML
* CSV Feed
* JSON Feed
* Feed Mapping
* Kategorie-Mapping
* Custom Labels
* Ausschlussregeln
* Feed Scheduling
* Feed Fehlerprüfung

WooCommerce bietet hierfür beispielsweise Product Feed Manager und Google for WooCommerce. ([WooCommerce][8])

---

# 47. Social Commerce

* Facebook Shop
* Instagram Shopping
* TikTok Shop
* Pinterest
* Social Product Sync
* Social Checkout
* Social Ads
* Pixel Integration
* Conversion API
* Catalog Sync
* Influencer Links

---

# 48. Werbeplattformen

* Google Ads
* Meta Ads
* TikTok Ads
* Pinterest Ads
* Microsoft Ads
* Google Merchant
* Google Analytics
* Meta Pixel
* TikTok Pixel
* serverseitiges Tracking
* Conversion API
* Enhanced Conversions
* ROAS Tracking
* Attribution

---

# 49. Blog / Content Marketing

* Blog
* Kategorien
* Tags
* Autoren
* Featured Image
* SEO
* Veröffentlichung planen
* Entwürfe
* Rich Text
* Embeds
* Produktverlinkung
* Related Products
* Kommentare
* RSS

---

# 50. Personalisierung

* personalisierte Produktempfehlungen
* „Kunden kauften auch“
* ähnliche Produkte
* zuletzt angesehen
* häufig zusammen gekauft
* personalisierte Homepage
* personalisierte Preise
* personalisierte Inhalte
* Geo-Personalisierung
* Kundensegment-Personalisierung
* Recommendation API
* AI Recommendations

---

# 51. Merchandising

* Featured Products
* Bestseller
* Neuheiten
* manuelle Sortierung
* automatische Sortierung
* Kategorie-Pinning
* Product Boost
* Product Bury
* Search Merchandising
* Saisonregeln
* Kampagnen-Sortierung
* automatische Collections
* Dynamic Collections

---

# 52. AI-Funktionen

* Produktbeschreibung generieren
* SEO-Texte
* Meta Description
* Bild Alt-Tags
* Übersetzungen
* E-Mail-Texte
* Antworten an Kunden
* Support Assistent
* Produktklassifizierung
* Kategorie-Vorschläge
* Tagging
* Bildgenerierung
* Bildbearbeitung
* Hintergrund entfernen
* Produktempfehlungen
* semantische Suche
* Analytics Insights
* Forecasting
* Fraud Detection
* AI Chat
* Shopping Assistant
* Admin Copilot

---

# 53. Kundenservice

* Contact Forms
* Live Chat
* Chatbot
* Inbox
* Tickets
* E-Mail Integration
* Kundenhistorie
* Bestellinformationen
* Refund direkt aus Support
* Gutscheine erstellen
* interne Notizen
* Makros
* automatische Antworten
* Help Center
* FAQ
* Knowledge Base
* WhatsApp
* Facebook Messenger
* Instagram DMs
* Support Analytics

---

# 54. Fraud / Risk

* Fraud Detection
* Risikoscore
* IP Prüfung
* Device Fingerprinting
* Velocity Checks
* Adressprüfung
* AVS
* CVV
* 3DS
* verdächtige Bestellungen
* Blacklist
* Whitelist
* E-Mail Blacklist
* IP Blacklist
* Länderblockierung
* Zahlungsprüfung
* manuelle Prüfung
* automatische Stornierung
* Fraud Tags
* Chargeback Management

---

# 55. Security

* HTTPS
* SSL
* TLS
* Encryption at Rest
* Encryption in Transit
* PCI DSS
* CSP
* CSRF Schutz
* XSS Schutz
* SQL Injection Schutz
* Rate Limiting
* Bot Protection
* WAF
* DDoS Protection
* Firewall
* Captcha
* Brute Force Protection
* 2FA
* MFA
* SSO
* Rollen
* Audit Logs
* Session Management
* API Tokens
* API Scopes
* Secret Rotation
* Backups
* Restore
* Disaster Recovery
* Security Logs

WooCommerce bietet beispielsweise explizites Checkout-Rate-Limiting und High-Performance Order Storage als Plattformoptionen. ([WooCommerce][10])

---

# 56. Performance

* CDN
* Image CDN
* automatische Bildoptimierung
* WebP
* AVIF
* Lazy Loading
* Caching
* Full Page Cache
* Object Cache
* Edge Cache
* Minification
* Code Splitting
* Preloading
* Prefetching
* Database Optimization
* Query Optimization
* High Performance Order Storage
* Background Jobs
* Queue System
* Async Processing
* Performance Monitoring
* Core Web Vitals

---

# 57. Domains

* eigene Domain
* Domains kaufen
* Domain verbinden
* Subdomains
* mehrere Domains
* Primary Domain
* Redirect Domain
* SSL
* DNS
* international domains
* Domain pro Market
* Domain pro Sprache

---

# 58. App-/Plugin-System

* App Store
* Plugin Marketplace
* Apps installieren
* Apps entfernen
* App Permissions
* App Scopes
* öffentliche Apps
* private Apps
* Custom Apps
* Embedded Apps
* Admin Extensions
* Checkout Extensions
* Theme Extensions
* POS Extensions
* Web Pixels
* Functions
* Webhooks
* OAuth
* App Billing
* Subscription Billing
* Usage Billing
* Extension Updates
* App Settings

Das ist gerade bei WooCommerce zentral: Der offizielle Marketplace deckt Payment, Shipping, Marketing, Produktfelder, Abandoned Cart, Feeds, Analytics und zahlreiche weitere Erweiterungskategorien ab. ([WooCommerce][8])

---

# 59. API

* REST API
* GraphQL API
* Admin API
* Storefront API
* Customer API
* Cart API
* Checkout API
* Product API
* Order API
* Inventory API
* Customer API
* Fulfillment API
* Payments API
* Shipping API
* Returns API
* Discounts API
* Meta API
* Analytics API
* Files API
* Themes API
* Webhooks API
* OAuth
* API Keys
* Access Tokens
* API Scopes
* Pagination
* Filtering
* Sorting
* Bulk Operations
* Rate Limits
* Idempotency
* API Versioning

---

# 60. Webhooks / Events

* order.created
* order.updated
* order.deleted
* order.paid
* order.cancelled
* order.fulfilled
* product.created
* product.updated
* product.deleted
* customer.created
* customer.updated
* inventory.updated
* checkout.created
* checkout.completed
* refund.created
* fulfillment.created
* app.installed
* app.uninstalled
* custom events
* Webhook Retry
* Signing
* HMAC Verification
* Event Logs
* Dead Letter Queue

---

# 61. Developer Tools

* CLI
* Local Development
* Dev Stores
* Sandbox
* API Explorer
* GraphQL Explorer
* Webhook Tester
* App Templates
* Theme CLI
* Extension CLI
* SDK
* JS SDK
* React Components
* UI Kit
* Design System
* App Bridge
* Testing APIs
* Mock Data
* Environment Variables
* Deployment
* Versioning
* Feature Flags
* Logs
* Debugging
* Monitoring

Shopify Functions ermöglichen sogar eigene Backend-Logik für Rabatte, Warenkorbtransformationen, Versand-, Zahlungs- und Fulfillmentregeln. ([Shopify][3])

---

# 62. Integrationen

* ERP
* SAP
* Microsoft Dynamics
* Odoo
* NetSuite
* PIM
* DAM
* CRM
* Salesforce
* HubSpot
* Klaviyo
* Mailchimp
* Brevo
* Buchhaltung
* DATEV
* Lexware
* sevdesk
* Xero
* QuickBooks
* WMS
* 3PL
* Shipping Provider
* Marketplace
* Payment Provider
* Analytics
* BI
* Data Warehouse

Shopify nennt ERP, Accounting, PIM und 3PL ausdrücklich als externe B2B-Integrationsziele. ([Shopify Help Center][9])

---

# 63. Import / Migration

* Shopify Migration
* WooCommerce Migration
* Magento Migration
* Shopware Migration
* PrestaShop Migration
* BigCommerce Migration
* CSV
* Kunden
* Produkte
* Varianten
* Kategorien
* Bestellungen
* Bewertungen
* Rabatte
* Gutscheine
* URLs
* Redirects
* Bilder
* Metadaten
* Blog
* Seiten
* SEO
* historische Bestellungen

---

# 64. Backup / Versionierung

* automatische Backups
* manuelles Backup
* Datenbank Backup
* Dateibackup
* Theme Backup
* Konfigurationsbackup
* Point-in-Time Restore
* Version History
* Rollback
* Staging
* Deployment History

---

# 65. Dateien / Media Library

* Bilder
* Videos
* PDFs
* Dokumente
* Upload
* Ordner
* Tags
* Suche
* Dateinamen
* Alt Text
* Metadaten
* CDN
* Image Resize
* Crop
* Compression
* WebP
* AVIF
* externe Storage Provider
* DAM Integration

---

# 66. Mobile Admin App

* Dashboard
* Bestellungen
* Produkte
* Kunden
* Bestand
* Benachrichtigungen
* Refunds
* Fulfillment
* Analytics
* Barcode Scan
* Produkte erstellen
* Bilder aufnehmen
* POS
* Push Notifications
* Mitarbeiterzugang

WooCommerce hat ebenfalls eine eigene Mobile-App-Unterstützung und Extension-Kompatibilitäten. ([WooCommerce][7])

---

# 67. Mobile Store / PWA

* Responsive Design
* PWA
* Add to Home Screen
* Offline Cache
* Push Notifications
* Mobile Checkout
* Apple Pay
* Google Pay
* native App API
* Deep Links
* App Links

---

# 68. Marktplatz-Funktionalität

Falls das System auch selbst zum Marketplace werden soll:

* Multi-Vendor
* Händlerregistrierung
* Händler-Dashboard
* Händlerprodukte
* Händlerbestellungen
* Verkäuferprofil
* Händlerbewertungen
* Provision
* individuelle Provisionssätze
* automatische Auszahlung
* Payout
* Escrow
* Vendor Shipping
* Vendor Returns
* Vendor Coupons
* Vendor Analytics
* Vendor Subscription
* KYC
* Händlerverträge
* Marketplace Search
* Marketplace Categories

---

# 69. Dropshipping

* Lieferanten
* Produktimport
* Preisaufschläge
* automatische Preisregeln
* Bestandsabgleich
* Bestellung an Supplier
* automatischer Fulfillment Request
* Tracking Import
* mehrere Lieferanten
* Split Orders
* Supplier Mapping
* Supplier API
* AliExpress-artige Imports
* Print-on-Demand

---

# 70. Print-on-Demand

* Produktgenerator
* Varianten
* Mockups
* automatische Bestellübermittlung
* Fulfillment
* Tracking
* Kosten
* Marge
* mehrere Anbieter

---

# 71. Buchungen / Termine

* Kalender
* verfügbare Slots
* Mitarbeiter
* Ressourcen
* Dauer
* Pufferzeit
* Kapazität
* Gruppenbuchung
* Terminverschiebung
* Storno
* Anzahlungen
* Erinnerungen
* Google Calendar Sync
* Outlook Sync
* Zoom/Meeting-Link

---

# 72. Digital Downloads

* Downloadlink
* Ablaufzeit
* Downloadlimit
* sichere URLs
* Dateien pro Bestellung
* Lizenzschlüssel
* PDF
* ZIP
* Software
* Videos
* E-Books
* Downloadhistorie

---

# 73. Lizenzsystem

* Lizenzkeys
* Aktivierung
* Geräte-Limit
* Ablaufdatum
* Subscription License
* Key Generation
* Key Revocation
* API Validation
* Lizenzportal

---

# 74. Produktpersonalisierung

* Textgravur
* Namensfeld
* Upload
* Bild Upload
* Datei Upload
* Farbwahl
* Zusatzoptionen
* Checkboxen
* Dropdowns
* Aufpreis
* Live Preview
* Product Configurator
* 2D Configurator
* 3D Configurator

---

# 75. Empfehlungen / Upselling

* Related Products
* Recommended Products
* Frequently Bought Together
* Cross Sell
* Upsell
* Cart Upsell
* Checkout Upsell
* Post-Purchase Upsell
* Bundles
* AI Recommendations
* Personalization

---

# 76. Preisalarme / Stock Alerts

* Back in Stock
* Low Stock
* Price Drop
* Wunschlistenalarm
* E-Mail
* SMS
* Push
* Warteliste
* Preorder Notification

---

# 77. Forms

* Kontaktformular
* Newsletter
* B2B Registrierung
* Produktanfrage
* Angebotsanfrage
* Retourenantrag
* Custom Forms
* Datei Upload
* bedingte Felder
* Formularautomationen
* Captcha
* Webhook

---

# 78. Feature Flags / Experimente

* Feature Flags
* A/B Tests
* Theme Experiments
* Checkout Experiments
* Preisexperimente
* Conversion Tests
* Traffic Split
* Variant Tracking

---

# 79. Monitoring

* Uptime Monitoring
* Error Logs
* Application Logs
* API Logs
* Webhook Logs
* Payment Logs
* E-Mail Logs
* Background Job Logs
* Performance Metrics
* Health Checks
* Alerting
* Incident Tracking

---

# 80. Search-/Admin-Kommandos

* globale Admin-Suche
* Produkte suchen
* Kunden suchen
* Bestellungen suchen
* SKU
* E-Mail
* Telefonnummer
* Barcode
* Bestellnummer
* Quick Actions
* Command Palette
* Keyboard Shortcuts

---

# 81. Benachrichtigungen

* In-App
* E-Mail
* SMS
* Push
* Slack
* Webhook
* Low Stock
* New Order
* High Risk Order
* Failed Payment
* Return
* Chargeback
* B2B Request
* Supplier Delay
* System Error

---

# 82. Scheduler

* geplante Produkte
* geplante Preise
* geplante Rabatte
* geplante Kampagnen
* geplante Theme-Wechsel
* geplante Content-Veröffentlichung
* geplante Reports
* geplante Imports
* geplante Exports

---

# 83. Custom Admin

* Admin Dashboard
* Widgets
* anpassbares Menü
* Favoriten
* gespeicherte Filter
* Tabellenansichten
* Spalten konfigurieren
* Bulk Actions
* Saved Views
* individuelle Dashboards
* Rollenbasierte Oberfläche

---

# 84. Datenmodell / Infrastruktur

Für ein eigenes System extrem wichtig:

* Tenants
* Stores
* Users
* Roles
* Permissions
* Customers
* Companies
* Addresses
* Products
* Variants
* Options
* Collections
* Categories
* Prices
* Price Lists
* Inventory Items
* Inventory Locations
* Stock Movements
* Carts
* Cart Lines
* Checkouts
* Orders
* Order Lines
* Payments
* Refunds
* Returns
* Fulfillments
* Shipments
* Discounts
* Coupons
* Gift Cards
* Taxes
* Shipping Methods
* Markets
* Currencies
* Languages
* Channels
* Suppliers
* Purchase Orders
* Files
* Events
* Webhooks
* API Keys
* Audit Logs
* Custom Fields

---

# 85. Enterprise-Funktionen

* hohe Skalierbarkeit
* Multi-Region
* mehrere Brands
* mehrere Legal Entities
* Enterprise SSO
* SCIM
* granular Roles
* Audit
* SLA
* Dedicated Support
* Custom Checkout
* Custom Pricing
* Contract Pricing
* ERP Integration
* PIM
* OMS
* WMS
* Data Warehouse
* Custom Reporting
* B2B
* Approval Workflows
* Sales Representatives
* Wholesale
* Multi-Shop
* International Markets

---

# 86. Funktionen, die ich für ein modernes eigenes System zusätzlich vorsehen würde

Das sind teilweise Funktionen, bei denen man Shopify/WooCommerce sogar überholen könnte:

* **AI Commerce Copilot**
* natürliche Sprache zur Shopverwaltung
* „Erstelle Produkt aus diesem Foto“
* „Erhöhe alle Samsung-Produkte um 5 %“
* „Welche Produkte verkaufen sich schlecht?“
* automatische Kategorisierung
* automatische Attributerkennung
* automatische SEO-Optimierung
* automatische Produktübersetzung
* AI Bildbearbeitung
* AI Hintergrundbilder
* automatische Bundle-Vorschläge
* automatische Rabattempfehlungen
* intelligente Nachbestellung
* Demand Forecasting
* Bestandsprognosen
* automatische Betrugserkennung
* automatische Retourenbewertung
* AI Support Agent
* AI Shopping Assistant
* Conversational Checkout
* Voice Commerce
* visuelle Produktsuche
* Search by Image
* intelligente Preisoptimierung
* automatische Supplier-Auswahl
* automatische Fulfillment-Routen
* Agent API / MCP
* Shop steuerbar durch AI Agents

---

## Unterm Strich

Wenn du **Shopify + WooCommerce + deren relevantes App-/Extension-Ökosystem** auf einen gemeinsamen Nenner bringst, würde ich ein wirklich vollständiges Commerce-System ungefähr in diese **20 Kernmodule** zerlegen:

1. **Core / Tenancy**
2. **Catalog / PIM**
3. **Pricing**
4. **Inventory**
5. **Purchasing / Suppliers**
6. **Customers / CRM**
7. **B2B**
8. **Cart**
9. **Checkout**
10. **Payments**
11. **Orders / OMS**
12. **Fulfillment / Shipping / Returns**
13. **Storefront / CMS / Themes**
14. **Marketing / Promotions / Loyalty**
15. **Analytics / Reporting**
16. **Accounting / Tax / Finance**
17. **POS / Omnichannel**
18. **Apps / APIs / Webhooks / Developer Platform**
19. **Security / Admin / Automation**
20. **AI / Agent Layer**

Das Entscheidende dabei: **WooCommerce ist nicht nur das WooCommerce-Core-Plugin und Shopify nicht nur der Shopify-Admin.** Die eigentliche Funktionsbreite entsteht bei beiden über Apps, Extensions, APIs und Integrationen. Deshalb ist „wirklich alles“ theoretisch unbegrenzt. Die Liste oben bildet aber praktisch die vollständige **Funktionsarchitektur einer modernen Commerce-Plattform** ab. ([WooCommerce][8])

Für dein eigenes Commerce-OS würde ich insbesondere **Pricing, Inventory, Checkout, Orders, Events/Webhooks und Custom Fields von Anfang an als getrennte Engines** bauen und nicht als einen großen Shop-Codeblock. Genau dadurch bleibt das System später so erweiterbar wie Shopify/WooCommerce.

[1]: https://www.shopify.com/products?utm_source=chatgpt.com "Browse all of Shopify’s products & features - Shopify"
[2]: https://woocommerce.com/document/managing-products/?utm_source=chatgpt.com "Adding and Managing Products Documentation - WooCommerce"
[3]: https://shopify.dev/docs/api/functions/2025-10?utm_source=chatgpt.com "Function APIs"
[4]: https://shopify.dev/docs/api/checkout-extensions?utm_source=chatgpt.com "About checkout app extensions"
[5]: https://help.shopify.com/en/manual/b2b/getting-started/features?utm_source=chatgpt.com "Shopify Help Center | Overview of B2B features on Shopify"
[6]: https://woocommerce.com/document/supported-extensions/?utm_source=chatgpt.com "Supported Extensions Documentation - WooCommerce"
[7]: https://woocommerce.com/documentation/woocommerce/?utm_source=chatgpt.com "WooCommerce Documentation - WooCommerce"
[8]: https://woocommerce.com/documentation/products/extensions/?utm_source=chatgpt.com "Extensions Documentation - WooCommerce"
[9]: https://help.shopify.com/de/manual/b2b/reports-and-automations?utm_source=chatgpt.com "Shopify Help Center | Berichterstattung, Automatisierungen und Integrationen in B2B"
[10]: https://woocommerce.com/document/configuring-woocommerce-settings/advanced/?utm_source=chatgpt.com "Advanced Settings Documentation - WooCommerce"
