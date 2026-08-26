# Fertige Agenten-Prompts

Zum Kopieren. Platzhalter in `<spitzen Klammern>` ersetzen.

---

## 1. Neue Storefront bauen (Betriebsart B)

```text
Du baust eine eigenständige Storefront für einen bestehenden Commerce-OS-Shop.

Zugangsdaten:
- API-Basis-URL: <https://host/api/public/store/v1>
- Publishable Key: <pk_...>

Verbindliche Regeln:
1. Es gibt KEINE eigene Datenbank und KEIN eigenes Commerce-Backend. Lege weder Supabase
   noch Lovable Cloud an. Alle Daten kommen über die Store API v1.
2. Die einzige erlaubte Schnittstelle ist das Store SDK. Kein direkter fetch gegen die API,
   kein @supabase/supabase-js, kein Import aus src/lib/commerce.
3. Das SDK ist noch kein npm-Paket. Übernimm den Ordner src/lib/store-sdk/ aus dem
   Commerce-OS-Repository im angegebenen Commit und halte Quelle, Commit und sdk_version fest.
   Führe niemals "npm install @commerce-os/sdk" aus — das Paket existiert nicht.
4. Rechne keine Preise, Steuern, Rabatte oder Bestände. Zeige ausschließlich Serverwerte an;
   Beträge sind Minor Units mit Währungscode.
5. Behandle die Fehlercodes CART_EXPIRED, OUT_OF_STOCK, CHECKOUT_INVALID, PAYMENT_FAILED,
   RATE_LIMITED und CUSTOMER_SESSION_EXPIRED sichtbar.
6. Mobil ab 320 px ohne horizontalen Überlauf, Touch-Ziele mindestens 44 px.

Umfang: Startseite, Kategorie, Produktdetail, Suche, Warenkorb, Checkout, Zahlung,
Bestellbestätigung, Gastbestellung, Kundenkonto mit Bestellhistorie und Retoure.

Abnahme: vollständiger Durchlauf Katalog → Warenkorb → Checkout → Zahlung → Bestätigung,
plus Nachweis, dass kein Supabase-Import und kein Secret im Bundle liegt.

Referenz: docs/agent/NEW_STOREFRONT_RUNBOOK.md, docs/agent/STORE_API_GUIDE.md,
docs/agent/store-api-v1.json.
```

---

## 2. Neuen Kunden anlegen (Betriebsart A)

```text
Lege im bestehenden Commerce OS einen neuen Mandanten an.

Kundendaten: <Firma>, <Rechnungsanschrift>, <USt-ID>, Währung <EUR>,
Steuermodus <brutto|netto>, Versandländer <DE, AT, CH>.

Regeln:
- KEINE neue Datenbank, KEIN neues Backend, KEINE Migration. Es entstehen nur Datensätze.
- Trennung läuft über organization_id/shop_id und RLS.

Schritte: Organisation, Shop, Steuern, Lagerort und Versandarten, Zahlungsart,
Dokumenten-Nummernkreise und Branding, Katalog, Team, Publishable Key mit Origin-Restriction.

Nachweis: Testbestellung bis Rechnung, plus Beleg, dass ein Key dieses Shops keine Ressource
eines anderen Shops liefert.

Referenz: docs/agent/CUSTOMER_ONBOARDING.md
```

---

## 3. Feature im Commerce OS ändern

```text
Aufgabe: <Beschreibung>

Vorgehen:
1. Lies AGENTS.md, docs/agent/START_HERE.md und die lokale AGENTS.md im betroffenen Ordner.
2. Bestimme das Modul über docs/agent/modules.json.
3. Halte die Quellenhierarchie ein: Code vor Migrationen vor QA-Berichten vor Manifesten
   vor Dokumentation.
4. Folge dem passenden Ablauf in docs/agent/CHANGE_PLAYBOOK.md.
5. Grenzen: Mandantentrennung, RLS, Server-seitige Berechnung, Unveränderlichkeit von Belegen,
   keine Breaking Changes an der Store API v1.
6. Production: keine Seeds, keine QA-Läufe, keine Migration ohne Runbook und Backup,
   keine echten Zahlungen. Bei unklarer Umgebung stoppen und nachfragen.
7. Abschluss: "bun run verify" grün plus passender qa:*-Lauf gegen Dev, mit Nachweis.
```

---

## 4. Store-API-Endpunkt ergänzen

```text
Ergänze den Endpunkt <METHODE /pfad> in der Store API v1.

Pflicht:
- Handler in src/lib/commerce/store/routes.server.ts mit Rate-Profil und Autorisierungsstufe
- Shop-Bindung über ctx.key.shopId erzwingen
- Ausgabe ausschließlich über die Allowlist in mappers.server.ts
- Eintrag in api-catalog.ts (Zusammenfassung, Fehler, SDK-Aufruf)
- SDK-Methode in src/lib/store-sdk ergänzen, ohne bestehende Signaturen zu brechen
- Additiv bleiben: v1 darf nicht gebrochen werden

Abschluss: bun run generate:manifests && bun run verify && bun run qa:store-api
```

---

## 5. Onboarding-Selbsttest für einen neuen Agenten

```text
Beantworte ausschließlich anhand dieses Repositories, ohne Rückfragen:
1. Was ist dieses Projekt und welche Stack-Bausteine nutzt es?
2. Wie startet man es lokal und braucht man dafür eine Datenbank?
3. Wo liegt die Preis-, Steuer- und Bestandslogik?
4. Wie bindet eine externe Storefront das System an — und wie wird das SDK derzeit eingebunden?
5. Braucht ein neuer Storefront-Kunde eine eigene Datenbank? Wann braucht ein Kunde eine?
6. Welche Regeln gelten für Production?
7. Welche Quelle gilt bei Widersprüchen zwischen Doku und Code?
8. Mit welchem Befehl weist man nach, dass die Änderung in Ordnung ist?

Nenne für jede Antwort die Datei, aus der sie stammt.
```
