# Phase 8 — Invoicing & Document Engine

Ziel: Aus einer Bestellung entstehen unveränderbare kaufmännische Dokumente (Rechnung, Gutschrift, Lieferschein) mit fortlaufenden Nummern, Snapshot-Prinzip, serverseitigem PDF und einer Architektur, die ZUGFeRD/XRechnung später ohne Neuberechnung erlaubt.

Kernfluss:

```text
Order + Tax Snapshot  ->  Invoice Snapshot (unveränderbar)
                              -> Document View Model
                                   -> Format Renderer (pdf | zugferd | xrechnung)
                                        -> document_files (Storage + Checksum)
```

## Datenmodell (neue Tabellen)

- `invoices`, `invoice_items` — Rechnungskopf/-positionen mit Seller-, Customer-, Order- und Tax-Snapshot; Nummer erst bei Ausstellung.
- `credit_notes`, `credit_note_items` — referenzieren immer genau eine Rechnung; Steuerbehandlung stammt aus dem Invoice-Snapshot, nie aus aktuellen Sätzen.
- `delivery_notes` — optional an ein Fulfillment gebunden, ohne Preis-/Steuerdaten.
- `document_sequences` — je Organisation/Shop/Dokumenttyp: Präfix, Suffix, `next_number`, Padding, Reset-Policy (`never | yearly | monthly`), aktuelle Periode.
- `document_files` — erzeugte Dateien: Typ, Format, Version, Storage-Pfad, MIME, Größe, SHA-256-Checksum, Generierungsstatus.
- `document_branding` — je Shop: Logo, Farben, Schrift, Absenderblock, Bankdaten, Footer, Anzeigeoptionen, Preset (`clean | compact | modern`).
- `invoice_settings` — je Shop: Unternehmens-/Steuerdaten, Bankverbindung, Zahlungsziel, `invoice_creation_strategy` (`manual | on_order_paid | on_order_created`), getrennte Flags `automatically_create_invoice` / `automatically_issue_invoice`, E-Rechnungs-Optionen.

Enums: `document_type`, `invoice_status` (draft, issued, partially_credited, credited, voided), `credit_note_status` (draft, issued, voided), `delivery_note_status`, `document_format`, `document_format_status` (not_generated, generated, validation_failed), `sequence_reset_policy`. Dokumenttypen für Proforma, Angebot, Retoure, Zahlungsbeleg und Storno werden im Enum bereits angelegt, aber nicht implementiert.

Alle Tabellen: GRANTs, RLS auf Organisationszugehörigkeit plus Permission-Check, Trigger, der ausgestellte Dokumente und deren Positionen gegen UPDATE/DELETE fachlicher Felder sperrt. Unique-Invariante: höchstens eine nicht-verworfene Hauptrechnung je Order; Dokumentnummern unique je Organisation und Typ.

Neuer privater Storage-Bucket `documents` (tenant-präfixierte Pfade, kein öffentlicher Zugriff).

## Transaktionssichere Logik (SQL, SECURITY DEFINER)

- `doc_next_number(org, shop, type)` — sperrt die Sequenzzeile, wendet die Reset-Policy an, gibt formatierte Nummer zurück. Keine Nummer im Client, keine Wiederverwendung.
- `invoice_create_from_order(...)` — prüft Tenant, Rechnungsfähigkeit, vorhandenen Tax-Snapshot, Rechnungsadresse und vollständige Verkäuferdaten; erzeugt Draft plus Positionen (Produkt, Versand, Rabatt) aus dem Order-Snapshot. Idempotent über `idempotency_keys`.
- `invoice_issue(...)` — atomar: Validierung, Nummer, Ausstellungs-/Leistungs-/Fälligkeitsdatum, Snapshots einfrieren, Status `issued`, Audit-Eintrag, `outbox_events` mit `invoice.issued`.
- `credit_note_create` / `credit_note_issue` — serverseitig berechnetes Maximum (`Rechnung brutto − bereits gutgeschrieben`), setzt die Rechnung auf `partially_credited` bzw. `credited`.
- `delivery_note_create` — nur die tatsächlich im Fulfillment enthaltenen Positionen.
- `invoice_void`, `credit_note_void` für die fachlich zulässigen Fälle.

Refund und Gutschrift bleiben getrennt: ein Refund erzeugt niemals automatisch eine ausgestellte Gutschrift; optional (Setting) einen Draft.

