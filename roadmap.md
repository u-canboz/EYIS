# Roadmap

## Offen

- [ ] Blackbox-Erstinstallation in einem frischen, leeren Lovable-Projekt durchführen (nur über den Agent Migration Plan, 50 Schritte).
- [ ] Nach PASS: v1.0.0 promoten (exakt getesteter Commit und Artefakt-Digest).
- [ ] Danach: Update-Setup-Assistent, echter Update-Test v1.0.0 → v1.0.1, Freigabe Update Center.
- [ ] Fehlgeschlagenes Projekt „EYIS Setup“ nur read-only als Fehlernachweis behalten; kein Baseline-Overlay.

## Erledigt

- [x] Blackbox-Befund „öffentlich aufrufbare Funktionen“ upstream behoben: Install Pack entzieht jeder Datenbankfunktion das Default-Ausführungsrecht, pg_net liegt nicht mehr im öffentlichen Bereich, Regressionstest ergänzt.

- [x] Installationsauftrag auf den Weg über das Plattform-Migrationstool vereindeutigt (Betriebsart C, Zielprojekt-Prompt).
