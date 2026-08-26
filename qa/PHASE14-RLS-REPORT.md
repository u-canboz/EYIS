# Phase 14 — Gate A4: Datenbank-, RLS-, RPC- und Storage-Sicherheitsinventur

Durchgeführt im Rahmen des Production Hardening. Keine neuen Funktionen.
Nachweisdateien: `qa/phase14-rls.ts` (Prüfskript), `qa/results-phase14-rls.json`
(Rohergebnisse), `docs/production/DATABASE_SECURITY_MATRIX.md` (vollständige
Matrix, direkt aus dem Datenbankkatalog erzeugt).

## Ergebnis

**52 von 52 Prüfungen bestanden.** Kein Punkt ist ohne konkreten Nachweis als
bestanden markiert; jede Prüfung führt ihr Beweismittel in der JSON-Datei mit.

Die Prüfungen laufen zweigleisig:

1. **Strukturell** gegen den Datenbankkatalog — RLS-Status, Policies, GRANTs,
   Indizes, Fremdschlüssel, Trigger, `search_path`, Storage-Konfiguration.
2. **Verhaltensbasiert** als real angemeldeter Nutzer der zweiten Organisation
   sowie als anonymer Besucher — Lesen, Ändern, Löschen, Anlegen, RPC-Aufrufe
   und Storage-Zugriffe über Mandantengrenzen hinweg.

## Behobene Findings

### 1. Pauschale Tabellenrechte für `anon` und `authenticated` (HOCH)

Alle 112 Tabellen gewährten den Rollen `anon` und `authenticated` sämtliche
Rechte inklusive `TRUNCATE`, `REFERENCES` und `TRIGGER`. Row Level Security
verhinderte zwar jeden tatsächlichen Datenabfluss — die Verhaltenstests belegen
das —, aber es fehlte die zweite Verteidigungslinie: eine einzige zu weit
gefasste Policy hätte sofort vollen Tabellenzugriff bedeutet.

Behoben: Rechte vollständig entzogen und neu vergeben. `anon` hat jetzt keinerlei
Tabellenrechte. `authenticated` erhält pro Tabelle nur die Operationen, für die
tatsächlich eine Policy existiert. Zusätzlich wurden die Standardrechte für
künftige Objekte an `anon` entzogen.

Wichtiger Nebenbefund: Die ursprüngliche Prüfung über `information_schema`
meldete fälschlich „keine anon-Rechte“, weil diese Sicht nur Rechte der
aufrufenden Rolle zeigt. Die Prüfung läuft jetzt über die tatsächliche
Katalog-ACL (`pg_class.relacl`) und kann nicht mehr blind sein.

### 2. `profiles_select_self` — offene Namen und E-Mail-Adressen (offener A3-Punkt)

Bisher konnte jedes Mitglied einer Organisation Namen und E-Mail-Adressen aller
Mitglieder lesen. Die Sichtbarkeit ist jetzt auf das eigene Profil sowie auf
Nutzer mit dem Recht `settings.manage` beschränkt, geprüft über die Funktion
`can_view_profile`.

Nachweis: Nutzer B sieht genau ein Profil (das eigene); das Profil von Nutzer A
ist nicht lesbar; `can_view_profile` liefert für fremde Nutzer `false`.

### 3. `customer_addresses_self` — eine Sammelregel für alles (offener A3-Punkt)

Die frühere `FOR ALL`-Regel wurde durch vier getrennte Regeln ersetzt (Ansehen,
Anlegen, Ändern, Löschen). Anlegen und Ändern erzwingen jetzt, dass
Organisation und Shop zur Kundschaft passen; ein Umhängen auf eine fremde
Kundschaft ist nicht mehr möglich, gesperrte und archivierte Kundschaften sind
ausgeschlossen.

Nachweis: vier getrennte Policies, keine davon vom Typ `ALL`; zwei davon mit
Mandantenprüfung im `WITH CHECK`.

### 4. Fehlende Zugriffsindizes

Sechs Tabellen (`order_items`, `order_promotions`, `return_media`,
`return_sequences`, `shop_order_sequences`, `outgoing_webhook_endpoints`) hatten
außer dem Primärschlüssel keinen Index. Da jede Zugriffsregel nach Organisation
oder Elternschlüssel filtert, hätte das unter Last zu vollständigen
Tabellenscans geführt. Indizes wurden ergänzt.

### 5. Überflüssige Ausführungsrechte auf internen Funktionen

Acht Trigger-Funktionen hatten noch ein `PUBLIC`-Ausführungsrecht. Entzogen.
Ergebnis heute: `anon` darf keine einzige Funktion im Schema `public`
ausführen, `authenticated` genau die sieben RLS-Hilfsfunktionen.

## Geprüfte Bereiche im Überblick