## Rendering

- `document.viewmodel.ts` — baut aus jedem Dokument-Snapshot ein einheitliches View Model (`document`, `seller`, `recipient`, `header`, `positions`, `totals`, `taxes`, `payment`, `footer`, `branding`, `legal_notes`). Der Renderer kennt keine Datenbankstruktur.
- `InvoiceFormatRenderer`-Interface mit `format`, `validate(snapshot)`, `render(snapshot)`.
- `pdf.renderer.server.ts` mit `pdf-lib` (reines JavaScript, im Worker-Runtime lauffähig): A4, professionelle Typografie, mehrseitig mit wiederholtem Tabellenkopf, Seitenzahlen („Seite 1 von 3"), stabile Summenblöcke, Wasserzeichen „ENTWURF" bei Drafts, drei Presets.
- Nach Ausstellung wird das PDF einmalig erzeugt, mit Checksum in `document_files` abgelegt und beim Download nur noch geladen. Renderer-Verbesserungen erzeugen eine neue `version`-Zeile statt die alte Datei zu überschreiben.
- `zugferd`/`xrechnung`: Adapter-Stubs mit vollständigem Domain-Feldsatz (Buyer Reference, Leitweg-ID, Zahlungsbedingungen, Steuerkategorien, Einheiten) und Status `not_generated`. Es wird keine Datei erzeugt, die nicht validiert wurde.

Download ausschließlich über eine Server Function, die Tenant und Permission prüft und eine kurzlebige signierte URL zurückgibt.

## UI

- `/app/dokumente` — neuer Hauptnavigationspunkt mit Tabs Rechnungen / Gutschriften / Lieferscheine, Filtern nach Nummer, Kunde, Bestellung, Datum, Status und Betrag.
- `/app/dokumente/rechnungen/$invoiceId` — Kopfdaten, Beträge, Steueraufschlüsselung, Formatstatus je Format, verknüpfte Gutschriften, Timeline; Aktionen abhängig vom Status (Vorschau, Ausstellen, Verwerfen bzw. PDF öffnen, Download, Gutschrift erstellen, Versand vorbereitet).
- `/app/einstellungen/rechnungen` — geführte Einrichtung mit Setup-Check-Liste (Anschrift, Steuerangabe, Nummernkreis, Zahlungsinformationen). Ohne vollständige Pflichtangaben stellt die Automatik keine Rechnung aus.
- `/app/einstellungen/dokumente` — Branding-Editor mit Live-Vorschau, ohne HTML/CSS-Eingabe; Übernahme der Shop-CI als expliziter Kopiervorgang.
- Bestelldetail: Abschnitt „Dokumente" mit vorhandenen Belegen bzw. „Rechnung erstellen"; Fulfillment-Detail: „Lieferschein erstellen".

## Berechtigungen

Neue Permissions `invoices.read`, `invoices.manage`, `invoices.issue`, `invoices.credit`, `documents.settings` in `role_permissions`, analog zur bestehenden Rollenmatrix.

## Qualitätssicherung

`qa/phase8.ts` prüft: Draft ohne Nummer, Ausstellung vergibt genau eine Nummer, 100 parallele Ausstellungen ergeben 100 eindeutige Nummern ohne Lücken-Wiederverwendung, Snapshot-Unveränderbarkeit nach `issued`, Teil- und Vollgutschrift mit Statusübergängen, Überschreiten des Gutschriftlimits wird abgewiesen, Steuerwerte stammen aus dem Rechnungssnapshot, Lieferschein bei Teilversand enthält nur versandte Positionen, Tenant-Isolation beim Download, Checksum stimmt mit gespeicherter Datei überein. Zusätzlich visuelle PDF-Kontrolle (einseitig und mehrseitig) auf Umbrüche, Abschneidungen und Summen.

## Technische Hinweise

- PDF-Erzeugung mit `pdf-lib`; Standard-Fonts decken den westeuropäischen Zeichensatz inklusive Umlauten, ß und € ab. Für darüber hinausgehende Zeichensätze wird der Adapter so gebaut, dass später eine eingebettete TTF ergänzt werden kann.
- Alle Betragsfelder bleiben ganzzahlige Minor Units; Steuersätze in Basispunkten wie in Phase 6.
- Serverlogik als `createServerFn` in `src/lib/commerce/documents/*.functions.ts`, Datenzugriff in `*.server.ts`.
