# Erstinstallation stabilisieren, danach Update-Transport bedienbar machen

## Zielsatz

Einmal EYIS installieren und den Update-Transport einrichten. Danach laufen
zukünftige EYIS-Updates weitgehend automatisch. Erstinstallation und
Update Center bleiben strikt getrennt — zwei Prozesse, zwei Oberflächen,
eine gemeinsame Diagnosequelle.

## Ausführungsregel (verbindlich)

Beginne ausschließlich mit Schritt 1. Schritte 2 bis 5 sind derzeit gesperrt.
Keine Arbeiten am Update-Setup-Assistenten, bevor **EYIS FULL BLACKBOX
INSTALL PASS** nachgewiesen ist. Erst wenn ein Schritt nachgewiesen
abgeschlossen ist, wird der nächste begonnen.

## Reihenfolge

1. Erstinstallation Blackbox PASS
2. EYIS v1.0.0
3. Capability-Matrix + Update-Setup-Assistent
4. echter Test v1.0.0 → v1.0.1
5. erst danach gilt das Update Center als produktionsreif

---

## Schritt 1 — Erstinstallation Blackbox PASS

Ziel: nachweisen, dass EYIS zuverlässig erstmals in ein fremdes Projekt
installiert werden kann — ohne Update-Transport, ohne GitHub, ohne Secrets.

### Harte Blackbox-Definition

Ein PASS aus dem EYIS-Hauptrepository allein reicht ausdrücklich nicht.
Schritt 1 gilt ausschließlich dann als bestanden, wenn die Installation in
einer vom EYIS-Hauptrepository isolierten Zielumgebung durchgeführt wurde.

Verboten während des Nachweises:

- fehlende Dateien aus dem Hauptrepository nachladen
- Imports manuell korrigieren
- SQL manuell reparieren
- Integration-Patches nachbearbeiten
- Manifeste korrigieren
- nicht dokumentierte Abhängigkeiten ergänzen
- einen Fehler umgehen und anschließend PASS melden

### Finaler Nachweis (Mindestumfang)

```text
Release/Install-Pack:     PASS
Distribution:             PASS
Dependencies:             PASS
Integration Patches:      PASS
Pre-DB Build:             PASS
Migrationen vollständig:  PASS
Migration Journal:        PASS
Schema Fingerprint:       PASS
System Seed Fingerprint:  PASS
Bootstrap:                PASS
Owner:                    PASS
Doctor Kernprüfungen:     PASS
Final Build:              PASS
Manuelle Reparaturen:     0
```

Erst dann lautet der Status: **EYIS FULL BLACKBOX INSTALL PASS**.

Fingerprints bleiben Abschlusskriterium: `schema_fingerprint` **und**
`system_seed_fingerprint` müssen PASS melden. Struktur allein zählt nicht.
Gefundene Defekte werden minimal behoben — keine neuen Features, keine
Architekturänderung. Jede Behebung setzt den Blackbox-Lauf vollständig
zurück; ein PASS gilt nur aus einem einzigen, ununterbrochenen Lauf.

## Schritt 2 — EYIS v1.0.0 (gesperrt bis Schritt 1 PASS)

### Promotion-Regel

Der als `v1.0.0` veröffentlichte Stand muss exakt dem vollständig
blackbox-getesteten Kandidaten entsprechen.

Zwischen erfolgreichem Blackbox-Test und Stable-Promotion verboten:

- keine Codeänderung
- keine Manifeständerung
- keine Migration
- keine Dependency-Änderung
- keine neue Artefakt-Zusammensetzung

Der getestete Commit-SHA und die getesteten Artefakt-Digests werden im
Promotion-Nachweis festgehalten. Stable darf nicht aus einem nachträglich
veränderten Working Tree entstehen — sonst testen wir Paket A und
veröffentlichen Paket B.

Release-Kette unverändert nutzen (Pack signieren → Tarball → Manifest →
Ed25519-Signatur → Trust Anchor gepinnt). Keine Änderung an Signatur- oder
Promotion-Logik in diesem Schritt.

## Schritt 3 — Capability-Matrix + Update-Setup-Assistent (gesperrt bis v1.0.0)

### Zentrale Capability-Matrix (Single Source of Truth)

`probeCapabilities()` bleibt die **einzige** Stelle, die Zustände berechnet;
UI, Doctor und CLI konsumieren nur noch dasselbe Ergebnis — keine eigenen
Ableitungen, Divergenz wird per Test verhindert.

```text
probeCapabilities()
        │
   ┌────┼────┐
  UI  Doctor CLI
```

