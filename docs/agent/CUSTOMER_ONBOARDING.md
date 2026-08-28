# Kunden-Onboarding (Betriebsart A)

Ziel: ein weiterer Mandant im bestehenden EYIS.
**Keine neue Datenbank, kein neues Backend, keine Migration.** Es entstehen ausschließlich
Datensätze.

## Voraussetzungen

- Zugang zum Backoffice mit Rolle `owner` oder `admin`.
- Bekannte Eckdaten: Firmenname, Rechnungsdaten, Währung, Steuermodus (Netto/Brutto), Versandländer,
  gewünschte Zahlungsart.

## Schritte

1. **Organisation anlegen** — Name, Rechnungsanschrift, USt-ID. Sie ist die Mandantenwurzel; alle
   weiteren Daten hängen an ihrer `organization_id`.
2. **Shop anlegen** — Handle/Slug, Anzeigename, Locale, Währung. Ein Shop = ein Verkaufskanal.
3. **Steuern** — Steuerklassen und Sätze prüfen (Standard 19 %, ermäßigt 7 %), Anzeigemodus
   Netto oder Brutto festlegen. Wirkt sich auf alle Totals aus.
4. **Versand** — Lagerort anlegen, Versandarten mit Ländern und Preisen definieren.
5. **Zahlung** — Provider konfigurieren. Ohne freigegebene Live-Zugangsdaten bleibt der
   Mock-Provider aktiv (siehe `docs/production/KNOWN_LIMITATIONS.md`).
6. **Dokumente** — Nummernkreise für Rechnung, Gutschrift und Lieferschein, Branding und
   Absenderdaten setzen. Nummernkreise sind lückenlos und werden nicht nachträglich verändert.
7. **Katalog** — Kategorien, Kollektionen, Produkte, Varianten, Preise, Bestände. Bestände nur über
   Inventory-Bewegungen.
8. **Team** — Mitglieder per Einladung hinzufügen und Rollen vergeben. Rollen stehen in
   `memberships`, nie im Profil.
9. **Publishable Key erzeugen** — im Entwicklerbereich. Origin-Restriction auf die künftige
   Storefront-Domain setzen. Für Entwicklung und Live getrennte Keys verwenden.
10. **Abnahme** — Testbestellung über die Referenz-Storefront oder die Kunden-Storefront:
    Katalog → Warenkorb → Checkout → Zahlung (Mock) → Bestellung → Rechnung → Versand.

## Trennung prüfen (Nachweis)

- Ein Key des neuen Shops darf keine Ressource eines anderen Shops liefern (404/403).
- Backoffice-Nutzer ohne Mitgliedschaft sehen keinerlei Daten der neuen Organisation.
- Automatisiert: `bun run qa:rls` und `bun run qa:store-api` gegen Dev.

## Wann braucht ein Kunde eine eigene Datenbank?

Nur in Betriebsart C (Dedicated Deployment) und nur, wenn vollständige Isolation ausdrücklich
verlangt wird. Für einen normalen Neukunden lautet die Antwort: **nein**.

## Danach

Die Storefront folgt separat: [NEW_STOREFRONT_RUNBOOK.md](NEW_STOREFRONT_RUNBOOK.md).
