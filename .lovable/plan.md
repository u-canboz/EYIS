# EYIS-Erstinstallation in Lovable zuverlässig abschließen

## Bestätigter Ist-Zustand

Im Projekt **„EYIS Setup“** (Snapshot `0989f501`) ist die Installation nicht nur an einer einzelnen RLS-Regel hängen geblieben:

- Das Projekt enthält weiterhin die Lovable-Leer-App.
- EYIS-Anwendungscode, Installer, Install-Pack, Agent Migration Plan, QA und Betriebsdokumentation fehlen.
- Die Datenbank-Typen enthalten bereits EYIS-Tabellen; die Datenbank wurde also teilweise verändert.
- Der dort hinterlegte Installationsplan verlangt fälschlich das Abspielen der historischen Migrationen und direkte Datenbankausführung.
- Der aktuelle EYIS-Installationsvertrag verlangt für eine frische Lovable-Cloud-Instanz dagegen den **signierten Install-Pack** und **53 unveränderte, einzeln über das offizielle Migrationstool ausgeführte Schritte**.

Damit ist `sandbox_exec` nicht die eigentliche Produktursache. Der Fehler entstand, weil ein für Lovable Cloud ungeeigneter Installationsweg verwendet wurde. Weitere Wiederholungen desselben Laufs sind gesperrt.

## Ziel

EYIS ist in einem frischen, leeren Lovable-Projekt direkt installierbar und läuft dort anschließend als eigenständige Backend-Engine, an die ein neu gebauter Shop angebunden wird.

Das heißt konkret:

- Installation ohne manuelle SQL-, Import-, Abhängigkeits- oder Code-Reparaturen.
- Nach der Installation stehen Backoffice, Datenbank, Anmeldung und die Store API v1 im Zielprojekt bereit.
- Ein neuer Shop wird nicht in die Datenbank hineinkopiert, sondern spricht ausschließlich über die Store API v1 und das Store SDK mit dieser Engine.

Abschlussstatus: `EYIS FULL BLACKBOX INSTALL PASS`

## Was am Installationsweg tatsächlich repariert werden muss

Die Fehlversuche zeigen einen Ablauf-, keinen Fachlogikfehler. Vor dem nächsten Lauf wird deshalb im EYIS-Hauptprojekt sichergestellt:

- Der ausgelieferte Installationsauftrag beschreibt ausschließlich den Weg über das offizielle Lovable-Migrationstool. Der Weg über direkte Datenbankausführung wird als in Lovable Cloud nicht verfügbar gekennzeichnet.
- Der Installationsauftrag enthält keinen Hinweis mehr auf das Abspielen der historischen Migrationskette.
- Installer, Install-Pack, Agent Migration Plan und Betriebsbefehle gehören zum Pflichtlieferumfang und werden vor der ersten Datenbankänderung auf Vollständigkeit geprüft; fehlen sie, wird gestoppt.
- Der auszugebende Startprompt für ein frisches Projekt wird an genau diesen Ablauf angeglichen.



## Vorgehen

### 1. Fehlgeschlagenen Zielstand sichern und klassifizieren

- „EYIS Setup“ nicht weiter beschreiben.
- Read-only feststellen, welche EYIS-Objekte und Journalstände tatsächlich existieren und ob Shop-/Kundendaten angelegt wurden.
- Den Stand als `PARTIAL_INSTALL` dokumentieren; kein Baseline-Overlay und kein blindes Löschen.
- Falls Kundendaten existieren oder Ownership nicht eindeutig ist: bestehendes Projekt ausschließlich als Fehlernachweis behalten.

### 2. Frisches isoliertes Ziel verwenden

- Für den verbindlichen Blackbox-Nachweis ein neues, leeres Lovable-Projekt mit eigener aktivierter Cloud verwenden.
- Keine Migrationen oder Dateien aus dem beschädigten Projekt übernehmen.
- Exakt den eingefrorenen RC.8-Commit und dessen signierte Artefakt-Digests verwenden; kein bewegliches `main`.

### 3. Lieferpaket vor jeder Datenbankänderung vollständig prüfen

- Signatur ausschließlich gegen den gepinnten EYIS Trust Anchor prüfen.
- Vollständigkeit von Code-Distribution, Install-Pack, Ressourcen und Abhängigkeitsmanifest prüfen.
- EYIS-Code und Abhängigkeiten automatisiert übernehmen.
- Integration-Patches automatisiert anwenden.
- Pre-DB-Build muss PASS sein. Bei Fehlern wird gestoppt; die Datenbank bleibt leer.