| Bereich | Ergebnis |
| --- | --- |
| RLS auf allen 112 Tabellen aktiv | bestanden |
| Tabellen ohne Policy sind ausschließlich server-only Systemtabellen | bestanden |
| Keine Tabellenrechte für `anon`, keine `PUBLIC`-Rechte | bestanden |
| `authenticated` nur mit Rechten, für die eine Policy existiert | bestanden |
| Keine Views oder Materialized Views, die RLS umgehen könnten | bestanden |
| Fester `search_path` auf allen 86 SECURITY-DEFINER-Funktionen | bestanden |
| Kein dynamisches SQL in Datenbankfunktionen | bestanden |
| `organization_id` überall per Fremdschlüssel gebunden und indiziert | bestanden |
| Unique-Regeln für Mitgliedschaften und offene Einladungen | bestanden |
| Append-only-Trigger auf Audit-Log, Lagerbewegungen, Zahlungsereignissen, Steuer-Snapshots | bestanden |
| Cross-Tenant-Lesen über 43 Kern-Tabellen | kein einziger Treffer |
| Manipulierte IDs (Bestellung, Produkt, Shop, Kundenadresse) | jeweils abgewiesen |
| Schreiben, Ändern, Löschen in fremder Organisation | jeweils abgewiesen |
| Selbstbeförderung über `memberships` und `role_permissions` | abgewiesen |
| Audit-Log gegen Änderung und Löschung | unverändert, 0 manipulierte Einträge |
| 12 privilegierte Datenbankfunktionen als angemeldeter Nutzer | alle abgewiesen |
| Hilfsfunktionen liefern für fremde Organisation keine Rechte | bestanden |
| Storage: fremde Mandantenordner auflisten, laden, signieren, hochladen | jeweils abgewiesen |
| Anonymer Zugriff auf Produkte, Bestellungen, Kundschaft, Preise, Schlüssel, Profile, Rechnungen | keine Daten |

## Regressionsprüfung nach der Rechteverschärfung

Weil der Entzug der Tabellenrechte tief eingreift, wurden alle bestehenden
Prüfsuiten erneut ausgeführt:

| Suite | Ergebnis |
| --- | --- |
| `qa/phase14-security.ts` (Gate A3) | 32/32 bestanden |
| `qa/e2e.ts` (Cart → Checkout → Zahlung → Bestellung) | 46/46 bestanden |
| `qa/phase12.ts` (Store-API, Schlüssel, Rate-Limits) | 52/52 bestanden |
| Admin-Oberfläche (Anmeldung, Übersicht, Produkte, Bestellungen, Team) | lädt fehlerfrei, keine Konsolenfehler |
| Kundenportal (`/portal`, `/portal/gast`) | lädt fehlerfrei |

## Bewusst akzeptierte Punkte

- **Sechs Tabellen mit RLS ohne Policy** (`outbox_events`, `idempotency_keys`,
  `automation_rule_counters`, `store_api_rate_counters`,
  `store_confirmation_tokens`, `store_privacy_salts`). Das ist die schärfste
  mögliche Einstellung: über die Daten-API ist gar kein Zugriff möglich, nur
  serverseitig. Der Datenbank-Linter meldet dies als Hinweis; die Meldung bleibt
  bestehen und ist gewollt.
- **Sieben SECURITY-DEFINER-Funktionen für angemeldete Nutzer ausführbar**
  (`has_permission`, `is_org_member`, `has_org_role`, `current_org_ids`,
  `shares_org_with`, `shop_in_org`, `can_view_profile`). Die Zugriffsregeln
  selbst benötigen sie. Sie geben ausschließlich Ja/Nein-Antworten zur eigenen
  Mitgliedschaft und legen keine fremden Daten offen — nachgewiesen durch die
  Aufrufe gegen die fremde Organisation.
- **Eine Erweiterung im Schema `public`.** Plattformseitig vorgegeben, keine
  Handlungsmöglichkeit im Projekt.

## Offene Punkte (unverändert BLOCKIEREND für Go-live)

| Punkt | Stand | Herkunft |
| --- | --- | --- |
| Dev, Staging und Production teilen eine Datenbank | offen, blockierend | Gate A2 |
| Dateityp-Allowlist auf Storage-Bucket-Ebene nicht setzbar | akzeptiert, Ersatz in der Anwendungsschicht belegt | Gate A4 |
| Stripe-Livebetrieb, E-Mail-Versand, Carrier-Anbindung | BLOCKIERT, keine Zugangsdaten | Gate A1/A2 |
| CSP weiterhin nur im Report-Only-Modus | offen, geplant nach Auswertung | Gate A3 |

## Fazit

Gate A4 ist abgeschlossen. Die Mandantentrennung hält in allen 52 Prüfungen —
strukturell wie im tatsächlichen Verhalten. Der wichtigste Fund dieses Gates war
nicht ein Datenleck, sondern eine fehlende zweite Verteidigungslinie: Die
Datenbank verließ sich vollständig auf Row Level Security. Das ist jetzt
korrigiert.
