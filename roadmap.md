# Roadmap

## Offen

### Shop-Funktionen (aus dem genehmigten Plan, noch nicht umgesetzt)
- [ ] B1–B3: serverseitige Katalogfilter (Preis, Verfügbarkeit), Sortierung `price_asc`/`price_desc`, Suche über Marke/Produktart/Kategorie inkl. pflegbarer Synonyme.
- [ ] B5/B6: pflegbare Storefront-Inhalte und Rechtstexte (Tabellen mit RLS, Backoffice-Bereich, additive Endpunkte `/content/blocks`, `/content/pages/{handle}`).
- [ ] Google: direkte Merchant-API-Anbindung (OAuth, Synchronisierung, Fehlerprotokoll) — der Datei-Feed ist fertig.
- [ ] Feed-Praxistest gegen Merchant Center (Bildabruf, Preise, Lagerstatus) sobald ein Shop mit echten Produkten steht.

### Release-Kette
- [ ] Blackbox-Erstinstallation in einem frischen, leeren Lovable-Projekt durchführen (nur über den Agent Migration Plan).
- [ ] Nach PASS: v1.0.0 promoten (exakt getesteter Commit und Artefakt-Digest).
- [ ] Danach: Update-Setup-Assistent, echter Update-Test v1.0.0 → v1.0.1, Freigabe Update Center.
- [ ] Fehlgeschlagenes Projekt „EYIS Setup“ nur read-only als Fehlernachweis behalten; kein Baseline-Overlay.

### Blockiert (fehlende Zugangsdaten)
- [ ] Stripe Live, echter E-Mail-Versand (SMTP), echte Carrier-Labels.

## Erledigt

- [x] Blackbox-Befund „öffentlich aufrufbare Funktionen“ upstream behoben: Install Pack entzieht jeder Datenbankfunktion das Default-Ausführungsrecht, pg_net liegt nicht mehr im öffentlichen Bereich, Regressionstest ergänzt.

- [x] Installationsauftrag auf den Weg über das Plattform-Migrationstool vereindeutigt (Betriebsart C, Zielprojekt-Prompt).