Jede Capability trägt neben dem Status **Beweis und Zeitpunkt** — ein grünes
Häkchen bedeutet „das wurde geprüft", nicht „die Software glaubt, dass es
funktioniert":

```text
github_auth
  status: PASS
  verified_at: ...
  evidence: ...
  remediation: null

migration_transport
  status: SETUP_REQUIRED
  verified_at: ...
  evidence: "Secret nicht konfiguriert"
  remediation: "..."
```

Matrix-Schlüssel und Zustände (PASS / SETUP_REQUIRED / MANUAL / FAIL):

```text
release_registry       PASS
trust_anchor           PASS
github_auth            SETUP_REQUIRED
customer_repository    SETUP_REQUIRED
deployment_workflow    SETUP_REQUIRED
migration_transport    SETUP_REQUIRED
backup_restore         SETUP_REQUIRED
deployment_health      PASS
lovable_publish        MANUAL
```

`lovable_publish` ist ein eigener Zustand `MANUAL` — kein Fehler, kein
verstecktes PASS. Es gibt keinen programmatischen Publish-Endpunkt.

### Update-Setup-Assistent (nur Update Center)

Eigener Bereich „Update Center einrichten" auf `/app/system/updates` —
**nicht** vermischt mit der Erstinstallation.

```text
Update Center einrichten
  ✓ EYIS Release Registry
  ✓ Trust Anchor
  ✓ Hosting erkannt
  ✓ Health Endpoint
  ! GitHub-Zugang verbinden
  ! Migration-Secrets hinterlegen
  ! Backup bestätigen
  → Einrichtung abschließen
```

- Pro Eintrag: Live-Prüfung („Jetzt prüfen"), verständliche Begründung,
  konkreter nächster Schritt.
- Auto-Erkennung statt Handeingabe, wo die Instanz es selbst weiß: Hosting,
  eigene Health-URL, Release-Registry, Trust Anchor.
- Secrets-freier Diagnose-Export zum Kopieren (Prüfung, Status, Detail,
  Remediation, verified_at) — damit ist jede Blockade im Kundenprojekt aus
  der Ferne diagnostizierbar.
- Keine Aufweichung bestehender Gates: Preflight, Single-Active-Run,
  Backup-Nachweis, Signaturprüfung bleiben unverändert.

### Datenhaltung — bewusst eng gefasst

`commerce_installation.update_config` nimmt ausschließlich ungefährliche
Einstellungen und Statusinformationen auf:

```text
repository
update_channel
hosting_type
health_url
setup_progress
last_verified_at
capability_status
```

Alles Sicherheitsrelevante (GitHub-Token, App Private Key, Migrations-
Zugangsdaten) bleibt ausschließlich im Secret-/Vault-System und wird nie in
diese Spalte geschrieben, nie geloggt und nie exportiert. Ein Test erzwingt,
dass Diagnose-Export und `update_config` keine Secrets enthalten.

## Schritt 4 — Echter Update-Test v1.0.0 → v1.0.1 (gesperrt bis Schritt 3)

- Minimales v1.0.1 erzeugen und den vollen Lauf gegen eine Nicht-Production-
  Installation fahren: preflight → backup → code → database → deployment →
  doctor.
- Jeder Schritt braucht echten Nachweis; ein übersprungener Schritt wird als
  `skipped` mit Begründung geführt, nicht als PASS.

## Schritt 5 — Freigabe

Update Center gilt erst nach bestandenem Schritt 4 als produktionsreif.
Der Bericht hält je Fähigkeit den belegten Zustand samt `verified_at` und
`evidence` fest.

---

## Bewusst außen vor

- Keine neue Update-Architektur — Bedien- und Automatisierungsschicht über
  dem bestehenden System.
- Kein Gate-C-Ausbau (Staging, Live-Provider-Schaltung).
- Keine Vermischung von Installations- und Update-Assistent.
- Keine Aufweichung der Production-Sperren.
- Keine parallele Arbeit an späteren Schritten, solange ein früherer offen
  ist.

## Technische Anker

- Fähigkeitsproben: `src/lib/commerce/updates/providers.server.ts`
  (`probeCapabilities`) — wird zur alleinigen Quelle (Schritt 3).
- Orchestrierung: `src/lib/commerce/updates/update-center.server.ts`
- UI: `src/routes/_authenticated/app/system/updates.tsx`
- Doctor/CLI: `installer/eyis.ts`, `scripts/commerce-doctor.ts`
- Installationsstrecke: `installer/database/**`, `scripts/eyis-*.ts`
- Persistenz: `commerce_installation.update_config` (kein neues Schema)
