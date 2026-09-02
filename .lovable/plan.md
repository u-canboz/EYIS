# Erstinstallation stabilisieren, danach Update-Transport bedienbar machen

## Zielsatz

Einmal EYIS installieren und den Update-Transport einrichten. Danach laufen
zukünftige EYIS-Updates weitgehend automatisch. Erstinstallation und
Update Center bleiben strikt getrennt — zwei Prozesse, zwei Oberflächen,
eine gemeinsame Diagnosequelle.

## Reihenfolge (verbindlich)

1. Erstinstallation Blackbox PASS
2. EYIS v1.0.0
3. Update-Setup-Assistent
4. echter Test v1.0.0 → v1.0.1
5. erst danach gilt das Update Center als produktionsreif

Alles unterhalb von Schritt 3 wird nicht begonnen, solange Schritt 1 nicht
nachgewiesen PASS ist.

---

## Schritt 1 — Erstinstallation Blackbox PASS

Ziel: nachweisen, dass EYIS zuverlässig erstmals in ein fremdes Projekt
installiert werden kann — ohne Update-Transport, ohne GitHub, ohne Secrets.

- Vollständigen Blackbox-Durchlauf fahren: `eyis:dist:verify`,
  `eyis:blackbox:simulate`, `qa:install-pack`, `qa:blackbox-preflight`,
  `bun run verify`. Jedes FAIL wird als Befund mit Ursache dokumentiert.
- Installationsstrecke Ende-zu-Ende belegen: Dateisatz → Integration Patches
  → Agent Migration Plan (Schritt 1…n) → Systemseeds → Bootstrap → Owner →
  Doctor → `EYIS READY`.
- Fingerprints als Abschlusskriterium: `schema_fingerprint` **und**
  `system_seed_fingerprint` müssen PASS melden. Struktur allein zählt nicht.
- Gefundene Defekte minimal beheben — keine neuen Features, keine
  Architekturänderung.

Ergebnis: Befundliste mit Status je Prüfung; Schritt 2 startet erst bei
durchgängigem PASS.

## Schritt 2 — EYIS v1.0.0

- Release-Kette unverändert nutzen (Pack signieren → Tarball → Manifest →
  Ed25519-Signatur → Trust Anchor gepinnt).
- Keine Änderung an Signatur- oder Promotion-Logik in diesem Schritt.

## Schritt 3 — Zentrale Capability-Matrix (Single Source of Truth)

Kern der Bedienbarkeit. `probeCapabilities()` bleibt die **einzige** Stelle,
die Zustände berechnet; UI, Doctor und CLI konsumieren nur noch dasselbe
Ergebnis.

```text
probeCapabilities()
        │
   ┌────┼────┐
  UI  Doctor CLI
```

Matrix mit stabilen Schlüsseln und Zuständen (PASS / SETUP_REQUIRED /
MANUAL / FAIL):

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

- `lovable_publish` ist ein eigener Zustand `MANUAL` — kein Fehler, kein
  verstecktes PASS. Es gibt keinen programmatischen Publish-Endpunkt.
- Doctor (`installer/eyis.ts doctor`) und CLI geben exakt diese Matrix aus,
  ohne eigene Ableitungen. Divergenz UI/Doctor/CLI wird per Test verhindert.

## Schritt 3b — Update-Setup-Assistent (nur Update Center)

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
  Remediation) — damit ist jede Blockade im Kundenprojekt aus der Ferne
  diagnostizierbar.
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
dass der Diagnose-Export und `update_config` keine Secrets enthalten.

## Schritt 4 — Echter Update-Test v1.0.0 → v1.0.1

- Minimales v1.0.1 erzeugen und den vollen Lauf gegen eine Nicht-Production-
  Installation fahren: preflight → backup → code → database → deployment →
  doctor.
- Jeder Schritt braucht echten Nachweis; ein übersprungener Schritt wird als
  `skipped` mit Begründung geführt, nicht als PASS.

## Schritt 5 — Freigabe

Update Center gilt erst nach bestandenem Schritt 4 als produktionsreif.
Der Bericht hält je Fähigkeit den belegten Zustand fest.

---

## Bewusst außen vor

- Keine neue Update-Architektur — das hier ist eine Bedien- und
  Automatisierungsschicht über dem bestehenden System.
- Kein Gate-C-Ausbau (Staging, Live-Provider-Schaltung).
- Keine Vermischung von Installations- und Update-Assistent.
- Keine Aufweichung der Production-Sperren.

## Technische Anker

- Fähigkeitsproben: `src/lib/commerce/updates/providers.server.ts`
  (`probeCapabilities`) — wird zur alleinigen Quelle.
- Orchestrierung: `src/lib/commerce/updates/update-center.server.ts`
- UI: `src/routes/_authenticated/app/system/updates.tsx`
- Doctor/CLI: `installer/eyis.ts`, `scripts/commerce-doctor.ts`
- Installationsstrecke: `installer/database/**`, `scripts/eyis-*.ts`
- Persistenz: `commerce_installation.update_config` (kein neues Schema)
