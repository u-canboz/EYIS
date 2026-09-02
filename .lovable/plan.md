# Update Center + Dedicated Installation — Diagnose & maximale Automatik

## Ausgangslage

Das Update Center funktioniert nachweisbasiert: Jeder Transportweg (GitHub-Auth,
Workflow im Kunden-Repo, Hosting, Deployment-Health, Migrationen, Signatur,
Backup) muss real geprüft sein, sonst steht die betreffende Fähigkeit auf
**SETUP REQUIRED** und Updates werden gesperrt. Das ist Absicht (kein Fake-PASS),
aber im Kundenprojekt gibt es bisher **keine geführte Einrichtung**: Der Betreiber
muss bis zu 8 Umgebungsvariablen und einen GitHub-Workflow manuell korrekt
kombinieren, ohne zu sehen, welcher einzelne Nachweis fehlt oder warum.

Zielzustand: Einmal einrichten, danach laufen Installation und jedes Update
ohne manuelle Eingriffe. Drei Dinge lassen sich **nicht** automatisieren und
werden ehrlich als manuelle Einmalschritte geführt: GitHub-Zugangsdaten,
Repo-Secrets für Migrationen, Backup-Nachweis. Alles andere wird automatisch
erkannt oder vorbefüllt.

## Arbeitspakete

### 1. Diagnose — Ist-Zustand beider Projekte belegen

- Hier (Hauptprojekt): `eyis:blackbox:simulate`, `qa:install-pack`,
  `qa:blackbox-preflight` laufen lassen; Update-Overview live prüfen und
  festhalten, welche Fähigkeiten SUPPORTED bzw. SETUP_REQUIRED sind.
- Für das Kundenprojekt: Diagnose-Pfad schaffen, der ohne Shell-Zugang
  funktioniert — siehe Paket 2 (Setup-Assistent mit Selbstdiagnose) und
  `installer/eyis.ts doctor` als CLI-Alternative.

### 2. Setup-Assistent im Update Center (Kernstück)

Neuer Bereich „Einrichtung" auf `/app/system/updates`, der den Betreiber
durch exakt die fehlenden Nachweise führt:

- **Schritt-für-Schritt-Karte** pro Fähigkeit (Auth → Registry → Code →
  Deployment → Migration → Backup), jeweils mit Live-Prüfung („Jetzt prüfen"),
  verständlicher Begründung und konkretem nächsten Schritt.
- **Auto-Erkennung** dessen, was die Instanz selbst weiß: Hosting-Variante,
  Health-URL der eigenen Installation, Release-Registry, Trust Anchor —
  Vorschläge werden automatisch befüllt und nur noch bestätigt.
- **Persistenter Setup-Stand** in `commerce_installation.update_config`:
  erledigte Schritte bleiben sichtbar, wiederholte Prüfungen sind idempotent.
- **Diagnose-Export**: ein Knopf erzeugt einen vollständigen, secrets-freien
  Bericht (welche Prüfung, Status, Detail, Remediation) zum Kopieren — damit
  ist jede Kundenprojekt-Blockade mit einer Nachricht hier diagnostizierbar.

### 3. Automatik-Grad erhöhen, ohne die Nachweis-Disziplin aufzuweichen

- Defaults dort setzen, wo sie eindeutig sind (`EYIS_RELEASE_REPO`,
  Hosting-Erkennung, Health-URL), damit nur noch wirklich unvermeidbare
  Variablen manuell gesetzt werden müssen.
- Klare Statussemantik in der UI: „vollautomatisch bereit" vs. „manueller
  Schritt nötig (Publish bei Lovable-Hosting)" — letzteres bleibt benannt,
  nicht versteckt.
- Keine Änderung an den Sperrlogiken selbst (Preflight, Single-Active-Run,
  Backup-Nachweis) — die sind gewollt.

### 4. Installer-Seite (Dedicated Installation)

- `installer/eyis.ts status` und `doctor` um einen Hinweis-Block „Update Center
  einrichten" ergänzen: nach erfolgreicher Installation zeigt der Installer
  direkt die als Nächstes fehlenden Update-Nachweise an.
- Template-Workflow `templates/customer-repo/.github/workflows/eyis-update.yml`:
  Platzhalter-SHAs und benötigte Repo-Secrets in einer Setup-Checkliste
  im Assistenten spiegeln (keine Codeänderung am Workflow nötig, nur Führung).

### 5. QA & Nachweise

- Neue/erweiterte Tests: Setup-Assistenten-Logik (Auto-Erkennung, Persistenz,
  Idempotenz), Diagnose-Export enthält keine Secrets.
- `bun run verify` komplett grün; Bericht der Diagnose aus Paket 1 als
  Anhang im Abschluss.

## Bewusst außen vor

- Keine neuen Features außerhalb Setup/Diagnose/Update-Transport.
- Kein Gate-C-Ausbau (Staging, Provider-Live-Schaltung).
- Keine Aufweichung der Production-Sperren (Backup-Nachweis, Signatur,
  Single-Active-Run).
- Lovable-Publish bleibt ein manueller Schritt — es gibt keinen
  programmatischen Publish-Endpunkt; die UI nennt das offen.

## Technische Anker

- Orchestrion: `src/lib/commerce/updates/update-center.server.ts`,
  Fähigkeitsproben: `providers.server.ts` (`probeCapabilities`), UI:
  `src/routes/_authenticated/app/system/updates.tsx`, Installer-CLI:
  `installer/eyis.ts`, Setup-Persistenz: Tabelle `commerce_installation`
  (`update_config`, kein neues Schema nötig).