### 4. Datenbank ausschließlich über den Agent Migration Plan installieren

- `bun run installer/eyis.ts plan` muss exakt 53 Schritte liefern.
- Für jeden Schritt wird das unveränderte SQL aus `bun run installer/eyis.ts step <n>` an das offizielle Lovable-Migrationstool übergeben.
- Reihenfolge: 46 Baseline-Units → 5 System-Seeds → Migration-History-Reconciliation → Abschluss.
- Keine direkte `psql`-/`sandbox_exec`-Ausführung, keine historische Migrationskette, kein Zusammenkopieren oder Umschreiben von SQL.
- Nach jedem Schritt Journaleintrag und Checksumme prüfen; bei Unterbrechung beim ersten offenen Schritt fortsetzen, nicht erneut bei Schritt 1 beginnen.
- Ein abgelehnter Schritt bleibt FAIL und wird im EYIS-Hauptprojekt minimal korrigiert; keine Reparatur im Zielprojekt.

### 5. Plattformressourcen und Bootstrap

- Erforderliche private Buckets über die Plattformwerkzeuge anlegen; niemals per SQL.
- Projektlokale Secrets erzeugen, ohne Werte zu protokollieren oder zu übertragen.
- Dedicated Bootstrap einmal ausführen und Installation-Singleton, Owner-Vormerkung, Organisation, Hauptshop und Default Settings prüfen.
- Mit einem realen isolierten Auth-Testnutzer Owner-Claim und erneute Bootstrap-Ausführung prüfen.

### 6. Vollständige Abnahme

Der Lauf gilt nur bei einem durchgehenden Nachweis als bestanden:

```text
Release/Install-Pack:       PASS
Distribution:               PASS
Dependencies:               PASS
Integration Patches:        PASS
Pre-DB Build:               PASS
Migration Steps:            53/53 PASS
Migration Journal:          PASS
Schema Fingerprint:         PASS
System Seed Fingerprint:    PASS
RLS / Grants:               PASS
Storage:                    PASS
Bootstrap / Idempotenz:     PASS
Owner / Auth:               PASS
Organization / Main Shop:   PASS
Doctor Kernprüfungen:       PASS
Store API HTTPS:            PASS
Commerce Smoke:             PASS
Jobs / Cron:                PASS
Final Build:                PASS
Manual Code/SQL Repairs:    0
```

Commerce Smoke umfasst Produkt → Variante → Preis → Bestand → Warenkorb → Checkout mit Test-Provider → Bestellung → Bestandsbuchung.

### 7. Shop-Anbindung nachweisen

- Im installierten Zielprojekt einen Publishable Key mit Origin-Beschränkung erzeugen.
- Aus einem getrennten Frontend-Projekt über Store API v1 und Store SDK Katalog, Warenkorb und Checkout abrufen.
- Damit ist belegt, dass die Installation als Backend-Engine für neu gebaute Shops nutzbar ist.
- Das Shop-Frontend erhält ausschließlich API-Adresse und Publishable Key — keinen Datenbankzugang.

### 8. Ergebnis und Rückwirkung

- Nur bei vollständiger Liste: `EYIS FULL BLACKBOX INSTALL PASS — READY FOR v1.0.0`.
- Bei Fehler: exakten Schritt, Plattformmeldung, Pack-/Commit-Digest und Journalstand sichern; Status FAIL, niemals simuliertes PASS.
- Ein nachgewiesener Produktdefekt wird ausschließlich im EYIS-Hauptprojekt minimal behoben, neu signiert und erzwingt einen komplett neuen Lauf in einem wieder leeren Ziel.
- Erst nach diesem PASS werden v1.0.0, Update-Setup-Assistent und Update-Test freigegeben.


## Technische Leitplanken

- Betriebsart C: vollständig isolierte EYIS-Instanz.
- Keine Änderung an Commerce-Fachlogik oder Architektur.
- Keine Demo-Seeds, Live-Zahlungen oder echten Kundendaten.
- Keine Änderung an Secrets oder Providern ohne gesonderte Freigabe.
- Der beschädigte Cluster wird nicht automatisch gelöscht; Recovery ist erst nach eindeutiger Ownership- und Datenprüfung zulässig.
- Die eigentliche Installation muss im neuen Zielprojekt laufen, weil das Migrationstool immer an dessen Cloud gebunden ist.
